const db = require('../db/database');
const vectorService = require('./vectorService');
const llmService = require('./llmService');
const memoryService = require('./memoryService');

// 初始化缓存表
db.exec(`
  CREATE TABLE IF NOT EXISTS recommendation_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    data TEXT NOT NULL,
    options TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    hit_count INTEGER DEFAULT 0
  )
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_cache_key ON recommendation_cache(cache_key);
  CREATE INDEX IF NOT EXISTS idx_user_expires ON recommendation_cache(user_id, expires_at);
`);

class RecallRankingService {
  constructor() {
    // 召回策略权重配置
    this.recallConfig = {
      vector_recall: {
        enabled: true,
        weight: 0.4,
        candidate_size: 200
      },
      tag_recall: {
        enabled: true,
        weight: 0.3,
        candidate_size: 150
      },
      collaborative_recall: {
        enabled: true,
        weight: 0.2,
        candidate_size: 100
      },
      trending_recall: {
        enabled: true,
        weight: 0.1,
        candidate_size: 50
      }
    };

    // 排序算法权重配置
    this.rankingConfig = {
      relevance: 0.4,      // 相关度
      interest: 0.3,       // 兴趣度
      diversity: 0.2,      // 多样性
      freshness: 0.1       // 新鲜度
    };

    // 分页缓存配置
    this.cacheConfig = {
      ttl: 1800000,        // 30分钟缓存
      max_cache_size: 1000, // 最大缓存数量
      page_size: 20
    };

    // SQLite缓存初始化完成
  }

  /**
   * 主推荐入口 - 召回+排序两阶段
   */
  async getRecommendations(userId, options = {}) {
    const {
      page = 1,
      pageSize = 20,
      forceRefresh = false,
      enableExplain = false
    } = options;

    // 检查SQLite缓存
    const cacheKey = `rec_${userId}_${JSON.stringify(options)}`;
    if (!forceRefresh) {
      const cachedResult = await this.getCachedRecommendations(cacheKey);
      if (cachedResult) {
        console.log(`🎯 Using cached recommendations for user ${userId}, page ${page}`);
        return this.paginateResults(cachedResult, page, pageSize, enableExplain);
      }
    }

    console.log(`🔄 Generating fresh recommendations for user ${userId}`);

    try {
      // 阶段1: 多路召回
      const recallCandidates = await this.multiChannelRecall(userId);
      console.log(`📊 Recall stage: ${recallCandidates.length} candidates`);

      // 阶段2: 混合排序
      const rankedResults = await this.hybridRanking(userId, recallCandidates, enableExplain);
      console.log(`🎯 Ranking stage: ${rankedResults.length} ranked results`);

      // 缓存结果到SQLite
      await this.cacheRecommendations(cacheKey, userId, rankedResults, options);

      // 清理过期缓存
      this.cleanupExpiredCache();

      return this.paginateResults(rankedResults, page, pageSize, enableExplain);

    } catch (error) {
      console.error('Error in recommendation pipeline:', error);
      throw error;
    }
  }

  /**
   * 多路召回策略
   */
  async multiChannelRecall(userId) {
    const candidates = new Map(); // 使用Map避免重复

    try {
      // 1. 向量召回 - 基于语义相似度
      if (this.recallConfig.vector_recall.enabled) {
        const vectorCandidates = await this.vectorRecall(userId, this.recallConfig.vector_recall.candidate_size);
        vectorCandidates.forEach(candidate => {
          candidate.recall_source = 'vector';
          candidate.recall_score = candidate.similarity_score || 0;
          candidates.set(candidate.id, candidate);
        });
        console.log(`🔍 Vector recall: ${vectorCandidates.length} candidates`);
      }

      // 2. 标签召回 - 基于用户兴趣标签
      if (this.recallConfig.tag_recall.enabled) {
        const tagCandidates = await this.tagBasedRecall(userId, this.recallConfig.tag_recall.candidate_size);
        tagCandidates.forEach(candidate => {
          if (candidates.has(candidate.id)) {
            // 合并召回源
            candidates.get(candidate.id).recall_source += ',tag';
            candidates.get(candidate.id).tag_score = candidate.tag_score;
          } else {
            candidate.recall_source = 'tag';
            candidate.recall_score = candidate.tag_score || 0;
            candidates.set(candidate.id, candidate);
          }
        });
        console.log(`🏷️ Tag recall: ${tagCandidates.length} candidates`);
      }

      // 3. 协同过滤召回 - 基于相似用户
      if (this.recallConfig.collaborative_recall.enabled) {
        const collabCandidates = await this.collaborativeRecall(userId, this.recallConfig.collaborative_recall.candidate_size);
        collabCandidates.forEach(candidate => {
          if (candidates.has(candidate.id)) {
            candidates.get(candidate.id).recall_source += ',collaborative';
            candidates.get(candidate.id).collab_score = candidate.collab_score;
          } else {
            candidate.recall_source = 'collaborative';
            candidate.recall_score = candidate.collab_score || 0;
            candidates.set(candidate.id, candidate);
          }
        });
        console.log(`👥 Collaborative recall: ${collabCandidates.length} candidates`);
      }

      // 4. 热门召回 - 基于全局热度
      if (this.recallConfig.trending_recall.enabled) {
        const trendingCandidates = await this.trendingRecall(this.recallConfig.trending_recall.candidate_size);
        trendingCandidates.forEach(candidate => {
          if (candidates.has(candidate.id)) {
            candidates.get(candidate.id).recall_source += ',trending';
            candidates.get(candidate.id).trending_score = candidate.trending_score;
          } else {
            candidate.recall_source = 'trending';
            candidate.recall_score = candidate.trending_score || 0;
            candidates.set(candidate.id, candidate);
          }
        });
        console.log(`🔥 Trending recall: ${trendingCandidates.length} candidates`);
      }

      return Array.from(candidates.values());

    } catch (error) {
      console.error('Error in multi-channel recall:', error);
      return [];
    }
  }

