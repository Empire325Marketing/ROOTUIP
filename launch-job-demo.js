/**
 * ROOTUIP Job Processing System Demo
 * Mock version for demonstration without Redis
 */

const express = require('express');
const path = require('path');
const EventEmitter = require('events');

const app = express();
const PORT = process.env.JOB_DASHBOARD_PORT || 8083;

// Mock data storage
const mockData = {
    queues: {
        critical: { waiting: 12, active: 8, completed: 2456, failed: 2, delayed: 0 },
        high: { waiting: 156, active: 42, completed: 8923, failed: 8, delayed: 5 },
        normal: { waiting: 892, active: 128, completed: 45678, failed: 23, delayed: 34 },
        low: { waiting: 3421, active: 245, completed: 123456, failed: 67, delayed: 89 },
        bulk: { waiting: 12456, active: 512, completed: 456789, failed: 234, delayed: 567 }
    },
    jobs: [],
    alerts: [
        { id: 1, type: 'high_failure_rate', severity: 'critical', message: 'Failure rate: 8.5% - Critical queue affected', timestamp: new Date() },
        { id: 2, type: 'queue_depth', severity: 'warning', message: 'Normal queue has 892 waiting jobs', timestamp: new Date() }
    ],
    metrics: {
        totalJobs: 142384,
        activeJobs: 523,
        completedToday: 45678,
        failedToday: 334,
        avgProcessingTime: 3500,
        systemHealth: { score: 85, status: 'healthy' }
    }
};

// Initialize mock jobs
function initMockJobs() {
    const jobTypes = ['process_container_batch', 'generate_report', 'sync_carrier_data', 'send_email', 'train_prediction_model'];
    const queues = ['critical', 'high', 'normal', 'low', 'bulk'];
    
    for (let i = 0; i < 50; i++) {
        mockData.jobs.push({
            id: `job_${Date.now()}_${i}`,
            name: jobTypes[Math.floor(Math.random() * jobTypes.length)],
            queue: queues[Math.floor(Math.random() * queues.length)],
            state: ['waiting', 'active', 'completed', 'failed'][Math.floor(Math.random() * 4)],
            progress: Math.floor(Math.random() * 100),
            attempts: Math.floor(Math.random() * 3) + 1,
            createdAt: new Date(Date.now() - Math.random() * 3600000),
            data: { sample: 'data' }
        });
    }
}

initMockJobs();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API Routes
app.get('/api/dashboard/overview', (req, res) => {
    res.json({
        timestamp: new Date(),
        summary: mockData.metrics,
        queues: Object.entries(mockData.queues).map(([name, stats]) => ({
            name,
            ...stats,
            health: stats.failed > 50 ? 'critical' : stats.failed > 20 ? 'warning' : 'healthy'
        })),
        alerts: mockData.alerts,
        trends: {
            jobVolume: { current: 142384, previous: 125000, trend: 'up', change: '+13.9%' },
            successRate: { current: 96.8, previous: 94.2, trend: 'up', change: '+2.6%' },
            avgProcessingTime: { current: 3500, previous: 4200, trend: 'down', change: '-16.7%' }
        }
    });
});

app.get('/api/queues', (req, res) => {
    res.json(Object.entries(mockData.queues).map(([name, stats]) => ({
        name,
        ...stats,
        total: stats.waiting + stats.active + stats.completed + stats.failed + stats.delayed,
        paused: false
    })));
});

app.get('/api/queues/:name/status', (req, res) => {
    const queue = mockData.queues[req.params.name];
    if (!queue) {
        return res.status(404).json({ error: 'Queue not found' });
    }
    res.json({
        name: req.params.name,
        ...queue,
        total: queue.waiting + queue.active + queue.completed + queue.failed + queue.delayed,
        paused: false
    });
});

app.get('/api/queues/:name/jobs/:state', (req, res) => {
    const jobs = mockData.jobs
        .filter(job => job.queue === req.params.name && job.state === req.params.state)
        .slice(0, 20);
    res.json(jobs);
});

app.post('/api/jobs', (req, res) => {
    const { queue, name, data, options } = req.body;
    const job = {
        id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        queue,
        state: 'waiting',
        progress: 0,
        attempts: 0,
        createdAt: new Date(),
        data
    };
    mockData.jobs.push(job);
    mockData.queues[queue].waiting++;
    res.json(job);
});

app.post('/api/jobs/:queue/:id/retry', (req, res) => {
    const job = mockData.jobs.find(j => j.id === req.params.id);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    job.state = 'waiting';
    job.attempts++;
    res.json({ success: true, jobId: job.id, status: 'retrying' });
});

app.delete('/api/jobs/:queue/:id', (req, res) => {
    const jobIndex = mockData.jobs.findIndex(j => j.id === req.params.id);
    if (jobIndex === -1) {
        return res.status(404).json({ error: 'Job not found' });
    }
    mockData.jobs.splice(jobIndex, 1);
    res.json({ success: true, id: req.params.id, status: 'cancelled' });
});

