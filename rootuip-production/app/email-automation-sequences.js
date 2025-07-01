// ROOTUIP Email Automation Sequences
// SendGrid integration for enterprise B2B nurturing

const sgMail = require('@sendgrid/mail');
const { Pool } = require('pg');
const handlebars = require('handlebars');

class EmailAutomation {
    constructor() {
        this.sg = sgMail;
        this.sg.setApiKey(process.env.SENDGRID_API_KEY);
        
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        // Email template IDs
        this.templates = {
            // ROI Calculator Sequence
            roi_results_immediate: 'd-f4a8b2c1e5d74a89b2c8e1f4a8b2c1e5',
            roi_case_study: 'd-a2c8e1f4a8b2c1e5d74a89b2c8e1f4a8',
            roi_implementation_guide: 'd-8e1f4a8b2c1e5d74a89b2c8e1f4a8b2',
            roi_customer_success: 'd-1f4a8b2c1e5d74a89b2c8e1f4a8b2c1',
            roi_demo_invitation: 'd-4a8b2c1e5d74a89b2c8e1f4a8b2c1e5',
            roi_final_offer: 'd-b2c1e5d74a89b2c8e1f4a8b2c1e5d7',
            
            // Demo No-Show Recovery
            demo_missed_reschedule: 'd-c1e5d74a89b2c8e1f4a8b2c1e5d74a',
            demo_value_reminder: 'd-5d74a89b2c8e1f4a8b2c1e5d74a89b',
            demo_last_chance: 'd-74a89b2c8e1f4a8b2c1e5d74a89b2c',
            
            // Enterprise Nurture Track
            welcome_enterprise: 'd-89b2c8e1f4a8b2c1e5d74a89b2c8e1',
            industry_insights: 'd-2c8e1f4a8b2c1e5d74a89b2c8e1f4a',
            customer_spotlight: 'd-8e1f4a8b2c1e5d74a89b2c8e1f4a8',
            roi_benchmark: 'd-1f4a8b2c1e5d74a89b2c8e1f4a8b2',
            integration_guide: 'd-4a8b2c1e5d74a89b2c8e1f4a8b2c1',
            quarterly_trends: 'd-b2c1e5d74a89b2c8e1f4a8b2c1e5',
            personalized_assessment: 'd-c1e5d74a89b2c8e1f4a8b2c1e5d7',
            
            // Customer Onboarding
            onboarding_welcome: 'd-5d74a89b2c8e1f4a8b2c1e5d74a89',
            onboarding_setup: 'd-74a89b2c8e1f4a8b2c1e5d74a89b2',
            onboarding_training: 'd-89b2c8e1f4a8b2c1e5d74a89b2c8',
            onboarding_success: 'd-2c8e1f4a8b2c1e5d74a89b2c8e1f',
            
            // Monthly Performance Reports
            monthly_performance: 'd-8e1f4a8b2c1e5d74a89b2c8e1f4a'
        };
        
        // Dynamic content generators
        this.contentGenerators = {
            roi_results: this.generateROIContent.bind(this),
            case_study: this.generateCaseStudyContent.bind(this),
            performance_report: this.generatePerformanceReport.bind(this),
            industry_insights: this.generateIndustryInsights.bind(this)
        };
    }
    
