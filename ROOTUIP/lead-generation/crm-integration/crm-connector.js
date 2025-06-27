// CRM Integration System for ROOTUIP Lead Generation
class CRMConnector {
    constructor(config) {
        this.config = config;
        this.crmType = config.crmType; // 'salesforce', 'hubspot', 'pipedrive', etc.
        this.apiEndpoint = config.apiEndpoint;
        this.apiKey = config.apiKey;
        this.leadScoringEngine = new LeadScoringEngine();
        
        // Initialize connection based on CRM type
        this.initializeConnection();
    }
    
    initializeConnection() {
        switch (this.crmType) {
            case 'salesforce':
                this.connector = new SalesforceConnector(this.config);
                break;
            case 'hubspot':
                this.connector = new HubSpotConnector(this.config);
                break;
            case 'pipedrive':
                this.connector = new PipedriveConnector(this.config);
                break;
            default:
                this.connector = new GenericCRMConnector(this.config);
        }
    }
    
    // Create or update lead in CRM
    async syncLead(leadData) {
        try {
            // Calculate lead score
            const scoreData = this.leadScoringEngine.calculateLeadScore(leadData);
            
            // Enrich lead data with scoring
            const enrichedLead = {
                ...leadData,
                lead_score: scoreData.totalScore,
                lead_grade: scoreData.gradeLevel,
                score_breakdown: JSON.stringify(scoreData.scoreBreakdown),
                recommended_action: scoreData.recommendedAction,
                velocity_score: scoreData.velocityScore,
                last_scored: scoreData.scoringDate,
                next_review: scoreData.nextReviewDate,
                source_detail: this.getSourceDetail(leadData.source),
                lifecycle_stage: this.determineLifecycleStage(scoreData)
            };
            
            // Check if lead exists
            const existingLead = await this.findLeadByEmail(enrichedLead.email);
            
            let result;
            if (existingLead) {
                // Update existing lead
                result = await this.updateLead(existingLead.id, enrichedLead);
                
                // Log activity
                await this.logActivity(existingLead.id, 'lead_updated', {
                    updates: this.getChangedFields(existingLead, enrichedLead),
                    previous_score: existingLead.lead_score,
                    new_score: scoreData.totalScore
                });
            } else {
                // Create new lead
                result = await this.createLead(enrichedLead);
                
                // Log activity
                await this.logActivity(result.id, 'lead_created', {
                    source: leadData.source,
                    initial_score: scoreData.totalScore
                });
                
                // Trigger welcome automation
                await this.triggerAutomation('new_lead_welcome', result.id);
            }
            
            // Handle lead routing
            await this.routeLead(result.id, scoreData);
            
            // Trigger score-based automations
            await this.handleScoreBasedActions(result.id, scoreData);
            
            return {
                success: true,
                leadId: result.id,
                action: existingLead ? 'updated' : 'created',
                score: scoreData
            };
            
        } catch (error) {
            console.error('CRM sync error:', error);
            
            // Queue for retry
            await this.queueForRetry(leadData);
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Create new lead
    async createLead(leadData) {
        const crmData = this.mapToCRMFormat(leadData);
        return await this.connector.createRecord('Lead', crmData);
    }
    
    // Update existing lead
    async updateLead(leadId, leadData) {
        const crmData = this.mapToCRMFormat(leadData);
        return await this.connector.updateRecord('Lead', leadId, crmData);
    }
    
    // Find lead by email
    async findLeadByEmail(email) {
        return await this.connector.findRecord('Lead', {
            email: email
        });
    }
    
    // Log activity in CRM
    async logActivity(leadId, activityType, details) {
        const activity = {
            leadId: leadId,
            type: activityType,
            timestamp: new Date().toISOString(),
            details: JSON.stringify(details),
            source: 'rootuip_lead_gen'
        };
        
        return await this.connector.createRecord('Activity', activity);
    }
    
    // Lead routing based on score and criteria
    async routeLead(leadId, scoreData) {
        let assignedTo = null;
        
        // Route based on grade
        if (scoreData.gradeLevel === 'A') {
            // Assign to senior sales rep
            assignedTo = await this.getAvailableSalesRep('senior', scoreData);
        } else if (scoreData.gradeLevel === 'B') {
            // Assign to regular sales rep
            assignedTo = await this.getAvailableSalesRep('regular', scoreData);
        } else {
            // Keep in marketing nurture
            assignedTo = 'marketing_automation';
        }
        
        if (assignedTo && assignedTo !== 'marketing_automation') {
            await this.assignLead(leadId, assignedTo);
            await this.notifySalesRep(assignedTo, leadId, scoreData);
        }
        
        return assignedTo;
    }
    
    // Get available sales rep based on criteria
    async getAvailableSalesRep(level, scoreData) {
        // This would typically query your CRM for available reps
        // based on territory, workload, expertise, etc.
        const criteria = {
            level: level,
            industry: scoreData.industry,
            dealSize: this.estimateDealSize(scoreData),
            region: scoreData.region
        };
        
        return await this.connector.getAvailableRep(criteria);
    }
    
    // Assign lead to sales rep
    async assignLead(leadId, repId) {
        await this.connector.updateRecord('Lead', leadId, {
            ownerId: repId,
            assignedDate: new Date().toISOString(),
            status: 'Assigned'
        });
        
        // Create task for follow-up
        await this.createTask(leadId, repId, 'Initial follow-up', 1); // Due in 1 day
    }
    
    // Create task in CRM
    async createTask(leadId, assignedTo, taskType, dueDays) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dueDays);
        
        const task = {
            leadId: leadId,
            assignedTo: assignedTo,
            type: taskType,
            priority: this.getTaskPriority(taskType),
            dueDate: dueDate.toISOString(),
            status: 'Open',
            description: this.getTaskDescription(taskType, leadId)
        };
        
        return await this.connector.createRecord('Task', task);
    }
    
