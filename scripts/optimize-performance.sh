#!/bin/bash

# ROOTUIP Performance Optimization Script
# Optimizes system performance for ML processing

echo "======================================"
echo "ROOTUIP Performance Optimization"
echo "======================================"
echo "Starting at: $(date)"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if running with appropriate privileges
if [ "$EUID" -ne 0 ] && [ "$1" != "--user" ]; then 
    echo -e "${YELLOW}Note: Some optimizations require sudo. Run with sudo for full optimization.${NC}"
    echo "Continuing with user-level optimizations..."
    echo ""
fi

# 1. Node.js Optimization
echo -e "${YELLOW}1. Optimizing Node.js processes...${NC}"

# Set Node.js memory limits
export NODE_OPTIONS="--max-old-space-size=2048"

# Enable production mode
export NODE_ENV=production

# Clear npm cache
npm cache clean --force 2>/dev/null || echo "Skipping npm cache clean (requires npm)"

echo -e "${GREEN}✓ Node.js optimized${NC}"

# 2. Python Optimization
echo -e "\n${YELLOW}2. Optimizing Python environment...${NC}"

# Remove Python cache files
find /home/iii/ROOTUIP -name "*.pyc" -delete 2>/dev/null
find /home/iii/ROOTUIP -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null

# Set Python optimization flags
export PYTHONOPTIMIZE=1
export PYTHONDONTWRITEBYTECODE=1

echo -e "${GREEN}✓ Python optimized${NC}"

# 3. PostgreSQL Optimization (requires sudo)
if [ "$EUID" -eq 0 ]; then
    echo -e "\n${YELLOW}3. Optimizing PostgreSQL...${NC}"
    
    # Run VACUUM and ANALYZE
    sudo -u postgres psql -d rootuip -c "VACUUM ANALYZE;" 2>/dev/null
    
    # Update statistics
    sudo -u postgres psql -d rootuip -c "ANALYZE;" 2>/dev/null
    
    # Reindex for better performance
    sudo -u postgres psql -d rootuip -c "REINDEX DATABASE rootuip;" 2>/dev/null
    
    echo -e "${GREEN}✓ PostgreSQL optimized${NC}"
else
    echo -e "\n${YELLOW}3. Skipping PostgreSQL optimization (requires sudo)${NC}"
fi

# 4. System Memory Optimization
echo -e "\n${YELLOW}4. Optimizing system memory...${NC}"

# Clear system caches (requires sudo)
if [ "$EUID" -eq 0 ]; then
    sync
    echo 1 > /proc/sys/vm/drop_caches
    echo -e "${GREEN}✓ System caches cleared${NC}"
else
    echo "Skipping cache clear (requires sudo)"
fi

# 5. Log Cleanup
echo -e "\n${YELLOW}5. Cleaning up old logs...${NC}"

# Compress logs older than 7 days
find /home/iii/ROOTUIP/logs -name "*.log" -mtime +7 -exec gzip {} \; 2>/dev/null

# Remove compressed logs older than 30 days
find /home/iii/ROOTUIP/logs -name "*.gz" -mtime +30 -delete 2>/dev/null

