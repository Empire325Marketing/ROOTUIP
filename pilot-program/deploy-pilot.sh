#!/bin/bash
# Deploy ROOTUIP Pilot Program

echo "🚀 Deploying ROOTUIP Pilot Program..."

# Load environment variables
export $(cat /home/iii/ROOTUIP/.env.pilot | grep -v '^#' | xargs)

# Create nginx configuration
cat > /tmp/pilot.rootuip.com << 'EOF'
# Pilot Dashboard Configuration
server {
    listen 80;
    server_name pilot.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name pilot.rootuip.com;

    # SSL configuration (using existing rootuip.com certificate)
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval';" always;

    # Pilot dashboard static files
    root /home/iii/ROOTUIP/pilot-program;
    index pilot-tracking-dashboard.html;

    location / {
        try_files $uri $uri/ @backend;
    }

    # Pilot API endpoints
    location /api/pilot {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Feedback form
    location /feedback {
        alias /home/iii/ROOTUIP/pilot-program/feedback-collection-system.html;
    }

    # Executive presentation
    location /presentation {
        alias /home/iii/ROOTUIP/pilot-program/executive-presentation-template.html;
    }

    # Reports download (protected)
    location /reports {
        alias /home/iii/ROOTUIP/reports;
        autoindex on;
    }

    # Backend fallback
    location @backend {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Logging
    access_log /var/log/nginx/pilot.rootuip.com.access.log;
    error_log /var/log/nginx/pilot.rootuip.com.error.log;
}
EOF

echo "Nginx configuration created. Please run:"
echo "sudo cp /tmp/pilot.rootuip.com /etc/nginx/sites-available/"
echo "sudo ln -s /etc/nginx/sites-available/pilot.rootuip.com /etc/nginx/sites-enabled/"
echo "sudo nginx -t && sudo systemctl reload nginx"

# Update API gateway to include pilot routes
echo "Adding pilot routes to API gateway..."
cd /home/iii/ROOTUIP

# Check if pilot routes are already added
if ! grep -q "pilot-program/pilot-routes" api-gateway.js; then
    # Add before the last line of the file
    sed -i '$i\
\
// Pilot Program Routes\
const pilotRoutes = require("./pilot-program/pilot-routes");\
app.use("/api/pilot", pilotRoutes);\
\
// Automated report generation\
const reportGenerator = require("./pilot-program/automated-report-generator");\
app.use("/api/pilot/reports", reportGenerator);\
' api-gateway.js
fi

# Create PM2 ecosystem file for pilot services
cat > /home/iii/ROOTUIP/pilot-program/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'pilot-api',
      script: 'node',
      args: 'api-gateway.js',
      cwd: '/home/iii/ROOTUIP',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_file: '/home/iii/ROOTUIP/.env.pilot'
    },
    {
      name: 'pilot-slack',
      script: 'pilot-slack-integration.js',
      cwd: '/home/iii/ROOTUIP/pilot-program',
      env_file: '/home/iii/ROOTUIP/.env.pilot',
      error_file: '/home/iii/ROOTUIP/logs/pilot-slack-error.log',
      out_file: '/home/iii/ROOTUIP/logs/pilot-slack-out.log'
    }
  ]
};
EOF

# Test Slack connection
echo "Testing Slack API connection..."
node -e "
const { WebClient } = require('@slack/web-api');
const token = process.env.SLACK_BOT_TOKEN || '$SLACK_BOT_TOKEN';
const slack = new WebClient(token);

(async () => {
  try {
    const result = await slack.auth.test();
    console.log('✅ Slack connection successful!');
    console.log('Bot User ID:', result.user_id);
    console.log('Team:', result.team);
  } catch (error) {
    console.error('❌ Slack connection failed:', error.message);
  }
})();
"

# Create quick access scripts
cat > /home/iii/ROOTUIP/pilot-program/pilot-admin.sh << 'EOF'
#!/bin/bash
# ROOTUIP Pilot Program Admin Script

case "$1" in
  start)
    echo "Starting pilot services..."
    pm2 start /home/iii/ROOTUIP/pilot-program/ecosystem.config.js
    ;;
  stop)
    echo "Stopping pilot services..."
    pm2 stop pilot-api pilot-slack
    ;;
  restart)
    echo "Restarting pilot services..."
    pm2 restart pilot-api pilot-slack
    ;;
  status)
    pm2 status pilot-api pilot-slack
    ;;
  logs)
    pm2 logs ${2:-pilot-api}
    ;;
  report)
    echo "Generating pilot report..."
    curl -X POST http://localhost:3001/api/pilot/reports/generate \
      -H "Content-Type: application/json" \
      -d '{"customerId": "'${2:-pilot-001}'", "reportType": "'${3:-weekly}'"}'
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs|report} [options]"
    exit 1
    ;;
esac
EOF

chmod +x /home/iii/ROOTUIP/pilot-program/pilot-admin.sh

echo "✅ Pilot program deployment script complete!"
echo ""
echo "Quick commands:"
echo "./pilot-admin.sh start    - Start all pilot services"
echo "./pilot-admin.sh status   - Check service status"
echo "./pilot-admin.sh logs     - View logs"
echo "./pilot-admin.sh report   - Generate report"
echo ""
echo "Access points:"
echo "Dashboard: https://pilot.rootuip.com"
echo "Feedback: https://pilot.rootuip.com/feedback"
echo "Presentation: https://pilot.rootuip.com/presentation"