// Key construction helpers.
//
// Builds consistent storage keys for scopes and exemptions across
// message and interaction sources so limits remain comparable.

import { Message } from 'discord.js';
import type { Interaction } from 'discord.js';
import type { Context } from 'commandkit';
import type { LoadedCommand } from 'commandkit';
import type {
  RateLimitExemptionScope,
  RateLimitKeyResolver,
  RateLimitScope,
} from '../types';
import { RATE_LIMIT_EXEMPTION_SCOPES } from '../types';
import { DEFAULT_KEY_PREFIX } from '../constants';

/**
 * Inputs for resolving a scope-based key from a command/source.
 */
export interface ResolveScopeKeyParams {
  ctx: Context;
  source: Interaction | Message;
  command: LoadedCommand;
  scope: RateLimitScope;
  keyPrefix?: string;
  keyResolver?: RateLimitKeyResolver;
}

/**
 * Resolved key paired with its scope for aggregation.
 */
export interface ResolvedScopeKey {
  scope: RateLimitScope;
  key: string;
}

function applyPrefix(prefix: string | undefined, key: string): string {
  if (!prefix) return key;
  return `${prefix}${key}`;
}

function getUserId(source: Interaction | Message): string | null {
  if (source instanceof Message) return source.author.id;
  return source.user?.id ?? null;
}

function getGuildId(source: Interaction | Message): string | null {
  if (source instanceof Message) return source.guildId ?? null;
  return source.guildId ?? null;
}

function getChannelId(source: Interaction | Message): string | null {
  if (source instanceof Message) return source.channelId ?? null;
  return source.channelId ?? null;
}

function getParentId(channel: unknown): string | null {
  if (!channel || typeof channel !== 'object') return null;
  if (!('parentId' in channel)) return null;
  const parentId = (channel as { parentId?: string | null }).parentId;
  return parentId ?? null;
}

function getCategoryId(source: Interaction | Message): string | null {
  if (source instanceof Message) {
    return getParentId(source.channel);
  }
  return getParentId(source.channel);
}

/**
 * Extract role IDs from a message/interaction for role-based limits.
 */
export function getRoleIds(source: Interaction | Message): string[] {
  const roles = source.member?.roles;
  if (!roles) return [];
  if (Array.isArray(roles)) return roles;
  if ('cache' in roles) {
    return roles.cache.map((role) => role.id);
  }
  return [];
}

/**
 * Build a storage key for a temporary exemption entry.
 */
export function buildExemptionKey(
  scope: RateLimitExemptionScope,
  id: string,
  keyPrefix?: string,
): string {
  const prefix = keyPrefix ?? '';
  return applyPrefix(prefix, `${DEFAULT_KEY_PREFIX}exempt:${scope}:${id}`);
}

/**
 * Build a prefix for scanning exemption keys in storage.
 */
export function buildExemptionPrefix(
  keyPrefix?: string,
  scope?: RateLimitExemptionScope,
): string {
  const prefix = keyPrefix ?? '';
  const base = `${DEFAULT_KEY_PREFIX}exempt:`;
  if (!scope) return applyPrefix(prefix, base);
  return applyPrefix(prefix, `${base}${scope}:`);
}

/**
 * Parse an exemption key into scope and ID for listing.
 */
export function parseExemptionKey(
  key: string,
  keyPrefix?: string,
): { scope: RateLimitExemptionScope; id: string } | null {
  const prefix = keyPrefix ?? '';
  const base = `${prefix}${DEFAULT_KEY_PREFIX}exempt:`;
  if (!key.startsWith(base)) return null;
  const rest = key.slice(base.length);
  const [scope, ...idParts] = rest.split(':');
  if (!scope || idParts.length === 0) return null;
  if (!RATE_LIMIT_EXEMPTION_SCOPES.includes(scope as RateLimitExemptionScope)) {
    return null;
  }
  return { scope: scope as RateLimitExemptionScope, id: idParts.join(':') };
}

/**
 * Resolve all exemption keys that could apply to a source.
 */
