// Demo command for queued rate limiting.
//
// Shows queue delay by comparing interaction creation vs handling time.

import type { ChatInputCommand, CommandData, CommandMetadata } from 'commandkit';

export const command: CommandData = {
  name: 'ratelimit-queue',
  description: 'Demo queued rate limiting with timestamps.',
};

export const metadata: CommandMetadata = {
  ratelimit: {
    limiter: 'queued',
  },
};

export const chatInput: ChatInputCommand = async (ctx) => {
  const createdAtMs = ctx.interaction.createdTimestamp;
  const handledAtMs = Date.now();
  const delayMs = Math.max(0, handledAtMs - createdAtMs);

  const lines = [
    `createdAt: ${new Date(createdAtMs).toISOString()}`,
    `handledAt: ${new Date(handledAtMs).toISOString()}`,
    `delayMs: ${delayMs}`,
  ];

  await ctx.interaction.reply({
    content: lines.join('\n'),
  });
};
