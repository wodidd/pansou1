// Test setup file
import { TextEncoder, TextDecoder } from 'util';
// Polyfill for TextEncoder/TextDecoder for Node.js < 11
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
// Mock console methods to reduce noise during tests
global.console = {
    ...console,
    // Uncomment to ignore specific console methods during tests
    // log: jest.fn(),
    // debug: jest.fn(),
    // info: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
};
// Set default timeout for async operations
// Note: jest.setTimeout is set in jest.config.js instead
//# sourceMappingURL=setup.js.map