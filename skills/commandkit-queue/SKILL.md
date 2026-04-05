---
name: commandkit-queue
version: 1.2.0
author: neplextech
emoji: '📬'
tags:
  - commandkit
  - queue
  - messaging
  - redis
description: >
  Build queue-based messaging workflows with @commandkit/queue. Use
  for driver bootstrap, topic/payload contracts, send/receive
  patterns, and resilient consumer handling.
---

# CommandKit Queue Plugin

## Activation guidance

Use for decoupled async communication between bot components/services.

## Required filesystem expectations

- queue bootstrap module (for example `src/bootstrap/queue.ts`)
- producers/consumers in command/event/service layers
- shared payload type module for typed contracts

## Execution workflow

1. Register queue driver once at startup.
2. Define topic naming and payload contracts.
3. Implement send/receive handlers with error strategy.
4. Ensure idempotent consumption behavior.

## Guardrails

- Avoid unstructured payloads.
- Avoid side-effect-heavy consumers without retry/idempotency
  planning.

## Reference index

| Name                                    | Description                                                |
| --------------------------------------- | ---------------------------------------------------------- |
| `references/00-filesystem-structure.md` | Queue bootstrap placement and typed contract organization. |
| `references/01-driver-setup.md`         | Driver setup with Redis PubSub integration.                |
| `references/02-send-and-receive.md`     | Publish/subscribe usage patterns.                          |
| `references/03-typed-events.md`         | Typed message contract approach.                           |

## Tool index

| Name  | Description                                      |
| ----- | ------------------------------------------------ |
| `N/A` | This skill currently has no helper tool scripts. |
