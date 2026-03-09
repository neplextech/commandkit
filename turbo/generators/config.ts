import type { PlopTypes } from '@turbo/gen';
import YAML from 'yaml';

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  const destination = plop.getDestBasePath();

  plop.setGenerator('bootstrap', {
    description: 'Bootstrap a new CommandKit project',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'What is the name of the package to generate?',
      },
      {
        type: 'input',
        name: 'description',
        message: 'What is the description of the package to generate?',
      },
    ],
    actions: [
      {
        type: 'addMany',
        templateFiles: ['templates/**/*'],
        base: 'templates',
        stripExtensions: ['hbs'],
        destination: `${destination}/packages/{{name}}`,
      },
      {
        type: 'modify',
        path: `${destination}/.github/workflows/publish-dev.yaml`,
        transform(template: string, data: { name: string }): string {
          const packageName = data.name.startsWith('@')
            ? data.name
            : `@commandkit/${data.name}`;
          const packagePath = `packages/${data.name}`;

          // Add to PACKAGES array in publish step
          const publishPackagesMatch = template.match(
            /PACKAGES=\(\s*([\s\S]*?)\s*\)/,
          );
          if (publishPackagesMatch) {
            const packages = publishPackagesMatch[1]
              .split('\n')
              .filter(Boolean)
              .map((p) => p.trim());
            packages.push(`"${packageName}:${packagePath}"`);
            const newPackages = packages
              .map((p) => `            ${p}`)
              .join('\n');
            template = template.replace(
              publishPackagesMatch[0],
              `PACKAGES=(\n${newPackages}\n          )`,
            );
          }

          // Add to PACKAGES array in deprecate step
          const deprecatePackagesMatch = template.match(
            /PACKAGES=\(\s*([\s\S]*?)\s*\)/g,
          );
          if (deprecatePackagesMatch && deprecatePackagesMatch[1]) {
            const packages = deprecatePackagesMatch[1]
              .split('\n')
              .filter(Boolean)
              .map((p) => p.trim())
              .filter((p) => !p.includes('PACKAGES=(') && !p.includes(')')); // Remove any nested PACKAGES=( ... )
            packages.push(`"${packageName}"`);
            const newPackages = packages
              .map((p) => `            ${p}`)
              .join('\n');
            template = template.replace(
              deprecatePackagesMatch[1],
              `PACKAGES=(\n${newPackages}\n          )`,
            );
          }

          return template;
        },
      },
      {
        type: 'modify',
        path: `${destination}/.github/workflows/publish-latest.yaml`,
        transform(template: string, data: { name: string }): string {
          const packageName = data.name.startsWith('@')
            ? data.name
            : `@commandkit/${data.name}`;
          const packagePath = `packages/${data.name}`;
          const entry = `"${packageName}:${packagePath}"`;

          // Update all PACKAGES=(...) arrays (publish + changelog steps)
          const allMatches = template.match(/PACKAGES=\(\s*([\s\S]*?)\s*\)/g);
          if (allMatches) {
            for (const match of allMatches) {
              const inner = match.match(/PACKAGES=\(\s*([\s\S]*?)\s*\)/);
              if (!inner) continue;
              const packages = inner[1]
                .split('\n')
                .filter(Boolean)
                .map((p) => p.trim());
              packages.push(entry);
              const newPackages = packages
                .map((p) => `            ${p}`)
                .join('\n');
              template = template.replace(
                match,
                `PACKAGES=(\n${newPackages}\n          )`,
              );
            }
          }

          return template;
        },
      },
    ],
  });
}
