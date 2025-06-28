# Enterprise Authentication System - Disaster Recovery Plan

## Executive Summary

This Disaster Recovery Plan (DRP) outlines the procedures and protocols for recovering the ROOTUIP Enterprise Authentication System in the event of a disaster, system failure, or security incident. The plan ensures business continuity with minimal downtime and data loss.

---

## 🎯 Recovery Objectives

### Recovery Time Objective (RTO)
- **Critical Systems**: 4 hours maximum
- **Authentication Service**: 2 hours maximum
- **Security Dashboard**: 1 hour maximum
- **Full System Restoration**: 8 hours maximum

### Recovery Point Objective (RPO)
- **Database Backups**: 1 hour maximum data loss
- **Configuration Files**: 15 minutes maximum
- **Audit Logs**: Real-time replication (no loss)
- **Session Data**: Acceptable loss (users re-authenticate)

---

## 📋 Disaster Categories

### Level 1 - Minor Incidents
- Service degradation
- Single component failure
- Performance issues
- **Recovery Time**: < 30 minutes

### Level 2 - Major Incidents
- Authentication service outage
- Database connectivity loss
- Multiple component failures
- **Recovery Time**: < 2 hours

### Level 3 - Critical Disasters
- Complete system failure
- Data center outage
- Security breach
- Natural disasters
- **Recovery Time**: < 8 hours

---

## 🏗️ System Architecture Overview

### Core Components
1. **Authentication Service** (Port 3003)
   - Enterprise auth service
   - JWT token management
   - MFA handling

2. **Database Layer**
   - PostgreSQL primary database
   - User credentials and sessions
   - Audit logs and security data

3. **Web Interface**
   - Login pages
   - Security dashboard
   - Monitoring dashboard

4. **Supporting Services**
   - Nginx reverse proxy
   - PM2 process manager
   - Monitoring services

---

## 💾 Backup Strategy

### Automated Backups

#### Database Backups
```bash
# Daily full backup at 2 AM
0 2 * * * /home/iii/ROOTUIP/scripts/backup-database.sh

# Hourly incremental backups
0 * * * * /home/iii/ROOTUIP/scripts/backup-incremental.sh
```

#### Configuration Backups
```bash
# Backup all configuration files
/home/iii/ROOTUIP/auth-enterprise/config.json
/home/iii/ROOTUIP/enterprise-auth-complete-schema.sql
/etc/nginx/sites-available/rootuip
/home/iii/.pm2/dump.pm2
```

#### Code Repository Backups
- Git repository with all source code
- Tagged releases for stable versions
- Automated pushes to remote repositories

### Backup Locations
1. **Primary**: Local server storage
2. **Secondary**: Cloud storage (AWS S3/Google Cloud)
3. **Tertiary**: Off-site physical backup

---

## 🔧 Recovery Procedures

### Level 1 Recovery - Service Restart

#### Authentication Service Failure
```bash
#!/bin/bash
# Quick service recovery

echo "Restarting authentication service..."

# Stop existing service
pm2 stop enterprise-auth

# Clear any locks or temp files
rm -f /tmp/auth-*.lock

# Restart service
pm2 start enterprise-auth

# Verify service is running
sleep 5
curl -f http://localhost:3003/auth/health || exit 1

echo "Authentication service restored"
```

#### Database Connection Issues
```bash
#!/bin/bash
# Database connection recovery

echo "Checking database connectivity..."

# Test database connection
PGPASSWORD=rootuip123 psql -h localhost -U postgres -d rootuip -c "SELECT 1;" || {
    echo "Database connection failed, attempting restart..."
    sudo systemctl restart postgresql
    sleep 10
}

# Restart auth service to refresh connections
pm2 restart enterprise-auth

echo "Database connectivity restored"
```

### Level 2 Recovery - Component Restoration

