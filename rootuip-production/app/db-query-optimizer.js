/**
 * ROOTUIP Database Query Optimizer
 * Monitors queries, suggests indexes, and implements query caching
 */

const { Pool } = require('pg');
const Redis = require('redis');
const crypto = require('crypto');

class DatabaseQueryOptimizer {
    constructor(config) {
        this.pgPool = new Pool({
            connectionString: config.databaseUrl || process.env.DATABASE_URL,
            max: 20, // Connection pool size
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            statement_timeout: 5000, // 5 second query timeout
        });

        this.redis = Redis.createClient({
            url: config.redisUrl || process.env.REDIS_URL
        });

        this.queryCache = new Map();
        this.queryStats = new Map();
        this.slowQueryThreshold = config.slowQueryThreshold || 100; // ms
        this.cacheEnabled = config.cacheEnabled !== false;
        
        // Performance monitor reference
        this.performanceMonitor = config.performanceMonitor;

        this.init();
    }

    async init() {
        // Connect to Redis
        await this.redis.connect();
        
        // Wrap query method for monitoring
        this.wrapQueryMethod();
        
        // Create indexes for common queries
        await this.createOptimalIndexes();
        
        // Start query analysis
        setInterval(() => this.analyzeQueryPerformance(), 300000); // Every 5 minutes
    }

