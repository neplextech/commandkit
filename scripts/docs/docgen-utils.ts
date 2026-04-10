// borrowed from https://github.com/vendure-ecommerce/vendure/blob/cfc0dd7c34fd070a15455508f32d37e94589e656/scripts/docs/docgen-utils.ts

/* eslint-disable no-console */

import fs from 'fs';
import klawSync from 'klaw-sync';

/**
 * Generates the Hugo front matter with the title of the document
 */
export function generateFrontMatter(
  title: string,
  isDefaultIndex = false,
): string {
  return `---
title: "${titleCase(title.replace(/-/g, ' '))}"
isDefaultIndex: ${isDefaultIndex ? 'true' : 'false'}
generated: true
---

import MemberInfo from '@site/src/components/MemberInfo';
import GenerationInfo from '@site/src/components/GenerationInfo';
import MemberDescription from '@site/src/components/MemberDescription';

<!-- This file was generated from the CommandKit source. Do not modify. Instead, re-run the "docgen" script -->
`;
}

const UPPERCASE = new Set(['API', 'CLI', 'AI', 'JSX', 'HTML', 'JSON', 'XML']);

export function titleCase(input: string): string {
  return input
    .split(' ')
    .map((w) => {
      if (UPPERCASE.has(w.toUpperCase())) {
        return w.toUpperCase();
      }
      return w[0].toLocaleUpperCase() + w.substr(1);
    })
    .join(' ');
}

export function normalizeForUrlPart<T extends string | undefined>(input: T): T {
  if (input == null) {
    return input;
  }
  return input
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9-_/]/g, ' ')
    .replace(/\s+/g, '-')
    .toLowerCase() as T;
}

/**
 * Delete all generated docs found in the outputPath.
 */
export function deleteGeneratedDocs(outputPath: string) {
  if (!fs.existsSync(outputPath)) {
    return;
  }
  try {
    let deleteCount = 0;
    const files = klawSync(outputPath, { nodir: true });
    for (const file of files) {
      const content = fs.readFileSync(file.path, 'utf-8');
      if (isGenerated(content)) {
        fs.unlinkSync(file.path);
        deleteCount++;
      }
    }
    if (deleteCount) {
      console.log(`Deleted ${deleteCount} generated docs from ${outputPath}`);
    }
  } catch (e: any) {
    console.error('Could not delete generated docs!');
    console.log(e);
    process.exitCode = 1;
  }
}

/**
 * Returns true if the content matches that of a generated document.
 */
function isGenerated(content: string) {
  return /generated\: true\n---\n/.test(content);
}

export function assertNever(value: never): never {
  throw new Error(
    `Expected never, got ${typeof value} (${JSON.stringify(value)})`,
  );
}

export function notNullOrUndefined<T>(val: T | undefined | null): val is T {
  return val !== undefined && val !== null;
}

export function escapeIfNeeded(input: string): string {
  const shouldEscape = /^[|{}[\]^$+*?.()]/.test(input.trim());
  return shouldEscape
    ? `\\${input.replaceAll('`', '\\`')}`
    : input.replaceAll('`', '\\`');
}

export function addCodeBlockIfNeeded(code: string): string {
  if (code.startsWith('```')) {
    return code;
  }
  return `\`\`\`ts\n${code}\n\`\`\``;
}

export function normalizeLineEndings(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
