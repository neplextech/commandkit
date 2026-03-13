import type { RateLimitStorage } from '../types';

type LockedFn<T> = () => Promise<T>;

class KeyedMutex {
  private readonly queues = new Map<string, Promise<void>>();

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
