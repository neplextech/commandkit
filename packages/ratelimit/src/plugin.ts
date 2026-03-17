import { Logger, RuntimePlugin, defer } from 'commandkit';
import type {
  CommandKitEnvironment,
  CommandKitPluginRuntime,
  CommandKitHMREvent,
  PreparedAppCommandExecution,
} from 'commandkit';
import { createAsyncQueue, type AsyncQueue } from 'commandkit/async-queue';
import { EmbedBuilder, MessageFlags, Message } from 'discord.js';
import type { Interaction } from 'discord.js';
import { RateLimitEngine } from './engine/RateLimitEngine';
import type {
  RateLimitCommandConfig,
  RateLimitLimiterConfig,
  RateLimitPluginOptions,
  RateLimitResult,
  RateLimitScope,
  RateLimitStorage,
  RateLimitStorageConfig,
  RateLimitQueueOptions,
  RateLimitRoleLimitStrategy,
  RateLimitStoreValue,
} from './types';
import {
  DEFAULT_LIMITER,
  mergeLimiterConfigs,
  resolveLimiterConfigs,
} from './utils/config';
import {
  getRoleIds,
  resolveExemptionKeys,
  resolveScopeKeys,
} from './utils/keys';
import type { ResolvedScopeKey } from './utils/keys';
import { RATELIMIT_STORE_KEY } from './constants';
import { MemoryRateLimitStorage } from './storage/memory';
import {
  getRateLimitStorage,
  setRateLimitRuntime,
  setRateLimitStorage,
} from './runtime';
import { isRateLimitConfigured } from './configure';
import { clampAtLeast, resolveDuration } from './utils/time';

const ANALYTICS_EVENTS = {
  HIT: 'ratelimit_hit',
  ALLOWED: 'ratelimit_allowed',
  RESET: 'ratelimit_reset',
  VIOLATION: 'ratelimit_violation',
} as const;

type RateLimitEventPayload = {
  key: string;
  result: RateLimitResult;
  source: Interaction | Message;
  aggregate: RateLimitStoreValue;
  commandName: string;
  queued: boolean;
};

/**
 * Runtime plugin that enforces rate limits for CommandKit commands so handlers stay lean.
 *
 * @extends RuntimePlugin<RateLimitPluginOptions>
 */
export class RateLimitPlugin extends RuntimePlugin<RateLimitPluginOptions> {
  public readonly name = 'RateLimitPlugin';
  private readonly engines = new WeakMap<RateLimitStorage, RateLimitEngine>();
  private readonly memoryStorage = new MemoryRateLimitStorage();
  private readonly queues = new Map<string, AsyncQueue>();
  private hasLoggedMissingStorage = false;

  public constructor(options: RateLimitPluginOptions) {
    super(options);
    this.preload.add('ratelimit.js');
  }

  /**
   * Initialize runtime storage and defaults for this plugin instance.
   *
   * @param ctx - CommandKit runtime for the active application.
   * @returns Resolves when runtime storage has been initialized.
   * @throws Error when the plugin has not been configured.
   */
  public async activate(ctx: CommandKitPluginRuntime): Promise<void> {
    if (!isRateLimitConfigured()) {
      throw new Error(
        'RateLimit is not configured. Call configureRatelimit() during startup (for example in src/ratelimit.ts).',
      );
    }

    const runtimeStorage = this.resolveDefaultStorage();

    if (!runtimeStorage) {
      this.logMissingStorage();
      setRateLimitRuntime(null);
      return;
    }

    if (!getRateLimitStorage()) {
      setRateLimitStorage(runtimeStorage);
    }

    setRateLimitRuntime({
      storage: runtimeStorage,
      keyPrefix: this.options.keyPrefix,
      defaultLimiter: this.options.defaultLimiter ?? DEFAULT_LIMITER,
      limiters: this.options.limiters,
      hooks: this.options.hooks,
    });
  }

  /**
   * Dispose queues and clear shared runtime state.
   *
   * @returns Resolves after queues are aborted and runtime state is cleared.
   */
  public async deactivate(): Promise<void> {
    for (const queue of this.queues.values()) {
      queue.abort();
    }
    this.queues.clear();
    setRateLimitRuntime(null);
  }

