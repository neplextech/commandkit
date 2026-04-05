# 00 filesystem structure

## Purpose

Define a maintainable plugin project layout for runtime and compiler
plugin development.

## When to use

Use when creating plugin source folders, deciding where to register
plugins, or structuring template outputs.

## Filesystem

```txt
project/
  commandkit.config.ts
  src/
    plugins/
      my-runtime-plugin.ts
      my-compiler-plugin.ts
    app/
      commands/
      events/
```

## Example

```ts
// commandkit.config.ts
import { defineConfig } from 'commandkit';

export default defineConfig({
  plugins: [
    // runtime plugin instances or plugin wrappers
  ],
  rolldownPlugins: [
    // optional compiler-time rolldown plugins
  ],
});
```

## Important details

- Keep plugin classes in dedicated plugin directories to avoid mixing
  with app command logic.
- Wire plugins centrally in config for easier auditability.
- Compiler plugin template generation should target valid app source
  paths.

## Best practices

- Keep one plugin class per file.
- Name plugins clearly by behavior (for example
  `logging-runtime-plugin`).
- Keep plugin setup deterministic and side effects explicit.

## Common mistakes

- Spreading plugin registration across multiple unrelated startup
  files.
- Mixing runtime and compiler concerns in a single class.
- Generating templates into non-discovered directories.
