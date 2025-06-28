#!/bin/bash

# ROOTUIP Auto-Scaling Configuration Script
# Sets up horizontal scaling for ML services

set -e

echo "==================================="
echo "ROOTUIP Auto-Scaling Setup"
echo "==================================="

# Configuration
BASE_DIR="/home/iii/ROOTUIP"
ML_PORT_START=3104
PYTHON_PORT_START=8001
INSTANCES=${1:-2}  # Number of additional instances

# Create scaling directory
mkdir -p "$BASE_DIR/scaling"

# Function to create ML server instance
create_ml_instance() {
    local instance=$1
    local port=$((ML_PORT_START + instance * 100))
    
    cat > "$BASE_DIR/scaling/ml-server-$instance.service" << EOF
[Unit]
Description=ROOTUIP ML Server Instance $instance
After=network.target

[Service]
Type=simple
User=iii
Group=iii
WorkingDirectory=$BASE_DIR/ml_system
Environment="NODE_ENV=production"
Environment="PORT=$port"
Environment="INSTANCE_ID=ml-$instance"
ExecStart=/usr/bin/node $BASE_DIR/ml_system/ml-server.js
Restart=always
RestartSec=10
StandardOutput=append:$BASE_DIR/logs/ml-server-$instance.log
StandardError=append:$BASE_DIR/logs/ml-server-$instance-error.log

[Install]
WantedBy=multi-user.target
EOF

    echo "Created ML instance $instance on port $port"
}

# Function to create Python API instance
create_python_instance() {
    local instance=$1
    local port=$((PYTHON_PORT_START + instance))
    
    cat > "$BASE_DIR/scaling/python-api-$instance.service" << EOF
[Unit]
Description=ROOTUIP Python API Instance $instance
After=network.target

[Service]
Type=simple
User=iii
Group=iii
WorkingDirectory=$BASE_DIR/ml-system
Environment="PORT=$port"
Environment="INSTANCE_ID=python-$instance"
ExecStart=/home/iii/ROOTUIP/.venv/bin/uvicorn api:app --host 0.0.0.0 --port $port --workers 2
Restart=always
RestartSec=10
StandardOutput=append:$BASE_DIR/logs/python-api-$instance.log
StandardError=append:$BASE_DIR/logs/python-api-$instance-error.log

[Install]
WantedBy=multi-user.target
EOF

    echo "Created Python API instance $instance on port $port"
}

# Create HAProxy configuration for advanced load balancing
cat > "$BASE_DIR/scaling/haproxy.cfg" << 'EOF'
global
    log /dev/log local0
    chroot /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin
    stats timeout 30s
    user haproxy
    group haproxy
    daemon

defaults
    log     global
    mode    http
    option  httplog
    option  dontlognull
    timeout connect 5000
    timeout client  50000
    timeout server  50000
    errorfile 400 /etc/haproxy/errors/400.http
    errorfile 403 /etc/haproxy/errors/403.http
    errorfile 408 /etc/haproxy/errors/408.http
    errorfile 500 /etc/haproxy/errors/500.http
    errorfile 502 /etc/haproxy/errors/502.http
    errorfile 503 /etc/haproxy/errors/503.http
    errorfile 504 /etc/haproxy/errors/504.http

# Statistics
stats enable
stats uri /haproxy?stats
stats realm ROOTUIP\ Statistics
stats auth admin:secure-password-here

# ML Backend
backend ml_servers
    balance leastconn
    option httpchk GET /ml/health
    http-check expect status 200
    
    server ml-primary localhost:3004 check weight 3
EOF

# Add instances to HAProxy config
for ((i=1; i<=INSTANCES; i++)); do
    port=$((ML_PORT_START + i * 100))
    echo "    server ml-instance-$i localhost:$port check weight 2" >> "$BASE_DIR/scaling/haproxy.cfg"
done

cat >> "$BASE_DIR/scaling/haproxy.cfg" << 'EOF'

# Python API Backend
backend python_api_servers
    balance leastconn
    option httpchk GET /health
    http-check expect status 200
    
    server python-primary localhost:8000 check weight 3
EOF

# Add Python instances to HAProxy config
for ((i=1; i<=INSTANCES; i++)); do
    port=$((PYTHON_PORT_START + i))
    echo "    server python-instance-$i localhost:$port check weight 2" >> "$BASE_DIR/scaling/haproxy.cfg"
