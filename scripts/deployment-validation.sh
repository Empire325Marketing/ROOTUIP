#!/bin/bash

# ROOTUIP Deployment Validation Checklist
# Validates that all components are properly deployed and functioning

echo "======================================"
echo "ROOTUIP Deployment Validation"
echo "======================================"
echo "Date: $(date)"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

# Function to check and report
check() {
    local description=$1
    local command=$2
    local expected=$3
    
    echo -n "Checking: $description... "
    
    result=$(eval "$command" 2>&1)
    
    if [[ "$result" =~ $expected ]]; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Expected: $expected"
        echo "  Got: $result"
        ((FAIL++))
        return 1
    fi
}

# Function to check URL
check_url() {
    local description=$1
    local url=$2
    local expected_code=$3
    
    echo -n "Checking: $description... "
    
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$code" == "$expected_code" ]; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASS++))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $code)"
        ((FAIL++))
        return 1
    fi
}

# Function to warn
warn() {
    local description=$1
    echo -e "${YELLOW}⚠ WARNING: $description${NC}"
    ((WARN++))
}

echo "1. Infrastructure Checks"
echo "========================"

# Check if services are listening
check "ML Server on port 3004" "lsof -i :3004 | grep -c LISTEN" "1"
check "Python API on port 8000" "lsof -i :8000 | grep -c LISTEN" "1"
check "Nginx running" "systemctl is-active nginx" "active"
check "PostgreSQL running" "systemctl is-active postgresql" "active"

echo ""
echo "2. API Endpoint Checks"
echo "======================"

# Check API endpoints
check_url "ML Health endpoint" "http://localhost:3004/ml/health" "200"
check_url "Python API Health" "http://localhost:8000/health" "200"
check_url "ML Metrics endpoint" "http://localhost:3004/ml/metrics" "200"

echo ""
echo "3. File System Checks"
echo "===================="

# Check critical files exist
check "ML model exists" "test -f /home/iii/ROOTUIP/models/dnd_model.pkl && echo exists" "exists"
check "Web files directory" "test -d /home/iii/ROOTUIP/ROOTUIP && echo exists" "exists"
check "Logs directory" "test -d /home/iii/ROOTUIP/logs && echo exists" "exists"
check "Backup directory" "test -d /home/iii/ROOTUIP/backups && echo exists" "exists"

echo ""
echo "4. Database Checks"
echo "=================="

# Check database
check "Database connection" "PGPASSWORD='U1Pp@ssw0rd!' psql -h localhost -U uip_user -d rootuip -c 'SELECT 1' 2>&1 | grep -c '1 row'" "1"
check "Users table exists" "PGPASSWORD='U1Pp@ssw0rd!' psql -h localhost -U uip_user -d rootuip -c '\dt' 2>&1 | grep -c users" "1"
check "ML predictions table" "PGPASSWORD='U1Pp@ssw0rd!' psql -h localhost -U uip_user -d rootuip -c '\dt' 2>&1 | grep -c ml_predictions" "1"

echo ""
echo "5. Security Checks"
echo "=================="

# Check security configurations
check "Nginx headers configured" "curl -I http://localhost 2>&1 | grep -c 'X-Frame-Options'" "1"
check "CORS configured" "grep -c 'cors' /home/iii/ROOTUIP/ml_system/ml-server.js" "1"

