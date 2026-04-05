# 08 file naming conventions

## Purpose

Document CommandKit special filenames and directory conventions that
control discovery and execution behavior.

## When to use

Use when creating new files, reorganizing command/event trees, or
debugging why handlers are not being discovered.

## Filesystem

```txt
src/
  app.ts
  app/
    commands/
      +global-middleware.ts
      +middleware.ts
      +<command>.middleware.ts
    events/
      <eventName>/
        <handler>.ts
```

## Example

```ts
// src/app.ts
import { Client } from 'discord.js';

const client = new Client({ intents: ['Guilds'] });
export default client;
```

```ts
// src/app/commands/+middleware.ts
import type { MiddlewareContext } from 'commandkit';

export function beforeExecute(ctx: MiddlewareContext) {
  console.log(`before ${ctx.command.name}`);
}
```

## Important details

- `src/app.ts` must export the discord.js client instance.
- Command categories use parenthesized directories (for example
  `(Moderation)`) for organization.
- Middleware filename variants define global, directory-scoped, and
  command-scoped behavior.

## Best practices

- Use descriptive, stable command filenames and folder categories.
- Keep middleware naming exact (`+middleware`, `+global-middleware`,
  `+<command>.middleware`).
- Keep event handlers inside event-name folders to preserve discovery
  consistency.

## Common mistakes

- Placing handlers in custom paths not recognized by convention
  discovery.
- Misspelling middleware filename prefixes/signatures.
- Forgetting to export default client from `src/app.ts`.
