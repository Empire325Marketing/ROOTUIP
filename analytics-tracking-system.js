/**
 * ROOTUIP Analytics Tracking System
 * Google Analytics 4 and Mixpanel integration for comprehensive business intelligence
 */

const { GA4 } = require('ga4-node');
const Mixpanel = require('mixpanel');
const { Pool } = require('pg');
const express = require('express');
const router = express.Router();

class AnalyticsTrackingSystem {
    constructor(config = {}) {
        // Google Analytics 4 setup
        this.ga4 = new GA4({
            measurementId: process.env.GA4_MEASUREMENT_ID || config.ga4MeasurementId,
            apiSecret: process.env.GA4_API_SECRET || config.ga4ApiSecret
        });
        
        // Mixpanel setup
        this.mixpanel = Mixpanel.init(
            process.env.MIXPANEL_TOKEN || config.mixpanelToken,
            {
                protocol: 'https',
                keepAlive: false
            }
        );
        
        // Database connection
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost/rootuip_analytics',
            max: 10
        });
        
        // Event definitions
        this.events = {
            // Conversion funnel events
            PAGE_VIEW: 'page_view',
            ROI_CALCULATOR_START: 'roi_calculator_start',
            ROI_CALCULATOR_COMPLETE: 'roi_calculator_complete',
            LEAD_CAPTURE: 'lead_capture',
            DEMO_REQUEST: 'demo_request',
            DEMO_SCHEDULED: 'demo_scheduled',
            DEMO_ATTENDED: 'demo_attended',
            TRIAL_START: 'trial_start',
            TRIAL_ACTIVATED: 'trial_activated',
            PURCHASE: 'purchase',
            
            // Platform usage events
            LOGIN: 'login',
            CONTAINER_TRACKED: 'container_tracked',
            CHARGE_PREVENTED: 'charge_prevented',
            ALERT_CREATED: 'alert_created',
            REPORT_GENERATED: 'report_generated',
            API_CALL: 'api_call',
            
            // Feature engagement
            FEATURE_USED: 'feature_used',
            DASHBOARD_VIEW: 'dashboard_view',
            SETTING_CHANGED: 'setting_changed',
            INTEGRATION_CONNECTED: 'integration_connected',
            
            // Customer success events
            USER_ACTIVATED: 'user_activated',
            MILESTONE_REACHED: 'milestone_reached',
            SUPPORT_TICKET: 'support_ticket',
            NPS_SUBMITTED: 'nps_submitted'
        };
        
        // Initialize tracking
        this.initializeTracking();
    }

    initializeTracking() {
        // Set up user identification
        this.userProfiles = new Map();
        
        // Start aggregation job
        this.startAggregationJob();
        
        console.log('Analytics tracking system initialized');
    }

    // Core tracking methods
    async track(eventName, properties = {}, userId = null, sessionId = null) {
        try {
            // Enrich properties
            const enrichedProperties = this.enrichProperties(properties);
            
            // Track in GA4
            await this.trackGA4(eventName, enrichedProperties, userId, sessionId);
            
            // Track in Mixpanel
            await this.trackMixpanel(eventName, enrichedProperties, userId);
            
            // Store in database
            await this.storeEvent(eventName, enrichedProperties, userId, sessionId);
            
            // Real-time processing
            await this.processRealTimeEvent(eventName, enrichedProperties, userId);
            
        } catch (error) {
            console.error('Analytics tracking error:', error);
        }
    }

    async trackGA4(eventName, properties, userId, sessionId) {
        try {
            const ga4Event = {
                name: eventName,
                params: {
                    ...properties,
                    session_id: sessionId,
                    engagement_time_msec: properties.engagement_time || 100
                }
            };
            
            if (userId) {
                ga4Event.userId = userId;
            }
            
            await this.ga4.send([ga4Event]);
            
        } catch (error) {
            console.error('GA4 tracking error:', error);
        }
    }

    async trackMixpanel(eventName, properties, userId) {
        try {
            const trackData = {
                distinct_id: userId || properties.anonymous_id || 'anonymous',
                ...properties
            };
            
            this.mixpanel.track(eventName, trackData);
            
            // Update user profile if needed
            if (userId && this.shouldUpdateProfile(eventName)) {
                await this.updateMixpanelProfile(userId, properties);
            }
            
        } catch (error) {
            console.error('Mixpanel tracking error:', error);
        }
    }

    async updateMixpanelProfile(userId, properties) {
        const profileUpdates = {};
        
        // Set user properties
        if (properties.company) profileUpdates.$company = properties.company;
        if (properties.fleet_size) profileUpdates.$fleet_size = properties.fleet_size;
        if (properties.calculated_savings) profileUpdates.$ltv = properties.calculated_savings;
        
        // Increment counters
        if (properties.containers_tracked) {
            profileUpdates.$add = { total_containers_tracked: properties.containers_tracked };
        }
        
        this.mixpanel.people.set(userId, profileUpdates);
    }

    enrichProperties(properties) {
        return {
            ...properties,
            timestamp: new Date().toISOString(),
            platform: properties.platform || 'web',
            environment: process.env.NODE_ENV || 'development',
            version: process.env.APP_VERSION || '1.0.0'
        };
    }

    shouldUpdateProfile(eventName) {
        const profileEvents = [
            this.events.LEAD_CAPTURE,
            this.events.TRIAL_START,
            this.events.PURCHASE,
            this.events.MILESTONE_REACHED
        ];
        
        return profileEvents.includes(eventName);
    }

    // Conversion funnel tracking
    async trackConversionFunnel(stage, properties = {}, userId = null) {
        const funnelStages = {
            visitor: { event: this.events.PAGE_VIEW, value: 0 },
            lead: { event: this.events.LEAD_CAPTURE, value: 1 },
            qualified: { event: this.events.ROI_CALCULATOR_COMPLETE, value: 2 },
            demo: { event: this.events.DEMO_ATTENDED, value: 3 },
            trial: { event: this.events.TRIAL_ACTIVATED, value: 4 },
            customer: { event: this.events.PURCHASE, value: 5 }
        };
        
        const stageData = funnelStages[stage];
        if (!stageData) return;
        
        await this.track(stageData.event, {
            ...properties,
            funnel_stage: stage,
            funnel_value: stageData.value
        }, userId);
        
        // Update funnel metrics
        await this.updateFunnelMetrics(stage, userId);
    }

    async updateFunnelMetrics(stage, userId) {
        await this.db.query(`
            INSERT INTO funnel_metrics (user_id, stage, reached_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (user_id, stage) DO UPDATE
            SET reached_at = NOW()
        `, [userId, stage]);
        
        // Calculate conversion rates
        await this.calculateConversionRates();
    }

    async calculateConversionRates() {
        const rates = await this.db.query(`
            WITH stage_counts AS (
                SELECT 
                    stage,
                    COUNT(DISTINCT user_id) as count
                FROM funnel_metrics
                WHERE reached_at > NOW() - INTERVAL '30 days'
                GROUP BY stage
            )
            SELECT 
                stage,
                count,
                LAG(count) OVER (ORDER BY 
                    CASE stage 
                        WHEN 'visitor' THEN 1
                        WHEN 'lead' THEN 2
                        WHEN 'qualified' THEN 3
                        WHEN 'demo' THEN 4
                        WHEN 'trial' THEN 5
                        WHEN 'customer' THEN 6
                    END
                ) as previous_count,
                CASE 
                    WHEN LAG(count) OVER (ORDER BY 
                        CASE stage 
                            WHEN 'visitor' THEN 1
                            WHEN 'lead' THEN 2
                            WHEN 'qualified' THEN 3
                            WHEN 'demo' THEN 4
                            WHEN 'trial' THEN 5
                            WHEN 'customer' THEN 6
                        END
                    ) > 0 
                    THEN (count::float / LAG(count) OVER (ORDER BY 
                        CASE stage 
                            WHEN 'visitor' THEN 1
                            WHEN 'lead' THEN 2
                            WHEN 'qualified' THEN 3
                            WHEN 'demo' THEN 4
                            WHEN 'trial' THEN 5
                            WHEN 'customer' THEN 6
                        END
                    ))::float * 100
                    ELSE 0
                END as conversion_rate
            FROM stage_counts
        `);
        
        // Store conversion rates
        for (const rate of rates.rows) {
            await this.db.query(`
                INSERT INTO conversion_rates (stage, rate, calculated_at)
                VALUES ($1, $2, NOW())
            `, [rate.stage, rate.conversion_rate]);
        }
        
        return rates.rows;
    }

    // Platform usage analytics
    async trackPlatformUsage(action, details = {}, userId) {
        const usageEvent = {
            action,
            ...details,
            user_id: userId,
            session_duration: details.session_duration || 0,
            features_used: details.features_used || [],
            api_calls: details.api_calls || 0
        };
        
        await this.track(this.events.FEATURE_USED, usageEvent, userId);
        
        // Update user engagement score
        await this.updateEngagementScore(userId, action, details);
    }

    async updateEngagementScore(userId, action, details) {
        const scoreWeights = {
            login: 1,
            container_tracked: 5,
            charge_prevented: 10,
            alert_created: 3,
            report_generated: 4,
            api_call: 2,
            dashboard_view: 1
        };
        
        const score = scoreWeights[action] || 1;
        
        await this.db.query(`
            INSERT INTO user_engagement (user_id, date, score, actions)
            VALUES ($1, CURRENT_DATE, $2, 1)
            ON CONFLICT (user_id, date) DO UPDATE
            SET score = user_engagement.score + $2,
                actions = user_engagement.actions + 1
        `, [userId, score]);
    }

    // Customer success metrics
    async trackCustomerHealth(userId, metrics) {
        const healthScore = this.calculateHealthScore(metrics);
        
        await this.db.query(`
            INSERT INTO customer_health (
                user_id, health_score, login_frequency, feature_adoption,
                support_tickets, nps_score, charges_prevented, roi_achieved,
                calculated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `, [
            userId,
            healthScore,
            metrics.login_frequency,
            metrics.feature_adoption,
            metrics.support_tickets,
            metrics.nps_score,
            metrics.charges_prevented,
            metrics.roi_achieved
        ]);
        
        // Trigger alerts if health score is low
        if (healthScore < 50) {
            await this.triggerHealthAlert(userId, healthScore, metrics);
        }
        
        return healthScore;
    }

    calculateHealthScore(metrics) {
        // Weighted scoring model
        const weights = {
            login_frequency: 0.2,
            feature_adoption: 0.25,
            support_tickets: -0.15,
            nps_score: 0.2,
            charges_prevented: 0.2,
            roi_achieved: 0.3
        };
        
        let score = 0;
        
        // Login frequency (daily = 100, weekly = 70, monthly = 40)
        if (metrics.login_frequency >= 5) score += weights.login_frequency * 100;
        else if (metrics.login_frequency >= 1) score += weights.login_frequency * 70;
        else score += weights.login_frequency * 40;
        
        // Feature adoption (percentage of features used)
        score += weights.feature_adoption * metrics.feature_adoption;
        
        // Support tickets (inverse - more tickets = lower score)
        score += weights.support_tickets * Math.max(0, 100 - (metrics.support_tickets * 20));
        
        // NPS score (0-10 scale, normalized to 0-100)
        score += weights.nps_score * (metrics.nps_score * 10);
        
        // Business metrics
        score += weights.charges_prevented * Math.min(100, metrics.charges_prevented / 10);
        score += weights.roi_achieved * Math.min(100, (metrics.roi_achieved / metrics.roi_target) * 100);
        
        return Math.max(0, Math.min(100, score));
    }

    async triggerHealthAlert(userId, score, metrics) {
        await this.db.query(`
            INSERT INTO health_alerts (
                user_id, score, alert_type, metrics, created_at
            ) VALUES ($1, $2, $3, $4, NOW())
        `, [
            userId,
            score,
            score < 30 ? 'critical' : 'warning',
            JSON.stringify(metrics)
        ]);
        
        // Notify customer success team
        this.track('customer_health_alert', {
            user_id: userId,
            health_score: score,
            alert_type: score < 30 ? 'critical' : 'warning',
            ...metrics
        });
    }

    // Revenue analytics
    async trackRevenue(type, amount, properties = {}, userId) {
        const revenueEvent = {
            revenue: amount,
            currency: properties.currency || 'USD',
            transaction_id: properties.transaction_id,
            ...properties
        };
        
        // Track in GA4 (Enhanced Ecommerce)
        if (type === 'purchase') {
            await this.track('purchase', {
                ...revenueEvent,
                items: [{
                    item_id: 'rootuip_platform',
                    item_name: 'ROOTUIP Platform Subscription',
                    price: amount,
                    quantity: 1
                }]
            }, userId);
        }
        
        // Track in Mixpanel with revenue
        this.mixpanel.people.track_charge(userId, amount, {
            time: new Date().toISOString(),
            ...properties
        });
        
        // Update revenue metrics
        await this.updateRevenueMetrics(type, amount, userId);
    }

    async updateRevenueMetrics(type, amount, userId) {
        await this.db.query(`
            INSERT INTO revenue_metrics (
                user_id, type, amount, date, properties
            ) VALUES ($1, $2, $3, CURRENT_DATE, $4)
        `, [userId, type, amount, JSON.stringify({})]);
        
        // Calculate MRR/ARR
        if (type === 'subscription') {
            await this.calculateRecurringRevenue();
        }
    }

    async calculateRecurringRevenue() {
        const metrics = await this.db.query(`
            WITH monthly_revenue AS (
                SELECT 
                    DATE_TRUNC('month', date) as month,
                    SUM(amount) as mrr
                FROM revenue_metrics
                WHERE type = 'subscription'
                    AND date > NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', date)
            )
            SELECT 
                month,
                mrr,
                mrr * 12 as arr,
                LAG(mrr) OVER (ORDER BY month) as previous_mrr,
                CASE 
                    WHEN LAG(mrr) OVER (ORDER BY month) > 0
                    THEN ((mrr - LAG(mrr) OVER (ORDER BY month)) / LAG(mrr) OVER (ORDER BY month))::float * 100
                    ELSE 0
                END as growth_rate
            FROM monthly_revenue
            ORDER BY month DESC
        `);
        
        return metrics.rows;
    }

    // Real-time event processing
    async processRealTimeEvent(eventName, properties, userId) {
        // Check for significant events
        if (eventName === this.events.CHARGE_PREVENTED && properties.amount > 10000) {
            // High-value charge prevented
            await this.track('high_value_prevention', {
                ...properties,
                alert_type: 'success'
            }, userId);
        }
        
        if (eventName === this.events.ROI_CALCULATOR_COMPLETE && properties.calculated_savings > 10000000) {
            // High-value lead
            await this.track('high_value_lead', properties, userId);
        }
    }

    // API endpoints
    setupRoutes() {
        // Track event endpoint
        router.post('/track', async (req, res) => {
            const { event, properties, userId, sessionId } = req.body;
            
            await this.track(event, properties, userId, sessionId);
            
            res.json({ success: true });
        });
        
        // Get analytics data
        router.get('/analytics/:type', async (req, res) => {
            const { type } = req.params;
            const { startDate, endDate, userId } = req.query;
            
            let data;
            
            switch (type) {
                case 'funnel':
                    data = await this.getFunnelAnalytics(startDate, endDate);
                    break;
                case 'engagement':
                    data = await this.getEngagementAnalytics(startDate, endDate, userId);
                    break;
                case 'revenue':
                    data = await this.getRevenueAnalytics(startDate, endDate);
                    break;
                case 'health':
                    data = await this.getHealthAnalytics(userId);
                    break;
                default:
                    data = {};
            }
            
            res.json(data);
        });
        
        return router;
    }

    // Analytics queries
    async getFunnelAnalytics(startDate, endDate) {
        const funnel = await this.db.query(`
            SELECT 
                stage,
                COUNT(DISTINCT user_id) as users,
                AVG(EXTRACT(EPOCH FROM (reached_at - created_at))) as avg_time_to_stage
            FROM funnel_metrics
            WHERE reached_at BETWEEN $1 AND $2
            GROUP BY stage
            ORDER BY 
                CASE stage 
                    WHEN 'visitor' THEN 1
                    WHEN 'lead' THEN 2
                    WHEN 'qualified' THEN 3
                    WHEN 'demo' THEN 4
                    WHEN 'trial' THEN 5
                    WHEN 'customer' THEN 6
                END
        `, [startDate, endDate]);
        
        const conversionRates = await this.db.query(`
            SELECT stage, AVG(rate) as avg_rate
            FROM conversion_rates
            WHERE calculated_at BETWEEN $1 AND $2
            GROUP BY stage
        `, [startDate, endDate]);
        
        return {
            funnel: funnel.rows,
            conversionRates: conversionRates.rows
        };
    }

    async getEngagementAnalytics(startDate, endDate, userId = null) {
        let query = `
            SELECT 
                DATE(date) as date,
                AVG(score) as avg_score,
                SUM(actions) as total_actions,
                COUNT(DISTINCT user_id) as active_users
            FROM user_engagement
            WHERE date BETWEEN $1 AND $2
        `;
        
        const params = [startDate, endDate];
        
        if (userId) {
            query += ' AND user_id = $3';
            params.push(userId);
        }
        
        query += ' GROUP BY DATE(date) ORDER BY date';
        
        const engagement = await this.db.query(query, params);
        
        return engagement.rows;
    }

    async getRevenueAnalytics(startDate, endDate) {
        const revenue = await this.db.query(`
            SELECT 
                DATE_TRUNC('month', date) as month,
                type,
                SUM(amount) as total,
                COUNT(DISTINCT user_id) as customers,
                AVG(amount) as avg_transaction
            FROM revenue_metrics
            WHERE date BETWEEN $1 AND $2
            GROUP BY DATE_TRUNC('month', date), type
            ORDER BY month DESC
        `, [startDate, endDate]);
        
        const mrr = await this.calculateRecurringRevenue();
        
        return {
            revenue: revenue.rows,
            mrr: mrr
        };
    }

    async getHealthAnalytics(userId = null) {
        let query = `
            SELECT 
                user_id,
                health_score,
                login_frequency,
                feature_adoption,
                charges_prevented,
                roi_achieved,
                calculated_at
            FROM customer_health
        `;
        
        if (userId) {
            query += ' WHERE user_id = $1';
        }
        
        query += ' ORDER BY calculated_at DESC LIMIT 100';
        
        const health = await this.db.query(query, userId ? [userId] : []);
        
        return health.rows;
    }

    // Store event in database
    async storeEvent(eventName, properties, userId, sessionId) {
        await this.db.query(`
            INSERT INTO analytics_events (
                event_name, properties, user_id, session_id, created_at
            ) VALUES ($1, $2, $3, $4, NOW())
        `, [eventName, JSON.stringify(properties), userId, sessionId]);
    }

    // Aggregation job
    startAggregationJob() {
        // Run every hour
        setInterval(async () => {
            await this.aggregateMetrics();
        }, 60 * 60 * 1000);
    }

    async aggregateMetrics() {
        // Aggregate hourly metrics
        await this.db.query(`
            INSERT INTO analytics_aggregated (period, metrics)
            SELECT 
                DATE_TRUNC('hour', created_at) as period,
                jsonb_build_object(
                    'total_events', COUNT(*),
                    'unique_users', COUNT(DISTINCT user_id),
                    'events_by_type', jsonb_object_agg(event_name, count),
                    'avg_properties', AVG(jsonb_array_length(properties))
                ) as metrics
            FROM analytics_events
            WHERE created_at >= NOW() - INTERVAL '1 hour'
                AND created_at < DATE_TRUNC('hour', NOW())
            GROUP BY DATE_TRUNC('hour', created_at)
            ON CONFLICT (period) DO UPDATE
            SET metrics = EXCLUDED.metrics
        `);
    }
}

