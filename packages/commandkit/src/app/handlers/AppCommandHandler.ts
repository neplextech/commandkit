import {
  ApplicationCommandType,
  AutocompleteInteraction,
  Awaitable,
  Collection,
  CommandInteraction,
  ContextMenuCommandBuilder,
  Events,
  Interaction,
  Message,
  SlashCommandBuilder,
} from 'discord.js';
import type { CommandKit } from '../../commandkit';
import { getConfig } from '../../config/config';
import { AsyncFunction, GenericFunction } from '../../context/async-context';
import { Logger } from '../../logger/Logger';
import type {
  CommandData,
  CommandMetadata,
  CommandMetadataFunction,
} from '../../types';
import colors from '../../utils/colors';
import { COMMANDKIT_IS_DEV } from '../../utils/constants';
import { CommandKitErrorCodes, isErrorType } from '../../utils/error-codes';
import { toFileURL } from '../../utils/resolve-file-url';
import { rewriteCommandDeclaration } from '../../utils/types-package';
import { AppCommandRunner } from '../commands/AppCommandRunner';
import { Context } from '../commands/Context';
import { isInteractionSource } from '../commands/helpers';
import { MessageCommandParser } from '../commands/MessageCommandParser';
import {
  beforeExecute as permissions_beforeExecute,
  middlewareId as permissions_middlewareId,
} from '../middlewares/permissions';
import { CommandRegistrar } from '../register/CommandRegistrar';
import { Command, Middleware } from '../router';

const KNOWN_NON_HANDLER_KEYS = [
  'command',
  'generateMetadata',
  'metadata',
  'aiConfig',
];

/**
 * Function type for wrapping command execution with custom logic.
 */
export type RunCommand = <T extends AsyncFunction>(fn: T) => T;

/**
 * Represents a native command structure used in CommandKit.
 * This structure includes the command definition and various handlers for different interaction types.
 * It can be used to define slash commands, context menu commands, and message commands.
 */
export interface AppCommandNative {
  command: CommandData | Record<string, any>;
  generateMetadata?: CommandMetadataFunction;
  metadata?: CommandMetadata;
  chatInput?: (ctx: Context) => Awaitable<unknown>;
  autocomplete?: (ctx: Context) => Awaitable<unknown>;
  message?: (ctx: Context) => Awaitable<unknown>;
  messageContextMenu?: (ctx: Context) => Awaitable<unknown>;
  userContextMenu?: (ctx: Context) => Awaitable<unknown>;
}

/**
 * Custom properties that can be added to an AppCommand.
 * This allows for additional metadata or configuration to be associated with a command.
 */
export interface CustomAppCommandProps {
  [key: string]: any;
}

/**
 * Represents a command in the CommandKit application, including its metadata and handlers.
 * This type extends the native command structure with additional properties.
 */
export type AppCommand = AppCommandNative & CustomAppCommandProps;

/**
 * @private
 * @internal
 */
interface AppCommandMiddleware {
  beforeExecute: (ctx: Context) => Awaitable<unknown>;
  afterExecute: (ctx: Context) => Awaitable<unknown>;
}

/**
 * Represents a loaded command with its metadata and configuration.
 */
export interface LoadedCommand {
  /**
   * The associated discord snowflake id for this command.
   * If the information is not yet available, this will be `null`.
   */
  discordId: string | null;
  /**
   * The command data.
   */
  command: Command;
  /**
   * The metadata for this command.
   */
  metadata: CommandMetadata;
  /**
   * The data for this command.
   */
  data: AppCommand;
}

/**
 * Type representing command data identifier.
 */
export type CommandTypeData = string;

/**
 * Type for commands that can be resolved by the handler.
 */
export type ResolvableCommand = CommandTypeData | (string & {});

/**
 * @private
 * @internal
 */
interface LoadedMiddleware {
  middleware: Middleware;
  data: AppCommandMiddleware;
}

/**
 * Represents a prepared command execution with all necessary data and middleware.
 */
