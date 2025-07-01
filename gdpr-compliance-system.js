/**
 * ROOTUIP GDPR Compliance System
 * Comprehensive data protection and privacy compliance for EU market
 */

const EventEmitter = require('events');
const crypto = require('crypto');

// GDPR Compliance Manager
class GDPRComplianceManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            dataRetentionPeriod: config.dataRetentionPeriod || 2555, // 7 years in days
            cookieConsentRequired: config.cookieConsentRequired !== false,
            dataProcessingPurposes: config.dataProcessingPurposes || [
                'service_provision',
                'billing',
                'analytics',
                'marketing',
                'support'
            ],
            lawfulBases: config.lawfulBases || [
                'consent',
                'contract',
                'legal_obligation',
                'vital_interests',
                'public_task',
                'legitimate_interests'
            ],
            ...config
        };
        
        this.consentRecords = new Map();
        this.dataRequests = new Map();
        this.processingActivities = new Map();
        this.dataBreaches = new Map();
        this.privacyPolicies = new Map();
        
        this.setupProcessingActivities();
    }
    
    // Setup data processing activities register
    setupProcessingActivities() {
        // Customer Account Management
        this.processingActivities.set('customer_accounts', {
            id: 'customer_accounts',
            name: 'Customer Account Management',
            purpose: 'Managing customer accounts and providing container tracking services',
            lawfulBasis: 'contract',
            dataCategories: [
                'identity_data',
                'contact_data',
                'financial_data',
                'usage_data'
            ],
            dataSubjects: ['customers', 'prospects'],
            recipients: ['internal_teams', 'payment_processors'],
            retentionPeriod: 2555, // 7 years
            crossBorderTransfers: {
                countries: ['US', 'Canada'],
                safeguards: 'adequacy_decision'
            },
            technicalMeasures: [
                'encryption_at_rest',
                'encryption_in_transit',
                'access_controls',
                'audit_logging'
            ],
            organizationalMeasures: [
                'staff_training',
                'data_protection_policies',
                'incident_response_plan'
            ]
        });
        
        // Container Tracking
        this.processingActivities.set('container_tracking', {
            id: 'container_tracking',
            name: 'Container Tracking Services',
            purpose: 'Providing real-time container location and status tracking',
            lawfulBasis: 'contract',
            dataCategories: [
                'container_data',
                'location_data',
                'shipment_data',
                'usage_data'
            ],
            dataSubjects: ['customers'],
            recipients: ['shipping_partners', 'logistics_providers'],
            retentionPeriod: 1825, // 5 years
            crossBorderTransfers: {
                countries: ['various_shipping_countries'],
                safeguards: 'standard_contractual_clauses'
            },
            technicalMeasures: [
                'api_authentication',
                'data_minimization',
                'pseudonymization'
            ],
            organizationalMeasures: [
                'data_sharing_agreements',
                'vendor_assessments'
            ]
        });
        
        // Marketing Communications
        this.processingActivities.set('marketing', {
            id: 'marketing',
            name: 'Marketing Communications',
            purpose: 'Sending marketing communications and improving services',
            lawfulBasis: 'consent',
            dataCategories: [
                'identity_data',
                'contact_data',
                'usage_data',
                'behavioral_data'
            ],
            dataSubjects: ['customers', 'prospects'],
            recipients: ['marketing_platforms', 'analytics_providers'],
            retentionPeriod: 1095, // 3 years
            crossBorderTransfers: {
                countries: ['US'],
                safeguards: 'adequacy_decision'
            },
            technicalMeasures: [
                'opt_out_mechanisms',
                'preference_centers',
                'data_segmentation'
            ],
            organizationalMeasures: [
                'consent_management',
                'marketing_policies'
            ]
        });
        
        // Analytics and Performance
        this.processingActivities.set('analytics', {
            id: 'analytics',
            name: 'Website and Service Analytics',
            purpose: 'Understanding user behavior and improving service performance',
            lawfulBasis: 'legitimate_interests',
            dataCategories: [
                'usage_data',
                'technical_data',
                'behavioral_data'
            ],
            dataSubjects: ['users', 'customers'],
            recipients: ['analytics_providers'],
            retentionPeriod: 730, // 2 years
            crossBorderTransfers: {
                countries: ['US'],
                safeguards: 'adequacy_decision'
            },
            technicalMeasures: [
                'data_anonymization',
                'ip_masking',
                'cookie_controls'
            ],
            organizationalMeasures: [
                'privacy_impact_assessments',
                'balancing_tests'
            ]
        });
    }
    
    // Consent Management
    async recordConsent(userId, consentData) {
        const consentRecord = {
            id: this.generateConsentId(),
            userId,
            timestamp: new Date(),
            ipAddress: consentData.ipAddress,
            userAgent: consentData.userAgent,
            consentMethod: consentData.method || 'explicit',
            consentScope: consentData.scope || [],
            purposes: consentData.purposes || [],
            lawfulBasis: consentData.lawfulBasis || 'consent',
            consentString: consentData.consentString,
            tcfString: consentData.tcfString, // IAB TCF consent string
            version: consentData.version || '1.0',
            language: consentData.language || 'en',
            withdrawal: null,
            status: 'active'
        };
        
        this.consentRecords.set(consentRecord.id, consentRecord);
        
        // Update user's current consent status
        await this.updateUserConsentStatus(userId, consentRecord);
        
        this.emit('consent_recorded', {
            consentId: consentRecord.id,
            userId,
            purposes: consentRecord.purposes
        });
        
        return consentRecord;
    }
    
    async withdrawConsent(userId, withdrawalData) {
        const userConsents = this.getUserConsents(userId);
        const activeConsent = userConsents.find(c => c.status === 'active');
        
        if (!activeConsent) {
            throw new Error('No active consent found for user');
        }
        
        // Record withdrawal
        const withdrawal = {
            timestamp: new Date(),
            method: withdrawalData.method || 'explicit',
            ipAddress: withdrawalData.ipAddress,
            userAgent: withdrawalData.userAgent,
            reason: withdrawalData.reason,
            partialWithdrawal: withdrawalData.purposes || null
        };
        
        if (withdrawalData.purposes) {
            // Partial withdrawal - update purposes
            activeConsent.purposes = activeConsent.purposes.filter(
                purpose => !withdrawalData.purposes.includes(purpose)
            );
            activeConsent.withdrawal = withdrawal;
        } else {
            // Full withdrawal
            activeConsent.status = 'withdrawn';
            activeConsent.withdrawal = withdrawal;
        }
        
        await this.updateUserConsentStatus(userId, activeConsent);
        
        this.emit('consent_withdrawn', {
            consentId: activeConsent.id,
            userId,
            withdrawnPurposes: withdrawalData.purposes || 'all',
            withdrawal
        });
        
        return activeConsent;
    }
    
    getUserConsents(userId) {
        return Array.from(this.consentRecords.values())
            .filter(consent => consent.userId === userId)
            .sort((a, b) => b.timestamp - a.timestamp);
    }
    
    async updateUserConsentStatus(userId, consentRecord) {
        // This would update the user's consent preferences in the database
        // For now, we'll just emit an event
        this.emit('user_consent_updated', {
            userId,
            consentId: consentRecord.id,
            purposes: consentRecord.purposes,
            status: consentRecord.status
        });
    }
    
    // Data Subject Rights (DSR) Handling
    async handleDataSubjectRequest(requestData) {
        const request = {
            id: this.generateRequestId(),
            type: requestData.type, // 'access', 'rectification', 'erasure', 'portability', 'restriction', 'objection'
            userId: requestData.userId,
            email: requestData.email,
            requestDate: new Date(),
            status: 'pending_verification',
            verificationMethod: requestData.verificationMethod || 'email',
            verificationCode: this.generateVerificationCode(),
            verificationExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            requestDetails: requestData.details || {},
            processingDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            responseMethod: requestData.responseMethod || 'email',
            documents: [],
            processingLog: [{
                timestamp: new Date(),
                action: 'request_received',
                details: 'Data subject request received and assigned ID'
            }]
        };
        
        this.dataRequests.set(request.id, request);
        
        // Send verification email
        await this.sendVerificationEmail(request);
        
        this.emit('dsr_request_received', {
            requestId: request.id,
            type: request.type,
            userId: request.userId
        });
        
        return request;
    }
    
    async verifyDataSubjectRequest(requestId, verificationCode) {
        const request = this.dataRequests.get(requestId);
        if (!request) {
            throw new Error('Request not found');
        }
        
        if (request.status !== 'pending_verification') {
            throw new Error('Request is not pending verification');
        }
        
        if (new Date() > request.verificationExpiry) {
            throw new Error('Verification code has expired');
        }
        
        if (request.verificationCode !== verificationCode) {
            throw new Error('Invalid verification code');
        }
        
        request.status = 'verified';
        request.verificationDate = new Date();
        request.processingLog.push({
            timestamp: new Date(),
            action: 'request_verified',
            details: 'Identity verified successfully'
        });
        
        // Start processing the request
        await this.processDataSubjectRequest(request);
        
        return request;
    }
    
    async processDataSubjectRequest(request) {
        request.status = 'processing';
        request.processingStartDate = new Date();
        request.processingLog.push({
            timestamp: new Date(),
            action: 'processing_started',
            details: `Started processing ${request.type} request`
        });
        
        try {
            let result;
            
            switch (request.type) {
                case 'access':
                    result = await this.processAccessRequest(request);
                    break;
                case 'rectification':
                    result = await this.processRectificationRequest(request);
                    break;
                case 'erasure':
                    result = await this.processErasureRequest(request);
                    break;
                case 'portability':
                    result = await this.processPortabilityRequest(request);
                    break;
                case 'restriction':
                    result = await this.processRestrictionRequest(request);
                    break;
                case 'objection':
                    result = await this.processObjectionRequest(request);
                    break;
                default:
                    throw new Error(`Unsupported request type: ${request.type}`);
            }
            
            request.status = 'completed';
            request.completionDate = new Date();
            request.result = result;
            request.processingLog.push({
                timestamp: new Date(),
                action: 'processing_completed',
                details: `${request.type} request completed successfully`
            });
            
            await this.sendCompletionNotification(request);
            
        } catch (error) {
            request.status = 'failed';
            request.error = error.message;
            request.processingLog.push({
                timestamp: new Date(),
                action: 'processing_failed',
                details: error.message
            });
            
            await this.sendErrorNotification(request, error);
        }
        
        this.emit('dsr_request_processed', {
            requestId: request.id,
            type: request.type,
            status: request.status,
            userId: request.userId
        });
        
        return request;
    }
    
    async processAccessRequest(request) {
        const userData = await this.collectUserData(request.userId);
        
        const dataPackage = {
            requestId: request.id,
            userId: request.userId,
            exportDate: new Date(),
            dataCategories: userData,
            processingActivities: this.getRelevantProcessingActivities(request.userId),
            consents: this.getUserConsents(request.userId),
            retentionInfo: this.getUserDataRetention(request.userId)
        };
        
        // Generate secure download link
        const downloadToken = this.generateDownloadToken();
        const downloadUrl = await this.createSecureDownload(dataPackage, downloadToken);
        
        return {
            type: 'data_access',
            downloadUrl,
            downloadToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            dataCategories: Object.keys(userData),
            recordCount: this.getTotalRecordCount(userData)
        };
    }
    
    async processErasureRequest(request) {
        const erasureResults = await this.eraseUserData(request.userId, request.requestDetails);
        
        return {
            type: 'data_erasure',
            erasedCategories: erasureResults.categories,
            recordsDeleted: erasureResults.recordCount,
            retainedData: erasureResults.retained,
            retentionReasons: erasureResults.retentionReasons
        };
    }
    
    async processPortabilityRequest(request) {
        const portableData = await this.extractPortableData(request.userId);
        const exportFormat = request.requestDetails.format || 'json';
        
        const dataPackage = await this.formatPortableData(portableData, exportFormat);
        const downloadToken = this.generateDownloadToken();
        const downloadUrl = await this.createSecureDownload(dataPackage, downloadToken);
        
        return {
            type: 'data_portability',
            format: exportFormat,
            downloadUrl,
            downloadToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            dataSize: dataPackage.size
        };
    }
    
    async processRectificationRequest(request) {
        const corrections = request.requestDetails.corrections || {};
        const correctionResults = await this.correctUserData(request.userId, corrections);
        
        return {
            type: 'data_rectification',
            correctedFields: correctionResults.fields,
            verificationRequired: correctionResults.verificationRequired,
            effectiveDate: new Date()
        };
    }
    
    async processRestrictionRequest(request) {
        const restrictions = await this.restrictDataProcessing(
            request.userId, 
            request.requestDetails.activities || []
        );
        
        return {
            type: 'processing_restriction',
            restrictedActivities: restrictions.activities,
            effectiveDate: new Date(),
            reviewDate: restrictions.reviewDate
        };
    }
    
    async processObjectionRequest(request) {
        const objections = await this.processObjections(
            request.userId,
            request.requestDetails.activities || []
        );
        
        return {
            type: 'processing_objection',
            stoppedActivities: objections.stopped,
            continuedActivities: objections.continued,
            continuedReasons: objections.reasons,
            effectiveDate: new Date()
        };
    }
    
    // Cookie Consent Management
    generateCookieConsentBanner(locale = 'en') {
        return {
            html: `
                <div id="cookieConsent" class="cookie-consent-banner" data-locale="${locale}">
                    <div class="cookie-consent-content">
                        <div class="cookie-consent-text">
                            <h3>Cookie Settings</h3>
                            <p>We use cookies to improve your experience and analyze site usage. You can manage your preferences below.</p>
                        </div>
                        <div class="cookie-consent-actions">
                            <button id="cookieSettings" class="btn btn-secondary">
                                Manage Preferences
                            </button>
                            <button id="acceptAll" class="btn btn-primary">
                                Accept All
                            </button>
                            <button id="rejectAll" class="btn btn-secondary">
                                Reject All
                            </button>
                        </div>
                    </div>
                </div>`,
            categories: [
                {
                    id: 'necessary',
                    name: 'Strictly Necessary',
                    description: 'Essential for the website to function properly',
                    required: true,
                    enabled: true
                },
                {
                    id: 'functional',
                    name: 'Functional',
                    description: 'Remember your preferences and settings',
                    required: false,
                    enabled: false
                },
                {
                    id: 'analytics',
                    name: 'Analytics',
                    description: 'Help us understand how you use our website',
                    required: false,
                    enabled: false
                },
                {
                    id: 'marketing',
                    name: 'Marketing',
                    description: 'Used to deliver relevant advertisements',
                    required: false,
                    enabled: false
                }
            ]
        };
    }
    
    // Data Breach Management
    async reportDataBreach(breachData) {
        const breach = {
            id: this.generateBreachId(),
            reportDate: new Date(),
            discoveryDate: new Date(breachData.discoveryDate),
            category: breachData.category, // 'confidentiality', 'integrity', 'availability'
            severity: breachData.severity, // 'low', 'medium', 'high', 'critical'
            affectedDataSubjects: breachData.affectedDataSubjects || 0,
            dataCategories: breachData.dataCategories || [],
            cause: breachData.cause,
            description: breachData.description,
            containmentMeasures: breachData.containmentMeasures || [],
            mitigationActions: breachData.mitigationActions || [],
            riskAssessment: {
                likelihood: breachData.riskAssessment?.likelihood || 'unknown',
                impact: breachData.riskAssessment?.impact || 'unknown',
                overallRisk: breachData.riskAssessment?.overallRisk || 'unknown'
            },
            notificationRequired: {
                supervisoryAuthority: this.requiresSupervisoryNotification(breachData),
                dataSubjects: this.requiresDataSubjectNotification(breachData)
            },
            timeline: [{
                timestamp: new Date(),
                event: 'breach_reported',
                details: 'Data breach reported to GDPR system'
            }],
            status: 'investigating'
        };
        
        this.dataBreaches.set(breach.id, breach);
        
        // Check if 72-hour notification to supervisory authority is required
        if (breach.notificationRequired.supervisoryAuthority) {
            await this.scheduleRegulatoryNotification(breach);
        }
        
        // Check if notification to data subjects is required
        if (breach.notificationRequired.dataSubjects) {
            await this.scheduleDataSubjectNotification(breach);
        }
        
        this.emit('data_breach_reported', {
            breachId: breach.id,
            severity: breach.severity,
            affectedDataSubjects: breach.affectedDataSubjects
        });
        
        return breach;
    }
    
    requiresSupervisoryNotification(breachData) {
        // High risk threshold for supervisory authority notification
        return breachData.severity === 'high' || 
               breachData.severity === 'critical' ||
               breachData.affectedDataSubjects > 100;
    }
    
    requiresDataSubjectNotification(breachData) {
        // High risk threshold for data subject notification
        return breachData.severity === 'critical' ||
               breachData.affectedDataSubjects > 1000 ||
               breachData.dataCategories.includes('special_category_data');
    }
    
    // Privacy Impact Assessment (PIA)
    async conductPrivacyImpactAssessment(activityData) {
        const pia = {
            id: this.generatePIAId(),
            activityId: activityData.activityId,
            activityName: activityData.activityName,
            assessmentDate: new Date(),
            assessor: activityData.assessor,
            stakeholders: activityData.stakeholders || [],
            scope: activityData.scope,
            dataCategories: activityData.dataCategories || [],
            dataSubjects: activityData.dataSubjects || [],
            processingPurposes: activityData.processingPurposes || [],
            lawfulBasis: activityData.lawfulBasis,
            risks: this.assessPrivacyRisks(activityData),
            mitigations: activityData.mitigations || [],
            recommendations: [],
            overallRiskLevel: 'pending',
            status: 'draft',
            reviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Annual review
        };
        
        // Calculate overall risk level
        pia.overallRiskLevel = this.calculateOverallRisk(pia.risks);
        
        // Generate recommendations based on risks
        pia.recommendations = this.generatePrivacyRecommendations(pia);
        
        this.emit('pia_conducted', {
            piaId: pia.id,
            activityId: pia.activityId,
            riskLevel: pia.overallRiskLevel
        });
        
        return pia;
    }
    
    assessPrivacyRisks(activityData) {
        const risks = [];
        
        // Special category data risk
        if (activityData.dataCategories.includes('special_category_data')) {
            risks.push({
                id: 'special_category_risk',
                category: 'data_sensitivity',
                description: 'Processing of special category personal data',
                likelihood: 'high',
                impact: 'high',
                riskLevel: 'high'
            });
        }
        
        // Cross-border transfer risk
        if (activityData.crossBorderTransfers?.countries?.length > 0) {
            risks.push({
                id: 'transfer_risk',
                category: 'data_transfer',
                description: 'International data transfers',
                likelihood: 'medium',
                impact: 'medium',
                riskLevel: 'medium'
            });
        }
        
        // Large scale processing risk
        if (activityData.dataSubjectCount > 10000) {
            risks.push({
                id: 'scale_risk',
                category: 'processing_scale',
                description: 'Large scale processing of personal data',
                likelihood: 'high',
                impact: 'medium',
                riskLevel: 'medium'
            });
        }
        
        return risks;
    }
    
    // Utility Methods
    generateConsentId() {
        return `consent_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    }
    
    generateRequestId() {
        return `dsr_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    }
    
    generateBreachId() {
        return `breach_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    }
    
    generatePIAId() {
        return `pia_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    }
    
    generateVerificationCode() {
        return Math.random().toString(36).substr(2, 8).toUpperCase();
    }
    
    generateDownloadToken() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    calculateOverallRisk(risks) {
        if (risks.some(r => r.riskLevel === 'high')) return 'high';
        if (risks.some(r => r.riskLevel === 'medium')) return 'medium';
        return 'low';
    }
    
    // Mock data collection methods (would integrate with actual data sources)
    async collectUserData(userId) {
        return {
            identity: { /* user identity data */ },
            contact: { /* contact information */ },
            usage: { /* usage data */ },
            financial: { /* billing/payment data */ }
        };
    }
    
    async eraseUserData(userId, details) {
        return {
            categories: ['usage', 'marketing'],
            recordCount: 1247,
            retained: ['financial', 'legal'],
            retentionReasons: ['legal_obligation', 'contract_fulfillment']
        };
    }
    
    async extractPortableData(userId) {
        return {
            containers: [/* container data */],
            preferences: {/* user preferences */},
            history: [/* tracking history */]
        };
    }
}

