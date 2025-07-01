#!/usr/bin/env node

/**
 * ROOTUIP Partner Success Tracking and Revenue Sharing Automation System
 * Tracks partner performance and automates commission calculations
 */

const { Pool } = require('pg');
const Redis = require('ioredis');
const AWS = require('aws-sdk');
const stripe = require('stripe');
const BigNumber = require('bignumber.js');
const { v4: uuidv4 } = require('uuid');

class PartnerSuccessRevenueSystem {
    constructor(config = {}) {
        this.config = {
            databaseUrl: config.databaseUrl || process.env.DATABASE_URL,
            redisUrl: config.redisUrl || process.env.REDIS_URL,
            stripeKey: config.stripeKey || process.env.STRIPE_SECRET_KEY,
            paypalConfig: config.paypalConfig || {
                clientId: process.env.PAYPAL_CLIENT_ID,
                clientSecret: process.env.PAYPAL_CLIENT_SECRET
            },
            ...config
        };
        
        // Database connection
        this.db = new Pool({
            connectionString: this.config.databaseUrl,
            max: 20
        });
        
        // Redis for real-time metrics
        this.redis = new Redis(this.config.redisUrl);
        
        // Payment processors
        this.stripe = stripe(this.config.stripeKey);
        
        // AWS services
        this.ses = new AWS.SES();
        this.s3 = new AWS.S3();
        
        // Revenue models
        this.revenueModels = {
            RECURRING: 'recurring',
            ONE_TIME: 'one_time',
            USAGE_BASED: 'usage_based',
            HYBRID: 'hybrid'
        };
        
        // Commission triggers
        this.commissionTriggers = {
            SIGNUP: 'signup',
            PAYMENT: 'payment',
            MILESTONE: 'milestone',
            RENEWAL: 'renewal'
        };
        
        // Initialize tracking
        this.initializeTracking();
    }
    
    // Initialize real-time tracking
    initializeTracking() {
        // Start metrics collection
        setInterval(() => this.collectPartnerMetrics(), 60000); // Every minute
        
        // Process pending commissions
        setInterval(() => this.processPendingCommissions(), 300000); // Every 5 minutes
        
        // Generate success reports
        setInterval(() => this.generateSuccessReports(), 86400000); // Daily
        
        // Monitor partner health
        setInterval(() => this.monitorPartnerHealth(), 3600000); // Hourly
    }
    
