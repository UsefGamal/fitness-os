// Code checks (npm run lint). They run on the source only and never ship
// in the APK. The React Hooks rules catch broken hook order and stale
// effects, the mistakes that are otherwise only found on the phone.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'dist-device/', 'android/', 'public/', 'coverage/', 'src/content.json'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      // The build-time values (__APP_VERSION__ and friends) are declared
      // where they are read, in src/lib/version.js.
      globals: globals.browser,
    },
    rules: {
      // A leading _ marks a value left out on purpose, e.g. ({ _drop, ...rest }).
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  reactHooks.configs.flat.recommended,
  {
    // The React Compiler rules start as warnings: the app does not use the
    // compiler yet, and these findings are fixed screen by screen (they are
    // performance hints, not crashes). The classic hook rules stay errors.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  {
    files: ['src/**/*.jsx'],
    plugins: { 'react-refresh': reactRefresh },
    rules: { 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] },
  },
  {
    // Node scripts, tests and the phone harness.
    files: ['*.config.js', 'scripts/**', 'e2e/**', 'src/**/*.test.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
