#!/bin/bash

# ROOTUIP Production Monitoring Script
# Monitors all services and system health

echo "📊 ROOTUIP Production Monitoring"
echo "================================"
echo "Press Ctrl+C to exit"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to check service health
check_service() {
    local service_name=$1
    local port=$2
    local endpoint=${3:-"/health"}
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}${endpoint}" 2>/dev/null)
    
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✓${NC} ${service_name} (port ${port})"
    else
        echo -e "${RED}✗${NC} ${service_name} (port ${port}) - HTTP ${response}"
    fi
}

# Function to check system resources
check_system() {
    echo -e "\n${YELLOW}📈 SYSTEM RESOURCES${NC}"
    echo "─────────────────────"
    
    # CPU Usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -f1 -d'%')
    echo "CPU Usage: ${cpu_usage}%"
    
    # Memory Usage
    memory_usage=$(free | grep Mem | awk '{print ($3/$2) * 100.0}' | cut -f1 -d'.')
    echo "Memory Usage: ${memory_usage}%"
    
    # Disk Usage
    disk_usage=$(df -h / | awk 'NR==2 {print $5}')
    echo "Disk Usage: ${disk_usage}"
    
    # Load Average
    load_avg=$(uptime | awk -F'load average:' '{print $2}')
    echo "Load Average:${load_avg}"
}

# Function to check database connections
check_database() {
    echo -e "\n${YELLOW}🗄️  DATABASE STATUS${NC}"
    echo "─────────────────────"
    
    # PostgreSQL
    if pg_isready -q 2>/dev/null; then
        echo -e "${GREEN}✓${NC} PostgreSQL is ready"
        # Count connections
        conn_count=$(sudo -u postgres psql -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname='rootuip_production';" 2>/dev/null | tr -d ' ')
        echo "  Active connections: ${conn_count:-0}"
    else
        echo -e "${RED}✗${NC} PostgreSQL is not responding"
    fi
    
    # Redis
    if redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Redis is ready"
        # Get memory usage
        redis_mem=$(redis-cli info memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')
        echo "  Memory usage: ${redis_mem:-unknown}"
    else
        echo -e "${RED}✗${NC} Redis is not responding"
    fi
}

# Function to check PM2 processes
check_pm2() {
    echo -e "\n${YELLOW}🔄 PM2 PROCESSES${NC}"
    echo "─────────────────────"
    
    if command -v pm2 &> /dev/null; then
        pm2 list --no-color | grep -E "rootuip-|online|stopped|errored" | while read line; do
            if echo "$line" | grep -q "online"; then
                echo -e "${GREEN}✓${NC} $line"
            elif echo "$line" | grep -q "stopped\|errored"; then
                echo -e "${RED}✗${NC} $line"
            else
                echo "$line"
            fi
        done
    else
        echo -e "${RED}PM2 not installed${NC}"
    fi
}

# Function to check recent logs
check_logs() {
    echo -e "\n${YELLOW}📝 RECENT ERROR LOGS${NC}"
    echo "─────────────────────"
    
    log_dir="/var/www/rootuip/logs"
    if [ -d "$log_dir" ]; then
        # Check for recent errors (last 5 minutes)
        recent_errors=$(find "$log_dir" -name "*error.log" -mmin -5 -exec grep -l "ERROR\|FATAL" {} \; 2>/dev/null)
        
        if [ -z "$recent_errors" ]; then
            echo -e "${GREEN}✓${NC} No recent errors in logs"
        else
            echo -e "${RED}⚠️  Recent errors found in:${NC}"
            echo "$recent_errors"
        fi
    else
        echo "Log directory not found"
    fi
}

# Function to test API endpoints
test_endpoints() {
    echo -e "\n${YELLOW}🌐 API ENDPOINTS${NC}"
    echo "─────────────────────"
    
    # Test main endpoints
    endpoints=(
        "https://rootuip.com|Main Site"
        "https://rootuip.com/api/health|API Gateway"
        "https://rootuip.com/app.html|Application"
    )
    
    for endpoint in "${endpoints[@]}"; do
        IFS='|' read -r url name <<< "$endpoint"
        response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
        
        if [ "$response" = "200" ] || [ "$response" = "301" ] || [ "$response" = "302" ]; then
            echo -e "${GREEN}✓${NC} ${name}: ${url} (${response})"
        else
            echo -e "${RED}✗${NC} ${name}: ${url} (${response})"
        fi
    done
}

# Main monitoring loop
while true; do
    clear
    echo "📊 ROOTUIP Production Monitoring"
    echo "================================"
    echo "Time: $(date)"
    echo ""
    
    # Check services
    echo -e "${YELLOW}🚀 SERVICES STATUS${NC}"
    echo "─────────────────────"
    check_service "API Gateway" 3007
    check_service "Auth Service" 3003
    check_service "Demo Platform" 3001
    check_service "AI/ML Engine" 3002
    check_service "WebSocket Server" 3004
    check_service "Maersk Service" 3005
    check_service "Customer Success" 3006
    
    # Check system resources
    check_system
    
    # Check databases
    check_database
    
    # Check PM2
    check_pm2
    
    # Check logs
    check_logs
    
    # Test endpoints (only every 5th iteration to avoid rate limiting)
    if [ $((SECONDS % 50)) -lt 10 ]; then
        test_endpoints
    fi
    
    echo -e "\n${YELLOW}Refreshing in 10 seconds... (Ctrl+C to exit)${NC}"
    sleep 10
done