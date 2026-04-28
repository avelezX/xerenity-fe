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
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // Next.js sets `jsx: 'preserve'` in tsconfig because the Next compiler
  // handles JSX transformation. Vitest uses Vite, which respects tsconfig
  // by default — so we plug in the official React plugin to handle JSX
  // transformation independently of Next's compiler.
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'src/__tests__/**/*.test.{ts,tsx}'],
    // Fail fast on the first error in CI (kept default in dev/watch mode).
    bail: process.env.CI ? 1 : 0,
    // env runs before any test/source module loads, so modules that read
    // `process.env.NEXT_PUBLIC_*` at import-time pick up these values.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://dummy.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'dummy-anon-key',
      NEXT_PUBLIC_PYSDK_URL: 'https://dummy-pysdk.local',
    },
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
