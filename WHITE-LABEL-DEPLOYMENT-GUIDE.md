# ROOTUIP White-Label & Multi-Tenancy Deployment Guide

## Overview
This guide covers the deployment of the white-label platform, advanced multi-tenancy system, and partner platform to your VPS and domain.

## Pre-Deployment Checklist

1. **VPS Requirements**
   - Ubuntu 20.04+ or similar Linux distribution
   - Minimum 4GB RAM, 2 CPU cores
   - Node.js 18+ installed
   - PostgreSQL 14+ installed
   - Nginx installed
   - SSL certificates (Let's Encrypt recommended)

2. **AWS Services** (if using cloud features)
   - AWS CLI configured
   - S3 bucket for asset storage
   - CloudFront distribution
   - Route53 hosted zone (for custom domains)

3. **Environment Variables**
   ```bash
   # Database
   DATABASE_URL=postgresql://user:password@localhost/rootuip
   ANALYTICS_DATABASE_URL=postgresql://user:password@localhost/rootuip_analytics
   
   # Redis
   REDIS_URL=redis://localhost:6379
   
   # AWS
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   AWS_REGION=us-east-1
   
   # Email
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email
   SMTP_PASS=your-password
   
   # Stripe (for partner payments)
   STRIPE_SECRET_KEY=sk_live_xxx
   
   # JWT
   JWT_SECRET=your-secret-key
   ```

## Deployment Steps

### 1. Quick Deploy
```bash
# Set VPS details
export VPS_HOST="your-vps-ip"
export VPS_USER="root"

# Run deployment
chmod +x deploy-white-label-to-vps.sh
./deploy-white-label-to-vps.sh
```

### 2. Manual Deployment

#### Transfer Files
```bash
# Package files
tar -czf white-label.tar.gz white-label/ multi-tenancy/ partner-platform/

# Transfer to VPS
scp white-label.tar.gz root@your-vps:/var/www/rootuip/
```

#### Install on VPS
```bash
# SSH to VPS
ssh root@your-vps

# Extract files
cd /var/www/rootuip
tar -xzf white-label.tar.gz

# Install dependencies
cd white-label && npm install --production
cd ../multi-tenancy && npm install --production
cd ../partner-platform && npm install --production
```

#### Configure Services
Create systemd service files for each component:

```bash
# /etc/systemd/system/rootuip-white-label.service
[Unit]
Description=ROOTUIP White-Label System
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/rootuip/white-label
ExecStart=/usr/bin/node branding-system.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 3. Configure Nginx

Add to your Nginx configuration:

```nginx
# White-label API
location /api/white-label/ {
    proxy_pass http://localhost:3008/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Partner Portal
location /partners/ {
    proxy_pass http://localhost:3010/;
    proxy_set_header Host $host;
}

# Multi-tenancy API
location /api/tenants/ {
    proxy_pass http://localhost:3009/;
    proxy_set_header Host $host;
}
```

### 4. Database Setup

```sql
-- Create schemas
CREATE SCHEMA white_label;
CREATE SCHEMA multi_tenancy;
CREATE SCHEMA partner_platform;

-- Create tables
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    organization_name VARCHAR(255),
    subdomain VARCHAR(100) UNIQUE,
    custom_domain VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE partners (
    id UUID PRIMARY KEY,
    company_name VARCHAR(255),
    partner_type VARCHAR(50),
    tier VARCHAR(50),
    commission_rate DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 5. DNS Configuration

#### Main Domain
- A record: @ → your-vps-ip
- CNAME: www → rootuip.com
- CNAME: api → rootuip.com
- CNAME: partners → rootuip.com

#### Wildcard for Tenants
- CNAME: *.tenants → rootuip.com

#### White-Label Domains
Customers should add:
- CNAME: their-domain.com → white-label.rootuip.com

### 6. SSL Certificates

```bash
# Install Let's Encrypt
certbot --nginx -d rootuip.com -d www.rootuip.com -d api.rootuip.com -d partners.rootuip.com

# Auto-renewal
certbot renew --dry-run
```

## Post-Deployment

### 1. Verify Services
```bash
# Check service status
systemctl status rootuip-white-label
systemctl status rootuip-domain-manager
systemctl status rootuip-multi-tenancy
systemctl status rootuip-partner-portal

# Check endpoints
curl https://rootuip.com/api/white-label/health
curl https://rootuip.com/api/tenants/health
curl https://rootuip.com/partners/health
```

### 2. Create First Tenant
```bash
curl -X POST https://rootuip.com/api/tenants/create \
  -H "Content-Type: application/json" \
  -d '{
    "organizationName": "Demo Logistics Co",
    "subdomain": "demo",
    "plan": "professional"
  }'
```

### 3. Onboard First Partner
```bash
./onboard-partner.sh "Logistics Solutions Inc" "partner@example.com" "system_integrator"
```

### 4. Monitor Performance
```bash
# View logs
journalctl -u rootuip-white-label -f
journalctl -u rootuip-multi-tenancy -f

# Check resource usage
htop
df -h
free -m
```

## Security Considerations

1. **Firewall Rules**
   ```bash
   ufw allow 80/tcp
   ufw allow 443/tcp
   ufw allow 22/tcp
   ufw enable
   ```

2. **Database Security**
   - Use strong passwords
   - Enable SSL for PostgreSQL
   - Implement row-level security

3. **API Security**
   - Rate limiting enabled
   - JWT authentication required
   - CORS properly configured

4. **Data Encryption**
   - All sensitive data encrypted at rest
   - TLS 1.3 for data in transit
   - Credential encryption for integrations

## Troubleshooting

### Service Won't Start
```bash
# Check logs
journalctl -u rootuip-white-label -n 50
# Check permissions
chown -R www-data:www-data /var/www/rootuip
```

### Database Connection Issues
```bash
# Test connection
psql -U rootuip_user -d rootuip -h localhost
# Check PostgreSQL status
systemctl status postgresql
```

### SSL Certificate Issues
```bash
# Renew certificates
certbot renew --force-renewal
# Check Nginx config
nginx -t
```

## Maintenance

### Daily Tasks
- Monitor service health
- Check error logs
- Review partner activity

### Weekly Tasks
- Database backups
- Security updates
- Performance optimization

### Monthly Tasks
- SSL certificate renewal check
- Capacity planning
- Partner commission processing

## Support

- Documentation: https://docs.rootuip.com
- Partner Support: partners@rootuip.com
- Technical Issues: https://github.com/rootuip/issues