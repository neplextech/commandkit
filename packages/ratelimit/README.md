# @commandkit/ratelimit

Advanced rate limiting for CommandKit with multiple algorithms, queueing,
role limits, multi-window policies, and temporary exemptions.

## Installation

```bash
npm install @commandkit/ratelimit
```

## Quick start

Create the auto-loaded `ratelimit.ts`/`ratelimit.js` file and call
`configureRatelimit(...)` there so runtime settings are available before the
plugin evaluates any commands:

```ts
// ratelimit.ts
import { configureRatelimit } from '@commandkit/ratelimit';

configureRatelimit({
  defaultLimiter: {
    maxRequests: 5,
    interval: '1m',
    scope: 'user',
    algorithm: 'fixed-window',
  },
});
```

```ts
// commandkit.config.ts
import { defineConfig } from 'commandkit';
import { ratelimit } from '@commandkit/ratelimit';

export default defineConfig({
  plugins: [ratelimit()],
});
```

The runtime plugin auto-loads `ratelimit.ts`/`ratelimit.js` on startup.

Enable rate limiting on a command:

```ts
export const metadata = {
  ratelimit: {
    maxRequests: 3,
    interval: '10s',
    scope: 'user',
    algorithm: 'sliding-window',
  },
};
```

## `ratelimit()` options

The `ratelimit()` factory returns the compiler and runtime plugins and accepts:

- `compiler`: Options for the `"use ratelimit"` directive transformer.

Runtime options are configured via `configureRatelimit()`.

Example:

```ts
ratelimit({
  compiler: { enabled: true },
});
```

## How keys and scopes work

Scopes determine how keys are generated:

- `user` -> `rl:user:{userId}:{commandName}`
- `guild` -> `rl:guild:{guildId}:{commandName}`
- `channel` -> `rl:channel:{channelId}:{commandName}`
- `global` -> `rl:global:{commandName}`
- `user-guild` -> `rl:user:{userId}:guild:{guildId}:{commandName}`
- `custom` -> `keyResolver(ctx, command, source)`

If `keyPrefix` is provided, it is prepended before the `rl:` prefix:

- `keyPrefix: 'prod:'` -> `prod:rl:user:{userId}:{commandName}`

Multi-window limits append a suffix:

- `:w:{windowId}` (for example `rl:user:123:ping:w:short`)

For `custom` scope you must provide `keyResolver`:

```ts
import type { RateLimitKeyResolver } from '@commandkit/ratelimit';

const keyResolver: RateLimitKeyResolver = (ctx, command, source) => {
  return `custom:${ctx.commandName}:${source.user?.id ?? 'unknown'}`;
};
```

If `keyResolver` returns a falsy value, the limiter is skipped for that scope.

Exemption keys use:

- `rl:exempt:{scope}:{id}` (plus optional `keyPrefix`).

## Plugin options (RateLimitPluginOptions)

- `defaultLimiter`: Default limiter settings used when a command does not specify a limiter.
- `limiters`: Named limiter presets referenced by command metadata using `limiter: 'name'`.
- `storage`: Storage driver or `{ driver }` wrapper used for rate limit state.
- `keyPrefix`: Optional prefix prepended to all keys.
- `keyResolver`: Resolver used for `custom` scope keys.
- `bypass`: Bypass rules for users, roles, guilds, or a custom check.
- `hooks`: Lifecycle hooks for allowed, limited, reset, violation, and storage error events.
- `onRateLimited`: Custom response handler that replaces the default reply.
- `queue`: Queue settings for retrying instead of rejecting.
- `roleLimits`: Role-specific limiter overrides.
- `roleLimitStrategy`: `highest`, `lowest`, or `first` to resolve matching role limits.
- `initializeDefaultStorage`: When true, initializes in-memory storage if no storage is set.
- `initializeDefaultDriver`: Alias for `initializeDefaultStorage`.

## Limiter options (RateLimitLimiterConfig)

