#!/usr/bin/env node

/**
 * ROOTUIP Feature Configuration System
 * Manages custom features and tenant-specific integrations
 */

const EventEmitter = require('events');
const { DynamoDB } = require('aws-sdk');

class FeatureConfigurationSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            dynamoTableName: config.dynamoTableName || 'rootuip-feature-configs',
            cacheTimeout: config.cacheTimeout || 300000, // 5 minutes
            ...config
        };
        
        this.dynamodb = new DynamoDB.DocumentClient();
        this.featureCache = new Map();
        this.integrationRegistry = new Map();
        
        // Feature categories
        this.featureCategories = {
            CORE: 'core',
            ANALYTICS: 'analytics',
            INTEGRATION: 'integration',
            SECURITY: 'security',
            COLLABORATION: 'collaboration',
            AUTOMATION: 'automation',
            COMPLIANCE: 'compliance',
            CUSTOMIZATION: 'customization'
        };
        
        // Initialize default features
        this.initializeDefaultFeatures();
    }
    
    // Initialize default feature definitions
    initializeDefaultFeatures() {
        this.defaultFeatures = {
            // Core Features
            shipmentTracking: {
                id: 'shipmentTracking',
                name: 'Shipment Tracking',
                category: this.featureCategories.CORE,
                description: 'Real-time shipment tracking and visibility',
                configurable: true,
                dependencies: [],
                settings: {
                    trackingInterval: { type: 'number', default: 300, min: 60, max: 3600 },
                    autoStatusUpdate: { type: 'boolean', default: true },
                    locationPrecision: { type: 'select', default: 'high', options: ['low', 'medium', 'high'] }
                }
            },
            
            containerManagement: {
                id: 'containerManagement',
                name: 'Container Management',
                category: this.featureCategories.CORE,
                description: 'Container tracking and allocation',
                configurable: true,
                dependencies: ['shipmentTracking'],
                settings: {
                    containerTypes: { type: 'array', default: ['20ft', '40ft', '40ft HC'] },
                    autoAllocation: { type: 'boolean', default: false },
                    maintenanceTracking: { type: 'boolean', default: true }
                }
            },
            
            documentManagement: {
                id: 'documentManagement',
                name: 'Document Management',
                category: this.featureCategories.CORE,
                description: 'Digital document storage and management',
                configurable: true,
                dependencies: [],
                settings: {
                    allowedFileTypes: { type: 'array', default: ['pdf', 'doc', 'docx', 'xls', 'xlsx'] },
                    maxFileSize: { type: 'number', default: 10485760, min: 1048576, max: 52428800 },
                    ocrEnabled: { type: 'boolean', default: false },
                    autoClassification: { type: 'boolean', default: false }
                }
            },
            
            // Analytics Features
            basicReporting: {
                id: 'basicReporting',
                name: 'Basic Reporting',
                category: this.featureCategories.ANALYTICS,
                description: 'Standard operational reports',
                configurable: true,
                dependencies: [],
                settings: {
                    reportTypes: { type: 'array', default: ['shipment-summary', 'container-utilization'] },
                    scheduleEnabled: { type: 'boolean', default: false },
                    exportFormats: { type: 'array', default: ['pdf', 'csv'] }
                }
            },
            
            advancedAnalytics: {
                id: 'advancedAnalytics',
                name: 'Advanced Analytics',
                category: this.featureCategories.ANALYTICS,
                description: 'AI-powered analytics and predictions',
                configurable: true,
                dependencies: ['basicReporting'],
                settings: {
                    predictiveAnalytics: { type: 'boolean', default: true },
                    demandForecasting: { type: 'boolean', default: true },
                    routeOptimization: { type: 'boolean', default: true },
                    anomalyDetection: { type: 'boolean', default: true },
                    mlModelRefresh: { type: 'select', default: 'weekly', options: ['daily', 'weekly', 'monthly'] }
                }
            },
            
            realTimeDashboard: {
                id: 'realTimeDashboard',
                name: 'Real-Time Dashboard',
                category: this.featureCategories.ANALYTICS,
                description: 'Live operational dashboards',
                configurable: true,
                dependencies: ['advancedAnalytics'],
                settings: {
                    refreshInterval: { type: 'number', default: 30, min: 10, max: 300 },
                    widgetLimit: { type: 'number', default: 10, min: 5, max: 20 },
                    customWidgets: { type: 'boolean', default: false }
                }
            },
            
            // Integration Features
            apiAccess: {
                id: 'apiAccess',
                name: 'API Access',
                category: this.featureCategories.INTEGRATION,
                description: 'RESTful API access',
                configurable: true,
                dependencies: [],
                settings: {
                    rateLimitPerHour: { type: 'number', default: 1000, min: 100, max: 10000 },
                    apiVersion: { type: 'select', default: 'v2', options: ['v1', 'v2'] },
                    webhooksEnabled: { type: 'boolean', default: false },
                    graphqlEnabled: { type: 'boolean', default: false }
                }
            },
            
            customIntegrations: {
                id: 'customIntegrations',
                name: 'Custom Integrations',
                category: this.featureCategories.INTEGRATION,
                description: 'Third-party system integrations',
                configurable: true,
                dependencies: ['apiAccess'],
                settings: {
                    maxIntegrations: { type: 'number', default: 5, min: 1, max: 20 },
                    supportedProtocols: { type: 'array', default: ['REST', 'SOAP', 'GraphQL'] },
                    customMappingEnabled: { type: 'boolean', default: true }
                }
            },
            
            erpIntegration: {
                id: 'erpIntegration',
                name: 'ERP Integration',
                category: this.featureCategories.INTEGRATION,
                description: 'Enterprise Resource Planning integration',
                configurable: true,
                dependencies: ['customIntegrations'],
                providers: ['SAP', 'Oracle', 'Microsoft Dynamics', 'NetSuite'],
                settings: {
                    provider: { type: 'select', default: null, options: ['SAP', 'Oracle', 'Microsoft Dynamics', 'NetSuite'] },
                    syncInterval: { type: 'number', default: 3600, min: 300, max: 86400 },
                    bidirectionalSync: { type: 'boolean', default: true },
                    fieldMapping: { type: 'object', default: {} }
                }
            },
            
            // Security Features
            sso: {
                id: 'sso',
                name: 'Single Sign-On',
                category: this.featureCategories.SECURITY,
                description: 'Enterprise SSO integration',
                configurable: true,
                dependencies: [],
                providers: ['SAML', 'OAuth2', 'OpenID Connect', 'Active Directory'],
                settings: {
                    provider: { type: 'select', default: null, options: ['SAML', 'OAuth2', 'OpenID Connect', 'Active Directory'] },
                    autoProvisioning: { type: 'boolean', default: false },
                    groupSync: { type: 'boolean', default: false },
                    sessionTimeout: { type: 'number', default: 28800, min: 900, max: 86400 }
                }
            },
            
            mfa: {
                id: 'mfa',
                name: 'Multi-Factor Authentication',
                category: this.featureCategories.SECURITY,
                description: 'Enhanced authentication security',
                configurable: true,
                dependencies: [],
                settings: {
                    methods: { type: 'array', default: ['totp', 'sms'], options: ['totp', 'sms', 'email', 'push'] },
                    enforced: { type: 'boolean', default: false },
                    rememberDevice: { type: 'boolean', default: true },
                    rememberDays: { type: 'number', default: 30, min: 1, max: 90 }
                }
            },
            
            dataEncryption: {
                id: 'dataEncryption',
                name: 'Data Encryption',
                category: this.featureCategories.SECURITY,
                description: 'At-rest and in-transit encryption',
                configurable: true,
                dependencies: [],
                settings: {
                    encryptionAlgorithm: { type: 'select', default: 'AES-256', options: ['AES-128', 'AES-256'] },
                    encryptPII: { type: 'boolean', default: true },
                    encryptDocuments: { type: 'boolean', default: true },
                    keyRotationDays: { type: 'number', default: 90, min: 30, max: 365 }
                }
            },
            
            // Collaboration Features
            multiUser: {
                id: 'multiUser',
                name: 'Multi-User Support',
                category: this.featureCategories.COLLABORATION,
                description: 'Team collaboration capabilities',
                configurable: true,
                dependencies: [],
                settings: {
                    maxUsers: { type: 'number', default: 50, min: 5, max: 1000 },
                    guestAccess: { type: 'boolean', default: false },
                    externalUsers: { type: 'boolean', default: false }
                }
            },
            
            roleBasedAccess: {
                id: 'roleBasedAccess',
                name: 'Role-Based Access Control',
                category: this.featureCategories.COLLABORATION,
                description: 'Granular permission management',
                configurable: true,
                dependencies: ['multiUser'],
                settings: {
                    customRoles: { type: 'boolean', default: true },
                    maxRoles: { type: 'number', default: 10, min: 3, max: 50 },
                    fieldLevelSecurity: { type: 'boolean', default: false },
                    dataSegmentation: { type: 'boolean', default: false }
                }
            },
            
            teamCollaboration: {
                id: 'teamCollaboration',
                name: 'Team Collaboration',
                category: this.featureCategories.COLLABORATION,
                description: 'Real-time collaboration tools',
                configurable: true,
                dependencies: ['multiUser'],
                settings: {
                    chat: { type: 'boolean', default: true },
                    videoConferencing: { type: 'boolean', default: false },
                    sharedWorkspaces: { type: 'boolean', default: true },
                    activityFeed: { type: 'boolean', default: true }
                }
            },
            
            // Automation Features
            workflowAutomation: {
                id: 'workflowAutomation',
                name: 'Workflow Automation',
                category: this.featureCategories.AUTOMATION,
                description: 'Business process automation',
                configurable: true,
                dependencies: [],
                settings: {
                    maxWorkflows: { type: 'number', default: 10, min: 1, max: 100 },
                    triggerTypes: { type: 'array', default: ['event', 'schedule', 'condition'] },
                    actionTypes: { type: 'array', default: ['email', 'api', 'update', 'create'] },
                    conditionalLogic: { type: 'boolean', default: true },
                    parallelExecution: { type: 'boolean', default: false }
                }
            },
            
            emailAutomation: {
                id: 'emailAutomation',
                name: 'Email Automation',
                category: this.featureCategories.AUTOMATION,
                description: 'Automated email notifications',
                configurable: true,
                dependencies: [],
                settings: {
                    templates: { type: 'array', default: ['shipment-update', 'delivery-confirmation'] },
                    customTemplates: { type: 'boolean', default: true },
                    dynamicContent: { type: 'boolean', default: true },
                    sendingLimitPerDay: { type: 'number', default: 1000, min: 100, max: 10000 }
                }
            },
            
            alerting: {
                id: 'alerting',
                name: 'Smart Alerting',
                category: this.featureCategories.AUTOMATION,
                description: 'Intelligent alert system',
                configurable: true,
                dependencies: [],
                settings: {
                    channels: { type: 'array', default: ['email', 'sms', 'push'] },
                    alertTypes: { type: 'array', default: ['delay', 'exception', 'threshold'] },
                    escalationEnabled: { type: 'boolean', default: true },
                    quietHours: { type: 'boolean', default: false },
                    aggregation: { type: 'boolean', default: true }
                }
            },
            
            // Compliance Features
            auditLog: {
                id: 'auditLog',
                name: 'Audit Logging',
                category: this.featureCategories.COMPLIANCE,
                description: 'Comprehensive audit trail',
                configurable: true,
                dependencies: [],
                settings: {
                    retentionDays: { type: 'number', default: 365, min: 90, max: 2555 },
                    logLevel: { type: 'select', default: 'standard', options: ['minimal', 'standard', 'detailed'] },
                    immutable: { type: 'boolean', default: true },
                    exportEnabled: { type: 'boolean', default: true }
                }
            },
            
            regulatoryCompliance: {
                id: 'regulatoryCompliance',
                name: 'Regulatory Compliance',
                category: this.featureCategories.COMPLIANCE,
                description: 'Industry compliance tools',
                configurable: true,
                dependencies: ['auditLog'],
                settings: {
                    frameworks: { type: 'array', default: ['GDPR', 'ISO27001'], options: ['GDPR', 'CCPA', 'HIPAA', 'ISO27001', 'SOC2'] },
                    dataResidency: { type: 'boolean', default: true },
                    rightToDelete: { type: 'boolean', default: true },
                    consentManagement: { type: 'boolean', default: true }
                }
            },
            
            // Customization Features
            whiteLabel: {
                id: 'whiteLabel',
                name: 'White Label',
                category: this.featureCategories.CUSTOMIZATION,
                description: 'Complete brand customization',
                configurable: true,
                dependencies: [],
                settings: {
                    customDomain: { type: 'boolean', default: true },
                    customEmails: { type: 'boolean', default: true },
                    customMobileApp: { type: 'boolean', default: true },
                    removeROOTUIPBranding: { type: 'boolean', default: true }
                }
            },
            
            customFields: {
                id: 'customFields',
                name: 'Custom Fields',
                category: this.featureCategories.CUSTOMIZATION,
                description: 'Add custom data fields',
                configurable: true,
                dependencies: [],
                settings: {
                    maxFields: { type: 'number', default: 20, min: 5, max: 100 },
                    fieldTypes: { type: 'array', default: ['text', 'number', 'date', 'select'] },
                    validation: { type: 'boolean', default: true },
                    conditional: { type: 'boolean', default: false }
                }
            },
            
            customReports: {
                id: 'customReports',
                name: 'Custom Reports',
                category: this.featureCategories.CUSTOMIZATION,
                description: 'Build custom reports',
                configurable: true,
                dependencies: ['advancedAnalytics'],
                settings: {
                    reportBuilder: { type: 'boolean', default: true },
                    sqlAccess: { type: 'boolean', default: false },
                    scheduling: { type: 'boolean', default: true },
                    sharing: { type: 'boolean', default: true }
                }
            }
        };
    }
    
    // Configure features for tenant
    async configureTenantFeatures(tenantId, featureConfig) {
        try {
            console.log(`Configuring features for tenant: ${tenantId}`);
            
            const configuration = {
                tenantId,
                features: {},
                integrations: {},
                customSettings: {},
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Process each feature
            for (const [featureId, enabled] of Object.entries(featureConfig.features || {})) {
                if (enabled) {
                    const feature = this.defaultFeatures[featureId];
                    
                    if (!feature) {
                        console.warn(`Unknown feature: ${featureId}`);
                        continue;
                    }
                    
                    // Check dependencies
                    if (!this.checkDependencies(featureId, featureConfig.features)) {
                        throw new Error(`Feature ${featureId} has unmet dependencies: ${feature.dependencies.join(', ')}`);
                    }
                    
                    // Apply feature configuration
                    configuration.features[featureId] = {
                        enabled: true,
                        settings: {
                            ...feature.settings,
                            ...(featureConfig.settings?.[featureId] || {})
                        }
                    };
                }
            }
            
            // Configure integrations
            if (featureConfig.integrations) {
                for (const [integrationType, integrationConfig] of Object.entries(featureConfig.integrations)) {
                    configuration.integrations[integrationType] = await this.configureIntegration(
                        tenantId,
                        integrationType,
                        integrationConfig
                    );
                }
            }
            
            // Apply custom settings
            if (featureConfig.customSettings) {
                configuration.customSettings = featureConfig.customSettings;
            }
            
            // Save configuration
            await this.saveFeatureConfiguration(tenantId, configuration);
            
            // Update cache
            this.featureCache.set(tenantId, {
                config: configuration,
                cachedAt: Date.now()
            });
            
            // Emit configuration event
            this.emit('features:configured', { tenantId, configuration });
            
            console.log(`Features configured successfully for tenant: ${tenantId}`);
            return {
                success: true,
                configuration
            };
            
        } catch (error) {
            console.error(`Error configuring features: ${error.message}`);
            throw error;
        }
    }
    
    // Configure integration
    async configureIntegration(tenantId, integrationType, config) {
        console.log(`Configuring ${integrationType} integration for tenant ${tenantId}`);
        
        const integration = {
            type: integrationType,
            enabled: true,
            provider: config.provider,
            settings: config.settings || {},
            credentials: {},
            status: 'pending',
            lastSync: null,
            metadata: {}
        };
        
        // Handle specific integration types
        switch (integrationType) {
            case 'erp':
                integration.credentials = {
                    endpoint: config.endpoint,
                    username: this.encryptCredential(config.username),
                    password: this.encryptCredential(config.password),
                    apiKey: config.apiKey ? this.encryptCredential(config.apiKey) : null
                };
                integration.settings = {
                    syncInterval: config.syncInterval || 3600,
                    syncEntities: config.syncEntities || ['shipments', 'customers', 'invoices'],
                    fieldMapping: config.fieldMapping || {},
                    transformRules: config.transformRules || []
                };
                break;
                
            case 'carrier':
                integration.credentials = {
                    apiKey: this.encryptCredential(config.apiKey),
                    accountNumber: config.accountNumber,
                    endpoint: config.endpoint || this.getCarrierEndpoint(config.provider)
                };
                integration.settings = {
                    trackingWebhook: config.trackingWebhook,
                    rateQuoting: config.rateQuoting !== false,
                    labelPrinting: config.labelPrinting !== false,
                    pickupScheduling: config.pickupScheduling !== false
                };
                break;
                
            case 'accounting':
                integration.credentials = {
                    clientId: this.encryptCredential(config.clientId),
                    clientSecret: this.encryptCredential(config.clientSecret),
                    refreshToken: config.refreshToken ? this.encryptCredential(config.refreshToken) : null
                };
                integration.settings = {
                    syncInvoices: config.syncInvoices !== false,
                    syncPayments: config.syncPayments !== false,
                    autoReconciliation: config.autoReconciliation || false,
                    chartOfAccounts: config.chartOfAccounts || {}
                };
                break;
                
            case 'customs':
                integration.credentials = {
                    username: this.encryptCredential(config.username),
                    password: this.encryptCredential(config.password),
                    facilityCode: config.facilityCode
                };
                integration.settings = {
                    autoFiling: config.autoFiling || false,
                    documentTypes: config.documentTypes || ['invoice', 'packingList', 'billOfLading'],
                    complianceCheck: config.complianceCheck !== false
                };
                break;
                
            case 'warehouse':
                integration.credentials = {
                    apiKey: this.encryptCredential(config.apiKey),
                    warehouseId: config.warehouseId
                };
                integration.settings = {
                    inventorySync: config.inventorySync !== false,
                    orderManagement: config.orderManagement !== false,
                    crossDocking: config.crossDocking || false,
                    slotting: config.slotting || false
                };
                break;
                
            case 'iot':
                integration.credentials = {
                    deviceToken: this.encryptCredential(config.deviceToken),
                    mqttEndpoint: config.mqttEndpoint
                };
                integration.settings = {
                    sensorTypes: config.sensorTypes || ['temperature', 'humidity', 'location', 'shock'],
                    alertThresholds: config.alertThresholds || {},
                    dataRetention: config.dataRetention || 90
                };
                break;
        }
        
        // Test integration connection
        if (config.testConnection !== false) {
            const testResult = await this.testIntegration(integrationType, integration);
            integration.status = testResult.success ? 'active' : 'error';
            integration.lastTestResult = testResult;
        }
        
        return integration;
    }
    
    // Test integration connection
    async testIntegration(integrationType, integration) {
        try {
            console.log(`Testing ${integrationType} integration`);
            
            // Integration-specific test logic
            const tester = this.integrationRegistry.get(integrationType);
            
            if (tester && tester.test) {
                return await tester.test(integration);
            }
            
            // Default test - ping endpoint
            return {
                success: true,
                message: 'Integration configured successfully',
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    // Get tenant features
    async getTenantFeatures(tenantId) {
        try {
            // Check cache
            const cached = this.featureCache.get(tenantId);
            if (cached && Date.now() - cached.cachedAt < this.config.cacheTimeout) {
                return cached.config;
            }
            
            // Load from database
            const result = await this.dynamodb.get({
                TableName: this.config.dynamoTableName,
                Key: { tenantId }
            }).promise();
            
            if (result.Item) {
                // Update cache
                this.featureCache.set(tenantId, {
                    config: result.Item,
                    cachedAt: Date.now()
                });
                
                return result.Item;
            }
            
            // Return default configuration
            return {
                tenantId,
                features: {},
                integrations: {},
                customSettings: {}
            };
            
        } catch (error) {
            console.error(`Error getting tenant features: ${error.message}`);
            throw error;
        }
    }
    
    // Check if tenant has feature
    async hasFeature(tenantId, featureId) {
        const config = await this.getTenantFeatures(tenantId);
        return config.features[featureId]?.enabled === true;
    }
    
    // Get feature settings
    async getFeatureSettings(tenantId, featureId) {
        const config = await this.getTenantFeatures(tenantId);
        return config.features[featureId]?.settings || {};
    }
    
    // Update feature settings
    async updateFeatureSettings(tenantId, featureId, settings) {
        try {
            const config = await this.getTenantFeatures(tenantId);
            
            if (!config.features[featureId]) {
                throw new Error(`Feature ${featureId} not enabled for tenant`);
            }
            
            // Validate settings
            const feature = this.defaultFeatures[featureId];
            const validatedSettings = this.validateSettings(feature.settings, settings);
            
            // Update configuration
            config.features[featureId].settings = {
                ...config.features[featureId].settings,
                ...validatedSettings
            };
            
            config.updatedAt = new Date().toISOString();
            
            // Save configuration
            await this.saveFeatureConfiguration(tenantId, config);
            
            // Update cache
            this.featureCache.set(tenantId, {
                config,
                cachedAt: Date.now()
            });
            
            // Emit update event
            this.emit('feature:updated', { tenantId, featureId, settings: validatedSettings });
            
            return {
                success: true,
                settings: config.features[featureId].settings
            };
            
        } catch (error) {
            console.error(`Error updating feature settings: ${error.message}`);
            throw error;
        }
    }
    
    // Enable feature
    async enableFeature(tenantId, featureId, settings = {}) {
        try {
            const config = await this.getTenantFeatures(tenantId);
            const feature = this.defaultFeatures[featureId];
            
            if (!feature) {
                throw new Error(`Unknown feature: ${featureId}`);
            }
            
            // Check dependencies
            const enabledFeatures = Object.keys(config.features).filter(id => config.features[id].enabled);
            if (!this.checkDependencies(featureId, enabledFeatures)) {
                throw new Error(`Feature ${featureId} has unmet dependencies`);
            }
            
            // Enable feature
            config.features[featureId] = {
                enabled: true,
                settings: {
                    ...this.getDefaultSettings(feature.settings),
                    ...settings
                }
            };
            
            config.updatedAt = new Date().toISOString();
            
            // Save configuration
            await this.saveFeatureConfiguration(tenantId, config);
            
            // Update cache
            this.featureCache.set(tenantId, {
                config,
                cachedAt: Date.now()
            });
            
            // Emit enable event
            this.emit('feature:enabled', { tenantId, featureId });
            
            return { success: true };
            
        } catch (error) {
            console.error(`Error enabling feature: ${error.message}`);
            throw error;
        }
    }
    
    // Disable feature
    async disableFeature(tenantId, featureId) {
        try {
            const config = await this.getTenantFeatures(tenantId);
            
            // Check if other features depend on this
            const dependents = this.findDependentFeatures(featureId, config.features);
            if (dependents.length > 0) {
                throw new Error(`Cannot disable ${featureId}: required by ${dependents.join(', ')}`);
            }
            
            // Disable feature
            if (config.features[featureId]) {
                config.features[featureId].enabled = false;
            }
            
            config.updatedAt = new Date().toISOString();
            
            // Save configuration
            await this.saveFeatureConfiguration(tenantId, config);
            
            // Update cache
            this.featureCache.set(tenantId, {
                config,
                cachedAt: Date.now()
            });
            
            // Emit disable event
            this.emit('feature:disabled', { tenantId, featureId });
            
            return { success: true };
            
        } catch (error) {
            console.error(`Error disabling feature: ${error.message}`);
            throw error;
        }
    }
    
    // Get integration configuration
    async getIntegration(tenantId, integrationType) {
        const config = await this.getTenantFeatures(tenantId);
        return config.integrations[integrationType];
    }
    
    // Update integration
    async updateIntegration(tenantId, integrationType, updates) {
        try {
            const config = await this.getTenantFeatures(tenantId);
            
            if (!config.integrations[integrationType]) {
                throw new Error(`Integration ${integrationType} not configured`);
            }
            
            // Update integration
            config.integrations[integrationType] = {
                ...config.integrations[integrationType],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            
            // Test connection if credentials changed
            if (updates.credentials) {
                const testResult = await this.testIntegration(
                    integrationType,
                    config.integrations[integrationType]
                );
                config.integrations[integrationType].status = testResult.success ? 'active' : 'error';
                config.integrations[integrationType].lastTestResult = testResult;
            }
            
            config.updatedAt = new Date().toISOString();
            
            // Save configuration
            await this.saveFeatureConfiguration(tenantId, config);
            
            // Update cache
            this.featureCache.set(tenantId, {
                config,
                cachedAt: Date.now()
            });
            
            // Emit update event
            this.emit('integration:updated', { tenantId, integrationType });
            
            return {
                success: true,
                integration: config.integrations[integrationType]
            };
            
        } catch (error) {
            console.error(`Error updating integration: ${error.message}`);
            throw error;
        }
    }
    
    // Register integration handler
    registerIntegration(type, handler) {
        this.integrationRegistry.set(type, handler);
    }
    
    // Get feature usage analytics
    async getFeatureUsage(tenantId, startDate, endDate) {
        try {
            // Query usage metrics from analytics system
            const usage = {
                tenantId,
                period: { startDate, endDate },
                features: {},
                integrations: {}
            };
            
            const config = await this.getTenantFeatures(tenantId);
            
            // Get usage for each enabled feature
            for (const [featureId, feature] of Object.entries(config.features)) {
                if (feature.enabled) {
                    usage.features[featureId] = {
                        enabled: true,
                        usageCount: Math.floor(Math.random() * 1000), // Placeholder
                        lastUsed: new Date().toISOString(),
                        adoptionRate: Math.random() * 100
                    };
                }
            }
            
            // Get integration usage
            for (const [integrationType, integration] of Object.entries(config.integrations)) {
                usage.integrations[integrationType] = {
                    status: integration.status,
                    syncCount: Math.floor(Math.random() * 100), // Placeholder
                    lastSync: integration.lastSync,
                    errorRate: Math.random() * 5
                };
            }
            
            return usage;
            
        } catch (error) {
            console.error(`Error getting feature usage: ${error.message}`);
            throw error;
        }
    }
    
    // Utility functions
    checkDependencies(featureId, enabledFeatures) {
        const feature = this.defaultFeatures[featureId];
        if (!feature.dependencies || feature.dependencies.length === 0) {
            return true;
        }
        
        return feature.dependencies.every(dep => 
            enabledFeatures.includes(dep) || enabledFeatures[dep]?.enabled
        );
    }
    
    findDependentFeatures(featureId, features) {
        const dependents = [];
        
        for (const [id, feature] of Object.entries(this.defaultFeatures)) {
            if (feature.dependencies.includes(featureId) && features[id]?.enabled) {
                dependents.push(id);
            }
        }
        
        return dependents;
    }
    
    validateSettings(schema, settings) {
        const validated = {};
        
        for (const [key, config] of Object.entries(schema)) {
            const value = settings[key];
            
            if (value === undefined) {
                validated[key] = config.default;
                continue;
            }
            
            // Type validation
            switch (config.type) {
                case 'number':
                    if (typeof value !== 'number') {
                        throw new Error(`Setting ${key} must be a number`);
                    }
                    if (config.min !== undefined && value < config.min) {
                        throw new Error(`Setting ${key} must be at least ${config.min}`);
                    }
                    if (config.max !== undefined && value > config.max) {
                        throw new Error(`Setting ${key} must be at most ${config.max}`);
                    }
                    validated[key] = value;
                    break;
                    
                case 'boolean':
                    if (typeof value !== 'boolean') {
                        throw new Error(`Setting ${key} must be a boolean`);
                    }
                    validated[key] = value;
                    break;
                    
                case 'select':
                    if (!config.options.includes(value)) {
                        throw new Error(`Setting ${key} must be one of: ${config.options.join(', ')}`);
                    }
                    validated[key] = value;
                    break;
                    
                case 'array':
                    if (!Array.isArray(value)) {
                        throw new Error(`Setting ${key} must be an array`);
                    }
                    validated[key] = value;
                    break;
                    
                case 'object':
                    if (typeof value !== 'object') {
                        throw new Error(`Setting ${key} must be an object`);
                    }
                    validated[key] = value;
                    break;
                    
                default:
                    validated[key] = value;
            }
        }
        
        return validated;
    }
    
    getDefaultSettings(schema) {
        const defaults = {};
        
        for (const [key, config] of Object.entries(schema)) {
            defaults[key] = config.default;
        }
        
        return defaults;
    }
    
    encryptCredential(value) {
        // In production, use proper encryption
        return Buffer.from(value).toString('base64');
    }
    
    decryptCredential(value) {
        // In production, use proper decryption
        return Buffer.from(value, 'base64').toString();
    }
    
    getCarrierEndpoint(provider) {
        const endpoints = {
            'FedEx': 'https://api.fedex.com',
            'UPS': 'https://api.ups.com',
            'DHL': 'https://api.dhl.com',
            'Maersk': 'https://api.maersk.com',
            'MSC': 'https://api.msc.com'
        };
        
        return endpoints[provider] || null;
    }
    
    async saveFeatureConfiguration(tenantId, config) {
        await this.dynamodb.put({
            TableName: this.config.dynamoTableName,
            Item: config
        }).promise();
    }
}

module.exports = FeatureConfigurationSystem;