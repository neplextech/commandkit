// Admin/demo command for managing rate limit exemptions and resets.
//
// Keeps the workflows in one place for test-bot demos.

import type { ChatInputCommand, CommandData } from 'commandkit';
import { ApplicationCommandOptionType, PermissionFlagsBits } from 'discord.js';
import {
  grantRateLimitExemption,
  listRateLimitExemptions,
  resetAllRateLimits,
  resetRateLimit,
  revokeRateLimitExemption,
} from '@commandkit/ratelimit';

const actions = ['grant', 'revoke', 'list', 'reset', 'resetAll'] as const;
type Action = (typeof actions)[number];

const actionChoices = actions.map((action) => ({
  name: action,
  value: action,
}));

const isAction = (value: string): value is Action =>
  actions.includes(value as Action);

const demoCommandName = 'ratelimit-basic';

export const command: CommandData = {
  name: 'ratelimit-admin',
  description: 'Manage rate limit exemptions and resets for demos.',
  options: [
    {
      name: 'action',
      description: 'Action to perform.',
      type: ApplicationCommandOptionType.String,
      required: true,
      choices: actionChoices,
    },
    {
      name: 'duration',
      description: 'Exemption duration (ex: 1m, 10m, 1h).',
      type: ApplicationCommandOptionType.String,
      required: false,
    },
  ],
};

export const chatInput: ChatInputCommand = async (ctx) => {
  const hasAdminPermission = ctx.interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator,
  );
  if (!hasAdminPermission) {
    await ctx.interaction.reply({
      content: 'You are not authorized to use this command.',
      ephemeral: true,
    });
    return;
  }

  const actionValue = ctx.options.getString('action', true);
  if (!isAction(actionValue)) {
    await ctx.interaction.reply({
      content: `Unknown action: ${actionValue}`,
      ephemeral: true,
    });
    return;
  }

  const action = actionValue;
  const duration = ctx.options.getString('duration') ?? '1m';
  const userId = ctx.interaction.user.id;

  try {
    switch (action) {
      case 'grant': {
        await grantRateLimitExemption({
          scope: 'user',
          id: userId,
          duration,
        });

        await ctx.interaction.reply({
          content: `Granted user exemption for ${duration}.`,
          ephemeral: true,
        });
        return;
      }
      case 'revoke': {
        await revokeRateLimitExemption({
          scope: 'user',
          id: userId,
        });

        await ctx.interaction.reply({
          content: 'Revoked user exemption.',
          ephemeral: true,
        });
        return;
      }
      case 'list': {
        const exemptions = await listRateLimitExemptions({
          scope: 'user',
          id: userId,
        });

        const lines = [`Exemptions: ${exemptions.length}`];
        for (const exemption of exemptions) {
          const expiresIn =
            exemption.expiresInMs === null
              ? 'unknown'
              : `${Math.ceil(exemption.expiresInMs / 1000)}s`;
          lines.push(`expiresIn: ${expiresIn}`);
        }

        await ctx.interaction.reply({
          content: lines.join('\n'),
          ephemeral: true,
        });
        return;
      }
      case 'reset': {
        await resetRateLimit({
          scope: 'user',
          userId,
          commandName: demoCommandName,
        });

        await ctx.interaction.reply({
          content: `Reset rate limit for ${demoCommandName}.`,
          ephemeral: true,
        });
        return;
      }
      case 'resetAll': {
        await resetAllRateLimits({ commandName: demoCommandName });

        await ctx.interaction.reply({
          content: `Reset all rate limits for ${demoCommandName}.`,
          ephemeral: true,
        });
        return;
      }
      default: {
        const _exhaustive: never = action;
        throw new Error(`Unsupported action: ${_exhaustive}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ctx.interaction.reply({
      content: `Ratelimit admin error: ${message}`,
      ephemeral: true,
    });
  }
};
