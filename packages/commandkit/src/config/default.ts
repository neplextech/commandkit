import { MacroPlugin } from '../plugins/plugin-runtime/builtin/MacroPlugin';
import { ResolvedCommandKitConfig } from './utils';
// import json from '@rollup/plugin-json';

/**
 * Default configuration for CommandKit.
 */
export const defaultConfig: ResolvedCommandKitConfig = {
  plugins: [new MacroPlugin({ enabled: true })],
  rolldownPlugins: [],
  compilerOptions: {
    macro: {
      development: false,
    },
    tsdown: {},
    disableChunking: false,
  },
  entrypoints: [],
  static: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  distDir: 'dist',
  env: {},
  sourceMap: {
    development: true,
    production: true,
  },
  typedCommands: true,
  disablePrefixCommands: false,
  disablePermissionsMiddleware: false,
  showUnknownPrefixCommandsWarning: true,
  antiCrashScript: {
    development: true,
    production: false,
  },
  jsxDefaultOptionalComponents: true,
};
