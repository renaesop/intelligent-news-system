const express = require('express');
const request = require('supertest');

/**
 * Creates a test Express app with common middleware
 * @param {Object} options - Configuration options
 * @returns {Object} Express app and test request helper
 */
function createTestServer(options = {}) {
  const app = express();
  
  // Add common middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Add custom middleware if provided
  if (options.middleware) {
    options.middleware.forEach(middleware => app.use(middleware));
  }
  
  // Add routes if provided
  if (options.routes) {
    options.routes.forEach(route => {
      app.use(route.path || '/', route.router);
    });
  }
  
  return {
    app,
    request: request(app)
  };
}

module.exports = {
  createTestServer
};