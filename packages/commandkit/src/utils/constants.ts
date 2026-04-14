/**
 * The current working directory of the CommandKit instance.
 */
export const COMMANDKIT_CWD = process.env.COMMANDKIT_CWD || process.cwd();

/**
 * Indicates whether CommandKit is running in development mode.
 */
export const COMMANDKIT_IS_DEV = process.env.COMMANDKIT_IS_DEV === 'true';

/**
 * Indicates whether CommandKit is running in CLI thread.
 */
export const COMMANDKIT_IS_CLI = process.env.COMMANDKIT_IS_CLI === 'true';

/**
 * Indicates whether CommandKit is running in test mode.
 */
export const COMMANDKIT_IS_TEST = process.env.COMMANDKIT_IS_TEST === 'true';

/**
 * Indicates that CommandKit is running in a build-like environment.
 * @private
 * @internal
 */
export function isBuildLikeEnvironment() {
  const isCLI = process.env.COMMANDKIT_INTERNAL_IS_CLI_PROCESS === 'true';
  if (isCLI) return true;

  return process.env.COMMANDKIT_IS_BUILD === 'true';
}

/**
 * The current bootstrap mode of CommandKit.
 * This can be 'development' or 'production'.
 */
export const COMMANDKIT_BOOTSTRAP_MODE = (process.env
  .COMMANDKIT_BOOTSTRAP_MODE || 'development') as 'development' | 'production';

/**
 * Types of Hot Module Replacement events
 */
export const HMREventType = {
  /**
   * HMR event for reloading commands.
   */
  ReloadCommands: 'reload-commands',
  /**
   * HMR event for reloading events.
   */
  ReloadEvents: 'reload-events',
  /**
   * HMR event for reloading unknown path, typically used by the plugins.
   */
  Unknown: 'unknown',
} as const;

/**
 * File system change types delivered through HMR messages.
 */
export const HMREventChangeType = {
  Add: 'add',
  Change: 'change',
  Unlink: 'unlink',
  UnlinkDir: 'unlinkDir',
} as const;

/**
 * The type for HMR events.
 */
export type HMREventType = (typeof HMREventType)[keyof typeof HMREventType];

/**
 * The type for file change events in HMR payloads.
 */
export type HMREventChangeType =
  (typeof HMREventChangeType)[keyof typeof HMREventChangeType];
