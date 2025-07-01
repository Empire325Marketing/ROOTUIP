# ROOTUIP Enterprise Authentication API

## 🎯 Overview

Complete enterprise-grade authentication system with JWT tokens, multi-factor authentication, role-based access control, and comprehensive security features.

**Base URL:** `https://auth.rootuip.com/api`

## 🔐 Authentication Methods

### 1. JWT Bearer Tokens
```http
Authorization: Bearer <access_token>
```

### 2. API Keys
```http
x-api-key: rk_<api_key>
```

## 📚 API Endpoints

### 🔑 Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "Acme Corp",
  "companyDomain": "acme.com",
  "inviteToken": "optional-invite-token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "userId": "uuid",
    "email": "user@company.com",
    "emailVerificationRequired": true
  }
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "SecurePass123!",
  "mfaToken": "123456",
  "rememberMe": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "jwt_token",
    "refreshToken": "refresh_token",
    "expiresIn": "15m",
    "user": {
      "id": "uuid",
      "email": "user@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admin",
      "companyId": "uuid",
      "companyName": "Acme Corp"
    }
  }
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token"
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <access_token>
```

### 🔒 Multi-Factor Authentication

#### Setup MFA
```http
POST /auth/mfa/setup
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "secret": "base32_secret",
    "qrCode": "data:image/png;base64,...",
    "backupCodes": ["12345678", "87654321", ...]
  }
}
```

#### Verify MFA Setup
```http
POST /auth/mfa/verify
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "token": "123456"
}
```

#### Disable MFA
```http
POST /auth/mfa/disable
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "password": "current_password",
  "mfaToken": "123456"
}
```

### 👥 User Management

#### List Users
```http
GET /users?page=1&limit=50&role=admin&status=active&search=john
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@company.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "admin",
        "status": "active",
        "lastLogin": "2024-01-15T10:30:00Z",
        "mfaEnabled": true,
        "activeSessions": 2,
        "apiKeysCount": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 25,
      "pages": 1
    }
  }
}
```

#### Get User Details
```http
GET /users/{userId}
Authorization: Bearer <access_token>
```

#### Create User
```http
POST /users
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "email": "newuser@company.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "viewer",
  "phone": "+1234567890",
  "title": "Analyst",
  "department": "Operations",
  "sendInvite": true,
  "permissions": ["custom:permission"]
}
```

#### Update User
```http
PUT /users/{userId}
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "manager",
  "status": "active",
  "permissions": ["custom:read", "custom:write"]
}
```

#### Delete User
```http
DELETE /users/{userId}
Authorization: Bearer <access_token>
```

#### Lock/Unlock User
```http
POST /users/{userId}/lock
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "lock": true
}
```

#### Reset User Password
```http
POST /users/{userId}/reset-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "temporaryPassword": "TempPass123!",
  "sendEmail": true
}
```

#### Get User Permissions
```http
GET /users/{userId}/permissions
Authorization: Bearer <access_token>
```

### 🏢 Company Management

#### Get Company Details
```http
GET /company
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "company": {
      "id": "uuid",
      "name": "Acme Corp",
      "domain": "acme.com",
      "vessels": 150,
      "subscriptionTier": "enterprise",
      "contractValue": 250000.00,
      "enforceMfa": true,
      "sessionTimeoutMinutes": 480,
      "totalUsers": 25,
      "activeUsers": 23,
      "totalApiKeys": 5
    },
    "ssoConfigurations": [],
    "ipAllowlists": []
  }
}
```

#### Update Company Settings
```http
PUT /company
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Acme Corporation",
  "vessels": 200,
  "enforceMfa": true,
  "sessionTimeoutMinutes": 240,
  "maxConcurrentSessions": 3
}
```

#### Get Security Settings
```http
GET /company/security
Authorization: Bearer <access_token>
```

#### Update Security Settings
```http
PUT /company/security
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "enforceMfa": true,
  "passwordPolicy": {
    "minLength": 14,
    "requireUppercase": true,
    "requireLowercase": true,
    "requireNumbers": true,
    "requireSpecialChars": true,
    "maxAge": 60,
    "preventReuse": 24
  },
  "sessionTimeoutMinutes": 240,
  "maxConcurrentSessions": 3
}
```

#### Add IP to Allowlist
```http
POST /company/ip-allowlist
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "ipRange": "192.168.1.0/24",
  "description": "Office network"
}
```

#### Remove IP from Allowlist
```http
DELETE /company/ip-allowlist/{allowlistId}
Authorization: Bearer <access_token>
```

#### Get Audit Logs
```http
GET /company/audit-logs?page=1&limit=50&action=user.created&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <access_token>
```

#### Get Company Statistics
```http
GET /company/statistics?period=30d
Authorization: Bearer <access_token>
```

#### Get Security Events
```http
GET /company/security-events?page=1&limit=50&severity=high&status=open
Authorization: Bearer <access_token>
```

### 🔑 API Key Management

#### List API Keys
```http
GET /keys
Authorization: Bearer <access_token>
```

#### Create API Key
```http
POST /keys
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Integration API Key",
  "scopes": ["read", "write", "containers:read"],
  "rateLimit": 5000,
  "expiresAt": "2025-01-15T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "API key created successfully",
  "data": {
    "id": "uuid",
    "name": "Integration API Key",
    "keyPrefix": "rk_abc123",
    "scopes": ["read", "write", "containers:read"],
    "rateLimit": 5000,
    "apiKey": "rk_abc123def456..." // Only returned once
  }
}
```

#### Revoke API Key
```http
DELETE /keys/{keyId}
Authorization: Bearer <access_token>
```

### 🛡️ Security

#### Get CSRF Token
```http
GET /csrf-token
```

**Response:**
```json
{
  "success": true,
  "data": {
    "csrfToken": "csrf_token_value"
  }
}
```

## 🔒 Security Features

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **admin** | Full access to users, company settings, API keys |
| **manager** | Read users, read company settings, limited API access |
| **viewer** | Read-only access to company resources |
| **api_user** | API access only, no web interface |

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 5 attempts | 15 minutes |
| `/auth/register` | 3 attempts | 1 hour |
| `/auth/mfa/verify` | 10 attempts | 15 minutes |
| API endpoints | 1000 requests | 1 hour |

### Password Policy

**Default Policy:**
- Minimum 12 characters
- Requires uppercase, lowercase, numbers, special characters
- Cannot reuse last 12 passwords
- Maximum age: 90 days
- Account lockout after 5 failed attempts

**Enterprise Policy:**
- Minimum 14 characters
- Stricter complexity requirements
- Cannot reuse last 24 passwords
- Maximum age: 60 days
- Account lockout after 3 failed attempts

## 🔧 Integration Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

// Login and get token
const login = async (email, password) => {
  const response = await axios.post('https://auth.rootuip.com/api/auth/login', {
    email,
    password
  });
  
  return response.data.data.accessToken;
};

// Use API with token
const getUsers = async (token) => {
  const response = await axios.get('https://auth.rootuip.com/api/users', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.data.data.users;
};

// Use API with API key
const getCompany = async (apiKey) => {
  const response = await axios.get('https://auth.rootuip.com/api/company', {
    headers: {
      'x-api-key': apiKey
    }
  });
  
  return response.data.data.company;
};
```

