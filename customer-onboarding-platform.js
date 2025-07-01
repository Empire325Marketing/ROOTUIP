// ROOTUIP Customer Onboarding & Success Platform
// Enterprise-grade onboarding workflows and success management

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const winston = require('winston');
const { generatePDF } = require('./utils/pdf-generator');

// Initialize services
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD
});

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'customer-success.log' }),
        new winston.transports.Console()
    ]
});

// Email configuration
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

class CustomerOnboardingPlatform {
    constructor() {
        this.onboardingPhases = {
            kickoff: { // Days 0-7
                milestones: [
                    'welcome_call_completed',
                    'technical_contact_assigned',
                    'success_manager_assigned',
                    'onboarding_plan_shared'
                ],
                duration: 7
            },
            implementation: { // Days 8-30
                milestones: [
                    'api_credentials_generated',
                    'first_carrier_integrated',
                    'initial_data_migrated',
                    'user_accounts_created',
                    'training_scheduled'
                ],
                duration: 22
            },
            adoption: { // Days 31-60
                milestones: [
                    'all_carriers_integrated',
                    'historical_data_imported',
                    'team_training_completed',
                    'first_cost_savings_identified',
                    'workflows_configured'
                ],
                duration: 30
            },
            optimization: { // Days 61-90
                milestones: [
                    'advanced_features_enabled',
                    'custom_reports_created',
                    'roi_documented',
                    'expansion_opportunities_identified',
                    'success_story_captured'
                ],
                duration: 30
            }
        };

        this.healthScoreWeights = {
            usage_frequency: 0.25,
            feature_adoption: 0.20,
            integration_completeness: 0.15,
            support_tickets: 0.10,
            training_completion: 0.10,
            engagement_score: 0.10,
            contract_value: 0.10
        };

        this.expansionTriggers = {
            volume_threshold: 0.85, // 85% of contracted volume
            new_carriers_available: true,
            feature_usage_high: true,
            roi_achieved: 2.0, // 2x ROI
            team_growth: 0.20 // 20% team growth
        };
    }

    // ================== AUTOMATED ONBOARDING WORKFLOWS ==================

    async createCustomerOnboarding(customerData) {
        const onboardingId = uuidv4();
        
        try {
            // Create onboarding record
            await pool.query(`
                INSERT INTO customer_onboarding (
                    id, customer_id, company_name, contract_value,
                    onboarding_type, start_date, target_completion_date,
                    assigned_csm, assigned_engineer, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
            `, [
                onboardingId,
                customerData.customerId,
                customerData.companyName,
                customerData.contractValue,
                customerData.onboardingType || 'enterprise',
                new Date(),
                new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
                customerData.assignedCSM,
                customerData.assignedEngineer
            ]);

            // Initialize onboarding phases
            await this.initializeOnboardingPhases(onboardingId);

            // Create welcome package
            await this.createWelcomePackage(customerData);

            // Schedule automated workflows
            await this.scheduleOnboardingWorkflows(onboardingId, customerData);

            // Send notifications
            await this.sendOnboardingNotifications(customerData);

            logger.info(`Onboarding created for ${customerData.companyName}`, { onboardingId });

            return {
                success: true,
                onboardingId,
                message: 'Onboarding workflow initiated successfully'
            };

        } catch (error) {
            logger.error('Error creating onboarding:', error);
            throw error;
        }
    }

    async initializeOnboardingPhases(onboardingId) {
        for (const [phase, config] of Object.entries(this.onboardingPhases)) {
            await pool.query(`
                INSERT INTO onboarding_phases (
                    onboarding_id, phase_name, start_date, target_end_date,
                    milestones, status
                ) VALUES ($1, $2, $3, $4, $5, 'pending')
            `, [
                onboardingId,
                phase,
                this.calculatePhaseStartDate(phase),
                this.calculatePhaseEndDate(phase),
                JSON.stringify(config.milestones)
            ]);
        }
    }

