// ==========================================================================
// PM2 配置文件 - LongH AI Workbench
// ==========================================================================
// 用法:
//   pm2 start ecosystem.config.cjs --env production
//   pm2 save
//   pm2 startup  (开机自启)
// ==========================================================================

module.exports = {
  apps: [
    {
      name: 'longh-workbench',
      script: './server/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,
        DB_PATH: './server/data/workbench.db',
        UPLOAD_DIR: './server/uploads',
      },
      // 自动重启策略
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      // 日志
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 优雅重启
      kill_timeout: 3000,
      // 环境变量文件
      env_file: '.env',
    },
  ],
};
