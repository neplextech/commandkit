import {
  CompilerPlugin,
  CompilerPluginRuntime,
  getConfig,
  MaybeFalsey,
  PluginTransformParameters,
  TransformedResult,
} from 'commandkit';
import { LocalBuilder } from './builder.js';
import { workflowTransformPlugin as workflowRollupPlugin } from '@workflow/rollup';

const USE_WORKFLOW_DIRECTIVE = 'use workflow';
const USE_STEP_DIRECTIVE = 'use step';

export interface WorkflowCompilerPluginOptions {}

const shouldTransform = (code: string): boolean => {
  return (
    code.includes(USE_WORKFLOW_DIRECTIVE) || code.includes(USE_STEP_DIRECTIVE)
  );
};

export class WorkflowCompilerPlugin extends CompilerPlugin<WorkflowCompilerPluginOptions> {
  public readonly name = 'WorkflowCompilerPlugin';
  private builder: LocalBuilder | null = null;
  private workflowRollupPlugin: ReturnType<typeof workflowRollupPlugin> | null =
    null;

  public async activate(ctx: CompilerPluginRuntime): Promise<void> {
    this.builder = new LocalBuilder({
      inputPaths: ['workflows', 'app/workflows'],
      outDir: ctx.isDevMode ? '.commandkit' : getConfig().distDir,
    });
    this.workflowRollupPlugin = workflowRollupPlugin();
  }

  public async deactivate(): Promise<void> {
    await this.builder?.build();
    this.builder = null;
  }

  public async transform(
    params: PluginTransformParameters,
  ): Promise<MaybeFalsey<TransformedResult>> {
    if (!shouldTransform(params.code)) return;
    if (typeof this.workflowRollupPlugin?.transform !== 'function') return;
    // @ts-ignore mismatched types
    const result = await this.workflowRollupPlugin.transform(
      params.code,
      params.id,
    );

    if (!result) return null;
    if (typeof result === 'string') return { code: result };
    return {
      code: result.code,
      map: typeof result.map === 'string' ? result.map : null,
    };
  }
}
