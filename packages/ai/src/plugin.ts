import { CommandKitPluginRuntime, RuntimePlugin } from 'commandkit/plugin';
import { AiPluginOptions, CommandTool } from './types';
import CommandKit, { getCommandKit, Logger } from 'commandkit';
import { AiContext } from './context';
import { Collection, Events, Message } from 'discord.js';
import { tool, Tool, generateText, stepCountIs, ModelMessage } from 'ai';
import { getAiWorkerContext, runInAiWorkerContext } from './ai-context-worker';
import { getAvailableCommands } from './tools/get-available-commands';
import { getChannelById } from './tools/get-channel-by-id';
import { getCurrentClientInfo } from './tools/get-current-client-info';
import { getGuildById } from './tools/get-guild-by-id';
import { getUserById } from './tools/get-user-by-id';
import { getAIConfig } from './configure';
import { augmentCommandKit } from './augmentation';
import { ToolParameterType } from './tools/common';
import { getMemberById } from './tools/get-member-by-id';
import { createEmbed } from './tools/create-embed';

/**
 * Represents the configuration options for the AI plugin scoped to a specific command.
 */
export interface AiConfig<T extends ToolParameterType = ToolParameterType> {
  /**
   * A description of the AI functionality provided by this command. If not given, the command's description will be used.
   */
  description?: string;
  /**
   * A zod schema defining the parameters that the AI command accepts.
   */
  inputSchema: T;
}

/**
 * A record of all built-in tools provided by the AI plugin.
 * These tools are automatically available to the AI unless `disableBuiltInTools` is set to `true`.
 *
 * You can use this to selectively include specific built-in tools when `disableBuiltInTools` is enabled:
 *
 * @example
 * ```ts
 * import { configureAI, defaultTools } from '@commandkit/ai';
 *
 * configureAI({
 *   disableBuiltInTools: true,
 *   selectAiModel: async (ctx, message) => ({
 *     model: google.languageModel('gemini-2.0-flash'),
 *     // Only include specific built-in tools
 *     tools: {
 *       getAvailableCommands: defaultTools.getAvailableCommands,
 *       getUserById: defaultTools.getUserById,
 *     },
 *   }),
 * });
 * ```
 */
export const defaultTools: Record<string, Tool> = {
  getAvailableCommands,
  getChannelById,
  getCurrentClientInfo,
  getGuildById,
  getUserById,
  getMemberById,
  createEmbed,
};

export class AiPlugin extends RuntimePlugin<AiPluginOptions> {
  public readonly name = 'AiPlugin';
  private toolsRecord: Record<string, Tool> = {};
  private defaultTools = defaultTools;
  private onMessageFunc: ((message: Message) => Promise<void>) | null = null;

  public constructor(options: AiPluginOptions) {
    super(options);
    this.preload.add('ai.js');
  }

  public async activate(ctx: CommandKitPluginRuntime): Promise<void> {
    this.onMessageFunc = (message) =>
      this.handleMessage(ctx.commandkit, message);
    ctx.commandkit.client.on(Events.MessageCreate, this.onMessageFunc);
    augmentCommandKit(true);

    Logger.info(`Plugin ${this.name} activated`);
  }

  public async deactivate(ctx: CommandKitPluginRuntime): Promise<void> {
    this.toolsRecord = {};
    if (this.onMessageFunc) {
      ctx.commandkit.client.off(Events.MessageCreate, this.onMessageFunc);
      this.onMessageFunc = null;
    }
    augmentCommandKit(false);
    Logger.info(`Plugin ${this.name} deactivated`);
  }

