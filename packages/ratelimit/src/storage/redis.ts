/**
 * Redis storage.
 *
 * Uses Lua scripts for atomic fixed/sliding window operations.
 */

import Redis, { type RedisOptions } from 'ioredis';
import type {
  FixedWindowConsumeResult,
  RateLimitStorage,
  SlidingWindowConsumeResult,
} from '../types';

const FIXED_WINDOW_SCRIPT = /* lua */ `
  local key = KEYS[1]
  local window = tonumber(ARGV[1])
  local count = redis.call('INCR', key)
  local ttl = redis.call('PTTL', key)
  if ttl < 0 then
    redis.call('PEXPIRE', key, window)
    ttl = window
  end
  return {count, ttl}
`;

const SLIDING_WINDOW_SCRIPT = /* lua */ `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local member = ARGV[4]

  redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
  local count = redis.call('ZCARD', key)

  if count >= limit then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local resetAt = now + window
    if oldest[2] then
      resetAt = tonumber(oldest[2]) + window
    end
    return {0, count, resetAt}
  end

  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, window)
  count = count + 1
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local resetAt = now + window
  if oldest[2] then
    resetAt = tonumber(oldest[2]) + window
  end
  return {1, count, resetAt}
`;

/**
 * Redis-backed storage with Lua scripts for atomic window operations.
 *
 * @implements RateLimitStorage
 */
export class RedisRateLimitStorage implements RateLimitStorage {
  public readonly redis: Redis;

  public constructor(redis?: Redis | RedisOptions) {
    this.redis = redis instanceof Redis ? redis : new Redis(redis ?? {});
  }

  /**
   * Read a value from Redis and JSON-decode it.
   *
   * @param key - Storage key to read.
   * @returns Parsed value or null when absent.
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (value == null) return null;
    return JSON.parse(value) as T;
  }

  /**
   * Store a value in Redis with optional TTL.
   *
   * @param key - Storage key to write.
   * @param value - Value to serialize and store.
   * @param ttlMs - Optional TTL in milliseconds.
   * @returns Resolves when the value is stored.
   */
  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (typeof ttlMs === 'number') {
      await this.redis.set(key, payload, 'PX', ttlMs);
      return;
    }
    await this.redis.set(key, payload);
  }

  /**
   * Delete a key from Redis.
   *
   * @param key - Storage key to delete.
   * @returns Resolves when the key is removed.
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Read the TTL for a key when present.
   *
   * @param key - Storage key to inspect.
   * @returns Remaining TTL in ms or null when no TTL is set.
   */
  async ttl(key: string): Promise<number | null> {
    const ttl = await this.redis.pttl(key);
    if (ttl < 0) return null;
    return ttl;
  }

  /**
   * Update the TTL for an existing key.
   *
   * @param key - Storage key to update.
   * @param ttlMs - TTL in milliseconds.
   * @returns Resolves after the TTL is updated.
   */
  async expire(key: string, ttlMs: number): Promise<void> {
    await this.redis.pexpire(key, ttlMs);
  }

  /**
   * Add a member to a sorted set with the given score.
   *
   * @param key - Sorted-set key.
   * @param score - Score to associate with the member.
   * @param member - Member identifier.
   * @returns Resolves when the member is added.
   */
  async zAdd(key: string, score: number, member: string): Promise<void> {
    await this.redis.zadd(key, score.toString(), member);
  }

  /**
   * Remove sorted-set members with scores in the given range.
   *
   * @param key - Sorted-set key.
   * @param min - Minimum score (inclusive).
   * @param max - Maximum score (inclusive).
   * @returns Resolves when the range is removed.
   */
  async zRemRangeByScore(key: string, min: number, max: number): Promise<void> {
    await this.redis.zremrangebyscore(key, min.toString(), max.toString());
  }

  /**
   * Count members in a sorted set.
   *
   * @param key - Sorted-set key.
   * @returns Number of members in the set.
   */
  async zCard(key: string): Promise<number> {
    return Number(await this.redis.zcard(key));
  }

  /**
   * Read sorted-set members in a score range.
   *
   * @param key - Sorted-set key.
   * @param min - Minimum score (inclusive).
   * @param max - Maximum score (inclusive).
   * @returns Ordered members in the score range.
   */
  async zRangeByScore(
    key: string,
    min: number,
    max: number,
  ): Promise<string[]> {
    return this.redis.zrangebyscore(key, min.toString(), max.toString());
  }

  /**
   * Atomically consume a fixed-window counter via Lua.
   *
   * @param key - Storage key to consume.
   * @param _limit - Limit (unused by the script).
   * @param windowMs - Window size in milliseconds.
   * @param _nowMs - Current time (unused by the script).
   * @returns Fixed-window consume result.
   */
  async consumeFixedWindow(
    key: string,
    _limit: number,
    windowMs: number,
    _nowMs: number,
  ): Promise<FixedWindowConsumeResult> {
    const result = (await this.redis.eval(
      FIXED_WINDOW_SCRIPT,
      1,
      key,
      windowMs.toString(),
    )) as [number, number];

    return {
      count: Number(result[0]),
      ttlMs: Number(result[1]),
    };
  }

  /**
   * Atomically consume a sliding-window log via Lua.
   *
   * @param key - Storage key to consume.
   * @param limit - Request limit for the window.
   * @param windowMs - Window size in milliseconds.
   * @param nowMs - Current timestamp in milliseconds.
   * @param member - Member identifier for this request.
   * @returns Sliding-window consume result.
   */
  async consumeSlidingWindowLog(
    key: string,
    limit: number,
    windowMs: number,
    nowMs: number,
    member: string,
  ): Promise<SlidingWindowConsumeResult> {
    const result = (await this.redis.eval(
      SLIDING_WINDOW_SCRIPT,
      1,
      key,
      limit.toString(),
      windowMs.toString(),
      nowMs.toString(),
      member,
    )) as [number, number, number];

    return {
      allowed: Number(result[0]) === 1,
      count: Number(result[1]),
      resetAt: Number(result[2]),
    };
  }

  /**
   * Delete keys with the given prefix.
   *
   * @param prefix - Prefix to match.
   * @returns Resolves after matching keys are deleted.
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    await this.deleteByPattern(`${prefix}*`);
  }

  /**
   * Delete keys matching a glob pattern using SCAN to avoid blocking Redis.
   *
   * @param pattern - Glob pattern to match keys against.
   * @returns Resolves after matching keys are deleted.
   */
  async deleteByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = (await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        '100',
      )) as [string, string[]];

      if (keys.length) {
        await this.redis.del(...keys);
      }
      cursor = nextCursor;
    } while (cursor !== '0');
  }

  /**
   * List keys that match a prefix using SCAN.
   *
   * @param prefix - Prefix to match.
   * @returns Matching keys.
   */
  async keysByPrefix(prefix: string): Promise<string[]> {
    const pattern = `${prefix}*`;
    const collected = new Set<string>();
    let cursor = '0';
    do {
      const [nextCursor, keys] = (await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        '100',
      )) as [string, string[]];

      for (const key of keys) {
        collected.add(key);
      }
      cursor = nextCursor;
    } while (cursor !== '0');

    return Array.from(collected);
  }
}
