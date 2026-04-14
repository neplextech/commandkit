import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  Client,
} from 'discord.js';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { CommandKit } from '../../commandkit';
import { Logger } from '../../logger/Logger';
import { AppCommandHandler } from '../handlers/AppCommandHandler';
import { CommandsRouter } from '../router';

const tmpRoots: string[] = [];
const tempBaseDir = join(__dirname, '.tmp');

async function createCommandsFixture(
  files: Array<[relativePath: string, contents?: string]>,
) {
  await mkdir(tempBaseDir, { recursive: true });

  const root = await mkdtemp(join(tempBaseDir, 'hierarchical-registration-'));
  tmpRoots.push(root);

  for (const [relativePath, contents = 'export {};'] of files) {
    const fullPath = join(root, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents);
  }

  return root;
}

function createCommandModule(options: {
  description: string;
  optionTypes?: ApplicationCommandOptionType[];
  metadata?: Record<string, unknown>;
}) {
  return `
export const command = {
  description: ${JSON.stringify(options.description)},
  options: ${JSON.stringify(
    (options.optionTypes ?? []).map((type, index) => ({
      name: index === 0 ? 'reason' : `opt${index}`,
      type,
    })),
  )}
};

${options.metadata ? `export const metadata = ${JSON.stringify(options.metadata)};` : ''}

export async function chatInput() {}
`;
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

  return { client, handler };
}

afterEach(async () => {
  CommandKit.instance = undefined;
  await Promise.all(
    tmpRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('Hierarchical command registration', () => {
  test('registers a hierarchical root as a single Discord chat-input payload', async () => {
    const { client, handler } = await createHandlerWithCommands([
      ['ping.mjs', createCommandModule({ description: 'Ping' })],
      [
        '[admin]/command.mjs',
        'export const command = { description: "Admin" };',
      ],
      [
        '[admin]/{moderation}/group.mjs',
        'export const command = { description: "Moderation" };',
      ],
      [
        '[admin]/{moderation}/ban.subcommand.mjs',
        createCommandModule({
          description: 'Ban',
          optionTypes: [ApplicationCommandOptionType.String],
        }),
      ],
      [
        '[admin]/{moderation}/[kick]/command.mjs',
        createCommandModule({ description: 'Kick' }),
      ],
    ]);

    try {
      const registrationCommands = handler.registrar.getCommandsData();

      expect(registrationCommands).toHaveLength(2);

      const ping = registrationCommands.find((entry) => entry.name === 'ping');
      const admin = registrationCommands.find(
        (entry) => entry.name === 'admin',
      );

      expect(ping?.type).toBe(ApplicationCommandType.ChatInput);
      expect(admin?.type).toBe(ApplicationCommandType.ChatInput);
      expect(admin?.description).toBe('Admin');
      expect(admin?.options).toEqual([
        {
          description: 'Moderation',
          name: 'moderation',
          options: [
            {
              description: 'Ban',
              name: 'ban',
              options: [
                {
                  name: 'reason',
                  type: ApplicationCommandOptionType.String,
                },
              ],
              type: ApplicationCommandOptionType.Subcommand,
            },
            {
              description: 'Kick',
              name: 'kick',
              options: [],
              type: ApplicationCommandOptionType.Subcommand,
            },
          ],
          type: ApplicationCommandOptionType.SubcommandGroup,
        },
      ]);

      expect(
        registrationCommands.find((entry) => entry.name === 'ban'),
      ).toBeUndefined();
      expect(
        registrationCommands.find((entry) => entry.name === 'kick'),
      ).toBeUndefined();

      admin?.__applyId('admin-id');

      const rootNode = handler
        .getHierarchicalNodesArray()
        .find(
          (entry) =>
            (entry.data.command as Record<string, any>).__routeKey === 'admin',
        );

      expect(rootNode?.discordId).toBe('admin-id');
    } finally {
      await client.destroy();
    }
  });

  test('skips hierarchical roots when chat-input leaves use mixed guild scopes', async () => {
    const { client, handler } = await createHandlerWithCommands([
      [
        '[admin]/command.mjs',
        'export const command = { description: "Admin" };',
      ],
      [
        '[admin]/{moderation}/group.mjs',
        'export const command = { description: "Moderation" };',
      ],
      [
        '[admin]/{moderation}/ban.subcommand.mjs',
        createCommandModule({
          description: 'Ban',
          metadata: {
            guilds: ['guild-a'],
          },
        }),
      ],
      [
        '[admin]/{moderation}/[kick]/command.mjs',
        createCommandModule({
          description: 'Kick',
          metadata: {
            guilds: ['guild-b'],
          },
        }),
      ],
    ]);

    const loggerErrorSpy = vi
      .spyOn(Logger, 'error')
      .mockImplementation((() => {}) as any);

    try {
      const registrationCommands = handler.registrar.getCommandsData();

      expect(
        registrationCommands.find((entry) => entry.name === 'admin'),
      ).toBeUndefined();
    } finally {
      loggerErrorSpy.mockRestore();
      await client.destroy();
    }
  });
});
