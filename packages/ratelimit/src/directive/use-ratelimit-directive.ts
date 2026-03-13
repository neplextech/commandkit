import {
  CommonDirectiveTransformer,
  type CommonDirectiveTransformerOptions,
  type CompilerPluginRuntime,
} from 'commandkit';

/**
 * Compiler plugin for the "use ratelimit" directive.
 */
export class UseRateLimitDirectivePlugin extends CommonDirectiveTransformer {
  public readonly name = 'UseRateLimitDirectivePlugin';

  public constructor(options?: Partial<CommonDirectiveTransformerOptions>) {
    super({
      enabled: true,
      ...options,
      directive: 'use ratelimit',
      importPath: '@commandkit/ratelimit',
      importName: '$ckitirl',
      asyncOnly: true,
    });
  }

  public async activate(ctx: CompilerPluginRuntime): Promise<void> {
    await super.activate(ctx);
  }
}