    // Handle score-based automated actions
    async handleScoreBasedActions(leadId, scoreData) {
        const actions = [];
        
        // High-value lead actions
        if (scoreData.totalScore >= 85) {
            actions.push(this.createSalesAlert(leadId, 'high_value_lead', scoreData));
            actions.push(this.triggerAutomation('high_value_nurture', leadId));
            actions.push(this.addToCampaign(leadId, 'vip_fast_track'));
        }
        
        // Medium-value lead actions
        else if (scoreData.totalScore >= 70) {
            actions.push(this.triggerAutomation('priority_nurture', leadId));
            actions.push(this.addToCampaign(leadId, 'standard_evaluation'));
        }
        
        // Developing lead actions
        else if (scoreData.totalScore >= 50) {
            actions.push(this.triggerAutomation('education_series', leadId));
            actions.push(this.addToCampaign(leadId, 'thought_leadership'));
        }
        
        // Handle specific score components
        if (scoreData.scoreBreakdown.intent >= 25) {
            actions.push(this.createSalesAlert(leadId, 'high_intent', scoreData));
        }
        
        if (scoreData.velocityScore >= 80) {
            actions.push(this.createSalesAlert(leadId, 'fast_moving_lead', scoreData));
        }
        
        await Promise.all(actions);
    }
    
    // Create sales alert
    async createSalesAlert(leadId, alertType, data) {
        const alert = {
            leadId: leadId,
            type: alertType,
            priority: this.getAlertPriority(alertType, data),
            message: this.getAlertMessage(alertType, data),
            data: JSON.stringify(data),
            createdAt: new Date().toISOString(),
            status: 'new'
        };
        
        // Create alert in CRM
        const alertRecord = await this.connector.createRecord('Alert', alert);
        
        // Send immediate notification
        await this.sendAlertNotification(alert);
        
        return alertRecord;
    }
    
    // Trigger marketing automation
    async triggerAutomation(automationType, leadId) {
        const automation = {
            type: automationType,
            leadId: leadId,
            triggeredAt: new Date().toISOString(),
            status: 'active'
        };
        
        // This would typically call your marketing automation platform
        return await this.connector.triggerAutomation(automation);
    }
    
