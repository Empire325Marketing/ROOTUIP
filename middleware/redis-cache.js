/**
 * ROOTUIP Enterprise Redis Caching Layer
 * Optimizes API response times to <100ms
 */

const redis = require('redis');
const { promisify } = require('util');
const crypto = require('crypto');

class EnterpriseCache {
    constructor(config = {}) {
        this.config = {
            host: config.host || 'localhost',
            port: config.port || 6379,
            password: config.password || null,
            db: config.db || 0,
            keyPrefix: config.keyPrefix || 'rootuip:',
            defaultTTL: config.defaultTTL || 300, // 5 minutes
            enableCompression: config.enableCompression || true,
            ...config
        };

        this.client = null;
        this.connected = false;
        this.stats = {
            hits: 0,
            misses: 0,
            errors: 0,
            avgHitTime: 0,
            avgMissTime: 0
        };
    }

    async connect() {
        try {
            this.client = redis.createClient({
                host: this.config.host,
                port: this.config.port,
                password: this.config.password,
                db: this.config.db,
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
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

            // Promisify Redis methods
            this.getAsync = promisify(this.client.get).bind(this.client);
            this.setAsync = promisify(this.client.set).bind(this.client);
            this.delAsync = promisify(this.client.del).bind(this.client);
            this.existsAsync = promisify(this.client.exists).bind(this.client);
            this.expireAsync = promisify(this.client.expire).bind(this.client);
            this.ttlAsync = promisify(this.client.ttl).bind(this.client);
            this.keysAsync = promisify(this.client.keys).bind(this.client);
            this.mgetAsync = promisify(this.client.mget).bind(this.client);
            this.msetAsync = promisify(this.client.mset).bind(this.client);
            this.incrAsync = promisify(this.client.incr).bind(this.client);
            this.hgetAsync = promisify(this.client.hget).bind(this.client);
            this.hsetAsync = promisify(this.client.hset).bind(this.client);
            this.hgetallAsync = promisify(this.client.hgetall).bind(this.client);

            this.client.on('error', (err) => {
                console.error('Redis error:', err);
                this.stats.errors++;
            });

            this.client.on('connect', () => {
                console.log('Redis connected successfully');
                this.connected = true;
            });

            this.client.on('ready', () => {
                console.log('Redis ready for commands');
            });

            return true;
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            return false;
        }
    }

    generateKey(namespace, identifier) {
        return `${this.config.keyPrefix}${namespace}:${identifier}`;
    }

    hashKey(data) {
        return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
    }

    async get(key, options = {}) {
        if (!this.connected) return null;

        const startTime = Date.now();
        try {
            const fullKey = this.generateKey(options.namespace || 'default', key);
            const cached = await this.getAsync(fullKey);
            
            if (cached) {
                const duration = Date.now() - startTime;
                this.stats.hits++;
                this.stats.avgHitTime = (this.stats.avgHitTime * (this.stats.hits - 1) + duration) / this.stats.hits;
                
                return this.config.enableCompression ? 
                    JSON.parse(cached) : cached;
            }

            this.stats.misses++;
            const duration = Date.now() - startTime;
            this.stats.avgMissTime = (this.stats.avgMissTime * (this.stats.misses - 1) + duration) / this.stats.misses;
            
            return null;
        } catch (error) {
            this.stats.errors++;
            console.error('Cache get error:', error);
            return null;
        }
    }

    async set(key, value, options = {}) {
        if (!this.connected) return false;

        try {
            const fullKey = this.generateKey(options.namespace || 'default', key);
            const ttl = options.ttl || this.config.defaultTTL;
            const data = this.config.enableCompression ? 
                JSON.stringify(value) : value;

            await this.setAsync(fullKey, data, 'EX', ttl);
            return true;
        } catch (error) {
            this.stats.errors++;
            console.error('Cache set error:', error);
            return false;
        }
    }

    async delete(key, options = {}) {
        if (!this.connected) return false;

        try {
            const fullKey = this.generateKey(options.namespace || 'default', key);
            await this.delAsync(fullKey);
            return true;
        } catch (error) {
            this.stats.errors++;
            console.error('Cache delete error:', error);
            return false;
        }
    }

    async invalidatePattern(pattern) {
        if (!this.connected) return 0;

        try {
            const keys = await this.keysAsync(`${this.config.keyPrefix}${pattern}`);
            if (keys.length > 0) {
                return await this.delAsync(keys);
            }
            return 0;
        } catch (error) {
            this.stats.errors++;
            console.error('Cache invalidate error:', error);
            return 0;
        }
    }

    // ML Prediction caching
    async getCachedPrediction(containerNumber, carrier, port) {
        const key = this.hashKey({ containerNumber, carrier, port });
        return await this.get(key, { namespace: 'predictions' });
    }

    async cachePrediction(containerNumber, carrier, port, prediction) {
        const key = this.hashKey({ containerNumber, carrier, port });
        return await this.set(key, prediction, { 
            namespace: 'predictions',
            ttl: 3600 // 1 hour for predictions
        });
    }

    // User session caching
    async getCachedSession(token) {
        return await this.get(token, { namespace: 'sessions' });
    }

    async cacheSession(token, sessionData, ttl = 3600) {
        return await this.set(token, sessionData, { 
            namespace: 'sessions',
            ttl 
        });
    }

    // API response caching
    async getCachedResponse(endpoint, params) {
        const key = this.hashKey({ endpoint, params });
        return await this.get(key, { namespace: 'api' });
    }

    async cacheResponse(endpoint, params, response, ttl = 300) {
        const key = this.hashKey({ endpoint, params });
        return await this.set(key, response, { 
            namespace: 'api',
            ttl 
        });
    }

    // Performance metrics caching
    async updateMetrics(metricName, value) {
        if (!this.connected) return false;

        try {
            const key = this.generateKey('metrics', metricName);
            await this.setAsync(key, value, 'EX', 60); // 1 minute TTL for metrics
            
            // Also update in sorted set for time series
            const tsKey = this.generateKey('metrics:ts', metricName);
            const timestamp = Date.now();
            await this.client.zadd(tsKey, timestamp, `${timestamp}:${value}`);
            
            // Keep only last hour of data
            const hourAgo = timestamp - (60 * 60 * 1000);
            await this.client.zremrangebyscore(tsKey, '-inf', hourAgo);
            
            return true;
        } catch (error) {
            console.error('Metrics update error:', error);
            return false;
        }
    }

    // Rate limiting implementation
    async checkRateLimit(identifier, limit = 100, window = 60) {
        if (!this.connected) return { allowed: true, remaining: limit };

        try {
            const key = this.generateKey('ratelimit', identifier);
            const current = await this.incrAsync(key);
            
            if (current === 1) {
                await this.expireAsync(key, window);
            }
            
            const ttl = await this.ttlAsync(key);
            const remaining = Math.max(0, limit - current);
            
            return {
                allowed: current <= limit,
                remaining,
                reset: Date.now() + (ttl * 1000)
            };
        } catch (error) {
            console.error('Rate limit error:', error);
            return { allowed: true, remaining: limit };
        }
    }

    // Cache warming for critical data
    async warmCache() {
        console.log('Warming cache with critical data...');
        
        // Add your cache warming logic here
        // Example: Pre-load common predictions, user data, etc.
        
        return true;
    }

    // Get cache statistics
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 ? 
            (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) : 0;

        return {
            connected: this.connected,
            hits: this.stats.hits,
            misses: this.stats.misses,
            errors: this.stats.errors,
            hitRate: `${hitRate}%`,
            avgHitTime: `${this.stats.avgHitTime.toFixed(2)}ms`,
            avgMissTime: `${this.stats.avgMissTime.toFixed(2)}ms`
        };
    }

    // Middleware for Express
    middleware(options = {}) {
        return async (req, res, next) => {
            // Skip caching for non-GET requests
            if (req.method !== 'GET' || options.skip?.(req)) {
                return next();
            }

            const cacheKey = this.hashKey({
                url: req.originalUrl,
                query: req.query,
                user: req.user?.id
            });

            try {
                // Check cache
                const cached = await this.get(cacheKey, { namespace: 'http' });
                if (cached) {
                    res.set('X-Cache', 'HIT');
                    res.set('X-Cache-TTL', await this.ttlAsync(this.generateKey('http', cacheKey)));
                    return res.json(cached);
                }

                // Cache miss - store original send
                const originalSend = res.json;
                res.json = (body) => {
                    res.json = originalSend;
                    
                    // Cache successful responses
                    if (res.statusCode === 200) {
                        this.set(cacheKey, body, { 
                            namespace: 'http',
                            ttl: options.ttl || 300
                        }).catch(err => console.error('Cache middleware error:', err));
                    }
                    
                    res.set('X-Cache', 'MISS');
                    return res.json(body);
                };

                next();
            } catch (error) {
                console.error('Cache middleware error:', error);
                next();
            }
        };
    }

    async disconnect() {
        if (this.client) {
            this.client.quit();
            this.connected = false;
        }
    }
}

// Singleton instance
let cacheInstance = null;

function getCache(config) {
    if (!cacheInstance) {
        cacheInstance = new EnterpriseCache(config);
    }
    return cacheInstance;
}

module.exports = {
    EnterpriseCache,
    getCache
};