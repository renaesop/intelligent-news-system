/**
 * Mock factory functions for consistent test data
 */

const mockArticle = (overrides = {}) => ({
  id: 'test-article-1',
  title: 'Test Article Title',
  content: 'Test article content',
  url: 'https://example.com/article-1',
  publishedAt: new Date().toISOString(),
  source: 'test-source',
  category: 'technology',
  tags: ['test', 'article'],
  ...overrides
});

const mockRecommendation = (overrides = {}) => ({
  id: 'test-rec-1',
  articleId: 'test-article-1',
  userId: 'test-user-1',
  score: 0.85,
  reason: 'test recommendation',
  createdAt: new Date().toISOString(),
  ...overrides
});

const mockUser = (overrides = {}) => ({
  id: 'test-user-1',
  preferences: {
    categories: ['technology', 'science'],
    tags: ['ai', 'programming']
  },
  interactions: [],
  ...overrides
});

const mockRSSSource = (overrides = {}) => ({
  id: 'test-source-1',
  name: 'Test Source',
  url: 'https://example.com/feed.xml',
  category: 'technology',
  isActive: true,
  lastFetch: new Date().toISOString(),
  ...overrides
});

const mockDatabase = () => {
  const mockDb = {
    prepare: jest.fn(),
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    close: jest.fn()
  };
  
  // Default implementations
  mockDb.prepare.mockReturnValue({
    run: mockDb.run,
    get: mockDb.get,
    all: mockDb.all
  });
  
  return mockDb;
};

const mockVectorService = () => ({
  generateEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  findSimilarArticles: jest.fn().mockResolvedValue([]),
  calculateSimilarity: jest.fn().mockReturnValue(0.8),
  getUserPreferenceVector: jest.fn().mockResolvedValue([0.2, 0.3, 0.4]),
  getPersonalizedRecommendations: jest.fn().mockResolvedValue([])
});

const mockRecallRankingService = () => ({
  getRecommendations: jest.fn().mockResolvedValue([]),
  cacheRecommendations: jest.fn().mockResolvedValue(true),
  getCachedRecommendations: jest.fn().mockResolvedValue(null),
  multiChannelRecall: jest.fn().mockResolvedValue([]),
  rankRecommendations: jest.fn().mockResolvedValue([])
});

module.exports = {
  mockArticle,
  mockRecommendation,
  mockUser,
  mockRSSSource,
  mockDatabase,
  mockVectorService,
  mockRecallRankingService
};