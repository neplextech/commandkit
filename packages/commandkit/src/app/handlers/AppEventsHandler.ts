import { Collection } from 'discord.js';
import type { CommandKit } from '../../commandkit';
import { ListenerFunction } from '../../events/CommandKitEventsChannel';
import { Logger } from '../../logger/Logger';
import { toFileURL } from '../../utils/resolve-file-url';
import { runInEventWorkerContext } from '../events/EventWorkerContext';
import { ParsedEvent } from '../router';
import { CommandKitEventDispatch } from '../../plugins';
import { CommandKitErrorCodes, isErrorType } from '../../utils/error-codes';

/**
 * Represents an event listener with its configuration.
 */
export type EventListener = {
  handler: ListenerFunction;
  once: boolean;
  parallel: boolean;
};

/**
 * Represents a loaded event with all its listeners.
 */
export interface LoadedEvent {
  name: string;
  namespace: string | null;
  event: ParsedEvent;
  listeners: EventListener[];
  mainListener?: EventListener;
  executedOnceListeners?: Set<ListenerFunction>; // Track executed once listeners
}

/**
 * Data structure representing loaded event information for external consumption.
 */
export interface AppEventsHandlerLoadedData {
  name: string;
  namespace: string | null;
  onceListeners: number;
  regularListeners: number;
  metadata: ParsedEvent;
}

/**
 * Handles Discord.js events and CommandKit custom events with support for namespacing and middleware.
 */
export class AppEventsHandler {
  /**
   * @private
   * @internal
   */
  private loadedEvents = new Collection<string, LoadedEvent>();

  /**
   * Creates a new AppEventsHandler instance.
   * @param commandkit - The CommandKit instance
   */
  public constructor(public readonly commandkit: CommandKit) {}

  /**
   * Gets information about all loaded events.
   * @returns Array of loaded event data
   */
  public getEvents(): AppEventsHandlerLoadedData[] {
    if (this.loadedEvents.size === 0) return [];

    const events = this.loadedEvents.toJSON();

    return events.map(
      (event) =>
        ({
          name: event.name,
          namespace: event.namespace,
          onceListeners: event.listeners.filter((listener) => listener.once)
            .length,
          regularListeners: event.listeners.filter((listener) => !listener.once)
            .length,
          metadata: event.event,
        }) satisfies AppEventsHandlerLoadedData,
    );
  }

  /**
   * Reloads all events by unregistering existing ones and loading them again.
   */
  public async reloadEvents() {
    this.unregisterAll();
    await this.loadEvents();
  }

  /**
   * Loads all events from the events router and registers them with Discord.js client.
   */
  public async loadEvents() {
    await this.commandkit.plugins.execute((ctx, plugin) => {
      return plugin.onBeforeEventsLoad(ctx);
    });

    const router = this.commandkit.eventsRouter;

    const events = await router.scan();

    for (const event of Object.values(events)) {
      const listeners: EventListener[] = [];

      for (const listener of event.listeners) {
        const handler = await import(toFileURL(listener, true));

        if (!handler.default || typeof handler.default !== 'function') {
          Logger.warn`Event handler for ${event.event}${event.namespace ? ` of namespace ${event.namespace}` : ''} at "${listener}" does not have a default export or is not a function. Skipping...`;
          continue;
        }

        listeners.push({
          handler: handler.default,
          once: !!handler.once,
          parallel: !!handler.parallel,
        });
      }

      const len = listeners.length;

      if (!len) {
        Logger.warn(
          `Event ${event.event}${event.namespace ? ` of namespace ${event.namespace}` : ''} does not have any listeners`,
        );
      }

      const key = `${event.namespace ? `${event.namespace}:` : ''}${event.event}`;

      this.loadedEvents.set(key, {
        name: event.event,
        namespace: event.namespace,
        event,
        listeners,
      });

      Logger.info(
        `✨ Loaded event ${event.event}${event.namespace ? ` of namespace ${event.namespace}` : ''} with ${len} listener${len === 1 ? '' : 's'}`,
      );
    }

    this.registerAllClientEvents();

    await this.commandkit.plugins.execute((ctx, plugin) => {
      return plugin.onAfterEventsLoad(ctx);
    });
  }

