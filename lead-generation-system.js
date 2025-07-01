// ROOTUIP Enterprise Lead Generation System
// Automated B2B lead capture, qualification, and nurturing

const express = require('express');
const { Pool } = require('pg');
const Redis = require('redis');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class LeadGenerationSystem {
    constructor() {
        this.app = express();
        this.port = process.env.LEAD_GEN_PORT || 3018;
        
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        this.redis = Redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        
        // Lead scoring configuration
        this.leadScoring = {
            // Company characteristics
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
            
            // Engagement scoring
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
            
            // Timeline indicators
            timeline: {
                'immediate': 50,
                '1-3months': 30,
                '3-6months': 20,
                '6months+': 10,
                'exploring': 5
            },
            
            // Score thresholds
            thresholds: {
                hot: 150,      // Sales ready
                warm: 100,     // Marketing qualified
                cool: 50,      // Nurture
                cold: 0        // Early stage
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
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            if (req.method === 'OPTIONS') return res.sendStatus(200);
            next();
        });
    }
    
    setupRoutes() {
        // Progressive profiling form
        this.app.post('/api/lead-gen/progressive-profile', async (req, res) => {
            try {
                const result = await this.handleProgressiveProfile(req.body);
                res.json(result);
            } catch (error) {
                console.error('Progressive profile error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // ROI Calculator submission
        this.app.post('/api/lead-gen/roi-calculator', async (req, res) => {
            try {
                const result = await this.handleROICalculator(req.body);
                res.json(result);
            } catch (error) {
                console.error('ROI calculator error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // System assessment tool
        this.app.post('/api/lead-gen/assessment', async (req, res) => {
            try {
                const result = await this.handleSystemAssessment(req.body);
                res.json(result);
            } catch (error) {
                console.error('Assessment error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Exit intent capture
        this.app.post('/api/lead-gen/exit-intent', async (req, res) => {
            try {
                const result = await this.handleExitIntent(req.body);
                res.json(result);
            } catch (error) {
                console.error('Exit intent error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Chatbot qualification
        this.app.post('/api/lead-gen/chatbot', async (req, res) => {
            try {
                const result = await this.handleChatbotLead(req.body);
                res.json(result);
            } catch (error) {
                console.error('Chatbot error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Lead scoring endpoint
        this.app.get('/api/lead-gen/score/:leadId', async (req, res) => {
            try {
                const score = await this.calculateLeadScore(req.params.leadId);
                res.json(score);
            } catch (error) {
                console.error('Lead scoring error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Analytics tracking
        this.app.post('/api/lead-gen/track', async (req, res) => {
            try {
                await this.trackLeadActivity(req.body);
                res.sendStatus(204);
            } catch (error) {
                console.error('Tracking error:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }
    
    async handleProgressiveProfile(data) {
        const { step, leadId, ...formData } = data;
        
        // Get or create lead record
        let lead;
        if (leadId) {
            lead = await this.getLeadById(leadId);
        } else {
            lead = await this.createLead(formData);
        }
        
        // Update lead with new data
        await this.updateLead(lead.id, formData);
        
        // Determine next step based on profile completion
        const profileCompletion = await this.calculateProfileCompletion(lead.id);
        
        let nextStep = null;
        let action = null;
        
        if (step === 1 && profileCompletion < 30) {
            nextStep = 2; // Ask for company info
        } else if (step === 2 && profileCompletion < 60) {
            nextStep = 3; // Ask for shipping volume
        } else if (step === 3 && profileCompletion < 90) {
            nextStep = 4; // Ask for timeline and budget
        } else {
            // Profile complete - trigger actions
            action = await this.processQualifiedLead(lead.id);
        }
        
        // Track progress
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
        
        // Calculate ROI
        const roiData = this.calculateROI({
            vesselCount: parseInt(vesselCount),
            avgDetentionDays: parseFloat(avgDetentionDays),
            containerVolume: parseInt(containerVolume),
            currentCosts: parseFloat(currentCosts)
        });
        
        // Create or update lead
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
        
        // Score the lead
        const score = await this.calculateLeadScore(lead.id);
        
        // Create HubSpot contact and deal
        await this.createHubSpotContact(lead);
        
        if (score.total >= this.leadScoring.thresholds.warm) {
            await this.createHubSpotDeal(lead, roiData);
        }
        
        // Trigger email sequence
        await this.triggerEmailSequence(lead.id, 'roi_calculator', {
            roiData,
            firstName: lead.firstName
        });
        
        // Track conversion
        await this.trackConversion('roi_calculator', lead.id, roiData.annualSavings);
        
        return {
            success: true,
            leadId: lead.id,
            roi: roiData,
            nextSteps: this.getNextSteps(score)
        };
    }
    
    async handleSystemAssessment(data) {
        const { leadId, answers } = data;
        
        // Calculate assessment score
        const assessmentScore = this.gradeCurrentSystem(answers);
        
        // Update lead
        await this.updateLead(leadId, {
            assessment_score: assessmentScore.score,
            assessment_grade: assessmentScore.grade,
            assessment_completed: true,
            pain_points: assessmentScore.painPoints
        });
        
        // Generate personalized recommendations
        const recommendations = this.generateRecommendations(assessmentScore);
        
        // Update lead score
        await this.addEngagementScore(leadId, 'assessmentCompleted');
        
        // Trigger targeted follow-up
        if (assessmentScore.score < 60) {
            await this.triggerEmailSequence(leadId, 'assessment_low_score', {
                score: assessmentScore.score,
                recommendations
            });
            
            // Alert sales for high-opportunity leads
            if (assessmentScore.painPoints.includes('high_costs')) {
                await this.alertSalesTeam(leadId, 'High detention costs identified');
            }
        }
        
        return {
            score: assessmentScore,
            recommendations,
            caseStudyUrl: this.getRelevantCaseStudy(assessmentScore.painPoints)
        };
    }
    
    async handleExitIntent(data) {
        const { email, currentPage, timeOnPage, scrollDepth } = data;
        
        // Determine best offer based on behavior
        const offer = this.determineExitOffer({
            page: currentPage,
            engagement: { timeOnPage, scrollDepth }
        });
        
        // Create minimal lead record
        const lead = await this.createOrUpdateLead({
            email,
            properties: {
                exit_intent_triggered: true,
                exit_offer: offer.type,
                last_page_viewed: currentPage
            }
        });
        
        // Track exit intent
        await this.trackLeadActivity({
            leadId: lead.id,
            event: 'exit_intent_shown',
            properties: { offer: offer.type }
        });
        
        return {
            offer,
            leadId: lead.id
        };
    }
    
    async handleChatbotLead(data) {
        const { conversation, email, qualificationAnswers } = data;
        
        // Extract intent and qualification level
        const qualification = this.qualifyFromChat(qualificationAnswers);
        
        // Create lead with chat context
        const lead = await this.createOrUpdateLead({
            email,
            properties: {
                chat_qualified: true,
                qualification_score: qualification.score,
                identified_needs: qualification.needs,
                budget_range: qualification.budget,
                timeline: qualification.timeline
            }
        });
        
        // Route based on qualification
        if (qualification.score >= 80) {
            // High intent - schedule demo
            const calendlyUrl = await this.generateCalendlyUrl(lead);
            
            // Alert sales team
            await this.alertSalesTeam(lead.id, 'Hot lead from chatbot');
            
            return {
                action: 'schedule_demo',
                calendlyUrl,
                message: 'Great! Let me connect you with our enterprise team.'
            };
        } else if (qualification.score >= 50) {
            // Medium intent - offer resources
            return {
                action: 'offer_resources',
                resources: [
                    { type: 'roi_calculator', url: '/roi-calculator' },
                    { type: 'case_study', url: '/case-studies/maersk' }
                ],
                message: 'I\'d recommend checking out these resources.'
            };
        } else {
            // Low intent - capture for nurture
            return {
                action: 'nurture',
                message: 'I\'ll send you some helpful information about reducing detention costs.'
            };
        }
    }
    
    async calculateLeadScore(leadId) {
        const lead = await this.getLeadById(leadId);
        const activities = await this.getLeadActivities(leadId);
        
        let score = 0;
        const breakdown = {
            company: 0,
            engagement: 0,
            timeline: 0,
            total: 0
        };
        
        // Company scoring
        if (lead.vessel_count) {
            const vesselRange = this.getVesselRange(lead.vessel_count);
            breakdown.company += this.leadScoring.vesselCount[vesselRange] || 0;
        }
        
        if (lead.annual_revenue) {
            const revenueRange = this.getRevenueRange(lead.annual_revenue);
            breakdown.company += this.leadScoring.annualRevenue[revenueRange] || 0;
        }
        
        // Engagement scoring
        activities.forEach(activity => {
            if (this.leadScoring.engagement[activity.type]) {
                breakdown.engagement += this.leadScoring.engagement[activity.type];
            }
        });
        
        // Timeline scoring
        if (lead.implementation_timeline) {
            breakdown.timeline = this.leadScoring.timeline[lead.implementation_timeline] || 0;
        }
        
        breakdown.total = breakdown.company + breakdown.engagement + breakdown.timeline;
        
        // Update lead score in database
        await this.updateLead(leadId, { lead_score: breakdown.total });
        
        // Sync to HubSpot
        await this.updateHubSpotScore(lead.hubspot_id, breakdown.total);
        
        return {
            ...breakdown,
            grade: this.getLeadGrade(breakdown.total),
            recommendation: this.getLeadRecommendation(breakdown.total)
        };
    }
    
    calculateROI(params) {
        const {
            vesselCount,
            avgDetentionDays,
            containerVolume,
            currentCosts
        } = params;
        
        // Industry averages
        const avgDetentionCostPerDay = 150; // USD per container per day
        const avgDemurrageCostPerDay = 200; // USD per container per day
        
        // Calculate current annual costs
        const estimatedAnnualCosts = currentCosts || 
            (containerVolume * avgDetentionDays * (avgDetentionCostPerDay + avgDemurrageCostPerDay));
        
        // ROOTUIP reduction estimates
        const detentionReduction = 0.75; // 75% reduction
        const demurrageReduction = 0.80; // 80% reduction
        
        // Calculate savings
        const annualSavings = estimatedAnnualCosts * 
            ((detentionReduction + demurrageReduction) / 2);
        
        // Investment calculation
        const annualInvestment = 500000; // $500K per vessel
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
    
    gradeCurrentSystem(answers) {
        let score = 100;
        const painPoints = [];
        const improvements = [];
        
        // Scoring logic based on assessment answers
        const scoringRules = {
            container_visibility: {
                'real_time': 0,
                'daily': -10,
                'weekly': -20,
                'manual': -30
            },
            detention_tracking: {
                'automated': 0,
                'semi_automated': -15,
                'manual': -25,
                'none': -35
            },
            alert_system: {
                'proactive': 0,
                'reactive': -20,
                'none': -40
            },
            data_accuracy: {
                'high': 0,
                'medium': -15,
                'low': -30
            },
            integration_level: {
                'full': 0,
                'partial': -20,
                'none': -40
            }
        };
        
        // Calculate score
        Object.entries(answers).forEach(([question, answer]) => {
            if (scoringRules[question] && scoringRules[question][answer]) {
                score += scoringRules[question][answer];
                
                if (scoringRules[question][answer] < -20) {
                    painPoints.push(question);
                    improvements.push(this.getImprovement(question));
                }
            }
        });
        
        // Determine grade
        let grade;
        if (score >= 90) grade = 'A';
        else if (score >= 80) grade = 'B';
        else if (score >= 70) grade = 'C';
        else if (score >= 60) grade = 'D';
        else grade = 'F';
        
        return {
            score,
            grade,
            painPoints,
            improvements,
            summary: this.getAssessmentSummary(score)
        };
    }
    
    async createHubSpotContact(lead) {
        const contactData = {
            properties: {
                email: lead.email,
                firstname: lead.firstName,
                lastname: lead.lastName,
                company: lead.company,
                phone: lead.phone,
                vessel_count: lead.vessel_count,
                annual_container_volume: lead.annual_container_volume,
                lead_score: lead.lead_score,
                lifecyclestage: 'lead'
            }
        };
        
        try {
            const response = await axios.post(
                `${this.hubspot.baseUrl}/crm/v3/objects/contacts`,
                contactData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.hubspot.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            // Update lead with HubSpot ID
            await this.updateLead(lead.id, { hubspot_id: response.data.id });
            
            return response.data;
        } catch (error) {
            console.error('HubSpot contact creation error:', error);
            throw error;
        }
    }
    
    async createHubSpotDeal(lead, roiData) {
        const dealData = {
            properties: {
                dealname: `${lead.company} - Ocean Freight Optimization`,
                pipeline: 'default',
                dealstage: this.hubspot.dealStages.discovery,
                amount: roiData.annualInvestment,
                closedate: this.getExpectedCloseDate(lead.timeline),
                annual_savings_potential: roiData.annualSavings,
                roi_percentage: roiData.roiPercentage,
                hubspot_owner_id: this.assignSalesRep(lead)
            },
            associations: [
                {
                    to: { id: lead.hubspot_id },
                    types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }]
                }
            ]
        };
        
        try {
            const response = await axios.post(
                `${this.hubspot.baseUrl}/crm/v3/objects/deals`,
                dealData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.hubspot.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            // Create tasks for sales team
            await this.createSalesTasks(response.data.id, lead);
            
            return response.data;
        } catch (error) {
            console.error('HubSpot deal creation error:', error);
            throw error;
        }
    }
    
    async triggerEmailSequence(leadId, sequenceType, data) {
        const sequences = {
            roi_calculator: {
                emails: [
                    { delay: 0, template: 'roi_results_immediate' },
                    { delay: 1, template: 'roi_case_study' },
                    { delay: 3, template: 'roi_implementation_guide' },
                    { delay: 7, template: 'roi_customer_success' },
                    { delay: 10, template: 'roi_demo_invitation' },
                    { delay: 14, template: 'roi_final_offer' }
                ]
            },
            demo_no_show: {
                emails: [
                    { delay: 0.5, template: 'demo_missed_reschedule' },
                    { delay: 2, template: 'demo_value_reminder' },
                    { delay: 5, template: 'demo_last_chance' }
                ]
            },
            enterprise_nurture: {
                emails: [
                    { delay: 0, template: 'welcome_enterprise' },
                    { delay: 7, template: 'industry_insights' },
                    { delay: 14, template: 'customer_spotlight' },
                    { delay: 21, template: 'roi_benchmark' },
                    { delay: 30, template: 'integration_guide' },
                    { delay: 45, template: 'quarterly_trends' },
                    { delay: 60, template: 'personalized_assessment' }
                ]
            }
        };
        
        const sequence = sequences[sequenceType];
        if (!sequence) throw new Error(`Unknown sequence type: ${sequenceType}`);
        
        // Schedule emails
        for (const email of sequence.emails) {
            await this.scheduleEmail(leadId, email.template, email.delay, data);
        }
        
        // Track sequence start
        await this.trackLeadActivity({
            leadId,
            event: 'email_sequence_started',
            properties: { sequence: sequenceType }
        });
        
        return { success: true, sequence: sequenceType };
    }
    
    async scheduleEmail(leadId, template, delayDays, data) {
        const lead = await this.getLeadById(leadId);
        const sendAt = new Date();
        sendAt.setDate(sendAt.getDate() + delayDays);
        
        const emailData = {
            to: lead.email,
            template_id: this.getTemplateId(template),
            dynamic_template_data: {
                firstName: lead.firstName,
                company: lead.company,
                ...data
            },
            send_at: Math.floor(sendAt.getTime() / 1000)
        };
        
        // Queue email with SendGrid
        await this.queueSendGridEmail(emailData);
        
        // Log scheduled email
        await this.logScheduledEmail(leadId, template, sendAt);
    }
    
    async trackConversion(type, leadId, value) {
        // Google Analytics 4
        await this.trackGA4Event('conversion', {
            conversion_type: type,
            lead_id: leadId,
            value: value,
            currency: 'USD'
        });
        
        // Mixpanel
        await this.trackMixpanelEvent('Conversion', {
            type: type,
            leadId: leadId,
            value: value,
            timestamp: new Date().toISOString()
        });
        
        // Internal tracking
        await this.db.query(`
            INSERT INTO conversions (lead_id, type, value, created_at)
            VALUES ($1, $2, $3, NOW())
        `, [leadId, type, value]);
    }
    
    // Helper methods
    getVesselRange(count) {
        if (count <= 10) return '1-10';
        if (count <= 50) return '11-50';
        if (count <= 200) return '51-200';
        return '200+';
    }
    
    getRevenueRange(revenue) {
        if (revenue < 50000000) return '<$50M';
        if (revenue < 250000000) return '$50M-$250M';
        if (revenue < 1000000000) return '$250M-$1B';
        return '$1B+';
    }
    
    getLeadGrade(score) {
        if (score >= this.leadScoring.thresholds.hot) return 'A';
        if (score >= this.leadScoring.thresholds.warm) return 'B';
        if (score >= this.leadScoring.thresholds.cool) return 'C';
        return 'D';
    }
    
    determineExitOffer(behavior) {
        const offers = {
            roi_calculator: {
                type: 'roi_guide',
                title: 'Free ROI Guide: Save $14M Per Vessel',
                cta: 'Get Your Custom ROI Report'
            },
            pricing: {
                type: 'pricing_consultation',
                title: 'Get Custom Enterprise Pricing',
                cta: 'Schedule Pricing Discussion'
            },
            case_studies: {
                type: 'case_study_bundle',
                title: 'See How Maersk Saved $127M',
                cta: 'Download Case Studies'
            },
            default: {
                type: 'assessment',
                title: 'Grade Your Current System',
                cta: 'Take 2-Min Assessment'
            }
        };
        
        return offers[behavior.page] || offers.default;
    }
    
    async initializeAutomation() {
        console.log('Lead Generation System initialized');
        
        // Set up recurring tasks
        setInterval(() => this.processLeadScoring(), 300000); // Every 5 minutes
        setInterval(() => this.syncWithHubSpot(), 600000); // Every 10 minutes
        setInterval(() => this.sendScheduledEmails(), 900000); // Every 15 minutes
        
        // Start API server
        this.app.listen(this.port, () => {
            console.log(`Lead Generation System running on port ${this.port}`);
        });
    }
}

module.exports = LeadGenerationSystem;