---
name: commandkit-cache
version: 1.2.0
author: neplextech
emoji: '🗄️'
tags:
  - commandkit
  - cache
  - performance
  - redis
description: >
  Implement deterministic caching with @commandkit/cache. Use for 'use
  cache' directives, cacheTag/cacheLife strategy, revalidateTag
  invalidation, and provider setup for memory or Redis deployments.
---

# CommandKit Cache Plugin

## Activation guidance

Use for read-heavy deterministic workloads and explicit invalidation
design.

## Required filesystem expectations

- plugin registration in `commandkit.config.ts`
- cacheable functions in commands/services/helpers
- optional provider bootstrap module for Redis setup

## Execution workflow

1. Register `cache()` plugin.
2. Add `'use cache'` to deterministic async functions.
3. Design tags and TTLs with clear resource boundaries.
4. Pair writes with `revalidateTag`.
5. Choose memory vs Redis based on deployment topology.

## Guardrails

- Do not cache mutation paths.
- Do not cache sensitive user-specific results without strict key
  design.

## Reference index

| Name                                    | Description                                                  |
| --------------------------------------- | ------------------------------------------------------------ |
| `references/00-filesystem-structure.md` | Cache integration locations and bootstrap placement.         |
| `references/01-directive-use-cache.md`  | Correct directive usage and deterministic function criteria. |
| `references/02-cachetag-cachelife.md`   | Tag strategy, TTL strategy, and invalidation planning.       |
| `references/03-revalidate-tag.md`       | Mutation-side invalidation patterns.                         |
| `references/04-provider-setup.md`       | Memory/Redis provider setup and topology guidance.           |

## Tool index

| Name  | Description                                      |
| ----- | ------------------------------------------------ |
| `N/A` | This skill currently has no helper tool scripts. |
