#!/bin/bash

echo "Deploying Enterprise Authentication System..."

# Copy files to server
sshpass -p 'Empire@325' scp -o StrictHostKeyChecking=no \
    enterprise-auth-schema.sql \
    enterprise-auth-system.js \
    security-dashboard.html \
    root@app.rootuip.com:/var/www/rootuip/

# Execute on server
sshpass -p 'Empire@325' ssh -o StrictHostKeyChecking=no root@app.rootuip.com << 'EOF'
cd /var/www/rootuip

# Install additional dependencies
npm install speakeasy qrcode uuid csurf express-rate-limit

# Apply database schema
sudo -u postgres psql -d uip_auth < enterprise-auth-schema.sql

# Create enterprise auth starter
cat > enterprise-auth-starter.js << 'EOFINNER'
const EnterpriseAuthSystem = require('./enterprise-auth-system');

// Database configuration
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'uip_auth',
  user: 'uip_user',
  password: 'uip_secure_2024',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create and start the enterprise auth system
const authSystem = new EnterpriseAuthSystem(dbConfig);
authSystem.start(3001);

console.log('Enterprise Auth System started on port 3001');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down Enterprise Auth System...');
  process.exit(0);
});
EOFINNER

# Stop old auth service
pm2 stop auth-service
pm2 delete auth-service

# Start new enterprise auth service
pm2 start enterprise-auth-starter.js --name auth-service

# Copy security dashboard to public directory
cp security-dashboard.html /var/www/rootuip/public/platform/security-dashboard.html

# Create demo company and admin user
sudo -u postgres psql -d uip_auth << 'EOFINNER'
-- Create demo company
INSERT INTO companies (name, domain, subscription_tier) 
VALUES ('Demo Enterprise', 'demo.com', 'enterprise')
ON CONFLICT (domain) DO NOTHING;

-- Create default password policy
INSERT INTO password_policies (company_id)
SELECT id FROM companies WHERE domain = 'demo.com'
ON CONFLICT DO NOTHING;
EOFINNER

echo "Enterprise Auth deployment complete!"
pm2 list
EOF

echo "Deployment script completed!"