import { defineConfig } from 'vitest/config';
import { join } from 'path';

export default defineConfig({
  test: {
    include: ['./spec/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    watch: false,
    setupFiles: ['./spec/setup.ts'],
  },
  resolve: {
    alias: {
      '@commandkit/ratelimit': join(import.meta.dirname, 'src', 'index.ts'),
    },
  },
});
