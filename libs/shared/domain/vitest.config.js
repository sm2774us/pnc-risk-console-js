import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/**/*.spec.js', 'src/index.js'],
      thresholds: { lines: 90, functions: 90, branches: 80, statements: 90 },
    },
  },
});
