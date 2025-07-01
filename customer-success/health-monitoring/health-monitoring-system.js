// ROOTUIP Customer Health Monitoring System
// Tracks usage analytics, adoption metrics, and churn risk scoring

const express = require('express');
const { Pool } = require('pg');
const Redis = require('redis');
const { v4: uuidv4 } = require('uuid');

class CustomerHealthMonitoringSystem {
    constructor() {
        this.app = express();
        this.port = process.env.HEALTH_MONITOR_PORT || 3019;
        
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        this.redis = Redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        
        // Health scoring configuration
        this.healthConfig = {
            // Usage metrics weights
            weights: {
                loginFrequency: 0.20,      // 20% - Daily active usage
                featureAdoption: 0.25,     // 25% - Feature utilization depth
                dataVolume: 0.15,          // 15% - Container tracking volume
                roiAchievement: 0.25,      // 25% - ROI goals vs actual
                supportTickets: 0.10,      // 10% - Support engagement quality
                trainingCompletion: 0.05   // 5%  - Training engagement
            },
            
            // Risk thresholds
            thresholds: {
                healthy: 80,      // Green - 80-100
                warning: 60,      // Yellow - 60-79
                risk: 40,         // Orange - 40-59
                critical: 0       // Red - 0-39
            },
            
            // Alert triggers
            alerts: {
                noLoginDays: 7,           // Alert if no login for 7 days
                featureUtilizationMin: 30, // Alert if <30% feature usage
                roiDeviationPercent: 20,   // Alert if ROI <80% of target
                supportTicketSpike: 5,     // Alert if >5 tickets in week
                trainingStalled: 14        // Alert if no training progress for 14 days
            }
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.initializeMonitoring();
    }
    
    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            if (req.method === 'OPTIONS') return res.sendStatus(200);
            next();
        });
    }
    
    setupRoutes() {
        // Health score endpoint
        this.app.get('/api/health/score/:customerId', async (req, res) => {
            try {
                const healthScore = await this.calculateHealthScore(req.params.customerId);
                res.json(healthScore);
            } catch (error) {
                console.error('Health score calculation error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Usage analytics
        this.app.get('/api/health/analytics/:customerId', async (req, res) => {
            try {
                const analytics = await this.getUsageAnalytics(req.params.customerId);
                res.json(analytics);
            } catch (error) {
                console.error('Usage analytics error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Feature adoption tracking
        this.app.get('/api/health/adoption/:customerId', async (req, res) => {
            try {
                const adoption = await this.getFeatureAdoption(req.params.customerId);
                res.json(adoption);
            } catch (error) {
                console.error('Feature adoption error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // ROI achievement monitoring
        this.app.get('/api/health/roi/:customerId', async (req, res) => {
            try {
                const roiData = await this.getROIAchievement(req.params.customerId);
                res.json(roiData);
            } catch (error) {
                console.error('ROI monitoring error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Churn risk assessment
        this.app.get('/api/health/churn-risk/:customerId', async (req, res) => {
            try {
                const churnRisk = await this.assessChurnRisk(req.params.customerId);
                res.json(churnRisk);
            } catch (error) {
                console.error('Churn risk assessment error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Track user activity (webhook)
        this.app.post('/api/health/track-activity', async (req, res) => {
            try {
                await this.trackUserActivity(req.body);
                res.sendStatus(204);
            } catch (error) {
                console.error('Activity tracking error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Alert management
        this.app.get('/api/health/alerts', async (req, res) => {
            try {
                const alerts = await this.getActiveAlerts();
                res.json(alerts);
            } catch (error) {
                console.error('Alert retrieval error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Health dashboard data
        this.app.get('/api/health/dashboard', async (req, res) => {
            try {
                const dashboard = await this.getHealthDashboard();
                res.json(dashboard);
            } catch (error) {
                console.error('Dashboard data error:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }
    
    async calculateHealthScore(customerId) {
        const metrics = await this.gatherHealthMetrics(customerId);
        const weights = this.healthConfig.weights;
        
        // Calculate weighted scores
        const scores = {
            loginFrequency: this.scoreLoginFrequency(metrics.loginData),
            featureAdoption: this.scoreFeatureAdoption(metrics.featureUsage),
            dataVolume: this.scoreDataVolume(metrics.containerData),
            roiAchievement: this.scoreROIAchievement(metrics.roiData),
            supportTickets: this.scoreSupportEngagement(metrics.supportData),
            trainingCompletion: this.scoreTrainingProgress(metrics.trainingData)
        };
        
        // Calculate overall health score
        const healthScore = Math.round(
            (scores.loginFrequency * weights.loginFrequency) +
            (scores.featureAdoption * weights.featureAdoption) +
            (scores.dataVolume * weights.dataVolume) +
            (scores.roiAchievement * weights.roiAchievement) +
            (scores.supportTickets * weights.supportTickets) +
            (scores.trainingCompletion * weights.trainingCompletion)
        );
        
        // Determine health status
        let status = 'critical';
        if (healthScore >= this.healthConfig.thresholds.healthy) status = 'healthy';
        else if (healthScore >= this.healthConfig.thresholds.warning) status = 'warning';
        else if (healthScore >= this.healthConfig.thresholds.risk) status = 'risk';
        
        // Generate recommendations
        const recommendations = this.generateRecommendations(scores, metrics);
        
        return {
            customerId,
            healthScore,
            status,
            lastUpdated: new Date().toISOString(),
            breakdown: scores,
            recommendations,
            metrics: {
                ...metrics,
                trend: await this.getHealthTrend(customerId)
            }
        };
    }
    
    async gatherHealthMetrics(customerId) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Login frequency data
        const loginQuery = `
            SELECT DATE(created_at) as login_date, COUNT(*) as login_count
            FROM user_sessions 
            WHERE customer_id = $1 AND created_at >= $2
            GROUP BY DATE(created_at)
            ORDER BY login_date DESC
        `;
        const loginData = await this.db.query(loginQuery, [customerId, thirtyDaysAgo]);
        
        // Feature usage data
        const featureQuery = `
            SELECT feature_name, COUNT(*) as usage_count
            FROM feature_usage_events
            WHERE customer_id = $1 AND created_at >= $2
            GROUP BY feature_name
        `;
        const featureUsage = await this.db.query(featureQuery, [customerId, thirtyDaysAgo]);
        
        // Container tracking data
        const containerQuery = `
            SELECT 
                COUNT(*) as total_containers,
                COUNT(DISTINCT container_number) as unique_containers,
                AVG(tracking_accuracy) as avg_accuracy
            FROM container_tracking
            WHERE customer_id = $1 AND created_at >= $2
        `;
        const containerData = await this.db.query(containerQuery, [customerId, thirtyDaysAgo]);
        
        // ROI achievement data
        const roiQuery = `
            SELECT 
                target_roi,
                actual_roi,
                cost_savings_target,
                cost_savings_actual
            FROM customer_roi_metrics
            WHERE customer_id = $1
            ORDER BY created_at DESC
            LIMIT 1
        `;
        const roiData = await this.db.query(roiQuery, [customerId]);
        
        // Support ticket data
        const supportQuery = `
            SELECT 
                COUNT(*) as total_tickets,
                AVG(resolution_time_hours) as avg_resolution_time,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets
            FROM support_tickets
            WHERE customer_id = $1 AND created_at >= $2
        `;
        const supportData = await this.db.query(supportQuery, [customerId, thirtyDaysAgo]);
        
        // Training progress data
        const trainingQuery = `
            SELECT 
                COUNT(*) as modules_completed,
                COUNT(DISTINCT module_id) as total_modules,
                MAX(completed_at) as last_training_activity
            FROM training_completions
            WHERE customer_id = $1
        `;
        const trainingData = await this.db.query(trainingQuery, [customerId]);
        
        return {
            loginData: loginData.rows,
            featureUsage: featureUsage.rows,
            containerData: containerData.rows[0] || {},
            roiData: roiData.rows[0] || {},
            supportData: supportData.rows[0] || {},
            trainingData: trainingData.rows[0] || {}
        };
    }
    
    scoreLoginFrequency(loginData) {
        const uniqueLoginDays = loginData.length;
        const maxDays = 30;
        
        // Score based on % of days with login activity
        const frequency = (uniqueLoginDays / maxDays) * 100;
        
        if (frequency >= 80) return 100;      // Excellent - daily usage
        if (frequency >= 60) return 85;       // Good - regular usage
        if (frequency >= 40) return 70;       // Moderate - sporadic usage
        if (frequency >= 20) return 50;       // Poor - infrequent usage
        return 25;                            // Critical - rare usage
    }
    
    scoreFeatureAdoption(featureUsage) {
        const availableFeatures = [
            'container_tracking', 'alert_management', 'reporting',
            'analytics', 'integration_setup', 'user_management',
            'workflow_automation', 'mobile_access'
        ];
        
        const usedFeatures = featureUsage.map(f => f.feature_name);
        const adoptionRate = (usedFeatures.length / availableFeatures.length) * 100;
        
        if (adoptionRate >= 80) return 100;   // Excellent - comprehensive usage
        if (adoptionRate >= 60) return 85;    // Good - broad usage
        if (adoptionRate >= 40) return 70;    // Moderate - selective usage
        if (adoptionRate >= 20) return 50;    // Poor - limited usage
        return 25;                            // Critical - minimal usage
    }
    
    scoreDataVolume(containerData) {
        const totalContainers = containerData.total_containers || 0;
        const accuracy = containerData.avg_accuracy || 0;
        
        // Combined score based on volume and accuracy
        let volumeScore = Math.min((totalContainers / 1000) * 50, 50); // Max 50 points for volume
        let accuracyScore = (accuracy / 100) * 50;                     // Max 50 points for accuracy
        
        return Math.round(volumeScore + accuracyScore);
    }
    
    scoreROIAchievement(roiData) {
        if (!roiData.target_roi || !roiData.actual_roi) return 50; // No data available
        
        const achievementRate = (roiData.actual_roi / roiData.target_roi) * 100;
        
        if (achievementRate >= 100) return 100;  // Exceeding targets
        if (achievementRate >= 80) return 85;    // Meeting targets
        if (achievementRate >= 60) return 70;    // Approaching targets
        if (achievementRate >= 40) return 50;    // Below targets
        return 25;                               // Significantly below targets
    }
    
    scoreSupportEngagement(supportData) {
        const totalTickets = supportData.total_tickets || 0;
        const resolutionTime = supportData.avg_resolution_time || 0;
        const resolutionRate = supportData.resolved_tickets / Math.max(totalTickets, 1);
        
        // Lower ticket volume and faster resolution = higher score
        let ticketScore = Math.max(100 - (totalTickets * 5), 50); // Penalty for high ticket volume
        let resolutionScore = resolutionRate * 50;                 // Bonus for good resolution rate
        
        return Math.round(Math.min(ticketScore + resolutionScore, 100));
    }
    
    scoreTrainingProgress(trainingData) {
        const completed = trainingData.modules_completed || 0;
        const total = trainingData.total_modules || 50; // Assume 50 available modules
        
        const completionRate = (completed / total) * 100;
        
        if (completionRate >= 80) return 100;
        if (completionRate >= 60) return 85;
        if (completionRate >= 40) return 70;
        if (completionRate >= 20) return 50;
        return 25;
    }
    
    generateRecommendations(scores, metrics) {
        const recommendations = [];
        
        // Login frequency recommendations
        if (scores.loginFrequency < 70) {
            recommendations.push({
                category: 'engagement',
                priority: 'high',
                title: 'Increase Platform Engagement',
                description: 'Consider setting up daily workflows or automated reports to encourage regular platform usage.',
                action: 'Schedule weekly check-in with Customer Success Manager'
            });
        }
        
        // Feature adoption recommendations
        if (scores.featureAdoption < 60) {
            recommendations.push({
                category: 'features',
                priority: 'medium',
                title: 'Expand Feature Utilization',
                description: 'Several platform features remain unused. Consider additional training or feature demonstrations.',
                action: 'Book advanced features training session'
            });
        }
        
        // ROI achievement recommendations
        if (scores.roiAchievement < 70) {
            recommendations.push({
                category: 'roi',
                priority: 'high',
                title: 'ROI Optimization Required',
                description: 'Current ROI is below target. Review implementation and optimization opportunities.',
                action: 'Schedule ROI review with Solutions Architect'
            });
        }
        
        // Support engagement recommendations
        if (scores.supportTickets < 60) {
            recommendations.push({
                category: 'support',
                priority: 'medium',
                title: 'Support Experience Improvement',
                description: 'High support ticket volume or slow resolution times detected.',
                action: 'Escalate to Customer Success Director'
            });
        }
        
        return recommendations;
    }
    
    async getUsageAnalytics(customerId) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        // Daily active users
        const dauQuery = `
            SELECT DATE(created_at) as date, COUNT(DISTINCT user_id) as active_users
            FROM user_sessions
            WHERE customer_id = $1 AND created_at >= $2
            GROUP BY DATE(created_at)
            ORDER BY date
        `;
        const dau = await this.db.query(dauQuery, [customerId, sevenDaysAgo]);
        
        // Feature usage heatmap
        const heatmapQuery = `
            SELECT 
                feature_name,
                DATE(created_at) as date,
                COUNT(*) as usage_count
            FROM feature_usage_events
            WHERE customer_id = $1 AND created_at >= $2
            GROUP BY feature_name, DATE(created_at)
            ORDER BY date, feature_name
        `;
        const heatmap = await this.db.query(heatmapQuery, [customerId, sevenDaysAgo]);
        
        // Top features by usage
        const topFeaturesQuery = `
            SELECT feature_name, COUNT(*) as usage_count
            FROM feature_usage_events
            WHERE customer_id = $1 AND created_at >= $2
            GROUP BY feature_name
            ORDER BY usage_count DESC
            LIMIT 10
        `;
        const topFeatures = await this.db.query(topFeaturesQuery, [customerId, sevenDaysAgo]);
        
        return {
            customerId,
            period: '7_days',
            dailyActiveUsers: dau.rows,
            featureHeatmap: heatmap.rows,
            topFeatures: topFeatures.rows,
            generatedAt: new Date().toISOString()
        };
    }
    
    async getFeatureAdoption(customerId) {
        const allFeatures = [
            { name: 'container_tracking', category: 'core' },
            { name: 'alert_management', category: 'core' },
            { name: 'reporting', category: 'analytics' },
            { name: 'analytics', category: 'analytics' },
            { name: 'integration_setup', category: 'technical' },
            { name: 'user_management', category: 'admin' },
            { name: 'workflow_automation', category: 'advanced' },
            { name: 'mobile_access', category: 'convenience' }
        ];
        
        const usageQuery = `
            SELECT 
                feature_name,
                COUNT(*) as usage_count,
                COUNT(DISTINCT user_id) as unique_users,
                MAX(created_at) as last_used
            FROM feature_usage_events
            WHERE customer_id = $1
            GROUP BY feature_name
        `;
        const usage = await this.db.query(usageQuery, [customerId]);
        const usageMap = new Map(usage.rows.map(row => [row.feature_name, row]));
        
        const adoptionData = allFeatures.map(feature => {
            const stats = usageMap.get(feature.name);
            return {
                ...feature,
                adopted: !!stats,
                usageCount: stats?.usage_count || 0,
                uniqueUsers: stats?.unique_users || 0,
                lastUsed: stats?.last_used || null,
                adoptionScore: stats ? Math.min((stats.usage_count / 100) * 100, 100) : 0
            };
        });
        
        const adoptionRate = (adoptionData.filter(f => f.adopted).length / allFeatures.length) * 100;
        
        return {
            customerId,
            adoptionRate: Math.round(adoptionRate),
            features: adoptionData,
            summary: {
                totalFeatures: allFeatures.length,
                adoptedFeatures: adoptionData.filter(f => f.adopted).length,
                heavilyUsed: adoptionData.filter(f => f.adoptionScore > 70).length,
                recentlyUsed: adoptionData.filter(f => {
                    if (!f.lastUsed) return false;
                    const daysSince = (Date.now() - new Date(f.lastUsed)) / (1000 * 60 * 60 * 24);
                    return daysSince <= 7;
                }).length
            }
        };
    }
    
    async getROIAchievement(customerId) {
        const roiQuery = `
            SELECT 
                *,
                (actual_cost_savings / target_cost_savings * 100) as savings_achievement_percent,
                (actual_roi / target_roi * 100) as roi_achievement_percent
            FROM customer_roi_metrics
            WHERE customer_id = $1
            ORDER BY created_at DESC
            LIMIT 12
        `;
        const roiData = await this.db.query(roiQuery, [customerId]);
        
        const latest = roiData.rows[0] || {};
        const trend = roiData.rows.map(row => ({
            date: row.created_at,
            targetROI: row.target_roi,
            actualROI: row.actual_roi,
            achievementPercent: row.roi_achievement_percent
        }));
        
        return {
            customerId,
            current: {
                targetROI: latest.target_roi || 0,
                actualROI: latest.actual_roi || 0,
                achievementPercent: latest.roi_achievement_percent || 0,
                targetSavings: latest.target_cost_savings || 0,
                actualSavings: latest.actual_cost_savings || 0,
                savingsAchievementPercent: latest.savings_achievement_percent || 0
            },
            trend,
            status: this.getROIStatus(latest.roi_achievement_percent || 0)
        };
    }
    
    getROIStatus(achievementPercent) {
        if (achievementPercent >= 100) return 'exceeding';
        if (achievementPercent >= 80) return 'on_track';
        if (achievementPercent >= 60) return 'below_target';
        return 'at_risk';
    }
    
    async assessChurnRisk(customerId) {
        const healthScore = await this.calculateHealthScore(customerId);
        
        // Risk factors
        const riskFactors = [];
        
        // Health score based risk
        if (healthScore.healthScore < 60) {
            riskFactors.push({
                factor: 'low_health_score',
                severity: 'high',
                description: 'Overall health score indicates customer satisfaction issues',
                score: healthScore.healthScore
            });
        }
        
        // Engagement based risk
        if (healthScore.breakdown.loginFrequency < 50) {
            riskFactors.push({
                factor: 'low_engagement',
                severity: 'high',
                description: 'Declining platform usage indicates disengagement',
                score: healthScore.breakdown.loginFrequency
            });
        }
        
        // ROI based risk
        if (healthScore.breakdown.roiAchievement < 60) {
            riskFactors.push({
                factor: 'roi_underperformance',
                severity: 'critical',
                description: 'Not achieving expected ROI targets',
                score: healthScore.breakdown.roiAchievement
            });
        }
        
        // Support based risk
        if (healthScore.breakdown.supportTickets < 60) {
            riskFactors.push({
                factor: 'support_issues',
                severity: 'medium',
                description: 'High support burden or resolution issues',
                score: healthScore.breakdown.supportTickets
            });
        }
        
        // Calculate overall churn risk
        let churnRisk = 0;
        riskFactors.forEach(factor => {
            const weight = {
                'critical': 40,
                'high': 25,
                'medium': 15,
                'low': 5
            }[factor.severity];
            churnRisk += weight;
        });
        
        churnRisk = Math.min(churnRisk, 100);
        
        let riskLevel = 'low';
        if (churnRisk >= 70) riskLevel = 'critical';
        else if (churnRisk >= 50) riskLevel = 'high';
        else if (churnRisk >= 30) riskLevel = 'medium';
        
        return {
            customerId,
            churnRisk,
            riskLevel,
            riskFactors,
            recommendations: this.getChurnPreventionRecommendations(riskFactors),
            nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        };
    }
    
    getChurnPreventionRecommendations(riskFactors) {
        const recommendations = [];
        
        riskFactors.forEach(factor => {
            switch (factor.factor) {
                case 'low_health_score':
                    recommendations.push({
                        action: 'immediate_executive_engagement',
                        description: 'Schedule executive check-in within 48 hours',
                        priority: 'urgent'
                    });
                    break;
                case 'low_engagement':
                    recommendations.push({
                        action: 'engagement_revival_campaign',
                        description: 'Launch targeted re-engagement campaign with value demonstration',
                        priority: 'high'
                    });
                    break;
                case 'roi_underperformance':
                    recommendations.push({
                        action: 'roi_optimization_review',
                        description: 'Conduct comprehensive ROI review and optimization planning',
                        priority: 'critical'
                    });
                    break;
                case 'support_issues':
                    recommendations.push({
                        action: 'support_escalation',
                        description: 'Escalate to senior support team for resolution',
                        priority: 'high'
                    });
                    break;
            }
        });
        
        return recommendations;
    }
    
    async trackUserActivity(activityData) {
        const {
            customerId,
            userId,
            action,
            featureName,
            metadata = {},
            timestamp = new Date()
        } = activityData;
        
        // Store activity in database
        await this.db.query(`
            INSERT INTO feature_usage_events 
            (customer_id, user_id, feature_name, action, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [customerId, userId, featureName, action, JSON.stringify(metadata), timestamp]);
        
        // Update Redis for real-time tracking
        const key = `customer:${customerId}:activity`;
        await this.redis.zadd(key, Date.now(), JSON.stringify(activityData));
        await this.redis.expire(key, 86400 * 30); // Keep 30 days
        
        // Check for alert conditions
        await this.checkAlertConditions(customerId);
    }
    
    async checkAlertConditions(customerId) {
        const healthScore = await this.calculateHealthScore(customerId);
        const alerts = [];
        
        // Generate alerts based on health score
        if (healthScore.healthScore < this.healthConfig.thresholds.warning) {
            alerts.push({
                type: 'health_score_warning',
                severity: healthScore.healthScore < this.healthConfig.thresholds.risk ? 'high' : 'medium',
                message: `Customer health score dropped to ${healthScore.healthScore}%`,
                customerId,
                triggeredAt: new Date().toISOString()
            });
        }
        
        // Save alerts
        for (const alert of alerts) {
            await this.createAlert(alert);
        }
    }
    
    async createAlert(alertData) {
        await this.db.query(`
            INSERT INTO health_alerts 
            (customer_id, type, severity, message, triggered_at, status)
            VALUES ($1, $2, $3, $4, $5, 'active')
        `, [
            alertData.customerId,
            alertData.type,
            alertData.severity,
            alertData.message,
            alertData.triggeredAt
        ]);
        
        // Send notification to customer success team
        await this.sendAlertNotification(alertData);
    }
    
    async sendAlertNotification(alert) {
        // In production, integrate with Slack, email, or other notification systems
        console.log('HEALTH ALERT:', JSON.stringify(alert, null, 2));
    }
    
    async getActiveAlerts() {
        const alertsQuery = `
            SELECT * FROM health_alerts
            WHERE status = 'active'
            ORDER BY triggered_at DESC
        `;
        const alerts = await this.db.query(alertsQuery);
        
        return alerts.rows;
    }
    
    async getHealthDashboard() {
        // Overall health distribution
        const distributionQuery = `
            SELECT 
                CASE 
                    WHEN health_score >= 80 THEN 'healthy'
                    WHEN health_score >= 60 THEN 'warning'
                    WHEN health_score >= 40 THEN 'risk'
                    ELSE 'critical'
                END as status,
                COUNT(*) as count
            FROM customer_health_scores
            WHERE updated_at >= NOW() - INTERVAL '24 hours'
            GROUP BY status
        `;
        const distribution = await this.db.query(distributionQuery);
        
        // Trending metrics
        const trendsQuery = `
            SELECT 
                DATE(updated_at) as date,
                AVG(health_score) as avg_health_score,
                COUNT(*) as customer_count
            FROM customer_health_scores
            WHERE updated_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(updated_at)
            ORDER BY date
        `;
        const trends = await this.db.query(trendsQuery);
        
        // High-risk customers
        const riskCustomersQuery = `
            SELECT customer_id, health_score, updated_at
            FROM customer_health_scores
            WHERE health_score < 60
            ORDER BY health_score ASC
            LIMIT 10
        `;
        const riskCustomers = await this.db.query(riskCustomersQuery);
        
        return {
            summary: {
                totalCustomers: distribution.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
                healthyCustomers: distribution.rows.find(row => row.status === 'healthy')?.count || 0,
                atRiskCustomers: distribution.rows.filter(row => ['risk', 'critical'].includes(row.status))
                    .reduce((sum, row) => sum + parseInt(row.count), 0)
            },
            distribution: distribution.rows,
            trends: trends.rows,
            riskCustomers: riskCustomers.rows,
            lastUpdated: new Date().toISOString()
        };
    }
    
    async getHealthTrend(customerId) {
        const trendQuery = `
            SELECT health_score, updated_at
            FROM customer_health_scores
            WHERE customer_id = $1
            ORDER BY updated_at DESC
            LIMIT 30
        `;
        const trend = await this.db.query(trendQuery, [customerId]);
        
        return trend.rows.map(row => ({
            score: row.health_score,
            date: row.updated_at
        }));
    }
    
    async initializeMonitoring() {
        console.log('Customer Health Monitoring System initialized');
        
        // Schedule periodic health score calculations
        setInterval(() => this.calculateAllHealthScores(), 3600000); // Every hour
        
        // Schedule alert checks
        setInterval(() => this.processAlerts(), 900000); // Every 15 minutes
        
        // Start API server
        this.app.listen(this.port, () => {
            console.log(`Health Monitoring System running on port ${this.port}`);
        });
    }
    
    async calculateAllHealthScores() {
        console.log('Calculating health scores for all customers...');
        
        const customersQuery = 'SELECT DISTINCT customer_id FROM customer_accounts WHERE status = \'active\'';
        const customers = await this.db.query(customersQuery);
        
        for (const customer of customers.rows) {
            try {
                const healthScore = await this.calculateHealthScore(customer.customer_id);
                
                // Update health score in database
                await this.db.query(`
                    INSERT INTO customer_health_scores 
                    (customer_id, health_score, status, breakdown, updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (customer_id) 
                    DO UPDATE SET 
                        health_score = EXCLUDED.health_score,
                        status = EXCLUDED.status,
                        breakdown = EXCLUDED.breakdown,
                        updated_at = EXCLUDED.updated_at
                `, [
                    customer.customer_id,
                    healthScore.healthScore,
                    healthScore.status,
                    JSON.stringify(healthScore.breakdown)
                ]);
                
            } catch (error) {
                console.error(`Error calculating health score for customer ${customer.customer_id}:`, error);
            }
        }
        
        console.log(`Health scores calculated for ${customers.rows.length} customers`);
    }
    
    async processAlerts() {
        console.log('Processing health alerts...');
        
        const activeAlerts = await this.getActiveAlerts();
        
        // Process each alert for escalation or resolution
        for (const alert of activeAlerts) {
            const alertAge = Date.now() - new Date(alert.triggered_at).getTime();
            const hours = alertAge / (1000 * 60 * 60);
            
            // Escalate alerts that are 24+ hours old
            if (hours >= 24 && alert.severity === 'high') {
                await this.escalateAlert(alert);
            }
        }
    }
    
    async escalateAlert(alert) {
        await this.db.query(`
            UPDATE health_alerts 
            SET severity = 'critical', escalated_at = NOW()
            WHERE id = $1
        `, [alert.id]);
        
        // Send escalation notification
        console.log(`ESCALATED ALERT: ${alert.message} for customer ${alert.customer_id}`);
    }
}

module.exports = CustomerHealthMonitoringSystem;

// Start the system if run directly
if (require.main === module) {
    new CustomerHealthMonitoringSystem();
}