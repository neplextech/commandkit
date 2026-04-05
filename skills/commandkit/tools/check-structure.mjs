#!/usr/bin/env node
import { existsSync } from 'node:fs';

const required = ['commandkit.config.ts', 'src/app/commands', 'src/app/events'];
const missing = required.filter((p) => !existsSync(p));

if (missing.length > 0) {
  console.error('Missing expected CommandKit paths:');
  for (const m of missing) console.error(`- ${m}`);
  process.exit(1);
}

console.log('Core CommandKit structure looks valid.');
