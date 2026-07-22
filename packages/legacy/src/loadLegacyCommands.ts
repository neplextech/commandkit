import type { CommandKit } from 'commandkit';
import {
  ApplicationCommandType,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
  type Client,
  type MessageContextMenuCommandInteraction,
  type PermissionsString,
  type RESTPostAPIApplicationCommandsJSONBody,
  type UserContextMenuCommandInteraction,
} from 'discord.js';
import { readdir } from 'node:fs/promises';
import { FILE_EXTENSIONS } from './common.js';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Represents the data structure for a command.
 */
export type CommandData = RESTPostAPIApplicationCommandsJSONBody;

/**
 * Represents the properties of a command, including its data and options.
 */
export interface CommandObject {
  /**
   * The category of the command.
   */
  category: string | null;
  /**
   * The command data, which includes the name, description, and options.
   */
  data: CommandData;
  /**
   * The file path of the command.
   */
  filePath: string;
  /**
   * The function to run when the command is executed.
   */
  options: CommandOptions;
}

/**
 * Represents the options for a command, including permissions and execution conditions.
 */
export interface CommandOptions {
  /**
   * The name of the command.
   */
  botPermissions?: PermissionsString[];
  /**
   * The description of the command.
   */
  deleted?: boolean;
  /**
   * Whether the command is only available to developers.
   */
  devOnly?: boolean;
  /**
   * Whether the command can only be used in a guild.
   */
  guildOnly?: boolean;
  /**
   * The permissions required for the user to execute the command.
   */
  userPermissions?: PermissionsString[];
}

/**
 * Represents the command runner function type.
 */
export type CommandRunner<T> = ({}: CommandProps<T>) =>
  Promise<unknown> | unknown;

/**
 * Represents the data structure for a command file, including its data, options, and runners.
 */
export interface CommandFileData {
  /**
   * The command data, which includes the name, description, and options.
   */
  data: CommandData;
  /**
   * The options for the command, including permissions and execution conditions.
   */
  options?: CommandOptions;
  /**
   * The function to run when the command is executed as slash command.
   */
  chatInput: CommandRunner<ChatInputCommandInteraction>;
  /**
   * The function to run when the command is executed as a message context menu command.
   */
  messageContextMenu?: CommandRunner<MessageContextMenuCommandInteraction>;
  /**
   * The function to run when the command is executed as a user context menu command.
   */
  userContextMenu?: CommandRunner<UserContextMenuCommandInteraction>;
  /**
   * The function to run when the command is executed as an autocomplete interaction.
   */
  autocomplete?: CommandRunner<AutocompleteInteraction>;
  /**
   * The category of the command, if applicable.
   */
  category: string | null;
  /**
   * The file path of the command.
   */
  path: string;
}

/**
 * Represents the properties required for command execution.
 */
interface CommandProps<T> {
  /**
   * The interaction that triggered the command.
   */
  interaction: T;
  /**
   * The command object associated with the interaction.
   */
  client: Client;
  /**
   * The command object containing the command data and options.
   */
  handler: CommandKit;
}

/**
 * Represents the properties required for slash commands.
 */
export type SlashCommandProps = CommandProps<ChatInputCommandInteraction>;
/**
 * Represents the properties required for autocomplete commands.
 */
export type AutocompleteProps = CommandProps<AutocompleteInteraction>;
/**
 * Represents the properties required for message context menu commands.
 */
export type ContextMenuCommandProps =
  CommandProps<MessageContextMenuCommandInteraction>;

/**
 * @private
 */
export async function loadLegacyCommands(path: string) {
  const content = await readdir(path, { withFileTypes: true });
  const commandFiles: CommandFileData[] = [];

  for (const entry of content) {
    if (entry.isFile()) {
      if (!FILE_EXTENSIONS.test(entry.name)) continue;
      const data = await loadCommand({
        name: entry.name,
        path: join(path, entry.name),
      });

      commandFiles.push(data);
    } else if (entry.isDirectory()) {
      const sub = await readdir(join(path, entry.name), {
        withFileTypes: true,
      });

      if (sub.length === 0) continue;

      const files = sub.filter(
        (entry) => entry.isFile() && FILE_EXTENSIONS.test(entry.name),
      );

      if (files.length === 0) continue;

      for (const file of files) {
        const data = await loadCommand(
          {
            name: file.name,
            path: join(path, entry.name, file.name),
          },
          entry.name,
        );
        commandFiles.push(data);
      }
    }
  }

  return commandFiles;
}

/**
 * @private
 */
async function loadCommand(
  entry: { name: string; path: string },
  category: string | null = null,
): Promise<CommandFileData> {
  const cmd = await import(`${pathToFileURL(entry.path)}?ts=${Date.now()}`);

  const dataSource = cmd.default || cmd;

  const { data, options, run, autocomplete } = dataSource;

  if (!data) {
    throw new Error(`Command ${entry.name} does not export a data property`);
  }

  if (!run && !autocomplete) {
    throw new Error(
      `Command ${entry.name} does not export a run or autocomplete property`,
    );
  }

  const type =
    data instanceof SlashCommandBuilder ? data.toJSON().type : data.type;

  const isMessageContextMenu = type === ApplicationCommandType.Message;
  const isUserContextMenu = type === ApplicationCommandType.User;

  return {
    category,
    chatInput: run,
    autocomplete: autocomplete ? autocomplete : undefined,
    messageContextMenu: isMessageContextMenu ? run : undefined,
    userContextMenu: isUserContextMenu ? run : undefined,
    data: 'toJSON' in data ? data.toJSON() : data,
    options,
    path: entry.path,
  };
}
