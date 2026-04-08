import { ChatInputCommandInteraction, Interaction, Message } from 'discord.js';
import { AnalyticsEvents } from '../../analytics/constants';
import {
  makeContextAwareFunction,
  provideContext,
  useEnvironment,
} from '../../context/async-context';
import {
  CommandKitEnvironment,
  CommandKitEnvironmentType,
} from '../../context/environment';
import { Logger } from '../../logger/Logger';
import { CommandKitErrorCodes, isErrorType } from '../../utils/error-codes';
import {
  AppCommandHandler,
  PreparedAppCommandExecution,
  RunCommand,
} from '../handlers/AppCommandHandler';
import { CommandExecutionMode, MiddlewareContext } from './Context';

/**
 * Options for running a command in CommandKit.
 */
export interface RunCommandOptions {
  /**
   * The handler to use for executing the command.
   * If not provided, the execution mode will determine the handler.
   * For example, 'chatInputCommand', 'message', etc.
   */
  handler?: string;
  /**
   * Whether to throw an error if the command execution fails.
   * If true, any error during execution will be thrown.
   * Default is false, which means errors will be logged but not thrown.
   * @default false
   */
  throwOnError?: boolean;
}

/**
 * Handles the execution of application commands for CommandKit.
 * Manages middleware execution, environment setup, and command invocation.
 */
export class AppCommandRunner {
  /**
   * Creates a new AppCommandRunner instance.
   * @param handler - The app command handler instance to use for command execution
   */
  public constructor(private handler: AppCommandHandler) {}

