import { ApplicationCommandOptionType } from 'discord.js';
import {
  ChatInputCommandContext,
  CommandData,
  MessageCommandContext,
} from 'commandkit';
import { replyWithHierarchyDemo } from '@/utils/hierarchical-demo';

export const command: CommandData = {
  name: 'status',
  description: 'Inspect a direct shorthand subcommand under the root.',
  options: [
    {
      name: 'scope',
      description: 'Which subsystem to inspect',
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: [
        { name: 'bot', value: 'bot' },
        { name: 'database', value: 'database' },
        { name: 'workers', value: 'workers' },
      ],
    },
  ],
};

async function execute(ctx: ChatInputCommandContext | MessageCommandContext) {
  const scope = ctx.options.getString('scope') ?? 'bot';

  return replyWithHierarchyDemo(ctx, {
    title: 'Ops Status',
    shape: 'root command -> direct subcommand',
    leafStyle: 'shorthand file (status.subcommand.ts)',
    summary:
      'Shows a direct subcommand branch without groups, where the leaf shares the root command directory and therefore uses that directory middleware plus same-directory command middleware.',
    details: [`scope: ${scope}`],
  });
}

export const chatInput = execute;
export const message = execute;
