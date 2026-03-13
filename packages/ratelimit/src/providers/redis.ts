// Provider re-export for Redis storage.
//
// Exposes the storage class and RedisOptions type for consumers.

export { RedisRateLimitStorage } from '../storage/redis';
export type { RedisOptions } from 'ioredis';
