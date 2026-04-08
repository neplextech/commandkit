# Hierarchical Commands Implementation Checklist

Status: Draft

Companion to:

- `docs/proposals/hierarchical-commands.md`

## Purpose

This document breaks the hierarchical commands RFC into concrete write
scopes so the work can be planned as issues or delivered in phased PRs
without starting implementation prematurely.

This is intentionally split by subsystem:

- router/compiler
- runtime handler
- registrar
- tests
- docs

## Suggested PR Order

1. characterization tests
2. router/compiler internals
3. runtime route resolution
4. registration integration
5. docs and test-bot examples

The first PR should not change behavior. It should only lock current
behavior into tests.

## 1. Router / Compiler

### Primary write scope

- `packages/commandkit/src/app/router/CommandsRouter.ts`
- `packages/commandkit/src/app/router/index.ts`

### Likely new files

- `packages/commandkit/src/app/router/CommandTree.ts`
- `packages/commandkit/src/app/router/CommandTreeCompiler.ts`
- `packages/commandkit/src/app/router/CommandTreeValidator.ts`

### Checklist

- [ ] Keep the current flat command scan path working unchanged.
- [ ] Add discovery support for `[name]` command directories.
- [ ] Add discovery support for `{name}` group directories.
- [ ] Add discovery support for `*.subcommand.ts` shorthand files.
- [ ] Preserve existing `(Category)` traversal semantics.
- [ ] Distinguish category directories from command/group directories.
- [ ] Build an internal tree representation instead of only flat
      `Command` records.
- [ ] Compile the tree into explicit outputs:
  - registration roots
  - runtime route index
  - middleware index
  - validation diagnostics
- [ ] Keep flat commands compiling through the same pipeline.
- [ ] Validate duplicate sibling tokens.
- [ ] Validate that groups cannot exist at the root.
- [ ] Validate that shorthand and folder-based subcommands cannot
      define the same leaf.
- [ ] Validate Discord nesting constraints on compiled payloads.
- [ ] Decide whether nested categories remain legal inside
      command/group directories and enforce that consistently.
- [ ] Replace same-directory middleware lookup with ancestry-based
      middleware compilation.
- [ ] Preserve current JSON/debug output semantics or update them
      deliberately for the new compiled shape.

### Done when

- Filesystem discovery can represent both flat and hierarchical
  commands.
- A compiled route like `admin.moderation.ban` can be resolved without
  scanning loaded commands by name.
- Middleware chains are precomputed per executable route.

## 2. Runtime Handler

### Primary write scope

- `packages/commandkit/src/app/handlers/AppCommandHandler.ts`
- `packages/commandkit/src/app/commands/Context.ts`
- `packages/commandkit/src/app/commands/MessageCommandParser.ts`

### Checklist

- [ ] Stop resolving chat-input commands by root name only.
- [ ] Build full interaction routes from:
  - `commandName`
  - `getSubcommandGroup(false)`
  - `getSubcommand(false)`
- [ ] Build full prefix routes from:
  - `parser.getCommand()`
  - `parser.getSubcommandGroup()`
  - `parser.getSubcommand()`
- [ ] Resolve the final leaf command from the compiled runtime route
      index.
- [ ] Load middleware from the compiled middleware index, not by
      re-deriving it at runtime.
- [ ] Keep permissions middleware behavior unchanged.
- [ ] Preserve flat command resolution behavior for current apps.
- [ ] Decide whether container `command.ts` files may execute as
      prefix commands in v1 and enforce the rule.
- [ ] Review `resolveMessageCommandName()` and alias lookup so route
      resolution stays unambiguous.
- [ ] Review `Context.commandName`, `Context.invokedCommandName`, and
      `forwardCommand()` for route-aware behavior.
- [ ] Decide whether to add a new full-route context property such as
      `commandRoute`.
- [ ] Keep `AppCommandRunner` changes minimal and limited to consuming
      a resolved leaf command.

### Done when

- Interactions and prefix commands resolve the same leaf route given
  the same logical command path.
- Flat commands still work without any route-specific branching in
  user code.

## 3. Registrar

### Primary write scope

- `packages/commandkit/src/app/register/CommandRegistrar.ts`

### Checklist