### Python
```python
import requests

class ROOTUIPAuth:
    def __init__(self, base_url="https://auth.rootuip.com/api"):
        self.base_url = base_url
        self.token = None
    
    def login(self, email, password, mfa_token=None):
        payload = {
            "email": email,
            "password": password
        }
        if mfa_token:
            payload["mfaToken"] = mfa_token
            
        response = requests.post(f"{self.base_url}/auth/login", json=payload)
        data = response.json()
        
        if data["success"]:
            self.token = data["data"]["accessToken"]
            return self.token
        else:
            raise Exception(data["message"])
    
    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}"}
    
    def get_users(self):
        response = requests.get(
            f"{self.base_url}/users",
            headers=self.get_headers()
        )
        return response.json()["data"]["users"]

# Usage
auth = ROOTUIPAuth()
auth.login("user@company.com", "password", "123456")
users = auth.get_users()
```

### cURL Examples
```bash
# Login
curl -X POST https://auth.rootuip.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.com",
    "password": "SecurePass123!",
    "mfaToken": "123456"
  }'

# Get users with JWT
curl -X GET https://auth.rootuip.com/api/users \
  -H "Authorization: Bearer <access_token>"

# Get company with API key
curl -X GET https://auth.rootuip.com/api/company \
  -H "x-api-key: rk_abc123def456..."

# Create user
curl -X POST https://auth.rootuip.com/api/users \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@company.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "viewer",
    "sendInvite": true
  }'
```

## 📊 Monitoring & Health

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "environment": "production"
}
```

### Metrics Endpoints
- `/api/company/statistics` - Company usage statistics
- `/api/company/audit-logs` - Audit trail
- `/api/company/security-events` - Security incidents

## 🚨 Error Handling

### Common Error Responses

#### Authentication Error (401)
```json
{
  "error": "Authentication required",
  "message": "Valid Bearer token required"
}
```

#### Authorization Error (403)
```json
{
  "error": "Insufficient permissions",
  "message": "Role 'viewer' is not authorized for this action"
}
```

#### Validation Error (400)
```json
{
  "error": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Valid email address is required"
    }
  ]
}
```

#### Rate Limit Error (429)
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many login attempts",
  "retryAfter": "15 minutes"
}
```

## 🔐 Security Best Practices

### For API Integration
1. **Store API keys securely** - Use environment variables, never commit to code
2. **Use HTTPS only** - All communication must be encrypted
3. **Implement token refresh** - Handle token expiration gracefully
4. **Rate limit awareness** - Implement exponential backoff
5. **Validate responses** - Always check response status and handle errors

### For Web Applications
1. **Secure token storage** - Use httpOnly cookies or secure localStorage
2. **CSRF protection** - Include CSRF tokens in state-changing requests
3. **Session management** - Implement proper logout and session timeout
4. **Input validation** - Validate all user inputs client and server-side
5. **Error handling** - Don't expose sensitive information in error messages

## 📈 Performance Considerations

- **Token caching** - Cache valid tokens to reduce authentication calls
- **Connection pooling** - Reuse HTTP connections when possible
- **Request batching** - Combine multiple operations when API supports it
- **Pagination** - Use pagination for large data sets
- **Compression** - Enable gzip compression for large responses

---

**🚀 Ready for Enterprise Deployment**

This authentication system provides enterprise-grade security with comprehensive audit trails, multi-factor authentication, and role-based access control. Perfect for ROOTUIP's enterprise customers requiring the highest security standards.

For technical support: auth-support@rootuip.com