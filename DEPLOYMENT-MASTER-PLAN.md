# ROOTUIP Master Deployment Plan

## Overview
This document maps all local ROOTUIP components to their deployment locations on VPS 145.223.73.4

## Current VPS Configuration
- **Domain**: rootuip.com (with SSL)
- **Server**: 145.223.73.4
- **Web Root**: /var/www/html or /var/www/rootuip.com
- **Services**: Nginx, potentially Node.js, PostgreSQL

## Local Project Structure Summary

### Total Files
- JavaScript: ~400+ files
- HTML: ~200+ files  
- JSON: ~50+ files
- Shell Scripts: ~100+ files
- Documentation: ~80+ MD files

### Main Components Built

## 1. CORE PLATFORM SERVICES

### API Gateway & Authentication
**Local Files:**
- `api-gateway-new.js` - Main API gateway
- `enterprise-auth-system.js` - Enterprise authentication
- `auth-enterprise/` - Complete auth system with SAML, OAuth

**Deploy To:**
- `/var/www/rootuip.com/api/`
- Run on port 3000 with PM2
- Nginx reverse proxy from api.rootuip.com

### Database Layer
**Local Files:**
- `api-gateway-database.js` - Database schemas
- `auth/database-config.js` - Auth database

**Deploy To:**
- PostgreSQL database: rootuip_production
- Run migrations from `/var/www/rootuip.com/migrations/`

## 2. ML/AI SYSTEMS

### ML Processing Engine
**Local Files:**
- `ml_system/ml-server.js` - Main ML server
- `ml_system/document-processor.js` - Document OCR
- `ml_system/dd-prediction-engine.js` - D&D prediction
- `ai-ml-api.js` - AI/ML API endpoints

**Deploy To:**
- `/var/www/rootuip.com/ml/`
- Run on port 3002 with PM2
- Subdomain: ml.rootuip.com

## 3. BUSINESS SERVICES

### Operations & CRM
**Local Files:**
- `business-operations-server.js`
- `customer-support-system.js`
- `sales-crm-system.js`
- `hubspot-crm-integration.js`

**Deploy To:**
- `/var/www/rootuip.com/services/business/`
- Individual PM2 processes

### Billing & Financial
**Local Files:**
- `billing/subscription-management.js` - Stripe integration
- `billing/financial-reporting.js` - Revenue recognition
- `billing/enterprise-billing.js` - Custom invoicing
- `billing/accounting-integration.js` - QuickBooks/NetSuite

**Deploy To:**
- `/var/www/rootuip.com/services/billing/`
- Secure environment variables for API keys

## 4. INTEGRATIONS

### Carrier Integrations
**Local Files:**
- `integrations/integration-server.js` - Main integration service
- `integrations/carriers/maersk-adapter.js`
- `integrations/carriers/msc-adapter.js`
- `mock-data/maersk-api-simulator.js`

**Deploy To:**
- `/var/www/rootuip.com/services/integrations/`
- Run on port 3003

## 5. MONITORING & ANALYTICS

### System Monitoring
**Local Files:**
- `monitoring/health-monitor.js`
- `monitoring/performance-monitor.js`
- `monitoring/ha-monitoring-system.js`
- `performance-tracker.js`

**Deploy To:**
- `/var/www/rootuip.com/monitoring/`
- Background services with PM2

### Analytics Platform
**Local Files:**
- `analytics/advanced-analytics-platform.js`
- `analytics/business-intelligence-dashboard.js`
- `analytics/predictive-ml-models.js`

**Deploy To:**
- `/var/www/rootuip.com/services/analytics/`

## 6. USER INTERFACES

### Main Website
**Local Files:**
- `landing-page.html` - Main landing
- `platform/dashboard.html` - Customer dashboard
- `login.html` - Login page
- `roi-calculator.html` - ROI calculator

**Deploy To:**
- `/var/www/rootuip.com/public/`
- Served by Nginx

### Admin & Management UIs
**Local Files:**
- `enterprise-monitoring-dashboard.html`
- `container-tracking-interface.html`
- `compliance/compliance-dashboard.html`
- `job-management-interface.html`

**Deploy To:**
- `/var/www/rootuip.com/admin/`
- Behind authentication

### API Documentation
**Local Files:**
- `api-docs/index.html`
- `api-playground.html`

**Deploy To:**
- `/var/www/rootuip.com/docs/`
- Public access at docs.rootuip.com

## 7. DEPLOYMENT INFRASTRUCTURE

### High Availability & DR
**Local Files:**
- `infrastructure/high-availability-architecture.js`
- `disaster-recovery/disaster-recovery-system.js`
- `deployment/zero-downtime-deployment.js`

**Deploy To:**
- `/var/www/rootuip.com/infrastructure/`
- System-level services

### Compliance & Security
**Local Files:**
- `compliance/compliance-management-framework.js`
- `compliance/security-compliance-system.js`
- `compliance/audit-logging-system.js`

**Deploy To:**
- `/var/www/rootuip.com/compliance/`
- Restricted access

## 8. STATIC ASSETS & PWA

### Progressive Web App
**Local Files:**
- `platform/manifest.json`
- `platform/service-worker.js`
- `assets/icons/` - App icons

**Deploy To:**
- `/var/www/rootuip.com/public/`
- Configure for offline support

## DEPLOYMENT SEQUENCE

### Phase 1: Infrastructure Setup
1. Database setup (PostgreSQL)
2. Redis cache
3. Environment variables
4. SSL certificates
5. Nginx configuration

### Phase 2: Core Services
1. API Gateway (port 3000)
2. Auth Service (port 3001)
3. Database migrations

### Phase 3: Business Services
1. ML Processing Service (port 3002)
2. Integration Service (port 3003)
3. Billing Services
4. Monitoring Services

### Phase 4: User Interfaces
1. Static files to Nginx
2. Admin dashboards
3. API documentation
4. PWA configuration

### Phase 5: Testing & Validation
1. Health checks
2. Integration tests
3. Performance monitoring
4. SSL validation

## Environment Variables Required
```
DATABASE_URL=postgresql://user:pass@localhost/rootuip_production
REDIS_URL=redis://localhost:6379
JWT_SECRET=<generate-secure-secret>
STRIPE_API_KEY=<from-billing-config>
QB_CLIENT_ID=<quickbooks-oauth>
NS_ACCOUNT_ID=<netsuite-config>
SMTP_HOST=<email-server>
AWS_ACCESS_KEY_ID=<if-using-s3>
```

## PM2 Ecosystem File
All Node.js services will be managed by PM2 with automatic restart and clustering.

## Monitoring Endpoints
- Health: https://api.rootuip.com/health
- Metrics: https://api.rootuip.com/metrics
- Status: https://rootuip.com/status

## Backup Strategy
- Database: Daily automated backups
- Code: Git repository
- Configs: Encrypted backup of .env files
- SSL: Certificate renewal automation

This plan ensures all components are properly organized and deployed to the VPS.