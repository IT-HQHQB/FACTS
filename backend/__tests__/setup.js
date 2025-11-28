// Test setup file
require('dotenv').config({ path: '.env.test' });

// Set test environment variables if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

// Increase timeout for database operations
jest.setTimeout(30000);

// Global test cleanup
afterAll(async () => {
  // Close any open connections
  const { pool } = require('../config/database');
  await pool.end();
});


















