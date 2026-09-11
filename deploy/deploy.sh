#!/bin/bash
# ==========================================================================
# LongH AI Workbench - 一键部署脚本
# 支持两种模式: Docker / PM2
# ==========================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_MODE="${1:-docker}"

log() { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +'%H:%M:%S')] $1${NC}"; }
error() { echo -e "${RED}[$(date +'%H:%M:%S')] ERROR: $1${NC}"; exit 1; }

# ==========================================================================
# Docker 部署
# ==========================================================================
deploy_docker() {
  log "使用 Docker 模式部署..."

  # 检查 Docker
  if ! command -v docker &> /dev/null; then
    error "Docker 未安装，请先安装 Docker: https://docs.docker.com/get-docker/"
  fi

  # 检查 Docker Compose
  if ! docker compose version &> /dev/null && ! docker-compose version &> /dev/null; then
    error "Docker Compose 未安装"
  fi

  # 检查 .env 文件
  if [ ! -f "$PROJECT_DIR/.env" ]; then
    log "创建 .env 配置文件..."
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    warn "请编辑 .env 文件修改 JWT_SECRET 和 API Key 后重新运行此脚本"
    warn "  vi $PROJECT_DIR/.env"
    exit 1
  fi

  # 检查 JWT_SECRET 是否已修改
  if grep -q "change-this-to-a-random" "$PROJECT_DIR/.env"; then
    warn "请先修改 .env 中的 JWT_SECRET 为随机字符串"
    warn "  生成命令: openssl rand -hex 32"
    exit 1
  fi

  cd "$PROJECT_DIR"

  log "构建并启动容器..."
  if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    docker compose up -d --build
  else
    docker-compose up -d --build
  fi

  log "等待服务启动..."
  sleep 5

  # 健康检查
  for i in $(seq 1 12); do
    if curl -s http://localhost:${PORT:-3001}/api/health | grep -q "ok" 2>/dev/null; then
      log "服务启动成功！"
      log "访问地址: http://localhost:${PORT:-3001}"
      log "容器状态: docker compose ps"
      log "查看日志: docker compose logs -f"
      exit 0
    fi
    sleep 2
  done

  error "服务启动超时，请检查日志: docker compose logs"
}

# ==========================================================================
# PM2 部署 (非 Docker)
# ==========================================================================
deploy_pm2() {
  log "使用 PM2 模式部署..."

  # 检查 Node.js
  if ! command -v node &> /dev/null; then
    error "Node.js 未安装，请先安装 Node.js 18+"
  fi

  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js 版本需要 18+，当前版本: $(node -v)"
  fi

  # 安装 PM2
  if ! command -v pm2 &> /dev/null; then
    log "安装 PM2..."
    npm install -g pm2
  fi

  # 检查 .env
  if [ ! -f "$PROJECT_DIR/.env" ]; then
    log "创建 .env 配置文件..."
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
    warn "请编辑 .env 文件修改 JWT_SECRET 和 API Key 后重新运行此脚本"
    exit 1
  fi

  if grep -q "change-this-to-a-random" "$PROJECT_DIR/.env"; then
    warn "请先修改 .env 中的 JWT_SECRET"
    exit 1
  fi

  cd "$PROJECT_DIR"

  # 创建必要目录
  mkdir -p server/data server/uploads logs

  # 安装后端依赖
  log "安装后端依赖..."
  cd server
  if [ -f package-lock.json ]; then
    npm ci --production || npm install --production
  else
    npm install --production
  fi

  # 构建前端
  log "构建前端..."
  cd "$PROJECT_DIR/client"
  if [ -f package-lock.json ]; then
    npm ci || npm install
  else
    npm install
  fi
  npm run build

  # 启动 PM2
  log "启动 PM2 服务..."
  cd "$PROJECT_DIR"
  pm2 delete longh-workbench 2>/dev/null || true
  pm2 start deploy/ecosystem.config.cjs --env production

  pm2 save
  log "PM2 服务已启动！"
  log "访问地址: http://localhost:${PORT:-3001}"
  log "状态: pm2 status"
  log "日志: pm2 logs longh-workbench"
  log ""
  log "设置开机自启: pm2 startup && pm2 save"
}

# ==========================================================================
# 主入口
# ==========================================================================
case "$DEPLOY_MODE" in
  docker|Docker)
    deploy_docker
    ;;
  pm2|PM2)
    deploy_pm2
    ;;
  *)
    echo "用法: $0 {docker|pm2}"
    echo "  docker - 使用 Docker Compose 部署（推荐）"
    echo "  pm2    - 使用 PM2 直接部署（无需 Docker）"
    exit 1
    ;;
esac
