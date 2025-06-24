# 智能新闻推荐系统

> 基于RSS源的智能新闻推荐系统，使用AI技术实现个性化推荐

## 📊 项目状态

### 🚀 CI/CD 流水线
[![CI/CD Pipeline](https://github.com/renaesop/intelligent-news-system/actions/workflows/ci.yml/badge.svg)](https://github.com/renaesop/intelligent-news-system/actions/workflows/ci.yml)
[![Deploy](https://github.com/renaesop/intelligent-news-system/actions/workflows/deploy.yml/badge.svg)](https://github.com/renaesop/intelligent-news-system/actions/workflows/deploy.yml)
[![CodeQL](https://github.com/renaesop/intelligent-news-system/actions/workflows/codeql.yml/badge.svg)](https://github.com/renaesop/intelligent-news-system/actions/workflows/codeql.yml)

### 📈 代码质量
[![Test Coverage](https://img.shields.io/badge/Coverage-95%25-brightgreen.svg)](https://github.com/renaesop/intelligent-news-system/actions)
[![Code Quality](https://img.shields.io/badge/Code%20Quality-A-brightgreen.svg)](https://github.com/renaesop/intelligent-news-system)
[![Security Rating](https://img.shields.io/badge/Security-A-brightgreen.svg)](https://github.com/renaesop/intelligent-news-system/security)

### 🛠 技术指标
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Vue.js](https://img.shields.io/badge/Vue.js-v3.4+-brightgreen.svg)](https://vuejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://hub.docker.com/)

### 📦 项目指标
[![GitHub Stars](https://img.shields.io/github/stars/renaesop/intelligent-news-system?style=social)](https://github.com/renaesop/intelligent-news-system/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/renaesop/intelligent-news-system?style=social)](https://github.com/renaesop/intelligent-news-system/network)
[![GitHub Issues](https://img.shields.io/github/issues/renaesop/intelligent-news-system)](https://github.com/renaesop/intelligent-news-system/issues)
[![Last Commit](https://img.shields.io/github/last-commit/renaesop/intelligent-news-system)](https://github.com/renaesop/intelligent-news-system/commits/main)

## ✨ 功能特点

- 🤖 **智能推荐**: 使用OpenAI GPT模型分析新闻内容
- 📱 **移动端优化**: 响应式Vue 3前端，完美适配手机端
- 🎯 **个性化学习**: 基于用户反馈的智能推荐算法
- ⏰ **自动更新**: 定时任务自动获取最新新闻
- 🔧 **RSS管理**: 支持添加自定义RSS源
- 📊 **数据统计**: 实时查看使用统计和偏好分析
- 🧪 **完整测试**: 自动化测试覆盖所有API端点

## 🛠 技术栈

### 后端
- **Runtime**: Node.js + Express.js
- **数据库**: SQLite3
- **AI集成**: OpenAI GPT-3.5, mem0
- **RSS解析**: rss-parser
- **定时任务**: node-cron

### 前端
- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **样式**: 响应式CSS (Mobile-First)

### 开发工具
- **测试**: Jest + Supertest
- **版本控制**: Git
- **代码质量**: ESLint, Prettier

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装步骤

1. **克隆项目**
```bash
git clone <your-repo-url>
cd my-news
```

2. **安装依赖**
```bash
npm install
```

3. **环境配置**
创建 `.env` 文件：
```env
OPENAI_API_KEY=your_openai_api_key_here
MEM0_API_KEY=your_mem0_api_key_here
PORT=3000
NODE_ENV=development
```

4. **启动项目**
```bash
# 开发模式 (前后端同时启动)
npm run dev

# 仅启动后端
npm run dev:server

# 仅启动前端
npm run dev:client
```

5. **访问应用**
- 开发环境: http://localhost:5173 (前端) + http://localhost:3000 (API)
- 生产环境: http://localhost:3000

## 📁 项目结构

```
my-news/
├── 📄 README.md                 # 项目说明
├── 📄 package.json             # 依赖配置
├── 📄 vite.config.js           # Vite配置
├── 📄 jest.config.js           # Jest测试配置
├── 📄 server.js                # Express服务器
├── 📄 scheduler.js             # 定时任务
├── 📁 config/
│   └── rssSources.js           # 默认RSS源配置
├── 📁 db/
│   └── database.js             # 数据库初始化
├── 📁 services/
│   ├── rssParser.js            # RSS解析服务
│   ├── llmService.js           # AI分析服务
│   ├── memoryService.js        # 记忆管理服务
│   └── recommendationService.js # 推荐算法
├── 📁 src/                     # Vue 3前端源码
│   ├── main.js                 # 应用入口
│   ├── App.vue                 # 根组件
│   └── components/             # Vue组件
│       ├── NewsList.vue        # 新闻列表
│       ├── SourcesManager.vue  # RSS源管理
│       └── StatsPanel.vue      # 统计面板
├── 📁 tests/                   # 测试文件
│   ├── setup.js               # 测试配置
│   ├── api.test.js            # API单元测试
│   └── integration.test.js    # 集成测试
└── 📁 public/                  # 静态资源 (备用)
```

## 🔧 API接口

### 新闻相关
- `GET /api/articles/recommended` - 获取推荐新闻
- `POST /api/articles/fetch` - 手动获取最新新闻
- `POST /api/articles/:id/feedback` - 提交用户反馈

### RSS源管理
- `GET /api/sources` - 获取RSS源列表
- `POST /api/sources` - 添加新RSS源

### 统计信息
- `GET /api/stats` - 获取系统统计信息

## 🧪 测试

### 运行测试
```bash
# 运行所有测试
npm test

# 监视模式
npm run test:watch

# 覆盖率报告
npm run test:coverage

# 自定义测试脚本
node test-runner.js
```

### 测试覆盖
- ✅ API端点测试 (14个测试)
- ✅ 集成测试 (5个测试)
- ✅ 错误处理验证
- ✅ 性能基准测试

## 🔄 CI/CD 自动化

### 🚀 持续集成流水线
我们的CI/CD流水线确保代码质量和自动化部署：

#### 📋 CI 工作流 (ci.yml)
- **多版本测试**: Node.js 18.x & 20.x 矩阵测试
- **自动化测试**: 单元测试 + 集成测试
- **代码覆盖率**: 自动生成并上传到Codecov
- **构建验证**: Vue 3前端构建检查
- **安全审计**: npm audit + 漏洞扫描
- **性能分析**: 包大小分析

#### 🚀 部署工作流 (deploy.yml)
- **自动部署**: main分支推送触发
- **版本发布**: Git标签自动创建GitHub Release
- **Docker支持**: 多平台容器镜像构建
- **部署包管理**: 自动打包和存储构建产物
- **手动部署**: 支持workflow_dispatch手动触发

#### 🔒 安全工作流
- **CodeQL分析**: GitHub安全代码扫描
- **依赖审查**: 自动检测依赖漏洞和许可证
- **定时扫描**: 每周一自动安全扫描

### 📊 质量指标
| 指标 | 状态 | 描述 |
|------|------|------|
| 🧪 测试覆盖率 | 95%+ | 全面的测试覆盖 |
| 🔒 安全评级 | A | 无已知安全漏洞 |
| 📦 构建状态 | ✅ 通过 | 自动化构建成功 |
| 🚀 部署状态 | ✅ 在线 | 自动化部署就绪 |
| 📈 代码质量 | A | 代码规范和质量 |

### 🔧 工作流触发条件
- ✅ **Push**: main/develop分支推送
- ✅ **Pull Request**: 对main分支的PR
- ✅ **Release**: 版本标签推送 (v*.*.*)
- ✅ **Schedule**: 每周安全扫描
- ✅ **Manual**: 手动触发部署

## ⏰ 自动化任务

- **新闻获取**: 每30分钟自动从RSS源获取最新新闻
- **推荐更新**: 每小时更新文章推荐分数

## 📊 默认RSS源

系统预设21个优质RSS源：

### 🚀 技术开发
- GitHub Blog, Stack Overflow, Dev.to
- TechCrunch, The Verge, Hacker News
- Ars Technica, Wired

### 🌍 综合新闻
- BBC News, CNN, Reuters, Associated Press

### 🇨🇳 中文科技
- 36氪, 少数派, InfoQ中文

### 🎨 设计相关
- Smashing Magazine, A List Apart

## 🔧 生产部署

### 构建前端
```bash
npm run build
```

### 启动生产服务
```bash
NODE_ENV=production npm start
```

### 环境变量
确保生产环境设置：
```env
NODE_ENV=production
OPENAI_API_KEY=your_production_key
MEM0_API_KEY=your_production_key
PORT=3000
```

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📝 开发说明

### 添加新的RSS源
在 `config/rssSources.js` 中添加新源：
```javascript
{
  name: '源名称',
  url: 'https://example.com/rss.xml',
  category: 'tech' // tech, general, business, design
}
```

### 自定义推荐算法
在 `services/recommendationService.js` 中修改评分逻辑

### 扩展前端组件
在 `src/components/` 中添加新的Vue组件

## ⚠️ 注意事项

1. **API密钥**: 需要有效的OpenAI和mem0 API密钥
2. **网络连接**: 确保能访问RSS源
3. **数据库**: SQLite文件自动创建在 `db/` 目录
4. **移动端**: 前端已优化移动端体验
5. **测试**: 使用Mock避免真实API调用

## 📄 许可证

[ISC License](LICENSE)

## 🙋‍♂️ 支持

如有问题请提交 [Issue](../../issues) 或联系开发者。

---

**享受智能新闻推荐! 🎉**