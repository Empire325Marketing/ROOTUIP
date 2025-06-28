#!/bin/bash

# ROOTUIP ML System Test Script
# Tests all ML endpoints to ensure functionality

echo "Testing ROOTUIP ML System"
echo "========================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ML_URL="http://localhost:3004"

# Test 1: Health Check
echo -n "1. Health Check: "
if curl -s "$ML_URL/ml/health" | grep -q "healthy"; then
    echo -e "${GREEN}✓ PASSED${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Test 2: Metrics Endpoint
echo -n "2. Metrics Endpoint: "
if curl -s "$ML_URL/ml/metrics" | grep -q "uptime"; then
    echo -e "${GREEN}✓ PASSED${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Test 3: D&D Risk Prediction
echo -n "3. D&D Risk Prediction: "
PREDICTION_PAYLOAD='{
    "shipmentData": {
        "containerNumber": "TEST123456",
        "destinationPort": "Los Angeles",
        "carrier": "Maersk",
        "estimatedTransitTime": 14,
        "cargoValue": 50000,
        "hazmat": false,
        "eta": "'$(date -d "+14 days" -Iseconds)'"
    }
}'

PREDICTION_RESULT=$(curl -s -X POST "$ML_URL/ml/predict-dd-risk" \
    -H "Content-Type: application/json" \
    -d "$PREDICTION_PAYLOAD")

if echo "$PREDICTION_RESULT" | grep -q "riskScore"; then
    echo -e "${GREEN}✓ PASSED${NC}"
    echo "   Risk Score: $(echo "$PREDICTION_RESULT" | grep -o '"riskScore":[0-9.]*' | cut -d: -f2)"
    echo "   Risk Level: $(echo "$PREDICTION_RESULT" | grep -o '"riskLevel":"[^"]*"' | cut -d'"' -f4)"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Test 4: Python Prediction API
echo -n "4. Python Prediction API: "
PYTHON_PAYLOAD='{
    "transit_time_days": 14,
    "port_congestion_index": 0.3,
    "carrier_reliability_score": 0.8,
    "documentation_completeness": 0.95,
    "customs_complexity_score": 0.4,
    "container_value_usd": 50000,
    "days_until_eta": 14,
    "historical_dd_rate": 0.15,
    "route_risk_score": 0.35,
    "seasonal_risk_factor": 0.6
}'

if curl -s -X POST "http://localhost:8000/predict" \
    -H "Content-Type: application/json" \
    -d "$PYTHON_PAYLOAD" 2>/dev/null | grep -q "risk_probability"; then
    echo -e "${GREEN}✓ PASSED${NC}"
else
    echo -e "${RED}✗ FAILED (Python API may not be running)${NC}"
fi

# Test 5: Accuracy Endpoint
echo -n "5. Model Accuracy: "
ACCURACY=$(curl -s "$ML_URL/ml/accuracy" | grep -o '"overallAccuracy":[0-9.]*' | cut -d: -f2)
if [ ! -z "$ACCURACY" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Accuracy: ${ACCURACY}%)"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

echo ""
echo "Summary"
echo "======="
echo "ML Server: $ML_URL"
echo "Python API: http://localhost:8000"
echo ""
echo "To view the ML demo, visit:"
echo "http://rootuip.com/ml-demo-connected.html"
echo ""
echo "To check logs:"
echo "- ML Server: tail -f /home/iii/ROOTUIP/logs/ml-server.log"
echo "- Python API: tail -f /home/iii/ROOTUIP/logs/python-api.log"