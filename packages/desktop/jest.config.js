module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-firebase|@react-native-google-signin|@react-native-async-storage)/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testEnvironmentOptions: {
    // For Node.js services like IPC Bridge
  },
  // Use different test environment for service tests
  projects: [
    {
      displayName: 'services',
      testMatch: ['<rootDir>/src/services/**/*.test.ts'],
      testEnvironment: 'node',
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    },
    {
      displayName: 'utils',
      testMatch: ['<rootDir>/src/utils/**/*.test.ts'],
      testEnvironment: 'node',
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
      },
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    },
    {
      displayName: 'react-native',
      preset: 'react-native',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.test.(ts|tsx|js)',
        '!<rootDir>/src/services/**/*.test.ts',
        '!<rootDir>/src/utils/**/*.test.ts',
      ],
      setupFiles: ['<rootDir>/jest.setup.js'],
      setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
      transformIgnorePatterns: [
        'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-firebase|@react-native-google-signin|@react-native-async-storage)/)',
      ],
    },
  ],
};
