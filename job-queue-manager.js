/**
 * ROOTUIP Distributed Job Queue Manager
 * Redis-based job queue with priority handling and robust retry logic
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const Bull = require('bull');
const Redis = require('ioredis');

// Job Queue Manager
class JobQueueManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            redis: config.redis || {
                host: 'localhost',
                port: 6379,
                maxRetriesPerRequest: 3
            },
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 500,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                }
            },
            queues: config.queues || [
                'critical',
                'high',
                'normal',
                'low',
                'bulk'
            ],
            ...config
        };
        
        this.queues = new Map();
        this.workers = new Map();
        this.jobMetrics = new Map();
        this.scheduledJobs = new Map();
        this.deadLetterQueue = null;
        
        this.initializeQueues();
        this.setupMetricsCollection();
    }
    
    // Initialize job queues
    initializeQueues() {
        // Create Redis clients
        this.redisClient = new Redis(this.config.redis);
        this.redisSubscriber = new Redis(this.config.redis);
        
        // Initialize queues by priority
        const queueConfigs = {
            critical: {
                name: 'critical',
                priority: 1,
                concurrency: 10,
                rateLimit: null,
                defaultOptions: {
                    priority: 1,
                    attempts: 5,
                    backoff: {
                        type: 'exponential',
                        delay: 1000
                    }
                }
            },
            high: {
                name: 'high',
                priority: 2,
                concurrency: 20,
                rateLimit: {
                    max: 1000,
                    duration: 60000 // 1000 jobs per minute
                },
                defaultOptions: {
                    priority: 2,
                    attempts: 4
                }
            },
            normal: {
                name: 'normal',
                priority: 3,
                concurrency: 50,
                rateLimit: {
                    max: 5000,
                    duration: 60000 // 5000 jobs per minute
                },
                defaultOptions: {
                    priority: 3,
                    attempts: 3
                }
            },
            low: {
                name: 'low',
                priority: 4,
                concurrency: 100,
                rateLimit: {
                    max: 10000,
                    duration: 60000 // 10000 jobs per minute
                },
                defaultOptions: {
                    priority: 4,
                    attempts: 2
                }
            },
            bulk: {
                name: 'bulk',
                priority: 5,
                concurrency: 200,
                rateLimit: {
                    max: 50000,
                    duration: 60000 // 50000 jobs per minute
                },
                defaultOptions: {
                    priority: 5,
                    attempts: 3,
                    timeout: 3600000 // 1 hour timeout for bulk jobs
                }
            }
        };
        
        // Create Bull queues
        for (const [queueName, config] of Object.entries(queueConfigs)) {
            const queue = new Bull(`rootuip-${queueName}`, {
                redis: this.config.redis,
                defaultJobOptions: {
                    ...this.config.defaultJobOptions,
                    ...config.defaultOptions
                }
            });
            
            // Store queue configuration
            queue.config = config;
            
            // Setup queue event listeners
            this.setupQueueEvents(queue, queueName);
            
            // Store queue
            this.queues.set(queueName, queue);
        }
        
        // Initialize dead letter queue
        this.deadLetterQueue = new Bull('rootuip-dead-letter', {
            redis: this.config.redis,
            defaultJobOptions: {
                removeOnComplete: false,
                removeOnFail: false,
                attempts: 1
            }
        });
        
        console.log('Job queues initialized successfully');
    }
    
    // Setup queue event listeners
    setupQueueEvents(queue, queueName) {
        queue.on('completed', (job, result) => {
            this.emit('job:completed', {
                queueName,
                jobId: job.id,
                jobName: job.name,
                result,
                duration: Date.now() - job.timestamp,
                attempts: job.attemptsMade
            });
            
            this.updateMetrics(queueName, 'completed');
        });
        
        queue.on('failed', (job, err) => {
            this.emit('job:failed', {
                queueName,
                jobId: job.id,
                jobName: job.name,
                error: err.message,
                attempts: job.attemptsMade,
                willRetry: job.attemptsMade < job.opts.attempts
            });
            
            this.updateMetrics(queueName, 'failed');
            
            // Move to dead letter queue if max attempts reached
            if (job.attemptsMade >= job.opts.attempts) {
                this.moveToDeadLetterQueue(job, err);
            }
        });
        
        queue.on('active', (job) => {
            this.emit('job:active', {
                queueName,
                jobId: job.id,
                jobName: job.name,
                attempts: job.attemptsMade
            });
            
            this.updateMetrics(queueName, 'active');
        });
        
        queue.on('stalled', (job) => {
            this.emit('job:stalled', {
                queueName,
                jobId: job.id,
                jobName: job.name
            });
            
            this.updateMetrics(queueName, 'stalled');
        });
        
        queue.on('error', (error) => {
            console.error(`Queue ${queueName} error:`, error);
            this.emit('queue:error', {
                queueName,
                error: error.message
            });
        });
    }
    
    // Add job to queue
    async addJob(queueName, jobName, data, options = {}) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        // Merge options with queue defaults
        const jobOptions = {
            ...queue.config.defaultOptions,
            ...options,
            timestamp: Date.now()
        };
        
        // Add job ID if not provided
        if (!jobOptions.jobId) {
            jobOptions.jobId = this.generateJobId();
        }
        
        // Add job to queue
        const job = await queue.add(jobName, data, jobOptions);
        
        console.log(`Job ${job.id} added to ${queueName} queue`);
        
        this.emit('job:created', {
            queueName,
            jobId: job.id,
            jobName,
            priority: jobOptions.priority
        });
        
        return {
            id: job.id,
            name: jobName,
            queue: queueName,
            status: 'waiting',
            createdAt: new Date()
        };
    }
    
    // Add bulk jobs
    async addBulkJobs(queueName, jobs, options = {}) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        // Prepare bulk jobs
        const bulkJobs = jobs.map(job => ({
            name: job.name,
            data: job.data,
            opts: {
                ...queue.config.defaultOptions,
                ...options,
                ...job.options,
                jobId: job.id || this.generateJobId(),
                timestamp: Date.now()
            }
        }));
        
        // Add jobs in batches
        const batchSize = 1000;
        const results = [];
        
        for (let i = 0; i < bulkJobs.length; i += batchSize) {
            const batch = bulkJobs.slice(i, i + batchSize);
            const batchResults = await queue.addBulk(batch);
            results.push(...batchResults);
            
            console.log(`Added batch of ${batch.length} jobs to ${queueName} queue`);
        }
        
        this.emit('bulk:created', {
            queueName,
            count: results.length,
            firstJobId: results[0]?.id,
            lastJobId: results[results.length - 1]?.id
        });
        
        return results.map(job => ({
            id: job.id,
            name: job.name,
            queue: queueName,
            status: 'waiting'
        }));
    }
    
    // Schedule job (cron)
    async scheduleJob(queueName, jobName, cronExpression, data, options = {}) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        const scheduleId = `schedule_${this.generateJobId()}`;
        
        // Add repeatable job
        const job = await queue.add(
            jobName,
            data,
            {
                ...options,
                repeat: {
                    cron: cronExpression,
                    tz: options.timezone || 'UTC'
                }
            }
        );
        
        // Store scheduled job info
        this.scheduledJobs.set(scheduleId, {
            id: scheduleId,
            queueName,
            jobName,
            cronExpression,
            data,
            options,
            createdAt: new Date()
        });
        
        console.log(`Scheduled job ${scheduleId} with cron: ${cronExpression}`);
        
        this.emit('job:scheduled', {
            scheduleId,
            queueName,
            jobName,
            cronExpression
        });
        
        return {
            scheduleId,
            jobName,
            cronExpression,
            nextRun: job.opts.repeat.next
        };
    }
    
    // Process jobs (worker)
    async processQueue(queueName, processor, options = {}) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        const concurrency = options.concurrency || queue.config.concurrency;
        
        // Create worker
        const worker = queue.process(concurrency, async (job) => {
            const startTime = Date.now();
            
            try {
                // Update job progress
                await job.progress(0);
                
                // Process job
                const result = await processor(job);
                
                // Update metrics
                this.updateJobMetrics(queueName, {
                    processingTime: Date.now() - startTime,
                    success: true
                });
                
                await job.progress(100);
                
                return result;
                
            } catch (error) {
                // Update metrics
                this.updateJobMetrics(queueName, {
                    processingTime: Date.now() - startTime,
                    success: false,
                    error: error.message
                });
                
                throw error;
            }
        });
        
        this.workers.set(`${queueName}_worker`, worker);
        
        console.log(`Started processing ${queueName} queue with concurrency: ${concurrency}`);
        
        return worker;
    }
    
    // Retry failed job
    async retryJob(queueName, jobId) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        const job = await queue.getJob(jobId);
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }
        
        // Retry the job
        await job.retry();
        
        this.emit('job:retried', {
            queueName,
            jobId,
            attempts: job.attemptsMade
        });
        
        return {
            id: jobId,
            status: 'retrying',
            attempts: job.attemptsMade
        };
    }
    
    // Cancel job
    async cancelJob(queueName, jobId) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        const job = await queue.getJob(jobId);
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }
        
        // Remove the job
        await job.remove();
        
        this.emit('job:cancelled', {
            queueName,
            jobId
        });
        
        return {
            id: jobId,
            status: 'cancelled'
        };
    }
    
    // Move job to dead letter queue
    async moveToDeadLetterQueue(job, error) {
        const deadLetterJob = await this.deadLetterQueue.add('failed_job', {
            originalQueue: job.queue.name,
            originalJobId: job.id,
            originalJobName: job.name,
            originalData: job.data,
            error: error.message,
            errorStack: error.stack,
            attempts: job.attemptsMade,
            failedAt: new Date()
        });
        
        console.log(`Moved job ${job.id} to dead letter queue`);
        
        this.emit('job:dead_letter', {
            originalJobId: job.id,
            deadLetterJobId: deadLetterJob.id,
            error: error.message
        });
    }
    
    // Get queue status
    async getQueueStatus(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        const [
            waiting,
            active,
            completed,
            failed,
            delayed,
            paused
        ] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
            queue.isPaused()
        ]);
        
        return {
            name: queueName,
            waiting,
            active,
            completed,
            failed,
            delayed,
            paused,
            total: waiting + active + completed + failed + delayed
        };
    }
    
    // Get all queues status
    async getAllQueuesStatus() {
        const statuses = [];
        
        for (const queueName of this.queues.keys()) {
            const status = await this.getQueueStatus(queueName);
            statuses.push(status);
        }
        
        return statuses;
    }
    
    // Get job details
    async getJob(queueName, jobId) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        const job = await queue.getJob(jobId);
        if (!job) {
            return null;
        }
        
        const state = await job.getState();
        
        return {
            id: job.id,
            name: job.name,
            data: job.data,
            state,
            progress: job.progress(),
            attempts: job.attemptsMade,
            createdAt: new Date(job.timestamp),
            processedAt: job.processedOn ? new Date(job.processedOn) : null,
            completedAt: job.finishedOn ? new Date(job.finishedOn) : null,
            failedReason: job.failedReason
        };
    }
    
    // Get jobs by state
    async getJobsByState(queueName, state, start = 0, end = 20) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        let jobs;
        switch (state) {
            case 'waiting':
                jobs = await queue.getWaiting(start, end);
                break;
            case 'active':
                jobs = await queue.getActive(start, end);
                break;
            case 'completed':
                jobs = await queue.getCompleted(start, end);
                break;
            case 'failed':
                jobs = await queue.getFailed(start, end);
                break;
            case 'delayed':
                jobs = await queue.getDelayed(start, end);
                break;
            default:
                throw new Error(`Invalid state: ${state}`);
        }
        
        return jobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            attempts: job.attemptsMade,
            createdAt: new Date(job.timestamp),
            progress: job.progress()
        }));
    }
    
    // Pause queue
    async pauseQueue(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        await queue.pause();
        
        this.emit('queue:paused', { queueName });
        
        return { queue: queueName, paused: true };
    }
    
    // Resume queue
    async resumeQueue(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        await queue.resume();
        
        this.emit('queue:resumed', { queueName });
        
        return { queue: queueName, paused: false };
    }
    
    // Clean queue
    async cleanQueue(queueName, grace = 0, limit = 100, status = 'completed') {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        const removed = await queue.clean(grace, status, limit);
        
        console.log(`Cleaned ${removed.length} ${status} jobs from ${queueName} queue`);
        
        return {
            queue: queueName,
            removed: removed.length,
            status
        };
    }
    
    // Setup metrics collection
    setupMetricsCollection() {
        // Initialize metrics for each queue
        for (const queueName of this.queues.keys()) {
            this.jobMetrics.set(queueName, {
                processed: 0,
                completed: 0,
                failed: 0,
                active: 0,
                stalled: 0,
                totalProcessingTime: 0,
                avgProcessingTime: 0,
                successRate: 0,
                throughput: 0,
                lastReset: new Date()
            });
        }
        
        // Reset metrics periodically
        setInterval(() => {
            this.resetMetrics();
        }, 3600000); // Reset every hour
    }
    
    // Update metrics
    updateMetrics(queueName, event) {
        const metrics = this.jobMetrics.get(queueName);
        if (!metrics) return;
        
        switch (event) {
            case 'completed':
                metrics.completed++;
                metrics.processed++;
                break;
            case 'failed':
                metrics.failed++;
                metrics.processed++;
                break;
            case 'active':
                metrics.active++;
                break;
            case 'stalled':
                metrics.stalled++;
                break;
        }
        
        // Calculate success rate
        if (metrics.processed > 0) {
            metrics.successRate = (metrics.completed / metrics.processed) * 100;
        }
        
        // Calculate throughput (jobs per minute)
        const timeDiff = (Date.now() - metrics.lastReset.getTime()) / 60000; // minutes
        if (timeDiff > 0) {
            metrics.throughput = metrics.processed / timeDiff;
        }
    }
    
    // Update job-specific metrics
    updateJobMetrics(queueName, jobMetrics) {
        const metrics = this.jobMetrics.get(queueName);
        if (!metrics) return;
        
        if (jobMetrics.processingTime) {
            metrics.totalProcessingTime += jobMetrics.processingTime;
            if (metrics.processed > 0) {
                metrics.avgProcessingTime = metrics.totalProcessingTime / metrics.processed;
            }
        }
    }
    
    // Get metrics
    getMetrics(queueName) {
        if (queueName) {
            return this.jobMetrics.get(queueName);
        }
        
        // Return all metrics
        const allMetrics = {};
        for (const [name, metrics] of this.jobMetrics) {
            allMetrics[name] = metrics;
        }
        return allMetrics;
    }
    
    // Reset metrics
    resetMetrics() {
        for (const [queueName, metrics] of this.jobMetrics) {
            // Store historical data before reset
            this.emit('metrics:snapshot', {
                queueName,
                metrics: { ...metrics },
                timestamp: new Date()
            });
            
            // Reset counters
            metrics.processed = 0;
            metrics.completed = 0;
            metrics.failed = 0;
            metrics.active = 0;
            metrics.stalled = 0;
            metrics.totalProcessingTime = 0;
            metrics.avgProcessingTime = 0;
            metrics.successRate = 0;
            metrics.throughput = 0;
            metrics.lastReset = new Date();
        }
    }
    
    // Generate job ID
    generateJobId() {
        return `job_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    }
    
    // Graceful shutdown
    async shutdown() {
        console.log('Shutting down job queue manager...');
        
        // Close all queues
        const closePromises = [];
        for (const queue of this.queues.values()) {
            closePromises.push(queue.close());
        }
        
        // Close dead letter queue
        closePromises.push(this.deadLetterQueue.close());
        
        await Promise.all(closePromises);
        
        // Close Redis connections
        await this.redisClient.quit();
        await this.redisSubscriber.quit();
        
        console.log('Job queue manager shutdown complete');
    }
}

module.exports = {
    JobQueueManager
};