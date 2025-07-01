#!/bin/bash

##
# ROOTUIP Blue-Green Deployment Script
# Performs zero-downtime deployments using blue-green strategy
##

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/ci-cd/deployment-config.json"

# Load configuration
if [[ -f "$CONFIG_FILE" ]]; then
    DEPLOYMENT_CONFIG=$(cat "$CONFIG_FILE")
else
    echo "❌ Deployment configuration not found: $CONFIG_FILE"
    exit 1
fi

# Default values
ENVIRONMENT=${1:-staging}
TARGET_COLOR=${2:-blue}
IMAGE_TAG=${3:-latest}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}
VALIDATION_TIMEOUT=${VALIDATION_TIMEOUT:-600}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get current active environment
get_active_environment() {
    local env=$1
    
    # Query load balancer or ingress controller for current routing
    if command -v kubectl &> /dev/null; then
        # Kubernetes deployment
        kubectl get service "${env}-app-service" -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "none"
    elif command -v docker &> /dev/null; then
        # Docker deployment
        docker ps --filter "label=environment=${env}" --filter "label=active=true" --format "{{.Labels}}" | grep -o "color=[^,]*" | cut -d= -f2 || echo "none"
    else
        # Check nginx or other proxy configuration
        if [[ -f "/etc/nginx/sites-enabled/${env}.conf" ]]; then
            grep -o "upstream.*${env}-[^;]*" "/etc/nginx/sites-enabled/${env}.conf" | grep -o "[^-]*$" || echo "none"
        else
            echo "none"
        fi
    fi
}

# Get inactive environment color
get_inactive_color() {
    local active_color=$1
    
    if [[ "$active_color" == "blue" ]]; then
        echo "green"
    elif [[ "$active_color" == "green" ]]; then
        echo "blue"
    else
        echo "blue"  # Default to blue if no active environment
    fi
}

# Health check function
health_check() {
    local env=$1
    local color=$2
    local timeout=$3
    
    log_info "Performing health check for ${env}-${color}..."
    
    local health_url
    if [[ "$env" == "production" ]]; then
        health_url="https://${color}.rootuip.com/health"
    else
        health_url="https://${color}-${env}.rootuip.com/health"
    fi
    
    local start_time=$(date +%s)
    local end_time=$((start_time + timeout))
    
    while [[ $(date +%s) -lt $end_time ]]; do
        if curl -f -s --max-time 10 "$health_url" > /dev/null 2>&1; then
            log_success "Health check passed for ${env}-${color}"
            return 0
        fi
        
        log_info "Health check failed, retrying in 10 seconds..."
        sleep 10
    done
    
    log_error "Health check failed for ${env}-${color} after ${timeout} seconds"
    return 1
}

# Smoke test function
run_smoke_tests() {
    local env=$1
    local color=$2
    
    log_info "Running smoke tests for ${env}-${color}..."
    
    local base_url
    if [[ "$env" == "production" ]]; then
        base_url="https://${color}.rootuip.com"
    else
        base_url="https://${color}-${env}.rootuip.com"
    fi
    
    # Test critical endpoints
    local endpoints=(
        "/health"
        "/api/health"
        "/api/version"
        "/api/auth/status"
    )
    
    for endpoint in "${endpoints[@]}"; do
        log_info "Testing endpoint: ${endpoint}"
        
        if ! curl -f -s --max-time 30 "${base_url}${endpoint}" > /dev/null; then
            log_error "Smoke test failed for endpoint: ${endpoint}"
            return 1
        fi
    done
    
    # Run performance check
    log_info "Running performance check..."
    local response_time=$(curl -o /dev/null -s -w '%{time_total}' "${base_url}/api/health")
    local response_time_ms=$(echo "$response_time * 1000" | bc)
    
    if (( $(echo "$response_time_ms > 2000" | bc -l) )); then
        log_warning "Response time is high: ${response_time_ms}ms"
    else
        log_success "Response time is acceptable: ${response_time_ms}ms"
    fi
    
    log_success "Smoke tests passed for ${env}-${color}"
    return 0
}

