/**
 * Rate limit error type.
 *
 * Lets callers distinguish rate-limit failures from other errors.
 */

import type { RateLimitStoreValue } from './types';

/**
 * Error thrown by the directive wrapper when a function is rate-limited.
 *
 * @extends Error
 */
export class RateLimitError extends Error {
  public readonly result: RateLimitStoreValue;

  /**
   * Create a rate-limit error with the stored result payload.
   *
   * @param result - Aggregated rate-limit result.
   * @param message - Optional error message override.
   */
  public constructor(result: RateLimitStoreValue, message?: string) {
    super(message ?? 'Rate limit exceeded');
    this.name = 'RateLimitError';
    this.result = result;
  }
}
