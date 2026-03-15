// Demo command for reading aggregated rate limit info.
//
// Reports remaining/reset values captured in the env store.

import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';
import { getRateLimitInfo } from '@commandkit/ratelimit';

export const command: CommandData = {
  name: 'ratelimit-basic',
  description: 'Hit a strict limiter and show remaining/reset info.',
};

export const metadata: CommandMetadata = {
  ratelimit: {
    limiter: 'strict',
  },
};

export const chatInput: ChatInputCommand = async (ctx) => {
  const info = getRateLimitInfo(ctx);

  if (!info) {
    await ctx.interaction.reply({
      content:
        'No rate limit info was found. Ensure the ratelimit() plugin is enabled.',
    });
    return;
  }

  const now = Date.now();
  const resetAt = info.resetAt
    ? new Date(info.resetAt).toISOString()
    : 'n/a';
  const resetInMs = info.resetAt ? Math.max(0, info.resetAt - now) : 0;

  const lines = [
    `limited: ${info.limited}`,
    `remaining: ${info.remaining}`,
    `retryAfterMs: ${info.retryAfter}`,
    `resetAt: ${resetAt}`,
    `resetInMs: ${resetInMs}`,
  ];

  await ctx.interaction.reply({
    content: lines.join('\n'),
  });
};
