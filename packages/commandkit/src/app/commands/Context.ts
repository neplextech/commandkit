import {
  AutocompleteInteraction,
  Awaitable,
  ChatInputCommandInteraction,
  Client,
  Collection,
  Guild,
  Interaction,
  Locale,
  Message,
  MessageContextMenuCommandInteraction,
  TextBasedChannel,
  UserContextMenuCommandInteraction,
} from 'discord.js';
import type { CommandKit } from '../../commandkit';
import { GenericFunction, getContext } from '../../context/async-context';
import { CommandKitEnvironment } from '../../context/environment';
import {
  LoadedCommand,
  ResolvableCommand,
  RunCommand,
} from '../handlers/AppCommandHandler';
import { redirect } from '../interrupt/signals';
import {
  MessageCommandOptions,
  MessageCommandParser,
} from './MessageCommandParser';

/**
 * Enumeration of different command execution modes supported by CommandKit.
 */
export const CommandExecutionMode = {
  ChatInputCommand: 'chatInput',
  MessageContextMenu: 'messageContextMenu',
  UserContextMenu: 'userContextMenu',
  Autocomplete: 'autocomplete',
  Message: 'message',
} as const;

/**
 * Type representing the possible command execution modes.
 */
export type CommandExecutionMode =
  (typeof CommandExecutionMode)[keyof typeof CommandExecutionMode];

/**
 * Parameters required to create a command context.
 */
export interface ContextParameters<
  T extends CommandExecutionMode,
  Args = Record<string, any>,
> {
  command: LoadedCommand;
  environment?: CommandKitEnvironment;
  executionMode: T;
  interaction: T extends 'chatInput'
    ? ChatInputCommandInteraction
    : T extends 'messageContextMenu'
      ? MessageContextMenuCommandInteraction
      : T extends 'userContextMenu'
        ? UserContextMenuCommandInteraction
        : T extends 'autocomplete'
          ? AutocompleteInteraction
          : never;
  message: T extends 'message' ? Message : never;
  forwarded?: boolean;
  messageCommandParser?: T extends 'message' ? MessageCommandParser : never;
  store?: Collection<string, any>;
  customArgs?: Args;
}

/**
 * Context for message-based commands.
 */
export type MessageCommandContext = Context<'message'>;

/**
 * Context for interaction-based commands.
 */
export type InteractionCommandContext = Context<
  'autocomplete' | 'chatInput' | 'messageContextMenu' | 'userContextMenu'
>;

/**
 * Middleware context for message-based commands.
 */
export type MessageCommandMiddlewareContext = MiddlewareContext<'message'>;

/**
 * Middleware context for interaction-based commands.
 */
export type InteractionCommandMiddlewareContext = MiddlewareContext<
  'autocomplete' | 'chatInput' | 'messageContextMenu' | 'userContextMenu'
>;

/**
 * Context for chat input (slash) commands.
 */
export type ChatInputCommandContext = Context<'chatInput'>;

/**
 * Middleware context for slash commands.
 */
export type SlashCommandMiddlewareContext = MiddlewareContext<'chatInput'>;

/**
 * Context for autocomplete interactions.
 */
export type AutocompleteCommandContext = Context<'autocomplete'>;

/**
 * Middleware context for autocomplete interactions.
 */
export type AutocompleteCommandMiddlewareContext =
  MiddlewareContext<'autocomplete'>;

/**
 * Context for message context menu commands.
 */
export type MessageContextMenuCommandContext = Context<'messageContextMenu'>;

/**
 * Middleware context for message context menu commands.
 */
export type MessageContextMenuCommandMiddlewareContext =
  MiddlewareContext<'messageContextMenu'>;

/**
 * Context for user context menu commands.
 */
export type UserContextMenuCommandContext = Context<'userContextMenu'>;

/**
 * Middleware context for user context menu commands.
 */
export type UserContextMenuCommandMiddlewareContext =
  MiddlewareContext<'userContextMenu'>;

/**
 * Type representing command context options based on execution mode.
 */
