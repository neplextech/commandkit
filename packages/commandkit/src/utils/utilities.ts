import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  COMMANDKIT_CWD,
  COMMANDKIT_IS_CLI,
  COMMANDKIT_IS_DEV,
  isBuildLikeEnvironment,
} from './constants';
import { getConfig } from '../config/config';

let appDir: string | null = null;
let currentDir: string | null = null;

function getSrcDir() {
  if (COMMANDKIT_IS_CLI) {
    return 'src';
  }

  if (COMMANDKIT_IS_DEV) {
    return '.commandkit';
  }

  return getConfig().distDir;
}

/**
 * Returns the current working directory of the CommandKit application.
 * This is typically the directory where the source code is located.
 */
export function getCurrentDirectory(): string {
  if (currentDir) return currentDir;
  const src = getSrcDir();
  let root = join(COMMANDKIT_CWD, src);

  if (!existsSync(root)) root = COMMANDKIT_CWD;

  currentDir = root;

  return root;
}

/**
 * Returns the possible source directories for the CommandKit application.
 * This includes the `src`, `.commandkit`, and the distribution directory.
 * @returns An array of possible source directories.
 */
export function getSourceDirectories(): string[] {
  const dist = getConfig().distDir;
  const locations = ['src', '.commandkit', dist].map((dir) =>
    join(COMMANDKIT_CWD, dir),
  );

  return locations;
}

/**
 * Returns the path to the app directory.
 * @returns The path to the app directory or `null` if not found.
 */
export function findAppDirectory(): string | null {
  if (appDir) return appDir;

  let root = join(COMMANDKIT_CWD, getSrcDir());

  if (!existsSync(root)) root = COMMANDKIT_CWD;

  const dirs = ['app'].map((dir) => join(root, dir));

  for (const dir of dirs) {
    if (existsSync(dir)) {
      appDir = dir;
      return dir;
    }
  }

  return null;
}

/**
 * Debounces a function.
 * @param fn The function to debounce.
 * @param ms The debounce time in milliseconds.
 * @returns The debounced function.
 * @example
 * const debouncedFn = debounce(() => {
 *   console.log('Debounced function called');
 * }, 300);
 *
 * debouncedFn(); // Will only execute after 300ms of inactivity
 * debouncedFn(); // Will reset the timer
 * debouncedFn(); // Will reset the timer again
 */
export function debounce<R, F extends (...args: any[]) => R>(
  fn: F,
  ms: number,
): F {
  let timer: NodeJS.Timeout | null = null;
  let sharedPromise: Promise<R> | null = null;
  let sharedResolve: ((value: R | PromiseLike<R>) => void) | null = null;
  let sharedReject: ((reason?: any) => void) | null = null;

  return ((...args: any[]) => {
    if (timer) {
      clearTimeout(timer);
    }

    if (!sharedPromise) {
      sharedPromise = new Promise<R>((res, rej) => {
        sharedResolve = res;
        sharedReject = rej;
      });
    }

    timer = setTimeout(async () => {
      const currentResolve = sharedResolve;
      const currentReject = sharedReject;

      // Clear state so next call starts a new debounce window
      timer = null;
      sharedPromise = null;
      sharedResolve = null;
      sharedReject = null;

      try {
        const result = await fn(...args);
        if (currentResolve) currentResolve(result);
      } catch (err) {
        if (currentReject) currentReject(err);
      }
    }, ms);

    return sharedPromise;
  }) as F;
}

/**
 * Defers the execution of a function.
 * @param fn The function to defer.
 * @param timeout The time in milliseconds to wait before executing the function. Defaults to 0.
 * @example
 * defer(() => {
 *   console.log('This will run after a delay');
 * });
 *
 * console.log('This will run immediately');
 */
export function defer<T>(fn: () => T, timeout = 0): void {
  setTimeout(() => {
    return fn();
  }, timeout).unref();
}

/**
 * Serializes a value to JSON.
 * @param value The value to serialize.
 * @param defaultValue The default value to return if the value is not serializable.
 * @returns The serialized value.
 */
