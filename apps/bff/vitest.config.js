import { defineConfig } from 'vitest/config';
import { workspaceAlias } from '../../vitest.shared.mjs';
export default defineConfig({
  resolve: { alias: workspaceAlias },
  oxc: { decorator: { legacy: true } },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.js', 'test/**/*.int.spec.js'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/**/*.spec.js', 'src/main.js'],
      thresholds: { lines: 85, functions: 85, branches: 75, statements: 85 },
    },
  },
});
