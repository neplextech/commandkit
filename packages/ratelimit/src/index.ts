import './augmentation';
import { RateLimitPlugin } from './plugin';
import { UseRateLimitDirectivePlugin } from './directive/use-ratelimit-directive';
import type { CommandKitPlugin } from 'commandkit';
import { getRateLimitConfig } from './configure';

/**
 * Create compiler + runtime plugins for rate limiting.
 *
 * Runtime options are provided via configureRatelimit().
 *
 * @param options - Optional compiler plugin configuration.
 * @returns Ordered array of compiler and runtime plugins.
 */
export function ratelimit(
  options?: Partial<{
    compiler: import('commandkit').CommonDirectiveTransformerOptions;
  }>,
): CommandKitPlugin[] {
  const compiler = new UseRateLimitDirectivePlugin(options?.compiler);
  const runtime = new RateLimitPlugin(getRateLimitConfig());
  return [compiler, runtime];
}

export * from './types';
export * from './constants';
export * from './runtime';
export * from './configure';
export * from './errors';
export * from './api';
export * from './plugin';
export * from './directive/use-ratelimit';
export * from './directive/use-ratelimit-directive';
export * from './engine/RateLimitEngine';
export * from './engine/algorithms/fixed-window';
export * from './engine/algorithms/sliding-window';
export * from './engine/algorithms/token-bucket';
export * from './engine/algorithms/leaky-bucket';
export * from './engine/violations';
export * from './storage/memory';
export * from './storage/redis';
export * from './storage/fallback';
