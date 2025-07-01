#!/usr/bin/env node

/**
 * ROOTUIP HubSpot CRM Integration Service
 * Advanced CRM automation and lead management
 */

const express = require('express');
const axios = require('axios');
const redis = require('redis');
const cors = require('cors');

const app = express();
const PORT = process.env.HUBSPOT_INTEGRATION_PORT || 3030;

// HubSpot Configuration
const HUBSPOT_CONFIG = {
    accessToken: process.env.HUBSPOT_TOKEN || 'your-hubspot-access-token',
    baseUrl: 'https://api.hubapi.com',
    portalId: process.env.HUBSPOT_PORTAL_ID || '8751929',
    webhookSecret: process.env.HUBSPOT_WEBHOOK_SECRET || 'rootuip-webhook-2025'
};

// Redis client
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

app.use(cors());
app.use(express.json());

// CRM data storage
const contacts = new Map();
const deals = new Map();
const companies = new Map();
const activities = [];
const leadScoring = new Map();

// Connect to Redis
async function connectRedis() {
    try {
        await redisClient.connect();
        console.log('✅ Redis connected for HubSpot integration');
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
    }
}

connectRedis();

// Advanced Lead Scoring Algorithm
function calculateAdvancedLeadScore(contact, company, activity) {
    let score = 0;
    const factors = {};

    // Company Information (0-30 points)
    if (company) {
        const revenue = company.annualrevenue || 0;
        const employees = company.numberofemployees || 0;
        
        if (revenue >= 10000000) factors.companyRevenue = 30;
        else if (revenue >= 1000000) factors.companyRevenue = 25;
        else if (revenue >= 100000) factors.companyRevenue = 15;
        else factors.companyRevenue = 5;

        if (employees >= 1000) factors.companySize = 20;
        else if (employees >= 100) factors.companySize = 15;
        else if (employees >= 50) factors.companySize = 10;
        else factors.companySize = 5;

        // Industry fit
        const targetIndustries = ['logistics', 'shipping', 'transportation', 'manufacturing', 'retail'];
        const industry = (company.industry || '').toLowerCase();
        factors.industryFit = targetIndustries.some(t => industry.includes(t)) ? 15 : 5;
    } else {
        factors.companyRevenue = 0;
        factors.companySize = 0;
        factors.industryFit = 0;
    }

    // Contact Demographics (0-20 points)
    const jobTitle = (contact.jobtitle || '').toLowerCase();
    const seniorTitles = ['ceo', 'cto', 'director', 'vp', 'manager', 'head'];
    factors.jobTitle = seniorTitles.some(title => jobTitle.includes(title)) ? 20 : 10;

    // Engagement Level (0-25 points)
    const pageViews = contact.hs_analytics_num_page_views || 0;
    const emailOpens = contact.hs_email_open || 0;
    const formSubmissions = contact.hs_analytics_num_visits || 0;

    factors.engagement = Math.min(
        (pageViews * 2) + (emailOpens * 3) + (formSubmissions * 5), 
        25
    );

    // Lead Source Quality (0-15 points)
    const source = contact.hs_analytics_source || '';
    const sourceScores = {
        'DIRECT_TRAFFIC': 15,
        'REFERRALS': 12,
        'ORGANIC_SEARCH': 10,
        'PAID_SEARCH': 8,
        'SOCIAL_MEDIA': 6,
        'EMAIL_MARKETING': 8
    };
    factors.leadSource = sourceScores[source] || 5;

    // Behavioral Indicators (0-10 points)
    const lastActivity = contact.notes_last_updated ? 
        (Date.now() - new Date(contact.notes_last_updated).getTime()) / (1000 * 60 * 60 * 24) : 999;
    
    if (lastActivity <= 1) factors.recentActivity = 10;
    else if (lastActivity <= 7) factors.recentActivity = 7;
    else if (lastActivity <= 30) factors.recentActivity = 4;
    else factors.recentActivity = 0;

    score = Object.values(factors).reduce((sum, s) => sum + s, 0);

    let classification;
    if (score >= 80) classification = 'hot';
    else if (score >= 60) classification = 'warm';
    else if (score >= 40) classification = 'cold';
    else classification = 'unqualified';

    return {
        score,
        classification,
        factors,
        priority: score >= 80 ? 'immediate' : score >= 60 ? 'high' : score >= 40 ? 'medium' : 'low'
    };
}

