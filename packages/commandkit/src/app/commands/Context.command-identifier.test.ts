import { afterEach, describe, expect, test } from 'vitest';
import { Client, Collection, Message } from 'discord.js';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { CommandKit } from '../../commandkit';
import { CommandExecutionMode, Context } from './Context';
import { AppCommandHandler } from '../handlers/AppCommandHandler';
import { CommandsRouter } from '../router';

const tmpRoots: string[] = [];
const tempBaseDir = join(__dirname, '.tmp');

async function createCommandsFixture(
  files: Array<[relativePath: string, contents?: string]>,
) {
  await mkdir(tempBaseDir, { recursive: true });

  const root = await mkdtemp(join(tempBaseDir, 'context-command-identifier-'));
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
    channel: null;
    channelId: string;
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
    channel: {
      value: null,
      writable: true,
    },
    channelId: {
      value: 'channel-1',
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

async function createContextForMessage(
  content: string,
  prefixes: string[],
  files: Array<[relativePath: string, contents?: string]>,
  commandOverride?: string,
) {
  CommandKit.instance = undefined;

  const entrypoint = await createCommandsFixture(files);
  const client = new Client({ intents: [] });
  const commandkit = new CommandKit({ client });
  const handler = new AppCommandHandler(commandkit);
  const router = new CommandsRouter({ entrypoint });
  const message = createMessage(content);

  commandkit.commandHandler = handler;
  commandkit.commandsRouter = router;
  commandkit.appConfig.getMessageCommandPrefix = () => prefixes;

  await router.scan();
  await handler.loadCommands();

  const prepared = await handler.prepareCommandRun(message, commandOverride);

  if (!prepared) {
    throw new Error(`Expected prepared command for message: ${content}`);
  }

  const context = new Context(commandkit, {
    command: prepared.command,
    executionMode: CommandExecutionMode.Message,
    interaction: null as never,
    message,
    messageCommandParser: prepared.messageCommandParser as never,
  });

  return { client, context };
}

afterEach(async () => {
  CommandKit.instance = undefined;
  await Promise.all(
    tmpRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('Context.getCommandIdentifier', () => {
  test('returns the canonical identifier for message commands across supported prefixes', async () => {
    const files: Array<[string, string]> = [
      [
        'ping.mjs',
        `
export const command = { description: 'Ping' };
export const metadata = { aliases: ['p'] };
export async function message() {}
`,
      ],
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
export async function message() {}
`,
      ],
    ];

    const bang = await createContextForMessage('!ping', ['!'], files);
    const multi = await createContextForMessage('??ping', ['??'], files);
    const mention = await createContextForMessage(
      '<@123>ping',
      ['<@123>'],
      files,
    );
    const alias = await createContextForMessage('!p', ['!'], files, 'p');
    const hierarchical = await createContextForMessage(
      '!admin:moderation:ban',
      ['!'],
      files,
    );

    try {
      expect(bang.context.getCommandIdentifier()).toBe('ping');
      expect(multi.context.getCommandIdentifier()).toBe('ping');
      expect(mention.context.getCommandIdentifier()).toBe('ping');
      expect(alias.context.getCommandIdentifier()).toBe('ping');
      expect(hierarchical.context.getCommandIdentifier()).toBe(
        'admin.moderation.ban',
      );
    } finally {
      await Promise.all([
        bang.client.destroy(),
        multi.client.destroy(),
        mention.client.destroy(),
        alias.client.destroy(),
        hierarchical.client.destroy(),
      ]);
    }
  });
});