- `maxRequests`: Requests allowed per interval (default 10).
- `interval`: Duration for the limit window (number in ms or string).
- `scope`: Single scope or list of scopes.
- `algorithm`: `fixed-window`, `sliding-window`, `token-bucket`, `leaky-bucket`.
- `burst`: Capacity for token/leaky bucket (defaults to `maxRequests`).
- `refillRate`: Tokens per second for token bucket (defaults to `maxRequests / intervalSeconds`).
- `leakRate`: Tokens per second for leaky bucket (defaults to `maxRequests / intervalSeconds`).
- `keyResolver`: Custom key resolver for `custom` scope.
- `keyPrefix`: Prefix override for this limiter.
- `storage`: Storage override for this limiter.
- `violations`: Escalation settings for repeated limits.
- `queue`: Queue override for this limiter.
- `windows`: Multi-window configuration.
- `roleLimits`: Role-specific overrides scoped to this limiter.
- `roleLimitStrategy`: Role limit resolution strategy scoped to this limiter.

## Command metadata options (RateLimitCommandConfig)

Command metadata extends limiter options and adds:

- `limiter`: Name of a limiter defined in `limiters`.

## Resolution order

Limiter resolution order (later overrides earlier):

- Built-in defaults (`DEFAULT_LIMITER`).
- `defaultLimiter`.
- Named limiter (if `metadata.ratelimit.limiter` is set).
- Command metadata overrides.
- Role limit overrides (when matched).

## Algorithms

### Fixed window

- Uses a counter per interval.
- Required: `maxRequests`, `interval`.
- Storage: `consumeFixedWindow` or `incr`, otherwise falls back to `get/set`.

### Sliding window log

- Tracks timestamps in a sorted set.
- Required: `maxRequests`, `interval`.
- Storage: `consumeSlidingWindowLog` or `zAdd`, `zRemRangeByScore`, `zCard` and optional `zRangeByScore`.
- If sorted-set ops are missing, it throws an error.
- The non-atomic sorted-set fallback can race under concurrency; implement `consumeSlidingWindowLog` for strict enforcement.

### Token bucket

- Refills tokens continuously.
- Required: `burst` (capacity), `refillRate` (tokens/sec).
- Storage: `get/set`.
- `refillRate` must be greater than 0.

### Leaky bucket

- Leaks tokens continuously.
- Required: `burst` (capacity), `leakRate` (tokens/sec).
- Storage: `get/set`.
- `leakRate` must be greater than 0.

## Storage drivers

### MemoryRateLimitStorage

- In-memory store with TTL support.
- Implements `consumeFixedWindow`, `consumeSlidingWindowLog`, sorted-set ops,
  prefix/pattern deletes, and key listing.
- Not shared across processes (single-node only).

### RedisRateLimitStorage

- Uses Redis with Lua scripts for fixed and sliding windows.
- Stores values as JSON.
- Supports `deleteByPattern`, `deleteByPrefix`, and `keysByPrefix` via `SCAN`.
- `@commandkit/ratelimit/redis` also re-exports `RedisOptions` from `ioredis`.

### FallbackRateLimitStorage

- Wraps a primary and secondary storage.
- On failure, falls back to the secondary and logs at most once per cooldown window.
- Options: `cooldownMs` (default 30s).

Disable the default memory storage:

```ts
configureRatelimit({
  initializeDefaultStorage: false,
  // or: initializeDefaultDriver: false
});
```

## Storage interface and requirements

`storage` accepts either a `RateLimitStorage` instance or `{ driver }`.

Required methods:

- `get`, `set`, `delete`.

Optional methods used by features:

- `incr` and `consumeFixedWindow` for fixed-window efficiency.
- `zAdd`, `zRemRangeByScore`, `zCard`, `zRangeByScore`, `consumeSlidingWindowLog` for sliding window.
- `ttl`, `expire` for expiry visibility.
- `deleteByPrefix`, `deleteByPattern`, `keysByPrefix` for resets and exemption listing.

## Queue mode

Queue mode retries commands instead of rejecting immediately:

```ts
configureRatelimit({
  queue: {
    enabled: true,
    maxSize: 3,
    timeout: '30s',
    deferInteraction: true,
    ephemeral: true,
    concurrency: 1,
  },
});
```
 
Queue options:

- `enabled`
- `maxSize`
- `timeout`
- `deferInteraction`
- `ephemeral`
- `concurrency`

