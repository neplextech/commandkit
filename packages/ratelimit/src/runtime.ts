/**
 * Runtime globals for rate limiting.
 *
 * Stores the active storage and plugin context for directives and helpers.
 */

import type { RateLimitRuntimeContext, RateLimitStorage } from './types';

let defaultStorage: RateLimitStorage | null = null;
let activeRuntime: RateLimitRuntimeContext | null = null;

/**
 * Set the default rate limit storage instance for the process.
 *
 * @param storage - Storage driver to use for rate-limit state.
 * @returns Nothing; updates the process-wide default storage.
 */
export function setRateLimitStorage(storage: RateLimitStorage): void {
  defaultStorage = storage;
}

/**
 * Get the default rate limit storage instance for the process.
 *
 * @returns Default storage instance or null if unset.
 */
export function getRateLimitStorage(): RateLimitStorage | null {
  return defaultStorage;
}

/**
 * Alias for setRateLimitStorage to match other packages (tasks/queue).
 *
 * @param storage - Storage driver to use for rate-limit state.
 * @returns Nothing; updates the process-wide default storage.
 */
export function setDriver(storage: RateLimitStorage): void {
  setRateLimitStorage(storage);
}

/**
 * Alias for getRateLimitStorage to match other packages (tasks/queue).
 *
 * @returns Default storage instance or null if unset.
 */
export function getDriver(): RateLimitStorage | null {
  return getRateLimitStorage();
}

/**
 * Set the active runtime context used by directives and APIs.
 *
 * @param runtime - Active runtime context or null to clear.
 * @returns Nothing; updates the active runtime context.
 */
export function setRateLimitRuntime(
  runtime: RateLimitRuntimeContext | null,
): void {
  activeRuntime = runtime;
}

/**
 * Get the active runtime context for directives and APIs.
 *
 * @returns Active runtime context or null if not initialized.
 */
export function getRateLimitRuntime(): RateLimitRuntimeContext | null {
  return activeRuntime;
}
