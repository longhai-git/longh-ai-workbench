# LongH AI Workbench 部署指南

## 部署方式

| 方式 | 适用场景 | 优势 |
|------|---------|------|
| Docker | 有 Docker 环境的服务器 | 环境隔离、一键部署、便于迁移 |
| PM2 | VPS/云服务器 | 轻量、无需 Docker、直接运行 |

---

## 一、Docker 部署（推荐）

### 1. 前置条件
- 服务器已安装 Docker 和 Docker Compose
- 已有服务器 SSH 访问权限

### 2. 部署步骤

```bash
# 克隆项目到服务器
git clone <your-repo-url> /opt/workbench
cd /opt/workbench

# 复制配置文件并修改
cp .env.example .env
vi .env  # 修改 JWT_SECRET 和 ARK_API_KEY

# 一键部署
./deploy/deploy.sh docker

# 或手动执行
docker compose up -d --build
```

### 3. 常用命令

```bash
# 查看状态
docker compose ps

# 查看日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新代码后重新部署
git pull && docker compose up -d --build
```

---

## 二、PM2 部署（非 Docker）

### 1. 前置条件
- Node.js 18+
- npm 或 pnpm

### 2. 部署步骤

```bash
# 克隆项目
git clone <your-repo-url> /opt/workbench
cd /opt/workbench

# 复制配置文件
cp .env.example .env
vi .env  # 修改 JWT_SECRET 和 ARK_API_KEY

# 一键部署
./deploy/deploy.sh pm2

# 设置开机自启
pm2 startup
pm2 save
```

### 3. 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs longh-workbench

# 重启
pm2 restart longh-workbench

# 停止
pm2 stop longh-workbench
```

---

## 三、Nginx + HTTPS 配置

### 1. 安装 Nginx

```bash
# Ubuntu/Debian
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

### 2. 配置反向代理

```bash
# 复制配置文件
sudo cp deploy/nginx.conf /etc/nginx/sites-available/workbench.conf

# 修改域名
sudo vi /etc/nginx/sites-available/workbench.conf
# 将 your-domain.com 改为实际域名

# 启用站点
sudo ln -s /etc/nginx/sites-available/workbench.conf /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载
sudo systemctl reload nginx
```

### 3. 配置 HTTPS（Let's Encrypt 免费证书）

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 自动配置 SSL
sudo certbot --nginx -d your-domain.com

# 自动续期（已由 certbot 自动设置）
sudo certbot renew --dry-run
```

---

## 四、环境变量说明

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3001 |
| NODE_ENV | 运行环境 | production |
| JWT_SECRET | JWT 加密密钥 | **必须修改** |
| DB_PATH | SQLite 数据库路径 | ./server/data/workbench.db |
| UPLOAD_DIR | 上传文件目录 | ./server/uploads |
| ARK_API_KEY | 火山引擎 Ark API Key | - |
| ARK_MODEL_ENDPOINT | Ark 模型端点 | - |

---

## 五、数据备份

### Docker 模式
```bash
# 备份数据库和上传文件
docker compose exec workbench tar czf - /app/server/data /app/server/uploads > backup-$(date +%Y%m%d).tar.gz

# 恢复
docker compose cp backup-20260908.tar.gz workbench:/tmp/
docker compose exec workbench tar xzf /tmp/backup-20260908.tar.gz -C /
```

### PM2 模式
```bash
# 备份
tar czf backup-$(date +%Y%m%d).tar.gz server/data/ server/uploads/

# 恢复
tar xzf backup-20260908.tar.gz
```

---

## 六、故障排查

| 问题 | 解决方案 |
|------|---------|
| 端口被占用 | `lsof -i:3001` 查看占用进程，或修改 .env 中的 PORT |
| 数据库锁死 | 删除 `server/data/workbench.db-wal` 和 `workbench.db-shm` |
| 权限不足 | `chown -R $USER:$USER server/data server/uploads` |
| better-sqlite3 编译失败 | 安装编译依赖: `apt install python3 make g++` |
| Docker 构建慢 | 使用国内镜像加速: 配置 Docker daemon mirror |
| Nginx 502 | 检查后端是否运行: `curl http://localhost:3001/api/health` |
