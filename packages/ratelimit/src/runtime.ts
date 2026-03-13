// Runtime globals for rate limiting.
//
// Stores the active storage and plugin context for directives and helpers.

import type { RateLimitRuntimeContext, RateLimitStorage } from './types';

let defaultStorage: RateLimitStorage | null = null;
let activeRuntime: RateLimitRuntimeContext | null = null;

/**
 * Set the default rate limit storage instance for the process.
 */
export function setRateLimitStorage(storage: RateLimitStorage): void {
  defaultStorage = storage;
}

/**
 * Get the default rate limit storage instance for the process.
 */
export function getRateLimitStorage(): RateLimitStorage | null {
  return defaultStorage;
}

/**
 * Alias for setRateLimitStorage to match other packages (tasks/queue).
 */
export function setDriver(storage: RateLimitStorage): void {
  setRateLimitStorage(storage);
}

/**
 * Alias for getRateLimitStorage to match other packages (tasks/queue).
 */
export function getDriver(): RateLimitStorage | null {
  return getRateLimitStorage();
}

/**
 * Set the active runtime context used by directives and APIs.
 */
export function setRateLimitRuntime(
  runtime: RateLimitRuntimeContext | null,
): void {
  activeRuntime = runtime;
}

/**
 * Get the active runtime context for directives and APIs.
 */
export function getRateLimitRuntime(): RateLimitRuntimeContext | null {
  return activeRuntime;
}
