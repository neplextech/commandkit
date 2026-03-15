import {
  ChatInputCommand,
  CommandData,
  CommandMetadata,
  MessageCommand,
  MessageContextMenuCommand,
  UserContextMenuCommand,
} from 'commandkit';

export const command: CommandData = {
  name: 'translate',
  description: 'translate command',
};

export const metadata: CommandMetadata = {
  nameAliases: {
    user: 'Translate User',
    message: 'Translate Message',
  },
};

export const userContextMenu: UserContextMenuCommand = async ({
  interaction,
}) => {
  interaction.reply('test');
};

export const messageContextMenu: MessageContextMenuCommand = async ({
  interaction,
}) => {
  interaction.reply('test');
};

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  interaction.reply('test');
};

export const message: MessageCommand = async ({ message }) => {
  message.reply('test');
};