  /**
   * Evaluate rate limits and optionally queue execution to avoid dropping commands.
   *
   * @param ctx - CommandKit runtime for the active application.
   * @param env - Command execution environment.
   * @param source - Interaction or message triggering the command.
   * @param prepared - Prepared command execution data.
   * @param execute - Callback that executes the command handler.
   * @returns True when execution is deferred or handled, otherwise false to continue.
   */
  public async executeCommand(
    ctx: CommandKitPluginRuntime,
    env: CommandKitEnvironment,
    source: Interaction | Message,
    prepared: PreparedAppCommandExecution,
    execute: () => Promise<any>,
  ): Promise<boolean> {
    const metadata = prepared.command.metadata as {
      ratelimit?: RateLimitCommandConfig | boolean;
    };

    const rateLimitSetting = metadata?.ratelimit;
    if (rateLimitSetting == null || rateLimitSetting === false) {
      return false;
    }

    if (!env.context) {
      return false;
    }

    if (await this.shouldBypass(source)) {
      return false;
    }

    const commandConfig =
      typeof rateLimitSetting === 'object' ? rateLimitSetting : {};

    const { limiter: limiterName, ...commandOverrides } = commandConfig;
    const namedLimiter = limiterName
      ? this.options.limiters?.[limiterName]
      : undefined;

    const mergedLimiter = mergeLimiterConfigs(
      DEFAULT_LIMITER,
      this.options.defaultLimiter,
      namedLimiter,
      commandOverrides,
    );

    const roleLimits = mergeRoleLimits(
      this.options.roleLimits,
      this.options.defaultLimiter?.roleLimits,
      namedLimiter?.roleLimits,
      commandOverrides.roleLimits,
    );
    const roleStrategy =
      commandOverrides.roleLimitStrategy ??
      namedLimiter?.roleLimitStrategy ??
      this.options.defaultLimiter?.roleLimitStrategy ??
      this.options.roleLimitStrategy;
    const roleOverride = resolveRoleLimit(roleLimits, roleStrategy, source);

    const effectiveLimiter = roleOverride
      ? mergeLimiterConfigs(mergedLimiter, roleOverride)
      : mergedLimiter;

    const queueConfig = resolveQueueOptions(
      this.options.queue,
      this.options.defaultLimiter?.queue,
      namedLimiter?.queue,
      commandOverrides.queue,
      roleOverride?.queue,
    );

    const scopes = normalizeScopes(effectiveLimiter.scope);
    const keyResolver =
      effectiveLimiter.keyResolver ?? this.options.keyResolver;
    const keyPrefix = effectiveLimiter.keyPrefix ?? this.options.keyPrefix;
    const storage =
      this.resolveStorage(effectiveLimiter.storage) ??
      this.resolveDefaultStorage();

    if (!storage) {
      this.logMissingStorage();
      env.store.set(RATELIMIT_STORE_KEY, createEmptyStoreValue());
      return false;
    }

    const engine = this.getEngine(storage);

    const resolvedKeys = resolveScopeKeys({
      ctx: env.context,
      source,
      command: prepared.command,
      scopes,
      keyPrefix,
      keyResolver,
    });

    if (!resolvedKeys.length) {
      env.store.set(RATELIMIT_STORE_KEY, createEmptyStoreValue());
      return false;
    }

    const results: RateLimitResult[] = [];
    let violationCount: number | undefined;

    for (const resolved of resolvedKeys) {
      const resolvedConfigs = resolveLimiterConfigs(
        effectiveLimiter,
        resolved.scope,
      );

      for (const resolvedConfig of resolvedConfigs) {
        const resolvedKey = withWindowSuffix(
          resolved.key,
          resolvedConfig.windowId,
        );

        let output: Awaited<ReturnType<RateLimitEngine['consume']>>;
        try {
          output = await engine.consume(resolvedKey, resolvedConfig);
        } catch (error) {
          if (this.options.hooks?.onStorageError) {
            await this.options.hooks.onStorageError(error, false);
          }
          Logger.error`[ratelimit] Storage error during consume: ${error}`;
          env.store.set(RATELIMIT_STORE_KEY, createEmptyStoreValue());
          return false;
        }

        const { result, violationCount: count } = output;
        results.push(result);
        if (typeof count === 'number') {
          violationCount =
            violationCount == null ? count : Math.max(violationCount, count);
        }

        if (result.limited) {
          defer(() =>
            ctx.commandkit.analytics.track({
              name: ANALYTICS_EVENTS.HIT,
              id: prepared.command.command.name,
              data: {
                key: result.key,
                scope: result.scope,
                algorithm: result.algorithm,
                resetAt: result.resetAt,
                remaining: result.remaining,
              },
            }),
          );

          if (violationCount != null) {
            defer(() =>
              ctx.commandkit.analytics.track({
                name: ANALYTICS_EVENTS.VIOLATION,
                id: prepared.command.command.name,
                data: {
                  key: result.key,
                  count: violationCount,
                },
              }),
            );
          }
        } else {
          defer(() =>
            ctx.commandkit.analytics.track({
              name: ANALYTICS_EVENTS.ALLOWED,
              id: prepared.command.command.name,
              data: {
                key: result.key,
                scope: result.scope,
                algorithm: result.algorithm,
                remaining: result.remaining,
              },
            }),
          );
        }
      }
    }

    /**
     * Aggregate across all scopes/windows so callers see a single response.
     */
    const aggregate = aggregateResults(results);
    env.store.set(RATELIMIT_STORE_KEY, aggregate);

    if (aggregate.limited) {
      const firstLimited = results.find((r) => r.limited) ?? results[0];
      if (!firstLimited) {
        return false;
      }

      if (
        queueConfig.enabled &&
        (await this.enqueueExecution({
          queueKey: selectQueueKey(results),
          queue: queueConfig,
          initialDelayMs: aggregate.retryAfter,
          source,
          execute,
          engine,
          resolvedKeys,
          limiter: effectiveLimiter,
        }))
      ) {
        Logger.info(
          `[ratelimit] Queued command /${prepared.command.command.name} for retry in ${Math.ceil(aggregate.retryAfter / 1000)}s`,
        );
        ctx.capture();
        if (this.options.hooks?.onRateLimited) {
          await this.options.hooks.onRateLimited({
            key: firstLimited.key,
            result: firstLimited,
            source,
          });
        }

        if (violationCount != null && this.options.hooks?.onViolation) {
          await this.options.hooks.onViolation(
            firstLimited.key,
            violationCount,
          );
        }

        this.emitRateLimited(ctx, {
          key: firstLimited.key,
          result: firstLimited,
          source,
          aggregate,
          commandName: prepared.command.command.name,
          queued: true,
        });

        return false;
      }

      Logger.warn(
        `[ratelimit] User hit rate limit on /${prepared.command.command.name} - retry in ${Math.ceil(aggregate.retryAfter / 1000)}s`,
      );

      await this.respondRateLimited(env, source, aggregate);

      if (this.options.hooks?.onRateLimited) {
        await this.options.hooks.onRateLimited({
          key: firstLimited.key,
          result: firstLimited,
          source,
        });
      }

      if (violationCount != null && this.options.hooks?.onViolation) {
        await this.options.hooks.onViolation(firstLimited.key, violationCount);
      }

      ctx.capture();

      this.emitRateLimited(ctx, {
        key: firstLimited.key,
        result: firstLimited,
        source,
        aggregate,
        commandName: prepared.command.command.name,
        queued: false,
      });
    } else if (this.options.hooks?.onAllowed) {
      const first = results[0];
      if (first) {
        await this.options.hooks.onAllowed({
          key: first.key,
          result: first,
          source,
        });
      }
    }

    return false;
  }

