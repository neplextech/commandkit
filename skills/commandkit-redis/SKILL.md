---
name: commandkit-redis
version: 1.2.0
author: neplextech
emoji: '🧠'
tags:
  - commandkit
  - redis
  - cache
  - distributed-systems
description: >
  Add Redis-backed shared infrastructure with @commandkit/redis for
  cache, mutex, semaphore, and distributed state patterns.
---

# CommandKit Redis Integrations

## Activation guidance

Use for multi-instance or distributed coordination scenarios.

## Required filesystem expectations

- central Redis bootstrap module (for example
  `src/bootstrap/redis.ts`)
- plugin/provider wiring in startup or config layer

## Execution workflow

1. Initialize Redis client with env-based config.
2. Wire cache provider and/or synchronization storages.
3. Validate behavior across multiple runtime instances.

## Guardrails

- Keep credentials out of source control.
- Keep key naming/TTL conventions explicit and documented.

## Reference index

| Name                                       | Description                                                   |
| ------------------------------------------ | ------------------------------------------------------------- |
| `references/00-filesystem-structure.md`    | Redis bootstrap and integration layout strategy.              |
| `references/01-plugin-setup.md`            | Plugin-based Redis cache integration.                         |
| `references/02-manual-cache-provider.md`   | Manual cache provider wiring with custom Redis client.        |
| `references/03-redis-mutex-storage.md`     | Distributed lock patterns with Redis mutex storage.           |
| `references/04-redis-semaphore-storage.md` | Distributed concurrency control with Redis semaphore storage. |

## Tool index

| Name  | Description                                      |
| ----- | ------------------------------------------------ |
| `N/A` | This skill currently has no helper tool scripts. |
