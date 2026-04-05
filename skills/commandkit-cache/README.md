# commandkit-cache skill

Skill for caching architecture and implementation with `@commandkit/cache`.

## Use this skill when

- adding cache to expensive data fetches
- setting cache lifetime policies
- implementing tag-based invalidation
- configuring Redis-backed cache provider

## Typical inputs

- target function(s) to cache
- freshness requirements
- deployment mode (single instance vs distributed)

## Expected outputs

- `'use cache'` integration
- clear `cacheLife` and `cacheTag` decisions
- safe invalidation flow using `revalidateTag`
