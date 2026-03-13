// Violation tracking.
//
// Persists repeat violations so cooldowns can escalate predictably.

import type { RateLimitStorage, ViolationOptions } from '../types';
import { resolveDuration } from '../utils/time';

interface ViolationState {
  count: number;
  cooldownUntil: number;
  lastViolationAt: number;
}

const DEFAULT_MAX_VIOLATIONS = 5;
const DEFAULT_ESCALATION_MULTIPLIER = 2;
const DEFAULT_RESET_AFTER_MS = 60 * 60 * 1000;

/**
 * Tracks repeated violations and computes escalating cooldowns.
 */
export class ViolationTracker {
  public constructor(private readonly storage: RateLimitStorage) {}

  private key(key: string): string {
    return `violation:${key}`;
  }

  /**
   * Read stored violation state for a key, if present.
   */
  async getState(key: string): Promise<ViolationState | null> {
    const stored = await this.storage.get<ViolationState>(this.key(key));
    return isViolationState(stored) ? stored : null;
  }

  /**
   * Check if a cooldown is currently active for this key.
   */
  async checkCooldown(key: string): Promise<ViolationState | null> {
    const state = await this.getState(key);
    if (!state) return null;
    if (state.cooldownUntil > Date.now()) return state;
    return null;
  }

  /**
   * Record a violation and return the updated state for callers.
   */
  async recordViolation(
    key: string,
    baseRetryAfterMs: number,
    options?: ViolationOptions,
  ): Promise<ViolationState> {
    const now = Date.now();
    const prev = await this.getState(key);
    const maxViolations = options?.maxViolations ?? DEFAULT_MAX_VIOLATIONS;
    const multiplier =
      options?.escalationMultiplier ?? DEFAULT_ESCALATION_MULTIPLIER;
    const resetAfter = resolveDuration(
      options?.resetAfter,
      DEFAULT_RESET_AFTER_MS,
    );

    const count = Math.min((prev?.count ?? 0) + 1, maxViolations);
    const base = Math.max(0, baseRetryAfterMs);
    const cooldownMs = base * Math.pow(multiplier, Math.max(0, count - 1));
    const cooldownUntil = now + cooldownMs;

    const state: ViolationState = {
      count,
      cooldownUntil,
      lastViolationAt: now,
    };

    await this.storage.set(this.key(key), state, resetAfter);
    return state;
  }

  async reset(key: string): Promise<void> {
    await this.storage.delete(this.key(key));
  }
}

function isViolationState(value: unknown): value is ViolationState {
  if (!value || typeof value !== 'object') return false;
  const state = value as ViolationState;
  return (
    typeof state.count === 'number' &&
    Number.isFinite(state.count) &&
    typeof state.cooldownUntil === 'number' &&
    Number.isFinite(state.cooldownUntil) &&
    typeof state.lastViolationAt === 'number' &&
    Number.isFinite(state.lastViolationAt)
  );
}
