import { afterEach, describe, expect, test } from 'vitest';
import { ApplicationCommandType, Client } from 'discord.js';
import { join } from 'node:path';
import { CommandKit } from '../src/commandkit';
import {
  AppCommandHandler,
  type LoadedCommand,
} from '../src/app/handlers/AppCommandHandler';
import { CommandRegistrar } from '../src/app/register/CommandRegistrar';
import type { Command } from '../src/app/router/CommandsRouter';
import type { CommandMetadata } from '../src/types';

const fixturesDir = join(__dirname, 'fixtures');
const noop = async () => {};
const slowTestTimeout = 20_000;

function createCommandFixture(fileName: string, name: string): Command {
  return {
    id: crypto.randomUUID(),
    name,
    path: join(fixturesDir, fileName),
    relativePath: `\\${fileName}`,
    parentPath: fixturesDir,
    middlewares: [],
    category: null,
  };
}

async function createHandler() {
  CommandKit.instance = undefined;

  const client = new Client({ intents: [] });
  const commandkit = new CommandKit({ client });
  const handler = new AppCommandHandler(commandkit);

  commandkit.commandHandler = handler;

  return { client, commandkit, handler };
}

async function loadFixtureCommand(
  handler: AppCommandHandler,
  fileName: string,
  name: string,
) {
  const command = createCommandFixture(fileName, name);

  await (handler as any).loadCommand(command.id, command);

  return command;
}

afterEach(async () => {
  CommandKit.instance = undefined;
});

