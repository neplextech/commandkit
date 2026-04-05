---
name: commandkit-devtools
version: 1.2.0
author: neplextech
emoji: '🛠️'
tags:
  - commandkit
  - devtools
  - debugging
  - local-development
description: >
  Configure and use @commandkit/devtools for local debugging, command
  inspection, and runtime diagnostics during development.
---

# CommandKit Devtools Plugin

## Activation guidance

Use for development-time diagnostics and command/runtime
introspection.

## Required filesystem expectations

- plugin setup in `commandkit.config.ts`
- environment-aware plugin loading logic

## Execution workflow

1. Enable devtools only for development.
2. Configure port/features as needed.
3. Use dashboard findings to target command/event fixes.

## Guardrails

- Never ship devtools enabled in production.
- Keep feature toggles focused to reduce diagnostic noise.

## Reference index

| Name                                    | Description                                  |
| --------------------------------------- | -------------------------------------------- |
| `references/00-filesystem-structure.md` | Placement and environment gate expectations. |
| `references/01-plugin-setup.md`         | Base plugin wiring.                          |
| `references/02-config-options.md`       | Feature and port configuration patterns.     |
| `references/03-dev-only-loading.md`     | Development-only loading pattern.            |

## Tool index

| Name  | Description                                      |
| ----- | ------------------------------------------------ |
| `N/A` | This skill currently has no helper tool scripts. |
