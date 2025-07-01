# VPS Inventory Report - 145.223.73.4
**Generated on:** 2025-06-30  
**VPS Credentials:** root/4T(8LORhk0(nmn/G#jii

## Executive Summary

The VPS is running a production instance of the ROOTUIP platform with multiple services, APIs, and web applications. The system is properly configured with SSL certificates, monitoring, and security measures in place.

## 1. File System Overview

### Primary Directory: /home/iii/ROOTUIP
- **Total Files:** 67,557 files
- **Key Configuration Files:**
  - `.env` - Production environment variables
  - `.env.production` - Production-specific settings
  - `ecosystem.config.js` - PM2 configuration
  - `package.json` - Node.js dependencies
  - Multiple documentation files (*.md)

### Web Directories: /var/www
- `/var/www/ROOTUIP` - Main application directory
- `/var/www/app-rootuip` - Application instance
- `/var/www/html` - Web root
- `/var/www/rootuip` - Another instance
- `/var/www/rootuip.com` - Domain-specific files
- `/var/www/staging-rootuip` - Staging environment
- `/var/www/monitoring-rootuip` - Monitoring dashboard

## 2. Running Services and Processes

### Active Services:
1. **nginx** - Web server and reverse proxy (running)
2. **pm2-root.service** - PM2 process manager (running)
3. **rootuip-auth.service** - Enterprise Authentication Service (running)
4. **postgresql** - Database server (active)
5. **redis-server** - In-memory data store (running)
6. **prometheus** - Monitoring system (running)
7. **grafana** - Analytics dashboard (running)
8. **node_exporter** - System metrics exporter (running)

### Key Processes:
- PM2 God Daemon (PID: 1229) - Managing Node.js applications
- Multiple nginx workers (8 processes)
- Fail2ban server - Security monitoring
- PostgreSQL, Redis, and monitoring services

## 3. PM2 Managed Processes

| Process | Name | Mode | Status | Port | Memory |
|---------|------|------|--------|------|--------|
| 0 | rootuip-api | cluster | online | 3006 | 57.9MB |
| 1 | rootuip-api | cluster | online | 3006 | 58.1MB |
| 2 | rootuip-static | fork | online | 8080 | 63.0MB |

All PM2 processes are running with 0 restarts, indicating stable operation.

## 4. Database Infrastructure

### PostgreSQL:
- **Status:** Active and running
- **Database:** rootuip_production (configured in .env)
- **Connection:** postgresql://rootuip:rootuip_secure_pass_2024@localhost/rootuip_production

### Redis:
- **Status:** Active and running
- **Port:** 6379 (localhost only)
- **Usage:** Session storage and caching

### PgBouncer:
- **Status:** Running
- **Port:** 6432
- **Purpose:** Connection pooling for PostgreSQL

## 5. Network Configuration

### Open Ports:
| Port | Service | Access |
|------|---------|--------|
| 22 | SSH | Public |
| 80 | HTTP | Public |
| 443 | HTTPS | Public |
| 3000 | Grafana | Public |
| 3003 | Auth Service | All interfaces |
| 3006 | PM2 API | All interfaces |
| 5432 | PostgreSQL | Localhost only |
| 6379 | Redis | Localhost only |
| 6432 | PgBouncer | Localhost only |
| 8080 | Static Server | All interfaces |
| 9090 | Prometheus | Public |
| 9100 | Node Exporter | All interfaces |

### Firewall Status:
- UFW is active with rules allowing:
  - SSH (22)
  - HTTP (80)
  - HTTPS (443)
  - Grafana (3000)
  - Prometheus (9090)

## 6. Scheduled Tasks

### Cron Jobs:
1. **Security Monitor:** `/usr/local/bin/security-monitor.sh` - Runs every 15 minutes
2. **System Cron:** Standard hourly, daily, weekly, and monthly maintenance tasks

## 7. Systemd Services

### ROOTUIP-specific Services:
1. **rootuip-auth.service**
   - Status: Active since 2025-06-27
   - Port: 3003
   - Endpoints: /auth/health, /auth/login

2. **pm2-root.service**
   - Status: Active since 2025-06-27
   - Managing 3 Node.js processes
   - Total memory usage: ~240MB

## 8. Environment Configuration

### Key Environment Variables:
- **NODE_ENV:** production
- **PORT:** 3000
- **AUTH_PORT:** 3001
- **BUSINESS_PORT:** 3004
- **DATABASE_URL:** PostgreSQL connection string
- **REDIS_URL:** redis://localhost:6379
- **JWT_SECRET:** Configured
- **API_URL:** https://rootuip.com/api

### API Keys Configured:
- STRIPE_API_KEY (placeholder)
- OPENAI_API_KEY (placeholder)
- MAERSK_CLIENT_ID (for container tracking integration)
- MAERSK_CLIENT_SECRET (for container tracking integration)

## 9. SSL Certificates and Domains

### SSL Certificate:
- **Provider:** Let's Encrypt (via Certbot)
- **Certificate Name:** rootuip.com
- **Valid Until:** 2025-09-24 (86 days remaining)
- **Domains Covered:**
  - rootuip.com
  - www.rootuip.com
  - api.rootuip.com
  - app.rootuip.com
  - cdn.rootuip.com
  - staging.rootuip.com

### Configured Domains in Nginx:
- rootuip.com (main domain)
- www.rootuip.com
- app.rootuip.com
- auth.rootuip.com
- cdn.rootuip.com
- monitoring.rootuip.com
- staging.rootuip.com

## 10. API Integrations and External Services

### Configured Integrations:
1. **Maersk Container Tracking**
   - Client ID and Secret configured
   - API integration for real-time container tracking

2. **Payment Processing**
   - Stripe API key (placeholder - needs real key)

3. **AI/ML Services**
   - OpenAI API key (placeholder - needs real key)

### API Endpoints:
- **/api/** - Main API gateway (proxied through Nginx)
- **/auth/** - Authentication endpoints
- Multiple versioned API endpoints (v1, v2, v3)

### Internal APIs:
- Container tracking API
- D&D charges prevention API
- Analytics API
- Webhook management API
- Document processing API

## System Resources

### Disk Usage:
- **Total:** 387GB
- **Used:** 10GB (3%)
- **Available:** 377GB

### Memory Usage:
- **Total:** 31GB
- **Used:** 1.1GB
- **Available:** 30GB
- **No swap configured**

### Docker:
- Docker is installed but no containers are currently running

## Security Features

1. **Fail2ban** - Active intrusion prevention
2. **UFW Firewall** - Configured with restrictive rules
3. **SSL/TLS** - All web traffic encrypted
4. **JWT Authentication** - Secure token-based auth
5. **Regular security monitoring** - via cron job

## Monitoring Stack

1. **Prometheus** - Metrics collection (port 9090)
2. **Grafana** - Visualization dashboard (port 3000)
3. **Node Exporter** - System metrics (port 9100)
4. **Custom monitoring** at monitoring.rootuip.com

## Recommendations

1. **Update API Keys:** Replace placeholder API keys with production values
2. **SSL Renewal:** Certificate expires in 86 days - ensure auto-renewal is configured
3. **Database Backup:** No automated backup system detected - implement regular backups
4. **Memory Optimization:** Only using 3.5% of available memory - system is well-provisioned
5. **Log Rotation:** Ensure log rotation is configured for all services
6. **Monitoring Alerts:** Configure Prometheus alerts for critical metrics

## Access Points

- **Main Application:** https://rootuip.com
- **API Gateway:** https://rootuip.com/api
- **Authentication:** https://auth.rootuip.com
- **Monitoring Dashboard:** https://monitoring.rootuip.com
- **Grafana:** http://145.223.73.4:3000
- **Prometheus:** http://145.223.73.4:9090

---
*This inventory was generated automatically by examining the VPS configuration and running services.*