export function JsonSerialize<R = any>(value: any, defaultValue = {} as R): R {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return defaultValue;
  }
}

/**
 * Creates a function from the given function that runs only in development mode.
 * @param fn The function to run in development mode.
 * @returns The function that runs only in development mode.
 * @example
 * ```ts
 * const devOnlyFn = devOnly(() => {
 *   console.log('This function runs only in development mode');
 * });
 * devOnlyFn(); // This will log the message only in development mode
 * ```
 */
export function devOnly<T extends (...args: any[]) => any>(fn: T): T {
  const f = (...args: Parameters<T>) => {
    if (COMMANDKIT_IS_DEV) {
      return fn(...args);
    }
  };

  return f as T;
}

/**
 * Creates a function from the given function that runs only in build mode.
 * @param fn The function to run in build mode.
 * @returns The function that runs only in build mode.
 * @example
 * ```ts
 * const buildOnlyFn = buildOnly(() => {
 *   console.log('This function runs only in build mode');
 * });
 * buildOnlyFn(); // This will log the message only in build mode
 * ```
 */
export function buildOnly<T extends (...args: any[]) => any>(fn: T): T {
  const f = (...args: Parameters<T>) => {
    if (isBuildLikeEnvironment()) {
      return fn(...args);
    }
  };

  return f as T;
}

/**
 * Creates a function from the given function that runs only outside of build mode.
 * @param fn The function to run outside of build mode.
 * @returns The function that runs only outside of build mode.
 * @example
 * ```ts
 * const noBuildOnlyFn = noBuildOnly(() => {
 *   console.log('This function runs only outside of build mode');
 * });
 * noBuildOnlyFn(); // This will log the message only outside of build mode
 * ```
 */
export function noBuildOnly<T extends (...args: any[]) => any>(fn: T): T {
  const f = (...args: Parameters<T>) => {
    if (!isBuildLikeEnvironment()) {
      return fn(...args);
    }
  };

  return f as T;
}

/**
 * Represents a simple proxy object that mirrors a target object.
 */
export interface SimpleProxy<T extends object> {
  /**
   * The proxied object that mirrors the target.
   */
  proxy: T;
  /**
   * Sets a new target object for the proxy.
   * @param newTarget The new target object to set.
   */
  setTarget(newTarget: T): void;
}

/**
 * Creates a simple proxy object that mirrors the target object.
 * @param target The target object to proxy.
 * @returns The proxied object.
 */
export function createProxy<T extends object>(target: T): SimpleProxy<T> {
  let _target = target;

  const proxy = new Proxy(_target, {
    get(target, prop, receiver) {
      return Reflect.get(_target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      return Reflect.set(_target, prop, value, receiver);
    },
    deleteProperty(target, prop) {
      return Reflect.deleteProperty(_target, prop);
    },
    has(target, prop) {
      return Reflect.has(_target, prop);
    },
    ownKeys(target) {
      return Reflect.ownKeys(_target);
    },
    getOwnPropertyDescriptor(target, prop) {
      return Reflect.getOwnPropertyDescriptor(_target, prop);
    },
    defineProperty(target, prop, attributes) {
      return Reflect.defineProperty(_target, prop, attributes);
    },
    getPrototypeOf(target) {
      return Reflect.getPrototypeOf(_target);
    },
    setPrototypeOf(target, proto) {
      return Reflect.setPrototypeOf(_target, proto);
    },
    isExtensible(target) {
      return Reflect.isExtensible(_target);
    },
    preventExtensions(target) {
      return Reflect.preventExtensions(_target);
    },
    apply(target, thisArg, args) {
      // @ts-ignore
      return Reflect.apply(_target, thisArg, args);
    },
    construct(target, args, newTarget) {
      // @ts-ignore
      return Reflect.construct(_target, args, newTarget);
    },
  });

  return {
    proxy,
    setTarget(newTarget: T) {
      _target = newTarget;
    },
  };
}
