<template>
  <div class="stats-container">
    <h2>系统统计</h2>
    
    <div v-if="loading" class="loading">
      <p>加载中...</p>
    </div>
    
    <div v-else class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">{{ stats.totalArticles || 0 }}</div>
        <div class="stat-label">总文章数</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-number">{{ stats.totalSources || 0 }}</div>
        <div class="stat-label">RSS源数量</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-number">{{ userStats.totalInteractions || 0 }}</div>
        <div class="stat-label">用户互动</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-number">{{ userStats.preferenceCount || 0 }}</div>
        <div class="stat-label">偏好记录</div>
      </div>
    </div>

    <div class="preferences-section">
      <h3>用户偏好分析</h3>
      
      <div v-if="userStats.topCategories && userStats.topCategories.length" class="preferences-list">
        <div 
          v-for="category in userStats.topCategories" 
          :key="category.name"
          class="preference-item"
        >
          <span class="category-name">{{ category.name }}</span>
          <div class="preference-bar">
            <div 
              class="preference-fill"
              :style="{ width: `${(category.score / maxScore) * 100}%` }"
            ></div>
          </div>
          <span class="category-score">{{ category.score.toFixed(1) }}</span>
        </div>
      </div>
      
      <div v-else class="empty-preferences">
        <p>暂无偏好数据，多与新闻互动以建立个性化推荐</p>
      </div>
    </div>

    <div v-if="stats.recommendationStats" class="recommendation-stats-section">
      <h3>智能推荐统计</h3>
      
      <div class="rec-stats-grid">
        <div class="stat-card">
          <div class="stat-number">{{ stats.recommendationStats.cache_size || 0 }}</div>
          <div class="stat-label">缓存条目</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-number">{{ stats.recommendationStats.cache_hit_rate || '0%' }}</div>
          <div class="stat-label">缓存命中率</div>
        </div>
        
        <div v-if="stats.recommendationStats.cache_details" class="cache-details">
          <h4>缓存详情</h4>
          <div class="detail-item">
            <span>活跃条目: {{ stats.recommendationStats.cache_details.active_entries }}</span>
          </div>
          <div class="detail-item">
            <span>过期条目: {{ stats.recommendationStats.cache_details.expired_entries }}</span>
          </div>
          <div class="detail-item">
            <span>平均命中次数: {{ stats.recommendationStats.cache_details.avg_hit_count }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="actions-section">
      <button @click="refreshStats" :disabled="loading" class="refresh-btn">
        {{ loading ? '刷新中...' : '刷新统计' }}
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue'

export default {
  name: 'StatsPanel',
  setup() {
    const stats = ref({})
    const loading = ref(false)

    const userStats = computed(() => stats.value.userStats || {})
    
    const maxScore = computed(() => {
      if (!userStats.value.topCategories || !userStats.value.topCategories.length) {
        return 1
      }
      return Math.max(...userStats.value.topCategories.map(c => c.score))
    })

    const loadStats = async () => {
      loading.value = true
      try {
        // Load both general stats and recommendation stats
        const [generalResponse, recResponse] = await Promise.all([
          fetch('/api/stats?userId=default'),
          fetch('/api/recommendations/stats')
        ])
        
        const generalStats = await generalResponse.json()
        const recStats = await recResponse.json()
        
        stats.value = {
          ...generalStats,
          recommendationStats: recStats
        }
      } catch (error) {
        console.error('Error loading stats:', error)
      } finally {
        loading.value = false
      }
    }

    const refreshStats = () => {
      loadStats()
    }

    onMounted(() => {
      loadStats()
    })

    return {
      stats,
      loading,
      userStats,
      maxScore,
      refreshStats
    }
  }
}
</script>

<style scoped>
.stats-container {
  max-width: 100%;
}

.stats-container h2 {
  color: #333;
  margin-bottom: 1.5rem;
  font-size: 1.3rem;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border: 1px solid #f0f0f0;
}

.stat-number {
  font-size: 2rem;
  font-weight: bold;
  color: #007bff;
  margin-bottom: 0.5rem;
}

.stat-label {
  color: #666;
  font-size: 0.9rem;
}

.preferences-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.preferences-section h3 {
  color: #333;
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.preferences-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.preference-item {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.category-name {
  min-width: 80px;
  font-size: 0.9rem;
  color: #555;
}

.preference-bar {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.preference-fill {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #0056b3);
  transition: width 0.3s ease;
}

.category-score {
  min-width: 40px;
  text-align: right;
  font-size: 0.85rem;
  color: #666;
}

.empty-preferences {
  text-align: center;
  padding: 2rem;
  color: #666;
  font-size: 0.9rem;
}

.actions-section {
  text-align: center;
}

.refresh-btn {
  padding: 0.75rem 1.5rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: #218838;
}

.refresh-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.recommendation-stats-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.recommendation-stats-section h3 {
  color: #333;
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.rec-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.cache-details {
  grid-column: 1 / -1;
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  border-left: 3px solid #28a745;
}

.cache-details h4 {
  color: #333;
  margin-bottom: 0.75rem;
  font-size: 1rem;
}

.detail-item {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #555;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .stat-card {
    padding: 1rem;
  }
  
  .stat-number {
    font-size: 1.5rem;
  }
  
  .preference-item {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .category-name {
    min-width: auto;
    text-align: center;
  }
  
  .category-score {
    text-align: center;
  }
}
</style>