const axios = require('axios');
const crypto = require('crypto');
const { Pool } = require('pg');

// Database connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rootuip'
});

// CRM Integration Engine
class CRMIntegrationEngine {
    constructor() {
        this.salesforceConfig = {
            clientId: process.env.SALESFORCE_CLIENT_ID,
            clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
            username: process.env.SALESFORCE_USERNAME,
            password: process.env.SALESFORCE_PASSWORD,
            securityToken: process.env.SALESFORCE_SECURITY_TOKEN,
            instanceUrl: process.env.SALESFORCE_INSTANCE_URL || 'https://rootuip.my.salesforce.com'
        };

        this.hubspotConfig = {
            apiKey: process.env.HUBSPOT_API_KEY,
            baseUrl: 'https://api.hubapi.com'
        };

        this.accessTokens = new Map();
        this.initializeCRM();
    }

    async initializeCRM() {
        try {
            await this.setupCRMDatabase();
            await this.authenticateSalesforce();
            console.log('CRM Integration Engine initialized');
        } catch (error) {
            console.error('CRM initialization error:', error);
        }
    }

    // SALESFORCE INTEGRATION
    async authenticateSalesforce() {
        try {
            const response = await axios.post(`${this.salesforceConfig.instanceUrl}/services/oauth2/token`, 
                new URLSearchParams({
                    grant_type: 'password',
                    client_id: this.salesforceConfig.clientId,
                    client_secret: this.salesforceConfig.clientSecret,
                    username: this.salesforceConfig.username,
                    password: this.salesforceConfig.password + this.salesforceConfig.securityToken
                }),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );

            this.accessTokens.set('salesforce', {
                token: response.data.access_token,
                instanceUrl: response.data.instance_url,
                expiresAt: Date.now() + (3600 * 1000) // 1 hour
            });

            console.log('Salesforce authentication successful');
            return true;
        } catch (error) {
            console.error('Salesforce authentication error:', error);
            return false;
        }
    }

