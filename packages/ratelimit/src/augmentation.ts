/**
 * CommandKit metadata augmentation.
 *
 * Extends CommandKit metadata so commands can declare per-command limits.
 */

import type { RateLimitCommandConfig } from './types';

declare module 'commandkit' {
  interface CommandMetadata {
    ratelimit?: RateLimitCommandConfig | boolean;
  }
}
