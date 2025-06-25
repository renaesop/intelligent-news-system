<template>
  <div class="news-container">
    <div class="header-actions">
      <button @click="fetchNews" :disabled="loading" class="fetch-btn">
        {{ loading ? '获取中...' : '获取最新新闻' }}
      </button>
    </div>

    <div v-if="articles.length === 0" class="empty-state">
      <p>暂无推荐新闻，点击上方按钮获取最新新闻</p>
    </div>

    <div class="articles-list">
      <article 
        v-for="article in articles" 
        :key="article.id" 
        class="article-card"
      >
        <h3 class="article-title">{{ article.title }}</h3>
        <p class="article-description">{{ article.description }}</p>
        
        <div class="article-meta">
          <span class="source">{{ article.source }}</span>
          <span class="date">{{ formatDate(article.publishedAt) }}</span>
        </div>

        <div v-if="article.explanation" class="recommendation-explanation">
          <small>💡 {{ article.explanation }}</small>
        </div>

        <div class="article-actions">
          <button 
            @click="giveFeedback(article.id, 'like')" 
            :class="{ active: article.userFeedback === 'like' }"
            class="like-btn"
          >
            👍 赞
          </button>
          <button 
            @click="giveFeedback(article.id, 'dislike')" 
            :class="{ active: article.userFeedback === 'dislike' }"
            class="dislike-btn"
          >
            👎 不感兴趣
          </button>
          <a :href="article.link" target="_blank" class="read-btn">
            阅读原文
          </a>
        </div>
      </article>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  name: 'NewsList',
  setup() {
    const articles = ref([])
    const loading = ref(false)

    const fetchNews = async () => {
      loading.value = true
      try {
        await fetch('/api/articles/fetch', { method: 'POST' })
        await loadRecommendations()
      } catch (error) {
        console.error('Error fetching news:', error)
      } finally {
        loading.value = false
      }
    }

    const loadRecommendations = async () => {
      try {
        const response = await fetch('/api/articles/recommended?enableExplain=true')
        const result = await response.json()
        
        // Handle new response format from recall-ranking service
        if (result.data && Array.isArray(result.data)) {
          articles.value = result.data.map(article => ({
            id: article.id,
            title: article.title,
            description: article.description,
            source: article.source_name || article.source,
            publishedAt: article.pub_date || article.created_at,
            link: article.url,
            userFeedback: null,
            explanation: article.explanation // Show recommendation explanation
          }))
        } else if (Array.isArray(result)) {
          // Fallback for old format
          articles.value = result
        }
      } catch (error) {
        console.error('Error loading recommendations:', error)
      }
    }

    const giveFeedback = async (articleId, action) => {
      try {
        await fetch(`/api/articles/${articleId}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, userId: 'default' })
        })
        
        const article = articles.value.find(a => a.id === articleId)
        if (article) {
          article.userFeedback = action
        }
      } catch (error) {
        console.error('Error giving feedback:', error)
      }
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString('zh-CN')
    }

    onMounted(() => {
      loadRecommendations()
    })

    return {
      articles,
      loading,
      fetchNews,
      giveFeedback,
      formatDate
    }
  }
}
</script>

<style scoped>
.news-container {
  max-width: 100%;
  margin: 0 auto;
}

.header-actions {
  margin-bottom: 1.5rem;
  text-align: center;
}

.fetch-btn {
  padding: 0.75rem 1.5rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
  width: 100%;
  max-width: 200px;
}

.fetch-btn:hover:not(:disabled) {
  background: #0056b3;
}

.fetch-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #666;
}

.articles-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.article-card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border: 1px solid #f0f0f0;
}

.article-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
  margin-bottom: 0.75rem;
  line-height: 1.4;
}

.article-description {
  color: #666;
  line-height: 1.5;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

.article-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
  font-size: 0.8rem;
  color: #888;
}

.article-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.article-actions button {
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
  flex: 1;
  min-width: 80px;
}

.like-btn:hover, .like-btn.active {
  background: #28a745;
  color: white;
  border-color: #28a745;
}

.dislike-btn:hover, .dislike-btn.active {
  background: #dc3545;
  color: white;
  border-color: #dc3545;
}

.read-btn {
  padding: 0.5rem 0.75rem;
  background: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-size: 0.85rem;
  text-align: center;
  flex: 1;
  min-width: 80px;
  transition: background 0.2s;
}

.read-btn:hover {
  background: #0056b3;
}

.recommendation-explanation {
  background: #f8f9fa;
  padding: 0.5rem;
  border-radius: 6px;
  margin-bottom: 1rem;
  border-left: 3px solid #007bff;
}

.recommendation-explanation small {
  color: #6c757d;
  font-style: italic;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .article-actions {
    flex-direction: column;
  }
  
  .article-actions button,
  .read-btn {
    flex: none;
    width: 100%;
    margin-bottom: 0.5rem;
  }
  
  .article-meta {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>