/**
 * ROOTUIP Partner Analytics Platform
 * Real-time analytics and insights for partners
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class AnalyticsPlatform extends EventEmitter {
    constructor() {
        super();
        
        // Analytics data stores
        this.metrics = {
            realtime: new Map(),
            hourly: new Map(),
            daily: new Map(),
            monthly: new Map()
        };
        
        // Metric types
        this.metricTypes = {
            // API Metrics
            API_CALLS: 'api_calls',
            API_ERRORS: 'api_errors',
            API_LATENCY: 'api_latency',
            
            // Business Metrics
            CONTAINERS_TRACKED: 'containers_tracked',
            SHIPMENTS_CREATED: 'shipments_created',
            BOOKINGS_MADE: 'bookings_made',
            DOCUMENTS_PROCESSED: 'documents_processed',
            
            // Revenue Metrics
            TRANSACTION_VOLUME: 'transaction_volume',
            REVENUE_GENERATED: 'revenue_generated',
            COMMISSION_EARNED: 'commission_earned',
            
            // Quality Metrics
            UPTIME: 'uptime',
            ERROR_RATE: 'error_rate',
            CUSTOMER_SATISFACTION: 'customer_satisfaction',
            
            // Integration Metrics
            ACTIVE_CUSTOMERS: 'active_customers',
            NEW_INSTALLATIONS: 'new_installations',
            CHURN_RATE: 'churn_rate'
        };
        
        // Aggregation rules
        this.aggregationRules = {
            sum: ['api_calls', 'api_errors', 'containers_tracked', 'shipments_created', 
                  'bookings_made', 'documents_processed', 'transaction_volume', 
                  'revenue_generated', 'commission_earned', 'new_installations'],
            average: ['api_latency', 'uptime', 'error_rate', 'customer_satisfaction'],
            unique: ['active_customers'],
            calculated: ['churn_rate']
        };
        
        // Real-time dashboards
        this.dashboards = new Map();
        
        // Alerts configuration
        this.alerts = new Map();
        
        // Report templates
        this.reportTemplates = this.initializeReportTemplates();
        
        this.initialize();
    }
    
    async initialize() {
        // Start metric collection
        this.startMetricCollection();
        
        // Start aggregation jobs
        this.startAggregationJobs();
        
        console.log('Analytics Platform initialized');
    }
    
    // Record metric
    async recordMetric(partnerId, metricType, value, metadata = {}) {
        const metric = {
            id: uuidv4(),
            partnerId,
            type: metricType,
            value,
            metadata,
            timestamp: new Date()
        };
        
        // Store in real-time metrics
        const key = `${partnerId}:${metricType}`;
        if (!this.metrics.realtime.has(key)) {
            this.metrics.realtime.set(key, []);
        }
        this.metrics.realtime.get(key).push(metric);
        
        // Check alerts
        await this.checkAlerts(partnerId, metricType, value);
        
        // Emit event for real-time dashboards
        this.emit('metric:recorded', metric);
        
        return metric;
    }
    
    // Batch record metrics
    async recordBatch(metrics) {
        const results = [];
        
        for (const metric of metrics) {
            const result = await this.recordMetric(
                metric.partnerId,
                metric.type,
                metric.value,
                metric.metadata
            );
            results.push(result);
        }
        
        return results;
    }
    
    // Get partner analytics
    async getPartnerAnalytics(partnerId, options = {}) {
        const {
            period = '7d',
            metrics = Object.values(this.metricTypes),
            granularity = 'daily'
        } = options;
        
        const analytics = {
            partnerId,
            period,
            granularity,
            summary: await this.getSummaryMetrics(partnerId, period, metrics),
            timeseries: await this.getTimeseriesData(partnerId, period, metrics, granularity),
            comparisons: await this.getComparisons(partnerId, period),
            insights: await this.generateInsights(partnerId, period)
        };
        
        return analytics;
    }
    
    // Get summary metrics
    async getSummaryMetrics(partnerId, period, metricTypes) {
        const summary = {};
        const periodMs = this.parsePeriod(period);
        const startDate = new Date(Date.now() - periodMs);
        
        for (const metricType of metricTypes) {
            const data = await this.getMetricData(partnerId, metricType, startDate);
            
            summary[metricType] = {
                current: this.calculateCurrent(data, metricType),
                previous: this.calculatePrevious(data, metricType, periodMs),
                change: this.calculateChange(data, metricType, periodMs),
                trend: this.calculateTrend(data, metricType)
            };
        }
        
        return summary;
    }
    
    // Get timeseries data
    async getTimeseriesData(partnerId, period, metricTypes, granularity) {
        const timeseries = {};
        const periodMs = this.parsePeriod(period);
        const startDate = new Date(Date.now() - periodMs);
        
        for (const metricType of metricTypes) {
            const data = await this.getMetricData(partnerId, metricType, startDate);
            timeseries[metricType] = this.aggregateByTime(data, granularity, metricType);
        }
        
        return timeseries;
    }
    
    // Generate insights
    async generateInsights(partnerId, period) {
        const insights = [];
        const metrics = await this.getSummaryMetrics(partnerId, period, Object.values(this.metricTypes));
        
        // API performance insights
        if (metrics.api_latency && metrics.api_latency.current > 500) {
            insights.push({
                type: 'warning',
                category: 'performance',
                title: 'High API Latency',
                description: `Average API latency is ${metrics.api_latency.current}ms, which may impact customer experience`,
                recommendation: 'Consider optimizing slow endpoints or upgrading infrastructure'
            });
        }
        
        // Revenue insights
        if (metrics.revenue_generated && metrics.revenue_generated.change > 20) {
            insights.push({
                type: 'positive',
                category: 'revenue',
                title: 'Revenue Growth',
                description: `Revenue increased by ${metrics.revenue_generated.change}% compared to previous period`,
                recommendation: 'Maintain momentum by expanding to new customer segments'
            });
        }
        
        // Error rate insights
        if (metrics.error_rate && metrics.error_rate.current > 5) {
            insights.push({
                type: 'critical',
                category: 'reliability',
                title: 'High Error Rate',
                description: `Error rate is ${metrics.error_rate.current}%, exceeding acceptable threshold`,
                recommendation: 'Investigate error logs and implement fixes immediately'
            });
        }
        
        // Customer activity insights
        if (metrics.active_customers && metrics.active_customers.change < -10) {
            insights.push({
                type: 'warning',
                category: 'engagement',
                title: 'Declining Customer Activity',
                description: `Active customers decreased by ${Math.abs(metrics.active_customers.change)}%`,
                recommendation: 'Reach out to inactive customers and gather feedback'
            });
        }
        
        return insights;
    }
    
    // Create custom dashboard
    async createDashboard(partnerId, config) {
        const dashboard = {
            id: uuidv4(),
            partnerId,
            name: config.name,
            description: config.description,
            widgets: config.widgets || [],
            layout: config.layout || 'grid',
            refreshInterval: config.refreshInterval || 60000, // 1 minute
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Validate widgets
        for (const widget of dashboard.widgets) {
            this.validateWidget(widget);
        }
        
        this.dashboards.set(dashboard.id, dashboard);
        
        // Start real-time updates
        this.startDashboardUpdates(dashboard);
        
        return dashboard;
    }
    
    // Configure alerts
    async configureAlert(partnerId, alertConfig) {
        const alert = {
            id: uuidv4(),
            partnerId,
            name: alertConfig.name,
            metric: alertConfig.metric,
            condition: alertConfig.condition, // { operator: '>', value: 100 }
            severity: alertConfig.severity || 'warning',
            notifications: alertConfig.notifications || [],
            cooldown: alertConfig.cooldown || 3600000, // 1 hour
            enabled: true,
            lastTriggered: null,
            createdAt: new Date()
        };
        
        const key = `${partnerId}:${alert.metric}`;
        if (!this.alerts.has(key)) {
            this.alerts.set(key, []);
        }
        this.alerts.get(key).push(alert);
        
        return alert;
    }
    
    // Check alerts
    async checkAlerts(partnerId, metricType, value) {
        const key = `${partnerId}:${metricType}`;
        const alerts = this.alerts.get(key) || [];
        
        for (const alert of alerts) {
            if (!alert.enabled) continue;
            
            // Check cooldown
            if (alert.lastTriggered) {
                const timeSinceLastTrigger = Date.now() - alert.lastTriggered.getTime();
                if (timeSinceLastTrigger < alert.cooldown) continue;
            }
            
            // Check condition
            const triggered = this.evaluateCondition(value, alert.condition);
            
            if (triggered) {
                alert.lastTriggered = new Date();
                
                // Send notifications
                await this.sendAlertNotifications(alert, {
                    metric: metricType,
                    value,
                    condition: alert.condition,
                    timestamp: new Date()
                });
                
                this.emit('alert:triggered', {
                    alert,
                    value,
                    partnerId
                });
            }
        }
    }
    
    // Generate reports
    async generateReport(partnerId, reportType, options = {}) {
        const template = this.reportTemplates[reportType];
        if (!template) {
            throw new Error(`Unknown report type: ${reportType}`);
        }
        
        const report = {
            id: uuidv4(),
            partnerId,
            type: reportType,
            period: options.period || template.defaultPeriod,
            generatedAt: new Date(),
            sections: []
        };
        
        // Generate each section
        for (const section of template.sections) {
            const sectionData = await this.generateReportSection(
                partnerId,
                section,
                report.period
            );
            report.sections.push(sectionData);
        }
        
        // Add executive summary
        report.summary = await this.generateExecutiveSummary(report);
        
        return report;
    }
    
    // Generate report section
    async generateReportSection(partnerId, sectionConfig, period) {
        const section = {
            title: sectionConfig.title,
            type: sectionConfig.type,
            data: {}
        };
        
        switch (sectionConfig.type) {
            case 'metrics_summary':
                section.data = await this.getSummaryMetrics(
                    partnerId,
                    period,
                    sectionConfig.metrics
                );
                break;
                
            case 'performance_trends':
                section.data = await this.getTimeseriesData(
                    partnerId,
                    period,
                    sectionConfig.metrics,
                    'daily'
                );
                break;
                
            case 'revenue_breakdown':
                section.data = await this.getRevenueBreakdown(partnerId, period);
                break;
                
            case 'top_customers':
                section.data = await this.getTopCustomers(partnerId, period);
                break;
                
            case 'api_usage':
                section.data = await this.getAPIUsageStats(partnerId, period);
                break;
        }
        
        return section;
    }
    
    // Get revenue breakdown
    async getRevenueBreakdown(partnerId, period) {
        // Mock revenue breakdown
        return {
            total: 45678.90,
            byType: {
                transaction_fees: 25678.90,
                subscription_share: 15000.00,
                performance_bonus: 5000.00
            },
            byProduct: {
                container_tracking: 20000.00,
                shipment_booking: 15678.90,
                document_processing: 10000.00
            },
            byRegion: {
                'north_america': 20000.00,
                'europe': 15000.00,
                'asia_pacific': 10678.90
            },
            growth: {
                month_over_month: 15.5,
                year_over_year: 125.3
            }
        };
    }
    
    // Get top customers
    async getTopCustomers(partnerId, period) {
        // Mock top customers
        return {
            customers: [
                {
                    id: 'cust-001',
                    name: 'Global Logistics Inc',
                    transactions: 5678,
                    revenue: 12345.67,
                    growth: 23.4
                },
                {
                    id: 'cust-002',
                    name: 'Ocean Freight Co',
                    transactions: 4321,
                    revenue: 9876.54,
                    growth: 15.2
                },
                {
                    id: 'cust-003',
                    name: 'Express Shipping Ltd',
                    transactions: 3210,
                    revenue: 7654.32,
                    growth: -5.1
                }
            ],
            totalCustomers: 156,
            newCustomers: 23,
            churnedCustomers: 5
        };
    }
    
    // Get API usage stats
    async getAPIUsageStats(partnerId, period) {
        // Mock API usage stats
        return {
            totalCalls: 1234567,
            byEndpoint: {
                '/containers/:id': { calls: 456789, avgLatency: 145 },
                '/shipments': { calls: 234567, avgLatency: 234 },
                '/bookings/quote': { calls: 123456, avgLatency: 567 },
                '/documents': { calls: 89012, avgLatency: 890 }
            },
            byMethod: {
                GET: 789012,
                POST: 345678,
                PUT: 89012,
                DELETE: 10865
            },
            errorRate: 0.23,
            availability: 99.95,
            peakHour: 14,
            peakDay: 'Wednesday'
        };
    }
    
    // Benchmark performance
    async benchmarkPerformance(partnerId, competitorGroup = 'similar_size') {
        const metrics = await this.getSummaryMetrics(
            partnerId,
            '30d',
            Object.values(this.metricTypes)
        );
        
        // Get benchmark data (mock)
        const benchmarks = this.getBenchmarkData(competitorGroup);
        
        const comparison = {};
        
        for (const [metric, data] of Object.entries(metrics)) {
            const benchmark = benchmarks[metric];
            if (!benchmark) continue;
            
            comparison[metric] = {
                partner: data.current,
                benchmark: benchmark.average,
                percentile: this.calculatePercentile(data.current, benchmark),
                rating: this.getRating(data.current, benchmark)
            };
        }
        
        return {
            partnerId,
            competitorGroup,
            period: '30d',
            comparison,
            overall_score: this.calculateOverallScore(comparison),
            recommendations: this.generateBenchmarkRecommendations(comparison)
        };
    }
    
    // Helper methods
    parsePeriod(period) {
        const match = period.match(/(\d+)([dhm])/);
        if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days
        
        const value = parseInt(match[1]);
        const unit = match[2];
        
        switch (unit) {
            case 'd': return value * 24 * 60 * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'm': return value * 60 * 1000;
            default: return 7 * 24 * 60 * 60 * 1000;
        }
    }
    
    async getMetricData(partnerId, metricType, startDate) {
        // In production, this would query from database
        // For now, return mock data
        const data = [];
        const now = Date.now();
        const start = startDate.getTime();
        
        for (let i = 0; i < 100; i++) {
            const timestamp = start + (now - start) * (i / 100);
            data.push({
                timestamp: new Date(timestamp),
                value: this.generateMockValue(metricType)
            });
        }
        
        return data;
    }
    
    generateMockValue(metricType) {
        switch (metricType) {
            case 'api_calls': return Math.floor(Math.random() * 1000) + 500;
            case 'api_latency': return Math.floor(Math.random() * 200) + 50;
            case 'error_rate': return Math.random() * 2;
            case 'revenue_generated': return Math.random() * 1000 + 100;
            case 'active_customers': return Math.floor(Math.random() * 50) + 20;
            default: return Math.random() * 100;
        }
    }
    
    calculateCurrent(data, metricType) {
        if (data.length === 0) return 0;
        
        if (this.aggregationRules.sum.includes(metricType)) {
            return data.reduce((sum, d) => sum + d.value, 0);
        } else if (this.aggregationRules.average.includes(metricType)) {
            return data.reduce((sum, d) => sum + d.value, 0) / data.length;
        } else {
            return data[data.length - 1].value;
        }
    }
    
    calculateTrend(data, metricType) {
        if (data.length < 2) return 'stable';
        
        const recent = data.slice(-10);
        const older = data.slice(-20, -10);
        
        const recentAvg = recent.reduce((sum, d) => sum + d.value, 0) / recent.length;
        const olderAvg = older.reduce((sum, d) => sum + d.value, 0) / older.length;
        
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        
        if (change > 10) return 'increasing';
        if (change < -10) return 'decreasing';
        return 'stable';
    }
    
    aggregateByTime(data, granularity, metricType) {
        const aggregated = [];
        const buckets = new Map();
        
        for (const point of data) {
            const bucket = this.getBucket(point.timestamp, granularity);
            if (!buckets.has(bucket)) {
                buckets.set(bucket, []);
            }
            buckets.get(bucket).push(point.value);
        }
        
        for (const [timestamp, values] of buckets) {
            let value;
            if (this.aggregationRules.sum.includes(metricType)) {
                value = values.reduce((sum, v) => sum + v, 0);
            } else {
                value = values.reduce((sum, v) => sum + v, 0) / values.length;
            }
            
            aggregated.push({ timestamp, value });
        }
        
        return aggregated.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    getBucket(timestamp, granularity) {
        const date = new Date(timestamp);
        
        switch (granularity) {
            case 'hourly':
                date.setMinutes(0, 0, 0);
                break;
            case 'daily':
                date.setHours(0, 0, 0, 0);
                break;
            case 'weekly':
                date.setDate(date.getDate() - date.getDay());
                date.setHours(0, 0, 0, 0);
                break;
            case 'monthly':
                date.setDate(1);
                date.setHours(0, 0, 0, 0);
                break;
        }
        
        return date.getTime();
    }
    
    evaluateCondition(value, condition) {
        switch (condition.operator) {
            case '>': return value > condition.value;
            case '<': return value < condition.value;
            case '>=': return value >= condition.value;
            case '<=': return value <= condition.value;
            case '=': return value === condition.value;
            case '!=': return value !== condition.value;
            default: return false;
        }
    }
    
    // Start metric collection
    startMetricCollection() {
        // Simulate metric collection every 10 seconds
        setInterval(() => {
            this.collectMetrics();
        }, 10000);
    }
    
    collectMetrics() {
        // Simulate collecting metrics from various sources
        const partners = ['partner-001', 'partner-002', 'partner-003'];
        
        for (const partnerId of partners) {
            // API metrics
            this.recordMetric(partnerId, 'api_calls', Math.floor(Math.random() * 100) + 50);
            this.recordMetric(partnerId, 'api_latency', Math.floor(Math.random() * 200) + 50);
            
            // Business metrics
            if (Math.random() > 0.7) {
                this.recordMetric(partnerId, 'containers_tracked', Math.floor(Math.random() * 10) + 1);
            }
            if (Math.random() > 0.8) {
                this.recordMetric(partnerId, 'revenue_generated', Math.random() * 100 + 10);
            }
        }
    }
    
    // Start aggregation jobs
    startAggregationJobs() {
        // Hourly aggregation
        setInterval(() => {
            this.aggregateMetrics('hourly');
        }, 60 * 60 * 1000);
        
        // Daily aggregation
        setInterval(() => {
            this.aggregateMetrics('daily');
        }, 24 * 60 * 60 * 1000);
    }
    
    async aggregateMetrics(granularity) {
        // Aggregate real-time metrics into hourly/daily/monthly
        console.log(`Running ${granularity} aggregation`);
    }
    
    // Initialize report templates
    initializeReportTemplates() {
        return {
            monthly_performance: {
                name: 'Monthly Performance Report',
                defaultPeriod: '30d',
                sections: [
                    {
                        title: 'Executive Summary',
                        type: 'metrics_summary',
                        metrics: ['revenue_generated', 'api_calls', 'active_customers']
                    },
                    {
                        title: 'Performance Trends',
                        type: 'performance_trends',
                        metrics: ['api_calls', 'api_latency', 'error_rate']
                    },
                    {
                        title: 'Revenue Analysis',
                        type: 'revenue_breakdown'
                    },
                    {
                        title: 'Customer Analysis',
                        type: 'top_customers'
                    },
                    {
                        title: 'API Usage',
                        type: 'api_usage'
                    }
                ]
            },
            quarterly_business_review: {
                name: 'Quarterly Business Review',
                defaultPeriod: '90d',
                sections: [
                    {
                        title: 'Business Overview',
                        type: 'metrics_summary',
                        metrics: ['revenue_generated', 'active_customers', 'new_installations']
                    },
                    {
                        title: 'Growth Analysis',
                        type: 'performance_trends',
                        metrics: ['revenue_generated', 'active_customers', 'transaction_volume']
                    },
                    {
                        title: 'Revenue Deep Dive',
                        type: 'revenue_breakdown'
                    },
                    {
                        title: 'Customer Success',
                        type: 'top_customers'
                    }
                ]
            }
        };
    }
    
    calculatePrevious(data, metricType, periodMs) {
        const midPoint = new Date(Date.now() - periodMs / 2);
        const previousData = data.filter(d => d.timestamp < midPoint);
        return this.calculateCurrent(previousData, metricType);
    }
    
    calculateChange(data, metricType, periodMs) {
        const current = this.calculateCurrent(data, metricType);
        const previous = this.calculatePrevious(data, metricType, periodMs);
        
        if (previous === 0) return 0;
        return ((current - previous) / previous) * 100;
    }
    
    validateWidget(widget) {
        const requiredFields = ['type', 'metric', 'title'];
        for (const field of requiredFields) {
            if (!widget[field]) {
                throw new Error(`Widget missing required field: ${field}`);
            }
        }
    }
    
    startDashboardUpdates(dashboard) {
        // In production, this would use WebSockets for real-time updates
        console.log(`Started real-time updates for dashboard: ${dashboard.name}`);
    }
    
    async sendAlertNotifications(alert, data) {
        // In production, this would send actual notifications
        console.log(`Alert triggered: ${alert.name}`, data);
    }
    
    async generateExecutiveSummary(report) {
        // Generate a summary based on report data
        return {
            highlights: [
                'Revenue increased by 15% month-over-month',
                'API response time improved by 20%',
                'Added 23 new customers this period'
            ],
            concerns: [
                'Error rate slightly above target at 0.23%',
                'Customer churn increased in APAC region'
            ],
            recommendations: [
                'Focus on improving API reliability',
                'Expand customer success efforts in APAC'
            ]
        };
    }
    
    getBenchmarkData(competitorGroup) {
        // Mock benchmark data
        return {
            api_calls: { average: 50000, p25: 25000, p75: 75000, p90: 100000 },
            api_latency: { average: 150, p25: 100, p75: 200, p90: 300 },
            error_rate: { average: 0.5, p25: 0.2, p75: 1.0, p90: 2.0 },
            revenue_generated: { average: 50000, p25: 25000, p75: 75000, p90: 100000 },
            active_customers: { average: 100, p25: 50, p75: 150, p90: 200 }
        };
    }
    
    calculatePercentile(value, benchmark) {
        if (value <= benchmark.p25) return 25;
        if (value <= benchmark.average) return 50;
        if (value <= benchmark.p75) return 75;
        if (value <= benchmark.p90) return 90;
        return 95;
    }
    
    getRating(value, benchmark) {
        const percentile = this.calculatePercentile(value, benchmark);
        if (percentile >= 90) return 'excellent';
        if (percentile >= 75) return 'good';
        if (percentile >= 50) return 'average';
        if (percentile >= 25) return 'below_average';
        return 'poor';
    }
    
    calculateOverallScore(comparison) {
        const scores = Object.values(comparison).map(c => {
            switch (c.rating) {
                case 'excellent': return 5;
                case 'good': return 4;
                case 'average': return 3;
                case 'below_average': return 2;
                case 'poor': return 1;
                default: return 3;
            }
        });
        
        return scores.reduce((sum, s) => sum + s, 0) / scores.length;
    }
    
    generateBenchmarkRecommendations(comparison) {
        const recommendations = [];
        
        for (const [metric, data] of Object.entries(comparison)) {
            if (data.rating === 'below_average' || data.rating === 'poor') {
                recommendations.push({
                    metric,
                    current: data.partner,
                    benchmark: data.benchmark,
                    action: `Improve ${metric} to meet industry standards`
                });
            }
        }
        
        return recommendations;
    }
}

module.exports = AnalyticsPlatform;