- [ ] Stop assuming one loaded command always equals one top-level
      chat input payload.
- [ ] Register compiled root chat-input payloads with nested
      subcommands/groups.
- [ ] Keep pre-generated context menu registration behavior unchanged.
- [ ] Preserve guild/global registration splitting based on metadata.
- [ ] Decide where metadata lives for compiled roots vs executable
      leaf routes.
- [ ] Ensure Discord IDs are still applied to the correct runtime
      objects.
- [ ] Confirm no duplicate payloads are emitted when flat and
      hierarchical commands coexist.
- [ ] Keep plugin pre-registration hooks working with the new payload
      source.

### Done when

- A hierarchical command tree registers as one Discord root command
  payload.
- Context menus remain unaffected.

## 4. Tests

### Primary write scope

- `packages/commandkit/spec/**`

### Likely new files

- `packages/commandkit/spec/commands-router.test.ts`
- `packages/commandkit/spec/hierarchical-commands.test.ts`
- `packages/commandkit/spec/middleware-inheritance.test.ts`
- `packages/commandkit/spec/command-registration.test.ts`

### Checklist

- [ ] Add characterization coverage for current flat discovery.
- [ ] Add characterization coverage for current category behavior.
- [ ] Add characterization coverage for current middleware ordering.
- [ ] Add characterization coverage for current prefix parsing.
- [ ] Add route discovery tests for:
  - flat commands
  - command directories
  - group directories
  - shorthand subcommands
- [ ] Add validation tests for:
  - duplicate sibling tokens
  - illegal root groups
  - illegal mixed primitive options and subcommands
  - shorthand/folder collisions
- [ ] Add runtime resolution tests for:
  - `admin`
  - `admin.ban`
  - `admin.moderation.ban`
- [ ] Add prefix resolution tests for:
  - `!admin:ban`
  - `!admin:moderation:ban`
- [ ] Add middleware inheritance tests across ancestor directories.
- [ ] Add registration tests for nested Discord payload generation.
- [ ] Add coexistence tests proving flat and hierarchical commands can
      load together.
- [ ] Add regression tests for context menu registration so the new
      work does not disturb the existing flow.

### Done when

- The old flat model is protected by characterization tests.
- The new route model is covered end-to-end from discovery to
  registration and execution preparation.

## 5. Docs

### Primary write scope

- `apps/website/docs/guide/02-commands/**`
- `apps/test-bot/src/app/commands/**`

### Checklist

- [ ] Add a guide page for hierarchical commands and filesystem
      syntax.
- [ ] Document the distinction between:
  - categories
  - command directories
  - group directories
  - subcommand shorthand
- [ ] Update middleware docs so inheritance matches actual runtime
      behavior.
- [ ] Document prefix-command route syntax for hierarchical commands.
- [ ] Document any limitations in v1:
  - flat-only context menus
  - deferred external/plugin-injected hierarchy
  - alias rules
- [ ] Add `apps/test-bot` examples for:
  - a root command with grouped subcommands
  - middleware inheritance across levels
  - prefix usage for the same routes
- [ ] Update docs that currently imply all commands are single-file
      flat files.
- [ ] Decide whether API reference updates are needed immediately or
      only after public types change.

### Done when

- The new filesystem grammar is discoverable from the guide.
- The example app demonstrates the intended structure.

## Cross-Cutting Decisions To Settle Before Coding

- [ ] Finalize the filesystem grammar:
  - `[name]`
  - `{name}`
  - `*.subcommand.ts`
- [ ] Decide whether container nodes are executable for prefix
      commands.
- [ ] Decide whether nested categories are legal inside command/group
      directories.
- [ ] Decide alias behavior for leaf subcommands.
- [ ] Decide whether context should expose a full route API in v1.
- [ ] Decide how plugin/external flat injection coexists with the new
      compiled route model in the short term.

## Release Gate

The feature is ready for merge only when all of the following are
true:

- [ ] flat commands are behaviorally unchanged
- [ ] hierarchical commands resolve by full route
- [ ] middleware inheritance is deterministic and tested
- [ ] Discord registration emits correct nested payloads
- [ ] docs and example usage are updated
- [ ] context menu behavior is unchanged
