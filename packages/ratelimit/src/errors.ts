// Rate limit error type.
//
// Lets callers distinguish rate-limit failures from other errors.

import type { RateLimitStoreValue } from './types';

/**
 * Error thrown by the directive wrapper when a function is rate-limited.
 */
export class RateLimitError extends Error {
  public readonly result: RateLimitStoreValue;

  public constructor(result: RateLimitStoreValue, message?: string) {
    super(message ?? 'Rate limit exceeded');
    this.name = 'RateLimitError';
    this.result = result;
  }
}
