import { afterEach, describe, expect, test } from 'vitest';
import {
  Client,
  Collection,
  Interaction,
  Message,
  type ApplicationCommandOptionType,
} from 'discord.js';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { CommandKit } from '../../commandkit';
import { AppCommandHandler } from './AppCommandHandler';
import { CommandsRouter } from '../router';

const tmpRoots: string[] = [];
const tempBaseDir = join(__dirname, '.tmp');

async function createCommandsFixture(
  files: Array<[relativePath: string, contents?: string]>,
) {
  await mkdir(tempBaseDir, { recursive: true });

  const root = await mkdtemp(join(tempBaseDir, 'hierarchical-handler-'));
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

  return { client, commandkit, handler, router };
}

afterEach(async () => {
  CommandKit.instance = undefined;
  await Promise.all(
    tmpRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('Hierarchical command runtime loading', () => {
  test('loads hierarchical executable leaves into the runtime index while preserving flat commands', async () => {
    const commandModule = (
      description: string,
      options: ApplicationCommandOptionType[] = [],
    ) => `
export const command = {
  description: ${JSON.stringify(description)},
  options: ${JSON.stringify(
    options.map((type, index) => ({
      name: index === 0 ? 'reason' : `opt${index}`,
      type,
    })),
  )}
};

export async function chatInput() {}
export async function message() {}
`;

    const { client, handler } = await createHandlerWithCommands([
      ['+global-middleware.mjs', 'export function beforeExecute() {}'],
      ['ping.mjs', commandModule('Ping')],
      [
        '[admin]/command.mjs',
        'export const command = { description: "Admin" };',
      ],
      ['[admin]/+middleware.mjs', 'export function beforeExecute() {}'],
      [
        '[admin]/{moderation}/group.mjs',
        'export const command = { description: "Moderation" };',
      ],
      [
        '[admin]/{moderation}/+middleware.mjs',
        'export function beforeExecute() {}',
      ],
      [
        '[admin]/{moderation}/+ban.middleware.mjs',
        'export function beforeExecute() {}',
      ],
      [
        '[admin]/{moderation}/ban.subcommand.mjs',
        commandModule('Ban', [3 as ApplicationCommandOptionType]),
      ],
      ['[admin]/{moderation}/[kick]/command.mjs', commandModule('Kick')],
    ]);

    try {
      // Public command list remains flat for now until registrar support lands.
      expect(
        handler.getCommandsArray().map((command) => command.command.name),
      ).toEqual(['ping']);

      const runtimeRouteKeys = handler
        .getRuntimeCommandsArray()
        .map((command) => {
          return (command.data.command as Record<string, any>).__routeKey;
        });

      expect(runtimeRouteKeys).toHaveLength(3);
      expect(runtimeRouteKeys).toEqual(
        expect.arrayContaining([
          'ping',
          'admin.moderation.ban',
          'admin.moderation.kick',
        ]),
      );

      const preparedFlat = await handler.prepareCommandRun(
        createChatInputInteraction('ping'),
      );
      expect(preparedFlat?.command.data.command.name).toBe('ping');

      const preparedHierarchical = await handler.prepareCommandRun(
        createChatInputInteraction('admin', {
          subcommand: 'ban',
          subcommandGroup: 'moderation',
        }),
      );

      expect(
        (preparedHierarchical?.command.data.command as Record<string, any>)
          .__routeKey,
      ).toBe('admin.moderation.ban');
      expect(preparedHierarchical?.command.data.message).toBeTypeOf('function');
      expect(
        preparedHierarchical?.middlewares.map((middleware) => {
          return middleware.middleware.relativePath.replace(/\\/g, '/');
        }),
      ).toEqual([
        '/+global-middleware.mjs',
        '/[admin]/{moderation}/+middleware.mjs',
        '/[admin]/{moderation}/+ban.middleware.mjs',
        '',
      ]);

      const preparedByOverride = await handler.prepareCommandRun(
        createChatInputInteraction('admin'),
        'admin:moderation:kick',
      );
      expect(
        (preparedByOverride?.command.data.command as Record<string, any>)
          .__routeKey,
      ).toBe('admin.moderation.kick');

      const preparedMessage = await handler.prepareCommandRun(
        createMessage('!admin:moderation:ban reason:spam'),
      );
      expect(
        (preparedMessage?.command.data.command as Record<string, any>)
          .__routeKey,
      ).toBe('admin.moderation.ban');
      expect(preparedMessage?.messageCommandParser?.getCommand()).toBe('admin');
      expect(preparedMessage?.messageCommandParser?.getSubcommandGroup()).toBe(
        'moderation',
      );
      expect(preparedMessage?.messageCommandParser?.getSubcommand()).toBe(
        'ban',
      );
    } finally {
      await client.destroy();
    }
  });
});
