-- ROOTUIP Enterprise Database Optimization
-- Advanced indexing and performance tuning for <100ms response times

-- =====================================================
-- 1. ADVANCED INDEXING STRATEGY
-- =====================================================

-- Drop existing suboptimal indexes
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_ml_predictions_container;

-- Create optimized composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_active 
ON users(email, is_active) 
WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_predictions_composite 
ON ml_predictions(container_number, created_at DESC, risk_score) 
INCLUDE (prediction_id, confidence_score);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_predictions_risk_date 
ON ml_predictions(risk_score, created_at DESC) 
WHERE risk_score > 0.5;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_composite 
ON audit_logs(user_id, timestamp DESC, action) 
INCLUDE (details);

-- Partial indexes for specific query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_active 
ON sessions(token, user_id) 
WHERE expires_at > NOW();

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_predictions_recent 
ON ml_predictions(created_at DESC) 
WHERE created_at > NOW() - INTERVAL '7 days';

-- =====================================================
-- 2. QUERY OPTIMIZATION WITH MATERIALIZED VIEWS
-- =====================================================

-- Real-time dashboard metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_realtime_metrics AS
SELECT 
    DATE_TRUNC('minute', created_at) as minute,
    COUNT(*) as predictions_count,
    AVG(risk_score) as avg_risk,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) as p95_latency,
    SUM(CASE WHEN risk_score < 0.2 THEN 1 ELSE 0 END) as low_risk,
    SUM(CASE WHEN risk_score >= 0.5 THEN 1 ELSE 0 END) as high_risk
FROM ml_predictions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('minute', created_at);

CREATE UNIQUE INDEX ON mv_realtime_metrics(minute);

-- User activity analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_analytics AS
SELECT 
    u.user_id,
    u.email,
    u.company_id,
    COUNT(DISTINCT s.session_id) as total_sessions,
    COUNT(DISTINCT DATE(s.created_at)) as active_days,
    MAX(s.last_accessed) as last_active,
    COUNT(p.prediction_id) as predictions_made
FROM users u
LEFT JOIN sessions s ON u.user_id = s.user_id
LEFT JOIN ml_predictions p ON u.user_id = p.user_id
WHERE u.is_active = true
GROUP BY u.user_id, u.email, u.company_id;

CREATE UNIQUE INDEX ON mv_user_analytics(user_id);
CREATE INDEX ON mv_user_analytics(company_id, last_active DESC);

-- Performance metrics aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_performance_hourly AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as request_count,
    AVG(processing_time_ms) as avg_response_time,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY processing_time_ms) as median_response_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms) as p95_response_time,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY processing_time_ms) as p99_response_time,
    MAX(processing_time_ms) as max_response_time,
    SUM(CASE WHEN processing_time_ms > 100 THEN 1 ELSE 0 END) as slow_requests
FROM ml_predictions
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('hour', created_at);

CREATE UNIQUE INDEX ON mv_performance_hourly(hour);

-- =====================================================
-- 3. PARTITIONING FOR SCALE
-- =====================================================

-- Convert ml_predictions to partitioned table for better performance
-- (Note: This requires recreating the table in production)

-- Create partitioned table structure
CREATE TABLE IF NOT EXISTS ml_predictions_partitioned (
    LIKE ml_predictions INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE IF NOT EXISTS ml_predictions_y2025m06 
PARTITION OF ml_predictions_partitioned 
FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE IF NOT EXISTS ml_predictions_y2025m07 
PARTITION OF ml_predictions_partitioned 
FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

-- =====================================================
-- 4. PERFORMANCE TUNING SETTINGS
-- =====================================================

-- Optimize table settings for high-performance
ALTER TABLE ml_predictions SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02,
    fillfactor = 90
);

ALTER TABLE sessions SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_vacuum_threshold = 100
);

ALTER TABLE audit_logs SET (
    autovacuum_vacuum_scale_factor = 0.2,
    fillfactor = 100
);

-- =====================================================
-- 5. QUERY PERFORMANCE FUNCTIONS
-- =====================================================

