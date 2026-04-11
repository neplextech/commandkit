import type {
  ChatInputCommand,
  CommandData,
  CommandMetadata,
  MessageCommand,
  MessageContextMenuCommand,
} from 'commandkit';
import {
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
} from 'discord.js';

export const command: CommandData = {
  name: 'cat',
  // description: 'cat command',
  integration_types: [
    ApplicationIntegrationType.GuildInstall,
    ApplicationIntegrationType.UserInstall,
  ],
  contexts: [
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel,
  ],
};

export const metadata: CommandMetadata = {
  nameAliases: {
    message: 'Cat Message',
    user: 'Cat User',
  },
};

export const messageContextMenu: MessageContextMenuCommand = async (ctx) => {
  const content = ctx.interaction.targetMessage.content || 'No content found';

  await ctx.interaction.reply({
    content,
    flags: MessageFlags.Ephemeral,
  });
};

export const chatInput: ChatInputCommand = async (ctx) => {
  await ctx.interaction.reply('Hello from cat!');
};

export const message: MessageCommand = async (ctx) => {
  await ctx.message.reply('Hello from cat!');
};
