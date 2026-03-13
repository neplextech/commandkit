// Demo for the "use ratelimit" directive.
//
// Catches RateLimitError and replies with retry info.

import type { ChatInputCommand, CommandData } from 'commandkit';
import { RateLimitError } from '@commandkit/ratelimit';

export const command: CommandData = {
  name: 'ratelimit-directive',
  description: 'Demo the use ratelimit directive on a helper function.',
};

const doWork = async () => {
  'use ratelimit';
  return `work-${Date.now()}`;
};

export const chatInput: ChatInputCommand = async (ctx) => {
  try {
    const value = await doWork();
    await ctx.interaction.reply({
      content: `Directive call succeeded: ${value}`,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      const retrySeconds = Math.ceil(error.result.retryAfter / 1000);
      await ctx.interaction.reply({
        content: `Rate limited. Retry after ${retrySeconds}s.`,
      });
      return;
    }

    throw error;
  }
};
