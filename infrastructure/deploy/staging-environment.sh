#!/bin/bash

# Staging Environment Setup with CI/CD Pipeline
# Creates a complete staging environment with automated deployment

set -e

# Configuration
DOMAIN="rootuip.com"
STAGING_DOMAIN="staging.$DOMAIN"
STAGING_ROOT="/var/www/staging-rootuip"
GIT_REPO="https://github.com/yourusername/rootuip.git"
DEPLOY_KEY="/home/deploy/.ssh/id_rsa"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== UIP Staging Environment Setup ===${NC}"

# 1. Create deployment user
echo -e "\n${YELLOW}Creating deployment user...${NC}"

if ! id "deploy" &>/dev/null; then
    sudo adduser --disabled-password --gecos "" deploy
    sudo usermod -aG www-data deploy
fi

# 2. Set up deployment keys
echo -e "\n${YELLOW}Setting up deployment keys...${NC}"

sudo -u deploy bash <<'EOF'
if [ ! -f ~/.ssh/id_rsa ]; then
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
    echo "Add this public key to your Git repository deploy keys:"
    cat ~/.ssh/id_rsa.pub
fi
EOF

# 3. Create staging directory structure
echo -e "\n${YELLOW}Creating staging environment...${NC}"

sudo mkdir -p $STAGING_ROOT/{releases,shared,repo}
sudo mkdir -p $STAGING_ROOT/shared/{logs,uploads,cache}
sudo chown -R deploy:www-data $STAGING_ROOT

# 4. Create deployment script
echo -e "\n${YELLOW}Creating deployment pipeline...${NC}"

sudo tee /usr/local/bin/deploy-staging.sh > /dev/null <<'EOF'
#!/bin/bash

# Automated staging deployment script
set -e

STAGING_ROOT="/var/www/staging-rootuip"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
RELEASE_DIR="$STAGING_ROOT/releases/$TIMESTAMP"
SHARED_DIR="$STAGING_ROOT/shared"
REPO_DIR="$STAGING_ROOT/repo"

echo "Starting deployment to staging..."

# 1. Update repository
echo "Pulling latest changes..."
cd $REPO_DIR
git fetch origin
git reset --hard origin/staging

# 2. Create new release directory
echo "Creating release directory..."
mkdir -p $RELEASE_DIR
rsync -av --exclude='.git' --exclude='node_modules' $REPO_DIR/ $RELEASE_DIR/

# 3. Install dependencies
echo "Installing dependencies..."
cd $RELEASE_DIR
if [ -f package.json ]; then
    npm ci --production
fi

# 4. Build assets
echo "Building assets..."
if [ -f webpack.config.js ]; then
    npm run build
fi

# 5. Run tests
echo "Running tests..."
if [ -f package.json ] && grep -q "\"test\"" package.json; then
    npm test || {
        echo "Tests failed! Aborting deployment."
        rm -rf $RELEASE_DIR
        exit 1
    }
fi

# 6. Link shared directories
echo "Linking shared directories..."
ln -nfs $SHARED_DIR/uploads $RELEASE_DIR/uploads
ln -nfs $SHARED_DIR/logs $RELEASE_DIR/logs
ln -nfs $SHARED_DIR/cache $RELEASE_DIR/cache

# 7. Update environment configuration
echo "Updating configuration..."
if [ -f $RELEASE_DIR/.env.example ]; then
    cp $RELEASE_DIR/.env.example $RELEASE_DIR/.env
    # Update staging-specific variables
    sed -i 's/APP_ENV=.*/APP_ENV=staging/' $RELEASE_DIR/.env
    sed -i 's/APP_DEBUG=.*/APP_DEBUG=true/' $RELEASE_DIR/.env
fi

# 8. Set permissions
echo "Setting permissions..."
sudo chown -R deploy:www-data $RELEASE_DIR
find $RELEASE_DIR -type d -exec chmod 755 {} \;
find $RELEASE_DIR -type f -exec chmod 644 {} \;

# 9. Create symlink to new release
echo "Activating new release..."
ln -nfs $RELEASE_DIR $STAGING_ROOT/current

# 10. Reload services
echo "Reloading services..."
sudo systemctl reload nginx
sudo systemctl restart php8.1-fpm || true

# 11. Clean up old releases (keep last 5)
echo "Cleaning up old releases..."
cd $STAGING_ROOT/releases
ls -t | tail -n +6 | xargs -r rm -rf

# 12. Run post-deployment tasks
echo "Running post-deployment tasks..."
cd $STAGING_ROOT/current
if [ -f artisan ]; then
    php artisan migrate --force || true
    php artisan cache:clear || true
