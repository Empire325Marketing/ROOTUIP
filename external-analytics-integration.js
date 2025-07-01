// ROOTUIP External Analytics Integration
// Google Analytics, Mixpanel, DataDog integration for comprehensive monitoring

const express = require('express');
const { Pool } = require('pg');
const Redis = require('redis');
const winston = require('winston');
const axios = require('axios');
const helmet = require('helmet');

class ExternalAnalyticsIntegration {
    constructor() {
        this.app = express();
        this.port = process.env.ANALYTICS_INTEGRATION_PORT || 3017;
        
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        this.redis = Redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/external-analytics.log' }),
                new winston.transports.Console()
            ]
        });
        
        // Analytics service configurations
        this.analyticsConfig = {
            googleAnalytics: {
                trackingId: process.env.GA_TRACKING_ID,
                measurementId: process.env.GA_MEASUREMENT_ID,
                apiSecret: process.env.GA_API_SECRET,
                enabled: !!process.env.GA_TRACKING_ID
            },
            
            mixpanel: {
                projectToken: process.env.MIXPANEL_PROJECT_TOKEN,
                apiSecret: process.env.MIXPANEL_API_SECRET,
                enabled: !!process.env.MIXPANEL_PROJECT_TOKEN
            },
            
            datadog: {
                apiKey: process.env.DATADOG_API_KEY,
                appKey: process.env.DATADOG_APP_KEY,
                site: process.env.DATADOG_SITE || 'datadoghq.com',
                enabled: !!process.env.DATADOG_API_KEY
            },
            
            segment: {
                writeKey: process.env.SEGMENT_WRITE_KEY,
                enabled: !!process.env.SEGMENT_WRITE_KEY
            }
        };
        
        // Event tracking configuration
        this.eventTracking = {
            userEvents: [
                'user_login',
                'user_logout',
                'container_created',
                'container_viewed',
                'alert_viewed',
                'report_generated',
                'feature_used',
                'api_called'
            ],
            
            businessEvents: [
                'customer_onboarded',
                'contract_signed',
                'payment_received',
                'support_ticket_created',
                'demo_scheduled',
                'trial_started',
                'subscription_upgraded'
            ],
            
            systemEvents: [
                'system_error',
                'performance_degradation',
                'security_incident',
                'backup_completed',
                'deployment_completed'
            ]
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.initializeAnalytics();
        this.startEventProcessing();
    }
    
    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(express.json({ limit: '10mb' }));
        
        // CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });
        
        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            });
            next();
        });
    }
    
    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                integrations: this.getIntegrationStatus()
            });
        });
        
        // Track event
        this.app.post('/api/analytics/track', async (req, res) => {
            try {
                const { event, properties, userId, sessionId } = req.body;
                const result = await this.trackEvent(event, properties, userId, sessionId);
                res.json(result);
            } catch (error) {
                this.logger.error('Event tracking failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Track page view
        this.app.post('/api/analytics/pageview', async (req, res) => {
            try {
                const { page, title, userId, sessionId } = req.body;
                const result = await this.trackPageView(page, title, userId, sessionId);
                res.json(result);
            } catch (error) {
                this.logger.error('Page view tracking failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Get analytics data
        this.app.get('/api/analytics/data/:service', async (req, res) => {
            try {
                const { service } = req.params;
                const { metric, timeframe = '7d' } = req.query;
                const data = await this.getAnalyticsData(service, metric, timeframe);
                res.json(data);
            } catch (error) {
                this.logger.error('Analytics data retrieval failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Analytics dashboard
        this.app.get('/api/analytics/dashboard', async (req, res) => {
            try {
                const dashboard = await this.getAnalyticsDashboard();
                res.json(dashboard);
            } catch (error) {
                this.logger.error('Analytics dashboard failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Custom metrics
        this.app.post('/api/analytics/metrics', async (req, res) => {
            try {
                const { metrics } = req.body;
                const result = await this.sendCustomMetrics(metrics);
                res.json(result);
            } catch (error) {
                this.logger.error('Custom metrics failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Integration status
        this.app.get('/api/analytics/integrations', (req, res) => {
            res.json(this.getIntegrationStatus());
        });
        
        // Sync data between services
        this.app.post('/api/analytics/sync', async (req, res) => {
            try {
                const { service, dataType } = req.body;
                const result = await this.syncAnalyticsData(service, dataType);
                res.json(result);
            } catch (error) {
                this.logger.error('Analytics sync failed:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }
    
    initializeAnalytics() {
        this.logger.info('Initializing external analytics integrations');
        
        const enabledServices = [];
        
        if (this.analyticsConfig.googleAnalytics.enabled) {
            enabledServices.push('Google Analytics 4');
        }
        
        if (this.analyticsConfig.mixpanel.enabled) {
            enabledServices.push('Mixpanel');
        }
        
        if (this.analyticsConfig.datadog.enabled) {
            enabledServices.push('DataDog');
        }
        
        if (this.analyticsConfig.segment.enabled) {
            enabledServices.push('Segment');
        }
        
        this.logger.info(`Enabled analytics services: ${enabledServices.join(', ')}`);
    }
    
    async trackEvent(eventName, properties = {}, userId = null, sessionId = null) {
        const eventData = {
            event: eventName,
            properties: {
                ...properties,
                timestamp: new Date().toISOString(),
                platform: 'ROOTUIP',
                environment: process.env.NODE_ENV || 'production'
            },
            userId: userId,
            sessionId: sessionId
        };
        
        // Track to all enabled services in parallel
        const trackingPromises = [];
        
        if (this.analyticsConfig.googleAnalytics.enabled) {
            trackingPromises.push(this.trackGoogleAnalyticsEvent(eventData));
        }
        
        if (this.analyticsConfig.mixpanel.enabled) {
            trackingPromises.push(this.trackMixpanelEvent(eventData));
        }
        
        if (this.analyticsConfig.datadog.enabled) {
            trackingPromises.push(this.trackDataDogEvent(eventData));
        }
        
        if (this.analyticsConfig.segment.enabled) {
            trackingPromises.push(this.trackSegmentEvent(eventData));
        }
        
        // Store event locally for backup and analysis
        trackingPromises.push(this.storeLocalEvent(eventData));
        
        try {
            const results = await Promise.allSettled(trackingPromises);
            
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            this.logger.info(`Event tracked: ${eventName}`, {
                successful,
                failed,
                userId,
                eventData: eventData.properties
            });
            
            return {
                success: true,
                event: eventName,
                tracked: successful,
                failed: failed,
                timestamp: eventData.properties.timestamp
            };
            
        } catch (error) {
            this.logger.error('Event tracking failed:', error);
            throw error;
        }
    }
    
    async trackPageView(page, title, userId = null, sessionId = null) {
        const pageViewData = {
            page: page,
            title: title,
            userId: userId,
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            referrer: null,
            userAgent: null
        };
        
        const trackingPromises = [];
        
        if (this.analyticsConfig.googleAnalytics.enabled) {
            trackingPromises.push(this.trackGoogleAnalyticsPageView(pageViewData));
        }
        
        if (this.analyticsConfig.mixpanel.enabled) {
            trackingPromises.push(this.trackMixpanelPageView(pageViewData));
        }
        
        // Store locally
        trackingPromises.push(this.storeLocalPageView(pageViewData));
        
        const results = await Promise.allSettled(trackingPromises);
        
        return {
            success: true,
            page: page,
            tracked: results.filter(r => r.status === 'fulfilled').length,
            timestamp: pageViewData.timestamp
        };
    }
    
    async trackGoogleAnalyticsEvent(eventData) {
        if (!this.analyticsConfig.googleAnalytics.enabled) return;
        
        const url = `https://www.google-analytics.com/mp/collect?measurement_id=${this.analyticsConfig.googleAnalytics.measurementId}&api_secret=${this.analyticsConfig.googleAnalytics.apiSecret}`;
        
        const payload = {
            client_id: eventData.sessionId || 'anonymous',
            user_id: eventData.userId,
            events: [{
                name: this.normalizeEventName(eventData.event),
                parameters: {
                    ...eventData.properties,
                    engagement_time_msec: 1
                }
            }]
        };
        
        try {
            await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            
            this.logger.debug('Google Analytics event tracked', { event: eventData.event });
            
        } catch (error) {
            this.logger.error('Google Analytics tracking failed:', error);
            throw error;
        }
    }
    
    async trackGoogleAnalyticsPageView(pageViewData) {
        if (!this.analyticsConfig.googleAnalytics.enabled) return;
        
        const url = `https://www.google-analytics.com/mp/collect?measurement_id=${this.analyticsConfig.googleAnalytics.measurementId}&api_secret=${this.analyticsConfig.googleAnalytics.apiSecret}`;
        
        const payload = {
            client_id: pageViewData.sessionId || 'anonymous',
            user_id: pageViewData.userId,
            events: [{
                name: 'page_view',
                parameters: {
                    page_title: pageViewData.title,
                    page_location: pageViewData.page,
                    engagement_time_msec: 1
                }
            }]
        };
        
        await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });
    }
    
    async trackMixpanelEvent(eventData) {
        if (!this.analyticsConfig.mixpanel.enabled) return;
        
        const url = 'https://api.mixpanel.com/track';
        
        const payload = [{
            event: eventData.event,
            properties: {
                ...eventData.properties,
                token: this.analyticsConfig.mixpanel.projectToken,
                distinct_id: eventData.userId || eventData.sessionId,
                time: Math.floor(Date.now() / 1000)
            }
        }];
        
        try {
            await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            
            this.logger.debug('Mixpanel event tracked', { event: eventData.event });
            
        } catch (error) {
            this.logger.error('Mixpanel tracking failed:', error);
            throw error;
        }
    }
    
    async trackMixpanelPageView(pageViewData) {
        return this.trackMixpanelEvent({
            event: 'Page View',
            properties: {
                page: pageViewData.page,
                title: pageViewData.title
            },
            userId: pageViewData.userId,
            sessionId: pageViewData.sessionId
        });
    }
    
    async trackDataDogEvent(eventData) {
        if (!this.analyticsConfig.datadog.enabled) return;
        
        const url = `https://api.${this.analyticsConfig.datadog.site}/api/v1/events`;
        
        const payload = {
            title: `ROOTUIP Event: ${eventData.event}`,
            text: JSON.stringify(eventData.properties),
            tags: [
                'source:rootuip',
                `event:${eventData.event}`,
                `environment:${process.env.NODE_ENV || 'production'}`
            ],
            alert_type: 'info'
        };
        
        try {
            await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'DD-API-KEY': this.analyticsConfig.datadog.apiKey
                },
                timeout: 5000
            });
            
            this.logger.debug('DataDog event tracked', { event: eventData.event });
            
        } catch (error) {
            this.logger.error('DataDog tracking failed:', error);
            throw error;
        }
    }
    
    async trackSegmentEvent(eventData) {
        if (!this.analyticsConfig.segment.enabled) return;
        
        const url = 'https://api.segment.io/v1/track';
        
        const payload = {
            userId: eventData.userId,
            anonymousId: eventData.sessionId,
            event: eventData.event,
            properties: eventData.properties,
            timestamp: eventData.properties.timestamp
        };
        
        const auth = Buffer.from(this.analyticsConfig.segment.writeKey + ':').toString('base64');
        
        try {
            await axios.post(url, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${auth}`
                },
                timeout: 5000
            });
            
            this.logger.debug('Segment event tracked', { event: eventData.event });
            
        } catch (error) {
            this.logger.error('Segment tracking failed:', error);
            throw error;
        }
    }
    
    async sendCustomMetrics(metrics) {
        const results = {};
        
        // Send to DataDog
        if (this.analyticsConfig.datadog.enabled) {
            try {
                results.datadog = await this.sendDataDogMetrics(metrics);
            } catch (error) {
                this.logger.error('DataDog metrics failed:', error);
                results.datadog = { error: error.message };
            }
        }
        
        // Store locally
        await this.storeLocalMetrics(metrics);
        
        return results;
    }
    
    async sendDataDogMetrics(metrics) {
        const url = `https://api.${this.analyticsConfig.datadog.site}/api/v1/series`;
        
        const series = metrics.map(metric => ({
            metric: `rootuip.${metric.name}`,
            points: [[Math.floor(Date.now() / 1000), metric.value]],
            tags: metric.tags || [`environment:${process.env.NODE_ENV || 'production'}`],
            type: metric.type || 'gauge'
        }));
        
        const payload = { series };
        
        await axios.post(url, payload, {
            headers: {
                'Content-Type': 'application/json',
                'DD-API-KEY': this.analyticsConfig.datadog.apiKey
            },
            timeout: 10000
        });
        
        return { success: true, metrics: series.length };
    }
    
    async getAnalyticsData(service, metric, timeframe) {
        switch (service) {
            case 'google-analytics':
                return await this.getGoogleAnalyticsData(metric, timeframe);
            case 'mixpanel':
                return await this.getMixpanelData(metric, timeframe);
            case 'datadog':
                return await this.getDataDogData(metric, timeframe);
            case 'local':
                return await this.getLocalAnalyticsData(metric, timeframe);
            default:
                throw new Error(`Unknown analytics service: ${service}`);
        }
    }
    
    async getLocalAnalyticsData(metric, timeframe) {
        // Query local analytics data from database
        const timeframeDays = this.parseTimeframe(timeframe);
        
        const queries = {
            page_views: `
                SELECT 
                    DATE_TRUNC('hour', created_at) as hour,
                    COUNT(*) as count
                FROM analytics_page_views 
                WHERE created_at >= NOW() - INTERVAL '${timeframeDays} days'
                GROUP BY hour
                ORDER BY hour
            `,
            
            events: `
                SELECT 
                    event_name,
                    DATE_TRUNC('hour', created_at) as hour,
                    COUNT(*) as count
                FROM analytics_events 
                WHERE created_at >= NOW() - INTERVAL '${timeframeDays} days'
                GROUP BY event_name, hour
                ORDER BY hour
            `,
            
            users: `
                SELECT 
                    DATE_TRUNC('day', created_at) as day,
                    COUNT(DISTINCT user_id) as unique_users
                FROM analytics_events 
                WHERE created_at >= NOW() - INTERVAL '${timeframeDays} days'
                AND user_id IS NOT NULL
                GROUP BY day
                ORDER BY day
            `
        };
        
        if (!queries[metric]) {
            throw new Error(`Unknown metric: ${metric}`);
        }
        
        const result = await this.db.query(queries[metric]);
        return result.rows;
    }
    
    async getAnalyticsDashboard() {
        const cacheKey = 'analytics:dashboard';
        const cached = await this.redis.get(cacheKey);
        
        if (cached) {
            return JSON.parse(cached);
        }
        
        const [
            pageViews,
            events,
            users,
            integrationStatus
        ] = await Promise.all([
            this.getLocalAnalyticsData('page_views', '7d'),
            this.getLocalAnalyticsData('events', '7d'),
            this.getLocalAnalyticsData('users', '7d'),
            this.getIntegrationStatus()
        ]);
        
        const dashboard = {
            pageViews: pageViews.reduce((sum, row) => sum + parseInt(row.count), 0),
            events: events.reduce((sum, row) => sum + parseInt(row.count), 0),
            uniqueUsers: users.reduce((sum, row) => sum + parseInt(row.unique_users), 0),
            integrations: integrationStatus,
            trends: {
                pageViews: pageViews,
                events: this.aggregateEventsByName(events),
                users: users
            },
            timestamp: new Date().toISOString()
        };
        
        // Cache for 1 hour
        await this.redis.setex(cacheKey, 3600, JSON.stringify(dashboard));
        
        return dashboard;
    }
    
    getIntegrationStatus() {
        return {
            googleAnalytics: {
                enabled: this.analyticsConfig.googleAnalytics.enabled,
                status: this.analyticsConfig.googleAnalytics.enabled ? 'connected' : 'disabled',
                lastSync: this.analyticsConfig.googleAnalytics.enabled ? new Date().toISOString() : null
            },
            mixpanel: {
                enabled: this.analyticsConfig.mixpanel.enabled,
                status: this.analyticsConfig.mixpanel.enabled ? 'connected' : 'disabled',
                lastSync: this.analyticsConfig.mixpanel.enabled ? new Date().toISOString() : null
            },
            datadog: {
                enabled: this.analyticsConfig.datadog.enabled,
                status: this.analyticsConfig.datadog.enabled ? 'connected' : 'disabled',
                lastSync: this.analyticsConfig.datadog.enabled ? new Date().toISOString() : null
            },
            segment: {
                enabled: this.analyticsConfig.segment.enabled,
                status: this.analyticsConfig.segment.enabled ? 'connected' : 'disabled',
                lastSync: this.analyticsConfig.segment.enabled ? new Date().toISOString() : null
            }
        };
    }
    
    async storeLocalEvent(eventData) {
        const query = `
            INSERT INTO analytics_events (
                event_name, user_id, session_id, properties, created_at
            ) VALUES ($1, $2, $3, $4, NOW())
        `;
        
        await this.db.query(query, [
            eventData.event,
            eventData.userId,
            eventData.sessionId,
            JSON.stringify(eventData.properties)
        ]);
    }
    
    async storeLocalPageView(pageViewData) {
        const query = `
            INSERT INTO analytics_page_views (
                page, title, user_id, session_id, created_at
            ) VALUES ($1, $2, $3, $4, NOW())
        `;
        
        await this.db.query(query, [
            pageViewData.page,
            pageViewData.title,
            pageViewData.userId,
            pageViewData.sessionId
        ]);
    }
    
    async storeLocalMetrics(metrics) {
        const query = `
            INSERT INTO analytics_metrics (
                metric_name, metric_value, metric_type, tags, created_at
            ) VALUES ($1, $2, $3, $4, NOW())
        `;
        
        for (const metric of metrics) {
            await this.db.query(query, [
                metric.name,
                metric.value,
                metric.type || 'gauge',
                JSON.stringify(metric.tags || [])
            ]);
        }
    }
    
    startEventProcessing() {
        this.logger.info('Starting analytics event processing');
        
        // Process queued events every minute
        setInterval(() => {
            this.processQueuedEvents();
        }, 60000);
        
        // Send aggregated metrics every 5 minutes
        setInterval(() => {
            this.sendAggregatedMetrics();
        }, 300000);
        
        // Sync data between services hourly
        setInterval(() => {
            this.syncAllAnalyticsData();
        }, 3600000);
    }
    
    async processQueuedEvents() {
        try {
            // Process any failed or queued events
            const queuedEvents = await this.redis.lrange('analytics:queue', 0, 99);
            
            for (const eventData of queuedEvents) {
                try {
                    const event = JSON.parse(eventData);
                    await this.trackEvent(event.event, event.properties, event.userId, event.sessionId);
                    await this.redis.lrem('analytics:queue', 1, eventData);
                } catch (error) {
                    this.logger.error('Failed to process queued event:', error);
                }
            }
            
        } catch (error) {
            this.logger.error('Event queue processing failed:', error);
        }
    }
    
    async sendAggregatedMetrics() {
        try {
            // Calculate and send business metrics
            const metrics = await this.calculateBusinessMetrics();
            
            if (metrics.length > 0) {
                await this.sendCustomMetrics(metrics);
            }
            
        } catch (error) {
            this.logger.error('Aggregated metrics failed:', error);
        }
    }
    
    async calculateBusinessMetrics() {
        const queries = [
            {
                name: 'active_users_hourly',
                query: 'SELECT COUNT(DISTINCT user_id) as value FROM analytics_events WHERE created_at >= NOW() - INTERVAL \'1 hour\' AND user_id IS NOT NULL',
                type: 'gauge'
            },
            {
                name: 'page_views_hourly',
                query: 'SELECT COUNT(*) as value FROM analytics_page_views WHERE created_at >= NOW() - INTERVAL \'1 hour\'',
                type: 'count'
            },
            {
                name: 'api_calls_hourly',
                query: 'SELECT COUNT(*) as value FROM analytics_events WHERE event_name = \'api_called\' AND created_at >= NOW() - INTERVAL \'1 hour\'',
                type: 'count'
            }
        ];
        
        const metrics = [];
        
        for (const metricQuery of queries) {
            try {
                const result = await this.db.query(metricQuery.query);
                const value = parseInt(result.rows[0]?.value || 0);
                
                metrics.push({
                    name: metricQuery.name,
                    value: value,
                    type: metricQuery.type,
                    tags: [`environment:${process.env.NODE_ENV || 'production'}`]
                });
            } catch (error) {
                this.logger.error(`Metric calculation failed for ${metricQuery.name}:`, error);
            }
        }
        
        return metrics;
    }
    
    normalizeEventName(eventName) {
        // Google Analytics event names must be alphanumeric with underscores
        return eventName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }
    
    parseTimeframe(timeframe) {
        const match = timeframe.match(/(\d+)([dwmy])/);
        if (!match) return 7; // default 7 days
        
        const [, value, unit] = match;
        const multipliers = { d: 1, w: 7, m: 30, y: 365 };
        
        return parseInt(value) * (multipliers[unit] || 1);
    }
    
    aggregateEventsByName(events) {
        const aggregated = {};
        
        events.forEach(row => {
            if (!aggregated[row.event_name]) {
                aggregated[row.event_name] = [];
            }
            aggregated[row.event_name].push({
                hour: row.hour,
                count: parseInt(row.count)
            });
        });
        
        return aggregated;
    }
    
    start() {
        this.server = this.app.listen(this.port, () => {
            this.logger.info(`External Analytics Integration running on port ${this.port}`);
            console.log(`📊 ROOTUIP External Analytics Integration`);
            console.log(`   Port: ${this.port}`);
            console.log(`   Dashboard: http://localhost:${this.port}/api/analytics/dashboard`);
            console.log(`   Integrations: http://localhost:${this.port}/api/analytics/integrations`);
            
            // Log enabled services
            const integrations = this.getIntegrationStatus();
            const enabled = Object.entries(integrations)
                .filter(([_, config]) => config.enabled)
                .map(([name, _]) => name);
            
            console.log(`   Enabled Services: ${enabled.join(', ') || 'None'}`);
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
            this.logger.info('Shutting down analytics integration...');
            this.server.close(() => {
                this.db.end();
                this.redis.quit();
                process.exit(0);
            });
        });
    }
}

// Database schema for analytics
const createAnalyticsTables = `
    CREATE TABLE IF NOT EXISTS analytics_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        event_name VARCHAR(255) NOT NULL,
        user_id UUID,
        session_id VARCHAR(255),
        properties JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS analytics_page_views (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        page VARCHAR(500) NOT NULL,
        title VARCHAR(500),
        user_id UUID,
        session_id VARCHAR(255),
        referrer VARCHAR(500),
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS analytics_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        metric_name VARCHAR(255) NOT NULL,
        metric_value DECIMAL(15,4) NOT NULL,
        metric_type VARCHAR(50) DEFAULT 'gauge',
        tags JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON analytics_events(event_name);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_page_views_page ON analytics_page_views(page);
    CREATE INDEX IF NOT EXISTS idx_analytics_page_views_user ON analytics_page_views(user_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_page_views_created ON analytics_page_views(created_at);
    CREATE INDEX IF NOT EXISTS idx_analytics_metrics_name ON analytics_metrics(metric_name);
    CREATE INDEX IF NOT EXISTS idx_analytics_metrics_created ON analytics_metrics(created_at);
`;

// Start analytics integration if called directly
if (require.main === module) {
    const analyticsIntegration = new ExternalAnalyticsIntegration();
    
    // Initialize database schema
    analyticsIntegration.db.query(createAnalyticsTables).then(() => {
        analyticsIntegration.start();
    }).catch(error => {
        console.error('Failed to initialize analytics integration:', error);
        process.exit(1);
    });
}

module.exports = ExternalAnalyticsIntegration;