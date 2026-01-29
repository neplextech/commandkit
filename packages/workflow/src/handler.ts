/* eslint-disable */
// @ts-nocheck
import { Hono } from 'hono';
import { serve as nodeServe } from '@hono/node-server';
import { POST as WebhookPOST } from '{{webhookPath}}';
import { POST as StepPOST } from '{{stepsPath}}';
import { POST as FlowPOST } from '{{workflowPath}}';

const app = new Hono();

const handlers = [
  ['/.well-known/workflow/v1/webhook/:token', (c) => WebhookPOST(c.req.raw)],
  ['/.well-known/workflow/v1/step', (c) => StepPOST(c.req.raw)],
  ['/.well-known/workflow/v1/flow', (c) => FlowPOST(c.req.raw)],
];

handlers.forEach(([path, handler]) => app.all(path, handler));

const port = process.env.PORT;

if (!port || isNaN(Number(port))) {
  throw new Error(
    'process.env.PORT must be set in order to use @commandkit/workflow plugin',
  );
}

if (typeof Deno !== 'undefined') {
  Deno.serve({ port: Number(port) }, app.fetch);
} else if (typeof Bun !== 'undefined') {
  Bun.serve({
    fetch: app.fetch,
    port: Number(port),
  });
} else {
  nodeServe({
    fetch: app.fetch,
    port: Number(port),
  });
}
