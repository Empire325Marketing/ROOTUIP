#!/bin/bash
# ROOTUIP Enterprise Authentication System Deployment
# Automatically deploys the complete authentication system

set -e

echo "🔐 ROOTUIP Enterprise Authentication System Deployment"
echo "====================================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_step() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    log_error "Please do not run this script as root"
    exit 1
fi

# Configuration
AUTH_DIR="/var/www/rootuip/auth"
PUBLIC_DIR="/var/www/rootuip/public/auth"
API_PORT=3002
DB_NAME="rootuip_auth"
DB_USER="rootuip_auth_user"
DB_PASS=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 64)

# Step 1: Install dependencies
log_step "Installing Node.js dependencies..."
cd /home/iii/ROOTUIP/auth
npm init -y
npm install express bcryptjs jsonwebtoken nodemailer speakeasy qrcode validator \
    express-rate-limit helmet cors dotenv pg

# Step 2: Create environment file
log_step "Creating environment configuration..."
cat > .env << EOF
# ROOTUIP Authentication Service Configuration
NODE_ENV=production
PORT=$API_PORT

# JWT Configuration
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS

# Email Configuration (update with your SMTP settings)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=noreply@rootuip.com
EMAIL_PASS=your-email-password

# Application URLs
APP_URL=https://app.rootuip.com
API_URL=https://app.rootuip.com/api

# Security
ALLOWED_ORIGINS=https://rootuip.com,https://app.rootuip.com,https://staging.rootuip.com

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=5
EOF

chmod 600 .env

# Step 3: Set up PostgreSQL database
log_step "Setting up PostgreSQL database..."
if command -v psql &> /dev/null; then
    log_warning "Creating database and user..."
    sudo -u postgres psql << EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER' 
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

    # Run schema
    PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME < /home/iii/ROOTUIP/auth/database-schema.sql
    log_success "Database schema created"
else
    log_warning "PostgreSQL not installed. Skipping database setup."
    log_warning "Please install PostgreSQL and run database-schema.sql manually"
fi

