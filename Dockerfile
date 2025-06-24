# 智能新闻推荐系统 Docker 配置
FROM node:20-alpine AS builder

LABEL maintainer="Claude Code <noreply@anthropic.com>"
LABEL description="智能新闻推荐系统 - AI驱动的个性化新闻推荐"

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 复制源代码
COPY . .

# 构建前端
RUN npm run build

# 生产环境镜像
FROM node:20-alpine AS production

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 只安装生产依赖
RUN npm ci --only=production && npm cache clean --force

# 复制构建产物和服务端代码
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/server.js .
COPY --from=builder --chown=nodejs:nodejs /app/scheduler.js .
COPY --from=builder --chown=nodejs:nodejs /app/config ./config
COPY --from=builder --chown=nodejs:nodejs /app/db ./db
COPY --from=builder --chown=nodejs:nodejs /app/services ./services

# 创建数据目录
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

# 切换到非root用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/stats', (res) => { \
    process.exit(res.statusCode === 200 ? 0 : 1) \
  }).on('error', () => process.exit(1))"

# 启动应用
CMD ["node", "server.js"]