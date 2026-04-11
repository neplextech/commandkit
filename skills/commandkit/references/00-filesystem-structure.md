# 00 filesystem structure

## Purpose

Define required filesystem layout so feature discovery and runtime
bootstrapping work reliably.

## When to use

Use when creating a new project, enabling a plugin, or debugging why
files are not discovered.

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

```txt
project/
  commandkit.config.ts
  src/
    app/
      commands/
      events/
```

```txt
src/
  app/
    components/
    utils/
```

## Hierarchical structure (Advanced)

```txt
src/
  app/
    commands/
      (general)/         # Category (meta-only)
        [workspace]/     # Root command
          command.ts     # Command logic
          {notes}/       # Subcommand group
            group.ts     # Group logic
            add.subcommand.ts  # Subcommand shorthand
```

## Important details

- Use exact API/export names shown in the example.
- Hierarchical tokens:
  - `[name]`: Command directory (requires `command.ts`).
  - `{name}`: Group directory (requires `group.ts`).
  - `(name)`: Category directory (organizational only).
- Keep filesystem placement aligned with enabled plugins and feature
  expectations.
- Preserve deterministic behavior and explicit error handling in
  implementation code.
- CommandKit supports both JavaScript and TypeScript projects and a
  mix of both ESM and CJS module formats.

## Best practices

- Keep snippets as baseline patterns and adapt them to real command
  names and data models.
- Hierarchical commands: Preserve the root-group-sub hierarchy using
  the specialized brackets/braces/parentheses.
- Validate external inputs and permission boundaries before side
  effects.
- Keep setup deterministic so startup behavior is stable across
  environments.

## Common mistakes

- Creating feature files in arbitrary folders not discovered by
  CommandKit.
- Renaming key directories without matching framework conventions.
- Hierarchy bugs: Forgetting `command.ts` inside a `[command]`
  directory or `group.ts` inside a `{group}` directory.
- Missing root config file while expecting auto-discovery to work.
