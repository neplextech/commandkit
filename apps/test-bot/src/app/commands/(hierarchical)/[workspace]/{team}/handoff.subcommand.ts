import { ApplicationCommandOptionType } from 'discord.js';
import {
  ChatInputCommandContext,
  CommandData,
  MessageCommandContext,
} from 'commandkit';
import { replyWithHierarchyDemo } from '@/utils/hierarchical-demo';

export const command: CommandData = {
  name: 'handoff',
  description: 'Hand work over to a teammate from a second group branch.',
  options: [
    {
      name: 'owner',
      description: 'Who is taking over the work',
      type: ApplicationCommandOptionType.String,
      required: false,
    },
    {
      name: 'project',
      description: 'Which project is being handed off',
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
};

async function execute(ctx: ChatInputCommandContext | MessageCommandContext) {
  const owner = ctx.options.getString('owner') ?? 'alex';
  const project = ctx.options.getString('project') ?? 'migration';

  return replyWithHierarchyDemo(ctx, {
    title: 'Workspace Team Handoff',
    shape: 'root command -> sibling group -> subcommand',
    leafStyle: 'shorthand file (handoff.subcommand.ts)',
    summary:
      'Shows that one root can host multiple groups while each leaf still resolves through the same route index.',
    details: [`owner: ${owner}`, `project: ${project}`],
  });
}

export const chatInput = execute;
export const message = execute;
