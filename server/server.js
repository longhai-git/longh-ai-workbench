import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// 加载环境变量
import dotenv from 'dotenv';
dotenv.config();

import './db.js'; // 初始化数据库

import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import contentRoutes from './routes/content.js';
import featureRoutes from './routes/features.js';
import apiRoutes from './routes/api.js';
import douyinRoutes from './routes/douyin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 确保uploads目录存在（支持环境变量配置）
const uploadsDir = process.env.UPLOAD_DIR
  ? (path.isAbsolute(process.env.UPLOAD_DIR) ? process.env.UPLOAD_DIR : path.join(__dirname, process.env.UPLOAD_DIR))
  : path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 静态文件服务 - 上传的文件
app.use('/uploads', express.static(uploadsDir));

// 静态文件服务 - 前端构建产物
const clientDist = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// 健康检查（必须在带auth的路由之前注册）
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API路由（注意：douyin路由的callback不需要鉴权，必须在auth中间件之前注册）
app.use('/api/auth', authRoutes);
app.use('/api/douyin', douyinRoutes); // /api/douyin/callback（公开回调）, /api/douyin/authorize 等
app.use('/api/projects', projectRoutes);
app.use('/api', contentRoutes);    // /api/agents, /api/skills, /api/topics 等
app.use('/api', featureRoutes);    // /api/benchmarks, /api/knowledge, /api/messages 等
app.use('/api', apiRoutes);        // /api/dashboard, /api/pomodoro 等

// 前端路由回退
if (fs.existsSync(clientDist)) {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return;
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// 错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  // multer 文件大小超限
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: '文件大小不能超过5MB' });
  }
  // multer 文件格式错误
  if (err.message && err.message.includes('只支持')) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// === 全局异常捕获，防止进程意外退出 ===
process.on('uncaughtException', (err) => {
  console.error('【未捕获异常】', err.message, err.stack);
  // 记录后继续运行，不让进程崩溃
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('【未处理的Promise拒绝】', reason);
  // 记录后继续运行
});

process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在优雅退出...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n收到 SIGINT 信号，正在退出...');
  process.exit(0);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════╗
║  LongH AI Workbench Server                   ║
║  Version: 2.1.0                              ║
║  Port: ${PORT}                                 ║
║  Status: Running                              ║
╚══════════════════════════════════════════════╝
  `);
});

export default app;
