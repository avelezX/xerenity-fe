/**
 * Vitest configuration — Phase 4 (#301), sub-issue #325.
 *
 * Mirrors the path aliases defined in `tsconfig.json` so test imports work
 * the same way as production code. Uses `happy-dom` because it boots ~5x
 * faster than jsdom and we don't need anything jsdom-specific.
 *
 * Globals are enabled (no need to import `describe`/`it`/`expect`); this
 * matches Jest's default and keeps test files concise.
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'src/__tests__/**/*.test.{ts,tsx}'],
    // Fail fast on the first error in CI (kept default in dev/watch mode).
    bail: process.env.CI ? 1 : 0,
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@layout': path.resolve(__dirname, './src/layout'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@types': path.resolve(__dirname, './src/types'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@store': path.resolve(__dirname, './src/store'),
      '@styles': path.resolve(__dirname, './src/styles'),
    },
  },
});
