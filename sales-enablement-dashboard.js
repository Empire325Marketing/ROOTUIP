const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Handlebars = require('handlebars');

const app = express();
app.use(cors());
app.use(express.json());

// Database connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rootuip'
});

// Sales Enablement Platform
class SalesEnablementPlatform {
    constructor() {
        this.templates = new Map();
        this.demoEnvironments = new Map();
        this.initializePlatform();
    }

    async initializePlatform() {
        await this.setupDatabase();
        await this.loadTemplates();
        console.log('Sales Enablement Platform initialized');
    }

    // LEAD INTELLIGENCE DASHBOARD
    async getLeadIntelligence(leadId) {
        try {
            const leadQuery = await db.query(`
                SELECT 
                    l.*,
                    db.scheduled_date as demo_date,
                    db.attendees as demo_attendees,
                    db.focus_areas,
                    cm.platform as crm_platform,
                    cm.record_id as crm_record_id
                FROM leads l
                LEFT JOIN demo_bookings db ON l.lead_id = db.lead_id
                LEFT JOIN crm_mappings cm ON l.lead_id = cm.lead_id
                WHERE l.lead_id = $1
            `, [leadId]);

            if (leadQuery.rows.length === 0) {
                throw new Error('Lead not found');
            }

            const lead = leadQuery.rows[0];

            // Get engagement history
            const engagementHistory = await this.getEngagementHistory(leadId);
            
            // Get company intelligence
            const companyIntel = await this.getCompanyIntelligence(lead.company, lead.website);
            
            // Get similar companies and case studies
            const similarCompanies = await this.getSimilarCompanies(lead);
            
            // Get conversation starters
            const conversationStarters = await this.generateConversationStarters(lead);
            
            // Get next best actions
            const nextActions = await this.getNextBestActions(lead);

            return {
                leadProfile: {
                    ...lead,
                    qualificationLevel: this.getQualificationLevel(lead.lead_score),
                    dealProbability: this.calculateDealProbability(lead),
                    estimatedValue: this.estimateOpportunityValue(lead),
                    timeToClose: this.estimateTimeToClose(lead)
                },
                companyIntelligence: companyIntel,
                engagementHistory,
                similarCompanies,
                conversationStarters,
                nextActions,
                salesPlaybook: await this.getSalesPlaybook(lead)
            };
        } catch (error) {
            console.error('Lead intelligence error:', error);
            throw error;
        }
    }

    async getEngagementHistory(leadId) {
        const history = await db.query(`
            SELECT 
                activity_type,
                activity_data,
                created_at
            FROM crm_activity_log
            WHERE lead_id = $1
            ORDER BY created_at DESC
            LIMIT 20
        `, [leadId]);

        const emailHistory = await db.query(`
            SELECT 
                sequence_type,
                subject,
                status,
                sent_at
            FROM email_queue
            WHERE lead_id = $1 AND status = 'sent'
            ORDER BY sent_at DESC
            LIMIT 10
        `, [leadId]);

        return {
            crmActivities: history.rows,
            emailHistory: emailHistory.rows,
            lastEngagement: history.rows[0]?.created_at || null,
            engagementScore: this.calculateEngagementScore(history.rows, emailHistory.rows)
        };
    }

