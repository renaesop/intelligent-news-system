/**
 * Test data fixtures for consistent testing
 */

const testArticles = [
  {
    id: 'article-1',
    title: 'AI Breakthrough in Machine Learning',
    content: 'Recent advances in artificial intelligence have led to significant breakthroughs in machine learning algorithms.',
    url: 'https://example.com/ai-breakthrough',
    publishedAt: '2024-01-15T10:00:00Z',
    source: 'tech-news',
    category: 'technology',
    tags: ['ai', 'machine-learning', 'breakthrough']
  },
  {
    id: 'article-2',
    title: 'Climate Change Impact on Global Economy',
    content: 'New research shows the significant economic impact of climate change on global markets.',
    url: 'https://example.com/climate-economy',
    publishedAt: '2024-01-14T15:30:00Z',
    source: 'science-daily',
    category: 'science',
    tags: ['climate', 'economy', 'research']
  },
  {
    id: 'article-3',
    title: 'New Programming Language Released',
    content: 'A new programming language designed for high-performance computing has been released.',
    url: 'https://example.com/new-language',
    publishedAt: '2024-01-13T09:15:00Z',
    source: 'dev-news',
    category: 'technology',
    tags: ['programming', 'language', 'performance']
  }
];

const testUsers = [
  {
    id: 'user-1',
    preferences: {
      categories: ['technology', 'science'],
      tags: ['ai', 'programming', 'research']
    },
    interactions: [
      { articleId: 'article-1', action: 'like', timestamp: '2024-01-15T11:00:00Z' },
      { articleId: 'article-3', action: 'share', timestamp: '2024-01-13T10:00:00Z' }
    ]
  },
  {
    id: 'user-2',
    preferences: {
      categories: ['science', 'health'],
      tags: ['climate', 'research', 'health']
    },
    interactions: [
      { articleId: 'article-2', action: 'like', timestamp: '2024-01-14T16:00:00Z' }
    ]
  }
];

const testSources = [
  {
    id: 'source-1',
    name: 'Tech News',
    url: 'https://example.com/tech-feed.xml',
    category: 'technology',
    isActive: true,
    lastFetch: '2024-01-15T12:00:00Z'
  },
  {
    id: 'source-2',
    name: 'Science Daily',
    url: 'https://example.com/science-feed.xml',
    category: 'science',
    isActive: true,
    lastFetch: '2024-01-14T18:00:00Z'
  }
];

const testVectors = [
  {
    articleId: 'article-1',
    embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
    dimensions: 5
  },
  {
    articleId: 'article-2',
    embedding: [0.2, 0.3, 0.1, 0.5, 0.4],
    dimensions: 5
  },
  {
    articleId: 'article-3',
    embedding: [0.3, 0.1, 0.4, 0.2, 0.5],
    dimensions: 5
  }
];

module.exports = {
  testArticles,
  testUsers,
  testSources,
  testVectors
};