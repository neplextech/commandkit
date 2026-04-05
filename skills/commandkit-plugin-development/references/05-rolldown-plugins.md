# 05 rolldown plugins

## Purpose

Show how to integrate rolldown plugins through CommandKit config for
compiler-time extension.

## When to use

Use when you already have a rolldown plugin or need bundler-level
compile customization.

## Filesystem

```txt
project/
  commandkit.config.ts
  src/
```

## Example

```ts
import { defineConfig } from 'commandkit';
import { someRolldownPlugin } from 'some-rolldown-plugin';

export default defineConfig({
  rolldownPlugins: [someRolldownPlugin()],
});
```

## Important details

- `rolldownPlugins` runs in compile pipeline, not runtime command
  execution.
- Keep plugin ordering intentional if using multiple rolldown plugins.
- Confirm plugin compatibility with your module format and target
  runtime.

## Best practices

- Start with one plugin and verify build output before stacking
  plugins.
- Keep build-specific behavior isolated from runtime logic.
- Add CI build verification for plugin-based transformations.

## Common mistakes

- Expecting rolldown plugin behavior to affect runtime-only hooks.
- Adding incompatible plugins without testing output.
- Ignoring plugin ordering side effects.
