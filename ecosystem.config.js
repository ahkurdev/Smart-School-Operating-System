// PM2 process config — SSOS native deployment (no Docker)
module.exports = {
  apps: [
    {
      name: 'smart-school-api',
      cwd: './apps/api',
      script: 'dist/src/main.js',
      env: { NODE_ENV: 'production', PORT: 4100 },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
      env_production: { NODE_ENV: 'production' },
    },
    {
      name: 'smart-school-web',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3200',
      env: { NODE_ENV: 'production', NEXT_PUBLIC_API_URL: 'http://localhost:4100' },
      instances: 1,
      autorestart: true,
    },
    {
      name: 'smart-school-worker',
      cwd: './apps/worker',
      script: 'dist/index.js',
      env: { NODE_ENV: 'production', LOG_LEVEL: 'info' },
      instances: 1,
      autorestart: true,
    },
  ],
}
