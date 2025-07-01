#!/usr/bin/env node

/**
 * ROOTUIP Advanced Multi-Tenancy System
 * Provides complete data isolation and tenant management
 */

const { Pool } = require('pg');
const Redis = require('ioredis');
const AWS = require('aws-sdk');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class TenantIsolationSystem {
    constructor(config = {}) {
        this.config = {
            databaseUrl: config.databaseUrl || process.env.DATABASE_URL,
            redisUrl: config.redisUrl || process.env.REDIS_URL,
            isolationStrategy: config.isolationStrategy || 'schema', // 'schema', 'database', 'row'
            encryptionKey: config.encryptionKey || process.env.TENANT_ENCRYPTION_KEY,
            ...config
        };
        
        // Database connection pools per tenant
        this.tenantPools = new Map();
        
        // Redis clients per tenant
        this.tenantRedisClients = new Map();
        
        // Tenant metadata cache
        this.tenantCache = new Map();
        
        // AWS services
        this.s3 = new AWS.S3();
        this.dynamodb = new AWS.DynamoDB.DocumentClient();
        
        // Isolation strategies
        this.isolationStrategies = {
            schema: this.schemaIsolation.bind(this),
            database: this.databaseIsolation.bind(this),
            row: this.rowLevelIsolation.bind(this)
        };
        
        // Initialize master connection
        this.masterPool = new Pool({
            connectionString: this.config.databaseUrl,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000
        });
        
        this.masterRedis = new Redis(this.config.redisUrl);
    }
    
    // Create new tenant
    async createTenant(tenantData) {
        try {
            console.log(`Creating tenant: ${tenantData.name}`);
            
            const tenantId = tenantData.id || uuidv4();
            const timestamp = new Date().toISOString();
            
            // Create tenant record
            const tenant = {
                id: tenantId,
                name: tenantData.name,
                slug: this.generateSlug(tenantData.name),
                createdAt: timestamp,
                updatedAt: timestamp,
                status: 'active',
                
                // Organization details
                organization: {
                    name: tenantData.organizationName,
                    type: tenantData.organizationType || 'enterprise',
                    size: tenantData.organizationSize || 'medium',
                    industry: tenantData.industry || 'logistics',
                    country: tenantData.country,
                    timezone: tenantData.timezone || 'UTC'
                },
                
                // Subscription details
                subscription: {
                    plan: tenantData.plan || 'professional',
                    status: 'active',
                    startDate: timestamp,
                    trialEndsAt: this.calculateTrialEnd(tenantData.plan),
                    limits: this.getPlanLimits(tenantData.plan || 'professional')
                },
                
                // Security settings
                security: {
                    encryptionEnabled: true,
                    encryptionKey: this.generateTenantKey(tenantId),
                    dataRetentionDays: tenantData.dataRetentionDays || 365,
                    ipWhitelist: tenantData.ipWhitelist || [],
                    mfaRequired: tenantData.mfaRequired || false
                },
                
                // Resource allocation
                resources: {
                    storageQuotaGB: tenantData.storageQuota || 100,
                    monthlyApiCalls: tenantData.apiCallLimit || 1000000,
                    maxUsers: tenantData.maxUsers || 50,
                    maxConcurrentConnections: tenantData.maxConnections || 100
                },
                
                // Feature flags
                features: {
                    ...this.getDefaultFeatures(),
                    ...tenantData.features
                },
                
                // Integration settings
                integrations: {
                    sso: {
                        enabled: tenantData.ssoEnabled || false,
                        provider: tenantData.ssoProvider,
                        config: tenantData.ssoConfig
                    },
                    api: {
                        enabled: true,
                        webhooksEnabled: tenantData.webhooksEnabled !== false,
                        customDomain: tenantData.customApiDomain
                    }
                }
            };
            
            // Create tenant isolation
            await this.createTenantIsolation(tenant);
            
            // Initialize tenant database
            await this.initializeTenantDatabase(tenant);
            
            // Create tenant storage
            await this.createTenantStorage(tenant);
            
            // Setup tenant cache
            await this.setupTenantCache(tenant);
            
            // Create default admin user
            if (tenantData.adminUser) {
                await this.createTenantAdmin(tenant, tenantData.adminUser);
            }
            
            // Store tenant metadata
            await this.saveTenantMetadata(tenant);
            
            // Update cache
            this.tenantCache.set(tenantId, tenant);
            
            console.log(`Tenant created successfully: ${tenantId}`);
            return {
                success: true,
                tenantId,
                tenant
            };
            
        } catch (error) {
            console.error(`Error creating tenant: ${error.message}`);
            throw error;
        }
    }
    
    // Create tenant isolation based on strategy
    async createTenantIsolation(tenant) {
        const strategy = this.isolationStrategies[this.config.isolationStrategy];
        
        if (!strategy) {
            throw new Error(`Unknown isolation strategy: ${this.config.isolationStrategy}`);
        }
        
        return strategy(tenant);
    }
    
    // Schema-based isolation
    async schemaIsolation(tenant) {
        const schemaName = `tenant_${tenant.id.replace(/-/g, '_')}`;
        
        const client = await this.masterPool.connect();
        
        try {
            // Create schema
            await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
            
            // Set schema permissions
            await client.query(`
                GRANT ALL ON SCHEMA ${schemaName} TO ${schemaName}_user;
                ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} 
                GRANT ALL ON TABLES TO ${schemaName}_user;
            `);
            
            // Create tenant-specific database user
            const password = this.generateSecurePassword();
            await client.query(`
                CREATE USER ${schemaName}_user WITH PASSWORD '${password}';
                GRANT USAGE ON SCHEMA ${schemaName} TO ${schemaName}_user;
                GRANT CREATE ON SCHEMA ${schemaName} TO ${schemaName}_user;
            `);
            
            // Store connection info
            tenant.database = {
                strategy: 'schema',
                schema: schemaName,
                user: `${schemaName}_user`,
                password: this.encryptData(password, tenant.security.encryptionKey),
                connectionString: this.buildConnectionString({
                    ...this.parseConnectionString(this.config.databaseUrl),
                    user: `${schemaName}_user`,
                    password,
                    schema: schemaName
                })
            };
            
        } finally {
            client.release();
        }
    }
    
    // Database-based isolation
    async databaseIsolation(tenant) {
        const dbName = `rootuip_${tenant.id.replace(/-/g, '_')}`;
        
        const client = await this.masterPool.connect();
        
        try {
            // Create database
            await client.query(`CREATE DATABASE ${dbName}`);
            
            // Create database user
            const password = this.generateSecurePassword();
            await client.query(`
                CREATE USER ${dbName}_user WITH PASSWORD '${password}';
                GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbName}_user;
            `);
            
            // Store connection info
            tenant.database = {
                strategy: 'database',
                database: dbName,
                user: `${dbName}_user`,
                password: this.encryptData(password, tenant.security.encryptionKey),
                connectionString: this.buildConnectionString({
                    ...this.parseConnectionString(this.config.databaseUrl),
                    database: dbName,
                    user: `${dbName}_user`,
                    password
                })
            };
            
        } finally {
            client.release();
        }
    }
    
    // Row-level isolation
    async rowLevelIsolation(tenant) {
        // For row-level isolation, we use the same database but filter by tenant_id
        tenant.database = {
            strategy: 'row',
            tenantIdColumn: 'tenant_id',
            connectionString: this.config.databaseUrl
        };
        
        // Enable row-level security
        const client = await this.masterPool.connect();
        
        try {
            // Create row-level security policies
            const tables = ['shipments', 'users', 'containers', 'routes', 'documents'];
            
            for (const table of tables) {
                await client.query(`
                    ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
                    
                    CREATE POLICY ${table}_tenant_isolation ON ${table}
                    FOR ALL
                    USING (tenant_id = current_setting('app.current_tenant')::uuid);
                `);
            }
            
        } finally {
            client.release();
        }
    }
    
    // Initialize tenant database
    async initializeTenantDatabase(tenant) {
        const pool = await this.getTenantPool(tenant.id);
        const client = await pool.connect();
        
        try {
            // Set search path for schema-based isolation
            if (tenant.database.strategy === 'schema') {
                await client.query(`SET search_path TO ${tenant.database.schema}, public`);
            }
            
            // Create base tables
            await this.createTenantTables(client, tenant);
            
            // Create indexes
            await this.createTenantIndexes(client, tenant);
            
            // Create views
            await this.createTenantViews(client, tenant);
            
            // Initialize data
            await this.initializeTenantData(client, tenant);
            
        } finally {
            client.release();
        }
    }
    
    // Create tenant tables
    async createTenantTables(client, tenant) {
        const tenantIdColumn = tenant.database.strategy === 'row' ? 'tenant_id UUID NOT NULL,' : '';
        
        // Users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ${tenantIdColumn}
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                first_name VARCHAR(100),
                last_name VARCHAR(100),
                role VARCHAR(50) NOT NULL DEFAULT 'user',
                status VARCHAR(20) NOT NULL DEFAULT 'active',
                mfa_enabled BOOLEAN DEFAULT false,
                mfa_secret VARCHAR(255),
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Shipments table
        await client.query(`
            CREATE TABLE IF NOT EXISTS shipments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ${tenantIdColumn}
                shipment_number VARCHAR(50) UNIQUE NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                origin JSONB NOT NULL,
                destination JSONB NOT NULL,
                carrier_id UUID,
                customer_id UUID,
                estimated_delivery DATE,
                actual_delivery TIMESTAMP,
                tracking_number VARCHAR(100),
                metadata JSONB DEFAULT '{}',
                created_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Containers table
        await client.query(`
            CREATE TABLE IF NOT EXISTS containers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ${tenantIdColumn}
                container_number VARCHAR(20) UNIQUE NOT NULL,
                type VARCHAR(20) NOT NULL,
                size INTEGER NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'available',
                current_location JSONB,
                shipment_id UUID REFERENCES shipments(id),
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Routes table
        await client.query(`
            CREATE TABLE IF NOT EXISTS routes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ${tenantIdColumn}
                name VARCHAR(255) NOT NULL,
                origin_port VARCHAR(10) NOT NULL,
                destination_port VARCHAR(10) NOT NULL,
                transit_time_days INTEGER,
                distance_km DECIMAL(10,2),
                carrier_id UUID,
                schedule JSONB,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Documents table
        await client.query(`
            CREATE TABLE IF NOT EXISTS documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ${tenantIdColumn}
                type VARCHAR(50) NOT NULL,
                name VARCHAR(255) NOT NULL,
                shipment_id UUID REFERENCES shipments(id),
                file_path VARCHAR(500),
                file_size INTEGER,
                mime_type VARCHAR(100),
                metadata JSONB DEFAULT '{}',
                uploaded_by UUID REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Audit log table
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ${tenantIdColumn}
                user_id UUID REFERENCES users(id),
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(50),
                entity_id UUID,
                changes JSONB,
                ip_address INET,
                user_agent TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Analytics events table
        await client.query(`
            CREATE TABLE IF NOT EXISTS analytics_events (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                ${tenantIdColumn}
                event_type VARCHAR(100) NOT NULL,
                event_data JSONB NOT NULL,
                user_id UUID REFERENCES users(id),
                session_id VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }
    
    // Create tenant indexes
    async createTenantIndexes(client, tenant) {
        const indexes = [
            'CREATE INDEX idx_shipments_status ON shipments(status)',
            'CREATE INDEX idx_shipments_created_at ON shipments(created_at DESC)',
            'CREATE INDEX idx_containers_status ON containers(status)',
            'CREATE INDEX idx_containers_shipment ON containers(shipment_id)',
            'CREATE INDEX idx_routes_ports ON routes(origin_port, destination_port)',
            'CREATE INDEX idx_documents_shipment ON documents(shipment_id)',
            'CREATE INDEX idx_audit_logs_user ON audit_logs(user_id)',
            'CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id)',
            'CREATE INDEX idx_analytics_events_type ON analytics_events(event_type)',
            'CREATE INDEX idx_analytics_events_created ON analytics_events(created_at DESC)'
        ];
        
        // Add tenant_id indexes for row-level isolation
        if (tenant.database.strategy === 'row') {
            indexes.push(
                'CREATE INDEX idx_users_tenant ON users(tenant_id)',
                'CREATE INDEX idx_shipments_tenant ON shipments(tenant_id)',
                'CREATE INDEX idx_containers_tenant ON containers(tenant_id)',
                'CREATE INDEX idx_routes_tenant ON routes(tenant_id)',
                'CREATE INDEX idx_documents_tenant ON documents(tenant_id)',
                'CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id)',
                'CREATE INDEX idx_analytics_events_tenant ON analytics_events(tenant_id)'
            );
        }
        
        for (const index of indexes) {
            await client.query(index);
        }
    }
    
    // Create tenant views
    async createTenantViews(client, tenant) {
        // Active shipments view
        await client.query(`
            CREATE OR REPLACE VIEW active_shipments AS
            SELECT 
                s.*,
                COUNT(c.id) as container_count,
                COUNT(d.id) as document_count
            FROM shipments s
            LEFT JOIN containers c ON c.shipment_id = s.id
            LEFT JOIN documents d ON d.shipment_id = s.id
            WHERE s.status NOT IN ('delivered', 'cancelled')
            GROUP BY s.id
        `);
        
        // Shipment analytics view
        await client.query(`
            CREATE OR REPLACE VIEW shipment_analytics AS
            SELECT 
                DATE_TRUNC('day', created_at) as date,
                COUNT(*) as total_shipments,
                COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
                COUNT(CASE WHEN status = 'in_transit' THEN 1 END) as in_transit,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                AVG(EXTRACT(EPOCH FROM (actual_delivery - created_at))/86400)::DECIMAL(10,2) as avg_delivery_days
            FROM shipments
            GROUP BY DATE_TRUNC('day', created_at)
        `);
        
        // User activity view
        await client.query(`
            CREATE OR REPLACE VIEW user_activity AS
            SELECT 
                u.id,
                u.email,
                u.first_name,
                u.last_name,
                u.last_login,
                COUNT(DISTINCT s.id) as shipments_created,
                COUNT(DISTINCT al.id) as total_actions,
                MAX(al.created_at) as last_action
            FROM users u
            LEFT JOIN shipments s ON s.created_by = u.id
            LEFT JOIN audit_logs al ON al.user_id = u.id
            GROUP BY u.id
        `);
    }
    
    // Initialize tenant data
    async initializeTenantData(client, tenant) {
        // Insert default data based on tenant type
        if (tenant.organization.type === 'enterprise') {
            // Create default roles and permissions
            await client.query(`
                INSERT INTO roles (name, permissions, description) VALUES
                ('admin', '["*"]', 'Full system access'),
                ('manager', '["shipments.*", "containers.*", "routes.read", "documents.*"]', 'Shipment management access'),
                ('operator', '["shipments.read", "shipments.update", "containers.read", "documents.read"]', 'Basic operational access'),
                ('viewer', '["*.read"]', 'Read-only access')
                ON CONFLICT DO NOTHING
            `);
        }
        
        // Create default settings
        await client.query(`
            INSERT INTO settings (key, value, category) VALUES
            ('timezone', $1, 'system'),
            ('currency', $2, 'billing'),
            ('date_format', 'YYYY-MM-DD', 'display'),
            ('notifications_enabled', 'true', 'notifications')
            ON CONFLICT DO NOTHING
        `, [tenant.organization.timezone, tenant.organization.country === 'US' ? 'USD' : 'EUR']);
    }
    
    // Create tenant storage
    async createTenantStorage(tenant) {
        // S3 bucket structure
        const bucketPrefix = `rootuip-tenant-${tenant.id}`;
        
        // Create S3 folders
        const folders = [
            'documents',
            'images',
            'reports',
            'exports',
            'backups'
        ];
        
        for (const folder of folders) {
            await this.s3.putObject({
                Bucket: this.config.s3Bucket,
                Key: `tenants/${tenant.id}/${folder}/.keep`,
                Body: ''
            }).promise();
        }
        
        // Set bucket lifecycle policies
        await this.setStorageLifecycle(tenant);
        
        // Store storage configuration
        tenant.storage = {
            provider: 's3',
            bucket: this.config.s3Bucket,
            prefix: `tenants/${tenant.id}`,
            quotaGB: tenant.resources.storageQuotaGB,
            usedGB: 0
        };
    }
    
    // Setup tenant cache
    async setupTenantCache(tenant) {
        // Create Redis namespace for tenant
        const redisClient = new Redis({
            ...this.parseRedisUrl(this.config.redisUrl),
            keyPrefix: `tenant:${tenant.id}:`
        });
        
        // Store Redis client
        this.tenantRedisClients.set(tenant.id, redisClient);
        
        // Initialize cache structures
        await redisClient.hset('config', {
            tenantId: tenant.id,
            name: tenant.name,
            plan: tenant.subscription.plan,
            features: JSON.stringify(tenant.features)
        });
        
        // Set up cache expiration policies
        await this.setCacheExpiration(tenant, redisClient);
    }
    
    // Get tenant context
    async getTenantContext(tenantId, userId = null) {
        try {
            // Get tenant from cache or load
            let tenant = this.tenantCache.get(tenantId);
            
            if (!tenant) {
                tenant = await this.loadTenant(tenantId);
                this.tenantCache.set(tenantId, tenant);
            }
            
            // Check tenant status
            if (tenant.status !== 'active') {
                throw new Error(`Tenant ${tenantId} is not active`);
            }
            
            // Get database connection
            const dbPool = await this.getTenantPool(tenantId);
            
            // Get Redis client
            const redisClient = await this.getTenantRedis(tenantId);
            
            // Build context
            const context = {
                tenant,
                tenantId,
                userId,
                db: dbPool,
                redis: redisClient,
                storage: this.getTenantStorage(tenant),
                
                // Helper methods
                encrypt: (data) => this.encryptData(data, tenant.security.encryptionKey),
                decrypt: (data) => this.decryptData(data, tenant.security.encryptionKey),
                audit: (action, data) => this.auditLog(tenant, userId, action, data),
                checkLimit: (resource) => this.checkResourceLimit(tenant, resource),
                
                // Feature flags
                hasFeature: (feature) => tenant.features[feature] === true,
                
                // Security
                validateIP: (ip) => this.validateTenantIP(tenant, ip),
                requireMFA: () => tenant.security.mfaRequired
            };
            
            return context;
            
        } catch (error) {
            console.error(`Error getting tenant context: ${error.message}`);
            throw error;
        }
    }
    
    // Get tenant database pool
    async getTenantPool(tenantId) {
        if (this.tenantPools.has(tenantId)) {
            return this.tenantPools.get(tenantId);
        }
        
        const tenant = await this.loadTenant(tenantId);
        const connectionString = this.decryptData(
            tenant.database.password,
            tenant.security.encryptionKey
        );
        
        const pool = new Pool({
            connectionString: tenant.database.connectionString.replace(
                /password=[^&]+/,
                `password=${connectionString}`
            ),
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000
        });
        
        // Set default schema for schema-based isolation
        if (tenant.database.strategy === 'schema') {
            pool.on('connect', (client) => {
                client.query(`SET search_path TO ${tenant.database.schema}, public`);
            });
        }
        
        // Set tenant context for row-level isolation
        if (tenant.database.strategy === 'row') {
            pool.on('connect', (client) => {
                client.query(`SET app.current_tenant = '${tenantId}'`);
            });
        }
        
        this.tenantPools.set(tenantId, pool);
        return pool;
    }
    
    // Get tenant Redis client
    async getTenantRedis(tenantId) {
        if (this.tenantRedisClients.has(tenantId)) {
            return this.tenantRedisClients.get(tenantId);
        }
        
        const redisClient = new Redis({
            ...this.parseRedisUrl(this.config.redisUrl),
            keyPrefix: `tenant:${tenantId}:`
        });
        
        this.tenantRedisClients.set(tenantId, redisClient);
        return redisClient;
    }
    
    // Get tenant storage interface
    getTenantStorage(tenant) {
        return {
            upload: async (key, data, options = {}) => {
                const fullKey = `${tenant.storage.prefix}/${key}`;
                
                await this.s3.putObject({
                    Bucket: tenant.storage.bucket,
                    Key: fullKey,
                    Body: data,
                    ...options
                }).promise();
                
                return fullKey;
            },
            
            download: async (key) => {
                const fullKey = `${tenant.storage.prefix}/${key}`;
                
                const result = await this.s3.getObject({
                    Bucket: tenant.storage.bucket,
                    Key: fullKey
                }).promise();
                
                return result.Body;
            },
            
            delete: async (key) => {
                const fullKey = `${tenant.storage.prefix}/${key}`;
                
                await this.s3.deleteObject({
                    Bucket: tenant.storage.bucket,
                    Key: fullKey
                }).promise();
            },
            
            list: async (prefix = '') => {
                const fullPrefix = `${tenant.storage.prefix}/${prefix}`;
                
                const result = await this.s3.listObjectsV2({
                    Bucket: tenant.storage.bucket,
                    Prefix: fullPrefix
                }).promise();
                
                return result.Contents.map(obj => ({
                    key: obj.Key.replace(`${tenant.storage.prefix}/`, ''),
                    size: obj.Size,
                    lastModified: obj.LastModified
                }));
            },
            
            getSignedUrl: async (key, expiresIn = 3600) => {
                const fullKey = `${tenant.storage.prefix}/${key}`;
                
                return this.s3.getSignedUrlPromise('getObject', {
                    Bucket: tenant.storage.bucket,
                    Key: fullKey,
                    Expires: expiresIn
                });
            }
        };
    }
    
    // Check resource limits
    async checkResourceLimit(tenant, resource) {
        const limits = tenant.resources;
        const usage = await this.getTenantUsage(tenant.id);
        
        switch (resource) {
            case 'storage':
                return usage.storageGB < limits.storageQuotaGB;
                
            case 'api_calls':
                return usage.monthlyApiCalls < limits.monthlyApiCalls;
                
            case 'users':
                return usage.activeUsers < limits.maxUsers;
                
            case 'connections':
                return usage.currentConnections < limits.maxConcurrentConnections;
                
            default:
                return true;
        }
    }
    
    // Get tenant usage
    async getTenantUsage(tenantId) {
        const context = await this.getTenantContext(tenantId);
        
        // Get storage usage
        const storageResult = await this.s3.listObjectsV2({
            Bucket: context.tenant.storage.bucket,
            Prefix: context.tenant.storage.prefix
        }).promise();
        
        const storageBytes = storageResult.Contents.reduce((sum, obj) => sum + obj.Size, 0);
        const storageGB = storageBytes / (1024 * 1024 * 1024);
        
        // Get API call usage
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const apiCalls = await context.redis.get('usage:api_calls:month') || 0;
        
        // Get user count
        const userResult = await context.db.query('SELECT COUNT(*) FROM users WHERE status = $1', ['active']);
        const activeUsers = parseInt(userResult.rows[0].count);
        
        // Get connection count
        const currentConnections = await context.redis.get('usage:connections:current') || 0;
        
        return {
            storageGB,
            monthlyApiCalls: parseInt(apiCalls),
            activeUsers,
            currentConnections: parseInt(currentConnections)
        };
    }
    
    // Update tenant
    async updateTenant(tenantId, updates) {
        try {
            const tenant = await this.loadTenant(tenantId);
            
            // Merge updates
            const updatedTenant = {
                ...tenant,
                ...updates,
                updatedAt: new Date().toISOString()
            };
            
            // Update features if provided
            if (updates.features) {
                updatedTenant.features = {
                    ...tenant.features,
                    ...updates.features
                };
            }
            
            // Update resources if provided
            if (updates.resources) {
                updatedTenant.resources = {
                    ...tenant.resources,
                    ...updates.resources
                };
            }
            
            // Save updated tenant
            await this.saveTenantMetadata(updatedTenant);
            
            // Update cache
            this.tenantCache.set(tenantId, updatedTenant);
            
            // Update Redis config
            const redis = await this.getTenantRedis(tenantId);
            await redis.hset('config', {
                features: JSON.stringify(updatedTenant.features),
                resources: JSON.stringify(updatedTenant.resources)
            });
            
            return {
                success: true,
                tenant: updatedTenant
            };
            
        } catch (error) {
            console.error(`Error updating tenant: ${error.message}`);
            throw error;
        }
    }
    
    // Delete tenant
    async deleteTenant(tenantId, options = {}) {
        try {
            console.log(`Deleting tenant: ${tenantId}`);
            
            const tenant = await this.loadTenant(tenantId);
            
            // Soft delete by default
            if (!options.hardDelete) {
                tenant.status = 'deleted';
                tenant.deletedAt = new Date().toISOString();
                await this.saveTenantMetadata(tenant);
                
                return { success: true, message: 'Tenant soft deleted' };
            }
            
            // Hard delete - remove all data
            
            // Close connections
            if (this.tenantPools.has(tenantId)) {
                await this.tenantPools.get(tenantId).end();
                this.tenantPools.delete(tenantId);
            }
            
            if (this.tenantRedisClients.has(tenantId)) {
                this.tenantRedisClients.get(tenantId).disconnect();
                this.tenantRedisClients.delete(tenantId);
            }
            
            // Delete database/schema
            if (tenant.database.strategy === 'schema') {
                const client = await this.masterPool.connect();
                try {
                    await client.query(`DROP SCHEMA IF EXISTS ${tenant.database.schema} CASCADE`);
                    await client.query(`DROP USER IF EXISTS ${tenant.database.user}`);
                } finally {
                    client.release();
                }
            } else if (tenant.database.strategy === 'database') {
                const client = await this.masterPool.connect();
                try {
                    await client.query(`DROP DATABASE IF EXISTS ${tenant.database.database}`);
                    await client.query(`DROP USER IF EXISTS ${tenant.database.user}`);
                } finally {
                    client.release();
                }
            }
            
            // Delete S3 data
            const objects = await this.s3.listObjectsV2({
                Bucket: tenant.storage.bucket,
                Prefix: tenant.storage.prefix
            }).promise();
            
            if (objects.Contents.length > 0) {
                await this.s3.deleteObjects({
                    Bucket: tenant.storage.bucket,
                    Delete: {
                        Objects: objects.Contents.map(obj => ({ Key: obj.Key }))
                    }
                }).promise();
            }
            
            // Delete Redis data
            const redis = await this.getTenantRedis(tenantId);
            const keys = await redis.keys('*');
            if (keys.length > 0) {
                await redis.del(...keys);
            }
            
            // Remove from cache
            this.tenantCache.delete(tenantId);
            
            console.log(`Tenant deleted successfully: ${tenantId}`);
            return { success: true, message: 'Tenant permanently deleted' };
            
        } catch (error) {
            console.error(`Error deleting tenant: ${error.message}`);
            throw error;
        }
    }
    
    // Utility functions
    generateSlug(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }
    
    generateTenantKey(tenantId) {
        return crypto.createHash('sha256')
            .update(`${tenantId}-${this.config.encryptionKey}`)
            .digest('hex');
    }
    
    generateSecurePassword() {
        return crypto.randomBytes(32).toString('base64');
    }
    
    encryptData(data, key) {
        const cipher = crypto.createCipher('aes-256-cbc', key);
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }
    
    decryptData(data, key) {
        const decipher = crypto.createDecipher('aes-256-cbc', key);
        let decrypted = decipher.update(data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    
    parseConnectionString(connectionString) {
        const url = new URL(connectionString);
        return {
            host: url.hostname,
            port: url.port || 5432,
            database: url.pathname.slice(1),
            user: url.username,
            password: url.password
        };
    }
    
    buildConnectionString(params) {
        return `postgresql://${params.user}:${params.password}@${params.host}:${params.port}/${params.database}`;
    }
    
    parseRedisUrl(redisUrl) {
        const url = new URL(redisUrl);
        return {
            host: url.hostname,
            port: url.port || 6379,
            password: url.password || undefined
        };
    }
    
    calculateTrialEnd(plan) {
        const trialDays = {
            starter: 14,
            professional: 30,
            enterprise: 60
        };
        
        const days = trialDays[plan] || 30;
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + days);
        
        return trialEnd.toISOString();
    }
    
    getPlanLimits(plan) {
        const limits = {
            starter: {
                shipments: 1000,
                users: 10,
                apiCalls: 100000,
                storage: 10
            },
            professional: {
                shipments: 10000,
                users: 50,
                apiCalls: 1000000,
                storage: 100
            },
            enterprise: {
                shipments: -1, // Unlimited
                users: -1,
                apiCalls: -1,
                storage: 1000
            }
        };
        
        return limits[plan] || limits.professional;
    }
    
    getDefaultFeatures() {
        return {
            // Core features
            shipmentTracking: true,
            containerManagement: true,
            documentManagement: true,
            basicReporting: true,
            
            // Advanced features
            advancedAnalytics: false,
            customIntegrations: false,
            apiAccess: true,
            webhooks: false,
            whiteLabel: false,
            
            // Security features
            sso: false,
            mfa: true,
            auditLog: true,
            dataEncryption: true,
            
            // Collaboration
            multiUser: true,
            roleBasedAccess: true,
            teamCollaboration: false,
            
            // Automation
            workflowAutomation: false,
            emailAutomation: true,
            alerting: true
        };
    }
    
    async saveTenantMetadata(tenant) {
        await this.dynamodb.put({
            TableName: 'rootuip-tenants',
            Item: tenant
        }).promise();
    }
    
    async loadTenant(tenantId) {
        const result = await this.dynamodb.get({
            TableName: 'rootuip-tenants',
            Key: { id: tenantId }
        }).promise();
        
        if (!result.Item) {
            throw new Error(`Tenant ${tenantId} not found`);
        }
        
        return result.Item;
    }
    
    async createTenantAdmin(tenant, adminUser) {
        const context = await this.getTenantContext(tenant.id);
        
        const hashedPassword = crypto.createHash('sha256')
            .update(adminUser.password)
            .digest('hex');
        
        await context.db.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, status)
            VALUES ($1, $2, $3, $4, 'admin', 'active')
        `, [
            adminUser.email,
            hashedPassword,
            adminUser.firstName,
            adminUser.lastName
        ]);
    }
    
    async auditLog(tenant, userId, action, data) {
        const context = await this.getTenantContext(tenant.id);
        
        await context.db.query(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            userId,
            action,
            data.entityType,
            data.entityId,
            JSON.stringify(data.changes),
            data.ipAddress,
            data.userAgent
        ]);
    }
    
    validateTenantIP(tenant, ip) {
        if (!tenant.security.ipWhitelist || tenant.security.ipWhitelist.length === 0) {
            return true;
        }
        
        return tenant.security.ipWhitelist.includes(ip);
    }
    
    async setStorageLifecycle(tenant) {
        // Set lifecycle rules based on data retention policy
        const rules = [
            {
                ID: `tenant-${tenant.id}-archive`,
                Status: 'Enabled',
                Transitions: [
                    {
                        Days: 90,
                        StorageClass: 'STANDARD_IA'
                    },
                    {
                        Days: 180,
                        StorageClass: 'GLACIER'
                    }
                ],
                NoncurrentVersionExpiration: {
                    NoncurrentDays: tenant.security.dataRetentionDays
                }
            }
        ];
        
        // Apply lifecycle configuration
        // (Implementation depends on S3 bucket configuration)
    }
    
    async setCacheExpiration(tenant, redisClient) {
        // Set default TTLs for different cache types
        const ttls = {
            session: 3600, // 1 hour
            query: 300, // 5 minutes
            report: 900, // 15 minutes
            static: 86400 // 24 hours
        };
        
        await redisClient.hset('cache:config', ttls);
    }
}

module.exports = TenantIsolationSystem;