    async scheduleOnboardingWorkflows(onboardingId, customerData) {
        const workflows = [
            {
                name: 'welcome_sequence',
                schedule: 'immediate',
                actions: ['send_welcome_email', 'create_slack_channel', 'schedule_kickoff_call']
            },
            {
                name: 'day_3_checkin',
                schedule: '3_days',
                actions: ['send_checkin_email', 'verify_access', 'track_first_login']
            },
            {
                name: 'week_1_review',
                schedule: '7_days',
                actions: ['conduct_progress_review', 'identify_blockers', 'adjust_timeline']
            },
            {
                name: 'week_2_training',
                schedule: '14_days',
                actions: ['schedule_training_sessions', 'assign_learning_paths', 'track_completion']
            },
            {
                name: 'day_30_milestone',
                schedule: '30_days',
                actions: ['evaluate_implementation', 'measure_initial_adoption', 'celebrate_wins']
            },
            {
                name: 'day_60_review',
                schedule: '60_days',
                actions: ['conduct_health_check', 'identify_expansion', 'document_roi']
            },
            {
                name: 'day_90_graduation',
                schedule: '90_days',
                actions: ['final_review', 'transition_to_success', 'capture_testimonial']
            }
        ];

        for (const workflow of workflows) {
            await this.scheduleWorkflow(onboardingId, workflow, customerData);
        }
    }

    async scheduleWorkflow(onboardingId, workflow, customerData) {
        const executeAt = this.calculateExecutionTime(workflow.schedule);
        
        await pool.query(`
            INSERT INTO scheduled_workflows (
                onboarding_id, workflow_name, execute_at, actions, status
            ) VALUES ($1, $2, $3, $4, 'scheduled')
        `, [
            onboardingId,
            workflow.name,
            executeAt,
            JSON.stringify(workflow.actions)
        ]);

        // Set up cron job for execution
        if (workflow.schedule === 'immediate') {
            await this.executeWorkflow(workflow, customerData);
        }
    }

    async executeWorkflow(workflow, customerData) {
        for (const action of workflow.actions) {
            try {
                await this.executeAction(action, customerData);
            } catch (error) {
                logger.error(`Error executing action ${action}:`, error);
            }
        }
    }

    async executeAction(action, customerData) {
        switch (action) {
            case 'send_welcome_email':
                return this.sendWelcomeEmail(customerData);
            case 'create_slack_channel':
                return this.createSlackChannel(customerData);
            case 'schedule_kickoff_call':
                return this.scheduleKickoffCall(customerData);
            case 'send_checkin_email':
                return this.sendCheckinEmail(customerData);
            case 'verify_access':
                return this.verifyCustomerAccess(customerData);
            case 'track_first_login':
                return this.trackFirstLogin(customerData);
            case 'schedule_training_sessions':
                return this.scheduleTrainingSessions(customerData);
            case 'assign_learning_paths':
                return this.assignLearningPaths(customerData);
            case 'evaluate_implementation':
                return this.evaluateImplementation(customerData);
            case 'measure_initial_adoption':
                return this.measureInitialAdoption(customerData);
            case 'conduct_health_check':
                return this.conductHealthCheck(customerData);
            case 'identify_expansion':
                return this.identifyExpansionOpportunities(customerData);
            default:
                logger.warn(`Unknown action: ${action}`);
        }
    }

    async createWelcomePackage(customerData) {
        const welcomePackage = {
            customerId: customerData.customerId,
            contents: {
                welcome_letter: await this.generateWelcomeLetter(customerData),
                getting_started_guide: await this.generateGettingStartedGuide(customerData),
                implementation_checklist: await this.generateImplementationChecklist(customerData),
                training_schedule: await this.generateTrainingSchedule(customerData),
                success_metrics: await this.defineSuccessMetrics(customerData),
                contact_information: await this.compileContactInformation(customerData)
            },
            created_at: new Date()
        };

        await pool.query(`
            INSERT INTO welcome_packages (customer_id, contents, created_at)
            VALUES ($1, $2, $3)
        `, [
            customerData.customerId,
            JSON.stringify(welcomePackage.contents),
            welcomePackage.created_at
        ]);

        // Generate PDF version
        const pdfPath = await generatePDF('welcome-package', welcomePackage);
        
        // Store in customer portal
        await this.uploadToCustomerPortal(customerData.customerId, pdfPath);

        return welcomePackage;
    }

