# 02 chat input command

## Purpose

Provide a safe baseline for implementing slash commands with CommandKit conventions.

## When to use

Use when implementing or reviewing this feature in a CommandKit-based project.

## Filesystem

```txt
project/
  commandkit.config.ts
  src/
    app/
      commands/
      events/
```

## Example

```ts
import type { ChatInputCommand, CommandData } from 'commandkit';

export const command: CommandData = {
  name: 'ping',
  description: 'Ping command',
};

export const chatInput: ChatInputCommand = async (ctx) => {
  await ctx.interaction.reply('Pong!');
};
```

## Important details

- Use exact API/export names shown in the example.
- Keep filesystem placement aligned with enabled plugins and feature expectations.
- Preserve deterministic behavior and explicit error handling in implementation code.

## Best practices

- Keep snippets as baseline patterns and adapt them to real command names and data models.
- Validate external inputs and permission boundaries before side effects.
- Keep setup deterministic so startup behavior is stable across environments.

## Common mistakes

- Skipping validation for user-provided inputs before side effects.
- Changing structure/config without verifying companion files.
- Copying snippets without adapting identifiers and environment values.
