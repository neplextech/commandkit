import {
  CommonDirectiveTransformer,
  type CommonDirectiveTransformerOptions,
  type CompilerPluginRuntime,
} from 'commandkit';

/**
 * Compiler plugin for the "use ratelimit" directive.
 *
 * @extends CommonDirectiveTransformer
 */
export class UseRateLimitDirectivePlugin extends CommonDirectiveTransformer {
  public readonly name = 'UseRateLimitDirectivePlugin';

  /**
   * Create the directive compiler plugin with optional overrides.
   *
   * @param options - Common directive transformer overrides.
   */
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

  /**
   * Activate the compiler plugin in the current build runtime.
   *
   * @param ctx - Compiler plugin runtime.
   * @returns Resolves after activation completes.
   */
  public async activate(ctx: CompilerPluginRuntime): Promise<void> {
    await super.activate(ctx);
  }
}
