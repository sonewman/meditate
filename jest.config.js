const { pathsToModuleNameMapper } = require('ts-jest/utils');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  rootDir: __dirname,
  testMatch: [
    '<rootDir>/src/__tests__/*.test.ts'
  ],
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.d.ts',
    '!**/*.test.ts'
  ],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
    }
  }
};
