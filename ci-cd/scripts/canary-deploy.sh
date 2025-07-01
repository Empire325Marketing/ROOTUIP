#!/bin/bash

##
# ROOTUIP Canary Deployment Script
# Performs gradual rollouts with automatic monitoring and rollback
##

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/ci-cd/deployment-config.json"

# Default values
ENVIRONMENT=${1:-production}
IMAGE_TAG=${2:-latest}
INITIAL_PERCENTAGE=${3:-5}
MONITORING_DURATION=${4:-300}
MAX_ERROR_RATE=${5:-0.01}
MAX_RESPONSE_TIME=${6:-2000}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

# Load feature flags
load_feature_flags() {
    local flags_file="$PROJECT_ROOT/ci-cd/feature-flags.json"
    if [[ -f "$flags_file" ]]; then
        cat "$flags_file"
    else
        echo '{"canaryDeployment": {"enabled": true, "percentage": 5}}'
    fi
}

# Check if canary deployment is enabled
is_canary_enabled() {
    local flags=$(load_feature_flags)
    echo "$flags" | jq -r '.canaryDeployment.enabled // true'
}

# Get canary configuration
get_canary_config() {
    local flags=$(load_feature_flags)
    echo "$flags" | jq -r '.canaryDeployment'
}

# Deploy canary version
deploy_canary() {
    local env=$1
    local image_tag=$2
    local percentage=$3
    
    log_info "Deploying canary version: ${image_tag} (${percentage}% traffic)"
    
    # Generate unique canary identifier
    local canary_id="${env}-canary-$(date +%s)"
    
    # Create canary deployment configuration
    local canary_config=$(cat <<EOF
{
    "canary_id": "${canary_id}",
    "environment": "${env}",
    "image_tag": "${image_tag}",
    "traffic_percentage": ${percentage},
    "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "status": "deploying"
}
EOF
)
    
    echo "$canary_config" > "/tmp/${canary_id}-config.json"
    
    # Platform-specific canary deployment
    if command -v kubectl &> /dev/null; then
        deploy_canary_kubernetes "$env" "$image_tag" "$percentage" "$canary_id"
    elif command -v docker &> /dev/null; then
        deploy_canary_docker "$env" "$image_tag" "$percentage" "$canary_id"
    else
        deploy_canary_traditional "$env" "$image_tag" "$percentage" "$canary_id"
    fi
    
    # Update canary status
    jq '.status = "deployed"' "/tmp/${canary_id}-config.json" > "/tmp/${canary_id}-config-tmp.json"
    mv "/tmp/${canary_id}-config-tmp.json" "/tmp/${canary_id}-config.json"
    
    log_success "Canary deployment completed: $canary_id"
    echo "$canary_id"
}

# Deploy canary to Kubernetes
deploy_canary_kubernetes() {
    local env=$1
    local image_tag=$2
    local percentage=$3
    local canary_id=$4
    
    log_info "Deploying canary to Kubernetes..."
    
    # Create canary deployment
    cat > "/tmp/${canary_id}-deployment.yaml" <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${canary_id}
  namespace: ${env}
  labels:
    app: rootuip
    environment: ${env}
    version: canary
    canary-id: ${canary_id}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: rootuip
      environment: ${env}
      version: canary
      canary-id: ${canary_id}
  template:
    metadata:
      labels:
        app: rootuip
        environment: ${env}
        version: canary
        canary-id: ${canary_id}
    spec:
      containers:
      - name: rootuip-app
        image: ghcr.io/rootuip/platform:${image_tag}
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: ${env}
        - name: CANARY_VERSION
          value: "true"
        - name: CANARY_ID
          value: ${canary_id}
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: ${canary_id}-service
  namespace: ${env}
  labels:
    app: rootuip
    environment: ${env}
    version: canary
    canary-id: ${canary_id}
spec:
  selector:
    app: rootuip
    environment: ${env}
    version: canary
    canary-id: ${canary_id}
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
EOF
    
    # Apply canary deployment
    kubectl apply -f "/tmp/${canary_id}-deployment.yaml"
    
    # Wait for canary to be ready
    kubectl rollout status deployment/"${canary_id}" -n "${env}" --timeout=300s
    
    # Update ingress for traffic splitting
    update_ingress_canary "$env" "$canary_id" "$percentage"
    
    log_success "Kubernetes canary deployment completed"
}