    // ================== INTEGRATION SETUP WIZARDS ==================

    async createIntegrationWizard(customerId, carrierType) {
        const wizardId = uuidv4();
        const steps = this.getCarrierIntegrationSteps(carrierType);

        await pool.query(`
            INSERT INTO integration_wizards (
                id, customer_id, carrier_type, steps, current_step, status
            ) VALUES ($1, $2, $3, $4, 0, 'in_progress')
        `, [
            wizardId,
            customerId,
            carrierType,
            JSON.stringify(steps)
        ]);

        return {
            wizardId,
            carrierType,
            steps,
            currentStep: 0
        };
    }

    getCarrierIntegrationSteps(carrierType) {
        const baseSteps = [
            {
                id: 'credentials',
                title: 'API Credentials',
                description: 'Enter your carrier API credentials',
                fields: ['api_key', 'api_secret', 'account_id'],
                validation: 'validate_api_credentials'
            },
            {
                id: 'test_connection',
                title: 'Test Connection',
                description: 'Verify API connectivity',
                action: 'test_carrier_connection',
                automatic: true
            },
            {
                id: 'configure_sync',
                title: 'Configure Data Sync',
                description: 'Set up data synchronization preferences',
                fields: ['sync_frequency', 'data_types', 'historical_range'],
                defaults: {
                    sync_frequency: 'real_time',
                    data_types: ['containers', 'documents', 'events'],
                    historical_range: '90_days'
                }
            },
            {
                id: 'map_fields',
                title: 'Field Mapping',
                description: 'Map carrier fields to ROOTUIP standard',
                action: 'auto_map_fields',
                review_required: true
            },
            {
                id: 'initial_sync',
                title: 'Initial Data Sync',
                description: 'Import historical data',
                action: 'perform_initial_sync',
                progress_tracking: true
            },
            {
                id: 'verify_data',
                title: 'Verify Data',
                description: 'Review imported data for accuracy',
                action: 'generate_verification_report',
                approval_required: true
            },
            {
                id: 'activate',
                title: 'Activate Integration',
                description: 'Enable live data synchronization',
                action: 'activate_integration',
                notification: true
            }
        ];

        // Carrier-specific steps
        const carrierSpecificSteps = {
            maersk: [
                {
                    id: 'edi_setup',
                    title: 'EDI Configuration',
                    description: 'Configure EDI message types',
                    after: 'configure_sync'
                }
            ],
            msc: [
                {
                    id: 'regional_endpoints',
                    title: 'Regional Endpoints',
                    description: 'Select regional API endpoints',
                    after: 'credentials'
                }
            ]
        };

        return this.mergeSteps(baseSteps, carrierSpecificSteps[carrierType] || []);
    }

    async progressIntegrationWizard(wizardId, stepData) {
        const wizard = await this.getWizard(wizardId);
        const currentStep = wizard.steps[wizard.current_step];

        try {
            // Validate step data
            if (currentStep.validation) {
                await this[currentStep.validation](stepData);
            }

            // Execute step action
            if (currentStep.action) {
                const result = await this[currentStep.action](wizard.customer_id, stepData);
                stepData.result = result;
            }

            // Save step data
            await pool.query(`
                INSERT INTO wizard_step_data (
                    wizard_id, step_id, data, completed_at
                ) VALUES ($1, $2, $3, NOW())
            `, [
                wizardId,
                currentStep.id,
                JSON.stringify(stepData)
            ]);

            // Update wizard progress
            const nextStep = wizard.current_step + 1;
            const isComplete = nextStep >= wizard.steps.length;

            await pool.query(`
                UPDATE integration_wizards 
                SET current_step = $1, 
                    status = $2,
                    completed_at = $3
                WHERE id = $4
            `, [
                isComplete ? wizard.current_step : nextStep,
                isComplete ? 'completed' : 'in_progress',
                isComplete ? new Date() : null,
                wizardId
            ]);

            // Track milestone
            if (isComplete) {
                await this.trackMilestone(wizard.customer_id, `${wizard.carrier_type}_integrated`);
            }

            return {
                success: true,
                nextStep: isComplete ? null : wizard.steps[nextStep],
                isComplete
            };

        } catch (error) {
            logger.error('Error progressing wizard:', error);
            throw error;
        }
    }

