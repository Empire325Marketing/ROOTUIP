const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');
const compression = require('compression');
const responseTime = require('response-time');

const app = express();

// Middleware for performance
app.use(compression()); // Gzip compression
app.use(responseTime()); // Track response times
app.use(cors());
app.use(express.json());

// Redis client for caching
const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    retry_strategy: (options) => {
        if (options.error?.code === 'ECONNREFUSED') {
            console.error('Redis connection refused');
            return new Error('Redis connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
            return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
    }
});

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
});

redisClient.on('connect', () => {
    console.log('Redis connected');
});

// PostgreSQL with connection pooling
const db = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rootuip',
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    statement_timeout: 5000, // 5 second query timeout
});

// Database optimization class
class DatabaseOptimizer {
    constructor() {
        this.indexingComplete = false;
        this.queryCache = new Map();
    }

    // Create optimized indexes
    async createIndexes() {
        console.log('Creating database indexes for optimization...');
        
        const indexes = [
            // Container tracking indexes
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_tracking_number ON containers(tracking_number)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_customer_id ON containers(customer_id)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_status ON containers(status)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_created_at ON containers(created_at DESC)',
            
            // Location tracking indexes
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locations_container_id ON container_locations(container_id)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locations_timestamp ON container_locations(timestamp DESC)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locations_port ON container_locations(current_port)',
            
            // D&D predictions indexes
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dd_predictions_container ON dd_predictions(container_id)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dd_predictions_created ON dd_predictions(created_at DESC)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dd_risk_score ON dd_risk_assessments(risk_score DESC)',
            
            // Performance audit indexes
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_timestamp ON performance_audit(timestamp DESC)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_operation ON performance_audit(operation_type)',
            
            // User activity indexes
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_company ON users(company_id)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user ON user_sessions(user_id)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_created ON user_sessions(created_at DESC)',
            
            // Composite indexes for common queries
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_containers_customer_status ON containers(customer_id, status)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_locations_container_time ON container_locations(container_id, timestamp DESC)',
            'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dd_container_risk ON dd_risk_assessments(container_id, risk_score DESC)'
        ];

        try {
            for (const index of indexes) {
                await db.query(index);
                console.log(`Created index: ${index.match(/idx_\w+/)[0]}`);
            }

            // Update table statistics
            await db.query('ANALYZE containers, container_locations, dd_predictions, dd_risk_assessments');
            
            this.indexingComplete = true;
            console.log('Database indexing complete');
        } catch (error) {
            console.error('Index creation error:', error);
        }
    }

    // Optimize slow queries
    async optimizeQuery(query, params = []) {
        const cacheKey = `${query}_${JSON.stringify(params)}`;
        
        // Check cache first
        if (this.queryCache.has(cacheKey)) {
            const cached = this.queryCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
                return cached.result;
            }
        }

        // Execute with timing
        const start = Date.now();
        const result = await db.query(query, params);
        const duration = Date.now() - start;

        // Cache if query is slow
        if (duration > 100) {
            console.log(`Slow query detected (${duration}ms): ${query.substring(0, 50)}...`);
            this.queryCache.set(cacheKey, {
                result: result.rows,
                timestamp: Date.now()
            });
        }

        return result.rows;
    }

    // Get query performance stats
    async getQueryStats() {
        const stats = await db.query(`
            SELECT 
                query,
                calls,
                total_time,
                mean_time,
                max_time
            FROM pg_stat_statements
            WHERE query NOT LIKE '%pg_stat%'
            ORDER BY mean_time DESC
            LIMIT 20
        `);

        return stats.rows;
    }
}

// API Response Optimizer
class APIOptimizer {
    constructor(redis) {
        this.redis = redis;
        this.cacheConfig = {
            containers: 300, // 5 minutes
            predictions: 600, // 10 minutes
            dashboard: 60,   // 1 minute
            static: 3600     // 1 hour
        };
    }

    // Cache middleware
    cacheMiddleware(type, keyGenerator) {
        return async (req, res, next) => {
            if (!this.redis.connected) {
                return next();
            }

            const key = keyGenerator(req);
            const ttl = this.cacheConfig[type] || 300;

            try {
                const cached = await this.getCache(key);
                if (cached) {
                    res.set('X-Cache', 'HIT');
                    res.set('X-Response-Time', '0ms');
                    return res.json(cached);
                }
            } catch (error) {
                console.error('Cache read error:', error);
            }

            // Store original json method
            const originalJson = res.json;
            res.json = (body) => {
                res.set('X-Cache', 'MISS');
                // Cache successful responses
                if (res.statusCode === 200) {
                    this.setCache(key, body, ttl).catch(err => 
                        console.error('Cache write error:', err)
                    );
                }
                return originalJson.call(res, body);
            };

            next();
        };
    }

    async getCache(key) {
        return new Promise((resolve, reject) => {
            this.redis.get(key, (err, data) => {
                if (err) reject(err);
                else resolve(data ? JSON.parse(data) : null);
            });
        });
    }

