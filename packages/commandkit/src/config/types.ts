import { MaybeArray } from '../components';
import { CommandKitPlugin } from '../plugins';
import type { InlineConfig as TsDownOptions } from 'tsdown';

export interface CommandKitCompilerOptions {
  /**
   * The macro compiler options to use with CommandKit.
   */
  macro?: {
    /**
     * Whether to enable macro function compilation in development mode.
     * @default false
     */
    development?: boolean;
  };
  /**
   * The tsdown compiler options to use with CommandKit.
   * **DO NOT USE THIS UNLESS YOU KNOW WHAT YOU ARE DOING** as it alters the behavior of the build process.
   */
  tsdown?: Partial<TsDownOptions>;
  /**
   * Disables chunking of the output (production only, development never chunks).
   * @default false
   */
  disableChunking?: boolean;
}

export interface CommandKitConfig {
  /**
   * The plugins to use with CommandKit.
   * Can be a single plugin, an array of plugins, or a nested array of plugins.
   */
  plugins?: MaybeArray<CommandKitPlugin>[] | Array<CommandKitPlugin>;
  /**
   * The rolldown plugins to use with CommandKit.
   */
  rolldownPlugins?: any[];
  /**
   * The list of additional entrypoints to compile. Eg, `dir` or `dir/index.ts` or `dir/*.ts`, etc.
   * Similarly, negative patterns can be used to exclude files. Eg, `!dir/index.ts` or `!dir/*.ts`, etc.
   */
  entrypoints?: string[];
  /**
   * The compiler options to use with CommandKit.
   */
  compilerOptions?: CommandKitCompilerOptions;
  /**
   * The typescript configuration to use with CommandKit.
   */
  typescript?: {
    /**
     * Whether to ignore type checking during builds.
     */
    ignoreBuildErrors?: boolean;
  };
  /**
   * Whether to generate static command handler data in production builds.
   */
  static?: boolean;
  /**
   * Statically define the environment variables to use.
   */
  env?: Record<string, string>;
  /**
   * The custom build directory name to use.
   * @default `dist`
   */
  distDir?: string;
  /**
   * The anti-crash script configuration.
   */
  antiCrashScript?: {
    /**
     * Whether to enable the anti-crash script in development mode.
     * @default true
     */
    development?: boolean;
    /**
     * Whether to enable the anti-crash script in production mode. Usually, you should use other means to handle errors.
     * @default false
     */
    production?: boolean;
  };
  /**
   * Whether or not to enable the source map generation.
   */
  sourceMap?: {
    /**
     * Whether to enable source map generation in development mode.
     */
    development?: boolean;
    /**
     * Whether to enable source map generation in production mode.
     */
    production?: boolean;
  };
  /**
   * Whether or not to enable the typed commands.
   * @default true
   */
  typedCommands?: boolean;
  /**
   * Whether or not to disable the prefix commands.
   * @default false
   */
  disablePrefixCommands?: boolean;
  /**
   * Whether or not to disable the built-in permissions middleware. This only affects `botPermissions` and `userPermissions` in the command metadata.
   * @default false
   */
  disablePermissionsMiddleware?: boolean;
  /**
   * Whether or not to show a warning when a prefix command is not found. This only affects development mode.
   * @default true
   */
  showUnknownPrefixCommandsWarning?: boolean;
  /**
   * Whether to make interaction components optional by default when using JSX (opposite of Discord's default behavior).
   * @default true
   */
  jsxDefaultOptionalComponents?: boolean;
    /**
   * The source folder that commandkit is in
   */
  srcFolder?: string;
}
