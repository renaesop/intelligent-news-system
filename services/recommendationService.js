const db = require('../db/database');
const llmService = require('./llmService');
const memoryService = require('./memoryService');

class RecommendationService {
  async scoreArticle(article, userId = 'default') {
    try {
      const userInterests = await memoryService.getUserInterests(userId);
      const userMemories = await memoryService.searchMemories(userId, article.title);
      
      let score = 5.0;
      
      const analysis = await llmService.analyzeArticle(article);
      score += analysis.importance * 0.5;
      
      const articleKeywords = analysis.topics || [];
      
      for (const interest of userInterests) {
        for (const keyword of articleKeywords) {
          if (keyword.toLowerCase().includes(interest.keyword) || 
              interest.keyword.includes(keyword.toLowerCase())) {
            score += interest.weight * 2;
          }
        }
      }
      
      if (userMemories && userMemories.length > 0) {
        score += userMemories.length * 0.5;
      }
      
      const recentActions = await this.getRecentUserActions(userId, 50);
      for (const action of recentActions) {
        if (action.categories) {
          const similarity = this.calculateCategorySimilarity(
            article.categories, 
            action.categories
          );
          score += similarity * (action.action === 'like' ? 1 : -1);
        }
      }
      
      return Math.max(0, Math.min(10, score));
    } catch (error) {
      console.error('Error scoring article:', error);
      return 5.0;
    }
  }

  calculateCategorySimilarity(categories1, categories2) {
    if (!categories1 || !categories2) return 0;
    
    const cats1 = categories1.toLowerCase().split(',').map(c => c.trim());
    const cats2 = categories2.toLowerCase().split(',').map(c => c.trim());
    
    const intersection = cats1.filter(c => cats2.includes(c)).length;
    const union = new Set([...cats1, ...cats2]).size;
    
    return union > 0 ? intersection / union : 0;
  }

  async getRecentUserActions(userId, limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT up.*, a.categories, a.title
        FROM user_preferences up
        JOIN articles a ON up.article_id = a.id
        WHERE up.user_id = ?
        ORDER BY up.created_at DESC
        LIMIT ?
      `, [userId, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getRecommendedArticles(userId = 'default', limit = 20) {
    return new Promise(async (resolve, reject) => {
      try {
        db.all(`
          SELECT a.*, s.name as source_name
          FROM articles a
          JOIN rss_sources s ON a.source_id = s.id
          WHERE a.id NOT IN (
            SELECT article_id FROM user_preferences WHERE user_id = ?
          )
          ORDER BY a.created_at DESC
          LIMIT 100
        `, [userId], async (err, articles) => {
          if (err) return reject(err);
          
          for (const article of articles) {
            article.score = await this.scoreArticle(article, userId);
          }
          
          articles.sort((a, b) => b.score - a.score);
          
          resolve(articles.slice(0, limit));
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async processUserFeedback(userId, articleId, action) {
    return new Promise(async (resolve, reject) => {
      try {
        await memoryService.recordUserAction(userId, articleId, action);
        
        db.get(
          'SELECT * FROM articles WHERE id = ?',
          [articleId],
          async (err, article) => {
            if (err) return reject(err);
            if (!article) return reject(new Error('Article not found'));
            
            const keywords = await llmService.extractKeywords(
              article.title + ' ' + article.description
            );
            
            await memoryService.updateUserInterests(userId, action, keywords);
            
            await memoryService.updateMemoryFromAction(userId, article, action);
            
            resolve({ success: true, keywords });
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  async updateArticleScores(userId = 'default') {
    return new Promise(async (resolve, reject) => {
      try {
        db.all(
          'SELECT id FROM articles WHERE score IS NOT NULL',
          async (err, articles) => {
            if (err) return reject(err);
            
            const stmt = db.prepare('UPDATE articles SET score = ? WHERE id = ?');
            
            for (const article of articles) {
              const fullArticle = await this.getArticleById(article.id);
              const score = await this.scoreArticle(fullArticle, userId);
              stmt.run(score, article.id);
            }
            
            stmt.finalize();
            resolve({ updated: articles.length });
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  getArticleById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM articles WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

module.exports = new RecommendationService();