export function resolveExemptionKeys(
  source: Interaction | Message,
  keyPrefix?: string,
): string[] {
  const keys: string[] = [];

  const userId = getUserId(source);
  if (userId) {
    keys.push(buildExemptionKey('user', userId, keyPrefix));
  }

  const guildId = getGuildId(source);
  if (guildId) {
    keys.push(buildExemptionKey('guild', guildId, keyPrefix));
  }

  const channelId = getChannelId(source);
  if (channelId) {
    keys.push(buildExemptionKey('channel', channelId, keyPrefix));
  }

  const categoryId = getCategoryId(source);
  if (categoryId) {
    keys.push(buildExemptionKey('category', categoryId, keyPrefix));
  }

  const roleIds = getRoleIds(source);
  for (const roleId of roleIds) {
    keys.push(buildExemptionKey('role', roleId, keyPrefix));
  }

  return keys;
}

/**
 * Resolve the storage key for a single scope.
 */
export function resolveScopeKey({
  ctx,
  source,
  command,
  scope,
  keyPrefix,
  keyResolver,
}: ResolveScopeKeyParams): ResolvedScopeKey | null {
  const prefix = keyPrefix ?? '';
  const commandName = ctx.commandName || command.command.name;

  switch (scope) {
    case 'user': {
      const userId = getUserId(source);
      if (!userId) return null;
      return {
        scope,
        key: applyPrefix(
          prefix,
          `${DEFAULT_KEY_PREFIX}user:${userId}:${commandName}`,
        ),
      };
    }
    case 'guild': {
      const guildId = getGuildId(source);
      if (!guildId) return null;
      return {
        scope,
        key: applyPrefix(
          prefix,
          `${DEFAULT_KEY_PREFIX}guild:${guildId}:${commandName}`,
        ),
      };
    }
    case 'channel': {
      const channelId = getChannelId(source);
      if (!channelId) return null;
      return {
        scope,
        key: applyPrefix(
          prefix,
          `${DEFAULT_KEY_PREFIX}channel:${channelId}:${commandName}`,
        ),
      };
    }
    case 'global': {
      return {
        scope,
        key: applyPrefix(prefix, `${DEFAULT_KEY_PREFIX}global:${commandName}`),
      };
    }
    case 'user-guild': {
      const userId = getUserId(source);
      const guildId = getGuildId(source);
      if (!userId || !guildId) return null;
      return {
        scope,
        key: applyPrefix(
          prefix,
          `${DEFAULT_KEY_PREFIX}user:${userId}:guild:${guildId}:${commandName}`,
        ),
      };
    }
    case 'custom': {
      if (!keyResolver) return null;
      const customKey = keyResolver(ctx, command, source);
      if (!customKey) return null;
      return {
        scope,
        key: applyPrefix(prefix, customKey),
      };
    }
    default:
      return null;
  }
}

/**
 * Resolve keys for multiple scopes, dropping unresolvable ones.
 */
export function resolveScopeKeys(
  params: Omit<ResolveScopeKeyParams, 'scope'> & {
    scopes: RateLimitScope[];
  },
): ResolvedScopeKey[] {
  const results: ResolvedScopeKey[] = [];
  for (const scope of params.scopes) {
    const resolved = resolveScopeKey({ ...params, scope });
    if (resolved) results.push(resolved);
  }
  return results;
}

/**
 * Build a prefix for resets by scope/identifier.
 */
export function buildScopePrefix(
  scope: RateLimitScope,
  keyPrefix: string | undefined,
  identifiers: {
    userId?: string;
    guildId?: string;
    channelId?: string;
    commandName?: string;
  },
): string | null {
  const prefix = keyPrefix ?? '';
  switch (scope) {
    case 'user':
      return identifiers.userId
        ? applyPrefix(
            prefix,
            `${DEFAULT_KEY_PREFIX}user:${identifiers.userId}:`,
          )
        : null;
    case 'guild':
      return identifiers.guildId
        ? applyPrefix(
            prefix,
            `${DEFAULT_KEY_PREFIX}guild:${identifiers.guildId}:`,
          )
        : null;
    case 'channel':
      return identifiers.channelId
        ? applyPrefix(
            prefix,
            `${DEFAULT_KEY_PREFIX}channel:${identifiers.channelId}:`,
          )
        : null;
    case 'global':
      return applyPrefix(prefix, `${DEFAULT_KEY_PREFIX}global:`);
    case 'user-guild':
      return identifiers.userId && identifiers.guildId
        ? applyPrefix(
            prefix,
            `${DEFAULT_KEY_PREFIX}user:${identifiers.userId}:guild:${identifiers.guildId}:`,
          )
        : null;
    case 'custom':
      return null;
    default:
      return null;
  }
}
