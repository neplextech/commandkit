// Fixed window rate limiting.
//
// Simple counters per window are fast and predictable, at the cost of allowing
// bursts within the window boundary. Prefer atomic storage for correctness.

import type {
  RateLimitAlgorithm,
  RateLimitAlgorithmType,
  RateLimitResult,
  RateLimitStorage,
} from '../../types';
import { withStorageKeyLock } from '../../utils/locking';

interface FixedWindowConfig {
  maxRequests: number;
  intervalMs: number;
  scope: RateLimitResult['scope'];
}

interface FixedWindowState {
  count: number;
  resetAt: number;
  version?: number;
}

/**
 * Basic fixed-window counter for low-cost rate limits.
 */
export class FixedWindowAlgorithm implements RateLimitAlgorithm {
  public readonly type: RateLimitAlgorithmType = 'fixed-window';

  public constructor(
    private readonly storage: RateLimitStorage,
    private readonly config: FixedWindowConfig,
  ) {}

  /**
   * Record one attempt and return the current window status for this key.
   */
  public async consume(key: string): Promise<RateLimitResult> {
    const limit = this.config.maxRequests;
    const interval = this.config.intervalMs;

    if (this.storage.consumeFixedWindow) {
      const now = Date.now();
      const { count, ttlMs } = await this.storage.consumeFixedWindow(
        key,
        limit,
        interval,
        now,
      );
      const resetAt = now + ttlMs;
      const limited = count > limit;
      return {
        key,
        scope: this.config.scope,
        algorithm: this.type,
        limited,
        remaining: Math.max(0, limit - count),
        resetAt,
        retryAfter: limited ? Math.max(0, resetAt - now) : 0,
        limit,
      };
    }

    if (this.storage.incr) {
      const now = Date.now();
      const { count, ttlMs } = await this.storage.incr(key, interval);
      const resetAt = now + ttlMs;
      const limited = count > limit;
      return {
        key,
        scope: this.config.scope,
        algorithm: this.type,
        limited,
        remaining: Math.max(0, limit - count),
        resetAt,
        retryAfter: limited ? Math.max(0, resetAt - now) : 0,
        limit,
      };
    }

    // Fallback is serialized per process to avoid same-instance races.
    // Multi-process strictness still requires atomic storage operations.
    return withStorageKeyLock(this.storage, key, async () => {
      const maxRetries = 5;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const attemptNow = Date.now();
        const existingRaw = await this.storage.get<FixedWindowState>(key);
        const existing = isFixedWindowState(existingRaw) ? existingRaw : null;

        if (!existing || existing.resetAt <= attemptNow) {
          const resetAt = attemptNow + interval;
          const state: FixedWindowState = { count: 1, resetAt, version: 1 };
          const currentRaw = await this.storage.get<FixedWindowState>(key);
          const current = isFixedWindowState(currentRaw) ? currentRaw : null;
          if (current && current.resetAt > attemptNow) {
            continue;
          }
          await this.storage.set(key, state, interval);
          const verifyRaw = await this.storage.get<FixedWindowState>(key);
          const verify = isFixedWindowState(verifyRaw) ? verifyRaw : null;
          if ((verify?.version ?? 0) !== 1) {
            continue;
          }
          return {
            key,
            scope: this.config.scope,
            algorithm: this.type,
            limited: false,
            remaining: Math.max(0, limit - 1),
            resetAt,
            retryAfter: 0,
            limit,
          };
        }

        if (existing.count >= limit) {
          return {
            key,
            scope: this.config.scope,
            algorithm: this.type,
            limited: true,
            remaining: 0,
            resetAt: existing.resetAt,
            retryAfter: Math.max(0, existing.resetAt - attemptNow),
            limit,
          };
        }

        let nextState: FixedWindowState = {
          count: existing.count + 1,
          resetAt: existing.resetAt,
          version: (existing.version ?? 0) + 1,
        };

        const currentRaw = await this.storage.get<FixedWindowState>(key);
        const current = isFixedWindowState(currentRaw) ? currentRaw : null;
        if (
          !current ||
          current.resetAt !== existing.resetAt ||
          current.count !== existing.count ||
          (current.version ?? 0) !== (existing.version ?? 0)
        ) {
          continue;
        }

        let ttlMs = existing.resetAt - attemptNow;
        if (ttlMs <= 0) {
          nextState = {
            count: 1,
            resetAt: attemptNow + interval,
            version: 1,
          };
          ttlMs = interval;
        }

        await this.storage.set(key, nextState, ttlMs);
        const verifyRaw = await this.storage.get<FixedWindowState>(key);
        const verify = isFixedWindowState(verifyRaw) ? verifyRaw : null;
        if ((verify?.version ?? 0) !== (nextState.version ?? 0)) {
          continue;
        }

        return {
          key,
          scope: this.config.scope,
          algorithm: this.type,
          limited: false,
          remaining: Math.max(0, limit - nextState.count),
          resetAt: nextState.resetAt,
          retryAfter: 0,
          limit,
        };
      }

      const now = Date.now();
      const resetAt = now + interval;
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
    });
  }

  public async reset(key: string): Promise<void> {
    await this.storage.delete(key);
  }
}

function isFixedWindowState(value: unknown): value is FixedWindowState {
  if (!value || typeof value !== 'object') return false;
  const state = value as FixedWindowState;
  const hasValidVersion =
    state.version === undefined ||
    (typeof state.version === 'number' && Number.isFinite(state.version));
  return (
    typeof state.count === 'number' &&
    Number.isFinite(state.count) &&
    typeof state.resetAt === 'number' &&
    Number.isFinite(state.resetAt) &&
    hasValidVersion
  );
}
