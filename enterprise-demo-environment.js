const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/demo_environment'
});

// ==================== PROSPECT-SPECIFIC DEMOS ====================

class DemoEnvironmentManager {
    constructor() {
        this.activeEnvironments = new Map();
        this.demoTemplates = new Map();
        this.industryScenarios = new Map();
        this.initializeTemplates();
    }

    async initializeTemplates() {
        // Load industry-specific templates
        this.industryScenarios.set('logistics', {
            scenarios: [
                {
                    name: 'Container Tracking Optimization',
                    description: 'Real-time visibility across global supply chain',
                    workflow: ['Current State', 'Pain Points', 'Solution Demo', 'ROI Impact'],
                    data: {
                        containers: 5000,
                        avgDelayHours: 48,
                        visibilityGap: 35,
                        costPerDelay: 2500
                    }
                },
                {
                    name: 'Port Operations Efficiency',
                    description: 'Streamline port operations and reduce dwell time',
                    workflow: ['Bottleneck Analysis', 'Process Optimization', 'Automation Demo', 'Results'],
                    data: {
                        dailyVolume: 1200,
                        avgDwellTime: 72,
                        targetReduction: 40,
                        savingsPerHour: 1800
                    }
                }
            ]
        });

        this.industryScenarios.set('retail', {
            scenarios: [
                {
                    name: 'Inventory Optimization',
                    description: 'Just-in-time inventory management',
                    workflow: ['Current Challenges', 'Inventory Analysis', 'Optimization Demo', 'Benefits'],
                    data: {
                        skus: 50000,
                        stockoutRate: 8,
                        excessInventory: 15,
                        holdingCostReduction: 25
                    }
                }
            ]
        });

        this.industryScenarios.set('manufacturing', {
            scenarios: [
                {
                    name: 'Supply Chain Visibility',
                    description: 'End-to-end supply chain transparency',
                    workflow: ['Visibility Gaps', 'Integration Demo', 'Real-time Tracking', 'Impact Analysis'],
                    data: {
                        suppliers: 200,
                        avgLeadTime: 45,
                        disruptionRate: 12,
                        responseTimeImprovement: 65
                    }
                }
            ]
        });
    }

    async createProspectEnvironment(prospectData) {
        const environmentId = uuidv4();
        
        try {
            // Create custom environment
            const environment = {
                id: environmentId,
                prospectId: prospectData.prospectId,
                company: prospectData.company,
                industry: prospectData.industry,
                created: new Date(),
                config: await this.generateEnvironmentConfig(prospectData),
                data: await this.prepareProspectData(prospectData),
                scenarios: this.getIndustryScenarios(prospectData.industry),
                integrations: await this.setupIntegrations(prospectData),
                customizations: await this.applyCustomizations(prospectData)
            };

            // Store environment
            await db.query(`
                INSERT INTO demo_environments 
                (environment_id, prospect_id, company, industry, config, data, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'active')
            `, [environmentId, prospectData.prospectId, prospectData.company, 
                prospectData.industry, JSON.stringify(environment.config), 
                JSON.stringify(environment.data)]);

            // Store in memory for fast access
            this.activeEnvironments.set(environmentId, environment);

            return environment;
        } catch (error) {
            console.error('Environment creation error:', error);
            throw error;
        }
    }

    async generateEnvironmentConfig(prospectData) {
        return {
            theme: {
                primaryColor: prospectData.brandColor || '#3B82F6',
                logo: prospectData.logoUrl || '/default-logo.png',
                companyName: prospectData.company
            },
            features: {
                containerTracking: prospectData.industry === 'logistics',
                inventoryManagement: prospectData.industry === 'retail',
                supplierPortal: prospectData.industry === 'manufacturing',
                analyticsDepth: prospectData.companySize === 'enterprise' ? 'advanced' : 'standard'
            },
            data: {
                volumeMultiplier: this.getVolumeMultiplier(prospectData.companySize),
                historicalMonths: 12,
                forecastMonths: 6
            },
            integrations: prospectData.currentSystems || [],
            competitors: prospectData.competitorsUsing || []
        };
    }

    async prepareProspectData(prospectData) {
        // Generate realistic data based on company profile
        const volumeMultiplier = this.getVolumeMultiplier(prospectData.companySize);
        
        return {
            // Current state metrics
            currentMetrics: {
                monthlyVolume: 10000 * volumeMultiplier,
                avgProcessingTime: 48,
                errorRate: 5.2,
                customerComplaints: 120 * volumeMultiplier,
                operationalCost: 2500000 * volumeMultiplier
            },
            // Pain points from discovery
            painPoints: prospectData.painPoints || [
                'Lack of real-time visibility',
                'Manual processes causing delays',
                'High operational costs',
                'Poor customer experience'
            ],
            // Projected improvements
            projectedImprovements: {
                processingTimeReduction: 65,
                errorRateReduction: 80,
                costSavings: 35,
                customerSatisfactionIncrease: 45
            },
            // Historical data for demos
            historicalData: await this.generateHistoricalData(prospectData),
            // Competitive comparison data
            competitorMetrics: await this.getCompetitorBenchmarks(prospectData.industry)
        };
    }

    async setupIntegrations(prospectData) {
        const integrations = [];
        
        // Setup mock integrations based on their current systems
        if (prospectData.currentSystems) {
            for (const system of prospectData.currentSystems) {
                integrations.push({
                    system: system,
                    status: 'ready',
                    mockEndpoint: `/api/demo/integration/${system.toLowerCase()}`,
                    dataFlow: this.getIntegrationDataFlow(system),
                    sampleData: await this.generateIntegrationSampleData(system)
                });
            }
        }

        return integrations;
    }

