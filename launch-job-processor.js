/**
 * ROOTUIP Job Processing System Launcher
 * Starts all job processing components
 */

const express = require('express');
const path = require('path');
const { JobQueueManager } = require('./job-queue-manager');
const { BackgroundProcessor } = require('./background-processor');
const { JobManagementDashboard } = require('./job-management-dashboard');

const app = express();
const PORT = process.env.JOB_DASHBOARD_PORT || 8083;

// Initialize components
console.log('🚀 Starting ROOTUIP Job Processing System...\n');

// Initialize Job Queue Manager
const jobQueue = new JobQueueManager({
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
    }
});

// Initialize Background Processor
const processor = new BackgroundProcessor({
    queue: {
        redis: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD
        }
    }
});

// Initialize Dashboard
const dashboard = new JobManagementDashboard({
    refreshInterval: 5000
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes
app.get('/api/dashboard/overview', async (req, res) => {
    try {
        const overview = await dashboard.getDashboardOverview();
        res.json(overview);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/queues', async (req, res) => {
    try {
        const queues = await jobQueue.getAllQueuesStatus();
        res.json(queues);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/queues/:name/status', async (req, res) => {
    try {
        const status = await jobQueue.getQueueStatus(req.params.name);
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/queues/:name/jobs/:state', async (req, res) => {
    try {
        const jobs = await jobQueue.getJobsByState(
            req.params.name, 
            req.params.state,
            0,
            50
        );
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/jobs', async (req, res) => {
    try {
        const { queue, name, data, options } = req.body;
        const job = await jobQueue.addJob(queue, name, data, options);
        res.json(job);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/jobs/:queue/:id/retry', async (req, res) => {
    try {
        const result = await jobQueue.retryJob(req.params.queue, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/jobs/:queue/:id', async (req, res) => {
    try {
        const result = await jobQueue.cancelJob(req.params.queue, req.params.id);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/jobs/failed', async (req, res) => {
    try {
        const failed = await dashboard.getFailedJobs(100);
        res.json(failed);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/jobs/scheduled', async (req, res) => {
    try {
        const scheduled = await dashboard.getScheduledJobs();
        res.json(scheduled);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/performance', async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '1h';
        const analytics = await dashboard.getPerformanceAnalytics(timeRange);
        res.json(analytics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/alerts', async (req, res) => {
    try {
        const alerts = await dashboard.getActiveAlerts();
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/alerts/config', async (req, res) => {
    try {
        const configs = await dashboard.getAlertConfigurations();
        res.json(configs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/resources', async (req, res) => {
    try {
        const usage = await dashboard.getResourceUsage();
        res.json(usage);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/recommendations', async (req, res) => {
    try {
        const recommendations = await dashboard.getOptimizationRecommendations();
        res.json(recommendations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve dashboard HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'job-management-interface.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Job Management Dashboard running at http://localhost:${PORT}`);
    console.log('\n📊 System Status:');
    console.log('- Job Queue Manager: Active');
    console.log('- Background Processor: Active');
    console.log('- Dashboard API: Active');
    console.log('- Redis Connection: Connected');
    console.log('\n🔧 Available Queues:');
    console.log('- critical (Priority: 1, Concurrency: 10)');
    console.log('- high (Priority: 2, Concurrency: 20)');
    console.log('- normal (Priority: 3, Concurrency: 50)');
    console.log('- low (Priority: 4, Concurrency: 100)');
    console.log('- bulk (Priority: 5, Concurrency: 200)');
});

// Demo: Add some sample jobs
setTimeout(async () => {
    console.log('\n📝 Adding sample jobs for demonstration...');
    
    // Add various types of jobs
    await jobQueue.addJob('high', 'process_container_batch', {
        containerIds: ['CONT001', 'CONT002', 'CONT003'],
        operation: 'update_location'
    });
    
    await jobQueue.addJob('normal', 'generate_report', {
        reportType: 'weekly_summary',
        format: 'pdf',
        parameters: { week: 49 }
    });
    
    await jobQueue.addJob('low', 'sync_carrier_data', {
        carrierId: 'MAERSK',
        syncType: 'incremental',
        lastSyncTime: new Date(Date.now() - 3600000)
    });
    
    console.log('✅ Sample jobs added to queues');
}, 3000);

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down job processing system...');
    await jobQueue.shutdown();
    process.exit(0);
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});