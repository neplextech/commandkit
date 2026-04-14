import EventEmitter from 'node:events';
import type { CommandKitOptions } from './types';
import colors from './utils/colors';
import { createElement, Fragment } from './components';
import { EventInterceptor } from './components/common/EventInterceptor';
import { Awaitable, Client, Events, Locale, Message } from 'discord.js';
import {
  createProxy,
  findAppDirectory,
  getCurrentDirectory,
  SimpleProxy,
} from './utils/utilities';
import { join } from 'node:path';
import { AppCommandHandler } from './app/handlers/AppCommandHandler';
import { CommandsRouter, EventsRouter } from './app/router';
import {
  hydrateRouterTreeArtifact,
  ROUTER_TREE_ARTIFACT_DIRECTORY,
  ROUTER_TREE_ARTIFACT_FILE,
  validateRouterTreeArtifact,
} from './app/router/TreeArtifact';
import { AppEventsHandler } from './app/handlers/AppEventsHandler';
import { CommandKitPluginRuntime } from './plugins/plugin-runtime/CommandKitPluginRuntime';
import { loadConfigFile } from './config/loader';
import {
  COMMANDKIT_BOOTSTRAP_MODE,
  COMMANDKIT_IS_DEV,
} from './utils/constants';
import { registerDevHooks } from './utils/dev-hooks';
import { existsSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { CommandKitEventsChannel } from './events/CommandKitEventsChannel';
import { isRuntimePlugin } from './plugins';
import { generateTypesPackage } from './utils/types-package';
import { Logger } from './logger/Logger';
import { AsyncFunction, GenericFunction } from './context/async-context';
import { FlagStore } from './flags/store';
import { AnalyticsEngine } from './analytics/analytics-engine';
import { ResolvedCommandKitConfig } from './config/utils';
import { getConfig } from './config/config';
import { version } from './version';

/**
 * Configurations for the CommandKit instance.
 */
export interface CommandKitConfiguration {
  /**
   * The default locale for the CommandKit instance. This will be used to infer the locale of the guild or user if it has not been set explicitly.
   * @default Locale.EnglishUS
   */
  defaultLocale: Locale;
  /**
   * A function that returns the command prefix for a given message.
   * This is used to determine how to parse commands from messages.
   * @param message The message to get the command prefix for.
   * @returns The command prefix or an array of prefixes.
   */
  getMessageCommandPrefix: (
    message: Message,
  ) => Awaitable<string | string[] | RegExp>;
}

/**
 * Represents the function executed during the bootstrap phase of CommandKit.
 */
export type BootstrapFunction =
  | GenericFunction<[CommandKit]>
  | AsyncFunction<[CommandKit]>;

const bootstrapHooks = new Set<BootstrapFunction>();
const onApplicationBootstrapHooks = new Set<BootstrapFunction>();

/**
 * Registers a bootstrap hook that will be called when the CommandKit instance is created.
 * This is useful for plugins that need to run some code after the CommandKit instance is fully initialized.
 * Note that not all commandkit dependencies are available at this point. It is recommended to use the `onApplicationBootstrap` hook instead,
 * if you need access to the commandkit dependencies.
 * @param fn The bootstrap function to register.
 * @example ```ts
 * import { onBootstrap } from 'commandkit';
 *
 * onBootstrap(async (commandkit) => {
 *   // Do something with the commandkit instance
 * })
 * ```
 */
export function onBootstrap<F extends BootstrapFunction>(fn: F): void {
  bootstrapHooks.add(fn);
}

/**
 * Registers a bootstrap hook that will be called when the CommandKit instance is created.
 * This is useful for plugins that need to run some code after the CommandKit instance is fully initialized.
 * @param fn The bootstrap function to register.
 * @example ```ts
 * import { onApplicationBootstrap } from 'commandkit';
 *
 * onApplicationBootstrap(async (commandkit) => {
 *   // Do something with the commandkit instance
 * })
 * ```
 */
export function onApplicationBootstrap<F extends BootstrapFunction>(
  fn: F,
): void {
  onApplicationBootstrapHooks.add(fn);
}

/**
 * The commandkit class that serves as the main entry point for the CommandKit framework.
 */
export class CommandKit extends EventEmitter {
  #started = false;
  #hydratedFromArtifact = false;
  #clientProxy: SimpleProxy<Client> | null = createProxy({} as Client);
  #client!: Client;
  /**
   * The event interceptor to quickly register temporary event listeners
   */
  public eventInterceptor!: EventInterceptor;

  /**
   * The static createElement function to create jsx elements
   */
  public static readonly createElement = createElement;
  /**
   * The static Fragment component to create jsx fragments
   */
  public static readonly Fragment = Fragment;

  /**
   * The configuration for the CommandKit instance.
   */
  public readonly appConfig: CommandKitConfiguration = {
    defaultLocale: Locale.EnglishUS,
    getMessageCommandPrefix: () => '!',
  };

  /**
   * The configuration for the CommandKit environment.
   */
  public config: ResolvedCommandKitConfig = getConfig();

  /**
   * A key-value store for storing arbitrary data.
   */
  public readonly store = new Map<string, any>();
  /**
   * A flag store for storing flags that can be used to enable or disable features.
   */
  public readonly flags = new FlagStore();

  /**
   * The command router for the CommandKit instance.
   */
  public commandsRouter!: CommandsRouter;
  /**
   * The events router for the CommandKit instance.
   */
  public eventsRouter!: EventsRouter;
  /**
   * The command handler for the CommandKit instance.
   * This is responsible for handling commands and their execution.
   */
  public commandHandler!: AppCommandHandler;
  /**
   * The event handler for the CommandKit instance.
   * This is responsible for handling events and their execution.
   */
  public eventHandler!: AppEventsHandler;
  /**
   * The plugins runtime for the CommandKit instance.
   */
  public plugins!: CommandKitPluginRuntime;
  /**
   * The events channel for the CommandKit instance. This can be used to emit custom events.
   */
  public events!: CommandKitEventsChannel;
  /**
   * The analytics engine for the CommandKit instance.
   * This is responsible for tracking events and user interactions.
   */
  public analytics!: AnalyticsEngine;

  /**
   * The static instance of CommandKit.
   */
  static instance: CommandKit | undefined = undefined;

  /**
   * Create a new command and event handler with CommandKit.
   * @param options - The default CommandKit configuration.
   */
  constructor(options: CommandKitOptions = {}) {
    if (CommandKit.instance) {
      process.emitWarning(
        'CommandKit instance already exists. Having multiple instance in same project is discouraged and it may lead to unexpected behavior.',
        {
          code: 'MultiInstanceWarning',
        },
      );
    }

    super();

    // lazily load the actual config file
    loadConfigFile().then((config) => (this.config = config));

    if (!CommandKit.instance) {
      CommandKit.instance = this;
    }

    if (options?.client) {
      this.setClient(options.client);
    }

    this.plugins = new CommandKitPluginRuntime(this);
    this.analytics = new AnalyticsEngine(this);

    this.#bootstrapHooks();
  }

  async #bootstrapHooks() {
    for (const hook of bootstrapHooks) {
      try {
        await hook(this);
      } catch (e) {
        Logger.error`Error while executing bootstrap hook: ${e}`;
      } finally {
        bootstrapHooks.delete(hook);
      }
    }

    // force clear just in case we missed something
    bootstrapHooks.clear();
  }

  async #applicationBootstrapHooks() {
    for (const hook of onApplicationBootstrapHooks) {
      try {
        await hook(this);
      } catch (e) {
        Logger.error`Error while executing application bootstrap hook: ${e}`;
      } finally {
        onApplicationBootstrapHooks.delete(hook);
      }
    }
    // force clear just in case we missed something
    onApplicationBootstrapHooks.clear();
  }

  /**
   * Starts the commandkit application.
   * @param token The application token to connect to the discord gateway. If not provided, it will use the `TOKEN` or `DISCORD_TOKEN` environment variable. If set to `false`, it will not login.
   */
  async start(token?: string | false) {
    if (this.#started) return;

    if (!this.#client) {
      throw new Error(
        colors.red('"client" is required when starting CommandKit.'),
      );
    }

    this.eventInterceptor = new EventInterceptor(this.client);

    if (COMMANDKIT_IS_DEV) {
      try {
        registerDevHooks(this);

        await generateTypesPackage();
      } catch (e) {
        // ignore
        if (process.env.COMMANDKIT_DEBUG_TYPEGEN) {
          Logger.error`${e}`;
        }
      }
    }

    await this.loadPlugins();

    await this.#init();

    this.commandHandler.registerCommandHandler();
    this.incrementClientListenersCount();

    if (token !== false && !this.client.isReady()) {
      this.client.once(Events.ClientReady, async () => {
        await this.commandHandler.registrar.register();
      });

      await this.plugins.execute((ctx, plugin) => {
        return plugin.onBeforeClientLogin?.(ctx);
      });

      const botToken =
        token ??
        this.client.token ??
        process.env.TOKEN ??
        process.env.DISCORD_TOKEN;

      await this.client.login(botToken);

      await this.plugins.execute((ctx, plugin) => {
        return plugin.onAfterClientLogin?.(ctx);
      });
    } else if (this.client.isReady()) {
      await this.commandHandler.registrar.register();
    }

    this.#started = true;

    await this.#applicationBootstrapHooks();
  }

  /**
   * Loads all the plugins.
   */
  async loadPlugins() {
    const config = await loadConfigFile();
    const plugins = config.plugins.flat(2).filter((p) => isRuntimePlugin(p));

    if (!plugins.length) return;

    for (const plugin of plugins) {
      await this.plugins.softRegisterPlugin(plugin);
    }
  }

  /**
   * Whether or not the commandkit application has started.
   */
  get started() {
    return this.#started;
  }

  /**
   * Sets the prefix resolver for the command handler.
   * @param resolver The resolver function.
   */
  setPrefixResolver(
    resolver: (message: Message) => Awaitable<string | string[] | RegExp>,
  ) {
    this.appConfig.getMessageCommandPrefix = resolver;
    return this;
  }

  /**
   * Sets the default locale for the command handler.
   * @param locale The default locale.
   */
  setDefaultLocale(locale: Locale) {
    this.appConfig.defaultLocale = locale;
    return this;
  }

  /**
   * Get the client attached to this CommandKit instance.
   */
  get client(): Client {
    const client = this.#client || this.#clientProxy?.proxy;

    if (!client) {
      throw new Error('Client instance is not set');
    }

    return client;
  }

  /**
   * Sets the client attached to this CommandKit instance.
   * @param client The client to set.
   */
  setClient(client: Client) {
    this.#client = client;

    // update the proxy target if it exists
    if (this.#clientProxy) {
      // this is a hack to update the proxy target
      // because some of the dependencies of commandkit may
      // depend on the client instance
      this.#clientProxy.setTarget(client);
      this.#clientProxy = null;
    }

    return this;
  }

  async #init() {
    const appDir = this.getAppDirectory();
    if (!appDir) {
      throw new Error(
        'CommandKit could not determine the application directory. ' +
          'This issue is common when you are not using the `commandkit dev` command to start the project. ' +
          'You can either use `commandkit dev` to start the project, or set the `COMMANDKIT_IS_CLI=true` environment variable (Note that adding this to `.env` file may not work). ' +
          'If you are trying to start the production build, make sure your current working directory is the directory where `commandkit.config.ts` file is located.',
      );
    }

    const commandsPath = this.getPath('commands')!;
    const events = this.getPath('events')!;

    this.commandHandler = new AppCommandHandler(this);
    this.eventHandler = new AppEventsHandler(this);
    this.events = new CommandKitEventsChannel(this);

    this.commandsRouter = new CommandsRouter({
      entrypoint: commandsPath,
    });

    await this.plugins.execute((ctx, plugin) => {
      return plugin.onCommandsRouterInit(ctx);
    });

    this.eventsRouter = new EventsRouter({
      entrypoints: [events],
    });

    await this.plugins.execute((ctx, plugin) => {
      return plugin.onEventsRouterInit(ctx);
    });

    this.#hydratedFromArtifact = await this.#hydrateRoutersFromArtifact();

    await this.#initEvents();
    await this.#initCommands();
  }

  async #hydrateRoutersFromArtifact() {
    if (COMMANDKIT_IS_DEV) return false;
    if (COMMANDKIT_BOOTSTRAP_MODE !== 'production') return false;
    if (!this.config.experimental.pregenerateCommands) return false;

    const outputRoot = getCurrentDirectory();
    const artifactPath = join(
      outputRoot,
      ROUTER_TREE_ARTIFACT_DIRECTORY,
      ROUTER_TREE_ARTIFACT_FILE,
    );

    if (!existsSync(artifactPath)) {
      return false;
    }

    try {
      const json = await readFile(artifactPath, 'utf8');
      const parsed = JSON.parse(json);

      if (!validateRouterTreeArtifact(parsed, version)) {
        Logger.warn(
          `Ignoring router tree artifact at ${artifactPath}: schema/version mismatch. Falling back to dynamic filesystem resolution.`,
        );
        return false;
      }

      const hydrated = hydrateRouterTreeArtifact(parsed, outputRoot);

      this.commandsRouter.populate(hydrated.commands);
      this.eventsRouter.populate(hydrated.events);

      return true;
    } catch (error) {
      Logger.warn(
        `Failed to load router tree artifact at ${artifactPath}. Falling back to dynamic filesystem resolution. ${error}`,
      );
      return false;
    }
  }

  async #initCommands() {
    if (!this.#hydratedFromArtifact && this.commandsRouter.isValidPath()) {
      const result = await this.commandsRouter.scan();

      if (COMMANDKIT_IS_DEV) {
        writeFileSync(
          './.commandkit/commands.json',
          JSON.stringify(result, null, 2),
        );
      }
    }

    await this.commandHandler.loadCommands();

    this.commandHandler.printBanner();
  }

  async #initEvents() {
    if (!this.#hydratedFromArtifact && this.eventsRouter.isValidPath()) {
      await this.eventsRouter.scan();
    }

    await this.eventHandler.loadEvents();
  }

  /**
   * Updates application commands with the latest from "commandsPath".
   */
  async reloadCommands() {
    await this.commandHandler.reloadCommands();
  }

  /**
   * Updates application events with the latest from "eventsPath".
   */
  async reloadEvents() {
    await this.eventHandler.reloadEvents();
  }

  /**
   * Increment the client listeners count.
   */
  incrementClientListenersCount() {
    this.client.setMaxListeners(this.client.getMaxListeners() + 1);
  }

  /**
   * Decrement the client listeners count.
   */
  decrementClientListenersCount() {
    this.client.setMaxListeners(this.client.getMaxListeners() - 1);
  }

  /**
   * Path to the app directory. Returns `null` if not found.
   * The lookup order is:
   * - `./app`
   * - `./src/app`
   */
  getAppDirectory() {
    return findAppDirectory();
  }

  /**
   * Get the path to the commands or events directory.
   * @param to The type of path to get, either 'commands' or 'events'.
   * @returns The path to the commands or events directory
   */
  getPath(to: 'commands' | 'events') {
    const appDir = this.getAppDirectory();
    if (!appDir) return null;

    switch (to) {
      case 'commands':
        return join(appDir, 'commands');
      case 'events':
        return join(appDir, 'events');
      default:
        return to satisfies never;
    }
  }
}

/**
 * The singleton instance of CommandKit.
 */
export const commandkit = CommandKit.instance || new CommandKit();
