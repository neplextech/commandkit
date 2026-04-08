import { Channel } from 'diagnostics_channel';
import {
  Message,
  ApplicationCommandOptionType,
  GuildMember,
  Attachment,
  User,
  Role,
  CommandInteractionOption,
} from 'discord.js';
import {
  CommandKitErrorCodes,
  createCommandKitError,
} from '../../utils/error-codes';

/**
 * Represents a parsed message command with its components.
 */
export interface ParsedMessageCommand {
  command: string;
  options: { name: string; value: unknown }[];
  subcommand?: string;
  subcommandGroup?: string;
}

/**
 * Schema defining the types of options for a message command.
 */
export type MessageCommandOptionsSchema = Record<
  string,
  ApplicationCommandOptionType
>;

/**
 * Parses message content into structured command data with options and subcommands.
 */
export class MessageCommandParser {
  /**
   * @private
   * @internal
   */
  #parsed: ParsedMessageCommand | null = null;

  /**
   * @private
   * @internal
   */
  #options: MessageCommandOptions | null = null;

  /**
   * @private
   * @internal
   */
  #args: string[] = [];

  /**
   * Creates a new message command parser.
   * @param message - The Discord message to parse
   * @param prefix - Array of valid command prefixes or a regular expression
   * @param schema - Function that returns the options schema for a command
   */
  public constructor(
    public message: Message,
    private prefix: string[] | RegExp,
    private schema: (command: string) => MessageCommandOptionsSchema,
  ) {}

  /**
   * Gets the parsed command arguments.
   * @returns Array of command arguments
   */
  public getArgs() {
    void this.parse();
    return this.#args;
  }

  /**
   * Gets the message command options object for easy access to typed option values.
   */
  public get options() {
    if (!this.#options) {
      this.#options = new MessageCommandOptions(this);
    }

    return this.#options;
  }

  /**
   * Gets a specific option value by name.
   * @param name - The option name
   * @returns The option value or undefined if not found
   */
  public getOption<T>(name: string): T | undefined {
    return this.parse().options.find((o) => o.name === name)?.value as T;
  }

  /**
   * Gets the main command name.
   * @returns The command name
   */
  public getCommand(): string {
    return this.parse().command;
  }

  /**
   * Gets the subcommand name if present.
   * @returns The subcommand name or undefined
   */
  public getSubcommand(): string | undefined {
    return this.parse().subcommand;
  }

  /**
   * Gets the subcommand group name if present.
   * @returns The subcommand group name or undefined
   */
  public getSubcommandGroup(): string | undefined {
    return this.parse().subcommandGroup;
  }

  /**
   * Gets the prefix used in the message.
   * @returns The matched prefix or undefined
   */
  public getPrefix() {
    if (this.prefix instanceof RegExp) {
      const match = this.message.content.match(this.prefix);
      return match?.[0];
    }

    for (const p of this.prefix) {
      if (this.message.content.startsWith(p)) {
        return p;
      }
    }
  }

  /**
   * Gets the full command including subcommand group and subcommand.
   * @returns The complete command string
   */
  public getFullCommand() {
    return [this.getCommand(), this.getSubcommandGroup(), this.getSubcommand()]
      .filter((v) => v)
      .join(' ');
  }

  /**
   * Parses the message content into structured command data.
   * @returns The parsed command data
   */
  public parse(): ParsedMessageCommand {
    if (this.#parsed) {
      return this.#parsed;
    }

    const content = this.message.content;

    const prefix = this.getPrefix();

    if (!prefix) {
      throw createCommandKitError(CommandKitErrorCodes.InvalidCommandPrefix);
    }

    const parts = content.slice(prefix.length).trim().split(' ');
    const commandToken = parts.shift();

    this.#args = parts;

    let command: string | undefined = commandToken;
    let subcommandGroup: string | undefined;
    let subcommand: string | undefined;

    if (commandToken?.includes(':')) {
      const [root, group, cmd] = commandToken.split(':');

      command = root;

      if (!cmd && group) {
        subcommand = group;
      } else if (cmd && group) {
        subcommandGroup = group;
        subcommand = cmd;
      }
    }

    const schema = this.schema(
      [command, subcommandGroup, subcommand].filter(Boolean).join(' ').trim(),
    );

    const options = parts
      .map((part) => {
        try {
          const [name, value] = part.split(':');

          if (!(name in schema)) return null;

          switch (schema[name]) {
            case ApplicationCommandOptionType.Boolean:
              return { name, value: value === 'true' };
            case ApplicationCommandOptionType.Integer:
              return { name, value: parseInt(value, 10) };
            case ApplicationCommandOptionType.Number:
              return { name, value: parseFloat(value) };
            case ApplicationCommandOptionType.String:
              return { name, value };
            case ApplicationCommandOptionType.User:
              return {
                name,
                value: this.message.mentions.users.find((u) => {
                  return u.id === value.replace(/[<@!>]/g, '');
                }),
              };
            case ApplicationCommandOptionType.Channel:
              return {
                name,
                value: this.message.mentions.channels.find((c) => {
                  return c.id === value.replace(/[<#>]/g, '');
                }),
              };
            case ApplicationCommandOptionType.Role:
              return {
                name,
                value: this.message.mentions.roles.find((r) => {
                  return r.id === value.replace(/[<@&>]/g, '');
                }),
              };
            case ApplicationCommandOptionType.Attachment:
              return {
                name,
                value: this.message.attachments.find((a) => {
                  return a.name === value;
                }),
              };
            default:
              return null;
          }
        } catch {
          // Invalid option
          return null;
        }
      })
      .filter((v) => v !== null);

    this.#parsed = {
      command: command!,
      options,
      subcommand,
      subcommandGroup,
    };

    return this.#parsed;
  }
}

/**
 * Provides typed access to message command options with methods similar to Discord.js interaction options.
 */
export class MessageCommandOptions {
  /**
   * Creates a new message command options instance.
   * @param parser - The message command parser instance
   */
  public constructor(private parser: MessageCommandParser) {}

