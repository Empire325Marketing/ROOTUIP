# High Response Time Incident Response Playbook

## Incident Classification: P2 - High

## Initial Response (0-5 minutes)

### 1. Identify Affected Services
```bash
# Check current response times
curl -w "@curl-format.txt" -o /dev/null -s https://app.rootuip.com/api/health

# Check all service endpoints
for endpoint in api ml auth gateway; do
  echo "Testing $endpoint..."
  time curl -s https://app.rootuip.com/$endpoint/health
done

# View real-time metrics
pm2 monit
```

### 2. Quick Diagnostics
```bash
# CPU and Memory usage
htop

# Network connections
ss -tuln | grep -E ':(3001|3002|3003|8000)'

# Check for traffic spikes
tail -f /var/log/nginx/access.log | cut -d' ' -f1 | sort | uniq -c | sort -rn | head -20
```

### 3. Enable Rate Limiting
```nginx
# Add to nginx configuration
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req zone=api_limit burst=20 nodelay;

# Reload nginx
sudo nginx -s reload
```

## Investigation (5-15 minutes)

### 1. Application Performance
```javascript
// Add temporary logging to identify slow endpoints
const responseTime = require('response-time');
app.use(responseTime((req, res, time) => {
  if (time > 1000) {
    console.error(`Slow request: ${req.method} ${req.url} - ${time}ms`);
  }
}));
```

### 2. Database Performance
```sql
-- Find slow queries
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 500
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Check for lock contention
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS blocking_statement
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;
```

### 3. ML Service Performance
```python
# Check ML model loading times
import time
from predict import DDPredictor

start = time.time()
predictor = DDPredictor()
print(f"Model load time: {time.time() - start}s")

# Profile prediction time
import cProfile
cProfile.run('predictor.predict(test_data)')
```

## Mitigation (15-30 minutes)

### 1. Scale Up Services
```bash
# Add more workers
pm2 scale api-gateway +2
pm2 scale auth-service +1

# For ML service, add instances on different ports
cd /home/iii/ROOTUIP/ml-system
pm2 start "uvicorn api:app --port 8001" --name ml-service-2
pm2 start "uvicorn api:app --port 8002" --name ml-service-3

# Update nginx upstream
cat > /etc/nginx/sites-available/ml-upstream.conf << EOF
upstream ml_backend {
    least_conn;
    server localhost:8000 weight=1;
    server localhost:8001 weight=1;
    server localhost:8002 weight=1;
}
EOF
```

### 2. Enable Caching
```javascript
// Add Redis caching for frequent queries
const redis = require('redis');
const client = redis.createClient();

app.use('/api/roi-calculator', async (req, res, next) => {
  const cacheKey = `roi:${JSON.stringify(req.query)}`;
  const cached = await client.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));
  next();
});
```

### 3. Database Optimization
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_shipments_eta ON shipments(eta) WHERE status = 'active';
CREATE INDEX CONCURRENTLY idx_predictions_created ON ml_predictions(created_at);

-- Update statistics
ANALYZE;

-- Increase work_mem for complex queries
ALTER SYSTEM SET work_mem = '256MB';
SELECT pg_reload_conf();
```

## Recovery Verification (30+ minutes)

### 1. Performance Testing
```bash
# Load test with Apache Bench
ab -n 1000 -c 50 https://app.rootuip.com/api/health

# Test critical endpoints
for i in {1..100}; do
  time curl -s https://app.rootuip.com/ml/predict -X POST \
    -H "Content-Type: application/json" \
    -d '{"shipmentData": {...}}'
done | grep real | awk '{sum+=$2; count++} END {print "Average:", sum/count}'
```

### 2. Monitor Metrics
```bash
# Watch Prometheus metrics
curl -s http://localhost:9090/api/v1/query?query=http_request_duration_seconds | jq .

# Check Grafana dashboards
open https://monitor.rootuip.com
```

### 3. Gradual Traffic Restoration
```nginx
# Remove rate limits gradually
limit_req zone=api_limit burst=50 nodelay;  # Increase burst
# Then eventually remove the limit_req directive
```

## Prevention Measures

### 1. Performance Budget
```javascript
// Add performance budgets to CI/CD
module.exports = {
  ci: {
    collect: {
      url: ['https://app.rootuip.com'],
    },
    assert: {
      assertions: {
        'first-contentful-paint': ['error', {maxNumericValue: 2000}],
        'interactive': ['error', {maxNumericValue: 5000}],
      },
    },
  },
};
```

### 2. Query Optimization
```sql
-- Regular maintenance
CREATE OR REPLACE FUNCTION maintenance_routine()
RETURNS void AS $$
BEGIN
  -- Update statistics
  ANALYZE;
  
  -- Reindex if needed
  REINDEX DATABASE rootuip;
  
  -- Clean up old data
  DELETE FROM ml_predictions WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Vacuum
  VACUUM ANALYZE;
END;
$$ LANGUAGE plpgsql;

-- Schedule weekly
SELECT cron.schedule('weekly-maintenance', '0 2 * * 0', 'SELECT maintenance_routine()');
```

### 3. Monitoring Improvements
```yaml
# Add more granular alerts
- alert: SlowEndpoint
  expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "Endpoint {{ $labels.handler }} is slow"
    description: "95th percentile: {{ $value }}s"
```

## Communication Template

### Status Update
```
🟡 Performance Degradation Detected

Affected Services: [API Gateway / ML Service / Auth]
Impact: Response times elevated to Xs (normal: <2s)
Users Affected: ~X%
Status: Investigating / Mitigating / Monitoring

Next Update: In 15 minutes
```

### Resolution Message
```
✅ Performance Restored

Issue: [Brief description]
Duration: XX minutes
Root Cause: [Summary]
Fix Applied: [What was done]
Prevention: [Future measures]

Full post-mortem to follow.
```