# Check for default passwords (warn if found)
if grep -q "U1Pp@ssw0rd!" /home/iii/ROOTUIP/scripts/*.sh 2>/dev/null; then
    warn "Default database password found in scripts - change in production"
fi

echo ""
echo "6. Performance Checks"
echo "===================="

# Get ML metrics
metrics=$(curl -s http://localhost:3004/ml/metrics 2>/dev/null)
if [ -n "$metrics" ]; then
    cpu=$(echo "$metrics" | grep -o '"currentCpu":"[^"]*"' | cut -d'"' -f4 | sed 's/%//')
    if [ -n "$cpu" ]; then
        cpu_val=${cpu%.*}
        if [ "$cpu_val" -gt 80 ]; then
            warn "High CPU usage: $cpu%"
        else
            echo -e "CPU Usage: ${GREEN}$cpu% (OK)${NC}"
            ((PASS++))
        fi
    fi
    
    memory=$(echo "$metrics" | grep -o '"currentMemory":"[^"]*"' | cut -d'"' -f4)
    echo "Memory Usage: $memory"
fi

echo ""
echo "7. ML System Validation"
echo "======================="

# Test ML prediction
echo -n "Testing ML prediction endpoint... "
prediction_response=$(curl -s -X POST http://localhost:3004/ml/predict-dd-risk \
    -H "Content-Type: application/json" \
    -d '{"shipmentData": {"containerNumber": "TEST123", "destinationPort": "Los Angeles", "carrier": "Maersk", "transitTime": 14, "cargoValue": 50000}}' 2>/dev/null)

if echo "$prediction_response" | grep -q "riskScore"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL++))
fi

echo ""
echo "8. Backup System Check"
echo "====================="

# Check if backup script exists and is executable
check "Backup script exists" "test -x /home/iii/ROOTUIP/scripts/backup-system.sh && echo exists" "exists"

# Check if any backups exist
backup_count=$(ls /home/iii/ROOTUIP/backups/*.tar.gz 2>/dev/null | wc -l)
if [ "$backup_count" -eq 0 ]; then
    warn "No backups found - run backup script"
else
    echo -e "Backups found: ${GREEN}$backup_count${NC}"
    ((PASS++))
fi

echo ""
echo "9. Documentation Check"
echo "===================="

# Check for key documentation files
check "Deployment status doc" "test -f /home/iii/ROOTUIP/FINAL-DEPLOYMENT-STATUS.md && echo exists" "exists"
check "API documentation" "test -f /home/iii/ROOTUIP/ROOTUIP/api-docs.html && echo exists" "exists"
check "System monitor page" "test -f /home/iii/ROOTUIP/ROOTUIP/system-monitor.html && echo exists" "exists"

echo ""
echo "10. SSL/HTTPS Check"
echo "==================="

# Check if SSL is configured
if curl -s -I https://rootuip.com 2>&1 | grep -q "200 OK"; then
    echo -e "SSL configured: ${GREEN}✓ PASS${NC}"
    ((PASS++))
else
    warn "SSL not configured - run setup-ssl-certificates.sh"
fi

echo ""
echo "======================================"
echo "Validation Summary"
echo "======================================"
echo -e "Passed: ${GREEN}$PASS${NC}"
echo -e "Failed: ${RED}$FAIL${NC}"
echo -e "Warnings: ${YELLOW}$WARN${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo "The ROOTUIP platform is properly deployed."
    exit_code=0
else
    echo -e "${RED}✗ Some checks failed!${NC}"
    echo "Please review the failures above and take corrective action."
    exit_code=1
fi

echo ""
echo "Recommendations:"
echo "==============="

if [ $FAIL -gt 0 ]; then
    echo "1. Fix failed checks before going to production"
fi

if [ $WARN -gt 0 ]; then
    echo "2. Address warnings for better security and performance"
fi

if [ "$backup_count" -eq 0 ]; then
    echo "3. Run backup script: /home/iii/ROOTUIP/scripts/backup-system.sh"
fi

echo "4. Set up monitoring: Use system-monitor.html regularly"
echo "5. Configure SSL: sudo /home/iii/ROOTUIP/setup-ssl-certificates.sh"
echo "6. Enable systemd services: sudo /home/iii/ROOTUIP/deploy-systemd-services.sh"

echo ""
echo "Full deployment guide: /home/iii/ROOTUIP/FINAL-DEPLOYMENT-STATUS.md"
echo ""

# Log validation run
echo "$(date): Validation completed - Pass: $PASS, Fail: $FAIL, Warn: $WARN" >> /home/iii/ROOTUIP/logs/validation.log

exit $exit_code