module.exports = {
  // Global timeout for property-based tests
  testTimeout: 30000,

  // Use projects to separate Node.js tests from React tests
  projects: [
    {
      displayName: 'services',
      testMatch: [
        '<rootDir>/src/services/**/*.test.ts',
        '<rootDir>/src/services/**/*.property.test.ts',
      ],
      testEnvironment: 'node',
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
      },
    },
    {
      displayName: 'utils',
      testMatch: ['<rootDir>/src/utils/**/*.test.ts'],
      testEnvironment: 'node',
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
      },
    },
    {
      displayName: 'react',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.test.(ts|tsx|js)',
        '!<rootDir>/src/services/**/*.test.ts',
        '!<rootDir>/src/utils/**/*.test.ts',
      ],
      testEnvironment: 'jsdom',
      setupFiles: ['<rootDir>/jest.setup.js'],
      setupFilesAfterEnv: ['@testing-library/jest-dom', '<rootDir>/jest.setupAfterEnv.js'],
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
      },
      transformIgnorePatterns: [
        'node_modules/(?!(firebase|@firebase)/)',
      ],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
      },
      // Enhanced test isolation settings
      clearMocks: true,
      restoreMocks: true,
      resetMocks: true,
      resetModules: true,
      // Prevent test pollution by running each test in isolation
      maxWorkers: 1,
      // Additional isolation settings
      // Ensure clean environment for each test
      testEnvironmentOptions: {
        url: 'http://localhost',
        pretendToBeVisual: true,
        resources: 'usable'
      }
    },
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
};