  /**
   * 向量召回
   */
  async vectorRecall(userId, limit) {
    try {
      const vectorRecommendations = await vectorService.getPersonalizedRecommendations(userId, limit);
      
      if (vectorRecommendations.length === 0) return [];

      const articleIds = vectorRecommendations.map(r => r.article_id);
      const placeholders = articleIds.map(() => '?').join(',');
      
      return new Promise((resolve, reject) => {
        db.all(`
          SELECT a.*, s.name as source_name, s.category as source_category
          FROM articles a
          JOIN rss_sources s ON a.source_id = s.id
          WHERE a.id IN (${placeholders})
          AND a.id NOT IN (
            SELECT article_id FROM user_preferences WHERE user_id = ?
          )
        `, [...articleIds, userId], (err, articles) => {
          if (err) return reject(err);
          
          const enrichedArticles = articles.map(article => {
            const vectorData = vectorRecommendations.find(r => r.article_id === article.id);
            return {
              ...article,
              similarity_score: vectorData ? vectorData.similarity_score : 0
            };
          });
          
          resolve(enrichedArticles);
        });
      });

    } catch (error) {
      console.error('Error in vector recall:', error);
      return [];
    }
  }

  /**
   * 标签召回
   */
  async tagBasedRecall(userId, limit) {
    try {
      // 获取用户兴趣标签
      const userInterests = await this.getUserInterestTags(userId);
      if (userInterests.length === 0) return [];

      const tagConditions = userInterests.map(() => 'categories LIKE ?').join(' OR ');
      const tagParams = userInterests.map(tag => `%${tag.keyword}%`);

      return new Promise((resolve, reject) => {
        db.all(`
          SELECT a.*, s.name as source_name, s.category as source_category,
                 a.created_at as publish_time
          FROM articles a
          JOIN rss_sources s ON a.source_id = s.id
          WHERE (${tagConditions})
          AND a.id NOT IN (
            SELECT article_id FROM user_preferences WHERE user_id = ?
          )
          ORDER BY a.created_at DESC
          LIMIT ?
        `, [...tagParams, userId, limit], (err, articles) => {
          if (err) return reject(err);
          
          // 计算标签匹配分数
          const scoredArticles = articles.map(article => {
            let tagScore = 0;
            userInterests.forEach(interest => {
              if (article.categories && article.categories.toLowerCase().includes(interest.keyword.toLowerCase())) {
                tagScore += interest.weight || 1;
              }
            });
            
            return {
              ...article,
              tag_score: tagScore
            };
          });
          
          resolve(scoredArticles);
        });
      });

    } catch (error) {
      console.error('Error in tag-based recall:', error);
      return [];
    }
  }

