# 03 compiler plugin transform

## Purpose

Show how to build compiler plugins that transform source code safely.

## When to use

Use when implementing directive transforms, compile-time rewrites, or
custom compile behavior.

## Filesystem

```txt
src/
  plugins/
    my-compiler-plugin.ts
```

## Example

```ts
import {
  type CompilerPluginRuntime,
  CompilerPlugin,
  MaybeFalsey,
  PluginTransformParameters,
  TransformedResult,
} from 'commandkit';

export class MyCompilerPlugin extends CompilerPlugin {
  public readonly name = 'my-compiler-plugin';

  public async activate(_ctx: CompilerPluginRuntime): Promise<void> {}

  public async deactivate(_ctx: CompilerPluginRuntime): Promise<void> {}

  public async transform(
    params: PluginTransformParameters,
  ): Promise<MaybeFalsey<TransformedResult>> {
    const transformed = params.contents.replace(
      /console\.log/g,
      'console.warn',
    );

    return {
      code: transformed,
      map: null,
    };
  }
}
```

## Important details

- Compiler plugins extend `CompilerPlugin` and implement `transform`.
- Return transformed code and optional source map.
- Activation/deactivation hooks are available for setup/cleanup.

## Best practices

- Keep transforms deterministic and easy to reason about.
- Preserve source-map quality when doing non-trivial rewrites.
- Scope transforms by file/path patterns to avoid accidental global
  rewrites.

## Common mistakes

- Rewriting code without preserving semantics.
- Applying broad regex transforms across all files unintentionally.
- Ignoring source maps for complex transformations.