    async getCompanyIntelligence(companyName, website) {
        // Simulate company intelligence gathering
        // In production, integrate with ZoomInfo, Clearbit, etc.
        return {
            basicInfo: {
                name: companyName,
                website: website,
                industry: 'Logistics & Transportation',
                founded: '2010',
                headquarters: 'New York, NY',
                employeeCount: '5,000-10,000',
                annualRevenue: '$1B - $5B'
            },
            keyPersonnel: [
                {
                    name: 'John Smith',
                    title: 'Chief Supply Chain Officer',
                    linkedin: 'https://linkedin.com/in/johnsmith',
                    email: 'john.smith@company.com',
                    background: 'Former McKinsey consultant, 15+ years in logistics'
                },
                {
                    name: 'Sarah Johnson',
                    title: 'VP of Operations',
                    linkedin: 'https://linkedin.com/in/sarahjohnson',
                    email: 'sarah.johnson@company.com',
                    background: 'MIT graduate, expert in supply chain optimization'
                }
            ],
            recentNews: [
                {
                    title: 'Company announces $500M expansion into Asian markets',
                    date: '2024-01-15',
                    source: 'Industry Weekly',
                    relevance: 'high'
                },
                {
                    title: 'CEO discusses sustainability initiatives in Q4 earnings call',
                    date: '2024-01-10',
                    source: 'Financial Times',
                    relevance: 'medium'
                }
            ],
            painPointIndicators: [
                'Recent port congestion delays mentioned in earnings call',
                'Increased logistics costs by 23% YoY',
                'Digital transformation initiative launched Q3 2023'
            ],
            competitivePosition: {
                rank: 3,
                marketShare: '12%',
                mainCompetitors: ['Competitor A', 'Competitor B'],
                differentiators: ['Global network', 'Technology focus']
            }
        };
    }

    async getSimilarCompanies(lead) {
        // Find similar companies by size, industry, and use case
        const similar = await db.query(`
            SELECT DISTINCT
                company,
                company_size,
                annual_revenue,
                lead_score,
                status,
                roi_calculation_data
            FROM leads
            WHERE company_size = $1
            AND lead_score >= 80
            AND status IN ('demo_completed', 'proposal_sent', 'closed_won')
            AND company != $2
            LIMIT 5
        `, [lead.company_size, lead.company]);

        return similar.rows.map(company => ({
            ...company,
            caseStudyAvailable: true,
            roiAchieved: company.roi_calculation_data?.estimatedSavings || 0,
            implementation: '6-8 weeks',
            keyBenefits: ['94% reduction in demurrage', 'Real-time visibility', 'Predictive analytics']
        }));
    }

    async generateConversationStarters(lead) {
        const starters = [];

        // Based on pain points
        if (lead.pain_points?.includes('demurrage-costs')) {
            starters.push({
                category: 'Pain Point',
                starter: `I see demurrage costs are a concern for ${lead.company}. Our clients typically see 94% reduction in these costs within the first quarter of implementation.`,
                followUp: 'What percentage of your logistics budget is currently going to demurrage fees?'
            });
        }

        // Based on company news/events
        starters.push({
            category: 'Industry Insight',
            starter: `With the recent port congestion issues affecting ${lead.company_size} companies like yours, many of our clients are implementing predictive analytics to avoid delays before they happen.`,
            followUp: 'How is your team currently handling supply chain disruptions?'
        });

        // Based on ROI calculation
        if (lead.roi_calculation_data?.estimatedSavings) {
            starters.push({
                category: 'ROI Focus',
                starter: `Based on your ROI calculation showing potential savings of $${lead.roi_calculation_data.estimatedSavings.toLocaleString()}, I wanted to share how similar companies achieved these results.`,
                followUp: 'What would that level of savings mean for your strategic initiatives this year?'
            });
        }

        // Timeline-based
        if (lead.timeline === 'immediate' || lead.timeline === '1-3-months') {
            starters.push({
                category: 'Urgency',
                starter: `Given your immediate timeline, I can fast-track our implementation process. Our record deployment was completed in just 4 weeks for a ${lead.company_size} company.`,
                followUp: 'What\'s driving the urgency for your timeline?'
            });
        }

        return starters;
    }

