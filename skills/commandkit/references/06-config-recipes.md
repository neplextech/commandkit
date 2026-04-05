# 06 config recipes

## Purpose

Provide ready-to-adapt config recipes for common plugin combinations.

## When to use

Use when you need a known-good config starting point for a specific feature combination.

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
import { defineConfig } from 'commandkit/config';

export default defineConfig({
  plugins: [],
});
```

```ts
import { defineConfig } from 'commandkit/config';
import { i18n } from '@commandkit/i18n';
import { cache } from '@commandkit/cache';

export default defineConfig({
  plugins: [i18n(), cache()],
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