export type CommandContextOptions<T extends CommandExecutionMode> =
  T extends 'message'
    ? MessageCommandOptions
    : T extends 'chatInput'
      ? ChatInputCommandInteraction['options']
      : T extends 'autocomplete'
        ? AutocompleteInteraction['options']
        : T extends 'messageContextMenu'
          ? MessageContextMenuCommandInteraction['options']
          : T extends 'userContextMenu'
            ? UserContextMenuCommandInteraction['options']
            : never;

/**
 * Generic type for command execution functions.
 */
export type AnyCommandExecute<ContextType extends Context = Context> = (
  ctx: ContextType,
) => Awaitable<unknown>;

/**
 * Type for chat input command execution functions.
 */
export type ChatInputCommand = AnyCommandExecute<ChatInputCommandContext>;

/**
 * Type for autocomplete command execution functions.
 */
export type AutocompleteCommand = AnyCommandExecute<AutocompleteCommandContext>;

/**
 * Type for message context menu command execution functions.
 */
export type MessageContextMenuCommand =
  AnyCommandExecute<MessageContextMenuCommandContext>;

/**
 * Type for user context menu command execution functions.
 */
export type UserContextMenuCommand =
  AnyCommandExecute<UserContextMenuCommandContext>;

/**
 * Type for message command execution functions.
 */
export type MessageCommand = AnyCommandExecute<MessageCommandContext>;

/**
 * Arguments for middleware context.
 */
export interface MiddlewareContextArgs {
  setCommandRunner?: GenericFunction<[RunCommand]>;
}

/**
 * Represents the execution context for a command, providing access to Discord.js objects,
 * command metadata, and various utility methods for command execution.
 */
export class Context<
  ExecutionMode extends CommandExecutionMode = CommandExecutionMode,
  Args extends Record<string, any> = Record<string, any>,
