module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'prettier'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier' // Make sure this is last
  ],
  rules: {
    'prettier/prettier': 'warn',
    // Add any custom rules here
  },
  env: {
    node: true,
    es2021: true
  }
};
