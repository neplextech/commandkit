import { Collection } from 'discord.js';
import { Dirent, existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, dirname, extname, join, normalize } from 'node:path';
import {
  CommandRouteDiagnostic,
  CommandTreeNode,
  CommandTreeNodeKind,
  CompiledCommandRoute,
} from './CommandTree';

/**
 * Represents a command with its metadata and middleware associations.
 */
export interface Command {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  parentPath: string;
  middlewares: Array<string>;
  category: string | null;
}

/**
 * Represents a middleware with its metadata and scope.
 */
export interface Middleware {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  parentPath: string;
  global: boolean;
  command: string | null;
}

/**
 * Data structure containing parsed commands, middleware, and tree data.
 */
export interface ParsedCommandData {
  commands: Record<string, Command>;
  middlewares: Record<string, Middleware>;
  treeNodes?: Record<string, CommandTreeNode>;
  compiledRoutes?: Record<string, CompiledCommandRoute>;
  diagnostics?: CommandRouteDiagnostic[];
}

/**
 * Configuration options for the commands router.
 */
export interface CommandsRouterOptions {
  entrypoint: string;
}

const ROOT_NODE_ID = '__commandkit_router_root__';

/**
 * @private
 * @internal
 */
const MIDDLEWARE_PATTERN = /^\+middleware\.(m|c)?(j|t)sx?$/;

/**
 * @private
 * @internal
 */
const COMMAND_MIDDLEWARE_PATTERN =
  /^\+([^+().][^().]*)\.middleware\.(m|c)?(j|t)sx?$/;

/**
 * @private
 * @internal
 */
const GLOBAL_MIDDLEWARE_PATTERN = /^\+global-middleware\.(m|c)?(j|t)sx?$/;

/**
 * @private
 * @internal
 */
const COMMAND_PATTERN = /^([^+().][^().]*)\.(m|c)?(j|t)sx?$/;

/**
 * @private
 * @internal
 */
const CATEGORY_PATTERN = /^\(.+\)$/;

/**
 * @private
 * @internal
 */
const COMMAND_DIRECTORY_PATTERN = /^\[([^\][\\\/]+)\]$/;

/**
 * @private
 * @internal
 */
const GROUP_DIRECTORY_PATTERN = /^\{([^}{\\\/]+)\}$/;

/**
 * @private
 * @internal
 */
const COMMAND_DEFINITION_PATTERN = /^command\.(m|c)?(j|t)sx?$/;

/**
 * @private
 * @internal
 */
const GROUP_DEFINITION_PATTERN = /^group\.(m|c)?(j|t)sx?$/;

/**
 * @private
 * @internal
 */
const SUBCOMMAND_FILE_PATTERN =
  /^([^+().][^().]*)\.subcommand\.(m|c)?(j|t)sx?$/;

/**
 * Handles discovery and parsing of command and middleware files in the filesystem.
 */
export class CommandsRouter {
  /**
   * @private
   * @internal
   */
  private commands = new Collection<string, Command>();

  /**
   * @private
   * @internal
   */
  private middlewares = new Collection<string, Middleware>();

  /**
   * @private
   * @internal
   */
  private treeNodes = new Collection<string, CommandTreeNode>();

  /**
   * @private
   * @internal
   */
  private compiledRoutes = new Collection<string, CompiledCommandRoute>();

  /**
   * @private
   * @internal
   */
  private diagnostics: CommandRouteDiagnostic[] = [];

  /**
   * Creates a new CommandsRouter instance.
   * @param options - Configuration options for the router
   */
  public constructor(private readonly options: CommandsRouterOptions) {}

  /**
   * Populates the router with existing command, middleware, and tree data.
   * @param data - Parsed command data to populate with
   */
  public populate(data: ParsedCommandData) {
    this.clear();

    for (const [id, command] of Object.entries(data.commands)) {
      this.commands.set(id, command);
    }

    for (const [id, middleware] of Object.entries(data.middlewares)) {
      this.middlewares.set(id, middleware);
    }

    for (const [id, node] of Object.entries(data.treeNodes ?? {})) {
      this.treeNodes.set(id, node);
    }

    for (const [key, route] of Object.entries(data.compiledRoutes ?? {})) {
      this.compiledRoutes.set(key, route);
    }

    this.diagnostics = [...(data.diagnostics ?? [])];
  }

