import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The playground imports the published subpath; map it to source in tests
    // so playground-only helpers are covered against the real schema.
    alias: {
      'dreamer-genui/schema': new URL(
        './packages/dreamer-genui/src/schema/index.ts',
        import.meta.url,
      ).pathname,
      // M5 figures are a separate tsup entry loaded via a dynamic import;
      // map the published subpath to source so tests exercise the real chunk.
      'dreamer-genui/3d': new URL('./packages/dreamer-genui/src/figure3d/index.tsx', import.meta.url).pathname,
      'dreamer-genui/figures': new URL(
        './packages/dreamer-genui/src/figures/index.tsx',
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    // The jsdom render + axe suites are CPU heavy and run in parallel with
    // canvas/rAF work; the 5s default flakes on slower machines.
    testTimeout: 20000,
    hookTimeout: 20000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
