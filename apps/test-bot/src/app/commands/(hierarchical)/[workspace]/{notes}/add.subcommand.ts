import { ApplicationCommandOptionType } from 'discord.js';
import {
  ChatInputCommandContext,
  CommandData,
  MessageCommandContext,
} from 'commandkit';
import { replyWithHierarchyDemo } from '@/utils/hierarchical-demo';

export const command: CommandData = {
  name: 'add',
  description: 'Create a note using a grouped shorthand subcommand.',
  options: [
    {
      name: 'title',
      description: 'Title for the note',
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: 'topic',
      description: 'Topic bucket for the note',
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
};

async function execute(ctx: ChatInputCommandContext | MessageCommandContext) {
  const title = ctx.options.getString('title') ?? 'untitled';
  const topic = ctx.options.getString('topic') ?? 'general';

  return replyWithHierarchyDemo(ctx, {
    title: 'Workspace Notes Add',
    shape: 'root command -> group -> subcommand',
    leafStyle: 'shorthand file (add.subcommand.ts)',
    summary:
      'Shows a grouped leaf discovered from a shorthand file with command-specific middleware in the group directory.',
    details: [`title: ${title}`, `topic: ${topic}`],
  });
}

export const chatInput = execute;
export const message = execute;