  /**
   * Checks if the configured entrypoint path exists.
   * @returns True if the path exists
   */
  public isValidPath(): boolean {
    return existsSync(this.options.entrypoint);
  }

  /**
   * @private
   * @internal
   */
  private isCommand(name: string): boolean {
    return COMMAND_PATTERN.test(name);
  }

  /**
   * @private
   * @internal
   */
  private isMiddleware(name: string): boolean {
    return (
      MIDDLEWARE_PATTERN.test(name) ||
      GLOBAL_MIDDLEWARE_PATTERN.test(name) ||
      COMMAND_MIDDLEWARE_PATTERN.test(name)
    );
  }

  /**
   * @private
   * @internal
   */
  private isCategory(name: string): boolean {
    return CATEGORY_PATTERN.test(name);
  }

  /**
   * @private
   * @internal
   */
  private isCommandDirectory(name: string): boolean {
    return COMMAND_DIRECTORY_PATTERN.test(name);
  }

  /**
   * @private
   * @internal
   */
  private isGroupDirectory(name: string): boolean {
    return GROUP_DIRECTORY_PATTERN.test(name);
  }

  /**
   * @private
   * @internal
   */
  private isCommandDefinition(name: string): boolean {
    return COMMAND_DEFINITION_PATTERN.test(name);
  }

  /**
   * @private
   * @internal
   */
  private isGroupDefinition(name: string): boolean {
    return GROUP_DEFINITION_PATTERN.test(name);
  }

  /**
   * @private
   * @internal
   */
  private isSubcommandFile(name: string): boolean {
    return SUBCOMMAND_FILE_PATTERN.test(name);
  }

  /**
   * Clears all loaded commands, middleware, and compiled tree data.
   */
  public clear() {
    this.commands.clear();
    this.middlewares.clear();
    this.treeNodes.clear();
    this.compiledRoutes.clear();
    this.diagnostics = [];
  }

  /**
   * Scans the filesystem for commands and middleware files.
   * @returns Parsed command data
   */
  public async scan() {
    this.clear();
    this.initializeRootNode();

    const entries = await readdir(this.options.entrypoint, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (entry.name.startsWith('_')) continue;

      const fullPath = join(this.options.entrypoint, entry.name);

      if (entry.isFile()) {
        if (this.isSubcommandFile(entry.name)) {
          this.addDiagnostic(
            'ROOT_SUBCOMMAND_NOT_ALLOWED',
            'Subcommand shorthand files must be nested inside a command or group directory.',
            fullPath,
          );
          continue;
        }

        if (this.isCommand(entry.name) || this.isMiddleware(entry.name)) {
          const result = await this.handle(entry);

          if (result.command) {
            this.createFlatCommandNode(result.command);
          }
        }

        continue;
      }

      if (!entry.isDirectory()) continue;

      if (this.isCategory(entry.name)) {
        await this.traverseLegacyDirectory(fullPath, entry.name.slice(1, -1));
        continue;
      }

      if (this.isCommandDirectory(entry.name)) {
        await this.traverseCommandDirectory(
          fullPath,
          entry.name.match(COMMAND_DIRECTORY_PATTERN)![1],
          null,
          ROOT_NODE_ID,
        );
        continue;
      }

      if (this.isGroupDirectory(entry.name)) {
        this.addDiagnostic(
          'ROOT_GROUP_NOT_ALLOWED',
          'Group directories must be nested inside a command directory.',
          fullPath,
        );
        continue;
      }

      await this.traverseLegacyDirectory(fullPath, null);
    }

    await this.applyMiddlewares();
    this.compileTree();

    return this.toJSON();
  }