  /**
   * 协同过滤召回
   */
  async collaborativeRecall(userId, limit) {
    try {
      // 找到相似用户
      const similarUsers = await this.findSimilarUsers(userId, 10);
      if (similarUsers.length === 0) return [];

      const userIds = similarUsers.map(u => u.user_id);
      const placeholders = userIds.map(() => '?').join(',');

      return new Promise((resolve, reject) => {
        db.all(`
          SELECT a.*, s.name as source_name, s.category as source_category,
                 COUNT(up.user_id) as like_count
          FROM articles a
          JOIN rss_sources s ON a.source_id = s.id
          JOIN user_preferences up ON a.id = up.article_id
          WHERE up.user_id IN (${placeholders})
          AND up.action = 'like'
          AND a.id NOT IN (
            SELECT article_id FROM user_preferences WHERE user_id = ?
          )
          GROUP BY a.id
          ORDER BY like_count DESC, a.created_at DESC
          LIMIT ?
        `, [...userIds, userId, limit], (err, articles) => {
          if (err) return reject(err);
          
          const scoredArticles = articles.map(article => ({
            ...article,
            collab_score: article.like_count || 0
          }));
          
          resolve(scoredArticles);
        });
      });

    } catch (error) {
      console.error('Error in collaborative recall:', error);
      return [];
    }
  }

  /**
   * 热门召回
   */
  async trendingRecall(limit) {
    try {
      return new Promise((resolve, reject) => {
        db.all(`
          SELECT a.*, s.name as source_name, s.category as source_category,
                 COUNT(up.user_id) as interaction_count,
                 SUM(CASE WHEN up.action = 'like' THEN 2 ELSE -1 END) as trending_score
          FROM articles a
          JOIN rss_sources s ON a.source_id = s.id
          LEFT JOIN user_preferences up ON a.id = up.article_id
          WHERE a.created_at > datetime('now', '-7 days')
          GROUP BY a.id
          HAVING interaction_count > 0
          ORDER BY trending_score DESC, a.created_at DESC
          LIMIT ?
        `, [limit], (err, articles) => {
          if (err) return reject(err);
          resolve(articles);
        });
      });

    } catch (error) {
      console.error('Error in trending recall:', error);
      return [];
    }
  }

  /**
   * 混合排序算法
   */
  async hybridRanking(userId, candidates, enableExplain = false) {
    if (candidates.length === 0) return [];

    try {
      const rankedCandidates = await Promise.all(
        candidates.map(async (article) => {
          const scores = await this.calculateRankingScores(userId, article);
          
          // 计算综合分数
          const finalScore = 
            scores.relevance * this.rankingConfig.relevance +
            scores.interest * this.rankingConfig.interest +
            scores.diversity * this.rankingConfig.diversity +
            scores.freshness * this.rankingConfig.freshness;

          const rankedArticle = {
            ...article,
            final_score: finalScore,
            ranking_scores: scores
          };

          // 添加推荐解释
          if (enableExplain) {
            rankedArticle.explanation = this.generateExplanation(article, scores);
          }

          return rankedArticle;
        })
      );

      // 应用多样性重排
      const diversifiedResults = this.applyDiversification(rankedCandidates);

      return diversifiedResults.sort((a, b) => b.final_score - a.final_score);

    } catch (error) {
      console.error('Error in hybrid ranking:', error);
      return candidates;
    }
  }

  /**
   * 计算排序分数
   */
  async calculateRankingScores(userId, article) {
    const scores = {
      relevance: 0,
      interest: 0,
      diversity: 0,
      freshness: 0
    };

    try {
      // 相关度分数 (基于向量相似度和标签匹配)
      scores.relevance = Math.max(
        article.similarity_score || 0,
        (article.tag_score || 0) / 10
      );

      // 兴趣度分数 (基于用户历史行为)
      scores.interest = await this.calculateInterestScore(userId, article);

      // 多样性分数 (基于内容多样性)
      scores.diversity = this.calculateDiversityScore(article);

      // 新鲜度分数 (基于发布时间)
      scores.freshness = this.calculateFreshnessScore(article);

      // 标准化分数到0-1范围
      Object.keys(scores).forEach(key => {
        scores[key] = Math.max(0, Math.min(1, scores[key]));
      });

    } catch (error) {
      console.error('Error calculating ranking scores:', error);
    }

    return scores;
  }

  /**
   * 计算兴趣度分数
   */
  async calculateInterestScore(userId, article) {
    try {
      // 基于用户历史偏好
      const userInterests = await this.getUserInterestTags(userId);
      let interestScore = 0;

      if (article.categories) {
        userInterests.forEach(interest => {
          if (article.categories.toLowerCase().includes(interest.keyword.toLowerCase())) {
            interestScore += interest.weight || 1;
          }
        });
      }

      // 基于来源偏好
      const sourcePreference = await this.getSourcePreference(userId, article.source_id);
      interestScore += sourcePreference;

      return Math.min(1, interestScore / 5); // 标准化

    } catch (error) {
      console.error('Error calculating interest score:', error);
      return 0;
    }
  }

