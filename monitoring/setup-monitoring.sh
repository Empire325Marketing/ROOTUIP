#!/bin/bash
# Complete Monitoring Setup Script for ROOTUIP

echo "🚀 Setting up comprehensive monitoring for ROOTUIP..."

# Create necessary directories
echo "Creating monitoring directories..."
mkdir -p /home/iii/ROOTUIP/monitoring/{prometheus/rules,alertmanager/templates,grafana/{provisioning/{datasources,dashboards},dashboards},loki,promtail}
mkdir -p /home/iii/ROOTUIP/logs/{scaling,backup,security}

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Start monitoring stack
echo "Starting monitoring stack..."
cd /home/iii/ROOTUIP/monitoring
docker-compose -f monitoring-stack.yml up -d

# Wait for services to start
echo "Waiting for services to initialize..."
sleep 30

# Configure Grafana
echo "Configuring Grafana..."
# Default admin password is already set in docker-compose
# Add API key for programmatic access
GRAFANA_API_KEY=$(curl -X POST -H "Content-Type: application/json" \
    -d '{"name":"monitoring-setup","role":"Admin"}' \
    http://admin:RootU1P2024!@localhost:3000/api/auth/keys | jq -r .key)

echo "GRAFANA_API_KEY=$GRAFANA_API_KEY" >> /home/iii/ROOTUIP/.env

# Setup backup monitoring cron
echo "Setting up backup monitoring..."
(crontab -l 2>/dev/null; echo "0 6 * * * /home/iii/ROOTUIP/monitoring/backup-monitoring.sh") | crontab -

# Install Sentry dependencies
echo "Installing Sentry SDK..."
cd /home/iii/ROOTUIP
npm install @sentry/node @sentry/tracing @sentry/profiling-node

# Setup nginx monitoring
echo "Configuring nginx monitoring..."
sudo apt-get update
sudo apt-get install -y nginx-module-njs

# Add nginx stub_status
sudo tee /etc/nginx/sites-available/nginx-status << EOF
server {
    listen 127.0.0.1:8080;
    server_name localhost;
    
    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/nginx-status /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Install blackbox exporter for endpoint monitoring
echo "Installing Blackbox Exporter..."
docker run -d \
    --name blackbox-exporter \
    --restart unless-stopped \
    -p 9115:9115 \
    prom/blackbox-exporter:latest

# Setup Prometheus Pushgateway for batch jobs
echo "Installing Prometheus Pushgateway..."
docker run -d \
    --name pushgateway \
    --restart unless-stopped \
    -p 9091:9091 \
    prom/pushgateway:latest

# Create monitoring endpoints in existing services
echo "Adding monitoring endpoints to services..."

# Add Prometheus metrics to API Gateway
cat >> /home/iii/ROOTUIP/api-gateway.js << 'EOF'

// Prometheus metrics endpoint
const promClient = require('prom-client');
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics();

app.get('/gateway/metrics', (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(promClient.register.metrics());
});
EOF

# Create automated report script
cat > /home/iii/ROOTUIP/monitoring/daily-report.sh << 'EOF'
#!/bin/bash
# Daily executive report

REPORT_DATE=$(date +%Y-%m-%d)
REPORT_FILE="/home/iii/ROOTUIP/reports/daily-report-$REPORT_DATE.html"

mkdir -p /home/iii/ROOTUIP/reports

# Generate HTML report
cat > "$REPORT_FILE" << HTML
<!DOCTYPE html>
<html>
<head>
    <title>ROOTUIP Daily Report - $REPORT_DATE</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; }
        .good { color: green; }
        .warning { color: orange; }
        .critical { color: red; }
    </style>
</head>
<body>
    <h1>ROOTUIP Daily Executive Report</h1>
    <h2>Date: $REPORT_DATE</h2>
    
    <div id="metrics-content">
        <!-- Metrics will be inserted here by JavaScript -->
    </div>
    
    <script>
        fetch('http://localhost:3001/api/monitoring/executive-summary')
            .then(response => response.json())
            .then(data => {
                document.getElementById('metrics-content').innerHTML = `
                    <h3>Business Metrics</h3>
                    <div class="metric">
                        <strong>MRR:</strong> $${data.revenue.mrr.toLocaleString()}<br>
                        <strong>Growth Rate:</strong> ${data.revenue.growthRate}%<br>
                        <strong>New Customers:</strong> ${data.revenue.newCustomersThisMonth}
                    </div>
                    
                    <h3>System Health</h3>
                    <div class="metric">
                        <strong>Uptime:</strong> ${data.performance.uptime}<br>
                        <strong>D&D Prevention Rate:</strong> ${data.performance.ml.preventionRate}%<br>
                        <strong>Error Rate:</strong> ${data.performance.errorRate}
                    </div>
                    
                    <h3>Alerts</h3>
                    <div class="metric">
                        <strong>Critical:</strong> <span class="${data.risks.alerts.critical > 0 ? 'critical' : 'good'}">${data.risks.alerts.critical}</span><br>
                        <strong>Warnings:</strong> <span class="${data.risks.alerts.warning > 5 ? 'warning' : 'good'}">${data.risks.alerts.warning}</span>
                    </div>
                `;
            });
    </script>
</body>
</html>
HTML

# Email the report
echo "Daily report generated: $REPORT_FILE" | mail -s "ROOTUIP Daily Report - $REPORT_DATE" -a "$REPORT_FILE" ops@rootuip.com
EOF

chmod +x /home/iii/ROOTUIP/monitoring/daily-report.sh

# Schedule daily report
(crontab -l 2>/dev/null; echo "0 8 * * * /home/iii/ROOTUIP/monitoring/daily-report.sh") | crontab -

# Create monitoring health check
cat > /home/iii/ROOTUIP/monitoring/health-check.sh << 'EOF'
#!/bin/bash
# Check all monitoring components

SERVICES=("prometheus:9090" "grafana:3000" "alertmanager:9093" "loki:3100")
FAILED=0

for SERVICE in "${SERVICES[@]}"; do
    SERVICE_NAME=$(echo $SERVICE | cut -d: -f1)
    SERVICE_PORT=$(echo $SERVICE | cut -d: -f2)
    
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$SERVICE_PORT | grep -q "200\|302"; then
        echo "✓ $SERVICE_NAME is healthy"
    else
        echo "✗ $SERVICE_NAME is down"
        FAILED=$((FAILED + 1))
    fi
done

if [ $FAILED -gt 0 ]; then
    echo "WARNING: $FAILED monitoring services are down"
    exit 1
else
    echo "All monitoring services are healthy"
    exit 0
fi
EOF

chmod +x /home/iii/ROOTUIP/monitoring/health-check.sh

echo "✅ Monitoring setup complete!"
echo ""
echo "Access points:"
echo "- Grafana: http://localhost:3000 (admin / RootU1P2024!)"
echo "- Prometheus: http://localhost:9090"
echo "- AlertManager: http://localhost:9093"
echo "- Loki (logs): http://localhost:3100"
echo ""
echo "Next steps:"
echo "1. Configure SMTP settings in alertmanager.yml"
echo "2. Add PagerDuty integration keys"
echo "3. Set up Sentry DSN for each service"
echo "4. Configure StatusPage.io at https://manage.statuspage.io"
echo "5. Add DataDog/New Relic agents if using those services"
echo ""
echo "Run health check: ./monitoring/health-check.sh"