export interface PreparedAppCommandExecution {
  command: LoadedCommand;
  middlewares: LoadedMiddleware[];
  messageCommandParser?: MessageCommandParser;
}

/**
 * Type representing command builder objects supported by CommandKit.
 */
export type CommandBuilderLike =
  | SlashCommandBuilder
  | ContextMenuCommandBuilder
  | Record<string, any>;

/**
 * @private
 * @internal
 */
const commandDataSchema = {
  command: (c: unknown) =>
    c instanceof SlashCommandBuilder ||
    c instanceof ContextMenuCommandBuilder ||
    (c && typeof c === 'object'),
  chatInput: (c: unknown) => typeof c === 'function',
  autocomplete: (c: unknown) => typeof c === 'function',
  message: (c: unknown) => typeof c === 'function',
  messageContextMenu: (c: unknown) => typeof c === 'function',
  userContextMenu: (c: unknown) => typeof c === 'function',
};

/**
 * @private
 * @internal
 */
export type CommandDataSchema = typeof commandDataSchema;

/**
 * @private
 * @internal
 */
export type CommandDataSchemaKey = keyof CommandDataSchema;

/**
 * @private
 * @internal
 */
export type CommandDataSchemaValue = CommandDataSchema[CommandDataSchemaKey];

/**
 * @private
 * @internal
 */
const middlewareDataSchema = {
  beforeExecute: (c: unknown) => typeof c === 'function',
  afterExecute: (c: unknown) => typeof c === 'function',
};

/**
 * Handles application commands for CommandKit, including loading, registration, and execution.
 * Manages both slash commands and message commands with middleware support.
 */
export class AppCommandHandler {
  /**
   * @private
   * @internal
   */
  private loadedCommands = new Collection<string, LoadedCommand>();

  /**
   * @private
   * @internal
   */
  private loadedMiddlewares = new Collection<string, LoadedMiddleware>();

  /**
   * Command registrar for handling Discord API registration.
   */
  public readonly registrar: CommandRegistrar;

  /**
   * @private
   * @internal
   */
  private onInteraction: GenericFunction<[Interaction]> | null = null;

  /**
   * @private
   * @internal
   */
  private onMessageCreate: GenericFunction<[Message]> | null = null;

  /**
   * Command runner instance for executing commands.
   */
  public readonly commandRunner = new AppCommandRunner(this);

  /**
   * External command data storage.
   */
  public readonly externalCommandData = new Collection<string, Command>();

  /**
   * External middleware data storage.
   */
  public readonly externalMiddlewareData = new Collection<string, Middleware>();

  /**
   * Creates a new AppCommandHandler instance.
   * @param commandkit - The CommandKit instance
   */
  public constructor(public readonly commandkit: CommandKit) {
    this.registrar = new CommandRegistrar(this.commandkit);
  }