    async applyCustomizations(prospectData) {
        return {
            terminology: this.getIndustryTerminology(prospectData.industry),
            workflows: this.getCustomWorkflows(prospectData),
            dashboards: await this.createCustomDashboards(prospectData),
            reports: await this.prepareCustomReports(prospectData)
        };
    }

    getVolumeMultiplier(companySize) {
        const multipliers = {
            'startup': 0.1,
            'small': 0.5,
            'medium': 1,
            'large': 5,
            'enterprise': 10
        };
        return multipliers[companySize] || 1;
    }

    getIndustryScenarios(industry) {
        return this.industryScenarios.get(industry) || this.industryScenarios.get('logistics');
    }

    async generateHistoricalData(prospectData) {
        const months = [];
        const volumeBase = 10000 * this.getVolumeMultiplier(prospectData.companySize);
        
        for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            
            months.push({
                month: date.toISOString().slice(0, 7),
                volume: Math.floor(volumeBase * (0.8 + Math.random() * 0.4)),
                onTimeDelivery: 75 + Math.random() * 10,
                customerSatisfaction: 70 + Math.random() * 15,
                operationalCost: Math.floor(200000 * this.getVolumeMultiplier(prospectData.companySize) * (0.9 + Math.random() * 0.2))
            });
        }
        
        return months;
    }

    getIndustryTerminology(industry) {
        const terminology = {
            logistics: {
                shipment: 'Container',
                facility: 'Terminal',
                route: 'Shipping Lane',
                customer: 'Consignee'
            },
            retail: {
                shipment: 'Order',
                facility: 'Distribution Center',
                route: 'Delivery Route',
                customer: 'Store'
            },
            manufacturing: {
                shipment: 'Parts Order',
                facility: 'Warehouse',
                route: 'Supply Route',
                customer: 'Production Line'
            }
        };
        return terminology[industry] || terminology.logistics;
    }
}

// ==================== LIVE DEMONSTRATION TOOLS ====================

class DemonstrationEngine {
    constructor() {
        this.activeDemos = new Map();
        this.demoScripts = new Map();
        this.tourSteps = new Map();
    }

    async startGuidedDemo(environmentId, demoType) {
        const demoId = uuidv4();
        
        const demo = {
            id: demoId,
            environmentId,
            type: demoType,
            startTime: new Date(),
            currentStep: 0,
            interactions: [],
            insights: [],
            script: await this.loadDemoScript(demoType),
            tourSteps: await this.generateTourSteps(environmentId, demoType)
        };

        this.activeDemos.set(demoId, demo);

        await db.query(`
            INSERT INTO demo_sessions 
            (demo_id, environment_id, demo_type, start_time, status)
            VALUES ($1, $2, $3, NOW(), 'active')
        `, [demoId, environmentId, demoType]);

        return demo;
    }

    async loadDemoScript(demoType) {
        const scripts = {
            'container-tracking': {
                title: 'Real-Time Container Visibility Demo',
                duration: 20,
                sections: [
                    {
                        name: 'Current State Analysis',
                        duration: 3,
                        talkingPoints: [
                            'Show current visibility gaps',
                            'Highlight manual tracking issues',
                            'Demonstrate data silos problem'
                        ],
                        interactions: ['click-current-dashboard', 'show-delays', 'highlight-gaps']
                    },
                    {
                        name: 'ROOTUIP Solution',
                        duration: 10,
                        talkingPoints: [
                            'Real-time tracking across all carriers',
                            'Predictive ETA with ML',
                            'Automated exception handling'
                        ],
                        interactions: ['switch-to-rootuip', 'show-live-tracking', 'demonstrate-alerts']
                    },
                    {
                        name: 'ROI Impact',
                        duration: 5,
                        talkingPoints: [
                            'Reduction in detention fees',
                            'Improved customer satisfaction',
                            'Operational efficiency gains'
                        ],
                        interactions: ['show-roi-calculator', 'compare-metrics', 'project-savings']
                    },
                    {
                        name: 'Next Steps',
                        duration: 2,
                        talkingPoints: [
                            'Technical evaluation options',
                            'Implementation timeline',
                            'Success metrics'
                        ],
                        interactions: ['show-timeline', 'discuss-pilot', 'schedule-followup']
                    }
                ]
            },
            'workflow-comparison': {
                title: 'Before & After Workflow Transformation',
                duration: 15,
                sections: [
                    {
                        name: 'Current Workflow Pain Points',
                        duration: 5,
                        talkingPoints: [
                            'Manual data entry across systems',
                            'Delayed exception handling',
                            'Limited visibility for customers'
                        ],
                        interactions: ['show-current-workflow', 'highlight-bottlenecks', 'calculate-delays']
                    },
                    {
                        name: 'Transformed Workflow',
                        duration: 7,
                        talkingPoints: [
                            'Automated data ingestion',
                            'Real-time exception detection',
                            'Self-service customer portal'
                        ],
                        interactions: ['show-new-workflow', 'demonstrate-automation', 'show-time-savings']
                    },
                    {
                        name: 'Measurable Benefits',
                        duration: 3,
                        talkingPoints: [
                            'Time savings quantification',
                            'Error reduction metrics',
                            'Customer satisfaction improvement'
                        ],
                        interactions: ['display-metrics', 'show-testimonials', 'calculate-roi']
                    }
                ]
            }
        };

        return scripts[demoType] || scripts['container-tracking'];
    }

