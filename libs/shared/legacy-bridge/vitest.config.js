import { defineConfig } from 'vitest/config';
import { workspaceAlias } from '../../../vitest.shared.mjs';
export default defineConfig({
  resolve: { alias: workspaceAlias },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*'],
      exclude: ['src/**/*.spec.js', 'src/index.js', 'src/**/*.d.js'],
      thresholds: { lines: 90, functions: 90, branches: 80, statements: 90 },
    },
  },
});
