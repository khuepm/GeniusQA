module.exports = {
  // Use projects to separate Node.js tests from React Native tests
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
      },
    },
    {
      displayName: 'react-native',
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.test.(ts|tsx|js)',
        '!<rootDir>/src/services/**/*.test.ts',
        '!<rootDir>/src/utils/**/*.test.ts',
      ],
      testEnvironment: 'node',
      setupFiles: ['<rootDir>/jest.setup.js'],
      setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { configFile: './babel.config.js' }],
      },
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|@react-native-firebase|@react-native-google-signin|@react-native-async-storage)/)',
      ],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^react-native$': '<rootDir>/node_modules/react-native',
      },
    },
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
};
