#!/usr/bin/env node

console.log(`import { configureRatelimit } from '@commandkit/ratelimit';

configureRatelimit({
  defaultLimiter: {
    maxRequests: 5,
    interval: '1m',
    scope: 'user',
    algorithm: 'fixed-window',
  },
});`);
