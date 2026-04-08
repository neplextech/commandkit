import { afterEach, describe, expect, test } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { CommandsRouter } from '../src/app/router/CommandsRouter';

const tmpRoots: string[] = [];
const tempBaseDir = join(__dirname, '.tmp');

function normalizePath(path: string) {
  return path.replace(/\\/g, '/');
}

async function createCommandsFixture(
  files: Array<[relativePath: string, contents?: string]>,
) {
  await mkdir(tempBaseDir, { recursive: true });

  const root = await mkdtemp(join(tempBaseDir, 'commands-router-'));
  tmpRoots.push(root);

  for (const [relativePath, contents = 'export {};'] of files) {
    const fullPath = join(root, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents);
  }

  return root;
}

afterEach(async () => {
  await Promise.all(
    tmpRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('CommandsRouter', () => {
  test('discovers flat commands, nested categories, and current middleware ordering', async () => {
    const entrypoint = await createCommandsFixture([
      ['_ignored.ts'],
      ['+global-middleware.ts'],
      ['ping.ts'],
      ['(General)/+middleware.ts'],
      ['(General)/+pong.middleware.ts'],
      ['(General)/pong.ts'],
      ['(General)/(Animals)/+middleware.ts'],
      ['(General)/(Animals)/cat.ts'],
    ]);

    const router = new CommandsRouter({ entrypoint });
    const result = await router.scan();
    const commands = Object.values(result.commands);
    const middlewares = result.middlewares;

    expect(commands).toHaveLength(3);

    const byName = Object.fromEntries(
      commands.map((command) => [command.name, command]),
    );

    expect(byName.ping.category).toBeNull();
    expect(byName.pong.category).toBe('General');
    expect(byName.cat.category).toBe('General:Animals');

    const middlewarePathsFor = (commandName: 'ping' | 'pong' | 'cat') => {
      return byName[commandName].middlewares.map((id) => {
        return normalizePath(middlewares[id].relativePath);
      });
    };

    expect(middlewarePathsFor('ping')).toEqual(['/+global-middleware.ts']);
    expect(middlewarePathsFor('pong')).toEqual([
      '/+global-middleware.ts',
      '/(General)/+middleware.ts',
      '/(General)/+pong.middleware.ts',
    ]);

    // Current behavior is same-directory only for directory middleware.
    expect(middlewarePathsFor('cat')).toEqual([
      '/+global-middleware.ts',
      '/(General)/(Animals)/+middleware.ts',
    ]);
  });
});