    // ROI Calculator Sequence (7 emails over 14 days)
    async sendROISequence(lead, roiData) {
        const sequence = [
            {
                template: 'roi_results_immediate',
                delay: 0,
                subject: `${lead.firstName}, your ROI analysis is ready (${this.formatCurrency(roiData.annualSavings)} potential savings)`,
                data: {
                    firstName: lead.firstName,
                    company: lead.company,
                    annualSavings: this.formatCurrency(roiData.annualSavings),
                    roiPercentage: roiData.roiPercentage,
                    paybackPeriod: roiData.paybackPeriod,
                    customROILink: this.generateCustomROILink(lead.id),
                    bookDemoLink: this.generateBookingLink(lead.id, 'roi-email-1')
                }
            },
            {
                template: 'roi_case_study',
                delay: 1,
                subject: 'How Maersk saved $127M with ROOTUIP (case study)',
                data: {
                    firstName: lead.firstName,
                    similarCompanySize: this.getSimilarCompanySize(lead.vesselCount),
                    relevantCaseStudy: this.getRelevantCaseStudy(lead.industry),
                    caseStudyMetrics: {
                        detentionReduction: '76%',
                        roiAchieved: '423%',
                        paybackPeriod: '3.2 months'
                    }
                }
            },
            {
                template: 'roi_implementation_guide',
                delay: 3,
                subject: 'Your 90-day implementation roadmap',
                data: {
                    firstName: lead.firstName,
                    implementationSteps: this.getImplementationSteps(lead.vesselCount),
                    quickWins: this.getQuickWins(lead.painPoints),
                    supportLevel: this.getSupportLevel(lead.company_size)
                }
            },
            {
                template: 'roi_customer_success',
                delay: 7,
                subject: `${lead.company} + ROOTUIP: What success looks like`,
                data: {
                    firstName: lead.firstName,
                    successMetrics: this.getSuccessMetrics(roiData),
                    customerTestimonial: this.getRelevantTestimonial(lead.industry),
                    expectedOutcomes: this.getExpectedOutcomes(lead)
                }
            },
            {
                template: 'roi_demo_invitation',
                delay: 10,
                subject: 'See ROOTUIP in action (20-min demo)',
                data: {
                    firstName: lead.firstName,
                    demoAgenda: this.getPersonalizedDemoAgenda(lead),
                    calendlyLink: this.generateBookingLink(lead.id, 'roi-email-5'),
                    urgencyMessage: this.getUrgencyMessage(lead.timeline)
                }
            },
            {
                template: 'roi_final_offer',
                delay: 14,
                subject: 'Final thoughts on your $14M opportunity',
                data: {
                    firstName: lead.firstName,
                    totalOpportunity: this.calculateTotalOpportunity(roiData),
                    competitorComparison: this.getCompetitorComparison(),
                    limitedTimeOffer: this.getLimitedTimeOffer(lead),
                    directLine: this.getAssignedRepContact(lead.id)
                }
            }
        ];
        
        // Schedule all emails
        for (const email of sequence) {
            await this.scheduleEmail(lead, email);
        }
        
        // Log sequence start
        await this.logEmailSequence(lead.id, 'roi_calculator', sequence.length);
    }
    
    // Demo No-Show Recovery (3 emails)
    async sendDemoNoShowSequence(lead, demoDetails) {
        const sequence = [
            {
                template: 'demo_missed_reschedule',
                delay: 0.5, // 12 hours
                subject: 'We missed you - let\'s reschedule',
                data: {
                    firstName: lead.firstName,
                    originalTime: demoDetails.scheduledTime,
                    rescheduleLink: this.generateRescheduleLink(demoDetails.id),
                    alternativeTimes: this.getAlternativeTimes()
                }
            },
            {
                template: 'demo_value_reminder',
                delay: 2,
                subject: 'Don\'t miss out on $500K+ in annual savings',
                data: {
                    firstName: lead.firstName,
                    keyValueProps: this.getKeyValueProps(lead),
                    peerCompanies: this.getPeerCompanies(lead.industry),
                    quickCallLink: this.generateQuickCallLink(lead.id)
                }
            },
            {
                template: 'demo_last_chance',
                delay: 5,
                subject: 'Last chance to see ROOTUIP (closing file)',
                data: {
                    firstName: lead.firstName,
                    finalOffer: this.getFinalRescheduleOffer(),
                    directContact: this.getAssignedRepContact(lead.id),
                    caseStudyLink: this.getRelevantCaseStudy(lead.industry)
                }
            }
        ];
        
        for (const email of sequence) {
            await this.scheduleEmail(lead, email);
        }
    }
    
