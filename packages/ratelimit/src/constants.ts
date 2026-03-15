/**
 * Rate limit constants shared across runtime and tests.
 *
 * Keeps key names consistent across storage, runtime, and docs.
 */

/**
 * Store key used to stash aggregated results in CommandKit envs.
 *
 * @default 'ratelimit'
 */
export const RATELIMIT_STORE_KEY = 'ratelimit';

/**
 * Default prefix for storage keys; can be overridden per config.
 *
 * @default 'rl:'
 */
export const DEFAULT_KEY_PREFIX = 'rl:';
