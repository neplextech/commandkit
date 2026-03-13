// Leaky bucket rate limiting.
//
// Drains at a steady rate to smooth spikes in traffic.
// The stored level keeps limits consistent across commands.

import type {
  RateLimitAlgorithm,
  RateLimitAlgorithmType,
  RateLimitResult,
  RateLimitStorage,
} from '../../types';

interface LeakyBucketConfig {
  /** Maximum fill level before limiting. */
  capacity: number;
  /** Tokens drained per second during leak. */
  leakRate: number;
  /** Scope reported in rate-limit results. */
  scope: RateLimitResult['scope'];
}

interface LeakyBucketState {
  level: number;
  lastLeak: number;
}

/**
 * Leaky bucket algorithm for smoothing output to a steady rate.
 */
export class LeakyBucketAlgorithm implements RateLimitAlgorithm {
  public readonly type: RateLimitAlgorithmType = 'leaky-bucket';

  public constructor(
    private readonly storage: RateLimitStorage,
    private readonly config: LeakyBucketConfig,
  ) {}

  /**
   * Record one attempt and return the current bucket status for this key.
   */
  public async consume(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const { capacity, leakRate } = this.config;

    if (leakRate <= 0) {
      throw new Error('leakRate must be greater than 0');
    }

    const stored = await this.storage.get<LeakyBucketState>(key);
    const state = isLeakyBucketState(stored)
      ? stored
      : ({ level: 0, lastLeak: now } satisfies LeakyBucketState);

    const elapsedSeconds = Math.max(0, (now - state.lastLeak) / 1000);
    const leaked = Math.max(0, state.level - elapsedSeconds * leakRate);

    const nextState: LeakyBucketState = {
      level: leaked,
      lastLeak: now,
    };

    if (leaked + 1 > capacity) {
      const overflow = leaked + 1 - capacity;
      const retryAfter = Math.ceil((overflow / leakRate) * 1000);
      const resetAt = now + retryAfter;
      await this.storage.set(
        key,
        nextState,
        estimateLeakyTtl(capacity, leakRate),
      );
      return {
        key,
        scope: this.config.scope,
        algorithm: this.type,
        limited: true,
        remaining: 0,
        resetAt,
        retryAfter,
        limit: capacity,
      };
    }

    nextState.level = leaked + 1;
    await this.storage.set(
      key,
      nextState,
      estimateLeakyTtl(capacity, leakRate),
    );

    const remaining = Math.floor(Math.max(0, capacity - nextState.level));
    const resetAt = now + Math.ceil((nextState.level / leakRate) * 1000);

    return {
      key,
      scope: this.config.scope,
      algorithm: this.type,
      limited: false,
      remaining,
      resetAt,
      retryAfter: 0,
      limit: capacity,
    };
  }

  public async reset(key: string): Promise<void> {
    await this.storage.delete(key);
  }
}

function isLeakyBucketState(value: unknown): value is LeakyBucketState {
  if (!value || typeof value !== 'object') return false;
  const state = value as LeakyBucketState;
  return (
    typeof state.level === 'number' &&
    Number.isFinite(state.level) &&
    typeof state.lastLeak === 'number' &&
    Number.isFinite(state.lastLeak)
  );
}

function estimateLeakyTtl(capacity: number, leakRate: number): number {
  if (leakRate <= 0) return 60_000;
  return Math.ceil((capacity / leakRate) * 1000 * 2);
}
