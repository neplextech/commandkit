# commandkit-redis skill

Skill for Redis-backed distributed infrastructure in CommandKit ecosystems.

## Use this skill when

- scaling beyond a single process
- sharing cache/locks/rate-limit state across instances
- integrating Redis providers with CommandKit plugins/utilities

## Typical inputs

- deployment topology
- required shared capabilities (cache, limits, locks)
- reliability constraints

## Expected outputs

- Redis integration wiring
- provider/storage selection guidance
- operational guardrails for distributed behavior