    // Enterprise Nurture Track (12 emails over 60 days)
    async sendEnterpriseNurtureSequence(lead) {
        const sequence = [
            {
                template: 'welcome_enterprise',
                delay: 0,
                subject: 'Welcome to ROOTUIP - Your journey to $14M savings starts here',
                data: {
                    firstName: lead.firstName,
                    company: lead.company,
                    resourceHub: this.getResourceHubLink(),
                    industryReport: this.getIndustryReport(lead.industry)
                }
            },
            {
                template: 'industry_insights',
                delay: 7,
                subject: `${lead.industry} freight trends: What leaders are doing differently`,
                data: {
                    firstName: lead.firstName,
                    industryTrends: await this.getIndustryTrends(lead.industry),
                    benchmarks: this.getIndustryBenchmarks(lead.industry),
                    webinarInvite: this.getUpcomingWebinar()
                }
            },
            {
                template: 'customer_spotlight',
                delay: 14,
                subject: 'How CMA CGM reduced detention by 78% in 90 days',
                data: {
                    firstName: lead.firstName,
                    customerStory: this.getCustomerSpotlight(lead.company_size),
                    similarChallenges: this.getSimilarChallenges(lead.painPoints),
                    resultsAchieved: this.getSpotlightResults()
                }
            },
            {
                template: 'roi_benchmark',
                delay: 21,
                subject: `How does ${lead.company} compare? (Industry ROI benchmark)`,
                data: {
                    firstName: lead.firstName,
                    benchmarkData: this.getROIBenchmarks(lead),
                    improvementAreas: this.getImprovementAreas(lead),
                    assessmentLink: this.getAssessmentLink(lead.id)
                }
            },
            {
                template: 'integration_guide',
                delay: 30,
                subject: 'ROOTUIP integration guide: Works with your existing systems',
                data: {
                    firstName: lead.firstName,
                    integrationOptions: this.getIntegrationOptions(),
                    timelineEstimate: this.getIntegrationTimeline(lead.company_size),
                    technicalResources: this.getTechnicalResources()
                }
            },
            {
                template: 'quarterly_trends',
                delay: 45,
                subject: 'Q4 ocean freight report: Costs rising 23% industry-wide',
                data: {
                    firstName: lead.firstName,
                    quarterlyReport: this.getQuarterlyReport(),
                    marketInsights: this.getMarketInsights(),
                    strategicRecommendations: this.getStrategicRecs(lead)
                }
            },
            {
                template: 'personalized_assessment',
                delay: 60,
                subject: `${lead.firstName}, your personalized ROOTUIP assessment is ready`,
                data: {
                    firstName: lead.firstName,
                    assessmentResults: this.generateAssessment(lead),
                    nextSteps: this.getPersonalizedNextSteps(lead),
                    exclusiveOffer: this.getExclusiveOffer(lead)
                }
            }
        ];
        
        // Add monthly check-ins
        for (let month = 2; month <= 6; month++) {
            sequence.push({
                template: 'monthly_checkin',
                delay: month * 30,
                subject: this.getMonthlySubject(month, lead),
                data: {
                    firstName: lead.firstName,
                    monthlyContent: this.getMonthlyContent(month, lead),
                    callToAction: this.getMonthlyCTA(month)
                }
            });
        }
        
        for (const email of sequence) {
            await this.scheduleEmail(lead, email);
        }
    }
    
    // Customer Onboarding Sequence
    async sendOnboardingSequence(customer) {
        const sequence = [
            {
                template: 'onboarding_welcome',
                delay: 0,
                subject: 'Welcome to ROOTUIP! Your onboarding journey starts now',
                data: {
                    firstName: customer.firstName,
                    company: customer.company,
                    onboardingTimeline: this.getOnboardingTimeline(),
                    csManagerIntro: this.getCSManagerInfo(customer.id),
                    quickStartGuide: this.getQuickStartGuide()
                }
            },
            {
                template: 'onboarding_setup',
                delay: 1,
                subject: 'Let\'s set up your ROOTUIP account (step-by-step guide)',
                data: {
                    firstName: customer.firstName,
                    setupSteps: this.getSetupSteps(customer.package),
                    videoTutorials: this.getVideoTutorials(),
                    supportContact: this.getSupportContact()
                }
            },
            {
                template: 'onboarding_training',
                delay: 7,
                subject: 'Your team training is scheduled',
                data: {
                    firstName: customer.firstName,
                    trainingSchedule: this.getTrainingSchedule(customer.id),
                    trainingMaterials: this.getTrainingMaterials(),
                    certificationInfo: this.getCertificationInfo()
                }
            },
            {
                template: 'onboarding_success',
                delay: 30,
                subject: 'Congrats! You\'re already saving on D&D costs',
                data: {
                    firstName: customer.firstName,
                    firstMonthMetrics: await this.getFirstMonthMetrics(customer.id),
                    successStories: this.getEarlySuccessStories(),
                    nextMilestones: this.getNextMilestones()
                }
            }
        ];
        
        for (const email of sequence) {
            await this.scheduleEmail(customer, email);
        }
    }
    