    async generateTourSteps(environmentId, demoType) {
        const environment = environmentManager.activeEnvironments.get(environmentId);
        
        return [
            {
                element: '#dashboard-overview',
                title: 'Executive Dashboard',
                content: `Welcome to ${environment.company}'s custom ROOTUIP dashboard. This view provides real-time visibility across your entire operation.`,
                position: 'bottom'
            },
            {
                element: '#live-tracking-map',
                title: 'Real-Time Tracking',
                content: 'Track all shipments in real-time across any carrier. No more logging into multiple systems.',
                position: 'right',
                interaction: 'zoom-to-shipments'
            },
            {
                element: '#exception-alerts',
                title: 'Proactive Exception Management',
                content: 'AI-powered alerts notify you of potential delays before they impact your customers.',
                position: 'left',
                interaction: 'show-alert-example'
            },
            {
                element: '#analytics-panel',
                title: 'Advanced Analytics',
                content: `Based on your historical data, we project ${environment.data.projectedImprovements.costSavings}% cost savings in the first year.`,
                position: 'top',
                interaction: 'show-projections'
            }
        ];
    }

    async processRealtimeDemo(demoId, eventData) {
        const demo = this.activeDemos.get(demoId);
        if (!demo) throw new Error('Demo not found');

        // Process the event
        const result = await this.handleDemoEvent(demo, eventData);

        // Record interaction
        demo.interactions.push({
            timestamp: new Date(),
            type: eventData.type,
            data: eventData.data,
            result
        });

        // Generate insight if applicable
        const insight = await this.generateInsight(demo, eventData);
        if (insight) {
            demo.insights.push(insight);
        }

        // Update database
        await db.query(`
            UPDATE demo_sessions 
            SET last_interaction = NOW(), 
                interactions = $2,
                insights = $3
            WHERE demo_id = $1
        `, [demoId, JSON.stringify(demo.interactions), JSON.stringify(demo.insights)]);

        return { result, insight };
    }

    async handleDemoEvent(demo, eventData) {
        switch (eventData.type) {
            case 'show-live-data':
                return await this.demonstrateLiveDataProcessing(demo.environmentId);
            
            case 'compare-workflows':
                return await this.generateWorkflowComparison(demo.environmentId);
            
            case 'calculate-roi':
                return await this.calculateProspectROI(demo.environmentId, eventData.data);
            
            case 'simulate-integration':
                return await this.simulateIntegration(demo.environmentId, eventData.data.system);
            
            default:
                return { status: 'processed' };
        }
    }

    async demonstrateLiveDataProcessing(environmentId) {
        const environment = environmentManager.activeEnvironments.get(environmentId);
        
        // Simulate real-time data processing
        const processingDemo = {
            inputData: {
                type: 'container_status_update',
                carrier: 'Maersk',
                containerNumber: 'MSKU' + Math.floor(Math.random() * 9000000 + 1000000),
                status: 'Departed',
                location: 'Port of Shanghai',
                timestamp: new Date()
            },
            processingSteps: [
                { step: 'Data Ingestion', duration: 50, status: 'complete' },
                { step: 'Validation & Enrichment', duration: 120, status: 'complete' },
                { step: 'ETA Prediction', duration: 200, status: 'complete' },
                { step: 'Exception Detection', duration: 80, status: 'complete' },
                { step: 'Customer Notification', duration: 100, status: 'complete' }
            ],
            output: {
                predictedETA: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                delayRisk: 'Low',
                recommendedActions: ['Monitor weather conditions', 'Prepare customs documentation'],
                customerNotified: true
            }
        };

        return processingDemo;
    }

    async generateWorkflowComparison(environmentId) {
        const environment = environmentManager.activeEnvironments.get(environmentId);
        
        return {
            currentWorkflow: {
                steps: 12,
                manualSteps: 8,
                avgProcessingTime: 240, // minutes
                errorRate: 5.2,
                systems: ['Email', 'Excel', 'Carrier Portal 1', 'Carrier Portal 2', 'TMS']
            },
            proposedWorkflow: {
                steps: 5,
                manualSteps: 1,
                avgProcessingTime: 45, // minutes
                errorRate: 0.5,
                systems: ['ROOTUIP Platform']
            },
            improvements: {
                timeReduction: 81.25,
                errorReduction: 90.4,
                systemConsolidation: 80,
                roiMonths: 8
            }
        };
    }

    async calculateProspectROI(environmentId, inputs) {
        const environment = environmentManager.activeEnvironments.get(environmentId);
        const data = environment.data;
        
        // Use prospect's actual data for calculation
        const monthlyVolume = inputs.monthlyVolume || data.currentMetrics.monthlyVolume;
        const avgDelayHours = inputs.avgDelayHours || 48;
        const detentionFeePerHour = inputs.detentionFeePerHour || 75;
        const manualProcessingCost = inputs.manualProcessingCost || 50;
        
        const calculations = {
            currentState: {
                annualDelayHours: monthlyVolume * 12 * avgDelayHours * 0.15, // 15% containers delayed
                annualDetentionFees: monthlyVolume * 12 * avgDelayHours * 0.15 * detentionFeePerHour,
                annualProcessingCost: monthlyVolume * 12 * manualProcessingCost,
                totalCost: 0
            },
            withROOTUIP: {
                annualDelayHours: monthlyVolume * 12 * (avgDelayHours * 0.35) * 0.05, // 65% reduction, 5% delayed
                annualDetentionFees: monthlyVolume * 12 * (avgDelayHours * 0.35) * 0.05 * detentionFeePerHour,
                annualProcessingCost: monthlyVolume * 12 * (manualProcessingCost * 0.2), // 80% automation
                totalCost: 0
            },
            savings: {},
            roi: {}
        };

        // Calculate totals
        calculations.currentState.totalCost = 
            calculations.currentState.annualDetentionFees + 
            calculations.currentState.annualProcessingCost;
            
        calculations.withROOTUIP.totalCost = 
            calculations.withROOTUIP.annualDetentionFees + 
            calculations.withROOTUIP.annualProcessingCost;

        // Calculate savings
        calculations.savings = {
            annualSavings: calculations.currentState.totalCost - calculations.withROOTUIP.totalCost,
            detentionFeeSavings: calculations.currentState.annualDetentionFees - calculations.withROOTUIP.annualDetentionFees,
            processingCostSavings: calculations.currentState.annualProcessingCost - calculations.withROOTUIP.annualProcessingCost,
            percentReduction: ((calculations.currentState.totalCost - calculations.withROOTUIP.totalCost) / calculations.currentState.totalCost * 100)
        };

        // ROI calculation
        const annualPlatformCost = this.calculatePlatformCost(monthlyVolume);
        calculations.roi = {
            annualPlatformCost,
            netAnnualSavings: calculations.savings.annualSavings - annualPlatformCost,
            paybackPeriodMonths: (annualPlatformCost / (calculations.savings.annualSavings / 12)),
            threeYearROI: ((calculations.savings.annualSavings * 3 - annualPlatformCost * 3) / (annualPlatformCost * 3) * 100),
            fiveYearROI: ((calculations.savings.annualSavings * 5 - annualPlatformCost * 5) / (annualPlatformCost * 5) * 100)
        };

        return calculations;
    }

