#!/bin/bash
# ==========================================================================
# LongH AI Workbench - 阿里云服务器一键部署脚本
# ==========================================================================
# 使用方法：
#   1. 登录阿里云控制台 → 轻量应用服务器 → 远程连接
#   2. 复制本脚本全部内容粘贴到终端执行
#   3. 等待部署完成
# ==========================================================================

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  LongH AI Workbench 一键部署${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
  echo -e "${YELLOW}请使用 root 用户执行：sudo bash deploy.sh${NC}"
  exit 1
fi

# 1. 安装 Docker
echo -e "\n${GREEN}[1/6] 安装 Docker...${NC}"
if command -v docker &> /dev/null; then
  echo "Docker 已安装，跳过"
else
  curl -fsSL https://get.docker.com | bash
  systemctl enable docker
  systemctl start docker
  echo "Docker 安装完成"
fi

# 2. 安装 Docker Compose
echo -e "\n${GREEN}[2/6] 安装 Docker Compose...${NC}"
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
  echo "Docker Compose 已安装，跳过"
else
  curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
  echo "Docker Compose 安装完成"
fi

# 3. 克隆代码
echo -e "\n${GREEN}[3/6] 拉取代码...${NC}"
DEPLOY_DIR=/opt/longh-ai-workbench
mkdir -p $DEPLOY_DIR
cd $DEPLOY_DIR

if [ -d ".git" ]; then
  echo "代码目录已存在，更新中..."
  git pull || true
else
  git clone https://github.com/longhai-git/longh-ai-workbench.git .
fi

# 4. 创建 docker-compose.yml
echo -e "\n${GREEN}[4/6] 创建部署配置...${NC}"
cat > $DEPLOY_DIR/docker-compose.yml << 'EOF'
version: '3.8'

services:
  workbench:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: longh-ai-workbench
    restart: always
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - JWT_SECRET=longh-ai-workbench-jwt-secret-2024
      - TURSO_DATABASE_URL=libsql://workbench-longh-ai.aws-ap-northeast-1.turso.io
      - TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODkxMDYxNzEsImlkIjoiMDFhMDhmMDktNDIwMS03NzFlLWE4NDgtYTdjYzA4YjNjNGM1Iiwia2lkIjoidlJDemg0QUhFODFPZWMyWWI4RGQ3Sk9qblVYX0pCZk1CTEY2NGZ0YnkxZyIsInJpZCI6IjVjNThjNzM3LTM4NGQtNGE1ZS1iOWVmLTNkYWJmODVjNTc0OCJ9.LKvY5HCEznFv7swMsTxMMwvKJ6NR0UGjUpydb43B30ctMKg012sko_HOc4YSHyvtJsfDfFxlBXvcRjMkn_ipBA
      - UPLOAD_DIR=/app/server/uploads
    volumes:
      - uploads:/app/server/uploads
      - data:/app/server/data
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3001/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

volumes:
  uploads:
  data:
EOF

# 5. 构建并启动
echo -e "\n${GREEN}[5/6] 构建并启动服务（需要3-5分钟）...${NC}"
cd $DEPLOY_DIR
docker compose up -d --build

# 等待服务启动
echo -e "\n${GREEN}等待服务启动...${NC}"
sleep 10

# 6. 验证服务
echo -e "\n${GREEN}[6/6] 验证服务...${NC}"
for i in $(seq 1 30); do
  if curl -s http://localhost:3001/api/health | grep -q "ok\|healthy\|200"; then
    echo -e "${GREEN}服务启动成功！${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${YELLOW}服务可能还在启动中，请稍后访问测试${NC}"
  fi
  echo "等待中... ($i/30)"
  sleep 5
done

# 输出结果
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "访问地址："
echo -e "  http://${SERVER_IP}:3001"
echo -e "  http://longhaicm.cn:3001"
echo ""
echo -e "默认登录："
echo -e "  用户名: admin"
echo -e "  密码:   admin123"
echo ""
echo -e "管理命令："
echo -e "  查看日志:   cd $DEPLOY_DIR && docker compose logs -f"
echo -e "  重启服务:   cd $DEPLOY_DIR && docker compose restart"
echo -e "  停止服务:   cd $DEPLOY_DIR && docker compose down"
echo ""
echo -e "${YELLOW}请首次登录后立即修改密码！${NC}"
