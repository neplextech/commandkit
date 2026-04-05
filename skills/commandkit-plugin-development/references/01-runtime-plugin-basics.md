# 01 runtime plugin basics

## Purpose

Provide a baseline RuntimePlugin implementation and registration
pattern.

## When to use

Use when adding behavior around command/event lifecycle, registration
flow, interaction handling, or post-command telemetry.

## Filesystem

```txt
src/
  plugins/
    my-runtime-plugin.ts
commandkit.config.ts
```

## Example

```ts
import { type CommandKitPluginRuntime, RuntimePlugin } from 'commandkit';

export class MyRuntimePlugin extends RuntimePlugin {
  async onAfterClientLogin(ctx: CommandKitPluginRuntime): Promise<void> {
    console.log(`Bot logged in as ${ctx.client.user?.tag}`);
  }
}
```

## Important details

- Runtime plugins extend `RuntimePlugin`.
- Hooks receive `CommandKitPluginRuntime` and can access
  client/commands/events context.
- Keep hook code non-blocking where possible.

## Best practices

- Start with one hook, then add only hooks you truly need.
- Add try/catch around external I/O in hooks.
- Keep plugin responsibilities focused.

## Common mistakes

- Implementing many hooks without clear need.
- Throwing uncaught errors from hot hooks.
- Embedding unrelated business logic inside plugin hooks.
