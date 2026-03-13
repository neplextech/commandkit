// Runtime configuration for the rate limit plugin.
//
// Mirrors configureAI so runtime options can be set outside commandkit.config
// before the plugin evaluates commands.

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

function resolveStorage(
  config: RateLimitStorageConfig,
): RateLimitStorage | null {
  if (!config) return null;
  if (typeof config === 'object' && 'driver' in config) {
    return config.driver;
  }
  return config;
}

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
 */
export function isRateLimitConfigured(): boolean {
  return configured;
}

/**
 * Retrieves the current rate limit configuration.
 */
export function getRateLimitConfig(): RateLimitPluginOptions {
  return rateLimitConfig;
}

/**
 * Configures the rate limit plugin runtime options.
 * Call this once during startup (for example in src/ratelimit.ts).
 */
export function configureRatelimit(
  config: RateLimitPluginOptions = {},
): void {
  configured = true;
  Object.assign(rateLimitConfig, config);
  updateRuntime(config);
}