    async getNextBestActions(lead) {
        const actions = [];
        const score = lead.lead_score;

        if (score >= 80) {
            actions.push({
                priority: 'high',
                action: 'Schedule executive briefing',
                description: 'Lead is highly qualified - involve C-level stakeholders',
                timeline: 'This week',
                template: 'executive_briefing_request'
            });
        }

        if (score >= 60 && !lead.demo_scheduled_date) {
            actions.push({
                priority: 'high',
                action: 'Book product demo',
                description: 'Lead is qualified and ready for detailed demonstration',
                timeline: 'Next 3 days',
                template: 'demo_booking_request'
            });
        }

        if (lead.pain_points?.includes('demurrage-costs')) {
            actions.push({
                priority: 'medium',
                action: 'Send demurrage cost case study',
                description: 'Highly relevant case study showing 94% cost reduction',
                timeline: 'Today',
                template: 'demurrage_case_study'
            });
        }

        if (score < 40) {
            actions.push({
                priority: 'low',
                action: 'Add to nurture sequence',
                description: 'Lead needs more education before sales engagement',
                timeline: 'This week',
                template: 'nurture_sequence'
            });
        }

        return actions;
    }

    async getSalesPlaybook(lead) {
        const playbook = {
            qualification: {
                questions: [
                    'What percentage of your containers are subject to demurrage charges?',
                    'How much visibility do you currently have into your supply chain?',
                    'Who else would be involved in evaluating a solution like this?',
                    'What\'s your current process for handling port delays?',
                    'What would a 94% reduction in demurrage costs mean for your business?'
                ],
                objections: [
                    {
                        objection: 'We already have a tracking system',
                        response: 'That\'s great! Most of our clients had tracking systems too. The difference is our AI-powered predictive analytics that prevent issues before they occur, rather than just tracking them after they happen.'
                    },
                    {
                        objection: 'The price seems high',
                        response: 'I understand cost is a consideration. Based on your ROI calculation, the system pays for itself in the first quarter through demurrage savings alone. Would you like to see exactly how other companies achieved their ROI?'
                    }
                ]
            },
            demoFlow: {
                duration: '30 minutes',
                agenda: [
                    'Business challenge discussion (5 min)',
                    'Live container tracking demo (10 min)',
                    'AI prediction showcase (10 min)',
                    'Custom ROI review (5 min)'
                ],
                customization: {
                    industry: lead.industry || 'logistics',
                    companySize: lead.company_size,
                    painPoints: lead.pain_points
                }
            },
            proposalElements: {
                implementation: '6-8 weeks',
                training: '2 weeks',
                support: '24/7 enterprise support',
                integration: 'API integration with existing systems',
                roi: `${lead.roi_calculation_data?.estimatedSavings || 0} annual savings`
            }
        };

        return playbook;
    }

    // PROSPECT PREPARATION MATERIALS
    async generateProspectMaterials(leadId) {
        try {
            const leadIntel = await this.getLeadIntelligence(leadId);
            const lead = leadIntel.leadProfile;

            const materials = {
                onePageExecutiveSummary: await this.generateExecutiveSummary(lead),
                customizedDeckUrl: await this.generateCustomDeck(lead),
                caseStudyUrl: await this.generateCaseStudy(lead),
                roiCalculatorUrl: await this.generateCustomROICalculator(lead),
                proposalDraftUrl: await this.generateProposalDraft(lead)
            };

            // Store materials reference
            await db.query(`
                INSERT INTO prospect_materials (
                    lead_id, materials_data, generated_at
                ) VALUES ($1, $2, NOW())
                ON CONFLICT (lead_id) 
                DO UPDATE SET materials_data = $2, updated_at = NOW()
            `, [leadId, JSON.stringify(materials)]);

            return materials;
        } catch (error) {
            console.error('Prospect materials generation error:', error);
            throw error;
        }
    }

    async generateExecutiveSummary(lead) {
        const template = await this.getTemplate('executive_summary');
        const compiled = Handlebars.compile(template);
        
        const context = {
            companyName: lead.company,
            contactName: lead.name,
            estimatedSavings: lead.roi_calculation_data?.estimatedSavings || 0,
            painPoints: lead.pain_points || [],
            companySize: lead.company_size,
            timeline: lead.timeline,
            keyBenefits: [
                '94% reduction in demurrage costs',
                'Real-time container visibility',
                'Predictive delay prevention',
                'Automated compliance reporting'
            ],
            caseStudyCompany: this.getSimilarCompanyName(lead.company_size),
            implementationTime: '6-8 weeks',
            contactInfo: {
                salesRep: 'Enterprise Sales Team',
                email: 'enterprise@rootuip.com',
                phone: '+1 (555) 123-4567'
            }
        };

        return compiled(context);
    }