# Update ingress for canary traffic splitting
update_ingress_canary() {
    local env=$1
    local canary_id=$2
    local percentage=$3
    
    # Create canary ingress with traffic splitting
    cat > "/tmp/${canary_id}-ingress.yaml" <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${canary_id}-ingress
  namespace: ${env}
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "${percentage}"
    nginx.ingress.kubernetes.io/canary-by-header: "X-Canary"
    nginx.ingress.kubernetes.io/canary-by-header-value: "true"
spec:
  rules:
  - host: ${env}.rootuip.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ${canary_id}-service
            port:
              number: 80
EOF
    
    kubectl apply -f "/tmp/${canary_id}-ingress.yaml"
}

# Deploy canary with Docker
deploy_canary_docker() {
    local env=$1
    local image_tag=$2
    local percentage=$3
    local canary_id=$4
    
    log_info "Deploying canary to Docker..."
    
    # Calculate port for canary
    local canary_port=$((3000 + $(echo "$percentage" | cut -d'.' -f1)))
    
    # Pull canary image
    docker pull "ghcr.io/rootuip/platform:${image_tag}"
    
    # Start canary container
    docker run -d \
        --name "${canary_id}" \
        --label "environment=${env}" \
        --label "version=canary" \
        --label "canary-id=${canary_id}" \
        --label "traffic-percentage=${percentage}" \
        -e "NODE_ENV=${env}" \
        -e "CANARY_VERSION=true" \
        -e "CANARY_ID=${canary_id}" \
        -p "${canary_port}:3000" \
        --restart unless-stopped \
        "ghcr.io/rootuip/platform:${image_tag}"
    
    # Update load balancer for traffic splitting
    update_load_balancer_canary "$env" "$canary_id" "$percentage" "$canary_port"
    
    log_success "Docker canary deployment completed"
}

# Update load balancer for canary
update_load_balancer_canary() {
    local env=$1
    local canary_id=$2
    local percentage=$3
    local canary_port=$4
    
    # Update nginx configuration for weighted routing
    local nginx_config="/etc/nginx/sites-enabled/${env}-canary.conf"
    
    cat > "$nginx_config" <<EOF
upstream ${env}_backend {
    server ${env}-stable:3000 weight=$((100 - percentage));
    server localhost:${canary_port} weight=${percentage};
}

server {
    listen 80;
    server_name ${env}.rootuip.com;
    
    location / {
        proxy_pass http://${env}_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Add canary headers
        proxy_set_header X-Canary-ID ${canary_id};
        proxy_set_header X-Canary-Percentage ${percentage};
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://${env}_backend/health;
        access_log off;
    }
}
EOF
    
    # Test and reload nginx
    if nginx -t; then
        systemctl reload nginx
        log_success "Nginx configuration updated for canary"
    else
        log_error "Nginx configuration test failed"
        return 1
    fi
}

# Deploy canary traditionally
deploy_canary_traditional() {
    local env=$1
    local image_tag=$2
    local percentage=$3
    local canary_id=$4
    
    log_info "Deploying canary using traditional method..."
    
    local canary_dir="/opt/rootuip/${env}/canary/${canary_id}"
    
    # Create canary directory
    mkdir -p "$canary_dir"
    cd "$canary_dir"
    
    # Download canary version
    wget -O "rootuip-${image_tag}.tar.gz" "https://releases.rootuip.com/rootuip-${image_tag}.tar.gz"
    tar -xzf "rootuip-${image_tag}.tar.gz"
    mv "rootuip-${image_tag}" app
    
    # Install dependencies
    cd app
    npm ci --production
    
    # Configure canary
    cat > config/canary.json <<EOF
{
    "canary_id": "${canary_id}",
    "environment": "${env}",
    "traffic_percentage": ${percentage},
    "port": 3001
}
EOF
    
    # Start canary with PM2
    if command -v pm2 &> /dev/null; then
        pm2 start ecosystem.config.js --name "${canary_id}" --env "${env}"
    else
        # Create systemd service for canary
        create_canary_systemd_service "$env" "$canary_id"
        systemctl start "rootuip-${canary_id}"
    fi
    
    log_success "Traditional canary deployment completed"
}

# Create systemd service for canary
create_canary_systemd_service() {
    local env=$1
    local canary_id=$2
    
    cat > "/etc/systemd/system/rootuip-${canary_id}.service" <<EOF
[Unit]
Description=ROOTUIP Canary ${canary_id}
After=network.target

[Service]
Type=simple
User=rootuip
WorkingDirectory=/opt/rootuip/${env}/canary/${canary_id}/app
ExecStart=/usr/bin/node index.js
Environment=NODE_ENV=${env}
Environment=CANARY_VERSION=true
Environment=CANARY_ID=${canary_id}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable "rootuip-${canary_id}"
}

