import { defineConfig } from 'vitest/config';
import { vite as cacheDirectivePlugin } from 'directive-to-hof';
import { join } from 'path';

export default defineConfig({
  test: {
    include: ['./src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    exclude: ['dist/**', '.commandkit/**', 'node_modules/**'],
    watch: false,
    dangerouslyIgnoreUnhandledErrors: true,
    env: {
      COMMANDKIT_TEST: 'true',
    },
  },
  resolve: {
    alias: {
      commandkit: join(import.meta.dirname, 'src', 'index.ts'),
    },
  },
  plugins: [
    cacheDirectivePlugin({
      directive: 'use cache',
      importPath: '@commandkit/cache',
      importName: '$ckitiucw',
      asyncOnly: true,
    }),
  ],
  optimizeDeps: {
    esbuildOptions: {
      jsxFactory: 'CommandKit.createElement',
      jsxFragment: 'CommandKit.Fragment',
    },
  },
});