If any queue config is provided and `enabled` is unset, it defaults to `true`.

Queue size counts pending plus running tasks. If the queue is full, the plugin
falls back to immediate rate-limit handling.

Queue defaults:

- `maxSize`: 3
- `timeout`: 30s
- `deferInteraction`: true
- `ephemeral`: true
- `concurrency`: 1

`deferInteraction` only applies to interactions (messages are ignored).

`maxSize`, `timeout`, and `concurrency` are clamped to a minimum of 1.

Queue resolution order is (later overrides earlier):

- `queue`
- `defaultLimiter.queue`
- `named limiter queue`
- `command metadata queue`
- `role limit queue`

## Role limits

Role limits override the base limiter if the user has a matching role:

```ts
configureRatelimit({
  roleLimits: {
    'ROLE_ID_1': { maxRequests: 30, interval: '1m' },
    'ROLE_ID_2': { maxRequests: 5, interval: '1m' },
  },
  roleLimitStrategy: 'highest',
});
```

If no strategy is provided, `roleLimitStrategy` defaults to `highest`.

Role scoring is based on `maxRequests / intervalMs` (minimum across windows).

## Multi-window limits

Use `windows` to enforce multiple windows at the same time:

```ts
configureRatelimit({
  defaultLimiter: {
    scope: 'user',
    algorithm: 'sliding-window',
    windows: [
      { id: 'short', maxRequests: 10, interval: '1m' },
      { id: 'long', maxRequests: 1000, interval: '1d' },
    ],
  },
});
```

If a window `id` is omitted, it auto-generates `w1`, `w2`, and so on.

## Violations and escalation

Escalate cooldowns after repeated rate limit violations:

```ts
configureRatelimit({
  defaultLimiter: {
    maxRequests: 1,
    interval: '10s',
    violations: {
      maxViolations: 5,
      escalationMultiplier: 2,
      resetAfter: '1h',
    },
  },
});
```

If an escalation cooldown extends beyond the normal reset, the plugin
uses the longer cooldown.

Violation defaults and flags:

- `escalate`: Defaults to true when `violations` is set. Set `false` to disable escalation.
- `maxViolations`: Default 5.
- `escalationMultiplier`: Default 2.
- `resetAfter`: Default 1h.

## Hooks

```ts
configureRatelimit({
  hooks: {
    onAllowed: ({ key, result }) => {
      console.log('allowed', key, result.remaining);
    },
    onRateLimited: ({ key, result }) => {
      console.log('limited', key, result.retryAfter);
    },
    onViolation: (key, count) => {
      console.log('violation', key, count);
    },
    onReset: (key) => {
      console.log('reset', key);
    },
    onStorageError: (error, fallbackUsed) => {
      console.error('storage error', error, fallbackUsed);
    },
  },
});
```

## Analytics events

The runtime plugin emits analytics events (if analytics is configured):

- `ratelimit_allowed`
- `ratelimit_hit`
- `ratelimit_violation`

## Events

Listen to runtime rate-limit events via CommandKit events:

```ts
commandkit.events
  .to('ratelimits')
  .on('ratelimited', ({ key, result, source, aggregate, commandName, queued }) => {
    console.log('ratelimited', key, commandName, queued, aggregate.retryAfter);
  });
```

In CommandKit apps, you can register the listener via the events router by
placing a handler under `src/app/events/(ratelimits)/ratelimited/` (for example
`logger.ts`).

## Bypass rules

```ts
configureRatelimit({
  bypass: {
    userIds: ['USER_ID'],
    guildIds: ['GUILD_ID'],
    roleIds: ['ROLE_ID'],
    check: (source) => source.channelId === 'ALLOWLIST_CHANNEL',
  },
});
```

## Custom rate-limited response

Override the default ephemeral cooldown reply:

```ts
import type { RateLimitStoreValue } from '@commandkit/ratelimit';

configureRatelimit({
  onRateLimited: async (ctx, info: RateLimitStoreValue) => {
    await ctx.reply(`Cooldown: ${Math.ceil(info.retryAfter / 1000)}s`);
  },
});
```

## Temporary exemptions

