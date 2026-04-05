# 02 runtime hooks reference

## Purpose

Summarize major runtime hooks and practical usage boundaries for safe
plugin behavior.

## When to use

Use when deciding where to place plugin logic in lifecycle, routing,
command registration, and interaction execution stages.

## Filesystem

```txt
src/
  plugins/
    runtime-hooks-plugin.ts
```

## Example

```ts
import {
  RuntimePlugin,
  type CommandKitPluginRuntime,
  type CommandBuilderLike,
} from 'commandkit';

export class HooksPlugin extends RuntimePlugin {
  async onBeforeCommandsLoad(_ctx: CommandKitPluginRuntime): Promise<void> {}

  async onAfterCommandsLoad(ctx: CommandKitPluginRuntime): Promise<void> {
    console.log(`Loaded ${ctx.commands.size} commands`);
  }

  async prepareCommand(
    _ctx: CommandKitPluginRuntime,
    command: CommandBuilderLike,
  ): Promise<CommandBuilderLike | null> {
    return command;
  }
}
```

## Important details

- Initialization hooks: before/after commands/events/client login.
- Router hooks: commands router init and events router init.
- Registration hooks: `prepareCommand` and pre-register command hooks.
- Execution hooks: interaction/message pre-hooks, `executeCommand`,
  `onAfterCommand`.

## Best practices

- Keep `executeCommand` behavior explicit: return whether execution
  was handled.
- Prefer lightweight hooks for high-frequency paths.
- Log enough metadata for debugging without noisy spam.

## Common mistakes

- Returning wrong control-flow values from `executeCommand`.
- Mutating command metadata without deterministic rules.
- Performing expensive work in pre-interaction hooks.