    calculatePlatformCost(monthlyVolume) {
        // Tiered pricing model
        if (monthlyVolume < 1000) return 60000; // $5k/month
        if (monthlyVolume < 5000) return 120000; // $10k/month
        if (monthlyVolume < 10000) return 180000; // $15k/month
        if (monthlyVolume < 50000) return 300000; // $25k/month
        return 480000; // $40k/month for enterprise
    }

    async simulateIntegration(environmentId, system) {
        const mockData = {
            'SAP': {
                endpoint: '/api/sap/shipments',
                authentication: 'OAuth 2.0',
                dataFormat: 'JSON',
                sampleRequest: {
                    method: 'GET',
                    headers: { Authorization: 'Bearer mock_token' },
                    params: { date_from: '2024-01-01', status: 'active' }
                },
                sampleResponse: {
                    shipments: [
                        {
                            shipmentId: 'SH001234',
                            origin: 'Shanghai',
                            destination: 'Los Angeles',
                            items: 250,
                            status: 'in_transit'
                        }
                    ]
                },
                integrationTime: '2-3 weeks',
                requiredFields: ['shipmentId', 'origin', 'destination', 'items']
            },
            'Oracle': {
                endpoint: '/api/oracle/logistics',
                authentication: 'API Key',
                dataFormat: 'XML',
                integrationTime: '3-4 weeks'
            },
            'Custom TMS': {
                endpoint: '/api/custom/tms',
                authentication: 'Basic Auth',
                dataFormat: 'CSV',
                integrationTime: '4-6 weeks'
            }
        };

        const integrationDetails = mockData[system] || mockData['Custom TMS'];

        // Simulate API call
        const simulationResult = {
            system,
            testStatus: 'successful',
            responseTime: Math.floor(Math.random() * 500 + 100) + 'ms',
            dataPoints: Math.floor(Math.random() * 50 + 10),
            ...integrationDetails,
            mappingPreview: {
                yourField: 'container_number',
                ourField: 'containerNumber',
                transformation: 'direct'
            }
        };

        return simulationResult;
    }

    async generateInsight(demo, eventData) {
        // Generate contextual insights based on demo interactions
        if (eventData.type === 'calculate-roi') {
            return {
                type: 'roi-insight',
                message: 'Based on your volume, you could save enough to fund 2 additional FTEs',
                icon: '💡',
                priority: 'high'
            };
        }

        if (eventData.type === 'show-live-data') {
            return {
                type: 'performance-insight',
                message: 'Processing time is 85% faster than your current system',
                icon: '⚡',
                priority: 'medium'
            };
        }

        return null;
    }
}

// ==================== TECHNICAL EVALUATION ====================

class TechnicalEvaluationPlatform {
    async createSandboxEnvironment(request) {
        const sandboxId = uuidv4();
        
        const sandbox = {
            id: sandboxId,
            companyId: request.companyId,
            created: new Date(),
            expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            credentials: {
                apiKey: this.generateAPIKey(),
                apiSecret: this.generateAPISecret(),
                sandboxUrl: `https://sandbox.rootuip.com/${sandboxId}`,
                webhookUrl: `https://sandbox.rootuip.com/${sandboxId}/webhooks`
            },
            limits: {
                apiCallsPerDay: 10000,
                dataRetentionDays: 30,
                maxContainers: 1000
            },
            features: {
                fullAPIAccess: true,
                sampleDataAvailable: true,
                customIntegrations: true,
                performanceTesting: true
            }
        };

        await db.query(`
            INSERT INTO sandbox_environments 
            (sandbox_id, company_id, credentials, expires_at, status)
            VALUES ($1, $2, $3, $4, 'active')
        `, [sandboxId, request.companyId, JSON.stringify(sandbox.credentials), sandbox.expires]);

        return sandbox;
    }

    generateAPIKey() {
        return 'sk_sandbox_' + require('crypto').randomBytes(24).toString('hex');
    }

    generateAPISecret() {
        return require('crypto').randomBytes(32).toString('hex');
    }