```ts
import {
  grantRateLimitExemption,
  revokeRateLimitExemption,
  listRateLimitExemptions,
} from '@commandkit/ratelimit';

await grantRateLimitExemption({
  scope: 'user',
  id: 'USER_ID',
  duration: '1h',
});

await revokeRateLimitExemption({
  scope: 'user',
  id: 'USER_ID',
});

const exemptions = await listRateLimitExemptions({
  scope: 'user',
  id: 'USER_ID',
});
```

All exemption helpers accept an optional `keyPrefix`.

Listing notes:

- `listRateLimitExemptions({ scope, id })` checks a single key directly.
- `listRateLimitExemptions({ scope })` scans by prefix if supported.
- `limit` caps the number of results.
- `expiresInMs` is `null` if the storage does not support `ttl`.

Supported exemption scopes:

- `user`
- `guild`
- `role`
- `channel`
- `category`

## Runtime helpers and API

### Runtime configuration

```ts
import { configureRatelimit } from '@commandkit/ratelimit';

configureRatelimit({
  defaultLimiter: { maxRequests: 5, interval: '1m' },
});
```

Use `getRateLimitConfig()` to read the active configuration and
`isRateLimitConfigured()` to guard flows that depend on runtime setup.

### Storage helpers

```ts
import {
  setRateLimitStorage,
  getRateLimitStorage,
  setDriver,
  getDriver,
} from '@commandkit/ratelimit';
```

### Runtime access

```ts
import { getRateLimitRuntime, setRateLimitRuntime } from '@commandkit/ratelimit';
```

### Accessing results inside commands

```ts
import { getRateLimitInfo } from '@commandkit/ratelimit';

export const chatInput = async (ctx) => {
  const info = getRateLimitInfo(ctx);
  if (info?.limited) {
    console.log(info.retryAfter);
  }
};
```

### Result shape

`RateLimitStoreValue` includes:

- `limited`: Whether any limiter hit.
- `remaining`: Minimum remaining across all results.
- `resetAt`: Latest reset timestamp across all results.
- `retryAfter`: Max retry delay when limited.
- `results`: Array of `RateLimitResult` entries.

Each `RateLimitResult` includes:

- `key`, `scope`, `algorithm`, `windowId?`.
- `limited`, `remaining`, `resetAt`, `retryAfter`, `limit`.

### Reset helpers

```ts
import { resetRateLimit, resetAllRateLimits } from '@commandkit/ratelimit';

await resetRateLimit({ key: 'rl:user:USER_ID:ping' });

await resetAllRateLimits({ commandName: 'ping' });

await resetAllRateLimits({ scope: 'guild', guildId: 'GUILD_ID' });
```

Reset parameter notes:

- `resetRateLimit` accepts either `key` or (`scope` + `commandName` + required IDs).
- `resetAllRateLimits` accepts `pattern`, `prefix`, `commandName`, or `scope` + IDs.
- `keyPrefix` can be passed to both reset helpers.

## Directive: `use ratelimit`

Use the directive in async functions to rate-limit function execution:

```ts
import { RateLimitError } from '@commandkit/ratelimit';

const heavy = async () => {
  'use ratelimit';
  return 'ok';
};

try {
  await heavy();
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(error.result.retryAfter);
  }
}
```

The compiler plugin injects `$ckitirl` at build time. The runtime
wrapper uses a per-function key and the runtime default limiter.

The directive is applied only to async functions.

## RateLimitEngine reset

`RateLimitEngine.reset(key)` removes both the main key and the
`violation:{key}` entry.

## HMR reset behavior

When a command file is hot-reloaded, the runtime plugin clears that command's
rate-limit keys using `deleteByPattern` (including `violation:` and `:w:` variants).
If the storage does not support pattern deletes, nothing is cleared.

## Behavior details and edge cases

