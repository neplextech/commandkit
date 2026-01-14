import { defineConfig } from 'tsdown';
import { MacroTransformer } from 'use-macro';

const macro = new MacroTransformer();

export default defineConfig({
  format: ['cjs'],
  entry: ['src/**/*.ts'],
  outDir: './dist',
  sourcemap: true,
  watch: false,
  minify: false,
  dts: true,
  shims: false,
  skipNodeModulesBundle: true,
  clean: true,
  platform: 'node',
  target: 'node16',
  outputOptions: {
    exports: 'named',
  },
  fixedExtension: false,
  outExtensions: (context) => {
    return {
      dts: '.d.ts',
      js: context.format === 'es' ? '.mjs' : '.js',
    };
  },
  logLevel: 'silent',
  unbundle: false,
  plugins: [
    {
      name: 'macro',
      transform: {
        filter: {
          id: /\.(c|m)?(t|j)sx?$/,
        },
        async handler(code, id) {
          const result = await macro.transform(code, id);

          return {
            code: result.contents as string,
          };
        },
      },
    },
  ],
});