    async generateCustomDeck(lead) {
        // Generate a customized presentation deck
        const deckId = crypto.randomUUID();
        const deckData = {
            slides: [
                {
                    title: `ROOTUIP Solution for ${lead.company}`,
                    content: 'Executive Overview',
                    customization: lead.company_size
                },
                {
                    title: 'Your Current Challenges',
                    content: lead.pain_points?.join(', ') || 'Logistics inefficiencies',
                    customization: 'pain_point_focused'
                },
                {
                    title: 'ROOTUIP Solution',
                    content: 'AI-powered container intelligence',
                    customization: 'solution_overview'
                },
                {
                    title: `ROI for ${lead.company}`,
                    content: `$${lead.roi_calculation_data?.estimatedSavings || 0} Annual Savings`,
                    customization: 'roi_focused'
                },
                {
                    title: 'Implementation Roadmap',
                    content: '6-8 week deployment plan',
                    customization: lead.timeline
                }
            ],
            generatedFor: lead.company,
            generatedAt: new Date()
        };

        // Store deck data
        await db.query(`
            INSERT INTO custom_presentations (
                deck_id, lead_id, deck_data, created_at
            ) VALUES ($1, $2, $3, NOW())
        `, [deckId, lead.lead_id, JSON.stringify(deckData)]);

        return `/api/sales/presentations/${deckId}`;
    }

    async generateCaseStudy(lead) {
        const caseStudyId = crypto.randomUUID();
        const similarCompany = this.getSimilarCompanyName(lead.company_size);
        
        const caseStudy = {
            companyProfile: {
                name: similarCompany,
                size: lead.company_size,
                industry: 'Logistics & Transportation',
                challenge: 'High demurrage costs and supply chain visibility issues'
            },
            solution: {
                implementation: '6 weeks',
                components: [
                    'Real-time container tracking',
                    'AI-powered delay prediction',
                    'Automated alerting system',
                    'Compliance reporting dashboard'
                ]
            },
            results: {
                demurrageReduction: '94%',
                costSavings: '$2.3M annually',
                visibilityImprovement: '85%',
                roi: '6 months'
            },
            relevanceToProspect: {
                companySize: 'Same company size category',
                painPoints: 'Similar operational challenges',
                expectedResults: `Projected $${lead.roi_calculation_data?.estimatedSavings || 0} savings for ${lead.company}`
            }
        };

        // Store case study
        await db.query(`
            INSERT INTO case_studies (
                case_study_id, lead_id, case_study_data, created_at
            ) VALUES ($1, $2, $3, NOW())
        `, [caseStudyId, lead.lead_id, JSON.stringify(caseStudy)]);

        return `/api/sales/case-studies/${caseStudyId}`;
    }

    async generateCustomROICalculator(lead) {
        const calculatorId = crypto.randomUUID();
        
        const calculatorData = {
            prefilledData: {
                companyName: lead.company,
                containerVolume: lead.roi_calculation_data?.containerVolume || 1000,
                currentDemurrageCosts: lead.roi_calculation_data?.currentDemurrageCosts || 50000,
                avgDelayDays: lead.roi_calculation_data?.avgDelayDays || 2
            },
            customizedFor: lead.company,
            estimatedSavings: lead.roi_calculation_data?.estimatedSavings || 0,
            implementation: {
                cost: this.estimateImplementationCost(lead),
                timeline: '6-8 weeks',
                roi: '6 months'
            }
        };

        // Store calculator
        await db.query(`
            INSERT INTO custom_calculators (
                calculator_id, lead_id, calculator_data, created_at
            ) VALUES ($1, $2, $3, NOW())
        `, [calculatorId, lead.lead_id, JSON.stringify(calculatorData)]);

        return `/api/sales/calculators/${calculatorId}`;
    }

