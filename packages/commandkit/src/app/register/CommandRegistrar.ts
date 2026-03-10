import { ApplicationCommandType, REST, Routes } from 'discord.js';
import type { CommandKit } from '../../commandkit';
import { CommandData, CommandMetadata } from '../../types';
import { Logger } from '../../logger/Logger';

/**
 * Event object passed to plugins before command registration.
 */
export interface PreRegisterCommandsEvent {
  preventDefault(): void;
  commands: CommandData[];
}

/**
 * Handles registration of Discord application commands (slash commands, context menus).
 */
export class CommandRegistrar {
  /**
   * @private
   * @internal
   */
  private api = new REST();

  /**
   * Creates an instance of CommandRegistrar.
   * @param commandkit The commandkit instance.
   */
  public constructor(public readonly commandkit: CommandKit) {
    this.api.setToken(
      this.commandkit.client.token ??
        process.env.DISCORD_TOKEN ??
        process.env.TOKEN ??
        '',
    );
  }

  /**
   * Gets the commands data, consuming pre-generated context menu entries when available.
   */
  public getCommandsData(): (CommandData & {
    __metadata?: CommandMetadata;
    __applyId(id: string): void;
  })[] {
    const handler = this.commandkit.commandHandler;
    const commands = handler.getCommandsArray();
    const commandIds = new Set(commands.map((command) => command.command.id));

    return commands.flatMap((cmd) => {
      const isPreGeneratedCtx =
        cmd.command.id.endsWith('::user-ctx') ||
        cmd.command.id.endsWith('::message-ctx');

      const json: CommandData =
        'toJSON' in cmd.data.command
          ? cmd.data.command.toJSON()
          : cmd.data.command;

      const __metadata = cmd.metadata ?? cmd.data.metadata;
      const isContextMenuType =
        json.type === ApplicationCommandType.User ||
        json.type === ApplicationCommandType.Message;
      const applyId = (id: string) => {
        cmd.discordId = id;
      };

      // Pre-generated context menu commands are already fully formed (#558)
      if (isPreGeneratedCtx || isContextMenuType) {
        return [
          {
            ...json,
            __metadata,
            __applyId: applyId,
          },
        ];
      }

      const collections: (CommandData & {
        __metadata?: CommandMetadata;
        __applyId(id: string): void;
      })[] = [];
      const hasPreGeneratedUserContextMenu = commandIds.has(
        `${cmd.command.id}::user-ctx`,
      );
      const hasPreGeneratedMessageContextMenu = commandIds.has(
        `${cmd.command.id}::message-ctx`,
      );

      if (cmd.data.chatInput) {
        collections.push({
          ...json,
          type: ApplicationCommandType.ChatInput,
          description: json.description ?? 'No command description set.',
          __metadata,
          __applyId: applyId,
        });
      }

      // Fall back to runtime generation for externally injected loaded commands
      // that dont have pre-generated context menu siblings in the cache.
      if (cmd.data.userContextMenu && !hasPreGeneratedUserContextMenu) {
        collections.push({
          ...json,
          name: __metadata?.nameAliases?.user ?? json.name,
          type: ApplicationCommandType.User,
          options: undefined,
          description_localizations: undefined,
          description: undefined,
          __metadata,
          __applyId: applyId,
        });
      }

      if (cmd.data.messageContextMenu && !hasPreGeneratedMessageContextMenu) {
        collections.push({
          ...json,
          name: __metadata?.nameAliases?.message ?? json.name,
          type: ApplicationCommandType.Message,
          description_localizations: undefined,
          description: undefined,
          options: undefined,
          __metadata,
          __applyId: applyId,
        });
      }

      return collections;
    });
  }

  /**
   * Registers loaded commands.
   */
  public async register() {
    const commands = this.getCommandsData();

    let preRegistrationPrevented = false;
    const preRegisterEvent: PreRegisterCommandsEvent = {
      preventDefault() {
        preRegistrationPrevented = true;
      },
      commands,
    };

    await this.commandkit.plugins.execute(async (ctx, plugin) => {
      if (preRegistrationPrevented) return;
      return plugin.onBeforeRegisterCommands(ctx, preRegisterEvent);
    });

    if (preRegistrationPrevented) return;

    // we check this after the plugin event
    // because plugins may be able to register commands
    // before the client is ready
    if (!this.commandkit.client.isReady()) {
      throw new Error('Cannot register commands before the client is ready');
    }

    const guildCommands = commands
      .filter((command) => command.__metadata?.guilds?.filter(Boolean).length)
      .map((c) => ({
        ...c,
        guilds: Array.from(new Set(c.__metadata?.guilds?.filter(Boolean))),
      }));

    const globalCommands = commands.filter(
      (command) => !command.__metadata?.guilds?.filter(Boolean).length,
    );

    await this.updateGlobalCommands(globalCommands);
    await this.updateGuildCommands(guildCommands);
  }

