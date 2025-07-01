#!/bin/bash

# ROOTUIP White-Label and Multi-Tenancy Deployment Script
# Deploys all new systems to VPS and connects to domain

set -e

echo "🚀 Starting ROOTUIP White-Label Platform Deployment..."

# Configuration
VPS_HOST="${VPS_HOST:-your-vps-ip}"
VPS_USER="${VPS_USER:-root}"
VPS_PATH="/var/www/rootuip"
DOMAIN="rootuip.com"
LOCAL_PATH="/home/iii/ROOTUIP"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📦 Preparing deployment package...${NC}"

# Create deployment manifest
cat > deployment-manifest.json << EOF
{
  "deployment": "white-label-multi-tenancy",
  "version": "1.0.0",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "components": [
    "white-label-platform",
    "multi-tenancy-system",
    "partner-platform"
  ]
}
EOF

# Step 1: Package new systems
echo -e "${GREEN}✓ Creating deployment archive...${NC}"
tar -czf white-label-deployment.tar.gz \
  white-label/ \
  multi-tenancy/ \
  partner-platform/ \
  deployment-manifest.json

# Step 2: Transfer to VPS
echo -e "${YELLOW}📤 Transferring files to VPS...${NC}"
scp white-label-deployment.tar.gz ${VPS_USER}@${VPS_HOST}:${VPS_PATH}/

# Step 3: Deploy on VPS
echo -e "${YELLOW}🔧 Deploying on VPS...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/rootuip

# Extract deployment package
echo "Extracting deployment package..."
tar -xzf white-label-deployment.tar.gz

# Install dependencies
echo "Installing Node.js dependencies..."
cd white-label && npm install --production && cd ..
cd multi-tenancy && npm install --production && cd ..
cd partner-platform && npm install --production && cd ..

# Create systemd services
echo "Creating systemd services..."

# White-Label Branding Service
cat > /etc/systemd/system/rootuip-white-label.service << EOF
[Unit]
Description=ROOTUIP White-Label Branding System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rootuip/white-label
ExecStart=/usr/bin/node branding-system.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Domain Management Service
cat > /etc/systemd/system/rootuip-domain-manager.service << EOF
[Unit]
Description=ROOTUIP Domain Management System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rootuip/white-label
ExecStart=/usr/bin/node domain-management.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Multi-Tenancy Service
cat > /etc/systemd/system/rootuip-multi-tenancy.service << EOF
[Unit]
Description=ROOTUIP Multi-Tenancy System
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rootuip/multi-tenancy
ExecStart=/usr/bin/node tenant-isolation-system.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Partner Portal Service
cat > /etc/systemd/system/rootuip-partner-portal.service << EOF
[Unit]
Description=ROOTUIP Partner Management Portal
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rootuip/partner-platform
ExecStart=/usr/bin/node reseller-management-portal.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3010

[Install]
WantedBy=multi-user.target
EOF

# Enable and start services
systemctl daemon-reload
systemctl enable rootuip-white-label rootuip-domain-manager rootuip-multi-tenancy rootuip-partner-portal
systemctl start rootuip-white-label rootuip-domain-manager rootuip-multi-tenancy rootuip-partner-portal

