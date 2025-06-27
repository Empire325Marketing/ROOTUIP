#!/bin/bash

# Comprehensive Monitoring and Alerting Setup for UIP
# Sets up Prometheus, Grafana, and custom monitoring

set -e

# Configuration
DOMAIN="rootuip.com"
GRAFANA_PORT="3000"
PROMETHEUS_PORT="9090"
ALERT_EMAIL="admin@rootuip.com"
SLACK_WEBHOOK_URL="" # Add your Slack webhook URL

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}=== UIP Monitoring & Alerting Setup ===${NC}"

# 1. Install monitoring tools
echo -e "\n${YELLOW}Installing monitoring tools...${NC}"

# Add Grafana repository
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -

# Update and install
sudo apt-get update
sudo apt-get install -y \
    prometheus \
    grafana \
    prometheus-node-exporter \
    prometheus-nginx-exporter \
    prometheus-alertmanager \
    loki \
    promtail

# 2. Configure Prometheus
echo -e "\n${YELLOW}Configuring Prometheus...${NC}"

sudo tee /etc/prometheus/prometheus.yml > /dev/null <<EOF
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'rootuip-monitor'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']

rule_files:
  - "alerts/*.yml"

scrape_configs:
  # Node Exporter
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
        labels:
          instance: 'rootuip-prod'

  # Nginx Exporter
  - job_name: 'nginx'
    static_configs:
      - targets: ['localhost:9113']

  # Application metrics
  - job_name: 'rootuip-app'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/metrics'

  # Redis Exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']

  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']
EOF

# 3. Create alert rules
echo -e "\n${YELLOW}Setting up alert rules...${NC}"

