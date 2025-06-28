# Enterprise Authentication API Documentation

## Overview
The ROOTUIP Enterprise Authentication Service provides Fortune 500-grade security features including multi-factor authentication, single sign-on, role-based access control, and comprehensive audit logging.

## Base URL
- Production: `https://app.rootuip.com/auth`
- Local Development: `http://localhost:3003/auth`

## Authentication
All protected endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <access_token>
```

## API Endpoints

### 1. Health Check
Check service health status.

**Endpoint:** `GET /auth/health`  
**Authentication:** Not required

**Response:**
```json
{
  "status": "healthy",
  "service": "enterprise-auth",
  "timestamp": "2025-06-27T19:39:24.652Z"
}
```

### 2. User Login
Authenticate user and receive access tokens.

**Endpoint:** `POST /auth/login`  
**Authentication:** Not required

**Request Body:**
```json
{
  "email": "user@company.com",
  "password": "SecurePassword123",
  "mfaCode": "123456" // Optional, required if MFA is enabled
}
```

**Response:**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "requiresMFA": false,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@company.com",
    "role": "admin",
    "company": "ACME Corp",
    "permissions": ["users.read", "users.write", "settings.manage"]
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid credentials
- `403 Forbidden` - Account locked or disabled
- `429 Too Many Requests` - Rate limit exceeded

### 3. Verify Token
Validate an access token and retrieve user information.

**Endpoint:** `GET /auth/verify`  
**Authentication:** Required

**Response:**
```json
{
  "valid": true,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@company.com",
    "role": "admin",
    "company": "ACME Corp"
  }
}
```

### 4. Refresh Token
Exchange a refresh token for a new access token.

**Endpoint:** `POST /auth/refresh`  
**Authentication:** Not required

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 5. Logout
Invalidate current session and tokens.

**Endpoint:** `POST /auth/logout`  
**Authentication:** Required

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 6. Enable MFA
Enable multi-factor authentication for user account.

**Endpoint:** `POST /auth/mfa/enable`  
**Authentication:** Required

**Request Body:**
```json
{
  "type": "totp", // or "sms"
  "phoneNumber": "+1234567890" // Required for SMS
}
```

**Response:**
```json
{
  "success": true,
  "qrCode": "data:image/png;base64,...", // For TOTP
  "secret": "JBSWY3DPEHPK3PXP", // Backup secret
  "backupCodes": [
    "12345678",
    "23456789",
    "34567890"
  ]
}
```

### 7. Verify MFA
Verify MFA code during setup or login.

**Endpoint:** `POST /auth/mfa/verify`  
**Authentication:** Required

**Request Body:**
```json
{
  "code": "123456"
}
```

### 8. User Management

#### List Users
**Endpoint:** `GET /auth/api/users`  
**Authentication:** Required (Admin role)  
**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 50)
- `search` - Search by email or name
- `role` - Filter by role
- `status` - Filter by status (active, inactive, locked)

**Response:**
```json
{
  "users": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "viewer",
      "status": "active",
      "lastLogin": "2025-06-27T19:00:00Z",
      "mfaEnabled": true
    }
  ],
  "total": 156,
  "page": 1,
  "pages": 4
}
```

#### Create User
**Endpoint:** `POST /auth/api/users`  
**Authentication:** Required (Admin role)

**Request Body:**
```json
{
  "email": "newuser@company.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "role": "viewer",
  "department": "Engineering",
  "sendInvitation": true
}
```

#### Update User
**Endpoint:** `PUT /auth/api/users/:userId`  
**Authentication:** Required (Admin role)

#### Delete User
**Endpoint:** `DELETE /auth/api/users/:userId`  
**Authentication:** Required (Admin role)

### 9. Session Management

#### List Active Sessions
**Endpoint:** `GET /auth/api/sessions`  
**Authentication:** Required

**Response:**
```json
{
  "sessions": [
    {
      "id": "session123",
      "device": "Chrome on MacOS",
      "ipAddress": "192.168.1.100",
      "location": "San Francisco, CA",
      "createdAt": "2025-06-27T18:00:00Z",
      "lastActivity": "2025-06-27T19:00:00Z",
      "current": true
    }
  ]
}
```

#### Revoke Session
**Endpoint:** `DELETE /auth/api/sessions/:sessionId`  
**Authentication:** Required

### 10. API Key Management

#### List API Keys
**Endpoint:** `GET /auth/api/keys`  
**Authentication:** Required

#### Create API Key
**Endpoint:** `POST /auth/api/keys`  
**Authentication:** Required (Admin role)

**Request Body:**
```json
{
  "name": "Production API Key",
  "permissions": ["data.read", "reports.generate"],
  "expiresAt": "2026-01-01T00:00:00Z",
  "rateLimit": 1000
}
```

**Response:**
```json
{
  "id": "key123",
  "key": "sk_live_abcdef123456...", // Only shown once
  "name": "Production API Key",
  "permissions": ["data.read", "reports.generate"],
  "createdAt": "2025-06-27T19:00:00Z"
}
```

### 11. Audit Logs

#### Get Audit Logs
**Endpoint:** `GET /auth/api/audit-logs`  
**Authentication:** Required (Admin role)  
**Query Parameters:**
- `startDate` - ISO date string
- `endDate` - ISO date string
- `action` - Filter by action type
- `userId` - Filter by user
- `page` (default: 1)
- `limit` (default: 100)

**Response:**
```json
{
  "logs": [
    {
      "id": "log123",
      "timestamp": "2025-06-27T19:00:00Z",
      "action": "USER_LOGIN",
      "userId": "user123",
      "userEmail": "user@company.com",
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "details": {
        "mfaUsed": true,
        "loginMethod": "password"
      },
      "result": "success"
    }
  ],
  "total": 1523,
  "page": 1
}
```

### 12. Security Statistics

#### Get Security Dashboard Stats
**Endpoint:** `GET /auth/api/stats`  
**Authentication:** Required (Admin role)

**Response:**
```json
{
  "totalUsers": 156,
  "activeUsers": 142,
  "activeSessions": 23,
  "mfaEnabled": 89,
  "apiKeys": 12,
  "securityScore": 92,
  "recentFailedLogins": 3,
  "passwordsExpiringSoon": 7,
  "complianceStatus": {
    "passwordPolicy": "compliant",
    "mfaEnforcement": "partial",
    "sessionTimeout": "compliant",
    "auditLogging": "compliant"
  }
}
```

## Rate Limiting

All endpoints are rate limited:
- Authentication endpoints: 5 requests per 15 minutes
- API endpoints: 100 requests per 15 minutes
- Per API key limits can be configured

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1719515400
```

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {} // Optional additional information
}
```

Common error codes:
- `INVALID_CREDENTIALS` - Invalid email or password
- `ACCOUNT_LOCKED` - Too many failed login attempts
- `TOKEN_EXPIRED` - Access token has expired
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INVALID_MFA_CODE` - Invalid or expired MFA code
- `SESSION_EXPIRED` - User session has expired