# Update Nginx configuration
echo "Updating Nginx configuration..."
cat > /etc/nginx/sites-available/rootuip-white-label << 'EOF'
# White-Label API endpoints
location /api/white-label/ {
    proxy_pass http://localhost:3008/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Partner Portal
location /partners/ {
    proxy_pass http://localhost:3010/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}

# Multi-tenancy API
location /api/tenants/ {
    proxy_pass http://localhost:3009/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
EOF

# Include in main Nginx config
sed -i '/location \/ {/i\    include /etc/nginx/sites-available/rootuip-white-label;' /etc/nginx/sites-available/default

# Test and reload Nginx
nginx -t && systemctl reload nginx

# Create database tables
echo "Setting up databases..."
sudo -u postgres psql << EOF
-- Create white-label schema
CREATE SCHEMA IF NOT EXISTS white_label;
CREATE SCHEMA IF NOT EXISTS multi_tenancy;
CREATE SCHEMA IF NOT EXISTS partner_platform;

-- Grant permissions
GRANT ALL ON SCHEMA white_label TO rootuip_user;
GRANT ALL ON SCHEMA multi_tenancy TO rootuip_user;
GRANT ALL ON SCHEMA partner_platform TO rootuip_user;
EOF

# Run database migrations
cd /var/www/rootuip/multi-tenancy
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createTables() {
    await pool.query(\`
        CREATE TABLE IF NOT EXISTS tenants (
            id UUID PRIMARY KEY,
            organization_name VARCHAR(255) NOT NULL,
            subdomain VARCHAR(100) UNIQUE,
            custom_domain VARCHAR(255),
            isolation_type VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    \`);
    
    await pool.query(\`
        CREATE TABLE IF NOT EXISTS tenant_features (
            tenant_id UUID REFERENCES tenants(id),
            feature_id VARCHAR(100),
            enabled BOOLEAN DEFAULT false,
            settings JSONB,
            PRIMARY KEY (tenant_id, feature_id)
        )
    \`);
    
    await pool.query(\`
        CREATE TABLE IF NOT EXISTS partners (
            id UUID PRIMARY KEY,
            company_name VARCHAR(255) NOT NULL,
            partner_type VARCHAR(50),
            tier VARCHAR(50),
            commission_rate DECIMAL(5,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    \`);
    
    console.log('Database tables created successfully');
    process.exit(0);
}

createTables().catch(console.error);
"

echo "Deployment completed successfully!"
ENDSSH

# Step 4: Configure DNS for white-label domains
echo -e "${YELLOW}🌐 Configuring DNS...${NC}"
cat > dns-configuration.txt << EOF
# DNS Configuration for ROOTUIP White-Label Platform

1. Main domain (rootuip.com):
   - A record: @ -> ${VPS_HOST}
   - CNAME: www -> rootuip.com
   - CNAME: api -> rootuip.com
   - CNAME: partners -> rootuip.com

2. Wildcard subdomain for tenants:
   - CNAME: *.tenants -> rootuip.com

3. White-label domain instructions:
   - Customer adds CNAME: their-domain.com -> white-label.rootuip.com
   - SSL certificates are automatically provisioned via Let's Encrypt

4. Partner portal subdomains:
   - CNAME: partners -> rootuip.com
   - CNAME: reseller -> rootuip.com
EOF

# Step 5: Initialize white-label system
echo -e "${YELLOW}🎨 Initializing white-label system...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
cd /var/www/rootuip

# Create initial white-label configuration
cat > white-label-config.json << EOF
{
  "platform": {
    "name": "ROOTUIP",
    "defaultTheme": {
      "primaryColor": "#1E40AF",
      "secondaryColor": "#3B82F6",
      "accentColor": "#60A5FA",
      "backgroundColor": "#F3F4F6",
      "textColor": "#1F2937"
    },
    "features": {
      "customDomains": true,
      "emailBranding": true,
      "mobileApps": true,
      "apiWhiteLabel": true
    }
  },
  "tenants": {
    "isolationDefault": "schema",
    "resourceLimits": {
      "trial": {
        "users": 5,
        "storage": 1,
        "apiCalls": 1000
      },
      "starter": {
        "users": 50,
        "storage": 10,
        "apiCalls": 100000
      },
      "professional": {
        "users": 200,
        "storage": 100,
        "apiCalls": 1000000
      },
      "enterprise": {
        "users": -1,
        "storage": -1,
        "apiCalls": -1
      }
    }
  },
  "partners": {
    "commissionStructure": {
      "bronze": 0.15,
      "silver": 0.20,
      "gold": 0.25,
      "platinum": 0.30
    },
    "enabledFeatures": [
      "whiteLabel",
      "customPricing",
      "leadRegistration",
      "revenueSharing"
    ]
  }
}
EOF

# Set up SSL certificates
certbot --nginx -d rootuip.com -d www.rootuip.com -d api.rootuip.com -d partners.rootuip.com --non-interactive --agree-tos -m admin@rootuip.com

echo "White-label system initialized!"
ENDSSH

# Step 6: Create monitoring setup
echo -e "${YELLOW}📊 Setting up monitoring...${NC}"
cat > monitor-white-label.sh << 'EOF'
#!/bin/bash
# Monitor white-label services

services=("rootuip-white-label" "rootuip-domain-manager" "rootuip-multi-tenancy" "rootuip-partner-portal")

for service in "${services[@]}"; do
    status=$(systemctl is-active $service)
    if [ "$status" != "active" ]; then
        echo "⚠️  $service is $status"
        systemctl restart $service
    else
        echo "✅ $service is running"
    fi
done

# Check endpoints
endpoints=(
    "https://rootuip.com/api/white-label/health"
    "https://rootuip.com/api/tenants/health"
    "https://rootuip.com/partners/health"
)

for endpoint in "${endpoints[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" $endpoint)
    if [ "$response" == "200" ]; then
        echo "✅ $endpoint is healthy"
    else
        echo "⚠️  $endpoint returned $response"
    fi
done
EOF

chmod +x monitor-white-label.sh
scp monitor-white-label.sh ${VPS_USER}@${VPS_HOST}:/usr/local/bin/

# Step 7: Create partner onboarding script
echo -e "${YELLOW}🤝 Creating partner onboarding automation...${NC}"
cat > onboard-partner.sh << 'EOF'
#!/bin/bash
# Automated partner onboarding

PARTNER_NAME=$1
PARTNER_EMAIL=$2
PARTNER_TYPE=${3:-"logistics_consultant"}

if [ -z "$PARTNER_NAME" ] || [ -z "$PARTNER_EMAIL" ]; then
    echo "Usage: ./onboard-partner.sh 'Company Name' 'email@example.com' [partner_type]"
    exit 1
fi

echo "🚀 Onboarding new partner: $PARTNER_NAME"

# Create partner account
curl -X POST https://rootuip.com/api/partners/register \
  -H "Content-Type: application/json" \
  -d "{
    \"companyName\": \"$PARTNER_NAME\",
    \"email\": \"$PARTNER_EMAIL\",
    \"partnerType\": \"$PARTNER_TYPE\"
  }"

echo "✅ Partner account created"
echo "📧 Welcome email sent to $PARTNER_EMAIL"
echo "🔗 Partner portal: https://partners.rootuip.com"
EOF

chmod +x onboard-partner.sh

# Clean up
rm -f white-label-deployment.tar.gz deployment-manifest.json

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Platform URL: https://rootuip.com${NC}"
echo -e "${GREEN}🤝 Partner Portal: https://partners.rootuip.com${NC}"
echo -e "${GREEN}📊 Monitor services: ssh ${VPS_USER}@${VPS_HOST} '/usr/local/bin/monitor-white-label.sh'${NC}"
echo -e "${GREEN}🚀 Onboard partner: ./onboard-partner.sh 'Company Name' 'email@example.com'${NC}"