# Truncate large active logs (keep last 10000 lines)
for logfile in /home/iii/ROOTUIP/logs/*.log; do
    if [ -f "$logfile" ] && [ $(wc -l < "$logfile") -gt 10000 ]; then
        tail -10000 "$logfile" > "$logfile.tmp" && mv "$logfile.tmp" "$logfile"
        echo "Truncated: $(basename "$logfile")"
    fi
done

echo -e "${GREEN}✓ Logs cleaned${NC}"

# 6. ML Model Cache Optimization
echo -e "\n${YELLOW}6. Optimizing ML model cache...${NC}"

# Clear old prediction cache
find /home/iii/ROOTUIP/ml_system/prediction_history -name "*.json" -mtime +30 -delete 2>/dev/null

# Clear processed documents older than 30 days
find /home/iii/ROOTUIP/ml_system/processed -name "*" -mtime +30 -delete 2>/dev/null

echo -e "${GREEN}✓ ML cache optimized${NC}"

# 7. Network Optimization (requires sudo)
if [ "$EUID" -eq 0 ]; then
    echo -e "\n${YELLOW}7. Optimizing network settings...${NC}"
    
    # Increase TCP buffer sizes
    sysctl -w net.core.rmem_max=134217728 2>/dev/null
    sysctl -w net.core.wmem_max=134217728 2>/dev/null
    sysctl -w net.ipv4.tcp_rmem="4096 87380 134217728" 2>/dev/null
    sysctl -w net.ipv4.tcp_wmem="4096 65536 134217728" 2>/dev/null
    
    # Enable TCP fast open
    sysctl -w net.ipv4.tcp_fastopen=3 2>/dev/null
    
    echo -e "${GREEN}✓ Network optimized${NC}"
else
    echo -e "\n${YELLOW}7. Skipping network optimization (requires sudo)${NC}"
fi

# 8. Service Health Check
echo -e "\n${YELLOW}8. Checking service health...${NC}"

# Check ML services
ml_health=$(curl -s http://localhost:3004/ml/health 2>/dev/null | grep -o '"status":"healthy"' || echo "")
if [ -n "$ml_health" ]; then
    echo -e "${GREEN}✓ ML Server: Healthy${NC}"
else
    echo -e "${RED}✗ ML Server: Not responding${NC}"
fi

python_health=$(curl -s http://localhost:8000/health 2>/dev/null | grep -o '"status":"healthy"' || echo "")
if [ -n "$python_health" ]; then
    echo -e "${GREEN}✓ Python API: Healthy${NC}"
else
    echo -e "${RED}✗ Python API: Not responding${NC}"
fi

# 9. Performance Metrics
echo -e "\n${YELLOW}9. Current Performance Metrics:${NC}"

# Get current metrics
metrics=$(curl -s http://localhost:3004/ml/metrics 2>/dev/null)
if [ -n "$metrics" ]; then
    uptime=$(echo "$metrics" | grep -o '"uptime":"[^"]*"' | cut -d'"' -f4)
    cpu=$(echo "$metrics" | grep -o '"currentCpu":"[^"]*"' | cut -d'"' -f4)
    memory=$(echo "$metrics" | grep -o '"currentMemory":"[^"]*"' | cut -d'"' -f4)
    
    echo "Uptime: $uptime"
    echo "CPU Usage: $cpu"
    echo "Memory Usage: $memory"
else
    echo "Unable to fetch metrics"
fi

# 10. Recommendations
echo -e "\n${YELLOW}10. Optimization Recommendations:${NC}"

# Check available memory
available_mem=$(free -m | awk 'NR==2{printf "%.1f", $7/1024}')
if (( $(echo "$available_mem < 1" | bc -l) )); then
    echo -e "${RED}⚠ Low memory available: ${available_mem}GB${NC}"
    echo "  Consider upgrading server RAM or reducing concurrent processes"
else
    echo -e "${GREEN}✓ Memory usage healthy: ${available_mem}GB available${NC}"
fi

# Check disk space
disk_usage=$(df -h /home | awk 'NR==2{print $5}' | sed 's/%//')
if [ "$disk_usage" -gt 80 ]; then
    echo -e "${RED}⚠ High disk usage: ${disk_usage}%${NC}"
    echo "  Run backup script and clean old files"
else
    echo -e "${GREEN}✓ Disk usage healthy: ${disk_usage}%${NC}"
fi

echo -e "\n${GREEN}======================================"
echo "Optimization Complete!"
echo "======================================${NC}"
echo "Completed at: $(date)"
echo ""
echo "Next steps:"
echo "1. Monitor performance with: /home/iii/ROOTUIP/ROOTUIP/system-monitor.html"
echo "2. Set up regular optimization: Add to cron with 'crontab -e'"
echo "   0 3 * * 0 /home/iii/ROOTUIP/scripts/optimize-performance.sh"
echo ""

# Log optimization run
echo "$(date): Performance optimization completed" >> /home/iii/ROOTUIP/logs/optimization.log