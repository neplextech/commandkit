---
name: commandkit-ai
version: 1.2.0
author: neplextech
emoji: '🤖'
tags:
  - commandkit
  - ai
  - tools
  - llm
description: >
  Build AI-powered command flows with @commandkit/ai. Use for model
  selection, message filtering, schema-backed AI commands, and safe
  tool-calling behavior.
---

# CommandKit AI Plugin

## Activation guidance

Use when implementing natural-language command execution or AI tool
orchestration.

## Required filesystem expectations

- plugin registration in `commandkit.config.ts`
- AI runtime config in `src/ai.ts` or `src/ai.js`
- AI-enabled command files in `src/app/commands/**`

## Execution workflow

1. Register `ai()` plugin.
2. Configure `configureAI()` in `src/ai.*`.
3. Implement `aiConfig` schema and `ai` command handlers.
4. Add tool registration and robust error handling.
5. Validate trigger filter, permissions, and response safety.

## Guardrails

- Never hardcode API keys.
- Treat AI output as untrusted input for sensitive operations.
- Keep tool descriptions explicit and narrow.

## Reference index

| Name                                    | Description                                                    |
| --------------------------------------- | -------------------------------------------------------------- |
| `references/00-filesystem-structure.md` | File layout and export expectations for AI-enabled projects.   |
| `references/01-plugin-setup.md`         | Minimal plugin wiring in config.                               |
| `references/02-configure-ai-model.md`   | Model selection, message filters, and runtime option patterns. |
| `references/03-ai-command-schema.md`    | Typed schema + AI command implementation pattern.              |
| `references/04-custom-tools.md`         | Tool creation and safe exposure patterns.                      |

## Tool index

| Name                                     | Description                                                           |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `tools/generate-ai-command-template.mjs` | Prints a starter AI command template with schema and handler exports. |