app.get('/api/jobs/failed', (req, res) => {
    const failed = mockData.jobs
        .filter(job => job.state === 'failed')
        .slice(0, 100)
        .map(job => ({
            id: job.id,
            queue: job.queue,
            name: job.name,
            error: 'Connection timeout',
            attempts: job.attempts,
            failedAt: job.createdAt,
            canRetry: true
        }));
    res.json(failed);
});

app.get('/api/jobs/scheduled', (req, res) => {
    res.json([
        {
            id: 'schedule_1',
            name: 'daily_analytics',
            cronExpression: '0 2 * * *',
            nextRun: new Date(Date.now() + 7200000),
            lastRun: new Date(Date.now() - 79200000),
            status: 'active'
        },
        {
            id: 'schedule_2',
            name: 'hourly_sync',
            cronExpression: '0 * * * *',
            nextRun: new Date(Date.now() + 1800000),
            lastRun: new Date(Date.now() - 1800000),
            status: 'active'
        }
    ]);
});

app.get('/api/performance', (req, res) => {
    const now = Date.now();
    const dataPoints = Array.from({ length: 20 }, (_, i) => ({
        timestamp: new Date(now - i * 300000)
    }));
    
    res.json({
        timeRange: req.query.timeRange || '1h',
        timestamp: new Date(),
        queues: {
            critical: {
                throughput: dataPoints.map(d => ({ ...d, value: Math.floor(Math.random() * 100) + 50 })),
                latency: dataPoints.map(d => ({ ...d, value: Math.floor(Math.random() * 5000) + 1000 }))
            }
        },
        resources: {
            cpu: dataPoints.map(d => ({ ...d, value: Math.random() * 80 + 10 })),
            memory: dataPoints.map(d => ({ ...d, value: Math.random() * 70 + 20 }))
        }
    });
});

app.get('/api/alerts', (req, res) => {
    res.json(mockData.alerts);
});

app.get('/api/alerts/config', (req, res) => {
    res.json([
        {
            id: 'alert_1',
            name: 'High Queue Depth',
            type: 'queue_depth',
            threshold: 10000,
            severity: 'high',
            enabled: true
        },
        {
            id: 'alert_2',
            name: 'High Failure Rate',
            type: 'failure_rate',
            threshold: 10,
            severity: 'critical',
            enabled: true
        }
    ]);
});

app.get('/api/resources', (req, res) => {
    res.json({
        timestamp: new Date(),
        workers: {
            total: 100,
            active: Math.floor(Math.random() * 80) + 10,
            idle: 0,
            cpu: Math.random() * 80 + 10,
            memory: Math.random() * 70 + 20
        },
        redis: {
            connections: 42,
            memory: 45.7,
            ops_per_sec: 8456
        }
    });
});

app.get('/api/recommendations', (req, res) => {
    res.json([
        {
            type: 'queue_balancing',
            priority: 'high',
            title: 'Queue Imbalance Detected',
            description: 'Consider redistributing jobs across queues for better performance',
            impact: 'Performance improvement of up to 20%'
        }
    ]);
});

// Serve dashboard HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'job-management-interface.html'));
});

// Simulate real-time updates
setInterval(() => {
    // Update random queue stats
    const queues = Object.keys(mockData.queues);
    const randomQueue = queues[Math.floor(Math.random() * queues.length)];
    const queue = mockData.queues[randomQueue];
    
    // Simulate job movement
    if (queue.waiting > 0 && Math.random() > 0.5) {
        queue.waiting--;
        queue.active++;
    }
    if (queue.active > 0 && Math.random() > 0.3) {
        queue.active--;
        if (Math.random() > 0.1) {
            queue.completed++;
        } else {
            queue.failed++;
        }
    }
    
    // Update metrics
    mockData.metrics.activeJobs = Object.values(mockData.queues).reduce((sum, q) => sum + q.active, 0);
    mockData.metrics.totalJobs = mockData.jobs.length;
}, 2000);

// Start server
app.listen(PORT, () => {
    console.log(`
🚀 ROOTUIP Job Processing System Demo Started!

✅ Dashboard: http://localhost:${PORT}

📊 System Features:
- Distributed Job Queue Management
- Real-time Job Monitoring
- Performance Analytics
- Alert Configuration
- Resource Tracking

🔧 Demo Queues:
- critical: High-priority urgent jobs
- high: Important business operations
- normal: Standard processing tasks
- low: Background maintenance
- bulk: Large batch operations

📝 Sample Jobs Running:
- Container batch processing
- Report generation
- Carrier data synchronization
- Email notifications
- ML model training

⚡ This is a demo version running without Redis.
   For production use, install and configure Redis.
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down job processing demo...');
    process.exit(0);
});