    async createSalesforceContact(leadData) {
        try {
            const authData = this.accessTokens.get('salesforce');
            if (!authData || Date.now() > authData.expiresAt) {
                await this.authenticateSalesforce();
            }

            const contactData = {
                FirstName: leadData.name?.split(' ')[0] || '',
                LastName: leadData.name?.split(' ').slice(1).join(' ') || 'Unknown',
                Email: leadData.email,
                Phone: leadData.phone,
                Company: leadData.company,
                Title: leadData.jobTitle || '',
                Website: leadData.website,
                LeadSource: leadData.source || 'ROI Calculator',
                Lead_Score__c: leadData.lead_score,
                Annual_Revenue__c: leadData.annual_revenue,
                Company_Size__c: leadData.company_size,
                Budget_Range__c: leadData.budget_range,
                Timeline__c: leadData.timeline,
                Pain_Points__c: Array.isArray(leadData.pain_points) ? leadData.pain_points.join(', ') : '',
                ROI_Calculation_Data__c: JSON.stringify(leadData.roi_calculation_data),
                ROOTUIP_Lead_ID__c: leadData.lead_id
            };

            const response = await axios.post(
                `${authData.instanceUrl}/services/data/v57.0/sobjects/Contact/`,
                contactData,
                {
                    headers: {
                        'Authorization': `Bearer ${authData.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Store CRM mapping
            await this.storeCRMMapping(leadData.lead_id, 'salesforce', response.data.id, 'contact');

            return {
                platform: 'salesforce',
                recordId: response.data.id,
                recordType: 'contact',
                status: 'created'
            };
        } catch (error) {
            console.error('Salesforce contact creation error:', error);
            throw error;
        }
    }

    async createSalesforceOpportunity(leadData, contactId) {
        try {
            const authData = this.accessTokens.get('salesforce');
            
            const opportunityData = {
                Name: `${leadData.company} - ROOTUIP Implementation`,
                AccountId: await this.getOrCreateAccount(leadData),
                ContactId: contactId,
                StageName: this.mapLeadScoreToStage(leadData.lead_score),
                Amount: this.estimateOpportunityValue(leadData),
                CloseDate: this.calculateCloseDate(leadData.timeline),
                LeadSource: leadData.source || 'ROI Calculator',
                Description: `Opportunity generated from ROI Calculator. Estimated savings: $${leadData.roi_calculation_data?.estimatedSavings || 0}`,
                Lead_Score__c: leadData.lead_score,
                Pain_Points__c: Array.isArray(leadData.pain_points) ? leadData.pain_points.join(', ') : '',
                ROI_Data__c: JSON.stringify(leadData.roi_calculation_data),
                ROOTUIP_Lead_ID__c: leadData.lead_id
            };

            const response = await axios.post(
                `${authData.instanceUrl}/services/data/v57.0/sobjects/Opportunity/`,
                opportunityData,
                {
                    headers: {
                        'Authorization': `Bearer ${authData.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            await this.storeCRMMapping(leadData.lead_id, 'salesforce', response.data.id, 'opportunity');

            return {
                platform: 'salesforce',
                recordId: response.data.id,
                recordType: 'opportunity',
                status: 'created',
                estimatedValue: opportunityData.Amount
            };
        } catch (error) {
            console.error('Salesforce opportunity creation error:', error);
            throw error;
        }
    }

    async updateSalesforceRecord(recordId, recordType, updateData) {
        try {
            const authData = this.accessTokens.get('salesforce');
            
            const response = await axios.patch(
                `${authData.instanceUrl}/services/data/v57.0/sobjects/${recordType}/${recordId}`,
                updateData,
                {
                    headers: {
                        'Authorization': `Bearer ${authData.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return { status: 'updated', recordId };
        } catch (error) {
            console.error('Salesforce update error:', error);
            throw error;
        }
    }

    // HUBSPOT INTEGRATION
    async createHubSpotContact(leadData) {
        try {
            const contactProperties = {
                email: leadData.email,
                firstname: leadData.name?.split(' ')[0] || '',
                lastname: leadData.name?.split(' ').slice(1).join(' ') || '',
                phone: leadData.phone,
                company: leadData.company,
                website: leadData.website,
                jobtitle: leadData.jobTitle || '',
                hs_lead_status: this.mapScoreToHubSpotStatus(leadData.lead_score),
                lifecyclestage: 'lead',
                lead_score: leadData.lead_score,
                annual_revenue: leadData.annual_revenue,
                company_size: leadData.company_size,
                budget_range: leadData.budget_range,
                timeline: leadData.timeline,
                pain_points: Array.isArray(leadData.pain_points) ? leadData.pain_points.join(', ') : '',
                roi_calculation_data: JSON.stringify(leadData.roi_calculation_data),
                rootuip_lead_id: leadData.lead_id,
                original_source: leadData.source || 'ROI Calculator'
            };

            const response = await axios.post(
                `${this.hubspotConfig.baseUrl}/crm/v3/objects/contacts`,
                {
                    properties: contactProperties
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.hubspotConfig.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            await this.storeCRMMapping(leadData.lead_id, 'hubspot', response.data.id, 'contact');

            return {
                platform: 'hubspot',
                recordId: response.data.id,
                recordType: 'contact',
                status: 'created'
            };
        } catch (error) {
            console.error('HubSpot contact creation error:', error);
            throw error;
        }
    }

    async createHubSpotDeal(leadData, contactId) {
        try {
            const dealProperties = {
                dealname: `${leadData.company} - ROOTUIP Implementation`,
                dealstage: this.mapLeadScoreToHubSpotStage(leadData.lead_score),
                amount: this.estimateOpportunityValue(leadData),
                closedate: this.calculateCloseDate(leadData.timeline),
                hubspot_owner_id: process.env.HUBSPOT_DEFAULT_OWNER,
                lead_score: leadData.lead_score,
                pain_points: Array.isArray(leadData.pain_points) ? leadData.pain_points.join(', ') : '',
                roi_calculation_data: JSON.stringify(leadData.roi_calculation_data),
                rootuip_lead_id: leadData.lead_id,
                pipeline: 'default'
            };

            const response = await axios.post(
                `${this.hubspotConfig.baseUrl}/crm/v3/objects/deals`,
                {
                    properties: dealProperties,
                    associations: [
                        {
                            to: { id: contactId },
                            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 3 }] // Contact to Deal
                        }
                    ]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.hubspotConfig.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            await this.storeCRMMapping(leadData.lead_id, 'hubspot', response.data.id, 'deal');

            return {
                platform: 'hubspot',
                recordId: response.data.id,
                recordType: 'deal',
                status: 'created',
                estimatedValue: dealProperties.amount
            };
        } catch (error) {
            console.error('HubSpot deal creation error:', error);
            throw error;
        }
    }

    async updateHubSpotRecord(recordId, recordType, updateData) {
        try {
            const response = await axios.patch(
                `${this.hubspotConfig.baseUrl}/crm/v3/objects/${recordType}s/${recordId}`,
                {
                    properties: updateData
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.hubspotConfig.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return { status: 'updated', recordId };
        } catch (error) {
            console.error('HubSpot update error:', error);
            throw error;
        }
    }

    // UNIFIED CRM OPERATIONS
    async createCRMRecord(leadData) {
        const results = [];
        
        try {
            // Create in both Salesforce and HubSpot if configured
            if (this.salesforceConfig.clientId) {
                const sfContact = await this.createSalesforceContact(leadData);
                results.push(sfContact);
                
                // Create opportunity for qualified leads
                if (leadData.lead_score >= 60) {
                    const sfOpportunity = await this.createSalesforceOpportunity(leadData, sfContact.recordId);
                    results.push(sfOpportunity);
                }
            }

            if (this.hubspotConfig.apiKey) {
                const hsContact = await this.createHubSpotContact(leadData);
                results.push(hsContact);
                
                // Create deal for qualified leads
                if (leadData.lead_score >= 60) {
                    const hsDeal = await this.createHubSpotDeal(leadData, hsContact.recordId);
                    results.push(hsDeal);
                }
            }

            // Store activity log
            await this.logCRMActivity(leadData.lead_id, 'record_created', { results });

            return results;
        } catch (error) {
            console.error('CRM record creation error:', error);
            await this.logCRMActivity(leadData.lead_id, 'creation_failed', { error: error.message });
            throw error;
        }
    }

    async updateCRMRecord(leadId, updateData) {
        try {
            const mappings = await this.getCRMMappings(leadId);
            const results = [];

            for (const mapping of mappings) {
                let updateResult;
                
                if (mapping.platform === 'salesforce') {
                    const sfUpdateData = this.mapToSalesforceFields(updateData);
                    updateResult = await this.updateSalesforceRecord(
                        mapping.record_id, 
                        mapping.record_type, 
                        sfUpdateData
                    );
                } else if (mapping.platform === 'hubspot') {
                    const hsUpdateData = this.mapToHubSpotFields(updateData);
                    updateResult = await this.updateHubSpotRecord(
                        mapping.record_id, 
                        mapping.record_type, 
                        hsUpdateData
                    );
                }
                
                results.push({ ...updateResult, platform: mapping.platform });
            }

            await this.logCRMActivity(leadId, 'record_updated', { updateData, results });
            
            return results;
        } catch (error) {
            console.error('CRM record update error:', error);
            throw error;
        }
    }

    // ACTIVITY TRACKING
    async trackEmailEngagement(leadId, emailId, engagementType, metadata = {}) {
        try {
            const mappings = await this.getCRMMappings(leadId);
            
            for (const mapping of mappings) {
                if (mapping.platform === 'salesforce') {
                    await this.createSalesforceTask(mapping.record_id, {
                        Subject: `Email ${engagementType}: ${emailId}`,
                        Description: `Email engagement tracked from ROOTUIP system`,
                        ActivityDate: new Date().toISOString().split('T')[0],
                        Status: 'Completed',
                        Type: 'Email',
                        Priority: 'Normal'
                    });
                } else if (mapping.platform === 'hubspot') {
                    await this.createHubSpotEngagement(mapping.record_id, {
                        engagement: {
                            type: 'EMAIL',
                            timestamp: Date.now()
                        },
                        metadata: {
                            subject: `Email ${engagementType}`,
                            text: `Email engagement tracked: ${engagementType}`
                        }
                    });
                }
            }

            await this.logCRMActivity(leadId, 'email_engagement', { emailId, engagementType, metadata });
        } catch (error) {
            console.error('Email engagement tracking error:', error);
        }
    }

    async trackDemoBooking(leadId, demoData) {
        try {
            const mappings = await this.getCRMMappings(leadId);
            
            for (const mapping of mappings) {
                if (mapping.platform === 'salesforce') {
                    await this.createSalesforceEvent(mapping.record_id, {
                        Subject: 'ROOTUIP Demo Scheduled',
                        StartDateTime: new Date(demoData.scheduled_date).toISOString(),
                        EndDateTime: new Date(new Date(demoData.scheduled_date).getTime() + 30 * 60000).toISOString(),
                        Description: `Demo scheduled with focus areas: ${demoData.focus_areas?.join(', ') || 'General'}`
                    });
                } else if (mapping.platform === 'hubspot') {
                    await this.createHubSpotMeeting(mapping.record_id, {
                        engagement: {
                            type: 'MEETING',
                            timestamp: new Date(demoData.scheduled_date).getTime()
                        },
                        metadata: {
                            title: 'ROOTUIP Demo',
                            body: `Demo scheduled with focus areas: ${demoData.focus_areas?.join(', ') || 'General'}`
                        }
                    });
                }
            }

            await this.logCRMActivity(leadId, 'demo_scheduled', demoData);
        } catch (error) {
            console.error('Demo booking tracking error:', error);
        }
    }

    // PIPELINE AUTOMATION
    async progressPipeline(leadId, newStage, reason = 'automatic') {
        try {
            const mappings = await this.getCRMMappings(leadId);
            
            for (const mapping of mappings) {
                if (mapping.record_type === 'opportunity' || mapping.record_type === 'deal') {
                    let updateData;
                    
                    if (mapping.platform === 'salesforce') {
                        updateData = { StageName: newStage };
                        await this.updateSalesforceRecord(mapping.record_id, 'Opportunity', updateData);
                    } else if (mapping.platform === 'hubspot') {
                        updateData = { dealstage: this.mapStageToHubSpot(newStage) };
                        await this.updateHubSpotRecord(mapping.record_id, 'deal', updateData);
                    }
                }
            }

            await this.logCRMActivity(leadId, 'pipeline_progression', { newStage, reason });
            
            return { status: 'progressed', newStage };
        } catch (error) {
            console.error('Pipeline progression error:', error);
            throw error;
        }
    }

    // ATTRIBUTION REPORTING
    async getAttributionReport(dateRange = 30) {
        try {
            const report = await db.query(`
                SELECT 
                    l.source,
                    COUNT(*) as total_leads,
                    COUNT(CASE WHEN l.lead_score >= 80 THEN 1 END) as hot_leads,
                    COUNT(CASE WHEN l.lead_score >= 60 THEN 1 END) as qualified_leads,
                    COUNT(CASE WHEN db.demo_id IS NOT NULL THEN 1 END) as demos_booked,
                    AVG(l.lead_score) as avg_lead_score,
                    SUM(CAST(l.roi_calculation_data->>'estimatedSavings' AS NUMERIC)) as total_estimated_value
                FROM leads l
                LEFT JOIN demo_bookings db ON l.lead_id = db.lead_id
                WHERE l.created_at > NOW() - INTERVAL '${dateRange} days'
                GROUP BY l.source
                ORDER BY total_leads DESC
            `);

            const crmConversions = await db.query(`
                SELECT 
                    l.source,
                    cm.platform,
                    cm.record_type,
                    COUNT(*) as crm_records
                FROM leads l
                JOIN crm_mappings cm ON l.lead_id = cm.lead_id
                WHERE l.created_at > NOW() - INTERVAL '${dateRange} days'
                GROUP BY l.source, cm.platform, cm.record_type
                ORDER BY crm_records DESC
            `);

            return {
                leadAttribution: report.rows,
                crmConversions: crmConversions.rows,
                reportPeriod: `${dateRange} days`,
                generatedAt: new Date()
            };
        } catch (error) {
            console.error('Attribution report error:', error);
            throw error;
        }
    }

    // MAPPING AND UTILITY METHODS
    mapLeadScoreToStage(score) {
        if (score >= 90) return 'Proposal/Price Quote';
        if (score >= 80) return 'Negotiation/Review';
        if (score >= 70) return 'Qualification';
        if (score >= 60) return 'Needs Analysis';
        if (score >= 40) return 'Prospecting';
        return 'Qualification';
    }

    mapLeadScoreToHubSpotStage(score) {
        if (score >= 90) return 'decisionmakerboughtin';
        if (score >= 80) return 'contractsent';
        if (score >= 70) return 'presentationscheduled';
        if (score >= 60) return 'qualifiedtobuy';
        if (score >= 40) return 'appointmentscheduled';
        return 'appointmentscheduled';
    }

    mapScoreToHubSpotStatus(score) {
        if (score >= 80) return 'QUALIFIED';
        if (score >= 60) return 'IN_PROGRESS';
        if (score >= 40) return 'OPEN';
        return 'NEW';
    }

    estimateOpportunityValue(leadData) {
        const baseValue = leadData.roi_calculation_data?.estimatedSavings || 0;
        const multiplier = this.getValueMultiplier(leadData.company_size);
        return Math.round(baseValue * multiplier * 0.3); // 30% of estimated savings as deal value
    }

    getValueMultiplier(companySize) {
        const multipliers = {
            'enterprise': 2.0,
            'large': 1.5,
            'medium': 1.0,
            'small': 0.7,
            'startup': 0.5
        };
        return multipliers[companySize] || 1.0;
    }

    calculateCloseDate(timeline) {
        const baseDate = new Date();
        const timelineMap = {
            'immediate': 30,
            '1-3-months': 90,
            '3-6-months': 180,
            '6-12-months': 365,
            '12+-months': 730
        };
        
        const days = timelineMap[timeline] || 180;
        baseDate.setDate(baseDate.getDate() + days);
        return baseDate.toISOString().split('T')[0];
    }

    mapToSalesforceFields(data) {
        const fieldMap = {
            leadScore: 'Lead_Score__c',
            companySize: 'Company_Size__c',
            budgetRange: 'Budget_Range__c',
            timeline: 'Timeline__c',
            painPoints: 'Pain_Points__c',
            demoScheduled: 'Demo_Scheduled__c'
        };

        const mapped = {};
        Object.keys(data).forEach(key => {
            if (fieldMap[key]) {
                mapped[fieldMap[key]] = data[key];
            }
        });
        return mapped;
    }

    mapToHubSpotFields(data) {
        const fieldMap = {
            leadScore: 'lead_score',
            companySize: 'company_size',
            budgetRange: 'budget_range',
            timeline: 'timeline',
            painPoints: 'pain_points',
            demoScheduled: 'demo_scheduled'
        };

        const mapped = {};
        Object.keys(data).forEach(key => {
            if (fieldMap[key]) {
                mapped[fieldMap[key]] = data[key];
            }
        });
        return mapped;
    }

    // DATABASE OPERATIONS
    async storeCRMMapping(leadId, platform, recordId, recordType) {
        await db.query(`
            INSERT INTO crm_mappings (
                lead_id, platform, record_id, record_type, created_at
            ) VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (lead_id, platform, record_type) 
            DO UPDATE SET record_id = $3, updated_at = NOW()
        `, [leadId, platform, recordId, recordType]);
    }

    async getCRMMappings(leadId) {
        const result = await db.query(
            'SELECT * FROM crm_mappings WHERE lead_id = $1',
            [leadId]
        );
        return result.rows;
    }

    async logCRMActivity(leadId, activityType, data) {
        await db.query(`
            INSERT INTO crm_activity_log (
                lead_id, activity_type, activity_data, created_at
            ) VALUES ($1, $2, $3, NOW())
        `, [leadId, activityType, JSON.stringify(data)]);
    }

    async setupCRMDatabase() {
        try {
            // CRM mappings table
            await db.query(`
                CREATE TABLE IF NOT EXISTS crm_mappings (
                    id SERIAL PRIMARY KEY,
                    lead_id UUID,
                    platform VARCHAR(50),
                    record_id VARCHAR(255),
                    record_type VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(lead_id, platform, record_type)
                )
            `);

            // CRM activity log
            await db.query(`
                CREATE TABLE IF NOT EXISTS crm_activity_log (
                    id SERIAL PRIMARY KEY,
                    lead_id UUID,
                    activity_type VARCHAR(100),
                    activity_data JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Create indexes
            await db.query(`
                CREATE INDEX IF NOT EXISTS idx_crm_mappings_lead_id ON crm_mappings(lead_id);
                CREATE INDEX IF NOT EXISTS idx_crm_activity_lead_id ON crm_activity_log(lead_id);
                CREATE INDEX IF NOT EXISTS idx_crm_activity_type ON crm_activity_log(activity_type);
            `);

            console.log('CRM database setup complete');
        } catch (error) {
            console.error('CRM database setup error:', error);
        }
    }

    // SALESFORCE HELPER METHODS
    async createSalesforceTask(contactId, taskData) {
        try {
            const authData = this.accessTokens.get('salesforce');
            
            const response = await axios.post(
                `${authData.instanceUrl}/services/data/v57.0/sobjects/Task/`,
                { ...taskData, WhoId: contactId },
                {
                    headers: {
                        'Authorization': `Bearer ${authData.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Salesforce task creation error:', error);
        }
    }

    async createSalesforceEvent(contactId, eventData) {
        try {
            const authData = this.accessTokens.get('salesforce');
            
            const response = await axios.post(
                `${authData.instanceUrl}/services/data/v57.0/sobjects/Event/`,
                { ...eventData, WhoId: contactId },
                {
                    headers: {
                        'Authorization': `Bearer ${authData.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Salesforce event creation error:', error);
        }
    }

    async getOrCreateAccount(leadData) {
        // For demo purposes, return a placeholder account ID
        // In production, search for existing account or create new one
        return '001XX000003DHPu';
    }

    // HUBSPOT HELPER METHODS
    async createHubSpotEngagement(contactId, engagementData) {
        try {
            const response = await axios.post(
                `${this.hubspotConfig.baseUrl}/engagements/v1/engagements`,
                {
                    ...engagementData,
                    associations: {
                        contactIds: [contactId]
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.hubspotConfig.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('HubSpot engagement creation error:', error);
        }
    }

    async createHubSpotMeeting(contactId, meetingData) {
        return this.createHubSpotEngagement(contactId, meetingData);
    }

    mapStageToHubSpot(stage) {
        const stageMap = {
            'Prospecting': 'appointmentscheduled',
            'Qualification': 'qualifiedtobuy',
            'Needs Analysis': 'presentationscheduled',
            'Proposal/Price Quote': 'decisionmakerboughtin',
            'Negotiation/Review': 'contractsent',
            'Closed Won': 'closedwon',
            'Closed Lost': 'closedlost'
        };
        return stageMap[stage] || 'appointmentscheduled';
    }
}

module.exports = CRMIntegrationEngine;