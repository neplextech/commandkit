// borrowed from https://github.com/vendure-ecommerce/vendure/blob/cfc0dd7c34fd070a15455508f32d37e94589e656/scripts/docs/generate-typescript-docs.ts
/* eslint-disable no-console */
import fs from 'fs-extra';
import klawSync from 'klaw-sync';
import path, { extname } from 'path';

import { deleteGeneratedDocs, normalizeForUrlPart } from './docgen-utils';
import { TypeMap } from './typescript-docgen-types';
import { TypescriptDocsParser } from './typescript-docs-parser';
import { TypescriptDocsRenderer } from './typescript-docs-renderer';

interface DocsSectionConfig {
  sourceDirs: string[];
  exclude?: RegExp[];
  outputPath: string;
  category: string;
}

const sections: DocsSectionConfig[] = [
  {
    sourceDirs: ['packages/commandkit/src/'],
    outputPath: '',
    category: 'commandkit',
  },
  {
    sourceDirs: ['packages/ai/src/'],
    outputPath: '',
    category: 'ai',
  },
  {
    sourceDirs: ['packages/analytics/src/'],
    outputPath: '',
    category: 'analytics',
  },
  {
    sourceDirs: ['packages/cache/src/'],
    outputPath: '',
    category: 'cache',
  },
  {
    sourceDirs: ['packages/i18n/src/'],
    outputPath: '',
    category: 'i18n',
  },
  {
    sourceDirs: ['packages/legacy/src/'],
    outputPath: '',
    category: 'legacy',
  },
  {
    sourceDirs: ['packages/redis/src/'],
    outputPath: '',
    category: 'redis',
  },
  {
    sourceDirs: ['packages/queue/src/'],
    outputPath: '',
    category: 'queue',
  },
  {
    sourceDirs: ['packages/tasks/src/'],
    outputPath: '',
    category: 'tasks',
  },
  {
    sourceDirs: ['packages/ratelimit/src/'],
    outputPath: '',
    category: 'ratelimit',
  },
];

generateTypescriptDocs(sections);

const watchMode = !!process.argv.find(
  (arg) => arg === '--watch' || arg === '-w',
);
if (watchMode) {
  console.log(`Watching for changes to source files...`);
  sections.forEach((section) => {
    section.sourceDirs.forEach((dir) => {
      fs.watch(dir, { recursive: true }, (eventType, file) => {
        if (file && extname(file) === '.ts') {
          console.log(`Changes detected in ${dir}`);
          generateTypescriptDocs([section], true);
        }
      });
    });
  });
}

/**
 * Uses the TypeScript compiler API to parse the given files and extract out the documentation
 * into markdown files
 */
function generateTypescriptDocs(
  config: DocsSectionConfig[],
  isWatchMode: boolean = false,
) {
  const timeStart = +new Date();

  // This map is used to cache types and their corresponding Hugo path. It is used to enable
  // hyperlinking from a member's "type" to the definition of that type.
  const globalTypeMap: TypeMap = new Map();

  if (!isWatchMode) {
    for (const { outputPath, sourceDirs } of config) {
      deleteGeneratedDocs(absOutputPath(outputPath));
    }
  }

  for (const { outputPath, sourceDirs, exclude, category } of config) {
    const sourceFilePaths = getSourceFilePaths(sourceDirs, exclude);
    const docsPages = new TypescriptDocsParser().parse(
      sourceFilePaths,
      category,
    );

    for (const page of docsPages) {
      const { category, fileName, declarations } = page;
      for (const declaration of declarations) {
        // Skip private/internal declarations from typeMap
        if (isPrivateOrInternal(declaration)) {
          continue;
        }

        const kindDir = getKindDirectory(declaration.kind);
        const pathToTypeDoc = `docs/api-reference/${outputPath ? `${outputPath}/` : ''}${
          category
            ? category.map((part) => normalizeForUrlPart(part)).join('/') + '/'
            : ''
        }${kindDir}/${normalizeForUrlPart(declaration.title)}#${toHash(declaration.title)}`;
        globalTypeMap.set(declaration.title, pathToTypeDoc);
      }
    }
    const docsUrl = ``;
    const generatedCount = new TypescriptDocsRenderer().render(
      docsPages,
      docsUrl,
      absOutputPath(outputPath),
      globalTypeMap,
    );

    if (generatedCount) {
      console.log(
        `Generated ${generatedCount} typescript api docs for "${outputPath || category}" in ${
          +new Date() - timeStart
        }ms`,
      );
    }
  }
}

function toHash(title: string): string {
  return title.replace(/\s/g, '').toLowerCase();
}

function absOutputPath(outputPath: string): string {
  return path.join(
    __dirname,
    '../../apps/website/docs/api-reference/',
    outputPath,
  );
}

function getSourceFilePaths(
  sourceDirs: string[],
  excludePatterns: RegExp[] = [],
): string[] {
  return sourceDirs
    .map((scanPath) => {
      const dir = path.join(__dirname, '../../', scanPath);

      return klawSync(dir, {
        nodir: true,
        filter: (item) => {
          const ext = path.extname(item.path);

          if (ext === '.ts' || ext === '.tsx') {
            for (const pattern of excludePatterns) {
              if (pattern.test(item.path)) {
                return false;
              }
            }
            return true;
          }
          return false;
        },
        traverseAll: true,
      });
    })
    .reduce((allFiles, files) => [...allFiles, ...files], [])
    .map((item) => item.path);
}

function isPrivateOrInternal(declaration: any): boolean {
  // Check if declaration is marked as internal
  if (
    declaration.description &&
    declaration.description.includes('@internal')
  ) {
    return true;
  }

  // Check if declaration name starts with underscore (private by convention)
  if (
    declaration.title &&
    (declaration.title.startsWith('_') || declaration.title.startsWith('#'))
  ) {
    return true;
  }

  // For classes and interfaces, check if they have private/internal members only
  if (declaration.kind === 'class' || declaration.kind === 'interface') {
    const hasPublicMembers =
      declaration.members &&
      declaration.members.some(
        (member: any) =>
          !member.name.startsWith('_') &&
          !member.name.startsWith('#') &&
          !member.description.includes('@internal'),
      );
    // If it has no public members and is not explicitly documented, consider it internal
    if (
      !hasPublicMembers &&
      (!declaration.description || !declaration.description.trim())
    ) {
      return true;
    }
  }

  return false;
}

function getKindDirectory(kind: string): string {
  const kindMapping = {
    interface: 'interfaces',
    typeAlias: 'types',
    class: 'classes',
    enum: 'enums',
    function: 'functions',
    variable: 'variables',
  };
  return kindMapping[kind as keyof typeof kindMapping] || kind;
}