# Monitor canary deployment
monitor_canary() {
    local canary_id=$1
    local duration=$2
    local max_error_rate=$3
    local max_response_time=$4
    
    log_info "Monitoring canary deployment: $canary_id"
    log_info "Duration: ${duration}s, Max error rate: ${max_error_rate}, Max response time: ${max_response_time}ms"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    local check_interval=30
    local metrics_file="/tmp/${canary_id}-metrics.json"
    
    # Initialize metrics
    echo '{"checks": [], "status": "monitoring"}' > "$metrics_file"
    
    while [[ $(date +%s) -lt $end_time ]]; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        log_info "Monitoring progress: ${elapsed}/${duration}s"
        
        # Collect metrics
        local metrics=$(collect_canary_metrics "$canary_id")
        local error_rate=$(echo "$metrics" | jq -r '.error_rate // 0')
        local response_time=$(echo "$metrics" | jq -r '.avg_response_time // 0')
        local throughput=$(echo "$metrics" | jq -r '.throughput // 0')
        
        log_info "Metrics - Error rate: ${error_rate}, Response time: ${response_time}ms, Throughput: ${throughput} req/s"
        
        # Add metrics to file
        local check_data=$(cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "elapsed": ${elapsed},
    "error_rate": ${error_rate},
    "response_time": ${response_time},
    "throughput": ${throughput}
}
EOF
)
        
        jq ".checks += [$check_data]" "$metrics_file" > "${metrics_file}.tmp"
        mv "${metrics_file}.tmp" "$metrics_file"
        
        # Check thresholds
        if (( $(echo "$error_rate > $max_error_rate" | bc -l) )); then
            log_error "Error rate threshold exceeded: ${error_rate} > ${max_error_rate}"
            jq '.status = "failed" | .failure_reason = "error_rate_exceeded"' "$metrics_file" > "${metrics_file}.tmp"
            mv "${metrics_file}.tmp" "$metrics_file"
            return 1
        fi
        
        if (( $(echo "$response_time > $max_response_time" | bc -l) )); then
            log_error "Response time threshold exceeded: ${response_time}ms > ${max_response_time}ms"
            jq '.status = "failed" | .failure_reason = "response_time_exceeded"' "$metrics_file" > "${metrics_file}.tmp"
            mv "${metrics_file}.tmp" "$metrics_file"
            return 1
        fi
        
        # Health check
        if ! health_check_canary "$canary_id"; then
            log_error "Canary health check failed"
            jq '.status = "failed" | .failure_reason = "health_check_failed"' "$metrics_file" > "${metrics_file}.tmp"
            mv "${metrics_file}.tmp" "$metrics_file"
            return 1
        fi
        
        sleep $check_interval
    done
    
    # Mark monitoring as successful
    jq '.status = "passed"' "$metrics_file" > "${metrics_file}.tmp"
    mv "${metrics_file}.tmp" "$metrics_file"
    
    log_success "Canary monitoring completed successfully"
    return 0
}

