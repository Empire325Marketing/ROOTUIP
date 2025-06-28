#!/bin/bash

curl -s -X POST https://app.rootuip.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@rootuip.com",
    "password": "Demo123!"
  }' | jq