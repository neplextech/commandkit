/**
 * Limiter config resolution.
 *
 * Applies defaults and merges overrides into concrete limiter settings
 * used by the engine and plugin.
 */

import type {
  RateLimitAlgorithmType,
  RateLimitLimiterConfig,
  RateLimitScope,
  RateLimitWindowConfig,
  ResolvedLimiterConfig,
} from '../types';
import { clampAtLeast, resolveDuration } from './time';

const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_ALGORITHM: RateLimitAlgorithmType = 'fixed-window';
const DEFAULT_SCOPE: RateLimitScope = 'user';

/**
 * Default limiter used when no explicit configuration is provided.
 */
export const DEFAULT_LIMITER: RateLimitLimiterConfig = {
  maxRequests: DEFAULT_MAX_REQUESTS,
  interval: DEFAULT_INTERVAL_MS,
  algorithm: DEFAULT_ALGORITHM,
  scope: DEFAULT_SCOPE,
};

/**
 * Merge limiter configs; later values override earlier ones for layering.
 *
 * @param configs - Limiter configs ordered from lowest to highest priority.
 * @returns Merged limiter config with later overrides applied.
 */
export function mergeLimiterConfigs(
  ...configs: Array<RateLimitLimiterConfig | undefined>
): RateLimitLimiterConfig {
  return configs.reduce<RateLimitLimiterConfig>(
    (acc, cfg) => ({ ...acc, ...(cfg ?? {}) }),
    {},
  );
}

/**
 * Resolve a limiter config for a single scope with defaults applied.
 *
 * @param config - Base limiter configuration.
 * @param scope - Scope to resolve for the limiter.
 * @returns Resolved limiter config with defaults and derived values.
 */
export function resolveLimiterConfig(
  config: RateLimitLimiterConfig,
  scope: RateLimitScope,
): ResolvedLimiterConfig {
  const maxRequests =
    typeof config.maxRequests === 'number' && config.maxRequests > 0
      ? config.maxRequests
      : DEFAULT_MAX_REQUESTS;

  const intervalMs = clampAtLeast(
    resolveDuration(config.interval, DEFAULT_INTERVAL_MS),
    1,
  );

  const algorithm = config.algorithm ?? DEFAULT_ALGORITHM;
  const intervalSeconds = intervalMs / 1000;
  const burst =
    typeof config.burst === 'number' && config.burst > 0
      ? config.burst
      : maxRequests;

  const refillRate =
    typeof config.refillRate === 'number' && config.refillRate > 0
      ? config.refillRate
      : maxRequests / intervalSeconds;

  const leakRate =
    typeof config.leakRate === 'number' && config.leakRate > 0
      ? config.leakRate
      : maxRequests / intervalSeconds;

  return {
    maxRequests,
    intervalMs,
    algorithm,
    scope,
    burst,
    refillRate,
    leakRate,
    violations: config.violations,
  };
}

/**
 * Resolve a stable window id when one is missing.
 *
 * @param window - Window config entry.
 * @param index - Index of the window in the config list.
 * @returns Window id string.
 */
function resolveWindowId(window: RateLimitWindowConfig, index: number): string {
  if (window.id && window.id.trim()) return window.id;
  /**
   * Stable fallback IDs keep window identity deterministic for resets.
   */
  return `w${index + 1}`;
}

/**
 * Resolve limiter configs for a scope across all configured windows.
 *
 * @param config - Base limiter configuration that may include windows.
 * @param scope - Scope to resolve for the limiter.
 * @returns Resolved limiter configs for each window (or a single config).
 */
export function resolveLimiterConfigs(
  config: RateLimitLimiterConfig,
  scope: RateLimitScope,
): ResolvedLimiterConfig[] {
  const windows = config.windows;
  if (!windows || windows.length === 0) {
    return [resolveLimiterConfig(config, scope)];
  }

  const { windows: _windows, ...base } = config;

  return windows.map((window, index) => {
    const windowId = resolveWindowId(window, index);
    const merged: RateLimitLimiterConfig = { ...base, ...window };
    const resolved = resolveLimiterConfig(merged, scope);
    return windowId ? { ...resolved, windowId } : resolved;
  });
}