  /**
   * Prints a formatted banner showing all loaded commands organized by category.
   */
  public printBanner() {
    const uncategorized = crypto.randomUUID();

    // Group commands by category
    const categorizedCommands = this.getCommandsArray().reduce(
      (acc, cmd) => {
        const category = cmd.command.category || uncategorized;
        acc[category] = acc[category] || [];
        acc[category].push(cmd);
        return acc;
      },
      {} as Record<string, LoadedCommand[]>,
    );

    console.log(
      colors.green(
        `Loaded ${colors.magenta(this.loadedCommands.size.toString())} commands:`,
      ),
    );

    const categories = Object.keys(categorizedCommands).sort();

    // Build category tree for all nesting depths
    const categoryTree: Record<string, string[]> = {};

    // Find the best parent for nested categories
    categories.forEach((category) => {
      if (category === uncategorized) return;

      if (category.includes(':')) {
        const parts = category.split(':');
        let bestParent = null;

        // Try to find the deepest existing parent
        for (let i = parts.length - 1; i > 0; i--) {
          const potentialParent = parts.slice(0, i).join(':');
          if (categories.includes(potentialParent)) {
            bestParent = potentialParent;
            break;
          }
        }

        // If we found a parent, add this category as its child
        if (bestParent) {
          categoryTree[bestParent] = categoryTree[bestParent] || [];
          categoryTree[bestParent].push(category);
        }
      }
    });

    // Track categories we've processed to avoid duplicates
    const processedCategories = new Set<string>();

    // Recursive function to print a category and its children
    const printCategory = (
      category: string,
      indent: string = '',
      isLast: boolean = false,
      parentPrefix: string = '',
    ) => {
      // Skip if already processed
      if (processedCategories.has(category)) return;
      processedCategories.add(category);

      const commands = categorizedCommands[category];
      const hasChildren =
        categoryTree[category] && categoryTree[category].length > 0;
      const thisPrefix = isLast ? '└─' : '├─';
      const childIndent = parentPrefix + (isLast ? '   ' : '│  ');

      // Print category name if not uncategorized
      if (category !== uncategorized) {
        // For nested categories, only print the last part after the colon
        const displayName = category.includes(':')
          ? category.split(':').pop()
          : category;

        console.log(
          colors.cyan(`${indent}${thisPrefix} ${colors.bold(displayName!)}`),
        );
      }

      // Print commands in this category
      commands.forEach((cmd, cmdIndex) => {
        const cmdIsLast = cmdIndex === commands.length - 1 && !hasChildren;
        const cmdPrefix = cmdIsLast ? '└─' : '├─';
        const cmdIndent = category !== uncategorized ? childIndent : indent;

        const name = cmd.data.command.name;
        const hasMw = cmd.command.middlewares.length > 0;
        const middlewareIcon = hasMw ? colors.magenta(' (λ)') : '';

        console.log(
          `${colors.green(`${cmdIndent}${cmdPrefix}`)} ${colors.yellow(name)}${middlewareIcon}`,
        );
      });

      // Process nested categories
      if (hasChildren) {
        const children = categoryTree[category].sort();
        children.forEach((childCategory, idx) => {
          const childIsLast = idx === children.length - 1;
          printCategory(childCategory, childIndent, childIsLast, childIndent);
        });
      }
    };

    // Find and print top-level categories
    const topLevelCategories = categories
      .filter((category) => {
        if (category === uncategorized) return true;

        if (category.includes(':')) {
          const parts = category.split(':');
          // Check if any parent path exists as a category
          for (let i = 1; i < parts.length; i++) {
            const parentPath = parts.slice(0, i).join(':');
            if (categories.includes(parentPath)) {
              return false; // Not top-level, it has a parent
            }
          }
          return true; // No parent found, so it's top-level
        }

        return true; // Not nested, so it's top-level
      })
      .sort();

    // Print each top-level category
    topLevelCategories.forEach((category, index) => {
      const isLast = index === topLevelCategories.length - 1;
      printCategory(category, '', isLast);
    });
  }

  /**
   * Gets an array of all loaded commands, including pre-generated context menu entries.
   * @returns Array of loaded commands
   */
  public getCommandsArray() {
    return Array.from(this.loadedCommands.values());
  }

  /**
   * Registers event handlers for Discord interactions and messages.
   */
  public registerCommandHandler() {
    this.onInteraction ??= async (interaction: Interaction) => {
      const success = await this.commandkit.plugins.execute(
        async (ctx, plugin) => {
          return plugin.onBeforeInteraction(ctx, interaction);
        },
      );

      // plugin will handle the interaction
      if (success) return;

      const isCommandLike =
        interaction.isCommand() ||
        interaction.isAutocomplete() ||
        interaction.isUserContextMenuCommand() ||
        interaction.isMessageContextMenuCommand();

      if (!isCommandLike) return;

      const prepared = await this.prepareCommandRun(interaction);

      if (!prepared) return;

      return this.commandRunner.runCommand(prepared, interaction);
    };

    this.onMessageCreate ??= async (message: Message) => {
      const success = await this.commandkit.plugins.execute(
        async (ctx, plugin) => {
          return plugin.onBeforeMessageCommand(ctx, message);
        },
      );

      // plugin will handle the message
      if (success) return;
      if (message.author.bot) return;

      const prepared = await this.prepareCommandRun(message);

      if (!prepared) return;

      return this.commandRunner.runCommand(prepared, message);
    };

    this.commandkit.client.on(Events.InteractionCreate, this.onInteraction);
    this.commandkit.client.on(Events.MessageCreate, this.onMessageCreate);
  }

