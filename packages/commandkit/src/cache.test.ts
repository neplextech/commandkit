// @ts-nocheck
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import {
  $ckitiucw as cache,
  cacheTag,
  cacheLife,
  MemoryCache,
  isCachedFunction,
  revalidateTag,
  getCacheProvider,
  setCacheProvider,
} from '@commandkit/cache';
import { CommandKit } from 'commandkit';
import { setTimeout } from 'node:timers/promises';
import { Client } from 'discord.js';

describe('Cache', () => {
  let commandkit!: CommandKit, client!: Client;

  beforeAll(async () => {
    setCacheProvider(new MemoryCache());

    client = new Client({
      intents: [],
    });

    commandkit = new CommandKit({
      client,
    });
  });

  afterAll(async () => {
    await client.destroy();
    await getCacheProvider()?.clear();
    commandkit = null!;
    client = null!;
  });

  test('Creates a cached function', async () => {
    const fn = cache(async () => Math.random());

    expect(isCachedFunction(fn)).toBe(true);
  });

  test('Creates a cached function with directive', async () => {
    const fn = async () => {
      'use cache';
      return Math.random();
    };

    expect(isCachedFunction(fn)).toBe(true);
  });

  test('Cache directive works with multiple function types', async () => {
    const fn = async () => {
      'use cache';
      return Math.random();
    };

    async function fn2() {
      'use cache';
      return Math.random();
    }

    const fn3 = async function () {
      'use cache';
      return Math.random();
    };

    const obj = {
      fn: async () => {
        'use cache';
        return Math.random();
      },
      async fn2() {
        'use cache';
        return Math.random();
      },
    };

    expect(isCachedFunction(fn)).toBe(true);
    expect(isCachedFunction(fn2)).toBe(true);
    expect(isCachedFunction(fn3)).toBe(true);
    expect(isCachedFunction(obj.fn)).toBe(true);
    expect(isCachedFunction(obj.fn2)).toBe(true);
  });

  test('Should cache the result', async () => {
    const fn = cache(async () => Math.random());

    const result = await fn();
    const result2 = await fn();

    expect(result).toBe(result2);
  });

  test('Should cache the result with directive', async () => {
    const fn = async () => {
      'use cache';
      return Math.random();
    };

    const result = await fn();
    const result2 = await fn();

    expect(result).toBe(result2);
  });

  test('Should apply cache tag', async () => {
    async function fn(name: string) {
      'use cache';

      cacheTag(name);

      return Math.random();
    }

    expect(await fn('issac')).toBe(await fn('issac'));
    expect(await fn('john')).toBe(await fn('john'));
    expect(await fn('issac')).not.toBe(await fn('john'));
  });

  test('Should apply cache life', async () => {
    // same as above but uses cacheLife with `1s` ttl and tests if it expires
    async function fn(name: string) {
      'use cache';

      cacheTag(name);
      cacheLife('1s');

      return Math.random();
    }

    const old = await fn('issac');

    expect(old).toBe(await fn('issac'));

    await setTimeout(1500);

    expect(old).not.toBe(await fn('issac'));
  });

  test('Should handle errors in cached functions', async () => {
    const fn = cache(async () => {
      throw new Error('Test error');
    });

    await expect(fn()).rejects.toThrow('Test error');
    await expect(fn()).rejects.toThrow('Test error');
  });

  test('Should handle undefined and null values', async () => {
    const fn1 = cache(async () => undefined);
    const fn2 = cache(async () => null);

    expect(await fn1()).toBe(await fn1());
    expect(await fn2()).toBe(await fn2());
  });

  test('Should expire cache with zero lifetime', async () => {
    async function fn() {
      'use cache';
      cacheLife('0s');
      return Math.random();
    }

    const result1 = await fn();
    await setTimeout(100);
    const result2 = await fn();

    expect(result1).not.toBe(result2);
  });

  test('Should invalidate cache using tag', async () => {
    async function fn() {
      'use cache';
      cacheTag('test-invalidate');
      return Math.random();
    }

    const result1 = await fn();
    expect(await fn()).toBe(result1);

    await revalidateTag('test-invalidate');
    expect(await fn()).not.toBe(result1);
  });

  test('Should revalidate cache using tag', async () => {
    async function fn(multiplier: number) {
      'use cache';
      cacheTag('test-revalidate');
      return Math.random() * multiplier;
    }

    const result1 = await fn(1);
    expect(await fn(1)).toBe(result1);

    await revalidateTag('test-revalidate');
    expect(await fn(2)).not.toBe(result1);
  });

  test('Should cache with multiple arguments', async () => {
    const fn = cache(async (a: number, b: string) => {
      return Math.random() + a + b;
    });

    const result1 = await fn(1, 'test');
    const result2 = await fn(1, 'test');
    const result3 = await fn(2, 'test');

    expect(result1).toBe(result2);
    expect(result1).not.toBe(result3);
  });

  test('Should throw when using cacheTag outside cached function', async () => {
    expect(() => cacheTag('test')).toThrow(
      'must be called inside a cached function',
    );
  });

  test('Should throw when using cacheLife outside cached function', async () => {
    expect(() => cacheLife('1m')).toThrow(
      'must be called inside a cached function',
    );
  });

  test('Should handle different TTL formats', async () => {
    const fn = async (id: string) => {
      'use cache';
      cacheLife('100ms');
      return Math.random();
    };

    const fn2 = async (id: string) => {
      'use cache';
      cacheLife(100); // numeric milliseconds
      return Math.random();
    };

    const r1 = await fn('test');
    const r2 = await fn2('test');

    await setTimeout(150);

    expect(await fn('test')).not.toBe(r1);
    expect(await fn2('test')).not.toBe(r2);
  });

  test('Should cache complex return types', async () => {
    interface ComplexType {
      data: { nested: number[] };
      timestamp: Date;
    }

    const fn = cache(
      async (): Promise<ComplexType> => ({
        data: { nested: [Math.random()] },
        timestamp: new Date(),
      }),
    );

    const result1 = await fn();
    const result2 = await fn();

    expect(result1).toEqual(result2);
    expect(result1.data.nested[0]).toBe(result2.data.nested[0]);
  });

  test('Should work with both cacheTag and cacheLife together', async () => {
    async function fn(id: string) {
      'use cache';
      cacheTag(`test-combined-${id}`);
      cacheLife('100ms');
      return Math.random();
    }

    const result1 = await fn('a');
    expect(await fn('a')).toBe(result1);
    expect(await fn('b')).not.toBe(result1);

    await setTimeout(150);
    expect(await fn('a')).not.toBe(result1);
  });

  test('Should keep deterministic cache behavior for use-cache directives', async () => {
    const fn = async () => {
      'use cache';

      return Math.random();
    };

    const result1 = await fn();
    expect(await fn()).toBe(result1);
  });

  test('Should cache multiple arguments without explicit cache controls', async () => {
    const fn = cache(async (a: number, b: string, c: boolean) => {
      return Math.random();
    });

    // Same arguments should return same result
    const result1 = await fn(1, 'test', true);
    expect(await fn(1, 'test', true)).toBe(result1);

    // Different arguments should return different results
    expect(await fn(1, 'test', false)).not.toBe(result1);
    expect(await fn(2, 'test', true)).not.toBe(result1);
    expect(await fn(1, 'other', true)).not.toBe(result1);

    // But calling again with same args should hit cache
    expect(await fn(2, 'test', true)).toBe(await fn(2, 'test', true));
    expect(await fn(1, 'other', true)).toBe(await fn(1, 'other', true));
  });
});
