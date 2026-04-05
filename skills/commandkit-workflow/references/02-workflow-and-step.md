# 02 workflow and step

## Purpose

Show workflow entrypoint and step boundaries.

## When to use

Use when implementing or reviewing this feature in a CommandKit-based project.

## Filesystem

```txt
project/
  commandkit.config.ts
  src/
    workflows/
    app/
      commands/
```

## Example

```ts
import { sleep } from 'workflow';
import { useClient } from 'commandkit/hooks';

export async function greetUserWorkflow(userId: string) {
  'use workflow';

  await greetUser(userId);
  await sleep('5 seconds');
  await greetUser(userId, true);
}

async function greetUser(userId: string, again = false) {
  'use step';
  const client = useClient<true>();
  const user = await client.users.fetch(userId);
  await user.send(again ? 'Hello again!' : 'Hello!');
}
```

## Important details

- Use exact API/export names shown in the example.
- Keep filesystem placement aligned with enabled plugins and feature expectations.
- Preserve deterministic behavior and explicit error handling in implementation code.

## Best practices

- Keep snippets as baseline patterns and adapt them to real command names and data models.
- Validate external inputs and permission boundaries before side effects.
- Keep setup deterministic so startup behavior is stable across environments.

## Common mistakes

- Skipping validation for user-provided inputs before side effects.
- Changing structure/config without verifying companion files.
- Copying snippets without adapting identifiers and environment values.
