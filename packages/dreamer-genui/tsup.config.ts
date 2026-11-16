import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: './src/index.ts',
    'schema/index': './src/schema/index.ts',
    'core/index': './src/core/index.ts',
    'react/index': './src/react/index.ts',
    'headless/index': './src/headless/index.ts',
    'devtools/index': './src/devtools/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  clean: true,
});
