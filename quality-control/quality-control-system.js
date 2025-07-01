/**
 * ROOTUIP Quality Control System
 * Main integration point for all quality control components
 */

const EventEmitter = require('events');
const DataQualityFramework = require('./data-quality-framework');
const IntegrationQualityControl = require('./integration-quality-control');
const BusinessRuleValidation = require('./business-rule-validation');
const AutomatedCorrectionWorkflows = require('./automated-correction-workflows');

class QualityControlSystem extends EventEmitter {
    constructor() {
        super();
        
        // Initialize components
        this.dataQuality = new DataQualityFramework();
        this.integrationQC = new IntegrationQualityControl();
        this.businessRules = new BusinessRuleValidation();
        this.correctionWorkflows = new AutomatedCorrectionWorkflows(
            this.dataQuality,
            this.integrationQC,
            this.businessRules
        );
        
        // System metrics
        this.metrics = {
            startTime: new Date(),
            totalValidations: 0,
            totalCorrections: 0,
            systemHealth: 100,
            components: {
                dataQuality: { status: 'active', health: 100 },
                integrationQC: { status: 'active', health: 100 },
                businessRules: { status: 'active', health: 100 },
                correctionWorkflows: { status: 'active', health: 100 }
            }
        };
        
        // Setup event handlers
        this.setupEventHandlers();
        
        console.log('Quality Control System initialized');
    }
    
    // Setup event handlers
    setupEventHandlers() {
        // Data quality events
        this.dataQuality.on('validation:completed', (result) => {
            this.metrics.totalValidations++;
            this.handleValidationResult(result);
        });
        
        this.dataQuality.on('metrics:updated', (metrics) => {
            this.updateComponentHealth('dataQuality', metrics.overall.score);
        });
        
        // Integration QC events
        this.integrationQC.on('reconciliation:completed', (result) => {
            if (result.conflicts.length > 0) {
                this.handleDataConflicts(result);
            }
        });
        
        // Business rules events
        this.businessRules.on('validation:completed', (result) => {
            if (!result.valid) {
                this.handleBusinessViolations(result);
            }
        });
        
        // Correction workflow events
        this.correctionWorkflows.on('workflow:completed', (execution) => {
            this.metrics.totalCorrections += execution.corrections.length;
            this.emit('correction:completed', execution);
        });
        
        this.correctionWorkflows.on('approval:required', (approval) => {
            this.emit('approval:required', approval);
        });
    }
    
    // Comprehensive data validation
    async validateData(dataType, data, options = {}) {
        const validation = {
            timestamp: new Date(),
            dataType,
            results: {},
            overallValid: true,
            overallScore: 100,
            corrections: [],
            issues: []
        };
        
        try {
            // 1. Basic data quality validation
            validation.results.dataQuality = await this.dataQuality.validateData(
                dataType, 
                data, 
                { checkAnomalies: options.checkAnomalies !== false }
            );
            
            if (!validation.results.dataQuality.valid) {
                validation.overallValid = false;
                validation.issues.push(...validation.results.dataQuality.errors);
            }
            
            // 2. Business rule validation
            validation.results.businessRules = await this.businessRules.validateBusinessRules(
                data, 
                { 
                    category: options.category,
                    complianceProfiles: options.complianceProfiles 
                }
            );
            
            if (!validation.results.businessRules.valid) {
                validation.overallValid = false;
                validation.issues.push(...validation.results.businessRules.violations);
            }
            
            // 3. Integration-specific validation (if applicable)
            if (options.source) {
                validation.results.integration = await this.validateIntegrationData(
                    options.source, 
                    data, 
                    dataType
                );
                
                if (!validation.results.integration.valid) {
                    validation.overallValid = false;
                    validation.issues.push(...validation.results.integration.errors);
                }
            }
            
            // Calculate overall score
            const scores = [
                validation.results.dataQuality.score,
                validation.results.businessRules.score,
                validation.results.integration?.score || 100
            ];
            validation.overallScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
            
            // 4. Apply automated corrections if enabled
            if (options.autoCorrect && !validation.overallValid) {
                const corrections = await this.applyAutomaticCorrections(validation, data);
                validation.corrections = corrections;
                
                // Re-validate after corrections
                if (corrections.length > 0) {
                    const correctedData = corrections[corrections.length - 1].correctedData;
                    validation.afterCorrection = await this.validateData(
                        dataType, 
                        correctedData, 
                        { ...options, autoCorrect: false }
                    );
                }
            }
            
        } catch (error) {
            validation.error = error.message;
            validation.overallValid = false;
            validation.overallScore = 0;
        }
        
        // Emit validation event
        this.emit('validation:completed', validation);
        
        return validation;
    }
    
