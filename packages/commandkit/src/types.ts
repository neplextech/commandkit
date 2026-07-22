import type {
  CacheType,
  Client,
  ClientEvents,
  Interaction,
  PermissionsString,
  RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';
import type { CommandKit } from './commandkit';

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Options for instantiating a CommandKit handler.
 */
export interface CommandKitOptions {
  /**
   * The Discord.js client object to use with CommandKit.
   */
  client?: Client;
}

/**
 * Represents a command context.
 */
export interface CommandContext<
  T extends Interaction,
  Cached extends CacheType,
> {
  /**
   * The interaction that triggered this command.
   */
  interaction: Interaction<CacheType>;
  /**
   * The client that instantiated this command.
   */
  client: Client;
  /**
   * The command data.
   */
  handler: CommandKit;
}

/**
 * Represents the command metadata.
 */
export interface CommandMetadata {
  /**
   * The guilds that the command is available in.
   */
  guilds?: string[];
  /**
   * The aliases of the command.
   */
  aliases?: string[];
  /**
   * The user permissions required to execute the command.
   */
  userPermissions?: PermissionsString | PermissionsString[];
  /**
   * The bot permissions required to execute the command.
   */
  botPermissions?: PermissionsString | PermissionsString[];
  /**
   * The name aliases for the `user` and `message` context menu commands. When i18n plugin is in use, this option will be ignored if the translation for the context menu command name is provided.
   */
  nameAliases?: Record<'user' | 'message', string>;
}

/**
 * Represents a command that can be executed by CommandKit.
 */
export type CommandData = Prettify<
  Omit<RESTPostAPIApplicationCommandsJSONBody, 'description'> & {
    /**
     * The description of the command.
     */
    description?: string;
  }
>;

/**
 * Represents an event handler for a specific event.
 */
export type EventHandler<K extends keyof ClientEvents> = (
  ...args: [...ClientEvents[K], Client<true>, CommandKit]
) => void | Promise<void>;

/**
 * The command metadata function
 */
export type CommandMetadataFunction = () =>
  Promise<CommandMetadata> | CommandMetadata;
