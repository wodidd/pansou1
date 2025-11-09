import type { Config } from 'jest'

const config: Config = {
  roots: ['<rootDir>/src/dashboard'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.test.json' }]
  },
  collectCoverage: false
}

export default config
