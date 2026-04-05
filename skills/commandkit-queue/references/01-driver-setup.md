# 01 driver setup

## Purpose

Show queue driver bootstrap and one-time initialization.

## When to use

Use when implementing or reviewing this feature in a CommandKit-based project.

## Filesystem

```txt
project/
  src/
    bootstrap/
      queue.ts
    app/
      commands/
      events/
```

## Example

```ts
import Redis from 'ioredis';
import { PubSubRedisBroker } from '@discordjs/brokers';
import { RedisPubSubDriver } from '@commandkit/queue/discordjs';
import { setDriver } from '@commandkit/queue';

const broker = new PubSubRedisBroker(new Redis());
const driver = new RedisPubSubDriver(broker);
setDriver(driver);
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
