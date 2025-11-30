module.exports = {
  // Use projects to separate Node.js tests from React tests
  projects: [
    {
      displayName: 'services',
      testMatch: ['<rootDir>/src/services/**/*.test.ts'],
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
      setupFilesAfterEnv: ['@testing-library/jest-dom'],
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
    },
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
};
