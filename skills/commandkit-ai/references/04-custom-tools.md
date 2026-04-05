# 04 custom tools

## Purpose

Show custom AI tool definitions and registration patterns.

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
import { createTool } from '@commandkit/ai';
import { z } from 'zod';

export const getWeather = createTool({
  name: 'getWeather',
  description: 'Get weather information',
  inputSchema: z.object({ location: z.string() }),
  async execute(_ctx, params) {
    return { location: params.location, status: 'sunny' };
  },
});
```

```ts
import { configureAI } from '@commandkit/ai';

configureAI({
  selectAiModel: async () => ({
    model: someModel,
    tools: { getWeather },
  }),
});
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
