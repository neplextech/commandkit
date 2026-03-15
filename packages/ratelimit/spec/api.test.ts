/**
 * API helper tests.
 *
 * Uses in-memory storage to keep exemption/reset tests isolated.
 */

import { afterEach, describe, expect, test } from 'vitest';
import { MemoryRateLimitStorage } from '../src/storage/memory';
import {
  grantRateLimitExemption,
  listRateLimitExemptions,
  resetAllRateLimits,
  resetRateLimit,
  revokeRateLimitExemption,
} from '../src/api';
import { setRateLimitRuntime, setRateLimitStorage } from '../src/runtime';
import type { RateLimitRuntimeContext, RateLimitStorage } from '../src/types';
import { buildExemptionKey } from '../src/utils/keys';

/**
 * Configure runtime + storage for API helpers under test.
 */
function setRuntime(storage: RateLimitStorage) {
  setRateLimitStorage(storage);
  const runtime: RateLimitRuntimeContext = {
    storage,
    defaultLimiter: {},
  };
  setRateLimitRuntime(runtime);
}

afterEach(() => {
  setRateLimitRuntime(null);
  setRateLimitStorage(null as unknown as RateLimitStorage);
});

describe('ratelimit API', () => {
  test('grant/list/revoke exemptions', async () => {
    const storage = new MemoryRateLimitStorage();
    setRuntime(storage);

    await grantRateLimitExemption({
      scope: 'user',
      id: 'user-1',
      duration: '1h',
    });

    const list = await listRateLimitExemptions({ scope: 'user', id: 'user-1' });
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('user-1');

    await revokeRateLimitExemption({ scope: 'user', id: 'user-1' });
    const after = await listRateLimitExemptions({
      scope: 'user',
      id: 'user-1',
    });
    expect(after).toHaveLength(0);
  });

  test('resetRateLimit removes violations and window variants', async () => {
    const storage = new MemoryRateLimitStorage();
    setRuntime(storage);

    const key = 'rl:user:user-1:ping';
    await storage.set(key, { count: 1 }, 1000);
    await storage.set(`violation:${key}`, { count: 1 }, 1000);
    await storage.set(`${key}:w:short`, { count: 1 }, 1000);
    await storage.set(`violation:${key}:w:short`, { count: 1 }, 1000);

    await resetRateLimit({ key });

    expect(await storage.get(key)).toBeNull();
    expect(await storage.get(`violation:${key}`)).toBeNull();
    expect(await storage.get(`${key}:w:short`)).toBeNull();
    expect(await storage.get(`violation:${key}:w:short`)).toBeNull();
  });

  test('resetAllRateLimits supports commandName pattern deletes', async () => {
    const storage = new MemoryRateLimitStorage();
    setRuntime(storage);

    const keys = [
      'rl:user:user-1:ping',
      'rl:user:user-2:ping',
      'rl:user:user-3:pong',
    ];

    for (const key of keys) {
      await storage.set(key, { count: 1 }, 1000);
    }

    await resetAllRateLimits({ commandName: 'ping' });

    expect(await storage.get('rl:user:user-1:ping')).toBeNull();
    expect(await storage.get('rl:user:user-2:ping')).toBeNull();
    expect(await storage.get('rl:user:user-3:pong')).not.toBeNull();
  });

  test('resetAllRateLimits throws when pattern deletes are unsupported', async () => {
    const storage: RateLimitStorage = {
      get: async () => null,
      set: async () => undefined,
      delete: async () => undefined,
    };

    setRuntime(storage);

    await expect(resetAllRateLimits({ commandName: 'ping' })).rejects.toThrow(
      'Storage does not support pattern deletes',
    );
  });

  test('throws when storage is missing', async () => {
    setRateLimitRuntime(null);
    setRateLimitStorage(null as unknown as RateLimitStorage);

    await expect(
      grantRateLimitExemption({
        scope: 'user',
        id: 'user-1',
        duration: '1h',
      }),
    ).rejects.toThrow('Rate limit storage not configured');
  });

  test('listRateLimitExemptions uses prefix listing', async () => {
    const storage = new MemoryRateLimitStorage();
    setRuntime(storage);

    const keyPrefix = 'custom:';
    const userKey = buildExemptionKey('user', 'user-1', keyPrefix);
    const guildKey = buildExemptionKey('guild', 'guild-1', keyPrefix);

    await storage.set(userKey, true, 1000);
    await storage.set(guildKey, true, 1000);

    const list = await listRateLimitExemptions({ keyPrefix });
    expect(list.map((entry) => entry.key).sort()).toEqual(
      [guildKey, userKey].sort(),
    );
  });
});
