-- ROOTUIP Database Optimization Queries
-- Run these queries periodically to maintain optimal performance

-- 1. Update table statistics for query planner
ANALYZE;

-- 2. Clean up dead rows and reclaim space
VACUUM ANALYZE;

-- 3. Reindex tables for better performance
REINDEX DATABASE rootuip;

-- 4. Find and remove duplicate entries (if any)
WITH duplicate_users AS (
    SELECT email, MIN(id) as keep_id
    FROM users
    GROUP BY email
    HAVING COUNT(*) > 1
)
DELETE FROM users
WHERE email IN (SELECT email FROM duplicate_users)
AND id NOT IN (SELECT keep_id FROM duplicate_users);

-- 5. Create missing indexes for better query performance
-- Index for faster auth lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Index for ML predictions
CREATE INDEX IF NOT EXISTS idx_ml_predictions_container ON ml_predictions(container_number);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_date ON ml_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_risk ON ml_predictions(risk_score);

-- Index for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);

-- 6. Optimize query performance for common queries
-- Create materialized view for daily statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_ml_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_predictions,
    AVG(risk_score) as avg_risk_score,
    SUM(CASE WHEN risk_score < 0.2 THEN 1 ELSE 0 END) as low_risk_count,
    SUM(CASE WHEN risk_score >= 0.2 AND risk_score < 0.5 THEN 1 ELSE 0 END) as medium_risk_count,
    SUM(CASE WHEN risk_score >= 0.5 THEN 1 ELSE 0 END) as high_risk_count,
    AVG(processing_time_ms) as avg_processing_time
FROM ml_predictions
GROUP BY DATE(created_at);

-- Refresh materialized view
REFRESH MATERIALIZED VIEW daily_ml_stats;

-- 7. Clean up old session data (older than 30 days)
DELETE FROM sessions WHERE last_accessed < NOW() - INTERVAL '30 days';

-- 8. Clean up old audit logs (older than 90 days)
DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '90 days';

-- 9. Optimize table storage
ALTER TABLE ml_predictions SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE audit_logs SET (autovacuum_vacuum_scale_factor = 0.1);

-- 10. Check table sizes and bloat
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 11. Find slow queries (requires pg_stat_statements extension)
-- CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
-- SELECT 
--     query,
--     calls,
--     total_time,
--     mean_time,
--     max_time
-- FROM pg_stat_statements
-- ORDER BY mean_time DESC
-- LIMIT 10;

-- 12. Connection pool statistics
SELECT 
    datname,
    numbackends as active_connections,
    xact_commit as transactions_committed,
    xact_rollback as transactions_rolled_back,
    blks_read as disk_blocks_read,
    blks_hit as buffer_hits,
    tup_returned as rows_returned,
    tup_fetched as rows_fetched,
    tup_inserted as rows_inserted,
    tup_updated as rows_updated,
    tup_deleted as rows_deleted
FROM pg_stat_database
WHERE datname = 'rootuip';

-- 13. Table maintenance status
SELECT 
    schemaname,
    tablename,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze,
    vacuum_count,
    autovacuum_count,
    analyze_count,
    autoanalyze_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY last_autovacuum NULLS FIRST;

-- 14. Create function for regular maintenance
CREATE OR REPLACE FUNCTION perform_maintenance()
RETURNS void AS $$
BEGIN
    -- Update statistics
    EXECUTE 'ANALYZE';
    
    -- Clean up sessions
    DELETE FROM sessions WHERE last_accessed < NOW() - INTERVAL '30 days';
    
    -- Refresh materialized views
    EXECUTE 'REFRESH MATERIALIZED VIEW daily_ml_stats';
    
    -- Log maintenance
    INSERT INTO audit_logs (user_id, action, details, ip_address, timestamp)
    VALUES (0, 'system_maintenance', 'Automated maintenance completed', '127.0.0.1', NOW());
END;
$$ LANGUAGE plpgsql;

-- 15. Schedule maintenance (requires pg_cron extension or external scheduler)
-- SELECT cron.schedule('perform-maintenance', '0 3 * * *', 'SELECT perform_maintenance()');

-- Report
SELECT 'Database optimization queries completed successfully' as status;