    // Add lead to campaign
    async addToCampaign(leadId, campaignName) {
        const campaign = await this.connector.findRecord('Campaign', {
            name: campaignName
        });
        
        if (campaign) {
            return await this.connector.addToCampaign(leadId, campaign.id);
        }
    }
    
    // Pipeline progression automation
    async updatePipelineStage(leadId, newStage, reason) {
        const stageUpdate = {
            stage: newStage,
            stageChangedDate: new Date().toISOString(),
            stageChangeReason: reason
        };
        
        await this.connector.updateRecord('Lead', leadId, stageUpdate);
        
        // Log stage change
        await this.logActivity(leadId, 'stage_changed', {
            previousStage: await this.getPreviousStage(leadId),
            newStage: newStage,
            reason: reason
        });
        
        // Trigger stage-specific actions
        await this.handleStageChangeActions(leadId, newStage);
    }
    
    // Attribution tracking
    async trackAttribution(leadId, touchpoint) {
        const attribution = {
            leadId: leadId,
            touchpoint: touchpoint.type,
            channel: touchpoint.channel,
            campaign: touchpoint.campaign,
            content: touchpoint.content,
            timestamp: touchpoint.timestamp || new Date().toISOString(),
            value: touchpoint.value || 0
        };
        
        await this.connector.createRecord('Attribution', attribution);
        
        // Update lead's attribution summary
        await this.updateAttributionSummary(leadId);
    }
    
    // Utility functions
    mapToCRMFormat(leadData) {
        // Map ROOTUIP lead format to specific CRM format
        return this.connector.mapFields(leadData);
    }
    
    getSourceDetail(source) {
        const sourceMap = {
            'roi_calculator': 'ROI Calculator - Gated',
            'whitepaper': 'Whitepaper Download',
            'demo_request': 'Demo Request Form',
            'assessment': 'System Assessment Tool',
            'newsletter': 'Newsletter Signup',
            'webinar': 'Webinar Registration'
        };
        
        return sourceMap[source] || source;
    }
    
    determineLifecycleStage(scoreData) {
        if (scoreData.gradeLevel === 'A') return 'sales_qualified_lead';
        if (scoreData.gradeLevel === 'B') return 'marketing_qualified_lead';
        if (scoreData.gradeLevel === 'C') return 'lead';
        return 'subscriber';
    }
    
    getChangedFields(oldData, newData) {
        const changes = {};
        for (const key in newData) {
            if (oldData[key] !== newData[key]) {
                changes[key] = {
                    old: oldData[key],
                    new: newData[key]
                };
            }
        }
        return changes;
    }
    
    estimateDealSize(scoreData) {
        // Estimate based on company size and potential savings
        const baseSize = scoreData.scoreBreakdown.companySize * 50000;
        const multiplier = scoreData.totalScore / 100;
        return Math.round(baseSize * multiplier);
    }
    
    getTaskPriority(taskType) {
        const priorities = {
            'Initial follow-up': 'high',
            'Demo preparation': 'high',
            'Proposal follow-up': 'medium',
            'Check-in call': 'low'
        };
        return priorities[taskType] || 'medium';
    }
    
    getAlertPriority(alertType, data) {
        if (alertType === 'high_value_lead' || data.totalScore >= 90) return 'critical';
        if (alertType === 'high_intent' || alertType === 'fast_moving_lead') return 'high';
        return 'medium';
    }
    
    getAlertMessage(alertType, data) {
        const messages = {
            'high_value_lead': `New high-value lead scored ${data.totalScore}/100. Immediate follow-up recommended.`,
            'high_intent': `Lead showing strong buying signals. Recent actions indicate immediate interest.`,
            'fast_moving_lead': `Lead progressing rapidly through funnel. Velocity score: ${data.velocityScore}.`,
            'grade_improved': `Lead grade improved from ${data.previousGrade} to ${data.gradeLevel}.`
        };
        
        return messages[alertType] || `New alert: ${alertType}`;
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CRMConnector;
}