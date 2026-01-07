const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');

module.exports = [
  js.configs.recommended,
  prettier,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
      },
    },
    rules: {
      // Error prevention
      //'no-console': 'warn',
      'no-debugger': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',
      'no-case-declarations': 'warn',
      // Code quality
      'prefer-const': 'error',
      'no-var': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // Best practices
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-multi-spaces': 'error',
      'no-trailing-spaces': 'error',
      'eol-last': 'error',

      // ES6+
      'arrow-spacing': 'error',
      'no-duplicate-imports': 'error',
      'prefer-template': 'error',
      'template-curly-spacing': 'error',

      // Node.js specific
      'no-process-exit': 'error',
      'no-path-concat': 'error',

      // Async/Await
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',

      // Security
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      '.env*',
      'logs/',
      '*.log',
      'pids/',
      '*.pid',
      '*.seed',
      '*.pid.lock',
      '.nyc_output',
      '.npm',
      '.node_repl_history',
      '*.tgz',
      '.yarn-integrity',
      '.vscode/',
      '.idea/',
      '.DS_Store',
      '.DS_Store?',
      '._*',
      '.Spotlight-V100',
      '.Trashes',
      'ehthumbs.db',
      'Thumbs.db',
      'package-lock.json',
      'yarn.lock',
      '*.config.js',
    ],
  },
];
