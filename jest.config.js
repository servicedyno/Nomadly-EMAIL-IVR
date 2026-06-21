module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/legacy/'],
  // Some legacy code uses node 20 features; keep it minimal here
  testTimeout: 10_000,
}