  /**
   * Unregisters all event listeners and clears loaded events.
   */
  public unregisterAll() {
    this.unregisterAllClientListeners();
    this.loadedEvents.clear();
  }

  /**
   * Registers all loaded events with the Discord.js client and CommandKit event system.
   */
  public registerAllClientEvents() {
    const client = this.commandkit.client;

    for (const [key, data] of this.loadedEvents.entries()) {
      const { name, listeners, namespace } = data;

      // Separate listeners into "once" and "on" groups
      const onceListeners = listeners.filter((listener) => listener.once);
      const onListeners = listeners.filter((listener) => !listener.once);

      // Further separate into parallel and sequential groups
      const onParallelListeners = onListeners.filter(
        (listener) => listener.parallel,
      );
      const onSequentialListeners = onListeners.filter(
        (listener) => !listener.parallel,
      );
      const onceParallelListeners = onceListeners.filter(
        (listener) => listener.parallel,
      );
      const onceSequentialListeners = onceListeners.filter(
        (listener) => !listener.parallel,
      );

      // Initialize set to track executed once listeners
      const executedOnceListeners = new Set<ListenerFunction>();

      // Create main handler for regular "on" listeners
      const mainHandler: ListenerFunction = async (...args) => {
        let accepted = false;

        const event: CommandKitEventDispatch = {
          name,
          args,
          namespace: namespace ?? null,
          once: false,
          metadata: data.event,
          accept() {
            if (accepted) return;
            accepted = true;
          },
        };

        await this.commandkit.plugins
          .execute(async (ctx, plugin) => {
            if (accepted) return;
            return plugin.willEmitEvent?.(ctx, event);
          })
          .catch(Object);

        await runInEventWorkerContext(
          {
            event: name,
            namespace: namespace ?? null,
            data: data.event,
            commandkit: this.commandkit,
            arguments: args,
            variables: new Map(),
          },
          async () => {
            // Execute parallel listeners first using Promise.all
            if (onParallelListeners.length > 0) {
              await Promise.all(
                onParallelListeners.map(async (listener) => {
                  try {
                    await listener.handler(...args, client, this.commandkit);
                  } catch (e) {
                    // Log errors but don't stop other parallel listeners
                    Logger.error`Error handling event ${name}${
                      namespace ? ` of namespace ${namespace}` : ''
                    }: ${e}`;
                  }
                }),
              );
            }

            // Execute sequential listeners in order
            for (const listener of onSequentialListeners) {
              try {
                await listener.handler(...args, client, this.commandkit);
              } catch (e) {
                // Check if this is a stop propagation signal
                if (isErrorType(e, CommandKitErrorCodes.StopEvents)) {
                  Logger.debug(
                    `Event propagation stopped for ${name}${
                      namespace ? ` of namespace ${namespace}` : ''
                    }`,
                  );
                  break; // Stop executing remaining listeners
                }

                // Otherwise log the error as usual
                Logger.error`Error handling event ${name}${
                  namespace ? ` of namespace ${namespace}` : ''
                }: ${e}`;
              }
            }
          },
        );
      };

      // Create handler for "once" listeners with cleanup logic
      const onceHandler: ListenerFunction = async (...args) => {
        let broken = false;
        let accepted = false;

        const event: CommandKitEventDispatch = {
          name,
          args,
          namespace: namespace ?? null,
          once: true,
          metadata: data.event,
          accept() {
            if (accepted) return;
            accepted = true;
          },
        };

        await this.commandkit.plugins
          .execute(async (ctx, plugin) => {
            if (accepted) return;
            return plugin.willEmitEvent?.(ctx, event);
          })
          .catch(Object);

        // Execute parallel once listeners first using Promise.all
        if (onceParallelListeners.length > 0) {
          await Promise.all(
            onceParallelListeners.map(async (listener) => {
              return runInEventWorkerContext(
                {
                  event: name,
                  namespace: namespace ?? null,
                  data: data.event,
                  commandkit: this.commandkit,
                  arguments: args,
                  variables: new Map(),
                },
                async () => {
                  try {
                    // Skip if already executed
                    if (executedOnceListeners.has(listener.handler)) return;

                    await listener.handler(...args, client, this.commandkit);
                    executedOnceListeners.add(listener.handler);
                  } catch (e) {
                    // Log errors but don't stop other parallel listeners
                    Logger.error`Error handling event ${name}${
                      namespace ? ` of namespace ${namespace}` : ''
                    }: ${e}`;
                  }
                },
              );
            }),
          );
        }

        // Execute sequential once listeners in order
        for (const listener of onceSequentialListeners) {
          if (broken) break; // Stop executing remaining listeners if propagation was stopped

          await runInEventWorkerContext(
            {
              event: name,
              namespace: namespace ?? null,
              data: data.event,
              commandkit: this.commandkit,
              arguments: args,
              variables: new Map(),
            },
            async () => {
              try {
                // Skip if already executed (shouldn't happen with proper .once registration, but just in case)
                if (executedOnceListeners.has(listener.handler)) return;

                await listener.handler(...args, client, this.commandkit);
                executedOnceListeners.add(listener.handler);
              } catch (e) {
                // Check if this is a stop propagation signal
                if (isErrorType(e, CommandKitErrorCodes.StopEvents)) {
                  Logger.debug(
                    `Event propagation stopped for ${name}${
                      namespace ? ` of namespace ${namespace}` : ''
                    }`,
                  );
                  broken = true; // Stop executing remaining listeners
                }

                // Otherwise log the error as usual
                Logger.error`Error handling event ${name}${
                  namespace ? ` of namespace ${namespace}` : ''
                }: ${e}`;
              }
            },
          );
        }

        // Cleanup: Remove once listeners that have been executed
        if (
          executedOnceListeners.size === onceListeners.length &&
          onListeners.length === 0
        ) {
          // If all once listeners executed and no regular listeners, remove event entirely
          this.loadedEvents.delete(key);
          Logger.info(
            `🧹 Cleaned up completed once-only event ${name}${
              namespace ? ` of namespace ${namespace}` : ''
            }`,
          );
        }
      };

      // Store main handlers in loadedEvents for later unregistration
      this.loadedEvents.set(key, {
        ...data,
        mainListener:
          onListeners.length > 0
            ? { handler: mainHandler, once: false, parallel: false }
            : undefined,
        executedOnceListeners,
      });

      // Register handlers with appropriate methods
      if (namespace) {
        if (onListeners.length > 0) {
          this.commandkit.events.on(namespace, name, mainHandler);
        }
        if (onceListeners.length > 0) {
          this.commandkit.events.once(namespace, name, onceHandler);
        }
      } else {
        if (onListeners.length > 0) {
          client.on(name, mainHandler);
        }
        if (onceListeners.length > 0) {
          client.once(name, onceHandler);
        }
      }

      Logger.info(
        `🔌 Registered event ${name}${
          namespace ? ` of namespace ${namespace}` : ''
        } (${onSequentialListeners.length} sequential, ${onParallelListeners.length} parallel, ${onceSequentialListeners.length} once-sequential, ${onceParallelListeners.length} once-parallel)`,
      );
    }
  }

  /**
   * Unregisters all client event listeners and cleans up loaded events.
   */
  public unregisterAllClientListeners() {
    const client = this.commandkit.client;

    for (const [
      key,
      { name, mainListener, namespace },
    ] of this.loadedEvents.entries()) {
      if (mainListener) {
        if (namespace) {
          this.commandkit.events.off(namespace, name, mainListener.handler);
        } else {
          client.off(name, mainListener.handler);
        }
      } else {
        if (namespace) {
          this.commandkit.events.removeAllListeners(namespace, name);
        } else {
          client.removeAllListeners(name);
        }
      }

      this.loadedEvents.delete(key);

      Logger.info(
        `🗑️ Unregistered event ${name}${
          namespace ? ` of namespace ${namespace}` : ''
        }`,
      );
    }
  }
}
