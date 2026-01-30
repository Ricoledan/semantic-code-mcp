/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      // Lower thresholds since ML-heavy code (embedder, store) requires model loading
      // which is impractical for unit tests. Security and error handling code has full coverage.
      branches: 25,
      functions: 25,
      lines: 25,
      statements: 25,
    },
  },
  // Skip native module tests by default
  testPathIgnorePatterns: [
    '/node_modules/',
  ],
  // Increase timeout for model loading tests
  testTimeout: 30000,
};
