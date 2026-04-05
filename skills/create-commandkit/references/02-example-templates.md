# 02 example templates

## Purpose

Show how to scaffold from official or custom examples.

## When to use

Use when implementing or reviewing this feature in a CommandKit-based project.

## Filesystem

```txt
new-project/
  package.json
  commandkit.config.ts
  src/
    app/
      commands/
      events/
```

## Example

```sh
# curated
npx create-commandkit@latest --example basic-ts

# custom repository
npx create-commandkit@latest --example "https://github.com/user/repo"

# custom path within repository
npx create-commandkit@latest --example "https://github.com/user/repo" --example-path "examples/bot"
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
