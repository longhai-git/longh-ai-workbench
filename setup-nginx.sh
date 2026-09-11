#!/bin/bash
# ==========================================================================
# Nginx 反向代理 + HTTPS 配置脚本
# ==========================================================================
# 使用方法：bash setup-nginx.sh
# 前提：域名 longhaicm.cn 已解析到服务器IP
# ==========================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Nginx + HTTPS 配置${NC}"
echo -e "${BLUE}========================================${NC}"

# 1. 安装 Nginx
echo -e "\n${GREEN}[1/4] 安装 Nginx...${NC}"
if command -v nginx &> /dev/null; then
  echo "Nginx 已安装"
else
  apt-get update -qq
  apt-get install -y -qq nginx
  echo "Nginx 安装完成"
fi

# 2. 配置 Nginx 反向代理
echo -e "\n${GREEN}[2/4] 配置 Nginx 反向代理...${NC}"
cat > /etc/nginx/conf.d/longh-ai-workbench.conf << 'EOF'
server {
    listen 80;
    server_name longhaicm.cn www.longhaicm.cn;

    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 删除默认配置（如果冲突）
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# 测试并重启 Nginx
nginx -t && systemctl restart nginx
echo "Nginx 配置完成"

# 3. 安装 Certbot 并申请 HTTPS 证书
echo -e "\n${GREEN}[3/4] 申请 HTTPS 证书...${NC}"
if command -v certbot &> /dev/null; then
  echo "Certbot 已安装"
else
  apt-get install -y -qq certbot python3-certbot-nginx
  echo "Certbot 安装完成"
fi

# 申请证书
echo "正在申请 Let's Encrypt 证书..."
certbot --nginx -d longhaicm.cn -d www.longhaicm.cn --non-interactive --agree-tos --register-unsafely-without-email --redirect || {
  echo -e "${YELLOW}证书申请失败，请检查：${NC}"
  echo "1. 域名 longhaicm.cn 是否已解析到服务器IP"
  echo "2. 80 端口是否在安全组中放行"
  echo "3. 手动执行: certbot --nginx -d longhaicm.cn"
}

# 4. 验证
echo -e "\n${GREEN}[4/4] 验证配置...${NC}"
echo -e "${GREEN}Nginx 状态: $(systemctl is-active nginx)${NC}"

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}  HTTPS 配置完成！${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "访问地址："
echo -e "  https://longhaicm.cn"
echo ""
echo -e "证书自动续期已配置，无需手动操作。"
