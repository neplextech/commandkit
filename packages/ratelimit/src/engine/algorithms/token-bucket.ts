// Token bucket rate limiting.
//
// Allows short bursts while refilling steadily up to a cap.
// Bucket state is stored so limits stay consistent across commands.

import type {
  RateLimitAlgorithm,
  RateLimitAlgorithmType,
  RateLimitResult,
  RateLimitStorage,
} from '../../types';

export interface TokenBucketConfig {
  /** Maximum tokens available when the bucket is full. */
  capacity: number;
  /** Tokens added per second during refill. */
  refillRate: number;
  /** Scope reported in rate-limit results. */
  scope: RateLimitResult['scope'];
}

interface TokenBucketState {
  tokens: number;
  lastRefill: number;
}

/**
 * Token bucket algorithm for bursty traffic with steady refill.
 */
export class TokenBucketAlgorithm implements RateLimitAlgorithm {
  public readonly type: RateLimitAlgorithmType = 'token-bucket';

  public constructor(
    private readonly storage: RateLimitStorage,
    private readonly config: TokenBucketConfig,
  ) {}

  /**
   * Record one attempt and return the current bucket status for this key.
   */
  public async consume(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const { capacity, refillRate } = this.config;

    if (refillRate <= 0) {
      throw new Error('refillRate must be greater than 0');
    }

    const stored = await this.storage.get<TokenBucketState>(key);
    const state = isTokenBucketState(stored)
      ? stored
      : ({ tokens: capacity, lastRefill: now } satisfies TokenBucketState);

    const elapsedSeconds = Math.max(0, (now - state.lastRefill) / 1000);
    const refilled = Math.min(
      capacity,
      state.tokens + elapsedSeconds * refillRate,
    );
    const nextState: TokenBucketState = {
      tokens: refilled,
      lastRefill: now,
    };

    if (refilled < 1) {
      const retryAfter = Math.ceil(((1 - refilled) / refillRate) * 1000);
      const resetAt = now + retryAfter;
      await this.storage.set(
        key,
        nextState,
        estimateBucketTtl(capacity, refillRate),
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

    nextState.tokens = refilled - 1;
    await this.storage.set(
      key,
      nextState,
      estimateBucketTtl(capacity, refillRate),
    );

    const remaining = Math.floor(nextState.tokens);
    const resetAt =
      now + Math.ceil(((capacity - nextState.tokens) / refillRate) * 1000);

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

function isTokenBucketState(value: unknown): value is TokenBucketState {
  if (!value || typeof value !== 'object') return false;
  const state = value as TokenBucketState;
  return (
    typeof state.tokens === 'number' &&
    Number.isFinite(state.tokens) &&
    typeof state.lastRefill === 'number' &&
    Number.isFinite(state.lastRefill)
  );
}

function estimateBucketTtl(capacity: number, refillRate: number): number {
  if (refillRate <= 0) return 60_000;
  return Math.ceil((capacity / refillRate) * 1000 * 2);
}