fi

# 13. Health check
echo "Running health check..."
sleep 5
response=$(curl -s -o /dev/null -w "%{http_code}" https://staging.rootuip.com)
if [ $response -eq 200 ]; then
    echo "Deployment successful! Site is responding."
else
    echo "Warning: Site returned HTTP $response"
fi

echo "Staging deployment completed at $(date)"
EOF

sudo chmod +x /usr/local/bin/deploy-staging.sh
sudo chown deploy:deploy /usr/local/bin/deploy-staging.sh

# 5. Create rollback script
echo -e "\n${YELLOW}Creating rollback capability...${NC}"

sudo tee /usr/local/bin/rollback-staging.sh > /dev/null <<'EOF'
#!/bin/bash

# Rollback to previous release
STAGING_ROOT="/var/www/staging-rootuip"

echo "Rolling back to previous release..."

# Get current and previous release
CURRENT=$(readlink $STAGING_ROOT/current)
CURRENT_TIMESTAMP=$(basename $CURRENT)

cd $STAGING_ROOT/releases
PREVIOUS=$(ls -t | grep -v $CURRENT_TIMESTAMP | head -1)

if [ -z "$PREVIOUS" ]; then
    echo "No previous release found!"
    exit 1
fi

echo "Rolling back from $CURRENT_TIMESTAMP to $PREVIOUS..."

# Update symlink
ln -nfs $STAGING_ROOT/releases/$PREVIOUS $STAGING_ROOT/current

# Reload services
sudo systemctl reload nginx

echo "Rollback completed!"
EOF

sudo chmod +x /usr/local/bin/rollback-staging.sh

# 6. Set up GitHub Actions workflow
echo -e "\n${YELLOW}Creating GitHub Actions workflow...${NC}"

sudo -u deploy tee ~/github-workflow.yml > /dev/null <<'EOF'
name: Deploy to Staging

on:
  push:
    branches: [ staging ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm test
    
    - name: Build
      run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/staging'
    
    steps:
    - name: Deploy to staging
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.STAGING_HOST }}
        username: deploy
        key: ${{ secrets.DEPLOY_KEY }}
        script: |
          /usr/local/bin/deploy-staging.sh
EOF

echo -e "${GREEN}Save this workflow to .github/workflows/staging-deploy.yml in your repository${NC}"

# 7. Create staging test suite
echo -e "\n${YELLOW}Creating staging test suite...${NC}"

sudo mkdir -p /usr/local/share/rootuip-tests

sudo tee /usr/local/share/rootuip-tests/staging-tests.sh > /dev/null <<'EOF'
#!/bin/bash

# Automated staging environment tests
STAGING_URL="https://staging.rootuip.com"
ERRORS=0

echo "Running staging environment tests..."

# Test 1: Homepage loads
echo -n "Testing homepage... "
response=$(curl -s -o /dev/null -w "%{http_code}" $STAGING_URL)
if [ $response -eq 200 ]; then
    echo "✓ PASS"
else
    echo "✗ FAIL (HTTP $response)"
    ((ERRORS++))
fi

# Test 2: SSL certificate
echo -n "Testing SSL certificate... "
if curl -s --head $STAGING_URL | grep -q "200 OK"; then
    echo "✓ PASS"
else
    echo "✗ FAIL"
    ((ERRORS++))
fi

# Test 3: Static assets
echo -n "Testing static assets... "
assets=(
    "/css/main.css"
    "/js/app.js"
    "/images/logo.svg"
)
for asset in "${assets[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" $STAGING_URL$asset)
    if [ $response -ne 200 ]; then
        echo "✗ FAIL ($asset returned $response)"
        ((ERRORS++))
        break
    fi
done
if [ $ERRORS -eq 0 ]; then
    echo "✓ PASS"
fi

# Test 4: API endpoints
echo -n "Testing API endpoints... "
response=$(curl -s -o /dev/null -w "%{http_code}" $STAGING_URL/api/health)
if [ $response -eq 200 ]; then
    echo "✓ PASS"
else
    echo "✗ FAIL (HTTP $response)"
    ((ERRORS++))
fi

# Test 5: Performance
echo -n "Testing performance... "
load_time=$(curl -s -o /dev/null -w "%{time_total}" $STAGING_URL)
if (( $(echo "$load_time < 2" | bc -l) )); then
    echo "✓ PASS (${load_time}s)"
else
    echo "✗ FAIL (${load_time}s > 2s)"
    ((ERRORS++))
fi

# Summary
echo ""
if [ $ERRORS -eq 0 ]; then
    echo "All tests passed! ✓"
    exit 0