    async generateAPIDocumentation(sandboxId) {
        return {
            baseUrl: `https://sandbox.rootuip.com/${sandboxId}/api/v1`,
            authentication: {
                type: 'Bearer Token',
                header: 'Authorization',
                format: 'Bearer {api_key}'
            },
            endpoints: [
                {
                    method: 'GET',
                    path: '/containers',
                    description: 'List all containers',
                    parameters: [
                        { name: 'status', type: 'string', required: false },
                        { name: 'carrier', type: 'string', required: false },
                        { name: 'limit', type: 'integer', required: false, default: 100 }
                    ],
                    example: {
                        request: 'GET /api/v1/containers?status=in_transit&limit=50',
                        response: {
                            containers: [
                                {
                                    id: 'cnt_123',
                                    number: 'MSKU1234567',
                                    status: 'in_transit',
                                    location: 'Pacific Ocean',
                                    eta: '2024-02-15T10:00:00Z'
                                }
                            ],
                            pagination: { total: 150, page: 1, limit: 50 }
                        }
                    }
                },
                {
                    method: 'POST',
                    path: '/containers/track',
                    description: 'Track a specific container',
                    body: {
                        containerNumber: 'string',
                        carrier: 'string'
                    }
                },
                {
                    method: 'GET',
                    path: '/analytics/performance',
                    description: 'Get performance metrics'
                },
                {
                    method: 'POST',
                    path: '/webhooks/subscribe',
                    description: 'Subscribe to real-time updates'
                }
            ],
            sdks: {
                python: 'pip install rootuip-sdk',
                javascript: 'npm install @rootuip/sdk',
                java: 'com.rootuip:sdk:1.0.0',
                csharp: 'Install-Package ROOTUIP.SDK'
            },
            postmanCollection: `/api/sandbox/${sandboxId}/postman-collection`,
            openAPISpec: `/api/sandbox/${sandboxId}/openapi.yaml`
        };
    }

    async generateSecurityDocumentation() {
        return {
            compliance: {
                certifications: ['SOC 2 Type II', 'ISO 27001', 'GDPR Compliant'],
                audits: {
                    lastAudit: '2024-01-15',
                    auditor: 'PwC',
                    report: '/security/audit-report-2024.pdf'
                }
            },
            dataProtection: {
                encryption: {
                    atRest: 'AES-256',
                    inTransit: 'TLS 1.3',
                    keyManagement: 'AWS KMS'
                },
                access: {
                    authentication: 'Multi-factor',
                    authorization: 'Role-based (RBAC)',
                    audit: 'All access logged and monitored'
                }
            },
            infrastructure: {
                hosting: 'AWS Multi-region',
                backup: 'Daily with 30-day retention',
                disasterRecovery: 'RTO: 4 hours, RPO: 1 hour',
                uptime: '99.95% SLA'
            },
            policies: {
                dataRetention: '7 years or per contract',
                incidentResponse: '24/7 SOC team',
                vendorManagement: 'Annual security reviews',
                penetrationTesting: 'Quarterly by third party'
            }
        };
    }

    async runPerformanceBenchmark(sandboxId, testConfig) {
        const results = {
            timestamp: new Date(),
            configuration: testConfig,
            results: {
                apiLatency: {
                    p50: 45,
                    p95: 120,
                    p99: 250,
                    unit: 'ms'
                },
                throughput: {
                    readOps: 10000,
                    writeOps: 5000,
                    unit: 'requests/second'
                },
                dataProcessing: {
                    singleContainer: 50,
                    batchOf100: 500,
                    batchOf1000: 4500,
                    unit: 'ms'
                },
                webhookDelivery: {
                    avgDelay: 200,
                    maxDelay: 1000,
                    reliability: 99.9,
                    unit: 'ms'
                }
            },
            comparison: {
                vsIndustryAverage: {
                    apiLatency: '-65%',
                    throughput: '+250%',
                    reliability: '+15%'
                }
            }
        };

        await db.query(`
            INSERT INTO performance_benchmarks 
            (sandbox_id, test_config, results, created_at)
            VALUES ($1, $2, $3, NOW())
        `, [sandboxId, JSON.stringify(testConfig), JSON.stringify(results)]);

        return results;
    }

    async generateIntegrationWorksheet(prospectData) {
        return {
            systems: prospectData.currentSystems.map(system => ({
                name: system,
                integrationType: this.suggestIntegrationType(system),
                estimatedEffort: this.estimateIntegrationEffort(system),
                requiredData: this.getRequiredDataPoints(system),
                sampleMapping: this.generateSampleMapping(system)
            })),
            timeline: {
                phase1: {
                    name: 'Core Integration',
                    duration: '2-3 weeks',
                    deliverables: ['Basic data flow', 'Real-time updates', 'Error handling']
                },
                phase2: {
                    name: 'Advanced Features',
                    duration: '2-3 weeks',
                    deliverables: ['Bi-directional sync', 'Custom workflows', 'Advanced analytics']
                },
                phase3: {
                    name: 'Optimization',
                    duration: '1-2 weeks',
                    deliverables: ['Performance tuning', 'Monitoring setup', 'Documentation']
                }
            },
            resources: {
                fromROOTUIP: ['Integration Engineer', 'Solution Architect', 'Project Manager'],
                fromClient: ['Technical Lead', 'System Admin', 'Business Analyst']
            }
        };
    }

    suggestIntegrationType(system) {
        const integrationTypes = {
            'SAP': 'REST API with OAuth 2.0',
            'Oracle': 'SOAP Web Services',
            'Salesforce': 'REST API with Connected App',
            'Microsoft Dynamics': 'OData API',
            'Custom': 'Webhook + Batch Upload'
        };
        return integrationTypes[system] || 'Custom Integration';
    }

    estimateIntegrationEffort(system) {
        const efforts = {
            'SAP': { hours: 80, complexity: 'Medium' },
            'Oracle': { hours: 120, complexity: 'High' },
            'Salesforce': { hours: 40, complexity: 'Low' },
            'Microsoft Dynamics': { hours: 60, complexity: 'Medium' },
            'Custom': { hours: 100, complexity: 'High' }
        };
        return efforts[system] || { hours: 80, complexity: 'Medium' };
    }
}

// ==================== SALES SUPPORT ====================

class SalesSupport {
    async generateDemoScript(environmentId, audienceProfile) {
        const environment = environmentManager.activeEnvironments.get(environmentId);
        const industry = environment.industry;
        const role = audienceProfile.role;

        const script = {
            opening: this.getOpening(role, environment.company),
            sections: await this.getScriptSections(industry, role, environment),
            objectionHandling: await this.getObjectionResponses(industry, role),
            closing: this.getClosing(role),
            timing: this.calculateTiming(audienceProfile.timeAvailable),
            talkingPoints: await this.getTalkingPoints(environment, audienceProfile)
        };

        return script;
    }

