import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginReactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import { configs as tslintConfigs, parser as tslintParser, plugin as tslintPlugin } from 'typescript-eslint';

const compat = new FlatCompat({
  baseDirectory: process.cwd(),
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  globalIgnores(['dist']),
  eslintConfigPrettier,
  ...tslintConfigs.recommended,
  ...tslintConfigs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['src/**/*.ts', 'src/**/*.tsx'],
  })),
  ...compat.extends('plugin:import/recommended', 'plugin:import/typescript', 'plugin:prettier/recommended'),
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: { '@typescript-eslint': tslintPlugin },
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      parser: tslintParser,
      ecmaVersion: 2020,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
    rules: {
      '@typescript-eslint/consistent-indexed-object-style': ['error', 'record'],

      '@typescript-eslint/consistent-type-exports': ['error', { fixMixedExportsWithInlineTypeSpecifier: false }],

      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'separate-type-imports', prefer: 'type-imports' },
      ],

      '@typescript-eslint/explicit-function-return-type': 'error',

      // Disallow invalid uses of `this`
      '@typescript-eslint/no-invalid-this': 'error',

      // Enforce explicit `this` parameter type annotations
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: ['parameter', 'variable'],
          leadingUnderscore: 'require',
          format: ['camelCase'],
          modifiers: ['unused'],
        },
        {
          selector: ['parameter', 'variable'],
          leadingUnderscore: 'allowDouble',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
        },
      ],

      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],

      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowConstructorOnly: true, allowStaticOnly: true, allowWithDecorator: true },
      ],

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      'no-restricted-exports': [
        'error',
        {
          restrictDefaultExports: {
            direct: true,
            named: true,
            defaultFrom: true,
            namedFrom: true,
            namespaceFrom: true,
          },
        },
      ],
    },
  },
  {
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      ...pluginReact.configs.flat.recommended?.languageOptions,
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
  },
  {
    plugins: { 'react-hooks': pluginReactHooks, 'react-refresh': pluginReactRefresh },
    settings: { react: { version: 'detect' } },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
      // React scope no longer necessary with new JSX transform.
      'react/react-in-jsx-scope': 'off',
      'react-refresh/only-export-components': 'error',
    },
  },
  {
    files: ['*.config.?(m)js', '*.config.?(c)js', '*.config.?(m)ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-default-export': 'off',
      'import/no-unresolved': 'off',
      'no-restricted-exports': 'off',
      // '@typescript-eslint/explicit-function-return-type': 'off',
      // '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
]);
