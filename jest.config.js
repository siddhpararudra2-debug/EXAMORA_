/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/backend/tests'],
  testMatch: ['**/*.test.ts'],
  // The server code uses ESM-style ".js" import specifiers; map them back to .ts
  moduleNameMapper: {
    '^(\\.+/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.server.json' }],
  },
  testTimeout: 30000,
  collectCoverageFrom: [
    'apps/backend/src/**/*.ts',
    'packages/database/src/**/*.ts',
    'server/**/*.ts',
    '!**/node_modules/**',
  ],
  coverageReporters: ['text', 'lcov', 'html'],
};
