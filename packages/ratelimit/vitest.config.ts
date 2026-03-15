import { defineConfig } from 'vitest/config';
import { vite as rateLimitDirectivePlugin } from 'directive-to-hof';
import { join } from 'path';

export default defineConfig({
  test: {
    include: ['./spec/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    watch: false,
    setupFiles: ['./spec/setup.ts'],
  },
  plugins: [
    rateLimitDirectivePlugin({
      directive: 'use ratelimit',
      importPath: '@commandkit/ratelimit',
      importName: '$ckitirl',
      asyncOnly: true,
    }),
  ],
  resolve: {
    alias: {
      '@commandkit/ratelimit': join(import.meta.dirname, 'src', 'index.ts'),
    },
  },
});
