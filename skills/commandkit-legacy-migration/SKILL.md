---
name: commandkit-legacy-migration
version: 1.2.0
author: neplextech
emoji: '♻️'
tags:
  - commandkit
  - legacy
  - migration
  - deprecation
description: >
  Migrate existing projects off @commandkit/legacy to modern
  CommandKit patterns. This skill is migration-only and must not
  promote new legacy adoption.
---

# CommandKit Legacy Migration

## Activation guidance

Use only when legacy plugin usage already exists.

## Required filesystem expectations

- legacy and modern structures may coexist during phased migration
- target end state uses `src/app/commands/**` and `src/app/events/**`

## Execution workflow

1. Detect legacy dependencies and plugin usage.
2. Inventory parity requirements.
3. Migrate incrementally by domain/feature slices.
4. Remove `legacy()` only after parity validation.

## Guardrails

- Never recommend new legacy adoption.
- Keep migration commits small and verifiable.

## Reference index

| Name                                       | Description                                             |
| ------------------------------------------ | ------------------------------------------------------- |
| `references/00-filesystem-structure.md`    | Coexistence strategy and target modern structure.       |
| `references/01-legacy-plugin-detection.md` | How to identify legacy plugin and handler usage points. |
| `references/02-migration-plan-template.md` | Stepwise migration plan template with safety checks.    |

## Tool index

| Name  | Description                                      |
| ----- | ------------------------------------------------ |
| `N/A` | This skill currently has no helper tool scripts. |
