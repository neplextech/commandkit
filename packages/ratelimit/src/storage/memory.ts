// In-memory storage.
//
// Used for tests and local development; implements TTL and sorted-set helpers.
// Not suitable for multi-process deployments.

import type {
  FixedWindowConsumeResult,
  RateLimitStorage,
  SlidingWindowConsumeResult,
} from '../types';

interface KvEntry {
  value: unknown;
  expiresAt: number | null;
}

interface ZSetItem {
  score: number;
  member: string;
}

interface ZSetEntry {
  items: ZSetItem[];
  expiresAt: number | null;
}

/**
 * In-memory storage used for tests and local usage.
 */
export class MemoryRateLimitStorage implements RateLimitStorage {
  private readonly kv = new Map<string, KvEntry>();
  private readonly zsets = new Map<string, ZSetEntry>();

  private now(): number {
    return Date.now();
  }

  private isExpired(expiresAt: number | null): boolean {
    return expiresAt != null && expiresAt <= this.now();
  }

  /**
   * Clear expired entries so reads reflect current state.
   */
  private cleanupKey(key: string) {
    const kvEntry = this.kv.get(key);
    if (kvEntry && this.isExpired(kvEntry.expiresAt)) {
      this.kv.delete(key);
    }

    const zEntry = this.zsets.get(key);
    if (zEntry && this.isExpired(zEntry.expiresAt)) {
      this.zsets.delete(key);
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    this.cleanupKey(key);
    const entry = this.kv.get(key);
    if (!entry) return null;
    return entry.value as T;
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    const expiresAt = typeof ttlMs === 'number' ? this.now() + ttlMs : null;
    this.kv.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.kv.delete(key);
    this.zsets.delete(key);
  }

  async incr(key: string, ttlMs: number): Promise<FixedWindowConsumeResult> {
    this.cleanupKey(key);
    const entry = this.kv.get(key);

    if (!entry || typeof entry.value !== 'number') {
      const expiresAt = this.now() + ttlMs;
      this.kv.set(key, { value: 1, expiresAt });
      return { count: 1, ttlMs };
    }

    const count = entry.value + 1;
    entry.value = count;
    if (!entry.expiresAt) {
      entry.expiresAt = this.now() + ttlMs;
    }

    const remainingTtl = Math.max(
      0,
      (entry.expiresAt ?? this.now()) - this.now(),
    );
    return { count, ttlMs: remainingTtl };
  }

  async ttl(key: string): Promise<number | null> {
    this.cleanupKey(key);
    const entry = this.kv.get(key) ?? this.zsets.get(key);
    if (!entry) return null;
    if (entry.expiresAt == null) return null;
    return Math.max(0, entry.expiresAt - this.now());
  }

  async expire(key: string, ttlMs: number): Promise<void> {
    const expiresAt = this.now() + ttlMs;
    const kvEntry = this.kv.get(key);
    if (kvEntry) kvEntry.expiresAt = expiresAt;
    const zEntry = this.zsets.get(key);
    if (zEntry) zEntry.expiresAt = expiresAt;
  }

  async zAdd(key: string, score: number, member: string): Promise<void> {
    this.cleanupKey(key);
    const entry = this.zsets.get(key) ?? { items: [], expiresAt: null };
    const existingIndex = entry.items.findIndex(
      (item) => item.member === member,
    );
    if (existingIndex >= 0) {
      entry.items[existingIndex] = { score, member };
    } else {
      entry.items.push({ score, member });
    }
    entry.items.sort((a, b) => a.score - b.score);
    this.zsets.set(key, entry);
  }

  async zRemRangeByScore(key: string, min: number, max: number): Promise<void> {
    this.cleanupKey(key);
    const entry = this.zsets.get(key);
    if (!entry) return;
    entry.items = entry.items.filter(
      (item) => item.score < min || item.score > max,
    );
  }

  async zCard(key: string): Promise<number> {
    this.cleanupKey(key);
    const entry = this.zsets.get(key);
    return entry ? entry.items.length : 0;
  }

  async zRangeByScore(
    key: string,
    min: number,
    max: number,
  ): Promise<string[]> {
    this.cleanupKey(key);
    const entry = this.zsets.get(key);
    if (!entry) return [];
    return entry.items
      .filter((item) => item.score >= min && item.score <= max)
      .map((item) => item.member);
  }

  async consumeFixedWindow(
    key: string,
    _limit: number,
    windowMs: number,
    _nowMs: number,
  ): Promise<FixedWindowConsumeResult> {
    return this.incr(key, windowMs);
  }

  async consumeSlidingWindowLog(
    key: string,
    limit: number,
    windowMs: number,
    nowMs: number,
    member: string,
  ): Promise<SlidingWindowConsumeResult> {
    await this.zRemRangeByScore(key, 0, nowMs - windowMs);
    const count = await this.zCard(key);
    if (count >= limit) {
      const oldest = await this.zRangeByScore(
        key,
        Number.NEGATIVE_INFINITY,
        Number.POSITIVE_INFINITY,
      );
      const oldestMember = oldest[0];
      const oldestTs = parseMemberTimestamp(oldestMember, nowMs);
      return { allowed: false, count, resetAt: oldestTs + windowMs };
    }

    await this.zAdd(key, nowMs, member);
    await this.expire(key, windowMs);
    const newCount = count + 1;
    const oldest = await this.zRangeByScore(
      key,
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    );
    const oldestMember = oldest[0];
    const oldestTs = parseMemberTimestamp(oldestMember, nowMs);

    return { allowed: true, count: newCount, resetAt: oldestTs + windowMs };
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    for (const key of Array.from(this.kv.keys())) {
      if (key.startsWith(prefix)) this.kv.delete(key);
    }
    for (const key of Array.from(this.zsets.keys())) {
      if (key.startsWith(prefix)) this.zsets.delete(key);
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    const regex = globToRegex(pattern);
    for (const key of Array.from(this.kv.keys())) {
      if (regex.test(key)) this.kv.delete(key);
    }
    for (const key of Array.from(this.zsets.keys())) {
      if (regex.test(key)) this.zsets.delete(key);
    }
  }

  async keysByPrefix(prefix: string): Promise<string[]> {
    const keys = new Set<string>();
    const kvKeys = Array.from(this.kv.keys());
    for (const key of kvKeys) {
      this.cleanupKey(key);
      if (this.kv.has(key) && key.startsWith(prefix)) {
        keys.add(key);
      }
    }
    const zsetKeys = Array.from(this.zsets.keys());
    for (const key of zsetKeys) {
      this.cleanupKey(key);
      if (this.zsets.has(key) && key.startsWith(prefix)) {
        keys.add(key);
      }
    }
    return Array.from(keys);
  }
}

function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const regex = `^${escaped.replace(/\*/g, '.*')}$`;
  return new RegExp(regex);
}

function parseMemberTimestamp(
  member: string | undefined,
  fallback: number,
): number {
  if (!member) return fallback;
  const prefix = member.split('-')[0];
  const parsed = Number(prefix);
  return Number.isFinite(parsed) ? parsed : fallback;
}
