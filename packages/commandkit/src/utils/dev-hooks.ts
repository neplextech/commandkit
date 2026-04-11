import type { CommandKit } from '../commandkit';
import { Logger } from '../logger/Logger';
import { COMMANDKIT_IS_DEV, HMREventType } from './constants';

/**
 * Represents HMR inter-process communication messages.
 */
export interface IpcMessageCommand {
  /**
   * The type of HMR event being communicated.
   */
  event: HMREventType;
  /**
   * The path associated with the HMR event.
   */
  path: string;
  /**
   * An optional identifier for the HMR event, used for acknowledgment.
   */
  id?: string;
}

/**
 * Represents an HMR event in CommandKit.
 */
export interface CommandKitHMREvent {
  /**
   * The type of HMR event.
   */
  event: HMREventType;
  /**
   * The path associated with the HMR event.
   */
  path: string;
  /**
   * Accepts the HMR event, indicating that it has been handled.
   * This prevents further processing of the event.
   */
  accept: () => void;
  /**
   * Prevents the default action for the HMR event.
   * This can be used to stop further processing of the event.
   */
  preventDefault: () => void;
}

/**
 * Registers development hooks for CommandKit to handle HMR (Hot Module Replacement) events.
 * @param commandkit - The CommandKit instance to register hooks for.
 */
export function registerDevHooks(commandkit: CommandKit) {
  if (!COMMANDKIT_IS_DEV) return;

  process.on('message', async (message) => {
    if (typeof message !== 'object' || message === null) return;

    const { event, path, id } = message as IpcMessageCommand;
    if (!event) return;

    if (process.env.COMMANDKIT_DEBUG_HMR === 'true') {
      Logger.info(`Received HMR event: ${event}${path ? ` for ${path}` : ''}`);
    }

    let accepted = false,
      prevented = false,
      handled = false;

    const hmrEvent: CommandKitHMREvent = {
      accept() {
        accepted = true;
      },
      preventDefault() {
        prevented = true;
      },
      path,
      event,
    };

    try {
      await commandkit.plugins.execute(async (ctx, plugin) => {
        // some plugin accepted the event
        if (accepted) return;
        await plugin.performHMR?.(ctx, hmrEvent);
      });

      // plugin took care of it
      if (prevented) return;

      switch (event) {
        case HMREventType.ReloadCommands:
          await commandkit.commandHandler.reloadCommands();
          handled = true;
          break;
        case HMREventType.ReloadEvents:
          await commandkit.eventHandler.reloadEvents();
          handled = true;
          break;
        case HMREventType.Unknown:
          // Handle unknown events if needed
          handled = false;
          break;
        default:
          // invalid hmr event
          break;
      }
    } finally {
      // Send acknowledgment back to dev server if an id was provided
      if (id && process.send) {
        process.send({
          type: 'commandkit-hmr-ack',
          id,
          handled: handled || accepted,
        });
      }
    }
  });
}