- `ratelimit()` returns `[UseRateLimitDirectivePlugin, RateLimitPlugin]` in that order.
- If required IDs are missing for a scope (for example no guild in DMs), that scope is skipped.
- `interval` is clamped to at least 1ms when resolving limiter config.
- `RateLimitResult.limit` is `burst` for token/leaky buckets and `maxRequests` for fixed/sliding windows.
- Default rate-limit response uses an embed titled `:hourglass_flowing_sand: You are on cooldown` with a relative timestamp. Interactions reply ephemerally (or follow up if already replied/deferred). Non-repliable interactions are skipped. Messages reply only if the channel is sendable.
- Queue behavior: queue size is pending + running; if `maxSize` is reached, the command is not queued and falls back to immediate rate-limit handling. Queued tasks stop after `timeout` and log a warning. After the initial delay, retries wait at least 250ms between checks. When queued, `ctx.capture()` and `onRateLimited`/`onViolation` hooks still run.
- Bypass order is user/guild/role lists, then temporary exemptions, then `bypass.check`.
- `roleLimitStrategy: 'first'` respects object insertion order. Role limits merge in this order: plugin `roleLimits` -> `defaultLimiter.roleLimits` -> named limiter `roleLimits` -> command overrides.
- `resetRateLimit` triggers `hooks.onReset` for the key; `resetAllRateLimits` does not.
- `onStorageError` is invoked with `fallbackUsed = false` from runtime plugin calls.
- `grantRateLimitExemption` uses the runtime `keyPrefix` by default unless `keyPrefix` is provided.
- `RateLimitError` defaults to message `Rate limit exceeded`.
- If no storage is configured and default storage is disabled, the plugin logs once and stores an empty `RateLimitStoreValue` without limiting.
- `FallbackRateLimitStorage` throws if either storage does not support an optional operation.
- `MemoryRateLimitStorage.deleteByPattern` supports `*` wildcards (simple glob).

## Constants

- `RATELIMIT_STORE_KEY`: `ratelimit` (store key for aggregated results).
- `DEFAULT_KEY_PREFIX`: `rl:` (prefix used in generated keys).

## Type reference (exported)

- `RateLimitScope` and `RATE_LIMIT_SCOPES`: Scope values used in keys.
- `RateLimitExemptionScope` and `RATE_LIMIT_EXEMPTION_SCOPES`: Exemption scopes.
- `RateLimitAlgorithmType` and `RATE_LIMIT_ALGORITHMS`: Algorithm identifiers.
- `DurationLike`: Number in ms or duration string.
- `RateLimitQueueOptions`: Queue settings for retries.
- `RateLimitRoleLimitStrategy`: `highest`, `lowest`, or `first`.
- `RateLimitResult`: Result for a single limiter/window.
- `RateLimitAlgorithm`: Interface for algorithm implementations.
- `FixedWindowConsumeResult` and `SlidingWindowConsumeResult`: Storage consume return types.
- `RateLimitStorage` and `RateLimitStorageConfig`: Storage interface and wrapper.
- `ViolationOptions`: Escalation controls.
- `RateLimitWindowConfig`: Per-window limiter config.
- `RateLimitKeyResolver`: Custom scope key resolver signature.
- `RateLimitLimiterConfig`: Base limiter configuration.
- `RateLimitCommandConfig`: Limiter config plus `limiter` name.
- `RateLimitBypassOptions`: Bypass lists and optional `check`.
- `RateLimitExemptionGrantParams`, `RateLimitExemptionRevokeParams`, `RateLimitExemptionListParams`: Exemption helper params.
- `RateLimitExemptionInfo`: Exemption listing entry shape.
- `RateLimitHookContext` and `RateLimitHooks`: Hook payloads and callbacks.
- `RateLimitResponseHandler`: `onRateLimited` handler signature.
- `RateLimitPluginOptions`: Runtime plugin options.
- `RateLimitStoreValue`: Aggregated results stored in `env.store`.
- `ResolvedLimiterConfig`: Resolved limiter config with defaults and `intervalMs`.
- `RateLimitRuntimeContext`: Active runtime state.

## Exports

- `ratelimit` plugin factory (compiler + runtime).
- `RateLimitPlugin` and `UseRateLimitDirectivePlugin`.
- `RateLimitEngine`, algorithm classes, and `ViolationTracker`.
- Storage implementations: `MemoryRateLimitStorage`, `RedisRateLimitStorage`, `FallbackRateLimitStorage`.
- Runtime helpers: `configureRatelimit`, `setRateLimitStorage`, `getRateLimitStorage`, `setDriver`, `getDriver`, `getRateLimitRuntime`, `setRateLimitRuntime`.
- API helpers: `getRateLimitInfo`, `resetRateLimit`, `resetAllRateLimits`, `grantRateLimitExemption`, `revokeRateLimitExemption`, `listRateLimitExemptions`.
- Errors: `RateLimitError`.

