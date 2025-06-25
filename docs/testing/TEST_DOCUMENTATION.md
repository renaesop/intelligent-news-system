# 智能新闻推荐系统 - 测试文档

## 📋 测试概览

本文档记录了为智能新闻推荐系统实施的全面测试用例，特别是新的召回-排序两阶段架构和SQLite缓存机制。

## 🧪 测试套件结构

### 1. 核心API测试 (`tests/api.test.js`)
**涵盖范围**: 基础API端点功能
- ✅ 推荐文章获取
- ✅ RSS源获取和新增
- ✅ 用户反馈处理
- ✅ 系统统计信息
- ✅ 错误处理和边界情况

**关键测试用例**:
```javascript
// 推荐文章API测试
test('should return recommended articles', async () => {
  const mockArticles = [
    { id: 1, title: 'Test Article', score: 0.8 }
  ];
  // 验证返回格式和数据完整性
});

// 用户反馈验证
test('should validate action parameter', async () => {
  // 确保只接受 'like' 和 'dislike' 动作
});
```

### 2. 集成测试 (`tests/integration.test.js`)
**涵盖范围**: 完整用户交互流程
- ✅ 端到端用户体验流程
- ✅ 多API调用协调
- ✅ 性能基准测试
- ✅ 并发请求处理

**关键场景**:
- 用户获取推荐 → 提供反馈 → 获取更新推荐
- 错误恢复和优雅降级
- API响应时间验证

### 3. 召回-排序系统测试 (`tests/recall-ranking.test.js`)
**涵盖范围**: 新推荐架构的核心功能

#### 3.1 SQLite缓存操作
```javascript
// 缓存写入测试
test('should cache recommendations in SQLite', async () => {
  const result = await RecallRankingService.cacheRecommendations(
    'test-key', 'user-123', recommendations, options
  );
  expect(result).toBe(true);
});

// 缓存读取测试
test('should retrieve cached recommendations', async () => {
  const result = await RecallRankingService.getCachedRecommendations('test-key');
  expect(result).toEqual(expectedData);
});
```

#### 3.2 多路召回策略
- **向量召回**: 基于语义相似度
- **标签召回**: 基于用户兴趣标签
- **协同过滤**: 基于相似用户行为
- **热门召回**: 基于全局热度

```javascript
test('should perform vector recall', async () => {
  const result = await RecallRankingService.vectorRecall('user-123', 10);
  expect(result[0]).toMatchObject({
    id: expect.any(Number),
    similarity_score: expect.any(Number)
  });
});
```

#### 3.3 混合排序算法
```javascript
test('should calculate relevance scores', async () => {
  const scores = await RecallRankingService.calculateRankingScores('user-123', article);
  // 验证所有分数都在0-1范围内
  expect(scores.relevance).toBeGreaterThanOrEqual(0);
  expect(scores.relevance).toBeLessThanOrEqual(1);
});
```

### 4. 向量服务测试 (`tests/vector-service.test.js`)
**涵盖范围**: 向量生成和相似度计算

#### 4.1 Embedding生成
```javascript
test('should generate embeddings successfully', async () => {
  const result = await vectorService.generateEmbedding('test text');
  expect(result).toHaveLength(1536);
});
```

#### 4.2 相似度计算
```javascript
test('should calculate cosine similarity correctly', () => {
  const similarity = vectorService.cosineSimilarity([1,0,0], [0,1,0]);
  expect(similarity).toBe(0); // 正交向量
});
```

#### 4.3 个性化推荐
```javascript
test('should generate personalized recommendations', async () => {
  const results = await vectorService.getPersonalizedRecommendations('user-123', 10);
  expect(results[0].similarity_score).toBeGreaterThan(results[1].similarity_score);
});
```

### 5. 性能测试 (`tests/performance.test.js`)
**涵盖范围**: 系统性能和负载测试

#### 5.1 并发性能
```javascript
test('should handle concurrent recommendation requests', async () => {
  const promises = Array.from({ length: 10 }, () => requestRecommendations());
  const responses = await Promise.all(promises);
  expect(totalTime).toBeLessThan(1000); // 1秒内完成
});
```

#### 5.2 缓存性能
```javascript
test('should benefit from caching on repeated requests', async () => {
  // 第一次请求 - 慢 (200ms)
  // 第二次请求 - 快 (10ms，来自缓存)
  expect(time2).toBeLessThan(time1);
});
```

#### 5.3 内存管理
```javascript
test('should handle memory efficiently with large datasets', async () => {
  // 处理大量数据后检查内存增长
  expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // <100MB
});
```