# Deploy to target environment
deploy_to_environment() {
    local env=$1
    local color=$2
    local image_tag=$3
    
    log_info "Deploying ${image_tag} to ${env}-${color}..."
    
    # Create deployment configuration
    local deploy_config=$(cat <<EOF
{
    "environment": "${env}",
    "color": "${color}",
    "image_tag": "${image_tag}",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "deployment_id": "${env}-${color}-$(date +%s)"
}
EOF
)
    
    echo "$deploy_config" > "/tmp/${env}-${color}-deploy.json"
    
    # Platform-specific deployment
    if command -v kubectl &> /dev/null; then
        deploy_kubernetes "$env" "$color" "$image_tag"
    elif command -v docker &> /dev/null; then
        deploy_docker "$env" "$color" "$image_tag"
    else
        deploy_traditional "$env" "$color" "$image_tag"
    fi
    
    log_success "Deployment completed for ${env}-${color}"
}

# Kubernetes deployment
deploy_kubernetes() {
    local env=$1
    local color=$2
    local image_tag=$3
    
    log_info "Deploying to Kubernetes cluster..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace "${env}" --dry-run=client -o yaml | kubectl apply -f -
    
    # Generate deployment manifest
    cat > "/tmp/${env}-${color}-deployment.yaml" <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${env}-${color}-app
  namespace: ${env}
  labels:
    app: rootuip
    environment: ${env}
    color: ${color}
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rootuip
      environment: ${env}
      color: ${color}
  template:
    metadata:
      labels:
        app: rootuip
        environment: ${env}
        color: ${color}
    spec:
      containers:
      - name: rootuip-app
        image: ghcr.io/rootuip/platform:${image_tag}
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: ${env}
        - name: COLOR
          value: ${color}
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
  name: ${env}-${color}-service
  namespace: ${env}
  labels:
    app: rootuip
    environment: ${env}
    color: ${color}
spec:
  selector:
    app: rootuip
    environment: ${env}
    color: ${color}
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
EOF
    
    # Apply deployment
    kubectl apply -f "/tmp/${env}-${color}-deployment.yaml"
    
    # Wait for rollout to complete
    kubectl rollout status deployment/"${env}-${color}-app" -n "${env}" --timeout=600s
    
    log_success "Kubernetes deployment completed"
}

# Docker deployment
deploy_docker() {
    local env=$1
    local color=$2
    local image_tag=$3
    
    log_info "Deploying to Docker..."
    
    # Stop existing container if running
    if docker ps -q --filter "name=${env}-${color}-app" | grep -q .; then
        log_info "Stopping existing container..."
        docker stop "${env}-${color}-app" || true
        docker rm "${env}-${color}-app" || true
    fi
    
    # Pull latest image
    docker pull "ghcr.io/rootuip/platform:${image_tag}"
    
    # Start new container
    docker run -d \
        --name "${env}-${color}-app" \
        --label "environment=${env}" \
        --label "color=${color}" \
        --label "active=false" \
        -e "NODE_ENV=${env}" \
        -e "COLOR=${color}" \
        -p "${PORT:-3000}:3000" \
        --restart unless-stopped \
        "ghcr.io/rootuip/platform:${image_tag}"
    
    log_success "Docker deployment completed"
}

# Traditional deployment
deploy_traditional() {
    local env=$1
    local color=$2
    local image_tag=$3
    
    log_info "Deploying using traditional method..."
    
    local deploy_dir="/opt/rootuip/${env}/${color}"
    
    # Create deployment directory
    mkdir -p "$deploy_dir"
    
    # Download and extract application
    cd "$deploy_dir"
    
    # Backup current version
    if [[ -d "current" ]]; then
        mv current "backup-$(date +%s)"
    fi
    
    # Download new version
    wget -O "rootuip-${image_tag}.tar.gz" "https://releases.rootuip.com/rootuip-${image_tag}.tar.gz"
    tar -xzf "rootuip-${image_tag}.tar.gz"
    mv "rootuip-${image_tag}" current
    
    # Install dependencies
    cd current
    npm ci --production
    
    # Update configuration
    cat > config/environment.json <<EOF
{
    "environment": "${env}",
    "color": "${color}",
    "port": 3000
}
EOF
    
    # Start application with PM2
    if command -v pm2 &> /dev/null; then
        pm2 start ecosystem.config.js --name "${env}-${color}" --env "${env}"
    else
        # Start with systemd
        systemctl start "rootuip-${env}-${color}"
    fi
    
    log_success "Traditional deployment completed"
}