    // Validate integration-specific data
    async validateIntegrationData(source, data, dataType) {
        if (source.type === 'carrier_api') {
            return await this.integrationQC.validateCarrierData(
                source.carrierId, 
                data, 
                dataType
            );
        } else if (source.type === 'edi') {
            return await this.integrationQC.validateEDIMessage(
                source.messageType, 
                data
            );
        } else if (source.type === 'api_response') {
            return await this.integrationQC.validateAPIResponse(
                source.apiType, 
                data, 
                source.metadata
            );
        }
        
        return { valid: true, score: 100 };
    }
    
    // Apply automatic corrections
    async applyAutomaticCorrections(validation, originalData) {
        const corrections = [];
        
        // Determine which workflows to trigger
        const triggeredWorkflows = new Set();
        
        // Check data quality errors
        for (const error of validation.results.dataQuality.errors || []) {
            if (error.field === 'containerId' && error.rule === 'pattern') {
                triggeredWorkflows.add('container_number_correction');
            }
        }
        
        // Check business rule violations
        for (const violation of validation.results.businessRules.violations || []) {
            if (violation.ruleName === 'date_time_consistency') {
                triggeredWorkflows.add('datetime_correction');
            } else if (violation.ruleName === 'port_code_validation') {
                triggeredWorkflows.add('geographic_correction');
            }
        }
        
        // Execute workflows
        for (const workflowId of triggeredWorkflows) {
            const trigger = {
                source: 'validation',
                validation: validation
            };
            
            const execution = await this.correctionWorkflows.executeWorkflow(
                workflowId, 
                originalData, 
                trigger
            );
            
            if (execution.status === 'completed' && execution.corrections.length > 0) {
                corrections.push({
                    workflowId,
                    executionId: execution.id,
                    corrections: execution.corrections,
                    correctedData: execution.data
                });
            }
        }
        
        return corrections;
    }
    
    // Handle validation results
    handleValidationResult(result) {
        if (!result.valid || result.score < 90) {
            // Check if automatic correction is applicable
            const applicableWorkflows = this.findApplicableWorkflows(result);
            
            if (applicableWorkflows.length > 0 && result.score < 80) {
                // Trigger correction workflows for low-scoring data
                this.triggerCorrections(result, applicableWorkflows);
            }
        }
    }
    
    // Handle data conflicts
    async handleDataConflicts(reconciliation) {
        // Trigger reconciliation workflow
        const execution = await this.correctionWorkflows.executeWorkflow(
            'data_reconciliation',
            { reconciliation },
            { type: 'reconciliation_conflict', conflicts: reconciliation.conflicts }
        );
        
        this.emit('reconciliation:processed', {
            original: reconciliation,
            resolution: execution
        });
    }
    
    // Handle business violations
    async handleBusinessViolations(validation) {
        // Critical violations require immediate attention
        const criticalViolations = validation.violations.filter(v => v.severity === 'critical');
        
        if (criticalViolations.length > 0) {
            this.emit('critical:violation', {
                violations: criticalViolations,
                data: validation
            });
        }
        
        // Apply corrections for auto-correctable violations
        const correctableViolations = validation.corrections || [];
        if (correctableViolations.length > 0) {
            const corrected = await this.businessRules.applyCorrections(
                validation.data,
                correctableViolations
            );
            
            this.emit('correction:applied', corrected);
        }
    }
    
    // Find applicable workflows
    findApplicableWorkflows(validationResult) {
        const applicable = [];
        
        for (const [workflowId, workflow] of this.correctionWorkflows.workflows) {
            for (const trigger of workflow.triggers) {
                if (this.matchesTrigger(trigger, validationResult)) {
                    applicable.push(workflowId);
                    break;
                }
            }
        }
        
        return applicable;
    }
    
