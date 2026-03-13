// Public rate limit helpers.
//
// Used by handlers and admin tools to inspect, reset, and manage exemptions.

import type { CommandKitEnvironment, Context } from 'commandkit';
import { RATELIMIT_STORE_KEY } from './constants';
import { getRateLimitRuntime, getRateLimitStorage } from './runtime';
import type {
  RateLimitExemptionGrantParams,
  RateLimitExemptionInfo,
  RateLimitExemptionListParams,
  RateLimitExemptionRevokeParams,
  RateLimitScope,
  RateLimitStorage,
  RateLimitStoreValue,
} from './types';
import {
  buildExemptionKey,
  buildExemptionPrefix,
  buildScopePrefix,
  parseExemptionKey,
} from './utils/keys';
import { resolveDuration } from './utils/time';

/**
 * Parameters for resetting a single key or scope-derived key.
 */
export interface ResetRateLimitParams {
  key?: string;
  scope?: RateLimitScope;
  userId?: string;
  guildId?: string;
  channelId?: string;
  commandName?: string;
  keyPrefix?: string;
}

/**
 * Parameters for batch resets by scope, prefix, or pattern.
 */
export interface ResetAllRateLimitsParams {
  scope?: RateLimitScope;
  userId?: string;
  guildId?: string;
  channelId?: string;
  commandName?: string;
  keyPrefix?: string;
  pattern?: string;
  prefix?: string;
}

/**
 * Read aggregated rate limit info stored on a CommandKit env or context.
 */
export function getRateLimitInfo(
  envOrCtx: CommandKitEnvironment | Context | null | undefined,
): RateLimitStoreValue | null {
  if (!envOrCtx) return null;
  const store = 'store' in envOrCtx ? envOrCtx.store : null;
  if (!store) return null;
  return (store.get(RATELIMIT_STORE_KEY) as RateLimitStoreValue) ?? null;
}

function getRequiredStorage(): RateLimitStorage {
  return getRuntimeStorage().storage;
}

function getRuntimeStorage(): {
  runtime: ReturnType<typeof getRateLimitRuntime>;
  storage: RateLimitStorage;
} {
  const runtime = getRateLimitRuntime();
  const storage = runtime?.storage ?? getRateLimitStorage();
  if (!storage) {
    throw new Error('Rate limit storage not configured');
  }
  return { runtime, storage };
}

function toWindowPrefix(prefix: string): string {
  return prefix.endsWith(':') ? `${prefix}w:` : `${prefix}:w:`;
}

/**
 * Reset a single key and its violation/window variants to keep state consistent.
 */
export async function resetRateLimit(
  params: ResetRateLimitParams,
): Promise<void> {
  const storage = getRequiredStorage();
  const hooks = getRateLimitRuntime()?.hooks;

  if (params.key) {
    await storage.delete(params.key);
    await storage.delete(`violation:${params.key}`);
    await deleteWindowVariants(storage, params.key);
    if (hooks?.onReset) {
      await hooks.onReset(params.key);
    }
    return;
  }

  if (!params.scope || !params.commandName) {
    throw new Error(
      'scope and commandName are required when key is not provided',
    );
  }

  const prefix = buildScopePrefix(params.scope, params.keyPrefix, {
    userId: params.userId,
    guildId: params.guildId,
    channelId: params.channelId,
  });

  if (!prefix) {
    throw new Error('Missing identifiers for scope');
  }

  const key = `${prefix}${params.commandName}`;
  await storage.delete(key);
  await storage.delete(`violation:${key}`);
  await deleteWindowVariants(storage, key);
  if (hooks?.onReset) {
    await hooks.onReset(key);
  }
}

/**
 * Reset multiple keys by scope, command name, prefix, or pattern for bulk cleanup.
 */
