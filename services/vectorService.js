const Database = require('better-sqlite3');
const path = require('path');
const { OpenAI } = require('openai');
require('dotenv').config();

class VectorService {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'db', 'news_vectors.db');
    this.db = new Database(this.dbPath);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.initializeVectorTables();
  }

  initializeVectorTables() {
    try {
      // Load VSS extension if available
      try {
        this.db.loadExtension('vss');
        console.log('✅ VSS extension loaded successfully');
      } catch (error) {
        console.log('⚠️  VSS extension not available, using fallback similarity search');
      }

      // Create articles_vectors table for storing embeddings
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS articles_vectors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          article_id INTEGER UNIQUE NOT NULL,
          title_embedding TEXT NOT NULL,
          content_embedding TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (article_id) REFERENCES articles (id)
        )
      `);

      // Create user_preferences_vectors table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_preferences_vectors (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          preference_embedding TEXT NOT NULL,
          keywords TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create virtual table for vector search (if VSS is available)
      try {
        this.db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS vss_articles USING vss0(
            title_embedding(1536),
            content_embedding(1536)
          )
        `);
        console.log('✅ VSS virtual table created');
      } catch (error) {
        console.log('⚠️  VSS virtual table creation failed, using manual similarity');
      }

      console.log('📊 Vector database tables initialized');
    } catch (error) {
      console.error('❌ Error initializing vector tables:', error);
    }
  }

  async generateEmbedding(text, model = 'text-embedding-3-small') {
    try {
      const response = await this.openai.embeddings.create({
        model: model,
        input: text,
        encoding_format: 'float'
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  }

  async storeArticleVectors(articleId, title, content) {
    try {
      const titleEmbedding = await this.generateEmbedding(title);
      const contentEmbedding = await this.generateEmbedding(content.substring(0, 1000));

      if (!titleEmbedding || !contentEmbedding) {
        throw new Error('Failed to generate embeddings');
      }

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO articles_vectors 
        (article_id, title_embedding, content_embedding)
        VALUES (?, ?, ?)
      `);

      const result = stmt.run(
        articleId,
        JSON.stringify(titleEmbedding),
        JSON.stringify(contentEmbedding)
      );

      // If VSS is available, also insert into virtual table
      try {
        const vssStmt = this.db.prepare(`
          INSERT OR REPLACE INTO vss_articles 
          (rowid, title_embedding, content_embedding)
          VALUES (?, ?, ?)
        `);
        vssStmt.run(articleId, JSON.stringify(titleEmbedding), JSON.stringify(contentEmbedding));
      } catch (error) {
        // VSS not available, skip
      }

      console.log(`✅ Stored vectors for article ${articleId}`);
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error storing article vectors:', error);
      throw error;
    }
  }

  async updateUserPreferenceVector(userId, keywords) {
    try {
      const preferenceText = keywords.join(' ');
      const preferenceEmbedding = await this.generateEmbedding(preferenceText);

      if (!preferenceEmbedding) {
        throw new Error('Failed to generate preference embedding');
      }

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO user_preferences_vectors 
        (user_id, preference_embedding, keywords, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);

      const result = stmt.run(
        userId,
        JSON.stringify(preferenceEmbedding),
        JSON.stringify(keywords)
      );

      console.log(`✅ Updated preference vector for user ${userId}`);
      return result.lastInsertRowid;
    } catch (error) {
      console.error('Error updating user preference vector:', error);
      throw error;
    }
  }

  cosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vector dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async findSimilarArticles(queryText, limit = 10, userId = null) {
    try {
      const queryEmbedding = await this.generateEmbedding(queryText);
      if (!queryEmbedding) {
        throw new Error('Failed to generate query embedding');
      }

      // Try VSS search first
      try {
        const vssResults = this.db.prepare(`
          SELECT rowid as article_id, distance 
          FROM vss_articles 
          WHERE vss_search(title_embedding, ?)
          ORDER BY distance 
          LIMIT ?
        `).all(JSON.stringify(queryEmbedding), limit);

        if (vssResults.length > 0) {
          console.log(`🚀 Found ${vssResults.length} similar articles using VSS`);
          return vssResults;
        }
      } catch (error) {
        console.log('VSS search failed, using manual similarity calculation');
      }

      // Fallback to manual similarity calculation
      const articles = this.db.prepare(`
        SELECT article_id, title_embedding, content_embedding 
        FROM articles_vectors
      `).all();

      const similarities = articles.map(article => {
        const titleEmbedding = JSON.parse(article.title_embedding);
        const contentEmbedding = JSON.parse(article.content_embedding);
        
        const titleSim = this.cosineSimilarity(queryEmbedding, titleEmbedding);
        const contentSim = this.cosineSimilarity(queryEmbedding, contentEmbedding);
        
        // Weighted combination: 70% title, 30% content
        const combinedSimilarity = titleSim * 0.7 + contentSim * 0.3;

        return {
          article_id: article.article_id,
          similarity: combinedSimilarity,
          distance: 1 - combinedSimilarity // Convert to distance for consistency
        };
      });

      // Sort by similarity (descending) and limit results
      const sortedSimilarities = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      console.log(`🔍 Found ${sortedSimilarities.length} similar articles using manual calculation`);
      return sortedSimilarities;
    } catch (error) {
      console.error('Error finding similar articles:', error);
      return [];
    }
  }

  async getPersonalizedRecommendations(userId, limit = 20) {
    try {
      // Get user preferences vector
      const userPrefs = this.db.prepare(`
        SELECT preference_embedding, keywords 
        FROM user_preferences_vectors 
        WHERE user_id = ? 
        ORDER BY updated_at DESC 
        LIMIT 1
      `).get(userId);

      if (!userPrefs) {
        console.log(`No preference vector found for user ${userId}`);
        return [];
      }

      const prefEmbedding = JSON.parse(userPrefs.preference_embedding);
      const articles = this.db.prepare(`
        SELECT av.article_id, av.title_embedding, av.content_embedding 
        FROM articles_vectors av
        LEFT JOIN user_preferences up ON av.article_id = up.article_id AND up.user_id = ?
        WHERE up.article_id IS NULL
      `).all(userId);

      const recommendations = articles.map(article => {
        const titleEmbedding = JSON.parse(article.title_embedding);
        const contentEmbedding = JSON.parse(article.content_embedding);
        
        const titleSim = this.cosineSimilarity(prefEmbedding, titleEmbedding);
        const contentSim = this.cosineSimilarity(prefEmbedding, contentEmbedding);
        
        const score = titleSim * 0.6 + contentSim * 0.4;

        return {
          article_id: article.article_id,
          similarity_score: score
        };
      });

      const sortedRecommendations = recommendations
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, limit);

      console.log(`🎯 Generated ${sortedRecommendations.length} personalized recommendations for user ${userId}`);
      return sortedRecommendations;
    } catch (error) {
      console.error('Error getting personalized recommendations:', error);
      return [];
    }
  }

  async getVectorStats() {
    try {
      const articleCount = this.db.prepare('SELECT COUNT(*) as count FROM articles_vectors').get();
      const userPrefCount = this.db.prepare('SELECT COUNT(*) as count FROM user_preferences_vectors').get();
      
      return {
        total_article_vectors: articleCount.count,
        total_user_preference_vectors: userPrefCount.count,
        vector_dimension: 1536,
        embedding_model: 'text-embedding-3-small'
      };
    } catch (error) {
      console.error('Error getting vector stats:', error);
      return {};
    }
  }

  close() {
    this.db.close();
  }
}

module.exports = new VectorService();