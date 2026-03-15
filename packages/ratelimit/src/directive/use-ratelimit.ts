/**
 * Runtime wrapper for the "use ratelimit" directive.
 *
 * Uses the runtime default limiter for arbitrary async functions.
 * Throws RateLimitError when the call is limited.
 */

import { randomUUID } from 'node:crypto';
import type { AsyncFunction, GenericFunction } from 'commandkit';
import { RateLimitEngine } from '../engine/RateLimitEngine';
import { RateLimitError } from '../errors';
import type {
  RateLimitLimiterConfig,
  RateLimitResult,
  RateLimitStorage,
  RateLimitStoreValue,
} from '../types';
import {
  DEFAULT_LIMITER,
  mergeLimiterConfigs,
  resolveLimiterConfigs,
} from '../utils/config';
import { getRateLimitRuntime } from '../runtime';
import { DEFAULT_KEY_PREFIX } from '../constants';

const RATELIMIT_FN_SYMBOL = Symbol('commandkit.ratelimit.directive');

let cachedEngine: RateLimitEngine | null = null;
let cachedStorage: RateLimitStorage | null = null;

/**
 * Resolve the cached engine instance for a storage backend.
 *
 * @param storage - Storage backend to associate with the engine.
 * @returns Cached engine instance for the storage.
 */
function getEngine(storage: RateLimitStorage): RateLimitEngine {
  /**
   * Cache per storage instance so violation tracking stays consistent.
   */
  if (!cachedEngine || cachedStorage !== storage) {
    cachedEngine = new RateLimitEngine(storage);
    cachedStorage = storage;
  }
  return cachedEngine;
}

/**
 * Apply an optional prefix to a storage key.
 *
 * @param prefix - Optional prefix to prepend.
 * @param key - Base key to prefix.
 * @returns Prefixed key.
 */
function withPrefix(prefix: string | undefined, key: string): string {
  if (!prefix) return key;
  return `${prefix}${key}`;
}

/**
 * Append a window suffix to a key when a window id is present.
 *
 * @param key - Base storage key.
 * @param windowId - Optional window identifier.
 * @returns Key with window suffix when provided.
 */
function withWindowSuffix(key: string, windowId?: string): string {
  if (!windowId) return key;
  return `${key}:w:${windowId}`;
}

/**
 * Merge a runtime default limiter with an override when provided.
 *
 * @param runtimeDefault - Runtime default limiter configuration.
 * @param limiter - Optional override limiter.
 * @returns Resolved limiter configuration.
 */
function resolveLimiter(
  runtimeDefault: RateLimitLimiterConfig,
  limiter?: RateLimitLimiterConfig,
): RateLimitLimiterConfig {
  if (!limiter) return runtimeDefault;
  return mergeLimiterConfigs(runtimeDefault, limiter);
}

/**
 * Wrap an async function with the runtime default limiter.
 *
 * Throws RateLimitError when the call exceeds limits.
 *
 * @template R - Argument tuple type for the wrapped async function.
 * @template F - Async function type being wrapped.
 * @param fn - Async function to wrap with rate limiting.
 * @returns Wrapped async function that enforces the default limiter.
 * @throws RateLimitError when the call exceeds limits.
 */
function useRateLimit<R extends any[], F extends AsyncFunction<R>>(fn: F): F {
  if (Object.prototype.hasOwnProperty.call(fn, RATELIMIT_FN_SYMBOL)) {
    return fn;
  }

  const fnId = randomUUID();

  const wrapped = (async (...args: R) => {
    const runtime = getRateLimitRuntime();
    if (!runtime) {
      throw new Error(
        'RateLimit runtime is not initialized. Register the RateLimitPlugin first.',
      );
    }

    const limiterConfig = resolveLimiter(
      mergeLimiterConfigs(DEFAULT_LIMITER, runtime.defaultLimiter),
    );

    const key = `${DEFAULT_KEY_PREFIX}fn:${fnId}`;
    const finalKey = withPrefix(runtime.keyPrefix, key);

    const engine = getEngine(runtime.storage);
    const resolvedConfigs = resolveLimiterConfigs(limiterConfig, 'custom');
    const results: RateLimitResult[] = [];
    for (const resolved of resolvedConfigs) {
      const resolvedKey = withWindowSuffix(finalKey, resolved.windowId);
      const { result } = await engine.consume(resolvedKey, resolved);
      results.push(result);
    }

    const aggregate = aggregateResults(results);
    if (aggregate.limited) {
      throw new RateLimitError(aggregate);
    }

    return fn(...args);
  }) as F;

  Object.defineProperty(wrapped, RATELIMIT_FN_SYMBOL, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  return wrapped;
}

/**
 * Aggregate multiple rate-limit results into a single summary object.
 *
 * @param results - Individual limiter/window results.
 * @returns Aggregated rate-limit store value.
 */
function aggregateResults(results: RateLimitResult[]): RateLimitStoreValue {
  if (!results.length) {
    return {
      limited: false,
      remaining: 0,
      resetAt: 0,
      retryAfter: 0,
      results: [],
    };
  }

  const limitedResults = results.filter((r) => r.limited);
  const limited = limitedResults.length > 0;
  const remaining = Math.min(...results.map((r) => r.remaining));
  const resetAt = Math.max(...results.map((r) => r.resetAt));
  const retryAfter = limited
    ? Math.max(...limitedResults.map((r) => r.retryAfter))
    : 0;

  return {
    limited,
    remaining,
    resetAt,
    retryAfter,
    results,
  };
}

/**
 * Wrapper symbol injected by the compiler plugin.
 *
 * @param fn - Generic function to wrap with runtime rate limiting.
 * @returns Wrapped function that enforces the runtime default limiter.
 */
export const $ckitirl: GenericFunction = (fn: GenericFunction) => {
  return useRateLimit(fn as AsyncFunction<any>);
};

if (!('$ckitirl' in globalThis)) {
  /**
   * Expose the wrapper globally so directive transforms can call it.
   */
  Object.defineProperty(globalThis, '$ckitirl', {
    value: $ckitirl,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}
