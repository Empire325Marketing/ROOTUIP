#!/bin/bash

echo "=== ROOTUIP Enterprise Demo Test ==="
echo

# Test 1: Health Check
echo "1. Testing Health Check..."
HEALTH=$(curl -s https://app.rootuip.com/api/health)
if [[ $HEALTH == *"healthy"* ]]; then
  echo "✅ Health check passed"
  echo $HEALTH | jq '.services'
else
  echo "❌ Health check failed"
fi
echo

# Test 2: Auth Registration
echo "2. Testing Registration..."
REG_RESPONSE=$(curl -s -X POST https://app.rootuip.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test'$(date +%s)'@company.com","password":"Test123","company":"Test Corp"}')
if [[ $REG_RESPONSE == *"success"* ]]; then
  echo "✅ Registration passed"
  echo $REG_RESPONSE | jq '.'
else
  echo "❌ Registration failed: $REG_RESPONSE"
fi
echo

# Test 3: Auth Login
echo "3. Testing Login..."
LOGIN_RESPONSE=$(curl -s -X POST https://app.rootuip.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@rootuip.com","password":"demo123"}')
if [[ $LOGIN_RESPONSE == *"token"* ]]; then
  echo "✅ Login passed"
  TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
  echo "Token: ${TOKEN:0:50}..."
else
  echo "❌ Login failed: $LOGIN_RESPONSE"
fi
echo

# Test 4: Auth Verify (with token)
echo "4. Testing Auth Verify..."
if [[ ! -z "$TOKEN" ]]; then
  VERIFY_RESPONSE=$(curl -s https://app.rootuip.com/auth/verify \
    -H "Authorization: Bearer $TOKEN")
  if [[ $VERIFY_RESPONSE == *"success"* ]] || [[ $VERIFY_RESPONSE == *"email"* ]]; then
    echo "✅ Auth verify passed"
    echo $VERIFY_RESPONSE | jq '.'
  else
    echo "❌ Auth verify failed: $VERIFY_RESPONSE"
  fi
else
  echo "❌ No token available for verify test"
fi
echo

# Test 5: User Profile (with token)
echo "5. Testing User Profile..."
USER_RESPONSE=$(curl -s https://app.rootuip.com/api/user \
  -H "Authorization: Bearer $TOKEN")
if [[ $USER_RESPONSE == *"user"* ]]; then
  echo "✅ User profile passed"
  echo $USER_RESPONSE | jq '.'
else
  echo "❌ User profile failed: $USER_RESPONSE"
fi
echo

# Test 6: Containers
echo "6. Testing Container Tracking..."
CONTAINERS=$(curl -s https://app.rootuip.com/api/containers/recent)
if [[ $CONTAINERS == *"DEMO"* ]]; then
  echo "✅ Container tracking passed"
  echo "Found $(echo $CONTAINERS | jq '. | length') containers"
else
  echo "❌ Container tracking failed"
fi
echo

# Test 7: ROI Calculator
echo "7. Testing ROI Calculator..."
ROI_RESPONSE=$(curl -s -X POST https://app.rootuip.com/api/roi-calculator/submit \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test'$(date +%s)'@company.com",
    "company": "Test Corp",
    "containerVolume": 5000,
    "ddCostPerDay": 150,
    "currentDDDays": 500,
    "industry": "retail"
  }')
if [[ $ROI_RESPONSE == *"leadId"* ]]; then
  echo "✅ ROI calculator passed"
  echo $ROI_RESPONSE | jq '.'
else
  echo "❌ ROI calculator failed: $ROI_RESPONSE"
fi
echo

# Test 8: Platform Metrics
echo "8. Testing Platform Metrics..."
METRICS=$(curl -s https://app.rootuip.com/api/metrics)
if [[ $METRICS == *"activeShipments"* ]]; then
  echo "✅ Platform metrics passed"
  echo $METRICS | jq '.'
else
  echo "❌ Platform metrics failed"
fi

echo
echo "=== Test Summary ==="
echo "Check the results above to see which tests are failing."