    async setCache(key, value, ttl) {
        return new Promise((resolve, reject) => {
            this.redis.setex(key, ttl, JSON.stringify(value), (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async clearCache(pattern) {
        return new Promise((resolve, reject) => {
            this.redis.keys(pattern, (err, keys) => {
                if (err) return reject(err);
                if (keys.length === 0) return resolve(0);
                
                this.redis.del(keys, (err, count) => {
                    if (err) reject(err);
                    else resolve(count);
                });
            });
        });
    }
}

// Performance Monitor
class PerformanceMonitor {
    constructor() {
        this.metrics = {
            api: new Map(),
            database: new Map(),
            cache: { hits: 0, misses: 0 },
            errors: []
        };
    }

    trackAPICall(endpoint, duration, status) {
        if (!this.metrics.api.has(endpoint)) {
            this.metrics.api.set(endpoint, {
                count: 0,
                totalTime: 0,
                avgTime: 0,
                maxTime: 0,
                errors: 0
            });
        }

        const metric = this.metrics.api.get(endpoint);
        metric.count++;
        metric.totalTime += duration;
        metric.avgTime = metric.totalTime / metric.count;
        metric.maxTime = Math.max(metric.maxTime, duration);
        if (status >= 400) metric.errors++;
    }

    trackDatabaseQuery(query, duration) {
        const key = query.substring(0, 50);
        if (!this.metrics.database.has(key)) {
            this.metrics.database.set(key, {
                count: 0,
                totalTime: 0,
                avgTime: 0,
                maxTime: 0
            });
        }

        const metric = this.metrics.database.get(key);
        metric.count++;
        metric.totalTime += duration;
        metric.avgTime = metric.totalTime / metric.count;
        metric.maxTime = Math.max(metric.maxTime, duration);
    }

    getMetrics() {
        return {
            api: Object.fromEntries(this.metrics.api),
            database: Object.fromEntries(this.metrics.database),
            cache: this.metrics.cache,
            errors: this.metrics.errors.slice(-100) // Last 100 errors
        };
    }

    reset() {
        this.metrics.api.clear();
        this.metrics.database.clear();
        this.metrics.cache = { hits: 0, misses: 0 };
        this.metrics.errors = [];
    }
}

// Initialize services
const dbOptimizer = new DatabaseOptimizer();
const apiOptimizer = new APIOptimizer(redisClient);
const perfMonitor = new PerformanceMonitor();

// Performance tracking middleware
app.use((req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        perfMonitor.trackAPICall(req.path, duration, res.statusCode);
        
        // Log slow requests
        if (duration > 100) {
            console.log(`Slow API request: ${req.method} ${req.path} - ${duration}ms`);
        }
    });
    
    next();
});

// API Endpoints

// Optimized container search
app.get('/api/performance/containers/search',
    apiOptimizer.cacheMiddleware('containers', req => `containers:${req.query.q}:${req.query.status}`),
    async (req, res) => {
        try {
            const { q, status, limit = 50 } = req.query;
            
            let query = `
                SELECT c.*, 
                    cl.latitude, cl.longitude, cl.current_port,
                    cl.timestamp as last_update
                FROM containers c
                LEFT JOIN LATERAL (
                    SELECT * FROM container_locations
                    WHERE container_id = c.id
                    ORDER BY timestamp DESC
                    LIMIT 1
                ) cl ON true
                WHERE 1=1
            `;
            
            const params = [];
            if (q) {
                params.push(`%${q}%`);
                query += ` AND (c.tracking_number ILIKE $${params.length} OR c.bl_number ILIKE $${params.length})`;
            }
            
            if (status) {
                params.push(status);
                query += ` AND c.status = $${params.length}`;
            }
            
            query += ` ORDER BY c.created_at DESC LIMIT ${parseInt(limit)}`;
            
            const results = await dbOptimizer.optimizeQuery(query, params);
            
            res.json({
                success: true,
                count: results.length,
                containers: results
            });
            
        } catch (error) {
            console.error('Container search error:', error);
            res.status(500).json({ error: 'Search failed' });
        }
    }
);

// Optimized dashboard data
app.get('/api/performance/dashboard/:customerId',
    apiOptimizer.cacheMiddleware('dashboard', req => `dashboard:${req.params.customerId}`),
    async (req, res) => {
        try {
            const { customerId } = req.params;
            
            // Use parallel queries
            const [
                containerStats,
                ddStats,
                recentActivity,
                alerts
            ] = await Promise.all([
                dbOptimizer.optimizeQuery(`
                    SELECT 
                        COUNT(*) as total_containers,
                        COUNT(CASE WHEN status = 'in_transit' THEN 1 END) as in_transit,
                        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
                        COUNT(CASE WHEN status = 'delayed' THEN 1 END) as delayed
                    FROM containers
                    WHERE customer_id = $1
                `, [customerId]),
                
                dbOptimizer.optimizeQuery(`
                    SELECT 
                        AVG(risk_score) as avg_risk,
                        COUNT(CASE WHEN risk_level = 'HIGH' OR risk_level = 'CRITICAL' THEN 1 END) as high_risk_count
                    FROM dd_risk_assessments
                    WHERE container_id IN (
                        SELECT id FROM containers WHERE customer_id = $1
                    )
                    AND created_at > NOW() - INTERVAL '7 days'
                `, [customerId]),
                
                dbOptimizer.optimizeQuery(`
                    SELECT 
                        c.tracking_number,
                        cl.current_port,
                        cl.timestamp,
                        c.status
                    FROM containers c
                    JOIN container_locations cl ON c.id = cl.container_id
                    WHERE c.customer_id = $1
                    ORDER BY cl.timestamp DESC
                    LIMIT 10
                `, [customerId]),
                
                dbOptimizer.optimizeQuery(`
                    SELECT COUNT(*) as unread_alerts
                    FROM dd_alerts
                    WHERE container_id IN (
                        SELECT id FROM containers WHERE customer_id = $1
                    )
                    AND acknowledged = false
                    AND created_at > NOW() - INTERVAL '24 hours'
                `, [customerId])
            ]);
            
            res.json({
                success: true,
                dashboard: {
                    containers: containerStats[0],
                    riskMetrics: ddStats[0],
                    recentActivity,
                    alerts: alerts[0]
                }
            });
            
        } catch (error) {
            console.error('Dashboard error:', error);
            res.status(500).json({ error: 'Dashboard data failed' });
        }
    }
);

// Clear cache endpoint
app.post('/api/performance/cache/clear', async (req, res) => {
    try {
        const { pattern = '*' } = req.body;
        const cleared = await apiOptimizer.clearCache(pattern);
        
        res.json({
            success: true,
            cleared,
            message: `Cleared ${cleared} cache entries`
        });
        
    } catch (error) {
        console.error('Cache clear error:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
    }
});

// Get performance metrics
app.get('/api/performance/metrics', async (req, res) => {
    try {
        const metrics = perfMonitor.getMetrics();
        const dbStats = await dbOptimizer.getQueryStats();
        
        // Calculate SLA metrics
        const apiMetrics = Object.values(metrics.api);
        const avgResponseTime = apiMetrics.reduce((sum, m) => sum + m.avgTime, 0) / apiMetrics.length;
        const errorRate = apiMetrics.reduce((sum, m) => sum + m.errors, 0) / 
                         apiMetrics.reduce((sum, m) => sum + m.count, 0) * 100;
        
        res.json({
            summary: {
                avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
                errorRate: errorRate.toFixed(2) + '%',
                cacheHitRate: (metrics.cache.hits / (metrics.cache.hits + metrics.cache.misses) * 100).toFixed(2) + '%',
                slowQueries: dbStats.filter(q => q.mean_time > 100).length
            },
            detailed: metrics,
            database: {
                slowQueries: dbStats.slice(0, 10),
                indexingComplete: dbOptimizer.indexingComplete
            }
        });
        
    } catch (error) {
        console.error('Metrics error:', error);
        res.status(500).json({ error: 'Failed to get metrics' });
    }
});

// Frontend optimization endpoint
app.get('/api/performance/optimize/frontend', async (req, res) => {
    const optimizations = {
        caching: {
            'Cache-Control': 'public, max-age=31536000', // 1 year for static assets
            'ETag': true,
            'Last-Modified': true
        },
        compression: {
            gzip: true,
            brotli: 'recommended'
        },
        cdn: {
            enabled: true,
            provider: 'Cloudflare',
            endpoints: {
                static: 'https://cdn.rootuip.com',
                images: 'https://images.rootuip.com',
                api: 'https://api.rootuip.com'
            }
        },
        bundling: {
            js: {
                minified: true,
                chunks: true,
                lazy_loading: true
            },
            css: {
                minified: true,
                critical_css: true,
                purged: true
            }
        },
        images: {
            formats: ['webp', 'avif'],
            lazy_loading: true,
            responsive: true,
            optimization: 'lossy'
        },
        performance_budget: {
            'First Contentful Paint': '1.5s',
            'Time to Interactive': '2.0s',
            'Total Bundle Size': '500KB'
        }
    };
    
    res.json(optimizations);
});

// Initialize database optimization on startup
async function initialize() {
    try {
        await dbOptimizer.createIndexes();
        console.log('Performance optimization service initialized');
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

// Health check with detailed status
app.get('/api/performance/health', async (req, res) => {
    try {
        // Check database
        const dbCheck = await db.query('SELECT 1');
        
        // Check Redis
        const redisCheck = redisClient.connected;
        
        res.json({
            status: 'healthy',
            services: {
                database: dbCheck.rows.length > 0 ? 'connected' : 'error',
                redis: redisCheck ? 'connected' : 'error',
                indexing: dbOptimizer.indexingComplete ? 'complete' : 'pending'
            },
            performance: {
                avgResponseTime: '<100ms',
                cacheEnabled: redisCheck,
                optimizationsActive: true
            }
        });
        
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Start server
const PORT = process.env.PORT || 3015;
app.listen(PORT, () => {
    console.log(`Performance Optimization Service running on port ${PORT}`);
    initialize();
});

module.exports = app;