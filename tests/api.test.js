const request = require('supertest');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

// Mock environment
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.MEM0_API_KEY = 'test-key';

// Create test app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Mock database and services
jest.mock('../db/database', () => ({
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn()
}));

jest.mock('../services/rssParser', () => ({
  fetchAllFeeds: jest.fn(),
  saveArticles: jest.fn(),
  getActiveSources: jest.fn(),
  initializeSources: jest.fn()
}));

jest.mock('../services/recommendationService', () => ({
  getRecommendedArticles: jest.fn(),
  processUserFeedback: jest.fn()
}));

jest.mock('../services/memoryService', () => ({
  getUserPreferenceStats: jest.fn()
}));

const db = require('../db/database');
const rssService = require('../services/rssParser');
const recommendationService = require('../services/recommendationService');
const memoryService = require('../services/memoryService');

// Setup API routes
app.get('/api/articles/recommended', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    const articles = await recommendationService.getRecommendedArticles(userId);
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

app.post('/api/articles/fetch', async (req, res) => {
  try {
    const articles = await rssService.fetchAllFeeds();
    await rssService.saveArticles(articles);
    res.json({ 
      success: true, 
      articlesFound: articles.length,
      message: `Fetched ${articles.length} articles` 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

app.post('/api/articles/:id/feedback', async (req, res) => {
  try {
    const articleId = req.params.id;
    const { action } = req.body;
    const userId = req.body.userId || 'default';
    
    if (!['like', 'dislike'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    const result = await recommendationService.processUserFeedback(userId, articleId, action);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to process feedback' });
  }
});

app.get('/api/sources', async (req, res) => {
  try {
    const sources = await rssService.getActiveSources();
    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get sources' });
  }
});

app.post('/api/sources', async (req, res) => {
  try {
    const { name, url, category } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }
    
    db.run(
      'INSERT INTO rss_sources (name, url, category) VALUES (?, ?, ?)',
      [name, url, category || 'general'],
      function(err) {
        if (err) {
          res.status(500).json({ error: 'Failed to add source' });
        } else {
          res.json({ success: true, id: this.lastID });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Failed to add source' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const userId = req.query.userId || 'default';
    
    const stats = await new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          (SELECT COUNT(*) FROM articles) as totalArticles,
          (SELECT COUNT(*) FROM rss_sources WHERE active = 1) as totalSources
      `, async (err, row) => {
        if (err) reject(err);
        else {
          const userStats = await memoryService.getUserPreferenceStats(userId);
          resolve({ ...row, userStats });
        }
      });
    });
    
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

describe('API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/articles/recommended', () => {
    test('should return recommended articles', async () => {
      const mockArticles = [
        { id: 1, title: 'Test Article', description: 'Test Description', score: 0.8 }
      ];
      recommendationService.getRecommendedArticles.mockResolvedValue(mockArticles);

      const response = await request(app)
        .get('/api/articles/recommended')
        .expect(200);

      expect(response.body).toEqual(mockArticles);
      expect(recommendationService.getRecommendedArticles).toHaveBeenCalledWith('default');
    });

    test('should handle errors', async () => {
      recommendationService.getRecommendedArticles.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/articles/recommended')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get recommendations' });
    });
  });

  describe('POST /api/articles/fetch', () => {
    test('should fetch and save articles', async () => {
      const mockArticles = [
        { title: 'Article 1', url: 'http://example.com/1' },
        { title: 'Article 2', url: 'http://example.com/2' }
      ];
      rssService.fetchAllFeeds.mockResolvedValue(mockArticles);
      rssService.saveArticles.mockResolvedValue();

      const response = await request(app)
        .post('/api/articles/fetch')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        articlesFound: 2,
        message: 'Fetched 2 articles'
      });
      expect(rssService.fetchAllFeeds).toHaveBeenCalled();
      expect(rssService.saveArticles).toHaveBeenCalledWith(mockArticles);
    });

    test('should handle fetch errors', async () => {
      rssService.fetchAllFeeds.mockRejectedValue(new Error('Network error'));

      const response = await request(app)
        .post('/api/articles/fetch')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to fetch articles' });
    });
  });

  describe('POST /api/articles/:id/feedback', () => {
    test('should process user feedback', async () => {
      const mockResult = { success: true, message: 'Feedback processed' };
      recommendationService.processUserFeedback.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/articles/123/feedback')
        .send({ action: 'like', userId: 'test-user' })
        .expect(200);

      expect(response.body).toEqual(mockResult);
      expect(recommendationService.processUserFeedback).toHaveBeenCalledWith('test-user', '123', 'like');
    });

    test('should validate action parameter', async () => {
      const response = await request(app)
        .post('/api/articles/123/feedback')
        .send({ action: 'invalid' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Invalid action' });
    });

    test('should handle feedback processing errors', async () => {
      recommendationService.processUserFeedback.mockRejectedValue(new Error('Processing error'));

      const response = await request(app)
        .post('/api/articles/123/feedback')
        .send({ action: 'like' })
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to process feedback' });
    });
  });

  describe('GET /api/sources', () => {
    test('should return RSS sources', async () => {
      const mockSources = [
        { id: 1, name: 'Test Source', url: 'http://example.com/rss', active: true }
      ];
      rssService.getActiveSources.mockResolvedValue(mockSources);

      const response = await request(app)
        .get('/api/sources')
        .expect(200);

      expect(response.body).toEqual(mockSources);
      expect(rssService.getActiveSources).toHaveBeenCalled();
    });

    test('should handle sources fetch errors', async () => {
      rssService.getActiveSources.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/sources')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get sources' });
    });
  });

  describe('POST /api/sources', () => {
    test('should add new RSS source', async () => {
      const mockThis = { lastID: 123 };
      db.run.mockImplementation((sql, params, callback) => {
        callback.call(mockThis, null);
      });

      const response = await request(app)
        .post('/api/sources')
        .send({
          name: 'Test Source',
          url: 'http://example.com/rss',
          category: 'tech'
        })
        .expect(200);

      expect(response.body).toEqual({ success: true, id: 123 });
      expect(db.run).toHaveBeenCalledWith(
        'INSERT INTO rss_sources (name, url, category) VALUES (?, ?, ?)',
        ['Test Source', 'http://example.com/rss', 'tech'],
        expect.any(Function)
      );
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/sources')
        .send({ name: 'Test Source' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Name and URL are required' });
    });

    test('should handle database errors', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Database error'));
      });

      const response = await request(app)
        .post('/api/sources')
        .send({
          name: 'Test Source',
          url: 'http://example.com/rss'
        })
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to add source' });
    });
  });

  describe('GET /api/stats', () => {
    test('should return system statistics', async () => {
      const mockStats = { totalArticles: 100, totalSources: 5 };
      const mockUserStats = { totalInteractions: 10, preferenceCount: 3 };
      
      db.get.mockImplementation((sql, callback) => {
        callback(null, mockStats);
      });
      memoryService.getUserPreferenceStats.mockResolvedValue(mockUserStats);

      const response = await request(app)
        .get('/api/stats?userId=test-user')
        .expect(200);

      expect(response.body).toEqual({
        ...mockStats,
        userStats: mockUserStats
      });
      expect(memoryService.getUserPreferenceStats).toHaveBeenCalledWith('test-user');
    });

    test('should handle stats fetch errors', async () => {
      db.get.mockImplementation((sql, callback) => {
        callback(new Error('Database error'));
      });

      const response = await request(app)
        .get('/api/stats')
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to get stats' });
    });
  });
});