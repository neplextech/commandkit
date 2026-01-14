#!/usr/bin/env node

import { confirm, intro, outro, password, text } from '@clack/prompts';
import fs from 'fs-extra';
import gradient from 'gradient-string';
import { execSync } from 'node:child_process';
import path, { join } from 'node:path';
import colors from 'picocolors';

import { parseCLI } from './cli.js';
import { fetchExample } from './functions/fetchExample.js';
import {
  validateDirectory,
  validateProjectName,
} from './functions/validate.js';
import {
  fetchAvailableExamples,
  getDefaultExample,
  getInstallCommand,
  isOfficialExample,
  resolvePackageManager,
  textColors,
} from './utils.js';
import { readFile } from 'node:fs/promises';

async function main() {
  const cliOptions = parseCLI();

  // Handle help and version flags
  if (cliOptions.help) {
    console.log(`
Usage: create-commandkit [options] [project-directory]

Options:
  -h, --help                    Show all available options
  -V, --version                 Output the version number
  -e, --example <name-or-url>  An example to bootstrap the app with
  --example-path <path>        Specify the path to the example separately
  --use-npm                    Explicitly tell the CLI to bootstrap using npm
  --use-pnpm                   Explicitly tell the CLI to bootstrap using pnpm
  --use-yarn                   Explicitly tell the CLI to bootstrap using yarn
  --use-bun                    Explicitly tell the CLI to bootstrap using bun
  --use-deno                   Explicitly tell the CLI to bootstrap using deno
  --skip-install               Explicitly tell the CLI to skip installing packages
  --no-git                     Explicitly tell the CLI to disable git initialization
  --yes                        Use previous preferences or defaults for all options
  --list-examples              List all available examples from the official repository

Examples:
  npx create-commandkit@latest
  npx create-commandkit@latest my-bot
  npx create-commandkit@latest --example basic-ts
  npx create-commandkit@latest --example "https://github.com/user/repo" --example-path "examples/bot"
  npx create-commandkit@latest --use-pnpm --yes
  npx create-commandkit@latest --list-examples
`);
    process.exit(0);
  }

  // Handle list examples flag
  if (cliOptions.listExamples) {
    console.log(colors.cyan('Fetching available examples...'));

    try {
      const examples = await fetchAvailableExamples();

      console.log(colors.green('\nAvailable examples:'));
      console.log('');

      for (const example of examples) {
        console.log(`  ${colors.magenta(example)}`);
      }

      console.log('');
      console.log(
        colors.gray(
          'Usage: npx create-commandkit@latest --example <example-name>',
        ),
      );
      console.log(
        colors.gray('Example: npx create-commandkit@latest --example basic-ts'),
      );
    } catch (error) {
      console.error(
        colors.red(
          'Failed to fetch examples list. Please check your internet connection.',
        ),
      );
      process.exit(1);
    }

    process.exit(0);
  }

  const commandkitGradient = gradient(textColors.commandkit)('CommandKit');
  intro(`Welcome to ${commandkitGradient}!`);

  // Determine project directory
  let projectDir: string;
  if (cliOptions.projectDirectory) {
    projectDir = path.resolve(process.cwd(), cliOptions.projectDirectory);

    // Validate project name if provided
    const projectName = path.basename(projectDir);
    const nameValidation = validateProjectName(projectName);
    if (!nameValidation.valid) {
      console.error(colors.red(`Error: ${nameValidation.error}`));
      process.exit(1);
    }
  } else if (cliOptions.yes) {
    projectDir = path.resolve(process.cwd(), 'commandkit-project');
  } else {
    projectDir = path.resolve(
      process.cwd(),
      (await text({
        message: 'Enter a project directory:',
        placeholder: 'Leave blank for current directory',
        defaultValue: '.',
        validate: (value) => {
          value = path.resolve(process.cwd(), value);
          const validation = validateDirectory(value);
          return validation.valid ? undefined : validation.error;
        },
      })) as string,
    );
  }

  // Validate directory
  const dirValidation = validateDirectory(projectDir);
  if (!dirValidation.valid) {
    console.error(colors.red(`Error: ${dirValidation.error}`));
    process.exit(1);
  }

  // Get Discord token
  let token: string;
  if (cliOptions.yes) {
    token = '';
  } else {
    token = (await password({
      message: 'Enter your Discord bot token (stored in .env, optional):',
      mask: colors.gray('*'),
    })) as string;
  }

  // Determine git initialization
  const gitInit = cliOptions.noGit
    ? false
    : cliOptions.yes
      ? true
      : await confirm({
          message: 'Initialize a git repository?',
          initialValue: true,
        });

  outro(colors.cyan('Setup complete.'));

  const example = cliOptions.example || getDefaultExample(cliOptions);

  // Determine package manager
  const manager = resolvePackageManager(cliOptions, example);

  // Fetch example from GitHub
  try {
    await fetchExample({
      example,
      examplePath: cliOptions.examplePath,
      targetDir: projectDir,
    });
    // Create .env file with token
    await fs.writeFile(`${projectDir}/.env`, `DISCORD_TOKEN="${token || ''}"`);

    // Install packages for official examples
    if (isOfficialExample(example) && !cliOptions.skipInstall) {
      console.log(
        colors.cyan('Installing dependencies for official example...'),
      );

      try {
        const tagMap = [
          ['-dev.', 'dev'],
          ['-rc.', 'next'],
        ];

        const tag = await readFile(
          join(import.meta.dirname, '..', 'package.json'),
          'utf-8',
        )
          .then((data) => {
            const version = JSON.parse(data).version;

            return (
              tagMap.find(([suffix]) => version.includes(suffix))?.[1] ||
              'latest'
            );
          })
          .catch(() => 'latest');

        // Install dependencies
        const depsCommand = getInstallCommand(manager, [
          `commandkit@${tag}`,
          'discord.js',
        ]);
        execSync(depsCommand, { cwd: projectDir, stdio: 'pipe' });

        // Install dev dependencies
        const devDepsCommand = getInstallCommand(
          manager,
          ['typescript', '@types/node'],
          true,
        );
        execSync(devDepsCommand, { cwd: projectDir, stdio: 'pipe' });

        console.log(colors.green('Dependencies installed successfully!'));
      } catch (error) {
        console.log(
          colors.yellow(
            'Warning: Failed to install dependencies. You may need to install them manually.',
          ),
        );
      }
    }
  } catch (error) {
    console.error(
      colors.red(
        `Error fetching example: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ),
    );
    process.exit(1);
  }

  // Initialize git if requested
  if (gitInit) {
    try {
      execSync('git init', { cwd: projectDir, stdio: 'pipe' });
    } catch (error) {
      console.log(
        colors.yellow(
          'Warning: Git initialization failed. Make sure Git is installed on your system.',
        ),
      );
    }
  }

  const command = (cmd: string) => {
    switch (manager) {
      case 'npm':
      // bun build runs bundler instead of the build script
      case 'bun':
        return `${manager} run ${cmd}`;
      case 'pnpm':
      case 'yarn':
        return `${manager} ${cmd}`;
      case 'deno':
        return `deno task ${cmd}`;
      default:
        return manager satisfies never;
    }
  };

  console.log(
    `${gradient(textColors.commandkit)('Thank you for choosing CommandKit!')}

To start your bot${projectDir !== '.' ? `, ${colors.magenta(`cd ${projectDir}`)}` : ''}${projectDir !== '.' ? ' and' : ''} use the following commands:
  ${colors.magenta(command('dev'))}     - Run your bot in development mode
  ${colors.magenta(command('build'))}   - Build your bot for production
  ${colors.magenta(command('start'))}   - Run your bot in production mode

• Documentation: ${colors.blue('https://commandkit.dev')}
• GitHub: ${colors.blue('https://github.com/neplextech/commandkit')}
• Neplex: ${colors.blue('https://neplextech.com')}
• Discord community: ${colors.blue('https://neplextech.com/discord')}

Happy coding! 🚀`,
  );
}

main().catch((error) => {
  console.error(
    colors.red(
      `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    ),
  );
  process.exit(1);
});