# Step 4: Deploy authentication API
log_step "Deploying authentication API service..."
sudo mkdir -p $AUTH_DIR
sudo cp -r /home/iii/ROOTUIP/auth/* $AUTH_DIR/
sudo chown -R www-data:www-data $AUTH_DIR

# Step 5: Create systemd service
log_step "Creating systemd service for authentication API..."
sudo tee /etc/systemd/system/rootuip-auth.service > /dev/null << EOF
[Unit]
Description=ROOTUIP Authentication Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$AUTH_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node $AUTH_DIR/enterprise-auth-system.js
Restart=always
RestartSec=10

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/rootuip/auth

[Install]
WantedBy=multi-user.target
EOF

# Step 6: Deploy frontend authentication pages
log_step "Deploying authentication frontend pages..."
sudo mkdir -p $PUBLIC_DIR
sudo cp /home/iii/ROOTUIP/auth/*.html $PUBLIC_DIR/
sudo cp /home/iii/ROOTUIP/enhanced-login.html $PUBLIC_DIR/login.html
sudo chown -R www-data:www-data $PUBLIC_DIR

# Step 7: Update nginx configuration
log_step "Updating nginx configuration for authentication..."
sudo tee /etc/nginx/conf.d/rootuip-auth.conf > /dev/null << 'EOF'
# Authentication API proxy
location /api/auth/ {
    proxy_pass http://localhost:3002/api/auth/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    
    # CORS headers
    add_header Access-Control-Allow-Origin $http_origin always;
    add_header Access-Control-Allow-Credentials true always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
    
    if ($request_method = OPTIONS) {
        return 204;
    }
}

# Authentication pages
location /auth/ {
    alias /var/www/rootuip/public/auth/;
    try_files $uri $uri/ =404;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
EOF

# Step 8: Update app.rootuip.com nginx config
log_step "Updating app.rootuip.com configuration..."
sudo tee /etc/nginx/sites-available/app.rootuip.com > /dev/null << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name app.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.rootuip.com;

    # SSL configuration (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.rootuip.com;";

    root /var/www/rootuip/public;
    index index.html;

    # Main app route
    location / {
        try_files /app-index.html =404;
    }

    # Platform pages
    location /dashboard {
        try_files /platform/dashboard.html =404;
    }

    location /platform/ {
        try_files $uri $uri/ =404;
    }

    # Include authentication routes
    include /etc/nginx/conf.d/rootuip-auth.conf;

    # API routes
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
}
EOF

# Step 9: Set up PM2 for process management (optional)
log_step "Setting up PM2 process manager..."
if command -v pm2 &> /dev/null; then
    log_success "PM2 already installed"
else
    sudo npm install -g pm2
fi

# Create PM2 ecosystem file
cat > $AUTH_DIR/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'rootuip-auth',
    script: './enterprise-auth-system.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: '/var/www/rootuip/logs/app/auth-error.log',
    out_file: '/var/www/rootuip/logs/app/auth-out.log',
    log_file: '/var/www/rootuip/logs/app/auth-combined.log',
    time: true
  }]
};
EOF

# Step 10: Create demo admin user
log_step "Creating demo admin user..."
cat > /tmp/create-admin.js << 'EOF'
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

async function createAdmin() {
    const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASS
    });

    try {
        const email = 'admin@rootuip.com';
        const password = 'Admin2025!';
        const hashedPassword = await bcrypt.hash(password, 12);

        await pool.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, company, role, verified, verified_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (email) DO NOTHING
        `, [email, hashedPassword, 'Admin', 'User', 'ROOTUIP', 'admin', true]);

        console.log('Admin user created:', email);
        console.log('Password:', password);
    } catch (error) {
        console.error('Error creating admin:', error);
    } finally {
        await pool.end();
    }
}

createAdmin();
EOF

cd $AUTH_DIR && node /tmp/create-admin.js
rm /tmp/create-admin.js

# Step 11: Start services
log_step "Starting authentication services..."
sudo systemctl daemon-reload
sudo systemctl enable rootuip-auth
sudo systemctl start rootuip-auth

# Start with PM2 as well
cd $AUTH_DIR
sudo -u www-data pm2 start ecosystem.config.js
sudo -u www-data pm2 save
sudo pm2 startup systemd -u www-data --hp /var/www

# Step 12: Test nginx configuration and reload
log_step "Testing and reloading nginx..."
sudo nginx -t
sudo systemctl reload nginx

# Step 13: Create authentication documentation
log_step "Creating authentication documentation..."
cat > /var/www/rootuip/public/docs/authentication-api.md << 'EOF'
# ROOTUIP Authentication API Documentation

## Base URL
`https://app.rootuip.com/api/auth`

## Authentication
Most endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Register
`POST /register`
```json
{
  "email": "user@company.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "company": "Acme Corp"
}
```

### Login
`POST /login`
```json
{
  "email": "user@company.com",
  "password": "SecurePass123!",
  "mfaCode": "123456" // Optional, required if MFA enabled
}
```

### Verify Email
`POST /verify-email`
```json
{
  "token": "verification-token-from-email"
}
```

### Refresh Token
`POST /refresh`
```json
{
  "refreshToken": "your-refresh-token"
}
```

### Get Profile
`GET /profile`
Requires authentication

### Update Profile
`PUT /profile`
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "company": "New Company"
}
```

### Change Password
`POST /change-password`
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```

### Enable MFA
`POST /mfa/enable`
Returns QR code for authenticator app

### Verify MFA
`POST /mfa/verify`
```json
{
  "code": "123456"
}
```

## Admin Endpoints

### List Users
`GET /admin/users`
Requires admin role

### Update User Role
`PUT /admin/users/:userId/role`
```json
{
  "role": "admin|operations|viewer"
}
```

### Lock/Unlock User
`PUT /admin/users/:userId/lock`
```json
{
  "locked": true
}
```

## Response Codes
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Too Many Requests
- 500: Internal Server Error
EOF

# Step 14: Display summary
echo ""
echo "====================================================="
log_success "Enterprise Authentication System Deployed!"
echo "====================================================="
echo ""
echo "📋 DEPLOYMENT SUMMARY:"
echo ""
echo "🔐 Authentication API:"
echo "   URL: https://app.rootuip.com/api/auth"
echo "   Port: $API_PORT"
echo "   Status: $(sudo systemctl is-active rootuip-auth)"
echo ""
echo "🌐 Authentication Pages:"
echo "   Login: https://app.rootuip.com/auth/login.html"
echo "   Register: https://app.rootuip.com/auth/register.html"
echo "   Verify: https://app.rootuip.com/auth/verify-email.html"
echo ""
echo "🗄️ Database:"
echo "   Name: $DB_NAME"
echo "   User: $DB_USER"
echo "   Pass: [Saved in $AUTH_DIR/.env]"
echo ""
echo "👤 Demo Admin Account:"
echo "   Email: admin@rootuip.com"
echo "   Password: Admin2025!"
echo ""
echo "🔑 JWT Secret: [Saved in $AUTH_DIR/.env]"
echo ""
echo "📝 Next Steps:"
echo "1. Update EMAIL settings in $AUTH_DIR/.env"
echo "2. Test authentication at https://app.rootuip.com/auth/login.html"
echo "3. Monitor logs: sudo journalctl -u rootuip-auth -f"
echo "4. PM2 monitoring: sudo -u www-data pm2 monit"
echo ""
log_warning "Remember to update email SMTP settings for email verification!"
echo ""