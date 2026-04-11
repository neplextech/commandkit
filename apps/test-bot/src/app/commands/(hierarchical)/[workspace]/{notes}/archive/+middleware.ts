import { MiddlewareContext } from 'commandkit';
import { recordHierarchyStage } from '@/utils/hierarchical-demo';

export function beforeExecute(ctx: MiddlewareContext) {
  recordHierarchyStage(ctx, 'leaf-dir:archive');
}
