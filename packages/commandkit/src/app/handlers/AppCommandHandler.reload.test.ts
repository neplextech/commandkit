import { afterEach, describe, expect, test } from 'vitest';
import { Client, Collection, Interaction, Message } from 'discord.js';
import {
  mkdir,
  mkdtemp,
  rename,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { HMREventChangeType } from '../../utils/constants';
import { CommandKit } from '../../commandkit';
import {
  AppCommandHandler,
  PreparedAppCommandExecution,
} from './AppCommandHandler';
import { CommandsRouter } from '../router';

const tmpRoots: string[] = [];
const tempBaseDir = join(__dirname, '.tmp');

async function createCommandsFixture(
  files: Array<[relativePath: string, contents?: string]>,
) {
  await mkdir(tempBaseDir, { recursive: true });

  const root = await mkdtemp(join(tempBaseDir, 'reload-commands-'));
  tmpRoots.push(root);

  for (const [relativePath, contents = 'export {};'] of files) {
    const fullPath = join(root, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents);
  }

  return root;
}

function createMessage(content: string) {
  const message = Object.create(Message.prototype) as Message & {
    attachments: Collection<string, unknown>;
    author: { bot: boolean };
    guild: null;
    guildId: string;
    mentions: {
      channels: Collection<string, unknown>;
      roles: Collection<string, unknown>;
      users: Collection<string, unknown>;
    };
  };

  Object.defineProperties(message, {
    attachments: {
      value: new Collection(),
      writable: true,
    },
    author: {
      value: { bot: false },
      writable: true,
    },
    content: {
      value: content,
      writable: true,
    },
    guild: {
      value: null,
      writable: true,
    },
    guildId: {
      value: 'guild-1',
      writable: true,
    },
    mentions: {
      value: {
        channels: new Collection(),
        roles: new Collection(),
        users: new Collection(),
      },
      writable: true,
    },
  });

  return message;
}

function createChatInputInteraction(
  commandName: string,
  options?: {
    subcommandGroup?: string;
    subcommand?: string;
  },
) {
  return {
    commandName,
    guildId: 'guild-1',
    isAutocomplete: () => false,
    isChatInputCommand: () => true,
    isCommand: () => true,
    isContextMenuCommand: () => false,
    isMessageContextMenuCommand: () => false,
    isUserContextMenuCommand: () => false,
    options: {
      getSubcommand: (_required?: boolean) => options?.subcommand,
      getSubcommandGroup: (_required?: boolean) => options?.subcommandGroup,
    },
  } as unknown as Interaction;
}

async function createHandlerWithCommands(
  files: Array<[relativePath: string, contents?: string]>,
) {
  CommandKit.instance = undefined;

  const entrypoint = await createCommandsFixture(files);
  const client = new Client({ intents: [] });
  const commandkit = new CommandKit({ client });
  const handler = new AppCommandHandler(commandkit);
  const router = new CommandsRouter({ entrypoint });

  commandkit.commandHandler = handler;
  commandkit.commandsRouter = router;

  await router.scan();
  await handler.loadCommands();

  return { client, handler, entrypoint };
}

function getNonPermissionMiddlewarePaths(
  prepared: PreparedAppCommandExecution | null,
) {
  return (prepared?.middlewares ?? [])
    .map((middleware) => middleware.middleware.relativePath.replace(/\\/g, '/'))
    .filter(Boolean);
}

afterEach(async () => {
  CommandKit.instance = undefined;
  await Promise.all(
    tmpRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('AppCommandHandler.reloadCommands', () => {
  test('rescans flat commands and middleware before rebuilding runtime caches', async () => {
    const { client, handler, entrypoint } = await createHandlerWithCommands([
      ['+global-middleware.mjs', 'export function beforeExecute() {}'],
      [
        'ping.mjs',
        `
export const command = { description: 'Ping' };
export async function chatInput() {}
export async function message() {}
`,
      ],
    ]);

    try {
      expect(
        handler
          .getRuntimeCommandsArray()
          .map((command) => command.command.name),
      ).toEqual(['ping']);

      await writeFile(
        join(entrypoint, 'pong.mjs'),
        `
export const command = { description: 'Pong' };
export async function chatInput() {}
export async function message() {}
`,
      );
      await writeFile(
        join(entrypoint, '+ping.middleware.mjs'),
        'export function beforeExecute() {}',
      );

      await handler.reloadCommands();

      expect(
        handler
          .getRuntimeCommandsArray()
          .map((command) => command.command.name)
          .sort(),
      ).toEqual(['ping', 'pong']);

      const pingAfterAdd = await handler.prepareCommandRun(
        createMessage('!ping'),
      );
      expect(getNonPermissionMiddlewarePaths(pingAfterAdd)).toEqual([
        '/+global-middleware.mjs',
        '/+ping.middleware.mjs',
      ]);

      await unlink(join(entrypoint, '+ping.middleware.mjs'));
      await rename(join(entrypoint, 'ping.mjs'), join(entrypoint, 'pang.mjs'));
      await writeFile(
        join(entrypoint, '+pang.middleware.mjs'),
        'export function beforeExecute() {}',
      );

      await handler.reloadCommands();

      expect(
        handler
          .getRuntimeCommandsArray()
          .map((command) => command.command.name)
          .sort(),
      ).toEqual(['pang', 'pong']);
      expect(
        await handler.prepareCommandRun(createMessage('!ping')),
      ).toBeNull();

      const pangAfterRename = await handler.prepareCommandRun(
        createMessage('!pang'),
      );
      expect(getNonPermissionMiddlewarePaths(pangAfterRename)).toEqual([
        '/+global-middleware.mjs',
        '/+pang.middleware.mjs',
      ]);
    } finally {
      await client.destroy();
    }
  });

  test('rescans hierarchical leaves after additions and removals', async () => {
    const { client, handler, entrypoint } = await createHandlerWithCommands([
      ['+global-middleware.mjs', 'export function beforeExecute() {}'],
      [
        '[admin]/command.mjs',
        `export const command = { description: 'Admin' };`,
      ],
      [
        '[admin]/{moderation}/group.mjs',
        `export const command = { description: 'Moderation' };`,
      ],
      [
        '[admin]/{moderation}/ban.subcommand.mjs',
        `
export const command = { description: 'Ban' };
export async function chatInput() {}
export async function message() {}
`,
      ],
    ]);

    try {
      expect(
        handler.getRuntimeCommandsArray().map((command) => {
          return (command.data.command as Record<string, any>).__routeKey;
        }),
      ).toEqual(['admin.moderation.ban']);

      await mkdir(join(entrypoint, '[admin]', '{moderation}', '[kick]'), {
        recursive: true,
      });
      await writeFile(
        join(entrypoint, '[admin]', '{moderation}', '[kick]', 'command.mjs'),
        `
export const command = { description: 'Kick' };
export async function chatInput() {}
export async function message() {}
`,
      );

      await handler.reloadCommands();

      expect(
        handler
          .getRuntimeCommandsArray()
          .map((command) => {
            return (command.data.command as Record<string, any>).__routeKey;
          })
          .sort(),
      ).toEqual(['admin.moderation.ban', 'admin.moderation.kick']);

      await unlink(
        join(entrypoint, '[admin]', '{moderation}', 'ban.subcommand.mjs'),
      );

      await handler.reloadCommands();

      expect(
        handler.getRuntimeCommandsArray().map((command) => {
          return (command.data.command as Record<string, any>).__routeKey;
        }),
      ).toEqual(['admin.moderation.kick']);

      const removedBan = await handler.prepareCommandRun(
        createChatInputInteraction('admin', {
          subcommandGroup: 'moderation',
          subcommand: 'ban',
        }),
      );
      expect(removedBan).toBeNull();
    } finally {
      await client.destroy();
    }
  });

  test('uses incremental command router reconciliation when enabled', async () => {
    const { client, handler, entrypoint } = await createHandlerWithCommands([
      [
        '[admin]/command.mjs',
        `export const command = { description: 'Admin' };`,
      ],
      [
        '[admin]/{moderation}/group.mjs',
        `export const command = { description: 'Moderation' };`,
      ],
      [
        '[admin]/{moderation}/ban.subcommand.mjs',
        `
export const command = { description: 'Ban' };
export async function chatInput() {}
`,
      ],
      [
        '[tools]/command.mjs',
        `
export const command = { description: 'Tools' };
export async function chatInput() {}
`,
      ],
    ]);

    try {
      handler.commandkit.config.experimental.incrementalRouter = true;

      await unlink(
        join(entrypoint, '[admin]', '{moderation}', 'ban.subcommand.mjs'),
      );

      await handler.reloadCommands(
        join(entrypoint, '[admin]', '{moderation}', 'ban.subcommand.mjs'),
        HMREventChangeType.Unlink,
      );

      expect(
        handler
          .getRuntimeCommandsArray()
          .map(
            (command) =>
              (command.data.command as Record<string, any>).__routeKey,
          )
          .sort(),
      ).toEqual(['tools']);
    } finally {
      await client.destroy();
    }
  });
});
