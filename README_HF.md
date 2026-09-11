---
title: LongH AI Workbench
emoji: 🚀
colorFrom: blue
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# LongH AI Workbench

AI 内容创作工作台 - 全栈应用（Express + React + Turso）

## 环境变量

在 Space Settings → Variables and secrets 中设置以下变量：

| Key | Value |
|-----|-------|
| PORT | 7860 |
| NODE_ENV | production |
| JWT_SECRET | longh-ai-workbench-jwt-secret-2024 |
| TURSO_DATABASE_URL | libsql://workbench-longh-ai.aws-ap-northeast-1.turso.io |
| TURSO_AUTH_TOKEN | (your Turso auth token) |
| UPLOAD_DIR | /app/server/uploads |
