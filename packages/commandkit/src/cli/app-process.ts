import { IOType, spawn } from 'node:child_process';
import { DevEnv, ProdEnv } from './env';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { panic } from './common';
import { ResolvedCommandKitConfig } from '../config/utils';
import { CommandKitJsRuntime } from '../config/types';

/**
 * @private
 * @internal
 */
function getStdio(supportsCommands: boolean) {
  if (supportsCommands) {
    return ['pipe', 'pipe', 'pipe', 'ipc'];
  }

  return ['pipe', 'pipe', 'pipe'];
}

const RuntimeLookup: [CommandKitJsRuntime, () => boolean][] = [
  // @ts-ignore Bun types
  ['bun', () => typeof Bun !== 'undefined' && typeof Bun.version === 'string'],
  [
    'deno',
    () =>
      // @ts-ignore Deno types
      typeof Deno !== 'undefined' &&
      // @ts-ignore Deno types
      typeof Deno.version === 'object' &&
      // @ts-ignore Deno types
      typeof Deno.version.deno === 'string',
  ],
];

function resolveRuntime(config: ResolvedCommandKitConfig): CommandKitJsRuntime {
  const maybeRuntime = config?.experimental?.devServerRuntime;

  // TODO: once stable enough, we should try 'auto' option here
  if (!maybeRuntime) return 'node';

  if (maybeRuntime === 'auto') {
    for (const [runtime, check] of RuntimeLookup) {
      if (check()) {
        return runtime as CommandKitJsRuntime;
      }
    }

    return 'node';
  }

  return maybeRuntime;
}

/**
 * @private
 * @internal
 */
export function createAppProcess(
  fileName: string,
  cwd: string,
  isDev: boolean,
  config: ResolvedCommandKitConfig,
) {
  if (!existsSync(join(cwd, fileName))) {
    panic(`Could not locate the entrypoint file: ${fileName}`);
  }

  const stdio = getStdio(isDev) as IOType[];
  const targetRuntime = resolveRuntime(config);

  const baseArgs =
    targetRuntime === 'node'
      ? [
          `--title="CommandKit ${isDev ? 'Development' : 'Production'}"`,
          '--enable-source-maps',
        ]
      : [];

  const nodeOptions = process.env.CK_NODE_OPTIONS || process.env.NODE_OPTIONS;
  let nodeArgs = [...baseArgs];

  if (nodeOptions) {
    const options = nodeOptions.trim().split(/\s+/);

    for (const option of options) {
      const optionName = option.split('=')[0];
      const existingIndex = nodeArgs.findIndex((arg) =>
        arg.startsWith(optionName),
      );

      if (existingIndex !== -1) {
        nodeArgs[existingIndex] = option;
      } else {
        nodeArgs.push(option);
      }
    }
  }

  nodeArgs.push(fileName);

  const ps = spawn(targetRuntime, nodeArgs, {
    cwd,
    windowsHide: true,
    env: isDev ? DevEnv() : ProdEnv(),
    stdio,
  });

  ps.stdout?.pipe(process.stdout);
  ps.stderr?.pipe(process.stderr);

  return ps;
}
