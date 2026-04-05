---
name: create-commandkit
version: 1.2.0
author: neplextech
emoji: '🚀'
tags:
  - commandkit
  - scaffolding
  - cli
  - bootstrap
description: >
  Scaffold CommandKit projects with create-commandkit. Use when
  generating a new bot, selecting example templates, package manager
  flags, and reproducible initialization commands.
---

# Create CommandKit CLI

## Activation guidance

Use for greenfield setup, template selection, and first-run onboarding
commands.

## Required filesystem expectations

- generated project root with `package.json`
- `commandkit.config.ts` or `.js`
- `src/app/commands/**` and `src/app/events/**`

## Execution workflow

1. Select bootstrap mode (interactive, defaults, or example).
2. Select package manager and installation flags.
3. Produce copy-paste command and next steps.
4. Verify generated structure before adding features.

## Guardrails

- Prefer official examples for reliable baseline behavior.
- Keep generated instructions deterministic and shell-ready.

## Reference index

| Name                                     | Description                                                         |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `references/00-filesystem-structure.md`  | Expected post-scaffold structure and immediate verification checks. |
| `references/01-bootstrap-commands.md`    | Standard initialization command variants.                           |
| `references/02-example-templates.md`     | Using curated and custom example sources.                           |
| `references/03-package-manager-flags.md` | Package manager and setup flags with selection guidance.            |

## Tool index

| Name                          | Description                                                     |
| ----------------------------- | --------------------------------------------------------------- |
| `tools/recommend-command.mjs` | Generates a recommended scaffold command from simple CLI hints. |
