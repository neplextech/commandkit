# 10 cli api

## Purpose

Document advanced programmatic use of `commandkit/cli` modules for
custom tooling and build workflows.

## When to use

Use when standard CLI commands are insufficient and custom automation
requires invoking CommandKit internals programmatically.

## Filesystem

```txt
project/
  commandkit.config.ts
  scripts/
    custom-build.ts
    custom-dev.ts
  src/
```

## Example

```ts
import { production, typeChecker } from 'commandkit/cli';

async function customBuild() {
  const configPath = './commandkit.config.ts';

  await typeChecker.performTypeCheck('./src');
  await production.createProductionBuild(configPath);
}

await customBuild();
```

```ts
import { development } from 'commandkit/cli';

const devServer = await development.bootstrapDevelopmentServer(
  './commandkit.config.ts',
);
devServer.watcher.on('change', (path) => {
  console.log(`changed: ${path}`);
});
```

## Important details

- CLI API is an advanced/internal-style surface and may change faster
  than high-level CLI commands.
- Wrap CLI API usage in explicit error handling.
- Prefer `commandkit dev/build/start` unless integration requirements
  truly demand programmatic control.

## Best practices

- Isolate custom CLI API usage in dedicated scripts.
- Keep config path explicit in automation scripts.
- Fail fast with clear error output in CI.

## Common mistakes

- Overusing CLI API when regular CLI commands are sufficient.
- Missing try/catch around long-running build/dev bootstraps.
- Assuming internal API stability across versions without
  compatibility checks.