  private async handleMessage(
    commandkit: CommandKit,
    message: Message,
  ): Promise<void> {
    if (message.author.bot) return;
    const {
      messageFilter,
      selectAiModel,
      prepareSystemPrompt,
      preparePrompt,
      onProcessingFinish,
      onProcessingStart,
      onResult,
      onError,
      disableBuiltInTools,
    } = getAIConfig();

    if (!message.content?.length) return;

    if (!message.channel.isTextBased() || !message.channel.isSendable()) return;

    const shouldContinue = messageFilter
      ? await messageFilter(commandkit, message)
      : true;
    if (!shouldContinue) return;

    const ctx = new AiContext<any>({
      message,
      params: {},
      commandkit: commandkit,
    });

    await runInAiWorkerContext(ctx, message, async () => {
      const systemPrompt = await prepareSystemPrompt(ctx, message);
      const prompt = await preparePrompt(ctx, message);
      const { model, abortSignal, stopWhen, ...modelOptions } =
        await selectAiModel(ctx, message);

      const promptOrMessage = (
        typeof prompt === 'string' ? { prompt } : { messages: prompt }
      ) as
        | { prompt: string; messages: never }
        | { messages: ModelMessage[]; prompt: never };

      await onProcessingStart(ctx, message);

      try {
        const result = await generateText({
          model,
          abortSignal: abortSignal ?? AbortSignal.timeout(60_000),
          system: systemPrompt,
          stopWhen: stopWhen ?? stepCountIs(5),
          ...modelOptions,
          tools: {
            // Include built-in least significant tools if not disabled
            ...(!disableBuiltInTools && this.defaultTools),
            // include tools added by configureAI()
            // this should be able to override built-in tools
            ...modelOptions.tools,
            // include tools added by commands at last since
            // they are the most specific and should override others
            ...this.toolsRecord,
          },
          ...promptOrMessage,
        });

        await onResult(ctx, message, result);
      } catch (e) {
        await onError(ctx, message, e as Error);
      } finally {
        await onProcessingFinish(ctx, message);
      }
    });
  }

  /**
   * Executes the AI for a given message.
   * @param message The message to process.
   * @param commandkit The CommandKit instance to use. If not provided, it will be inferred automatically.
   */
  public async executeAI(
    message: Message,
    commandkit?: CommandKit,
  ): Promise<void> {
    commandkit ??= getCommandKit(true);
    return this.handleMessage(commandkit, message);
  }

  public async onBeforeCommandsLoad(): Promise<void> {
    this.toolsRecord = {};
  }

  async onAfterCommandsLoad(ctx: CommandKitPluginRuntime): Promise<void> {
    const { commandkit } = ctx;
    const commands = commandkit.commandHandler
      .getCommandsArray()
      .filter(
        (command) =>
          'ai' in command.data &&
          typeof command.data.ai === 'function' &&
          'aiConfig' in command.data,
      );

    if (!commands.length) {
      return;
    }

    const tools = new Collection<string, CommandTool>();

    for (const command of commands) {
      const cmd = command as CommandTool;
      if (!cmd.data.ai || !cmd.data.aiConfig) {
        continue;
      }

      const description =
        cmd.data.aiConfig.description || cmd.data.command.description;

      const cmdTool = tool({
        description,
        inputSchema: cmd.data.aiConfig.inputSchema,
        async execute(params) {
          const config = getAIConfig();
          const ctx = getAiWorkerContext();

          ctx.ctx.setParams(params as Record<string, unknown>);

          try {
            const target = await commandkit.commandHandler.prepareCommandRun(
              ctx.message,
              cmd.data.command.name,
            );

            if (!target) {
              return {
                error: true,
                message: 'This command is not available.',
              };
            }

            const res =
              await commandkit.commandHandler.commandRunner.runCommand(
                target,
                ctx.message,
                {
                  handler: 'ai',
                  throwOnError: true,
                },
              );

            return res === undefined ? { success: true } : res;
          } catch (e) {
            await config.onError?.(ctx.ctx, ctx.message, e as Error);

            return {
              error: true,
              message: 'This tool failed with unexpected error.',
            };
          }
        },
      });

      cmd.tool = cmdTool;

      tools.set(cmd.command.name, cmd);
    }

    this.toolsRecord = Object.fromEntries(
      tools.map((toolCmd) => {
        return [toolCmd.command.name, toolCmd.tool];
      }),
    );
  }
}
