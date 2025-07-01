# Database Outage Incident Response Playbook

## Incident Classification: P1 - Critical

## Initial Response (0-5 minutes)

### 1. Verify the Alert
```bash
# Check PostgreSQL service status
sudo systemctl status postgresql

# Check if PostgreSQL is accepting connections
psql -U postgres -c "SELECT 1;"

# Check system resources
df -h
free -m
top -n 1
```

### 2. Immediate Mitigation
```bash
# If service is down, attempt restart
sudo systemctl restart postgresql

# Check logs for errors
sudo tail -f /var/log/postgresql/postgresql-*.log

# If disk space issue
sudo journalctl --vacuum-time=1d
sudo apt-get clean
```

### 3. Enable Read-Only Mode
```javascript
// In api-gateway.js, enable circuit breaker
const circuitBreaker = require('./circuit-breaker');
circuitBreaker.enableReadOnlyMode();
```

## Investigation (5-15 minutes)

### 1. Check Recent Changes
```bash
# Review recent deployments
git log --oneline -10

# Check PostgreSQL configuration changes
sudo diff /etc/postgresql/*/main/postgresql.conf /etc/postgresql/*/main/postgresql.conf.backup

# Review recent queries
psql -U postgres -d rootuip -c "
SELECT query, calls, mean_exec_time 
FROM pg_stat_statements 
WHERE mean_exec_time > 1000 
ORDER BY mean_exec_time DESC 
LIMIT 10;"
```

### 2. Connection Analysis
```sql
-- Check active connections
SELECT pid, usename, application_name, client_addr, state, query_start, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;

-- Kill long-running queries if needed
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state != 'idle'
AND query_start < NOW() - INTERVAL '5 minutes';
```

### 3. Resource Issues
```bash
# Check for table bloat
psql -U postgres -d rootuip -c "
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;"

# Run emergency VACUUM if needed
psql -U postgres -d rootuip -c "VACUUM ANALYZE;"
```

## Recovery (15-30 minutes)

### 1. If Corruption Detected
```bash
# Stop PostgreSQL
sudo systemctl stop postgresql

# Run PostgreSQL recovery
sudo -u postgres pg_resetwal -f /var/lib/postgresql/*/main

# Start in single-user mode for repairs
sudo -u postgres postgres --single -D /var/lib/postgresql/*/main rootuip
```

### 2. Restore from Backup
```bash
# List available backups
aws s3 ls s3://rootuip-backups/postgresql/

# Restore latest backup
sudo systemctl stop postgresql
sudo -u postgres pg_restore -d rootuip /backup/latest/rootuip.dump
sudo systemctl start postgresql
```

### 3. Failover to Replica (if available)
```bash
# Promote replica to primary
ssh replica-server
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/*/main

# Update application connection strings
sed -i 's/primary-db/replica-db/g' /home/iii/ROOTUIP/.env
pm2 restart all
```

## Post-Incident (30+ minutes)

### 1. Verify Recovery
```bash
# Run health checks
curl https://app.rootuip.com/api/health
curl https://app.rootuip.com/ml/health

# Check critical functionality
npm run test:integration

# Monitor error rates
tail -f /home/iii/ROOTUIP/logs/error.log
```

### 2. Communication
- Update StatusPage.io
- Send all-clear to PagerDuty
- Notify stakeholders via Slack
- Schedule post-mortem meeting

### 3. Prevention Measures
```bash
# Increase monitoring
echo "*/5 * * * * /home/iii/ROOTUIP/monitoring/db-health-check.sh" | crontab -

# Update connection pool settings
cat >> /home/iii/ROOTUIP/pgbouncer.ini << EOF
max_client_conn = 200
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3
EOF

# Enable additional logging
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
SELECT pg_reload_conf();
```

## Emergency Contacts
- DBA Team: dba@rootuip.com / +1-xxx-xxx-xxxx
- Infrastructure Lead: ops@rootuip.com / +1-xxx-xxx-xxxx
- CTO: cto@rootuip.com / +1-xxx-xxx-xxxx

## Runbook Updates
Last Updated: 2024-01-01
Next Review: 2024-02-01
Owner: Infrastructure Team