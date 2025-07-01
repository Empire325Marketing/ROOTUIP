#!/usr/bin/env node

/**
 * ROOTUIP Zero-Downtime Deployment System
 * Blue-green deployment, rolling updates, and automated rollback
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const AWS = require('aws-sdk');
const k8s = require('@kubernetes/client-node');
const { EventEmitter } = require('events');
const Redis = require('ioredis');
const { Pool } = require('pg');

class ZeroDowntimeDeployment extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            environment: config.environment || 'production',
            deploymentStrategy: config.deploymentStrategy || 'blue-green',
            healthCheckInterval: config.healthCheckInterval || 5000,
            healthCheckTimeout: config.healthCheckTimeout || 30000,
            rollbackThreshold: config.rollbackThreshold || 0.95, // 95% success rate
            canaryPercentage: config.canaryPercentage || 10,
            ...config
        };
        
        // AWS services
        this.elb = new AWS.ELBv2();
        this.ecs = new AWS.ECS();
        this.rds = new AWS.RDS();
        this.cloudWatch = new AWS.CloudWatch();
        
        // Kubernetes client
        this.k8sApi = this.initializeK8s();
        
        // Database connections
        this.db = new Pool({
            connectionString: config.databaseUrl,
            max: 5
        });
        
        // Redis for feature flags
        this.redis = new Redis(config.redisUrl);
        
        // Deployment state
        this.deploymentState = {
            inProgress: false,
            currentVersion: null,
            targetVersion: null,
            startTime: null,
            metrics: {}
        };
        
        // Feature toggle manager
        this.featureToggleManager = new FeatureToggleManager(this.redis);
        
        // Database migration manager
        this.migrationManager = new DatabaseMigrationManager(this.db);
        
        // Health check manager
        this.healthCheckManager = new HealthCheckManager(this);
        
        // Rollback manager
        this.rollbackManager = new RollbackManager(this);
    }
    
    // Initialize Kubernetes client
    initializeK8s() {
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        return kc.makeApiClient(k8s.AppsV1Api);
    }
    
    // Deploy new version
    async deploy(version, options = {}) {
        if (this.deploymentState.inProgress) {
            throw new Error('Deployment already in progress');
        }
        
        try {
            this.deploymentState = {
                inProgress: true,
                currentVersion: await this.getCurrentVersion(),
                targetVersion: version,
                startTime: Date.now(),
                metrics: {}
            };
            
            console.log(`Starting deployment of version ${version}`);
            this.emit('deployment:start', { version });
            
            // Pre-deployment checks
            await this.preDeploymentChecks(version);
            
            // Run database migrations
            await this.runDatabaseMigrations(version);
            
            // Deploy based on strategy
            let result;
            switch (this.config.deploymentStrategy) {
                case 'blue-green':
                    result = await this.blueGreenDeploy(version, options);
                    break;
                    
                case 'rolling':
                    result = await this.rollingDeploy(version, options);
                    break;
                    
                case 'canary':
                    result = await this.canaryDeploy(version, options);
                    break;
                    
                default:
                    throw new Error(`Unknown deployment strategy: ${this.config.deploymentStrategy}`);
            }
            
            // Post-deployment validation
            await this.postDeploymentValidation(version);
            
            // Update deployment state
            this.deploymentState.inProgress = false;
            
            console.log(`Deployment of version ${version} completed successfully`);
            this.emit('deployment:complete', { version, result });
            
            return result;
            
        } catch (error) {
            console.error(`Deployment failed: ${error.message}`);
            this.emit('deployment:failed', { version, error });
            
            // Automatic rollback
            if (this.shouldAutoRollback(error)) {
                await this.rollbackManager.rollback();
            }
            
            this.deploymentState.inProgress = false;
            throw error;
        }
    }
    
    // Blue-Green deployment
    async blueGreenDeploy(version, options) {
        console.log('Starting Blue-Green deployment');
        
        // Step 1: Deploy to green environment
        const greenEnvironment = await this.deployToGreenEnvironment(version);
        
        // Step 2: Run health checks on green
        await this.healthCheckManager.waitForHealthy(greenEnvironment, {
            timeout: this.config.healthCheckTimeout,
            interval: this.config.healthCheckInterval
        });
        
        // Step 3: Run smoke tests
        await this.runSmokeTests(greenEnvironment);
        
        // Step 4: Switch traffic to green
        await this.switchTraffic('blue', 'green', {
            gradual: options.gradualSwitch || false,
            duration: options.switchDuration || 300000 // 5 minutes
        });
        
        // Step 5: Monitor metrics
        const metrics = await this.monitorDeployment(greenEnvironment, {
            duration: options.monitorDuration || 600000 // 10 minutes
        });
        
        // Step 6: Validate metrics
        if (!this.validateMetrics(metrics)) {
            throw new Error('Deployment metrics validation failed');
        }
        
        // Step 7: Decommission blue environment
        if (options.keepBlue !== true) {
            await this.decommissionEnvironment('blue');
        }
        
        return {
            strategy: 'blue-green',
            version,
            environment: 'green',
            metrics,
            duration: Date.now() - this.deploymentState.startTime
        };
    }
    
    // Rolling deployment
    async rollingDeploy(version, options) {
        console.log('Starting Rolling deployment');
        
        const deploymentName = options.deploymentName || 'rootuip-deployment';
        const namespace = options.namespace || 'default';
        
        // Get current deployment
        const deployment = await this.k8sApi.readNamespacedDeployment(
            deploymentName,
            namespace
        );
        
        // Update deployment with new version
        deployment.body.spec.template.spec.containers[0].image = `rootuip:${version}`;
        
        // Configure rolling update strategy
        deployment.body.spec.strategy = {
            type: 'RollingUpdate',
            rollingUpdate: {
                maxSurge: options.maxSurge || '25%',
                maxUnavailable: options.maxUnavailable || '25%'
            }
        };
        
        // Apply deployment
        await this.k8sApi.patchNamespacedDeployment(
            deploymentName,
            namespace,
            deployment.body,
            undefined,
            undefined,
            undefined,
            undefined,
            { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
        );
        
        // Monitor rollout
        await this.monitorRollout(deploymentName, namespace);
        
        return {
            strategy: 'rolling',
            version,
            deployment: deploymentName,
            namespace
        };
    }
    
    // Canary deployment
    async canaryDeploy(version, options) {
        console.log('Starting Canary deployment');
        
        // Step 1: Deploy canary version
        const canaryDeployment = await this.deployCanaryVersion(version, {
            percentage: this.config.canaryPercentage
        });
        
        // Step 2: Route percentage of traffic to canary
        await this.configureCanaryTraffic(canaryDeployment, this.config.canaryPercentage);
        
        // Step 3: Monitor canary metrics
        const canaryMetrics = await this.monitorCanary(canaryDeployment, {
            duration: options.canaryDuration || 1800000 // 30 minutes
        });
        
        // Step 4: Analyze canary results
        const canaryAnalysis = this.analyzeCanaryMetrics(canaryMetrics);
        
        if (!canaryAnalysis.passed) {
            // Rollback canary
            await this.rollbackCanary(canaryDeployment);
            throw new Error(`Canary deployment failed: ${canaryAnalysis.reason}`);
        }
        
        // Step 5: Progressive rollout
        await this.progressiveRollout(version, {
            stages: options.stages || [25, 50, 75, 100],
            stageDuration: options.stageDuration || 600000 // 10 minutes per stage
        });
        
        return {
            strategy: 'canary',
            version,
            canaryAnalysis,
            stages: options.stages || [25, 50, 75, 100]
        };
    }
    
    // Pre-deployment checks
    async preDeploymentChecks(version) {
        console.log('Running pre-deployment checks');
        
        const checks = [
            this.checkDiskSpace(),
            this.checkDatabaseConnectivity(),
            this.checkDependencies(version),
            this.checkConfiguration(version),
            this.validateSecrets(version)
        ];
        
        const results = await Promise.all(checks);
        
        const failed = results.filter(r => !r.passed);
        if (failed.length > 0) {
            throw new Error(`Pre-deployment checks failed: ${failed.map(f => f.reason).join(', ')}`);
        }
    }
    
    // Run database migrations
    async runDatabaseMigrations(version) {
        console.log('Running database migrations');
        
        try {
            // Start transaction
            await this.migrationManager.beginTransaction();
            
            // Get pending migrations
            const migrations = await this.migrationManager.getPendingMigrations(version);
            
            if (migrations.length === 0) {
                console.log('No pending migrations');
                return;
            }
            
            // Run migrations with zero-downtime strategy
            for (const migration of migrations) {
                await this.migrationManager.runMigration(migration, {
                    strategy: 'online', // Online DDL for zero downtime
                    timeout: 300000 // 5 minutes
                });
            }
            
            // Commit transaction
            await this.migrationManager.commitTransaction();
            
            console.log(`Successfully ran ${migrations.length} migrations`);
            
        } catch (error) {
            await this.migrationManager.rollbackTransaction();
            throw error;
        }
    }
    
    // Deploy to green environment
    async deployToGreenEnvironment(version) {
        // Create new ECS task definition
        const taskDefinition = await this.ecs.registerTaskDefinition({
            family: 'rootuip-green',
            containerDefinitions: [{
                name: 'rootuip',
                image: `rootuip:${version}`,
                memory: 2048,
                cpu: 1024,
                environment: this.getEnvironmentVariables('green'),
                healthCheck: {
                    command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
                    interval: 30,
                    timeout: 5,
                    retries: 3,
                    startPeriod: 60
                }
            }]
        }).promise();
        
        // Update ECS service
        const service = await this.ecs.updateService({
            cluster: 'rootuip-cluster',
            service: 'rootuip-green',
            taskDefinition: taskDefinition.taskDefinition.taskDefinitionArn,
            desiredCount: this.getDesiredCount('green')
        }).promise();
        
        return {
            taskDefinition: taskDefinition.taskDefinition,
            service: service.service
        };
    }
    
    // Switch traffic between environments
    async switchTraffic(from, to, options) {
        if (options.gradual) {
            // Gradual traffic switch
            const steps = 10;
            const stepDuration = options.duration / steps;
            
            for (let i = 1; i <= steps; i++) {
                const percentage = (i / steps) * 100;
                
                await this.updateTargetGroupWeights({
                    [from]: 100 - percentage,
                    [to]: percentage
                });
                
                await this.sleep(stepDuration);
                
                // Check metrics after each step
                const metrics = await this.getCurrentMetrics();
                if (!this.validateMetrics(metrics)) {
                    throw new Error(`Traffic switch failed at ${percentage}%`);
                }
            }
        } else {
            // Immediate switch
            await this.updateTargetGroupWeights({
                [from]: 0,
                [to]: 100
            });
        }
    }
    
    // Update ALB target group weights
    async updateTargetGroupWeights(weights) {
        const params = {
            ListenerArn: this.config.listenerArn,
            DefaultActions: [{
                Type: 'forward',
                ForwardConfig: {
                    TargetGroups: Object.entries(weights).map(([env, weight]) => ({
                        TargetGroupArn: this.getTargetGroupArn(env),
                        Weight: weight
                    }))
                }
            }]
        };
        
        await this.elb.modifyListener(params).promise();
    }
    
    // Monitor deployment
    async monitorDeployment(environment, options) {
        const startTime = Date.now();
        const metrics = {
            errorRate: [],
            responseTime: [],
            throughput: [],
            cpuUsage: [],
            memoryUsage: []
        };
        
        while (Date.now() - startTime < options.duration) {
            const currentMetrics = await this.collectMetrics(environment);
            
            metrics.errorRate.push(currentMetrics.errorRate);
            metrics.responseTime.push(currentMetrics.responseTime);
            metrics.throughput.push(currentMetrics.throughput);
            metrics.cpuUsage.push(currentMetrics.cpuUsage);
            metrics.memoryUsage.push(currentMetrics.memoryUsage);
            
            // Check for anomalies
            if (this.detectAnomalies(currentMetrics)) {
                this.emit('deployment:anomaly', currentMetrics);
            }
            
            await this.sleep(30000); // Check every 30 seconds
        }
        
        return this.aggregateMetrics(metrics);
    }
    
    // Validate metrics
    validateMetrics(metrics) {
        const thresholds = {
            errorRate: 0.01, // 1%
            responseTime: 1000, // 1 second
            cpuUsage: 80, // 80%
            memoryUsage: 80 // 80%
        };
        
        for (const [metric, threshold] of Object.entries(thresholds)) {
            if (metrics[metric] > threshold) {
                console.error(`Metric ${metric} exceeds threshold: ${metrics[metric]} > ${threshold}`);
                return false;
            }
        }
        
        return true;
    }
    
    // Progressive rollout
    async progressiveRollout(version, options) {
        for (const stage of options.stages) {
            console.log(`Rolling out to ${stage}% of traffic`);
            
            // Update traffic distribution
            await this.updateCanaryTraffic(version, stage);
            
            // Monitor stage
            const stageMetrics = await this.monitorStage(stage, options.stageDuration);
            
            // Validate stage
            if (!this.validateStageMetrics(stageMetrics, stage)) {
                throw new Error(`Progressive rollout failed at ${stage}%`);
            }
            
            // Bake time between stages
            if (stage < 100) {
                await this.sleep(60000); // 1 minute bake time
            }
        }
    }
    
    // Feature toggle management
    async updateFeatureToggles(version, toggles) {
        for (const [feature, config] of Object.entries(toggles)) {
            await this.featureToggleManager.setToggle(feature, {
                ...config,
                version,
                updatedAt: new Date().toISOString()
            });
        }
    }
    
    // Get current version
    async getCurrentVersion() {
        try {
            const service = await this.ecs.describeServices({
                cluster: 'rootuip-cluster',
                services: ['rootuip-blue']
            }).promise();
            
            if (service.services.length > 0) {
                const taskDefinition = service.services[0].taskDefinition;
                const td = await this.ecs.describeTaskDefinition({
                    taskDefinition
                }).promise();
                
                const image = td.taskDefinition.containerDefinitions[0].image;
                return image.split(':')[1] || 'latest';
            }
        } catch (error) {
            console.error('Failed to get current version:', error);
        }
        
        return 'unknown';
    }
    
    // Helper methods
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    getTargetGroupArn(environment) {
        return this.config.targetGroups[environment];
    }
    
    getDesiredCount(environment) {
        return this.config.desiredCounts?.[environment] || 3;
    }
    
    getEnvironmentVariables(environment) {
        return [
            { name: 'NODE_ENV', value: 'production' },
            { name: 'ENVIRONMENT', value: environment },
            { name: 'VERSION', value: this.deploymentState.targetVersion }
        ];
    }
    
    shouldAutoRollback(error) {
        // Determine if automatic rollback should be triggered
        return error.severity === 'critical' || 
               error.message.includes('health check failed') ||
               error.message.includes('metrics validation failed');
    }
    
    detectAnomalies(metrics) {
        // Simple anomaly detection
        return metrics.errorRate > 0.05 || // 5% error rate
               metrics.responseTime > 2000 || // 2 seconds
               metrics.cpuUsage > 90 || // 90% CPU
               metrics.memoryUsage > 90; // 90% memory
    }
    
    aggregateMetrics(metrics) {
        const aggregate = {};
        
        for (const [key, values] of Object.entries(metrics)) {
            aggregate[key] = {
                avg: values.reduce((a, b) => a + b, 0) / values.length,
                max: Math.max(...values),
                min: Math.min(...values),
                p95: this.percentile(values, 0.95),
                p99: this.percentile(values, 0.99)
            };
        }
        
        return aggregate;
    }
    
    percentile(values, p) {
        const sorted = values.sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[index];
    }
}

// Feature Toggle Manager
class FeatureToggleManager {
    constructor(redis) {
        this.redis = redis;
        this.prefix = 'feature:toggle:';
    }
    
    async setToggle(feature, config) {
        const key = `${this.prefix}${feature}`;
        await this.redis.set(key, JSON.stringify(config));
        await this.redis.publish('feature:toggle:update', JSON.stringify({ feature, config }));
    }
    
    async getToggle(feature) {
        const key = `${this.prefix}${feature}`;
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
    }
    
    async isEnabled(feature, context = {}) {
        const toggle = await this.getToggle(feature);
        
        if (!toggle) return false;
        if (!toggle.enabled) return false;
        
        // Check rollout percentage
        if (toggle.rolloutPercentage && toggle.rolloutPercentage < 100) {
            const hash = this.hashContext(context);
            return (hash % 100) < toggle.rolloutPercentage;
        }
        
        // Check targeting rules
        if (toggle.targetingRules) {
            return this.evaluateTargetingRules(toggle.targetingRules, context);
        }
        
        return true;
    }
    
    hashContext(context) {
        const str = JSON.stringify(context);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }
    
    evaluateTargetingRules(rules, context) {
        for (const rule of rules) {
            if (this.evaluateRule(rule, context)) {
                return true;
            }
        }
        return false;
    }
    
    evaluateRule(rule, context) {
        const value = context[rule.attribute];
        
        switch (rule.operator) {
            case 'equals':
                return value === rule.value;
            case 'contains':
                return value && value.includes(rule.value);
            case 'in':
                return rule.values.includes(value);
            default:
                return false;
        }
    }
}

// Database Migration Manager
class DatabaseMigrationManager {
    constructor(db) {
        this.db = db;
        this.client = null;
    }
    
    async beginTransaction() {
        this.client = await this.db.connect();
        await this.client.query('BEGIN');
    }
    
    async commitTransaction() {
        if (this.client) {
            await this.client.query('COMMIT');
            this.client.release();
            this.client = null;
        }
    }
    
    async rollbackTransaction() {
        if (this.client) {
            await this.client.query('ROLLBACK');
            this.client.release();
            this.client = null;
        }
    }
    
    async getPendingMigrations(version) {
        const result = await this.db.query(`
            SELECT * FROM schema_migrations
            WHERE version > $1 AND version <= $2
            AND status = 'pending'
            ORDER BY version
        `, [await this.getCurrentSchemaVersion(), version]);
        
        return result.rows;
    }
    
    async getCurrentSchemaVersion() {
        const result = await this.db.query(`
            SELECT MAX(version) as version
            FROM schema_migrations
            WHERE status = 'completed'
        `);
        
        return result.rows[0]?.version || '0';
    }
    
    async runMigration(migration, options) {
        console.log(`Running migration: ${migration.name}`);
        
        try {
            // For zero-downtime, use online DDL techniques
            if (options.strategy === 'online') {
                await this.runOnlineMigration(migration);
            } else {
                await this.runStandardMigration(migration);
            }
            
            // Mark migration as completed
            await this.db.query(`
                UPDATE schema_migrations
                SET status = 'completed', completed_at = NOW()
                WHERE version = $1
            `, [migration.version]);
            
        } catch (error) {
            console.error(`Migration failed: ${error.message}`);
            throw error;
        }
    }
    
    async runOnlineMigration(migration) {
        // Example: Adding a column with default value
        if (migration.type === 'add_column') {
            // Step 1: Add column without default
            await this.client.query(`
                ALTER TABLE ${migration.table}
                ADD COLUMN ${migration.column} ${migration.dataType}
            `);
            
            // Step 2: Backfill in batches
            await this.backfillColumn(migration);
            
            // Step 3: Add constraints
            if (migration.constraints) {
                await this.addConstraints(migration);
            }
        }
        
        // Example: Creating index concurrently
        if (migration.type === 'create_index') {
            await this.client.query(`
                CREATE INDEX CONCURRENTLY ${migration.indexName}
                ON ${migration.table} (${migration.columns.join(', ')})
            `);
        }
    }
    
    async backfillColumn(migration) {
        const batchSize = 1000;
        let offset = 0;
        
        while (true) {
            const result = await this.client.query(`
                UPDATE ${migration.table}
                SET ${migration.column} = ${migration.defaultValue}
                WHERE id IN (
                    SELECT id FROM ${migration.table}
                    WHERE ${migration.column} IS NULL
                    LIMIT ${batchSize}
                )
            `);
            
            if (result.rowCount === 0) break;
            
            // Small delay to prevent overwhelming the database
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}

// Health Check Manager
class HealthCheckManager {
    constructor(parent) {
        this.parent = parent;
    }
    
    async waitForHealthy(environment, options) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < options.timeout) {
            const health = await this.checkHealth(environment);
            
            if (health.healthy) {
                console.log('Environment is healthy');
                return health;
            }
            
            console.log(`Health check failed: ${health.reason}. Retrying...`);
            await this.parent.sleep(options.interval);
        }
        
        throw new Error('Health check timeout');
    }
    
    async checkHealth(environment) {
        try {
            // Check ECS tasks
            const tasks = await this.parent.ecs.listTasks({
                cluster: 'rootuip-cluster',
                serviceName: `rootuip-${environment}`
            }).promise();
            
            if (tasks.taskArns.length === 0) {
                return { healthy: false, reason: 'No running tasks' };
            }
            
            // Check task health
            const taskDetails = await this.parent.ecs.describeTasks({
                cluster: 'rootuip-cluster',
                tasks: tasks.taskArns
            }).promise();
            
            const unhealthyTasks = taskDetails.tasks.filter(t => 
                t.healthStatus !== 'HEALTHY' || t.lastStatus !== 'RUNNING'
            );
            
            if (unhealthyTasks.length > 0) {
                return { 
                    healthy: false, 
                    reason: `${unhealthyTasks.length} unhealthy tasks`
                };
            }
            
            // Check application endpoints
            const endpoints = await this.getEndpoints(environment);
            const endpointHealth = await this.checkEndpoints(endpoints);
            
            if (!endpointHealth.healthy) {
                return endpointHealth;
            }
            
            return { healthy: true };
            
        } catch (error) {
            return { healthy: false, reason: error.message };
        }
    }
    
    async checkEndpoints(endpoints) {
        const axios = require('axios');
        const checks = endpoints.map(endpoint => 
            axios.get(`${endpoint}/health`, { timeout: 5000 })
                .then(() => ({ endpoint, healthy: true }))
                .catch(error => ({ endpoint, healthy: false, error: error.message }))
        );
        
        const results = await Promise.all(checks);
        const unhealthy = results.filter(r => !r.healthy);
        
        if (unhealthy.length > 0) {
            return {
                healthy: false,
                reason: `Unhealthy endpoints: ${unhealthy.map(u => u.endpoint).join(', ')}`
            };
        }
        
        return { healthy: true };
    }
}

// Rollback Manager
class RollbackManager {
    constructor(parent) {
        this.parent = parent;
    }
    
    async rollback() {
        console.log('Initiating automatic rollback');
        
        const { currentVersion, targetVersion } = this.parent.deploymentState;
        
        try {
            // Switch traffic back to previous version
            await this.parent.switchTraffic('green', 'blue', {
                gradual: false // Immediate rollback
            });
            
            // Rollback database if needed
            await this.rollbackDatabase(currentVersion, targetVersion);
            
            // Update deployment state
            this.parent.deploymentState.inProgress = false;
            
            console.log(`Rolled back from ${targetVersion} to ${currentVersion}`);
            this.parent.emit('rollback:complete', { 
                from: targetVersion, 
                to: currentVersion 
            });
            
        } catch (error) {
            console.error('Rollback failed:', error);
            this.parent.emit('rollback:failed', { error });
            throw error;
        }
    }
    
    async rollbackDatabase(toVersion, fromVersion) {
        const migrations = await this.parent.migrationManager.getMigrationsBetween(
            toVersion, 
            fromVersion
        );
        
        // Run down migrations in reverse order
        for (const migration of migrations.reverse()) {
            if (migration.down) {
                await this.parent.migrationManager.runMigration({
                    ...migration,
                    sql: migration.down
                });
            }
        }
    }
}

module.exports = ZeroDowntimeDeployment;