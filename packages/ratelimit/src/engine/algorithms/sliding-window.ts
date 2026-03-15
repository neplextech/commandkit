/**
 * Sliding window log rate limiting.
 *
 * Tracks individual request timestamps for smoother limits and accurate retry
 * timing. Requires sorted-set support or an atomic storage helper.
 */

import type {
  RateLimitAlgorithm,
  RateLimitAlgorithmType,
  RateLimitResult,
  RateLimitStorage,
} from '../../types';
import { withStorageKeyLock } from '../../utils/locking';

interface SlidingWindowConfig {
  maxRequests: number;
  intervalMs: number;
  scope: RateLimitResult['scope'];
}

/**
 * Sliding-window log algorithm for smoother limits.
 *
 * @implements RateLimitAlgorithm
 */
export class SlidingWindowLogAlgorithm implements RateLimitAlgorithm {
  public readonly type: RateLimitAlgorithmType = 'sliding-window';

  /**
   * Create a sliding-window algorithm bound to a storage backend.
   *
   * @param storage - Storage backend for rate-limit state.
   * @param config - Sliding-window configuration.
   */
  public constructor(
    private readonly storage: RateLimitStorage,
    private readonly config: SlidingWindowConfig,
  ) {}

  /**
   * Record one attempt and return the current window status for this key.
   *
   * @param key - Storage key for the limiter.
   * @returns Rate limit result for the current window.
   * @throws Error when the storage backend lacks sorted-set support.
   */
  public async consume(key: string): Promise<RateLimitResult> {
    const limit = this.config.maxRequests;
    const windowMs = this.config.intervalMs;

    if (this.storage.consumeSlidingWindowLog) {
      const now = Date.now();
      /**
       * Include the timestamp so reset time can be derived without extra reads.
       */
      const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;
      const res = await this.storage.consumeSlidingWindowLog(
        key,
        limit,
        windowMs,
        now,
        member,
      );
      const limited = !res.allowed;
      return {
        key,
        scope: this.config.scope,
        algorithm: this.type,
        limited,
        remaining: Math.max(0, limit - res.count),
        resetAt: res.resetAt,
        retryAfter: limited ? Math.max(0, res.resetAt - now) : 0,
        limit,
      };
    }

    if (
      !this.storage.zRemRangeByScore ||
      !this.storage.zCard ||
      !this.storage.zAdd
    ) {
      throw new Error('Sliding window requires sorted set support in storage');
    }

    return withStorageKeyLock(this.storage, key, async () => {
      const now = Date.now();
      /**
       * Include the timestamp so reset time can be derived without extra reads.
       */
      const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;
      /**
       * Fallback is serialized per process; multi-process strictness needs atomic storage.
       */
      await this.storage.zRemRangeByScore!(key, 0, now - windowMs);
      const count = await this.storage.zCard!(key);

      if (count >= limit) {
        const oldestMembers = this.storage.zRangeByScore
          ? await this.storage.zRangeByScore(
              key,
              Number.NEGATIVE_INFINITY,
              Number.POSITIVE_INFINITY,
            )
          : [];
        const oldestMember = oldestMembers[0];
        const oldestTs = oldestMember
          ? Number(oldestMember.split('-')[0])
          : now;
        const resetAt = oldestTs + windowMs;
        return {
          key,
          scope: this.config.scope,
          algorithm: this.type,
          limited: true,
          remaining: 0,
          resetAt,
          retryAfter: Math.max(0, resetAt - now),
          limit,
        };
      }

      await this.storage.zAdd!(key, now, member);
      if (this.storage.expire) {
        await this.storage.expire(key, windowMs);
      }

      const newCount = count + 1;
      const oldestMembers = this.storage.zRangeByScore
        ? await this.storage.zRangeByScore(
            key,
            Number.NEGATIVE_INFINITY,
            Number.POSITIVE_INFINITY,
          )
        : [];
      const oldestMember = oldestMembers[0];
      const oldestTs = oldestMember ? Number(oldestMember.split('-')[0]) : now;
      const resetAt = oldestTs + windowMs;

      return {
        key,
        scope: this.config.scope,
        algorithm: this.type,
        limited: false,
        remaining: Math.max(0, limit - newCount),
        resetAt,
        retryAfter: 0,
        limit,
      };
    });
  }

  /**
   * Reset the stored key state for this limiter.
   *
   * @param key - Storage key to reset.
   * @returns Resolves after the key is deleted.
   */
  public async reset(key: string): Promise<void> {
    await this.storage.delete(key);
  }
}