  /**
   * Executes a prepared command with middleware support and environment setup.
   * Handles the complete command lifecycle including before/after middleware execution.
   * @param prepared - The prepared command execution data
   * @param source - The source interaction or message that triggered the command
   * @param options - The options for running the command
   */
  public async runCommand(
    prepared: PreparedAppCommandExecution,
    source: Interaction | Message,
    options?: RunCommandOptions,
  ) {
    const { commandkit } = this.handler;

    const shouldThrowOnError = !!options?.throwOnError;

    const executionMode = this.getExecutionMode(source);

    let runCommand: RunCommand | null = null;

    const env = new CommandKitEnvironment(commandkit);
    env.setType(CommandKitEnvironmentType.CommandHandler);
    env.variables.set('commandHandlerType', 'app');
    env.variables.set(
      'currentCommandName',
      (prepared.command.data.command as Record<string, any>).__routeKey ??
        prepared.command.command.name,
    );
    env.variables.set('execHandlerKind', executionMode);
    env.variables.set('customHandler', options?.handler ?? null);

    try {
      const middlewareCtx = new MiddlewareContext(commandkit, {
        command: prepared.command,
        environment: env,
        executionMode,
        interaction: !(source instanceof Message)
          ? (source as ChatInputCommandInteraction)
          : (null as never),
        message: source instanceof Message ? source : (null as never),
        forwarded: false,
        customArgs: {
          setCommandRunner: (fn: RunCommand) => {
            runCommand = fn;
          },
        },
        messageCommandParser: prepared.messageCommandParser,
      });

      const beforeMiddlewares = prepared.middlewares.filter(
        (m) => m.data.beforeExecute,
      );

      let beforeMiddlewaresStopped = false;

      // Run middleware before command execution
      if (beforeMiddlewares.length) {
        await provideContext(env, async () => {
          for (const middleware of beforeMiddlewares) {
            try {
              await middleware.data.beforeExecute(middlewareCtx);
            } catch (e) {
              if (isErrorType(e, CommandKitErrorCodes.StopMiddlewares)) {
                beforeMiddlewaresStopped = true;
                Logger.debug(
                  `Middleware propagation stopped for command "${middlewareCtx.commandName}". stopMiddlewares() was called inside a beforeExecute function at "${middleware.middleware.relativePath}"`,
                );
                break; // Stop the middleware loop if `stopMiddlewares()` is called.
              }

              if (
                isErrorType(e, [
                  CommandKitErrorCodes.ForwardedCommand,
                  CommandKitErrorCodes.InvalidCommandPrefix,
                ])
              ) {
                continue;
              }

              throw e;
            }
          }
        });
      }

      let result: any;

      let stopMiddlewaresCalledInCmd = false;

      // If no `stopMiddlewares()` was called in a `beforeExecute` middleware, try to run the command
      if (!beforeMiddlewaresStopped) {
        const targetData = prepared.command.data;
        const fn = targetData[options?.handler || executionMode];

        if (!fn) {
          Logger.warn(
            `Command ${prepared.command.command.name} has no handler for ${executionMode}`,
          );
        }

        const analytics = commandkit.analytics;

        if (fn) {
          try {
            const _executeCommand = makeContextAwareFunction(
              env,
              async () => {
                env.registerDeferredFunction(async (env) => {
                  env.markEnd();
                  const error = env.getExecutionError();
                  const marker = env.getMarker();
                  const time = `${env.getExecutionTime().toFixed(2)}ms`;

                  if (error) {
                    Logger.error`[${marker} - ${time}] Error executing command: ${error}`;

                    const commandName =
                      (prepared.command?.data?.command as Record<string, any>)
                        ?.__routeKey ??
                      prepared.command?.data?.command?.name ??
                      prepared.command.command.name;

                    await analytics.track({
                      name: AnalyticsEvents.COMMAND_EXECUTION,
                      id: commandName,
                      data: {
                        error: true,
                        executionTime: env.getExecutionTime().toFixed(2),
                        type: executionMode,
                        command: commandName,
                      },
                    });

                    return;
                  }

                  Logger.info(
                    `[${marker} - ${time}] Command executed successfully`,
                  );

                  const commandName =
                    (prepared.command?.data?.command as Record<string, any>)
                      ?.__routeKey ??
                    prepared.command?.data?.command?.name ??
                    prepared.command.command.name;

                  await analytics.track({
                    name: AnalyticsEvents.COMMAND_EXECUTION,
                    id: commandName,
                    data: {
                      error: false,
                      executionTime: env.getExecutionTime().toFixed(2),
                      type: executionMode,
                      command: commandName,
                    },
                  });
                });

                return fn(middlewareCtx.clone());
              },
              this.#finalizer.bind(this),
            );

            const executeCommand =
              runCommand != null
                ? (runCommand as RunCommand)(_executeCommand)
                : _executeCommand;

            env.markStart(
              ((prepared.command.data.command as Record<string, any>)
                .__routeKey as string | undefined) ??
                prepared.command.data.command.name,
            );

            const res = await commandkit.plugins.execute(
              async (ctx, plugin) => {
                return plugin.executeCommand(
                  ctx,
                  env,
                  source,
                  prepared,
                  executeCommand,
                );
              },
            );

            if (!res) {
              result = await executeCommand();
            }
          } catch (e) {
            if (isErrorType(e, CommandKitErrorCodes.StopMiddlewares)) {
              stopMiddlewaresCalledInCmd = true;
              Logger.debug(
                `Middleware propagation stopped for command "${middlewareCtx.commandName}". stopMiddlewares() was called by the command itself`,
              );
            } else if (!isErrorType(e, CommandKitErrorCodes.ForwardedCommand)) {
              if (shouldThrowOnError) {
                throw e;
              }
              Logger.error`${e}`;
            }
          }
        }
      } else {
        result = {
          error: true,
          message:
            'Command execution was cancelled by a beforeExecute middleware.',
        };
      }

      const afterMiddlewares = prepared.middlewares.filter(
        (m) => m.data.afterExecute,
      );

      // Run middleware after command execution only if `stopMiddlewares()` wasn't
      // called in either `beforeExecute` middleware or in the command itself.
      if (
        !beforeMiddlewaresStopped &&
        !stopMiddlewaresCalledInCmd &&
        afterMiddlewares.length
      ) {
        await provideContext(env, async () => {
          for (const middleware of afterMiddlewares) {
            try {
              await middleware.data.afterExecute(middlewareCtx);
            } catch (e) {
              if (isErrorType(e, CommandKitErrorCodes.StopMiddlewares)) {
                Logger.debug(
                  `Middleware propagation stopped for command "${middlewareCtx.commandName}". stopMiddlewares() was called inside an afterExecute function at "${middleware.middleware.relativePath}"`,
                );
                break; // Stop the afterExecute middleware loop if `stopMiddlewares()` is called.
              }
              throw e;
            }
          }
        });
      }

      return result;
    } finally {
      await this.#finalizer(env, false);
    }
  }

  /**
   * @private
   * @internal
   * Finalizes command execution by running deferred functions and plugin cleanup.
   */
  async #finalizer(env?: CommandKitEnvironment, runPlugins = true) {
    env ??= useEnvironment();

    await env.runDeferredFunctions();

    env.clearAllDeferredFunctions();

    // plugins may have their own deferred function, useful for cleanup or post-command analytics
    if (runPlugins) {
      await this.handler.commandkit.plugins.execute(async (ctx, plugin) => {
        await plugin.onAfterCommand(ctx, env);
      });
    }
  }

  /**
   * Determines the execution mode based on the source of the command.
   * @param source - The interaction or message that triggered the command
   * @returns The appropriate command execution mode
   */
  public getExecutionMode(source: Interaction | Message): CommandExecutionMode {
    if (source instanceof Message) return CommandExecutionMode.Message;
    if (source.isChatInputCommand())
      return CommandExecutionMode.ChatInputCommand;
    if (source.isAutocomplete()) {
      return CommandExecutionMode.Autocomplete;
    }
    if (source.isMessageContextMenuCommand()) {
      return CommandExecutionMode.MessageContextMenu;
    }
    if (source.isUserContextMenuCommand()) {
      return CommandExecutionMode.UserContextMenu;
    }

    return null as never;
  }
}
