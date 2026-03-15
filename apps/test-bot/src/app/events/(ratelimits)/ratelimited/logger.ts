// Ratelimit event logger for the test bot.
//
// Logs aggregated retry info when commands are blocked.

import { Logger } from 'commandkit';
import type { RateLimitResult, RateLimitStoreValue } from '@commandkit/ratelimit';
import type { Interaction, Message } from 'discord.js';

type RateLimitedEventPayload = {
  key: string;
  result: RateLimitResult;
  source: Interaction | Message;
  aggregate: RateLimitStoreValue;
  commandName: string;
  queued: boolean;
};

const handler = (payload: RateLimitedEventPayload) => {
  const { key, aggregate, commandName, queued } = payload;
  Logger.warn(
    `[ratelimit] ratelimited ${key} command=${commandName} queued=${queued} retryAfter=${aggregate.retryAfter}ms`,
  );
};

export default handler;