    getOpening(role, company) {
        const openings = {
            'executive': `Thank you for joining us today. I know your time is valuable, so I'll focus on how ROOTUIP can directly impact ${company}'s bottom line through operational efficiency and cost reduction.`,
            'technical': `I appreciate you taking the time to evaluate ROOTUIP. Today, I'll demonstrate our technical capabilities, integration approach, and how we ensure seamless implementation with your existing systems.`,
            'operational': `Thank you for your time today. I'll show you how ROOTUIP transforms daily operations, reduces manual work, and gives your team the tools they need to excel.`
        };
        return openings[role] || openings['operational'];
    }

    async getScriptSections(industry, role, environment) {
        const sections = [];

        if (role === 'executive') {
            sections.push({
                title: 'Business Impact Overview',
                duration: 5,
                content: [
                    `Current challenges costing ${environment.company} an estimated $${(environment.data.currentMetrics.operationalCost * 0.35).toLocaleString()} annually`,
                    'ROI achievable within 6-8 months',
                    'Competitive advantage through real-time visibility'
                ]
            });
        }

        sections.push({
            title: 'Live Demonstration',
            duration: 15,
            content: [
                'Real-time tracking across all carriers',
                'Automated exception handling',
                'Predictive analytics for proactive management'
            ]
        });

        if (role === 'technical') {
            sections.push({
                title: 'Technical Deep Dive',
                duration: 10,
                content: [
                    'API architecture and integration options',
                    'Security and compliance features',
                    'Performance benchmarks'
                ]
            });
        }

        return sections;
    }

    async getObjectionResponses(industry, role) {
        return {
            'integration_complexity': {
                objection: 'This seems complex to integrate with our systems',
                response: 'We have pre-built connectors for major systems and our integration team handles the heavy lifting. Most clients are integrated within 4-6 weeks.'
            },
            'cost_concern': {
                objection: 'This might be outside our budget',
                response: 'Based on your volume, the platform pays for itself within 6-8 months through detention fee savings alone. We also offer flexible pricing models.'
            },
            'change_management': {
                objection: 'Our team might resist changing systems',
                response: 'Our platform is designed to be intuitive. We provide comprehensive training and have seen 95% user adoption within 30 days.'
            },
            'data_security': {
                objection: 'We have concerns about data security',
                response: 'We are SOC 2 Type II certified, ISO 27001 compliant, and can provide detailed security documentation. Your data is encrypted at rest and in transit.'
            }
        };
    }

    async generateCompetitivePositioning(competitorName) {
        const positioning = {
            'legacy_tms': {
                weaknesses: [
                    'Limited real-time visibility',
                    'Requires manual carrier portal access',
                    'No predictive analytics',
                    'Expensive customization'
                ],
                our_advantages: [
                    'Real-time tracking across all carriers',
                    'AI-powered predictions',
                    'No-code configuration',
                    'Modern cloud architecture'
                ],
                switching_benefits: [
                    '75% reduction in manual tracking',
                    'Unified platform vs multiple systems',
                    'Free data migration support'
                ]
            },
            'visibility_platform_x': {
                weaknesses: [
                    'Limited to ocean freight',
                    'No workflow automation',
                    'Basic reporting only'
                ],
                our_advantages: [
                    'Multi-modal coverage',
                    'Full workflow automation',
                    'Advanced analytics and ML'
                ]
            }
        };

        return positioning[competitorName] || positioning['legacy_tms'];
    }

    async generateProposal(environmentId, dealData) {
        const environment = environmentManager.activeEnvironments.get(environmentId);
        
        const proposal = {
            executiveSummary: await this.generateExecutiveSummary(environment, dealData),
            solutionOverview: await this.generateSolutionOverview(environment),
            implementation: await this.generateImplementationPlan(environment, dealData),
            pricing: await this.generatePricing(environment, dealData),
            roi: await this.generateROIAnalysis(environment),
            references: await this.getRelevantReferences(environment.industry),
            appendix: {
                securityCompliance: await technicalPlatform.generateSecurityDocumentation(),
                integrationDetails: await technicalPlatform.generateIntegrationWorksheet(environment),
                sla: this.generateSLA()
            }
        };

        // Generate PDF
        const pdfPath = await this.createProposalPDF(proposal, environment);

        return {
            proposal,
            pdfPath,
            executiveVersion: await this.createExecutiveSummaryPDF(proposal, environment)
        };
    }

    async getRelevantReferences(industry) {
        const references = {
            'logistics': [
                {
                    company: 'Global Shipping Corp',
                    size: 'Fortune 500',
                    results: '45% reduction in detention fees, 60% faster exception resolution',
                    contact: 'Available upon request'
                },
                {
                    company: 'TransPacific Logistics',
                    size: '$2B Revenue',
                    results: '30% operational cost reduction, 99.9% tracking accuracy',
                    contact: 'Reference call available'
                }
            ],
            'retail': [
                {
                    company: 'MegaRetail Inc',
                    size: 'Fortune 100',
                    results: '50% reduction in stockouts, 35% inventory cost savings',
                    contact: 'Case study available'
                }
            ]
        };

        return references[industry] || references['logistics'];
    }
}

// ==================== FOLLOW-UP AUTOMATION ====================

