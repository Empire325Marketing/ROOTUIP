/**
 * ROOTUIP Stakeholder-Specific Monitoring Dashboards
 * Custom dashboards for different user roles and responsibilities
 */

const EventEmitter = require('events');
const crypto = require('crypto');

// Dashboard Manager
class DashboardManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            refreshInterval: config.refreshInterval || 30000, // 30 seconds
            dataRetentionDays: config.dataRetentionDays || 30,
            enableRealTime: config.enableRealTime !== false,
            ...config
        };
        
        this.dashboards = new Map();
        this.userRoles = new Map();
        this.dashboardData = new Map();
        this.alerts = new Map();
        this.widgets = new Map();
        
        this.setupUserRoles();
        this.setupDashboards();
        this.setupWidgets();
        this.startDataCollection();
    }
    
    // Setup user roles and permissions
    setupUserRoles() {
        // Executive/C-Level Role
        this.userRoles.set('executive', {
            id: 'executive',
            name: 'Executive Leadership',
            description: 'C-level executives and senior management',
            permissions: ['view_all_dashboards', 'view_business_metrics', 'view_financial_data'],
            focusAreas: ['business_impact', 'financial_performance', 'strategic_metrics'],
            updateFrequency: '1hour'
        });
        
        // Operations Manager Role
        this.userRoles.set('operations_manager', {
            id: 'operations_manager',
            name: 'Operations Manager',
            description: 'Operations and infrastructure management',
            permissions: ['view_operational_dashboards', 'manage_incidents', 'configure_alerts'],
            focusAreas: ['system_health', 'performance_metrics', 'capacity_planning'],
            updateFrequency: '5minutes'
        });
        
        // DevOps Engineer Role
        this.userRoles.set('devops_engineer', {
            id: 'devops_engineer',
            name: 'DevOps Engineer',
            description: 'Development and operations engineering teams',
            permissions: ['view_technical_dashboards', 'manage_deployments', 'debug_issues'],
            focusAreas: ['infrastructure_metrics', 'deployment_status', 'error_tracking'],
            updateFrequency: '1minute'
        });
        
        // Customer Success Manager Role
        this.userRoles.set('customer_success', {
            id: 'customer_success',
            name: 'Customer Success Manager',
            description: 'Customer success and support teams',
            permissions: ['view_customer_dashboards', 'manage_support_cases', 'view_usage_analytics'],
            focusAreas: ['customer_health', 'support_metrics', 'feature_adoption'],
            updateFrequency: '15minutes'
        });
        
        // Product Manager Role
        this.userRoles.set('product_manager', {
            id: 'product_manager',
            name: 'Product Manager',
            description: 'Product management and strategy teams',
            permissions: ['view_product_dashboards', 'view_user_analytics', 'manage_features'],
            focusAreas: ['feature_usage', 'user_engagement', 'product_performance'],
            updateFrequency: '1hour'
        });
        
        // Security Team Role
        this.userRoles.set('security_team', {
            id: 'security_team',
            name: 'Security Team',
            description: 'Information security and compliance teams',
            permissions: ['view_security_dashboards', 'manage_security_incidents', 'audit_access'],
            focusAreas: ['security_metrics', 'compliance_status', 'threat_detection'],
            updateFrequency: '5minutes'
        });
    }
    
    // Setup role-specific dashboards
    setupDashboards() {
        // Executive Dashboard
        this.dashboards.set('executive_overview', {
            id: 'executive_overview',
            name: 'Executive Overview Dashboard',
            description: 'High-level business metrics and KPIs for executive leadership',
            role: 'executive',
            layout: 'executive',
            widgets: [
                'business_kpis', 'revenue_metrics', 'customer_growth', 'system_availability_summary',
                'cost_optimization', 'strategic_initiatives', 'risk_indicators', 'competitive_position'
            ],
            refreshRate: 3600000, // 1 hour
            alertLevel: 'critical_only'
        });
        
        // Operations Dashboard
        this.dashboards.set('operations_center', {
            id: 'operations_center',
            name: 'Operations Center Dashboard',
            description: 'Real-time operational metrics and system health monitoring',
            role: 'operations_manager',
            layout: 'operations',
            widgets: [
                'system_health_overview', 'service_status_grid', 'performance_metrics',
                'capacity_utilization', 'incident_management', 'sla_compliance', 'alert_center'
            ],
            refreshRate: 300000, // 5 minutes
            alertLevel: 'all'
        });
        
        // DevOps Engineering Dashboard
        this.dashboards.set('devops_engineering', {
            id: 'devops_engineering',
            name: 'DevOps Engineering Dashboard',
            description: 'Technical metrics for development and operations teams',
            role: 'devops_engineer',
            layout: 'technical',
            widgets: [
                'infrastructure_metrics', 'deployment_pipeline', 'error_rates', 'performance_graphs',
                'log_analysis', 'resource_monitoring', 'dependency_health', 'automated_remediation_status'
            ],
            refreshRate: 60000, // 1 minute
            alertLevel: 'medium_and_above'
        });
        
        // Customer Success Dashboard
        this.dashboards.set('customer_success', {
            id: 'customer_success',
            name: 'Customer Success Dashboard',
            description: 'Customer health and support metrics',
            role: 'customer_success',
            layout: 'customer_focused',
            widgets: [
                'customer_health_score', 'support_ticket_metrics', 'feature_adoption',
                'user_engagement', 'churn_predictions', 'satisfaction_scores', 'usage_trends'
            ],
            refreshRate: 900000, // 15 minutes
            alertLevel: 'customer_impact'
        });
        
        // Product Management Dashboard
        this.dashboards.set('product_management', {
            id: 'product_management',
            name: 'Product Management Dashboard',
            description: 'Product performance and user analytics',
            role: 'product_manager',
            layout: 'product_focused',
            widgets: [
                'feature_usage_analytics', 'user_journey_metrics', 'conversion_funnels',
                'product_performance', 'feedback_analysis', 'roadmap_progress', 'competitive_metrics'
            ],
            refreshRate: 3600000, // 1 hour
            alertLevel: 'product_issues'
        });
        
        // Security Dashboard
        this.dashboards.set('security_operations', {
            id: 'security_operations',
            name: 'Security Operations Dashboard',
            description: 'Security metrics and threat monitoring',
            role: 'security_team',
            layout: 'security_focused',
            widgets: [
                'security_metrics', 'threat_detection', 'compliance_status', 'access_monitoring',
                'vulnerability_management', 'incident_response', 'audit_logs'
            ],
            refreshRate: 300000, // 5 minutes
            alertLevel: 'security_events'
        });
        
        // Real-time NOC Dashboard
        this.dashboards.set('noc_realtime', {
            id: 'noc_realtime',
            name: 'Network Operations Center',
            description: 'Real-time system monitoring for NOC teams',
            role: 'operations_manager',
            layout: 'noc_wall',
            widgets: [
                'world_map_status', 'service_topology', 'real_time_metrics', 'alert_stream',
                'capacity_heatmap', 'performance_timeline', 'critical_paths'
            ],
            refreshRate: 10000, // 10 seconds
            alertLevel: 'all',
            displayMode: 'large_screen'
        });
    }
    
    // Setup individual dashboard widgets
    setupWidgets() {
        // Business KPIs Widget
        this.widgets.set('business_kpis', {
            id: 'business_kpis',
            name: 'Business KPIs',
            type: 'metric_cards',
            description: 'Key business performance indicators',
            dataSource: 'business_metrics',
            config: {
                metrics: [
                    { name: 'Monthly Recurring Revenue', key: 'mrr', format: 'currency', target: 150000 },
                    { name: 'Customer Acquisition Cost', key: 'cac', format: 'currency', target: 250 },
                    { name: 'Customer Lifetime Value', key: 'clv', format: 'currency', target: 2500 },
                    { name: 'Churn Rate', key: 'churn_rate', format: 'percentage', target: 3.0 }
                ],
                layout: '2x2_grid'
            }
        });
        
        // System Health Overview Widget
        this.widgets.set('system_health_overview', {
            id: 'system_health_overview',
            name: 'System Health Overview',
            type: 'status_grid',
            description: 'Overall system health status',
            dataSource: 'system_health',
            config: {
                services: [
                    'api-gateway', 'auth-service', 'container-service', 'location-service',
                    'notification-service', 'billing-service', 'analytics-service'
                ],
                healthLevels: ['healthy', 'warning', 'critical', 'unknown'],
                autoRefresh: true
            }
        });
        
        // Performance Metrics Widget
        this.widgets.set('performance_metrics', {
            id: 'performance_metrics',
            name: 'Performance Metrics',
            type: 'time_series_charts',
            description: 'Real-time performance monitoring',
            dataSource: 'performance_data',
            config: {
                charts: [
                    { metric: 'response_time', title: 'Response Time (ms)', color: '#3498db' },
                    { metric: 'throughput', title: 'Requests per Second', color: '#2ecc71' },
                    { metric: 'error_rate', title: 'Error Rate (%)', color: '#e74c3c' }
                ],
                timeRange: '1hour',
                refreshInterval: 30000
            }
        });
        
        // Customer Health Score Widget
        this.widgets.set('customer_health_score', {
            id: 'customer_health_score',
            name: 'Customer Health Score',
            type: 'gauge_chart',
            description: 'Overall customer health indicator',
            dataSource: 'customer_metrics',
            config: {
                metric: 'health_score',
                scale: { min: 0, max: 100 },
                thresholds: { critical: 40, warning: 70, healthy: 85 },
                aggregation: 'average'
            }
        });
        
        // Infrastructure Metrics Widget
        this.widgets.set('infrastructure_metrics', {
            id: 'infrastructure_metrics',
            name: 'Infrastructure Metrics',
            type: 'resource_charts',
            description: 'Infrastructure resource utilization',
            dataSource: 'infrastructure_data',
            config: {
                resources: ['cpu_usage', 'memory_usage', 'disk_usage', 'network_io'],
                regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
                alertThresholds: { cpu: 80, memory: 85, disk: 90 }
            }
        });
        
        // Security Metrics Widget
        this.widgets.set('security_metrics', {
            id: 'security_metrics',
            name: 'Security Metrics',
            type: 'security_dashboard',
            description: 'Security monitoring and threat detection',
            dataSource: 'security_data',
            config: {
                metrics: [
                    'failed_logins', 'suspicious_activity', 'vulnerability_scan_results',
                    'compliance_score', 'incident_count'
                ],
                threatLevels: ['low', 'medium', 'high', 'critical']
            }
        });
        
        // Alert Center Widget
        this.widgets.set('alert_center', {
            id: 'alert_center',
            name: 'Alert Center',
            type: 'alert_list',
            description: 'Real-time alert monitoring',
            dataSource: 'alert_stream',
            config: {
                maxAlerts: 20,
                severityFilter: ['medium', 'high', 'critical'],
                autoAcknowledge: false,
                groupBy: 'service'
            }
        });
        
        // World Map Status Widget
        this.widgets.set('world_map_status', {
            id: 'world_map_status',
            name: 'Global Status Map',
            type: 'world_map',
            description: 'Global infrastructure status visualization',
            dataSource: 'global_status',
            config: {
                regions: [
                    { id: 'us-east-1', lat: 39.0458, lng: -77.5091, name: 'US East' },
                    { id: 'eu-west-1', lat: 53.3498, lng: -6.2603, name: 'EU West' },
                    { id: 'ap-southeast-1', lat: 1.3521, lng: 103.8198, name: 'Singapore' }
                ],
                statusIndicators: true,
                trafficFlow: true
            }
        });
    }
    
    // Start data collection for all dashboards
    startDataCollection() {
        // Collect data at different intervals based on dashboard requirements
        setInterval(async () => {
            await this.collectRealTimeData();
        }, 10000); // Every 10 seconds for real-time dashboards
        
        setInterval(async () => {
            await this.collectOperationalData();
        }, 60000); // Every minute for operational dashboards
        
        setInterval(async () => {
            await this.collectBusinessData();
        }, 3600000); // Every hour for business dashboards
        
        // Update dashboard data
        setInterval(async () => {
            await this.updateDashboardData();
        }, this.config.refreshInterval);
    }
    
    // Collect real-time system data
    async collectRealTimeData() {
        const timestamp = new Date();
        
        // System health data
        const systemHealth = {
            timestamp,
            services: await this.getServiceHealthData(),
            infrastructure: await this.getInfrastructureData(),
            performance: await this.getPerformanceData()
        };
        
        this.storeDashboardData('system_health', systemHealth);
        
        // Performance data
        const performanceData = {
            timestamp,
            metrics: await this.getPerformanceMetrics(),
            trends: await this.getPerformanceTrends()
        };
        
        this.storeDashboardData('performance_data', performanceData);
        
        // Alert data
        const alertData = {
            timestamp,
            alerts: await this.getActiveAlerts(),
            summary: await this.getAlertSummary()
        };
        
        this.storeDashboardData('alert_stream', alertData);
    }
    
    // Collect operational data
    async collectOperationalData() {
        const timestamp = new Date();
        
        // Infrastructure data
        const infrastructureData = {
            timestamp,
            resources: await this.getResourceUtilization(),
            capacity: await this.getCapacityMetrics(),
            deployment: await this.getDeploymentStatus()
        };
        
        this.storeDashboardData('infrastructure_data', infrastructureData);
        
        // Security data
        const securityData = {
            timestamp,
            threats: await this.getThreatData(),
            compliance: await this.getComplianceStatus(),
            incidents: await this.getSecurityIncidents()
        };
        
        this.storeDashboardData('security_data', securityData);
    }
    
    // Collect business data
    async collectBusinessData() {
        const timestamp = new Date();
        
        // Business metrics
        const businessMetrics = {
            timestamp,
            revenue: await this.getRevenueMetrics(),
            customers: await this.getCustomerMetrics(),
            growth: await this.getGrowthMetrics()
        };
        
        this.storeDashboardData('business_metrics', businessMetrics);
        
        // Customer metrics
        const customerMetrics = {
            timestamp,
            health: await this.getCustomerHealthData(),
            satisfaction: await this.getSatisfactionMetrics(),
            usage: await this.getUsageAnalytics()
        };
        
        this.storeDashboardData('customer_metrics', customerMetrics);
    }
    
    // Generate dashboard data for specific role
    async generateDashboardData(dashboardId, userId) {
        const dashboard = this.dashboards.get(dashboardId);
        if (!dashboard) {
            throw new Error(`Dashboard ${dashboardId} not found`);
        }
        
        // Check user permissions
        const userRole = await this.getUserRole(userId);
        if (!this.hasPermission(userRole, dashboard.role)) {
            throw new Error(`User does not have permission to view ${dashboardId}`);
        }
        
        const dashboardData = {
            id: dashboardId,
            name: dashboard.name,
            description: dashboard.description,
            lastUpdated: new Date(),
            widgets: {}
        };
        
        // Generate data for each widget
        for (const widgetId of dashboard.widgets) {
            const widget = this.widgets.get(widgetId);
            if (widget) {
                dashboardData.widgets[widgetId] = await this.generateWidgetData(widget, userRole);
            }
        }
        
        return dashboardData;
    }
    
    // Generate data for specific widget
    async generateWidgetData(widget, userRole) {
        const widgetData = {
            id: widget.id,
            name: widget.name,
            type: widget.type,
            lastUpdated: new Date(),
            config: widget.config,
            data: null
        };
        
        // Get data based on widget type and data source
        const sourceData = this.getDashboardData(widget.dataSource);
        
        switch (widget.type) {
            case 'metric_cards':
                widgetData.data = this.generateMetricCardsData(widget.config, sourceData);
                break;
            case 'status_grid':
                widgetData.data = this.generateStatusGridData(widget.config, sourceData);
                break;
            case 'time_series_charts':
                widgetData.data = this.generateTimeSeriesData(widget.config, sourceData);
                break;
            case 'gauge_chart':
                widgetData.data = this.generateGaugeData(widget.config, sourceData);
                break;
            case 'alert_list':
                widgetData.data = this.generateAlertListData(widget.config, sourceData);
                break;
            case 'world_map':
                widgetData.data = this.generateWorldMapData(widget.config, sourceData);
                break;
            default:
                widgetData.data = sourceData;
        }
        
        return widgetData;
    }
    
    // Data generation methods for different widget types
    generateMetricCardsData(config, sourceData) {
        const cards = [];
        
        for (const metric of config.metrics) {
            const value = this.extractMetricValue(sourceData, metric.key);
            const change = this.calculateChange(sourceData, metric.key);
            
            cards.push({
                name: metric.name,
                value: this.formatValue(value, metric.format),
                change: change,
                trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
                status: this.getMetricStatus(value, metric.target),
                target: metric.target
            });
        }
        
        return { cards };
    }
    
    generateStatusGridData(config, sourceData) {
        const services = [];
        
        for (const serviceId of config.services) {
            const serviceData = this.getServiceData(sourceData, serviceId);
            services.push({
                id: serviceId,
                name: serviceId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                status: serviceData ? serviceData.status : 'unknown',
                lastCheck: serviceData ? serviceData.lastCheck : new Date(),
                metrics: serviceData ? serviceData.metrics : {}
            });
        }
        
        return { services };
    }
    
    generateTimeSeriesData(config, sourceData) {
        const charts = [];
        
        for (const chartConfig of config.charts) {
            const timeSeriesData = this.extractTimeSeriesData(sourceData, chartConfig.metric);
            charts.push({
                title: chartConfig.title,
                metric: chartConfig.metric,
                color: chartConfig.color,
                data: timeSeriesData,
                latest: timeSeriesData.length > 0 ? timeSeriesData[timeSeriesData.length - 1].value : 0
            });
        }
        
        return { charts, timeRange: config.timeRange };
    }
    
    generateGaugeData(config, sourceData) {
        const value = this.extractMetricValue(sourceData, config.metric);
        const percentage = (value / config.scale.max) * 100;
        
        let status = 'healthy';
        if (percentage >= config.thresholds.critical) {
            status = 'critical';
        } else if (percentage >= config.thresholds.warning) {
            status = 'warning';
        }
        
        return {
            value: value,
            percentage: Math.round(percentage),
            status: status,
            scale: config.scale,
            thresholds: config.thresholds
        };
    }
    
    generateAlertListData(config, sourceData) {
        const alerts = sourceData && sourceData.alerts ? sourceData.alerts : [];
        
        return {
            alerts: alerts
                .filter(alert => config.severityFilter.includes(alert.severity))
                .slice(0, config.maxAlerts)
                .map(alert => ({
                    id: alert.id,
                    title: alert.title || alert.type,
                    severity: alert.severity,
                    service: alert.service,
                    timestamp: alert.timestamp,
                    acknowledged: alert.acknowledged || false
                })),
            summary: {
                total: alerts.length,
                critical: alerts.filter(a => a.severity === 'critical').length,
                high: alerts.filter(a => a.severity === 'high').length,
                medium: alerts.filter(a => a.severity === 'medium').length
            }
        };
    }
    
    generateWorldMapData(config, sourceData) {
        const regions = config.regions.map(region => {
            const regionData = this.getRegionData(sourceData, region.id);
            return {
                ...region,
                status: regionData ? regionData.status : 'unknown',
                health: regionData ? regionData.health : 0,
                activeUsers: regionData ? regionData.activeUsers : 0,
                latency: regionData ? regionData.latency : 0
            };
        });
        
        return { regions };
    }
    
    // Data extraction and utility methods
    async getServiceHealthData() {
        const services = {};
        const serviceNames = [
            'api-gateway', 'auth-service', 'container-service', 'location-service',
            'notification-service', 'billing-service', 'analytics-service'
        ];
        
        for (const service of serviceNames) {
            services[service] = {
                status: Math.random() > 0.05 ? 'healthy' : 'unhealthy',
                lastCheck: new Date(),
                responseTime: Math.random() * 1000 + 100,
                uptime: Math.random() * 0.1 + 0.9 // 90-100%
            };
        }
        
        return services;
    }
    
    async getPerformanceMetrics() {
        return {
            response_time: Math.random() * 1000 + 200,
            throughput: Math.random() * 1000 + 500,
            error_rate: Math.random() * 5,
            cpu_usage: Math.random() * 80 + 10,
            memory_usage: Math.random() * 70 + 20
        };
    }
    
    async getRevenueMetrics() {
        return {
            mrr: 127450 + Math.random() * 10000 - 5000,
            arr: 1529400 + Math.random() * 100000 - 50000,
            cac: 245 + Math.random() * 50 - 25,
            clv: 2580 + Math.random() * 500 - 250,
            churn_rate: 3.2 + Math.random() * 2 - 1
        };
    }
    
    async getCustomerHealthData() {
        return {
            health_score: Math.random() * 40 + 60, // 60-100
            satisfaction_score: Math.random() * 2 + 3, // 3-5
            active_users: Math.floor(Math.random() * 1000) + 500,
            feature_adoption: Math.random() * 0.4 + 0.6 // 60-100%
        };
    }
    
    async getActiveAlerts() {
        const alerts = [];
        const alertTypes = ['performance', 'error_rate', 'capacity', 'security'];
        const severities = ['medium', 'high', 'critical'];
        const services = ['api-gateway', 'container-service', 'billing-service'];
        
        // Generate 3-8 random alerts
        const alertCount = Math.floor(Math.random() * 6) + 3;
        
        for (let i = 0; i < alertCount; i++) {
            alerts.push({
                id: `alert_${Date.now()}_${i}`,
                type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
                severity: severities[Math.floor(Math.random() * severities.length)],
                service: services[Math.floor(Math.random() * services.length)],
                title: `${alertTypes[Math.floor(Math.random() * alertTypes.length)]} issue detected`,
                timestamp: new Date(Date.now() - Math.random() * 3600000), // Last hour
                acknowledged: Math.random() > 0.7
            });
        }
        
        return alerts;
    }
    
    extractMetricValue(sourceData, key) {
        if (!sourceData) return 0;
        
        // Navigate nested object structure
        const keys = key.split('.');
        let value = sourceData;
        
        for (const k of keys) {
            value = value && value[k];
        }
        
        return typeof value === 'number' ? value : 0;
    }
    
    extractTimeSeriesData(sourceData, metric) {
        // Generate mock time series data
        const data = [];
        const now = Date.now();
        
        for (let i = 23; i >= 0; i--) {
            data.push({
                timestamp: new Date(now - i * 60000), // Last 24 minutes
                value: Math.random() * 1000 + 200 + Math.sin(i / 24 * 2 * Math.PI) * 100
            });
        }
        
        return data;
    }
    
    calculateChange(sourceData, key) {
        // Simulate change calculation
        return (Math.random() - 0.5) * 20; // ±10% change
    }
    
    formatValue(value, format) {
        switch (format) {
            case 'currency':
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                }).format(value);
            case 'percentage':
                return `${value.toFixed(1)}%`;
            default:
                return Math.round(value).toLocaleString();
        }
    }
    
    getMetricStatus(value, target) {
        if (!target) return 'neutral';
        
        const ratio = value / target;
        if (ratio >= 0.9) return 'good';
        if (ratio >= 0.7) return 'warning';
        return 'critical';
    }
    
    // Storage and retrieval methods
    storeDashboardData(dataSource, data) {
        const history = this.dashboardData.get(dataSource) || [];
        history.push(data);
        
        // Keep only recent data
        const cutoffTime = new Date(Date.now() - this.config.dataRetentionDays * 24 * 60 * 60 * 1000);
        const filtered = history.filter(item => item.timestamp > cutoffTime);
        
        this.dashboardData.set(dataSource, filtered);
    }
    
    getDashboardData(dataSource) {
        const history = this.dashboardData.get(dataSource) || [];
        return history.length > 0 ? history[history.length - 1] : null;
    }
    
    getServiceData(sourceData, serviceId) {
        return sourceData && sourceData.services ? sourceData.services[serviceId] : null;
    }
    
    getRegionData(sourceData, regionId) {
        // Mock region data
        return {
            status: Math.random() > 0.05 ? 'healthy' : 'degraded',
            health: Math.random() * 40 + 60,
            activeUsers: Math.floor(Math.random() * 10000) + 1000,
            latency: Math.random() * 200 + 50
        };
    }
    
    // User and permission management
    async getUserRole(userId) {
        // Mock user role lookup
        const roles = ['executive', 'operations_manager', 'devops_engineer', 'customer_success'];
        return roles[Math.floor(Math.random() * roles.length)];
    }
    
    hasPermission(userRole, requiredRole) {
        // Simplified permission check
        return userRole === requiredRole || userRole === 'executive';
    }
    
    // Dashboard update and notification
    async updateDashboardData() {
        for (const [dashboardId, dashboard] of this.dashboards) {
            try {
                // Check if dashboard needs update based on refresh rate
                const shouldUpdate = this.shouldUpdateDashboard(dashboard);
                
                if (shouldUpdate) {
                    await this.refreshDashboard(dashboardId);
                }
                
            } catch (error) {
                console.error(`Failed to update dashboard ${dashboardId}:`, error.message);
            }
        }
    }
    
    shouldUpdateDashboard(dashboard) {
        const lastUpdate = dashboard.lastUpdate || new Date(0);
        const timeSinceUpdate = Date.now() - lastUpdate.getTime();
        
        return timeSinceUpdate >= dashboard.refreshRate;
    }
    
    async refreshDashboard(dashboardId) {
        const dashboard = this.dashboards.get(dashboardId);
        dashboard.lastUpdate = new Date();
        
        this.emit('dashboard_updated', {
            dashboardId,
            timestamp: dashboard.lastUpdate
        });
    }
    
    // Dashboard management API methods
    async getDashboardList(userId) {
        const userRole = await this.getUserRole(userId);
        const accessibleDashboards = [];
        
        for (const [id, dashboard] of this.dashboards) {
            if (this.hasPermission(userRole, dashboard.role)) {
                accessibleDashboards.push({
                    id: dashboard.id,
                    name: dashboard.name,
                    description: dashboard.description,
                    role: dashboard.role
                });
            }
        }
        
        return accessibleDashboards;
    }
    
    async createCustomDashboard(userId, config) {
        const dashboardId = this.generateDashboardId();
        const userRole = await this.getUserRole(userId);
        
        const customDashboard = {
            id: dashboardId,
            name: config.name,
            description: config.description,
            role: userRole,
            layout: config.layout || 'custom',
            widgets: config.widgets || [],
            refreshRate: config.refreshRate || 300000,
            alertLevel: config.alertLevel || 'medium_and_above',
            createdBy: userId,
            createdAt: new Date(),
            custom: true
        };
        
        this.dashboards.set(dashboardId, customDashboard);
        
        this.emit('dashboard_created', {
            dashboardId,
            userId,
            config: customDashboard
        });
        
        return customDashboard;
    }
    
    generateDashboardId() {
        return `dashboard_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
}

module.exports = {
    DashboardManager
};