  /**
   * Clear matching keys when a command is hot-reloaded to avoid stale state.
   *
   * @param ctx - CommandKit runtime for the active application.
   * @param event - HMR event describing the changed file.
   * @returns Resolves after matching keys are cleared and the event is handled.
   */
  public async performHMR(
    ctx: CommandKitPluginRuntime,
    event: CommandKitHMREvent,
  ): Promise<void> {
    if (!event.path) return;

    const normalized = normalizePath(event.path);
    const commands = ctx.commandkit.commandHandler.getCommandsArray();
    const matched = commands.filter((cmd) =>
      cmd.command.path ? normalizePath(cmd.command.path) === normalized : false,
    );

    if (!matched.length) return;

    const storage = this.resolveDefaultStorage();

    if (!storage) {
      this.logMissingStorage();
      return;
    }

    for (const cmd of matched) {
      await resetByCommand(storage, this.options.keyPrefix, cmd.command.name);
    }

    event.accept();
    event.preventDefault();
  }

  /**
   * Resolve a cached engine instance for a storage backend.
   *
   * @param storage - Storage backend to associate with the engine.
   * @returns Cached engine instance for the storage.
   */
  private getEngine(storage: RateLimitStorage): RateLimitEngine {
    const existing = this.engines.get(storage);
    if (existing) return existing;
    const engine = new RateLimitEngine(storage);
    this.engines.set(storage, engine);
    return engine;
  }

