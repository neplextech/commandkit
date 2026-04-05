---
name: commandkit-analytics
version: 1.2.0
author: neplextech
emoji: '📈'
tags:
  - commandkit
  - analytics
  - posthog
  - umami
description: >
  Instrument CommandKit bots with @commandkit/analytics. Use for
  provider setup, event taxonomy, runtime telemetry controls, and
  privacy-aware analytics design.
---

# CommandKit Analytics Plugin

## Activation guidance

Use for analytics provider setup and event instrumentation strategy.

## Required filesystem expectations

- provider plugin registration in `commandkit.config.ts`
- tracking calls in commands/events/middleware where business events
  occur

## Execution workflow

1. Choose provider (`posthog` or `umami`).
2. Define stable event names and payload fields.
3. Instrument meaningful lifecycle events.
4. Apply selective suppression with `noAnalytics()` where needed.

## Guardrails

- Do not collect secrets or unnecessary personal data.
- Keep event schemas stable to preserve reporting quality.

## Reference index

| Name                                    | Description                                                  |
| --------------------------------------- | ------------------------------------------------------------ |
| `references/00-filesystem-structure.md` | Integration locations and analytics architecture boundaries. |
| `references/01-posthog-setup.md`        | PostHog provider setup pattern.                              |
| `references/02-umami-setup.md`          | Umami provider setup pattern.                                |
| `references/03-track-events.md`         | Event tracking conventions and examples.                     |
| `references/04-no-analytics-scope.md`   | Request-level telemetry suppression pattern.                 |

## Tool index

| Name  | Description                                      |
| ----- | ------------------------------------------------ |
| `N/A` | This skill currently has no helper tool scripts. |
