---
name: commandkit-ratelimit
version: 1.2.0
author: neplextech
emoji: '🚦'
tags:
  - commandkit
  - ratelimit
  - abuse-prevention
  - redis
description: >
  Configure advanced abuse protection with @commandkit/ratelimit. Use
  for runtime defaults, command-level policy, directive usage, storage
  strategy, and user-facing cooldown behavior.
---

# CommandKit Ratelimit Plugin

## Activation guidance

Use when protecting commands from abuse while keeping user UX
predictable.

## Required filesystem expectations

- plugin registration in `commandkit.config.ts`
- runtime config bootstrap in `ratelimit.ts` or `ratelimit.js`
- optional per-command metadata in command files

## Execution workflow

1. Define runtime defaults with `configureRatelimit`.
2. Register plugin in config.
3. Apply command-level overrides or directive-based limits.
4. Configure memory/redis/fallback storage based on deployment.
5. Validate limited responses and retry timing.

## Guardrails

- Balance burst and sustained limits.
- Avoid policy that blocks legitimate normal usage.

## Reference index

| Name                                          | Description                                         |
| --------------------------------------------- | --------------------------------------------------- |
| `references/00-filesystem-structure.md`       | Required ratelimit bootstrap/config file placement. |
| `references/01-runtime-config.md`             | Runtime defaults and initialization pattern.        |
| `references/02-plugin-setup.md`               | Plugin wiring and startup ordering expectations.    |
| `references/03-command-metadata-ratelimit.md` | Command-level metadata policy examples.             |
| `references/04-use-ratelimit-directive.md`    | Function directive usage and error handling.        |
| `references/05-storage-options.md`            | Memory/Redis storage strategy and deployment fit.   |

## Tool index

| Name                                  | Description                                                       |
| ------------------------------------- | ----------------------------------------------------------------- |
| `tools/generate-ratelimit-config.mjs` | Prints a baseline `configureRatelimit()` runtime config template. |
