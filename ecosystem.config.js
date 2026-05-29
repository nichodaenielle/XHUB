module.exports = {
  apps: [
    {
      name: 'xhub-api',
      script: 'dist/main.js',
      cwd: 'D:\\STGNG\\XHUB\\apps\\backend',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        RECAP_API_URL: 'http://127.0.0.1',
        RECAP_API_HOST: 'recap.cpu-crums.com',
      },
    },
  ],
};
