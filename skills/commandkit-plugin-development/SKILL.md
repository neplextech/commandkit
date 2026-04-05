---
name: commandkit-plugin-development
version: 1.0.0
author: neplextech
emoji: '🧩'
tags:
  - commandkit
  - plugins
  - runtime-plugin
  - compiler-plugin
  - rolldown
description: >
  Create CommandKit plugins for runtime and compiler extension points.
  Use when implementing RuntimePlugin hooks, CompilerPlugin
  transforms, template registration, or rolldownPlugins-based compiler
  customization.
---

# CommandKit Plugin Development

## Activation guidance

Use when building custom plugins that modify CommandKit runtime
behavior, command registration flow, or source compilation.

## Required filesystem expectations

- plugin source files in project plugin directory (for example
  `src/plugins/**`)
- plugin wiring in `commandkit.config.ts`
- optional template output targets under application source tree

## Execution workflow

1. Decide plugin type: runtime vs compiler.
2. Implement focused plugin class with explicit hook usage.
3. Register plugin in config and validate lifecycle behavior.
4. Add logging/tests for hook behavior and failure modes.

## Guardrails

- Keep plugin scope narrow and explicit.
- Avoid heavy side effects in hot hooks.
- For compiler plugins, preserve code correctness and source maps when
  transforming.

## Reference index

| Name                                         | Description                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| `references/00-filesystem-structure.md`      | Plugin folder layout and config wiring expectations.                         |
| `references/01-runtime-plugin-basics.md`     | RuntimePlugin class setup and minimal lifecycle hook usage.                  |
| `references/02-runtime-hooks-reference.md`   | Practical mapping of major runtime hooks and when to use each.               |
| `references/03-compiler-plugin-transform.md` | CompilerPlugin transform pipeline and safe transform patterns.               |
| `references/04-template-registration.md`     | Registering/unregistering `commandkit create` templates in compiler plugins. |
| `references/05-rolldown-plugins.md`          | Using `rolldownPlugins` in config for compiler-time extension.               |

## Tool index

| Name                                          | Description                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| `tools/generate-runtime-plugin-template.mjs`  | Prints a minimal RuntimePlugin template with typed hook signatures.           |
| `tools/generate-compiler-plugin-template.mjs` | Prints a minimal CompilerPlugin template including transform method skeleton. |