    // Track partner activity
    async trackPartnerActivity(partnerId, activityData) {
        try {
            const activity = {
                id: uuidv4(),
                partnerId,
                type: activityData.type,
                category: activityData.category,
                metadata: activityData.metadata || {},
                timestamp: new Date().toISOString(),
                
                // Activity scoring
                score: this.calculateActivityScore(activityData),
                
                // Impact metrics
                impact: {
                    revenue: activityData.revenue || 0,
                    clients: activityData.clients || 0,
                    engagement: activityData.engagement || 0
                }
            };
            
            // Store activity
            await this.db.query(
                `INSERT INTO partner_activities (
                    id, partner_id, type, category, metadata,
                    score, impact, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    activity.id, partnerId, activity.type, activity.category,
                    JSON.stringify(activity.metadata), activity.score,
                    JSON.stringify(activity.impact), activity.timestamp
                ]
            );
            
            // Update real-time metrics
            await this.updateRealTimeMetrics(partnerId, activity);
            
            // Check for achievements
            await this.checkAchievements(partnerId, activity);
            
            // Trigger automated actions
            await this.triggerAutomatedActions(partnerId, activity);
            
            return {
                success: true,
                activityId: activity.id,
                score: activity.score
            };
            
        } catch (error) {
            console.error(`Error tracking partner activity: ${error.message}`);
            throw error;
        }
    }
    
    // Calculate activity score
    calculateActivityScore(activity) {
        const scoreWeights = {
            // Sales activities
            demo_scheduled: 10,
            demo_completed: 20,
            proposal_sent: 30,
            deal_closed: 100,
            
            // Marketing activities
            lead_generated: 5,
            content_shared: 3,
            webinar_hosted: 25,
            case_study_created: 40,
            
            // Support activities
            client_onboarded: 50,
            training_completed: 15,
            support_ticket_resolved: 5,
            client_review_positive: 20,
            
            // Engagement activities
            portal_login: 1,
            resource_downloaded: 2,
            api_integration: 30,
            feature_request: 10
        };
        
        const baseScore = scoreWeights[activity.type] || 1;
        
        // Apply multipliers
        let multiplier = 1;
        
        // Deal size multiplier
        if (activity.metadata?.dealSize) {
            const dealSize = parseFloat(activity.metadata.dealSize);
            if (dealSize > 100000) multiplier *= 3;
            else if (dealSize > 50000) multiplier *= 2;
            else if (dealSize > 10000) multiplier *= 1.5;
        }
        
        // Client tier multiplier
        if (activity.metadata?.clientTier === 'enterprise') {
            multiplier *= 2;
        }
        
        // Time-based multiplier (bonus for quick actions)
        if (activity.metadata?.timeToComplete) {
            const days = activity.metadata.timeToComplete;
            if (days < 7) multiplier *= 1.2;
            else if (days > 30) multiplier *= 0.8;
        }
        
        return Math.round(baseScore * multiplier);
    }
    
    // Track revenue and calculate commissions
    async trackRevenue(partnerId, revenueData) {
        try {
            console.log(`Tracking revenue for partner ${partnerId}: $${revenueData.amount}`);
            
            const revenue = {
                id: uuidv4(),
                partnerId,
                clientId: revenueData.clientId,
                amount: new BigNumber(revenueData.amount),
                currency: revenueData.currency || 'USD',
                type: revenueData.type || this.revenueModels.RECURRING,
                period: revenueData.period || {
                    start: new Date(),
                    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                },
                status: 'confirmed',
                source: revenueData.source || 'stripe',
                metadata: revenueData.metadata || {},
                timestamp: new Date().toISOString()
            };
            
            // Store revenue record
            await this.db.query(
                `INSERT INTO partner_revenue (
                    id, partner_id, client_id, amount, currency,
                    type, period_start, period_end, status, source,
                    metadata, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [
                    revenue.id, partnerId, revenue.clientId,
                    revenue.amount.toString(), revenue.currency,
                    revenue.type, revenue.period.start, revenue.period.end,
                    revenue.status, revenue.source,
                    JSON.stringify(revenue.metadata), revenue.timestamp
                ]
            );
            
            // Calculate commission
            const commission = await this.calculateCommission(partnerId, revenue);
            
            // Create commission record
            await this.createCommissionRecord(partnerId, revenue, commission);
            
            // Update partner metrics
            await this.updatePartnerMetrics(partnerId, {
                revenue: revenue.amount,
                commissionEarned: commission.amount
            });
            
            // Check for tier upgrades
            await this.checkTierUpgrade(partnerId);
            
            // Send notifications
            await this.sendRevenueNotification(partnerId, revenue, commission);
            
            return {
                success: true,
                revenueId: revenue.id,
                commission: commission.amount.toString()
            };
            
        } catch (error) {
            console.error(`Error tracking revenue: ${error.message}`);
            throw error;
        }
    }
    
    // Calculate commission based on partner agreement
    async calculateCommission(partnerId, revenue) {
        try {
            // Get partner agreement
            const partner = await this.getPartnerDetails(partnerId);
            const agreement = partner.commission_agreement;
            
            let commissionAmount = new BigNumber(0);
            let rate = agreement.baseRate || 0.20;
            
            // Apply tier-based rates
            const ytdRevenue = await this.getYTDRevenue(partnerId);
            if (ytdRevenue.gt(1000000)) {
                rate = agreement.platinumRate || 0.30;
            } else if (ytdRevenue.gt(500000)) {
                rate = agreement.goldRate || 0.25;
            } else if (ytdRevenue.gt(100000)) {
                rate = agreement.silverRate || 0.22;
            }
            
            // Calculate base commission
            commissionAmount = revenue.amount.multipliedBy(rate);
            
            // Apply bonuses
            const bonuses = await this.calculateBonuses(partnerId, revenue);
            
            // Recurring revenue bonus
            if (revenue.type === this.revenueModels.RECURRING && bonuses.recurringBonus) {
                commissionAmount = commissionAmount.multipliedBy(1 + bonuses.recurringBonus);
            }
            
            // New client bonus
            if (await this.isNewClient(partnerId, revenue.clientId) && bonuses.newClientBonus) {
                commissionAmount = commissionAmount.plus(bonuses.newClientBonus);
            }
            
            // Performance bonus
            const performanceMultiplier = await this.getPerformanceMultiplier(partnerId);
            commissionAmount = commissionAmount.multipliedBy(performanceMultiplier);
            
            // Apply caps if any
            if (agreement.maxCommissionPerDeal) {
                commissionAmount = BigNumber.minimum(
                    commissionAmount,
                    new BigNumber(agreement.maxCommissionPerDeal)
                );
            }
            
            return {
                amount: commissionAmount,
                rate,
                bonuses,
                calculation: {
                    base: revenue.amount.multipliedBy(rate),
                    bonuses: commissionAmount.minus(revenue.amount.multipliedBy(rate)),
                    total: commissionAmount
                }
            };
            
        } catch (error) {
            console.error(`Error calculating commission: ${error.message}`);
            throw error;
        }
    }
    
    // Create commission record
    async createCommissionRecord(partnerId, revenue, commission) {
        const commissionRecord = {
            id: uuidv4(),
            partnerId,
            revenueId: revenue.id,
            clientId: revenue.clientId,
            amount: commission.amount.toString(),
            rate: commission.rate,
            status: 'pending',
            calculation: commission.calculation,
            period: revenue.period,
            createdAt: new Date().toISOString(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
        };
        
        await this.db.query(
            `INSERT INTO partner_commissions (
                id, partner_id, revenue_id, client_id, amount,
                rate, status, calculation, period_start, period_end,
                created_at, due_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                commissionRecord.id, partnerId, revenue.revenueId,
                revenue.clientId, commissionRecord.amount,
                commissionRecord.rate, commissionRecord.status,
                JSON.stringify(commissionRecord.calculation),
                revenue.period.start, revenue.period.end,
                commissionRecord.createdAt, commissionRecord.dueDate
            ]
        );
        
        return commissionRecord;
    }
    
    // Process pending commissions
    async processPendingCommissions() {
        try {
            console.log('Processing pending commissions...');
            
            // Get commissions ready for payout
            const pendingCommissions = await this.db.query(
                `SELECT c.*, p.payout_method, p.payout_details
                FROM partner_commissions c
                JOIN partners p ON c.partner_id = p.id
                WHERE c.status = 'approved'
                AND c.due_date <= CURRENT_DATE
                ORDER BY c.partner_id, c.created_at`
            );
            
            // Group by partner
            const commissionsByPartner = {};
            pendingCommissions.rows.forEach(commission => {
                if (!commissionsByPartner[commission.partner_id]) {
                    commissionsByPartner[commission.partner_id] = [];
                }
                commissionsByPartner[commission.partner_id].push(commission);
            });
            
            // Process payouts
            for (const [partnerId, commissions] of Object.entries(commissionsByPartner)) {
                await this.processPartnerPayout(partnerId, commissions);
            }
            
            console.log(`Processed payouts for ${Object.keys(commissionsByPartner).length} partners`);
            
        } catch (error) {
            console.error(`Error processing commissions: ${error.message}`);
        }
    }
    
    // Process payout for partner
    async processPartnerPayout(partnerId, commissions) {
        try {
            const partner = await this.getPartnerDetails(partnerId);
            
            // Calculate total payout
            const totalAmount = commissions.reduce((sum, c) => 
                sum.plus(new BigNumber(c.amount)), new BigNumber(0)
            );
            
            // Check minimum payout threshold
            const minPayout = new BigNumber(partner.commission_agreement?.minimumPayout || 100);
            if (totalAmount.lt(minPayout)) {
                console.log(`Partner ${partnerId} below minimum payout threshold`);
                return;
            }
            
            // Create payout record
            const payout = {
                id: uuidv4(),
                partnerId,
                amount: totalAmount.toString(),
                currency: 'USD',
                method: partner.payout_method || 'bank_transfer',
                status: 'processing',
                commissionIds: commissions.map(c => c.id),
                createdAt: new Date().toISOString()
            };
            
            await this.db.query(
                `INSERT INTO partner_payouts (
                    id, partner_id, amount, currency, method,
                    status, commission_ids, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    payout.id, partnerId, payout.amount, payout.currency,
                    payout.method, payout.status,
                    JSON.stringify(payout.commissionIds), payout.createdAt
                ]
            );
            
            // Process payment based on method
            let paymentResult;
            switch (payout.method) {
                case 'stripe':
                    paymentResult = await this.processStripePayment(partner, totalAmount);
                    break;
                case 'paypal':
                    paymentResult = await this.processPayPalPayment(partner, totalAmount);
                    break;
                case 'bank_transfer':
                    paymentResult = await this.processBankTransfer(partner, totalAmount);
                    break;
                default:
                    throw new Error(`Unsupported payment method: ${payout.method}`);
            }
            
            // Update payout status
            await this.db.query(
                `UPDATE partner_payouts 
                SET status = $1, payment_id = $2, processed_at = $3
                WHERE id = $4`,
                [
                    paymentResult.success ? 'completed' : 'failed',
                    paymentResult.paymentId,
                    new Date().toISOString(),
                    payout.id
                ]
            );
            
            // Update commission statuses
            if (paymentResult.success) {
                await this.db.query(
                    `UPDATE partner_commissions 
                    SET status = 'paid', payout_id = $1, paid_at = $2
                    WHERE id = ANY($3)`,
                    [payout.id, new Date().toISOString(), payout.commissionIds]
                );
            }
            
            // Send payout notification
            await this.sendPayoutNotification(partner, payout, paymentResult);
            
            // Update partner metrics
            await this.updatePartnerMetrics(partnerId, {
                totalPayouts: totalAmount,
                lastPayoutDate: new Date()
            });
            
            return paymentResult;
            
        } catch (error) {
            console.error(`Error processing partner payout: ${error.message}`);
            throw error;
        }
    }
    
    // Track partner success metrics
    async trackSuccessMetrics(partnerId) {
        try {
            const metrics = {
                partnerId,
                period: {
                    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    end: new Date()
                },
                
                // Revenue metrics
                revenue: await this.getRevenueMetrics(partnerId),
                
                // Client metrics
                clients: await this.getClientMetrics(partnerId),
                
                // Activity metrics
                activity: await this.getActivityMetrics(partnerId),
                
                // Performance metrics
                performance: await this.getPerformanceMetrics(partnerId),
                
                // Engagement metrics
                engagement: await this.getEngagementMetrics(partnerId),
                
                // Success score
                successScore: 0
            };
            
            // Calculate success score
            metrics.successScore = this.calculateSuccessScore(metrics);
            
            // Store metrics
            await this.storeSuccessMetrics(partnerId, metrics);
            
            // Generate insights
            const insights = await this.generatePartnerInsights(metrics);
            
            // Check for awards/recognition
            const awards = await this.checkPartnerAwards(partnerId, metrics);
            
            return {
                metrics,
                insights,
                awards,
                recommendations: await this.generateRecommendations(partnerId, metrics)
            };
            
        } catch (error) {
            console.error(`Error tracking success metrics: ${error.message}`);
            throw error;
        }
    }
    
    // Get revenue metrics
    async getRevenueMetrics(partnerId) {
        const result = await this.db.query(
            `SELECT 
                COUNT(DISTINCT client_id) as total_clients,
                SUM(amount::numeric) as total_revenue,
                AVG(amount::numeric) as avg_deal_size,
                COUNT(*) as total_deals,
                COUNT(CASE WHEN type = 'recurring' THEN 1 END) as recurring_deals,
                SUM(CASE WHEN type = 'recurring' THEN amount::numeric ELSE 0 END) as mrr
            FROM partner_revenue
            WHERE partner_id = $1
            AND timestamp >= CURRENT_DATE - INTERVAL '30 days'`,
            [partnerId]
        );
        
        const row = result.rows[0];
        
        // Get growth metrics
        const previousPeriod = await this.db.query(
            `SELECT SUM(amount::numeric) as total_revenue
            FROM partner_revenue
            WHERE partner_id = $1
            AND timestamp >= CURRENT_DATE - INTERVAL '60 days'
            AND timestamp < CURRENT_DATE - INTERVAL '30 days'`,
            [partnerId]
        );
        
        const currentRevenue = parseFloat(row.total_revenue || 0);
        const previousRevenue = parseFloat(previousPeriod.rows[0].total_revenue || 0);
        const growth = previousRevenue > 0 ? 
            ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
        
        return {
            totalRevenue: currentRevenue,
            avgDealSize: parseFloat(row.avg_deal_size || 0),
            totalDeals: parseInt(row.total_deals || 0),
            recurringRevenue: parseFloat(row.mrr || 0),
            recurringPercentage: row.total_deals > 0 ? 
                (parseInt(row.recurring_deals || 0) / parseInt(row.total_deals)) * 100 : 0,
            growth,
            trend: growth > 10 ? 'growing' : growth < -10 ? 'declining' : 'stable'
        };
    }
    
    // Get client metrics
    async getClientMetrics(partnerId) {
        const result = await this.db.query(
            `SELECT 
                COUNT(DISTINCT id) as total_clients,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active_clients,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_clients,
                AVG(CASE WHEN status = 'churned' 
                    THEN EXTRACT(EPOCH FROM (churned_at - created_at))/86400 
                    ELSE EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/86400 
                END) as avg_lifetime_days
            FROM clients
            WHERE partner_id = $1`,
            [partnerId]
        );
        
        const row = result.rows[0];
        
        // Calculate retention rate
        const retentionResult = await this.db.query(
            `SELECT 
                COUNT(CASE WHEN status = 'active' AND created_at < CURRENT_DATE - INTERVAL '30 days' THEN 1 END)::float /
                NULLIF(COUNT(CASE WHEN created_at < CURRENT_DATE - INTERVAL '30 days' THEN 1 END), 0) * 100 as retention_rate
            FROM clients
            WHERE partner_id = $1`,
            [partnerId]
        );
        
        // Get client satisfaction
        const satisfactionResult = await this.db.query(
            `SELECT AVG(satisfaction_score) as avg_satisfaction
            FROM client_feedback
            WHERE partner_id = $1
            AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
            [partnerId]
        );
        
        return {
            totalClients: parseInt(row.total_clients || 0),
            activeClients: parseInt(row.active_clients || 0),
            newClients: parseInt(row.new_clients || 0),
            avgLifetime: parseFloat(row.avg_lifetime_days || 0),
            retentionRate: parseFloat(retentionResult.rows[0].retention_rate || 0),
            satisfactionScore: parseFloat(satisfactionResult.rows[0].avg_satisfaction || 0),
            health: this.calculateClientHealth({
                retention: parseFloat(retentionResult.rows[0].retention_rate || 0),
                satisfaction: parseFloat(satisfactionResult.rows[0].avg_satisfaction || 0)
            })
        };
    }
    
    // Get activity metrics
    async getActivityMetrics(partnerId) {
        const result = await this.db.query(
            `SELECT 
                type,
                COUNT(*) as count,
                SUM(score) as total_score,
                AVG(score) as avg_score
            FROM partner_activities
            WHERE partner_id = $1
            AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY type`,
            [partnerId]
        );
        
        const activities = {};
        let totalScore = 0;
        let totalCount = 0;
        
        result.rows.forEach(row => {
            activities[row.type] = {
                count: parseInt(row.count),
                totalScore: parseInt(row.total_score),
                avgScore: parseFloat(row.avg_score)
            };
            totalScore += parseInt(row.total_score);
            totalCount += parseInt(row.count);
        });
        
        // Get activity trend
        const trendResult = await this.db.query(
            `SELECT 
                DATE_TRUNC('week', timestamp) as week,
                COUNT(*) as count,
                SUM(score) as score
            FROM partner_activities
            WHERE partner_id = $1
            AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY week
            ORDER BY week`,
            [partnerId]
        );
        
        return {
            totalActivities: totalCount,
            totalScore,
            avgScore: totalCount > 0 ? totalScore / totalCount : 0,
            byType: activities,
            trend: trendResult.rows,
            velocity: this.calculateActivityVelocity(trendResult.rows)
        };
    }
    
    // Get performance metrics
    async getPerformanceMetrics(partnerId) {
        // Demo conversion rate
        const demoResult = await this.db.query(
            `SELECT 
                COUNT(CASE WHEN type = 'demo_scheduled' THEN 1 END) as demos_scheduled,
                COUNT(CASE WHEN type = 'demo_completed' THEN 1 END) as demos_completed,
                COUNT(CASE WHEN type = 'deal_closed' THEN 1 END) as deals_closed
            FROM partner_activities
            WHERE partner_id = $1
            AND timestamp >= CURRENT_DATE - INTERVAL '90 days'`,
            [partnerId]
        );
        
        const demos = result.rows[0];
        const demoConversion = demos.demos_scheduled > 0 ?
            (demos.demos_completed / demos.demos_scheduled) * 100 : 0;
        const closeRate = demos.demos_completed > 0 ?
            (demos.deals_closed / demos.demos_completed) * 100 : 0;
        
        // Response time
        const responseResult = await this.db.query(
            `SELECT AVG(EXTRACT(EPOCH FROM (first_response - created_at))/3600) as avg_response_hours
            FROM partner_leads
            WHERE partner_id = $1
            AND created_at >= CURRENT_DATE - INTERVAL '30 days'
            AND first_response IS NOT NULL`,
            [partnerId]
        );
        
        // Training completion
        const trainingResult = await this.db.query(
            `SELECT 
                COUNT(DISTINCT course_id) as courses_completed,
                AVG(score) as avg_score
            FROM partner_training
            WHERE partner_id = $1
            AND completed_at >= CURRENT_DATE - INTERVAL '30 days'`,
            [partnerId]
        );
        
        return {
            demoConversionRate: demoConversion,
            closeRate,
            avgResponseTime: parseFloat(responseResult.rows[0].avg_response_hours || 0),
            trainingCompleted: parseInt(trainingResult.rows[0].courses_completed || 0),
            trainingScore: parseFloat(trainingResult.rows[0].avg_score || 0),
            performanceRating: this.calculatePerformanceRating({
                demoConversion,
                closeRate,
                responseTime: parseFloat(responseResult.rows[0].avg_response_hours || 0)
            })
        };
    }
    
    // Get engagement metrics
    async getEngagementMetrics(partnerId) {
        // Portal usage
        const portalResult = await this.db.query(
            `SELECT 
                COUNT(DISTINCT DATE_TRUNC('day', timestamp)) as active_days,
                COUNT(*) as total_logins,
                AVG(session_duration) as avg_session_minutes
            FROM partner_sessions
            WHERE partner_id = $1
            AND timestamp >= CURRENT_DATE - INTERVAL '30 days'`,
            [partnerId]
        );
        
        // Resource usage
        const resourceResult = await this.db.query(
            `SELECT 
                resource_type,
                COUNT(*) as download_count
            FROM partner_downloads
            WHERE partner_id = $1
            AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY resource_type`,
            [partnerId]
        );
        
        // API usage
        const apiResult = await this.db.query(
            `SELECT 
                COUNT(*) as api_calls,
                COUNT(DISTINCT endpoint) as unique_endpoints
            FROM partner_api_usage
            WHERE partner_id = $1
            AND timestamp >= CURRENT_DATE - INTERVAL '30 days'`,
            [partnerId]
        );
        
        return {
            activeDays: parseInt(portalResult.rows[0].active_days || 0),
            totalLogins: parseInt(portalResult.rows[0].total_logins || 0),
            avgSessionMinutes: parseFloat(portalResult.rows[0].avg_session_minutes || 0),
            resourceDownloads: resourceResult.rows,
            apiUsage: {
                totalCalls: parseInt(apiResult.rows[0].api_calls || 0),
                uniqueEndpoints: parseInt(apiResult.rows[0].unique_endpoints || 0)
            },
            engagementLevel: this.calculateEngagementLevel({
                activeDays: parseInt(portalResult.rows[0].active_days || 0),
                resourceDownloads: resourceResult.rows.length,
                apiCalls: parseInt(apiResult.rows[0].api_calls || 0)
            })
        };
    }
    
    // Calculate success score
    calculateSuccessScore(metrics) {
        const weights = {
            revenue: 0.30,
            clients: 0.25,
            activity: 0.20,
            performance: 0.15,
            engagement: 0.10
        };
        
        let score = 0;
        
        // Revenue score (0-100)
        const revenueScore = Math.min(100, (metrics.revenue.totalRevenue / 100000) * 100);
        score += revenueScore * weights.revenue;
        
        // Client score (0-100)
        const clientScore = (
            (metrics.clients.retentionRate * 0.4) +
            (metrics.clients.satisfactionScore * 20 * 0.3) +
            (Math.min(100, metrics.clients.activeClients * 5) * 0.3)
        );
        score += clientScore * weights.clients;
        
        // Activity score (0-100)
        const activityScore = Math.min(100, (metrics.activity.totalScore / 1000) * 100);
        score += activityScore * weights.activity;
        
        // Performance score (0-100)
        const performanceScore = (
            (metrics.performance.demoConversionRate * 0.3) +
            (metrics.performance.closeRate * 0.4) +
            (Math.max(0, 100 - metrics.performance.avgResponseTime * 4) * 0.3)
        );
        score += performanceScore * weights.performance;
        
        // Engagement score (0-100)
        const engagementScore = Math.min(100, 
            (metrics.engagement.activeDays / 30) * 100 * 0.5 +
            (metrics.engagement.apiUsage.totalCalls / 100) * 100 * 0.5
        );
        score += engagementScore * weights.engagement;
        
        return Math.round(score);
    }
    
    // Generate partner insights
    async generatePartnerInsights(metrics) {
        const insights = [];
        
        // Revenue insights
        if (metrics.revenue.growth > 20) {
            insights.push({
                type: 'positive',
                category: 'revenue',
                message: `Revenue growing strongly at ${metrics.revenue.growth.toFixed(1)}%`,
                impact: 'high'
            });
        } else if (metrics.revenue.growth < -10) {
            insights.push({
                type: 'warning',
                category: 'revenue',
                message: `Revenue declining by ${Math.abs(metrics.revenue.growth).toFixed(1)}%`,
                impact: 'high',
                recommendation: 'Schedule strategy session to identify growth opportunities'
            });
        }
        
        // Client insights
        if (metrics.clients.retentionRate < 80) {
            insights.push({
                type: 'warning',
                category: 'clients',
                message: `Client retention rate at ${metrics.clients.retentionRate.toFixed(1)}%`,
                impact: 'high',
                recommendation: 'Focus on client success and satisfaction initiatives'
            });
        }
        
        // Performance insights
        if (metrics.performance.closeRate > 30) {
            insights.push({
                type: 'positive',
                category: 'performance',
                message: `Excellent close rate of ${metrics.performance.closeRate.toFixed(1)}%`,
                impact: 'medium'
            });
        }
        
        // Engagement insights
        if (metrics.engagement.activeDays < 10) {
            insights.push({
                type: 'info',
                category: 'engagement',
                message: 'Low portal usage detected',
                impact: 'low',
                recommendation: 'Explore new features and resources in the partner portal'
            });
        }
        
        return insights;
    }
    
    // Check partner awards
    async checkPartnerAwards(partnerId, metrics) {
        const awards = [];
        const existingAwards = await this.getPartnerAwards(partnerId);
        
        // Revenue milestones
        const revenueMilestones = [10000, 50000, 100000, 500000, 1000000];
        for (const milestone of revenueMilestones) {
            if (metrics.revenue.totalRevenue >= milestone && 
                !existingAwards.find(a => a.type === 'revenue_milestone' && a.value === milestone)) {
                awards.push({
                    type: 'revenue_milestone',
                    name: `${milestone / 1000}K Revenue Milestone`,
                    value: milestone,
                    icon: '🏆',
                    points: milestone / 1000
                });
            }
        }
        
        // Performance awards
        if (metrics.performance.closeRate > 40 && 
            !existingAwards.find(a => a.type === 'top_performer')) {
            awards.push({
                type: 'top_performer',
                name: 'Top Performer',
                description: 'Achieved 40%+ close rate',
                icon: '⭐',
                points: 500
            });
        }
        
        // Client satisfaction award
        if (metrics.clients.satisfactionScore >= 4.5 && 
            !existingAwards.find(a => a.type === 'client_champion')) {
            awards.push({
                type: 'client_champion',
                name: 'Client Champion',
                description: 'Maintained 4.5+ client satisfaction',
                icon: '❤️',
                points: 300
            });
        }
        
        // Grant awards
        for (const award of awards) {
            await this.grantPartnerAward(partnerId, award);
        }
        
        return awards;
    }
    
    // Generate recommendations
    async generateRecommendations(partnerId, metrics) {
        const recommendations = [];
        
        // Revenue recommendations
        if (metrics.revenue.recurringPercentage < 50) {
            recommendations.push({
                category: 'revenue',
                priority: 'high',
                title: 'Increase Recurring Revenue',
                description: 'Focus on annual contracts and subscription upgrades',
                actions: [
                    'Offer annual contract incentives',
                    'Upsell existing clients to higher tiers',
                    'Introduce clients to value-add features'
                ],
                potentialImpact: '$' + (metrics.revenue.totalRevenue * 0.2).toFixed(0)
            });
        }
        
        // Activity recommendations
        if (metrics.activity.velocity < 0) {
            recommendations.push({
                category: 'activity',
                priority: 'medium',
                title: 'Boost Sales Activities',
                description: 'Increase demo and proposal activities',
                actions: [
                    'Schedule weekly demo sessions',
                    'Follow up on stale opportunities',
                    'Leverage marketing automation tools'
                ]
            });
        }
        
        // Training recommendations
        if (metrics.performance.trainingCompleted < 3) {
            recommendations.push({
                category: 'training',
                priority: 'low',
                title: 'Complete Advanced Training',
                description: 'Enhance skills with advanced courses',
                actions: [
                    'Complete Advanced Sales Training',
                    'Take Technical Certification',
                    'Attend Partner Success Webinar'
                ],
                estimatedTime: '6 hours'
            });
        }
        
        return recommendations;
    }
    
    // Monitor partner health
    async monitorPartnerHealth() {
        try {
            console.log('Monitoring partner health...');
            
            const partners = await this.db.query(
                `SELECT id FROM partners WHERE status = 'active'`
            );
            
            for (const partner of partners.rows) {
                const health = await this.assessPartnerHealth(partner.id);
                
                // Store health status
                await this.db.query(
                    `INSERT INTO partner_health (
                        partner_id, health_score, status, factors,
                        assessed_at
                    ) VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (partner_id) DO UPDATE
                    SET health_score = $2, status = $3, factors = $4, assessed_at = $5`,
                    [
                        partner.id, health.score, health.status,
                        JSON.stringify(health.factors), new Date()
                    ]
                );
                
                // Trigger alerts if needed
                if (health.status === 'at_risk') {
                    await this.triggerHealthAlert(partner.id, health);
                }
            }
            
        } catch (error) {
            console.error(`Error monitoring partner health: ${error.message}`);
        }
    }
    
    // Assess partner health
    async assessPartnerHealth(partnerId) {
        const metrics = await this.trackSuccessMetrics(partnerId);
        
        const healthFactors = {
            revenue: {
                score: metrics.revenue.growth > 0 ? 100 : Math.max(0, 100 + metrics.revenue.growth),
                weight: 0.3
            },
            activity: {
                score: Math.min(100, (metrics.activity.totalActivities / 20) * 100),
                weight: 0.2
            },
            clients: {
                score: metrics.clients.retentionRate,
                weight: 0.25
            },
            engagement: {
                score: Math.min(100, (metrics.engagement.activeDays / 20) * 100),
                weight: 0.15
            },
            satisfaction: {
                score: metrics.clients.satisfactionScore * 20,
                weight: 0.1
            }
        };
        
        let totalScore = 0;
        for (const [factor, data] of Object.entries(healthFactors)) {
            totalScore += data.score * data.weight;
        }
        
        const status = totalScore >= 80 ? 'healthy' : 
                      totalScore >= 60 ? 'stable' : 
                      totalScore >= 40 ? 'at_risk' : 'critical';
        
        return {
            score: Math.round(totalScore),
            status,
            factors: healthFactors,
            trends: {
                improving: metrics.revenue.growth > 0 && metrics.activity.velocity > 0,
                declining: metrics.revenue.growth < -10 || metrics.activity.velocity < -20
            }
        };
    }
    
    // Utility functions
    async getPartnerDetails(partnerId) {
        const result = await this.db.query(
            'SELECT * FROM partners WHERE id = $1',
            [partnerId]
        );
        return result.rows[0];
    }
    
    async getYTDRevenue(partnerId) {
        const result = await this.db.query(
            `SELECT SUM(amount::numeric) as ytd_revenue
            FROM partner_revenue
            WHERE partner_id = $1
            AND EXTRACT(YEAR FROM timestamp) = EXTRACT(YEAR FROM CURRENT_DATE)`,
            [partnerId]
        );
        return new BigNumber(result.rows[0].ytd_revenue || 0);
    }
    
    async isNewClient(partnerId, clientId) {
        const result = await this.db.query(
            `SELECT COUNT(*) as previous_deals
            FROM partner_revenue
            WHERE partner_id = $1 AND client_id = $2
            AND timestamp < CURRENT_DATE - INTERVAL '30 days'`,
            [partnerId, clientId]
        );
        return parseInt(result.rows[0].previous_deals) === 0;
    }
    
    async calculateBonuses(partnerId, revenue) {
        const partner = await this.getPartnerDetails(partnerId);
        const agreement = partner.commission_agreement;
        
        return {
            recurringBonus: agreement.recurringBonus || 0.1,
            newClientBonus: agreement.newClientBonus || 500,
            volumeBonus: revenue.amount.gt(50000) ? 0.05 : 0
        };
    }
    
    async getPerformanceMultiplier(partnerId) {
        const metrics = await this.trackSuccessMetrics(partnerId);
        
        if (metrics.successScore >= 90) return 1.2;
        if (metrics.successScore >= 80) return 1.1;
        if (metrics.successScore >= 70) return 1.0;
        if (metrics.successScore >= 60) return 0.95;
        return 0.9;
    }
    
    calculateClientHealth(data) {
        if (data.retention >= 90 && data.satisfaction >= 4) return 'excellent';
        if (data.retention >= 80 && data.satisfaction >= 3.5) return 'good';
        if (data.retention >= 70 && data.satisfaction >= 3) return 'fair';
        return 'poor';
    }
    
    calculateActivityVelocity(trendData) {
        if (trendData.length < 2) return 0;
        
        const firstWeek = parseInt(trendData[0].count);
        const lastWeek = parseInt(trendData[trendData.length - 1].count);
        
        return ((lastWeek - firstWeek) / firstWeek) * 100;
    }
    
    calculatePerformanceRating(data) {
        const score = (data.demoConversion * 0.3) + 
                     (data.closeRate * 0.4) + 
                     (Math.max(0, 100 - data.responseTime * 4) * 0.3);
        
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        if (score >= 40) return 'fair';
        return 'needs improvement';
    }
    
    calculateEngagementLevel(data) {
        const score = (data.activeDays / 30) * 40 +
                     (Math.min(10, data.resourceDownloads) / 10) * 30 +
                     (Math.min(1000, data.apiCalls) / 1000) * 30;
        
        if (score >= 80) return 'highly engaged';
        if (score >= 60) return 'engaged';
        if (score >= 40) return 'moderately engaged';
        return 'low engagement';
    }
    
    async updateRealTimeMetrics(partnerId, activity) {
        const key = `partner:${partnerId}:metrics`;
        
        await this.redis.hincrby(key, 'total_activities', 1);
        await this.redis.hincrby(key, 'total_score', activity.score);
        await this.redis.hincrby(key, `activity:${activity.type}`, 1);
        
        // Set expiry
        await this.redis.expire(key, 86400); // 24 hours
    }
    
    async checkAchievements(partnerId, activity) {
        // Check for activity-based achievements
        const totalActivities = await this.redis.hget(`partner:${partnerId}:metrics`, 'total_activities');
        
        if (parseInt(totalActivities) === 100) {
            await this.grantPartnerAward(partnerId, {
                type: 'activity_milestone',
                name: 'Century Club',
                description: 'Completed 100 activities',
                icon: '💯',
                points: 100
            });
        }
    }
    
    async triggerAutomatedActions(partnerId, activity) {
        // Trigger automated workflows based on activity
        if (activity.type === 'deal_closed' && activity.impact.revenue > 50000) {
            await this.sendCelebrationEmail(partnerId, activity);
        }
        
        if (activity.type === 'client_onboarded') {
            await this.scheduleFollowUp(partnerId, activity.metadata.clientId, 7);
        }
    }
    
    async getPartnerAwards(partnerId) {
        const result = await this.db.query(
            'SELECT * FROM partner_awards WHERE partner_id = $1',
            [partnerId]
        );
        return result.rows;
    }
    
    async grantPartnerAward(partnerId, award) {
        await this.db.query(
            `INSERT INTO partner_awards (
                partner_id, type, name, description, icon,
                points, granted_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                partnerId, award.type, award.name,
                award.description, award.icon,
                award.points, new Date()
            ]
        );
        
        // Send notification
        await this.sendAwardNotification(partnerId, award);
    }
    
    async triggerHealthAlert(partnerId, health) {
        // Create alert
        await this.db.query(
            `INSERT INTO partner_alerts (
                partner_id, type, severity, message, data,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                partnerId, 'health_risk', 'warning',
                `Partner health declined to ${health.status}`,
                JSON.stringify(health), new Date()
            ]
        );
        
        // Notify account manager
        await this.notifyAccountManager(partnerId, health);
    }
    
    async storeSuccessMetrics(partnerId, metrics) {
        await this.db.query(
            `INSERT INTO partner_success_metrics (
                partner_id, metrics, success_score, created_at
            ) VALUES ($1, $2, $3, $4)`,
            [partnerId, JSON.stringify(metrics), metrics.successScore, new Date()]
        );
    }
    
    async updatePartnerMetrics(partnerId, updates) {
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        
        if (updates.revenue) {
            updateFields.push(`metrics = jsonb_set(metrics, '{totalRevenue}', 
                (COALESCE((metrics->>'totalRevenue')::numeric, 0) + $${paramCount})::text::jsonb)`);
            values.push(updates.revenue.toString());
            paramCount++;
        }
        
        if (updates.commissionEarned) {
            updateFields.push(`metrics = jsonb_set(metrics, '{lifetimeCommission}', 
                (COALESCE((metrics->>'lifetimeCommission')::numeric, 0) + $${paramCount})::text::jsonb)`);
            values.push(updates.commissionEarned.toString());
            paramCount++;
        }
        
        if (updateFields.length > 0) {
            values.push(partnerId);
            await this.db.query(
                `UPDATE partners SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
                values
            );
        }
    }
    