# Switch traffic to new environment
switch_traffic() {
    local env=$1
    local new_color=$2
    local old_color=$3
    
    log_info "Switching traffic from ${old_color} to ${new_color} in ${env}..."
    
    if command -v kubectl &> /dev/null; then
        switch_traffic_kubernetes "$env" "$new_color" "$old_color"
    elif command -v docker &> /dev/null; then
        switch_traffic_docker "$env" "$new_color" "$old_color"
    else
        switch_traffic_nginx "$env" "$new_color" "$old_color"
    fi
    
    log_success "Traffic switched to ${new_color}"
}

# Switch traffic in Kubernetes
switch_traffic_kubernetes() {
    local env=$1
    local new_color=$2
    local old_color=$3
    
    # Update ingress to point to new service
    kubectl patch ingress "${env}-ingress" -n "${env}" \
        --type='json' \
        -p="[{\"op\": \"replace\", \"path\": \"/spec/rules/0/http/paths/0/backend/service/name\", \"value\": \"${env}-${new_color}-service\"}]"
    
    # Update service selector
    kubectl patch service "${env}-app-service" -n "${env}" \
        --type='json' \
        -p="[{\"op\": \"replace\", \"path\": \"/spec/selector/color\", \"value\": \"${new_color}\"}]"
}

# Switch traffic in Docker
switch_traffic_docker() {
    local env=$1
    local new_color=$2
    local old_color=$3
    
    # Update container labels
    docker update --label "active=true" "${env}-${new_color}-app"
    
    if [[ "$old_color" != "none" ]]; then
        docker update --label "active=false" "${env}-${old_color}-app"
    fi
    
    # Update load balancer configuration
    update_load_balancer_config "$env" "$new_color"
}

# Switch traffic using nginx
switch_traffic_nginx() {
    local env=$1
    local new_color=$2
    local old_color=$3
    
    local nginx_config="/etc/nginx/sites-enabled/${env}.conf"
    
    # Backup current configuration
    cp "$nginx_config" "${nginx_config}.backup-$(date +%s)"
    
    # Update upstream configuration
    sed -i "s/server ${env}-${old_color}:3000/server ${env}-${new_color}:3000/g" "$nginx_config"
    
    # Test nginx configuration
    if nginx -t; then
        # Reload nginx
        systemctl reload nginx
        log_success "Nginx configuration updated and reloaded"
    else
        # Restore backup
        mv "${nginx_config}.backup-$(date +%s)" "$nginx_config"
        log_error "Nginx configuration test failed, restored backup"
        return 1
    fi
}

# Update load balancer configuration
update_load_balancer_config() {
    local env=$1
    local new_color=$2
    
    # Update HAProxy or other load balancer
    if command -v haproxy &> /dev/null; then
        # Generate new HAProxy configuration
        cat > "/tmp/haproxy-${env}.cfg" <<EOF
global
    daemon
    
defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    
frontend ${env}_frontend
    bind *:80
    default_backend ${env}_backend
    
backend ${env}_backend
    balance roundrobin
    server ${env}_app ${env}-${new_color}:3000 check
EOF
        
        # Reload HAProxy
        haproxy -f "/tmp/haproxy-${env}.cfg" -D -p "/var/run/haproxy-${env}.pid" -sf "$(cat "/var/run/haproxy-${env}.pid" 2>/dev/null || echo '')"
    fi
}

