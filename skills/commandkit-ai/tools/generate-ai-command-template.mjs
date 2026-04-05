#!/usr/bin/env node

console.log(`import type { AiConfig, AiCommand } from '@commandkit/ai';
import { z } from 'zod';

export const aiConfig: AiConfig = {
  inputSchema: z.object({
    prompt: z.string().describe('User request prompt'),
  }),
};

export const ai: AiCommand<typeof aiConfig> = async (ctx) => {
  const { prompt } = ctx.ai.params;
  await ctx.message.reply(prompt);
  return { ok: true };
};`);
