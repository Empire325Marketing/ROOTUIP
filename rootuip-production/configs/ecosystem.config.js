module.exports = {
  apps: [
    {
      name: 'rootuip-main',
      script: 'server.js',
      cwd: '/var/www/rootuip',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/rootuip/main-error.log',
      out_file: '/var/log/rootuip/main-out.log',
      log_file: '/var/log/rootuip/main.log',
      time: true,
      max_memory_restart: '1G',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s'
    },
    {
      name: 'rootuip-api',
      script: 'api-server.js',
      cwd: '/var/www/rootuip',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/log/rootuip/api-error.log',
      out_file: '/var/log/rootuip/api-out.log',
      log_file: '/var/log/rootuip/api.log',
      time: true,
      max_memory_restart: '800M',
      autorestart: true
    },
    {
      name: 'rootuip-demo',
      script: 'demo-server.js',
      cwd: '/var/www/rootuip',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3030
      },
      error_file: '/var/log/rootuip/demo-error.log',
      out_file: '/var/log/rootuip/demo-out.log',
      log_file: '/var/log/rootuip/demo.log',
      time: true,
      max_memory_restart: '512M',
      autorestart: true
    }
  ]
};