    // ================== DATA MIGRATION ASSISTANCE ==================

    async createDataMigration(customerId, sourceSystem, options = {}) {
        const migrationId = uuidv4();

        await pool.query(`
            INSERT INTO data_migrations (
                id, customer_id, source_system, options, status, created_at
            ) VALUES ($1, $2, $3, $4, 'initialized', NOW())
        `, [
            migrationId,
            customerId,
            sourceSystem,
            JSON.stringify(options)
        ]);

        // Start migration process
        this.startMigrationProcess(migrationId, customerId, sourceSystem, options);

        return {
            migrationId,
            status: 'initialized',
            estimatedCompletion: this.estimateMigrationTime(options)
        };
    }

    async startMigrationProcess(migrationId, customerId, sourceSystem, options) {
        try {
            // Phase 1: Discovery
            await this.updateMigrationStatus(migrationId, 'discovery');
            const schema = await this.discoverSourceSchema(sourceSystem, options);
            
            // Phase 2: Mapping
            await this.updateMigrationStatus(migrationId, 'mapping');
            const mappings = await this.generateFieldMappings(schema);
            
            // Phase 3: Validation
            await this.updateMigrationStatus(migrationId, 'validation');
            const validation = await this.validateMappings(mappings, schema);
            
            // Phase 4: Migration
            await this.updateMigrationStatus(migrationId, 'migrating');
            const result = await this.performMigration(migrationId, mappings, options);
            
            // Phase 5: Verification
            await this.updateMigrationStatus(migrationId, 'verification');
            const verification = await this.verifyMigration(migrationId, result);
            
            // Complete
            await this.completeMigration(migrationId, verification);

        } catch (error) {
            await this.handleMigrationError(migrationId, error);
        }
    }

    async performMigration(migrationId, mappings, options) {
        const batchSize = options.batchSize || 1000;
        const parallel = options.parallel || 4;
        
        let totalRecords = 0;
        let migratedRecords = 0;
        let errors = [];

        // Get source data
        const sourceData = await this.getSourceData(options);
        totalRecords = sourceData.length;

        // Process in batches
        for (let i = 0; i < sourceData.length; i += batchSize) {
            const batch = sourceData.slice(i, i + batchSize);
            
            try {
                const transformed = await this.transformBatch(batch, mappings);
                await this.importBatch(transformed);
                migratedRecords += batch.length;
                
                // Update progress
                await this.updateMigrationProgress(migrationId, {
                    total: totalRecords,
                    completed: migratedRecords,
                    percentage: (migratedRecords / totalRecords) * 100
                });
                
            } catch (error) {
                errors.push({
                    batch: i / batchSize,
                    error: error.message,
                    records: batch.map(r => r.id)
                });
            }
        }

        return {
            totalRecords,
            migratedRecords,
            errors,
            success: errors.length === 0
        };
    }

    // ================== CUSTOMER SUCCESS MANAGEMENT ==================

    async calculateHealthScore(customerId) {
        const metrics = await this.gatherHealthMetrics(customerId);
        let totalScore = 0;
        const breakdown = {};

        for (const [metric, weight] of Object.entries(this.healthScoreWeights)) {
            const score = await this.calculateMetricScore(customerId, metric, metrics);
            const weightedScore = score * weight;
            totalScore += weightedScore;
            
            breakdown[metric] = {
                score,
                weight,
                weighted: weightedScore
            };
        }

        // Save health score
        await pool.query(`
            INSERT INTO customer_health_scores (
                customer_id, score, breakdown, calculated_at
            ) VALUES ($1, $2, $3, NOW())
            ON CONFLICT (customer_id) 
            DO UPDATE SET 
                score = $2,
                breakdown = $3,
                calculated_at = NOW()
        `, [
            customerId,
            totalScore,
            JSON.stringify(breakdown)
        ]);

        // Check for triggers
        await this.checkHealthTriggers(customerId, totalScore, breakdown);

        return {
            score: totalScore,
            status: this.getHealthStatus(totalScore),
            breakdown,
            recommendations: await this.generateHealthRecommendations(customerId, breakdown)
        };
    }