    async generateProposalDraft(lead) {
        const proposalId = crypto.randomUUID();
        
        const proposalData = {
            client: {
                company: lead.company,
                contact: lead.name,
                email: lead.email
            },
            solution: {
                package: this.recommendPackage(lead),
                components: this.getRecommendedComponents(lead),
                implementation: '6-8 weeks',
                training: '2 weeks',
                support: '24/7 enterprise support'
            },
            investment: {
                setup: this.estimateSetupCost(lead),
                annual: this.estimateAnnualCost(lead),
                roi: `${lead.roi_calculation_data?.estimatedSavings || 0} annual savings`,
                payback: '6 months'
            },
            terms: {
                contractLength: '3 years',
                paymentTerms: 'Net 30',
                sla: '99.9% uptime guarantee'
            }
        };

        // Store proposal
        await db.query(`
            INSERT INTO proposal_drafts (
                proposal_id, lead_id, proposal_data, created_at
            ) VALUES ($1, $2, $3, NOW())
        `, [proposalId, lead.lead_id, JSON.stringify(proposalData)]);

        return `/api/sales/proposals/${proposalId}`;
    }

    // DEMO ENVIRONMENT SETUP
    async setupCustomDemoEnvironment(leadId) {
        try {
            const lead = await db.query('SELECT * FROM leads WHERE lead_id = $1', [leadId]);
            if (lead.rows.length === 0) {
                throw new Error('Lead not found');
            }

            const leadData = lead.rows[0];
            const demoId = crypto.randomUUID();

            const demoEnvironment = {
                demoId,
                customizedFor: leadData.company,
                dataSet: await this.generateCustomDataSet(leadData),
                scenarios: await this.generateDemoScenarios(leadData),
                configuration: {
                    companyBranding: true,
                    relevantContainers: this.getRelevantContainerTypes(leadData),
                    painPointFocus: leadData.pain_points || [],
                    roiHighlights: true
                },
                accessUrl: `https://demo.rootuip.com/${demoId}`,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            };

            // Store demo environment
            await db.query(`
                INSERT INTO demo_environments (
                    demo_id, lead_id, environment_data, expires_at, created_at
                ) VALUES ($1, $2, $3, $4, NOW())
            `, [demoId, leadId, JSON.stringify(demoEnvironment), demoEnvironment.expiresAt]);

            this.demoEnvironments.set(demoId, demoEnvironment);

            return demoEnvironment;
        } catch (error) {
            console.error('Demo environment setup error:', error);
            throw error;
        }
    }

    async generateCustomDataSet(lead) {
        // Generate realistic demo data based on company profile
        const containerCount = this.estimateContainerVolume(lead.company_size);
        
        return {
            containers: Array.from({ length: Math.min(containerCount, 50) }, (_, i) => ({
                id: `${lead.company?.substring(0, 3).toUpperCase() || 'CNT'}${String(i + 1).padStart(4, '0')}`,
                status: this.getRandomStatus(),
                origin: this.getRandomPort('origin'),
                destination: this.getRandomPort('destination'),
                eta: this.getRandomETA(),
                demurrageRisk: this.getRandomRisk(),
                value: this.getRandomValue(lead.company_size)
            })),
            totalValue: containerCount * this.getAverageValue(lead.company_size),
            demurrageExposure: containerCount * 2500, // Average demurrage per container
            potentialSavings: Math.round(containerCount * 2500 * 0.94) // 94% reduction
        };
    }