export async function resetAllRateLimits(
  params: ResetAllRateLimitsParams = {},
): Promise<void> {
  const storage = getRequiredStorage();

  if (params.pattern) {
    if (!storage.deleteByPattern) {
      throw new Error('Storage does not support pattern deletes');
    }
    await storage.deleteByPattern(params.pattern);
    await storage.deleteByPattern(`violation:${params.pattern}`);
    await storage.deleteByPattern(`${params.pattern}:w:*`);
    await storage.deleteByPattern(`violation:${params.pattern}:w:*`);
    return;
  }

  if (params.prefix) {
    if (!storage.deleteByPrefix) {
      throw new Error('Storage does not support prefix deletes');
    }
    const windowPrefix = toWindowPrefix(params.prefix);
    await storage.deleteByPrefix(params.prefix);
    await storage.deleteByPrefix(`violation:${params.prefix}`);
    await storage.deleteByPrefix(windowPrefix);
    await storage.deleteByPrefix(`violation:${windowPrefix}`);
    return;
  }

  if (params.commandName) {
    if (!storage.deleteByPattern) {
      throw new Error('Storage does not support pattern deletes');
    }
    const prefix = params.keyPrefix ?? '';
    const pattern = `${prefix}*:${params.commandName}`;
    await storage.deleteByPattern(pattern);
    await storage.deleteByPattern(`violation:${pattern}`);
    await storage.deleteByPattern(`${pattern}:w:*`);
    await storage.deleteByPattern(`violation:${pattern}:w:*`);
    return;
  }

  if (!params.scope) {
    throw new Error('scope is required when commandName is not provided');
  }

  const scopePrefix = buildScopePrefix(params.scope, params.keyPrefix, {
    userId: params.userId,
    guildId: params.guildId,
    channelId: params.channelId,
  });

  if (!scopePrefix) {
    throw new Error('Missing identifiers for scope');
  }

  if (!storage.deleteByPrefix) {
    throw new Error('Storage does not support prefix deletes');
  }

  const windowPrefix = toWindowPrefix(scopePrefix);
  await storage.deleteByPrefix(scopePrefix);
  await storage.deleteByPrefix(`violation:${scopePrefix}`);
  await storage.deleteByPrefix(windowPrefix);
  await storage.deleteByPrefix(`violation:${windowPrefix}`);
}

/**
 * Grant a temporary exemption for a scope/id pair.
 */
export async function grantRateLimitExemption(
  params: RateLimitExemptionGrantParams,
): Promise<void> {
  const { runtime, storage } = getRuntimeStorage();
  const keyPrefix = params.keyPrefix ?? runtime?.keyPrefix;
  const ttlMs = resolveDuration(params.duration, 0);

  if (!ttlMs || ttlMs <= 0) {
    throw new Error('duration must be a positive value');
  }

  const key = buildExemptionKey(params.scope, params.id, keyPrefix);
  await storage.set(key, true, ttlMs);
}

/**
 * Revoke a temporary exemption for a scope/id pair.
 */
export async function revokeRateLimitExemption(
  params: RateLimitExemptionRevokeParams,
): Promise<void> {
  const { runtime, storage } = getRuntimeStorage();
  const keyPrefix = params.keyPrefix ?? runtime?.keyPrefix;
  const key = buildExemptionKey(params.scope, params.id, keyPrefix);
  await storage.delete(key);
}

/**
 * List exemptions by scope and/or id for admin/reporting.
 */
export async function listRateLimitExemptions(
  params: RateLimitExemptionListParams = {},
): Promise<RateLimitExemptionInfo[]> {
  const { runtime, storage } = getRuntimeStorage();
  const keyPrefix = params.keyPrefix ?? runtime?.keyPrefix;

  if (params.id && !params.scope) {
    throw new Error('scope is required when id is provided');
  }

  if (params.scope && params.id) {
    const key = buildExemptionKey(params.scope, params.id, keyPrefix);
    const exists = await storage.get(key);
    if (!exists) return [];
    const expiresInMs = storage.ttl ? await storage.ttl(key) : null;
    return [
      {
        key,
        scope: params.scope,
        id: params.id,
        expiresInMs,
      },
    ];
  }

  if (!storage.keysByPrefix) {
    throw new Error('Storage does not support listing exemptions');
  }

  const prefix = buildExemptionPrefix(keyPrefix, params.scope);
  const keys = await storage.keysByPrefix(prefix);
  const results: RateLimitExemptionInfo[] = [];

  for (const key of keys) {
    const parsed = parseExemptionKey(key, keyPrefix);
    if (!parsed) continue;
    if (params.scope && parsed.scope !== params.scope) continue;

    const expiresInMs = storage.ttl ? await storage.ttl(key) : null;
    results.push({
      key,
      scope: parsed.scope,
      id: parsed.id,
      expiresInMs,
    });

    if (params.limit && results.length >= params.limit) {
      break;
    }
  }

  return results;
}

async function deleteWindowVariants(
  storage: RateLimitStorage,
  key: string,
): Promise<void> {
  const prefix = `${key}:w:`;
  if (storage.deleteByPrefix) {
    await storage.deleteByPrefix(prefix);
    await storage.deleteByPrefix(`violation:${prefix}`);
    return;
  }
  if (storage.deleteByPattern) {
    await storage.deleteByPattern(`${key}:w:*`);
    await storage.deleteByPattern(`violation:${key}:w:*`);
  }
}
