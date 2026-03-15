/**
 * Key construction helpers.
 *
 * Builds consistent storage keys for scopes and exemptions across
 * message and interaction sources so limits remain comparable.
 */

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

/**
 * Apply an optional prefix to a storage key.
 *
 * @param prefix - Optional prefix to prepend.
 * @param key - Base key to prefix.
 * @returns Prefixed key.
 */
function applyPrefix(prefix: string | undefined, key: string): string {
  if (!prefix) return key;
  return `${prefix}${key}`;
}

/**
 * Resolve a user id from a message or interaction.
 *
 * @param source - Interaction or message source.
 * @returns User id or null when unavailable.
 */
function getUserId(source: Interaction | Message): string | null {
  if (source instanceof Message) return source.author.id;
  return source.user?.id ?? null;
}

/**
 * Resolve a guild id from a message or interaction.
 *
 * @param source - Interaction or message source.
 * @returns Guild id or null when unavailable.
 */
function getGuildId(source: Interaction | Message): string | null {
  if (source instanceof Message) return source.guildId ?? null;
  return source.guildId ?? null;
}

/**
 * Resolve a channel id from a message or interaction.
 *
 * @param source - Interaction or message source.
 * @returns Channel id or null when unavailable.
 */
function getChannelId(source: Interaction | Message): string | null {
  if (source instanceof Message) return source.channelId ?? null;
  return source.channelId ?? null;
}

/**
 * Resolve a parent category id from a channel object.
 *
 * @param channel - Channel object to inspect.
 * @returns Parent id or null when unavailable.
 */
function getParentId(channel: unknown): string | null {
  if (!channel || typeof channel !== 'object') return null;
  if (!('parentId' in channel)) return null;
  const parentId = (channel as { parentId?: string | null }).parentId;
  return parentId ?? null;
}

/**
 * Resolve a category id from a message or interaction.
 *
 * @param source - Interaction or message source.
 * @returns Category id or null when unavailable.
 */
function getCategoryId(source: Interaction | Message): string | null {
  if (source instanceof Message) {
    return getParentId(source.channel);
  }
  return getParentId(source.channel);
}

/**
 * Extract role IDs from a message/interaction for role-based limits.
 *
 * @param source - Interaction or message to read role data from.
 * @returns Array of role IDs for the source, or an empty array.
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
 *
 * @param scope - Exemption scope to encode.
 * @param id - Scope identifier (user, guild, role, etc.).
 * @param keyPrefix - Optional prefix to prepend to the key.
 * @returns Fully-qualified exemption storage key.
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
 *
 * @param keyPrefix - Optional prefix to prepend to the key.
 * @param scope - Optional exemption scope to narrow the prefix.
 * @returns Prefix suitable for storage scans.
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
 *
 * @param key - Exemption key to parse.
 * @param keyPrefix - Optional prefix to strip before parsing.
 * @returns Parsed scope/id pair or null when the key is invalid.
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
 *
 * @param source - Interaction or message to resolve keys for.
 * @param keyPrefix - Optional prefix to prepend to keys.
 * @returns Exemption keys that should be checked for the source.
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
 *
 * @param params - Inputs required to resolve the scope key.
 * @returns Resolved scope key or null when required identifiers are missing.
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
 *
 * @param params - Inputs required to resolve all scope keys.
 * @returns Array of resolved scope keys.
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
 *
 * @param scope - Scope to build the prefix for.
 * @param keyPrefix - Optional prefix to prepend to the key.
 * @param identifiers - Identifiers required for the scope.
 * @returns Prefix string or null when identifiers are missing.
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
