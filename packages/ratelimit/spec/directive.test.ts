import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { RateLimitPlugin } from '../src/plugin';
import { MemoryRateLimitStorage } from '../src/storage/memory';
import { RateLimitError } from '../src/errors';
import { configureRatelimit } from '../src/configure';
import { createRuntimeContext } from './helpers';
import { setRateLimitRuntime, setRateLimitStorage } from '../src/runtime';
import type { RateLimitStorage } from '../src/types';

describe('RateLimit directive', () => {
  beforeEach(() => {
    configureRatelimit({});
  });

  afterEach(() => {
    setRateLimitRuntime(null);
    setRateLimitStorage(null as unknown as RateLimitStorage);
  });

  test('enforces limits via runtime plugin', async () => {
    const storage = new MemoryRateLimitStorage();
    const plugin = new RateLimitPlugin({
      storage,
      defaultLimiter: { maxRequests: 1, interval: 1000 },
    });

    const runtime = createRuntimeContext();
    await plugin.activate(runtime.ctx as any);

    const arrow = async () => {
      'use ratelimit';
      return 'ok';
    };

    async function declared() {
      'use ratelimit';
      return 'ok';
    }

    const expressed = async function () {
      'use ratelimit';
      return 'ok';
    };

    const obj = {
      async method() {
        'use ratelimit';
        return 'ok';
      },
    };

    const cases = [arrow, declared, expressed, obj.method];

    for (const fn of cases) {
      await fn();
      let thrown: unknown;
      try {
        await fn();
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(RateLimitError);
      if (!(thrown instanceof RateLimitError)) {
        throw thrown;
      }
      expect(thrown.result.limited).toBe(true);
      expect(thrown.result.retryAfter).toBeGreaterThan(0);
    }
  });

  test('throws when runtime is not initialized', async () => {
    setRateLimitRuntime(null);
    setRateLimitStorage(null as unknown as RateLimitStorage);

    const fn = async () => {
      'use ratelimit';
      return 'ok';
    };

    await expect(fn()).rejects.toThrow(
      'RateLimit runtime is not initialized. Register the RateLimitPlugin first.',
    );
  });
});