// GDPR Compliance Middleware
class GDPRMiddleware {
    constructor(gdprManager) {
        this.gdprManager = gdprManager;
    }
    
    middleware() {
        return (req, res, next) => {
            // Add GDPR helpers to request
            req.gdpr = {
                recordConsent: (consentData) => {
                    return this.gdprManager.recordConsent(req.user?.id, {
                        ...consentData,
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent')
                    });
                },
                withdrawConsent: (withdrawalData) => {
                    return this.gdprManager.withdrawConsent(req.user?.id, {
                        ...withdrawalData,
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent')
                    });
                },
                submitDataRequest: (requestData) => {
                    return this.gdprManager.handleDataSubjectRequest({
                        ...requestData,
                        userId: req.user?.id,
                        ipAddress: req.ip,
                        userAgent: req.get('User-Agent')
                    });
                }
            };
            
            // Check for EU users and set compliance requirements
            const isEUUser = this.isEUUser(req);
            req.requiresGDPRCompliance = isEUUser;
            
            if (isEUUser) {
                // Add GDPR-specific headers
                res.set({
                    'X-GDPR-Compliant': 'true',
                    'X-Privacy-Policy': '/privacy-policy',
                    'X-Cookie-Policy': '/cookie-policy'
                });
            }
            
            next();
        };
    }
    
    isEUUser(req) {
        // Detect EU users based on IP geolocation or explicit settings
        const euCountries = [
            'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
            'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
            'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
        ];
        
        // This would typically use IP geolocation service
        const userCountry = req.headers['cf-ipcountry'] || req.user?.country;
        return euCountries.includes(userCountry);
    }
}

module.exports = {
    GDPRComplianceManager,
    GDPRMiddleware
};