done

cat >> "$BASE_DIR/scaling/haproxy.cfg" << 'EOF'

# Frontend configuration
frontend rootuip_frontend
    bind *:80
    # bind *:443 ssl crt /etc/ssl/rootuip.com.pem
    
    # ACLs
    acl is_ml path_beg /ml/
    acl is_python path_beg /api/python/
    
    # Use backends
    use_backend ml_servers if is_ml
    use_backend python_api_servers if is_python
    
    default_backend ml_servers
EOF

# Create auto-scaling rules
cat > "$BASE_DIR/scaling/auto-scale-rules.json" << EOF
{
  "rules": [
    {
      "name": "scale-up-cpu",
      "metric": "cpu",
      "threshold": 70,
      "duration": 300,
      "action": "scale-up",
      "cooldown": 600
    },
    {
      "name": "scale-down-cpu",
      "metric": "cpu",
      "threshold": 30,
      "duration": 600,
      "action": "scale-down",
      "cooldown": 900
    },
    {
      "name": "scale-up-response-time",
      "metric": "response_time_p95",
      "threshold": 200,
      "duration": 180,
      "action": "scale-up",
      "cooldown": 600
    },
    {
      "name": "scale-up-queue",
      "metric": "queue_size",
      "threshold": 100,
      "duration": 60,
      "action": "scale-up",
      "cooldown": 300
    }
  ],
  "limits": {
    "min_instances": 1,
    "max_instances": 10,
    "scale_increment": 1
  }
}
EOF

# Create auto-scaling monitor script
cat > "$BASE_DIR/scaling/auto-scale-monitor.js" << 'EOF'
#!/usr/bin/env node

const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class AutoScaler {
    constructor() {
        this.rules = [];
        this.metrics = {};
        this.lastScaleAction = {};
        this.currentInstances = {
            ml: 1,
            python: 1
        };
    }

    async loadRules() {
        const rulesData = await fs.readFile('/home/iii/ROOTUIP/scaling/auto-scale-rules.json', 'utf8');
        const config = JSON.parse(rulesData);
        this.rules = config.rules;
        this.limits = config.limits;
    }

    async collectMetrics() {
        // Collect metrics from monitoring service
        try {
            const response = await fetch('http://localhost:3006/metrics');
            const data = await response.json();
            
            this.metrics = {
                cpu: data.system.cpu,
                memory: data.system.memory.percent,
                response_time_p95: data.business.p95ResponseTime || 50,
                queue_size: data.business.predictionQueueSize || 0,
                error_rate: data.business.errorRate || 0
            };
        } catch (error) {
            console.error('Failed to collect metrics:', error);
        }
    }

    evaluateRules() {
        const now = Date.now();
        
        for (const rule of this.rules) {
            const metricValue = this.metrics[rule.metric];
            
            if (metricValue === undefined) continue;
            
            // Check if threshold is exceeded
            const shouldTrigger = rule.action === 'scale-up' ? 
                metricValue > rule.threshold : 
                metricValue < rule.threshold;
            
            if (shouldTrigger) {
                // Check cooldown
                const lastAction = this.lastScaleAction[rule.name] || 0;
                if (now - lastAction < rule.cooldown * 1000) {
                    console.log(`Rule ${rule.name} in cooldown period`);
                    continue;
                }
                
                // Execute scaling action
                this.executeScaling(rule);
                this.lastScaleAction[rule.name] = now;
            }
        }
    }

    async executeScaling(rule) {
        console.log(`Executing ${rule.action} based on rule ${rule.name}`);
        
        if (rule.action === 'scale-up') {
            if (this.currentInstances.ml >= this.limits.max_instances) {
                console.log('Max instances reached');
                return;
            }
            
            const newInstance = this.currentInstances.ml + 1;
            await this.startInstance('ml', newInstance);
            this.currentInstances.ml = newInstance;
            
        } else if (rule.action === 'scale-down') {
            if (this.currentInstances.ml <= this.limits.min_instances) {
                console.log('Min instances reached');
                return;
            }
            
            const instanceToStop = this.currentInstances.ml;
            await this.stopInstance('ml', instanceToStop);
            this.currentInstances.ml = instanceToStop - 1;
        }
    }

    async startInstance(type, instanceId) {
        try {
            const serviceName = `${type}-server-${instanceId}`;
            await execAsync(`sudo systemctl start ${serviceName}`);
            console.log(`Started ${serviceName}`);
            
            // Update load balancer configuration
            await this.updateLoadBalancer();
        } catch (error) {
            console.error(`Failed to start instance:`, error);
        }
    }

    async stopInstance(type, instanceId) {
        try {
            const serviceName = `${type}-server-${instanceId}`;
            await execAsync(`sudo systemctl stop ${serviceName}`);
            console.log(`Stopped ${serviceName}`);
            
            // Update load balancer configuration
            await this.updateLoadBalancer();
        } catch (error) {
            console.error(`Failed to stop instance:`, error);
        }
    }

    async updateLoadBalancer() {
        // Reload nginx configuration
        try {
            await execAsync('sudo nginx -s reload');
            console.log('Load balancer configuration updated');
        } catch (error) {
            console.error('Failed to update load balancer:', error);
        }
    }

    async start() {
        await this.loadRules();
        console.log('Auto-scaler started');
        
        // Run every 30 seconds
        setInterval(async () => {
            await this.collectMetrics();
            this.evaluateRules();
        }, 30000);
    }
}

