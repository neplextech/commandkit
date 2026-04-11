/**
 * Source types for command tree nodes discovered from the filesystem.
 */
export type CommandTreeNodeSource =
  | 'root'
  | 'flat'
  | 'directory'
  | 'group'
  | 'shorthand';

/**
 * Logical node kinds after tree compilation.
 */
export type CommandTreeNodeKind =
  | 'root'
  | 'flat'
  | 'command'
  | 'group'
  | 'subcommand';

/**
 * Internal tree node representing either a filesystem command or a
 * hierarchical container.
 */
export interface CommandTreeNode {
  id: string;
  source: CommandTreeNodeSource;
  kind: CommandTreeNodeKind;
  token: string;
  route: string[];
  category: string | null;
  parentId: string | null;
  childIds: string[];
  directoryPath: string;
  definitionPath: string | null;
  relativePath: string;
  shorthand: boolean;
  executable: boolean;
}

/**
 * Executable command route produced from the internal tree.
 */
export interface CompiledCommandRoute {
  id: string;
  key: string;
  kind: Exclude<CommandTreeNodeKind, 'root' | 'group'>;
  token: string;
  route: string[];
  category: string | null;
  definitionPath: string;
  relativePath: string;
  nodeId: string;
  middlewares: string[];
}

/**
 * Validation or compilation diagnostic emitted while building the
 * command tree.
 */
export interface CommandRouteDiagnostic {
  code: string;
  message: string;
  path: string;
}