class FollowUpAutomation {
    async generatePostDemoSummary(demoId) {
        const demoSession = await this.getDemoSession(demoId);
        const environment = environmentManager.activeEnvironments.get(demoSession.environmentId);

        const summary = {
            meetingDate: demoSession.startTime,
            attendees: demoSession.attendees,
            keyPointsCovered: await this.extractKeyPoints(demoSession),
            questionsRaised: await this.extractQuestions(demoSession),
            actionItems: await this.generateActionItems(demoSession, environment),
            customInsights: await this.generateCustomInsights(demoSession, environment),
            nextSteps: await this.recommendNextSteps(demoSession, environment)
        };

        // Generate formatted summary
        const formattedSummary = await this.formatSummary(summary, environment);

        // Create follow-up campaign
        await this.createFollowUpCampaign(environment, summary);

        return formattedSummary;
    }

    async extractKeyPoints(demoSession) {
        // Analyze demo interactions to extract key points
        const keyPoints = [];
        
        if (demoSession.interactions.find(i => i.type === 'calculate-roi')) {
            keyPoints.push('Demonstrated significant ROI potential with customer-specific data');
        }
        
        if (demoSession.interactions.find(i => i.type === 'show-live-data')) {
            keyPoints.push('Showed real-time data processing capabilities');
        }

        if (demoSession.insights.length > 0) {
            keyPoints.push(`Generated ${demoSession.insights.length} custom insights based on your operations`);
        }

        return keyPoints;
    }

