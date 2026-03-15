/**
 * Storage-scoped locking helpers.
 *
 * Serializes fallback storage operations per key to reduce same-process races.
 */

import type { RateLimitStorage } from '../types';

type LockedFn<T> = () => Promise<T>;

/**
 * Queue-based mutex keyed by string identifiers.
 */
class KeyedMutex {
  private readonly queues = new Map<string, Promise<void>>();

  /**
   * Run a function exclusively for the given key.
   *
   * @param key - Key to serialize on.
   * @param fn - Async function to run under the lock.
   * @returns Result of the locked function.
   */
  public async run<T>(key: string, fn: LockedFn<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    let release: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.queues.set(key, tail);

    await previous;
    try {
      return await fn();
    } finally {
      release!();
      if (this.queues.get(key) === tail) {
        this.queues.delete(key);
      }
    }
  }
}

const mutexByStorage = new WeakMap<RateLimitStorage, KeyedMutex>();

/**
 * Serialize work for a storage key to avoid same-process conflicts.
 *
 * @param storage - Storage instance that owns the key.
 * @param key - Storage key to lock on.
 * @param fn - Async function to run under the lock.
 * @returns Result of the locked function.
 */
export async function withStorageKeyLock<T>(
  storage: RateLimitStorage,
  key: string,
  fn: LockedFn<T>,
): Promise<T> {
  let mutex = mutexByStorage.get(storage);
  if (!mutex) {
    mutex = new KeyedMutex();
    mutexByStorage.set(storage, mutex);
  }
  return mutex.run(key, fn);
}