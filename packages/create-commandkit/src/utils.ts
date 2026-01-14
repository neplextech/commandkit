import type { CLIOptions, PackageManager } from './types';

export const textColors = {
  commandkit: ['#fdba74', '#e4a5a2', '#c288de', '#b27bf9'],
  js: ['#f7e01c', '#f7e01c'],
  ts: ['#2480c5', '#2480c5'],
};

export function detectPackageManager(): PackageManager {
  const packageManager = process.env.npm_config_user_agent;

  if (packageManager?.includes('pnpm')) return 'pnpm';
  if (packageManager?.includes('yarn')) return 'yarn';
  if (packageManager?.includes('bun')) return 'bun';
  if (packageManager?.includes('npm')) return 'npm';
  if (packageManager?.includes('deno')) return 'deno';

  return 'npm';
}

export function getPackageManagerFromCLI(options: {
  useNpm?: boolean;
  usePnpm?: boolean;
  useYarn?: boolean;
  useBun?: boolean;
  useDeno?: boolean;
}): PackageManager | null {
  if (options.useNpm) return 'npm';
  if (options.usePnpm) return 'pnpm';
  if (options.useYarn) return 'yarn';
  if (options.useBun) return 'bun';
  if (options.useDeno) return 'deno';

  return null;
}

export function resolvePackageManager(
  cliOptions: {
    useNpm?: boolean;
    usePnpm?: boolean;
    useYarn?: boolean;
    useBun?: boolean;
    useDeno?: boolean;
  },
  name: string,
): PackageManager {
  const cliManager = getPackageManagerFromCLI(cliOptions);
  return cliManager || (isDenoProject(name) ? 'deno' : detectPackageManager());
}

export function getDefaultExample(cliOptions: CLIOptions): string {
  if (cliOptions.useDeno) {
    return 'deno-ts';
  }

  return 'basic-ts';
}

export function isOfficialExample(example: string): boolean {
  // Check if it's a GitHub URL pointing to neplextech/commandkit
  if (example.startsWith('http://') || example.startsWith('https://')) {
    try {
      const url = new URL(example);
      return (
        url.hostname === 'github.com' &&
        url.pathname.startsWith('/neplextech/commandkit')
      );
    } catch {
      return false;
    }
  }

  // If it's just an example name, it's official
  return true;
}

export function getInstallCommand(
  manager: PackageManager,
  deps: string[],
  dev = false,
): string {
  switch (manager) {
    case 'npm':
    case 'pnpm':
    case 'yarn':
    case 'bun':
      return `${manager} add ${dev ? '-D' : ''} ${deps.join(' ')}`;
    case 'deno':
      return `deno add ${dev ? '--dev' : ''} ${deps.map((d) => `npm:${d}`).join(' ')}`;
    default:
      return manager satisfies never;
  }
}

export async function fetchAvailableExamples(): Promise<string[]> {
  try {
    const response = await fetch(
      'https://api.github.com/repos/neplextech/commandkit/contents/examples',
      {
        signal: AbortSignal.timeout(10_000),
        headers: {
          'User-Agent': 'create-commandkit',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = (await response.json()) as Array<{
      name: string;
      type: string;
    }>;

    // Filter for directories only and return their names
    return data
      .filter((item) => item.type === 'dir')
      .map((item) => item.name)
      .sort();
  } catch (error) {
    // Fallback to few known examples if API fails
    return ['basic-ts', 'basic-js', 'deno-ts', 'without-cli'];
  }
}

export function isDenoProject(example: string): boolean {
  const isOfficial = isOfficialExample(example);
  // if it's not an official example, we can assume it's not a Deno project
  // the user may use --use-deno to force a Deno project
  if (!isOfficial) return false;

  return example.startsWith('deno-') || example.startsWith('with-deno-');
}
