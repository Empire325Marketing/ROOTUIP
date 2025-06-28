#!/bin/bash

echo "========================================"
echo "Running Manual Security Scan"
echo "========================================"

cd /home/iii/ROOTUIP/security

# Check if auth service is running
if ! curl -s http://localhost:3003/auth/health > /dev/null; then
    echo "ERROR: Auth service is not running on port 3003"
    echo "Please start the auth service first: pm2 start enterprise-auth"
    exit 1
fi

echo "Auth service is running. Starting security scan..."

# Run the security scanner
node security-scanner.js

echo ""
echo "========================================"
echo "Running Dependency Vulnerability Check"
echo "========================================"

# Run dependency checker
node dependency-checker.js

echo ""
echo "========================================"
echo "Security Scan Complete"
echo "========================================"
echo "Check the reports directory for detailed results:"
echo "- Latest security report: reports/latest-security-report.json"
echo "- All reports: reports/"
