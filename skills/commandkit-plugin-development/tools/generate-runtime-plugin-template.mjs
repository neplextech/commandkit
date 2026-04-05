#!/usr/bin/env node

console.log(`import { RuntimePlugin, type CommandKitPluginRuntime } from 'commandkit';

export class MyRuntimePlugin extends RuntimePlugin {
  async onAfterClientLogin(ctx: CommandKitPluginRuntime): Promise<void> {
    console.log(\`Logged in as \${ctx.client.user?.tag}\`);
  }
}`);
