#!/bin/bash

# Enterprise Authentication Integration Test Script
echo "========================================"
echo "Enterprise Auth Integration Tests"
echo "========================================"

BASE_URL="http://localhost:3003"
PASS_COUNT=0
FAIL_COUNT=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local test_name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"
    local headers="$6"
    
    echo -n "Testing: $test_name... "
    
    if [ "$method" = "POST" ]; then
        if [ -n "$headers" ]; then
            response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "$headers" \
                -d "$data")
        else
            response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data")
        fi
    else
        if [ -n "$headers" ]; then
            response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint" \
                -H "$headers")
        else
            response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint")
        fi
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}PASS${NC} (Status: $status_code)"
        ((PASS_COUNT++))
        return 0
    else
        echo -e "${RED}FAIL${NC} (Expected: $expected_status, Got: $status_code)"
        echo "Response: $body"
        ((FAIL_COUNT++))
        return 1
    fi
}

# Test 1: Health Check
test_endpoint "Health Check" "GET" "/auth/health" "" "200" ""

# Test 2: Login with valid credentials
echo ""
echo "Authentication Tests:"
login_response=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"demo@rootuip.com","password":"Demo123456"}')

if echo "$login_response" | grep -q "accessToken"; then
    echo -e "Login with valid credentials... ${GREEN}PASS${NC}"
    ((PASS_COUNT++))
    
    # Extract token for further tests
    access_token=$(echo "$login_response" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    auth_header="Authorization: Bearer $access_token"
else
    echo -e "Login with valid credentials... ${RED}FAIL${NC}"
    echo "Response: $login_response"
    ((FAIL_COUNT++))
    access_token=""
fi

# Test 3: Login with invalid credentials
test_endpoint "Login with invalid credentials" "POST" "/auth/login" \
    '{"email":"demo@rootuip.com","password":"wrongpassword"}' "401" ""

# Test 4: Verify token
if [ -n "$access_token" ]; then
    test_endpoint "Verify valid token" "GET" "/auth/verify" "" "200" \
        "$auth_header"
fi

# Test 5: Verify invalid token
test_endpoint "Verify invalid token" "GET" "/auth/verify" "" "401" \
    "Authorization: Bearer invalidtoken123"

# Test 6: No token provided
test_endpoint "Verify without token" "GET" "/auth/verify" "" "401" ""

# Test 7: API endpoints with auth
echo ""
echo "API Endpoint Tests:"
if [ -n "$access_token" ]; then
    test_endpoint "Get users (authenticated)" "GET" "/auth/api/users" "" "200" \
        "$auth_header"
    
    test_endpoint "Get stats (authenticated)" "GET" "/auth/api/stats" "" "200" \
        "$auth_header"
    
    test_endpoint "Get audit logs (authenticated)" "GET" "/auth/api/audit-logs" "" "200" \
        "$auth_header"
fi

# Test 8: API endpoints without auth
test_endpoint "Get users (unauthenticated)" "GET" "/auth/api/users" "" "401" ""

# Test summary
echo ""
echo "========================================"
echo "Test Summary:"
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"
echo "Total: $((PASS_COUNT + FAIL_COUNT))"
echo "========================================"

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi