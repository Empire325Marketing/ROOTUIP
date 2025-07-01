#!/bin/bash

# Update deployment with unified application

echo "🔄 Updating ROOTUIP deployment with unified application..."

# Update package.json with missing dependencies
echo "📦 Updating package.json..."
cat > /home/iii/ROOTUIP/package.json << 'EOF'
{
  "name": "rootuip-platform",
  "version": "2.0.0",
  "description": "Enterprise Container Intelligence Platform - Unified",
  "main": "integration-gateway.js",
  "scripts": {
    "start": "pm2 start ecosystem.config.js",
    "dev": "pm2 start ecosystem.config.js --watch",
    "stop": "pm2 stop all",
    "restart": "pm2 restart all",
    "logs": "pm2 logs",
    "setup": "npm install && pm2 install pm2-logrotate",
    "test": "echo \"No tests configured\" && exit 0"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "redis": "^4.6.5",
    "ioredis": "^5.3.2",
    "pg": "^8.11.0",
    "axios": "^1.4.0",
    "passport": "^0.6.0",
    "passport-saml": "^3.2.4",
    "express-session": "^1.17.3",
    "connect-redis": "^7.1.0",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "@sendgrid/mail": "^7.7.0",
    "node-cron": "^3.0.2",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "express-rate-limit": "^6.7.0",
    "http-proxy-middleware": "^2.0.6",
    "winston": "^3.8.2",
    "uuid": "^9.0.0"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOF

# Update ecosystem.config.js for PM2
echo "🔧 Updating PM2 configuration..."
cat > /home/iii/ROOTUIP/ecosystem.config.js << 'EOF'
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
      script: './microsoft-saml-auth.js',
      env: {
        PORT: 3003,
        NODE_ENV: 'production',
        SAML_AUTH_PORT: 3003
      }
    },
    {
      name: 'enterprise-demo',
      script: './enterprise-demo-platform.js',
      env: {
        PORT: 3001,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'ai-ml-engine',
      script: './ai-ml-simulation-engine.js',
      env: {
        PORT: 3002,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'websocket-server',
      script: './real-time-websocket-server.js',
      env: {
        PORT: 3004,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'maersk-integration',
      script: './maersk-oauth-integration.js',
      env: {
        PORT: 3005,
        NODE_ENV: 'production'
      }
    },
    {
      name: 'customer-success',
      script: './customer-success-platform.js',
      env: {
        PORT: 3006,
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF

# Create updated deployment package
echo "📦 Creating updated deployment package..."
cd /home/iii/ROOTUIP

# Create logs directory
mkdir -p logs

# Ensure all HTML files are in public directory
cp *.html public/ 2>/dev/null || true

# Create deployment tarball
tar czf /tmp/rootuip-unified.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='*.sqlite' \
    .

echo "✅ Unified deployment package ready: /tmp/rootuip-unified.tar.gz"
echo ""
echo "📋 To deploy the unified application:"
echo "1. Copy to VPS: scp /tmp/rootuip-unified.tar.gz root@167.71.93.182:/tmp/"
echo "2. SSH to VPS: ssh root@167.71.93.182"
echo "3. Extract and restart:"
echo "   cd /var/www/rootuip"
echo "   tar xzf /tmp/rootuip-unified.tar.gz"
echo "   npm install"
echo "   pm2 restart all"
echo ""
echo "🌐 The unified application will be available at https://rootuip.com"
echo ""
echo "📱 Features:"
echo "✅ Unified login with JWT authentication"
echo "✅ Single-page application with navigation"
echo "✅ Real-time dashboard updates"
echo "✅ Integrated container tracking"
echo "✅ ROI calculator"
echo "✅ Role-based access control"
echo ""