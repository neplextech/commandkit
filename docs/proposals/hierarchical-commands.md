# Hierarchical Commands RFC

Status: Draft

## Summary

This RFC proposes a filesystem-based hierarchical command system for
CommandKit that adds native support for subcommands and subcommand
groups without breaking the current flat command model.

The current codebase already supports:

- flat command discovery from `src/app/commands/**`
- flat command loading and registration
- message-command parsing of `command:subcommand` and
  `command:group:subcommand`
- Discord-native subcommands when a developer manually builds them in
  a single command file

What is missing is framework-level support for discovering,
validating, registering, and executing hierarchical commands from the
filesystem.

This RFC introduces an internal command tree and compiler layer
between filesystem discovery and runtime execution. Existing flat
commands continue to work unchanged.

## Motivation

Today, hierarchical commands are not a first-class framework feature.

The current implementation is built around a flat `Command` record:

- `packages/commandkit/src/app/router/CommandsRouter.ts`
- `packages/commandkit/src/app/handlers/AppCommandHandler.ts`
- `packages/commandkit/src/app/register/CommandRegistrar.ts`

Important constraints in the current code:

- `CommandsRouter.scan()` returns a flat command list.
- `CommandsRouter` only treats `(Category)` directories as special.
- `CommandsRouter` still has a `TODO: handle subcommands`.
- `AppCommandHandler.prepareCommandRun()` resolves commands by root
  name.
- `CommandRegistrar.getCommandsData()` assumes one loaded command maps
  to one top-level Discord payload, plus context-menu siblings.
- Message parsing already extracts `subcommand` and `subcommandGroup`,
  but that data is not used for route resolution.

This creates a mismatch:

- the parser understands routes
- Discord understands routes
- the filesystem and runtime model do not

Large bots then end up packing many related subcommands into one file,
which hurts discoverability, middleware scoping, and long-term
maintenance.

## Goals

- Add native filesystem discovery for hierarchical chat-input
  commands.
- Keep existing flat command files working as-is.
- Keep existing category directories working as-is.
- Keep the current execution lifecycle and middleware hooks.
- Make middleware inheritance follow route ancestry.
- Support both directory-based subcommands and a shorthand file
  suffix.
- Compile the tree into a registration payload set and a runtime route
  index.

## Non-goals

- No breaking change to flat commands.
- No hierarchy for context menu commands.
- No change to the public command file contract for flat command
  files.
- No first-pass support for hierarchical external/plugin-injected
  commands.
- No change to `AppCommandRunner`'s execution flow beyond consuming a
  resolved leaf route.

## Current State

### Discovery

`CommandsRouter` currently recognizes:

- flat command files such as `ping.ts`
- middleware files such as `+middleware.ts`, `+global-middleware.ts`,
  and `+ping.middleware.ts`
- category directories such as `(Moderation)`

It does not currently recognize command directories, subcommand
groups, or subcommand shorthand files.

### Runtime resolution

`AppCommandHandler.prepareCommandRun()` currently resolves only the
root command name:

- for interactions: `source.commandName`
- for prefix commands: the first token returned by
  `MessageCommandParser`

The parsed subcommand fields are not used to select a leaf command.

### Registration

`CommandRegistrar.getCommandsData()` currently flattens loaded
commands into Discord registration payloads. That model works for flat
slash commands and context menus, but it is not expressive enough for
a compiled route tree.

### Middleware

The docs describe directory middleware as applying to subdirectories,
but the current router only applies middleware from the same
directory, plus global and command-specific middleware. This RFC
treats ancestry inheritance as part of the hierarchical command work
so the runtime matches the documented mental model.

## Proposed Filesystem Grammar

### Existing flat commands remain valid

These remain unchanged:

```txt
src/app/commands/
  ping.ts
  (Moderation)/
    ban.ts
```

### New hierarchical command syntax

This RFC proposes a Windows-safe syntax:

```txt
src/app/commands/
  [admin]/
    command.ts

    {moderation}/
      group.ts
      ban.subcommand.ts

      [kick]/
        command.ts
```

This maps to:

- `/admin moderation ban`
- `/admin moderation kick`

### Naming rules

- `(Category)` keeps its current meaning and remains purely
  organizational.
- `[name]` defines a command node directory.
- `{name}` defines a subcommand-group directory.
- `command.ts` defines a command node.
- `group.ts` defines a group node.
- `<name>.subcommand.ts` defines a leaf subcommand shorthand in the
  containing command or group directory.

Examples:

