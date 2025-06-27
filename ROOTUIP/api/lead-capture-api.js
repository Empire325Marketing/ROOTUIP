// Lead Capture API for ROOTUIP
const express = require('express');
const router = express.Router();
const LeadScoringEngine = require('../lead-generation/lead-scoring-engine');
const CRMConnector = require('../lead-generation/crm-integration/crm-connector');
const EmailAutomation = require('./email-automation');

// Initialize services
const leadScorer = new LeadScoringEngine();
const crmConnector = new CRMConnector({
    crmType: process.env.CRM_TYPE || 'hubspot',
    apiEndpoint: process.env.CRM_API_ENDPOINT,
    apiKey: process.env.CRM_API_KEY
});
const emailAutomation = new EmailAutomation();

// Lead capture endpoint
router.post('/api/lead-capture', async (req, res) => {
    try {
        const leadData = req.body;
        
        // Validate required fields
        if (!leadData.email || !leadData.full_name) {
            return res.status(400).json({
                success: false,
                error: 'Email and name are required'
            });
        }
        
        // Enrich lead data with metadata
        const enrichedLead = {
            ...leadData,
            captured_at: new Date().toISOString(),
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            referrer: req.headers.referer || 'direct',
            utm_source: req.query.utm_source,
            utm_medium: req.query.utm_medium,
            utm_campaign: req.query.utm_campaign
        };
        
        // Parse ROI data if present
        if (leadData.roi_data) {
            try {
                enrichedLead.roi_data = JSON.parse(leadData.roi_data);
                enrichedLead.potential_savings = enrichedLead.roi_data.results.totalSavings;
                enrichedLead.vessel_count = enrichedLead.roi_data.inputs.vesselCount;
                enrichedLead.teu_volume = enrichedLead.roi_data.inputs.teuVolume;
            } catch (e) {
                console.error('Error parsing ROI data:', e);
            }
        }
        
        // Calculate initial lead score
        const scoreData = leadScorer.calculateLeadScore({
            vesselCount: enrichedLead.vessel_count,
            revenue: enrichedLead.estimated_revenue,
            industry: enrichedLead.industry || 'shipping_line',
            engagement: {
                contentDownloads: leadData.source === 'whitepaper' ? 1 : 0,
                roiCalculatorCompleted: leadData.source === 'roi_calculator' ? 1 : 0,
                demoRequest: leadData.source === 'demo_request' ? 1 : 0
            },
            behavior: {
                roiCalculatorCompleted: leadData.source === 'roi_calculator',
                totalVisits: 1
            },
            budget: {
                amount: enrichedLead.potential_savings,
                timeline: leadData.budget_timeline || 'this_year'
            }
        });
        
        enrichedLead.lead_score = scoreData.totalScore;
        enrichedLead.lead_grade = scoreData.gradeLevel;
        
        // Sync to CRM
        const crmResult = await crmConnector.syncLead(enrichedLead);
        
        // Trigger email automation based on source
        let emailSequence = null;
        switch (leadData.source) {
            case 'roi_calculator':
                emailSequence = 'roi_calculator_followup';
                break;
            case 'whitepaper':
                emailSequence = 'whitepaper_nurture';
                break;
            case 'demo_request':
                emailSequence = 'demo_confirmation';
                break;
            case 'assessment':
                emailSequence = 'assessment_results';
                break;
            case 'newsletter':
                emailSequence = 'welcome_series';
                break;
        }
        
        if (emailSequence) {
            await emailAutomation.enrollInSequence({
                email: enrichedLead.email,
                sequence: emailSequence,
                data: enrichedLead
            });
        }
        
        // Send immediate response based on source
        if (leadData.source === 'roi_calculator') {
            await emailAutomation.sendTransactional({
                to: enrichedLead.email,
                template: 'roi_report_delivery',
                data: {
                    first_name: enrichedLead.full_name.split(' ')[0],
                    total_savings: enrichedLead.potential_savings,
                    roi_percentage: enrichedLead.roi_data?.results?.roi,
                    report_link: generateReportLink(crmResult.leadId)
                }
            });
        }
        
        // Track conversion
        await trackConversion({
            leadId: crmResult.leadId,
            source: leadData.source,
            value: enrichedLead.potential_savings || 0
        });
        
        res.json({
            success: true,
            message: 'Lead captured successfully',
            leadId: crmResult.leadId,
            score: scoreData.totalScore,
            grade: scoreData.gradeLevel
        });
        
    } catch (error) {
        console.error('Lead capture error:', error);
        
        // Still try to save lead data for retry
        await queueLeadForRetry(req.body);
        
        res.status(500).json({
            success: false,
            error: 'An error occurred processing your request'
        });
    }
});

