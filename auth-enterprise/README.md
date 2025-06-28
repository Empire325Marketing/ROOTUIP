# ROOTUIP Enterprise Authentication System

A Fortune 500-grade authentication system with comprehensive security features, compliance reporting, and multi-tenant support.

## Features

### Core Authentication
- JWT-based authentication with refresh tokens
- Multi-factor authentication (TOTP/SMS)
- SSO/SAML preparation
- Password policies with history tracking
- Account lockout protection
- Email verification

### Enterprise Features
- Multi-tenant architecture with company isolation
- Role-based access control (RBAC)
- API key management
- User invitation workflow
- Manager hierarchy support
- Session management

### Security & Compliance
- SOC 2 Type II compliance reporting
- ISO 27001, GDPR, and HIPAA frameworks
- Comprehensive audit logging
- Row-level security (RLS)
- Rate limiting
- Security dashboard
- Compliance score tracking

## Quick Start

### Prerequisites
- Node.js 14+
- PostgreSQL 12+
- Redis (optional, for session storage)

### Installation

1. Clone the repository:
```bash
cd /home/iii/ROOTUIP/auth-enterprise
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
psql -U postgres -d rootuip < enterprise-auth-complete-schema.sql
```

5. Start the service:
```bash
npm start
```

## Configuration

### Environment Variables

```env
# Server
PORT=3003

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rootuip
DB_USER=uip_user
DB_PASSWORD=U1Pp@ssw0rd!

# JWT
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Twilio (for SMS MFA)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_FROM_NUMBER=+1234567890

# SMTP (for email notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Frontend
FRONTEND_URL=https://rootuip.com
```

## API Endpoints

### Authentication
- `POST /auth/register-company` - Register new company
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh tokens
- `POST /auth/logout` - User logout
- `GET /auth/verify` - Verify token

### MFA
- `POST /auth/mfa/setup` - Setup MFA
- `POST /auth/mfa/verify` - Verify MFA token
- `POST /auth/mfa/disable` - Disable MFA

### User Management
- `GET /auth/users` - List users
- `GET /auth/users/:id` - Get user details
- `PUT /auth/users/:id` - Update user
- `DELETE /auth/users/:id` - Delete user
- `POST /auth/invite` - Invite user
- `POST /auth/accept-invitation` - Accept invitation

### API Keys
- `POST /auth/api-keys` - Create API key
- `GET /auth/api-keys` - List API keys
- `DELETE /auth/api-keys/:id` - Revoke API key

### Compliance
- `GET /auth/compliance/report` - Generate compliance report
- `GET /auth/compliance/frameworks` - List frameworks
- `GET /auth/compliance/status` - Current compliance status

### Admin
- `GET /auth/audit-logs` - View audit logs
- `GET /auth/security-dashboard` - Security metrics

## Testing

Run the test suite:

```bash
# All tests
npm test

# Integration tests only
npm run test:integration

# Unit tests only
npm run test:unit

# With coverage
npm run test:coverage
```

## Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **JWT Secrets**: Use strong, randomly generated secrets
3. **Database**: Enable SSL for production
4. **Password Policy**: Enforce strong password requirements
5. **MFA**: Encourage or require MFA for all users
6. **Rate Limiting**: Configure appropriate limits
7. **Audit Logging**: Monitor suspicious activities
8. **Regular Updates**: Keep dependencies updated

## Compliance Frameworks

### SOC 2 Type II
- Logical access controls (CC6.1-CC6.8)
- System monitoring (CC7.1-CC7.5)
- Change management (CC8.1)

### ISO 27001:2013
- Access control (A.9)
- Cryptography (A.10)
- Operations security (A.12)
- Communications security (A.13)

### GDPR
- Data protection by design (Article 25)
- Security of processing (Article 32)
- Breach notification (Articles 33-34)

### HIPAA
- Administrative safeguards
- Physical safeguards
- Technical safeguards

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Auth Service  │────▶│   PostgreSQL    │
│   (React/Vue)   │     │   (Node.js)     │     │   Database      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ├── JWT Auth
                               ├── MFA (TOTP/SMS)
                               ├── RBAC
                               ├── Audit Logging
                               ├── Rate Limiting
                               └── Compliance Reporting
```

## Database Schema

Key tables:
- `companies` - Multi-tenant companies
- `users` - User accounts with MFA
- `roles` - RBAC roles
- `sessions` - JWT session tracking
- `api_keys` - API key management
- `audit_logs` - Comprehensive audit trail
- `password_policies` - Company-specific policies

## Monitoring

### Health Check
```bash
curl http://localhost:3003/health
```

### Metrics
- Active users
- Failed login attempts
- MFA adoption rate
- API usage
- Compliance score

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify credentials in `.env`
   - Ensure database exists

2. **JWT Verification Failed**
   - Check JWT_SECRET matches
   - Verify token hasn't expired
   - Ensure proper Authorization header

3. **MFA Setup Failed**
   - Verify speakeasy is installed
   - Check QR code generation
   - Test with authenticator app

## Support

For issues or questions:
- GitHub Issues: [Create an issue](https://github.com/rootuip/auth-enterprise/issues)
- Email: support@rootuip.com
- Documentation: [Full docs](https://docs.rootuip.com/auth)

## License

Copyright © 2024 ROOTUIP. All rights reserved.