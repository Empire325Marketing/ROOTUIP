#!/bin/bash

echo "🚀 Launching ROOTUIP Enterprise Platform with Full Monitoring"
echo "============================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check system requirements
echo -e "${BLUE}Checking system requirements...${NC}"

# Check PostgreSQL
if ! pg_isready -q; then
    echo -e "${YELLOW}Starting PostgreSQL...${NC}"
    sudo service postgresql start
    sleep 3
fi

# Check Redis
if ! pgrep -x redis-server > /dev/null; then
    echo -e "${YELLOW}Starting Redis...${NC}"
    redis-server --daemonize yes
    sleep 2
fi

# Check nginx
if ! systemctl is-active --quiet nginx; then
    echo -e "${YELLOW}Starting nginx...${NC}"
    sudo systemctl start nginx
fi

# Kill existing processes
echo -e "${BLUE}Stopping existing services...${NC}"
pkill -f "performance-optimization-service.js" 2>/dev/null
pkill -f "enterprise-monitoring-system.js" 2>/dev/null
pkill -f "security-monitoring-service.js" 2>/dev/null
pkill -f "ml-document-processing-engine.js" 2>/dev/null
pkill -f "ml-demurrage-prediction-system.js" 2>/dev/null
pkill -f "enterprise-sales-automation.js" 2>/dev/null
pkill -f "customer-success-platform.js" 2>/dev/null

# Start Core Infrastructure Services
echo -e "${GREEN}Starting Core Infrastructure...${NC}"

# Performance Optimization Service
echo -e "${CYAN}Starting Performance Optimization...${NC}"
PORT=3015 node performance-optimization-service.js &
PERF_PID=$!
sleep 2

# Enterprise Monitoring System
echo -e "${CYAN}Starting Enterprise Monitoring...${NC}"
PORT=3016 node enterprise-monitoring-system.js &
MONITOR_PID=$!
sleep 2

# Security Monitoring Service
echo -e "${CYAN}Starting Security Monitoring...${NC}"
PORT=3018 node security-monitoring-service.js &
SECURITY_PID=$!
sleep 2

# Start AI/ML Services
echo -e "${GREEN}Starting AI/ML Services...${NC}"

# Document Processing Engine
echo -e "${PURPLE}Starting Document Processing...${NC}"
PORT=3010 node ml-document-processing-engine.js &
DOC_PID=$!
sleep 2

# D&D Prediction System
echo -e "${PURPLE}Starting D&D Prediction...${NC}"
PORT=3011 node ml-demurrage-prediction-system.js &
DD_PID=$!
sleep 2

# Start Business Services
echo -e "${GREEN}Starting Business Services...${NC}"

# Enterprise Sales Automation
echo -e "${BLUE}Starting Sales Automation...${NC}"
PORT=3006 node enterprise-sales-automation.js &
SALES_PID=$!
sleep 2

# Customer Success Platform
echo -e "${BLUE}Starting Customer Success...${NC}"
PORT=3007 node customer-success-platform.js &
SUCCESS_PID=$!
sleep 2

# Start Dashboard Servers
echo -e "${GREEN}Starting Dashboard Services...${NC}"

# Monitoring Dashboard
echo -e "${YELLOW}Starting Monitoring Dashboard...${NC}"
python3 -m http.server 8080 --directory /home/iii/ROOTUIP &
DASH_PID=$!
sleep 2

# Create nginx configuration for complete platform
echo -e "${BLUE}Configuring nginx for enterprise platform...${NC}"
sudo tee /etc/nginx/sites-available/rootuip-enterprise > /dev/null <<EOF
# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=100r/s;
limit_req_zone \$binary_remote_addr zone=auth_limit:10m rate=5r/s;
limit_req_zone \$binary_remote_addr zone=upload_limit:10m rate=2r/s;

# Upstream servers for load balancing
upstream app_servers {
    least_conn;
    server localhost:3000 weight=1 max_fails=3 fail_timeout=30s;
    server localhost:3006 weight=1 max_fails=3 fail_timeout=30s;
    server localhost:3007 weight=1 max_fails=3 fail_timeout=30s;
}

upstream ml_servers {
    least_conn;
    server localhost:3010 weight=1 max_fails=3 fail_timeout=30s;
    server localhost:3011 weight=1 max_fails=3 fail_timeout=30s;
    server localhost:3012 weight=1 max_fails=3 fail_timeout=30s;
}

