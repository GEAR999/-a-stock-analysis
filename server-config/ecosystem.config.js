/**
 * PM2 Ecosystem 配置文件
 * 用法：pm2 start ecosystem.config.js
 * 
 * 注意：推荐使用 systemd 替代 PM2（见 a-stock-analysis.service）
 * 此文件作为备选方案保留
 */

module.exports = {
  apps: [
    {
      name: 'a-stock-analysis',
      script: './dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      max_restarts: 10,
      restart_delay: 4000,
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