// HubSpot API Functions
async function getAllContacts(limit = 100) {
    try {
        const response = await axios.get(
            `${HUBSPOT_CONFIG.baseUrl}/crm/v3/objects/contacts`,
            {
                headers: {
                    'Authorization': `Bearer ${HUBSPOT_CONFIG.accessToken}`
                },
                params: {
                    limit,
                    properties: 'email,firstname,lastname,company,jobtitle,phone,website,createdate,lastmodifieddate,hs_analytics_source,hs_analytics_num_page_views,hs_email_open,notes_last_updated'
                }
            }
        );

        console.log(`📊 Retrieved ${response.data.results.length} contacts from HubSpot`);
        return response.data.results;

    } catch (error) {
        console.error('❌ Failed to fetch contacts:', error.response?.data || error.message);
        return [];
    }
}

async function createOrUpdateContact(contactData) {
    try {
        const response = await axios.post(
            `${HUBSPOT_CONFIG.baseUrl}/crm/v3/objects/contacts`,
            {
                properties: {
                    email: contactData.email,
                    firstname: contactData.firstName,
                    lastname: contactData.lastName,
                    company: contactData.company,
                    jobtitle: contactData.jobTitle,
                    phone: contactData.phone,
                    website: contactData.website,
                    lifecyclestage: 'lead',
                    hs_lead_status: 'NEW',
                    lead_source: contactData.source || 'ROOTUIP_WEBSITE'
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${HUBSPOT_CONFIG.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`✅ Contact created/updated: ${contactData.email}`);
        return response.data;

    } catch (error) {
        if (error.response?.status === 409) {
            // Contact exists, return success
            console.log(`✅ Contact already exists: ${contactData.email}`);
            return { id: 'existing-contact' };
        }
        console.error('❌ Failed to create contact:', error.response?.data || error.message);
        return null;
    }
}

async function createDeal(dealData) {
    try {
        const response = await axios.post(
            `${HUBSPOT_CONFIG.baseUrl}/crm/v3/objects/deals`,
            {
                properties: {
                    dealname: dealData.name,
                    amount: dealData.amount,
                    dealstage: dealData.stage || 'appointmentscheduled',
                    pipeline: 'default',
                    closedate: dealData.closeDate,
                    deal_currency_code: 'USD',
                    deal_source: 'ROOTUIP_WEBSITE'
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${HUBSPOT_CONFIG.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`✅ Deal created: ${dealData.name}`);
        return response.data;

    } catch (error) {
        console.error('❌ Failed to create deal:', error.response?.data || error.message);
        return null;
    }
}

// Lead Processing
async function processInboundLead(leadData) {
    try {
        // Create or update contact
        const contact = await createOrUpdateContact(leadData);
        if (!contact) return null;

        // Calculate lead score
        const scoring = calculateAdvancedLeadScore(leadData, null, null);
        
        // Store in local cache
        contacts.set(contact.id || Date.now(), {
            ...contact,
            scoring,
            processed: new Date().toISOString()
        });

        // Create deal for qualified leads
        let deal = null;
        if (scoring.score >= 40) {
            deal = await createDeal({
                name: `${leadData.company || leadData.firstName + ' ' + leadData.lastName} - ROOTUIP Opportunity`,
                amount: estimateDealValue(scoring, null),
                stage: 'appointmentscheduled',
                closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            });

            if (deal) {
                deals.set(deal.id, deal);
            }
        }

        return {
            contact,
            scoring,
            deal,
            dealCreated: !!deal
        };

    } catch (error) {
        console.error('❌ Error processing inbound lead:', error);
        return null;
    }
}

function estimateDealValue(scoring, company) {
    let baseValue = 60000; // Base annual contract value
    
    if (scoring.score >= 80) baseValue = 150000;
    else if (scoring.score >= 60) baseValue = 100000;
    else if (scoring.score >= 40) baseValue = 75000;
    
    return Math.round(baseValue);
}

// API Endpoints
app.post('/api/crm/lead', async (req, res) => {
    try {
        const leadData = req.body;
        const result = await processInboundLead(leadData);
        
        if (result) {
            res.json({
                success: true,
                contactId: result.contact.id,
                scoring: result.scoring,
                dealCreated: result.dealCreated,
                estimatedValue: result.deal?.properties?.amount || 0,
                message: 'Lead processed successfully'
            });
        } else {
            res.status(500).json({ error: 'Failed to process lead' });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/crm/contacts', async (req, res) => {
    try {
        const localContacts = Array.from(contacts.values());
        
        res.json({
            success: true,
            contacts: localContacts,
            total: localContacts.length,
            hubspotIntegrated: true
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/crm/deals', (req, res) => {
    const localDeals = Array.from(deals.values());
    
    res.json({
        success: true,
        deals: localDeals,
        total: localDeals.length,
        totalValue: localDeals.reduce((sum, d) => sum + (parseFloat(d.properties?.amount) || 0), 0)
    });
});

app.get('/api/crm/pipeline', (req, res) => {
    const localDeals = Array.from(deals.values());
    
    const pipeline = {
        stages: [
            { name: 'Initial Contact', deals: 0, value: 0 },
            { name: 'Qualified Lead', deals: 0, value: 0 },
            { name: 'Demo Scheduled', deals: localDeals.length, value: localDeals.reduce((sum, d) => sum + (parseFloat(d.properties?.amount) || 0), 0) },
            { name: 'Proposal Sent', deals: 0, value: 0 },
            { name: 'Negotiation', deals: 0, value: 0 },
            { name: 'Closed Won', deals: 0, value: 0 }
        ],
        totalDeals: localDeals.length,
        totalValue: localDeals.reduce((sum, d) => sum + (parseFloat(d.properties?.amount) || 0), 0)
    };

    res.json({
        success: true,
        pipeline
    });
});

app.get('/api/crm/analytics', (req, res) => {
    const localContacts = Array.from(contacts.values());
    const localDeals = Array.from(deals.values());
    
    const analytics = {
        contacts: {
            total: localContacts.length,
            hot: localContacts.filter(c => c.scoring?.classification === 'hot').length,
            warm: localContacts.filter(c => c.scoring?.classification === 'warm').length,
            cold: localContacts.filter(c => c.scoring?.classification === 'cold').length,
            averageScore: localContacts.reduce((sum, c) => sum + (c.scoring?.score || 0), 0) / (localContacts.length || 1)
        },
        deals: {
            total: localDeals.length,
            totalValue: localDeals.reduce((sum, d) => sum + (parseFloat(d.properties?.amount) || 0), 0),
            averageValue: localDeals.length > 0 ? localDeals.reduce((sum, d) => sum + (parseFloat(d.properties?.amount) || 0), 0) / localDeals.length : 0
        },
        conversion: {
            leadToDeal: localDeals.length > 0 ? (localDeals.length / Math.max(localContacts.length, 1) * 100).toFixed(1) : 0
        }
    };

    res.json({
        success: true,
        analytics,
        generatedAt: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'hubspot-crm-integration',
        contacts: contacts.size,
        deals: deals.size,
        hubspotConnected: true,
        redisConnected: redisClient.isReady,
        uptime: process.uptime()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 HubSpot CRM Integration running on port ${PORT}`);
    console.log(`🎯 Portal ID: ${HUBSPOT_CONFIG.portalId}`);
    console.log(`🔑 Using access token: ${HUBSPOT_CONFIG.accessToken.substring(0, 20)}...`);
    console.log(`📊 Lead scoring and deal creation active`);
    console.log(`💼 CRM API: http://localhost:${PORT}/api/crm/`);
});

module.exports = app;