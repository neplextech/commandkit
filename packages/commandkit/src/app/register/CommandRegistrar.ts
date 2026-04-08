import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  REST,
  Routes,
} from 'discord.js';
import type { CommandKit } from '../../commandkit';
import { CommandData, CommandMetadata } from '../../types';
import { Logger } from '../../logger/Logger';

type RegistrationCommandData = CommandData & {
  __metadata?: CommandMetadata;
  __applyId(id: string): void;
};

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
  public getCommandsData(): RegistrationCommandData[] {
    return [
      ...this.getFlatCommandsData(),
      ...this.getHierarchicalCommandsData(),
    ];
  }

  /**
   * Gets flat command data, consuming pre-generated context menu entries when available.
   */
  private getFlatCommandsData(): RegistrationCommandData[] {
    const handler = this.commandkit.commandHandler;
    const commands = handler.getCommandsArray();
    const commandIds = new Set(commands.map((command) => command.command.id));

    return commands.flatMap((cmd) => {
      const isPreGeneratedCtx =
        cmd.command.id.endsWith('::user-ctx') ||
        cmd.command.id.endsWith('::message-ctx');

      const json = this.sanitizeCommandData(
        'toJSON' in cmd.data.command
          ? cmd.data.command.toJSON()
          : cmd.data.command,
      );

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

      const collections: RegistrationCommandData[] = [];
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
   * Gets hierarchical chat-input command payloads compiled from cached tree nodes.
   */
  private getHierarchicalCommandsData(): RegistrationCommandData[] {
    const router = this.commandkit.commandsRouter;
    if (!router) return [];

    const { treeNodes } = router.getData();
    const hierarchicalNodes = new Map(
      this.commandkit.commandHandler
        .getHierarchicalNodesArray()
        .map((node) => [node.command.id, node] as const),
    );

    const rootNodes = Array.from(treeNodes.values()).filter((node) => {
      return (
        node.source !== 'flat' &&
        node.kind === 'command' &&
        node.route.length === 1
      );
    });

    const commands: RegistrationCommandData[] = [];

    for (const rootNode of rootNodes) {
      const payload = this.buildHierarchicalRootPayload(
        rootNode.id,
        treeNodes,
        hierarchicalNodes,
      );

      if (payload) {
        commands.push(payload);
      }
    }

    return commands;
  }

  /**
   * Removes internal runtime-only fields before Discord registration data is emitted.
   */
  private sanitizeCommandData(command: CommandData | Record<string, any>) {
    const { __routeKey, ...json } = command as Record<string, any>;
    return json as CommandData;
  }

  /**
   * Builds a top-level Discord payload for a hierarchical command root.
   */
  private buildHierarchicalRootPayload(
    rootNodeId: string,
    treeNodes: ReturnType<CommandKit['commandsRouter']['getData']>['treeNodes'],
    hierarchicalNodes: Map<
      string,
      ReturnType<
        CommandKit['commandHandler']['getHierarchicalNodesArray']
      >[number]
    >,
  ): RegistrationCommandData | null {
    const rootNode = treeNodes.get(rootNodeId);
    const rootLoaded = hierarchicalNodes.get(rootNodeId);

    if (!rootNode || !rootLoaded) {
      return null;
    }

    const rootJson = this.sanitizeCommandData(
      'toJSON' in rootLoaded.data.command
        ? rootLoaded.data.command.toJSON()
        : rootLoaded.data.command,
    );

    if (rootNode.executable) {
      if (!rootLoaded.data.chatInput) return null;

      return {
        ...rootJson,
        type: ApplicationCommandType.ChatInput,
        description: rootJson.description ?? 'No command description set.',
        __metadata: rootLoaded.metadata ?? rootLoaded.data.metadata,
        __applyId: (id: string) => {
          rootLoaded.discordId = id;
        },
      };
    }

    const options = rootNode.childIds
      .map((childId) =>
        this.buildHierarchicalOption(childId, treeNodes, hierarchicalNodes),
      )
      .filter(Boolean) as Record<string, any>[];

    if (!options.length) {
      return null;
    }

    const scopeKeys = new Set(
      this.collectHierarchicalGuildScopes(
        rootNode.childIds,
        treeNodes,
        hierarchicalNodes,
      ),
    );

    if (scopeKeys.size > 1) {
      Logger.error(
        `Failed to register hierarchical command "${rootJson.name ?? rootNode.token}": all chat-input leaves under the same root must use the same guild scope in v1.`,
      );
      return null;
    }

    const scopeKey = scopeKeys.values().next().value as string | undefined;
    const scopeGuilds = scopeKey ? scopeKey.split(',').filter(Boolean) : [];
    const metadata = {
      ...(rootLoaded.metadata ?? rootLoaded.data.metadata),
      guilds: scopeGuilds.length ? scopeGuilds : undefined,
    };

    return {
      ...rootJson,
      type: ApplicationCommandType.ChatInput,
      description: rootJson.description ?? 'No command description set.',
      options: options as CommandData['options'],
      __metadata: metadata,
      __applyId: (id: string) => {
        rootLoaded.discordId = id;
      },
    };
  }

  /**
   * Builds a nested subcommand or subcommand-group option from a hierarchical node.
   */
  private buildHierarchicalOption(
    nodeId: string,
    treeNodes: ReturnType<CommandKit['commandsRouter']['getData']>['treeNodes'],
    hierarchicalNodes: Map<
      string,
      ReturnType<
        CommandKit['commandHandler']['getHierarchicalNodesArray']
      >[number]
    >,
  ): Record<string, any> | null {
    const node = treeNodes.get(nodeId);
    const loadedNode = hierarchicalNodes.get(nodeId);

    if (!node || !loadedNode) {
      return null;
    }

    const json = this.sanitizeCommandData(
      'toJSON' in loadedNode.data.command
        ? loadedNode.data.command.toJSON()
        : loadedNode.data.command,
    );

    if (node.kind === 'group') {
      const options = node.childIds
        .map((childId) =>
          this.buildHierarchicalOption(childId, treeNodes, hierarchicalNodes),
        )
        .filter(Boolean) as Record<string, any>[];

      if (!options.length) {
        return null;
      }

      return {
        ...json,
        type: ApplicationCommandOptionType.SubcommandGroup,
        description: json.description ?? 'No command description set.',
        options: options as CommandData['options'],
      };
    }

    if (!node.executable || !loadedNode.data.chatInput) {
      return null;
    }

    return {
      ...json,
      type: ApplicationCommandOptionType.Subcommand,
      description: json.description ?? 'No command description set.',
    };
  }

  /**
   * Collects normalized guild scopes for all chat-input leaves within a hierarchical subtree.
   */
  private collectHierarchicalGuildScopes(
    nodeIds: string[],
    treeNodes: ReturnType<CommandKit['commandsRouter']['getData']>['treeNodes'],
    hierarchicalNodes: Map<
      string,
      ReturnType<
        CommandKit['commandHandler']['getHierarchicalNodesArray']
      >[number]
    >,
  ) {
    const scopes: string[] = [];

    for (const nodeId of nodeIds) {
      const node = treeNodes.get(nodeId);
      const loadedNode = hierarchicalNodes.get(nodeId);

      if (!node || !loadedNode) {
        continue;
      }

      if (node.kind === 'group') {
        scopes.push(
          ...this.collectHierarchicalGuildScopes(
            node.childIds,
            treeNodes,
            hierarchicalNodes,
          ),
        );
        continue;
      }

      if (!node.executable || !loadedNode.data.chatInput) {
        continue;
      }

      scopes.push(
        (loadedNode.metadata?.guilds ?? [])
          .filter(Boolean)
          .slice()
          .sort()
          .join(','),
      );
    }

    return scopes;
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
  public async updateGlobalCommands(commands: RegistrationCommandData[]) {
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
  public async updateGuildCommands(commands: RegistrationCommandData[]) {
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