  /**
   * Prepares a command for execution by resolving the command and its middleware.
   * @param source - The interaction or message that triggered the command
   * @param cmdName - Optional command name override
   * @returns Prepared command execution data or null if command not found
   */
  public async prepareCommandRun(
    source: Interaction | Message,
    cmdName?: string,
  ): Promise<PreparedAppCommandExecution | null> {
    const config = getConfig();

    if (config.disablePrefixCommands && source instanceof Message) {
      return null;
    }

    let parser: MessageCommandParser | undefined;

    // Extract command name (and possibly subcommand) from the source
    if (!cmdName) {
      if (source instanceof Message) {
        if (source.author.bot) return null;

        const prefix =
          await this.commandkit.appConfig.getMessageCommandPrefix(source);

        if (
          !prefix ||
          ((typeof prefix === 'string' || Array.isArray(prefix)) &&
            !prefix.length)
        )
          return null;

        parser = new MessageCommandParser(
          source,
          prefix instanceof RegExp
            ? prefix
            : Array.isArray(prefix)
              ? prefix
              : [prefix],
          (command: string) => {
            // Find the command by name
            const loadedCommand = this.findCommandByName(command);
            if (!loadedCommand) {
              if (
                COMMANDKIT_IS_DEV &&
                this.commandkit.config.showUnknownPrefixCommandsWarning
              ) {
                Logger.error`Prefix command "${command}" was not found.\nNote: This warning is only shown in development mode as an alert to help you find the command. If you wish to remove this warning, set \`showUnknownPrefixCommandsWarning\` to \`false\` in your commandkit config.`;
              }
              return null;
            }

            if (
              source.guildId &&
              loadedCommand.metadata?.guilds?.length &&
              !loadedCommand.metadata?.guilds.includes(source.guildId!)
            ) {
              return null;
            }

            const json =
              'toJSON' in loadedCommand.data.command
                ? loadedCommand.data.command.toJSON()
                : loadedCommand.data.command;

            return (
              json.options?.reduce(
                (acc: Record<string, unknown>, opt: Record<string, any>) => {
                  acc[opt.name] = opt.type;
                  return acc;
                },
                {} as Record<string, unknown>,
              ) ?? {}
            );
          },
        );

        try {
          const fullCommand = parser.getFullCommand();
          const parts = fullCommand.split(' ');
          cmdName = parts[0];
        } catch (e) {
          if (isErrorType(e, CommandKitErrorCodes.InvalidCommandPrefix)) {
            return null;
          }
          Logger.error`${e}`;
          return null;
        }
      } else {
        const isAnyCommand =
          source.isChatInputCommand() ||
          source.isAutocomplete() ||
          source.isContextMenuCommand();

        if (!isAnyCommand) return null;

        cmdName = source.commandName;
      }
    }

    // Find the command by name
    const hint = isInteractionSource(source)
      ? source.isUserContextMenuCommand()
        ? 'user'
        : source.isMessageContextMenuCommand()
          ? 'message'
          : undefined
      : undefined;
    const loadedCommand = this.findCommandByName(cmdName, hint);
    if (!loadedCommand) return null;

    // If this is a guild specific command, check if we're in the right guild
    if (
      (source instanceof CommandInteraction ||
        source instanceof AutocompleteInteraction) &&
      source.guildId &&
      loadedCommand.metadata?.guilds?.length &&
      !loadedCommand.metadata?.guilds.includes(source.guildId)
    ) {
      return null;
    }

    if (source instanceof Message) {
      if (!source.guildId) {
        return null; // command is being called in a dm
      }

      if (
        loadedCommand.metadata?.guilds?.length &&
        !loadedCommand.metadata.guilds.includes(source.guildId)
      ) {
        return null; // command is being called in a guild that is not in the metadata
      }
    }

    // Collect all applicable middleware
    const middlewares: LoadedMiddleware[] = [];

    // Add command-level middleware
    for (const middlewareId of loadedCommand.command.middlewares) {
      const middleware = this.loadedMiddlewares.get(middlewareId);
      if (middleware) {
        middlewares.push(middleware);
      }
    }

    if (!getConfig().disablePermissionsMiddleware) {
      middlewares.push({
        data: {
          // @ts-ignore
          beforeExecute: permissions_beforeExecute,
        },
        middleware: {
          command: null,
          global: true,
          id: permissions_middlewareId,
          name: 'permissions',
          parentPath: '',
          path: '',
          relativePath: '',
        },
      });
    }

    // No middleware for subcommands since they inherit from parent command
    return {
      command: loadedCommand,
      middlewares,
      messageCommandParser: parser,
    };
  }

