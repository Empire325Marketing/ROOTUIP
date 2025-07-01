// ROOTUIP Enterprise Lead Generation System - SECURED VERSION
// Automated B2B lead capture, qualification, and nurturing with JWT/API Key authentication

const express = require('express');
const { Pool } = require('pg');
const Redis = require('redis');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const cors = require('cors');
const AuthMiddleware = require('./auth-middleware');

class SecureLeadGenerationSystem {
    constructor() {
        this.app = express();
        this.port = process.env.LEAD_GEN_PORT || 3018;
        
        // Initialize authentication
        this.auth = new AuthMiddleware();
        
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        this.redis = Redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        
        // Lead scoring configuration (same as original)
        this.leadScoring = {
            vesselCount: {
                '1-10': 10,
                '11-50': 25,
                '51-200': 40,
                '200+': 50
            },
            annualRevenue: {
                '<$50M': 5,
                '$50M-$250M': 15,
                '$250M-$1B': 30,
                '$1B+': 40
            },
            engagement: {
                roiCalculatorCompleted: 30,
                demoRequested: 40,
                assessmentCompleted: 25,
                caseStudyDownloaded: 15,
                pricingViewed: 20,
                multipleVisits: 10,
                emailOpened: 5,
                emailClicked: 10
            },
            timeline: {
                'immediate': 50,
                '1-3months': 30,
                '3-6months': 20,
                '6months+': 10,
                'exploring': 5
            },
            thresholds: {
                hot: 150,
                warm: 100,
                cool: 50,
                cold: 0
            }
        };
        
        // HubSpot configuration
        this.hubspot = {
            apiKey: process.env.HUBSPOT_API_KEY,
            portalId: process.env.HUBSPOT_PORTAL_ID,
            baseUrl: 'https://api.hubapi.com',
            dealStages: {
                'discovery': '1',
                'demo_scheduled': '2',
                'proposal_sent': '3',
                'negotiation': '4',
                'closed_won': '5',
                'closed_lost': '6'
            },
            customProperties: {
                vessel_count: 'vessel_count',
                annual_container_volume: 'annual_container_volume',
                current_detention_costs: 'current_detention_costs',
                implementation_timeline: 'implementation_timeline',
                decision_maker: 'decision_maker',
                lead_score: 'lead_score',
                roi_calculated: 'roi_calculated'
            }
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.initializeAutomation();
    }
    
    setupMiddleware() {
        // Security headers
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://www.google-analytics.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "https://api.hubapi.com", "https://api.sendgrid.com"]
                }
            }
        }));
        
        // CORS with proper configuration
        this.app.use(cors(this.auth.getCorsOptions()));
        
        // Body parsing with size limits
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Security logging
        this.app.use(this.auth.securityLogger());
        
        // Global rate limiting
        this.app.use(this.auth.getRateLimiters().api);
        
        // Input sanitization
        this.app.use(this.auth.sanitizeInput());
    }
    
    setupRoutes() {
        // Public auth endpoint to get JWT token
        this.app.post('/api/auth/token', 
            this.auth.getRateLimiters().auth,
            this.auth.validateInput({
                apiKey: { required: true, type: 'string', minLength: 20 }
            }),
            async (req, res) => {
                try {
                    const { apiKey } = req.body;
                    
                    // Verify API key
                    let validClient = null;
                    for (const [client, data] of this.auth.apiKeys) {
                        const bcrypt = require('bcryptjs');
                        if (await bcrypt.compare(apiKey, data.key)) {
                            validClient = client;
                            break;
                        }
                    }
                    
                    if (!validClient) {
                        return res.status(401).json({ error: 'Invalid API key' });
                    }
                    
                    // Generate JWT token
                    const token = this.auth.generateToken({
                        client: validClient,
                        permissions: ['read', 'write'],
                        type: 'api_access'
                    });
                    
                    res.json({
                        token,
                        expiresIn: '7d',
                        type: 'Bearer'
                    });
                } catch (error) {
                    console.error('Token generation error:', error);
                    res.status(500).json({ error: 'Failed to generate token' });
                }
            }
        );
        
        // Progressive profiling form - PUBLIC endpoint with rate limiting
        this.app.post('/api/lead-gen/progressive-profile',
            this.auth.getRateLimiters().public,
            this.auth.validateInput({
                email: { 
                    required: true, 
                    type: 'string', 
                    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    maxLength: 255
                },
                firstName: { type: 'string', maxLength: 100 },
                lastName: { type: 'string', maxLength: 100 },
                company: { type: 'string', maxLength: 200 },
                step: { type: 'number' }
            }),
            async (req, res) => {
                try {
                    const result = await this.handleProgressiveProfile(req.body);
                    res.json(result);
                } catch (error) {
                    console.error('Progressive profile error:', error);
                    res.status(500).json({ error: 'Failed to process profile' });
                }
            }
        );
        
        // ROI Calculator submission - PUBLIC endpoint with rate limiting
        this.app.post('/api/lead-gen/roi-calculator',
            this.auth.getRateLimiters().public,
            this.auth.validateInput({
                email: { 
                    required: true, 
                    type: 'string', 
                    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    maxLength: 255
                },
                company: { required: true, type: 'string', maxLength: 200 },
                firstName: { required: true, type: 'string', maxLength: 100 },
                lastName: { required: true, type: 'string', maxLength: 100 },
                vesselCount: { required: true, type: 'string' },
                containerVolume: { required: true, type: 'string' }
            }),
            async (req, res) => {
                try {
                    const result = await this.handleROICalculator(req.body);
                    res.json(result);
                } catch (error) {
                    console.error('ROI calculator error:', error);
                    res.status(500).json({ error: 'Failed to calculate ROI' });
                }
            }
        );
        
        // System assessment tool - PUBLIC with rate limiting
        this.app.post('/api/lead-gen/assessment',
            this.auth.getRateLimiters().public,
            this.auth.validateInput({
                leadId: { required: true, type: 'string' },
                answers: { required: true, type: 'object' }
            }),
            async (req, res) => {
                try {
                    const result = await this.handleSystemAssessment(req.body);
                    res.json(result);
                } catch (error) {
                    console.error('Assessment error:', error);
                    res.status(500).json({ error: 'Failed to process assessment' });
                }
            }
        );
        
        // Lead scoring endpoint - REQUIRES AUTHENTICATION
        this.app.get('/api/lead-gen/score/:leadId',
            this.auth.authenticate(),
            async (req, res) => {
                try {
                    const score = await this.calculateLeadScore(req.params.leadId);
                    res.json(score);
                } catch (error) {
                    console.error('Lead scoring error:', error);
                    res.status(500).json({ error: 'Failed to calculate score' });
                }
            }
        );
        
        // Admin endpoints - REQUIRE API KEY
        this.app.get('/api/admin/leads',
            this.auth.authenticateApiKey(),
            this.auth.checkPermission('read'),
            async (req, res) => {
                try {
                    const leads = await this.getAllLeads();
                    res.json(leads);
                } catch (error) {
                    console.error('Error fetching leads:', error);
                    res.status(500).json({ error: 'Failed to fetch leads' });
                }
            }
        );
        
        this.app.post('/api/admin/send-email',
            this.auth.authenticateApiKey(),
            this.auth.checkPermission('write'),
            this.auth.getRateLimiters().expensive,
            async (req, res) => {
                try {
                    await this.triggerEmailSequence(
                        req.body.leadId, 
                        req.body.sequenceType, 
                        req.body.data
                    );
                    res.json({ success: true });
                } catch (error) {
                    console.error('Email sending error:', error);
                    res.status(500).json({ error: 'Failed to send email' });
                }
            }
        );
        
        // Health check endpoint
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });
    }
    
    // Lead handling methods (same as original)
    async handleProgressiveProfile(data) {
        const { step, leadId, ...formData } = data;
        
        let lead;
        if (leadId) {
            lead = await this.getLeadById(leadId);
        } else {
            lead = await this.createLead(formData);
        }
        
        await this.updateLead(lead.id, formData);
        const profileCompletion = await this.calculateProfileCompletion(lead.id);
        
        let nextStep = null;
        let action = null;
        
        if (step === 1 && profileCompletion < 30) {
            nextStep = 2;
        } else if (step === 2 && profileCompletion < 60) {
            nextStep = 3;
        } else if (step === 3 && profileCompletion < 90) {
            nextStep = 4;
        } else {
            action = await this.processQualifiedLead(lead.id);
        }
        
        await this.trackLeadActivity({
            leadId: lead.id,
            event: 'progressive_profile_step',
            properties: { step, completion: profileCompletion }
        });
        
        return {
            leadId: lead.id,
            nextStep,
            profileCompletion,
            action
        };
    }
    
    async handleROICalculator(data) {
        const {
            email,
            company,
            firstName,
            lastName,
            vesselCount,
            avgDetentionDays,
            containerVolume,
            currentCosts
        } = data;
        
        const roiData = this.calculateROI({
            vesselCount: parseInt(vesselCount),
            avgDetentionDays: parseFloat(avgDetentionDays) || 5,
            containerVolume: parseInt(containerVolume),
            currentCosts: parseFloat(currentCosts) || 0
        });
        
        const lead = await this.createOrUpdateLead({
            email,
            company,
            firstName,
            lastName,
            properties: {
                vessel_count: vesselCount,
                annual_container_volume: containerVolume,
                current_detention_costs: currentCosts,
                roi_calculated: roiData.annualSavings,
                roi_percentage: roiData.roiPercentage
            }
        });
        
        const score = await this.calculateLeadScore(lead.id);
        
        await this.createHubSpotContact(lead);
        
        if (score.total >= this.leadScoring.thresholds.warm) {
            await this.createHubSpotDeal(lead, roiData);
        }
        
        await this.triggerEmailSequence(lead.id, 'roi_calculator', {
            roiData,
            firstName: lead.firstName
        });
        
        await this.trackConversion('roi_calculator', lead.id, roiData.annualSavings);
        
        return {
            success: true,
            leadId: lead.id,
            roi: roiData,
            nextSteps: this.getNextSteps(score)
        };
    }
    
    calculateROI(params) {
        const {
            vesselCount,
            avgDetentionDays,
            containerVolume,
            currentCosts
        } = params;
        
        const avgDetentionCostPerDay = 150;
        const avgDemurrageCostPerDay = 200;
        
        const estimatedAnnualCosts = currentCosts || 
            (containerVolume * avgDetentionDays * (avgDetentionCostPerDay + avgDemurrageCostPerDay));
        
        const detentionReduction = 0.75;
        const demurrageReduction = 0.80;
        
        const annualSavings = estimatedAnnualCosts * 
            ((detentionReduction + demurrageReduction) / 2);
        
        const annualInvestment = vesselCount * 500000;
        const netSavings = annualSavings - annualInvestment;
        const roiPercentage = ((netSavings / annualInvestment) * 100).toFixed(1);
        const paybackPeriod = (annualInvestment / annualSavings * 12).toFixed(1);
        
        return {
            currentCosts: estimatedAnnualCosts,
            projectedCosts: estimatedAnnualCosts - annualSavings,
            annualSavings,
            annualInvestment,
            netSavings,
            roiPercentage,
            paybackPeriod,
            fiveYearValue: netSavings * 5
        };
    }
    
    // Placeholder methods for database operations
    async getLeadById(id) {
        // In production, query from database
        return { id, email: 'lead@example.com' };
    }
    
    async createLead(data) {
        // In production, insert into database
        const id = uuidv4();
        return { id, ...data };
    }
    
    async updateLead(id, data) {
        // In production, update database
        return true;
    }
    
    async createOrUpdateLead(data) {
        // In production, upsert into database
        return { id: uuidv4(), ...data };
    }
    
    async getAllLeads() {
        // In production, query from database
        return [];
    }
    
    async calculateLeadScore(leadId) {
        // Simplified version - in production, calculate from database
        return {
            company: 40,
            engagement: 50,
            timeline: 30,
            total: 120,
            grade: 'B',
            recommendation: 'Schedule demo'
        };
    }
    
    async initializeAutomation() {
        console.log('Secure Lead Generation System initialized');
        
        // Generate API keys for different clients
        await this.auth.createApiKey('website', 'rootuip-website-key-' + Math.random().toString(36).substr(2, 9));
        await this.auth.createApiKey('mobile', 'rootuip-mobile-key-' + Math.random().toString(36).substr(2, 9));
        await this.auth.createApiKey('partner', 'rootuip-partner-key-' + Math.random().toString(36).substr(2, 9));
        
        this.app.listen(this.port, () => {
            console.log(`Secure Lead Generation System running on port ${this.port}`);
            console.log('Authentication enabled with JWT and API keys');
            console.log('Rate limiting active on all endpoints');
            console.log('Input validation and sanitization enabled');
        });
    }
}

// Export for use
module.exports = SecureLeadGenerationSystem;

// Start the system if run directly
if (require.main === module) {
    new SecureLeadGenerationSystem();
}