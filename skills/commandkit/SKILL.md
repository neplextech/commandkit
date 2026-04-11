---
name: commandkit
version: 1.2.0
author: neplextech
emoji: '🧰'
tags:
  - commandkit
  - discordjs
  - framework
  - commands
  - events
  - hierarchical-commands
description: >
  Build and maintain Discord bots with CommandKit core conventions.
  Use when implementing command/event architecture (including
  hierarchical subcommands), middleware chains, JSX components, and
  commandkit.config setup for plugin-based features.
---

# CommandKit Core

## Activation guidance

Use this skill for framework-level architecture and implementation:

- command and event file placement
- commandkit.config strategy and plugin wiring
- middleware lifecycle behavior
- JSX interaction components and handlers
- project structure validation and migration to convention-based
  layouts

## Required filesystem expectations

- `commandkit.config.ts` (or `.js`) at project root
- `src/app/commands/**` for commands
- `src/app/events/**` for events
- optional plugin-specific folders (`src/app/locales`,
  `src/app/tasks`, `src/workflows`) when those plugins are enabled

## Configuration expectations

- Use `defineConfig` from `commandkit/config`.
- Register plugins explicitly in `plugins: []`.
- Use startup guards like `noBuildOnly()` for runtime-only setup (for
  example task/driver init).
- Keep environment-sensitive plugin toggles explicit (for example
  devtools in development only).

## Execution workflow

1. Validate structure and baseline config first.
2. Place command/event files in convention paths.
3. Implement command logic with typed context and metadata.
4. Add middleware only for cross-cutting concerns.
5. Verify runtime behavior with local dev command.

## Guardrails

- Do not invent CommandKit APIs.
- Avoid registration-heavy patterns that bypass convention discovery.
- Keep handlers small and move reusable logic to helpers/services.

## Reference index

| Name                                       | Description                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `references/00-filesystem-structure.md`    | Canonical project layout, required paths, and structure validation guidance.                |
| `references/01-config-and-structure.md`    | Detailed config patterns, plugin wiring strategies, and config recipes by task.             |
| `references/02-chat-input-command.md`      | Baseline slash command pattern with metadata and response handling.                         |
| `references/03-event-handler.md`           | Event listener conventions and lifecycle best practices.                                    |
| `references/04-jsx-components.md`          | Valid JSX component patterns (including interactive handlers) based on real project usage.  |
| `references/05-middlewares.md`             | Global, directory, and command-specific middleware patterns and ordering.                   |
| `references/06-config-recipes.md`          | Task-oriented config recipes for common bot setups (core only, AI, cache, tasks, workflow). |
| `references/07-sharding-your-bot.md`       | Sharding manager setup, entrypoint behavior, and scale-related shard planning.              |
| `references/08-file-naming-conventions.md` | Special filenames/directories CommandKit auto-discovers and how they affect runtime.        |
| `references/09-manual-setup.md`            | Full manual setup flow for config, app entrypoint, commands, events, and run/build/start.   |
| `references/10-cli-api.md`                 | Advanced programmatic CLI API usage patterns and constraints.                               |

## Tool index

| Name                        | Description                                                                 |
| --------------------------- | --------------------------------------------------------------------------- |
| `tools/check-structure.mjs` | Checks whether required core CommandKit paths exist in the current project. |