  /**
   * Normalize a storage config into a storage driver instance.
   *
   * @param config - Storage config or driver.
   * @returns Storage driver instance or null when not configured.
   */
  private resolveStorage(
    config?: RateLimitStorageConfig,
  ): RateLimitStorage | null {
    if (!config) return null;
    if ('driver' in config) return config.driver;
    return config;
  }

  /**
   * Resolve the default storage, falling back to memory when enabled.
   *
   * @returns Resolved storage instance or null when disabled.
   */
  private resolveDefaultStorage(): RateLimitStorage | null {
    const resolved =
      this.resolveStorage(this.options.storage) ?? getRateLimitStorage();

    if (resolved) return resolved;
    if (
      this.options.initializeDefaultStorage === false ||
      this.options.initializeDefaultDriver === false
    ) {
      return null;
    }
    return this.memoryStorage;
  }

  /**
   * Log a one-time error when storage is missing.
   *
   * @returns Nothing; logs at most once per process.
   */
  private logMissingStorage(): void {
    if (this.hasLoggedMissingStorage) return;
    this.hasLoggedMissingStorage = true;
    Logger.error(
      '[ratelimit] No storage configured. Set storage via configureRatelimit({ storage }), setRateLimitStorage(), or enable initializeDefaultStorage.',
    );
  }

  /**
   * Emit a ratelimited event through CommandKit's event bus.
   *
   * @param ctx - CommandKit runtime for the active application.
   * @param payload - Rate-limit event payload to emit.
   * @returns Nothing; emits the event when available.
   */
  private emitRateLimited(
    ctx: CommandKitPluginRuntime,
    payload: RateLimitEventPayload,
  ): void {
    ctx.commandkit.events?.to('ratelimits').emit('ratelimited', payload);
  }

  /**
   * Determine whether a source should bypass rate limits.
   *
   * @param source - Interaction or message to evaluate.
   * @returns True when the source should bypass rate limiting.
   */
  private async shouldBypass(source: Interaction | Message): Promise<boolean> {
    const bypass = this.options.bypass;
    if (bypass) {
      /**
       * Check permanent allowlists first to avoid storage lookups.
       */
      const userId =
        source instanceof Message ? source.author.id : source.user?.id;
      if (userId && bypass.userIds?.includes(userId)) return true;

      const guildId = source.guildId ?? null;
      if (guildId && bypass.guildIds?.includes(guildId)) return true;

      const roleIds = getRoleIds(source);
      if (roleIds.length && bypass.roleIds?.length) {
        if (roleIds.some((roleId) => bypass.roleIds!.includes(roleId)))
          return true;
      }
    }

    /**
     * Check temporary exemptions stored in the rate limit storage next.
     */
    if (await this.hasTemporaryBypass(source)) {
      return true;
    }

    /**
     * Run custom predicate last so it can override previous checks.
     */
    if (bypass?.check) {
      return Boolean(await bypass.check(source));
    }

    return false;
  }

  /**
   * Check for temporary exemptions in storage for the source.
   *
   * @param source - Interaction or message to evaluate.
   * @returns True when a temporary exemption is found.
   */
  private async hasTemporaryBypass(
    source: Interaction | Message,
  ): Promise<boolean> {
    const storage = this.resolveDefaultStorage();
    if (!storage) return false;

    const keys = resolveExemptionKeys(source, this.options.keyPrefix);
    if (!keys.length) return false;

    try {
      for (const key of keys) {
        if (await storage.get(key)) return true;
      }
    } catch (error) {
      if (this.options.hooks?.onStorageError) {
        await this.options.hooks.onStorageError(error, false);
      }
      Logger.error`[ratelimit] Storage error during exemption check: ${error}`;
    }

    return false;
  }

