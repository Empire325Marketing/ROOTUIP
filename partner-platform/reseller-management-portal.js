#!/usr/bin/env node

/**
 * ROOTUIP Partner Platform - Reseller Management Portal
 * Enables logistics consultants and system integrators as resellers
 */

const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

class ResellerManagementPortal {
    constructor(config = {}) {
        this.config = {
            databaseUrl: config.databaseUrl || process.env.PARTNER_DATABASE_URL,
            redisUrl: config.redisUrl || process.env.REDIS_URL,
            jwtSecret: config.jwtSecret || process.env.JWT_SECRET,
            commissionTiers: config.commissionTiers || this.getDefaultCommissionTiers(),
            ...config
        };
        
        // Database connection
        this.db = new Pool({
            connectionString: this.config.databaseUrl,
            max: 20
        });
        
        // Redis for sessions and caching
        this.redis = new Redis(this.config.redisUrl);
        
        // Partner types
        this.partnerTypes = {
            CONSULTANT: 'logistics_consultant',
            INTEGRATOR: 'system_integrator',
            VAR: 'value_added_reseller',
            REFERRAL: 'referral_partner',
            TECHNOLOGY: 'technology_partner'
        };
        
        // Partner tiers
        this.partnerTiers = {
            BRONZE: 'bronze',
            SILVER: 'silver',
            GOLD: 'gold',
            PLATINUM: 'platinum'
        };
        
        // Initialize Express app
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }
    
    // Get default commission tiers
    getDefaultCommissionTiers() {
        return {
            bronze: {
                minRevenue: 0,
                maxRevenue: 50000,
                commissionRate: 0.15,
                benefits: [
                    'Basic partner portal access',
                    'Sales materials',
                    'Email support'
                ]
            },
            silver: {
                minRevenue: 50000,
                maxRevenue: 250000,
                commissionRate: 0.20,
                benefits: [
                    'All Bronze benefits',
                    'Dedicated account manager',
                    'Co-marketing opportunities',
                    'Priority support'
                ]
            },
            gold: {
                minRevenue: 250000,
                maxRevenue: 1000000,
                commissionRate: 0.25,
                benefits: [
                    'All Silver benefits',
                    'Advanced training',
                    'Lead sharing',
                    'Custom demo environment',
                    'Joint sales calls'
                ]
            },
            platinum: {
                minRevenue: 1000000,
                maxRevenue: null,
                commissionRate: 0.30,
                benefits: [
                    'All Gold benefits',
                    'White-label options',
                    'Strategic planning sessions',
                    'Executive briefings',
                    'Custom integrations'
                ]
            }
        };
    }
    
