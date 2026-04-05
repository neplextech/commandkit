#!/usr/bin/env node

console.log(`import {
  CompilerPlugin,
  type CompilerPluginRuntime,
  type PluginTransformParameters,
  type MaybeFalsey,
  type TransformedResult,
} from 'commandkit';

export class MyCompilerPlugin extends CompilerPlugin {
  public readonly name = 'my-compiler-plugin';

  public async activate(_ctx: CompilerPluginRuntime): Promise<void> {}

  public async deactivate(_ctx: CompilerPluginRuntime): Promise<void> {}

  public async transform(
    params: PluginTransformParameters,
  ): Promise<MaybeFalsey<TransformedResult>> {
    return {
      code: params.contents,
      map: null,
    };
  }
}`);
