# 04 template registration

## Purpose

Show how compiler plugins can extend `commandkit create` with custom
templates.

## When to use

Use when your plugin needs to scaffold new file types or override
default templates.

## Filesystem

```txt
src/
  plugins/
    templates-plugin.ts
```

## Example

```ts
import { CompilerPlugin, type CompilerPluginRuntime } from 'commandkit';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export class TemplatesPlugin extends CompilerPlugin {
  public readonly name = 'templates-plugin';

  public async activate(ctx: CompilerPluginRuntime): Promise<void> {
    ctx.registerTemplate('event', async (args: string[]) => {
      const [name, targetPath] = args;
      const file = `export default async function on${name[0].toUpperCase() + name.slice(1)}() {\n  console.log('${name}');\n}`;
      await writeFile(join(targetPath, 'event.ts'), file);
    });
  }

  public async deactivate(ctx: CompilerPluginRuntime): Promise<void> {
    ctx.unregisterTemplate('event');
  }
}
```

## Important details

- `registerTemplate` must be called in `activate`.
- `unregisterTemplate` must be called in `deactivate`.
- Templates can intentionally override defaults by reusing template
  names.

## Best practices

- Validate template args before writing files.
- Keep generated output minimal and convention-aligned.
- Add cleanup logic to avoid stale template registrations.

## Common mistakes

- Registering templates outside lifecycle hooks.
- Not unregistering templates on plugin deactivation.
- Writing templates to invalid paths.