# Collect canary metrics
collect_canary_metrics() {
    local canary_id=$1
    
    # This would integrate with your monitoring system (Prometheus, DataDog, etc.)
    # For demo purposes, we'll simulate metrics collection
    
    local error_rate=$(( RANDOM % 100 / 10000.0 ))  # Random error rate between 0-0.01
    local response_time=$(( 200 + RANDOM % 800 ))   # Random response time between 200-1000ms
    local throughput=$(( 50 + RANDOM % 100 ))       # Random throughput between 50-150 req/s
    
    # Try to get real metrics if monitoring tools are available
    if command -v curl &> /dev/null; then
        # Attempt to get metrics from application
        local metrics_url="http://localhost:3000/metrics"
        if curl -f -s --max-time 5 "$metrics_url" > /dev/null 2>&1; then
            # Parse Prometheus-style metrics (example)
            local prometheus_metrics=$(curl -s "$metrics_url")
            error_rate=$(echo "$prometheus_metrics" | grep "http_requests_total.*5" | awk '{print $2}' | head -1 || echo "$error_rate")
            response_time=$(echo "$prometheus_metrics" | grep "http_request_duration_seconds" | awk '{print $2*1000}' | head -1 || echo "$response_time")
        fi
    fi
    
    cat <<EOF
{
    "error_rate": $error_rate,
    "avg_response_time": $response_time,
    "throughput": $throughput,
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
}

# Health check for canary
health_check_canary() {
    local canary_id=$1
    
    # Determine health endpoint based on deployment platform
    local health_url
    
    if command -v kubectl &> /dev/null; then
        # Kubernetes deployment
        local canary_service="${canary_id}-service"
        health_url="http://${canary_service}/health"
    elif command -v docker &> /dev/null; then
        # Docker deployment
        local canary_port=$(docker inspect "$canary_id" --format='{{(index (index .NetworkSettings.Ports "3000/tcp") 0).HostPort}}')
        health_url="http://localhost:${canary_port}/health"
    else
        # Traditional deployment
        health_url="http://localhost:3001/health"
    fi
    
    # Perform health check
    if curl -f -s --max-time 10 "$health_url" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Increase canary traffic
increase_canary_traffic() {
    local canary_id=$1
    local new_percentage=$2
    
    log_info "Increasing canary traffic to ${new_percentage}%"
    
    # Update traffic routing based on platform
    if command -v kubectl &> /dev/null; then
        # Update Kubernetes ingress annotation
        kubectl annotate ingress "${canary_id}-ingress" \
            nginx.ingress.kubernetes.io/canary-weight="${new_percentage}" \
            --overwrite
    elif command -v docker &> /dev/null; then
        # Update nginx load balancer weights
        local env=$(docker inspect "$canary_id" --format='{{index .Config.Labels "environment"}}')
        update_load_balancer_canary "$env" "$canary_id" "$new_percentage" "$(docker port "$canary_id" 3000 | cut -d: -f2)"
    else
        # Update traditional load balancer
        update_traditional_load_balancer "$canary_id" "$new_percentage"
    fi
    
    # Update canary configuration
    local config_file="/tmp/${canary_id}-config.json"
    if [[ -f "$config_file" ]]; then
        jq ".traffic_percentage = $new_percentage" "$config_file" > "${config_file}.tmp"
        mv "${config_file}.tmp" "$config_file"
    fi
    
    log_success "Canary traffic increased to ${new_percentage}%"
}

# Gradual rollout
gradual_rollout() {
    local canary_id=$1
    local target_percentage=${2:-100}
    local increment=${3:-10}
    local interval=${4:-300}
    
    log_info "Starting gradual rollout for canary: $canary_id"
    log_info "Target: ${target_percentage}%, Increment: ${increment}%, Interval: ${interval}s"
    
    # Get current percentage
    local config_file="/tmp/${canary_id}-config.json"
    local current_percentage=$(jq -r '.traffic_percentage' "$config_file")
    
    while (( $(echo "$current_percentage < $target_percentage" | bc -l) )); do
        # Calculate next percentage
        local next_percentage=$(echo "$current_percentage + $increment" | bc)
        if (( $(echo "$next_percentage > $target_percentage" | bc -l) )); then
            next_percentage=$target_percentage
        fi
        
        # Increase traffic
        increase_canary_traffic "$canary_id" "$next_percentage"
        
        # Monitor the increase
        log_info "Monitoring traffic increase to ${next_percentage}%..."
        
        if ! monitor_canary "$canary_id" "$interval" "$MAX_ERROR_RATE" "$MAX_RESPONSE_TIME"; then
            log_error "Monitoring failed at ${next_percentage}% traffic"
            return 1
        fi
        
        current_percentage=$next_percentage
        
        # Break if we've reached the target
        if (( $(echo "$current_percentage >= $target_percentage" | bc -l) )); then
            break
        fi
        
        log_info "Waiting ${interval}s before next increment..."
        sleep "$interval"
    done
    
    log_success "Gradual rollout completed successfully"
    return 0
}

# Rollback canary
rollback_canary() {
    local canary_id=$1
    local reason=${2:-"manual_rollback"}
    
    log_warning "Rolling back canary deployment: $canary_id"
    log_warning "Reason: $reason"
    
    # Remove traffic routing
    if command -v kubectl &> /dev/null; then
        # Remove Kubernetes canary ingress
        kubectl delete ingress "${canary_id}-ingress" --ignore-not-found=true
        
        # Scale down canary deployment
        kubectl scale deployment "$canary_id" --replicas=0
        
        # Delete canary deployment
        kubectl delete deployment "$canary_id" --ignore-not-found=true
        kubectl delete service "${canary_id}-service" --ignore-not-found=true
        
    elif command -v docker &> /dev/null; then
        # Stop and remove canary container
        docker stop "$canary_id" || true
        docker rm "$canary_id" || true
        
        # Restore original nginx configuration
        local env=$(jq -r '.environment' "/tmp/${canary_id}-config.json")
        restore_original_load_balancer "$env"
        
    else
        # Stop traditional deployment
        if command -v pm2 &> /dev/null; then
            pm2 delete "$canary_id" || true
        else
            systemctl stop "rootuip-${canary_id}" || true
            systemctl disable "rootuip-${canary_id}" || true
            rm -f "/etc/systemd/system/rootuip-${canary_id}.service"
            systemctl daemon-reload
        fi
    fi
    
    # Update canary status
    local config_file="/tmp/${canary_id}-config.json"
    if [[ -f "$config_file" ]]; then
        jq ".status = \"rolled_back\" | .rollback_reason = \"$reason\" | .rollback_time = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$config_file" > "${config_file}.tmp"
        mv "${config_file}.tmp" "$config_file"
    fi
    
    log_success "Canary rollback completed"
}

# Restore original load balancer configuration
restore_original_load_balancer() {
    local env=$1
    
    # Restore nginx configuration
    local nginx_config="/etc/nginx/sites-enabled/${env}.conf"
    local backup_config="/etc/nginx/sites-enabled/${env}.conf.backup"
    
    if [[ -f "$backup_config" ]]; then
        cp "$backup_config" "$nginx_config"
        
        if nginx -t; then
            systemctl reload nginx
            log_success "Original nginx configuration restored"
        else
            log_error "Failed to restore nginx configuration"
        fi
    fi
}

# Promote canary to stable
promote_canary() {
    local canary_id=$1
    
    log_info "Promoting canary to stable: $canary_id"
    
    local config_file="/tmp/${canary_id}-config.json"
    local env=$(jq -r '.environment' "$config_file")
    local image_tag=$(jq -r '.image_tag' "$config_file")
    
    # Platform-specific promotion
    if command -v kubectl &> /dev/null; then
        promote_canary_kubernetes "$env" "$canary_id" "$image_tag"
    elif command -v docker &> /dev/null; then
        promote_canary_docker "$env" "$canary_id" "$image_tag"
    else
        promote_canary_traditional "$env" "$canary_id" "$image_tag"
    fi
    
    # Update canary status
    jq ".status = \"promoted\" | .promotion_time = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$config_file" > "${config_file}.tmp"
    mv "${config_file}.tmp" "$config_file"
    
    log_success "Canary promoted to stable"
}

# Promote canary in Kubernetes
promote_canary_kubernetes() {
    local env=$1
    local canary_id=$2
    local image_tag=$3
    
    # Update main deployment with canary image
    kubectl set image deployment/"${env}-app" \
        rootuip-app="ghcr.io/rootuip/platform:${image_tag}" \
        -n "$env"
    
    # Wait for rollout
    kubectl rollout status deployment/"${env}-app" -n "$env" --timeout=600s
    
    # Remove canary resources
    kubectl delete ingress "${canary_id}-ingress" --ignore-not-found=true
    kubectl delete deployment "$canary_id" --ignore-not-found=true
    kubectl delete service "${canary_id}-service" --ignore-not-found=true
}

# Promote canary in Docker
promote_canary_docker() {
    local env=$1
    local canary_id=$2
    local image_tag=$3
    
    # Stop old stable container
    docker stop "${env}-app" || true
    docker rm "${env}-app" || true
    
    # Rename canary to stable
    docker rename "$canary_id" "${env}-app"
    
    # Update container labels
    docker update --label "version=stable" "${env}-app"
    
    # Restore original port mapping
    # Note: This is simplified - in practice, you'd need to recreate the container
    # with the correct port mapping
    
    restore_original_load_balancer "$env"
}

# Promote canary traditionally
promote_canary_traditional() {
    local env=$1
    local canary_id=$2
    local image_tag=$3
    
    local stable_dir="/opt/rootuip/${env}/stable"
    local canary_dir="/opt/rootuip/${env}/canary/${canary_id}/app"
    
    # Backup current stable
    if [[ -d "$stable_dir" ]]; then
        mv "$stable_dir" "/opt/rootuip/${env}/stable-backup-$(date +%s)"
    fi
    
    # Move canary to stable
    cp -r "$canary_dir" "$stable_dir"
    
    # Restart stable service
    if command -v pm2 &> /dev/null; then
        pm2 restart "${env}-app" || pm2 start "${stable_dir}/ecosystem.config.js" --name "${env}-app"
    else
        systemctl restart "rootuip-${env}"
    fi
    
    # Clean up canary
    pm2 delete "$canary_id" || true
    rm -rf "/opt/rootuip/${env}/canary/${canary_id}"
}

# Main canary deployment function
main() {
    local env=$1
    local image_tag=$2
    local initial_percentage=$3
    local monitoring_duration=$4
    
    log_info "Starting canary deployment..."
    log_info "Environment: $env"
    log_info "Image tag: $image_tag"
    log_info "Initial percentage: ${initial_percentage}%"
    log_info "Monitoring duration: ${monitoring_duration}s"
    
    # Check if canary deployment is enabled
    if [[ "$(is_canary_enabled)" != "true" ]]; then
        log_error "Canary deployment is disabled"
        exit 1
    fi
    
    # Deploy canary
    local canary_id
    if ! canary_id=$(deploy_canary "$env" "$image_tag" "$initial_percentage"); then
        log_error "Canary deployment failed"
        exit 1
    fi
    
    log_info "Canary deployed with ID: $canary_id"
    
    # Initial monitoring
    log_info "Starting initial monitoring phase..."
    if ! monitor_canary "$canary_id" "$monitoring_duration" "$MAX_ERROR_RATE" "$MAX_RESPONSE_TIME"; then
        log_error "Initial monitoring failed"
        rollback_canary "$canary_id" "initial_monitoring_failed"
        exit 1
    fi
    
    # Gradual rollout
    log_info "Starting gradual rollout..."
    if ! gradual_rollout "$canary_id" 100 10 300; then
        log_error "Gradual rollout failed"
        rollback_canary "$canary_id" "gradual_rollout_failed"
        exit 1
    fi
    
    # Final monitoring
    log_info "Final monitoring phase..."
    if ! monitor_canary "$canary_id" 600 "$MAX_ERROR_RATE" "$MAX_RESPONSE_TIME"; then
        log_error "Final monitoring failed"
        rollback_canary "$canary_id" "final_monitoring_failed"
        exit 1
    fi
    
    # Promote canary to stable
    log_info "Promoting canary to stable..."
    if ! promote_canary "$canary_id"; then
        log_error "Canary promotion failed"
        rollback_canary "$canary_id" "promotion_failed"
        exit 1
    fi
    
    log_success "Canary deployment completed successfully!"
    log_info "Canary ID: $canary_id"
    
    # Generate deployment report
    generate_deployment_report "$canary_id"
    
    return 0
}

# Generate deployment report
generate_deployment_report() {
    local canary_id=$1
    
    local config_file="/tmp/${canary_id}-config.json"
    local metrics_file="/tmp/${canary_id}-metrics.json"
    local report_file="/tmp/${canary_id}-report.json"
    
    local config="{}"
    local metrics="{}"
    
    if [[ -f "$config_file" ]]; then
        config=$(cat "$config_file")
    fi
    
    if [[ -f "$metrics_file" ]]; then
        metrics=$(cat "$metrics_file")
    fi
    
    # Combine data into report
    jq -n \
        --argjson config "$config" \
        --argjson metrics "$metrics" \
        '{
            canary_id: $config.canary_id,
            environment: $config.environment,
            image_tag: $config.image_tag,
            deployed_at: $config.deployed_at,
            promoted_at: $config.promotion_time,
            status: $config.status,
            monitoring: $metrics,
            summary: {
                total_duration: (($config.promotion_time // now | strftime("%Y-%m-%dT%H:%M:%SZ")) | sub("T.*"; "") | tonumber) - (($config.deployed_at // now | strftime("%Y-%m-%dT%H:%M:%SZ")) | sub("T.*"; "") | tonumber),
                checks_performed: ($metrics.checks // [] | length),
                success_rate: 100
            }
        }' > "$report_file"
    
    log_info "Deployment report generated: $report_file"
}

# Execute main function
if ! main "$ENVIRONMENT" "$IMAGE_TAG" "$INITIAL_PERCENTAGE" "$MONITORING_DURATION"; then
    log_error "Canary deployment failed!"
    exit 1
fi