## Webhooks

Configure webhooks for security events:
- User login/logout
- Failed login attempts
- Password changes
- MFA enable/disable
- API key creation/deletion
- Security policy violations

## Security Best Practices

1. **Token Storage**: Store tokens securely in httpOnly cookies or secure storage
2. **HTTPS Only**: Always use HTTPS in production
3. **Token Rotation**: Implement token refresh before expiry
4. **MFA Enforcement**: Require MFA for admin accounts
5. **API Key Rotation**: Rotate API keys regularly
6. **Audit Log Monitoring**: Regularly review audit logs
7. **Rate Limit Monitoring**: Monitor for rate limit violations

## SDK Examples

### JavaScript/TypeScript
```javascript
const auth = new ROOTUIPAuth({
  baseUrl: 'https://app.rootuip.com/auth',
  clientId: 'your-client-id'
});

// Login
const { accessToken, user } = await auth.login({
  email: 'user@company.com',
  password: 'SecurePassword123'
});

// Verify token
const isValid = await auth.verifyToken(accessToken);

// Refresh token
const newToken = await auth.refreshToken(refreshToken);
```

### Python
```python
from rootuip import AuthClient

auth = AuthClient(
    base_url='https://app.rootuip.com/auth',
    client_id='your-client-id'
)

# Login
result = auth.login(
    email='user@company.com',
    password='SecurePassword123'
)

# Use authenticated client
users = auth.get_users(page=1, limit=50)
```

## Compliance & Certifications

The Enterprise Authentication Service is designed to meet:
- SOC 2 Type II requirements
- GDPR compliance
- HIPAA compliance (with BAA)
- ISO 27001 standards
- NIST cybersecurity framework

## Support

For enterprise support:
- Email: enterprise-support@rootuip.com
- Enterprise Portal: https://app.rootuip.com/support
- API Status: https://status.rootuip.com

## Changelog

### Version 2.0.0 (Current)
- Added multi-factor authentication
- Implemented SSO support (SAML 2.0, OAuth 2.0)
- Enhanced audit logging
- Added API key management
- Improved rate limiting
- Added compliance reporting

### Version 1.0.0
- Initial release
- Basic authentication
- JWT token support
- Role-based access control