### 6. 边界情况测试 (`tests/edge-cases.test.js`)
**涵盖范围**: 异常情况和边界条件

#### 6.1 数据库异常
```javascript
test('should handle database connection failures gracefully', async () => {
  mockDb.get.mockImplementation((sql, params, callback) => {
    callback(new Error('SQLITE_BUSY: database is locked'));
  });
  const result = await getCachedRecommendations('test-key');
  expect(result).toBeNull(); // 优雅降级
});
```

#### 6.2 输入验证
```javascript
test('should handle special characters in user IDs', async () => {
  const specialUserIds = ['user@#$%', 'user🚀with🔥emojis'];
  // 确保特殊字符不会破坏系统
});
```

#### 6.3 国际化支持
```javascript
test('should handle articles in different languages', async () => {
  const multiLangArticles = [
    { title: '人工智能的未来', description: '中文文章' },
    { title: 'الذكاء الاصطناعي', description: 'مقال عربي' }
  ];
  // 验证多语言内容处理
});
```

## 🎯 测试运行指南

### 运行所有测试
```bash
npm test
```

### 运行特定测试套件
```bash
# 召回-排序系统测试
npm run test:recall

# 向量服务测试
npm run test:vector

# 性能测试
npm run test:performance

# 边界情况测试
npm run test:edge-cases

# 完整测试套件
npm run test:all
```

### CI/CD测试
```bash
npm run test:ci
```

## 📊 测试覆盖率

当前测试覆盖率目标:
- **行覆盖率**: 80%+
- **函数覆盖率**: 75%+
- **分支覆盖率**: 70%+
- **语句覆盖率**: 80%+

### 覆盖率报告
```bash
npm run test:coverage
```

生成的报告位于 `coverage/` 目录。

## 🚀 性能基准

### 响应时间目标
- 单用户推荐: <150ms
- 10个并发用户: <500ms
- 缓存命中响应: <50ms
- 大页面(100条): <300ms
- 向量搜索: <200ms

### 缓存性能
- 缓存命中率: >70%
- 缓存写入延迟: <10ms
- 缓存过期清理: 自动后台执行

## 🔧 测试配置

### Jest配置 (`jest.config.js`)
```javascript
module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  },
  maxWorkers: '50%'
};
```

### 测试执行顺序
通过 `tests/testSequencer.js` 优化测试执行顺序:
1. 基础API测试
2. 集成测试
3. 向量服务测试
4. 召回-排序测试
5. 边界情况测试
6. 性能测试 (最后执行)

## 🐛 常见测试问题

### 1. OpenAI API Mock问题
**问题**: `TypeError: OpenAI is not a constructor`
**解决**: 确保在服务导入前正确mock OpenAI构造函数

### 2. 数据库Mock问题
**问题**: SQLite操作在测试中失败
**解决**: 使用完整的数据库mock，包括所有回调参数

### 3. 异步测试超时
**问题**: 长时间运行的测试超时
**解决**: 增加 `testTimeout` 或优化测试逻辑

## 📝 测试最佳实践

### 1. 测试隔离
- 每个测试用例独立运行
- 使用 `beforeEach` 重置mock状态
- 避免测试间的依赖关系

### 2. Mock策略
- Mock外部依赖 (OpenAI, 数据库)
- 保持mock的真实性
- 测试错误场景和边界条件

### 3. 断言清晰
- 使用描述性的测试名称
- 验证关键属性而非整个对象
- 包含正面和负面测试用例

### 4. 性能考虑
- 避免在测试中进行真实的API调用
- 使用合适的延迟模拟
- 监控测试执行时间

## 🔄 持续改进

### 测试维护
- 定期更新测试用例
- 监控测试覆盖率变化
- 添加新功能的测试用例

### 性能监控
- 定期运行性能基准测试
- 监控响应时间变化
- 优化慢速测试用例

### 错误处理
- 添加更多边界条件测试
- 验证错误恢复机制
- 测试降级策略

## 🎉 总结

新增的测试套件全面覆盖了召回-排序推荐系统的各个方面:

✅ **SQLite缓存机制**: 完整的CRUD操作和性能测试  
✅ **多路召回策略**: 向量、标签、协同、热门召回  
✅ **混合排序算法**: 相关度、兴趣度、多样性、新鲜度  
✅ **分页一致性**: 缓存基础的分页机制  
✅ **性能优化**: 并发处理和响应时间优化  
✅ **边界情况**: 异常处理和数据验证  
✅ **国际化**: 多语言内容支持

这些测试确保系统的稳定性、性能和可靠性，为生产环境部署提供了充分的验证。