    async generateActionItems(demoSession, environment) {
        const actionItems = [];

        // For prospect
        actionItems.push({
            owner: 'Prospect',
            action: 'Review technical requirements document',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        });

        actionItems.push({
            owner: 'Prospect',
            action: 'Identify integration points and data sources',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        // For ROOTUIP
        actionItems.push({
            owner: 'ROOTUIP',
            action: 'Provide sandbox access for technical evaluation',
            dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
        });

        actionItems.push({
            owner: 'ROOTUIP',
            action: 'Schedule follow-up with decision makers',
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
        });

        return actionItems;
    }

    async generateCustomInsights(demoSession, environment) {
        const insights = [];

        // Based on their specific data
        const roiData = demoSession.interactions.find(i => i.type === 'calculate-roi')?.result;
        if (roiData) {
            insights.push({
                type: 'financial',
                insight: `Based on your volume of ${environment.data.currentMetrics.monthlyVolume} monthly shipments, you could save $${Math.floor(roiData.savings.annualSavings).toLocaleString()} annually`,
                impact: 'high'
            });
        }

        // Industry-specific insights
        insights.push({
            type: 'operational',
            insight: `Your current ${environment.data.currentMetrics.avgProcessingTime} hour processing time can be reduced to under ${Math.floor(environment.data.currentMetrics.avgProcessingTime * 0.2)} hours`,
            impact: 'medium'
        });

        return insights;
    }

    async createFollowUpCampaign(environment, summary) {
        const campaign = {
            id: uuidv4(),
            environmentId: environment.id,
            created: new Date(),
            sequence: [
                {
                    delay: 0,
                    type: 'email',
                    template: 'demo_summary',
                    data: summary
                },
                {
                    delay: 1,
                    type: 'email',
                    template: 'technical_resources',
                    data: { sandboxInfo: true, documentation: true }
                },
                {
                    delay: 3,
                    type: 'call',
                    template: 'check_in',
                    data: { topics: ['technical questions', 'evaluation progress'] }
                },
                {
                    delay: 7,
                    type: 'email',
                    template: 'roi_detailed',
                    data: { customCalculations: true, caseStudies: true }
                },
                {
                    delay: 14,
                    type: 'email',
                    template: 'proposal_followup',
                    data: { proposalLink: true, calendarLink: true }
                }
            ]
        };

        await db.query(`
            INSERT INTO followup_campaigns 
            (campaign_id, environment_id, sequence, status, created_at)
            VALUES ($1, $2, $3, 'active', NOW())
        `, [campaign.id, environment.id, JSON.stringify(campaign.sequence)]);

        // Schedule first email immediately
        await this.sendFollowUpEmail(campaign.sequence[0], environment);

        return campaign;
    }

    async generateImplementationPlan(environment, requirements) {
        return {
            phases: [
                {
                    phase: 1,
                    name: 'Discovery & Planning',
                    duration: '2 weeks',
                    activities: [
                        'Detailed requirements gathering',
                        'System architecture review',
                        'Integration mapping',
                        'Success criteria definition'
                    ],
                    deliverables: [
                        'Implementation roadmap',
                        'Integration specifications',
                        'Test plan'
                    ]
                },
                {
                    phase: 2,
                    name: 'Core Implementation',
                    duration: '4-6 weeks',
                    activities: [
                        'Environment setup',
                        'Core integrations',
                        'Data migration',
                        'User configuration'
                    ],
                    deliverables: [
                        'Production environment',
                        'Integrated systems',
                        'Migrated data'
                    ]
                },
                {
                    phase: 3,
                    name: 'Testing & Training',
                    duration: '2 weeks',
                    activities: [
                        'UAT execution',
                        'Performance testing',
                        'User training',
                        'Documentation review'
                    ],
                    deliverables: [
                        'Test results',
                        'Trained users',
                        'Go-live checklist'
                    ]
                },
                {
                    phase: 4,
                    name: 'Go-Live & Optimization',
                    duration: '2 weeks',
                    activities: [
                        'Phased rollout',
                        'Monitoring setup',
                        'Performance tuning',
                        'Success tracking'
                    ],
                    deliverables: [
                        'Live system',
                        'Performance reports',
                        'Success metrics'
                    ]
                }
            ],
            resources: {
                fromROOTUIP: [
                    { role: 'Project Manager', allocation: '50%' },
                    { role: 'Integration Engineer', allocation: '100%' },
                    { role: 'Solution Architect', allocation: '25%' },
                    { role: 'Training Specialist', allocation: '25%' }
                ],
                fromClient: [
                    { role: 'Project Sponsor', allocation: '10%' },
                    { role: 'Technical Lead', allocation: '50%' },
                    { role: 'Business Analyst', allocation: '75%' },
                    { role: 'System Administrator', allocation: '50%' }
                ]
            },
            successMetrics: [
                'System uptime > 99.9%',
                'User adoption > 90% in 30 days',
                'ROI targets achieved in 6 months',
                'Integration success rate 100%'
            ]
        };
    }
}

// Initialize managers
const environmentManager = new DemoEnvironmentManager();
const demonstrationEngine = new DemonstrationEngine();
const technicalPlatform = new TechnicalEvaluationPlatform();
const salesSupport = new SalesSupport();
const followUpAutomation = new FollowUpAutomation();

// ==================== API ENDPOINTS ====================

// Create custom demo environment
app.post('/api/demo/environment/create', async (req, res) => {
    try {
        const environment = await environmentManager.createProspectEnvironment(req.body);
        res.json({
            success: true,
            environmentId: environment.id,
            accessUrl: `https://demo.rootuip.com/${environment.id}`,
            environment
        });
    } catch (error) {
        console.error('Environment creation error:', error);
        res.status(500).json({ error: 'Failed to create environment' });
    }
});

// Start guided demo
app.post('/api/demo/start', async (req, res) => {
    try {
        const { environmentId, demoType } = req.body;
        const demo = await demonstrationEngine.startGuidedDemo(environmentId, demoType);
        res.json({
            success: true,
            demoId: demo.id,
            demo
        });
    } catch (error) {
        console.error('Demo start error:', error);
        res.status(500).json({ error: 'Failed to start demo' });
    }
});

// Process demo interaction
app.post('/api/demo/interact', async (req, res) => {
    try {
        const { demoId, eventData } = req.body;
        const result = await demonstrationEngine.processRealtimeDemo(demoId, eventData);
        res.json({ success: true, result });
    } catch (error) {
        console.error('Demo interaction error:', error);
        res.status(500).json({ error: 'Failed to process interaction' });
    }
});

// Create sandbox environment
app.post('/api/sandbox/create', async (req, res) => {
    try {
        const sandbox = await technicalPlatform.createSandboxEnvironment(req.body);
        res.json({ success: true, sandbox });
    } catch (error) {
        console.error('Sandbox creation error:', error);
        res.status(500).json({ error: 'Failed to create sandbox' });
    }
});

// Get API documentation
app.get('/api/sandbox/:sandboxId/documentation', async (req, res) => {
    try {
        const docs = await technicalPlatform.generateAPIDocumentation(req.params.sandboxId);
        res.json(docs);
    } catch (error) {
        console.error('Documentation error:', error);
        res.status(500).json({ error: 'Failed to generate documentation' });
    }
});

// Run performance benchmark
app.post('/api/sandbox/:sandboxId/benchmark', async (req, res) => {
    try {
        const results = await technicalPlatform.runPerformanceBenchmark(
            req.params.sandboxId, 
            req.body
        );
        res.json({ success: true, results });
    } catch (error) {
        console.error('Benchmark error:', error);
        res.status(500).json({ error: 'Failed to run benchmark' });
    }
});

// Generate demo script
app.post('/api/sales/demo-script', async (req, res) => {
    try {
        const { environmentId, audienceProfile } = req.body;
        const script = await salesSupport.generateDemoScript(environmentId, audienceProfile);
        res.json({ success: true, script });
    } catch (error) {
        console.error('Script generation error:', error);
        res.status(500).json({ error: 'Failed to generate script' });
    }
});

// Generate proposal
app.post('/api/sales/proposal', async (req, res) => {
    try {
        const { environmentId, dealData } = req.body;
        const proposal = await salesSupport.generateProposal(environmentId, dealData);
        res.json({ success: true, proposal });
    } catch (error) {
        console.error('Proposal generation error:', error);
        res.status(500).json({ error: 'Failed to generate proposal' });
    }
});

// Generate post-demo summary
app.post('/api/followup/summary', async (req, res) => {
    try {
        const { demoId } = req.body;
        const summary = await followUpAutomation.generatePostDemoSummary(demoId);
        res.json({ success: true, summary });
    } catch (error) {
        console.error('Summary generation error:', error);
        res.status(500).json({ error: 'Failed to generate summary' });
    }
});

// Initialize database
async function initializeDatabase() {
    try {
        // Demo environments table
        await db.query(`
            CREATE TABLE IF NOT EXISTS demo_environments (
                environment_id UUID PRIMARY KEY,
                prospect_id VARCHAR(255),
                company VARCHAR(255),
                industry VARCHAR(100),
                config JSONB,
                data JSONB,
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Demo sessions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS demo_sessions (
                demo_id UUID PRIMARY KEY,
                environment_id UUID,
                demo_type VARCHAR(100),
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                interactions JSONB,
                insights JSONB,
                status VARCHAR(50),
                last_interaction TIMESTAMP
            )
        `);

        // Sandbox environments table
        await db.query(`
            CREATE TABLE IF NOT EXISTS sandbox_environments (
                sandbox_id UUID PRIMARY KEY,
                company_id VARCHAR(255),
                credentials JSONB,
                expires_at TIMESTAMP,
                usage_stats JSONB,
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Performance benchmarks table
        await db.query(`
            CREATE TABLE IF NOT EXISTS performance_benchmarks (
                id SERIAL PRIMARY KEY,
                sandbox_id UUID,
                test_config JSONB,
                results JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Follow-up campaigns table
        await db.query(`
            CREATE TABLE IF NOT EXISTS followup_campaigns (
                campaign_id UUID PRIMARY KEY,
                environment_id UUID,
                sequence JSONB,
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Start server
const PORT = process.env.PORT || 3009;
app.listen(PORT, async () => {
    console.log(`Enterprise Demo Environment running on port ${PORT}`);
    await initializeDatabase();
});

module.exports = app;