  /**
   * Gets the raw command, middleware, and compiled tree collections.
   * @returns Object containing router collections
   */
  public getData() {
    return {
      commands: this.commands,
      middlewares: this.middlewares,
      treeNodes: this.treeNodes,
      compiledRoutes: this.compiledRoutes,
      diagnostics: this.diagnostics,
    };
  }

  /**
   * Gets only the internal command tree and compiled route data.
   * @returns Object containing tree data
   */
  public getTreeData() {
    return {
      treeNodes: this.treeNodes,
      compiledRoutes: this.compiledRoutes,
      diagnostics: this.diagnostics,
    };
  }

  /**
   * Converts the loaded data to a JSON-serializable format.
   * @returns Plain object with commands, middleware, and tree data
   */
  public toJSON() {
    return {
      commands: Object.fromEntries(this.commands.entries()),
      middlewares: Object.fromEntries(this.middlewares.entries()),
      treeNodes: Object.fromEntries(this.treeNodes.entries()),
      compiledRoutes: Object.fromEntries(this.compiledRoutes.entries()),
      diagnostics: this.diagnostics,
    };
  }

  /**
   * @private
   * @internal
   */
  private initializeRootNode() {
    this.treeNodes.set(ROOT_NODE_ID, {
      id: ROOT_NODE_ID,
      source: 'root',
      kind: 'root',
      token: '',
      route: [],
      category: null,
      parentId: null,
      childIds: [],
      directoryPath: this.options.entrypoint,
      definitionPath: null,
      relativePath: '',
      shorthand: false,
      executable: false,
    });
  }

  /**
   * @private
   * @internal
   */
  private async traverseLegacyDirectory(path: string, category: string | null) {
    const entries = await readdir(path, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (entry.name.startsWith('_')) continue;

      const fullPath = join(path, entry.name);

      if (entry.isFile()) {
        if (this.isSubcommandFile(entry.name)) {
          this.addDiagnostic(
            'ORPHAN_SUBCOMMAND_FILE',
            'Subcommand shorthand files must be nested inside a command or group directory.',
            fullPath,
          );
          continue;
        }

        if (this.isCommand(entry.name) || this.isMiddleware(entry.name)) {
          const result = await this.handle(entry, category);

          if (result.command) {
            this.createFlatCommandNode(result.command);
          }
        }

        continue;
      }

      if (!entry.isDirectory()) continue;

      if (this.isCommandDirectory(entry.name)) {
        await this.traverseCommandDirectory(
          fullPath,
          entry.name.match(COMMAND_DIRECTORY_PATTERN)![1],
          category,
          ROOT_NODE_ID,
        );
        continue;
      }

      if (this.isGroupDirectory(entry.name)) {
        this.addDiagnostic(
          'ORPHAN_GROUP_DIRECTORY',
          'Group directories must be nested inside a command directory.',
          fullPath,
        );
        continue;
      }

      if (this.isCategory(entry.name) && category) {
        const nestedCategory = `${category}:${entry.name.slice(1, -1)}`;
        await this.traverseLegacyDirectory(fullPath, nestedCategory);
      }
    }
  }

