module.exports = {
  env: {
    node: true,
    browser: true,
    jest: true,
    es6: true,
  },
  parser: '@typescript-eslint/parser', // Specifies the ESLint parser
  extends: [
    'eslint:recommended',
    // "plugin:react-hooks/recommended", //TODO: Give me a reason to be here => activate ME!!!
    'plugin:@typescript-eslint/recommended', // Uses the recommended rules from the @typescript-eslint/eslint-plugin
    'prettier/@typescript-eslint',
    'plugin:prettier/recommended',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:import/typescript',
  ],
  parserOptions: {
    ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
    sourceType: 'module', // Allows for the use of imports
    ecmaFeatures: {
      jsx: true, // Allows for the parsing of JSX
    },
  },
  settings: {},
  rules: {
    'no-console': ['warn'],
    'import/no-extraneous-dependencies': ['error'],
    'import/no-unresolved': 'off',
    'import/named': 'off',
    'no-case-declarations': ['warn'],
    '@typescript-eslint/explicit-function-return-type': 'off',
  },
  overrides: [
    {
      files: ['*.{test,spec,story}.ts{,x}'],
      rules: {
        'import/no-extraneous-dependencies': ['warn', { packageDir: './' }],
      },
    },
  ],
};