  /**
   * @private
   * @internal
   */
  private assertOption<T>(name: string, required = false) {
    const option = this.parser.getOption<T>(name);

    if (required && option === undefined) {
      throw new Error(`Option "${name}" is required.`);
    }

    return option ?? null;
  }

  /**
   * Gets a guild member from the command options.
   * @param name - The option name
   * @param required - Whether the option is required
   * @returns The guild member or null if not found
   */
  getMember(name: string): GuildMember | null;
  getMember(name: string, required: true): GuildMember;
  getMember(name: string, required = false) {
    const user = this.assertOption<User>(name, required);
    const member = this.parser.message.guild?.members.cache.get(user?.id!);

    if (required && !member) {
      throw new Error(`Member "${name}" is required.`);
    }

    return member ?? null;
  }

  /**
   * Gets an attachment from the command options.
   * @param name - The option name
   * @param required - Whether the option is required
   * @returns The attachment or null if not found
   */
  getAttachment(name: string): Attachment | null;
  getAttachment(name: string, required: true): Attachment;
  getAttachment(name: string, required = false) {
    return this.assertOption<Attachment>(name, required);
  }

  /**
   * Gets a boolean value from the command options.
   * @param name - The option name
   * @param required - Whether the option is required
   * @returns The boolean value or null if not found
   */
  getBoolean(name: string): boolean | null;
  getBoolean(name: string, required: true): boolean;
  getBoolean(name: string, required = false) {
    return this.assertOption<boolean>(name, required);
  }

  /**
   * Gets a number value from the command options.
   * @param name - The option name
   * @param required - Whether the option is required
   * @returns The number value or null if not found
   */
  getNumber(name: string): number | null;
  getNumber(name: string, required: true): number;
  getNumber(name: string, required = false) {
    return this.assertOption<number>(name, required);
  }

  /**
   * Gets a string value from the command options.
   * @param name - The option name
   * @param required - Whether the option is required
   * @returns The string value or null if not found
   */
  getString(name: string): string | null;
  getString(name: string, required: true): string;
  getString(name: string, required = false) {
    return this.assertOption<string>(name, required);
  }

  /**
   * Gets an integer value from the command options.
   * @param name - The option name
   * @param required - Whether the option is required
   * @returns The integer value or null if not found
   */
  getInteger(name: string): number | null;
  getInteger(name: string, required: true): number;
  getInteger(name: string, required = false) {
    return this.assertOption<number>(name, required);
  }

  /**
   * Gets a user from the command options.
   * @param name - The option name
   * @param required - Whether the option is required
   * @returns The user or null if not found
   */
  getUser(name: string): User | null;
  getUser(name: string, required: true): User;
  getUser(name: string, required = false) {
    return this.assertOption<User>(name, required);
  }

  /**
   * Gets a channel from the command options.
   * @param name - The option name
   * @param required - Whether the option is required
   * @returns The channel or null if not found
   */
  getChannel(name: string): Channel | null;
  getChannel(name: string, required: true): Channel;
  getChannel(name: string, required = false) {
    return this.assertOption<Channel>(name, required);
  }

  /**
   * Gets a role from the command options.
   * @param name - The option name
   * @param required - Whether the option is required
   * @returns The role or null if not found
   */
  getRole(name: string): Role | null;
  getRole(name: string, required: true): Role;
  getRole(name: string, required = false) {
    return this.assertOption<Role>(name, required);
  }

  /**
   * Gets a mentionable (user, member, or role) from the command options.
   * @param name - The option name
   * @param required - Whether the option is required
   * @returns The mentionable or null if not found
   */
  getMentionable(
    name: string,
  ): NonNullable<CommandInteractionOption['member' | 'role' | 'user']> | null;
  getMentionable(
    name: string,
    required: true,
  ): NonNullable<CommandInteractionOption['member' | 'role' | 'user']>;
  getMentionable(
    name: string,
    required = false,
  ): NonNullable<CommandInteractionOption['member' | 'role' | 'user']> | null {
    const target = this.assertOption(name, required);

    if (
      target instanceof GuildMember ||
      target instanceof User ||
      target instanceof Role
    ) {
      return target;
    }

    if (required) {
      throw new Error(`Mentionable "${name}" is required.`);
    }

    return null;
  }

  /**
   * Gets the subcommand name from the command.
   * @param required - Whether the subcommand is required
   * @returns The subcommand name or null if not found
   */
  getSubcommand(): string | null;
  getSubcommand(required: true): string;
  getSubcommand(required = false) {
    const sub = this.parser.getSubcommand();

    if (required && sub === undefined) {
      throw new Error('Subcommand is required.');
    }

    return sub ?? null;
  }

  /**
   * Gets the subcommand group name from the command.
   * @param required - Whether the subcommand group is required
   * @returns The subcommand group name or null if not found
   */
  getSubcommandGroup(): string | null;
  getSubcommandGroup(required: true): string;
  getSubcommandGroup(required = false) {
    const sub = this.parser.getSubcommandGroup();

    if (required && sub === undefined) {
      throw new Error('Subcommand group is required.');
    }

    return sub ?? null;
  }
}
