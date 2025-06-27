#!/bin/bash

# Monitoring Stack Installation Script
# This script installs Prometheus, Grafana, Node Exporter, and configures Nginx

set -e

echo "Starting monitoring stack installation..."

# Update system
apt-get update
apt-get upgrade -y

# Install required packages
apt-get install -y wget curl gnupg software-properties-common apt-transport-https nginx apache2-utils

# Create monitoring user
useradd --no-create-home --shell /bin/false prometheus || true
useradd --no-create-home --shell /bin/false node_exporter || true

# Create directories
mkdir -p /etc/prometheus /var/lib/prometheus
mkdir -p /etc/prometheus/rules.d
chown prometheus:prometheus /etc/prometheus /var/lib/prometheus

# Install Prometheus
PROMETHEUS_VERSION="2.45.0"
cd /tmp
wget https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz
tar xzf prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz
cp prometheus-${PROMETHEUS_VERSION}.linux-amd64/prometheus /usr/local/bin/
cp prometheus-${PROMETHEUS_VERSION}.linux-amd64/promtool /usr/local/bin/
cp -r prometheus-${PROMETHEUS_VERSION}.linux-amd64/consoles /etc/prometheus/
cp -r prometheus-${PROMETHEUS_VERSION}.linux-amd64/console_libraries /etc/prometheus/
chown -R prometheus:prometheus /etc/prometheus
chown prometheus:prometheus /usr/local/bin/prometheus /usr/local/bin/promtool
rm -rf prometheus-${PROMETHEUS_VERSION}.linux-amd64*

# Install Node Exporter
NODE_EXPORTER_VERSION="1.6.1"
wget https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz
tar xzf node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz
cp node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64/node_exporter /usr/local/bin/
chown node_exporter:node_exporter /usr/local/bin/node_exporter
rm -rf node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64*

# Install Grafana
wget -q -O - https://packages.grafana.com/gpg.key | apt-key add -
echo "deb https://packages.grafana.com/oss/deb stable main" | tee /etc/apt/sources.list.d/grafana.list
apt-get update
apt-get install -y grafana

# Create Prometheus configuration
cat > /etc/prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
    - static_configs:
        - targets: []

rule_files:
  - "/etc/prometheus/rules.d/*.yml"

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']
        labels:
          instance: 'rootuip-server'

  - job_name: 'grafana'
    static_configs:
      - targets: ['localhost:3000']
EOF

# Create alert rules
cat > /etc/prometheus/rules.d/node_alerts.yml << 'EOF'
groups:
  - name: node_alerts
    interval: 30s
    rules:
      - alert: HighCPUUsage
        expr: 100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is above 80% (current value: {{ $value }}%)"

      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is above 80% (current value: {{ $value }}%)"

      - alert: DiskSpaceLow
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 20
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space"
          description: "Disk space is below 20% (current value: {{ $value }}%)"

      - alert: ServiceDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Service is down"
          description: "{{ $labels.job }} on {{ $labels.instance }} is down"
EOF

chown -R prometheus:prometheus /etc/prometheus

# Create systemd service for Prometheus
cat > /etc/systemd/system/prometheus.service << 'EOF'
[Unit]
Description=Prometheus
Documentation=https://prometheus.io/docs/introduction/overview/
After=network-online.target

[Service]
Type=notify
User=prometheus
Group=prometheus
ExecStart=/usr/local/bin/prometheus \
  --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/var/lib/prometheus/ \
  --web.console.templates=/etc/prometheus/consoles \
  --web.console.libraries=/etc/prometheus/console_libraries \
  --web.enable-lifecycle \
  --web.enable-admin-api

[Install]
WantedBy=multi-user.target
EOF

# Create systemd service for Node Exporter
cat > /etc/systemd/system/node_exporter.service << 'EOF'
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

# Configure Grafana
cat > /etc/grafana/provisioning/datasources/prometheus.yaml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://localhost:9090
    isDefault: true
    editable: true
EOF

# Create Grafana dashboard provisioning
mkdir -p /etc/grafana/provisioning/dashboards
cat > /etc/grafana/provisioning/dashboards/dashboards.yaml << 'EOF'
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
EOF