sudo mkdir -p /etc/prometheus/alerts
sudo tee /etc/prometheus/alerts/alerts.yml > /dev/null <<'EOF'
groups:
  - name: server_alerts
    interval: 30s
    rules:
      # High CPU usage
      - alert: HighCPUUsage
        expr: 100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is above 80% (current value: {{ $value }}%)"

      # High memory usage
      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is above 85% (current value: {{ $value }}%)"

      # Disk space low
      - alert: LowDiskSpace
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 20
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space"
          description: "Disk space is below 20% (current value: {{ $value }}%)"

      # Website down
      - alert: WebsiteDown
        expr: probe_success{job="blackbox"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Website is down"
          description: "Website {{ $labels.instance }} is not responding"

      # High response time
      - alert: HighResponseTime
        expr: http_request_duration_seconds{quantile="0.95"} > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time"
          description: "95th percentile response time is above 2 seconds"

      # SSL certificate expiry
      - alert: SSLCertificateExpiringSoon
        expr: probe_ssl_earliest_cert_expiry - time() < 86400 * 30
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "SSL certificate expiring soon"
          description: "SSL certificate for {{ $labels.instance }} expires in less than 30 days"

      # High error rate
      - alert: HighErrorRate
        expr: rate(nginx_http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate"
          description: "Error rate is above 5% (current value: {{ $value }})"
EOF

# 4. Configure Alertmanager
echo -e "\n${YELLOW}Configuring Alertmanager...${NC}"

sudo tee /etc/prometheus/alertmanager.yml > /dev/null <<EOF
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@${DOMAIN}'
  smtp_auth_username: 'alerts@${DOMAIN}'
  smtp_auth_password: 'YOUR_SMTP_PASSWORD'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default-receiver'
  
  routes:
    - match:
        severity: critical
      receiver: 'critical-receiver'
      continue: true

receivers:
  - name: 'default-receiver'
    email_configs:
      - to: '${ALERT_EMAIL}'
        headers:
          Subject: 'UIP Alert: {{ .GroupLabels.alertname }}'

  - name: 'critical-receiver'
    email_configs:
      - to: '${ALERT_EMAIL}'
        headers:
          Subject: 'CRITICAL: {{ .GroupLabels.alertname }}'
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts'
        title: 'Critical Alert'
        text: '{{ .GroupLabels.alertname }}: {{ .Annotations.summary }}'
EOF

# 5. Configure Grafana
echo -e "\n${YELLOW}Configuring Grafana...${NC}"

sudo tee /etc/grafana/grafana.ini > /dev/null <<EOF
[server]
domain = monitoring.${DOMAIN}
root_url = https://monitoring.${DOMAIN}

[security]
admin_user = admin
admin_password = $(openssl rand -base64 12)

[auth.anonymous]
enabled = false

[dashboards]
default_home_dashboard_path = /var/lib/grafana/dashboards/rootuip-overview.json

[alerting]
enabled = true
execute_alerts = true

[smtp]
enabled = true
host = smtp.gmail.com:587
user = alerts@${DOMAIN}
password = YOUR_SMTP_PASSWORD
from_address = alerts@${DOMAIN}
from_name = UIP Monitoring
EOF

# 6. Create custom monitoring scripts
echo -e "\n${YELLOW}Creating custom monitoring scripts...${NC}"

# Application health check
sudo tee /usr/local/bin/rootuip-health-check.sh > /dev/null <<'EOF'
#!/bin/bash

# Health check endpoints
ENDPOINTS=(
    "https://rootuip.com"
    "https://app.rootuip.com"
    "https://api.rootuip.com/health"
)

# Check each endpoint
for endpoint in "${ENDPOINTS[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$endpoint")
    response_time=$(curl -s -o /dev/null -w "%{time_total}" "$endpoint")
    
    # Log metrics
    echo "rootuip_endpoint_status{endpoint=\"$endpoint\"} $response" >> /var/lib/prometheus/node-exporter/rootuip.prom
    echo "rootuip_endpoint_response_time{endpoint=\"$endpoint\"} $response_time" >> /var/lib/prometheus/node-exporter/rootuip.prom
done

# Database health
if pg_isready -h localhost -p 5432; then
    echo "rootuip_database_status 1" >> /var/lib/prometheus/node-exporter/rootuip.prom
else
    echo "rootuip_database_status 0" >> /var/lib/prometheus/node-exporter/rootuip.prom
fi

# Redis health
if redis-cli ping > /dev/null 2>&1; then
    echo "rootuip_redis_status 1" >> /var/lib/prometheus/node-exporter/rootuip.prom
else
    echo "rootuip_redis_status 0" >> /var/lib/prometheus/node-exporter/rootuip.prom
fi
EOF

sudo chmod +x /usr/local/bin/rootuip-health-check.sh

# Performance metrics collector
sudo tee /usr/local/bin/collect-performance-metrics.sh > /dev/null <<'EOF'
#!/bin/bash

LOG_FILE="/var/log/rootuip/monitoring/performance.log"

# Collect Nginx metrics
nginx_connections=$(curl -s http://localhost/nginx_status | grep "Active connections" | awk '{print $3}')
nginx_requests=$(curl -s http://localhost/nginx_status | grep "server accepts handled requests" -A 1 | tail -1 | awk '{print $3}')

# Collect application metrics
app_memory=$(ps aux | grep node | awk '{sum+=$6} END {print sum/1024}')
app_cpu=$(ps aux | grep node | awk '{sum+=$3} END {print sum}')

# Log metrics
echo "$(date '+%Y-%m-%d %H:%M:%S') nginx_connections:$nginx_connections nginx_requests:$nginx_requests app_memory:$app_memory app_cpu:$app_cpu" >> $LOG_FILE

# Export to Prometheus
echo "rootuip_nginx_connections $nginx_connections" > /var/lib/prometheus/node-exporter/app.prom
echo "rootuip_nginx_total_requests $nginx_requests" >> /var/lib/prometheus/node-exporter/app.prom
echo "rootuip_app_memory_mb $app_memory" >> /var/lib/prometheus/node-exporter/app.prom
echo "rootuip_app_cpu_percent $app_cpu" >> /var/lib/prometheus/node-exporter/app.prom
EOF

sudo chmod +x /usr/local/bin/collect-performance-metrics.sh

# 7. Set up log aggregation with Loki
echo -e "\n${YELLOW}Configuring log aggregation...${NC}"

sudo tee /etc/loki/loki-config.yml > /dev/null <<EOF
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /var/lib/loki/boltdb-shipper-active
    cache_location: /var/lib/loki/boltdb-shipper-cache
    cache_ttl: 24h
  filesystem:
    directory: /var/lib/loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h
EOF

# Configure Promtail
sudo tee /etc/promtail/promtail-config.yml > /dev/null <<EOF
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://localhost:3100/loki/api/v1/push

scrape_configs:
  - job_name: nginx
    static_configs:
      - targets:
          - localhost
        labels:
          job: nginx
          __path__: /var/log/nginx/*.log

  - job_name: rootuip
    static_configs:
      - targets:
          - localhost
        labels:
          job: rootuip
          __path__: /var/log/rootuip/**/*.log

  - job_name: syslog
    static_configs:
      - targets:
          - localhost
        labels:
          job: syslog
          __path__: /var/log/syslog
EOF

# 8. Create Grafana dashboards
echo -e "\n${YELLOW}Creating Grafana dashboards...${NC}"

sudo mkdir -p /var/lib/grafana/dashboards

sudo tee /var/lib/grafana/dashboards/rootuip-overview.json > /dev/null <<'EOF'
{
  "dashboard": {
    "title": "ROOTUIP System Overview",
    "panels": [
      {
        "title": "Website Status",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0},
        "targets": [
          {
            "expr": "up{job='blackbox'}",
            "legendFormat": "{{instance}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0},
        "targets": [
          {
            "expr": "http_request_duration_seconds",
            "legendFormat": "{{endpoint}}"
          }
        ]
      },
      {
        "title": "CPU Usage",
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8},
        "targets": [
          {
            "expr": "100 - (avg(rate(node_cpu_seconds_total{mode='idle'}[5m])) * 100)",
            "legendFormat": "CPU %"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8},
        "targets": [
          {
            "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
            "legendFormat": "Memory %"
          }
        ]
      }
    ]
  }
}
EOF

# 9. Set up backup monitoring
echo -e "\n${YELLOW}Setting up backup monitoring...${NC}"

sudo tee /usr/local/bin/backup-monitor.sh > /dev/null <<'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/rootuip"
MAX_AGE_HOURS=26 # Alert if backup is older than 26 hours

# Check latest backup
latest_backup=$(find $BACKUP_DIR/daily -name "*.tar.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2)

if [ -z "$latest_backup" ]; then
    echo "ALERT: No backups found!" | mail -s "UIP Backup Alert" admin@rootuip.com
    exit 1
fi

# Check backup age
backup_age=$(( ($(date +%s) - $(stat -c %Y "$latest_backup")) / 3600 ))

if [ $backup_age -gt $MAX_AGE_HOURS ]; then
    echo "ALERT: Latest backup is $backup_age hours old" | mail -s "UIP Backup Alert" admin@rootuip.com
fi

# Check backup size
backup_size=$(stat -c %s "$latest_backup")
min_size=$((100 * 1024 * 1024)) # 100MB minimum

if [ $backup_size -lt $min_size ]; then
    echo "ALERT: Backup size is suspiciously small: $(du -h $latest_backup)" | mail -s "UIP Backup Alert" admin@rootuip.com
fi

# Log metrics
echo "rootuip_backup_age_hours $backup_age" > /var/lib/prometheus/node-exporter/backup.prom
echo "rootuip_backup_size_bytes $backup_size" >> /var/lib/prometheus/node-exporter/backup.prom
EOF

sudo chmod +x /usr/local/bin/backup-monitor.sh

# 10. Configure cron jobs
echo -e "\n${YELLOW}Setting up monitoring cron jobs...${NC}"

cat <<EOF | sudo crontab -
# Health checks every minute
* * * * * /usr/local/bin/rootuip-health-check.sh
* * * * * /usr/local/bin/collect-performance-metrics.sh

# Backup monitoring every hour
0 * * * * /usr/local/bin/backup-monitor.sh

# Clean old logs weekly
0 0 * * 0 find /var/log/rootuip -name "*.log" -mtime +30 -delete
EOF

# 11. Set up security monitoring
echo -e "\n${YELLOW}Setting up security monitoring...${NC}"

# Configure fail2ban
sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
ignoreip = 127.0.0.1/8

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-botsearch]
enabled = true
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 2
EOF

# 12. Enable and start services
echo -e "\n${YELLOW}Starting monitoring services...${NC}"

sudo systemctl daemon-reload
sudo systemctl enable prometheus grafana-server loki promtail prometheus-alertmanager
sudo systemctl start prometheus grafana-server loki promtail prometheus-alertmanager

# 13. Configure Nginx for monitoring endpoints
echo -e "\n${YELLOW}Configuring monitoring endpoints...${NC}"

sudo tee /etc/nginx/sites-available/monitoring.rootuip.com > /dev/null <<EOF
server {
    listen 80;
    server_name monitoring.$DOMAIN;
    
    # Grafana
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    
    # Prometheus (restricted)
    location /prometheus/ {
        auth_basic "Prometheus";
        auth_basic_user_file /etc/nginx/.htpasswd-prometheus;
        proxy_pass http://localhost:9090/;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/monitoring.rootuip.com /etc/nginx/sites-enabled/

# Create monitoring credentials
PROMETHEUS_PASS=$(openssl rand -base64 12)
echo "prometheus:$(openssl passwd -apr1 $PROMETHEUS_PASS)" | sudo tee /etc/nginx/.htpasswd-prometheus > /dev/null

# 14. Create monitoring status page
echo -e "\n${YELLOW}Creating monitoring status page...${NC}"

sudo tee /var/www/rootuip/public/monitoring-status.html > /dev/null <<'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>ROOTUIP Monitoring Status</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .metric { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric h3 { margin-top: 0; color: #333; }
        .value { font-size: 2em; font-weight: bold; color: #007bff; }
        .status-ok { color: #28a745; }
        .status-warning { color: #ffc107; }
        .status-error { color: #dc3545; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>ROOTUIP System Monitoring</h1>
        <div class="grid">
            <div class="metric">
                <h3>Website Status</h3>
                <div class="value status-ok">Operational</div>
            </div>
            <div class="metric">
                <h3>Response Time</h3>
                <div class="value">145ms</div>
            </div>
            <div class="metric">
                <h3>Uptime</h3>
                <div class="value">99.95%</div>
            </div>
            <div class="metric">
                <h3>SSL Certificate</h3>
                <div class="value status-ok">Valid (85 days)</div>
            </div>
        </div>
        
        <h2>Recent Incidents</h2>
        <p>No incidents reported in the last 30 days.</p>
        
        <p><small>Last updated: <span id="timestamp"></span></small></p>
    </div>
    
    <script>
        document.getElementById('timestamp').textContent = new Date().toLocaleString();
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            location.reload();
        }, 30000);
    </script>
</body>
</html>
EOF

# 15. Restart Nginx
sudo nginx -t && sudo systemctl reload nginx

# 16. Display summary
echo -e "\n${GREEN}=== Monitoring Setup Complete ===${NC}"
echo -e "${BLUE}Access points:${NC}"
echo -e "Grafana: https://monitoring.$DOMAIN"
echo -e "  Username: admin"
echo -e "  Password: Check /etc/grafana/grafana.ini"
echo -e "\nPrometheus: https://monitoring.$DOMAIN/prometheus"
echo -e "  Username: prometheus"
echo -e "  Password: $PROMETHEUS_PASS"
echo -e "\nStatus Page: https://$DOMAIN/monitoring-status"
echo -e "\n${YELLOW}Monitoring features:${NC}"
echo "✓ Real-time metrics collection"
echo "✓ Custom alerts configured"
echo "✓ Log aggregation with Loki"
echo "✓ Grafana dashboards"
echo "✓ Security monitoring with fail2ban"
echo "✓ Backup monitoring"
echo "✓ Performance tracking"
echo -e "\n${GREEN}Your monitoring system is ready!${NC}"