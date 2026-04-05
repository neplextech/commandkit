# 01 config and structure

## Purpose

Explain CommandKit configuration model and how plugin setup maps to
concrete project tasks.

## When to use

Use when editing commandkit.config or deciding which plugins/files are
required for a capability.

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
import { defineConfig, noBuildOnly } from 'commandkit/config';
import { i18n } from '@commandkit/i18n';
import { devtools } from '@commandkit/devtools';
import { cache } from '@commandkit/cache';
import { ai } from '@commandkit/ai';
import { tasks, setDriver } from '@commandkit/tasks';
import { SQLiteDriver } from '@commandkit/tasks/sqlite';
import { workflow } from '@commandkit/workflow';
import { ratelimit } from '@commandkit/ratelimit';

noBuildOnly(() => {
  // runs only if this code is being executed outside of a build process
  // this prevents issues such as:
  // - build command hangs due to long-running driver initialization
  // - build-time errors from missing environment variables used in driver setup
  // - unintended side effects from running driver code during build
  // The opposite behavior can be achieved with `buildOnly()` function.
  setDriver(new SQLiteDriver());
})();

export default defineConfig({
  plugins: [
    i18n(),
    devtools(),
    cache(),
    ratelimit(),
    ai(),
    tasks({ initializeDefaultDriver: false }),
    workflow(),
  ],
});
```

## Important details

- Use exact API/export names shown in the example.
- Keep filesystem placement aligned with enabled plugins and feature
  expectations.
- Preserve deterministic behavior and explicit error handling in
  implementation code.
- CommandKit config file can be in both JavaScript and TypeScript
  formats, and supports both ESM and CJS module formats.

## Best practices

- Keep snippets as baseline patterns and adapt them to real command
  names and data models.
- Validate external inputs and permission boundaries before side
  effects.
- Keep setup deterministic so startup behavior is stable across
  environments.

## Common mistakes

- Enabling plugins without creating required companion files.
- Running runtime-only setup during build.
- Putting commands/events outside discovery paths.
