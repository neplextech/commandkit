# 09 manual setup

## Purpose

Provide a full manual setup blueprint for CommandKit projects without
using scaffolding CLI.

## When to use

Use when integrating CommandKit into an existing repo or when custom
project bootstrap is required.

## Filesystem

```txt
project/
  commandkit.config.ts
  src/
    app.ts
    app/
      commands/
      events/
```

## Example

```ts
// commandkit.config.ts
import { defineConfig } from 'commandkit';

export default defineConfig({});
```

```ts
// src/app.ts
import { Client } from 'discord.js';

const client = new Client({ intents: ['Guilds'] });
export default client;
```

```ts
// src/app/commands/ping.ts
import type { CommandData, ChatInputCommand, MessageCommand } from 'commandkit';

export const command: CommandData = {
  name: 'ping',
  description: 'Pong!',
};

export const chatInput: ChatInputCommand = async ({ interaction }) => {
  await interaction.reply('Pong!');
};

export const message: MessageCommand = async ({ message }) => {
  await message.reply('Pong!');
};
```

## Important details

- Do not call `client.login()` manually; CommandKit handles login.
- Bot token should come from `DISCORD_TOKEN` or `TOKEN`, or be
  assigned to `client.token` explicitly.
- Development/build artifacts (`.commandkit`, `dist`) should be
  ignored by version control.

## Best practices

- Verify manual setup with `commandkit dev` before adding plugins.
- Add one command and one event first to validate discovery.
- Keep env handling explicit and consistent across local/CI/prod.

## Common mistakes

- Creating config and entrypoint but missing `src/app/commands` or
  `src/app/events`.
- Trying to log in client manually and conflicting with CommandKit
  lifecycle.
- Committing generated build/dev folders.
