// Fallback storage wrapper.
//
// Routes storage calls to a secondary backend when the primary fails.

import { Logger } from 'commandkit';
import type { RateLimitStorage } from '../types';

/**
 * Options that control fallback logging/cooldown behavior.
 */
export interface FallbackRateLimitStorageOptions {
  /** Minimum time between fallback log entries (to avoid log spam). */
  cooldownMs?: number;
}

/**
 * Storage wrapper that falls back to a secondary implementation on failure.
 */
export class FallbackRateLimitStorage implements RateLimitStorage {
  private lastErrorAt = 0;

  public constructor(
    private readonly primary: RateLimitStorage,
    private readonly secondary: RateLimitStorage,
    private readonly options: FallbackRateLimitStorageOptions = {},
  ) {}

  private shouldLog(): boolean {
    const now = Date.now();
    const cooldown = this.options.cooldownMs ?? 30_000;
    if (now - this.lastErrorAt > cooldown) {
      this.lastErrorAt = now;
      return true;
    }
    return false;
  }

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

  async get<T = unknown>(key: string): Promise<T | null> {
    return this.withFallback(
      () => this.primary.get<T>(key),
      () => this.secondary.get<T>(key),
    );
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    return this.withFallback(
      () => this.primary.set(key, value, ttlMs),
      () => this.secondary.set(key, value, ttlMs),
    );
  }

  async delete(key: string): Promise<void> {
    return this.withFallback(
      () => this.primary.delete(key),
      () => this.secondary.delete(key),
    );
  }

  async incr(key: string, ttlMs: number) {
    if (!this.primary.incr || !this.secondary.incr) {
      throw new Error('incr not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.incr!(key, ttlMs),
      () => this.secondary.incr!(key, ttlMs),
    );
  }

  async ttl(key: string) {
    if (!this.primary.ttl || !this.secondary.ttl) {
      throw new Error('ttl not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.ttl!(key),
      () => this.secondary.ttl!(key),
    );
  }

  async expire(key: string, ttlMs: number) {
    if (!this.primary.expire || !this.secondary.expire) {
      throw new Error('expire not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.expire!(key, ttlMs),
      () => this.secondary.expire!(key, ttlMs),
    );
  }

  async zAdd(key: string, score: number, member: string) {
    if (!this.primary.zAdd || !this.secondary.zAdd) {
      throw new Error('zAdd not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.zAdd!(key, score, member),
      () => this.secondary.zAdd!(key, score, member),
    );
  }

  async zRemRangeByScore(key: string, min: number, max: number) {
    if (!this.primary.zRemRangeByScore || !this.secondary.zRemRangeByScore) {
      throw new Error('zRemRangeByScore not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.zRemRangeByScore!(key, min, max),
      () => this.secondary.zRemRangeByScore!(key, min, max),
    );
  }

  async zCard(key: string) {
    if (!this.primary.zCard || !this.secondary.zCard) {
      throw new Error('zCard not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.zCard!(key),
      () => this.secondary.zCard!(key),
    );
  }

  async zRangeByScore(key: string, min: number, max: number) {
    if (!this.primary.zRangeByScore || !this.secondary.zRangeByScore) {
      throw new Error('zRangeByScore not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.zRangeByScore!(key, min, max),
      () => this.secondary.zRangeByScore!(key, min, max),
    );
  }

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

  async deleteByPrefix(prefix: string) {
    if (!this.primary.deleteByPrefix || !this.secondary.deleteByPrefix) {
      throw new Error('deleteByPrefix not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.deleteByPrefix!(prefix),
      () => this.secondary.deleteByPrefix!(prefix),
    );
  }

  async deleteByPattern(pattern: string) {
    if (!this.primary.deleteByPattern || !this.secondary.deleteByPattern) {
      throw new Error('deleteByPattern not supported by both storages');
    }
    return this.withFallback(
      () => this.primary.deleteByPattern!(pattern),
      () => this.secondary.deleteByPattern!(pattern),
    );
  }

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
