import {
  ChatInputCommandContext,
  Logger,
  MessageCommandContext,
} from 'commandkit';

const TRACE_KEY = 'hierarchical-demo.trace';

type StoreShape = {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
};

type TraceContext = {
  commandName: string;
  store: StoreShape;
};

export interface HierarchyReplyOptions {
  title: string;
  shape: string;
  leafStyle: string;
  summary: string;
  details?: string[];
}

export function recordHierarchyStage(ctx: TraceContext, stage: string) {
  const trace = getHierarchyTrace(ctx);
  trace.push(stage);
  ctx.store.set(TRACE_KEY, trace);
  Logger.info(`[hierarchy demo] ${stage} -> ${ctx.commandName}`);
}

export function getHierarchyTrace(ctx: { store: StoreShape }) {
  const value = ctx.store.get(TRACE_KEY);

  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

export function toSlashRoute(route: string) {
  return `/${route.replace(/\./g, ' ')}`;
}

export function toMessageRoute(route: string) {
  return `!${route.replace(/\./g, ':')}`;
}

type HierarchyContext = ChatInputCommandContext | MessageCommandContext;

export async function replyWithHierarchyDemo(
  ctx: HierarchyContext,
  options: HierarchyReplyOptions,
) {
  const lines = [
    `**${options.title}**`,
    `Route: ${ctx.commandName}`,
    `Slash: ${toSlashRoute(ctx.commandName)}`,
    `Prefix: ${toMessageRoute(ctx.commandName)}`,
    `Invoked Root: ${ctx.invokedCommandName}`,
    `Execution: ${ctx.isMessage() ? 'message command' : 'chat input command'}`,
    `Middleware Trace: ${getHierarchyTrace(ctx).join(' -> ') || '(none)'}`,
    `Shape: ${options.shape}`,
    `Leaf Style: ${options.leafStyle}`,
    `Summary: ${options.summary}`,
  ];

  if (ctx.isMessage()) {
    lines.push(`Raw Args: ${ctx.args().join(' ') || '(none)'}`);
  }

  for (const detail of options.details ?? []) {
    lines.push(`- ${detail}`);
  }

  const content = lines.join('\n');

  if (ctx.isMessage()) {
    return ctx.message.reply(content);
  }

  return ctx.interaction.reply({ content });
}
