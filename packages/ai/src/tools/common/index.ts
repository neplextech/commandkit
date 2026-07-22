import { JSONSchema7, Schema, tool } from 'ai';
import { AiContext } from '../../context';
import { getAiWorkerContext } from '../../ai-context-worker';
import { z } from 'zod';
import { z as z3 } from 'zod/v3';

/**
 * Utility type that represents a value that can be either synchronous or asynchronous.
 * @template T - The type of the value
 * @internal
 */
type Awaitable<T> = T | Promise<T>;

/**
 * Type representing the parameters schema for AI tools.
 * Extracted from the first parameter of the `tool` function from the 'ai' library.
 */
export type ToolParameterType = z.ZodType | z3.ZodType | Schema<any>;

/**
 * Utility type that infers the TypeScript type from a tool parameter schema.
 * Supports both Zod schemas and AI library schemas.
 * @template T - The tool parameter type to infer from
 */
export type InferParameters<T extends ToolParameterType> =
  T extends Schema<any>
    ? T['_type']
    : T extends z.ZodTypeAny
      ? z.infer<T>
      : T extends z3.ZodTypeAny
        ? z3.infer<T>
        : never;
/**
 * Configuration options for creating an AI tool.
 * @template T - The parameter schema type for the tool
 * @template R - The return type of the tool's execute function
 */
export interface CreateToolOptions<
  T extends ToolParameterType,
  R = unknown,
  C extends JSONSchema7 = JSONSchema7,
> {
  /** The unique name identifier for the tool */
  name: string;
  /** A human-readable description of what the tool does */
  description: string;
  /** The parameter schema that defines the tool's input structure */
  inputSchema: T;
  /** The context schema for this tool */
  contextSchema?: C;
  /** The function that executes when the tool is called */
  execute: ToolExecuteFunction<T, R>;
}

type Context = Record<string, unknown>;

export type ExecutableTool<T, R, C extends Context> = ReturnType<
  typeof tool<T, R, C>
>;

/**
 * Type definition for a tool's execute function.
 * @template T - The parameter schema type
 * @template R - The return type of the function
 * @param ctx - The AI context containing request and response information
 * @param inputSchema - The validated inputSchema passed to the tool
 * @returns The result of the tool execution, which can be synchronous or asynchronous
 */
export type ToolExecuteFunction<T extends ToolParameterType, R> = (
  ctx: AiContext,
  inputSchema: InferParameters<T>,
) => Awaitable<R>;

/**
 * Creates a new AI tool with the specified configuration.
 * This function wraps the underlying AI library's tool creation with additional
 * context management and parameter validation.
 *
 * @template T - The parameter schema type for the tool
 * @template R - The return type of the tool's execute function
 * @param options - The configuration options for the tool
 * @returns A configured AI tool ready for use
 *
 * @example
 * ```typescript
 * const myTool = createTool({
 *   name: 'calculate',
 *   description: 'Performs basic arithmetic calculations',
 *   parameters: z.object({
 *     operation: z.enum(['add', 'subtract']),
 *     a: z.number(),
 *     b: z.number(),
 *   }),
 *   execute: async (ctx, params) => {
 *     return params.operation === 'add'
 *       ? params.a + params.b
 *       : params.a - params.b;
 *   },
 * });
 * ```
 */
export function createTool<
  T extends ToolParameterType,
  R = unknown,
  C extends Context = Context,
>(options: CreateToolOptions<T, R, C>): ExecutableTool<T, R, C> {
  // @ts-ignore types
  const _tool = tool<T, R, C>({
    name: options.name,
    description: options.description,
    inputSchema: options.inputSchema,
    async execute(params) {
      const { ctx } = getAiWorkerContext();

      ctx.setParams(params as Record<string, unknown>);

      return options.execute(ctx, params as InferParameters<T>);
    },
  });

  return _tool;
}
