// Test helpers for ratelimit specs.
//
// Provides lightweight stubs for Discord and CommandKit so tests stay focused
// on rate limit behavior without a live client.

import { Collection, Message } from 'discord.js';
import { vi } from 'vitest';
import type { Interaction } from 'discord.js';

export interface InteractionStubOptions {
  userId?: string;
  guildId?: string | null;
  channelId?: string | null;
  parentId?: string | null;
  replied?: boolean;
  deferred?: boolean;
  roleIds?: string[];
}

/**
 * Build an Interaction-like stub with only the fields the plugin reads.
 * Keeps tests fast without a live Discord client.
 */
export function createInteractionStub(options: InteractionStubOptions = {}) {
  const interaction = {
    reply: vi.fn(async () => undefined),
    followUp: vi.fn(async () => undefined),
    deferReply: vi.fn(async () => undefined),
    isRepliable: vi.fn(() => true),
    replied: options.replied ?? false,
    deferred: options.deferred ?? false,
    user: { id: options.userId ?? 'user-1' },
    guildId: options.guildId ?? 'guild-1',
    channelId: options.channelId ?? 'channel-1',
    channel: { parentId: options.parentId ?? 'category-1' },
    member: options.roleIds ? { roles: options.roleIds } : null,
  } as Interaction & {
    reply: ReturnType<typeof vi.fn>;
    followUp: ReturnType<typeof vi.fn>;
    deferReply: ReturnType<typeof vi.fn>;
    isRepliable: ReturnType<typeof vi.fn>;
    replied: boolean;
    deferred: boolean;
    user: { id: string } | null;
    guildId: string | null;
    channelId: string | null;
    channel: { parentId: string | null } | null;
    member: { roles: string[] } | null;
  };

  return interaction;
}

export interface MessageStubOptions {
  userId?: string;
  guildId?: string | null;
  channelId?: string | null;
  parentId?: string | null;
  roleIds?: string[];
}

/**
 * Build a Message-like stub with minimal fields used by rate limit logic.
 */
export function createMessageStub(options: MessageStubOptions = {}) {
  const message = Object.create(Message.prototype) as Message & {
    reply: ReturnType<typeof vi.fn>;
    author: { id: string } | null;
    guildId: string | null;
    channelId: string | null;
    channel: { parentId: string | null; isSendable: () => boolean } | null;
    member: { roles: string[] } | null;
  };

  message.reply = vi.fn(async () => undefined);
  message.author = { id: options.userId ?? 'user-1' };
  message.guildId = options.guildId ?? 'guild-1';
  message.channelId = options.channelId ?? 'channel-1';
  message.channel = {
    parentId: options.parentId ?? 'category-1',
    isSendable: () => true,
  };
  message.member = options.roleIds ? { roles: options.roleIds } : null;

  return message;
}

/**
 * Create a minimal CommandKit env with a store for plugin results.
 */
export function createEnv(commandName = 'ping') {
  return {
    context: { commandName },
    store: new Collection(),
  } as const;
}

/**
 * Create a runtime context with stubbed analytics and capture hooks.
 */
export function createRuntimeContext(
  overrides: {
    commands?: any[];
  } = {},
) {
  const analyticsTrack = vi.fn(async () => undefined);
  const capture = vi.fn();
  const eventsEmit = vi.fn();
  const eventsTo = vi.fn(() => ({ emit: eventsEmit }));

  const commandkit = {
    analytics: { track: analyticsTrack },
    commandHandler: {
      getCommandsArray: () => overrides.commands ?? [],
    },
    events: {
      to: eventsTo,
    },
  };

  return {
    ctx: { commandkit, capture },
    analyticsTrack,
    capture,
    eventsEmit,
    eventsTo,
  };
}

/**
 * Build a prepared command shape for plugin tests.
 */
export function createPreparedCommand(options: {
  name?: string;
  metadata?: any;
  path?: string;
}) {
  const name = options.name ?? 'ping';
  return {
    command: {
      discordId: null,
      command: {
        id: 'cmd-1',
        name,
        path: options.path ?? 'C:/commands/ping.ts',
        relativePath: 'ping.ts',
        parentPath: 'C:/commands',
        middlewares: [],
        category: null,
      },
      metadata: options.metadata ?? {},
      data: {
        command: { name },
        metadata: options.metadata ?? {},
      },
    },
    middlewares: [],
  } as const;
}
