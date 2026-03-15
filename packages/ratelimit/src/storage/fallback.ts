/**
 * Fallback storage wrapper.
 *
 * Routes storage calls to a secondary backend when the primary fails.
 */

import { Logger } from 'commandkit';
import type { RateLimitStorage } from '../types';

/**
 * Options that control fallback logging/cooldown behavior.
 */
export interface FallbackRateLimitStorageOptions {
  /**
   * Minimum time between fallback log entries (to avoid log spam).
   *
   * @default 30000
   */
  cooldownMs?: number;
}

/**
 * Storage wrapper that falls back to a secondary implementation on failure.
 *
 * @implements RateLimitStorage
 */
export class FallbackRateLimitStorage implements RateLimitStorage {
  private lastErrorAt = 0;

  /**
   * Create a fallback wrapper with primary/secondary storages.
   *
   * @param primary - Primary storage backend.
   * @param secondary - Secondary storage backend used on failure.
   * @param options - Fallback logging and cooldown options.
   */
  public constructor(
    private readonly primary: RateLimitStorage,
    private readonly secondary: RateLimitStorage,
    private readonly options: FallbackRateLimitStorageOptions = {},
  ) {}

  /**
   * Check whether a fallback error should be logged.
   *
   * @returns True when the log cooldown has elapsed.
   */
  private shouldLog(): boolean {
    const now = Date.now();
    const cooldown = this.options.cooldownMs ?? 30_000;
    if (now - this.lastErrorAt > cooldown) {
      this.lastErrorAt = now;
      return true;
    }
    return false;
  }

  /**
   * Execute a storage operation with a fallback on failure.
   *
   * @param op - Primary operation.
   * @param fallback - Secondary operation when primary fails.
   * @returns Result from the primary or fallback operation.
   */
  private async withFallback<T>(
    op: () => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    try {
      return await op();
    } catch (error) {
      if (this.shouldLog()) {
        Logger.error`[ratelimit] Storage error, falling back to secondary: ${error}`;
      }
      return fallback();
    }
  }