- `[admin]/command.ts` defines the root command `admin`
- `{moderation}/group.ts` defines the group `moderation`
- `ban.subcommand.ts` defines the subcommand `ban`
- `[kick]/command.ts` defines the subcommand `kick`

### Why this syntax

The initial proposal used angle-bracket directories for subcommands.
That is not portable because `<` and `>` are invalid in Windows
filenames.

This RFC uses only syntax that is valid on Windows and does not
collide with the existing `(Category)` convention.

## Semantics

### Executable vs non-executable nodes

- Flat command files remain executable leaves.
- A root command with children is a non-executable container for
  Discord chat-input registration and route metadata.
- A group node is a non-executable container.
- A leaf subcommand is executable.

This means a hierarchical `command.ts` may define metadata without
being directly executable when children exist.

### File export expectations

To minimize new API surface:

- `command.ts` continues using the existing command-file export shape.
- `group.ts` reuses the same `command` metadata pattern, but it must
  not export executable handlers.
- Leaf files must still export at least one executable handler.

Validation rules determine whether a node is allowed to have handlers
based on its compiled role.

### Prefix command syntax

Message-command routing keeps the current colon-delimited syntax:

- `!admin:ban`
- `!admin:moderation:ban`

This avoids introducing a new ambiguous parser grammar for
space-delimited prefix commands.

## Internal Model

The implementation should stop treating filesystem discovery as the
final command shape.

### Stage 1: raw tree discovery

Introduce an internal tree model:

```ts
type CommandTreeNodeKind =
  | 'root'
  | 'command'
  | 'group'
  | 'subcommand';

interface CommandTreeNode {
  id: string;
  kind: CommandTreeNodeKind;
  token: string;
  route: string[];
  fsPath: string;
  definitionPath: string | null;
  parentId: string | null;
  childIds: string[];
  category: string | null;
  inheritedDirectories: string[];
  shorthand: boolean;
}
```

Notes:

- `token` is one path segment such as `admin` or `ban`.
- `route` is the full route token list.
- `definitionPath` is null for synthetic/internal nodes if needed.
- `category` preserves the existing `(Category)` behavior.

### Stage 2: compile outputs

Compile the tree into explicit outputs:

- `registrationRoots`
  - root chat-input command payloads with nested options
- `runtimeRouteIndex`
  - `admin`
  - `admin.ban`
  - `admin.moderation.ban`
- `middlewareIndex`
  - full ordered middleware chain per executable route
- `validationDiagnostics`
  - structural and Discord-shape errors

The key design point is this:

`CommandsRouter` should no longer be responsible for producing the
same shape that runtime execution consumes.

## Discovery Rules

### Categories

- `(Category)` directories remain supported exactly as they work
  today.
- Category directories may contain flat commands, hierarchical command
  directories, middleware, and nested categories.
- Categories do not become command nodes.

### Command directories

- `[name]/command.ts` defines a command node.
- A command directory may contain:
  - subcommand groups
  - subcommands
  - middleware
  - nested category directories
- A command directory with children is a container command.

### Group directories

- `{name}/group.ts` defines a subcommand group node.
- A group directory may contain:
  - subcommands
  - middleware
  - nested categories if explicitly supported by implementation

### Subcommand shorthand

- `<name>.subcommand.ts` defines a leaf subcommand in the containing
  command or group directory.
- It is equivalent to `[name]/command.ts`.
- It cannot define a group.
- It cannot have child nodes.

## Validation Rules

Validation should happen before loading executable modules.

### Structural rules

- Duplicate sibling tokens are not allowed.
- A group cannot exist at the root of `src/app/commands`.
- A subcommand cannot have children.
- A shorthand subcommand cannot coexist with `[name]/command.ts` in
  the same parent scope.
- A container command cannot also behave like a flat executable
  command for chat-input registration.

### Handler rules

- Group nodes cannot export executable handlers.
- Non-leaf hierarchical command nodes cannot export `chatInput` or
  `autocomplete` handlers.
- Leaf hierarchical nodes may export `chatInput`, `autocomplete`, and
  `message`.
- Context-menu handlers remain flat-only in v1.

### Discord-shape rules

- Root commands can contain either subcommands or groups, matching
  Discord constraints.
- Root commands cannot mix direct primitive options with subcommands.
- Group nodes can only contain subcommands.
- Name and description constraints must be validated on compiled
  payloads, not only raw files.

## Middleware Inheritance

Middleware should be compiled per executable route in ancestry order.

### Ordering

For a route like `admin.moderation.ban`, the middleware order should
be:

