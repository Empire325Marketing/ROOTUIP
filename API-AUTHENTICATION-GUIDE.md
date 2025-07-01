# ROOTUIP API Authentication Guide

## Overview

The ROOTUIP Lead Generation API uses two authentication methods:
1. **API Keys** - For server-to-server communication
2. **JWT Tokens** - For client applications

## Quick Start

### 1. API Key Authentication

Use API keys for server-side applications, webhooks, and integrations.

```bash
# Request with API Key
curl -X POST https://api.rootuip.com/api/lead-gen/roi-calculator \
  -H "x-api-key: rootuip-default-key-2024" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@shipping.com",
    "company": "Global Shipping Co",
    "vesselCount": "50"
  }'
```

### 2. JWT Token Authentication

Use JWT tokens for client applications and authenticated endpoints.

```bash
# Step 1: Get JWT token
curl -X POST https://api.rootuip.com/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "rootuip-default-key-2024"
  }'

# Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "7d",
  "type": "Bearer"
}

# Step 2: Use JWT token
curl -X GET https://api.rootuip.com/api/lead-gen/score/123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

## Authentication Methods

### Public Endpoints (No Auth Required)
These endpoints are rate-limited but don't require authentication:
- `POST /api/lead-gen/progressive-profile`
- `POST /api/lead-gen/roi-calculator`
- `POST /api/lead-gen/assessment`
- `POST /api/lead-gen/exit-intent`

### Protected Endpoints (JWT Required)
- `GET /api/lead-gen/score/:leadId`
- `GET /api/lead-gen/analytics`

### Admin Endpoints (API Key Required)
- `GET /api/admin/leads`
- `POST /api/admin/send-email`
- `DELETE /api/admin/lead/:id`

## Rate Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Auth | 5 requests | 15 minutes |
| Public API | 200 requests | 15 minutes |
| Protected API | 100 requests | 15 minutes |
| Admin API | 100 requests | 15 minutes |
| Expensive Operations | 10 requests | 1 hour |

## Security Features

### 1. Input Validation
All inputs are validated and sanitized:
```javascript
// Email validation
email: { 
    required: true, 
    type: 'string', 
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 255
}
```

### 2. XSS Protection
All string inputs are automatically sanitized to prevent XSS attacks.

### 3. CORS Configuration
Only authorized origins are allowed:
- https://rootuip.com
- https://www.rootuip.com
- https://demo.rootuip.com
- https://sales.rootuip.com

### 4. Security Headers
Helmet.js provides additional security headers:
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security

## Implementation Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

// Using API Key
const apiClient = axios.create({
  baseURL: 'https://api.rootuip.com',
  headers: {
    'x-api-key': process.env.ROOTUIP_API_KEY
  }
});

// Using JWT Token
async function getAuthenticatedClient() {
  const { data } = await axios.post('https://api.rootuip.com/api/auth/token', {
    apiKey: process.env.ROOTUIP_API_KEY
  });
  
  return axios.create({
    baseURL: 'https://api.rootuip.com',
    headers: {
      'Authorization': `Bearer ${data.token}`
    }
  });
}
```

### Python
```python
import requests

# Using API Key
headers = {
    'x-api-key': 'rootuip-default-key-2024',
    'Content-Type': 'application/json'
}

response = requests.post(
    'https://api.rootuip.com/api/lead-gen/roi-calculator',
    headers=headers,
    json={
        'email': 'john@shipping.com',
        'company': 'Global Shipping Co',
        'vesselCount': '50'
    }
)
```

### PHP
```php
<?php
$apiKey = 'rootuip-default-key-2024';

$ch = curl_init('https://api.rootuip.com/api/lead-gen/roi-calculator');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'x-api-key: ' . $apiKey,
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'email' => 'john@shipping.com',
    'company' => 'Global Shipping Co',
    'vesselCount' => '50'
]));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);
?>
```

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Authentication required",
  "message": "Please provide a valid Bearer token"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions",
  "message": "This action requires write permission"
}
```

### 429 Too Many Requests
```json
{
  "error": "Too many requests from this IP, please try again later."
}
```

## Best Practices

1. **Never expose API keys in client-side code**
2. **Rotate API keys regularly**
3. **Use environment variables for sensitive data**
4. **Implement retry logic with exponential backoff**
5. **Log all API interactions for security monitoring**

## Environment Variables

Add these to your `.env` file:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# API Configuration
LEAD_GEN_PORT=3018
CORS_ORIGIN=https://rootuip.com

# Database
DATABASE_URL=postgresql://user:pass@localhost/rootuip

# Redis
REDIS_URL=redis://localhost:6379

# External Services
HUBSPOT_API_KEY=your-hubspot-key
SENDGRID_API_KEY=your-sendgrid-key
```

## Support

For API support or to request additional API keys:
- Email: api-support@rootuip.com
- Documentation: https://docs.rootuip.com/api
- Status Page: https://status.rootuip.com