  /**
   * Finds a command by name.
   * @param name - The command name to search for
   * @param hint - The hint for the command type (user or message)
   * @returns The loaded command or null if not found
   */
  private findCommandByName(
    name: string,
    hint?: 'user' | 'message',
  ): LoadedCommand | null {
    for (const [, loadedCommand] of this.loadedCommands) {
      if (hint) {
        const nameAliases = loadedCommand.data.metadata?.nameAliases;

        if (nameAliases && nameAliases[hint] === name) {
          return loadedCommand;
        }
      }

      if (loadedCommand.data.command.name === name) {
        return loadedCommand;
      }

      // Check aliases for prefix commands
      const aliases = loadedCommand.data.metadata?.aliases;
      if (aliases && Array.isArray(aliases) && aliases.includes(name)) {
        return loadedCommand;
      }
    }

    return null;
  }

  public resolveMessageCommandName(name: string): string {
    for (const [, loadedCommand] of this.loadedCommands) {
      if (loadedCommand.data.command.name === name) {
        return loadedCommand.data.command.name;
      }

      const aliases = loadedCommand.data.metadata?.aliases;

      if (aliases && Array.isArray(aliases) && aliases.includes(name)) {
        return loadedCommand.data.command.name;
      }
    }

    return name;
  }

  /**
   * Reloads all commands and middleware from scratch.
   */
  public async reloadCommands() {
    this.loadedCommands.clear();
    this.loadedMiddlewares.clear();
    this.externalCommandData.clear();
    this.externalMiddlewareData.clear();

    await this.loadCommands();
  }

  /**
   * Adds external middleware data to be loaded.
   * @param data - Array of middleware data to add
   */
  public async addExternalMiddleware(data: Middleware[]) {
    for (const middleware of data) {
      if (!middleware.id) continue;

      this.externalMiddlewareData.set(middleware.id, middleware);
    }
  }

  /**
   * Adds external command data to be loaded.
   * @param data - Array of command data to add
   */
  public async addExternalCommands(data: Command[]) {
    for (const command of data) {
      if (!command.id) continue;

      this.externalCommandData.set(command.id, command);
    }
  }

  /**
   * Registers externally loaded middleware.
   * @param data - Array of loaded middleware to register
   */
  public async registerExternalLoadedMiddleware(data: LoadedMiddleware[]) {
    for (const middleware of data) {
      this.loadedMiddlewares.set(middleware.middleware.id, middleware);
    }
  }

  /**
   * Registers externally loaded commands.
   * @param data - Array of loaded commands to register
   */
  public async registerExternalLoadedCommands(data: LoadedCommand[]) {
    for (const command of data) {
      this.loadedCommands.set(command.command.id, command);
    }
  }