  /**
   * @private
   * @internal
   */
  private async traverseCommandDirectory(
    path: string,
    token: string,
    category: string | null,
    parentId: string,
  ) {
    const node = this.createTreeNode({
      source: 'directory',
      token,
      category,
      parentId,
      directoryPath: path,
      definitionPath: null,
      shorthand: false,
    });

    if (!node) return;

    const entries = await readdir(path, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (entry.name.startsWith('_')) continue;

      const fullPath = join(path, entry.name);

      if (entry.isFile()) {
        if (this.isCommandDefinition(entry.name)) {
          node.definitionPath = fullPath;
          node.relativePath = this.replaceEntrypoint(fullPath);
          continue;
        }

        if (this.isSubcommandFile(entry.name)) {
          this.createTreeNode({
            source: 'shorthand',
            token: entry.name.match(SUBCOMMAND_FILE_PATTERN)![1],
            category,
            parentId: node.id,
            directoryPath: path,
            definitionPath: fullPath,
            shorthand: true,
          });
          continue;
        }

        if (this.isMiddleware(entry.name)) {
          await this.handle(entry, category);
          continue;
        }

        if (this.isCommand(entry.name)) {
          this.addDiagnostic(
            'UNSUPPORTED_FILE_IN_COMMAND_DIRECTORY',
            'Only command.ts, middleware files, and subcommand shorthand files are supported inside a command directory.',
            fullPath,
          );
        }

        continue;
      }

      if (!entry.isDirectory()) continue;

      if (this.isCommandDirectory(entry.name)) {
        await this.traverseCommandDirectory(
          fullPath,
          entry.name.match(COMMAND_DIRECTORY_PATTERN)![1],
          category,
          node.id,
        );
        continue;
      }

      if (this.isGroupDirectory(entry.name)) {
        await this.traverseGroupDirectory(
          fullPath,
          entry.name.match(GROUP_DIRECTORY_PATTERN)![1],
          category,
          node.id,
        );
        continue;
      }

      if (this.isCategory(entry.name)) {
        this.addDiagnostic(
          'UNSUPPORTED_CATEGORY_IN_HIERARCHY',
          'Category directories inside command/group directories are not supported in this initial implementation.',
          fullPath,
        );
      }
    }

    if (!node.definitionPath) {
      this.addDiagnostic(
        'MISSING_COMMAND_DEFINITION',
        'Command directories must include a command.ts file.',
        path,
      );
    }
  }

  /**
   * @private
   * @internal
   */
  private async traverseGroupDirectory(
    path: string,
    token: string,
    category: string | null,
    parentId: string,
  ) {
    const node = this.createTreeNode({
      source: 'group',
      token,
      category,
      parentId,
      directoryPath: path,
      definitionPath: null,
      shorthand: false,
    });

    if (!node) return;

    const entries = await readdir(path, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (entry.name.startsWith('_')) continue;

      const fullPath = join(path, entry.name);

      if (entry.isFile()) {
        if (this.isGroupDefinition(entry.name)) {
          node.definitionPath = fullPath;
          node.relativePath = this.replaceEntrypoint(fullPath);
          continue;
        }

        if (this.isSubcommandFile(entry.name)) {
          this.createTreeNode({
            source: 'shorthand',
            token: entry.name.match(SUBCOMMAND_FILE_PATTERN)![1],
            category,
            parentId: node.id,
            directoryPath: path,
            definitionPath: fullPath,
            shorthand: true,
          });
          continue;
        }

        if (this.isMiddleware(entry.name)) {
          await this.handle(entry, category);
          continue;
        }

        if (this.isCommand(entry.name)) {
          this.addDiagnostic(
            'UNSUPPORTED_FILE_IN_GROUP_DIRECTORY',
            'Only group.ts, middleware files, and subcommand shorthand files are supported inside a group directory.',
            fullPath,
          );
        }

        continue;
      }

      if (!entry.isDirectory()) continue;

      if (this.isCommandDirectory(entry.name)) {
        await this.traverseCommandDirectory(
          fullPath,
          entry.name.match(COMMAND_DIRECTORY_PATTERN)![1],
          category,
          node.id,
        );
        continue;
      }

      if (this.isGroupDirectory(entry.name)) {
        this.addDiagnostic(
          'NESTED_GROUP_NOT_ALLOWED',
          'Subcommand groups cannot contain nested group directories.',
          fullPath,
        );
        continue;
      }

      if (this.isCategory(entry.name)) {
        this.addDiagnostic(
          'UNSUPPORTED_CATEGORY_IN_HIERARCHY',
          'Category directories inside command/group directories are not supported in this initial implementation.',
          fullPath,
        );
      }
    }

    if (!node.definitionPath) {
      this.addDiagnostic(
        'MISSING_GROUP_DEFINITION',
        'Group directories must include a group.ts file.',
        path,
      );
    }
  }

  /**
   * @private
   * @internal
   */
  private createFlatCommandNode(command: Command) {
    this.createTreeNode({
      id: command.id,
      source: 'flat',
      token: command.name,
      category: command.category,
      parentId: ROOT_NODE_ID,
      directoryPath: command.parentPath,
      definitionPath: command.path,
      shorthand: false,
    });
  }

