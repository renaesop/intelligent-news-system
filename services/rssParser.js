const Parser = require('rss-parser');
const db = require('../db/database');
const recommendationService = require('./recommendationService');

const parser = new Parser({
  customFields: {
    item: ['content:encoded', 'category']
  }
});

class RSSService {
  async initializeSources(sources) {
    const stmt = db.prepare('INSERT OR IGNORE INTO rss_sources (name, url, category) VALUES (?, ?, ?)');
    
    sources.forEach(source => {
      stmt.run(source.name, source.url, source.category);
    });
    
    stmt.finalize();
  }

  async fetchAllFeeds() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM rss_sources WHERE active = 1', async (err, sources) => {
        if (err) return reject(err);
        
        const allArticles = [];
        
        for (const source of sources) {
          try {
            const articles = await this.fetchFeed(source);
            allArticles.push(...articles);
          } catch (error) {
            console.error(`Error fetching ${source.name}:`, error.message);
          }
        }
        
        resolve(allArticles);
      });
    });
  }

  async fetchFeed(source) {
    try {
      const feed = await parser.parseURL(source.url);
      const articles = [];

      for (const item of feed.items) {
        const article = {
          source_id: source.id,
          title: item.title || '',
          description: item.contentSnippet || item.description || '',
          content: item['content:encoded'] || item.content || item.description || '',
          url: item.link || item.guid || '',
          pub_date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
          author: item.creator || item.author || '',
          categories: this.extractCategories(item)
        };

        articles.push(article);
      }

      return articles;
    } catch (error) {
      console.error(`Error parsing RSS feed ${source.url}:`, error);
      throw error;
    }
  }

  extractCategories(item) {
    const categories = [];
    
    if (item.categories) {
      categories.push(...item.categories);
    }
    
    if (item.category) {
      if (Array.isArray(item.category)) {
        categories.push(...item.category);
      } else {
        categories.push(item.category);
      }
    }
    
    return categories.join(',');
  }

  async saveArticles(articles) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO articles 
      (source_id, title, description, content, url, pub_date, author, categories) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const savedArticles = [];

    articles.forEach(article => {
      const result = stmt.run(
        article.source_id,
        article.title,
        article.description,
        article.content,
        article.url,
        article.pub_date,
        article.author,
        article.categories
      );

      // If this is a new article (not ignored due to duplicate)
      if (result.changes > 0) {
        savedArticles.push({
          id: result.lastInsertRowid,
          ...article
        });
      }
    });

    stmt.finalize();

    // Generate vectors for new articles
    console.log(`🎯 Processing ${savedArticles.length} new articles for vector generation`);
    for (const article of savedArticles) {
      try {
        await recommendationService.processArticleForVectors(article);
      } catch (error) {
        console.error(`Error generating vectors for article ${article.id}:`, error);
      }
    }

    return savedArticles.length;
  }

  async getActiveSources() {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM rss_sources WHERE active = 1', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

module.exports = new RSSService();