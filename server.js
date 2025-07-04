const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const db = require('./db/database');
const rssService = require('./services/rssParser');
const recommendationService = require('./services/recommendationService');
const recallRankingService = require('./services/recallRankingService');
const memoryService = require('./services/memoryService');
const defaultRssSources = require('./config/rssSources');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
// Serve Vue.js built files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  
  // Handle client-side routing
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    }
  });
} else {
  // In development, serve the original public folder
  app.use(express.static('public'));
}

async function initializeApp() {
  await rssService.initializeSources(defaultRssSources);
  console.log('Default RSS sources initialized');
}

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
    console.error('Error getting recommended articles:', error);
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
    console.error('Error fetching articles:', error);
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
    console.error('Error processing feedback:', error);
    res.status(500).json({ error: 'Failed to process feedback' });
  }
});

app.get('/api/sources', async (req, res) => {
  try {
    const sources = await rssService.getActiveSources();
    res.json(sources);
  } catch (error) {
    console.error('Error getting sources:', error);
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
          console.error('Error adding source:', err);
          res.status(500).json({ error: 'Failed to add source' });
        } else {
          res.json({ success: true, id: this.lastID });
        }
      }
    );
  } catch (error) {
    console.error('Error adding source:', error);
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
          const vectorStats = await recommendationService.getVectorStats();
          resolve({ ...row, userStats, vectorStats });
        }
      });
    });
    
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Vector search endpoints
app.post('/api/articles/search', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const similarArticles = await recommendationService.findSimilarArticles(query, limit);
    res.json({
      query,
      results: similarArticles,
      count: similarArticles.length
    });
  } catch (error) {
    console.error('Error searching articles:', error);
    res.status(500).json({ error: 'Failed to search articles' });
  }
});

app.post('/api/articles/:id/vectorize', async (req, res) => {
  try {
    const articleId = req.params.id;
    
    const article = await recommendationService.getArticleById(articleId);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    const success = await recommendationService.processArticleForVectors(article);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `Vectors generated for article ${articleId}`,
        article_id: articleId
      });
    } else {
      res.status(500).json({ error: 'Failed to generate vectors' });
    }
  } catch (error) {
    console.error('Error vectorizing article:', error);
    res.status(500).json({ error: 'Failed to vectorize article' });
  }
});

app.get('/api/vectors/stats', async (req, res) => {
  try {
    const vectorStats = await recommendationService.getVectorStats();
    res.json(vectorStats);
  } catch (error) {
    console.error('Error getting vector stats:', error);
    res.status(500).json({ error: 'Failed to get vector stats' });
  }
});

// 新推荐系统统计信息
app.get('/api/recommendations/stats', async (req, res) => {
  try {
    const stats = await recallRankingService.getRecommendationStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting recommendation stats:', error);
    res.status(500).json({ error: 'Failed to get recommendation stats' });
  }
});

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await initializeApp();
  
  require('./scheduler');
});