  /**
   * Loads all commands and middleware from the router.
   */
  public async loadCommands() {
    await this.commandkit.plugins.execute((ctx, plugin) => {
      return plugin.onBeforeCommandsLoad(ctx);
    });

    const commandsRouter = this.commandkit.commandsRouter;

    if (!commandsRouter) {
      throw new Error('Commands router has not yet initialized');
    }

    const { commands, middlewares } = commandsRouter.getData();

    const combinedCommands = this.externalCommandData.size
      ? commands.concat(this.externalCommandData)
      : commands;

    const combinedMiddlewares = this.externalMiddlewareData.size
      ? middlewares.concat(this.externalMiddlewareData)
      : middlewares;

    // Load middlewares first
    for (const [id, middleware] of combinedMiddlewares) {
      await this.loadMiddleware(id, middleware);
    }

    // Load commands
    for (const [id, command] of combinedCommands) {
      await this.loadCommand(id, command);
    }

    // generate types
    if (COMMANDKIT_IS_DEV) {
      const commandNames = Array.from(this.loadedCommands.values()).map(
        (v) => v.data.command.name,
      );
      const aliases = Array.from(this.loadedCommands.values()).flatMap(
        (v) => v.metadata.aliases || [],
      );

      const allNames = [...commandNames, ...aliases];

      await rewriteCommandDeclaration(
        `type CommandTypeData = ${allNames.map((name) => JSON.stringify(name)).join(' | ')}`,
      );
    }

    await this.commandkit.plugins.execute((ctx, plugin) => {
      return plugin.onAfterCommandsLoad(ctx);
    });
  }

  /**
   * @private
   * @internal
   */
  private async loadMiddleware(id: string, middleware: Middleware) {
    try {
      const data = await import(
        `${toFileURL(middleware.path)}?t=${Date.now()}`
      );

      let handlerCount = 0;
      for (const [key, validator] of Object.entries(middlewareDataSchema)) {
        if (data[key] && !(await validator(data[key]))) {
          throw new Error(
            `Invalid export for middleware ${id}: ${key} does not match expected value`,
          );
        }

        if (data[key]) handlerCount++;
      }

      if (handlerCount === 0) {
        throw new Error(
          `Invalid export for middleware ${id}: at least one handler function must be provided`,
        );
      }

      this.loadedMiddlewares.set(id, { middleware, data });
    } catch (error) {
      Logger.error`Failed to load middleware ${id}: ${error}`;
    }
  }

