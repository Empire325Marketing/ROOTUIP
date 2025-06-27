#!/bin/bash
# Deploy ROOTUIP Integration System

set -e

echo "🔌 Deploying ROOTUIP Integration System"
echo "======================================"

# Create package.json for integrations
cd /home/iii/ROOTUIP/integrations
cat > package.json << 'EOF'
{
  "name": "rootuip-integrations",
  "version": "1.0.0",
  "description": "ROOTUIP Carrier Integration System",
  "main": "integration-service.js",
  "scripts": {
    "start": "node integration-server.js",
    "dev": "nodemon integration-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "limiter": "^2.1.0",
    "soap": "^1.0.0",
    "xml2js": "^0.6.2",
    "csv-parse": "^5.5.0",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.3.1"
  }
}
EOF

# Install dependencies
npm install

# Create the main server file
cat > integration-server.js << 'EOF'
// ROOTUIP Integration Server
const express = require('express');
const cors = require('cors');
const { router: integrationAPI, integrationService } = require('./integration-api');

const app = express();
const PORT = process.env.PORT || 3011;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount integration API
app.use('/api/integrations', integrationAPI);

// Start webhook server
integrationService.startWebhookServer(3100);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'ROOTUIP Integration Service',
        version: '1.0.0',
        endpoints: {
            carriers: '/api/integrations/carriers',
            tracking: '/api/integrations/track/:trackingNumber',
            schedules: '/api/integrations/schedules',
            health: '/api/integrations/health'
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Integration Service running on port ${PORT}`);
    console.log(`Webhook server running on port 3100`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down integration service...');
    await integrationService.shutdown();
    process.exit(0);
});
EOF

# Create demo configuration
cat > demo-carriers.json << 'EOF'
{
  "carriers": [
    {
      "carrierId": "MAEU",
      "config": {
        "consumerKey": "demo-key",
        "consumerSecret": "demo-secret",
        "customerId": "DEMO123",
        "environment": "sandbox"
      }
    },
    {
      "carrierId": "MSCU",
      "config": {
        "username": "demo",
        "password": "demo123",
        "accountNumber": "MSC-DEMO",
        "environment": "test"
      }
    }
  ]
}
EOF

# Copy to server
echo "Copying files to server..."
scp -r /home/iii/ROOTUIP/integrations root@145.223.73.4:/tmp/

# Deploy on server
ssh root@145.223.73.4 << 'REMOTE_SCRIPT'
# Create directory
mkdir -p /var/www/rootuip/integrations
cp -r /tmp/integrations/* /var/www/rootuip/integrations/
cd /var/www/rootuip/integrations

# Install dependencies
npm install --production

# Set permissions
chown -R www-data:www-data /var/www/rootuip/integrations

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'rootuip-integrations',
    script: './integration-server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3011
    },
    error_file: '/var/www/rootuip/logs/app/integrations-error.log',
    out_file: '/var/www/rootuip/logs/app/integrations-out.log',
    time: true
  }]
};
EOF

# Start with PM2
sudo -u www-data pm2 start ecosystem.config.js
sudo -u www-data pm2 save

# Update nginx to proxy integration API
cat >> /etc/nginx/sites-available/app.rootuip.com << 'NGINX'

    # Integration API
    location /api/integrations/ {
        proxy_pass http://localhost:3011/api/integrations/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
NGINX

# Test and reload nginx
nginx -t && systemctl reload nginx

echo "Integration system deployed!"
REMOTE_SCRIPT

echo ""
echo "✅ Integration System Deployed!"
echo ""
echo "API Endpoints:"
echo "  - https://app.rootuip.com/api/integrations/carriers"
echo "  - https://app.rootuip.com/api/integrations/track/{trackingNumber}"
echo "  - https://app.rootuip.com/api/integrations/schedules"
echo "  - https://app.rootuip.com/api/integrations/health"
echo ""
echo "Webhook Server: Port 3100"
echo ""