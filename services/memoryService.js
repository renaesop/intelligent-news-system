const Mem0 = require('mem0ai');
const db = require('../db/database');
require('dotenv').config();

class MemoryService {
  constructor() {
    this.mem0 = new Mem0({
      apiKey: process.env.MEM0_API_KEY
    });
  }

  async addMemory(userId, content, metadata = {}) {
    try {
      const memory = await this.mem0.add(content, userId, metadata);
      return memory;
    } catch (error) {
      console.error('Error adding memory:', error);
      return null;
    }
  }

  async searchMemories(userId, query) {
    try {
      const memories = await this.mem0.search(query, userId);
      return memories;
    } catch (error) {
      console.error('Error searching memories:', error);
      return [];
    }
  }

  async getUserMemories(userId) {
    try {
      const memories = await this.mem0.getAll({ user_id: userId });
      return memories;
    } catch (error) {
      console.error('Error getting user memories:', error);
      return [];
    }
  }

  async updateUserInterests(userId, action, keywords) {
    const weight = action === 'like' ? 0.1 : -0.1;
    
    keywords.forEach(keyword => {
      db.run(`
        INSERT INTO user_interests (user_id, keyword, weight)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, keyword) 
        DO UPDATE SET 
          weight = weight + ?,
          updated_at = CURRENT_TIMESTAMP
      `, [userId, keyword.toLowerCase(), weight, weight]);
    });
  }

  async getUserInterests(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT keyword, weight FROM user_interests WHERE user_id = ? ORDER BY weight DESC',
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async recordUserAction(userId, articleId, action) {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO user_preferences (user_id, article_id, action) VALUES (?, ?, ?)',
        [userId, articleId, action],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async updateMemoryFromAction(userId, article, action) {
    try {
      const memoryContent = `User ${action}d article: "${article.title}". Topics: ${article.categories}`;
      await this.addMemory(userId, memoryContent, {
        type: 'preference',
        action: action,
        article_id: article.id
      });

      const relatedMemories = await this.searchMemories(userId, article.title);
      return relatedMemories;
    } catch (error) {
      console.error('Error updating memory:', error);
      return [];
    }
  }

  async getUserPreferenceStats(userId) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(CASE WHEN action = 'like' THEN 1 END) as likes,
          COUNT(CASE WHEN action = 'dislike' THEN 1 END) as dislikes
        FROM user_preferences 
        WHERE user_id = ?
      `, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

module.exports = new MemoryService();