1. global middleware
2. ancestor directory middleware from outermost to innermost
3. leaf-directory middleware
4. command-specific middleware for the leaf token
5. built-in permissions middleware

Example:

```txt
src/app/commands/
  +global-middleware.ts
  [admin]/
    +middleware.ts
    {moderation}/
      +middleware.ts
      +ban.middleware.ts
      ban.subcommand.ts
```

Compiled middleware chain for `admin.moderation.ban`:

1. `+global-middleware.ts`
2. `[admin]/+middleware.ts`
3. `{moderation}/+middleware.ts`
4. `{moderation}/+ban.middleware.ts`
5. permissions middleware

This also fixes the current mismatch between docs and implementation
for directory ancestry.

## Runtime Resolution

### Interactions

For chat-input interactions, build the route from:

- `interaction.commandName`
- `interaction.options.getSubcommandGroup(false)`
- `interaction.options.getSubcommand(false)`

Then resolve the compiled leaf route from `runtimeRouteIndex`.

### Prefix commands

For message commands, build the route from:

- `parser.getCommand()`
- `parser.getSubcommandGroup()`
- `parser.getSubcommand()`

Resolution should use the full route, not only the root command.

### Execution

`AppCommandRunner` should continue executing a prepared leaf command.
The main change is in how `prepareCommandRun()` resolves the target
and builds the middleware chain.

## Registration Model

Hierarchical filesystem commands should compile into top-level Discord
chat-input payloads.

Example compiled registration output:

```txt
[admin]/command.ts
  {moderation}/group.ts
    ban.subcommand.ts
```

produces one top-level Discord command:

```txt
admin
  moderation
    ban
```

This is different from the current model where one loaded command
becomes one top-level slash payload.

For that reason, hierarchical compiled commands should not be forced
into the current `LoadedCommand` shape unchanged. A new internal
compiled route type is cleaner than stretching the flat type until it
breaks.

## Backward Compatibility

### Supported combinations

- flat-only apps continue to work unchanged
- hierarchical-only apps work with the new syntax
- both styles can coexist in the same project

### Deferred compatibility

The current external command injection APIs are flat:

- `addExternalCommands(data: Command[])`
- `registerExternalLoadedCommands(data: LoadedCommand[])`

This RFC defers hierarchical external/plugin-injected commands to a
follow-up design. v1 should support hierarchical discovery only for
filesystem commands.

## Implementation Plan

### Phase 0: characterization tests

Add tests for current behavior before changing internals:

- flat discovery
- category handling
- flat command resolution
- current middleware ordering
- current message parser behavior

### Phase 1: internal tree and compiler

- add tree discovery structures
- add compiler outputs
- keep flat commands compiling through the same pipeline
- keep current public behavior unchanged

### Phase 2: router and validation

- support `[name]`, `{name}`, and `.subcommand.ts`
- emit diagnostics for invalid structures
- make directory middleware ancestry-based

### Phase 3: runtime resolution

- resolve interaction routes by full path
- resolve prefix routes by full path
- compile middleware chains per leaf route

### Phase 4: registrar integration

- register compiled root chat-input payloads
- keep context menu registration flat

### Phase 5: docs and examples

- add a guide page for hierarchical commands
- update middleware docs to match actual inheritance
- add `apps/test-bot` examples

## Test Plan

Add dedicated coverage for:

- router discovery of command directories, groups, and shorthand files
- duplicate sibling validation
- invalid mixed root options/subcommand structures
- interaction resolution for:
  - `admin`
  - `admin.ban`
  - `admin.moderation.ban`
- prefix resolution for:
  - `!admin:ban`
  - `!admin:moderation:ban`
- middleware inheritance order across ancestors
- registration payload nesting
- flat and hierarchical coexistence

## Open Questions

1. Should a container `command.ts` be allowed to export a `message`
   handler for a root-only prefix command, or should container nodes
   be non-executable across all modes?
2. Should nested categories inside command/group directories be
   allowed in v1, or should category traversal stop at command nodes
   to keep discovery simpler?
3. Should aliases apply only to root prefix commands in v1, or can
   leaf subcommands define aliases too?
4. Should runtime context expose a new full-route property such as
   `ctx.commandRoute`, or should v1 keep `ctx.commandName` semantics
   unchanged and defer richer route APIs?

## Recommended Next Step

The companion implementation checklist lives at:

- `docs/proposals/hierarchical-commands-checklist.md`

The main engineering decision is already clear:

hierarchical commands should be implemented as a compiled tree model,
not as more special cases on top of the current flat records.