#### Full Authentication System Recovery
```bash
#!/bin/bash
# Complete auth system recovery

echo "Starting full authentication system recovery..."

# Stop all related services
pm2 stop all
sudo systemctl stop nginx

# Restore from backup if needed
if [ "$1" = "--from-backup" ]; then
    echo "Restoring from latest backup..."
    /home/iii/ROOTUIP/scripts/restore-from-backup.sh
fi

# Start database
sudo systemctl start postgresql
sleep 10

# Apply any pending schema updates
PGPASSWORD=rootuip123 psql -h localhost -U postgres -d rootuip -f /home/iii/ROOTUIP/enterprise-auth-complete-schema.sql

# Start authentication service
cd /home/iii/ROOTUIP/auth-enterprise
pm2 start simple-auth.js --name enterprise-auth

# Start monitoring services
pm2 start /home/iii/ROOTUIP/monitoring/performance-monitor.js --name auth-monitor

# Start nginx
sudo systemctl start nginx

# Verify all services
sleep 15
curl -f http://localhost:3003/auth/health || exit 1
curl -f https://app.rootuip.com/auth/health || exit 1

echo "Full authentication system recovery completed"
```

### Level 3 Recovery - Complete System Rebuild

#### Disaster Recovery from Scratch
```bash
#!/bin/bash
# Complete system rebuild from backups

echo "Starting complete disaster recovery..."

# Set variables
BACKUP_DATE=${1:-$(date +%Y%m%d)}
RESTORE_DIR="/tmp/disaster-recovery"

# Create restore directory
mkdir -p $RESTORE_DIR
cd $RESTORE_DIR

# Download backups from remote storage
echo "Downloading backups..."
# aws s3 sync s3://rootuip-backups/$BACKUP_DATE/ ./ --exclude "*" --include "*.sql" --include "*.tar.gz"

# Restore database
echo "Restoring database..."
sudo systemctl start postgresql
sleep 10

# Create database and user if needed
sudo -u postgres psql -c "CREATE DATABASE rootuip;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'rootuip123';" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE rootuip TO postgres;" 2>/dev/null || true

# Restore database from backup
gunzip -c database-backup-$BACKUP_DATE.sql.gz | PGPASSWORD=rootuip123 psql -h localhost -U postgres -d rootuip

# Restore application files
echo "Restoring application files..."
tar -xzf application-backup-$BACKUP_DATE.tar.gz -C /home/iii/

# Restore configuration files
tar -xzf config-backup-$BACKUP_DATE.tar.gz -C /

# Install dependencies
cd /home/iii/ROOTUIP
npm install --production

# Start all services
echo "Starting services..."
pm2 start ecosystem.config.js
sudo systemctl start nginx

# Verify recovery
sleep 30
/home/iii/ROOTUIP/test-enterprise-auth.sh

echo "Complete disaster recovery finished"
```

---

## 📝 Recovery Scripts

### Database Backup Script
```bash
#!/bin/bash
# /home/iii/ROOTUIP/scripts/backup-database.sh

BACKUP_DIR="/home/iii/backups/database"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/rootuip_backup_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create database backup
PGPASSWORD=rootuip123 pg_dump -h localhost -U postgres -d rootuip > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Upload to cloud storage
# aws s3 cp $BACKUP_FILE.gz s3://rootuip-backups/database/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Database backup completed: $BACKUP_FILE.gz"
```

### Configuration Backup Script
```bash
#!/bin/bash
# /home/iii/ROOTUIP/scripts/backup-config.sh

BACKUP_DIR="/home/iii/backups/config"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/config_backup_$DATE.tar.gz"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup configuration files
tar -czf $BACKUP_FILE \
    /home/iii/ROOTUIP/auth-enterprise/config.json \
    /home/iii/ROOTUIP/enterprise-auth-complete-schema.sql \
    /home/iii/ROOTUIP/monitoring/alerts.json \
    /etc/nginx/sites-available/rootuip \
    /home/iii/.pm2/dump.pm2

# Upload to cloud storage
# aws s3 cp $BACKUP_FILE s3://rootuip-backups/config/

echo "Configuration backup completed: $BACKUP_FILE"
```

### Health Check Script
```bash
#!/bin/bash
# /home/iii/ROOTUIP/scripts/health-check.sh

echo "Running comprehensive health check..."

# Check authentication service
if curl -f -s http://localhost:3003/auth/health > /dev/null; then
    echo "✓ Authentication service is healthy"
else
    echo "✗ Authentication service is down"
    exit 1
fi

# Check database connectivity
if PGPASSWORD=rootuip123 psql -h localhost -U postgres -d rootuip -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✓ Database is accessible"
else
    echo "✗ Database is not accessible"
    exit 1
fi

# Check nginx
if curl -f -s https://app.rootuip.com/auth/health > /dev/null; then
    echo "✓ Nginx reverse proxy is working"
else
    echo "✗ Nginx reverse proxy is not working"
    exit 1
fi

# Check PM2 processes
if pm2 list | grep -q "online"; then
    echo "✓ PM2 processes are running"
else
    echo "✗ PM2 processes are not running"
    exit 1
fi

echo "All health checks passed"
```

