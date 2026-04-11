# AGENTS.md

This file is the operational guide for coding agents working in the
CommandKit monorepo.

## Repository layout

- Monorepo managed with `pnpm` workspaces + Turborepo.
- Workspace roots:
  - `packages/*` - published/core packages
  - `apps/*` - first-party apps (docs site, test bot, etc.)
- Key project used as real-world reference:
  - `apps/test-bot` - practical CommandKit usage patterns (plugins,
    JSX components, tasks, workflow, ratelimit, i18n, sharding manager
    pattern)

## First source of truth for agents

Use the skills in `skills/` first, then confirm with code and docs.

- Skills index: `skills/README.md`
- Core framework skill: `skills/commandkit/SKILL.md`
- Plugin development skill:
  `skills/commandkit-plugin-development/SKILL.md`

Each skill includes:

- `SKILL.md` with activation guidance and reference/tool tables
- `references/*.md` with implementation details and best practices
- optional `tools/*.mjs` helper generators/validators

## CommandKit conventions to preserve

When editing CommandKit projects (especially `apps/test-bot`),
preserve convention-based discovery:

- Config file at root: `commandkit.config.ts` (or `.js`)
- App entrypoint: `src/app.ts` (exports discord.js client)
- Commands: `src/app/commands/**`
- Hierarchical Discovery Tokens:
  - `[command]` - top-level command directory
  - `{group}` - subcommand group directory
  - `(category)` - organizational category directory
  - `command.ts` / `group.ts` - definition files
  - `<name>.subcommand.ts` - subcommand shorthand
- Events: `src/app/events/**`

- Optional feature paths:
  - i18n: `src/app/locales/**`
  - tasks: `src/app/tasks/**`
  - workflow: `src/workflows/**`
  - ratelimit runtime config: `ratelimit.ts`
  - sharding manager: `src/sharding-manager.ts`

Important middleware naming conventions:

- `+global-middleware.ts`
- `+middleware.ts`
- `+<command>.middleware.ts`

## Preferred implementation workflow

1. Identify the target package/app and relevant skill in `skills/`.
2. Read the corresponding `references/*.md` for exact patterns.
3. Mirror existing local conventions (from nearby files) before
   introducing new structures.
4. Make minimal, focused changes.
5. Validate with the appropriate command(s).

## Validation commands

From repo root:

- Install deps: `pnpm install`
- Build packages: `pnpm build`
- Type-check packages: `pnpm check-types`
- Format codebase: `pnpm format`
- Check formatting only: `pnpm prettier:check`

For app-level verification (example test bot):

- `pnpm --filter test-bot dev`
- `pnpm --filter test-bot build`
- `pnpm --filter test-bot start`

## Documentation and guide alignment

When adding or changing behavior, keep docs alignment in mind:

- Guide docs: `apps/website/docs/guide/**`
- API reference docs: `apps/website/docs/api-reference/**`

If you add new user-facing behavior in packages, update the relevant
guide and/or API reference pages.

## Plugin development guidance

For creating CommandKit plugins:

- Runtime plugin patterns:
  `skills/commandkit-plugin-development/references/01-runtime-plugin-basics.md`
- Runtime hook mapping:
  `skills/commandkit-plugin-development/references/02-runtime-hooks-reference.md`
- Compiler transforms:
  `skills/commandkit-plugin-development/references/03-compiler-plugin-transform.md`
- Template extension hooks:
  `skills/commandkit-plugin-development/references/04-template-registration.md`
- Rolldown integration:
  `skills/commandkit-plugin-development/references/05-rolldown-plugins.md`

## Safety and quality rules

- Do not introduce APIs that are not already present in the
  codebase/docs unless explicitly asked.
- Do not break convention-based file discovery paths.
- Keep changes backward-compatible unless the task explicitly requires
  a breaking change.
- Prefer explicit error handling in runtime hooks and long-running
  workflows.
- For interactive JSX components, use valid interaction patterns
  (`onClick` for interactive buttons, link buttons with `url` +
  `ButtonStyle.Link`).

## Git hygiene

- Do not revert unrelated user changes.
- Keep commits scoped and descriptive when asked to commit.
- Avoid destructive git operations unless explicitly requested.
