import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{src,test}/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: { lines: 60, functions: 60, branches: 50, statements: 60 }
    }
  }
});
