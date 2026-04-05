---
name: commandkit-workflow
version: 1.2.0
author: neplextech
emoji: '🧭'
tags:
  - commandkit
  - workflow
  - orchestration
  - durability
description: >
  Build durable workflow orchestration with @commandkit/workflow. Use
  for workflow entrypoints, step design, command-triggered workflow
  starts, and long-running stateful process handling.
---

# CommandKit Workflow Plugin

## Activation guidance

Use for multi-step processes that should survive restart and run
reliably.

## Required filesystem expectations

- plugin registration in `commandkit.config.ts`
- workflow files in `src/workflows/**`
- trigger commands/events in `src/app/**`

## Execution workflow

1. Register workflow plugin.
2. Create workflow entrypoint using `'use workflow'`.
3. Create step functions using `'use step'`.
4. Start workflows from commands/events.

## Guardrails

- Keep step boundaries explicit and side effects controlled.
- Keep workflow inputs deterministic and serializable.

## Reference index

| Name                                    | Description                                                  |
| --------------------------------------- | ------------------------------------------------------------ |
| `references/00-filesystem-structure.md` | Workflow/trigger file placement and project layout guidance. |
| `references/01-plugin-setup.md`         | Plugin wiring baseline.                                      |
| `references/02-workflow-and-step.md`    | Entry/step design pattern and best practices.                |
| `references/03-start-workflow.md`       | Starting workflows from command handlers.                    |

## Tool index

| Name  | Description                                      |
| ----- | ------------------------------------------------ |
| `N/A` | This skill currently has no helper tool scripts. |
