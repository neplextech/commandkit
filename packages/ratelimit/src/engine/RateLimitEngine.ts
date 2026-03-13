// Engine coordinator.
//
// Selects algorithms and applies violation escalation before returning results.

import type {
  RateLimitAlgorithm,
  RateLimitAlgorithmType,
  RateLimitResult,
  RateLimitStorage,
  ResolvedLimiterConfig,
} from '../types';
import { FixedWindowAlgorithm } from './algorithms/fixed-window';
import { SlidingWindowLogAlgorithm } from './algorithms/sliding-window';
import { TokenBucketAlgorithm } from './algorithms/token-bucket';
import { LeakyBucketAlgorithm } from './algorithms/leaky-bucket';
import { ViolationTracker } from './violations';

/**
 * Consume output including optional violation count for callers.
 */
export interface RateLimitConsumeOutput {
  result: RateLimitResult;
  violationCount?: number;
}

/**
 * Coordinates algorithm selection and violation escalation per storage.
 */
export class RateLimitEngine {
  private readonly violations: ViolationTracker;

  public constructor(private readonly storage: RateLimitStorage) {
    this.violations = new ViolationTracker(storage);
  }

  /**
   * Create an algorithm instance for a resolved config.
   */
  private createAlgorithm(config: ResolvedLimiterConfig): RateLimitAlgorithm {
    switch (config.algorithm) {
      case 'fixed-window':
        return new FixedWindowAlgorithm(this.storage, {
          maxRequests: config.maxRequests,
          intervalMs: config.intervalMs,
          scope: config.scope,
        });
      case 'sliding-window':
        return new SlidingWindowLogAlgorithm(this.storage, {
          maxRequests: config.maxRequests,
          intervalMs: config.intervalMs,
          scope: config.scope,
        });
      case 'token-bucket':
        return new TokenBucketAlgorithm(this.storage, {
          capacity: config.burst,
          refillRate: config.refillRate,
          scope: config.scope,
        });
      case 'leaky-bucket':
        return new LeakyBucketAlgorithm(this.storage, {
          capacity: config.burst,
          leakRate: config.leakRate,
          scope: config.scope,
        });
      default:
        // Fall back to fixed-window so unknown algorithms still enforce a limit.
        return new FixedWindowAlgorithm(this.storage, {
          maxRequests: config.maxRequests,
          intervalMs: config.intervalMs,
          scope: config.scope,
        });
    }
  }

  /**
   * Consume a single key and apply escalation rules when enabled.
   */
  public async consume(
    key: string,
    config: ResolvedLimiterConfig,
  ): Promise<RateLimitConsumeOutput> {
    const now = Date.now();
    const shouldEscalate =
      config.violations != null && config.violations.escalate !== false;
    if (shouldEscalate) {
      const active = await this.violations.checkCooldown(key);
      if (active) {
        // When an escalation cooldown is active, skip the algorithm to enforce the cooldown.
        const limit =
          config.algorithm === 'token-bucket' ||
          config.algorithm === 'leaky-bucket'
            ? config.burst
            : config.maxRequests;
        const result = {
          key,
          scope: config.scope,
          algorithm: config.algorithm,
          limited: true,
          remaining: 0,
          resetAt: active.cooldownUntil,
          retryAfter: Math.max(0, active.cooldownUntil - now),
          limit,
          windowId: config.windowId,
        };
        return {
          result,
          violationCount: active.count,
        };
      }
    }

    const algorithm = this.createAlgorithm(config);
    const result = await algorithm.consume(key);
    if (config.windowId) {
      result.windowId = config.windowId;
    }

    if (result.limited && shouldEscalate) {
      const state = await this.violations.recordViolation(
        key,
        result.retryAfter,
        config.violations,
      );

      // If escalation extends the cooldown, update the result so retry info stays accurate.
      if (state.cooldownUntil > result.resetAt) {
        result.resetAt = state.cooldownUntil;
        result.retryAfter = Math.max(0, state.cooldownUntil - now);
      }

      return { result, violationCount: state.count };
    }

    return { result };
  }

  /**
   * Reset a key and its associated violation state.
   */
  public async reset(key: string): Promise<void> {
    await this.storage.delete(key);
    await this.violations.reset(key);
  }
}
