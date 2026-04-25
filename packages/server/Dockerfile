# 构建命令（从 twinum/ 根目录执行）：
#   docker build -f packages/server/Dockerfile -t twinum-server .
#
# 使用 tsx 直接运行 TypeScript 源码（与开发模式一致）
# 这样避免了 monorepo CJS/ESM 路径解析问题，生产机器仍只跑 Node.js
FROM node:20-alpine

WORKDIR /app

# 复制 monorepo 根配置
COPY package.json package-lock.json ./

# 复制所有 packages（含 @twinum/shared 和 @twinum/server）
COPY packages/ ./packages/

# 安装全部依赖（含 devDependencies，因为需要 tsx）
RUN npm ci --ignore-scripts

EXPOSE 2567

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:2567/health || exit 1

# 直接用 tsx 运行源码，指定 server tsconfig（处理 emitDecoratorMetadata）
CMD ["node_modules/.bin/tsx", "--tsconfig", "packages/server/tsconfig.json", "packages/server/src/index.ts"]