    // Monthly Performance Reports for Clients
    async sendMonthlyPerformanceReport(customer) {
        const performanceData = await this.gatherPerformanceData(customer.id);
        
        const emailData = {
            template: 'monthly_performance',
            subject: `${customer.company} saved ${this.formatCurrency(performanceData.monthlySavings)} in ${performanceData.month}`,
            data: {
                firstName: customer.firstName,
                company: customer.company,
                month: performanceData.month,
                
                // Key metrics
                totalSavings: this.formatCurrency(performanceData.totalSavings),
                monthlySavings: this.formatCurrency(performanceData.monthlySavings),
                containersTracked: performanceData.containersTracked,
                detentionDaysAvoided: performanceData.detentionDaysAvoided,
                
                // Performance trends
                savingsTrend: performanceData.savingsTrend,
                efficiencyScore: performanceData.efficiencyScore,
                
                // Comparative analysis
                vsLastMonth: performanceData.vsLastMonth,
                vsIndustry: performanceData.vsIndustry,
                
                // Recommendations
                recommendations: this.getMonthlyRecommendations(performanceData),
                
                // Success highlights
                topWins: performanceData.topWins,
                
                // Next month preview
                upcomingChallenges: this.getUpcomingChallenges(customer),
                
                // Interactive elements
                dashboardLink: this.getDashboardLink(customer.id),
                downloadPDFLink: this.generatePDFReportLink(customer.id, performanceData.month)
            }
        };
        
        await this.sendEmail(customer, emailData);
        
        // Log report sent
        await this.logPerformanceReport(customer.id, performanceData);
    }
    
    // Helper Methods
    async scheduleEmail(recipient, emailConfig) {
        const sendAt = new Date();
        sendAt.setDate(sendAt.getDate() + emailConfig.delay);
        
        const msg = {
            to: recipient.email,
            from: {
                email: 'insights@rootuip.com',
                name: 'ROOTUIP Team'
            },
            templateId: this.templates[emailConfig.template],
            dynamicTemplateData: emailConfig.data,
            sendAt: Math.floor(sendAt.getTime() / 1000),
            
            // Tracking settings
            trackingSettings: {
                clickTracking: { enable: true },
                openTracking: { enable: true },
                subscriptionTracking: { enable: false }
            },
            
            // Custom args for analytics
            customArgs: {
                leadId: recipient.id,
                sequence: emailConfig.sequence || 'default',
                emailType: emailConfig.template
            }
        };
        
        try {
            await this.sg.send(msg);
            
            // Log scheduled email
            await this.db.query(`
                INSERT INTO scheduled_emails 
                (recipient_id, template, subject, send_at, status)
                VALUES ($1, $2, $3, $4, 'scheduled')
            `, [recipient.id, emailConfig.template, emailConfig.subject, sendAt]);
            
        } catch (error) {
            console.error('Error scheduling email:', error);
            throw error;
        }
    }
    
    generateROIContent(lead, roiData) {
        const industry = lead.industry || 'shipping';
        const vesselCount = lead.vesselCount || 50;
        
        return {
            headline: `Your ${vesselCount}-vessel fleet could save ${this.formatCurrency(roiData.annualSavings)} annually`,
            
            summary: `Based on your current operation with ${vesselCount} vessels and ${lead.containerVolume} TEUs annually, 
                      ROOTUIP can help you reduce detention and demurrage costs by an average of 77.5%.`,
            
            breakdown: {
                currentCosts: this.formatCurrency(roiData.currentCosts),
                projectedSavings: this.formatCurrency(roiData.annualSavings),
                investmentRequired: this.formatCurrency(roiData.annualInvestment),
                netBenefit: this.formatCurrency(roiData.netSavings),
                roi: `${roiData.roiPercentage}%`,
                payback: `${roiData.paybackPeriod} months`
            },
            
            comparisonChart: this.generateComparisonChart(roiData),
            
            nextSteps: [
                'Schedule a personalized demo to see ROOTUIP in action',
                'Get a detailed implementation roadmap for your team',
                'Connect with similar companies who achieved these results'
            ],
            
            urgency: this.getUrgencyMessage(lead.timeline),
            
            socialProof: {
                stat: '87% of our customers achieve positive ROI within 90 days',
                testimonial: this.getRelevantTestimonial(industry)
            }
        };
    }
    
