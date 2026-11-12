/**
 * Jest config for the pure-TypeScript logic modules (e.g. src/lib/targets.ts).
 *
 * These modules import nothing from React Native, so we transform them with
 * ts-jest in a plain node environment — fast and dependency-light. UI/component
 * tests, when added, can move to the jest-expo preset.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/lib/**/*.test.ts'],
  // Each file is only transpiled, not type checked: `npm run typecheck`
  // checks types for the whole project, and skipping it here makes a cold
  // run several times faster.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { isolatedModules: true } }],
  },
};