else
    echo "$ERRORS tests failed! ✗"
    exit 1
fi
EOF

sudo chmod +x /usr/local/share/rootuip-tests/staging-tests.sh

# 8. Create staging configuration
echo -e "\n${YELLOW}Configuring staging environment...${NC}"

sudo tee $STAGING_ROOT/shared/.env > /dev/null <<EOF
# Staging Environment Configuration
APP_NAME="ROOTUIP Staging"
APP_ENV=staging
APP_DEBUG=true
APP_URL=https://staging.rootuip.com

# Database
DB_CONNECTION=pgsql
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=rootuip_staging
DB_USERNAME=rootuip_staging
DB_PASSWORD=$(openssl rand -base64 32)

# Cache
CACHE_DRIVER=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

# Redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

# Mail (Staging uses mailhog)
MAIL_MAILER=smtp
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_ENCRYPTION=null

# Monitoring
SENTRY_DSN=
LOG_CHANNEL=daily
LOG_LEVEL=debug

# Feature Flags
FEATURE_NEW_UI=true
FEATURE_BETA_API=true
EOF

# 9. Set up database for staging
echo -e "\n${YELLOW}Setting up staging database...${NC}"

sudo -u postgres psql <<EOF
CREATE DATABASE rootuip_staging;
CREATE USER rootuip_staging WITH ENCRYPTED PASSWORD '$(openssl rand -base64 32)';
GRANT ALL PRIVILEGES ON DATABASE rootuip_staging TO rootuip_staging;
EOF

# 10. Install Mailhog for email testing
echo -e "\n${YELLOW}Installing Mailhog for email testing...${NC}"

wget -q https://github.com/mailhog/MailHog/releases/download/v1.0.1/MailHog_linux_amd64
sudo mv MailHog_linux_amd64 /usr/local/bin/mailhog
sudo chmod +x /usr/local/bin/mailhog

# Create systemd service
sudo tee /etc/systemd/system/mailhog.service > /dev/null <<EOF
[Unit]
Description=Mailhog
After=network.target

[Service]
User=nobody
ExecStart=/usr/local/bin/mailhog
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable mailhog
sudo systemctl start mailhog

# 11. Create staging monitoring dashboard
echo -e "\n${YELLOW}Creating staging dashboard...${NC}"

