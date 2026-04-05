# commandkit-legacy-migration skill

Migration-only skill for projects currently using `@commandkit/legacy`.

## Use this skill when

- a project already depends on legacy handlers
- you need a controlled migration to modern CommandKit
- you want to deprecate and remove legacy plugin usage

## Do not use this skill for

- greenfield projects
- recommending new legacy adoption

## Typical inputs

- current legacy file layout
- migration risk tolerance and rollout constraints
- parity requirements

## Expected outputs

- phased migration plan
- concrete code updates per phase
- explicit criteria for removing `legacy()`
