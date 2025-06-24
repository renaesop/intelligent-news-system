<template>
  <div id="app">
    <header class="header">
      <h1>智能新闻推荐系统</h1>
      <nav>
        <button 
          :class="{ active: activeTab === 'news' }" 
          @click="activeTab = 'news'"
        >
          推荐新闻
        </button>
        <button 
          :class="{ active: activeTab === 'sources' }" 
          @click="activeTab = 'sources'"
        >
          RSS源管理
        </button>
        <button 
          :class="{ active: activeTab === 'stats' }" 
          @click="activeTab = 'stats'"
        >
          统计信息
        </button>
      </nav>
    </header>

    <main class="main">
      <NewsList v-if="activeTab === 'news'" />
      <SourcesManager v-if="activeTab === 'sources'" />
      <StatsPanel v-if="activeTab === 'stats'" />
    </main>
  </div>
</template>

<script>
import { ref } from 'vue'
import NewsList from './components/NewsList.vue'
import SourcesManager from './components/SourcesManager.vue'
import StatsPanel from './components/StatsPanel.vue'

export default {
  name: 'App',
  components: {
    NewsList,
    SourcesManager,
    StatsPanel
  },
  setup() {
    const activeTab = ref('news')

    return {
      activeTab
    }
  }
}
</script>

<style scoped>
.header {
  background: white;
  border-bottom: 1px solid #e5e5e5;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.header h1 {
  color: #333;
  margin-bottom: 1rem;
  font-size: 1.5rem;
  text-align: center;
}

.header nav {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  flex-wrap: wrap;
}

.header button {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.9rem;
  min-width: 80px;
}

.header button:hover {
  background: #f0f0f0;
}

.header button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.main {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .header {
    padding: 0.75rem;
  }
  
  .header h1 {
    font-size: 1.3rem;
    margin-bottom: 0.75rem;
  }
  
  .header nav {
    gap: 0.25rem;
  }
  
  .header button {
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    flex: 1;
    min-width: 70px;
  }
  
  .main {
    padding: 0.75rem;
  }
}

@media (max-width: 480px) {
  .header nav {
    flex-direction: column;
  }
  
  .header button {
    flex: none;
    width: 100%;
  }
}
</style>