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
        // RECAP is on local port 80; Host header selects the recap vhost.
        RECAP_API_URL: 'http://127.0.0.1',
        RECAP_API_HOST: 'recap.cpu-crums.com',
      },
    },
  ],
};
