/**
 * Algorithm integration tests.
 *
 * Fake timers keep limiter math deterministic and avoid flakiness.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';
import { MemoryRateLimitStorage } from '../src/storage/memory';
import { FixedWindowAlgorithm } from '../src/engine/algorithms/fixed-window';
import { SlidingWindowLogAlgorithm } from '../src/engine/algorithms/sliding-window';
import { TokenBucketAlgorithm } from '../src/engine/algorithms/token-bucket';
import { LeakyBucketAlgorithm } from '../src/engine/algorithms/leaky-bucket';
import type { RateLimitStorage } from '../src/types';

const scope = 'user' as const;
const delay = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Test storage that delays sorted-set calls to simulate contention.
 *
 * @implements RateLimitStorage
 */
class DelayedSlidingWindowStorage implements RateLimitStorage {
  private readonly kv = new Map<string, unknown>();
  private readonly zset = new MemoryRateLimitStorage();

  async get<T = unknown>(key: string): Promise<T | null> {
    return (this.kv.get(key) as T) ?? null;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    this.kv.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.kv.delete(key);
    await this.zset.delete(key);
  }

  async zAdd(key: string, score: number, member: string): Promise<void> {
    await delay();
    await this.zset.zAdd!(key, score, member);
  }

  async zRemRangeByScore(key: string, min: number, max: number): Promise<void> {
    await delay();
    await this.zset.zRemRangeByScore!(key, min, max);
  }

  async zCard(key: string): Promise<number> {
    await delay();
    return this.zset.zCard!(key);
  }

  async zRangeByScore(
    key: string,
    min: number,
    max: number,
  ): Promise<string[]> {
    await delay();
    return this.zset.zRangeByScore!(key, min, max);
  }

  async expire(key: string, ttlMs: number): Promise<void> {
    await delay();
    await this.zset.expire!(key, ttlMs);
  }
}

/**
 * Test storage that delays key/value calls for fixed-window tests.
 *
 * @implements RateLimitStorage
 */
class DelayedFixedWindowStorage implements RateLimitStorage {
  private readonly kv = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | null> {
    await delay();
    return (this.kv.get(key) as T) ?? null;
  }

  async set<T = unknown>(key: string, value: T): Promise<void> {
    await delay();
    this.kv.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.kv.delete(key);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('FixedWindowAlgorithm', () => {
  test('limits after max requests and resets after interval', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const storage = new MemoryRateLimitStorage();
    const algorithm = new FixedWindowAlgorithm(storage, {
      maxRequests: 2,
      intervalMs: 1000,
      scope,
    });

    const r1 = await algorithm.consume('key');
    const r2 = await algorithm.consume('key');
    const r3 = await algorithm.consume('key');

    expect(r1.limited).toBe(false);
    expect(r2.limited).toBe(false);
    expect(r3.limited).toBe(true);
    expect(r3.retryAfter).toBeGreaterThan(0);

    vi.advanceTimersByTime(1000);
    const r4 = await algorithm.consume('key');
    expect(r4.limited).toBe(false);
  });

  test('serializes fallback consumes per key', async () => {
    const storage = new DelayedFixedWindowStorage();
    const algorithm = new FixedWindowAlgorithm(storage, {
      maxRequests: 1,
      intervalMs: 1000,
      scope,
    });

    const results = await Promise.all([
      algorithm.consume('key'),
      algorithm.consume('key'),
    ]);

    const limitedCount = results.filter((result) => result.limited).length;
    expect(limitedCount).toBe(1);
  });
});

describe('SlidingWindowLogAlgorithm', () => {
  test('enforces window and allows after it passes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const storage = new MemoryRateLimitStorage();
    const algorithm = new SlidingWindowLogAlgorithm(storage, {
      maxRequests: 2,
      intervalMs: 1000,
      scope,
    });

    expect((await algorithm.consume('key')).limited).toBe(false);
    expect((await algorithm.consume('key')).limited).toBe(false);
    expect((await algorithm.consume('key')).limited).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);

    expect((await algorithm.consume('key')).limited).toBe(false);
  });

  test('serializes fallback log consumes per key', async () => {
    const storage = new DelayedSlidingWindowStorage();
    const algorithm = new SlidingWindowLogAlgorithm(storage, {
      maxRequests: 1,
      intervalMs: 1000,
      scope,
    });

    const results = await Promise.all([
      algorithm.consume('key'),
      algorithm.consume('key'),
    ]);

    const limitedCount = results.filter((result) => result.limited).length;
    expect(limitedCount).toBe(1);
  });
});

describe('TokenBucketAlgorithm', () => {
  test('refills over time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const storage = new MemoryRateLimitStorage();
    const algorithm = new TokenBucketAlgorithm(storage, {
      capacity: 2,
      refillRate: 1,
      scope,
    });

    expect((await algorithm.consume('key')).limited).toBe(false);
    expect((await algorithm.consume('key')).limited).toBe(false);
    const limited = await algorithm.consume('key');
    expect(limited.limited).toBe(true);
    expect(limited.retryAfter).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(1000);

    expect((await algorithm.consume('key')).limited).toBe(false);
  });
});

describe('LeakyBucketAlgorithm', () => {
  test('drains over time', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const storage = new MemoryRateLimitStorage();
    const algorithm = new LeakyBucketAlgorithm(storage, {
      capacity: 2,
      leakRate: 1,
      scope,
    });

    expect((await algorithm.consume('key')).limited).toBe(false);
    expect((await algorithm.consume('key')).limited).toBe(false);
    const limited = await algorithm.consume('key');
    expect(limited.limited).toBe(true);
    expect(limited.retryAfter).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(1000);

    expect((await algorithm.consume('key')).limited).toBe(false);
  });
});
