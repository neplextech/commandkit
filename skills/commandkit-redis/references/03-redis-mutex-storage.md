# 03 redis mutex storage

## Purpose

Show distributed mutex integration pattern.

## When to use

Use when implementing or reviewing this feature in a CommandKit-based project.

## Filesystem

```txt
project/
  commandkit.config.ts
  src/
    bootstrap/
      redis.ts
```

## Example

```ts
import { createMutex } from 'commandkit/mutex';
import { RedisMutexStorage } from '@commandkit/redis';
import { Redis } from 'ioredis';

const redis = new Redis();
const mutex = createMutex({
  timeout: 30000,
  storage: new RedisMutexStorage(redis),
});

await mutex.withLock('shared-resource', async () => {
  await updateSharedResource();
});
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