    async calculateMetricScore(customerId, metric, data) {
        switch (metric) {
            case 'usage_frequency':
                return this.calculateUsageScore(data.usage);
            case 'feature_adoption':
                return this.calculateFeatureAdoptionScore(data.features);
            case 'integration_completeness':
                return this.calculateIntegrationScore(data.integrations);
            case 'support_tickets':
                return this.calculateSupportScore(data.support);
            case 'training_completion':
                return this.calculateTrainingScore(data.training);
            case 'engagement_score':
                return this.calculateEngagementScore(data.engagement);
            case 'contract_value':
                return this.calculateContractScore(data.contract);
            default:
                return 0;
        }
    }

    async checkHealthTriggers(customerId, score, breakdown) {
        const triggers = [];

        // Low health score
        if (score < 60) {
            triggers.push({
                type: 'low_health_score',
                severity: 'high',
                action: 'schedule_executive_review'
            });
        }

        // Declining usage
        if (breakdown.usage_frequency.score < 50) {
            triggers.push({
                type: 'declining_usage',
                severity: 'medium',
                action: 'usage_analysis_meeting'
            });
        }

        // Poor feature adoption
        if (breakdown.feature_adoption.score < 40) {
            triggers.push({
                type: 'low_feature_adoption',
                severity: 'medium',
                action: 'feature_training_session'
            });
        }

        // High support tickets
        if (breakdown.support_tickets.score < 50) {
            triggers.push({
                type: 'high_support_volume',
                severity: 'medium',
                action: 'technical_review'
            });
        }

        // Execute triggered actions
        for (const trigger of triggers) {
            await this.executeHealthTrigger(customerId, trigger);
        }

        return triggers;
    }

    async executeHealthTrigger(customerId, trigger) {
        switch (trigger.action) {
            case 'schedule_executive_review':
                await this.scheduleExecutiveReview(customerId, trigger);
                break;
            case 'usage_analysis_meeting':
                await this.scheduleUsageAnalysis(customerId, trigger);
                break;
            case 'feature_training_session':
                await this.scheduleFeatureTraining(customerId, trigger);
                break;
            case 'technical_review':
                await this.scheduleTechnicalReview(customerId, trigger);
                break;
        }

        // Log trigger
        await pool.query(`
            INSERT INTO health_triggers (
                customer_id, trigger_type, severity, action_taken, triggered_at
            ) VALUES ($1, $2, $3, $4, NOW())
        `, [
            customerId,
            trigger.type,
            trigger.severity,
            trigger.action
        ]);
    }

