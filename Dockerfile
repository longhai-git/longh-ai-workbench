# ==========================================================================
# LongH AI Workbench - 多阶段构建 Dockerfile (兼容 Render/Koyeb/HF Spaces)
# ==========================================================================

# --- 阶段1: 构建前端 ---
FROM node:20-slim AS frontend-builder

WORKDIR /app/client

# 复制前端 package 文件并安装依赖
COPY client/package.json client/package-lock.json* ./
RUN npm ci --production=false || npm install

# 复制前端源码并构建
COPY client/ ./
RUN npm run build

# --- 阶段2: 构建后端 ---
FROM node:20-slim AS backend-builder

WORKDIR /app/server

# 安装编译依赖（libsql 需要）
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# 复制后端 package 文件并安装依赖
COPY server/package.json server/package-lock.json* ./
RUN npm ci --production || npm install --production

# --- 阶段3: 生产环境镜像 ---
FROM node:20-slim AS production

WORKDIR /app

# 安装运行时依赖
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

# 创建非 root 用户（Hugging Face Spaces 要求，也提升安全性）
RUN useradd -m -u 1000 appuser

# 复制后端依赖
COPY --from=backend-builder /app/server/node_modules ./server/node_modules

# 复制后端源码
COPY server/ ./server/

# 复制前端构建产物
COPY --from=frontend-builder /app/client/dist ./client/dist

# 创建上传目录并设置权限
RUN mkdir -p /app/server/uploads /app/server/data && \
    chown -R appuser:appuser /app

# 设置环境变量（PORT 可在运行时覆盖，HF Spaces 需设为 7860）
ENV NODE_ENV=production
ENV PORT=3001
ENV UPLOAD_DIR=/app/server/uploads

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 3001 7860

# 健康检查（使用动态端口）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const p=process.env.PORT||3001;fetch('http://localhost:'+p+'/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# 启动命令
WORKDIR /app/server
CMD ["node", "server.js"]
