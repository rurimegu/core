module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: __dirname + '/tsconfig.json',
    sourceType: 'module',
  },
  extends: [
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    jest: true,
  },
  ignorePatterns: ['.eslintrc.cjs', 'build.js', '*.config.ts', '*.config.js'],
  rules: {
    eqeqeq: 'warn',
    'no-return-await': 'warn',
    'no-implicit-coercion': 'warn',
    'linebreak-style': ['error', 'unix'],
    '@typescript-eslint/no-floating-promises': 'warn',
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-unused-vars': [
      2,
      { args: 'all', argsIgnorePattern: '^_' },
    ],
  },
};
