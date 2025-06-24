const fs = require('fs');
const path = require('path');

// Setup test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';

// Create test database directory if it doesn't exist
const testDbDir = path.join(__dirname, '..', 'db', 'test');
if (!fs.existsSync(testDbDir)) {
  fs.mkdirSync(testDbDir, { recursive: true });
}

// Clean up test database before each test run
beforeAll(() => {
  const testDbPath = path.join(testDbDir, 'news_test.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

// Global test timeout
jest.setTimeout(30000);