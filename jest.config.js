/**
 * Jest config for the pure-TypeScript logic modules (e.g. src/lib/targets.ts).
 *
 * These modules import nothing from React Native, so we transform them with
 * ts-jest in a plain node environment — fast and dependency-light. UI/component
 * tests, when added, can move to the jest-expo preset.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/src/lib/**/*.test.ts'],
};
