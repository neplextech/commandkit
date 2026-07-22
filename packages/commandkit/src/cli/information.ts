import os from 'node:os';
import { execSync } from 'node:child_process';
import { version as commandkitVersion } from '../version';
import fs from 'node:fs';
import path from 'node:path';
import { COMMANDKIT_CWD } from '../utils/constants';

/**
 * @private
 * @internal
 */
function $getKnownPlugins() {
  'use macro';

  // remove name from the list when that plugin is stable
  const BLACKLISTED = new Set([
    'commandkit', // core package itself, not a plugin
    'create-commandkit', // generator, not a plugin
    'tsconfig', // repo config related, not a plugin
    // the plugins below are TBD
    'tasks',
  ]);

  const { readdirSync, readFileSync } =
    require('node:fs') as typeof import('node:fs');
  const { join } = require('node:path') as typeof path;

  const pluginsPath = join(__dirname, '..', '..', '..');

  const entries = readdirSync(pluginsPath, { withFileTypes: true }).filter(
    (e) => !BLACKLISTED.has(e.name),
  );

  const packages = entries.map((p) =>
    join(p.parentPath, p.name, 'package.json'),
  );

  const knownPlugins: string[] = [];

  for (const pkg of packages) {
    try {
      const { name } = JSON.parse(readFileSync(pkg, 'utf8'));
      if (name && !BLACKLISTED.has(name.replace('@commandkit/', ''))) {
        knownPlugins.push(name);
      }
    } catch {
      // Ignore errors
    }
  }

  return knownPlugins;
}

const knownPlugins: string[] = $getKnownPlugins();

/**
 * @private
 * @internal
 */
function findPackageVersion(packageName: string) {
  try {
    const packageJsonPath = require.resolve(`${packageName}/package.json`);
    const packageJson = require(packageJsonPath);
    return packageJson.version;
  } catch (e) {
    try {
      const basePaths = [
        path.join(COMMANDKIT_CWD, 'node_modules', packageName),
        path.join(COMMANDKIT_CWD, '..', '..', 'node_modules', packageName),
        path.join(COMMANDKIT_CWD, '..', '..', '.pnpm', packageName),
        path.join(
          COMMANDKIT_CWD,
          '..',
          '..',
          'node_modules',
          '.pnpm',
          packageName,
        ),
      ];

      for (const basePath of basePaths) {
        const packageJsonPath = path.join(basePath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, 'utf8'),
          );
          return packageJson.version;
        }
      }

      const nodeModulesPath = path.join(
        COMMANDKIT_CWD,
        '..',
        '..',
        'node_modules',
        '.pnpm',
      );
      if (fs.existsSync(nodeModulesPath)) {
        const folders = fs.readdirSync(nodeModulesPath);
        const packageFolder = folders.find((folder) =>
          folder.startsWith(`${packageName.replace('/', '+')}@`),
        );

        if (packageFolder) {
          const packageJsonPath = path.join(
            nodeModulesPath,
            packageFolder,
            'node_modules',
            packageName,
            'package.json',
          );
          if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(
              fs.readFileSync(packageJsonPath, 'utf8'),
            );
            return packageJson.version;
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }
}

/**
 * @private
 * @internal
 */
function getBinaryVersion(binary: string) {
  try {
    const version = execSync(`${binary} --version`).toString().trim();
    return version;
  } catch {
    return null;
  }
}

/**
 * @private
 * @internal
 */
export async function showInformation() {
  const runtimeName: string = (() => {
    // @ts-ignore
    if ('Deno' in globalThis && typeof Deno !== 'undefined') return 'Deno';
    // @ts-ignore
    if ('Bun' in globalThis && typeof Bun !== 'undefined') return 'Bun';

    return 'Node.js';
  })();

  const info = {
    'Operating System': {
      Platform: process.platform,
      Arch: process.arch,
      Version: os.version(),
      'Available Memory (MB)': Math.round(os.totalmem() / 1024 / 1024),
      'Available CPU cores': os.cpus().length,
    },
    Runtime: runtimeName,
    Binaries: {
      Node: process.version,
      npm: getBinaryVersion('npm') || 'N/A',
      Yarn: getBinaryVersion('yarn') || 'N/A',
      pnpm: getBinaryVersion('pnpm') || 'N/A',
      Bun: getBinaryVersion('bun') || 'N/A',
      Deno: (getBinaryVersion('deno') || 'N/A').replace(/\n|\r/g, ' '),
    },
    'Relevant Packages': {
      commandkit: commandkitVersion,
      'discord.js': findPackageVersion('discord.js') || 'N/A',
      typescript: findPackageVersion('typescript') || 'N/A',
      rolldown: findPackageVersion('rolldown') || 'N/A',
      tsdown: findPackageVersion('tsdown') || 'N/A',
    },
    'CommandKit Plugins': knownPlugins.reduce(
      (acc, plugin) => {
        acc[plugin] = findPackageVersion(plugin) || 'N/A';
        return acc;
      },
      {} as Record<string, string>,
    ),
  };

  let output = '';

  for (const [section, data] of Object.entries(info)) {
    output += `${section}:\n`;

    if (typeof data === 'string') {
      output += `  ${data}\n\n`;
      continue;
    }

    for (const [key, value] of Object.entries(data)) {
      output += `  ${key}: ${value}\n`;
    }
    output += '\n';
  }

  console.log(output.trim());
}