  /**
   * @private
   * @internal
   */
  private createTreeNode(options: {
    id?: string;
    source: Exclude<CommandTreeNode['source'], 'root'>;
    token: string;
    category: string | null;
    parentId: string;
    directoryPath: string;
    definitionPath: string | null;
    shorthand: boolean;
  }) {
    const parent = this.treeNodes.get(options.parentId);

    if (!parent) {
      this.addDiagnostic(
        'MISSING_PARENT_NODE',
        `Unable to create command tree node "${options.token}" because its parent node was not found.`,
        options.directoryPath,
      );
      return null;
    }

    const duplicate = parent.childIds.some((childId) => {
      return this.treeNodes.get(childId)?.token === options.token;
    });

    if (duplicate) {
      this.addDiagnostic(
        'DUPLICATE_SIBLING_TOKEN',
        `Duplicate command token "${options.token}" found under the same parent.`,
        options.definitionPath ?? options.directoryPath,
      );
      return null;
    }

    const route = [...parent.route, options.token];
    const node: CommandTreeNode = {
      id: options.id ?? crypto.randomUUID(),
      source: options.source,
      kind: this.resolveNodeKind(options.source, route.length),
      token: options.token,
      route,
      category: options.category,
      parentId: options.parentId,
      childIds: [],
      directoryPath: options.directoryPath,
      definitionPath: options.definitionPath,
      relativePath: this.replaceEntrypoint(
        options.definitionPath ?? options.directoryPath,
      ),
      shorthand: options.shorthand,
      executable: false,
    };

    this.treeNodes.set(node.id, node);
    parent.childIds.push(node.id);

    return node;
  }

  /**
   * @private
   * @internal
   */
  private resolveNodeKind(
    source: CommandTreeNode['source'],
    depth: number,
  ): CommandTreeNodeKind {
    switch (source) {
      case 'root':
        return 'root';
      case 'flat':
        return 'flat';
      case 'group':
        return 'group';
      case 'shorthand':
        return 'subcommand';
      case 'directory':
        return depth === 1 ? 'command' : 'subcommand';
      default:
        return source satisfies never;
    }
  }

  /**
   * @private
   * @internal
   */
  private compileTree() {
    this.compiledRoutes.clear();

    for (const node of this.treeNodes.values()) {
      if (node.id === ROOT_NODE_ID) continue;

      const hasChildren = node.childIds.length > 0;
      node.executable =
        !!node.definitionPath && node.kind !== 'group' && !hasChildren;

      if (node.kind === 'subcommand' && hasChildren) {
        this.addDiagnostic(
          'SUBCOMMAND_CANNOT_HAVE_CHILDREN',
          `Subcommand "${node.route.join('.')}" cannot contain child command nodes.`,
          node.definitionPath ?? node.directoryPath,
        );
      }

      if (node.kind === 'command') {
        const childKinds = new Set(
          node.childIds
            .map((childId) => this.treeNodes.get(childId)?.kind)
            .filter(Boolean),
        );

        if (childKinds.has('group') && childKinds.has('subcommand')) {
          this.addDiagnostic(
            'MIXED_ROOT_CHILDREN',
            `Command "${node.route.join('.')}" cannot mix direct subcommands and subcommand groups.`,
            node.definitionPath ?? node.directoryPath,
          );
        }
      }

      if (!node.executable || !node.definitionPath) continue;

      const key = node.route.join('.');
      const routeKind = node.kind as Exclude<
        CommandTreeNodeKind,
        'root' | 'group'
      >;
      this.compiledRoutes.set(key, {
        id: node.id,
        key,
        kind: routeKind,
        token: node.token,
        route: node.route,
        category: node.category,
        definitionPath: node.definitionPath,
        relativePath: this.replaceEntrypoint(node.definitionPath),
        nodeId: node.id,
        middlewares: this.collectCompiledMiddlewares(node),
      });
    }
  }

