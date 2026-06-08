import { defineConfig } from 'vitest/config';
import { join } from 'node:path';

export default defineConfig({
  test: {
    include: ['./src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['dist/**', 'node_modules/**'],
    watch: false,
    env: {
      COMMANDKIT_TEST: 'true',
    },
  },
  resolve: {
    alias: {
      commandkit: join(
        import.meta.dirname,
        '..',
        'commandkit',
        'src',
        'index.ts',
      ),
    },
  },
});
