import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  {
    // Mirrors .gitignore. Flat config does not auto-ignore dot-directories,
    // so the vendored agent-skill copies under `.claude/`, `.github/`, and
    // `.agents/` — all gitignored by `.*/` — would otherwise be linted as
    // project source and bury real findings under thousands of `no-undef`
    // errors for Node globals they legitimately use.
    ignores: [
      '.*/**',
      'dist',
      'coverage',
      'node_modules',
      'playwright-report',
      'test-results',
    ],
  },
  js.configs.recommended,
  {
    // Typed linting applies to the typed program only; the flat config itself
    // is plain JS outside it.
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    rules: {
      // Underscore-prefixed parameters mark a signature kept for a later
      // milestone; removing them would churn the seam.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // ADR 0002: the simulation core is plain TypeScript. No React, no DOM.
    files: ['src/sim/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', '@visx/*'],
              message: 'src/sim/ must stay framework-independent (ADR 0002).',
            },
            {
              group: ['../app/*', '**/app/**'],
              message:
                'src/sim/ must not depend on the React shell (ADR 0002).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'src/sim/ must have no DOM dependency (ADR 0002).',
        },
        {
          name: 'document',
          message: 'src/sim/ must have no DOM dependency (ADR 0002).',
        },
        {
          name: 'Date',
          message:
            'src/sim/ uses the controlled clock, not wall-clock time (ADR 0005).',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message:
            'src/sim/ must use the seeded RNG for determinism (ADR 0001).',
        },
      ],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // ADR 0007: visx is isolated behind the chart-view layer. Everywhere else
    // in the React shell consumes project-owned chart-data instead.
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: ['src/app/charts/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@visx/*'],
              message:
                'Only src/app/charts/ may import visx directly (ADR 0007).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'tests/**/*.ts', '*.config.{ts,js}'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
)
