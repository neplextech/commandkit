import path from 'node:path';
import fs from 'node:fs';

const BEGIN_MARKER = '<!-- BEGIN_AVAILABLE_EXAMPLES -->';
const END_MARKER = '<!-- END_AVAILABLE_EXAMPLES -->';

const README_PATH = path.join(import.meta.dirname, '..', 'README.md');
const README_CONTENT = fs.readFileSync(README_PATH, 'utf8');

function insertBetween(content: string) {
  const availableExamples = fs.readdirSync(
    path.join(import.meta.dirname, '..', '..', '..', 'examples'),
  );

  const examples = availableExamples
    .map(
      (example) =>
        `- \`${example}\` - [examples/${example}](https://github.com/neplextech/commandkit/tree/main/examples/${example})`,
    )
    .join('\n');

  const between = `${BEGIN_MARKER}\n${examples}\n${END_MARKER}`;
  const newContent = [
    content.split(BEGIN_MARKER)[0],
    between,
    content.split(END_MARKER)[1],
  ].join('');

  return newContent;
}

const newContent = insertBetween(README_CONTENT);

fs.writeFileSync(README_PATH, newContent);
