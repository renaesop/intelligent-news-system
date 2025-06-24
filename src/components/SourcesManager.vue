<template>
  <div class="sources-container">
    <div class="add-source-section">
      <h2>添加RSS源</h2>
      <form @submit.prevent="addSource" class="add-form">
        <div class="form-group">
          <label for="name">源名称</label>
          <input 
            id="name"
            v-model="newSource.name" 
            type="text" 
            placeholder="例如：新浪新闻" 
            required
          />
        </div>
        
        <div class="form-group">
          <label for="url">RSS链接</label>
          <input 
            id="url"
            v-model="newSource.url" 
            type="url" 
            placeholder="https://..." 
            required
          />
        </div>
        
        <div class="form-group">
          <label for="category">分类</label>
          <select id="category" v-model="newSource.category">
            <option value="general">综合</option>
            <option value="tech">科技</option>
            <option value="business">商业</option>
            <option value="sports">体育</option>
            <option value="entertainment">娱乐</option>
          </select>
        </div>
        
        <button type="submit" :disabled="loading" class="add-btn">
          {{ loading ? '添加中...' : '添加RSS源' }}
        </button>
      </form>
    </div>

    <div class="sources-list-section">
      <h2>当前RSS源</h2>
      
      <div v-if="sources.length === 0" class="empty-state">
        <p>暂无RSS源</p>
      </div>
      
      <div class="sources-list">
        <div 
          v-for="source in sources" 
          :key="source.id" 
          class="source-card"
        >
          <div class="source-info">
            <h3>{{ source.name }}</h3>
            <p class="source-url">{{ source.url }}</p>
            <span class="source-category">{{ getCategoryName(source.category) }}</span>
          </div>
          
          <div class="source-status">
            <span :class="['status-badge', source.active ? 'active' : 'inactive']">
              {{ source.active ? '活跃' : '禁用' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'

export default {
  name: 'SourcesManager',
  setup() {
    const sources = ref([])
    const loading = ref(false)
    const newSource = ref({
      name: '',
      url: '',
      category: 'general'
    })

    const categoryNames = {
      general: '综合',
      tech: '科技',
      business: '商业',
      sports: '体育',
      entertainment: '娱乐'
    }

    const loadSources = async () => {
      try {
        const response = await fetch('/api/sources')
        sources.value = await response.json()
      } catch (error) {
        console.error('Error loading sources:', error)
      }
    }

    const addSource = async () => {
      if (!newSource.value.name || !newSource.value.url) return
      
      loading.value = true
      try {
        const response = await fetch('/api/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSource.value)
        })
        
        if (response.ok) {
          newSource.value = { name: '', url: '', category: 'general' }
          await loadSources()
        }
      } catch (error) {
        console.error('Error adding source:', error)
      } finally {
        loading.value = false
      }
    }

    const getCategoryName = (category) => {
      return categoryNames[category] || category
    }

    onMounted(() => {
      loadSources()
    })

    return {
      sources,
      loading,
      newSource,
      addSource,
      getCategoryName
    }
  }
}
</script>

<style scoped>
.sources-container {
  max-width: 100%;
}

.add-source-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.add-source-section h2 {
  color: #333;
  margin-bottom: 1.5rem;
  font-size: 1.3rem;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: #555;
  font-size: 0.9rem;
}

.form-group input,
.form-group select {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #007bff;
}

.add-btn {
  padding: 0.75rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 0.5rem;
}

.add-btn:hover:not(:disabled) {
  background: #218838;
}

.add-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.sources-list-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.sources-list-section h2 {
  color: #333;
  margin-bottom: 1.5rem;
  font-size: 1.3rem;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.sources-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.source-card {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  background: #fafafa;
  gap: 1rem;
}

.source-info {
  flex: 1;
  min-width: 0;
}

.source-info h3 {
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 1rem;
  word-break: break-word;
}

.source-url {
  color: #666;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
  word-break: break-all;
}

.source-category {
  background: #e9ecef;
  color: #495057;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.source-status {
  flex-shrink: 0;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.active {
  background: #d4edda;
  color: #155724;
}

.status-badge.inactive {
  background: #f8d7da;
  color: #721c24;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .source-card {
    flex-direction: column;
    align-items: stretch;
  }
  
  .source-status {
    align-self: flex-start;
  }
}
</style>