  /**
   * Send the default rate-limited response when no custom handler is set.
   *
   * @param env - Command execution environment.
   * @param source - Interaction or message that was limited.
   * @param info - Aggregated rate-limit info for the response.
   * @returns Resolves after the response is sent.
   */
  private async respondRateLimited(
    env: CommandKitEnvironment,
    source: Interaction | Message,
    info: RateLimitStoreValue,
  ) {
    const ctx = env.context;
    if (this.options.onRateLimited && ctx) {
      await this.options.onRateLimited(ctx, info);
      return;
    }

    const retrySeconds = Math.ceil(info.retryAfter / 1000);
    const embed = new EmbedBuilder()
      .setTitle(':hourglass_flowing_sand: You are on cooldown')
      .setDescription(
        `Try again <t:${Math.floor(info.resetAt / 1000)}:R> (in ${retrySeconds}s).`,
      )
      .setColor('Red');

    if (source instanceof Message) {
      if (source.channel?.isSendable()) {
        try {
          await source.reply({ embeds: [embed] });
        } catch (error) {
          Logger.error`[ratelimit] Failed to reply with rate limit embed: ${error}`;
        }
      }
      return;
    }

    if (!source.isRepliable()) return;

    if (source.replied || source.deferred) {
      try {
        await source.followUp({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
      } catch (error) {
        Logger.error`[ratelimit] Failed to follow up with rate limit embed: ${error}`;
      }
      return;
    }

    try {
      await source.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      Logger.error`[ratelimit] Failed to reply with rate limit embed: ${error}`;
    }
  }

  /**
   * Enqueue a command execution for later retry under queue rules.
   *
   * @param params - Queue execution parameters.
   * @returns True when the execution was queued.
   */
  private async enqueueExecution(params: {
    queueKey: string;
    queue: NormalizedQueueOptions;
    initialDelayMs: number;
    source: Interaction | Message;
    execute: () => Promise<any>;
    engine: RateLimitEngine;
    resolvedKeys: ResolvedScopeKey[];
    limiter: RateLimitLimiterConfig;
  }): Promise<boolean> {
    if (!params.queue.enabled) return false;

    const queue = this.getQueue(params.queueKey, params.queue);
    const size = queue.getPending() + queue.getRunning();
    if (size >= params.queue.maxSize) {
      /**
       * Queue full: fall back to immediate rate-limit handling to avoid unbounded growth.
       */
      return false;
    }

    await this.deferInteractionIfNeeded(params.source, params.queue);

    const queuedAt = Date.now();
    const timeoutAt = queuedAt + params.queue.timeoutMs;
    const initialDelay = Math.max(0, params.initialDelayMs);

    void queue
      .add(async () => {
        let delayMs = initialDelay;
        while (true) {
          if (delayMs > 0) {
            await sleep(delayMs);
          }

          if (Date.now() > timeoutAt) {
            Logger.warn(
              `[ratelimit] Queue timeout exceeded for key ${params.queueKey}`,
            );
            return;
          }

          const aggregate = await this.consumeForQueue(
            params.engine,
            params.limiter,
            params.resolvedKeys,
          ).catch(async (error) => {
            if (this.options.hooks?.onStorageError) {
              await this.options.hooks.onStorageError(error, false);
            }
            Logger.error`[ratelimit] Storage error during queued consume: ${error}`;
            return null;
          });

          if (!aggregate) {
            return;
          }

          if (!aggregate.limited) {
            await params.execute();
            return;
          }

          delayMs = Math.max(aggregate.retryAfter, 250);
        }
      })
      .catch((error) => {
        Logger.error`[ratelimit] Queue task failed: ${error}`;
      });

    return true;
  }

  /**
   * Get or create an async queue for the given key.
   *
   * @param key - Queue identifier.
   * @param options - Normalized queue settings.
   * @returns Async queue instance.
   */
  private getQueue(key: string, options: NormalizedQueueOptions): AsyncQueue {
    const existing = this.queues.get(key);
    if (existing) return existing;
    const queue = createAsyncQueue({ concurrency: options.concurrency });
    this.queues.set(key, queue);
    return queue;
  }

  /**
   * Consume limits for queued execution to decide whether to run now.
   *
   * @param engine - Rate limit engine.
   * @param limiter - Resolved limiter configuration.
   * @param resolvedKeys - Scope keys to consume.
   * @returns Aggregated rate-limit info for the queue check.
   */
  private async consumeForQueue(
    engine: RateLimitEngine,
    limiter: RateLimitLimiterConfig,
    resolvedKeys: ResolvedScopeKey[],
  ): Promise<RateLimitStoreValue> {
    const results: RateLimitResult[] = [];
    for (const resolved of resolvedKeys) {
      const resolvedConfigs = resolveLimiterConfigs(limiter, resolved.scope);
      for (const resolvedConfig of resolvedConfigs) {
        const resolvedKey = withWindowSuffix(
          resolved.key,
          resolvedConfig.windowId,
        );
        const output = await engine.consume(resolvedKey, resolvedConfig);
        results.push(output.result);
      }
    }

    return aggregateResults(results);
  }

  /**
   * Defer interaction replies when queueing and the source is repliable.
   *
   * @param source - Interaction or message that may be deferred.
   * @param queue - Normalized queue settings.
   * @returns Resolves after attempting to defer the interaction.
   */
  private async deferInteractionIfNeeded(
    source: Interaction | Message,
    queue: NormalizedQueueOptions,
  ): Promise<void> {
    if (!queue.deferInteraction) return;
    if (source instanceof Message) return;
    if (!source.isRepliable()) return;
    if (source.deferred || source.replied) return;

    try {
      await source.deferReply({
        flags: queue.ephemeral ? MessageFlags.Ephemeral : undefined,
      });
    } catch (error) {
      Logger.debug(
        `[ratelimit] Failed to defer interaction for queued command: ${error}`,
      );
    }
  }
}

interface NormalizedQueueOptions {
  enabled: boolean;
  maxSize: number;
  timeoutMs: number;
  deferInteraction: boolean;
  ephemeral: boolean;
  concurrency: number;
}

/**
 * Normalize scope input into a de-duplicated scope array.
 *
 * @param scope - Scope config value.
 * @returns Array of scopes to enforce.
 */
function normalizeScopes(
  scope: RateLimitLimiterConfig['scope'] | undefined,
): RateLimitScope[] {
  if (!scope) return ['user'];
  if (Array.isArray(scope)) return Array.from(new Set(scope));
  return [scope];
}

/**
 * Aggregate multiple rate-limit results into a single summary object.
 *
 * @param results - Individual limiter/window results.
 * @returns Aggregated rate-limit store value.
 */
function aggregateResults(results: RateLimitResult[]): RateLimitStoreValue {
  if (!results.length) {
    return createEmptyStoreValue();
  }

  const limitedResults = results.filter((r) => r.limited);
  const limited = limitedResults.length > 0;
  const remaining = Math.min(...results.map((r) => r.remaining));
  const resetAt = Math.max(...results.map((r) => r.resetAt));
  const retryAfter = limited
    ? Math.max(...limitedResults.map((r) => r.retryAfter))
    : 0;

  return {
    limited,
    remaining,
    resetAt,
    retryAfter,
    results,
  };
}

/**
 * Append a window suffix to a key when a window id is present.
 *
 * @param key - Base storage key.
 * @param windowId - Optional window identifier.
 * @returns Key with window suffix when provided.
 */
function withWindowSuffix(key: string, windowId?: string): string {
  if (!windowId) return key;
  return `${key}:w:${windowId}`;
}

/**
 * Create an empty aggregate result for cases with no limiter results.
 *
 * @returns Empty rate-limit store value.
 */
function createEmptyStoreValue(): RateLimitStoreValue {
  return {
    limited: false,
    remaining: 0,
    resetAt: 0,
    retryAfter: 0,
    results: [],
  };
}

/**
 * Merge multiple role limit maps, with later maps overriding earlier ones.
 *
 * @param limits - Role limit maps ordered from lowest to highest priority.
 * @returns Merged role limits or undefined when empty.
 */
function mergeRoleLimits(
  ...limits: Array<Record<string, RateLimitLimiterConfig> | undefined>
): Record<string, RateLimitLimiterConfig> | undefined {
  const merged: Record<string, RateLimitLimiterConfig> = {};
  for (const limit of limits) {
    if (!limit) continue;
    Object.assign(merged, limit);
  }
  return Object.keys(merged).length ? merged : undefined;
}

/**
 * Resolve a role-specific limiter for a source using a strategy.
 *
 * @param limits - Role limit map keyed by role id.
 * @param strategy - Role limit strategy to apply.
 * @param source - Interaction or message to resolve roles from.
 * @returns Resolved role limiter or null when none match.
 */
function resolveRoleLimit(
  limits: Record<string, RateLimitLimiterConfig> | undefined,
  strategy: RateLimitRoleLimitStrategy | undefined,
  source: Interaction | Message,
): RateLimitLimiterConfig | null {
  if (!limits) return null;
  const roleIds = getRoleIds(source);
  if (!roleIds.length) return null;

  const entries = Object.entries(limits).filter(([roleId]) =>
    roleIds.includes(roleId),
  );
  if (!entries.length) return null;

  const resolvedStrategy = strategy ?? 'highest';
  if (resolvedStrategy === 'first') {
    return entries[0]?.[1] ?? null;
  }

  const scored = entries.map(([, limiter]) => ({
    limiter,
    score: computeLimiterScore(limiter),
  }));

  scored.sort((a, b) => {
    if (resolvedStrategy === 'lowest') {
      return a.score - b.score;
    }
    return b.score - a.score;
  });

  return scored[0]?.limiter ?? null;
}

/**
 * Compute a comparable score for a limiter for role-strategy sorting.
 *
 * @param limiter - Limiter configuration to score.
 * @returns Minimum request rate across windows.
 */
function computeLimiterScore(limiter: RateLimitLimiterConfig): number {
  const resolvedConfigs = resolveLimiterConfigs(limiter, 'user');
  if (!resolvedConfigs.length) return 0;
  const scores = resolvedConfigs.map(
    (resolved) => resolved.maxRequests / resolved.intervalMs,
  );
  return Math.min(...scores);
}

/**
 * Merge and normalize queue options across config layers.
 *
 * @param options - Queue option layers ordered from lowest to highest priority.
 * @returns Normalized queue options.
 */
function resolveQueueOptions(
  ...options: Array<RateLimitQueueOptions | undefined>
): NormalizedQueueOptions {
  const merged = options.reduce<RateLimitQueueOptions>(
    (acc, opt) => ({ ...acc, ...(opt ?? {}) }),
    {},
  );
  const hasConfig = options.some((opt) => opt != null);
  const enabled = merged.enabled ?? hasConfig;

  return {
    enabled,
    maxSize: clampAtLeast(merged.maxSize ?? 3, 1),
    timeoutMs: clampAtLeast(resolveDuration(merged.timeout, 30_000), 1),
    deferInteraction: merged.deferInteraction !== false,
    ephemeral: merged.ephemeral !== false,
    concurrency: clampAtLeast(merged.concurrency ?? 1, 1),
  };
}

/**
 * Select the queue key from the result with the longest retry delay.
 *
 * @param results - Rate limit results for the command.
 * @returns Queue key to use for serialization.
 */
function selectQueueKey(results: RateLimitResult[]): string {
  let target: RateLimitResult | undefined;
  for (const result of results) {
    if (!result.limited) continue;
    if (!target || result.retryAfter > target.retryAfter) {
      target = result;
    }
  }
  return (target ?? results[0])?.key ?? 'ratelimit:queue';
}

/**
 * Delay execution for a given duration.
 *
 * @param ms - Delay duration in milliseconds.
 * @returns Promise that resolves after the delay.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reset all rate-limit keys for a specific command name.
 *
 * @param storage - Storage backend to delete from.
 * @param keyPrefix - Optional prefix to prepend to the key.
 * @param commandName - Command name to reset.
 * @returns Resolves after matching keys are deleted.
 */
async function resetByCommand(
  storage: RateLimitStorage,
  keyPrefix: string | undefined,
  commandName: string,
) {
  if (!storage.deleteByPattern) return;
  const prefix = keyPrefix ?? '';
  const pattern = `${prefix}*:${commandName}`;
  await storage.deleteByPattern(pattern);
  await storage.deleteByPattern(`violation:${pattern}`);
  await storage.deleteByPattern(`${pattern}:w:*`);
  await storage.deleteByPattern(`violation:${pattern}:w:*`);
}

/**
 * Normalize path separators to forward slashes for comparisons.
 *
 * @param path - Path to normalize.
 * @returns Normalized path string.
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}
