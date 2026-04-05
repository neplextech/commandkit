# 02 configure ai model

## Purpose

Show model selection and message filter configuration for AI runtime.

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
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { configureAI } from '@commandkit/ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

configureAI({
  selectAiModel: async () => ({
    model: google.languageModel('gemini-2.0-flash'),
    maxSteps: 5,
    temperature: 0.7,
  }),
  messageFilter: async (_commandkit, message) =>
    message.mentions.users.has(message.client.user.id),
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
