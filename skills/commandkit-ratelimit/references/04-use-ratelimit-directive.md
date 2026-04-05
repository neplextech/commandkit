# 04 use ratelimit directive

## Purpose

Show function-level directive usage and error handling.

## When to use

Use when throttling a hot async function outside command metadata policy.

## Filesystem

```txt
project/
  commandkit.config.ts
  ratelimit.ts
  src/
    app/
      commands/
```

## Example

```ts
import { RateLimitError } from '@commandkit/ratelimit';

const heavy = async () => {
  'use ratelimit';
  return 'ok';
};

try {
  await heavy();
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(error.result.retryAfter);
  }
}
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