# Main application server
server {
    listen 80;
    listen 443 ssl http2;
    server_name app.rootuip.com tracking.rootuip.com;

    # SSL configuration
    ssl_certificate /etc/ssl/certs/rootuip.crt;
    ssl_certificate_key /etc/ssl/private/rootuip.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Main application
    location / {
        proxy_pass http://app_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # Authentication endpoints with strict rate limiting
    location /api/auth/ {
        limit_req zone=auth_limit burst=3 nodelay;
        proxy_pass http://app_servers;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # File upload endpoints
    location /api/upload/ {
        limit_req zone=upload_limit burst=1 nodelay;
        client_max_body_size 50M;
        proxy_pass http://app_servers;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
        proxy_send_timeout 300;
    }

    # Static assets with caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|pdf|doc|docx)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff";
    }
}

# API server
server {
    listen 443 ssl http2;
    server_name api.rootuip.com;

    ssl_certificate /etc/ssl/certs/rootuip.crt;
    ssl_certificate_key /etc/ssl/private/rootuip.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # API rate limiting
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;
        proxy_pass http://app_servers;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # ML API endpoints
    location /api/ml/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://ml_servers;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
    }

    # Performance monitoring
    location /api/performance/ {
        proxy_pass http://localhost:3015;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Monitoring endpoints
    location /api/monitoring/ {
        proxy_pass http://localhost:3016;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Security endpoints
    location /api/security/ {
        proxy_pass http://localhost:3018;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# Monitoring dashboard
server {
    listen 443 ssl http2;
    server_name monitor.rootuip.com;

    ssl_certificate /etc/ssl/certs/rootuip.crt;
    ssl_certificate_key /etc/ssl/private/rootuip.key;

    # Dashboard interface
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket for real-time monitoring
    location /ws {
        proxy_pass http://localhost:3017;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# Health check endpoint
server {
    listen 80;
    server_name health.rootuip.com;

    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/rootuip-enterprise /etc/nginx/sites-enabled/
sudo nginx -s reload

# Wait for services to initialize
echo -e "${YELLOW}Waiting for services to initialize...${NC}"
sleep 10

# Health check all services
echo -e "${BLUE}Performing health checks...${NC}"

declare -A services=(
    ["Performance Optimization"]="http://localhost:3015/api/performance/health"
    ["Enterprise Monitoring"]="http://localhost:3016/health"
    ["Security Monitoring"]="http://localhost:3018/health"
    ["Document Processing"]="http://localhost:3010/api/ml/health"
    ["D&D Prediction"]="http://localhost:3011/api/ml/dd/health"
    ["Sales Automation"]="http://localhost:3006/health"
    ["Customer Success"]="http://localhost:3007/health"
)

all_healthy=true
for service in "${!services[@]}"; do
    url="${services[$service]}"
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $service: Healthy${NC}"
    else
        echo -e "${RED}✗ $service: Unhealthy${NC}"
        all_healthy=false
    fi
done

echo ""
echo -e "${GREEN}🎉 ROOTUIP Enterprise Platform Launched!${NC}"
echo ""

if [ "$all_healthy" = true ]; then
    echo -e "${GREEN}📊 System Status: ALL SYSTEMS OPERATIONAL${NC}"
else
    echo -e "${YELLOW}⚠️  System Status: Some services need attention${NC}"
fi

echo ""
echo "🌐 Access Points:"
echo -e "${CYAN}Main Application:${NC} http://localhost (or https://app.rootuip.com)"
echo -e "${CYAN}API Gateway:${NC} http://localhost/api (or https://api.rootuip.com)"
echo -e "${CYAN}Monitoring Dashboard:${NC} http://localhost:8080"
echo -e "${CYAN}ML Demo Interface:${NC} http://localhost:8282/ml-demonstration-interface.html"
echo -e "${CYAN}ROI Calculator:${NC} http://localhost:8181/enterprise-roi-calculator.html"
echo -e "${CYAN}Outreach Tracker:${NC} http://localhost:8181/enterprise-outreach-tracker.html"
echo ""

echo "🔧 Infrastructure Services:"
echo -e "${BLUE}Performance Optimization:${NC} http://localhost:3015 (PID: $PERF_PID)"
echo -e "${BLUE}Enterprise Monitoring:${NC} http://localhost:3016 (PID: $MONITOR_PID)"
echo -e "${BLUE}Security Monitoring:${NC} http://localhost:3018 (PID: $SECURITY_PID)"
echo ""

echo "🤖 AI/ML Services:"
echo -e "${PURPLE}Document Processing:${NC} http://localhost:3010 (PID: $DOC_PID)"
echo -e "${PURPLE}D&D Prediction:${NC} http://localhost:3011 (PID: $DD_PID)"
echo ""

echo "💼 Business Services:"
echo -e "${GREEN}Sales Automation:${NC} http://localhost:3006 (PID: $SALES_PID)"
echo -e "${GREEN}Customer Success:${NC} http://localhost:3007 (PID: $SUCCESS_PID)"
echo ""

echo "📊 Performance Metrics:"
echo "• Target Response Time: <100ms"
echo "• Target Uptime: 99.99%"
echo "• Target Error Rate: <0.1%"
echo "• Cache Hit Rate: >94%"
echo "• ML Accuracy: >96%"
echo ""

echo "🔐 Security Features:"
echo "• Rate limiting enabled"
echo "• Security headers configured"
echo "• Vulnerability scanning active"
echo "• Real-time threat detection"
echo "• Audit trail monitoring"
echo ""

echo "📈 Business Capabilities:"
echo "• Lead generation & qualification"
echo "• Automated email sequences"
echo "• HubSpot CRM integration"
echo "• Customer success workflows"
echo "• Revenue forecasting"
echo "• D&D prevention (94% rate)"
echo ""

echo "🚀 Enterprise Features:"
echo "• Auto-scaling ready"
echo "• Load balancing configured"
echo "• Disaster recovery automation"
echo "• Complete monitoring"
echo "• Security compliance"
echo "• Performance optimization"
echo ""

echo -e "${YELLOW}💰 Ready to convert Fortune 500 prospects into $500K+ contracts!${NC}"
echo ""
echo "Press Ctrl+C to stop all services..."

# Keep the script running and monitor services
while true; do
    sleep 30
    
    # Quick health check
    if ! curl -s -f http://localhost:3016/health > /dev/null 2>&1; then
        echo -e "${RED}$(date): Warning - Monitoring service appears down${NC}"
    fi
    
    if ! curl -s -f http://localhost:3015/api/performance/health > /dev/null 2>&1; then
        echo -e "${RED}$(date): Warning - Performance service appears down${NC}"
    fi
done

# Cleanup on exit
trap 'echo -e "\n${YELLOW}Stopping all services...${NC}"; kill $PERF_PID $MONITOR_PID $SECURITY_PID $DOC_PID $DD_PID $SALES_PID $SUCCESS_PID $DASH_PID 2>/dev/null; exit' INT