    async checkTierUpgrade(partnerId) {
        const ytdRevenue = await this.getYTDRevenue(partnerId);
        const partner = await this.getPartnerDetails(partnerId);
        
        let newTier = partner.tier;
        
        if (ytdRevenue.gte(1000000) && partner.tier !== 'platinum') {
            newTier = 'platinum';
        } else if (ytdRevenue.gte(500000) && partner.tier !== 'gold') {
            newTier = 'gold';
        } else if (ytdRevenue.gte(100000) && partner.tier !== 'silver') {
            newTier = 'silver';
        }
        
        if (newTier !== partner.tier) {
            await this.db.query(
                'UPDATE partners SET tier = $1 WHERE id = $2',
                [newTier, partnerId]
            );
            
            await this.sendTierUpgradeNotification(partnerId, newTier);
        }
    }
    
    // Payment processing methods
    async processStripePayment(partner, amount) {
        try {
            const transfer = await this.stripe.transfers.create({
                amount: amount.multipliedBy(100).toNumber(), // Convert to cents
                currency: 'usd',
                destination: partner.stripe_account_id,
                description: `Partner commission payout - ${partner.company_name}`
            });
            
            return {
                success: true,
                paymentId: transfer.id,
                amount: amount.toString()
            };
        } catch (error) {
            console.error(`Stripe payment error: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async processPayPalPayment(partner, amount) {
        // PayPal implementation
        return {
            success: true,
            paymentId: `PP-${Date.now()}`,
            amount: amount.toString()
        };
    }
    
    async processBankTransfer(partner, amount) {
        // Bank transfer implementation
        return {
            success: true,
            paymentId: `BT-${Date.now()}`,
            amount: amount.toString()
        };
    }
    
    // Notification methods
    async sendRevenueNotification(partnerId, revenue, commission) {
        const partner = await this.getPartnerDetails(partnerId);
        
        await this.ses.sendEmail({
            Source: 'partners@rootuip.com',
            Destination: { ToAddresses: [partner.email] },
            Message: {
                Subject: { Data: 'New Revenue Recorded - Commission Earned!' },
                Body: {
                    Html: {
                        Data: `
                            <h2>Congratulations! New revenue recorded.</h2>
                            <p>Revenue Amount: $${revenue.amount}</p>
                            <p>Commission Earned: $${commission.amount}</p>
                            <p>Commission Rate: ${(commission.rate * 100).toFixed(1)}%</p>
                        `
                    }
                }
            }
        }).promise();
    }
    
    async sendPayoutNotification(partner, payout, result) {
        await this.ses.sendEmail({
            Source: 'partners@rootuip.com',
            Destination: { ToAddresses: [partner.email] },
            Message: {
                Subject: { Data: 'Commission Payout Processed' },
                Body: {
                    Html: {
                        Data: `
                            <h2>Your commission payout has been processed</h2>
                            <p>Amount: $${payout.amount}</p>
                            <p>Method: ${payout.method}</p>
                            <p>Status: ${result.success ? 'Completed' : 'Failed'}</p>
                            ${result.paymentId ? `<p>Reference: ${result.paymentId}</p>` : ''}
                        `
                    }
                }
            }
        }).promise();
    }
    
    async sendAwardNotification(partnerId, award) {
        const partner = await this.getPartnerDetails(partnerId);
        
        await this.ses.sendEmail({
            Source: 'partners@rootuip.com',
            Destination: { ToAddresses: [partner.email] },
            Message: {
                Subject: { Data: `🎉 Achievement Unlocked: ${award.name}` },
                Body: {
                    Html: {
                        Data: `
                            <h2>${award.icon} ${award.name}</h2>
                            <p>${award.description}</p>
                            <p>Points Earned: ${award.points}</p>
                        `
                    }
                }
            }
        }).promise();
    }
    
    async sendTierUpgradeNotification(partnerId, newTier) {
        const partner = await this.getPartnerDetails(partnerId);
        
        await this.ses.sendEmail({
            Source: 'partners@rootuip.com',
            Destination: { ToAddresses: [partner.email] },
            Message: {
                Subject: { Data: `🚀 Congratulations! You've reached ${newTier} tier` },
                Body: {
                    Html: {
                        Data: `
                            <h2>Your partnership has been upgraded to ${newTier} tier!</h2>
                            <p>Enjoy enhanced benefits and higher commission rates.</p>
                        `
                    }
                }
            }
        }).promise();
    }
    
    async sendCelebrationEmail(partnerId, activity) {
        const partner = await this.getPartnerDetails(partnerId);
        
        await this.ses.sendEmail({
            Source: 'partners@rootuip.com',
            Destination: { ToAddresses: [partner.email] },
            Message: {
                Subject: { Data: '🎊 Congratulations on your big win!' },
                Body: {
                    Html: {
                        Data: `
                            <h2>Amazing job closing a $${activity.impact.revenue} deal!</h2>
                            <p>This is a fantastic achievement. Keep up the great work!</p>
                        `
                    }
                }
            }
        }).promise();
    }
    
    async scheduleFollowUp(partnerId, clientId, daysLater) {
        const followUpDate = new Date(Date.now() + daysLater * 24 * 60 * 60 * 1000);
        
        await this.db.query(
            `INSERT INTO partner_tasks (
                partner_id, type, client_id, due_date,
                title, description, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                partnerId, 'follow_up', clientId, followUpDate,
                'Client follow-up',
                'Check in with newly onboarded client',
                new Date()
            ]
        );
    }
    
    async notifyAccountManager(partnerId, health) {
        // Notify account manager about partner health
        console.log(`Notifying account manager about partner ${partnerId} health: ${health.status}`);
    }
    
    // Report generation
    async generateSuccessReports() {
        try {
            console.log('Generating partner success reports...');
            
            const partners = await this.db.query(
                'SELECT id FROM partners WHERE status = $1',
                ['active']
            );
            
            for (const partner of partners.rows) {
                const report = await this.generatePartnerReport(partner.id);
                await this.storePartnerReport(partner.id, report);
                
                // Send weekly reports on Mondays
                if (new Date().getDay() === 1) {
                    await this.sendPartnerReport(partner.id, report);
                }
            }
            
        } catch (error) {
            console.error(`Error generating reports: ${error.message}`);
        }
    }
    
    async generatePartnerReport(partnerId) {
        const metrics = await this.trackSuccessMetrics(partnerId);
        
        return {
            partnerId,
            period: metrics.period,
            summary: {
                successScore: metrics.successScore,
                totalRevenue: metrics.revenue.totalRevenue,
                activeClients: metrics.clients.activeClients,
                completedActivities: metrics.activity.totalActivities
            },
            highlights: await this.getPartnerHighlights(partnerId),
            insights: await this.generatePartnerInsights(metrics),
            recommendations: await this.generateRecommendations(partnerId, metrics)
        };
    }
    
    async getPartnerHighlights(partnerId) {
        // Get top achievements and milestones
        const highlights = [];
        
        // Biggest deal
        const biggestDeal = await this.db.query(
            `SELECT client_id, amount, timestamp
            FROM partner_revenue
            WHERE partner_id = $1
            AND timestamp >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY amount DESC
            LIMIT 1`,
            [partnerId]
        );
        
        if (biggestDeal.rows.length > 0) {
            highlights.push({
                type: 'revenue',
                title: 'Biggest Deal',
                value: `$${biggestDeal.rows[0].amount}`,
                date: biggestDeal.rows[0].timestamp
            });
        }
        
        return highlights;
    }
    
    async storePartnerReport(partnerId, report) {
        await this.db.query(
            `INSERT INTO partner_reports (
                partner_id, report_data, created_at
            ) VALUES ($1, $2, $3)`,
            [partnerId, JSON.stringify(report), new Date()]
        );
    }
    
    async sendPartnerReport(partnerId, report) {
        const partner = await this.getPartnerDetails(partnerId);
        
        // Generate report HTML
        const reportHtml = this.generateReportHTML(report);
        
        await this.ses.sendEmail({
            Source: 'partners@rootuip.com',
            Destination: { ToAddresses: [partner.email] },
            Message: {
                Subject: { Data: 'Your Weekly Partner Success Report' },
                Body: {
                    Html: { Data: reportHtml }
                }
            }
        }).promise();
    }
    
    generateReportHTML(report) {
        return `
            <html>
                <body style="font-family: Arial, sans-serif;">
                    <h1>Partner Success Report</h1>
                    <h2>Summary</h2>
                    <ul>
                        <li>Success Score: ${report.summary.successScore}/100</li>
                        <li>Revenue: $${report.summary.totalRevenue}</li>
                        <li>Active Clients: ${report.summary.activeClients}</li>
                        <li>Activities: ${report.summary.completedActivities}</li>
                    </ul>
                    <h2>Recommendations</h2>
                    ${report.recommendations.map(rec => `
                        <div>
                            <h3>${rec.title}</h3>
                            <p>${rec.description}</p>
                        </div>
                    `).join('')}
                </body>
            </html>
        `;
    }
    
    // Collect partner metrics
    async collectPartnerMetrics() {
        try {
            const partners = await this.db.query(
                'SELECT id FROM partners WHERE status = $1',
                ['active']
            );
            
            for (const partner of partners.rows) {
                await this.trackSuccessMetrics(partner.id);
            }
            
        } catch (error) {
            console.error(`Error collecting metrics: ${error.message}`);
        }
    }
}

module.exports = PartnerSuccessRevenueSystem;