# Create dashboards directory
mkdir -p /var/lib/grafana/dashboards

# Download Node Exporter Full dashboard
wget -O /var/lib/grafana/dashboards/node-exporter-full.json https://grafana.com/api/dashboards/1860/revisions/27/download

# Set permissions
chown -R grafana:grafana /var/lib/grafana/dashboards

# Generate basic auth password
MONITORING_PASSWORD=$(openssl rand -base64 32)
echo "admin:$MONITORING_PASSWORD" > /root/monitoring-credentials.txt
htpasswd -bc /etc/nginx/.htpasswd admin "$MONITORING_PASSWORD"

# Configure Nginx for monitoring.rootuip.com
cat > /etc/nginx/sites-available/monitoring.rootuip.com << 'EOF'
server {
    listen 80;
    server_name monitoring.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name monitoring.rootuip.com;

    # SSL configuration (you'll need to add certificates)
    # ssl_certificate /etc/letsencrypt/live/monitoring.rootuip.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/monitoring.rootuip.com/privkey.pem;

    # Basic authentication
    auth_basic "Monitoring Access";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # Grafana
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Prometheus
    location /prometheus/ {
        proxy_pass http://localhost:9090/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Enable Nginx site
ln -sf /etc/nginx/sites-available/monitoring.rootuip.com /etc/nginx/sites-enabled/

# Create a simple HTTP version for now (without SSL)
cat > /etc/nginx/sites-available/monitoring-http << 'EOF'
server {
    listen 80;
    server_name monitoring.rootuip.com;

    # Basic authentication
    auth_basic "Monitoring Access";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # Grafana
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Prometheus
    location /prometheus/ {
        proxy_pass http://localhost:9090/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Use HTTP version for now
rm -f /etc/nginx/sites-enabled/monitoring.rootuip.com
ln -sf /etc/nginx/sites-available/monitoring-http /etc/nginx/sites-enabled/

# Reload systemd
systemctl daemon-reload

# Enable and start services
systemctl enable prometheus
systemctl enable node_exporter
systemctl enable grafana-server
systemctl enable nginx

systemctl start prometheus
systemctl start node_exporter
systemctl start grafana-server
systemctl restart nginx

# Wait for services to start
sleep 5

# Set Grafana admin password
GRAFANA_PASSWORD=$(openssl rand -base64 32)
echo "grafana-admin:$GRAFANA_PASSWORD" >> /root/monitoring-credentials.txt
curl -X PUT -H "Content-Type: application/json" -d "{\"oldPassword\":\"admin\",\"newPassword\":\"$GRAFANA_PASSWORD\",\"confirmNew\":\"$GRAFANA_PASSWORD\"}" http://admin:admin@localhost:3000/api/user/password

# Create status script
cat > /root/check-monitoring-status.sh << 'EOF'
#!/bin/bash
echo "=== Monitoring Stack Status ==="
echo
echo "Service Status:"
systemctl status prometheus --no-pager | grep Active
systemctl status node_exporter --no-pager | grep Active
systemctl status grafana-server --no-pager | grep Active
systemctl status nginx --no-pager | grep Active
echo
echo "Port Status:"
ss -tlnp | grep -E ':(3000|9090|9100|80|443)'
echo
echo "Credentials are stored in: /root/monitoring-credentials.txt"
echo
echo "Access URLs:"
echo "- Grafana: http://monitoring.rootuip.com/"
echo "- Prometheus: http://monitoring.rootuip.com/prometheus/"
EOF

chmod +x /root/check-monitoring-status.sh

echo
echo "=== Installation Complete ==="
echo
echo "Monitoring stack has been installed successfully!"
echo
echo "Credentials have been saved to: /root/monitoring-credentials.txt"
echo
echo "Access URLs:"
echo "- Grafana: http://monitoring.rootuip.com/"
echo "- Prometheus: http://monitoring.rootuip.com/prometheus/"
echo
echo "Run '/root/check-monitoring-status.sh' to check service status"