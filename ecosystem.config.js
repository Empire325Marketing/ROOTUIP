module.exports = {
  apps: [
    {
      name: 'api-gateway',
      script: './integration-gateway.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        PORT: 3007,
        NODE_ENV: 'production',
        JWT_SECRET: 'rootuip-jwt-secret-2024'
      },
      error_file: './logs/api-gateway-error.log',
      out_file: './logs/api-gateway-out.log'
    },
    {
      name: 'auth-service',
      script: './auth-unified.js',
      env: {
        PORT: 3003,
        NODE_ENV: 'production'
      },
      error_file: './logs/auth-error.log',
      out_file: './logs/auth-out.log'
    },
    {
      name: 'realtime-demo',
      script: './real-time-demo-enhanced.js',
      env: {
        PORT: 3001,
        NODE_ENV: 'production'
      },
      error_file: './logs/demo-error.log',
      out_file: './logs/demo-out.log'
    },
    {
      name: 'ai-ml-engine',
      script: './ai-ml-realtime-engine.js',
      env: {
        PORT: 3002,
        NODE_ENV: 'production'
      },
      error_file: './logs/ai-error.log',
      out_file: './logs/ai-out.log'
    },
    {
      name: 'websocket-server',
      script: './real-time-websocket-server-enhanced.js',
      env: {
        PORT: 3004,
        NODE_ENV: 'production'
      },
      error_file: './logs/websocket-error.log',
      out_file: './logs/websocket-out.log'
    },
    {
      name: 'maersk-integration',
      script: './maersk-oauth-integration.js',
      env: {
        PORT: 3005,
        NODE_ENV: 'production'
      },
      error_file: './logs/maersk-error.log',
      out_file: './logs/maersk-out.log'
    },
    {
      name: 'customer-success',
      script: './customer-success-platform.js',
      env: {
        PORT: 3006,
        NODE_ENV: 'production'
      },
      error_file: './logs/customer-error.log',
      out_file: './logs/customer-out.log'
    }
  ]
};