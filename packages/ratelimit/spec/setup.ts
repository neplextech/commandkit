/**
 * Vitest setup for ratelimit specs.
 *
 * Restores the Console constructor so logging helpers behave consistently.
 */

import { Console } from 'node:console';

const consoleAny = console as Console & { Console?: typeof Console };
if (typeof consoleAny.Console !== 'function') {
  consoleAny.Console = Console;
}
