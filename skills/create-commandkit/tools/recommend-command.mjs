#!/usr/bin/env node

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--')) ?? 'my-bot';
const pm = args.includes('--pnpm')
  ? '--use-pnpm'
  : args.includes('--yarn')
    ? '--use-yarn'
    : '--use-npm';
const fast = args.includes('--yes') ? '--yes' : '';

console.log(`npx create-commandkit@latest ${name} ${pm} ${fast}`.trim());
