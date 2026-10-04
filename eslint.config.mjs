import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import nx from '@nx/eslint-plugin';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/ng-js/**',
      'libs/shared/legacy-bridge/src/lib/legacy-rating-engine.js',
      'dist',
      '**/coverage',
      '.nx',
      '.angular',
      'node_modules',
      'tools/**',
      '**/*.mjs',
      '**/vitest*.config.js',
      '**/playwright.config.js',
    ],
  },
  {
    files: ['**/*.js'],
    extends: [...tseslint.configs.recommended, prettier],
    plugins: { '@nx': nx },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-extraneous-class': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: false,
          allow: [],
          depConstraints: [
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:feature', 'type:data-access', 'type:ui', 'type:domain', 'type:util'],
            },
            { sourceTag: 'type:bff', onlyDependOnLibsWithTags: ['type:domain', 'type:util'] },
            { sourceTag: 'type:e2e', onlyDependOnLibsWithTags: ['type:domain'] },
            { sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:data-access', 'type:ui', 'type:domain'] },
            { sourceTag: 'type:data-access', onlyDependOnLibsWithTags: ['type:domain'] },
            { sourceTag: 'type:ui', onlyDependOnLibsWithTags: ['type:domain'] },
            { sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:domain'] },
            { sourceTag: 'type:domain', onlyDependOnLibsWithTags: ['type:domain'] },
            { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/risk-console/**/*.js', 'libs/risk/**/*.js', 'libs/shared/ui/**/*.js'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'pnc', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'pnc', style: 'kebab-case' }],
      '@angular-eslint/prefer-on-push-component-change-detection': 'off',
    },
  },
  ...[...angular.configs.templateRecommended, ...angular.configs.templateAccessibility].map((c) => ({ ...c, files: ['**/*.html'] })),
  {
    files: ['**/*.spec.js', 'apps/**/e2e/**', 'apps/risk-console-e2e/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off', 'no-console': 'off' },
  },
);
