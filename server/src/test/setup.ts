// Silence console output during tests
global.console.debug = jest.fn();
global.console.log = jest.fn();

// Set required env vars before any module loads
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret';
process.env.OPENAI_API_KEY = 'sk-test';
process.env.NODE_ENV = 'test';