## Defaults

- `maxRequests`: 10
- `interval`: 60s
- `algorithm`: `fixed-window`
- `scope`: `user`
- `keyPrefix`: none (but keys always include `rl:`)
- `initializeDefaultStorage`: true

## Duration units

String durations support `ms`, `s`, `m`, `h`, `d` via `ms`, plus:

- `w`, `week`, `weeks`
- `mo`, `month`, `months`

## Subpath exports

- `@commandkit/ratelimit/redis`
- `@commandkit/ratelimit/memory`
- `@commandkit/ratelimit/fallback`

## Source map (packages/ratelimit/src)

- `src/index.ts`: Package entrypoint that re-exports the public API.
- `src/augmentation.ts`: Extends `CommandMetadata` with `metadata.ratelimit`.
- `src/configure.ts`: `configureRatelimit`, `getRateLimitConfig`, `isRateLimitConfigured`, and runtime updates.
- `src/runtime.ts`: Process-wide storage/runtime accessors, plus `setDriver`/`getDriver` aliases.
- `src/plugin.ts`: Runtime plugin: config resolution, queueing, hooks, analytics/events, responses, and HMR resets.
- `src/directive/use-ratelimit-directive.ts`: Compiler plugin for the `"use ratelimit"` directive.
- `src/directive/use-ratelimit.ts`: Runtime directive wrapper; uses `RateLimitEngine` and throws `RateLimitError`.
- `src/api.ts`: Public helpers for `getRateLimitInfo`, resets, and exemptions, plus param types.
- `src/types.ts`: Public config/result/storage types.
- `src/constants.ts`: `RATELIMIT_STORE_KEY` and `DEFAULT_KEY_PREFIX`.
- `src/errors.ts`: `RateLimitError` type.
- `src/engine/RateLimitEngine.ts`: Algorithm selection plus violation escalation.
- `src/engine/violations.ts`: `ViolationTracker` and escalation state.
- `src/engine/algorithms/fixed-window.ts`: Fixed-window algorithm.
- `src/engine/algorithms/sliding-window.ts`: Sliding-window log algorithm.
- `src/engine/algorithms/token-bucket.ts`: Token-bucket algorithm.
- `src/engine/algorithms/leaky-bucket.ts`: Leaky-bucket algorithm.
- `src/storage/memory.ts`: In-memory storage with TTL and sorted-set helpers.
- `src/storage/redis.ts`: Redis storage with Lua scripts for atomic windows.
- `src/storage/fallback.ts`: Fallback storage wrapper with cooldown logging.
- `src/providers/memory.ts`: Subpath export for memory storage.
- `src/providers/redis.ts`: Subpath export for Redis storage.
- `src/providers/fallback.ts`: Subpath export for fallback storage.
- `src/utils/config.ts`: Defaults, normalization, multi-window resolution, and role-limit merging.
- `src/utils/keys.ts`: Key building and parsing for scopes/exemptions.
- `src/utils/time.ts`: Duration parsing and clamp helpers.
- `src/utils/locking.ts`: Per-storage keyed mutex for fallback algorithm serialization.

## Spec map (packages/ratelimit/spec)

- `spec/setup.ts`: Shared test setup for vitest.
- `spec/helpers.ts`: Test helpers and stubs.
- `spec/algorithms.test.ts`: Algorithm integration tests.
- `spec/engine.test.ts`: Engine + violation behavior tests.
- `spec/api.test.ts`: API helper tests (resets, exemptions, info).
- `spec/plugin.test.ts`: Runtime plugin behavior tests.

## Manual testing

- Configure `maxRequests: 1` and `interval: '5s'`.
- Call the command twice and verify the cooldown response.
- Enable queue mode and confirm the second call is deferred and executes later.
- Grant an exemption and verify the user bypasses limits.
- Reset the command and verify the cooldown clears immediately.