    wrapQueryMethod() {
        const originalQuery = this.pgPool.query.bind(this.pgPool);
        
        this.pgPool.query = async (text, params) => {
            const startTime = Date.now();
            const queryHash = this.hashQuery(text, params);
            
            // Check cache first
            if (this.cacheEnabled && this.isSelectQuery(text)) {
                const cached = await this.getFromCache(queryHash);
                if (cached) {
                    this.recordQueryStats(text, 0, true); // 0ms for cache hit
                    return cached;
                }
            }

            try {
                // Add EXPLAIN ANALYZE for slow queries in development
                let queryText = text;
                if (process.env.NODE_ENV !== 'production' && this.shouldAnalyze(text)) {
                    queryText = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${text}`;
                }

                const result = await originalQuery(queryText, params);
                const duration = Date.now() - startTime;

                // Record stats
                this.recordQueryStats(text, duration, false);

                // Report to performance monitor
                if (this.performanceMonitor) {
                    this.performanceMonitor.recordDatabaseQuery({
                        sql: text,
                        duration,
                        rows: result.rowCount
                    });
                }

                // Cache if appropriate
                if (this.cacheEnabled && this.isSelectQuery(text) && duration > 50) {
                    await this.addToCache(queryHash, result, this.getCacheTTL(text));
                }

                // Log slow queries
                if (duration > this.slowQueryThreshold) {
                    console.warn(`Slow query detected (${duration}ms):`, text.substring(0, 100) + '...');
                    this.suggestOptimizations(text, duration, result);
                }

                return result;
            } catch (error) {
                console.error('Query error:', error);
                throw error;
            }
        };
    }

    async createOptimalIndexes() {
        const indexes = [
            // Container tracking indexes
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_number ON containers(container_number)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_status ON containers(status)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_updated ON containers(updated_at DESC)',
            
            // Events indexes
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_container ON events(container_id, event_time DESC)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_type ON events(event_type, event_time DESC)',
            
            // Risk scores indexes
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_risk_container ON risk_scores(container_id)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_risk_level ON risk_scores(risk_level) WHERE risk_level IN (\'HIGH\', \'CRITICAL\')',
            
            // Composite indexes for common queries
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_status_risk ON containers(status) INCLUDE (risk_level)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_container_type ON events(container_id, event_type, event_time DESC)',
            
            // Partial indexes for performance
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_containers ON containers(container_number) WHERE status NOT IN (\'DELIVERED\', \'CANCELLED\')',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recent_events ON events(event_time) WHERE event_time > NOW() - INTERVAL \'7 days\''
        ];

        for (const index of indexes) {
            try {
                await this.pgPool.query(index);
            } catch (error) {
                if (!error.message.includes('already exists')) {
                    console.error('Error creating index:', error);
                }
            }
        }

        // Update table statistics
        await this.pgPool.query('ANALYZE containers, events, risk_scores');
    }

    hashQuery(text, params) {
        const data = JSON.stringify({ text, params });
        return crypto.createHash('md5').update(data).digest('hex');
    }

    isSelectQuery(text) {
        return text.trim().toUpperCase().startsWith('SELECT');
    }

    shouldAnalyze(text) {
        // Analyze complex queries
        return text.includes('JOIN') || text.includes('GROUP BY') || text.includes('ORDER BY');
    }

    async getFromCache(key) {
        try {
            const cached = await this.redis.get(`query:${key}`);
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (error) {
            console.error('Cache get error:', error);
        }
        return null;
    }

    async addToCache(key, result, ttl = 300) {
        try {
            // Only cache small result sets
            if (result.rows && result.rows.length < 1000) {
                const data = {
                    rows: result.rows,
                    rowCount: result.rowCount,
                    fields: result.fields
                };
                await this.redis.setex(`query:${key}`, ttl, JSON.stringify(data));
            }
        } catch (error) {
            console.error('Cache set error:', error);
        }
    }

    getCacheTTL(query) {
        // Different TTL based on query type
        if (query.includes('risk_scores')) return 60; // 1 minute for risk data
        if (query.includes('events')) return 300; // 5 minutes for events
        if (query.includes('containers')) return 600; // 10 minutes for containers
        return 300; // Default 5 minutes
    }

    recordQueryStats(query, duration, cached) {
        const key = this.normalizeQuery(query);
        
        if (!this.queryStats.has(key)) {
            this.queryStats.set(key, {
                count: 0,
                totalDuration: 0,
                maxDuration: 0,
                minDuration: Infinity,
                cacheHits: 0,
                lastRun: Date.now()
            });
        }

        const stats = this.queryStats.get(key);
        stats.count++;
        
        if (cached) {
            stats.cacheHits++;
        } else {
            stats.totalDuration += duration;
            stats.maxDuration = Math.max(stats.maxDuration, duration);
            stats.minDuration = Math.min(stats.minDuration, duration);
        }
        
        stats.lastRun = Date.now();
    }

    normalizeQuery(query) {
        // Remove values to group similar queries
        return query
            .replace(/\$\d+/g, '$?') // Replace positional parameters
            .replace(/'\w+'/g, "'?'") // Replace string literals
            .replace(/\d+/g, '?') // Replace numbers
            .trim();
    }

    async suggestOptimizations(query, duration, result) {
        const suggestions = [];

        // Check for missing indexes
        if (query.includes('WHERE') && !query.includes('INDEX')) {
            const whereColumns = this.extractWhereColumns(query);
            for (const column of whereColumns) {
                const indexExists = await this.checkIndexExists(column);
                if (!indexExists) {
                    suggestions.push({
                        type: 'missing_index',
                        column,
                        suggestion: `Consider adding index on ${column}`,
                        estimatedImprovement: '50-90%'
                    });
                }
            }
        }

        // Check for SELECT *
        if (query.includes('SELECT *')) {
            suggestions.push({
                type: 'select_star',
                suggestion: 'Avoid SELECT *, specify only needed columns',
                estimatedImprovement: '10-30%'
            });
        }

        // Check for missing LIMIT
        if (query.includes('SELECT') && !query.includes('LIMIT') && result.rowCount > 100) {
            suggestions.push({
                type: 'missing_limit',
                suggestion: 'Consider adding LIMIT clause for large result sets',
                estimatedImprovement: '20-50%'
            });
        }

        // Check for N+1 queries
        const stats = this.queryStats.get(this.normalizeQuery(query));
        if (stats && stats.count > 100 && stats.count / (Date.now() - stats.lastRun) > 0.1) {
            suggestions.push({
                type: 'n_plus_one',
                suggestion: 'Possible N+1 query pattern detected. Consider batch loading',
                estimatedImprovement: '80-95%'
            });
        }

        if (suggestions.length > 0) {
            console.log('Query optimization suggestions:', suggestions);
        }

        return suggestions;
    }

    extractWhereColumns(query) {
        const columns = [];
        const whereMatch = query.match(/WHERE\s+(.+?)(?:GROUP|ORDER|LIMIT|$)/i);
        
        if (whereMatch) {
            const conditions = whereMatch[1];
            const columnMatches = conditions.match(/(\w+)\s*[=<>]/g);
            if (columnMatches) {
                columnMatches.forEach(match => {
                    const column = match.replace(/\s*[=<>]/, '');
                    columns.push(column);
                });
            }
        }
        
        return columns;
    }

    async checkIndexExists(column) {
        const query = `
            SELECT 1 
            FROM pg_indexes 
            WHERE indexdef LIKE '%${column}%' 
            LIMIT 1
        `;
        
        try {
            const result = await this.pgPool.query(query);
            return result.rowCount > 0;
        } catch (error) {
            return false;
        }
    }

    async analyzeQueryPerformance() {
        const slowQueries = [];
        
        for (const [query, stats] of this.queryStats.entries()) {
            const avgDuration = stats.totalDuration / (stats.count - stats.cacheHits);
            
            if (avgDuration > this.slowQueryThreshold) {
                slowQueries.push({
                    query,
                    avgDuration,
                    count: stats.count,
                    cacheHitRate: stats.cacheHits / stats.count,
                    maxDuration: stats.maxDuration
                });
            }
        }

        // Sort by impact (duration * count)
        slowQueries.sort((a, b) => 
            (b.avgDuration * b.count) - (a.avgDuration * a.count)
        );

        if (slowQueries.length > 0) {
            console.log('Top slow queries:');
            slowQueries.slice(0, 5).forEach((sq, i) => {
                console.log(`${i + 1}. Avg: ${sq.avgDuration.toFixed(0)}ms, Count: ${sq.count}, Cache Hit: ${(sq.cacheHitRate * 100).toFixed(1)}%`);
                console.log(`   Query: ${sq.query.substring(0, 100)}...`);
            });

            // Generate optimization report
            this.generateOptimizationReport(slowQueries);
        }

        // Clear old stats
        const oneHourAgo = Date.now() - 3600000;
        for (const [query, stats] of this.queryStats.entries()) {
            if (stats.lastRun < oneHourAgo) {
                this.queryStats.delete(query);
            }
        }
    }

    async generateOptimizationReport(slowQueries) {
        const report = {
            timestamp: new Date().toISOString(),
            totalQueries: this.queryStats.size,
            slowQueries: slowQueries.length,
            recommendations: []
        };

        // Top recommendations
        if (slowQueries.length > 0) {
            // Check for queries that could benefit from caching
            const cacheCandidates = slowQueries.filter(sq => 
                sq.cacheHitRate < 0.5 && sq.count > 10
            );
            
            if (cacheCandidates.length > 0) {
                report.recommendations.push({
                    type: 'caching',
                    impact: 'high',
                    description: `${cacheCandidates.length} queries could benefit from better caching`,
                    queries: cacheCandidates.slice(0, 3).map(q => q.query)
                });
            }

            // Check for frequently executed queries
            const frequentQueries = slowQueries.filter(sq => sq.count > 100);
            if (frequentQueries.length > 0) {
                report.recommendations.push({
                    type: 'batch_processing',
                    impact: 'high',
                    description: `${frequentQueries.length} queries are executed very frequently`,
                    suggestion: 'Consider batch processing or materialized views'
                });
            }
        }

        // Check connection pool usage
        const poolStats = await this.getPoolStats();
        if (poolStats.waitingCount > 0) {
            report.recommendations.push({
                type: 'connection_pool',
                impact: 'medium',
                description: 'Connection pool exhaustion detected',
                suggestion: `Increase pool size from ${poolStats.totalCount} to ${poolStats.totalCount * 1.5}`
            });
        }

        return report;
    }

    async getPoolStats() {
        return {
            totalCount: this.pgPool.totalCount,
            idleCount: this.pgPool.idleCount,
            waitingCount: this.pgPool.waitingCount
        };
    }

    // Optimized query methods
    async getContainersByStatus(status, limit = 100) {
        const cacheKey = `containers:status:${status}:${limit}`;
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }

        const query = `
            SELECT c.*, r.risk_level, r.risk_score
            FROM containers c
            LEFT JOIN risk_scores r ON c.id = r.container_id
            WHERE c.status = $1
            ORDER BY c.updated_at DESC
            LIMIT $2
        `;
        
        const result = await this.pgPool.query(query, [status, limit]);
        
        // Cache for 5 minutes
        await this.redis.setex(cacheKey, 300, JSON.stringify(result.rows));
        
        return result.rows;
    }

    async getContainerEvents(containerId, limit = 50) {
        const query = `
            SELECT * FROM events
            WHERE container_id = $1
            ORDER BY event_time DESC
            LIMIT $2
        `;
        
        return (await this.pgPool.query(query, [containerId, limit])).rows;
    }

    async getHighRiskContainers() {
        const cacheKey = 'containers:high-risk';
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }

        const query = `
            SELECT c.*, r.risk_level, r.risk_score, r.risk_factors
            FROM containers c
            INNER JOIN risk_scores r ON c.id = r.container_id
            WHERE r.risk_level IN ('HIGH', 'CRITICAL')
            AND c.status NOT IN ('DELIVERED', 'CANCELLED')
            ORDER BY r.risk_score DESC
            LIMIT 100
        `;
        
        const result = await this.pgPool.query(query);
        
        // Cache for 1 minute (critical data)
        await this.redis.setex(cacheKey, 60, JSON.stringify(result.rows));
        
        return result.rows;
    }

    // Batch operations for better performance
    async batchInsertEvents(events) {
        const values = [];
        const placeholders = [];
        let paramCount = 1;

        events.forEach((event, index) => {
            const params = [
                event.containerId,
                event.eventType,
                event.eventTime,
                event.location,
                event.description
            ];
            values.push(...params);
            
            const placeholder = `($${paramCount}, $${paramCount+1}, $${paramCount+2}, $${paramCount+3}, $${paramCount+4})`;
            placeholders.push(placeholder);
            paramCount += 5;
        });

        const query = `
            INSERT INTO events (container_id, event_type, event_time, location, description)
            VALUES ${placeholders.join(', ')}
            RETURNING id
        `;

        return await this.pgPool.query(query, values);
    }

    async cleanup() {
        await this.pgPool.end();
        await this.redis.quit();
    }
}

module.exports = DatabaseQueryOptimizer;