// Email automation trigger endpoint
router.post('/api/email-automation/trigger', async (req, res) => {
    try {
        const { sequence, email, data } = req.body;
        
        const result = await emailAutomation.enrollInSequence({
            email,
            sequence,
            data
        });
        
        res.json({
            success: true,
            enrollmentId: result.id
        });
        
    } catch (error) {
        console.error('Email automation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Sales alert endpoint
router.post('/api/sales-alert', async (req, res) => {
    try {
        const alertData = req.body;
        
        // Create alert in CRM
        const alert = await crmConnector.createSalesAlert(
            alertData.lead.id,
            alertData.alert_type,
            alertData
        );
        
        // Send immediate notification to sales team
        await notifySalesTeam({
            type: alertData.alert_type,
            lead: alertData.lead,
            score: alertData.score,
            savings: alertData.savings,
            priority: alert.priority
        });
        
        res.json({
            success: true,
            alertId: alert.id
        });
        
    } catch (error) {
        console.error('Sales alert error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Progressive profiling endpoint
router.post('/api/progressive-profile', async (req, res) => {
    try {
        const { email, additionalData } = req.body;
        
        // Update lead profile
        const lead = await crmConnector.findLeadByEmail(email);
        if (lead) {
            await crmConnector.updateLead(lead.id, additionalData);
            
            // Recalculate score with new data
            const updatedScore = await recalculateLeadScore(lead.id);
            
            res.json({
                success: true,
                newScore: updatedScore.totalScore,
                fieldsUpdated: Object.keys(additionalData).length
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Lead not found'
            });
        }
        
    } catch (error) {
        console.error('Progressive profiling error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Lead scoring update endpoint
router.post('/api/lead-score/update', async (req, res) => {
    try {
        const { leadId, activity } = req.body;
        
        // Update score based on new activity
        const updatedScore = leadScorer.updateLeadScore(leadId, activity);
        
        // Sync to CRM
        await crmConnector.updateLead(leadId, {
            lead_score: updatedScore.totalScore,
            lead_grade: updatedScore.gradeLevel,
            last_activity: activity.type,
            last_activity_date: new Date().toISOString()
        });
        
        res.json({
            success: true,
            score: updatedScore
        });
        
    } catch (error) {
        console.error('Score update error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Utility functions
function generateReportLink(leadId) {
    const token = generateSecureToken(leadId);
    return `${process.env.APP_URL}/roi-report/${leadId}?token=${token}`;
}

function generateSecureToken(leadId) {
    const crypto = require('crypto');
    return crypto.createHash('sha256')
        .update(leadId + process.env.SECRET_KEY + Date.now())
        .digest('hex');
}

async function trackConversion(data) {
    // Track in analytics
    if (global.analytics) {
        global.analytics.track({
            userId: data.leadId,
            event: 'Lead Captured',
            properties: {
                source: data.source,
                value: data.value
            }
        });
    }
}

async function queueLeadForRetry(leadData) {
    // Store in Redis or database for retry
    if (global.redis) {
        await global.redis.lpush('lead_capture_retry', JSON.stringify({
            data: leadData,
            timestamp: new Date().toISOString(),
            attempts: 0
        }));
    }
}

async function notifySalesTeam(alertData) {
    // Send to Slack/email/SMS based on priority
    if (alertData.priority === 'critical') {
        // Send immediate notifications
        await sendSlackAlert(alertData);
        await sendSMSAlert(alertData);
    } else {
        // Queue for next digest
        await queueForSalesDigest(alertData);
    }
}

async function recalculateLeadScore(leadId) {
    const lead = await crmConnector.getLeadById(leadId);
    return leadScorer.calculateLeadScore(lead);
}

module.exports = router;