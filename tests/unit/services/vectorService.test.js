// Mock environment first
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';

// Mock OpenAI before requiring vector service
const mockOpenAI = {
  embeddings: {
    create: jest.fn()
  }
};

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => mockOpenAI);
});

// Mock database
const mockDb = {
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn(),
  exec: jest.fn(),
  prepare: jest.fn().mockReturnValue({
    run: jest.fn(),
    finalize: jest.fn()
  })
};

jest.mock('../../../db/database', () => mockDb);

const vectorService = require('../../../services/vectorService');

describe('Vector Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAI.embeddings.create.mockReset();
  });

  describe('Embedding Generation', () => {
    test('should generate embeddings successfully', async () => {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
      
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      const result = await vectorService.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test text',
        encoding_format: 'float'
      });
    });

    test('should handle embedding generation errors', async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('API Error'));

      await expect(vectorService.generateEmbedding('test text'))
        .rejects.toThrow('API Error');
    });

    test('should handle empty text input', async () => {
      const result = await vectorService.generateEmbedding('');

      expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test('should use custom model when specified', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      await vectorService.generateEmbedding('test', 'text-embedding-ada-002');

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-ada-002',
        input: 'test',
        encoding_format: 'float'
      });
    });
  });

  describe('Cosine Similarity', () => {
    test('should calculate cosine similarity correctly', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [0, 1, 0];
      const vector3 = [1, 0, 0];

      const similarity1 = vectorService.cosineSimilarity(vector1, vector2);
      const similarity2 = vectorService.cosineSimilarity(vector1, vector3);

      expect(similarity1).toBe(0); // Orthogonal vectors
      expect(similarity2).toBe(1); // Identical vectors
    });

    test('should handle zero vectors', () => {
      const vector1 = [0, 0, 0];
      const vector2 = [1, 1, 1];

      const similarity = vectorService.cosineSimilarity(vector1, vector2);

      expect(similarity).toBe(0);
    });

    test('should handle different vector lengths gracefully', () => {
      const vector1 = [1, 0];
      const vector2 = [1, 0, 0];

      expect(() => {
        vectorService.cosineSimilarity(vector1, vector2);
      }).not.toThrow();
    });
  });

  describe('Article Vector Storage', () => {
    test('should store article vectors successfully', async () => {
      const mockEmbedding = new Array(1536).fill(0.5);
      
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      const result = await vectorService.storeArticleVectors(
        123,
        'Test Title',
        'Test content for embedding'
      );

      expect(result).toBe(true);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO article_vectors'),
        expect.arrayContaining([123, expect.any(String)]),
        expect.any(Function)
      );
    });

    test('should handle storage errors', async () => {
      const mockEmbedding = new Array(1536).fill(0.5);
      
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      });

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Database error'));
      });

      const result = await vectorService.storeArticleVectors(
        123,
        'Test Title',
        'Test content'
      );

      expect(result).toBe(false);
    });

    test('should skip storage for articles without content', async () => {
      const result = await vectorService.storeArticleVectors(123, '', '');

      expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
      expect(mockDb.run).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('Similar Articles Search', () => {
    test('should find similar articles', async () => {
      const queryEmbedding = new Array(1536).fill(0.7);
      const mockArticles = [
        { 
          article_id: 1, 
          title_vector: JSON.stringify(new Array(1536).fill(0.8)),
          content_vector: JSON.stringify(new Array(1536).fill(0.6))
        },
        { 
          article_id: 2, 
          title_vector: JSON.stringify(new Array(1536).fill(0.3)),
          content_vector: JSON.stringify(new Array(1536).fill(0.2))
        }
      ];

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: queryEmbedding }]
      });

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockArticles);
      });

      const results = await vectorService.findSimilarArticles('AI technology', 5);

      expect(results).toHaveLength(2);
      expect(results[0].similarity_score).toBeGreaterThan(results[1].similarity_score);
    });

    test('should handle empty search results', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: queryEmbedding }]
      });

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const results = await vectorService.findSimilarArticles('nonexistent topic', 5);

      expect(results).toEqual([]);
    });

    test('should handle malformed vector data', async () => {
      const queryEmbedding = new Array(1536).fill(0.5);
      const mockArticles = [
        { 
          article_id: 1, 
          title_vector: 'invalid-json',
          content_vector: JSON.stringify(new Array(1536).fill(0.5))
        }
      ];

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: queryEmbedding }]
      });

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockArticles);
      });

      const results = await vectorService.findSimilarArticles('test query', 5);

      // Should skip articles with invalid vector data
      expect(results).toEqual([]);
    });
  });

  describe('User Preference Vectors', () => {
    test('should update user preference vector', async () => {
      const keywords = ['machine learning', 'artificial intelligence', 'technology'];
      const mockEmbeddings = [
        new Array(1536).fill(0.8),
        new Array(1536).fill(0.7),
        new Array(1536).fill(0.6)
      ];

      mockOpenAI.embeddings.create
        .mockResolvedValueOnce({ data: [{ embedding: mockEmbeddings[0] }] })
        .mockResolvedValueOnce({ data: [{ embedding: mockEmbeddings[1] }] })
        .mockResolvedValueOnce({ data: [{ embedding: mockEmbeddings[2] }] });

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      const result = await vectorService.updateUserPreferenceVector('user-123', keywords);

      expect(result).toBe(true);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(3);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO user_preference_vectors'),
        expect.arrayContaining(['user-123']),
        expect.any(Function)
      );
    });

    test('should handle empty keywords array', async () => {
      const result = await vectorService.updateUserPreferenceVector('user-123', []);

      expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
      expect(mockDb.run).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    test('should handle embedding generation failures', async () => {
      const keywords = ['test'];
      
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('API Error'));

      const result = await vectorService.updateUserPreferenceVector('user-123', keywords);

      expect(result).toBe(false);
    });
  });

  describe('Personalized Recommendations', () => {
    test('should generate personalized recommendations', async () => {
      const mockUserVector = JSON.stringify(new Array(1536).fill(0.8));
      const mockArticles = [
        { 
          article_id: 1, 
          title_vector: JSON.stringify(new Array(1536).fill(0.9)),
          content_vector: JSON.stringify(new Array(1536).fill(0.7))
        },
        { 
          article_id: 2, 
          title_vector: JSON.stringify(new Array(1536).fill(0.3)),
          content_vector: JSON.stringify(new Array(1536).fill(0.2))
        }
      ];

      mockDb.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('SELECT preference_vector FROM user_preference_vectors')) {
          callback(null, { preference_vector: mockUserVector });
        }
      });

      mockDb.all.mockImplementation((sql, params, callback) => {
        if (sql.includes('SELECT article_id, title_vector, content_vector')) {
          callback(null, mockArticles);
        }
      });

      const results = await vectorService.getPersonalizedRecommendations('user-123', 10);

      expect(results).toHaveLength(2);
      expect(results[0].similarity_score).toBeGreaterThan(results[1].similarity_score);
      expect(results[0]).toMatchObject({
        article_id: expect.any(Number),
        similarity_score: expect.any(Number)
      });
    });

    test('should handle user without preference vector', async () => {
      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, null); // No preference vector found
      });

      const results = await vectorService.getPersonalizedRecommendations('new-user', 10);

      expect(results).toEqual([]);
    });

    test('should filter out articles user has already interacted with', async () => {
      const mockUserVector = JSON.stringify(new Array(1536).fill(0.8));
      const mockArticles = [
        { 
          article_id: 1, 
          title_vector: JSON.stringify(new Array(1536).fill(0.9)),
          content_vector: JSON.stringify(new Array(1536).fill(0.7))
        }
      ];

      mockDb.get.mockImplementation((sql, params, callback) => {
        callback(null, { preference_vector: mockUserVector });
      });

      mockDb.all.mockImplementation((sql, params, callback) => {
        if (sql.includes('SELECT article_id, title_vector, content_vector')) {
          callback(null, mockArticles);
        }
      });

      const results = await vectorService.getPersonalizedRecommendations('user-123', 10);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('av.article_id NOT IN'),
        expect.arrayContaining(['user-123']),
        expect.any(Function)
      );
    });
  });

  describe('Vector Statistics', () => {
    test('should return vector database statistics', async () => {
      const mockStats = {
        total_articles: 1000,
        vectorized_articles: 800,
        total_users: 50,
        users_with_preferences: 30
      };

      mockDb.get.mockImplementation((sql, callback) => {
        callback(null, mockStats);
      });

      const stats = await vectorService.getVectorStats();

      expect(stats).toMatchObject({
        total_articles: 1000,
        vectorized_articles: 800,
        vectorization_rate: '80.0%',
        total_users: 50,
        users_with_preferences: 30,
        preference_rate: '60.0%'
      });
    });

    test('should handle empty database', async () => {
      mockDb.get.mockImplementation((sql, callback) => {
        callback(null, {
          total_articles: 0,
          vectorized_articles: 0,
          total_users: 0,
          users_with_preferences: 0
        });
      });

      const stats = await vectorService.getVectorStats();

      expect(stats).toMatchObject({
        total_articles: 0,
        vectorized_articles: 0,
        vectorization_rate: '0.0%',
        total_users: 0,
        users_with_preferences: 0,
        preference_rate: '0.0%'
      });
    });

    test('should handle database errors gracefully', async () => {
      mockDb.get.mockImplementation((sql, callback) => {
        callback(new Error('Database error'));
      });

      const stats = await vectorService.getVectorStats();

      expect(stats).toMatchObject({
        total_articles: 0,
        vectorized_articles: 0,
        vectorization_rate: '0.0%',
        error: 'Failed to fetch vector statistics'
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large batch operations', async () => {
      const largeKeywordList = new Array(100).fill(0).map((_, i) => `keyword-${i}`);
      
      mockOpenAI.embeddings.create.mockImplementation(() => 
        Promise.resolve({ data: [{ embedding: new Array(1536).fill(Math.random()) }] })
      );

      mockDb.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      const result = await vectorService.updateUserPreferenceVector('user-123', largeKeywordList);

      expect(result).toBe(true);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(100);
    });

    test('should handle concurrent embedding requests', async () => {
      const texts = ['text1', 'text2', 'text3', 'text4', 'text5'];
      
      mockOpenAI.embeddings.create.mockImplementation(() => 
        Promise.resolve({ data: [{ embedding: new Array(1536).fill(Math.random()) }] })
      );

      const promises = texts.map(text => vectorService.generateEmbedding(text));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(5);
      results.forEach(result => {
        expect(result).toHaveLength(1536);
      });
    });

    test('should handle vector dimension mismatches', () => {
      const vector1 = new Array(1536).fill(0.5);
      const vector2 = new Array(512).fill(0.5); // Different dimension

      const similarity = vectorService.cosineSimilarity(vector1, vector2);

      // Should handle gracefully without throwing
      expect(typeof similarity).toBe('number');
    });

    test('should validate vector data integrity', async () => {
      const mockArticles = [
        { 
          article_id: 1, 
          title_vector: JSON.stringify([1, 2, 3]), // Too short
          content_vector: JSON.stringify(new Array(1536).fill(0.5))
        },
        { 
          article_id: 2, 
          title_vector: JSON.stringify(new Array(1536).fill('invalid')), // Invalid numbers
          content_vector: JSON.stringify(new Array(1536).fill(0.5))
        }
      ];

      const queryEmbedding = new Array(1536).fill(0.5);

      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: queryEmbedding }]
      });

      mockDb.all.mockImplementation((sql, params, callback) => {
        callback(null, mockArticles);
      });

      const results = await vectorService.findSimilarArticles('test query', 5);

      // Should filter out invalid vectors
      expect(results).toEqual([]);
    });
  });
});