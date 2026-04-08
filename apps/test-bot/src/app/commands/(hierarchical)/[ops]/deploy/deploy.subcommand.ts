import { ApplicationCommandOptionType } from 'discord.js';
import {
  ChatInputCommandContext,
  CommandData,
  MessageCommandContext,
} from 'commandkit';
import { replyWithHierarchyDemo } from '@/utils/hierarchical-demo';

export const command: CommandData = {
  name: 'deploy',
  description: 'Run a folder-based direct subcommand under the root.',
  options: [
    {
      name: 'environment',
      description: 'Where the deployment should go',
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: [
        { name: 'staging', value: 'staging' },
        { name: 'production', value: 'production' },
      ],
    },
    {
      name: 'dry_run',
      description: 'Whether to simulate the deployment',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    },
  ],
};

async function execute(ctx: ChatInputCommandContext | MessageCommandContext) {
  const environment = ctx.options.getString('environment') ?? 'staging';
  const dryRun = ctx.options.getBoolean('dry_run') ?? true;

  return replyWithHierarchyDemo(ctx, {
    title: 'Ops Deploy',
    shape: 'root command -> direct subcommand',
    leafStyle: 'folder leaf ([deploy]/command.ts)',
    summary:
      'Shows a direct folder-based subcommand with leaf-directory middleware and the same prefix route syntax.',
    details: [`environment: ${environment}`, `dry_run: ${dryRun}`],
  });
}

export const chatInput = execute;
export const message = execute;
