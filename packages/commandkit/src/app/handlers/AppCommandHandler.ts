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
import { dirname } from 'node:path';
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
import {
  Command,
  CommandTreeNode,
  CompiledCommandRoute,
  Middleware,
} from '../router';

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
   * Executable runtime commands indexed by canonical route key.
   * This includes flat commands and hierarchical executable leaves.
   * @private
   * @internal
   */
  private runtimeRouteIndex = new Collection<string, LoadedCommand>();

  /**
   * Loaded hierarchical command nodes keyed by tree node id.
   * Container nodes are cached here for registration compilation.
   * @private
   * @internal
   */
  private hierarchicalNodes = new Collection<string, LoadedCommand>();

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

    // Collect flat commands
    const flatCommands = this.getCommandsArray();

    // Collect hierarchical root nodes from treeNodes (kind === 'command')
    const treeNodes = Array.from(
      this.commandkit.commandsRouter?.getData().treeNodes.values() ?? [],
    );
    const hierarchicalRoots = treeNodes.filter(
      (n) => n.kind === 'command' && n.source !== 'root',
    );

    // Total = flat commands + hierarchical roots (top-level slash commands)
    const totalCount = flatCommands.length + hierarchicalRoots.length;

    console.log(
      colors.green(`Loaded ${colors.magenta(totalCount.toString())} commands:`),
    );

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    const printHierarchicalNode = (
      nodeId: string,
      prefix: string,
      indent: string,
    ) => {
      const node = treeNodes.find((n) => n.id === nodeId);
      if (!node || node.kind === 'root') return;

      const loadedNode = this.hierarchicalNodes.get(nodeId);
      const hasMw =
        loadedNode && loadedNode.command.middlewares.length > 0
          ? colors.magenta(' (λ)')
          : '';

      const kindLabel =
        node.kind === 'group'
          ? colors.cyan(` [group]`)
          : node.kind === 'command'
            ? ''
            : '';

      console.log(
        `${colors.green(prefix)} ${colors.yellow(node.token)}${kindLabel}${hasMw}`,
      );

      // Render children
      const children = node.childIds;
      children.forEach((childId, idx) => {
        const isLastChild = idx === children.length - 1;
        const childPrefix = indent + (isLastChild ? '└─' : '├─');
        const childIndent = indent + (isLastChild ? '   ' : '│  ');
        printHierarchicalNode(childId, childPrefix, childIndent);
      });
    };

    // ------------------------------------------------------------------
    // Group flat commands by category
    // ------------------------------------------------------------------
    type BannerEntry =
      | { type: 'flat'; cmd: LoadedCommand }
      | { type: 'hierarchical'; root: (typeof hierarchicalRoots)[number] };

    interface CategoryBucket {
      flat: LoadedCommand[];
      hierarchical: (typeof hierarchicalRoots)[number][];
    }

    const categoryBuckets: Record<string, CategoryBucket> = {};
    const ensureBucket = (cat: string) => {
      categoryBuckets[cat] ??= { flat: [], hierarchical: [] };
    };

    for (const cmd of flatCommands) {
      const cat = cmd.command.category || uncategorized;
      ensureBucket(cat);
      categoryBuckets[cat].flat.push(cmd);
    }
    for (const root of hierarchicalRoots) {
      const cat = root.category || uncategorized;
      ensureBucket(cat);
      categoryBuckets[cat].hierarchical.push(root);
    }

    const categories = Object.keys(categoryBuckets).sort();

    // Build category parent tree
    const categoryTree: Record<string, string[]> = {};
    categories.forEach((category) => {
      if (category === uncategorized || !category.includes(':')) return;
      const parts = category.split(':');
      for (let i = parts.length - 1; i > 0; i--) {
        const potentialParent = parts.slice(0, i).join(':');
        if (categories.includes(potentialParent)) {
          categoryTree[potentialParent] ??= [];
          categoryTree[potentialParent].push(category);
          break;
        }
      }
    });

    const processedCategories = new Set<string>();

    const printCategory = (
      category: string,
      indent: string = '',
      isLast: boolean = false,
      parentPrefix: string = '',
    ) => {
      if (processedCategories.has(category)) return;
      processedCategories.add(category);

      const bucket = categoryBuckets[category];
      const hasChildren =
        categoryTree[category] && categoryTree[category].length > 0;
      const allEntries = [...bucket.flat, ...bucket.hierarchical];
      const thisPrefix = isLast ? '└─' : '├─';
      const childIndent = parentPrefix + (isLast ? '   ' : '│  ');

      if (category !== uncategorized) {
        const displayName = category.includes(':')
          ? category.split(':').pop()
          : category;
        console.log(
          colors.cyan(`${indent}${thisPrefix} ${colors.bold(displayName!)}`),
        );
      }

      const cmdIndent = category !== uncategorized ? childIndent : indent;
      const totalEntries = allEntries.length;
      let entryIndex = 0;

      // Print flat commands
      bucket.flat.forEach((cmd) => {
        const isLastEntry = entryIndex === totalEntries - 1 && !hasChildren;
        const cmdPrefix = isLastEntry ? '└─' : '├─';
        const name = cmd.data.command.name;
        const hasMw = cmd.command.middlewares.length > 0;
        const middlewareIcon = hasMw ? colors.magenta(' (λ)') : '';
        console.log(
          `${colors.green(`${cmdIndent}${cmdPrefix}`)} ${colors.yellow(name)}${middlewareIcon}`,
        );
        entryIndex++;
      });

      // Print hierarchical roots (with their sub-trees)
      bucket.hierarchical.forEach((root) => {
        const isLastEntry = entryIndex === totalEntries - 1 && !hasChildren;
        const rootPrefix = cmdIndent + (isLastEntry ? '└─' : '├─');
        const rootChildIndent = cmdIndent + (isLastEntry ? '   ' : '│  ');

        const loadedNode = this.hierarchicalNodes.get(root.id);
        const hasMw =
          loadedNode && loadedNode.command.middlewares.length > 0
            ? colors.magenta(' (λ)')
            : '';
        console.log(
          `${colors.green(rootPrefix)} ${colors.yellow(root.token)}${hasMw}`,
        );

        // Print children of this root
        root.childIds.forEach((childId, idx) => {
          const isLastChild = idx === root.childIds.length - 1;
          const childPrefix = rootChildIndent + (isLastChild ? '└─' : '├─');
          const childIndentNext =
            rootChildIndent + (isLastChild ? '   ' : '│  ');
          printHierarchicalNode(childId, childPrefix, childIndentNext);
        });

        entryIndex++;
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

    const topLevelCategories = categories
      .filter((category) => {
        if (category === uncategorized) return true;
        if (category.includes(':')) {
          const parts = category.split(':');
          for (let i = 1; i < parts.length; i++) {
            const parentPath = parts.slice(0, i).join(':');
            if (categories.includes(parentPath)) return false;
          }
          return true;
        }
        return true;
      })
      .sort();

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
   * Gets all executable runtime routes, including hierarchical leaves.
   * @returns Array of route-indexed commands
   */
  public getRuntimeCommandsArray() {
    return Array.from(this.runtimeRouteIndex.values());
  }

  /**
   * Gets loaded hierarchical command nodes, including non-executable containers.
   * @returns Array of hierarchical node definitions
   */
  public getHierarchicalNodesArray() {
    return Array.from(this.hierarchicalNodes.values());
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
   * @private
   * @internal
   */
  private normalizeRouteKey(input: string) {
    return input
      .trim()
      .replace(/[.:]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .join('.');
  }

  /**
   * @private
   * @internal
   */
  private buildInteractionRouteKey(source: Interaction) {
    if (!source.isCommand() && !source.isAutocomplete()) {
      return '';
    }

    const segments = [source.commandName];

    if (source.isChatInputCommand() || source.isAutocomplete()) {
      const group = source.options.getSubcommandGroup(false);
      const subcommand = source.options.getSubcommand(false);

      if (group) segments.push(group);
      if (subcommand) segments.push(subcommand);
    }

    return segments.filter(Boolean).join('.');
  }

  /**
   * @private
   * @internal
   */
  private buildMessageRouteKey(parser: MessageCommandParser) {
    return [
      parser.getCommand(),
      parser.getSubcommandGroup(),
      parser.getSubcommand(),
    ]
      .filter(Boolean)
      .join('.');
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
    let routeKey: string | undefined;
    let usedCommandOverride = false;

    if (cmdName) {
      routeKey = this.normalizeRouteKey(cmdName);
      usedCommandOverride = true;
    }

    // Extract command name (and possibly subcommand) from the source
    if (!routeKey) {
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
            const loadedCommand = this.findCommandByRoute(command);
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
          routeKey = this.buildMessageRouteKey(parser);
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

        routeKey = this.buildInteractionRouteKey(source);
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
    const loadedCommand = hint
      ? this.findCommandByName(routeKey!, hint)
      : this.findCommandByRoute(routeKey!, usedCommandOverride);
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

  /**
   * Finds a command by its canonical route key.
   * @param route - The command route or command name
   * @param allowFlatAliasFallback - Whether to check flat aliases if the route key was not found
   * @returns The loaded command or null if not found
   */
  private findCommandByRoute(
    route: string,
    allowFlatAliasFallback = true,
  ): LoadedCommand | null {
    const normalizedRoute = this.normalizeRouteKey(route);
    const directMatch = this.runtimeRouteIndex.get(normalizedRoute);
    if (directMatch) return directMatch;

    if (!allowFlatAliasFallback || normalizedRoute.includes('.')) {
      return null;
    }

    for (const loadedCommand of this.runtimeRouteIndex.values()) {
      const aliases = loadedCommand.data.metadata?.aliases;
      if (
        aliases &&
        Array.isArray(aliases) &&
        aliases.includes(normalizedRoute)
      ) {
        return loadedCommand;
      }
    }

    return null;
  }

  /**
   * @private
   * @internal
   */
  private getRouteKeyFor(command: LoadedCommand) {
    return (
      (command.data.command as Record<string, any>).__routeKey ??
      this.normalizeRouteKey(command.data.command.name)
    );
  }

  public resolveMessageCommandName(name: string): string {
    const loadedCommand = this.findCommandByRoute(name);
    if (loadedCommand) {
      return this.getRouteKeyFor(loadedCommand);
    }

    return name;
  }

  /**
   * Reloads all commands and middleware from scratch.
   */
  public async reloadCommands() {
    this.loadedCommands.clear();
    this.loadedMiddlewares.clear();
    this.runtimeRouteIndex.clear();
    this.hierarchicalNodes.clear();
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
      this.registerRuntimeRoute(command);
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

    const { commands, middlewares, treeNodes, compiledRoutes } =
      commandsRouter.getData();

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

    const hierarchicalNodes = Array.from(treeNodes.values())
      .filter((node) => node.source !== 'flat' && !!node.definitionPath)
      .sort((left, right) => left.route.length - right.route.length);

    for (const node of hierarchicalNodes) {
      const routeKey = node.route.join('.');
      await this.loadHierarchicalNode(
        node,
        compiledRoutes.get(routeKey) ?? undefined,
      );
    }

    // generate types
    if (COMMANDKIT_IS_DEV) {
      const commandNames = Array.from(this.runtimeRouteIndex.keys());
      const aliases = Array.from(this.runtimeRouteIndex.values()).flatMap(
        (v) => v.metadata.aliases || [],
      );

      const allNames = Array.from(new Set([...commandNames, ...aliases]));

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
  private shouldIndexAsRuntimeRoute(command: LoadedCommand) {
    return !!(
      command.data.chatInput ||
      command.data.message ||
      command.data.autocomplete
    );
  }

  /**
   * @private
   * @internal
   */
  private registerRuntimeRoute(command: LoadedCommand, routeKey?: string) {
    if (!this.shouldIndexAsRuntimeRoute(command)) return;

    const key = this.normalizeRouteKey(routeKey ?? command.data.command.name);
    if (!key) return;

    const commandData = command.data.command as Record<string, any>;
    commandData.__routeKey ??= key;

    this.runtimeRouteIndex.set(key, command);
  }

  /**
   * @private
   * @internal
   */
  private async processCommandFile(
    fileUrl: string,
    identifier: string,
    fallbackName: string,
    isHierarchical: boolean,
  ) {
    const commandFileData = (await import(
      `${toFileURL(fileUrl)}?t=${Date.now()}`
    )) as AppCommandNative;

    if (!commandFileData.command) {
      throw new Error(
        `Invalid export for ${isHierarchical ? 'hierarchical node' : 'command'} ${identifier}: no command definition found`,
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

    let commandName = commandFileData.command.name;

    if (isHierarchical) {
      if (typeof commandName === 'string' && commandName !== fallbackName) {
        Logger.warn(
          `Hierarchical node \`${identifier}\` overrides its command name with \`${commandName}\`. The filesystem token \`${fallbackName}\` will be used instead.`,
        );
      }
      commandName = fallbackName;
    } else {
      commandName = commandName || fallbackName;
    }

    let commandDescription = commandFileData.command.description as
      | string
      | undefined;

    if (!commandDescription && commandFileData.chatInput) {
      commandDescription = 'No command description set.';
    }

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
            `Invalid export for ${isHierarchical ? 'hierarchical node' : 'command'} ${identifier}: ${key} does not match expected value`,
          );
        }

        if (!KNOWN_NON_HANDLER_KEYS.includes(key)) {
          handlerCount++;
        }
      }
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
        `Command \`${identifier}\` uses deprecated metadata properties. Please update to use the new \`metadata\` object or \`generateMetadata\` function.`,
      );
    }

    const resolvedMetadata = {
      guilds: commandJson.guilds,
      aliases: commandJson.aliases,
      ...metadata,
    };

    return {
      commandFileData,
      handlerCount,
      commandJson,
      resolvedMetadata,
    };
  }

  /**
   * @private
   * @internal
   */
  private async loadCommand(id: string, command: Command) {
    try {
      // Skip if path is null (directory-only command group) - external plugins
      if (command.path === null) {
        const loadedCommand: LoadedCommand = {
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
        };

        this.loadedCommands.set(id, loadedCommand);
        this.registerRuntimeRoute(loadedCommand);
        return;
      }

      const { commandFileData, handlerCount, commandJson, resolvedMetadata } =
        await this.processCommandFile(
          command.path,
          command.name,
          command.name,
          false,
        );

      if (handlerCount === 0) {
        throw new Error(
          `Invalid export for command ${command.name}: at least one handler function must be provided`,
        );
      }

      const loadedCommand: LoadedCommand = {
        discordId: null,
        command,
        metadata: resolvedMetadata,
        data: {
          ...commandFileData,
          metadata: resolvedMetadata,
          command: commandJson,
        },
      };

      this.loadedCommands.set(id, loadedCommand);
      this.registerRuntimeRoute(loadedCommand);

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
   * Loads a hierarchical command node into the hierarchical cache.
   * Executable leaves are also added to the runtime route index.
   * @private
   * @internal
   */
  private async loadHierarchicalNode(
    node: CommandTreeNode,
    compiledRoute?: CompiledCommandRoute,
  ) {
    if (!node.definitionPath) return;

    const routeKey = node.route.join('.');
    const command: Command = {
      id: node.id,
      name: routeKey,
      path: node.definitionPath,
      relativePath: compiledRoute?.relativePath ?? node.relativePath,
      parentPath: dirname(node.definitionPath),
      middlewares: compiledRoute ? [...compiledRoute.middlewares] : [],
      category: node.category,
    };

    try {
      const { commandFileData, handlerCount, commandJson, resolvedMetadata } =
        await this.processCommandFile(command.path, routeKey, node.token, true);

      const isRootHierarchyLeaf = node.kind === 'command';
      const hasContextMenuHandlers = !!(
        commandFileData.userContextMenu || commandFileData.messageContextMenu
      );
      const hasExecutableSlashHandlers = !!(
        commandFileData.chatInput ||
        commandFileData.message ||
        commandFileData.autocomplete
      );

      if (!isRootHierarchyLeaf && hasContextMenuHandlers) {
        throw new Error(
          `Invalid export for hierarchical node ${routeKey}: context menu handlers are only supported for top-level root commands.`,
        );
      }

      if (node.executable && handlerCount === 0) {
        throw new Error(
          `Invalid export for hierarchical node ${routeKey}: executable leaves must provide at least one handler function`,
        );
      }

      if (!node.executable && hasExecutableSlashHandlers) {
        throw new Error(
          `Invalid export for hierarchical node ${routeKey}: non-leaf hierarchical nodes cannot export executable slash/prefix handlers`,
        );
      }

      const loadedCommand: LoadedCommand = {
        discordId: null,
        command,
        metadata: resolvedMetadata,
        data: {
          ...commandFileData,
          metadata: resolvedMetadata,
          command: {
            ...commandJson,
            __routeKey: routeKey,
          },
        },
      };

      this.hierarchicalNodes.set(node.id, loadedCommand);

      if (node.executable) {
        this.registerRuntimeRoute(loadedCommand, routeKey);
      }

      if (isRootHierarchyLeaf && hasContextMenuHandlers) {
        this.generateContextMenuCommands(
          node.id,
          command,
          commandFileData,
          commandJson,
          resolvedMetadata,
        );
      }
    } catch (error) {
      Logger.error`Failed to load hierarchical node ${routeKey} (${node.id}): ${error}`;
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
    const loadedCommand = hint
      ? this.findCommandByName(command, hint)
      : this.findCommandByRoute(command);
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
