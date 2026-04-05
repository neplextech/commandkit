# CommandKit Skills Index

This directory contains self-contained skills for public CommandKit
packages and development workflows.

Each skill folder includes:

- `SKILL.md` for activation and execution behavior
- `README.md` for human-facing scope and usage notes
- `references/*.md` for feature-specific snippets, filesystem
  expectations, important details, and best practices
- optional `tools/*.mjs` JavaScript helpers with shebang for
  repeatable utility tasks

`SKILL.md` files include tabular indexes for references and tools,
with name + description columns.

## Included skills

- `skills/commandkit`
- `skills/create-commandkit`
- `skills/commandkit-ai`
- `skills/commandkit-analytics`
- `skills/commandkit-cache`
- `skills/commandkit-devtools`
- `skills/commandkit-i18n`
- `skills/commandkit-legacy-migration`
- `skills/commandkit-queue`
- `skills/commandkit-ratelimit`
- `skills/commandkit-redis`
- `skills/commandkit-tasks`
- `skills/commandkit-workflow`
- `skills/commandkit-plugin-development`

## Excluded internal packages

- `@commandkit/devtools-ui` (private internal UI package)
- `tsconfig` (private internal tooling package)

## Legacy policy

`@commandkit/legacy` is represented only by a migration-focused skill.
It should be used to move existing projects to modern CommandKit
patterns, not to encourage new legacy adoption.
