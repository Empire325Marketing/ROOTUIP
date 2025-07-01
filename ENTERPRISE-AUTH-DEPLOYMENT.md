# ROOTUIP Enterprise Authentication Deployment Guide

## Overview

This guide covers the complete enterprise authentication system integrating Microsoft Entra ID (Azure AD) SAML with the ROOTUIP Container Intelligence Platform.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Microsoft      │────▶│  Enterprise     │────▶│  Container      │
│  Entra ID       │     │  Auth Server    │     │  Tracking API   │
│  (SAML IdP)     │◀────│  (Port 3000)    │◀────│  (Port 3008)    │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         ▲                       │                       │
         │                       ▼                       ▼
         │              ┌─────────────────┐     ┌─────────────────┐
         │              │                 │     │                 │
         └──────────────│  Web Browser    │────▶│  WebSocket      │
                        │  (User)         │◀────│  Connection     │
                        │                 │     │                 │
                        └─────────────────┘     └─────────────────┘
```

## Features

### 1. **SAML Authentication**
- Microsoft Entra ID integration
- Single Sign-On (SSO)
- Automatic session management
- Secure logout with SAML SLO

### 2. **JWT Token Management**
- 15-minute access tokens
- 7-day refresh tokens
- Automatic token renewal
- Secure httpOnly cookies

### 3. **Role-Based Access Control**
- C-Suite Executive Dashboard
- Operations Container Tracking
- Role inference from Azure AD attributes
- Group-based permissions

### 4. **Secure WebSocket**
- Authenticated WebSocket connections
- User context in real-time updates
- Role-based data filtering
- Automatic reconnection

## Quick Start

1. **Start the System**
   ```bash
   cd /home/iii/ROOTUIP
   ./launch-enterprise-auth.sh
   ```

2. **Access the Application**
   - Login: http://localhost:3000/login
   - Click "Login with Microsoft"
   - Authenticate with your Microsoft account
   - Get redirected to your role-based dashboard

## Configuration

### Environment Variables (.env)

```env
# SAML Configuration
SAML_METADATA_URL=https://login.microsoftonline.com/{tenant}/federationmetadata/...
SAML_LOGIN_URL=https://login.microsoftonline.com/{tenant}/saml2
SAML_ISSUER=https://sts.windows.net/{tenant}/
SAML_ENTITY_ID=https://app.rootuip.com/saml/metadata
SAML_CONSUMER_SERVICE_URL=https://app.rootuip.com/saml/acs

# JWT Configuration
JWT_SECRET=<32-character-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<32-character-secret>
JWT_REFRESH_EXPIRES_IN=7d

# Session Configuration
SESSION_SECRET=<32-character-secret>
```

### Azure AD Configuration

1. **Enterprise Application Settings**
   - Name: UIP Container Intelligence Platform
   - Identifier (Entity ID): https://app.rootuip.com/saml/metadata
   - Reply URL: https://app.rootuip.com/saml/acs
   - Sign on URL: https://app.rootuip.com/login

2. **User Attributes & Claims**
   - emailaddress → user.mail
   - givenname → user.givenname
   - surname → user.surname
   - displayname → user.displayname
   - jobtitle → user.jobtitle (for role inference)
   - department → user.department
   - groups → user.groups (optional)

3. **SAML Signing Certificate**
   - Download Base64 certificate
   - Save as `certificates/saml-cert.cer`

## Authentication Flow

1. **Initial Login**
   ```
   User → /login → "Login with Microsoft" → Microsoft Entra ID
   ```

2. **SAML Response**
   ```
   Microsoft → /saml/acs → Validate → Create Session → Generate JWT
   ```

3. **Dashboard Access**
   ```
   JWT Cookie → /dashboard → Role Check → Executive/Operations View
   ```

4. **API Requests**
   ```
   Request + JWT → Auth Middleware → Validate → Proxy to Backend
   ```

5. **WebSocket Connection**
   ```
   WS Upgrade + JWT → Auth Check → Add User Context → Real-time Updates
   ```

## Role Mapping

### Automatic Role Assignment

1. **By Job Title**
   - CEO, CFO, CTO, President, VP → C_SUITE
   - Manager, Director, Supervisor → MANAGER
   - Operator, Analyst, Coordinator → OPERATIONS

2. **By Azure AD Groups** (if configured)
   - c-suite-group-id → C_SUITE
   - operations-group-id → OPERATIONS
   - admin-group-id → ADMIN

3. **Default Role**
   - If no role matches → USER

## Security Features

1. **SAML Security**
   - Certificate validation
   - Assertion signing verification
   - Clock skew tolerance
   - Replay attack prevention

2. **JWT Security**
   - Short-lived access tokens (15 min)
   - Secure httpOnly cookies
   - CSRF protection
   - Automatic token rotation

3. **Session Security**
   - Secure session cookies
   - Session timeout
   - Logout clears all sessions
   - SAML Single Logout (SLO)

4. **API Security**
   - Authentication required for all endpoints
   - Role-based access control
   - Request rate limiting
   - CORS protection

## API Endpoints

### Authentication Endpoints

```bash
# SAML Login
GET /auth/saml

# SAML Assertion Consumer Service
POST /saml/acs

# SAML Metadata
GET /saml/metadata

# User Info
GET /api/user

# Refresh Token
POST /api/refresh-token

# Logout
GET /logout
```

### Proxied Container Tracking API

All requests to `/api/tracking/*` are proxied to the backend with user context:

```bash
# Track Container
POST /api/tracking/track

# Get Containers
GET /api/tracking/containers

# Get Statistics
GET /api/tracking/stats

# WebSocket
WS /ws
```

## Troubleshooting

### Common Issues

1. **"Cannot find module" errors**
   ```bash
   npm install express express-session passport passport-saml jsonwebtoken cors cookie-parser http-proxy-middleware
   ```

2. **SAML Certificate Not Found**
   - Ensure certificate is copied to `certificates/saml-cert.cer`
   - Check file permissions

3. **Login Redirect Loop**
   - Verify Reply URL in Azure AD matches exactly
   - Check SAML Entity ID configuration
   - Ensure cookies are enabled

4. **WebSocket Connection Failed**
   - Check if auth server is running on port 3000
   - Verify JWT cookie is present
   - Check browser console for errors

### Debug Mode

Set environment variable for detailed logs:
```bash
DEBUG=passport-saml node enterprise-auth-server.js
```

## Production Deployment

### 1. **SSL/TLS Setup**
```nginx
server {
    listen 443 ssl;
    server_name app.rootuip.com;
    
    ssl_certificate /etc/ssl/certs/rootuip.crt;
    ssl_certificate_key /etc/ssl/private/rootuip.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 2. **Environment Variables**
```bash
NODE_ENV=production
SECURE_COOKIES=true
TRUST_PROXY=true
```

### 3. **Process Management**
```bash
# Using PM2
pm2 start enterprise-auth-server.js --name rootuip-auth
pm2 start real-time-dashboard-server.js --name rootuip-dashboard
pm2 save
pm2 startup
```

## Monitoring

### Health Checks
- Auth Server: http://localhost:3000/health
- Dashboard API: http://localhost:3008/health

### Metrics to Monitor
- Authentication success/failure rate
- JWT token refresh rate
- WebSocket connection count
- API response times
- Session duration

## Support

For issues or questions:
1. Check logs: `pm2 logs rootuip-auth`
2. Verify Azure AD configuration
3. Test SAML metadata endpoint
4. Contact support with error details