---

## 🚨 Emergency Contacts

### Primary Response Team
- **System Administrator**: admin@rootuip.com / +1-555-ADMIN
- **Database Administrator**: dba@rootuip.com / +1-555-DATABASE
- **Security Officer**: security@rootuip.com / +1-555-SECURITY
- **DevOps Engineer**: devops@rootuip.com / +1-555-DEVOPS

### Escalation Contacts
- **CTO**: cto@rootuip.com / +1-555-CTO-HELP
- **CEO**: ceo@rootuip.com / +1-555-CEO-HELP

### External Vendors
- **Cloud Provider Support**: support@cloudprovider.com
- **ISP Emergency Line**: +1-555-ISP-HELP
- **Data Center Support**: +1-555-DATACENTER

---

## 📊 Communication Plan

### Internal Communication
1. **Immediate Notification** (< 15 minutes)
   - Response team via SMS/email
   - Management notification
   - Status page update

2. **Regular Updates** (Every 30 minutes)
   - Progress reports to stakeholders
   - Customer communication
   - Vendor coordination

3. **Resolution Notification**
   - Service restoration confirmation
   - Post-mortem scheduling
   - Lessons learned documentation

### Customer Communication
- **Status Page**: https://status.rootuip.com
- **Email Notifications**: System administrators
- **API Status**: Service health endpoints

---

## 🧪 Testing and Validation

### Monthly DR Tests
- Service restart procedures
- Backup restoration verification
- Health check validation
- Communication plan testing

### Quarterly Full Tests
- Complete system recovery
- Backup integrity verification
- Performance validation
- Security assessment

### Annual DR Drills
- Simulated disaster scenarios
- Cross-team coordination
- Process improvement
- Documentation updates

---

## 📈 Monitoring and Alerting

### Critical Alerts
- Service downtime (immediate)
- Database connectivity loss (immediate)
- High error rates (5 minutes)
- Security breaches (immediate)

### Monitoring Dashboards
- Real-time service health
- Performance metrics
- Error tracking
- Resource utilization

---

## 📋 Post-Recovery Procedures

### Immediate Actions (0-2 hours)
1. Verify all services are operational
2. Run comprehensive health checks
3. Validate data integrity
4. Confirm security controls

### Short-term Actions (2-24 hours)
1. Monitor system stability
2. Review logs for issues
3. Communicate with stakeholders
4. Document incident details

### Long-term Actions (1-7 days)
1. Conduct post-mortem analysis
2. Update procedures based on lessons learned
3. Test recovered systems thoroughly
4. Implement preventive measures

---

## 📚 Documentation and Training

### Required Documentation
- Current system architecture diagrams
- Updated contact information
- Backup and restore procedures
- Security incident response plan

### Training Requirements
- Annual DR training for all team members
- New employee DR orientation
- Vendor training coordination
- Regular procedure updates

---

## 🔍 Compliance and Audit

### Regulatory Requirements
- SOC 2 Type II compliance
- GDPR data recovery obligations
- Industry-specific requirements
- Audit trail maintenance

### Documentation Requirements
- Recovery procedure documentation
- Test results and reports
- Incident response records
- Training completion records

---

## 📅 Review and Updates

### Regular Reviews
- **Monthly**: Procedure validation
- **Quarterly**: Full plan review
- **Annually**: Complete plan update
- **As Needed**: After incidents or changes

### Change Management
- Version control for all procedures
- Approval process for plan changes
- Distribution of updated procedures
- Training on new procedures

---

**Document Version**: 1.0  
**Last Updated**: June 27, 2025  
**Next Review Date**: September 27, 2025  
**Approved By**: CTO, Security Officer, Operations Manager

---

*This disaster recovery plan ensures the ROOTUIP Enterprise Authentication System can be quickly restored in any disaster scenario, maintaining business continuity and data integrity.*