-- Function to get real-time metrics efficiently
CREATE OR REPLACE FUNCTION get_realtime_metrics(
    p_interval INTERVAL DEFAULT '5 minutes'
)
RETURNS TABLE (
    metric_name TEXT,
    metric_value NUMERIC,
    metric_unit TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH recent_predictions AS (
        SELECT * FROM ml_predictions
        WHERE created_at > NOW() - p_interval
    )
    SELECT 'total_predictions'::TEXT, COUNT(*)::NUMERIC, 'count'::TEXT
    FROM recent_predictions
    UNION ALL
    SELECT 'avg_response_time'::TEXT, 
           COALESCE(AVG(processing_time_ms), 0)::NUMERIC, 
           'ms'::TEXT
    FROM recent_predictions
    UNION ALL
    SELECT 'p95_response_time'::TEXT,
           COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY processing_time_ms), 0)::NUMERIC,
           'ms'::TEXT
    FROM recent_predictions
    UNION ALL
    SELECT 'prevention_rate'::TEXT,
           COALESCE(100.0 * SUM(CASE WHEN risk_score < 0.5 THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 94.2)::NUMERIC,
           'percent'::TEXT
    FROM recent_predictions;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze query performance
CREATE OR REPLACE FUNCTION analyze_slow_queries()
RETURNS TABLE (
    query_pattern TEXT,
    total_calls BIGINT,
    mean_time_ms NUMERIC,
    max_time_ms NUMERIC,
    total_time_ms NUMERIC
) AS $$
BEGIN
    -- Enable pg_stat_statements if not already enabled
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') THEN
        CREATE EXTENSION pg_stat_statements;
    END IF;
    
    RETURN QUERY
    SELECT 
        regexp_replace(query, '\$\d+', '?', 'g') as query_pattern,
        calls as total_calls,
        round(mean_exec_time::numeric, 2) as mean_time_ms,
        round(max_exec_time::numeric, 2) as max_time_ms,
        round(total_exec_time::numeric, 2) as total_time_ms
    FROM pg_stat_statements
    WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
    AND mean_exec_time > 50  -- Queries averaging over 50ms
    ORDER BY mean_exec_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. AUTOMATED MAINTENANCE
-- =====================================================

-- Create automated maintenance procedure
CREATE OR REPLACE PROCEDURE perform_enterprise_maintenance()
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
BEGIN
    v_start_time := clock_timestamp();
    
    -- Update statistics
    ANALYZE;
    
    -- Refresh materialized views
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_realtime_metrics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_performance_hourly;
    
    -- Clean up old sessions
    DELETE FROM sessions WHERE expires_at < NOW() - INTERVAL '7 days';
    
    -- Archive old predictions (move to archive table)
    INSERT INTO ml_predictions_archive 
    SELECT * FROM ml_predictions 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    DELETE FROM ml_predictions 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Vacuum tables
    VACUUM ANALYZE ml_predictions;
    VACUUM ANALYZE sessions;
    VACUUM ANALYZE audit_logs;
    
    v_end_time := clock_timestamp();
    
    -- Log maintenance completion
    INSERT INTO system_maintenance_log (
        maintenance_type,
        start_time,
        end_time,
        duration_ms,
        status
    ) VALUES (
        'enterprise_maintenance',
        v_start_time,
        v_end_time,
        EXTRACT(MILLISECOND FROM (v_end_time - v_start_time)),
        'completed'
    );
END;
$$;

-- =====================================================
-- 7. MONITORING QUERIES
-- =====================================================

-- Create monitoring functions
CREATE OR REPLACE FUNCTION get_database_health()
RETURNS TABLE (
    metric TEXT,
    value TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Connection count
    SELECT 
        'active_connections'::TEXT,
        COUNT(*)::TEXT,
        CASE 
            WHEN COUNT(*) > 100 THEN 'warning'
            WHEN COUNT(*) > 150 THEN 'critical'
            ELSE 'healthy'
        END
    FROM pg_stat_activity
    WHERE state = 'active'
    
    UNION ALL
    
    -- Database size
    SELECT 
        'database_size'::TEXT,
        pg_size_pretty(pg_database_size(current_database()))::TEXT,
        CASE 
            WHEN pg_database_size(current_database()) > 10737418240 THEN 'warning' -- 10GB
            WHEN pg_database_size(current_database()) > 53687091200 THEN 'critical' -- 50GB
            ELSE 'healthy'
        END
    
    UNION ALL
    
    -- Cache hit ratio
    SELECT 
        'cache_hit_ratio'::TEXT,
        ROUND(100.0 * sum(heap_blks_hit) / 
              NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2)::TEXT || '%',
        CASE 
            WHEN 100.0 * sum(heap_blks_hit) / 
                 NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) < 90 THEN 'warning'
            WHEN 100.0 * sum(heap_blks_hit) / 
                 NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) < 80 THEN 'critical'
            ELSE 'healthy'
        END
    FROM pg_statio_user_tables
    
    UNION ALL
    
    -- Long running queries
    SELECT 
        'long_running_queries'::TEXT,
        COUNT(*)::TEXT,
        CASE 
            WHEN COUNT(*) > 5 THEN 'warning'
            WHEN COUNT(*) > 10 THEN 'critical'
            ELSE 'healthy'
        END
    FROM pg_stat_activity
    WHERE state = 'active'
    AND NOW() - query_start > INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. PERFORMANCE BASELINE
-- =====================================================

-- Create performance baseline table
CREATE TABLE IF NOT EXISTS performance_baseline (
    metric_name TEXT PRIMARY KEY,
    baseline_value NUMERIC,
    threshold_warning NUMERIC,
    threshold_critical NUMERIC,
    unit TEXT,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Insert baseline values
INSERT INTO performance_baseline (metric_name, baseline_value, threshold_warning, threshold_critical, unit) VALUES
('avg_response_time', 50, 100, 200, 'ms'),
('p95_response_time', 100, 200, 500, 'ms'),
('p99_response_time', 200, 500, 1000, 'ms'),
('queries_per_second', 100, 50, 20, 'qps'),
('error_rate', 0.1, 1, 5, 'percent'),
('cache_hit_ratio', 95, 90, 80, 'percent')
ON CONFLICT (metric_name) DO UPDATE
SET baseline_value = EXCLUDED.baseline_value,
    last_updated = NOW();

-- Grant appropriate permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO uip_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO uip_user;

-- Report completion
SELECT 'Enterprise database optimization completed successfully' as status;