  /**
   * Read a value using primary storage with fallback.
   *
   * @param key - Storage key to read.
   * @returns Stored value or null when absent.
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    return this.withFallback(
      () => this.primary.get<T>(key),
      () => this.secondary.get<T>(key),
    );
  }

  /**
   * Store a value using primary storage with fallback.
   *
   * @param key - Storage key to write.
   * @param value - Value to store.
   * @param ttlMs - Optional TTL in milliseconds.
   * @returns Resolves when the value is stored.
   */
  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    return this.withFallback(
      () => this.primary.set(key, value, ttlMs),
      () => this.secondary.set(key, value, ttlMs),
    );
  }

  /**
   * Delete a key using primary storage with fallback.
   *
   * @param key - Storage key to delete.
   * @returns Resolves when the key is removed.
   */
  async delete(key: string): Promise<void> {
    return this.withFallback(
      () => this.primary.delete(key),
      () => this.secondary.delete(key),
    );
  }

  /**
   * Increment a fixed-window counter using primary storage with fallback.
   *
   * @param key - Storage key to increment.
   * @param ttlMs - TTL window in milliseconds.
   * @returns Fixed-window consume result.
   * @throws Error when either storage lacks incr support.
   */
  async incr(key: string, ttlMs: number) {
    if (!this.primary.incr || !this.secondary.incr) {
      throw new Error('incr not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.incr!(key, ttlMs),
      () => this.secondary.incr!(key, ttlMs),
    );
  }

  /**
   * Read TTL using primary storage with fallback.
   *
   * @param key - Storage key to inspect.
   * @returns Remaining TTL in ms or null when no TTL is set.
   * @throws Error when either storage lacks ttl support.
   */
  async ttl(key: string) {
    if (!this.primary.ttl || !this.secondary.ttl) {
      throw new Error('ttl not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.ttl!(key),
      () => this.secondary.ttl!(key),
    );
  }

  /**
   * Update TTL using primary storage with fallback.
   *
   * @param key - Storage key to update.
   * @param ttlMs - TTL in milliseconds.
   * @returns Resolves after the TTL is updated.
   * @throws Error when either storage lacks expire support.
   */
  async expire(key: string, ttlMs: number) {
    if (!this.primary.expire || !this.secondary.expire) {
      throw new Error('expire not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.expire!(key, ttlMs),
      () => this.secondary.expire!(key, ttlMs),
    );
  }

  /**
   * Add a member to a sorted set using primary storage with fallback.
   *
   * @param key - Sorted-set key.
   * @param score - Score to associate with the member.
   * @param member - Member identifier.
   * @returns Resolves when the member is added.
   */
  async zAdd(key: string, score: number, member: string) {
    if (!this.primary.zAdd || !this.secondary.zAdd) {
      throw new Error('zAdd not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.zAdd!(key, score, member),
      () => this.secondary.zAdd!(key, score, member),
    );
  }

  /**
   * Remove sorted-set members in a score range with fallback.
   *
   * @param key - Sorted-set key.
   * @param min - Minimum score (inclusive).
   * @param max - Maximum score (inclusive).
   * @returns Resolves when the range is removed.
   */
  async zRemRangeByScore(key: string, min: number, max: number) {
    if (!this.primary.zRemRangeByScore || !this.secondary.zRemRangeByScore) {
      throw new Error('zRemRangeByScore not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.zRemRangeByScore!(key, min, max),
      () => this.secondary.zRemRangeByScore!(key, min, max),
    );
  }

  /**
   * Count sorted-set members with fallback.
   *
   * @param key - Sorted-set key.
   * @returns Number of members in the set.
   */
  async zCard(key: string) {
    if (!this.primary.zCard || !this.secondary.zCard) {
      throw new Error('zCard not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.zCard!(key),
      () => this.secondary.zCard!(key),
    );
  }

  /**
   * Read sorted-set members in a score range with fallback.
   *
   * @param key - Sorted-set key.
   * @param min - Minimum score (inclusive).
   * @param max - Maximum score (inclusive).
   * @returns Ordered members in the score range.
   */
  async zRangeByScore(key: string, min: number, max: number) {
    if (!this.primary.zRangeByScore || !this.secondary.zRangeByScore) {
      throw new Error('zRangeByScore not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.zRangeByScore!(key, min, max),
      () => this.secondary.zRangeByScore!(key, min, max),
    );
  }

  /**
   * Atomically consume a fixed-window counter with fallback.
   *
   * @param key - Storage key to consume.
   * @param limit - Request limit for the window.
   * @param windowMs - Window size in milliseconds.
   * @param nowMs - Current timestamp in milliseconds.
   * @returns Fixed-window consume result.
   * @throws Error when either storage lacks consumeFixedWindow support.
   */
  async consumeFixedWindow(
    key: string,
    limit: number,
    windowMs: number,
    nowMs: number,
  ) {
    if (
      !this.primary.consumeFixedWindow ||
      !this.secondary.consumeFixedWindow
    ) {
      throw new Error('consumeFixedWindow not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.consumeFixedWindow!(key, limit, windowMs, nowMs),
      () => this.secondary.consumeFixedWindow!(key, limit, windowMs, nowMs),
    );
  }

  /**
   * Atomically consume a sliding-window log with fallback.
   *
   * @param key - Storage key to consume.
   * @param limit - Request limit for the window.
   * @param windowMs - Window size in milliseconds.
   * @param nowMs - Current timestamp in milliseconds.
   * @param member - Member identifier for this request.
   * @returns Sliding-window consume result.
   * @throws Error when either storage lacks consumeSlidingWindowLog support.
   */
  async consumeSlidingWindowLog(
    key: string,
    limit: number,
    windowMs: number,
    nowMs: number,
    member: string,
  ) {
    if (
      !this.primary.consumeSlidingWindowLog ||
      !this.secondary.consumeSlidingWindowLog
    ) {
      throw new Error('consumeSlidingWindowLog not supported by both storages');
    }
    return this.withFallback(
      () =>
        this.primary.consumeSlidingWindowLog!(
          key,
          limit,
          windowMs,
          nowMs,
          member,
        ),
      () =>
        this.secondary.consumeSlidingWindowLog!(
          key,
          limit,
          windowMs,
          nowMs,
          member,
        ),
    );
  }

  /**
   * Delete keys with a prefix using primary storage with fallback.
   *
   * @param prefix - Prefix to match.
   * @returns Resolves after matching keys are deleted.
   * @throws Error when either storage lacks deleteByPrefix support.
   */
  async deleteByPrefix(prefix: string) {
    if (!this.primary.deleteByPrefix || !this.secondary.deleteByPrefix) {
      throw new Error('deleteByPrefix not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.deleteByPrefix!(prefix),
      () => this.secondary.deleteByPrefix!(prefix),
    );
  }

  /**
   * Delete keys matching a pattern using primary storage with fallback.
   *
   * @param pattern - Glob pattern to match.
   * @returns Resolves after matching keys are deleted.
   * @throws Error when either storage lacks deleteByPattern support.
   */
  async deleteByPattern(pattern: string) {
    if (!this.primary.deleteByPattern || !this.secondary.deleteByPattern) {
      throw new Error('deleteByPattern not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.deleteByPattern!(pattern),
      () => this.secondary.deleteByPattern!(pattern),
    );
  }

  /**
   * List keys matching a prefix using primary storage with fallback.
   *
   * @param prefix - Prefix to match.
   * @returns Matching keys.
   * @throws Error when either storage lacks keysByPrefix support.
   */
  async keysByPrefix(prefix: string) {
    if (!this.primary.keysByPrefix || !this.secondary.keysByPrefix) {
      throw new Error('keysByPrefix not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.keysByPrefix!(prefix),
      () => this.secondary.keysByPrefix!(prefix),
    );
  }
}
