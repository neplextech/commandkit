// Demo ratelimit configuration for the test bot.
//
// Exercises defaults, a strict limiter, and queued retries with hooks logging.

import { configureRatelimit } from '@commandkit/ratelimit';
import { Logger } from 'commandkit';

const formatError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

configureRatelimit({
  defaultLimiter: {
    maxRequests: 10,
    interval: '30s',
    scope: 'user',
  },
  limiters: {
    strict: {
      maxRequests: 2,
      interval: '1m',
      scope: 'user',
    },
    queued: {
      maxRequests: 1,
      interval: '5s',
      scope: 'user',
      queue: {
        enabled: true,
        maxSize: 3,
        timeout: '20s',
        deferInteraction: true,
        ephemeral: true,
        concurrency: 1,
      },
    },
  },
  hooks: {
    onAllowed: ({ key, result }) => {
      Logger.info(`[ratelimit] allowed ${key} remaining=${result.remaining}`);
    },
    onRateLimited: ({ key, result }) => {
      Logger.warn(`[ratelimit] limited ${key} retryAfter=${result.retryAfter}ms`);
    },
    onViolation: (key, count) => {
      Logger.warn(`[ratelimit] violation ${key} count=${count}`);
    },
    onReset: (key) => {
      Logger.info(`[ratelimit] reset ${key}`);
    },
    onStorageError: (error, fallbackUsed) => {
      Logger.error(
        `[ratelimit] storage error fallback=${fallbackUsed} error=${formatError(error)}`,
      );
    },
  },
});