  /**
   * @private
   * @internal
   */
  private async loadCommand(id: string, command: Command) {
    try {
      // Skip if path is null (directory-only command group) - external plugins
      if (command.path === null) {
        this.loadedCommands.set(id, {
          discordId: null,
          command,
          metadata: {
            guilds: [],
            aliases: [],
            userPermissions: [],
            botPermissions: [],
          },
          data: {
            command: {
              name: command.name,
            },
          },
        });
        return;
      }

      const commandFileData = (await import(
        `${toFileURL(command.path)}?t=${Date.now()}`
      )) as AppCommandNative;

      if (!commandFileData.command) {
        throw new Error(
          `Invalid export for command ${command.name}: no command definition found`,
        );
      }

      const metadataFunc = commandFileData.generateMetadata;
      const metadataObj = commandFileData.metadata;

      if (metadataFunc && metadataObj) {
        throw new Error(
          'A command may only export either `generateMetadata` or `metadata`, not both',
        );
      }

      const metadata = (metadataFunc ? await metadataFunc() : metadataObj) ?? {
        aliases: [],
        guilds: [],
        userPermissions: [],
        botPermissions: [],
      };

      // Apply the specified logic for name and description
      const commandName = commandFileData.command.name || command.name;
      let commandDescription = commandFileData.command.description as
        | string
        | undefined;

      // since `CommandData.description` is optional, set a fallback description if none provided
      if (!commandDescription && commandFileData.chatInput) {
        commandDescription = 'No command description set.';
      }

      // Update the command data with resolved name and description
      const updatedCommandData = {
        ...commandFileData.command,
        name: commandName,
        description: commandDescription,
      } as CommandData;

      let handlerCount = 0;

      for (const [key, propValidator] of Object.entries(commandDataSchema) as [
        CommandDataSchemaKey,
        CommandDataSchemaValue,
      ][]) {
        const exportedProp = commandFileData[key];

        if (exportedProp) {
          if (!(await propValidator(exportedProp))) {
            throw new Error(
              `Invalid export for command ${command.name}: ${key} does not match expected value`,
            );
          }

          if (!KNOWN_NON_HANDLER_KEYS.includes(key)) {
            // command file includes a handler function (chatInput, message, etc)
            handlerCount++;
          }
        }
      }

      if (handlerCount === 0) {
        throw new Error(
          `Invalid export for command ${command.name}: at least one handler function must be provided`,
        );
      }

      let lastUpdated = updatedCommandData;

      await this.commandkit.plugins.execute(async (ctx, plugin) => {
        const res = await plugin.prepareCommand(ctx, lastUpdated);

        if (res) {
          lastUpdated = res as CommandData;
        }
      });

      const commandJson =
        'toJSON' in lastUpdated && typeof lastUpdated.toJSON === 'function'
          ? lastUpdated.toJSON()
          : lastUpdated;

      if ('guilds' in commandJson || 'aliases' in commandJson) {
        Logger.warn(
          `Command \`${command.name}\` uses deprecated metadata properties. Please update to use the new \`metadata\` object or \`generateMetadata\` function.`,
        );
      }

      const resolvedMetadata = {
        guilds: commandJson.guilds,
        aliases: commandJson.aliases,
        ...metadata,
      };

      this.loadedCommands.set(id, {
        discordId: null,
        command,
        metadata: resolvedMetadata,
        data: {
          ...commandFileData,
          metadata: resolvedMetadata,
          command: commandJson,
        },
      });

      // Pre-generate context menu commands so the handler cache
      // is aware of them before CommandRegistrar runs (#558)
      this.generateContextMenuCommands(
        id,
        command,
        commandFileData,
        commandJson,
        resolvedMetadata,
      );
    } catch (error) {
      Logger.error`Failed to load command ${command.name} (${id}): ${error}`;
    }
  }

  /**
   * Gets the metadata for a command.
   * @param command - The command name to get metadata for
   * @param hint - The hint for the command type (user or message)
   * @returns The command metadata or null if not found
   */
  public getMetadataFor(
    command: string,
    hint?: 'user' | 'message',
  ): CommandMetadata | null {
    const loadedCommand = this.findCommandByName(command, hint);
    if (!loadedCommand) return null;

    return (loadedCommand.metadata ??= {
      aliases: [],
      guilds: [],
      userPermissions: [],
      botPermissions: [],
    });
  }

  /**
   * Generates context menu commands for the loaded command.
   * @private
   * @internal
   */
  private generateContextMenuCommands(
    id: string,
    command: Command,
    commandFileData: AppCommandNative,
    commandJson: CommandData,
    metadata: CommandMetadata,
  ) {
    if (commandFileData.userContextMenu) {
      const userCtxId = `${id}::user-ctx`;
      const userCtxName = metadata.nameAliases?.user ?? commandJson.name;

      this.loadedCommands.set(userCtxId, {
        discordId: null,
        command: {
          ...command,
          id: userCtxId,
          name: userCtxName,
        },
        metadata,
        data: {
          ...commandFileData,
          metadata,
          command: {
            ...commandJson,
            name: userCtxName,
            type: ApplicationCommandType.User,
            description: undefined,
            options: undefined,
          },
        },
      });
    }

    if (commandFileData.messageContextMenu) {
      const messageCtxId = `${id}::message-ctx`;
      const messageCtxName = metadata.nameAliases?.message ?? commandJson.name;

      this.loadedCommands.set(messageCtxId, {
        discordId: null,
        command: {
          ...command,
          id: messageCtxId,
          name: messageCtxName,
        },
        metadata,
        data: {
          ...commandFileData,
          metadata,
          command: {
            ...commandJson,
            name: messageCtxName,
            type: ApplicationCommandType.Message,
            description: undefined,
            options: undefined,
          },
        },
      });
    }
  }
}
