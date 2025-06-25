# 智能新闻推荐系统 - 测试文档

## 📋 测试架构概览

本文档记录了智能新闻推荐系统的完整测试架构，采用分层测试策略确保系统的可靠性和性能。

## 🏗️ 测试目录结构

```
tests/
├── unit/                    # 单元测试
│   ├── services/           # 服务层单元测试
│   │   ├── vectorService.test.js        # 向量服务测试
│   │   └── recallRankingService.test.js # 召回排序服务测试
│   └── edge-cases.test.js  # 边界情况和错误处理测试
├── integration/            # 集成测试
│   ├── api/               # API集成测试
│   │   └── api.test.js    # REST API端点测试
│   └── workflows/         # 工作流集成测试
│       └── userJourney.test.js # 用户完整交互流程测试
├── performance/           # 性能测试
│   └── performance.test.js # 系统性能和负载测试
├── fixtures/              # 测试数据
│   └── testData.js        # 标准化测试数据集
├── helpers/               # 测试工具
│   ├── mockFactories.js   # Mock对象工厂
│   └── testServer.js      # 测试服务器工具
├── scripts/               # 测试脚本
│   ├── test-runner.js     # 主测试运行器
│   ├── test-recall-ranking.js # 召回排序专项测试
│   └── test-vector.js     # 向量功能专项测试
└── setup/                 # 测试配置
    ├── globalSetup.js     # 全局测试环境设置
    └── testSequencer.js   # 测试执行顺序控制
```

## 🚀 快速开始

### 运行所有测试
```bash
npm run test:all
# 或者
node tests/scripts/test-runner.js
```

### 运行特定测试套件
```bash
# 单元测试
npm run test:unit

# 集成测试  
npm run test:integration

# 性能测试
npm run test:performance
```

### 专项测试脚本
```bash
# 召回排序系统专项测试
npm run test:recall

# 向量搜索功能专项测试
npm run test:vector
```

## 📊 测试套件详情

### 1. 单元测试 (Unit Tests)
**目标**: 测试独立组件和服务的功能正确性

#### 1.1 向量服务测试 (`tests/unit/services/vectorService.test.js`)
- ✅ OpenAI嵌入生成
- ✅ 余弦相似度计算
- ✅ 文章向量存储和检索
- ✅ 用户偏好向量构建
- ✅ 个性化推荐生成

#### 1.2 召回排序服务测试 (`tests/unit/services/recallRankingService.test.js`)
- ✅ SQLite缓存操作 (读写、过期、并发)
- ✅ 多通道召回 (向量、标签、协同、热门)
- ✅ 混合排序算法 (相关性、新鲜度、多样性)
- ✅ 推荐解释生成
- ✅ 分页一致性

#### 1.3 边界情况测试 (`tests/unit/edge-cases.test.js`)
- ✅ 数据库连接异常处理
- ✅ 无效输入验证
- ✅ 数据损坏恢复
- ✅ 内存限制处理
- ✅ 并发访问控制
- ✅ 国际化支持

### 2. 集成测试 (Integration Tests)
**目标**: 验证组件间协作和端到端功能

#### 2.1 API集成测试 (`tests/integration/api/api.test.js`)
- ✅ GET /api/articles/recommended - 推荐文章获取
- ✅ POST /api/articles/fetch - RSS源抓取
- ✅ POST /api/articles/:id/feedback - 用户反馈处理
- ✅ GET /api/sources - RSS源管理
- ✅ POST /api/sources - 添加新RSS源
- ✅ GET /api/stats - 系统统计信息

#### 2.2 用户流程测试 (`tests/integration/workflows/userJourney.test.js`)
- ✅ 完整用户交互流程
- ✅ 多API调用协调
- ✅ 错误恢复机制
- ✅ 响应格式验证

### 3. 性能测试 (Performance Tests)
**目标**: 验证系统性能指标和扩展性

#### 3.1 系统性能测试 (`tests/performance/performance.test.js`)
- ✅ 并发推荐请求处理 (10+ 并发用户)
- ✅ 缓存性能优化验证 (首次 vs 缓存请求)
- ✅ 大数据集处理 (1000+ 文章)
- ✅ 向量搜索性能 (< 200ms)
- ✅ 内存使用监控
- ✅ 负载测试场景

## 🔧 测试工具和辅助功能

### Mock工厂 (`tests/helpers/mockFactories.js`)
提供标准化的Mock对象创建：
- `mockArticle()` - 文章对象Mock
- `mockUser()` - 用户对象Mock
- `mockDatabase()` - 数据库Mock
- `mockVectorService()` - 向量服务Mock

### 测试数据 (`tests/fixtures/testData.js`)
预定义的测试数据集：
- `testArticles` - 标准测试文章集
- `testUsers` - 测试用户数据
- `testVectors` - 向量测试数据

### 测试服务器 (`tests/helpers/testServer.js`)
快速创建测试用Express应用的工具函数。

## 📈 测试覆盖率

目标覆盖率指标：
- **分支覆盖率**: 70%+
- **函数覆盖率**: 75%+
- **行覆盖率**: 80%+
- **语句覆盖率**: 80%+

查看覆盖率报告：
```bash
npm run test:coverage
open coverage/index.html
```

## 🐛 测试调试

### 单独运行特定测试
```bash
# 运行特定测试文件
jest tests/unit/services/vectorService.test.js

# 运行特定测试用例
jest -t "should generate embedding"

# 调试模式
node --inspect-brk node_modules/.bin/jest tests/unit/services/vectorService.test.js
```

### 常见问题排查

1. **OpenAI API错误**: 检查 `.env` 文件中的 `OPENAI_API_KEY`
2. **数据库锁定**: 确保测试间正确清理数据库连接
3. **超时错误**: 调整 `jest.config.js` 中的 `testTimeout` 设置
4. **Mock问题**: 确保在 `beforeEach` 中重置所有Mock

## 📋 持续集成

### GitHub Actions配置
测试在以下情况自动运行：
- PR提交时
- 合并到主分支时
- 每日定时任务

### CI测试命令
```bash
npm run test:ci
```

## 🔄 测试维护

### 添加新测试
1. 确定测试类型（单元/集成/性能）
2. 选择合适的目录
3. 使用现有的Mock工厂和测试数据
4. 更新此文档

### 测试更新最佳实践
- 保持测试的独立性和可重复性
- 使用描述性的测试名称
- 及时更新测试以反映代码变更
- 定期检查和优化测试性能

---

## 📞 联系和支持

如有测试相关问题，请查看：
1. 测试输出日志
2. 本文档的故障排除部分
3. Jest官方文档
4. 项目issue tracker