/**
 * Runtime configuration for the rate limit plugin.
 *
 * Mirrors configureAI so runtime options can be set outside commandkit.config
 * before the plugin evaluates commands.
 */

import { DEFAULT_LIMITER } from './utils/config';
import {
  getRateLimitRuntime,
  setRateLimitRuntime,
  setRateLimitStorage,
} from './runtime';
import type {
  RateLimitPluginOptions,
  RateLimitRuntimeContext,
  RateLimitStorage,
  RateLimitStorageConfig,
} from './types';

const rateLimitConfig: RateLimitPluginOptions = {};
let configured = false;

/**
 * Normalize a storage config into a storage driver instance.
 *
 * @param config - Storage config or driver.
 * @returns Storage driver instance or null when not configured.
 */
function resolveStorage(
  config: RateLimitStorageConfig,
): RateLimitStorage | null {
  if (!config) return null;
  if (typeof config === 'object' && 'driver' in config) {
    return config.driver;
  }
  return config;
}

/**
 * Apply updated config to the active runtime context.
 *
 * @param config - Runtime configuration updates.
 * @returns Nothing; mutates the active runtime context when present.
 */
function updateRuntime(config: RateLimitPluginOptions): void {
  const runtime = getRateLimitRuntime();
  const storageOverride = config.storage
    ? resolveStorage(config.storage)
    : null;

  if (storageOverride) {
    setRateLimitStorage(storageOverride);
  }

  if (!runtime) {
    return;
  }

  const nextRuntime: RateLimitRuntimeContext = {
    storage: storageOverride ?? runtime.storage,
    keyPrefix: config.keyPrefix ?? runtime.keyPrefix,
    defaultLimiter:
      config.defaultLimiter ?? runtime.defaultLimiter ?? DEFAULT_LIMITER,
    limiters: config.limiters ?? runtime.limiters,
    hooks: config.hooks ?? runtime.hooks,
  };

  setRateLimitRuntime(nextRuntime);
}

/**
 * Returns true once configureRatelimit has been called.
 *
 * @returns True when runtime configuration has been initialized.
 */
export function isRateLimitConfigured(): boolean {
  return configured;
}

/**
 * Retrieves the current rate limit configuration.
 *
 * @returns The current in-memory rate limit config object.
 */
export function getRateLimitConfig(): RateLimitPluginOptions {
  return rateLimitConfig;
}

/**
 * Configures the rate limit plugin runtime options.
 *
 * Call this once during startup (for example in src/ratelimit.ts).
 *
 * @param config - Runtime options to merge into the active configuration.
 * @returns Nothing; updates runtime state in place.
 */
export function configureRatelimit(
  config: RateLimitPluginOptions = {},
): void {
  configured = true;
  Object.assign(rateLimitConfig, config);
  updateRuntime(config);
}
