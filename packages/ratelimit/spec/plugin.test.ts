/**
 * Plugin integration tests.
 *
 * Uses stubs to keep plugin tests fast and offline.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MessageFlags } from 'discord.js';
import { RateLimitPlugin } from '../src/plugin';
import { MemoryRateLimitStorage } from '../src/storage/memory';
import { RATELIMIT_STORE_KEY } from '../src/constants';
import { setRateLimitRuntime, setRateLimitStorage } from '../src/runtime';
import { configureRatelimit } from '../src/configure';
import {
  createEnv,
  createInteractionStub,
  createPreparedCommand,
  createRuntimeContext,
} from './helpers';
import type { RateLimitStorage } from '../src/types';

afterEach(() => {
  setRateLimitRuntime(null);
  setRateLimitStorage(null as unknown as RateLimitStorage);
  vi.useRealTimers();
});

describe('RateLimitPlugin', () => {
  beforeEach(() => {
    configureRatelimit({});
  });

  test('allows first request and stores result', async () => {
    const storage = new MemoryRateLimitStorage();
    const plugin = new RateLimitPlugin({
      storage,
      defaultLimiter: { maxRequests: 2, interval: 1000 },
    });

    const runtime = createRuntimeContext();
    await plugin.activate(runtime.ctx as any);

    const env = createEnv('ping');
    const interaction = createInteractionStub();
    const prepared = createPreparedCommand({
      name: 'ping',
      metadata: { ratelimit: true },
    });
    const execute = vi.fn(async () => undefined);

    await plugin.executeCommand(
      runtime.ctx as any,
      env as any,
      interaction as any,
      prepared as any,
      execute,
    );

    const stored = env.store.get(RATELIMIT_STORE_KEY);
    expect(stored?.limited).toBe(false);
    expect(interaction.reply).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(runtime.capture).not.toHaveBeenCalled();
  });

  test('replies when limit is exceeded', async () => {
    const storage = new MemoryRateLimitStorage();
    const plugin = new RateLimitPlugin({
      storage,
      defaultLimiter: { maxRequests: 1, interval: 1000 },
    });

    const runtime = createRuntimeContext();
    await plugin.activate(runtime.ctx as any);

    const env = createEnv('ping');
    const interaction = createInteractionStub();
    const prepared = createPreparedCommand({
      name: 'ping',
      metadata: { ratelimit: true },
    });

    await plugin.executeCommand(
      runtime.ctx as any,
      env as any,
      interaction as any,
      prepared as any,
      vi.fn(async () => undefined),
    );

    await plugin.executeCommand(
      runtime.ctx as any,
      env as any,
      interaction as any,
      prepared as any,
      vi.fn(async () => undefined),
    );

    const stored = env.store.get(RATELIMIT_STORE_KEY);
    expect(stored?.limited).toBe(true);
    expect(stored?.retryAfter).toBeGreaterThan(0);
    expect(interaction.reply).toHaveBeenCalledTimes(1);

    const [payload] = interaction.reply.mock.calls[0];
    expect(payload.flags).toBe(MessageFlags.Ephemeral);
    expect(runtime.capture).toHaveBeenCalled();
  });

  test('emits ratelimited event when blocked', async () => {
    const storage = new MemoryRateLimitStorage();
    const plugin = new RateLimitPlugin({
      storage,
      defaultLimiter: { maxRequests: 1, interval: 1000 },
    });

    const runtime = createRuntimeContext();
    await plugin.activate(runtime.ctx as any);

    const env = createEnv('ping');
    const interaction = createInteractionStub();
    const prepared = createPreparedCommand({
      name: 'ping',
      metadata: { ratelimit: true },
    });

    await plugin.executeCommand(
      runtime.ctx as any,
      env as any,
      interaction as any,
      prepared as any,
      vi.fn(async () => undefined),
    );

    await plugin.executeCommand(
      runtime.ctx as any,
      env as any,
      interaction as any,
      prepared as any,
      vi.fn(async () => undefined),
    );

    expect(runtime.eventsTo).toHaveBeenCalledWith('ratelimits');
    expect(runtime.eventsEmit).toHaveBeenCalledTimes(1);
    const [eventName, payload] = runtime.eventsEmit.mock.calls[0];
    expect(eventName).toBe('ratelimited');
    expect(payload.commandName).toBe('ping');
    expect(payload.queued).toBe(false);
    expect(payload.aggregate.limited).toBe(true);
  });

  test('uses followUp when interaction already replied', async () => {
    const storage = new MemoryRateLimitStorage();
    const plugin = new RateLimitPlugin({
      storage,
      defaultLimiter: { maxRequests: 1, interval: 1000 },
    });

    const runtime = createRuntimeContext();
    await plugin.activate(runtime.ctx as any);

    const env = createEnv('ping');
    const interaction = createInteractionStub({ replied: true });
    const prepared = createPreparedCommand({
      name: 'ping',
      metadata: { ratelimit: true },
    });

    await plugin.executeCommand(
      runtime.ctx as any,
      env as any,
      interaction as any,
      prepared as any,
      vi.fn(async () => undefined),
    );

    await plugin.executeCommand(
      runtime.ctx as any,
      env as any,
      interaction as any,
      prepared as any,
      vi.fn(async () => undefined),
    );

    expect(interaction.followUp).toHaveBeenCalledTimes(1);
  });

  test('queues execution when enabled', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const storage = new MemoryRateLimitStorage();
    const plugin = new RateLimitPlugin({
      storage,
      defaultLimiter: { maxRequests: 1, interval: 1000 },
      queue: { enabled: true, timeout: '5s' },
    });

    const runtime = createRuntimeContext();
    await plugin.activate(runtime.ctx as any);

    const env = createEnv('ping');
    const interaction = createInteractionStub();
    const prepared = createPreparedCommand({
      name: 'ping',
      metadata: { ratelimit: true },
    });
    const execute = vi.fn(async () => undefined);

    await plugin.executeCommand(
      runtime.ctx as any,
      env as any,
      interaction as any,
      prepared as any,
      execute,
    );

    await plugin.executeCommand(
      runtime.ctx as any,
      env as any,
      interaction as any,
      prepared as any,
      execute,
    );

    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
    expect(runtime.capture).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1100);

    expect(execute).toHaveBeenCalledTimes(1);
  });

  test('applies role-specific limits', async () => {
    const storage = new MemoryRateLimitStorage();
    const plugin = new RateLimitPlugin({
      storage,
      defaultLimiter: { maxRequests: 2, interval: 1000 },
      roleLimits: {
        'role-1': { maxRequests: 1, interval: 1000 },
      },
      roleLimitStrategy: 'highest',
    });

    const runtime = createRuntimeContext();
    await plugin.activate(runtime.ctx as any);

    const env = createEnv('ping');
    const interaction = createInteractionStub({ roleIds: ['role-1'] });
    const prepared = createPreparedCommand({
      name: 'ping',
      metadata: { ratelimit: true },
    });

    await plugin.executeCommand(
      runtime.ctx as any,
      env as any,
      interaction as any,
      prepared as any,
      vi.fn(async () => undefined),
    );

    await plugin.executeCommand(
      runtime.ctx as any,
      env as any,
      interaction as any,
      prepared as any,
      vi.fn(async () => undefined),
    );

    const stored = env.store.get(RATELIMIT_STORE_KEY);
    expect(stored?.limited).toBe(true);
  });

  test('stores multi-window results', async () => {
    const storage = new MemoryRateLimitStorage();
    const plugin = new RateLimitPlugin({
      storage,
      defaultLimiter: {
        algorithm: 'fixed-window',
        scope: 'user',
        windows: [
          { id: 'short', maxRequests: 2, interval: '1s' },
          { id: 'long', maxRequests: 5, interval: '1m' },
        ],
      },
    });

    const runtime = createRuntimeContext();
    await plugin.activate(runtime.ctx as any);

    const env = createEnv('ping');
    const interaction = createInteractionStub();
    const prepared = createPreparedCommand({
      name: 'ping',
      metadata: { ratelimit: true },
    });

    await plugin.executeCommand(
      runtime.ctx as any,
      env as any,
      interaction as any,
      prepared as any,
      vi.fn(async () => undefined),
    );

    const stored = env.store.get(RATELIMIT_STORE_KEY);
    expect(stored?.results).toHaveLength(2);
    expect(stored?.results?.map((r: any) => r.windowId)).toEqual([
      'short',
      'long',
    ]);
    expect(stored?.remaining).toBe(1);
  });

  test('performHMR resets matching command keys', async () => {
    const storage = new MemoryRateLimitStorage();
    const plugin = new RateLimitPlugin({ storage });

    const commandPath = 'C:/commands/ping.ts';
    const prepared = createPreparedCommand({
      name: 'ping',
      path: commandPath,
      metadata: { ratelimit: true },
    });

    const runtime = createRuntimeContext({ commands: [prepared.command] });
    await plugin.activate(runtime.ctx as any);

    const key = 'rl:user:user-1:ping';
    await storage.set(key, { count: 1 }, 1000);
    await storage.set(`violation:${key}`, { count: 1 }, 1000);
    await storage.set(`${key}:w:short`, { count: 1 }, 1000);

    const event = {
      path: commandPath,
      accept: vi.fn(),
      preventDefault: vi.fn(),
    };

    await plugin.performHMR(runtime.ctx as any, event as any);

    expect(await storage.get(key)).toBeNull();
    expect(await storage.get(`violation:${key}`)).toBeNull();
    expect(await storage.get(`${key}:w:short`)).toBeNull();
    expect(event.accept).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