    async identifyExpansionOpportunities(customerId) {
        const opportunities = [];
        const usage = await this.getCustomerUsage(customerId);
        const contract = await this.getCustomerContract(customerId);

        // Volume expansion
        if (usage.containerVolume / contract.contractedVolume > this.expansionTriggers.volume_threshold) {
            opportunities.push({
                type: 'volume_expansion',
                current: usage.containerVolume,
                contracted: contract.contractedVolume,
                recommended: Math.ceil(usage.containerVolume * 1.3),
                estimatedValue: this.calculateVolumeExpansionValue(usage, contract)
            });
        }

        // Feature upsell
        const unusedFeatures = await this.getUnusedPremiumFeatures(customerId);
        if (unusedFeatures.length > 0) {
            opportunities.push({
                type: 'feature_upsell',
                features: unusedFeatures,
                estimatedValue: this.calculateFeatureUpsellValue(unusedFeatures)
            });
        }

        // Additional carriers
        const potentialCarriers = await this.getPotentialCarriers(customerId);
        if (potentialCarriers.length > 0) {
            opportunities.push({
                type: 'carrier_expansion',
                carriers: potentialCarriers,
                estimatedValue: this.calculateCarrierExpansionValue(potentialCarriers)
            });
        }

        // Team expansion
        const teamGrowth = await this.getTeamGrowthRate(customerId);
        if (teamGrowth > this.expansionTriggers.team_growth) {
            opportunities.push({
                type: 'seat_expansion',
                currentSeats: contract.seats,
                recommendedSeats: Math.ceil(contract.seats * (1 + teamGrowth)),
                estimatedValue: this.calculateSeatExpansionValue(contract, teamGrowth)
            });
        }

        // Save opportunities
        for (const opportunity of opportunities) {
            await pool.query(`
                INSERT INTO expansion_opportunities (
                    customer_id, opportunity_type, details, estimated_value, 
                    identified_at, status
                ) VALUES ($1, $2, $3, $4, NOW(), 'open')
            `, [
                customerId,
                opportunity.type,
                JSON.stringify(opportunity),
                opportunity.estimatedValue
            ]);
        }

        return opportunities;
    }

    async generateExecutiveBusinessReview(customerId, period = 'quarterly') {
        const review = {
            customerId,
            period,
            generatedAt: new Date(),
            sections: {}
        };

        // Executive Summary
        review.sections.executiveSummary = await this.generateExecutiveSummary(customerId, period);

        // ROI Analysis
        review.sections.roiAnalysis = await this.calculateROI(customerId, period);

        // Usage Analytics
        review.sections.usageAnalytics = await this.generateUsageAnalytics(customerId, period);

        // Success Metrics
        review.sections.successMetrics = await this.compileSuccessMetrics(customerId, period);

        // Strategic Recommendations
        review.sections.recommendations = await this.generateStrategicRecommendations(customerId);

        // Future Roadmap
        review.sections.roadmap = await this.generateRoadmap(customerId);

        // Save EBR
        await pool.query(`
            INSERT INTO executive_business_reviews (
                customer_id, period, content, generated_at
            ) VALUES ($1, $2, $3, NOW())
        `, [
            customerId,
            period,
            JSON.stringify(review)
        ]);

        // Generate presentation
        const presentationPath = await this.generateEBRPresentation(review);

        return {
            review,
            presentationPath,
            scheduleMeeting: true
        };
    }

    async calculateROI(customerId, period) {
        const costs = await this.getCustomerCosts(customerId, period);
        const savings = await this.calculateSavings(customerId, period);
        const efficiency = await this.calculateEfficiencyGains(customerId, period);

        const totalBenefit = savings.total + efficiency.monetaryValue;
        const roi = ((totalBenefit - costs.total) / costs.total) * 100;

        return {
            costs,
            savings,
            efficiency,
            totalBenefit,
            roi,
            paybackPeriod: costs.total / (totalBenefit / 12) // months
        };
    }

    // ================== SELF-SERVICE SUCCESS TOOLS ==================