    // Setup middleware
    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Authentication middleware
        this.app.use(async (req, res, next) => {
            const token = req.headers.authorization?.split(' ')[1];
            
            if (token) {
                try {
                    const decoded = jwt.verify(token, this.config.jwtSecret);
                    req.partner = await this.getPartner(decoded.partnerId);
                } catch (error) {
                    // Invalid token
                }
            }
            
            next();
        });
    }
    
    // Setup routes
    setupRoutes() {
        // Public routes
        this.app.post('/api/partners/register', this.registerPartner.bind(this));
        this.app.post('/api/partners/login', this.loginPartner.bind(this));
        
        // Protected routes
        this.app.use('/api/partners/*', this.requireAuth.bind(this));
        
        // Partner management
        this.app.get('/api/partners/profile', this.getPartnerProfile.bind(this));
        this.app.put('/api/partners/profile', this.updatePartnerProfile.bind(this));
        
        // Client management
        this.app.get('/api/partners/clients', this.getPartnerClients.bind(this));
        this.app.post('/api/partners/clients', this.createClient.bind(this));
        this.app.get('/api/partners/clients/:clientId', this.getClient.bind(this));
        
        // Opportunity management
        this.app.get('/api/partners/opportunities', this.getOpportunities.bind(this));
        this.app.post('/api/partners/opportunities', this.createOpportunity.bind(this));
        this.app.put('/api/partners/opportunities/:opportunityId', this.updateOpportunity.bind(this));
        
        // Commission and revenue
        this.app.get('/api/partners/commissions', this.getCommissions.bind(this));
        this.app.get('/api/partners/revenue', this.getRevenueSummary.bind(this));
        
        // Resources
        this.app.get('/api/partners/resources', this.getResources.bind(this));
        this.app.get('/api/partners/training', this.getTrainingMaterials.bind(this));
        
        // Analytics
        this.app.get('/api/partners/analytics', this.getPartnerAnalytics.bind(this));
        
        // Admin routes
        this.app.use('/api/admin/*', this.requireAdmin.bind(this));
        this.app.get('/api/admin/partners', this.getAllPartners.bind(this));
        this.app.put('/api/admin/partners/:partnerId', this.updatePartnerStatus.bind(this));
    }
    
    // Register new partner
    async registerPartner(req, res) {
        try {
            const {
                companyName,
                partnerType,
                contactName,
                email,
                phone,
                password,
                website,
                industry,
                specializations,
                certifications,
                regions
            } = req.body;
            
            // Validate required fields
            if (!companyName || !partnerType || !contactName || !email || !password) {
                return res.status(400).json({
                    error: 'Missing required fields'
                });
            }
            
            // Check if partner already exists
            const existingPartner = await this.db.query(
                'SELECT id FROM partners WHERE email = $1',
                [email]
            );
            
            if (existingPartner.rows.length > 0) {
                return res.status(409).json({
                    error: 'Partner already exists'
                });
            }
            
            // Create partner record
            const partnerId = uuidv4();
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const partner = {
                id: partnerId,
                companyName,
                partnerType,
                tier: this.partnerTiers.BRONZE,
                status: 'pending_approval',
                contactName,
                email,
                phone,
                website,
                industry,
                specializations: specializations || [],
                certifications: certifications || [],
                regions: regions || [],
                createdAt: new Date(),
                updatedAt: new Date(),
                
                // Partner agreement
                agreement: {
                    status: 'pending',
                    sentAt: new Date(),
                    version: '1.0'
                },
                
                // Commission settings
                commission: {
                    rate: this.config.commissionTiers.bronze.commissionRate,
                    tier: 'bronze',
                    customRate: null
                },
                
                // Metrics
                metrics: {
                    totalClients: 0,
                    activeClients: 0,
                    totalRevenue: 0,
                    ytdRevenue: 0,
                    lifetimeCommission: 0
                }
            };
            
            // Save to database
            await this.db.query(
                `INSERT INTO partners (
                    id, company_name, partner_type, tier, status,
                    contact_name, email, phone, password_hash,
                    website, industry, specializations, certifications, regions,
                    agreement, commission, metrics,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
                [
                    partnerId, companyName, partnerType, partner.tier, partner.status,
                    contactName, email, phone, hashedPassword,
                    website, industry, JSON.stringify(specializations), JSON.stringify(certifications), JSON.stringify(regions),
                    JSON.stringify(partner.agreement), JSON.stringify(partner.commission), JSON.stringify(partner.metrics),
                    partner.createdAt, partner.updatedAt
                ]
            );
            
            // Send welcome email
            await this.sendPartnerWelcomeEmail(partner);
            
            // Create onboarding tasks
            await this.createOnboardingTasks(partnerId);
            
            res.status(201).json({
                success: true,
                partnerId,
                message: 'Partner registration successful. Pending approval.'
            });
            
        } catch (error) {
            console.error('Error registering partner:', error);
            res.status(500).json({
                error: 'Failed to register partner'
            });
        }
    }
    
    // Partner login
    async loginPartner(req, res) {
        try {
            const { email, password } = req.body;
            
            // Get partner
            const result = await this.db.query(
                'SELECT id, email, password_hash, status FROM partners WHERE email = $1',
                [email]
            );
            
            if (result.rows.length === 0) {
                return res.status(401).json({
                    error: 'Invalid credentials'
                });
            }
            
            const partner = result.rows[0];
            
            // Check password
            const validPassword = await bcrypt.compare(password, partner.password_hash);
            if (!validPassword) {
                return res.status(401).json({
                    error: 'Invalid credentials'
                });
            }
            
            // Check status
            if (partner.status !== 'active') {
                return res.status(403).json({
                    error: `Account ${partner.status}`
                });
            }
            
            // Generate token
            const token = jwt.sign(
                { partnerId: partner.id, email: partner.email },
                this.config.jwtSecret,
                { expiresIn: '24h' }
            );
            
            // Update last login
            await this.db.query(
                'UPDATE partners SET last_login = $1 WHERE id = $2',
                [new Date(), partner.id]
            );
            
            res.json({
                success: true,
                token,
                partnerId: partner.id
            });
            
        } catch (error) {
            console.error('Error logging in partner:', error);
            res.status(500).json({
                error: 'Failed to login'
            });
        }
    }
    
    // Get partner profile
    async getPartnerProfile(req, res) {
        try {
            const partner = req.partner;
            
            // Remove sensitive data
            delete partner.password_hash;
            
            // Get additional data
            const clients = await this.db.query(
                'SELECT COUNT(*) as total, COUNT(CASE WHEN status = $1 THEN 1 END) as active FROM clients WHERE partner_id = $2',
                ['active', partner.id]
            );
            
            partner.clientStats = {
                total: parseInt(clients.rows[0].total),
                active: parseInt(clients.rows[0].active)
            };
            
            res.json({
                success: true,
                partner
            });
            
        } catch (error) {
            console.error('Error getting partner profile:', error);
            res.status(500).json({
                error: 'Failed to get profile'
            });
        }
    }
    
    // Create client
    async createClient(req, res) {
        try {
            const partnerId = req.partner.id;
            const {
                companyName,
                contactName,
                email,
                phone,
                industry,
                companySize,
                requirements,
                estimatedVolume
            } = req.body;
            
            const clientId = uuidv4();
            const tenantId = uuidv4();
            
            // Create client record
            const client = {
                id: clientId,
                partnerId,
                tenantId,
                companyName,
                contactName,
                email,
                phone,
                industry,
                companySize,
                requirements: requirements || {},
                estimatedVolume,
                status: 'trial',
                trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                subscription: {
                    plan: 'trial',
                    status: 'active',
                    startDate: new Date()
                },
                createdAt: new Date()
            };
            
            // Save client
            await this.db.query(
                `INSERT INTO clients (
                    id, partner_id, tenant_id, company_name,
                    contact_name, email, phone, industry, company_size,
                    requirements, estimated_volume, status, trial_ends_at,
                    subscription, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                [
                    clientId, partnerId, tenantId, companyName,
                    contactName, email, phone, industry, companySize,
                    JSON.stringify(requirements), estimatedVolume, client.status, client.trialEndsAt,
                    JSON.stringify(client.subscription), client.createdAt
                ]
            );
            
            // Create tenant
            await this.createTenantForClient(client);
            
            // Update partner metrics
            await this.updatePartnerMetrics(partnerId);
            
            // Send welcome email to client
            await this.sendClientWelcomeEmail(client, req.partner);
            
            res.status(201).json({
                success: true,
                clientId,
                tenantId,
                client
            });
            
        } catch (error) {
            console.error('Error creating client:', error);
            res.status(500).json({
                error: 'Failed to create client'
            });
        }
    }
    
    // Get partner clients
    async getPartnerClients(req, res) {
        try {
            const partnerId = req.partner.id;
            const { status, page = 1, limit = 20 } = req.query;
            
            let query = 'SELECT * FROM clients WHERE partner_id = $1';
            const params = [partnerId];
            
            if (status) {
                query += ' AND status = $2';
                params.push(status);
            }
            
            query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
            params.push(limit, (page - 1) * limit);
            
            const result = await this.db.query(query, params);
            
            // Get total count
            let countQuery = 'SELECT COUNT(*) FROM clients WHERE partner_id = $1';
            const countParams = [partnerId];
            
            if (status) {
                countQuery += ' AND status = $2';
                countParams.push(status);
            }
            
            const countResult = await this.db.query(countQuery, countParams);
            const total = parseInt(countResult.rows[0].count);
            
            res.json({
                success: true,
                clients: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });
            
        } catch (error) {
            console.error('Error getting partner clients:', error);
            res.status(500).json({
                error: 'Failed to get clients'
            });
        }
    }
    
    // Create opportunity
    async createOpportunity(req, res) {
        try {
            const partnerId = req.partner.id;
            const {
                clientName,
                contactName,
                email,
                value,
                stage,
                probability,
                expectedCloseDate,
                description,
                requirements
            } = req.body;
            
            const opportunityId = uuidv4();
            
            const opportunity = {
                id: opportunityId,
                partnerId,
                clientName,
                contactName,
                email,
                value,
                stage: stage || 'qualification',
                probability: probability || 25,
                expectedCloseDate,
                description,
                requirements: requirements || {},
                status: 'open',
                activities: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Save opportunity
            await this.db.query(
                `INSERT INTO opportunities (
                    id, partner_id, client_name, contact_name, email,
                    value, stage, probability, expected_close_date,
                    description, requirements, status, activities,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
                [
                    opportunityId, partnerId, clientName, contactName, email,
                    value, opportunity.stage, opportunity.probability, expectedCloseDate,
                    description, JSON.stringify(requirements), opportunity.status, JSON.stringify(opportunity.activities),
                    opportunity.createdAt, opportunity.updatedAt
                ]
            );
            
            // Create initial activity
            await this.addOpportunityActivity(opportunityId, {
                type: 'created',
                description: 'Opportunity created',
                user: req.partner.contact_name
            });
            
            res.status(201).json({
                success: true,
                opportunityId,
                opportunity
            });
            
        } catch (error) {
            console.error('Error creating opportunity:', error);
            res.status(500).json({
                error: 'Failed to create opportunity'
            });
        }
    }
    
    // Get commissions
    async getCommissions(req, res) {
        try {
            const partnerId = req.partner.id;
            const { startDate, endDate, status } = req.query;
            
            let query = `
                SELECT 
                    c.*,
                    cl.company_name as client_name,
                    cl.subscription->>'plan' as plan
                FROM commissions c
                JOIN clients cl ON c.client_id = cl.id
                WHERE c.partner_id = $1
            `;
            const params = [partnerId];
            
            if (startDate && endDate) {
                query += ' AND c.period_start >= $2 AND c.period_end <= $3';
                params.push(startDate, endDate);
            }
            
            if (status) {
                query += ' AND c.status = $' + (params.length + 1);
                params.push(status);
            }
            
            query += ' ORDER BY c.created_at DESC';
            
            const result = await this.db.query(query, params);
            
            // Calculate totals
            const totals = {
                pending: 0,
                approved: 0,
                paid: 0
            };
            
            result.rows.forEach(commission => {
                totals[commission.status] += parseFloat(commission.amount);
            });
            
            res.json({
                success: true,
                commissions: result.rows,
                totals
            });
            
        } catch (error) {
            console.error('Error getting commissions:', error);
            res.status(500).json({
                error: 'Failed to get commissions'
            });
        }
    }
    
    // Calculate partner commission
    async calculatePartnerCommission(partnerId, clientId, revenue, period) {
        try {
            const partner = await this.getPartner(partnerId);
            const client = await this.getClientById(clientId);
            
            // Get commission rate based on tier
            let commissionRate = partner.commission.customRate || 
                this.config.commissionTiers[partner.tier].commissionRate;
            
            // Apply special rates
            if (client.subscription.plan === 'enterprise') {
                commissionRate *= 1.2; // 20% bonus for enterprise clients
            }
            
            // Calculate commission
            const commissionAmount = revenue * commissionRate;
            
            // Create commission record
            const commissionId = uuidv4();
            
            await this.db.query(
                `INSERT INTO commissions (
                    id, partner_id, client_id, period_start, period_end,
                    revenue, rate, amount, status, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    commissionId, partnerId, clientId, period.start, period.end,
                    revenue, commissionRate, commissionAmount, 'pending', new Date()
                ]
            );
            
            // Update partner metrics
            await this.db.query(
                `UPDATE partners 
                SET metrics = jsonb_set(
                    jsonb_set(metrics, '{ytdRevenue}', to_jsonb((metrics->>'ytdRevenue')::numeric + $1)),
                    '{lifetimeCommission}', to_jsonb((metrics->>'lifetimeCommission')::numeric + $2)
                )
                WHERE id = $3`,
                [revenue, commissionAmount, partnerId]
            );
            
            return {
                commissionId,
                amount: commissionAmount,
                rate: commissionRate
            };
            
        } catch (error) {
            console.error('Error calculating commission:', error);
            throw error;
        }
    }
    
    // Get partner analytics
    async getPartnerAnalytics(req, res) {
        try {
            const partnerId = req.partner.id;
            const { period = '30d' } = req.query;
            
            const analytics = {
                overview: await this.getPartnerOverview(partnerId),
                revenue: await this.getRevenueAnalytics(partnerId, period),
                clients: await this.getClientAnalytics(partnerId, period),
                opportunities: await this.getOpportunityAnalytics(partnerId),
                performance: await this.getPerformanceMetrics(partnerId, period)
            };
            
            res.json({
                success: true,
                analytics
            });
            
        } catch (error) {
            console.error('Error getting partner analytics:', error);
            res.status(500).json({
                error: 'Failed to get analytics'
            });
        }
    }
    
    // Get partner overview
    async getPartnerOverview(partnerId) {
        const partner = await this.getPartner(partnerId);
        
        // Current month revenue
        const currentMonthResult = await this.db.query(
            `SELECT SUM(revenue) as revenue, SUM(amount) as commission
            FROM commissions
            WHERE partner_id = $1
            AND period_start >= DATE_TRUNC('month', CURRENT_DATE)`,
            [partnerId]
        );
        
        // Previous month revenue
        const previousMonthResult = await this.db.query(
            `SELECT SUM(revenue) as revenue
            FROM commissions
            WHERE partner_id = $1
            AND period_start >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
            AND period_start < DATE_TRUNC('month', CURRENT_DATE)`,
            [partnerId]
        );
        
        const currentRevenue = parseFloat(currentMonthResult.rows[0].revenue || 0);
        const previousRevenue = parseFloat(previousMonthResult.rows[0].revenue || 0);
        const revenueGrowth = previousRevenue > 0 ? 
            ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
        
        return {
            tier: partner.tier,
            status: partner.status,
            currentMonthRevenue: currentRevenue,
            currentMonthCommission: parseFloat(currentMonthResult.rows[0].commission || 0),
            revenueGrowth: revenueGrowth.toFixed(1),
            totalClients: partner.metrics.totalClients,
            activeClients: partner.metrics.activeClients,
            conversionRate: partner.metrics.totalClients > 0 ?
                ((partner.metrics.activeClients / partner.metrics.totalClients) * 100).toFixed(1) : 0
        };
    }
    
    // Get revenue analytics
    async getRevenueAnalytics(partnerId, period) {
        const periodDays = parseInt(period) || 30;
        
        const result = await this.db.query(
            `SELECT 
                DATE_TRUNC('day', period_start) as date,
                SUM(revenue) as revenue,
                SUM(amount) as commission
            FROM commissions
            WHERE partner_id = $1
            AND period_start >= CURRENT_DATE - INTERVAL '${periodDays} days'
            GROUP BY DATE_TRUNC('day', period_start)
            ORDER BY date`,
            [partnerId]
        );
        
        return {
            chart: result.rows,
            total: result.rows.reduce((sum, row) => sum + parseFloat(row.revenue), 0),
            totalCommission: result.rows.reduce((sum, row) => sum + parseFloat(row.commission), 0)
        };
    }
    
    // Get client analytics
    async getClientAnalytics(partnerId, period) {
        const periodDays = parseInt(period) || 30;
        
        // New clients
        const newClientsResult = await this.db.query(
            `SELECT COUNT(*) as count
            FROM clients
            WHERE partner_id = $1
            AND created_at >= CURRENT_DATE - INTERVAL '${periodDays} days'`,
            [partnerId]
        );
        
        // Client distribution by status
        const statusResult = await this.db.query(
            `SELECT status, COUNT(*) as count
            FROM clients
            WHERE partner_id = $1
            GROUP BY status`,
            [partnerId]
        );
        
        // Client distribution by plan
        const planResult = await this.db.query(
            `SELECT subscription->>'plan' as plan, COUNT(*) as count
            FROM clients
            WHERE partner_id = $1
            GROUP BY subscription->>'plan'`,
            [partnerId]
        );
        
        return {
            newClients: parseInt(newClientsResult.rows[0].count),
            byStatus: statusResult.rows,
            byPlan: planResult.rows
        };
    }
    
    // Get opportunity analytics
    async getOpportunityAnalytics(partnerId) {
        // Pipeline value by stage
        const pipelineResult = await this.db.query(
            `SELECT stage, SUM(value) as value, COUNT(*) as count
            FROM opportunities
            WHERE partner_id = $1
            AND status = 'open'
            GROUP BY stage`,
            [partnerId]
        );
        
        // Win rate
        const winRateResult = await this.db.query(
            `SELECT 
                COUNT(CASE WHEN status = 'won' THEN 1 END) as won,
                COUNT(CASE WHEN status IN ('won', 'lost') THEN 1 END) as total
            FROM opportunities
            WHERE partner_id = $1`,
            [partnerId]
        );
        
        const winRate = winRateResult.rows[0].total > 0 ?
            (winRateResult.rows[0].won / winRateResult.rows[0].total) * 100 : 0;
        
        return {
            pipeline: pipelineResult.rows,
            totalPipelineValue: pipelineResult.rows.reduce((sum, row) => sum + parseFloat(row.value), 0),
            winRate: winRate.toFixed(1),
            averageDealSize: pipelineResult.rows.length > 0 ?
                pipelineResult.rows.reduce((sum, row) => sum + parseFloat(row.value), 0) / 
                pipelineResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0) : 0
        };
    }
    
    // Get performance metrics
    async getPerformanceMetrics(partnerId, period) {
        const periodDays = parseInt(period) || 30;
        
        // Client satisfaction (mock data for demo)
        const satisfaction = {
            score: 4.5,
            responses: 24
        };
        
        // Support tickets
        const supportResult = await this.db.query(
            `SELECT 
                COUNT(*) as total,
                AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
            FROM support_tickets
            WHERE partner_id = $1
            AND created_at >= CURRENT_DATE - INTERVAL '${periodDays} days'`,
            [partnerId]
        );
        
        // Training completion
        const trainingResult = await this.db.query(
            `SELECT 
                COUNT(DISTINCT user_id) as users_trained,
                COUNT(DISTINCT course_id) as courses_completed
            FROM training_completions
            WHERE partner_id = $1
            AND completed_at >= CURRENT_DATE - INTERVAL '${periodDays} days'`,
            [partnerId]
        );
        
        return {
            clientSatisfaction: satisfaction,
            supportMetrics: {
                ticketsCreated: parseInt(supportResult.rows[0].total || 0),
                avgResolutionTime: parseFloat(supportResult.rows[0].avg_resolution_hours || 0).toFixed(1)
            },
            training: {
                usersTrained: parseInt(trainingResult.rows[0].users_trained || 0),
                coursesCompleted: parseInt(trainingResult.rows[0].courses_completed || 0)
            }
        };
    }
    
    // Get resources
    async getResources(req, res) {
        try {
            const partnerId = req.partner.id;
            const partner = req.partner;
            
            const resources = {
                salesMaterials: await this.getSalesMaterials(partner.tier),
                marketingAssets: await this.getMarketingAssets(partner.tier),
                technicalDocs: await this.getTechnicalDocumentation(partner.tier),
                training: await this.getTrainingResources(partner.tier),
                tools: await this.getPartnerTools(partner.tier)
            };
            
            res.json({
                success: true,
                resources
            });
            
        } catch (error) {
            console.error('Error getting resources:', error);
            res.status(500).json({
                error: 'Failed to get resources'
            });
        }
    }
    
    // Get sales materials
    async getSalesMaterials(tier) {
        const materials = [
            {
                id: 'pitch-deck',
                name: 'ROOTUIP Partner Pitch Deck',
                type: 'presentation',
                description: 'Comprehensive pitch deck for partner presentations',
                url: '/resources/sales/pitch-deck.pptx',
                updated: '2024-01-15'
            },
            {
                id: 'case-studies',
                name: 'Customer Success Stories',
                type: 'document',
                description: 'Collection of customer case studies and testimonials',
                url: '/resources/sales/case-studies.pdf',
                updated: '2024-01-20'
            },
            {
                id: 'roi-calculator',
                name: 'ROI Calculator',
                type: 'tool',
                description: 'Interactive ROI calculator for prospects',
                url: '/tools/roi-calculator',
                updated: '2024-01-10'
            },
            {
                id: 'competitive-analysis',
                name: 'Competitive Analysis',
                type: 'document',
                description: 'Detailed competitive positioning guide',
                url: '/resources/sales/competitive-analysis.pdf',
                updated: '2024-01-05',
                restricted: ['silver', 'gold', 'platinum']
            }
        ];
        
        // Filter based on tier
        return materials.filter(material => 
            !material.restricted || material.restricted.includes(tier)
        );
    }
    
    // Get marketing assets
    async getMarketingAssets(tier) {
        const assets = [
            {
                id: 'logos',
                name: 'Partner Co-Branding Logos',
                type: 'assets',
                description: 'Approved co-branded logos and guidelines',
                formats: ['PNG', 'SVG', 'EPS'],
                url: '/resources/marketing/logos.zip'
            },
            {
                id: 'email-templates',
                name: 'Email Campaign Templates',
                type: 'templates',
                description: 'Pre-approved email templates for campaigns',
                count: 12,
                url: '/resources/marketing/email-templates'
            },
            {
                id: 'social-media',
                name: 'Social Media Kit',
                type: 'assets',
                description: 'Social media posts, images, and guidelines',
                platforms: ['LinkedIn', 'Twitter', 'Facebook'],
                url: '/resources/marketing/social-media-kit.zip'
            },
            {
                id: 'webinar-kit',
                name: 'Webinar Resources',
                type: 'materials',
                description: 'Everything needed to run partner webinars',
                url: '/resources/marketing/webinar-kit',
                restricted: ['gold', 'platinum']
            }
        ];
        
        return assets.filter(asset => 
            !asset.restricted || asset.restricted.includes(tier)
        );
    }
    
    // Create tenant for client
    async createTenantForClient(client) {
        // This would integrate with the TenantIsolationSystem
        console.log(`Creating tenant ${client.tenantId} for client ${client.id}`);
        
        // Mock implementation
        const tenantConfig = {
            id: client.tenantId,
            name: client.companyName,
            plan: 'trial',
            features: {
                shipmentTracking: true,
                containerManagement: true,
                documentManagement: true,
                basicReporting: true,
                apiAccess: true
            }
        };
        
        // Would call tenant creation service
        return tenantConfig;
    }
    
    // Middleware functions
    requireAuth(req, res, next) {
        if (!req.partner) {
            return res.status(401).json({
                error: 'Authentication required'
            });
        }
        next();
    }
    
    requireAdmin(req, res, next) {
        if (!req.partner || req.partner.role !== 'admin') {
            return res.status(403).json({
                error: 'Admin access required'
            });
        }
        next();
    }
    
    // Utility functions
    async getPartner(partnerId) {
        const result = await this.db.query(
            'SELECT * FROM partners WHERE id = $1',
            [partnerId]
        );
        
        return result.rows[0];
    }
    
    async getClientById(clientId) {
        const result = await this.db.query(
            'SELECT * FROM clients WHERE id = $1',
            [clientId]
        );
        
        return result.rows[0];
    }
    
    async updatePartnerMetrics(partnerId) {
        // Update client counts
        await this.db.query(
            `UPDATE partners 
            SET metrics = jsonb_set(
                jsonb_set(metrics, '{totalClients}', 
                    (SELECT COUNT(*)::text::jsonb FROM clients WHERE partner_id = $1)
                ),
                '{activeClients}',
                (SELECT COUNT(*)::text::jsonb FROM clients WHERE partner_id = $1 AND status = 'active')
            )
            WHERE id = $1`,
            [partnerId]
        );
    }
    
    async createOnboardingTasks(partnerId) {
        const tasks = [
            { task: 'Complete partner agreement', due: 7 },
            { task: 'Complete onboarding training', due: 14 },
            { task: 'Set up first client demo', due: 21 },
            { task: 'Submit first opportunity', due: 30 }
        ];
        
        for (const task of tasks) {
            await this.db.query(
                `INSERT INTO partner_tasks (
                    partner_id, task, status, due_date, created_at
                ) VALUES ($1, $2, $3, $4, $5)`,
                [
                    partnerId,
                    task.task,
                    'pending',
                    new Date(Date.now() + task.due * 24 * 60 * 60 * 1000),
                    new Date()
                ]
            );
        }
    }
    
    async sendPartnerWelcomeEmail(partner) {
        // Email sending implementation
        console.log(`Sending welcome email to partner: ${partner.email}`);
    }
    
    async sendClientWelcomeEmail(client, partner) {
        // Email sending implementation
        console.log(`Sending welcome email to client: ${client.email}`);
    }
    
    async addOpportunityActivity(opportunityId, activity) {
        await this.db.query(
            `UPDATE opportunities 
            SET activities = activities || $1::jsonb,
                updated_at = $2
            WHERE id = $3`,
            [JSON.stringify({...activity, timestamp: new Date()}), new Date(), opportunityId]
        );
    }
    
    async getTrainingMaterials(req, res) {
        try {
            const materials = [
                {
                    id: 'onboarding',
                    name: 'Partner Onboarding Course',
                    type: 'course',
                    duration: '2 hours',
                    modules: 5,
                    required: true
                },
                {
                    id: 'sales-training',
                    name: 'ROOTUIP Sales Certification',
                    type: 'course',
                    duration: '4 hours',
                    modules: 8,
                    certification: true
                },
                {
                    id: 'technical-training',
                    name: 'Technical Implementation Guide',
                    type: 'course',
                    duration: '6 hours',
                    modules: 10,
                    certification: true
                }
            ];
            
            res.json({
                success: true,
                materials
            });
            
        } catch (error) {
            console.error('Error getting training materials:', error);
            res.status(500).json({
                error: 'Failed to get training materials'
            });
        }
    }
    
    async getOpportunities(req, res) {
        try {
            const partnerId = req.partner.id;
            const { stage, status } = req.query;
            
            let query = 'SELECT * FROM opportunities WHERE partner_id = $1';
            const params = [partnerId];
            
            if (stage) {
                query += ' AND stage = $' + (params.length + 1);
                params.push(stage);
            }
            
            if (status) {
                query += ' AND status = $' + (params.length + 1);
                params.push(status);
            }
            
            query += ' ORDER BY created_at DESC';
            
            const result = await this.db.query(query, params);
            
            res.json({
                success: true,
                opportunities: result.rows
            });
            
        } catch (error) {
            console.error('Error getting opportunities:', error);
            res.status(500).json({
                error: 'Failed to get opportunities'
            });
        }
    }
    
    async updateOpportunity(req, res) {
        try {
            const { opportunityId } = req.params;
            const updates = req.body;
            
            // Build update query
            const updateFields = [];
            const values = [];
            let paramCount = 1;
            
            Object.entries(updates).forEach(([key, value]) => {
                if (['stage', 'probability', 'value', 'expected_close_date', 'status'].includes(key)) {
                    updateFields.push(`${key} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            });
            
            updateFields.push(`updated_at = $${paramCount}`);
            values.push(new Date());
            values.push(opportunityId);
            
            await this.db.query(
                `UPDATE opportunities SET ${updateFields.join(', ')} WHERE id = $${paramCount + 1}`,
                values
            );
            
            // Add activity
            await this.addOpportunityActivity(opportunityId, {
                type: 'updated',
                description: `Updated: ${Object.keys(updates).join(', ')}`,
                user: req.partner.contact_name
            });
            
            res.json({
                success: true
            });
            
        } catch (error) {
            console.error('Error updating opportunity:', error);
            res.status(500).json({
                error: 'Failed to update opportunity'
            });
        }
    }
    
    async getRevenueSummary(req, res) {
        try {
            const partnerId = req.partner.id;
            
            // Current year revenue
            const yearResult = await this.db.query(
                `SELECT 
                    EXTRACT(MONTH FROM period_start) as month,
                    SUM(revenue) as revenue,
                    SUM(amount) as commission
                FROM commissions
                WHERE partner_id = $1
                AND EXTRACT(YEAR FROM period_start) = EXTRACT(YEAR FROM CURRENT_DATE)
                GROUP BY EXTRACT(MONTH FROM period_start)
                ORDER BY month`,
                [partnerId]
            );
            
            // Forecast
            const avgMonthlyRevenue = yearResult.rows.length > 0 ?
                yearResult.rows.reduce((sum, row) => sum + parseFloat(row.revenue), 0) / yearResult.rows.length : 0;
            
            const currentMonth = new Date().getMonth() + 1;
            const remainingMonths = 12 - currentMonth;
            const yearForecast = yearResult.rows.reduce((sum, row) => sum + parseFloat(row.revenue), 0) +
                (avgMonthlyRevenue * remainingMonths);
            
            res.json({
                success: true,
                summary: {
                    ytdRevenue: yearResult.rows.reduce((sum, row) => sum + parseFloat(row.revenue), 0),
                    ytdCommission: yearResult.rows.reduce((sum, row) => sum + parseFloat(row.commission), 0),
                    monthlyBreakdown: yearResult.rows,
                    yearForecast,
                    avgMonthlyRevenue
                }
            });
            
        } catch (error) {
            console.error('Error getting revenue summary:', error);
            res.status(500).json({
                error: 'Failed to get revenue summary'
            });
        }
    }
    
    async getClient(req, res) {
        try {
            const { clientId } = req.params;
            const partnerId = req.partner.id;
            
            const result = await this.db.query(
                'SELECT * FROM clients WHERE id = $1 AND partner_id = $2',
                [clientId, partnerId]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Client not found'
                });
            }
            
            res.json({
                success: true,
                client: result.rows[0]
            });
            
        } catch (error) {
            console.error('Error getting client:', error);
            res.status(500).json({
                error: 'Failed to get client'
            });
        }
    }
    
    async getTechnicalDocumentation(tier) {
        return [
            {
                id: 'api-docs',
                name: 'API Documentation',
                description: 'Complete API reference and integration guides',
                url: '/docs/api'
            },
            {
                id: 'integration-guide',
                name: 'Integration Guide',
                description: 'Step-by-step integration instructions',
                url: '/docs/integration'
            },
            {
                id: 'webhook-guide',
                name: 'Webhook Implementation',
                description: 'Guide for implementing webhooks',
                url: '/docs/webhooks'
            }
        ];
    }
    
    async getTrainingResources(tier) {
        return [
            {
                id: 'video-library',
                name: 'Training Video Library',
                description: 'On-demand training videos',
                videos: 24,
                url: '/training/videos'
            },
            {
                id: 'certification',
                name: 'Partner Certification Program',
                description: 'Become a certified ROOTUIP partner',
                tracks: ['Sales', 'Technical', 'Implementation'],
                url: '/training/certification'
            }
        ];
    }
    
    async getPartnerTools(tier) {
        return [
            {
                id: 'demo-environment',
                name: 'Demo Environment',
                description: 'Fully functional demo instance',
                url: 'https://demo.rootuip.com',
                credentials: {
                    username: 'partner_demo',
                    password: 'demo123'
                }
            },
            {
                id: 'quote-builder',
                name: 'Quote Builder',
                description: 'Generate customer quotes',
                url: '/tools/quote-builder',
                restricted: ['silver', 'gold', 'platinum']
            },
            {
                id: 'deal-registration',
                name: 'Deal Registration',
                description: 'Register and protect your deals',
                url: '/tools/deal-registration',
                restricted: ['gold', 'platinum']
            }
        ];
    }
    
    async getAllPartners(req, res) {
        try {
            const result = await this.db.query(
                'SELECT * FROM partners ORDER BY created_at DESC'
            );
            
            res.json({
                success: true,
                partners: result.rows
            });
            
        } catch (error) {
            console.error('Error getting all partners:', error);
            res.status(500).json({
                error: 'Failed to get partners'
            });
        }
    }
    
    async updatePartnerStatus(req, res) {
        try {
            const { partnerId } = req.params;
            const { status, tier } = req.body;
            
            const updates = [];
            const values = [];
            let paramCount = 1;
            
            if (status) {
                updates.push(`status = $${paramCount}`);
                values.push(status);
                paramCount++;
            }
            
            if (tier) {
                updates.push(`tier = $${paramCount}`);
                values.push(tier);
                paramCount++;
            }
            
            updates.push(`updated_at = $${paramCount}`);
            values.push(new Date());
            values.push(partnerId);
            
            await this.db.query(
                `UPDATE partners SET ${updates.join(', ')} WHERE id = $${paramCount + 1}`,
                values
            );
            
            res.json({
                success: true
            });
            
        } catch (error) {
            console.error('Error updating partner status:', error);
            res.status(500).json({
                error: 'Failed to update partner'
            });
        }
    }
    
    // Start server
    start(port = 3005) {
        this.app.listen(port, () => {
            console.log(`Partner Portal running on port ${port}`);
        });
    }
}

module.exports = ResellerManagementPortal;