  /**
   * 计算多样性分数
   */
  calculateDiversityScore(article) {
    // 基于内容长度、来源多样性等
    let diversityScore = 0.5; // 基础分数

    // 标题长度多样性
    if (article.title) {
      const titleLength = article.title.length;
      if (titleLength > 20 && titleLength < 100) {
        diversityScore += 0.2;
      }
    }

    // 分类多样性
    if (article.categories) {
      const categoryCount = article.categories.split(',').length;
      diversityScore += Math.min(0.3, categoryCount * 0.1);
    }

    return Math.min(1, diversityScore);
  }

  /**
   * 计算新鲜度分数
   */
  calculateFreshnessScore(article) {
    if (!article.created_at && !article.pub_date) return 0.5;

    const publishTime = new Date(article.created_at || article.pub_date);
    const now = new Date();
    const hoursDiff = (now - publishTime) / (1000 * 60 * 60);

    // 24小时内为最新，之后逐渐衰减
    if (hoursDiff <= 1) return 1.0;
    if (hoursDiff <= 6) return 0.9;
    if (hoursDiff <= 24) return 0.7;
    if (hoursDiff <= 72) return 0.5;
    if (hoursDiff <= 168) return 0.3; // 一周内
    return 0.1;
  }

  /**
   * 应用多样性重排
   */
  applyDiversification(candidates) {
    if (candidates.length <= 10) return candidates;

    const diversified = [];
    const used_sources = new Set();
    const used_categories = new Set();

    // 先选择高分且多样的文章
    const sorted = [...candidates].sort((a, b) => b.final_score - a.final_score);

    for (const article of sorted) {
      const source = article.source_name || article.source_id;
      const category = article.source_category || 'general';

      // 控制同一来源和分类的文章数量
      const sourceCount = Array.from(used_sources).filter(s => s === source).length;
      const categoryCount = Array.from(used_categories).filter(c => c === category).length;

      if (sourceCount < 3 && categoryCount < 5) {
        diversified.push(article);
        used_sources.add(source);
        used_categories.add(category);
      } else if (diversified.length < candidates.length * 0.8) {
        // 仍有空间，但降低分数
        article.final_score *= 0.8;
        diversified.push(article);
      }
    }

    // 填充剩余位置
    const remaining = sorted.filter(a => !diversified.includes(a));
    diversified.push(...remaining.slice(0, candidates.length - diversified.length));

    return diversified;
  }

  /**
   * 分页处理
   */
  paginateResults(results, page, pageSize, enableExplain) {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedResults = results.slice(startIndex, endIndex);

    return {
      data: paginatedResults,
      pagination: {
        current_page: page,
        page_size: pageSize,
        total_items: results.length,
        total_pages: Math.ceil(results.length / pageSize),
        has_next: endIndex < results.length,
        has_previous: page > 1
      },
      metadata: {
        cache_used: false, // Will be set by cache methods
        generated_at: new Date().toISOString(),
        algorithm_version: '2.0'
      }
    };
  }

  /**
   * 生成推荐解释
   */
  generateExplanation(article, scores) {
    const explanations = [];

    if (scores.relevance > 0.7) {
      explanations.push(`与您的兴趣高度相关 (${(scores.relevance * 100).toFixed(0)}%)`);
    }
    
    if (scores.interest > 0.6) {
      explanations.push('基于您的阅读偏好推荐');
    }
    
    if (scores.freshness > 0.8) {
      explanations.push('最新发布的热门内容');
    }
    
    if (article.recall_source && article.recall_source.includes(',')) {
      explanations.push('多个推荐策略共同推荐');
    }

    return explanations.join('；') || '根据智能算法为您推荐';
  }

