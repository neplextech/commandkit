import type { CommandKitPluginRuntime } from './CommandKitPluginRuntime';
import type { CompilerPluginRuntime } from './CompilerPluginRuntime';

/**
 * Common plugin runtime type that can be used in both command and compiler plugins.
 */
export type CommonPluginRuntime =
  CommandKitPluginRuntime | CompilerPluginRuntime;
