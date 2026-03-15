/**
 * Engine escalation tests.
 *
 * Fake timers keep violation cooldowns deterministic.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { RateLimitEngine } from '../src/engine/RateLimitEngine';
import { MemoryRateLimitStorage } from '../src/storage/memory';
import type { ResolvedLimiterConfig } from '../src/types';

const scope = 'user' as const;

afterEach(() => {
  vi.useRealTimers();
});

describe('RateLimitEngine violations', () => {
  test('escalates cooldown when violations repeat', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const storage = new MemoryRateLimitStorage();
    const engine = new RateLimitEngine(storage);

    const config: ResolvedLimiterConfig = {
      maxRequests: 1,
      intervalMs: 1000,
      algorithm: 'fixed-window',
      scope,
      burst: 1,
      refillRate: 1,
      leakRate: 1,
      violations: {
        maxViolations: 3,
        escalationMultiplier: 2,
        resetAfter: 60_000,
      },
    };

    const first = await engine.consume('key', config);
    expect(first.result.limited).toBe(false);

    const second = await engine.consume('key', config);
    expect(second.result.limited).toBe(true);
    expect(second.violationCount).toBe(1);

    await vi.advanceTimersByTimeAsync(1000);

    const third = await engine.consume('key', config);
    expect(third.result.limited).toBe(false);

    const fourth = await engine.consume('key', config);
    expect(fourth.result.limited).toBe(true);
    expect(fourth.violationCount).toBe(2);
    expect(fourth.result.retryAfter).toBeGreaterThanOrEqual(2000);
  });
});