    async generateDemoScenarios(lead) {
        const scenarios = [];

        // Scenario 1: Port congestion prediction
        scenarios.push({
            title: 'Port Congestion Prediction',
            description: 'Show how AI predicts and prevents demurrage',
            relevance: lead.pain_points?.includes('demurrage-costs') ? 'high' : 'medium',
            duration: '5 minutes',
            keyPoints: [
                'Real-time congestion monitoring',
                '48-hour advance warning',
                'Alternative routing suggestions',
                'Cost impact calculation'
            ]
        });

        // Scenario 2: Real-time visibility
        scenarios.push({
            title: 'End-to-End Visibility',
            description: 'Complete shipment tracking and analytics',
            relevance: lead.pain_points?.includes('data-visibility') ? 'high' : 'medium',
            duration: '5 minutes',
            keyPoints: [
                'Live container tracking',
                'Stakeholder notifications',
                'Exception management',
                'Performance analytics'
            ]
        });

        // Scenario 3: ROI demonstration
        if (lead.roi_calculation_data?.estimatedSavings) {
            scenarios.push({
                title: `ROI Demonstration for ${lead.company}`,
                description: 'Customized ROI calculation and results',
                relevance: 'high',
                duration: '5 minutes',
                keyPoints: [
                    `$${lead.roi_calculation_data.estimatedSavings.toLocaleString()} annual savings`,
                    '6-month payback period',
                    'Competitive advantage',
                    'Implementation roadmap'
                ]
            });
        }

        return scenarios;
    }

    // UTILITY METHODS
    getQualificationLevel(score) {
        if (score >= 80) return 'Hot';
        if (score >= 60) return 'Warm';
        if (score >= 40) return 'Qualified';
        return 'Cold';
    }

    calculateDealProbability(lead) {
        let probability = 0;
        
        // Base score contribution (40%)
        probability += (lead.lead_score / 100) * 0.4;
        
        // Demo scheduled boost (20%)
        if (lead.demo_scheduled_date) probability += 0.2;
        
        // Timeline urgency (20%)
        const timelineBoost = {
            'immediate': 0.2,
            '1-3-months': 0.15,
            '3-6-months': 0.1,
            '6-12-months': 0.05,
            '12+-months': 0.02
        };
        probability += timelineBoost[lead.timeline] || 0;
        
        // Budget authority (20%)
        if (lead.budget_range && lead.budget_range !== 'under-25000') {
            probability += 0.2;
        }
        
        return Math.min(Math.round(probability * 100), 95); // Cap at 95%
    }

    estimateOpportunityValue(lead) {
        const baseValue = lead.roi_calculation_data?.estimatedSavings || 100000;
        const sizeMultiplier = {
            'enterprise': 3.0,
            'large': 2.0,
            'medium': 1.0,
            'small': 0.5,
            'startup': 0.3
        };
        
        return Math.round(baseValue * (sizeMultiplier[lead.company_size] || 1.0) * 0.25);
    }

    estimateTimeToClose(lead) {
        const baseTime = {
            'immediate': 30,
            '1-3-months': 60,
            '3-6-months': 120,
            '6-12-months': 240,
            '12+-months': 365
        };
        
        let days = baseTime[lead.timeline] || 120;
        
        // Adjust based on lead score
        if (lead.lead_score >= 80) days *= 0.7;
        else if (lead.lead_score >= 60) days *= 0.8;
        else if (lead.lead_score < 40) days *= 1.5;
        
        return Math.round(days);
    }

