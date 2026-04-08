import { ApplicationCommandOptionType } from 'discord.js';
import {
  ChatInputCommandContext,
  CommandData,
  MessageCommandContext,
} from 'commandkit';
import { replyWithHierarchyDemo } from '@/utils/hierarchical-demo';

export const command: CommandData = {
  name: 'archive',
  description: 'Archive a note using a folder-based grouped subcommand.',
  options: [
    {
      name: 'note',
      description: 'The note name to archive',
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: 'reason',
      description: 'Why the note is being archived',
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
};

async function execute(ctx: ChatInputCommandContext | MessageCommandContext) {
  const note = ctx.options.getString('note') ?? 'sprint-plan';
  const reason = ctx.options.getString('reason') ?? 'cleanup';

  return replyWithHierarchyDemo(ctx, {
    title: 'Workspace Notes Archive',
    shape: 'root command -> group -> subcommand',
    leafStyle: 'folder leaf ([archive]/command.ts)',
    summary:
      'Shows a grouped leaf discovered from a nested command directory with middleware scoped only to that leaf directory.',
    details: [`note: ${note}`, `reason: ${reason}`],
  });
}

export const chatInput = execute;
export const message = execute;