    // Check if validation matches workflow trigger
    matchesTrigger(trigger, validation) {
        if (trigger.type === 'validation_error') {
            return validation.errors.some(e => 
                e.field === trigger.field && 
                (!trigger.error || e.rule === trigger.error)
            );
        }
        
        return false;
    }
    
    // Trigger corrections
    async triggerCorrections(validation, workflowIds) {
        for (const workflowId of workflowIds) {
            await this.correctionWorkflows.executeWorkflow(
                workflowId,
                validation.data,
                { type: 'validation_failure', validation }
            );
        }
    }
    
    // Update component health
    updateComponentHealth(component, score) {
        this.metrics.components[component].health = score;
        
        // Calculate overall system health
        const healthScores = Object.values(this.metrics.components).map(c => c.health);
        this.metrics.systemHealth = healthScores.reduce((sum, h) => sum + h, 0) / healthScores.length;
        
        this.emit('health:updated', {
            component,
            health: score,
            systemHealth: this.metrics.systemHealth
        });
    }
    
    // Get system status
    getSystemStatus() {
        return {
            status: this.metrics.systemHealth > 90 ? 'healthy' : 
                    this.metrics.systemHealth > 70 ? 'degraded' : 'unhealthy',
            health: this.metrics.systemHealth,
            uptime: Date.now() - this.metrics.startTime.getTime(),
            metrics: {
                totalValidations: this.metrics.totalValidations,
                totalCorrections: this.metrics.totalCorrections,
                dataQualityScore: this.dataQuality.qualityMetrics.overall.score,
                pendingApprovals: this.correctionWorkflows.metrics.pendingApprovals
            },
            components: this.metrics.components
        };
    }
    
    // Generate comprehensive report
    async generateQualityReport(options = {}) {
        const report = {
            generatedAt: new Date(),
            period: options.period || '24h',
            systemStatus: this.getSystemStatus(),
            dataQuality: await this.dataQuality.generateQualityReport(options),
            businessCompliance: await this.businessRules.generateValidationReport(options),
            corrections: await this.correctionWorkflows.generateCorrectionReport(options),
            integrations: this.generateIntegrationReport()
        };
        
        // Add executive summary
        report.executiveSummary = this.generateExecutiveSummary(report);
        
        return report;
    }
    
    // Generate integration report
    generateIntegrationReport() {
        const report = {
            carriers: {},
            overallScore: 0
        };
        
        let totalScore = 0;
        let carrierCount = 0;
        
        for (const [carrierId, score] of this.integrationQC.integrationScores) {
            report.carriers[carrierId] = score;
            totalScore += score.overall;
            carrierCount++;
        }
        
        report.overallScore = carrierCount > 0 ? totalScore / carrierCount : 0;
        
        return report;
    }
    
    // Generate executive summary
    generateExecutiveSummary(report) {
        const summary = {
            highlights: [],
            concerns: [],
            recommendations: []
        };
        
        // System health
        if (report.systemStatus.health > 95) {
            summary.highlights.push('System operating at optimal performance');
        } else if (report.systemStatus.health < 80) {
            summary.concerns.push('System health below acceptable threshold');
        }
        
        // Data quality
        if (report.dataQuality.overall.score > 95) {
            summary.highlights.push(`Data quality excellent at ${report.dataQuality.overall.score.toFixed(1)}%`);
        } else if (report.dataQuality.overall.score < 85) {
            summary.concerns.push(`Data quality needs improvement: ${report.dataQuality.overall.score.toFixed(1)}%`);
        }
        
        // Corrections
        const correctionRate = report.corrections.summary.successfulCorrections / 
                              report.corrections.summary.totalExecutions * 100;
        
        if (correctionRate > 90) {
            summary.highlights.push(`Automated corrections successful: ${correctionRate.toFixed(1)}% success rate`);
        }
        
        // Recommendations
        if (report.dataQuality.recommendations) {
            summary.recommendations.push(...report.dataQuality.recommendations);
        }
        
        return summary;
    }
    
    // Process approval
    async processApproval(approvalId, decision, reviewer) {
        return await this.correctionWorkflows.processApproval(approvalId, decision, reviewer);
    }
    
    // Cleanup and shutdown
    async shutdown() {
        console.log('Shutting down Quality Control System...');
        
        // Save any pending data
        // Close connections
        // Clean up resources
        
        this.emit('shutdown');
    }
}

module.exports = QualityControlSystem;