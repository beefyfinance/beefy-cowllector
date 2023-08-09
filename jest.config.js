module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testPathIgnorePatterns: [
        '<rootDir>/data/',
        '<rootDir>/node_modules/',
        '<rootDir>/src/script/test.ts',
        '<rootDir>/dist/',
    ],
    resetMocks: true,
    clearMocks: true,
};
