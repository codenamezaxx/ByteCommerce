/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'jest-fixed-jsdom',
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
  extensionsToTreatAsEsm: [],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '@aejkatappaja/phantom-ui': '<rootDir>/__tests__/mocks/phantom-ui.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        module: 'commonjs',
        esModuleInterop: true,
        allowJs: true,
        strict: true,
        moduleResolution: 'node',
        target: 'es2020',
        paths: { '@/*': ['./*'] },
        baseUrl: '.',
      },
    }],
    '^.+\\.m?js$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(rettime|msw|@mswjs|until-async|@open-draft|headers-polyfill|outvariant|strict-event-emitter|tough-cookie|graphql|path-to-regexp)/)',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/__tests__/mocks/',
    '<rootDir>/__tests__/setup\\.ts$',
    '<rootDir>/__tests__/setupTests\\.ts$',
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
}
