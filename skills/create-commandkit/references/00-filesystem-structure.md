# 00 filesystem structure

## Purpose

Define required filesystem layout so feature discovery and runtime bootstrapping work reliably.

## When to use

Use when creating a new project, enabling a plugin, or debugging why files are not discovered.

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

```txt
my-bot/
  package.json
  commandkit.config.ts
  src/
    app/
      commands/
      events/
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

- Creating feature files in arbitrary folders not discovered by CommandKit.
- Renaming key directories without matching framework conventions.
- Missing root config file while expecting auto-discovery to work.