    async gatherPerformanceData(customerId) {
        // Query actual performance metrics
        const query = `
            SELECT 
                COUNT(DISTINCT c.id) as containers_tracked,
                SUM(c.detention_days_saved) as detention_days_avoided,
                SUM(c.cost_savings) as monthly_savings,
                AVG(c.on_time_percentage) as efficiency_score
            FROM containers c
            WHERE c.company_id = $1
            AND c.created_at >= NOW() - INTERVAL '30 days'
        `;
        
        const result = await this.db.query(query, [customerId]);
        const metrics = result.rows[0];
        
        // Get historical data for trends
        const historicalQuery = `
            SELECT 
                DATE_TRUNC('month', created_at) as month,
                SUM(cost_savings) as monthly_total
            FROM containers
            WHERE company_id = $1
            AND created_at >= NOW() - INTERVAL '6 months'
            GROUP BY month
            ORDER BY month DESC
        `;
        
        const historical = await this.db.query(historicalQuery, [customerId]);
        
        return {
            month: new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
            containersTracked: metrics.containers_tracked,
            detentionDaysAvoided: metrics.detention_days_avoided,
            monthlySavings: metrics.monthly_savings,
            totalSavings: this.calculateTotalSavings(historical.rows),
            efficiencyScore: Math.round(metrics.efficiency_score),
            savingsTrend: this.calculateTrend(historical.rows),
            vsLastMonth: this.compareToLastMonth(historical.rows),
            vsIndustry: await this.compareToIndustry(metrics),
            topWins: await this.getTopWins(customerId)
        };
    }
    
    formatCurrency(amount) {
        if (amount >= 1000000) {
            return `$${(amount / 1000000).toFixed(1)}M`;
        } else if (amount >= 1000) {
            return `$${(amount / 1000).toFixed(0)}K`;
        }
        return `$${amount.toFixed(0)}`;
    }
    
    generateCustomROILink(leadId) {
        const token = this.generateSecureToken(leadId);
        return `https://rootuip.com/roi-results/${leadId}?token=${token}`;
    }
    
    generateBookingLink(leadId, source) {
        return `https://calendly.com/rootuip-demo/30min?leadId=${leadId}&source=${source}`;
    }
    
    getRelevantCaseStudy(industry) {
        const caseStudies = {
            'shipping': 'https://rootuip.com/case-studies/maersk',
            'logistics': 'https://rootuip.com/case-studies/dhl',
            'manufacturing': 'https://rootuip.com/case-studies/samsung',
            'retail': 'https://rootuip.com/case-studies/walmart',
            'default': 'https://rootuip.com/case-studies/cma-cgm'
        };
        
        return caseStudies[industry] || caseStudies.default;
    }
    
    async logEmailSequence(leadId, sequenceType, emailCount) {
        await this.db.query(`
            INSERT INTO email_sequences 
            (lead_id, sequence_type, email_count, started_at)
            VALUES ($1, $2, $3, NOW())
        `, [leadId, sequenceType, emailCount]);
    }
    
    // Start email processing service
    async startEmailService() {
        console.log('Email Automation Service started');
        
        // Process scheduled emails every 5 minutes
        setInterval(() => this.processScheduledEmails(), 300000);
        
        // Send monthly reports on the 1st of each month
        setInterval(() => {
            const now = new Date();
            if (now.getDate() === 1 && now.getHours() === 9) {
                this.sendAllMonthlyReports();
            }
        }, 3600000); // Check every hour
    }
}

module.exports = EmailAutomation;