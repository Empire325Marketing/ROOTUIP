// Test setup file
const winston = require('winston');

// Disable logging during tests
winston.configure({
    transports: [
        new winston.transports.Console({
            silent: true
        })
    ]
});

// Set test environment
process.env.NODE_ENV = 'test';

// Mock timers for consistent test results
jest.useFakeTimers('modern');
jest.setSystemTime(new Date('2024-01-15'));

// Global test utilities
global.testUtils = {
    generateTestEmail: () => `test-${Date.now()}@test.com`,
    generateTestCompany: () => `Test Company ${Date.now()}`,
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Clean up after all tests
afterAll(async () => {
    // Close any open handles
    jest.clearAllTimers();
    jest.useRealTimers();
});