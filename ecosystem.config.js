const path = require('path');

const backendDir = path.join(__dirname, 'apps', 'backend');
const logsDir = path.join(__dirname, 'logs');

/**
 * XHUB backend — required for xhub.cpu-crums.com (Cloudflare tunnel → 127.0.0.1:3001).
 *
 * Usage (from D:\STGNG\XHUB):
 *   npm run build:backend   # once, or after code changes
 *   npm run pm2:start
 *   npm run pm2:logs
 *
 * Secrets and DB URLs live in apps/backend/.env (loaded by Nest ConfigModule).
 */
module.exports = {
  apps: [
    {
      name: 'xhub-api',
      script: 'dist/main.js',
      cwd: backendDir,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 15,
      min_uptime: '10s',
      restart_delay: 5000,
      max_memory_restart: '512M',
      kill_timeout: 10000,
      listen_timeout: 30000,
      error_file: path.join(logsDir, 'xhub-api-error.log'),
      out_file: path.join(logsDir, 'xhub-api-out.log'),
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_URL: 'postgresql://xhub_new:simplepass@localhost:5432/xhub',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        REDIS_PASSWORD: '',
        REDIS_URL: 'redis://127.0.0.1:6379',
        RECAP_REDIS_PREFIX: 'xhub_broadcast_',
        JWT_SECRET: 'your_jwt_secret_change_this',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_SECRET: 'your_refresh_secret_change_this',
        JWT_REFRESH_EXPIRES_IN: '7d',
        FRONTEND_URL: 'https://recap.cpu-crums.com',
        XHUB_URL: 'https://xhub.cpu-crums.com',
        RECAP_API_URL: 'http://127.0.0.1',
        RECAP_API_HOST: 'recap.cpu-crums.com',
        RECAP_API_SECRET: '0811fc1dd7a79d9b8632e2b2be92b3557d9e6e44146f7052c9178c70f07a35ba',
        RECAP_WEBHOOK_SECRET: '0811fc1dd7a79d9b8632e2b2be92b3557d9e6e44146f7052c9178c70f07a35ba',
        APP_NAME: 'XHub',
        APP_URL: 'http://localhost:3000',
      },
    },
  ],
};