  /**
   * Updates the global commands.
   */
  public async updateGlobalCommands(
    commands: (CommandData & {
      __metadata?: CommandMetadata;
      __applyId(id: string): void;
    })[],
  ) {
    if (!commands.length) return;

    let prevented = false;
    const preRegisterEvent: PreRegisterCommandsEvent = {
      preventDefault() {
        prevented = true;
      },
      commands,
    };

    await this.commandkit.plugins.execute(async (ctx, plugin) => {
      if (prevented) return;
      return plugin.onBeforeRegisterGlobalCommands(ctx, preRegisterEvent);
    });

    try {
      const data = (await this.api.put(
        Routes.applicationCommands(this.commandkit.client.user!.id),
        {
          body: commands.map((c) => ({
            ...c,
            __metadata: undefined,
            __applyId: undefined,
          })),
        },
      )) as (CommandData & { id: string })[];

      // inject the command id into the command
      data.forEach((c) => {
        if (!c.id) return;
        const cmd = commands.find(
          (co) => co.name === c.name && co.type === c.type,
        );
        if (!cmd) return;
        cmd.__applyId?.(c.id);
      });

      Logger.info(
        `✨ Refreshed ${data.length} global application (/) commands`,
      );
    } catch (e) {
      Logger.error`Failed to update global application (/) commands: ${e}`;
    }
  }

  /**
   * Updates the guild commands.
   */
  public async updateGuildCommands(
    commands: (CommandData & {
      __metadata?: CommandMetadata;
      __applyId(id: string): void;
    })[],
  ) {
    if (!commands.length) return;

    let prevented = false;
    const preRegisterEvent: PreRegisterCommandsEvent = {
      preventDefault() {
        prevented = true;
      },
      commands,
    };
    await this.commandkit.plugins.execute(async (ctx, plugin) => {
      if (prevented) return;
      return plugin.onBeforePrepareGuildCommandsRegistration(
        ctx,
        preRegisterEvent,
      );
    });
    if (prevented) return;

    try {
      const guildCommandsMap = new Map<string, CommandData[]>();

      commands.forEach((command) => {
        if (!command.__metadata?.guilds?.length) return;

        command.__metadata?.guilds?.forEach((guild) => {
          if (!guildCommandsMap.has(guild)) {
            guildCommandsMap.set(guild, []);
          }

          guildCommandsMap.get(guild)!.push(command);
        });
      });

      if (!guildCommandsMap.size) return;

      let count = 0;

      for (const [guild, guildCommands] of guildCommandsMap) {
        let prevented = false;
        const preRegisterEvent: PreRegisterCommandsEvent = {
          preventDefault() {
            prevented = true;
          },
          commands: guildCommands,
        };

        await this.commandkit.plugins.execute(async (ctx, plugin) => {
          if (prevented) return;
          return plugin.onBeforeRegisterGuildCommands(ctx, preRegisterEvent);
        });

        if (prevented) continue;

        const data = (await this.api.put(
          Routes.applicationGuildCommands(
            this.commandkit.client.user!.id,
            guild,
          ),
          {
            body: guildCommands.map((b) => ({
              ...b,
              __metadata: undefined,
              __applyId: undefined,
            })),
          },
        )) as (CommandData & { id: string })[];

        data.forEach((c) => {
          if (!c.id) return;
          const cmd = commands.find(
            (co) => co.name === c.name && co.type === c.type,
          );
          if (!cmd) return;
          cmd.__applyId?.(c.id);
        });

        count += data.length;
      }

      Logger.info(`✨ Refreshed ${count} guild application (/) commands`);
    } catch (e) {
      Logger.error`Failed to update guild application (/) commands: ${e}`;
    }
  }
}