# Validation tests
run_validation_tests() {
    local env=$1
    local color=$2
    
    log_info "Running validation tests for ${env}-${color}..."
    
    # Run comprehensive test suite
    local base_url
    if [[ "$env" == "production" ]]; then
        base_url="https://${color}.rootuip.com"
    else
        base_url="https://${color}-${env}.rootuip.com"
    fi
    
    # API functionality tests
    log_info "Testing API functionality..."
    
    # Test authentication
    local auth_response=$(curl -s -w "%{http_code}" -o /tmp/auth_test.json \
        -X POST "${base_url}/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"test","password":"test"}')
    
    if [[ "$auth_response" -ne 200 ]]; then
        log_error "Authentication test failed"
        return 1
    fi
    
    # Test data retrieval
    local data_response=$(curl -s -w "%{http_code}" -o /tmp/data_test.json \
        "${base_url}/api/shipments?limit=1")
    
    if [[ "$data_response" -ne 200 ]]; then
        log_error "Data retrieval test failed"
        return 1
    fi
    
    # Test database connectivity
    local db_response=$(curl -s -w "%{http_code}" -o /tmp/db_test.json \
        "${base_url}/api/health/database")
    
    if [[ "$db_response" -ne 200 ]]; then
        log_error "Database connectivity test failed"
        return 1
    fi
    
    # Load testing (light)
    log_info "Running light load test..."
    
    if command -v ab &> /dev/null; then
        # Apache Bench load test
        ab -n 100 -c 10 "${base_url}/api/health" > /tmp/load_test.log 2>&1
        
        local success_rate=$(grep "Percentage of the requests served" /tmp/load_test.log | awk '{print $7}' | sed 's/%//')
        
        if (( $(echo "$success_rate < 99" | bc -l) )); then
            log_warning "Load test success rate: ${success_rate}%"
        else
            log_success "Load test success rate: ${success_rate}%"
        fi
    fi
    
    log_success "Validation tests completed"
    return 0
}

# Cleanup old environment
cleanup_old_environment() {
    local env=$1
    local old_color=$2
    
    if [[ "$old_color" == "none" ]]; then
        log_info "No old environment to cleanup"
        return 0
    fi
    
    log_info "Cleaning up old environment: ${env}-${old_color}"
    
    # Wait a bit before cleanup to ensure traffic has switched
    sleep 30
    
    if command -v kubectl &> /dev/null; then
        # Scale down old deployment
        kubectl scale deployment "${env}-${old_color}-app" -n "${env}" --replicas=0
        
        # Optional: Delete old deployment after grace period
        # kubectl delete deployment "${env}-${old_color}-app" -n "${env}"
    elif command -v docker &> /dev/null; then
        # Stop old container
        docker stop "${env}-${old_color}-app" || true
        
        # Optional: Remove old container
        # docker rm "${env}-${old_color}-app" || true
    else
        # Stop old service
        if command -v pm2 &> /dev/null; then
            pm2 stop "${env}-${old_color}" || true
        else
            systemctl stop "rootuip-${env}-${old_color}" || true
        fi
    fi
    
    log_success "Old environment cleanup completed"
}

# Rollback function
rollback() {
    local env=$1
    local failed_color=$2
    local previous_color=$3
    
    log_warning "Rolling back from ${failed_color} to ${previous_color}..."
    
    # Switch traffic back
    switch_traffic "$env" "$previous_color" "$failed_color"
    
    # Cleanup failed deployment
    cleanup_old_environment "$env" "$failed_color"
    
    log_success "Rollback completed"
}

# Monitor deployment
monitor_deployment() {
    local env=$1
    local color=$2
    local duration=$3
    
    log_info "Monitoring deployment for ${duration} seconds..."
    
    local start_time=$(date +%s)
    local end_time=$((start_time + duration))
    local check_interval=30
    
    while [[ $(date +%s) -lt $end_time ]]; do
        # Check health
        if ! health_check "$env" "$color" 30; then
            log_error "Health check failed during monitoring"
            return 1
        fi
        
        # Check metrics (placeholder - integrate with monitoring system)
        log_info "Checking metrics..."
        
        # Check error rate
        local error_rate=$(get_error_rate "$env" "$color")
        if (( $(echo "$error_rate > 0.05" | bc -l) )); then
            log_error "Error rate too high: ${error_rate}"
            return 1
        fi
        
        # Check response time
        local response_time=$(get_response_time "$env" "$color")
        if (( $(echo "$response_time > 2000" | bc -l) )); then
            log_warning "Response time high: ${response_time}ms"
        fi
        
        sleep $check_interval
    done
    
    log_success "Monitoring completed successfully"
    return 0
}

# Get error rate (placeholder)
get_error_rate() {
    local env=$1
    local color=$2
    
    # This would integrate with your monitoring system
    # For now, return a dummy value
    echo "0.01"
}

# Get response time (placeholder)
get_response_time() {
    local env=$1
    local color=$2
    
    # This would integrate with your monitoring system
    # For now, return a dummy value
    echo "500"
}

# Main deployment function
main() {
    local env=$1
    local target_color=$2
    local image_tag=$3
    
    log_info "Starting blue-green deployment..."
    log_info "Environment: $env"
    log_info "Target color: $target_color"
    log_info "Image tag: $image_tag"
    
    # Get current active environment
    local active_color=$(get_active_environment "$env")
    log_info "Current active color: $active_color"
    
    # Validate target color
    if [[ "$target_color" == "$active_color" ]]; then
        log_error "Target color ($target_color) is the same as active color ($active_color)"
        exit 1
    fi
    
    # Deploy to target environment
    if ! deploy_to_environment "$env" "$target_color" "$image_tag"; then
        log_error "Deployment failed"
        exit 1
    fi
    
    # Health check
    if ! health_check "$env" "$target_color" "$HEALTH_CHECK_TIMEOUT"; then
        log_error "Health check failed"
        cleanup_old_environment "$env" "$target_color"
        exit 1
    fi
    
    # Run smoke tests
    if ! run_smoke_tests "$env" "$target_color"; then
        log_error "Smoke tests failed"
        cleanup_old_environment "$env" "$target_color"
        exit 1
    fi
    
    # Run validation tests
    if ! run_validation_tests "$env" "$target_color"; then
        log_error "Validation tests failed"
        cleanup_old_environment "$env" "$target_color"
        exit 1
    fi
    
    # Switch traffic
    if ! switch_traffic "$env" "$target_color" "$active_color"; then
        log_error "Traffic switch failed"
        rollback "$env" "$target_color" "$active_color"
        exit 1
    fi
    
    # Monitor new deployment
    if ! monitor_deployment "$env" "$target_color" 300; then
        log_error "Monitoring detected issues"
        rollback "$env" "$target_color" "$active_color"
        exit 1
    fi
    
    # Cleanup old environment
    cleanup_old_environment "$env" "$active_color"
    
    log_success "Blue-green deployment completed successfully!"
    log_info "Active environment: ${env}-${target_color}"
    
    # Update deployment status
    cat > "/tmp/${env}-deployment-status.json" <<EOF
{
    "environment": "${env}",
    "active_color": "${target_color}",
    "previous_color": "${active_color}",
    "image_tag": "${image_tag}",
    "deployment_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "status": "success"
}
EOF
    
    return 0
}

# Execute main function with error handling
if ! main "$ENVIRONMENT" "$TARGET_COLOR" "$IMAGE_TAG"; then
    log_error "Blue-green deployment failed!"
    
    # Update deployment status
    cat > "/tmp/${ENVIRONMENT}-deployment-status.json" <<EOF
{
    "environment": "${ENVIRONMENT}",
    "active_color": "$(get_active_environment "$ENVIRONMENT")",
    "target_color": "${TARGET_COLOR}",
    "image_tag": "${IMAGE_TAG}",
    "deployment_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "status": "failed"
}
EOF
    
    exit 1
fi