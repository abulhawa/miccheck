import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {alias: [
    {find: /^@miccheck\/audio-core$/, replacement: fileURLToPath(new URL('../../packages/audio-core/src/index.ts', import.meta.url))},
    {find: /^@miccheck\/audio-metrics$/, replacement: fileURLToPath(new URL('../../packages/audio-metrics/src/index.ts', import.meta.url))},
  ]},
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['{app,components,hooks,lib,src}/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: { lines: 60, functions: 60, branches: 50, statements: 60 }
    }
  }
});
