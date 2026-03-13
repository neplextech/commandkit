// Rate limit type contracts.
//
// Shared config and result shapes for the plugin, engine, storage, and helpers.
// Keeping them in one place reduces drift between runtime behavior and docs.

import type { Interaction, Message } from 'discord.js';
import type { Context } from 'commandkit';
import type { LoadedCommand } from 'commandkit';

/**
 * Scopes used to build rate limit keys and apply per-scope limits.
 */
export const RATE_LIMIT_SCOPES = [
  'user',
  'guild',
  'channel',
  'global',
  'user-guild',
  'custom',
] as const;

/**
 * Literal union of supported key scopes.
 */
export type RateLimitScope = (typeof RATE_LIMIT_SCOPES)[number];

/**
 * Scopes eligible for temporary exemptions stored in rate limit storage.
 */
export const RATE_LIMIT_EXEMPTION_SCOPES = [
  'user',
  'guild',
  'role',
  'channel',
  'category',
] as const;

/**
 * Literal union of exemption scopes.
 */
export type RateLimitExemptionScope =
  (typeof RATE_LIMIT_EXEMPTION_SCOPES)[number];

/**
 * Algorithm identifiers used to select the limiter implementation.
 */
export const RATE_LIMIT_ALGORITHMS = [
  'fixed-window',
  'sliding-window',
  'token-bucket',
  'leaky-bucket',
] as const;

/**
 * Literal union of algorithm identifiers.
 */
export type RateLimitAlgorithmType = (typeof RATE_LIMIT_ALGORITHMS)[number];

/**
 * Duration input accepted by configs: milliseconds or a duration string.
 */
export type DurationLike = number | string;

/**
 * Queue behavior for delayed retries after a limit is hit.
 */
export interface RateLimitQueueOptions {
  enabled?: boolean;
  maxSize?: number;
  timeout?: DurationLike;
  deferInteraction?: boolean;
  ephemeral?: boolean;
  concurrency?: number;
}

/**
 * Strategy for choosing among matching role-based overrides.
 */
export type RateLimitRoleLimitStrategy = 'highest' | 'lowest' | 'first';

/**
 * Result for a single limiter/window evaluation used for aggregation.
 */
export interface RateLimitResult {
  key: string;
  scope: RateLimitScope;
  algorithm: RateLimitAlgorithmType;
  windowId?: string;
  limited: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
  limit: number;
}

/**
 * Contract for rate limit algorithms used by the engine.
 */
