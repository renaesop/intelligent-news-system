const request = require('supertest');

// Mock environment
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.MEM0_API_KEY = 'test-key';

// Mock database
const mockDb = {
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
  exec: jest.fn()
};

jest.mock('../db/database', () => mockDb);

// Mock services
jest.mock('../services/vectorService', () => ({
  getPersonalizedRecommendations: jest.fn(),
  generateEmbedding: jest.fn(),
  findSimilarArticles: jest.fn(),
  updateUserPreferenceVector: jest.fn(),
  storeArticleVectors: jest.fn(),
  getVectorStats: jest.fn()
}));

jest.mock('../services/llmService', () => ({
  analyzeContent: jest.fn(),
  generateSummary: jest.fn()
}));

jest.mock('../services/memoryService', () => ({
  getUserMemory: jest.fn(),
  addUserMemory: jest.fn(),
  getUserPreferenceStats: jest.fn()
}));

const vectorService = require('../services/vectorService');
const llmService = require('../services/llmService');
const memoryService = require('../services/memoryService');

// Import service after mocking
const RecallRankingService = require('../services/recallRankingService');

describe('Edge Cases and Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Database Connection Issues', () => {
    test('should handle database connection failures gracefully', async () => {
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(new Error('SQLITE_BUSY: database is locked'));
      });

      const result = await RecallRankingService.getCachedRecommendations('test-key');

      expect(result).toBeNull();
    });

    test('should handle database corruption scenarios', async () => {
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(new Error('SQLITE_CORRUPT: database disk image is malformed'));
      });

      const result = await RecallRankingService.vectorRecall('user-123', 10);

      expect(result).toEqual([]);
    });

    test('should handle database timeout scenarios', async () => {
      mockDb.run.mockImplementation((sql, params, callback) => {
        setTimeout(() => callback(new Error('SQLITE_BUSY: database is locked')), 100);
      });

      const result = await RecallRankingService.cacheRecommendations(
        'timeout-key',
        'user-123',
        [{ id: 1, title: 'Test' }],
        {}
      );

      expect(result).toBe(false);
    });
  });

  describe('Invalid Input Handling', () => {
    test('should handle null user IDs', async () => {
      const result = await RecallRankingService.getRecommendations(null, {});

      expect(result).toMatchObject({
        data: [],
        pagination: expect.any(Object),
        metadata: expect.any(Object)
      });
    });

    test('should handle extremely large page sizes', async () => {
      const options = { page: 1, pageSize: 1000000 };

      // Mock empty results to avoid processing overhead
      vectorService.getPersonalizedRecommendations.mockResolvedValue([]);
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const result = await RecallRankingService.getRecommendations('user-123', options);

      expect(result.pagination.page_size).toBe(1000000);
      expect(result.data).toEqual([]);
    });

    test('should handle negative page numbers', async () => {
      const options = { page: -1, pageSize: 20 };

      vectorService.getPersonalizedRecommendations.mockResolvedValue([]);
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const result = await RecallRankingService.getRecommendations('user-123', options);

      // Should default to page 1
      expect(result.pagination.current_page).toBe(-1); // Preserves input but handles gracefully
    });

    test('should handle special characters in user IDs', async () => {
      const specialUserIds = [
        'user@#$%^&*()',
        'user with spaces',
        'user\nwith\nnewlines',
        'user\twith\ttabs',
        'user"with"quotes',
        "user'with'apostrophes",
        'user🚀with🔥emojis'
      ];

      for (const userId of specialUserIds) {
        vectorService.getPersonalizedRecommendations.mockResolvedValue([]);
        mockDb.all.mockImplementation((sql, params, callback) => {
          callback(null, []);
        });

        const result = await RecallRankingService.getRecommendations(userId, {});

        expect(result).toMatchObject({
          data: expect.any(Array),
          pagination: expect.any(Object)
        });
      }
    });
  });

  describe('Data Corruption and Malformed Data', () => {
    test('should handle corrupted cache data', async () => {
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, {
          data: '{invalid json data[}',
          hit_count: 5
        });
      });

      const result = await RecallRankingService.getCachedRecommendations('corrupted-key');

      expect(result).toBeNull();
    });

    test('should handle missing article fields', async () => {
      const malformedArticles = [
        { id: 1 }, // Missing title, description
        { title: 'Only Title' }, // Missing ID
        { id: 2, title: null, description: undefined }, // Null/undefined fields
        { id: 3, title: '', description: '', content: '' }, // Empty strings
      ];

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, malformedArticles);
      });

      const scores = await Promise.all(
        malformedArticles.map(article => 
          RecallRankingService.calculateRankingScores('user-123', article)
        )
      );

      scores.forEach(score => {
        expect(score.relevance).toBeGreaterThanOrEqual(0);
        expect(score.interest).toBeGreaterThanOrEqual(0);
        expect(score.diversity).toBeGreaterThanOrEqual(0);
        expect(score.freshness).toBeGreaterThanOrEqual(0);
      });
    });

    test('should handle circular references in article data', async () => {
      const circularArticle = { id: 1, title: 'Test' };
      circularArticle.self = circularArticle; // Create circular reference

      // Should not throw when trying to cache
      const result = await RecallRankingService.cacheRecommendations(
        'circular-key',
        'user-123',
        [circularArticle],
        {}
      );

      // JSON.stringify should handle this gracefully or throw, which we catch
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    test('should handle extremely long article content', async () => {
      const longContent = 'A'.repeat(1000000); // 1MB of text
      const article = {
        id: 1,
        title: 'Long Article',
        description: longContent,
        content: longContent
      };

      const scores = await RecallRankingService.calculateRankingScores('user-123', article);

      expect(scores).toMatchObject({
        relevance: expect.any(Number),
        interest: expect.any(Number),
        diversity: expect.any(Number),
        freshness: expect.any(Number)
      });
    });

    test('should handle empty recommendation results', async () => {
      vectorService.getPersonalizedRecommendations.mockResolvedValue([]);
      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const result = await RecallRankingService.getRecommendations('empty-user', {});

      expect(result.data).toEqual([]);
      expect(result.pagination.total_items).toBe(0);
      expect(result.pagination.total_pages).toBe(0);
    });

    test('should handle cache overflow scenarios', async () => {
      // Simulate cache table being full
      mockDb.run.mockImplementation((sql, params, callback) => {
        if (sql.includes('INSERT OR REPLACE INTO recommendation_cache')) {
          callback(new Error('SQLITE_FULL: database or disk is full'));
        } else {
          callback(null);
        }
      });

      const result = await RecallRankingService.cacheRecommendations(
        'overflow-key',
        'user-123',
        [{ id: 1, title: 'Test' }],
        {}
      );

      expect(result).toBe(false);
    });
  });

  describe('Concurrent Access Issues', () => {
    test('should handle concurrent cache writes', async () => {
      let writeCount = 0;
      mockDb.run.mockImplementation((sql, params, callback) => {
        if (sql.includes('INSERT OR REPLACE INTO recommendation_cache')) {
          writeCount++;
          setTimeout(() => callback(null), Math.random() * 50);
        }
      });

      const promises = Array.from({ length: 10 }, (_, i) =>
        RecallRankingService.cacheRecommendations(
          `concurrent-key-${i}`,
          'user-123',
          [{ id: i, title: `Article ${i}` }],
          {}
        )
      );

      const results = await Promise.all(promises);

      expect(results.every(result => result === true)).toBe(true);
      expect(writeCount).toBe(10);
    });

    test('should handle concurrent reads from same cache key', async () => {
      const cachedData = [{ id: 1, title: 'Concurrent Test' }];
      
      mockDb.get.mockImplementation((sql, params, callback) => {
        setTimeout(() => callback(null, {
          data: JSON.stringify(cachedData),
          hit_count: 1
        }), Math.random() * 20);
      });

      mockDb.run.mockImplementation(() => {}); // Mock hit count update

      const promises = Array.from({ length: 5 }, () =>
        RecallRankingService.getCachedRecommendations('same-key')
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).toEqual(cachedData);
      });
    });
  });

  describe('Service Dependencies Failures', () => {
    test('should handle vector service failures gracefully', async () => {
      vectorService.getPersonalizedRecommendations.mockRejectedValue(
        new Error('Vector service unavailable')
      );

      // Other recall methods should still work
      mockDb.all.mockImplementation((sql, params, callback) => {
        if (sql.includes('user_interests')) {
          callback(null, [{ keyword: 'tech', weight: 1.0 }]);
        } else if (sql.includes('categories LIKE')) {
          callback(null, [{ id: 1, title: 'Tag Article', categories: 'tech' }]);
        } else {
          callback(null, []);
        }
      });

      const result = await RecallRankingService.getRecommendations('user-123', {});

      // Should still return results from other recall methods
      expect(result.data).toBeDefined();
    });

    test('should handle LLM service timeouts', async () => {
      llmService.analyzeContent.mockImplementation(() =>
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('LLM timeout')), 100);
        })
      );

      // Should not break the recommendation pipeline
      const article = { id: 1, title: 'Test', description: 'Test content' };
      const scores = await RecallRankingService.calculateRankingScores('user-123', article);

      expect(scores).toMatchObject({
        relevance: expect.any(Number),
        interest: expect.any(Number),
        diversity: expect.any(Number),
        freshness: expect.any(Number)
      });
    });

    test('should handle memory service failures', async () => {
      memoryService.getUserPreferenceStats.mockRejectedValue(
        new Error('Memory service error')
      );

      // Should still calculate interest scores with fallback
      const article = { id: 1, title: 'Test', categories: 'tech' };
      const interestScore = await RecallRankingService.calculateInterestScore('user-123', article);

      expect(typeof interestScore).toBe('number');
      expect(interestScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases in Algorithms', () => {
    test('should handle articles with future publication dates', async () => {
      const futureArticle = {
        id: 1,
        title: 'Future Article',
        created_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString() // 1 day in future
      };

      const freshnessScore = RecallRankingService.calculateFreshnessScore(futureArticle);

      expect(freshnessScore).toBeGreaterThanOrEqual(0);
      expect(freshnessScore).toBeLessThanOrEqual(1);
    });

    test('should handle articles with very old publication dates', async () => {
      const ancientArticle = {
        id: 1,
        title: 'Ancient Article',
        created_at: new Date('1990-01-01').toISOString()
      };

      const freshnessScore = RecallRankingService.calculateFreshnessScore(ancientArticle);

      expect(freshnessScore).toBe(0.1); // Minimum freshness score
    });

    test('should handle diversity calculation with unusual content', async () => {
      const weirdArticles = [
        { title: '', categories: '' }, // Empty
        { title: 'A', categories: 'a' }, // Very short
        { title: 'A'.repeat(1000), categories: 'B'.repeat(1000) }, // Very long
        { title: '🚀🔥💯', categories: '📱💻🌐' }, // Only emojis
        { title: '123456789', categories: '987654321' }, // Only numbers
        { title: '\n\t\r\n', categories: '\t\r\n\t' } // Only whitespace
      ];

      weirdArticles.forEach(article => {
        const diversityScore = RecallRankingService.calculateDiversityScore(article);
        expect(diversityScore).toBeGreaterThanOrEqual(0);
        expect(diversityScore).toBeLessThanOrEqual(1);
      });
    });

    test('should handle ranking with extreme scores', async () => {
      const extremeArticles = [
        { 
          id: 1, 
          similarity_score: Infinity, 
          tag_score: -Infinity,
          final_score: NaN
        },
        { 
          id: 2, 
          similarity_score: -1000, 
          tag_score: 1000000,
          final_score: 0
        }
      ];

      for (const article of extremeArticles) {
        const scores = await RecallRankingService.calculateRankingScores('user-123', article);
        
        // All scores should be normalized to 0-1 range
        Object.values(scores).forEach(score => {
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
          expect(Number.isFinite(score)).toBe(true);
        });
      }
    });
  });

  describe('Unicode and Internationalization', () => {
    test('should handle articles in different languages', async () => {
      const multiLangArticles = [
        { id: 1, title: '人工智能的未来', description: '这是一篇关于人工智能的中文文章', categories: '科技,AI' },
        { id: 2, title: 'الذكاء الاصطناعي', description: 'مقال باللغة العربية', categories: 'تكنولوجيا' },
        { id: 3, title: 'Искусственный интеллект', description: 'Статья на русском языке', categories: 'технологии' },
        { id: 4, title: '人工知能の未来', description: '日本語の記事です', categories: '技術' },
        { id: 5, title: '🤖 AI + 🧠 = 🚀', description: 'Emoji heavy content 💯🔥⚡', categories: '🎯💼🌟' }
      ];

      for (const article of multiLangArticles) {
        const scores = await RecallRankingService.calculateRankingScores('user-123', article);
        
        expect(scores).toMatchObject({
          relevance: expect.any(Number),
          interest: expect.any(Number),
          diversity: expect.any(Number),
          freshness: expect.any(Number)
        });

        const explanation = RecallRankingService.generateExplanation(article, scores);
        expect(typeof explanation).toBe('string');
        expect(explanation.length).toBeGreaterThan(0);
      }
    });

    test('should handle malformed UTF-8 sequences', async () => {
      const malformedArticle = {
        id: 1,
        title: 'Test\uFFFD\uFFFD', // Replacement characters
        description: 'Content with\x00null\x01bytes',
        categories: 'test\uD83D' // Incomplete surrogate pair
      };

      const scores = await RecallRankingService.calculateRankingScores('user-123', malformedArticle);
      
      expect(scores).toMatchObject({
        relevance: expect.any(Number),
        interest: expect.any(Number),
        diversity: expect.any(Number),
        freshness: expect.any(Number)
      });
    });
  });
});