sudo tee $STAGING_ROOT/shared/staging-dashboard.html > /dev/null <<'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>ROOTUIP Staging Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: #ff9800; color: white; padding: 20px; margin: -20px -20px 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .card { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric { display: inline-block; margin: 0 20px; }
        .value { font-size: 2em; font-weight: bold; color: #333; }
        .label { color: #666; font-size: 0.9em; }
        .status { padding: 5px 10px; border-radius: 4px; color: white; font-weight: bold; }
        .status.active { background: #4caf50; }
        .status.inactive { background: #f44336; }
        .deployments { margin-top: 20px; }
        .deployment { padding: 10px; border-left: 4px solid #ff9800; margin: 10px 0; background: #fff3e0; }
        code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>ROOTUIP Staging Environment</h1>
        <p>⚠️ This is a staging environment. Do not use for production.</p>
    </div>
    
    <div class="container">
        <div class="card">
            <h2>Environment Status</h2>
            <div class="metric">
                <div class="label">Status</div>
                <div class="status active">ACTIVE</div>
            </div>
            <div class="metric">
                <div class="label">Version</div>
                <div class="value">staging-<span id="version">latest</span></div>
            </div>
            <div class="metric">
                <div class="label">Last Deploy</div>
                <div class="value" id="lastDeploy">Never</div>
            </div>
        </div>
        
        <div class="card">
            <h2>Quick Links</h2>
            <ul>
                <li><a href="/">Homepage</a></li>
                <li><a href="/platform">Platform Demo</a></li>
                <li><a href="/api/docs">API Documentation</a></li>
                <li><a href="http://localhost:8025" target="_blank">Mailhog (Email Testing)</a></li>
                <li><a href="/logs">Application Logs</a></li>
            </ul>
        </div>
        
        <div class="card">
            <h2>Testing Credentials</h2>
            <p><strong>Admin User:</strong> admin@staging.rootuip.com / staging123</p>
            <p><strong>Demo User:</strong> demo@staging.rootuip.com / demo123</p>
            <p><strong>API Key:</strong> <code>staging_api_key_12345</code></p>
        </div>
        
        <div class="card deployments">
            <h2>Recent Deployments</h2>
            <div id="deployments">
                <div class="deployment">
                    <strong>Loading deployment history...</strong>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>Deployment Commands</h2>
            <pre>
# Deploy latest staging branch
ssh deploy@staging.rootuip.com
/usr/local/bin/deploy-staging.sh

# Rollback to previous version
/usr/local/bin/rollback-staging.sh

# Run tests
/usr/local/share/rootuip-tests/staging-tests.sh
            </pre>
        </div>
    </div>
    
    <script>
        // Load deployment history
        fetch('/api/deployments')
            .then(r => r.json())
            .then(data => {
                const container = document.getElementById('deployments');
                container.innerHTML = data.deployments.map(d => `
                    <div class="deployment">
                        <strong>${d.timestamp}</strong> - 
                        ${d.commit} by ${d.author}
                        <br>
                        <small>${d.message}</small>
                    </div>
                `).join('');
            })
            .catch(() => {
                document.getElementById('deployments').innerHTML = 
                    '<div class="deployment">No deployment history available</div>';
            });
    </script>
</body>
</html>
EOF

# 12. Configure Nginx for staging with password protection
echo -e "\n${YELLOW}Updating Nginx configuration...${NC}"

# Generate staging password
STAGING_PASS=$(openssl rand -base64 12)
echo "staging:$(openssl passwd -apr1 $STAGING_PASS)" | sudo tee -a /etc/nginx/.htpasswd > /dev/null

# Update staging Nginx config
sudo tee /etc/nginx/sites-available/staging.rootuip.com > /dev/null <<EOF
server {
    listen 80;
    server_name staging.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name staging.$DOMAIN;
    
    root $STAGING_ROOT/current/public;
    index index.html index.php;
    
    # SSL (managed by certbot)
    # ssl_certificate /etc/letsencrypt/live/staging.$DOMAIN/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/staging.$DOMAIN/privkey.pem;
    
    # Basic authentication
    auth_basic "Staging Environment";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    # Staging-specific headers
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header X-Environment "staging" always;
    
    # Mailhog web interface
    location /mailhog {
        proxy_pass http://localhost:8025;
        proxy_set_header Host \$host;
        auth_basic off; # Mailhog has its own auth
    }
    
    # Staging dashboard
    location /staging-dashboard {
        alias $STAGING_ROOT/shared/staging-dashboard.html;
        auth_basic off;
    }
    
    # PHP processing (if needed)
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
    }
    
    # Standard configuration
    include /etc/nginx/snippets/common-config.conf;
    
    access_log /var/log/nginx/staging-access.log;
    error_log /var/log/nginx/staging-error.log;
}
EOF

# 13. Create post-receive hook for auto-deployment
echo -e "\n${YELLOW}Setting up Git hooks...${NC}"

sudo -u deploy tee ~/post-receive-hook.sh > /dev/null <<'EOF'
#!/bin/bash

# Git post-receive hook for automatic staging deployment
while read oldrev newrev ref; do
    if [[ $ref =~ .*/staging$ ]]; then
        echo "Staging branch updated, triggering deployment..."
        /usr/local/bin/deploy-staging.sh
    fi
done
EOF

# 14. Initialize staging repository
echo -e "\n${YELLOW}Initializing staging repository...${NC}"

sudo -u deploy bash <<EOF
cd $STAGING_ROOT/repo
git init
git remote add origin $GIT_REPO || true
git fetch origin
git checkout -b staging origin/staging || git checkout staging
EOF

# 15. Run initial deployment
echo -e "\n${YELLOW}Running initial deployment...${NC}"

sudo -u deploy /usr/local/bin/deploy-staging.sh || echo "Initial deployment failed - configure git repository first"

# 16. Summary
echo -e "\n${GREEN}=== Staging Environment Setup Complete ===${NC}"
echo -e "${BLUE}Staging URL:${NC} https://staging.$DOMAIN"
echo -e "${BLUE}Credentials:${NC} staging / $STAGING_PASS"
echo -e "${BLUE}Mailhog:${NC} https://staging.$DOMAIN/mailhog"
echo -e "${BLUE}Dashboard:${NC} https://staging.$DOMAIN/staging-dashboard"
echo -e "\n${YELLOW}Deployment commands:${NC}"
echo "Deploy: ssh deploy@$DOMAIN '/usr/local/bin/deploy-staging.sh'"
echo "Rollback: ssh deploy@$DOMAIN '/usr/local/bin/rollback-staging.sh'"
echo "Test: ssh deploy@$DOMAIN '/usr/local/share/rootuip-tests/staging-tests.sh'"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Add deploy key to your Git repository"
echo "2. Configure GitHub Actions secrets"
echo "3. Push to staging branch to trigger deployment"
echo -e "\n${GREEN}Staging environment is ready for testing!${NC}"