    calculateEngagementScore(crmActivities, emailHistory) {
        let score = 0;
        
        // Email engagement
        const emailEngagement = emailHistory.length * 10;
        score += Math.min(emailEngagement, 50);
        
        // CRM activities
        const activityScore = crmActivities.length * 5;
        score += Math.min(activityScore, 30);
        
        // Recent activity bonus
        const recentActivity = crmActivities.filter(a => 
            new Date(a.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length;
        score += recentActivity * 5;
        
        return Math.min(score, 100);
    }

    getSimilarCompanyName(companySize) {
        const examples = {
            'enterprise': 'Global Logistics Corp',
            'large': 'Continental Shipping',
            'medium': 'Regional Transport Co',
            'small': 'Metro Logistics',
            'startup': 'Innovative Shipping'
        };
        return examples[companySize] || 'Similar Company';
    }

    recommendPackage(lead) {
        if (lead.lead_score >= 80 && lead.company_size === 'enterprise') {
            return 'Enterprise Plus';
        }
        if (lead.lead_score >= 60) {
            return 'Professional';
        }
        return 'Standard';
    }

    getRecommendedComponents(lead) {
        const components = ['Real-time Tracking', 'AI Predictions', 'Analytics Dashboard'];
        
        if (lead.company_size === 'enterprise') {
            components.push('Advanced API Integration', 'Custom Reporting', 'Dedicated Support');
        }
        
        if (lead.pain_points?.includes('compliance-issues')) {
            components.push('Compliance Module');
        }
        
        return components;
    }

    estimateImplementationCost(lead) {
        const baseCosts = {
            'startup': 25000,
            'small': 50000,
            'medium': 100000,
            'large': 200000,
            'enterprise': 500000
        };
        return baseCosts[lead.company_size] || 100000;
    }

    estimateSetupCost(lead) {
        return Math.round(this.estimateImplementationCost(lead) * 0.3);
    }

    estimateAnnualCost(lead) {
        return Math.round(this.estimateImplementationCost(lead) * 0.4);
    }

    estimateContainerVolume(companySize) {
        const volumes = {
            'startup': 100,
            'small': 500,
            'medium': 2000,
            'large': 10000,
            'enterprise': 50000
        };
        return volumes[companySize] || 1000;
    }

    getRandomStatus() {
        const statuses = ['In Transit', 'At Port', 'Delayed', 'Delivered', 'Loading'];
        return statuses[Math.floor(Math.random() * statuses.length)];
    }

    getRandomPort(type) {
        const ports = {
            origin: ['Shanghai', 'Singapore', 'Hong Kong', 'Busan', 'Ningbo'],
            destination: ['Los Angeles', 'Long Beach', 'New York', 'Savannah', 'Oakland']
        };
        const portList = ports[type] || ports.origin;
        return portList[Math.floor(Math.random() * portList.length)];
    }

    getRandomETA() {
        const days = Math.floor(Math.random() * 14) + 1;
        const eta = new Date();
        eta.setDate(eta.getDate() + days);
        return eta.toISOString().split('T')[0];
    }

    getRandomRisk() {
        const risks = ['Low', 'Medium', 'High'];
        return risks[Math.floor(Math.random() * risks.length)];
    }

    getRandomValue(companySize) {
        const ranges = {
            'startup': [10000, 50000],
            'small': [25000, 100000],
            'medium': [50000, 250000],
            'large': [100000, 500000],
            'enterprise': [250000, 1000000]
        };
        const range = ranges[companySize] || ranges.medium;
        return Math.floor(Math.random() * (range[1] - range[0]) + range[0]);
    }

    getAverageValue(companySize) {
        const averages = {
            'startup': 30000,
            'small': 62500,
            'medium': 150000,
            'large': 300000,
            'enterprise': 625000
        };
        return averages[companySize] || 150000;
    }

    getRelevantContainerTypes(lead) {
        // Return container types relevant to the company's industry/size
        return ['20ft Standard', '40ft Standard', '40ft High Cube', 'Refrigerated'];
    }

    async getTemplate(templateName) {
        if (this.templates.has(templateName)) {
            return this.templates.get(templateName);
        }
        
        // Load template from database or file system
        // For demo, return a simple template
        const templates = {
            executive_summary: `
                Executive Summary: {{companyName}} ROOTUIP Implementation
                
                Dear {{contactName}},
                
                Based on our analysis, {{companyName}} could achieve ${{estimatedSavings}} in annual savings through ROOTUIP implementation.
                
                Key Benefits:
                {{#each keyBenefits}}
                • {{this}}
                {{/each}}
                
                Implementation: {{implementationTime}}
                
                Next Steps: Schedule executive briefing
                
                Best regards,
                {{contactInfo.salesRep}}
            `
        };
        
        return templates[templateName] || '';
    }

    async loadTemplates() {
        // Load email and document templates
        // For demo purposes, templates are loaded in memory
        console.log('Templates loaded');
    }

    async setupDatabase() {
        try {
            await db.query(`
                CREATE TABLE IF NOT EXISTS prospect_materials (
                    id SERIAL PRIMARY KEY,
                    lead_id UUID UNIQUE,
                    materials_data JSONB,
                    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS custom_presentations (
                    id SERIAL PRIMARY KEY,
                    deck_id UUID UNIQUE,
                    lead_id UUID,
                    deck_data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS case_studies (
                    id SERIAL PRIMARY KEY,
                    case_study_id UUID UNIQUE,
                    lead_id UUID,
                    case_study_data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS custom_calculators (
                    id SERIAL PRIMARY KEY,
                    calculator_id UUID UNIQUE,
                    lead_id UUID,
                    calculator_data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS proposal_drafts (
                    id SERIAL PRIMARY KEY,
                    proposal_id UUID UNIQUE,
                    lead_id UUID,
                    proposal_data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await db.query(`
                CREATE TABLE IF NOT EXISTS demo_environments (
                    id SERIAL PRIMARY KEY,
                    demo_id UUID UNIQUE,
                    lead_id UUID,
                    environment_data JSONB,
                    expires_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            console.log('Sales enablement database setup complete');
        } catch (error) {
            console.error('Database setup error:', error);
        }
    }
}

// Initialize platform
const salesPlatform = new SalesEnablementPlatform();

// API Endpoints
app.get('/api/sales/leads/:leadId/intelligence', async (req, res) => {
    try {
        const intelligence = await salesPlatform.getLeadIntelligence(req.params.leadId);
        res.json(intelligence);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/sales/leads/:leadId/materials', async (req, res) => {
    try {
        const materials = await salesPlatform.generateProspectMaterials(req.params.leadId);
        res.json(materials);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/sales/leads/:leadId/demo-environment', async (req, res) => {
    try {
        const environment = await salesPlatform.setupCustomDemoEnvironment(req.params.leadId);
        res.json(environment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sales/presentations/:deckId', async (req, res) => {
    try {
        const deck = await db.query('SELECT * FROM custom_presentations WHERE deck_id = $1', [req.params.deckId]);
        if (deck.rows.length === 0) {
            return res.status(404).json({ error: 'Presentation not found' });
        }
        res.json(deck.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sales/case-studies/:caseStudyId', async (req, res) => {
    try {
        const caseStudy = await db.query('SELECT * FROM case_studies WHERE case_study_id = $1', [req.params.caseStudyId]);
        if (caseStudy.rows.length === 0) {
            return res.status(404).json({ error: 'Case study not found' });
        }
        res.json(caseStudy.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sales/calculators/:calculatorId', async (req, res) => {
    try {
        const calculator = await db.query('SELECT * FROM custom_calculators WHERE calculator_id = $1', [req.params.calculatorId]);
        if (calculator.rows.length === 0) {
            return res.status(404).json({ error: 'Calculator not found' });
        }
        res.json(calculator.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sales/proposals/:proposalId', async (req, res) => {
    try {
        const proposal = await db.query('SELECT * FROM proposal_drafts WHERE proposal_id = $1', [req.params.proposalId]);
        if (proposal.rows.length === 0) {
            return res.status(404).json({ error: 'Proposal not found' });
        }
        res.json(proposal.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'sales-enablement-platform',
        activeDemoEnvironments: salesPlatform.demoEnvironments.size
    });
});

const PORT = process.env.PORT || 3021;
app.listen(PORT, () => {
    console.log(`Sales Enablement Platform running on port ${PORT}`);
});

module.exports = { app, salesPlatform };