  /**
   * @private
   * @internal
   */
  private collectCompiledMiddlewares(node: CommandTreeNode) {
    const allMiddlewares = Array.from(this.middlewares.values());
    const globalMiddlewares = allMiddlewares
      .filter((middleware) => middleware.global)
      .map((middleware) => middleware.id);

    const directoryPaths = this.getDirectoryAncestors(node.directoryPath);
    const directoryMiddlewares = directoryPaths.flatMap((path) => {
      return allMiddlewares
        .filter((middleware) => {
          return (
            !middleware.global &&
            !middleware.command &&
            middleware.parentPath === path
          );
        })
        .map((middleware) => middleware.id);
    });

    const commandSpecificMiddlewares = allMiddlewares
      .filter((middleware) => {
        return (
          middleware.command === node.token &&
          middleware.parentPath === node.directoryPath
        );
      })
      .map((middleware) => middleware.id);

    return [
      ...globalMiddlewares,
      ...directoryMiddlewares,
      ...commandSpecificMiddlewares,
    ];
  }

  /**
   * @private
   * @internal
   */
  private getDirectoryAncestors(path: string) {
    const normalizedPath = normalize(path);
    const normalizedEntrypoint = normalize(this.options.entrypoint);
    const ancestors: string[] = [];

    let current = normalizedPath;

    while (current.startsWith(normalizedEntrypoint)) {
      ancestors.push(current);

      if (current === normalizedEntrypoint) break;

      const parent = normalize(dirname(current));
      if (parent === current) break;
      current = parent;
    }

    return ancestors.reverse();
  }

  /**
   * @private
   * @internal
   */
  private addDiagnostic(code: string, message: string, path: string) {
    this.diagnostics.push({
      code,
      message,
      path: normalize(path),
    });
  }

  /**
   * @private
   * @internal
   */
  private async handle(entry: Dirent, category: string | null = null) {
    const name = entry.name;
    const path = join(entry.parentPath, entry.name);

    if (this.isCommand(name)) {
      const command: Command = {
        id: crypto.randomUUID(),
        name: basename(path, extname(path)),
        path,
        category,
        parentPath: entry.parentPath,
        relativePath: this.replaceEntrypoint(path),
        middlewares: [],
      };

      this.commands.set(command.id, command);
      return { command };
    }

    if (this.isMiddleware(name)) {
      const middleware: Middleware = {
        id: crypto.randomUUID(),
        name: basename(path, extname(path)),
        path,
        relativePath: this.replaceEntrypoint(path),
        parentPath: entry.parentPath,
        global: GLOBAL_MIDDLEWARE_PATTERN.test(name),
        command: COMMAND_MIDDLEWARE_PATTERN.test(name)
          ? name.match(COMMAND_MIDDLEWARE_PATTERN)?.[1] || null
          : null,
      };

      this.middlewares.set(middleware.id, middleware);
      return { middleware };
    }

    return {};
  }

  /**
   * @private
   * @internal
   */
  private applyMiddlewares() {
    this.commands.forEach((command) => {
      const commandPath = command.parentPath;
      const allMiddlewares = Array.from(this.middlewares.values());

      const commandSpecificMiddlewares = allMiddlewares
        .filter((middleware) => middleware.command === command.name)
        .map((middleware) => middleware.id);

      const directorySpecificMiddlewares = allMiddlewares
        .filter((middleware) => {
          return (
            !middleware.global &&
            !middleware.command &&
            middleware.parentPath === commandPath
          );
        })
        .map((middleware) => middleware.id);

      const globalMiddlewares = allMiddlewares
        .filter((middleware) => middleware.global)
        .map((middleware) => middleware.id);

      command.middlewares = [
        ...globalMiddlewares,
        ...directorySpecificMiddlewares,
        ...commandSpecificMiddlewares,
      ];
    });
  }

  /**
   * @private
   * @internal
   */
  private replaceEntrypoint(path: string) {
    const normalized = normalize(path);
    return normalized.replace(this.options.entrypoint, '');
  }
}
