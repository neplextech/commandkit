import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { rimraf } from 'rimraf';
import type { InlineConfig } from 'tsdown';

import { MaybeArray } from '../components';
import { loadConfigFile } from '../config/loader';
import { mergeDeep } from '../config/utils';
import { CompilerPlugin, CompilerPluginRuntime } from '../plugins';
import { COMMANDKIT_CWD } from '../utils/constants';
import { copyLocaleFiles, loadTsdown } from './common';
import { devEnvFileArgs, prodEnvFileArgs } from './env';
import { performTypeCheck } from './type-checker';

/**
 * @private
 * @internal
 */
export interface ApplicationBuildOptions {
  plugins?: MaybeArray<CompilerPlugin>[] | Array<CompilerPlugin>;
  rolldownPlugins?: any[];
  isDev?: boolean;
  configPath?: string;
}

// emit public env variables and given env variables
/**
 * @private
 * @internal
 */
function mergeDefinitionsIfNeeded(env: Record<string, string>, isDev: boolean) {
  const values = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !(k in env) && k.startsWith('COMMANDKIT_PUBLIC_'),
    ),
  );

  return {
    ...env,
    ...values,
    ...(isDev
      ? {
          NODE_ENV: 'development',
          COMMANDKIT_BOOTSTRAP_MODE: 'development',
          COMMANDKIT_IS_DEV: 'true',
          COMMANDKIT_IS_TEST: 'false',
        }
      : {
          NODE_ENV: 'production',
          COMMANDKIT_BOOTSTRAP_MODE: 'production',
          COMMANDKIT_IS_DEV: 'false',
          COMMANDKIT_IS_TEST: 'false',
        }),
  };
}

/**
 * @private
 * @internal
 */
export async function buildApplication({
  plugins,
  rolldownPlugins,
  isDev,
  configPath,
}: ApplicationBuildOptions) {
  const { build } = await loadTsdown();
  const config = await loadConfigFile(configPath);

  if (!isDev && !config?.typescript?.ignoreBuildErrors) {
    await performTypeCheck(configPath || COMMANDKIT_CWD);
  }

  const pluginRuntime = new CompilerPluginRuntime(
    (plugins || []) as CompilerPlugin[],
    !!isDev,
  );

  rolldownPlugins ??= [];

  rolldownPlugins.push(pluginRuntime.toJSON());

  try {
    const dest = isDev ? '.commandkit' : config.distDir;

    // Clean the destination directory
    await rimraf(dest);

    await pluginRuntime.init();

    await build(
      mergeDeep(
        {
          watch: false,
          dts: false,
          clean: true,
          format: ['esm'],
          shims: true,
          minify: false,
          logLevel: !!isDev ? 'silent' : 'info',
          inputOptions: {
            transform: {
              jsx: {
                runtime: 'automatic',
                importSource: 'commandkit',
              },
            },
            checks: {
              circularDependency: true,
            },
            onwarn: (warning, defaultWarn) => {
              if (warning?.message?.includes('compilerOptions.jsx')) return;

              return defaultWarn(warning);
            },
            onLog: (level, log, defaultLog) => {
              if (isDev) return;

              return defaultLog(level, log);
            },
            moduleTypes: {
              '.json': 'json',
              '.node': 'binary',
            },
          },
          outExtensions: (context) => {
            return {
              dts: '.d.ts',
              js: context.format === 'cjs' ? '.cjs' : '.js',
            };
          },
          plugins: rolldownPlugins,
          platform: 'node',
          skipNodeModulesBundle: true,
          sourcemap:
            config.sourceMap?.[isDev ? 'development' : 'production'] ?? true,
          target: 'node16',
          outDir: dest,
          env: mergeDefinitionsIfNeeded(config.env || {}, !!isDev),
          entry: Array.from(
            new Set([
              'src/**/*.{js,cjs,mjs,ts,cts,mts,jsx,tsx}',
              `!${config.distDir}`,
              '!.commandkit',
              '!**/*.test.*',
              '!**/*.spec.*',
              ...(config.entrypoints ?? []),
            ]),
          ),
          outputOptions: {
            sanitizeFileName: (name) => name,
          },
          unbundle: isDev
            ? true
            : (config.compilerOptions?.disableChunking ?? false),
        } satisfies InlineConfig,
        config.compilerOptions?.tsdown,
      ),
    );

    await copyLocaleFiles('src', dest);
    await injectEntryFile(
      configPath || COMMANDKIT_CWD,
      !!isDev,
      !!(
        config.antiCrashScript?.[isDev ? 'development' : 'production'] ??
        (isDev ? true : false)
      ),
      config.distDir,
    );
  } catch (error) {
    console.error('Build failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.stack);
    }
    process.exit(1); // Force exit on error
  } finally {
    // Ensure plugins are cleaned up
    await pluginRuntime.destroy();
  }
}

const envScript = (dev: boolean) => `// --- Environment Variables Loader ---
const $env = [${(dev ? devEnvFileArgs : prodEnvFileArgs).map((p) => `"${p}"`).join(', ')}];
for (const file of $env) {
  try {
    process.loadEnvFile(file);
    console.log('\\x1b[36m✔ Loaded \\x1b[0m\\x1b[33m%s\\x1b[0m', file);
  } catch {}
}
`;

const antiCrashScript = [
  '// --- CommandKit Anti-Crash Monitor ---',
  "  // 'uncaughtException' event is supposed to be used to perform synchronous cleanup before shutting down the process",
  '  // instead of using it as a means to resume operation.',
  '  // But it exists here due to compatibility reasons with discord bot ecosystem.',
  "  const p = (t) => `\\x1b[31m${t}\\x1b[0m`, b = '[CommandKit Anti-Crash Monitor]', l = console.log, e1 = 'uncaughtException', e2 = 'unhandledRejection';",
  '  if (!process.eventNames().includes(e1)) // skip if it is already handled',
  '    process.on(e1, (e) => {',
  '      l(p(`${b} Uncaught Exception`)); l(p(b), p(e.stack || e));',
  '    })',
  '  if (!process.eventNames().includes(e2)) // skip if it is already handled',
  '    process.on(e2, (r) => {',
  '      l(p(`${b} Unhandled promise rejection`)); l(p(`${b} ${r.stack || r}`));',
  '    });',
  '// --- CommandKit Anti-Crash Monitor ---',
].join('\n');

const wrapInAsyncIIFE = (code: string[]) =>
  `;await (async () => {\n${code.join('\n\n')}\n})();`;

async function injectEntryFile(
  configPath: string,
  isDev: boolean,
  emitAntiCrashScript: boolean,
  distDir?: string,
) {
  const dist = isDev ? '.commandkit' : distDir || 'dist';
  const entryFilePath = join(configPath, dist, 'index.js');

  // skip if the entry file already exists
  if (existsSync(entryFilePath)) return;

  const code = `/* Entrypoint File Generated By CommandKit */
${isDev ? `\n\n// Injected for development\n${wrapInAsyncIIFE([envScript(isDev), emitAntiCrashScript ? antiCrashScript : ''])}\n\n` : wrapInAsyncIIFE([envScript(isDev)])}


async function bootstrap() {
  const { Client } = await import('discord.js');
  const { commandkit } = await import('commandkit');
  const app = await import('./app.js').then((m) => m.default ?? m);

  if (!app || !(app instanceof Client)) {
    throw new Error('The app file must default export the discord.js client instance');
  }

  commandkit.setClient(app);

  await commandkit.start();
}

await bootstrap().catch((e) => {
  console.error('Failed to bootstrap CommandKit application:\\n', e.stack);
})
`;

  await writeFile(entryFilePath, code);
}
