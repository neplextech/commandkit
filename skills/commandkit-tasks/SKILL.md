---
name: commandkit-tasks
version: 1.2.0
author: neplextech
emoji: '⏱️'
tags:
  - commandkit
  - tasks
  - scheduler
  - cron
description: >
  Implement scheduled and dynamic jobs with @commandkit/tasks. Use for
  static task definitions, dynamic task creation, driver setup, and
  resilient job execution patterns.
---

# CommandKit Tasks Plugin

## Activation guidance

Use for recurring jobs, delayed reminders, and background processing
flows.

## Required filesystem expectations

- plugin registration in `commandkit.config.ts`
- static tasks in `src/app/tasks/**`
- driver bootstrap module (for example `src/bootstrap/tasks.ts`)

## Execution workflow

1. Register tasks plugin.
2. Configure and initialize driver.
3. Add static tasks and optional dynamic creation APIs.
4. Add idempotency, error handling, and cancellation support.

## Guardrails

- Keep tasks idempotent where retries are possible.
- Validate dynamic task payload and schedule inputs.

## Reference index

| Name                                       | Description                                           |
| ------------------------------------------ | ----------------------------------------------------- |
| `references/00-filesystem-structure.md`    | Task folder and bootstrap layout expectations.        |
| `references/01-plugin-and-driver-setup.md` | Plugin + driver setup patterns.                       |
| `references/02-static-task.md`             | Static task definition pattern and lifecycle notes.   |
| `references/03-dynamic-task.md`            | Dynamic task scheduling pattern and payload guidance. |
| `references/04-delete-task.md`             | Task cancellation/deletion pattern and safeguards.    |

## Tool index

| Name                               | Description                                  |
| ---------------------------------- | -------------------------------------------- |
| `tools/generate-task-template.mjs` | Prints static or dynamic task template code. |
