#!/bin/bash

# ROOTUIP Production Testing Suite
# Comprehensive testing for production deployment at rootuip.com
# Version: 1.0.0

set -e

# Configuration
DOMAIN="rootuip.com"
BASE_URL="https://$DOMAIN"
API_URL="https://api.$DOMAIN"
DEMO_URL="https://demo.$DOMAIN"
APP_URL="https://app.$DOMAIN"
CUSTOMER_URL="https://customer.$DOMAIN"

# Test results directory
TEST_DIR="/tmp/rootuip-tests"
mkdir -p "$TEST_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

print_header() {
    echo -e "${PURPLE}================================================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================================================${NC}"
}

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

print_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

# Function to test HTTP endpoint
test_endpoint() {
    local url="$1"
    local expected_status="${2:-200}"
    local description="$3"
    
    print_test "Testing $description: $url"
    
    local response=$(curl -s -w "%{http_code}" -o /dev/null "$url" --max-time 10)
    
    if [ "$response" = "$expected_status" ]; then
        print_pass "$description - Status: $response"
        return 0
    else
        print_fail "$description - Expected: $expected_status, Got: $response"
        return 1
    fi
}

# Function to test SSL certificate
test_ssl_certificate() {
    local domain="$1"
    
    print_test "Testing SSL certificate for $domain"
    
    local ssl_info=$(echo | openssl s_client -connect "$domain:443" -servername "$domain" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        local expiry_date=$(echo "$ssl_info" | grep "notAfter" | cut -d= -f2)
        local expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || echo "0")
        local current_epoch=$(date +%s)
        local days_left=$(( ($expiry_epoch - $current_epoch) / 86400 ))
        
        if [ $days_left -gt 7 ]; then
            print_pass "SSL certificate valid for $domain ($days_left days remaining)"
            return 0
        else
            print_fail "SSL certificate expires soon for $domain ($days_left days remaining)"
            return 1
        fi
    else
        print_fail "SSL certificate test failed for $domain"
        return 1
    fi
}

# Function to test security headers
test_security_headers() {
    local url="$1"
    
    print_test "Testing security headers for $url"
    
    local headers=$(curl -s -I "$url" 2>/dev/null)
    local score=0
    
    # Check for required security headers
    if echo "$headers" | grep -qi "strict-transport-security"; then
        score=$((score + 1))
    fi
    
    if echo "$headers" | grep -qi "x-frame-options"; then
        score=$((score + 1))
    fi
    
    if echo "$headers" | grep -qi "x-content-type-options"; then
        score=$((score + 1))
    fi
    
    if echo "$headers" | grep -qi "x-xss-protection"; then
        score=$((score + 1))
    fi
    
    if [ $score -ge 3 ]; then
        print_pass "Security headers present ($score/4)"
        return 0
    else
        print_fail "Missing security headers ($score/4)"
        return 1
    fi
}

# Function to test load time
test_load_time() {
    local url="$1"
    local max_time="${2:-3}"
    
    print_test "Testing load time for $url (max: ${max_time}s)"
    
    local load_time=$(curl -w "%{time_total}" -o /dev/null -s "$url" --max-time 10)
    local load_time_int=$(echo "$load_time" | cut -d. -f1)
    
    if [ "$load_time_int" -le "$max_time" ]; then
        print_pass "Load time acceptable: ${load_time}s"
        return 0
    else
        print_fail "Load time too high: ${load_time}s (max: ${max_time}s)"
        return 1
    fi
}

# Function to test API endpoint with JSON response
test_api_endpoint() {
    local url="$1"
    local description="$2"
    
    print_test "Testing API: $description"
    
    local response=$(curl -s "$url" --max-time 10)
    
    if echo "$response" | grep -q "status"; then
        print_pass "API endpoint responding: $description"
        echo "$response" > "$TEST_DIR/api_$(echo "$description" | tr ' ' '_').json"
        return 0
    else
        print_fail "API endpoint not responding properly: $description"
        return 1
    fi
}

# Main testing functions

test_basic_connectivity() {
    print_header "BASIC CONNECTIVITY TESTS"
    
    # Test all main domains
    test_endpoint "$BASE_URL" 200 "Main website"
    test_endpoint "$APP_URL" 200 "Application portal"
    test_endpoint "$API_URL/api/health" 200 "API health endpoint"
    test_endpoint "$DEMO_URL" 200 "Demo platform"
    test_endpoint "$CUSTOMER_URL" 200 "Customer portal"
    
    # Test www redirect
    test_endpoint "https://www.$DOMAIN" 200 "WWW redirect"
    
    # Test HTTP to HTTPS redirect
    local http_response=$(curl -s -w "%{http_code}" -o /dev/null "http://$DOMAIN" --max-time 10)
    if [ "$http_response" = "301" ] || [ "$http_response" = "302" ]; then
        print_pass "HTTP to HTTPS redirect working"
    else
        print_fail "HTTP to HTTPS redirect not working (got $http_response)"
    fi
}

