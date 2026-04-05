# 07 sharding your bot

## Purpose

Provide a safe, practical sharding setup for large Discord bots using
CommandKit + discord.js sharding manager conventions.

## When to use

Use when the bot is approaching high guild counts, has single-process
memory pressure, or needs multi-process scaling.

## Filesystem

```txt
project/
  commandkit.config.ts
  src/
    app.ts
    sharding-manager.ts
```

## Example

```ts
// src/sharding-manager.ts
import { ShardingManager } from 'discord.js';
import { join } from 'node:path';

process.loadEnvFile('./.env');

const manager = new ShardingManager(join(import.meta.dirname, 'index.js'), {
  token: process.env.DISCORD_TOKEN,
  totalShards: 2,
  mode: 'worker',
});

manager.on('shardCreate', (shard) => {
  console.log(`Launched shard ${shard.id}`);
});

await manager.spawn();
```

## Important details

- `src/sharding-manager.ts` is auto-detected by CommandKit and used as
  shard manager entrypoint.
- `index.js` refers to the generated runtime entrypoint used by
  CommandKit in dev/start flows.
- Sharding behavior follows discord.js semantics; CommandKit does not
  redefine core sharding model.

## Best practices

- Keep shard count configurable via environment for deploy
  flexibility.
- Add startup logging for shard creation and failures.
- Centralize shared-state dependencies (cache/queue/ratelimit storage)
  for multi-shard consistency.

## Common mistakes

- Hardcoding shard settings without environment-based overrides.
- Forgetting to load token environment variables before manager
  creation.
- Assuming single-process in-memory state is shared across shards.
