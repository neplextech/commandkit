# 05 middlewares

## Purpose

Describe middleware scopes, ordering, and safe cross-cutting usage
patterns.

## When to use

Use when you need auth/logging/validation before or after command
execution.

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
import type { MiddlewareContext } from 'commandkit';

export function beforeExecute(ctx: MiddlewareContext) {
  console.log(
    `User ${ctx.interaction.user.id} is about to execute a command`,
  );
}

export function afterExecute(ctx: MiddlewareContext) {
  console.log(
    `Command execution completed for user ${ctx.interaction.user.id}`,
  );
}
```

## Important details

- Middleware variants:
  - `+global-middleware.ts`: Applies to all commands in tree.
  - `+middleware.ts`: Applies to current directory commands.
  - `+<name>.middleware.ts`: Applies to specific command only.
- Inheritance: Subcommands inherit all global and directory-level
  middlewares from their parents in the hierarchy.
- Use exact API/export names shown in the example.
- Keep filesystem placement aligned with enabled plugins and feature
  expectations.
- Preserve deterministic behavior and explicit error handling in
  implementation code.

## Best practices

- Use `+global-middleware.ts` for cross-cutting logic like audit
  logging.
- Use `+middleware.ts` in `{group}` folders for group-specific auth.
- Keep snippets as baseline patterns and adapt them to real command
  names and data models.
- Validate external inputs and permission boundaries before side
  effects.
- Keep setup deterministic so startup behavior is stable across
  environments.

## Common mistakes

- Breaking middleware inheritance by misnaming files.
- Skipping validation for user-provided inputs before side effects.
- Changing structure/config without verifying companion files.
- Copying snippets without adapting identifiers and environment
  values.
