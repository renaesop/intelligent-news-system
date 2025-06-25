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

// Mock database for testing
const mockDb = {
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
  exec: jest.fn()
};

// Mock dependencies
jest.mock('../../../db/database', () => mockDb);

jest.mock('../../../services/vectorService', () => ({
  getPersonalizedRecommendations: jest.fn(),
  generateEmbedding: jest.fn(),
  cosineSimilarity: jest.fn(),
  getVectorStats: jest.fn()
}));

jest.mock('../../../services/llmService', () => ({
  analyzeContent: jest.fn()
}));

jest.mock('../../../services/memoryService', () => ({
  getUserMemory: jest.fn(),
  addUserMemory: jest.fn()
}));

const vectorService = require('../../../services/vectorService');

// Import service after mocking
const RecallRankingService = require('../../../services/recallRankingService');

// Setup API routes for new recommendation system
app.get('/api/articles/recommended', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const forceRefresh = req.query.forceRefresh === 'true';
    const enableExplain = req.query.enableExplain === 'true';
    
    const options = { page, pageSize, forceRefresh, enableExplain };
    const recommendations = await RecallRankingService.getRecommendations(userId, options);
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

app.get('/api/recommendations/stats', async (req, res) => {
  try {
    const stats = await RecallRankingService.getRecommendationStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get recommendation stats' });
  }
});

describe('Recall-Ranking Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset database mocks
    mockDb.run.mockReset();
    mockDb.get.mockReset();
    mockDb.all.mockReset();
    mockDb.exec.mockReset();
  });

  describe('Cache Operations', () => {
    test('should cache recommendations in SQLite', async () => {
      // Mock successful cache write
      mockDb.run.mockImplementation((sql, params, callback) => {
        if (sql.includes('INSERT OR REPLACE INTO recommendation_cache')) {
          callback(null);
        }
      });

      const result = await RecallRankingService.cacheRecommendations(
        'test-key',
        'user-123',
        [{ id: 1, title: 'Test Article' }],
        { page: 1 }
      );

      expect(result).toBe(true);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO recommendation_cache'),
        expect.arrayContaining(['test-key', 'user-123']),
        expect.any(Function)
      );
    });

    test('should retrieve cached recommendations', async () => {
      const mockCachedData = JSON.stringify([{ id: 1, title: 'Cached Article' }]);
      
      mockDb.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('SELECT data, hit_count FROM recommendation_cache')) {
          callback(null, { data: mockCachedData, hit_count: 5 });
        }
      });

      mockDb.run.mockImplementation((sql, params) => {
        // Mock hit count update
      });

      const result = await RecallRankingService.getCachedRecommendations('test-key');

      expect(result).toEqual([{ id: 1, title: 'Cached Article' }]);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT data, hit_count FROM recommendation_cache'),
        ['test-key'],
        expect.any(Function)
      );
    });

    test('should handle cache miss gracefully', async () => {
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, null); // No cached data
      });

      const result = await RecallRankingService.getCachedRecommendations('non-existent-key');

      expect(result).toBeNull();
    });

    test('should handle cache parsing errors', async () => {
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { data: 'invalid-json', hit_count: 0 });
      });

      const result = await RecallRankingService.getCachedRecommendations('bad-data-key');

      expect(result).toBeNull();
    });
  });

  describe('Multi-Channel Recall', () => {
    test('should perform vector recall', async () => {
      const mockVectorRecommendations = [
        { article_id: 1, similarity_score: 0.9 },
        { article_id: 2, similarity_score: 0.8 }
      ];

      const mockArticles = [
        { id: 1, title: 'AI Article', description: 'About AI', source_name: 'Tech News' },
        { id: 2, title: 'ML Article', description: 'About ML', source_name: 'Science Today' }
      ];

      vectorService.getPersonalizedRecommendations.mockResolvedValue(mockVectorRecommendations);

      mockDb.all.mockImplementation((sql, params, callback) => {
        if (sql.includes('SELECT a.*, s.name as source_name')) {
          callback(null, mockArticles);
        }
      });

      const result = await RecallRankingService.vectorRecall('test-user', 10);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        title: 'AI Article',
        similarity_score: 0.9
      });
      expect(vectorService.getPersonalizedRecommendations).toHaveBeenCalledWith('test-user', 10);
    });

    test('should perform tag-based recall', async () => {
      const mockUserInterests = [
        { keyword: 'technology', weight: 1.0 },
        { keyword: 'artificial intelligence', weight: 0.8 }
      ];

      const mockArticles = [
        { 
          id: 3, 
          title: 'Tech Trends', 
          categories: 'technology,innovation',
          source_name: 'Tech Weekly'
        }
      ];

      // Mock getUserInterestTags
      mockDb.all.mockImplementation((sql, params, callback) => {
        if (sql.includes('SELECT keyword, weight FROM user_interests')) {
          callback(null, mockUserInterests);
        } else if (sql.includes('SELECT a.*, s.name as source_name')) {
          callback(null, mockArticles);
        }
      });

      const result = await RecallRankingService.tagBasedRecall('test-user', 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 3,
        title: 'Tech Trends',
        tag_score: expect.any(Number)
      });
    });

    test('should perform collaborative recall', async () => {
      const mockSimilarUsers = [
        { user_id: 'user-456', common_likes: 5 }
      ];

      const mockArticles = [
        { 
          id: 4, 
          title: 'Popular Article', 
          like_count: 10,
          source_name: 'News Hub'
        }
      ];

      // Mock findSimilarUsers and collaborative articles
      mockDb.all.mockImplementation((sql, params, callback) => {
        if (sql.includes('SELECT u2.user_id, COUNT(*) as common_likes')) {
          callback(null, mockSimilarUsers);
        } else if (sql.includes('COUNT(up.user_id) as like_count')) {
          callback(null, mockArticles);
        }
      });

      const result = await RecallRankingService.collaborativeRecall('test-user', 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 4,
        title: 'Popular Article',
        collab_score: 10
      });
    });

    test('should perform trending recall', async () => {
      const mockTrendingArticles = [
        { 
          id: 5, 
          title: 'Trending News', 
          interaction_count: 20,
          trending_score: 15,
          source_name: 'Viral News'
        }
      ];

      mockDb.all.mockImplementation((sql, params, callback) => {
        if (sql.includes('SUM(CASE WHEN up.action = \'like\' THEN 2 ELSE -1 END) as trending_score')) {
          callback(null, mockTrendingArticles);
        }
      });

      const result = await RecallRankingService.trendingRecall(10);

      expect(result).toEqual(mockTrendingArticles);
    });
  });

  describe('Ranking Algorithms', () => {
    test('should calculate relevance scores', async () => {
      const article = {
        id: 1,
        similarity_score: 0.8,
        tag_score: 5
      };

      const scores = await RecallRankingService.calculateRankingScores('test-user', article);

      expect(scores.relevance).toBeGreaterThanOrEqual(0);
      expect(scores.relevance).toBeLessThanOrEqual(1);
      expect(scores.interest).toBeGreaterThanOrEqual(0);
      expect(scores.diversity).toBeGreaterThanOrEqual(0);
      expect(scores.freshness).toBeGreaterThanOrEqual(0);
    });

    test('should calculate freshness scores correctly', () => {
      const recentArticle = {
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 min ago
      };

      const oldArticle = {
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString() // 1 week ago
      };

      const recentScore = RecallRankingService.calculateFreshnessScore(recentArticle);
      const oldScore = RecallRankingService.calculateFreshnessScore(oldArticle);

      expect(recentScore).toBeGreaterThan(oldScore);
      expect(recentScore).toBe(1.0); // Within 1 hour
      expect(oldScore).toBe(0.3); // Within 1 week
    });

    test('should calculate diversity scores', () => {
      const diverseArticle = {
        title: 'A comprehensive guide to modern technology trends',
        categories: 'tech,innovation,future,science'
      };

      const simpleArticle = {
        title: 'News',
        categories: 'general'
      };

      const diverseScore = RecallRankingService.calculateDiversityScore(diverseArticle);
      const simpleScore = RecallRankingService.calculateDiversityScore(simpleArticle);

      expect(diverseScore).toBeGreaterThan(simpleScore);
    });
  });

  describe('Recommendation Explanations', () => {
    test('should generate appropriate explanations', () => {
      const article = {
        recall_source: 'vector,tag',
        explanation: undefined
      };

      const scores = {
        relevance: 0.9,
        interest: 0.7,
        diversity: 0.6,
        freshness: 0.9
      };

      const explanation = RecallRankingService.generateExplanation(article, scores);

      expect(explanation).toContain('与您的兴趣高度相关');
      expect(explanation).toContain('基于您的阅读偏好推荐');
      expect(explanation).toContain('最新发布的热门内容');
      expect(explanation).toContain('多个推荐策略共同推荐');
    });

    test('should provide fallback explanation', () => {
      const article = {};
      const scores = {
        relevance: 0.3,
        interest: 0.2,
        diversity: 0.4,
        freshness: 0.1
      };

      const explanation = RecallRankingService.generateExplanation(article, scores);

      expect(explanation).toBe('根据智能算法为您推荐');
    });
  });

  describe('Cache Statistics', () => {
    test('should return cache statistics', async () => {
      const mockCacheStats = {
        total_entries: 100,
        active_entries: 80,
        avg_hit_count: 3.5,
        max_hit_count: 25,
        oldest_entry: '2024-01-01T00:00:00.000Z',
        newest_entry: '2024-01-02T00:00:00.000Z'
      };

      mockDb.get.mockImplementation((sql, callback) => {
        if (sql.includes('COUNT(*) as total_entries')) {
          callback(null, mockCacheStats);
        }
      });

      const stats = await RecallRankingService.getCacheStats();

      expect(stats).toMatchObject({
        total_entries: 100,
        active_entries: 80,
        expired_entries: 20,
        hit_rate: expect.stringContaining('%'),
        avg_hit_count: '3.50'
      });
    });

    test('should handle empty cache statistics', async () => {
      mockDb.get.mockImplementation((sql, callback) => {
        callback(null, {
          total_entries: 0,
          active_entries: 0,
          avg_hit_count: null,
          max_hit_count: null
        });
      });

      const stats = await RecallRankingService.getCacheStats();

      expect(stats).toMatchObject({
        total_entries: 0,
        active_entries: 0,
        expired_entries: 0,
        hit_rate: '0%',
        avg_hit_count: '0.00'
      });
    });
  });

  describe('Diversification', () => {
    test('should apply diversification to recommendations', () => {
      const candidates = [
        { id: 1, final_score: 0.9, source_name: 'TechNews', source_category: 'tech' },
        { id: 2, final_score: 0.8, source_name: 'TechNews', source_category: 'tech' },
        { id: 3, final_score: 0.7, source_name: 'ScienceDaily', source_category: 'science' },
        { id: 4, final_score: 0.6, source_name: 'TechNews', source_category: 'tech' }
      ];

      const diversified = RecallRankingService.applyDiversification(candidates);

      // Should prioritize diversity over just score
      expect(diversified).toHaveLength(4);
      
      // Check that we don't have too many from the same source
      const techNewsCount = diversified.filter(a => a.source_name === 'TechNews').length;
      expect(techNewsCount).toBeLessThanOrEqual(3);
    });

    test('should handle small candidate lists', () => {
      const candidates = [
        { id: 1, final_score: 0.9, source_name: 'TechNews', source_category: 'tech' },
        { id: 2, final_score: 0.8, source_name: 'TechNews', source_category: 'tech' }
      ];

      const diversified = RecallRankingService.applyDiversification(candidates);

      expect(diversified).toEqual(candidates);
    });
  });
});

