# commandkit-ratelimit skill

Skill for designing and implementing command rate limiting with `@commandkit/ratelimit`.

## Use this skill when

- adding anti-abuse protections
- defining scoped limits and windows
- switching to Redis/fallback storage for shared deployments

## Typical inputs

- command usage profile
- acceptable burst/sustained behavior
- storage and deployment topology

## Expected outputs

- ratelimit configuration
- directive usage in command handlers
- clear violation behavior and user messaging
