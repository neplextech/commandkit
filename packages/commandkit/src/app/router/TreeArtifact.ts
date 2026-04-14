import { isAbsolute, join, normalize, relative } from 'node:path';
import type { EventsTree } from './EventsRouter';
import type { ParsedCommandData } from './CommandsRouter';

export const ROUTER_TREE_ARTIFACT_SCHEMA_VERSION = 1;
export const ROUTER_TREE_ARTIFACT_FILE = 'router-tree.json';
export const ROUTER_TREE_ARTIFACT_DIRECTORY = '.commandkit';

export interface RouterTreeArtifact {
  schemaVersion: number;
  commandkitVersion: string;
  generatedAt: string;
  commands: ParsedCommandData;
  events: EventsTree;
}

export function createRouterTreeArtifact(options: {
  outputRoot: string;
  commandkitVersion: string;
  commands: ParsedCommandData;
  events: EventsTree;
}): RouterTreeArtifact {
  const { outputRoot, commandkitVersion } = options;

  return {
    schemaVersion: ROUTER_TREE_ARTIFACT_SCHEMA_VERSION,
    commandkitVersion,
    generatedAt: new Date().toISOString(),
    commands: mapCommandDataPaths(options.commands, outputRoot, toRelativePath),
    events: mapEventsTreePaths(options.events, outputRoot, toRelativePath),
  };
}

export function validateRouterTreeArtifact(
  input: unknown,
  runtimeVersion: string,
): input is RouterTreeArtifact {
  if (!input || typeof input !== 'object') return false;

  const artifact = input as Partial<RouterTreeArtifact>;

  if (artifact.schemaVersion !== ROUTER_TREE_ARTIFACT_SCHEMA_VERSION) {
    return false;
  }

  if (
    !artifact.commandkitVersion ||
    artifact.commandkitVersion !== runtimeVersion
  ) {
    return false;
  }

  if (!artifact.commands || typeof artifact.commands !== 'object') {
    return false;
  }

  if (!artifact.events || typeof artifact.events !== 'object') {
    return false;
  }

  return true;
}

export function hydrateRouterTreeArtifact(
  artifact: RouterTreeArtifact,
  outputRoot: string,
): {
  commands: ParsedCommandData;
  events: EventsTree;
} {
  return {
    commands: mapCommandDataPaths(
      artifact.commands,
      outputRoot,
      toAbsolutePath,
    ),
    events: mapEventsTreePaths(artifact.events, outputRoot, toAbsolutePath),
  };
}

function mapCommandDataPaths(
  data: ParsedCommandData,
  root: string,
  mapper: (rootPath: string, path: string) => string,
): ParsedCommandData {
  const commands = Object.fromEntries(
    Object.entries(data.commands ?? {}).map(([id, command]) => [
      id,
      {
        ...command,
        path: mapper(root, command.path),
        parentPath: mapper(root, command.parentPath),
      },
    ]),
  );

  const middlewares = Object.fromEntries(
    Object.entries(data.middlewares ?? {}).map(([id, middleware]) => [
      id,
      {
        ...middleware,
        path: mapper(root, middleware.path),
        parentPath: mapper(root, middleware.parentPath),
      },
    ]),
  );

  const treeNodes = Object.fromEntries(
    Object.entries(data.treeNodes ?? {}).map(([id, node]) => [
      id,
      {
        ...node,
        directoryPath: mapper(root, node.directoryPath),
        definitionPath:
          node.definitionPath === null
            ? null
            : mapper(root, node.definitionPath),
      },
    ]),
  );

  const compiledRoutes = Object.fromEntries(
    Object.entries(data.compiledRoutes ?? {}).map(([id, route]) => [
      id,
      {
        ...route,
        definitionPath: mapper(root, route.definitionPath),
      },
    ]),
  );

  const diagnostics = (data.diagnostics ?? []).map((diagnostic) => ({
    ...diagnostic,
    path: mapper(root, diagnostic.path),
  }));

  return {
    commands,
    middlewares,
    treeNodes,
    compiledRoutes,
    diagnostics,
  };
}

function mapEventsTreePaths(
  events: EventsTree,
  root: string,
  mapper: (rootPath: string, path: string) => string,
): EventsTree {
  return Object.fromEntries(
    Object.entries(events ?? {}).map(([id, event]) => [
      id,
      {
        ...event,
        path: mapper(root, event.path),
        listeners: event.listeners.map((listener) => mapper(root, listener)),
      },
    ]),
  );
}

function toRelativePath(rootPath: string, path: string): string {
  if (!path) return path;

  const normalizedPath = normalize(path);

  if (!isAbsolute(normalizedPath)) {
    return normalizedPath;
  }

  return normalize(relative(rootPath, normalizedPath));
}

function toAbsolutePath(rootPath: string, path: string): string {
  if (!path) return path;

  const normalizedPath = normalize(path);

  if (isAbsolute(normalizedPath)) {
    return normalizedPath;
  }

  return normalize(join(rootPath, normalizedPath));
}