describe('API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default cache miss
    mockDb.get.mockImplementation((sql, params, callback) => {
      if (sql.includes('SELECT data, hit_count FROM recommendation_cache')) {
        callback(null, null); // Cache miss
      }
    });
  });

  test('GET /api/articles/recommended should return paginated recommendations', async () => {
    // Mock the complete recommendation pipeline
    vectorService.getPersonalizedRecommendations.mockResolvedValue([
      { article_id: 1, similarity_score: 0.9 }
    ]);

    mockDb.all.mockImplementation((sql, params, callback) => {
      if (sql.includes('SELECT keyword, weight FROM user_interests')) {
        callback(null, [{ keyword: 'tech', weight: 1.0 }]);
      } else if (sql.includes('SELECT a.*, s.name as source_name')) {
        callback(null, [{
          id: 1,
          title: 'Test Article',
          description: 'Test Description',
          source_name: 'Test Source',
          created_at: new Date().toISOString()
        }]);
      } else if (sql.includes('common_likes')) {
        callback(null, []);
      } else if (sql.includes('trending_score')) {
        callback(null, []);
      }
    });

    mockDb.run.mockImplementation((sql, params, callback) => {
      if (sql.includes('INSERT OR REPLACE INTO recommendation_cache')) {
        callback(null);
      }
    });

    const response = await request(app)
      .get('/api/articles/recommended?page=1&pageSize=10&enableExplain=true')
      .expect(200);

    expect(response.body).toMatchObject({
      data: expect.any(Array),
      pagination: {
        current_page: 1,
        page_size: 10,
        total_items: expect.any(Number),
        total_pages: expect.any(Number),
        has_next: expect.any(Boolean),
        has_previous: false
      },
      metadata: {
        cache_used: false,
        generated_at: expect.any(String),
        algorithm_version: '2.0'
      }
    });
  });

  test('GET /api/recommendations/stats should return recommendation statistics', async () => {
    mockDb.get.mockImplementation((sql, callback) => {
      if (sql.includes('COUNT(*) as total_entries')) {
        callback(null, {
          total_entries: 50,
          active_entries: 40,
          avg_hit_count: 2.5,
          max_hit_count: 10
        });
      }
    });

    const response = await request(app)
      .get('/api/recommendations/stats')
      .expect(200);

    expect(response.body).toMatchObject({
      cache_size: expect.any(Number),
      cache_hit_rate: expect.any(String),
      recall_config: expect.any(Object),
      ranking_config: expect.any(Object),
      cache_config: expect.any(Object),
      cache_details: expect.any(Object)
    });
  });

  test('should handle recommendation errors gracefully', async () => {
    vectorService.getPersonalizedRecommendations.mockRejectedValue(new Error('Vector service error'));

    const response = await request(app)
      .get('/api/articles/recommended')
      .expect(500);

    expect(response.body).toEqual({ error: 'Failed to get recommendations' });
  });

  test('should handle cache from previous request', async () => {
    const cachedData = [{
      id: 1,
      title: 'Cached Article',
      description: 'From cache',
      final_score: 0.8
    }];

    // First request - cache miss, then cache write
    mockDb.get.mockImplementationOnce((sql, params, callback) => {
      callback(null, null); // Cache miss
    });

    mockDb.run.mockImplementation((sql, params, callback) => {
      if (sql.includes('INSERT OR REPLACE INTO recommendation_cache')) {
        callback(null);
      }
    });

    // Setup successful recommendation generation
    vectorService.getPersonalizedRecommendations.mockResolvedValue([]);
    mockDb.all.mockImplementation((sql, params, callback) => {
      callback(null, []);
    });

    // Second request - cache hit
    mockDb.get.mockImplementationOnce((sql, params, callback) => {
      if (sql.includes('SELECT data, hit_count FROM recommendation_cache')) {
        callback(null, { 
          data: JSON.stringify(cachedData),
          hit_count: 1 
        });
      }
    });

    // First request
    await request(app)
      .get('/api/articles/recommended?userId=test-user')
      .expect(200);

    // Second request should use cache
    const response = await request(app)
      .get('/api/articles/recommended?userId=test-user')
      .expect(200);

    expect(response.body.data).toEqual(cachedData);
  });
});