  /**
   * 辅助方法
   */
  async getUserInterestTags(userId) {
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT keyword, weight 
        FROM user_interests 
        WHERE user_id = ? 
        ORDER BY weight DESC 
        LIMIT 10
      `, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async findSimilarUsers(userId, limit) {
    // 简化的相似用户查找
    return new Promise((resolve, reject) => {
      db.all(`
        SELECT u2.user_id, COUNT(*) as common_likes
        FROM user_preferences u1
        JOIN user_preferences u2 ON u1.article_id = u2.article_id
        WHERE u1.user_id = ? AND u2.user_id != ? 
        AND u1.action = 'like' AND u2.action = 'like'
        GROUP BY u2.user_id
        HAVING common_likes >= 2
        ORDER BY common_likes DESC
        LIMIT ?
      `, [userId, userId, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getSourcePreference(userId, sourceId) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          SUM(CASE WHEN action = 'like' THEN 1 ELSE -0.5 END) as preference_score
        FROM user_preferences up
        JOIN articles a ON up.article_id = a.id
        WHERE up.user_id = ? AND a.source_id = ?
      `, [userId, sourceId], (err, row) => {
        if (err) reject(err);
        else resolve(Math.max(0, (row?.preference_score || 0) / 10));
      });
    });
  }

  /**
   * SQLite缓存操作方法
   */
  async getCachedRecommendations(cacheKey) {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT data, hit_count
        FROM recommendation_cache 
        WHERE cache_key = ? AND expires_at > datetime('now')
      `, [cacheKey], (err, row) => {
        if (err) {
          console.error('Error reading cache:', err);
          return resolve(null);
        }
        
        if (row) {
          // 更新命中次数
          db.run(`
            UPDATE recommendation_cache 
            SET hit_count = hit_count + 1 
            WHERE cache_key = ?
          `, [cacheKey]);
          
          try {
            const data = JSON.parse(row.data);
            resolve(data);
          } catch (parseError) {
            console.error('Error parsing cached data:', parseError);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  }

  async cacheRecommendations(cacheKey, userId, data, options) {
    return new Promise((resolve, reject) => {
      const expiresAt = new Date(Date.now() + this.cacheConfig.ttl).toISOString();
      const dataJson = JSON.stringify(data);
      const optionsJson = JSON.stringify(options);

      db.run(`
        INSERT OR REPLACE INTO recommendation_cache 
        (cache_key, user_id, data, options, expires_at, hit_count)
        VALUES (?, ?, ?, ?, ?, 0)
      `, [cacheKey, userId, dataJson, optionsJson, expiresAt], (err) => {
        if (err) {
          console.error('Error caching recommendations:', err);
          return resolve(false);
        }
        resolve(true);
      });
    });
  }

  /**
   * 清理过期缓存
   */
  cleanupExpiredCache() {
    // 异步清理过期缓存
    setImmediate(() => {
      db.run(`
        DELETE FROM recommendation_cache 
        WHERE expires_at < datetime('now')
      `, (err) => {
        if (err) {
          console.error('Error cleaning expired cache:', err);
          return;
        }
        
        // 如果缓存数量仍然过多，删除最旧的
        db.run(`
          DELETE FROM recommendation_cache 
          WHERE id IN (
            SELECT id FROM recommendation_cache 
            ORDER BY created_at ASC 
            LIMIT (
              SELECT MAX(0, COUNT(*) - ?) 
              FROM recommendation_cache
            )
          )
        `, [this.cacheConfig.max_cache_size], (err) => {
          if (err) {
            console.error('Error cleaning old cache:', err);
          } else {
            console.log('🧹 SQLite cache cleaned successfully');
          }
        });
      });
    });
  }

  /**
   * 获取推荐统计信息
   */
  async getRecommendationStats() {
    const cacheStats = await this.getCacheStats();
    return {
      cache_size: cacheStats.total_entries,
      cache_hit_rate: cacheStats.hit_rate,
      recall_config: this.recallConfig,
      ranking_config: this.rankingConfig,
      cache_config: this.cacheConfig,
      cache_details: cacheStats
    };
  }

  async getCacheStats() {
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          COUNT(*) as total_entries,
          COUNT(CASE WHEN expires_at > datetime('now') THEN 1 END) as active_entries,
          AVG(hit_count) as avg_hit_count,
          MAX(hit_count) as max_hit_count,
          MIN(created_at) as oldest_entry,
          MAX(created_at) as newest_entry
        FROM recommendation_cache
      `, (err, row) => {
        if (err) {
          console.error('Error getting cache stats:', err);
          return resolve({
            total_entries: 0,
            active_entries: 0,
            hit_rate: '0%',
            avg_hit_count: 0
          });
        }
        
        const hitRate = row.total_entries > 0 ? 
          ((row.avg_hit_count || 0) / Math.max(1, row.total_entries) * 100).toFixed(1) + '%' : '0%';
        
        resolve({
          total_entries: row.total_entries || 0,
          active_entries: row.active_entries || 0,
          expired_entries: (row.total_entries || 0) - (row.active_entries || 0),
          hit_rate: hitRate,
          avg_hit_count: (row.avg_hit_count || 0).toFixed(2),
          max_hit_count: row.max_hit_count || 0,
          oldest_entry: row.oldest_entry,
          newest_entry: row.newest_entry
        });
      });
    });
  }
}

module.exports = new RecallRankingService();