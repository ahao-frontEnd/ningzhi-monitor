import eslint from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import eslintPrettier from 'eslint-plugin-prettier'
import importSort from 'eslint-plugin-simple-import-sort'

import tsEslint from 'typescript-eslint'

const ignores = [
    'dist',
    'build',
    '**/*.js',
    '**/*.mjs',
    '**/*.d.ts',
    'eslint.config.js',
    'commitlint.config.js',
    'apps/frontend/monitor/src/components/ui/**/*',
    'packages/browser-utils/src/metrics/**/*',
]

const frontendMonitorConfig = {
  files: ['apps/frontend/monitor/**/*.{ts,tsx}'],
  ignores: ['apps/frontend/monitor/src/components/ui/**/*'],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  plugins: {
    'react-hooks': reactHooks, // React Hooks 规则，确保 React Hooks 的正确使用
    'react-refresh': reactRefresh // React Refresh 是检查 React 组件是否正确使用 React Refresh 的插件，确保热更新功能正常工作
  },
  rules: {
    ...reactHooks.configs.recommended.rules,
    // 这个规则表示 React Refresh 只允许导出组件，允许导出常量（如函数、对象等），但不允许导出非组件的变量。这有助于确保热更新功能正常工作，同时允许开发者导出其他类型的变量。
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'no-console': 'error',
  },
}

const backendMonitorConfig = {
  files: ['apps/backend/**/*.ts'],
  languageOptions: {
    globals: {
      ...globals.node,
      ...globals.jest,
    },
    // parser 表示使用 TypeScript ESLint 解析器来解析 TypeScript 代码，这样 ESLint 就能够理解 TypeScript 的语法和特性，从而正确地分析和检查 TypeScript 代码中的潜在问题。
    parser: tsEslint.parser,
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off', // 这个规则要求函数必须显式地声明返回类型。关闭这个规则可以让开发者在编写函数时不必每次都声明返回类型，尤其是在 TypeScript 能够推断出返回类型的情况下。
    // 这个规则要求在模块边界上显式地声明函数和类的返回类型。关闭这个规则可以让开发者在模块边界上不必每次都声明返回类型，尤其是在 TypeScript 能够推断出返回类型的情况下。
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // 这个规则要求接口名称必须以大写字母 "I" 开头。关闭这个规则可以让开发者在命名接口时不必遵循这个特定的命名约定，从而提供更多的灵活性。
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-console': 'error',
  }
}

export default tsEslint.config(
  {
    ignores,
    extends: [eslint.configs.recommended, ...tsEslint.configs.recommended],
    plugins: {
      prettier: eslintPrettier,
      'simple-import-sort': importSort
    },
    rules: {
      'prettier/prettier': 'error', // 表示 Prettier 的格式问题将被视为 ESLint 错误，这样可以确保代码始终符合 Prettier 的格式规范。
      'simple-import-sort/imports': 'error',
    }
  },
  frontendMonitorConfig,
  backendMonitorConfig
)