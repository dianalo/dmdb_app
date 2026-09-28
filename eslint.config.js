import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { globalIgnores } from 'eslint/config';

export default tseslint.config([
  globalIgnores([
    'dist',
    'coverage',
    'node_modules',
    'assets',
    'playwright-report',
    'test-results',
    'playwright/.cache',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    files: [
      'vite.config.ts',
      'playwright.config.ts',
      'scripts/**/*.ts',
      'e2e/**/*.ts',
      'eslint.config.js',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
