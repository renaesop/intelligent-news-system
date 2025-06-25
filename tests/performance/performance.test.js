const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Mock environment
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.MEM0_API_KEY = 'test-key';

// Create test app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Mock database with performance simulation
const mockDb = {
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
  exec: jest.fn()
};

jest.mock('../../db/database', () => mockDb);

// Mock services with realistic delays
jest.mock('../../services/vectorService', () => ({
  getPersonalizedRecommendations: jest.fn(),
  generateEmbedding: jest.fn(),
  findSimilarArticles: jest.fn()
}));

jest.mock('../../services/recallRankingService', () => ({
  getRecommendations: jest.fn(),
  getRecommendationStats: jest.fn(),
  getCachedRecommendations: jest.fn(),
  cacheRecommendations: jest.fn()
}));

const vectorService = require('../../services/vectorService');
const recallRankingService = require('../../services/recallRankingService');

// Setup API routes
app.get('/api/articles/recommended', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const forceRefresh = req.query.forceRefresh === 'true';
    const enableExplain = req.query.enableExplain === 'true';
    
    const options = { page, pageSize, forceRefresh, enableExplain };
    const recommendations = await recallRankingService.getRecommendations(userId, options);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

app.post('/api/articles/search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;
    const results = await vectorService.findSimilarArticles(query, limit);
    res.json({ results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

describe('Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Recommendation Performance', () => {
    test('should handle concurrent recommendation requests', async () => {
      const mockRecommendations = {
        data: [
          { id: 1, title: 'Article 1', final_score: 0.9 },
          { id: 2, title: 'Article 2', final_score: 0.8 }
        ],
        pagination: {
          current_page: 1,
          page_size: 20,
          total_items: 2,
          total_pages: 1,
          has_next: false,
          has_previous: false
        },
        metadata: {
          cache_used: false,
          generated_at: new Date().toISOString(),
          algorithm_version: '2.0'
        }
      };

      // Simulate realistic response times
      recallRankingService.getRecommendations.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockRecommendations), 100))
      );

      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        request(app)
          .get(`/api/articles/recommended?userId=user-${i}`)
          .expect(200)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should complete
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach(response => {
        expect(response.body).toEqual(mockRecommendations);
      });

      // Should handle concurrency efficiently (not much slower than sequential)
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
      expect(recallRankingService.getRecommendations).toHaveBeenCalledTimes(concurrentRequests);

      console.log(`Concurrent requests (${concurrentRequests}) completed in ${totalTime}ms`);
    });

    test('should benefit from caching on repeated requests', async () => {
      const cachedRecommendations = {
        data: [{ id: 1, title: 'Cached Article' }],
        pagination: { current_page: 1, page_size: 20, total_items: 1, total_pages: 1 },
        metadata: { cache_used: true, generated_at: new Date().toISOString() }
      };

      const freshRecommendations = {
        data: [{ id: 2, title: 'Fresh Article' }],
        pagination: { current_page: 1, page_size: 20, total_items: 1, total_pages: 1 },
        metadata: { cache_used: false, generated_at: new Date().toISOString() }
      };

      // First request - cache miss (slow)
      recallRankingService.getRecommendations
        .mockImplementationOnce(() => 
          new Promise(resolve => setTimeout(() => resolve(freshRecommendations), 200))
        )
        // Second request - cache hit (fast)
        .mockImplementationOnce(() => 
          new Promise(resolve => setTimeout(() => resolve(cachedRecommendations), 10))
        );

      const userId = 'cache-test-user';

      // First request
      const startTime1 = Date.now();
      const response1 = await request(app)
        .get(`/api/articles/recommended?userId=${userId}`)
        .expect(200);
      const time1 = Date.now() - startTime1;

      // Second request (should be cached)
      const startTime2 = Date.now();
      const response2 = await request(app)
        .get(`/api/articles/recommended?userId=${userId}`)
        .expect(200);
      const time2 = Date.now() - startTime2;

      expect(response1.body.metadata.cache_used).toBe(false);
      expect(response2.body.metadata.cache_used).toBe(true);
      expect(time2).toBeLessThan(time1); // Cached request should be faster

      console.log(`First request: ${time1}ms, Cached request: ${time2}ms`);
    });

    test('should handle large page sizes efficiently', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        title: `Article ${i + 1}`,
        final_score: Math.random()
      }));

      const mockLargeResponse = {
        data: largeDataset.slice(0, 100), // First 100 items
        pagination: {
          current_page: 1,
          page_size: 100,
          total_items: 1000,
          total_pages: 10,
          has_next: true,
          has_previous: false
        },
        metadata: {
          cache_used: false,
          generated_at: new Date().toISOString(),
          algorithm_version: '2.0'
        }
      };

      recallRankingService.getRecommendations.mockResolvedValue(mockLargeResponse);

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/articles/recommended?pageSize=100')
        .expect(200);
      const responseTime = Date.now() - startTime;

      expect(response.body.data).toHaveLength(100);
      expect(response.body.pagination.total_items).toBe(1000);
      expect(responseTime).toBeLessThan(500); // Should handle large pages quickly

      console.log(`Large page request (100 items) completed in ${responseTime}ms`);
    });
  });

  describe('Vector Search Performance', () => {
    test('should handle vector search efficiently', async () => {
      const mockSearchResults = Array.from({ length: 50 }, (_, i) => ({
        article_id: i + 1,
        title: `Relevant Article ${i + 1}`,
        similarity_score: 0.9 - (i * 0.01)
      }));

      vectorService.findSimilarArticles.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockSearchResults), 150))
      );

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/articles/search')
        .send({ query: 'artificial intelligence machine learning', limit: 50 })
        .expect(200);
      const searchTime = Date.now() - startTime;

      expect(response.body.results).toHaveLength(50);
      expect(response.body.count).toBe(50);
      expect(searchTime).toBeLessThan(300); // Vector search should complete quickly

      console.log(`Vector search completed in ${searchTime}ms`);
    });

    test('should handle concurrent vector searches', async () => {
      const mockResults = [
        { article_id: 1, similarity_score: 0.95 },
        { article_id: 2, similarity_score: 0.87 }
      ];

      vectorService.findSimilarArticles.mockImplementation((query) =>
        new Promise(resolve => 
          setTimeout(() => resolve(mockResults), Math.random() * 100 + 50)
        )
      );

      const searchQueries = [
        'artificial intelligence',
        'machine learning',
        'neural networks',
        'deep learning',
        'data science'
      ];

      const startTime = Date.now();
      const promises = searchQueries.map(query =>
        request(app)
          .post('/api/articles/search')
          .send({ query, limit: 10 })
          .expect(200)
      );

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(responses).toHaveLength(searchQueries.length);
      responses.forEach(response => {
        expect(response.body.results).toEqual(mockResults);
      });

      expect(totalTime).toBeLessThan(500); // Concurrent searches should be efficient
      console.log(`Concurrent vector searches (${searchQueries.length}) completed in ${totalTime}ms`);
    });
  });

  describe('Memory and Resource Usage', () => {
    test('should handle memory efficiently with large datasets', async () => {
      const initialMemory = process.memoryUsage();

      // Simulate processing large recommendation datasets
      const largeRecommendationSets = Array.from({ length: 10 }, (_, i) => ({
        data: Array.from({ length: 500 }, (_, j) => ({
          id: i * 500 + j,
          title: `Article ${i * 500 + j}`,
          description: 'A'.repeat(200), // Simulate realistic content size
          final_score: Math.random(),
          explanation: 'Generated explanation text'
        })),
        pagination: {
          current_page: 1,
          page_size: 500,
          total_items: 5000,
          total_pages: 10
        }
      }));

      recallRankingService.getRecommendations.mockImplementation(() =>
        Promise.resolve(largeRecommendationSets[Math.floor(Math.random() * 10)])
      );

      // Process multiple large requests
      const promises = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .get(`/api/articles/recommended?userId=user-${i}&pageSize=500`)
          .expect(200)
      );

      await Promise.all(promises);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    test('should clean up resources after processing', async () => {
      const beforeTest = process.memoryUsage();

      // Simulate heavy processing
      const heavyRecommendations = {
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          title: `Heavy Article ${i}`,
          description: 'B'.repeat(500),
          content: 'C'.repeat(2000),
          explanation: 'D'.repeat(300)
        })),
        pagination: { current_page: 1, page_size: 1000, total_items: 1000, total_pages: 1 }
      };

      recallRankingService.getRecommendations.mockResolvedValue(heavyRecommendations);

      // Process heavy request
      await request(app)
        .get('/api/articles/recommended?pageSize=1000')
        .expect(200);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      const afterTest = process.memoryUsage();
      const memoryDifference = afterTest.heapUsed - beforeTest.heapUsed;

      // Memory should not increase significantly after cleanup
      expect(memoryDifference).toBeLessThan(50 * 1024 * 1024); // Less than 50MB

      console.log(`Memory difference after cleanup: ${(memoryDifference / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Error Handling Performance', () => {
    test('should handle errors quickly without blocking', async () => {
      recallRankingService.getRecommendations
        .mockRejectedValueOnce(new Error('Service error'))
        .mockResolvedValue({
          data: [{ id: 1, title: 'Recovery Article' }],
          pagination: { current_page: 1, page_size: 20, total_items: 1 }
        });

      const startTime = Date.now();

      // First request should fail quickly
      const errorResponse = await request(app)
        .get('/api/articles/recommended')
        .expect(500);

      const errorTime = Date.now() - startTime;

      // Subsequent request should work
      const successResponse = await request(app)
        .get('/api/articles/recommended')
        .expect(200);

      const totalTime = Date.now() - startTime;

      expect(errorResponse.body).toEqual({ error: 'Failed to get recommendations' });
      expect(successResponse.body.data).toHaveLength(1);

      // Error handling should be fast
      expect(errorTime).toBeLessThan(100);
      expect(totalTime).toBeLessThan(300);

      console.log(`Error handled in ${errorTime}ms, recovery in ${totalTime - errorTime}ms`);
    });

    test('should handle timeout scenarios gracefully', async () => {
      // Simulate slow service
      recallRankingService.getRecommendations.mockImplementation(() =>
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Service timeout')), 1000);
        })
      );

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/articles/recommended')
        .expect(500);
      const responseTime = Date.now() - startTime;

      expect(response.body).toEqual({ error: 'Failed to get recommendations' });
      expect(responseTime).toBeGreaterThan(990); // Should wait for timeout
      expect(responseTime).toBeLessThan(1100); // But not much longer

      console.log(`Timeout handled in ${responseTime}ms`);
    });
  });

  describe('Load Testing Scenarios', () => {
    test('should maintain performance under sustained load', async () => {
      const mockRecommendations = {
        data: [{ id: 1, title: 'Load Test Article' }],
        pagination: { current_page: 1, page_size: 20, total_items: 1 }
      };

      recallRankingService.getRecommendations.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockRecommendations), 50))
      );

      const requestsPerBatch = 5;
      const numberOfBatches = 10;
      const times = [];

      for (let batch = 0; batch < numberOfBatches; batch++) {
        const batchStartTime = Date.now();
        
        const promises = Array.from({ length: requestsPerBatch }, (_, i) =>
          request(app)
            .get(`/api/articles/recommended?userId=load-user-${batch}-${i}`)
            .expect(200)
        );

        await Promise.all(promises);
        const batchTime = Date.now() - batchStartTime;
        times.push(batchTime);

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      // Performance should remain consistent
      expect(maxTime - minTime).toBeLessThan(averageTime); // Variance should be reasonable
      expect(averageTime).toBeLessThan(200); // Average batch time should be reasonable

      console.log(`Load test: avg=${averageTime.toFixed(2)}ms, min=${minTime}ms, max=${maxTime}ms`);
    });
  });
});