export interface RateLimitAlgorithm {
  readonly type: RateLimitAlgorithmType;
  consume(key: string): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

/**
 * Storage result for fixed-window atomic consumes.
 */
export interface FixedWindowConsumeResult {
  count: number;
  ttlMs: number;
}

/**
 * Storage result for sliding-window log consumes.
 */
export interface SlidingWindowConsumeResult {
  allowed: boolean;
  count: number;
  resetAt: number;
}

/**
 * Storage contract for rate limit state, with optional optimization hooks.
 */
export interface RateLimitStorage {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  incr?(key: string, ttlMs: number): Promise<FixedWindowConsumeResult>;
  ttl?(key: string): Promise<number | null>;
  expire?(key: string, ttlMs: number): Promise<void>;
  zAdd?(key: string, score: number, member: string): Promise<void>;
  zRemRangeByScore?(key: string, min: number, max: number): Promise<void>;
  zCard?(key: string): Promise<number>;
  zRangeByScore?(key: string, min: number, max: number): Promise<string[]>;
  consumeFixedWindow?(
    key: string,
    limit: number,
    windowMs: number,
    nowMs: number,
  ): Promise<FixedWindowConsumeResult>;
  consumeSlidingWindowLog?(
    key: string,
    limit: number,
    windowMs: number,
    nowMs: number,
    member: string,
  ): Promise<SlidingWindowConsumeResult>;
  deleteByPrefix?(prefix: string): Promise<void>;
  deleteByPattern?(pattern: string): Promise<void>;
  keysByPrefix?(prefix: string): Promise<string[]>;
}

/**
 * Storage configuration: direct instance or `{ driver }` wrapper for parity.
 */
export type RateLimitStorageConfig =
  | RateLimitStorage
  | {
      driver: RateLimitStorage;
    };

/**
 * Escalation settings for repeated violations.
 */
export interface ViolationOptions {
  escalate?: boolean;
  maxViolations?: number;
  escalationMultiplier?: number;
  resetAfter?: DurationLike;
}

/**
 * Per-window overrides when a limiter defines multiple windows.
 */
export interface RateLimitWindowConfig {
  id?: string;
  maxRequests?: number;
  interval?: DurationLike;
  algorithm?: RateLimitAlgorithmType;
  burst?: number;
  refillRate?: number;
  leakRate?: number;
  violations?: ViolationOptions;
}

/**
 * Custom key builder for the `custom` scope.
 */
export type RateLimitKeyResolver = (
  ctx: Context,
  command: LoadedCommand,
  source: Interaction | Message,
) => string;

/**
 * Core limiter configuration used by plugin and directives.
 */
export interface RateLimitLimiterConfig {
  maxRequests?: number;
  interval?: DurationLike;
  scope?: RateLimitScope | RateLimitScope[];
  algorithm?: RateLimitAlgorithmType;
  burst?: number;
  refillRate?: number;
  leakRate?: number;
  keyResolver?: RateLimitKeyResolver;
  keyPrefix?: string;
  storage?: RateLimitStorageConfig;
  violations?: ViolationOptions;
  queue?: RateLimitQueueOptions;
  windows?: RateLimitWindowConfig[];
  roleLimits?: Record<string, RateLimitLimiterConfig>;
  roleLimitStrategy?: RateLimitRoleLimitStrategy;
}

/**
 * Per-command override stored in CommandKit metadata.
 */
export interface RateLimitCommandConfig extends RateLimitLimiterConfig {
  limiter?: string;
}

/**
 * Permanent allowlist rules for rate limiting.
 */
export interface RateLimitBypassOptions {
  userIds?: string[];
  roleIds?: string[];
  guildIds?: string[];
  check?: (source: Interaction | Message) => boolean | Promise<boolean>;
}

/**
 * Parameters for granting a temporary exemption.
 */
export interface RateLimitExemptionGrantParams {
  scope: RateLimitExemptionScope;
  id: string;
  duration: DurationLike;
  keyPrefix?: string;
}

/**
 * Parameters for revoking a temporary exemption.
 */
export interface RateLimitExemptionRevokeParams {
  scope: RateLimitExemptionScope;
  id: string;
  keyPrefix?: string;
}

/**
 * Filters for listing temporary exemptions.
 */
export interface RateLimitExemptionListParams {
  scope?: RateLimitExemptionScope;
  id?: string;
  keyPrefix?: string;
  limit?: number;
}

/**
 * Listed exemption entry with key and expiry info.
 */
export interface RateLimitExemptionInfo {
  key: string;
  scope: RateLimitExemptionScope;
  id: string;
  expiresInMs: number | null;
}

/**
 * Hook payload for rate limit lifecycle callbacks.
 */
export interface RateLimitHookContext {
  key: string;
  result: RateLimitResult;
  source: Interaction | Message;
}

/**
 * Optional lifecycle hooks used by the plugin to surface rate limit events.
 */
export interface RateLimitHooks {
  onRateLimited?: (info: RateLimitHookContext) => void | Promise<void>;
  onAllowed?: (info: RateLimitHookContext) => void | Promise<void>;
  onReset?: (key: string) => void | Promise<void>;
  onViolation?: (key: string, count: number) => void | Promise<void>;
  onStorageError?: (
    error: unknown,
    fallbackUsed: boolean,
  ) => void | Promise<void>;
}

/**
 * Override for responding when a command is rate-limited.
 */
export type RateLimitResponseHandler = (
  ctx: Context,
  info: RateLimitStoreValue,
) => Promise<void> | void;

/**
 * Runtime plugin options consumed by RateLimitPlugin.
 * Configure these via configureRatelimit().
 */
export interface RateLimitPluginOptions {
  defaultLimiter?: RateLimitLimiterConfig;
  limiters?: Record<string, RateLimitLimiterConfig>;
  storage?: RateLimitStorageConfig;
  keyPrefix?: string;
  keyResolver?: RateLimitKeyResolver;
  bypass?: RateLimitBypassOptions;
  hooks?: RateLimitHooks;
  onRateLimited?: RateLimitResponseHandler;
  queue?: RateLimitQueueOptions;
  roleLimits?: Record<string, RateLimitLimiterConfig>;
  roleLimitStrategy?: RateLimitRoleLimitStrategy;
  /**
   * Whether to initialize the default in-memory storage if no storage is configured.
   *
   * @default true
   */
  initializeDefaultStorage?: boolean;
  /**
   * Alias for initializeDefaultStorage, aligned with other packages.
   *
   * @default true
   */
  initializeDefaultDriver?: boolean;
}

/**
 * Aggregate results stored on the environment store for downstream handlers.
 */
export interface RateLimitStoreValue {
  limited: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
  results: RateLimitResult[];
}

/**
 * Limiter configuration after defaults are applied.
 */
export interface ResolvedLimiterConfig {
  maxRequests: number;
  intervalMs: number;
  algorithm: RateLimitAlgorithmType;
  scope: RateLimitScope;
  burst: number;
  refillRate: number;
  leakRate: number;
  violations?: ViolationOptions;
  windowId?: string;
}

/**
 * Active runtime context shared with APIs and directives.
 */
export interface RateLimitRuntimeContext {
  storage: RateLimitStorage;
  keyPrefix?: string;
  defaultLimiter: RateLimitLimiterConfig;
  limiters?: Record<string, RateLimitLimiterConfig>;
  hooks?: RateLimitHooks;
}
