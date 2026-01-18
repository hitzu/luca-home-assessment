import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^@factories/(.*)$': '<rootDir>/test/factories/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(@faker-js/faker|@jorgebodega/typeorm-factory)/)',
  ],
  testMatch: [
    '<rootDir>/src/auth/guards/**/*.spec.ts',
    '<rootDir>/src/gov-sync/**/*.spec.ts',
    '<rootDir>/test/gov-sync.e2e-spec.ts',
  ],
  maxWorkers: 1,
  testTimeout: 20000,
};

export default config;