> {
  /**
   * The interaction that triggered the command.
   */
  public readonly interaction: ContextParameters<ExecutionMode>['interaction'];

  /**
   * The message that triggered the command.
   */
  public readonly message: ContextParameters<ExecutionMode>['message'];

  /**
   * The guild where the command was triggered.
   */
  public readonly guild!: Guild | null;

  /**
   * The guild ID where the command was triggered.
   */
  public readonly guildId!: string | null;

  /**
   * The channel where the command was triggered.
   */
  public readonly channel!: TextBasedChannel | null;

  /**
   * The channel id where the command was triggered.
   */
  public readonly channelId!: string | null;

  /**
   * The client instance.
   */
  public readonly client: Client<true>;

  /**
   * The command that this context belongs to.
   */
  public readonly command: LoadedCommand;

  /**
   * @private
   * @internal
   */
  #store: Collection<any, any>;

  /**
   * @private
   * @internal
   */
  private _locale: Locale | null = null;

  /**
   * Creates a new command context.
   * @param commandkit The command kit instance.
   * @param config The context parameters.
   */
  public constructor(
    public readonly commandkit: CommandKit,
    protected readonly config: ContextParameters<ExecutionMode, Args>,
  ) {
    // these are assigned to readonly properties to make them accessible via object destructuring
    this.interaction = config.interaction;
    this.message = config.message;
    this.client = commandkit.client as Client<true>;
    this.#store = config.environment?.store ?? config.store ?? new Collection();
    this.command = config.command;

    if (config.interaction) {
      this.guild = config.interaction.guild;
      this.guildId = config.interaction.guildId;
      this.channel = config.interaction.channel;
      this.channelId = config.interaction.channelId;
    }

    if (config.message) {
      this.guild = config.message.guild;
      this.guildId = config.message.guildId;
      this.channel = config.message.channel;
      this.channelId = config.message.channelId;
    }

    if (this.config.environment) {
      this.config.environment.setContext(this);
    }
  }

  /**
   * The shared key-value store for this context. This can be used to store data that needs to be shared between middlewares or commands.
   * This store is shared across all contexts in the same command execution, including the cloned contexts and middleware contexts.
   */
  public get store() {
    return this.config.environment?.store ?? this.#store;
  }

  /**
   * Gets the name of the current command.
   */
  public get commandName(): string {
    const routeKey = (this.command.data.command as Record<string, any>)
      .__routeKey;

    if (typeof routeKey === 'string' && routeKey.length) {
      return routeKey;
    }

    if (this.command.data.command.name) {
      return this.command.data.command.name;
    }

    if (this.isInteraction()) {
      return this.interaction.commandName;
    }

    const parser = this.config.messageCommandParser!;
    return this.commandkit.commandHandler.resolveMessageCommandName(
      parser.getFullCommand(),
    );
  }

  /**
   * Gets the invoked command name (could be an alias for message commands)
   */
  public get invokedCommandName(): string {
    if (this.isInteraction()) {
      return this.interaction.commandName;
    }

    return this.config.messageCommandParser!.getCommand();
  }

  /**
   * Gets the command options based on the execution mode.
   */
  public get options(): CommandContextOptions<ExecutionMode> {
    if (this.isMessage()) {
      const parser = this.config.messageCommandParser!;
      // @ts-expect-error
      return parser.options;
    } else {
      const interaction = (<InteractionCommandContext>this).interaction;
      // @ts-expect-error
      return interaction.options;
    }
  }

  /**
   * Whether this context was forwarded from another context. This happens when a command forwards its context to another command.
   */
  public get forwarded(): boolean {
    return this.config.forwarded ?? false;
  }

  /**
   * Forwards the context to another command. The target handler will be the same as current handler.
   * @param command The command to forward to.
   */
  public async forwardCommand<C extends ResolvableCommand>(
    command: C,
  ): Promise<never> {
    const target = await this.commandkit.commandHandler.prepareCommandRun(
      (this.isInteraction() ? this.interaction : this.message) as Interaction,
      command,
    );

    if (!target) {
      throw new Error(`Command ${command} not found`);
    }

    const env = this.config.environment ?? getContext();

    if (!env) {
      throw new Error('No commandkit environment found.');
    }

    const handlers = {
      chatInput: target.command.data.chatInput,
      autocomplete: target.command.data.autocomplete,
      message: target.command.data.message,
      messageContextMenu: target.command.data.messageContextMenu,
      userContextMenu: target.command.data.userContextMenu,
    };

    const handlerKind = env.variables.get(
      'execHandlerKind',
    ) as keyof typeof handlers;

    if (!handlerKind) {
      throw new Error('No execution handler kind found.');
    }

    const handler = handlers[handlerKind];

    if (!handler) {
      throw new Error(`No handler found for ${handlerKind}`);
    }

    env.variables.set('forwardedBy', this.commandName);
    env.variables.set('forwardedTo', command);

    await handler(this.clone({ forwarded: true }));

    redirect();
  }

  /**
   * The execution mode of the command.
   */
  public get executionMode(): ExecutionMode {
    return this.config.executionMode;
  }

  // /**
  //  * The guild where this command was triggered.
  //  */
  // public get guild() {
  //   if (this.isInteraction()) {
  //     return this.interaction.guild;
  //   } else {
  //     return (<MessageCommandContext>this).message.guild;
  //   }
  // }

  // /**
  //  * The guild ID where this command was triggered.
  //  */
  // public get guildId() {
  //   if (this.isInteraction()) {
  //     return this.interaction.guildId;
  //   } else {
  //     return (<MessageCommandContext>this).message.guildId;
  //   }
  // }

  /**
   * Whether the command was triggered by an interaction.
   */
  public isInteraction(): this is InteractionCommandContext {
    return (
      this.executionMode === CommandExecutionMode.ChatInputCommand ||
      this.executionMode === CommandExecutionMode.Autocomplete ||
      this.executionMode === CommandExecutionMode.MessageContextMenu ||
      this.executionMode === CommandExecutionMode.UserContextMenu
    );
  }

  /**
   * Whether the command was triggered by a slash command interaction.
   */
  public isChatInputCommand(): this is ChatInputCommandContext {
    return this.executionMode === CommandExecutionMode.ChatInputCommand;
  }

  /**
   * Whether the command was triggered by an autocomplete interaction.
   */
  public isAutocomplete(): this is AutocompleteCommandContext {
    return this.executionMode === CommandExecutionMode.Autocomplete;
  }

  /**
   * Whether the command was triggered by a message context menu interaction.
   */
  public isMessageContextMenu(): this is MessageContextMenuCommandContext {
    return this.executionMode === CommandExecutionMode.MessageContextMenu;
  }

  /**
   * Whether the command was triggered by a user context menu interaction.
   */
  public isUserContextMenu(): this is UserContextMenuCommandContext {
    return this.executionMode === CommandExecutionMode.UserContextMenu;
  }

  /**
   * Whether the command was triggered by a message.
   */
  public isMessage(): this is Context<'message'> {
    return this.executionMode === CommandExecutionMode.Message;
  }

  /**
   * Returns the command identifier.
   */
  public getCommandIdentifier(): string {
    if (this.isInteraction()) {
      return this.interaction.commandName;
    } else {
      return this.commandName;
    }
  }

  /**
   * Returns the locale of the guild where this command was triggered.
   */
  public getGuildLocale(): Locale | null {
    if (this.isInteraction()) {
      return this.interaction.guildLocale;
    } else {
      return this.message.guild?.preferredLocale ?? null;
    }
  }

  /**
   * Returns the locale of the user who triggered this command.
   */
  public getUserLocale(): Locale | null {
    if (this.isInteraction()) {
      return this.interaction.locale;
    } else {
      return null;
    }
  }

  /**
   * Returns the locale for this command.
   * @param preferUser Whether to prefer the user's locale over the guild's locale.
   * @returns The locale for this command. If no locale is found, the default locale is returned.
   */
  public getLocale(preferUser = false): Locale {
    if (this._locale) return this._locale;

    const locale = preferUser ? this.getUserLocale() : this.getGuildLocale();

    if (!locale) {
      return this.commandkit.appConfig.defaultLocale;
    }

    return locale;
  }

  /**
   * Sets the locale for this command.
   * @param locale The locale to set.
   */
  public setLocale(locale: Locale | null): void {
    this._locale = locale;
  }

  /**
   * Creates a clone of this context
   * @param config - Optional partial config to override in the clone
   */
  public clone(
    config?: Partial<ContextParameters<ExecutionMode>>,
  ): Context<ExecutionMode> {
    if (!config) return new Context(this.commandkit, this.config);

    const ctx = new Context(this.commandkit, {
      ...this.config,
      ...config,
      store: this.#store,
    });

    return ctx;
  }

  /**
   * Checks if this context is a middleware context.
   */
  public isMiddleware(): this is MiddlewareContext<ExecutionMode> {
    return this instanceof MiddlewareContext;
  }

  /**
   * Gets the command arguments (only available for message commands).
   * @returns Array of command arguments
   */
  public args(): string[] {
    if (this.isMessage()) {
      return this.config.messageCommandParser!.getArgs();
    }

    return [];
  }

  // /**
  //  * Stops upcoming middleware or current command execution.
  //  * If this is called inside pre-stage middleware, the next run will be the actual command, skipping all other pre-stage middlewares.
  //  * If this is called inside a command itself, it will skip all post-stage middlewares.
  //  * If this is called inside post-stage middleware, it will skip all other post-stage middlewares.
  //  */
  // public exit(): never {
  //   stopMiddlewares();
  // }
}

/**
 * Extended context class for middleware execution with additional control methods.
 */
export class MiddlewareContext<
  T extends CommandExecutionMode = CommandExecutionMode,
> extends Context<T, MiddlewareContextArgs> {
  /**
   * Sets command runner function to wrap the command execution.
   * @param fn The function to set.
   * @example ctx.setCommandRunner(async (execute) => {
   *  // do something before command execution
   *  await execute();
   *  // do something after command execution
   * })
   */
  public setCommandRunner(fn: RunCommand): void {
    this.config.customArgs?.setCommandRunner?.(fn);
  }
}
