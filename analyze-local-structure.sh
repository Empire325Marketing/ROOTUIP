#!/bin/bash

echo "=== ROOTUIP Local Project Structure Analysis ==="
echo "Path: /home/iii/ROOTUIP"
echo "Date: $(date)"
echo ""

# Function to count files by type
count_files() {
    local dir=$1
    local pattern=$2
    find "$dir" -name "$pattern" -type f | grep -v node_modules | wc -l
}

echo "=== Project Statistics ==="
echo "JavaScript files: $(count_files /home/iii/ROOTUIP "*.js")"
echo "HTML files: $(count_files /home/iii/ROOTUIP "*.html")"
echo "JSON files: $(count_files /home/iii/ROOTUIP "*.json")"
echo "Shell scripts: $(count_files /home/iii/ROOTUIP "*.sh")"
echo "Markdown docs: $(count_files /home/iii/ROOTUIP "*.md")"
echo ""

echo "=== Main Categories ==="
echo ""

echo "1. CORE SERVICES:"
echo "   - API Gateway: api-gateway-new.js"
echo "   - Authentication: enterprise-auth-system.js"
echo "   - Database: api-gateway-database.js"
echo ""

echo "2. ML/AI SYSTEMS:"
find /home/iii/ROOTUIP -type f -name "*.js" | grep -E "(ml_system|ai-ml)" | grep -v node_modules | sort
echo ""

echo "3. BILLING & FINANCIAL:"
find /home/iii/ROOTUIP/billing -type f -name "*.js" 2>/dev/null | sort
echo ""

echo "4. INTEGRATIONS:"
find /home/iii/ROOTUIP/integrations -type f -name "*.js" 2>/dev/null | grep -v node_modules | sort
echo ""

echo "5. MONITORING & ANALYTICS:"
find /home/iii/ROOTUIP -type f -name "*.js" | grep -E "(monitoring|analytics)" | grep -v node_modules | sort
echo ""

echo "6. DEPLOYMENT & INFRASTRUCTURE:"
find /home/iii/ROOTUIP -type f -name "*.js" | grep -E "(deploy|infrastructure)" | grep -v node_modules | sort
echo ""

echo "7. COMPLIANCE & SECURITY:"
find /home/iii/ROOTUIP -type f -name "*.js" | grep -E "(compliance|security)" | grep -v node_modules | sort
echo ""

echo "8. USER INTERFACES (HTML):"
find /home/iii/ROOTUIP -type f -name "*.html" | grep -v node_modules | head -20
echo "   ... and $(find /home/iii/ROOTUIP -type f -name "*.html" | grep -v node_modules | wc -l) more HTML files"
echo ""

echo "9. DEPLOYMENT SCRIPTS:"
find /home/iii/ROOTUIP -type f -name "deploy*.sh" | sort
echo ""

echo "=== Directory Structure (Top Level) ==="
tree -L 2 -d /home/iii/ROOTUIP 2>/dev/null || (
    echo "Main directories:"
    find /home/iii/ROOTUIP -maxdepth 2 -type d | grep -v "^\.$" | sort | sed 's|/home/iii/ROOTUIP||' | grep -v "^$" | head -30
)
echo ""

echo "=== Services That Need Deployment ==="
echo ""
echo "1. MAIN API SERVICES:"
echo "   - api-gateway-new.js (Main API Gateway)"
echo "   - enterprise-auth-system.js (Authentication)"
echo "   - real-time-dashboard-server.js (Dashboard)"
echo ""

echo "2. BUSINESS SERVICES:"
echo "   - business-operations-server.js"
echo "   - customer-support-system.js"
echo "   - sales-crm-system.js"
echo ""

echo "3. ML/AI SERVICES:"
echo "   - ml_system/ml-server.js"
echo "   - ai-ml-api.js"
echo "   - ml_system/document-processor.js"
echo ""

echo "4. INTEGRATION SERVICES:"
echo "   - integrations/integration-server.js"
echo "   - hubspot-crm-integration.js"
echo ""

echo "5. MONITORING SERVICES:"
echo "   - monitoring/health-monitor.js"
echo "   - performance-monitor.js"
echo ""

echo "=== Database Requirements ==="
echo "Files requiring database setup:"
grep -l "CREATE TABLE" /home/iii/ROOTUIP/*.js 2>/dev/null | head -10
echo ""

echo "=== Environment Variables Needed ==="
echo "Checking for required environment variables:"
grep -h "process.env" /home/iii/ROOTUIP/*.js 2>/dev/null | grep -oE "process\.env\.[A-Z_]+" | sort -u | head -20
echo ""

echo "=== Package Dependencies ==="
if [ -f /home/iii/ROOTUIP/package.json ]; then
    echo "Main package.json dependencies:"
    cat /home/iii/ROOTUIP/package.json | grep -A 20 '"dependencies"' | head -25
fi
echo ""

echo "=== Deployment Plan Summary ==="
echo ""
echo "PHASE 1 - Core Infrastructure:"
echo "  1. PostgreSQL database setup"
echo "  2. Redis cache setup"
echo "  3. Environment configuration"
echo "  4. SSL certificates"
echo ""
echo "PHASE 2 - Core Services:"
echo "  1. API Gateway (port 3000)"
echo "  2. Auth Service (port 3001)"
echo "  3. Static file serving (nginx)"
echo ""
echo "PHASE 3 - Business Services:"
echo "  1. ML Processing Service"
echo "  2. Integration Service"
echo "  3. Real-time Dashboard"
echo "  4. Monitoring System"
echo ""
echo "PHASE 4 - User Interfaces:"
echo "  1. Main website (landing page)"
echo "  2. Customer dashboard"
echo "  3. Admin interfaces"
echo "  4. API documentation"

echo ""
echo "Analysis complete. Ready for deployment planning."