    async createProductTour(tourConfig) {
        const tourId = uuidv4();

        await pool.query(`
            INSERT INTO product_tours (
                id, name, description, steps, target_role, 
                estimated_duration, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
            tourId,
            tourConfig.name,
            tourConfig.description,
            JSON.stringify(tourConfig.steps),
            tourConfig.targetRole,
            tourConfig.estimatedDuration
        ]);

        return {
            tourId,
            ...tourConfig
        };
    }

    async trackTourProgress(userId, tourId, stepCompleted) {
        await pool.query(`
            INSERT INTO tour_progress (
                user_id, tour_id, step_completed, completed_at
            ) VALUES ($1, $2, $3, NOW())
            ON CONFLICT (user_id, tour_id, step_completed) DO NOTHING
        `, [userId, tourId, stepCompleted]);

        // Check if tour completed
        const tour = await this.getTour(tourId);
        const progress = await this.getUserTourProgress(userId, tourId);

        if (progress.completedSteps.length === tour.steps.length) {
            await this.completeTour(userId, tourId);
        }
    }

    async createTrainingModule(moduleConfig) {
        const moduleId = uuidv4();

        await pool.query(`
            INSERT INTO training_modules (
                id, title, description, content_type, content_url,
                duration, difficulty, prerequisites, role_specific,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        `, [
            moduleId,
            moduleConfig.title,
            moduleConfig.description,
            moduleConfig.contentType, // video, interactive, document
            moduleConfig.contentUrl,
            moduleConfig.duration,
            moduleConfig.difficulty,
            JSON.stringify(moduleConfig.prerequisites || []),
            moduleConfig.roleSpecific
        ]);

        // Generate quiz if applicable
        if (moduleConfig.includeQuiz) {
            await this.createModuleQuiz(moduleId, moduleConfig.quizQuestions);
        }

        return moduleId;
    }

    async generateImplementationTemplate(customerId, templateType) {
        const templates = {
            carrier_integration: {
                phases: ['Planning', 'Technical Setup', 'Testing', 'Go-Live'],
                tasks: await this.getCarrierIntegrationTasks(customerId),
                timeline: '2-4 weeks',
                resources: ['Technical Contact', 'API Documentation', 'Test Environment']
            },
            team_onboarding: {
                phases: ['Access Setup', 'Role Assignment', 'Training', 'Certification'],
                tasks: await this.getTeamOnboardingTasks(customerId),
                timeline: '1-2 weeks',
                resources: ['Training Videos', 'User Guides', 'Practice Environment']
            },
            data_migration: {
                phases: ['Assessment', 'Mapping', 'Validation', 'Migration', 'Verification'],
                tasks: await this.getDataMigrationTasks(customerId),
                timeline: '2-6 weeks',
                resources: ['Data Mapping Tool', 'Migration Guide', 'Support Team']
            }
        };

        const template = templates[templateType];
        if (!template) {
            throw new Error(`Unknown template type: ${templateType}`);
        }

        // Customize template for customer
        const customized = await this.customizeTemplate(template, customerId);

        // Generate downloadable formats
        const formats = {
            pdf: await this.generateTemplatePDF(customized),
            excel: await this.generateTemplateExcel(customized),
            projectPlan: await this.generateProjectPlan(customized)
        };

        return {
            template: customized,
            formats
        };
    }

    async createCommunityPost(userId, postData) {
        const postId = uuidv4();

        await pool.query(`
            INSERT INTO community_posts (
                id, user_id, title, content, category, tags,
                is_best_practice, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
            postId,
            userId,
            postData.title,
            postData.content,
            postData.category,
            JSON.stringify(postData.tags || []),
            postData.isBestPractice || false
        ]);

        // Notify relevant users
        await this.notifyCommunityMembers(postId, postData);

        return postId;
    }

    // ================== RETENTION & EXPANSION TRACKING ==================

    async calculateRetentionMetrics() {
        const metrics = {
            customerRetention: await this.calculateCustomerRetention(),
            netRevenueRetention: await this.calculateNetRevenueRetention(),
            grossRevenueRetention: await this.calculateGrossRevenueRetention(),
            churnRate: await this.calculateChurnRate(),
            expansionRevenue: await this.calculateExpansionRevenue()
        };

        // Store metrics
        await pool.query(`
            INSERT INTO retention_metrics (
                period, customer_retention, nrr, grr, churn_rate,
                expansion_revenue, calculated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
            new Date().toISOString().slice(0, 7), // YYYY-MM
            metrics.customerRetention,
            metrics.netRevenueRetention,
            metrics.grossRevenueRetention,
            metrics.churnRate,
            metrics.expansionRevenue
        ]);

        return metrics;
    }

    async calculateNetRevenueRetention() {
        const result = await pool.query(`
            WITH cohort_analysis AS (
                SELECT 
                    DATE_TRUNC('month', c1.start_date) as cohort_month,
                    SUM(c1.mrr) as starting_mrr,
                    SUM(c2.mrr) as ending_mrr,
                    SUM(CASE WHEN c2.mrr > c1.mrr THEN c2.mrr - c1.mrr ELSE 0 END) as expansion,
                    SUM(CASE WHEN c2.mrr < c1.mrr THEN c1.mrr - c2.mrr ELSE 0 END) as contraction,
                    SUM(CASE WHEN c2.mrr IS NULL THEN c1.mrr ELSE 0 END) as churn
                FROM customer_contracts c1
                LEFT JOIN customer_contracts c2 
                    ON c1.customer_id = c2.customer_id 
                    AND c2.period = c1.period + INTERVAL '12 months'
                WHERE c1.period >= NOW() - INTERVAL '12 months'
                GROUP BY DATE_TRUNC('month', c1.start_date)
            )
            SELECT 
                AVG((ending_mrr + expansion) / NULLIF(starting_mrr, 0) * 100) as nrr
            FROM cohort_analysis
        `);

        return result.rows[0].nrr || 0;
    }

    // Scheduled jobs
    initializeScheduledJobs() {
        // Daily health score calculation
        cron.schedule('0 2 * * *', async () => {
            logger.info('Running daily health score calculations');
            const customers = await this.getActiveCustomers();
            
            for (const customer of customers) {
                try {
                    await this.calculateHealthScore(customer.id);
                } catch (error) {
                    logger.error(`Error calculating health score for ${customer.id}:`, error);
                }
            }
        });

        // Weekly expansion opportunity identification
        cron.schedule('0 9 * * 1', async () => {
            logger.info('Running weekly expansion opportunity analysis');
            const customers = await this.getActiveCustomers();
            
            for (const customer of customers) {
                try {
                    await this.identifyExpansionOpportunities(customer.id);
                } catch (error) {
                    logger.error(`Error identifying expansion for ${customer.id}:`, error);
                }
            }
        });

        // Monthly retention metrics
        cron.schedule('0 0 1 * *', async () => {
            logger.info('Calculating monthly retention metrics');
            await this.calculateRetentionMetrics();
        });
    }
}

// Initialize platform
const platform = new CustomerOnboardingPlatform();
platform.initializeScheduledJobs();

// API Routes
router.post('/onboarding/create', async (req, res) => {
    try {
        const result = await platform.createCustomerOnboarding(req.body);
        res.json(result);
    } catch (error) {
        logger.error('Error creating onboarding:', error);
        res.status(500).json({ error: 'Failed to create onboarding' });
    }
});

router.post('/onboarding/wizard/:wizardId/progress', async (req, res) => {
    try {
        const result = await platform.progressIntegrationWizard(
            req.params.wizardId,
            req.body
        );
        res.json(result);
    } catch (error) {
        logger.error('Error progressing wizard:', error);
        res.status(500).json({ error: 'Failed to progress wizard' });
    }
});

router.get('/customer/:customerId/health', async (req, res) => {
    try {
        const healthScore = await platform.calculateHealthScore(req.params.customerId);
        res.json(healthScore);
    } catch (error) {
        logger.error('Error calculating health score:', error);
        res.status(500).json({ error: 'Failed to calculate health score' });
    }
});

router.get('/customer/:customerId/expansion-opportunities', async (req, res) => {
    try {
        const opportunities = await platform.identifyExpansionOpportunities(
            req.params.customerId
        );
        res.json(opportunities);
    } catch (error) {
        logger.error('Error identifying expansion:', error);
        res.status(500).json({ error: 'Failed to identify expansion opportunities' });
    }
});

router.post('/customer/:customerId/ebr/generate', async (req, res) => {
    try {
        const ebr = await platform.generateExecutiveBusinessReview(
            req.params.customerId,
            req.body.period || 'quarterly'
        );
        res.json(ebr);
    } catch (error) {
        logger.error('Error generating EBR:', error);
        res.status(500).json({ error: 'Failed to generate EBR' });
    }
});

router.get('/metrics/retention', async (req, res) => {
    try {
        const metrics = await platform.calculateRetentionMetrics();
        res.json(metrics);
    } catch (error) {
        logger.error('Error calculating retention metrics:', error);
        res.status(500).json({ error: 'Failed to calculate retention metrics' });
    }
});

module.exports = router;