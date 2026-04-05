# 01 directive use cache

## Purpose

Show valid cache directive usage in deterministic functions.

## When to use

Use when implementing or reviewing this feature in a CommandKit-based project.

## Filesystem

```txt
project/
  commandkit.config.ts
  src/
    app/
      commands/
    services/
```

## Example

```ts
import { cacheLife, cacheTag } from '@commandkit/cache';

async function fetchDogs() {
  'use cache';

  cacheTag('dogs');
  cacheLife('1h');

  const dogs = await fetch('https://example.com/dogs');
  return dogs.json();
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
