/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/dashboard/**/*.test.ts',
    '**/dashboard/**/*.spec.ts'
  ],
  collectCoverageFrom: [
    'src/dashboard/**/*.ts',
    '!src/dashboard/**/*.d.ts',
    '!src/dashboard/index.ts'
  ],
  coverageDirectory: 'coverage/dashboard',
  coverageReporters: ['text', 'lcov', 'html'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        types: ['jest', 'node'],
      },
    }],
  },
  testTimeout: 30000,
  verbose: true,
};