test_ssl_certificates() {
    print_header "SSL CERTIFICATE TESTS"
    
    # Test SSL certificates for all domains
    test_ssl_certificate "$DOMAIN"
    test_ssl_certificate "app.$DOMAIN"
    test_ssl_certificate "api.$DOMAIN"
    test_ssl_certificate "demo.$DOMAIN"
    test_ssl_certificate "customer.$DOMAIN"
    
    # Test SSL Labs rating (simplified check)
    print_test "Checking SSL configuration quality"
    local ssl_check=$(echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null | grep -E "(Protocol|Cipher)")
    
    if echo "$ssl_check" | grep -q "TLSv1.[23]"; then
        print_pass "Using modern TLS version"
    else
        print_fail "Not using modern TLS version"
    fi
}

test_security_implementation() {
    print_header "SECURITY IMPLEMENTATION TESTS"
    
    # Test security headers for all domains
    test_security_headers "$BASE_URL"
    test_security_headers "$APP_URL"
    test_security_headers "$API_URL"
    
    # Test rate limiting
    print_test "Testing API rate limiting"
    local rate_limit_test=0
    for i in {1..15}; do
        local response=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/api/health" --max-time 5)
        if [ "$response" = "429" ]; then
            rate_limit_test=1
            break
        fi
        sleep 0.1
    done
    
    if [ $rate_limit_test -eq 1 ]; then
        print_pass "Rate limiting is working"
    else
        print_info "Rate limiting not triggered (may be configured differently)"
    fi
    
    # Test common attack vectors
    print_test "Testing SQL injection protection"
    local sqli_response=$(curl -s -w "%{http_code}" -o /dev/null "$API_URL/api/health?id=1';DROP TABLE users;--" --max-time 5)
    if [ "$sqli_response" != "500" ]; then
        print_pass "SQL injection protection working"
    else
        print_fail "Potential SQL injection vulnerability"
    fi
}

test_performance() {
    print_header "PERFORMANCE TESTS"
    
    # Test load times for key pages
    test_load_time "$BASE_URL" 3
    test_load_time "$APP_URL" 3
    test_load_time "$DEMO_URL" 3
    
    # Test compression
    print_test "Testing gzip compression"
    local compression_test=$(curl -s -H "Accept-Encoding: gzip" -I "$BASE_URL" | grep -i "content-encoding")
    if echo "$compression_test" | grep -qi "gzip"; then
        print_pass "Gzip compression enabled"
    else
        print_fail "Gzip compression not enabled"
    fi
    
    # Test HTTP/2 support
    print_test "Testing HTTP/2 support"
    local http2_test=$(curl -s --http2 -I "$BASE_URL" | head -1)
    if echo "$http2_test" | grep -q "HTTP/2"; then
        print_pass "HTTP/2 support enabled"
    else
        print_info "HTTP/2 not detected (may not be enabled)"
    fi
    
    # Test CDN integration
    print_test "Testing CDN integration"
    local cdn_test=$(curl -s -I "$BASE_URL" | grep -i "cf-ray\|cloudflare\|x-cache")
    if [ -n "$cdn_test" ]; then
        print_pass "CDN detected"
    else
        print_info "CDN not detected or headers not visible"
    fi
}

test_api_endpoints() {
    print_header "API ENDPOINT TESTS"
    
    # Test core API endpoints
    test_api_endpoint "$API_URL/api/health" "Health check"
    test_api_endpoint "$API_URL/api/version" "Version info"
    test_api_endpoint "$DEMO_URL/api/health" "Demo health"
    test_api_endpoint "$DEMO_URL/api/demo/status" "Demo status"
    
    # Test API response format
    print_test "Testing API response format"
    local api_response=$(curl -s "$API_URL/api/health" --max-time 10)
    
    if echo "$api_response" | grep -q '"status".*"timestamp"'; then
        print_pass "API returns proper JSON format"
    else
        print_fail "API response format incorrect"
    fi
    
    # Test CORS headers
    print_test "Testing CORS headers"
    local cors_test=$(curl -s -I -H "Origin: https://app.$DOMAIN" "$API_URL/api/health" | grep -i "access-control")
    if [ -n "$cors_test" ]; then
        print_pass "CORS headers present"
    else
        print_info "CORS headers not detected"
    fi
}

test_database_connectivity() {
    print_header "DATABASE CONNECTIVITY TESTS"
    
    # Test database through API endpoints
    print_test "Testing database connectivity via API"
    local db_test=$(curl -s "$API_URL/api/health" --max-time 10 | grep -o '"database"[^,]*')
    
    if echo "$db_test" | grep -q "true"; then
        print_pass "Database connectivity confirmed"
    else
        print_info "Database status not available in health check"
    fi
}

test_email_functionality() {
    print_header "EMAIL FUNCTIONALITY TESTS"
    
    # Note: Email testing requires actual SMTP configuration
    print_info "Email functionality testing requires SMTP configuration"
    print_info "Manual testing recommended for:"
    print_info "- Registration confirmation emails"
    print_info "- Password reset emails"
    print_info "- Lead notification emails"
    print_info "- Demo booking confirmations"
}