// Database schema
const initSchema = `
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    properties JSONB,
    user_id VARCHAR(255),
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS funnel_metrics (
    user_id VARCHAR(255),
    stage VARCHAR(50),
    reached_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, stage)
);

CREATE TABLE IF NOT EXISTS conversion_rates (
    id SERIAL PRIMARY KEY,
    stage VARCHAR(50),
    rate DECIMAL(5,2),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_engagement (
    user_id VARCHAR(255),
    date DATE,
    score INTEGER,
    actions INTEGER,
    PRIMARY KEY (user_id, date)
);

CREATE TABLE IF NOT EXISTS customer_health (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    health_score DECIMAL(5,2),
    login_frequency INTEGER,
    feature_adoption DECIMAL(5,2),
    support_tickets INTEGER,
    nps_score INTEGER,
    charges_prevented INTEGER,
    roi_achieved DECIMAL(12,2),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS health_alerts (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    score DECIMAL(5,2),
    alert_type VARCHAR(50),
    metrics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS revenue_metrics (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    type VARCHAR(50),
    amount DECIMAL(12,2),
    date DATE,
    properties JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_aggregated (
    period TIMESTAMP PRIMARY KEY,
    metrics JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_user ON analytics_events(user_id, created_at);
CREATE INDEX idx_events_name ON analytics_events(event_name, created_at);
CREATE INDEX idx_funnel_user ON funnel_metrics(user_id);
CREATE INDEX idx_engagement_date ON user_engagement(date);
CREATE INDEX idx_health_user ON customer_health(user_id, calculated_at);
CREATE INDEX idx_revenue_date ON revenue_metrics(date, type);
`;

module.exports = { AnalyticsTrackingSystem, initSchema };