// Start auto-scaler
const scaler = new AutoScaler();
scaler.start();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down auto-scaler...');
    process.exit(0);
});
EOF

chmod +x "$BASE_DIR/scaling/auto-scale-monitor.js"

# Create scaling management script
cat > "$BASE_DIR/scaling/manage-scaling.sh" << 'EOF'
#!/bin/bash

# ROOTUIP Scaling Management Script

case "$1" in
    start)
        echo "Starting auto-scaling monitor..."
        nohup /home/iii/ROOTUIP/scaling/auto-scale-monitor.js > /home/iii/ROOTUIP/logs/auto-scaler.log 2>&1 &
        echo $! > /home/iii/ROOTUIP/scaling/auto-scaler.pid
        echo "Auto-scaler started"
        ;;
    stop)
        if [ -f /home/iii/ROOTUIP/scaling/auto-scaler.pid ]; then
            kill $(cat /home/iii/ROOTUIP/scaling/auto-scaler.pid)
            rm /home/iii/ROOTUIP/scaling/auto-scaler.pid
            echo "Auto-scaler stopped"
        else
            echo "Auto-scaler not running"
        fi
        ;;
    status)
        if [ -f /home/iii/ROOTUIP/scaling/auto-scaler.pid ]; then
            if ps -p $(cat /home/iii/ROOTUIP/scaling/auto-scaler.pid) > /dev/null; then
                echo "Auto-scaler is running"
            else
                echo "Auto-scaler is not running (stale PID file)"
            fi
        else
            echo "Auto-scaler is not running"
        fi
        ;;
    scale-up)
        echo "Manually scaling up..."
        # Add logic for manual scale up
        ;;
    scale-down)
        echo "Manually scaling down..."
        # Add logic for manual scale down
        ;;
    *)
        echo "Usage: $0 {start|stop|status|scale-up|scale-down}"
        exit 1
        ;;
esac
EOF

chmod +x "$BASE_DIR/scaling/manage-scaling.sh"

# Create instance service files
for ((i=1; i<=INSTANCES; i++)); do
    create_ml_instance $i
    create_python_instance $i
done

echo ""
echo "==================================="
echo "Auto-Scaling Setup Complete!"
echo "==================================="
echo ""
echo "Created configurations for $INSTANCES additional instances"
echo ""
echo "To deploy the services:"
echo "1. Copy service files: sudo cp $BASE_DIR/scaling/*.service /etc/systemd/system/"
echo "2. Reload systemd: sudo systemctl daemon-reload"
echo "3. Start auto-scaler: $BASE_DIR/scaling/manage-scaling.sh start"
echo ""
echo "To use HAProxy instead of Nginx:"
echo "1. Install HAProxy: sudo apt-get install haproxy"
echo "2. Copy config: sudo cp $BASE_DIR/scaling/haproxy.cfg /etc/haproxy/"
echo "3. Start HAProxy: sudo systemctl start haproxy"
echo ""
echo "Monitor scaling activity:"
echo "tail -f $BASE_DIR/logs/auto-scaler.log"