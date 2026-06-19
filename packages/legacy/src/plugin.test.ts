import { afterEach, describe, expect, test } from 'vitest';
import { ApplicationCommandType } from 'discord.js';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { LegacyHandlerPlugin } from './plugin';
import { loadLegacyCommands } from './loadLegacyCommands';
import { CommandRegistrar, type LoadedCommand } from 'commandkit';

const tmpRoots: string[] = [];
const commandkitBaseDir = join(process.cwd(), 'dist');
const tempBaseDir = join(commandkitBaseDir, '.tmp');

async function createLegacyCommandFixture(
  fileName: string,
  type: ApplicationCommandType,
) {
  await mkdir(tempBaseDir, { recursive: true });
  const root = await mkdtemp(join(tempBaseDir, 'legacy-commands-'));
  tmpRoots.push(root);

  const filePath = join(root, fileName);
  await writeFile(
    filePath,
    `
import { ApplicationCommandType } from 'discord.js';

export const data = {
  name: ${JSON.stringify(fileName.replace(/\.[^.]+$/, ''))},
  type: ApplicationCommandType.${type === ApplicationCommandType.User ? 'User' : 'Message'},
};

export async function run() {
  return ${JSON.stringify(type === ApplicationCommandType.User ? 'user' : 'message')};
}
`,
  );

  return root;
}

async function loadPluginCommands(commandsRoot: string) {
  const registered: LoadedCommand[] = [];
  const plugin = new LegacyHandlerPlugin({
    commandsPath: relative(commandkitBaseDir, commandsRoot).replace(/\\/g, '/'),
    eventsPath: './events',
    validationsPath: './validations',
    skipBuiltInValidations: true,
    devUserIds: [],
    devGuildIds: [],
    devRoleIds: [],
  });

  await (plugin as any).loadCommands(
    {
      commandkit: {
        commandHandler: {
          registerExternalLoadedCommands: async (commands: LoadedCommand[]) => {
            registered.push(...commands);
          },
        },
      },
    },
    [],
  );

  return registered;
}

function createRegistrarData(commands: LoadedCommand[]) {
  const registrar = new CommandRegistrar({
    client: {
      token: 'test-token',
    },
    commandHandler: {
      getCommandsArray: () => commands,
    },
    commandsRouter: null,
    plugins: {
      execute: async () => undefined,
    },
  } as any);

  return registrar.getCommandsData();
}

afterEach(async () => {
  await Promise.all(
    tmpRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('legacy context menu command loading', () => {
  test('maps legacy message context menu commands to modern loaded commands', async () => {
    const root = await createLegacyCommandFixture(
      'inspect-message.mjs',
      ApplicationCommandType.Message,
    );

    const [legacyCommand] = await loadLegacyCommands(root);
    const [loadedCommand] = await loadPluginCommands(root);

    expect(legacyCommand.messageContextMenu).toBeTypeOf('function');
    expect(legacyCommand.userContextMenu).toBeUndefined();
    expect(loadedCommand.data.messageContextMenu).toBeTypeOf('function');
    expect(loadedCommand.data.userContextMenu).toBeUndefined();
  });

  test('maps legacy user context menu commands to modern loaded commands', async () => {
    const root = await createLegacyCommandFixture(
      'inspect-user.mjs',
      ApplicationCommandType.User,
    );

    const [legacyCommand] = await loadLegacyCommands(root);
    const [loadedCommand] = await loadPluginCommands(root);

    expect(legacyCommand.userContextMenu).toBeTypeOf('function');
    expect(legacyCommand.messageContextMenu).toBeUndefined();
    expect(loadedCommand.data.userContextMenu).toBeTypeOf('function');
    expect(loadedCommand.data.messageContextMenu).toBeUndefined();
  });

  test('emits user context menu registration data for legacy loaded commands', async () => {
    const root = await createLegacyCommandFixture(
      'inspect-user.mjs',
      ApplicationCommandType.User,
    );

    const [legacyCommand] = await loadLegacyCommands(root);
    const [loadedCommand] = await loadPluginCommands(root);
    const registrationCommands = createRegistrarData([loadedCommand]);

    expect(registrationCommands).toHaveLength(1);
    expect(registrationCommands[0]).toMatchObject({
      name: 'inspect-user',
      type: ApplicationCommandType.User,
    });
    expect(registrationCommands[0].description).toBeUndefined();
    expect(registrationCommands[0].options).toBeUndefined();
  });

  test('executes the wrapped legacy user context menu runner', async () => {
    const root = await createLegacyCommandFixture(
      'inspect-user.mjs',
      ApplicationCommandType.User,
    );

    const [legacyCommand] = await loadLegacyCommands(root);
    const [loadedCommand] = await loadPluginCommands(root);
    const result = await loadedCommand.data.userContextMenu?.({
      client: {},
      interaction: {},
      commandkit: {},
    } as any);

    expect(result).toBe('user');
  });
});
