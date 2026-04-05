# 03 ai command schema

## Purpose

Show schema-backed AI command exports to reduce parameter hallucination.

## When to use

Use when implementing or reviewing this feature in a CommandKit-based project.

## Filesystem

```txt
project/
  commandkit.config.ts
  src/
    ai.ts
    app/
      commands/
```

## Example

```ts
import type { AiConfig, AiCommand } from '@commandkit/ai';
import { z } from 'zod';

export const aiConfig: AiConfig = {
  inputSchema: z.object({
    username: z.string(),
    message: z.string().optional(),
  }),
};

export const ai: AiCommand<typeof aiConfig> = async (ctx) => {
  const { username, message } = ctx.ai.params;
  await ctx.message.reply(message || `Hello, ${username}!`);
  return { username };
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