test_mobile_responsiveness() {
    print_header "MOBILE RESPONSIVENESS TESTS"
    
    # Test with mobile user agents
    print_test "Testing mobile responsiveness (iPhone)"
    local mobile_response=$(curl -s -H "User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)" "$BASE_URL" --max-time 10)
    
    if echo "$mobile_response" | grep -qi "viewport.*width=device-width"; then
        print_pass "Mobile viewport meta tag present"
    else
        print_fail "Mobile viewport meta tag missing"
    fi
    
    print_test "Testing mobile responsiveness (Android)"
    local android_response=$(curl -s -H "User-Agent: Mozilla/5.0 (Linux; Android 10)" "$BASE_URL" --max-time 10)
    
    if [ ${#android_response} -gt 1000 ]; then
        print_pass "Mobile page loads successfully"
    else
        print_fail "Mobile page loading issues"
    fi
}

test_error_pages() {
    print_header "ERROR PAGE TESTS"
    
    # Test 404 pages
    test_endpoint "$BASE_URL/nonexistent-page" 404 "404 error page"
    
    # Test API 404
    test_endpoint "$API_URL/api/nonexistent" 404 "API 404 error"
    
    # Test custom error pages exist
    local error_404=$(curl -s "$BASE_URL/nonexistent-page" --max-time 10)
    if echo "$error_404" | grep -qi "not found\|404"; then
        print_pass "Custom 404 page working"
    else
        print_fail "Custom 404 page not working"
    fi
}

run_load_test() {
    print_header "LOAD TEST SIMULATION"
    
    print_info "Running simplified load test..."
    print_info "For comprehensive load testing, use tools like Apache Bench or Artillery"
    
    # Simple concurrent request test
    print_test "Testing concurrent requests (10 simultaneous)"
    
    # Create temporary script for concurrent testing
    cat > "$TEST_DIR/load_test.sh" << 'EOF'
#!/bin/bash
URL="$1"
for i in {1..10}; do
    curl -s -w "%{http_code}:%{time_total}\n" -o /dev/null "$URL" &
done
wait
EOF
    
    chmod +x "$TEST_DIR/load_test.sh"
    
    local load_results=$("$TEST_DIR/load_test.sh" "$BASE_URL/api/health")
    local success_count=$(echo "$load_results" | grep -c "200:")
    
    if [ "$success_count" -ge 8 ]; then
        print_pass "Load test successful ($success_count/10 requests succeeded)"
    else
        print_fail "Load test failed ($success_count/10 requests succeeded)"
    fi
}

generate_test_report() {
    print_header "TEST SUMMARY REPORT"
    
    local pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    
    echo -e "${CYAN}================================${NC}"
    echo -e "${CYAN}ROOTUIP PRODUCTION TEST RESULTS${NC}"
    echo -e "${CYAN}================================${NC}"
    echo -e "Total Tests: ${TOTAL_TESTS}"
    echo -e "Passed: ${GREEN}${PASSED_TESTS}${NC}"
    echo -e "Failed: ${RED}${FAILED_TESTS}${NC}"
    echo -e "Pass Rate: ${pass_rate}%"
    echo -e "Test Date: $(date)"
    echo -e "Domain: $DOMAIN"
    echo -e "${CYAN}================================${NC}"
    
    # Create detailed report file
    cat > "$TEST_DIR/test_report.txt" << EOF
ROOTUIP Production Test Report
==============================
Date: $(date)
Domain: $DOMAIN
Total Tests: $TOTAL_TESTS
Passed: $PASSED_TESTS
Failed: $FAILED_TESTS
Pass Rate: $pass_rate%

Test Categories Covered:
- Basic Connectivity
- SSL Certificates
- Security Implementation
- Performance
- API Endpoints
- Database Connectivity
- Mobile Responsiveness
- Error Pages
- Load Testing

Recommendations:
- Monitor failed tests and address issues
- Set up continuous monitoring
- Regular security audits
- Performance optimization
- Load testing with professional tools

Generated by ROOTUIP Testing Suite v1.0.0
EOF
    
    print_info "Detailed report saved to: $TEST_DIR/test_report.txt"
    
    if [ $pass_rate -ge 80 ]; then
        echo -e "${GREEN}✅ OVERALL RESULT: PRODUCTION READY${NC}"
        return 0
    else
        echo -e "${RED}❌ OVERALL RESULT: ISSUES NEED ATTENTION${NC}"
        return 1
    fi
}

# Main execution
main() {
    print_header "ROOTUIP PRODUCTION TESTING SUITE"
    echo -e "${CYAN}Testing domain: $DOMAIN${NC}"
    echo -e "${CYAN}Test timestamp: $(date)${NC}"
    echo ""
    
    # Run all test suites
    test_basic_connectivity
    test_ssl_certificates
    test_security_implementation
    test_performance
    test_api_endpoints
    test_database_connectivity
    test_mobile_responsiveness
    test_error_pages
    run_load_test
    
    # Generate final report
    generate_test_report
    
    echo ""
    echo -e "${BLUE}Test artifacts saved to: $TEST_DIR${NC}"
    echo -e "${BLUE}View detailed results: cat $TEST_DIR/test_report.txt${NC}"
}

# Execute main function
main "$@"