describe('Context menu registration', () => {
  test(
    'pre-generates context menu commands in the handler cache',
    async () => {
      const { client, handler } = await createHandler();

      try {
        const command = await loadFixtureCommand(
          handler,
          'context-menu-command.mjs',
          'report',
        );
        const loadedCommands = handler.getCommandsArray();

        expect(loadedCommands).toHaveLength(3);

        const baseCommand = loadedCommands.find(
          (entry) => entry.command.id === command.id,
        );
        const userContextMenu = loadedCommands.find(
          (entry) => entry.command.id === `${command.id}::user-ctx`,
        );
        const messageContextMenu = loadedCommands.find(
          (entry) => entry.command.id === `${command.id}::message-ctx`,
        );

        expect(baseCommand?.data.command.name).toBe('report');
        expect(baseCommand?.data.command.type).toBeUndefined();

        expect(userContextMenu?.data.command.name).toBe('Report User');
        expect(userContextMenu?.data.command.type).toBe(
          ApplicationCommandType.User,
        );
        expect(userContextMenu?.data.command.description).toBeUndefined();
        expect(userContextMenu?.data.command.options).toBeUndefined();

        expect(messageContextMenu?.data.command.name).toBe('Report Message');
        expect(messageContextMenu?.data.command.type).toBe(
          ApplicationCommandType.Message,
        );
        expect(messageContextMenu?.data.command.description).toBeUndefined();
        expect(messageContextMenu?.data.command.options).toBeUndefined();
      } finally {
        await client.destroy();
      }
    },
    slowTestTimeout,
  );

  test(
    'keeps alias metadata resolvable after context menu pre-generation',
    async () => {
      const { client, handler } = await createHandler();

      try {
        await loadFixtureCommand(handler, 'context-menu-command.mjs', 'report');

        expect(handler.getMetadataFor('Report User', 'user')).toMatchObject({
          nameAliases: {
            user: 'Report User',
            message: 'Report Message',
          },
        });

        expect(
          handler.getMetadataFor('Report Message', 'message'),
        ).toMatchObject({
          nameAliases: {
            user: 'Report User',
            message: 'Report Message',
          },
        });
      } finally {
        await client.destroy();
      }
    },
    slowTestTimeout,
  );

  test(
    'registers pre-generated context menu commands without duplication',
    async () => {
      const { client, handler } = await createHandler();

      try {
        const command = await loadFixtureCommand(
          handler,
          'context-menu-command.mjs',
          'report',
        );
        const registrationCommands = handler.registrar.getCommandsData();

        expect(registrationCommands).toHaveLength(3);

        const slashCommand = registrationCommands.find(
          (entry) => entry.type === ApplicationCommandType.ChatInput,
        );
        const userContextMenu = registrationCommands.find(
          (entry) => entry.type === ApplicationCommandType.User,
        );
        const messageContextMenu = registrationCommands.find(
          (entry) => entry.type === ApplicationCommandType.Message,
        );

        expect(slashCommand?.name).toBe('report');
        expect(userContextMenu?.name).toBe('Report User');
        expect(messageContextMenu?.name).toBe('Report Message');

        expect(userContextMenu?.description).toBeUndefined();
        expect(userContextMenu?.options).toBeUndefined();
        expect(messageContextMenu?.description).toBeUndefined();
        expect(messageContextMenu?.options).toBeUndefined();

        expect(userContextMenu?.__metadata?.nameAliases?.user).toBe(
          'Report User',
        );
        expect(messageContextMenu?.__metadata?.nameAliases?.message).toBe(
          'Report Message',
        );

        slashCommand?.__applyId('slash-id');
        userContextMenu?.__applyId('user-id');
        messageContextMenu?.__applyId('message-id');

        const loadedCommands = handler.getCommandsArray();

        expect(
          loadedCommands.find((entry) => entry.command.id === command.id)
            ?.discordId,
        ).toBe('slash-id');
        expect(
          loadedCommands.find(
            (entry) => entry.command.id === `${command.id}::user-ctx`,
          )?.discordId,
        ).toBe('user-id');
        expect(
          loadedCommands.find(
            (entry) => entry.command.id === `${command.id}::message-ctx`,
          )?.discordId,
        ).toBe('message-id');
      } finally {
        await client.destroy();
      }
    },
    slowTestTimeout,
  );

  test(
    'falls back to generating context menu payloads for external loaded commands',
    async () => {
      const { client, commandkit } = await createHandler();

      try {
        const metadata: CommandMetadata = {
          nameAliases: {
            user: 'Inspect User',
            message: 'Inspect Message',
          },
        };

        const externalCommand: LoadedCommand = {
          discordId: null,
          command: createCommandFixture('external-command.mjs', 'inspect'),
          metadata,
          data: {
            command: {
              name: 'inspect',
              description: 'Inspect content from a context menu command.',
            },
            metadata,
            userContextMenu: noop,
            messageContextMenu: noop,
          },
        };

        commandkit.commandHandler = {
          getCommandsArray: () => [externalCommand],
        } as AppCommandHandler;

        const registrationCommands = new CommandRegistrar(
          commandkit,
        ).getCommandsData();

        expect(registrationCommands).toHaveLength(2);
        expect(
          registrationCommands.every(
            (entry) => entry.type !== ApplicationCommandType.ChatInput,
          ),
        ).toBe(true);

        const userContextMenu = registrationCommands.find(
          (entry) => entry.type === ApplicationCommandType.User,
        );
        const messageContextMenu = registrationCommands.find(
          (entry) => entry.type === ApplicationCommandType.Message,
        );

        expect(userContextMenu?.name).toBe('Inspect User');
        expect(messageContextMenu?.name).toBe('Inspect Message');
        expect(userContextMenu?.description).toBeUndefined();
        expect(messageContextMenu?.description).toBeUndefined();
      } finally {
        await client.destroy();
      }
    },
    slowTestTimeout,
  );

  test(
    'registers pre-generated context-menu-only commands without slash payloads',
    async () => {
      const { client, handler } = await createHandler();

      try {
        await loadFixtureCommand(
          handler,
          'context-menu-only-command.mjs',
          'inspect',
        );

        const registrationCommands = handler.registrar.getCommandsData();

        expect(registrationCommands).toHaveLength(2);
        expect(
          registrationCommands.every(
            (entry) => entry.type !== ApplicationCommandType.ChatInput,
          ),
        ).toBe(true);
        expect(registrationCommands.map((entry) => entry.name).sort()).toEqual([
          'Inspect Message',
          'Inspect User',
        ]);
      } finally {
        await client.destroy();
      }
    },
    slowTestTimeout,
  );
});
