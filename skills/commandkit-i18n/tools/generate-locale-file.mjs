#!/usr/bin/env node

const locale = process.argv[2] ?? 'en-US';
const command = process.argv[3] ?? 'ping';

const template = {
  $command: {
    name: command,
    description: `Description for ${command}`,
  },
  response: 'Localized response text',
};

console.log(`// Save as src/app/locales/${locale}/${command}.json`);
console.log(JSON.stringify(template, null, 2));
