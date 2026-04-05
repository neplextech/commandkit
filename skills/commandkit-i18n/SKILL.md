---
name: commandkit-i18n
version: 1.2.0
author: neplextech
emoji: '🌍'
tags:
  - commandkit
  - i18n
  - localization
  - i18next
description: >
  Implement localization with @commandkit/i18n and i18next. Use for
  locale resources, command metadata translations, and locale-aware
  runtime helpers.
---

# CommandKit i18n Plugin

## Activation guidance

Use for multilingual command metadata and translated runtime
responses.

## Required filesystem expectations

- plugin registration in `commandkit.config.ts`
- locale files under `src/app/locales/<locale>/*.json`
- command/event handlers in `src/app/commands/**` and
  `src/app/events/**`

## Execution workflow

1. Register `i18n()` plugin.
2. Build locale directory and translation files.
3. Add `$command` keys for metadata localization.
4. Use `ctx.locale()` in commands and `locale()` in events/utilities.
5. Validate missing-key and fallback behavior.

## Guardrails

- Keep translation keys stable across locales.
- Ensure all required keys exist in baseline locale.

## Reference index

| Name                                             | Description                                               |
| ------------------------------------------------ | --------------------------------------------------------- |
| `references/00-filesystem-structure.md`          | Locale folder layout and naming expectations.             |
| `references/01-plugin-setup.md`                  | Plugin setup baseline.                                    |
| `references/02-locales-structure.md`             | Locale file placement and organization details.           |
| `references/03-command-metadata-localization.md` | `$command` and context menu metadata localization format. |
| `references/04-locale-helpers.md`                | Runtime locale helper usage in commands/events.           |

## Tool index

| Name                             | Description                                                          |
| -------------------------------- | -------------------------------------------------------------------- |
| `tools/generate-locale-file.mjs` | Prints a locale JSON starter template for a command and locale code. |
