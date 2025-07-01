/**
 * ROOTUIP Chaos Engineering Framework
 * Controlled failure injection and resilience testing
 */

const EventEmitter = require('events');

class ChaosFramework extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = config;
        
        // Chaos experiments catalog
        this.experiments = {
            network: {
                latency: {
                    name: 'Network Latency Injection',
                    description: 'Add latency to network calls',
                    params: {
                        delay: { min: 100, max: 5000, unit: 'ms' },
                        jitter: { min: 0, max: 100, unit: 'ms' },
                        targets: ['api', 'database', 'cache']
                    }
                },
                packetLoss: {
                    name: 'Packet Loss Simulation',
                    description: 'Simulate packet loss in network',
                    params: {
                        lossRate: { min: 1, max: 50, unit: '%' },
                        targets: ['api', 'integration']
                    }
                },
                partition: {
                    name: 'Network Partition',
                    description: 'Simulate network partition between services',
                    params: {
                        duration: { min: 30, max: 300, unit: 's' },
                        services: ['api-database', 'api-cache', 'ml-api']
                    }
                }
            },
            resource: {
                cpuStress: {
                    name: 'CPU Stress Test',
                    description: 'Consume CPU resources',
                    params: {
                        usage: { min: 50, max: 95, unit: '%' },
                        cores: { min: 1, max: 'all' },
                        duration: { min: 60, max: 600, unit: 's' }
                    }
                },
                memoryLeak: {
                    name: 'Memory Leak Simulation',
                    description: 'Gradually consume memory',
                    params: {
                        rate: { min: 10, max: 100, unit: 'MB/min' },
                        maxUsage: { min: 50, max: 90, unit: '%' }
                    }
                },
                diskFull: {
                    name: 'Disk Space Exhaustion',
                    description: 'Fill disk space',
                    params: {
                        fillRate: { min: 1, max: 10, unit: 'GB/min' },
                        target: { min: 80, max: 95, unit: '%' }
                    }
                }
            },
            application: {
                serviceFailure: {
                    name: 'Service Instance Failure',
                    description: 'Kill service instances',
                    params: {
                        instances: { min: 1, max: '50%' },
                        service: ['api', 'worker', 'ml-pipeline']
                    }
                },
                dependencyFailure: {
                    name: 'Dependency Failure',
                    description: 'Simulate external dependency failure',
                    params: {
                        dependency: ['payment-gateway', 'shipping-api', 'weather-service'],
                        failureRate: { min: 10, max: 100, unit: '%' }
                    }
                },
                slowEndpoints: {
                    name: 'Slow API Endpoints',
                    description: 'Make specific endpoints slow',
                    params: {
                        endpoints: ['/api/track', '/api/predict', '/api/report'],
                        delay: { min: 1000, max: 30000, unit: 'ms' }
                    }
                }
            },
            data: {
                corruption: {
                    name: 'Data Corruption',
                    description: 'Introduce data inconsistencies',
                    params: {
                        corruptionRate: { min: 0.1, max: 5, unit: '%' },
                        targets: ['cache', 'message-queue']
                    }
                },
                replicationLag: {
                    name: 'Database Replication Lag',
                    description: 'Simulate replication delays',
                    params: {
                        lag: { min: 1, max: 60, unit: 's' },
                        databases: ['primary-replica', 'cross-region']
                    }
                }
            }
        };
        
        // Safety controls
        this.safetyControls = {
            blast_radius: {
                max_affected_instances: 0.5, // Maximum 50% of instances
                excluded_services: ['payment', 'authentication'], // Critical services
                excluded_environments: ['production'] // Only in staging by default
            },
            duration_limits: {
                max_experiment_duration: 3600000, // 1 hour
                auto_rollback_timeout: 600000 // 10 minutes
            },
            monitoring: {
                abort_on_slo_breach: true,
                abort_on_error_rate: 10, // Abort if error rate > 10%
                abort_on_customer_impact: true
            }
        };
        
        // Active experiments
        this.activeExperiments = new Map();
        
        // Experiment history
        this.experimentHistory = [];
        
        this.initialize();
    }
    
    async initialize() {
        console.log('Chaos Engineering Framework initialized');
    }
    
    // Plan chaos experiment
    async planExperiment(config) {
        const plan = {
            id: `chaos-${Date.now()}`,
            name: config.name,
            description: config.description,
            hypothesis: config.hypothesis,
            steadyState: config.steadyState,
            chaos: config.chaos,
            rollback: config.rollback || 'automatic',
            schedule: config.schedule || 'immediate',
            blast_radius: this.calculateBlastRadius(config.chaos),
            safety_checks: await this.performSafetyChecks(config),
            created_at: new Date()
        };
        
        // Validate experiment
        const validation = this.validateExperiment(plan);
        if (!validation.valid) {
            throw new Error(`Invalid experiment: ${validation.errors.join(', ')}`);
        }
        
        return plan;
    }
    
    // Execute chaos experiment
    async executeExperiment(plan) {
        console.log(`Executing chaos experiment: ${plan.name}`);
        
        const execution = {
            plan,
            startTime: new Date(),
            status: 'running',
            observations: [],
            metrics: {
                baseline: {},
                during: [],
                after: {}
            },
            result: null
        };
        
        this.activeExperiments.set(plan.id, execution);
        
        try {
            // Phase 1: Verify steady state
            execution.observations.push({
                phase: 'steady-state-verification',
                timestamp: new Date()
            });
            
            const steadyState = await this.verifySteadyState(plan.steadyState);
            if (!steadyState.verified) {
                throw new Error('System not in steady state: ' + steadyState.reason);
            }
            
            execution.metrics.baseline = steadyState.metrics;
            execution.observations.push({
                phase: 'steady-state-verified',
                metrics: steadyState.metrics
            });
            
            // Phase 2: Inject chaos
            execution.observations.push({
                phase: 'chaos-injection',
                timestamp: new Date()
            });
            
            const chaosInjection = await this.injectChaos(plan.chaos);
            execution.chaosInjection = chaosInjection;
            
            // Phase 3: Monitor and collect metrics
            execution.observations.push({
                phase: 'monitoring',
                timestamp: new Date()
            });
            
            const monitoringResult = await this.monitorExperiment(execution, plan);
            execution.metrics.during = monitoringResult.metrics;
            
            // Phase 4: Verify hypothesis
            execution.observations.push({
                phase: 'hypothesis-verification',
                timestamp: new Date()
            });
            
            const hypothesisResult = await this.verifyHypothesis(plan.hypothesis, execution.metrics);
            
            execution.result = {
                hypothesis_verified: hypothesisResult.verified,
                findings: hypothesisResult.findings,
                resilience_score: hypothesisResult.resilienceScore
            };
            
        } catch (error) {
            console.error('Experiment failed:', error);
            execution.status = 'failed';
            execution.error = error.message;
            
            // Emergency rollback
            await this.emergencyRollback(execution);
            
        } finally {
            // Phase 5: Rollback chaos
            execution.observations.push({
                phase: 'rollback',
                timestamp: new Date()
            });
            
            await this.rollbackChaos(execution);
            
            // Phase 6: Verify recovery
            execution.observations.push({
                phase: 'recovery-verification',
                timestamp: new Date()
            });
            
            const recoveryState = await this.verifySteadyState(plan.steadyState);
            execution.metrics.after = recoveryState.metrics;
            
            execution.endTime = new Date();
            execution.duration = execution.endTime - execution.startTime;
            execution.status = execution.status === 'failed' ? 'failed' : 'completed';
            
            // Archive experiment
            this.activeExperiments.delete(plan.id);
            this.experimentHistory.push(execution);
            
            // Generate report
            const report = await this.generateExperimentReport(execution);
            
            this.emit('chaos:experiment-completed', { execution, report });
        }
        
        return execution;
    }
    
    // Inject chaos based on type
    async injectChaos(chaosConfig) {
        const { type, params } = chaosConfig;
        const [category, experiment] = type.split('.');
        
        const experimentDef = this.experiments[category]?.[experiment];
        if (!experimentDef) {
            throw new Error(`Unknown chaos type: ${type}`);
        }
        
        console.log(`Injecting chaos: ${experimentDef.name}`);
        
        const injection = {
            type,
            params,
            startTime: new Date(),
            affectedResources: []
        };
        
        switch (category) {
            case 'network':
                injection.result = await this.injectNetworkChaos(experiment, params);
                break;
                
            case 'resource':
                injection.result = await this.injectResourceChaos(experiment, params);
                break;
                
            case 'application':
                injection.result = await this.injectApplicationChaos(experiment, params);
                break;
                
            case 'data':
                injection.result = await this.injectDataChaos(experiment, params);
                break;
        }
        
        return injection;
    }
    
    // Network chaos injections
    async injectNetworkChaos(type, params) {
        switch (type) {
            case 'latency':
                return await this.addNetworkLatency(params);
                
            case 'packetLoss':
                return await this.simulatePacketLoss(params);
                
            case 'partition':
                return await this.createNetworkPartition(params);
        }
    }
    
    async addNetworkLatency(params) {
        const { target, delay, jitter } = params;
        
        // Simulate adding network latency
        console.log(`Adding ${delay}ms latency (±${jitter}ms) to ${target}`);
        
        // In production, this would use tc (traffic control) or similar
        const command = `tc qdisc add dev eth0 root netem delay ${delay}ms ${jitter}ms`;
        
        return {
            success: true,
            command,
            affected: [target]
        };
    }
    
    async simulatePacketLoss(params) {
        const { target, lossRate } = params;
        
        console.log(`Simulating ${lossRate}% packet loss on ${target}`);
        
        const command = `tc qdisc add dev eth0 root netem loss ${lossRate}%`;
        
        return {
            success: true,
            command,
            affected: [target]
        };
    }
    
    async createNetworkPartition(params) {
        const { services, duration } = params;
        
        console.log(`Creating network partition between ${services} for ${duration}s`);
        
        // Simulate network partition using iptables
        const commands = services.map(service => 
            `iptables -A INPUT -s ${service} -j DROP`
        );
        
        return {
            success: true,
            commands,
            affected: services
        };
    }
    
    // Resource chaos injections
    async injectResourceChaos(type, params) {
        switch (type) {
            case 'cpuStress':
                return await this.stressCPU(params);
                
            case 'memoryLeak':
                return await this.simulateMemoryLeak(params);
                
            case 'diskFull':
                return await this.fillDisk(params);
        }
    }
    
    async stressCPU(params) {
        const { usage, cores, duration } = params;
        
        console.log(`Stressing CPU: ${usage}% on ${cores} cores for ${duration}s`);
        
        // Use stress-ng or similar tool
        const command = `stress-ng --cpu ${cores} --cpu-load ${usage} --timeout ${duration}s`;
        
        return {
            success: true,
            command,
            processId: Math.floor(Math.random() * 10000)
        };
    }
    
    async simulateMemoryLeak(params) {
        const { rate, maxUsage } = params;
        
        console.log(`Simulating memory leak: ${rate}MB/min up to ${maxUsage}%`);
        
        // Custom memory leak simulation
        const leakProcess = {
            pid: Math.floor(Math.random() * 10000),
            rate,
            maxUsage
        };
        
        return {
            success: true,
            process: leakProcess
        };
    }
    
    async fillDisk(params) {
        const { fillRate, target } = params;
        
        console.log(`Filling disk at ${fillRate}GB/min to ${target}%`);
        
        // Use dd or fallocate
        const command = `dd if=/dev/zero of=/tmp/chaos-disk bs=1G count=${fillRate}`;
        
        return {
            success: true,
            command
        };
    }
    
    // Application chaos injections
    async injectApplicationChaos(type, params) {
        switch (type) {
            case 'serviceFailure':
                return await this.killServiceInstances(params);
                
            case 'dependencyFailure':
                return await this.failDependency(params);
                
            case 'slowEndpoints':
                return await this.slowDownEndpoints(params);
        }
    }
    
    async killServiceInstances(params) {
        const { service, instances } = params;
        
        console.log(`Killing ${instances} instances of ${service}`);
        
        // Simulate killing instances
        const killed = [];
        const instanceCount = typeof instances === 'string' ? 
            Math.floor(parseInt(instances) * 0.01 * 10) : instances;
        
        for (let i = 0; i < instanceCount; i++) {
            killed.push(`${service}-${i}`);
        }
        
        return {
            success: true,
            killed
        };
    }
    
    async failDependency(params) {
        const { dependency, failureRate } = params;
        
        console.log(`Failing ${dependency} at ${failureRate}% rate`);
        
        // Configure proxy or service mesh to fail requests
        return {
            success: true,
            dependency,
            failureRate
        };
    }
    
    async slowDownEndpoints(params) {
        const { endpoints, delay } = params;
        
        console.log(`Slowing down endpoints by ${delay}ms:`, endpoints);
        
        // Configure middleware or proxy to add delay
        return {
            success: true,
            endpoints,
            delay
        };
    }
    
    // Monitor experiment
    async monitorExperiment(execution, plan) {
        const duration = plan.chaos.duration || 300000; // Default 5 minutes
        const interval = 10000; // Collect metrics every 10 seconds
        const metrics = [];
        const abortChecks = [];
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < duration) {
            // Collect metrics
            const currentMetrics = await this.collectMetrics(plan.steadyState.metrics);
            metrics.push({
                timestamp: new Date(),
                values: currentMetrics
            });
            
            // Safety checks
            const safetyCheck = await this.performSafetyCheck(currentMetrics);
            if (!safetyCheck.safe) {
                console.warn('Safety check failed:', safetyCheck.reason);
                abortChecks.push(safetyCheck);
                
                if (this.shouldAbortExperiment(safetyCheck)) {
                    throw new Error(`Experiment aborted: ${safetyCheck.reason}`);
                }
            }
            
            // Check if hypothesis already disproven
            if (await this.isHypothesisDisproven(plan.hypothesis, metrics)) {
                console.log('Hypothesis disproven early, ending experiment');
                break;
            }
            
            await this.sleep(interval);
        }
        
        return {
            metrics,
            abortChecks,
            duration: Date.now() - startTime
        };
    }
    
    // Verify steady state
    async verifySteadyState(criteria) {
        const metrics = await this.collectMetrics(criteria.metrics);
        
        const checks = [];
        for (const [metric, criterion] of Object.entries(criteria.metrics)) {
            const value = metrics[metric];
            const check = this.evaluateCriterion(value, criterion);
            checks.push({
                metric,
                value,
                criterion,
                passed: check
            });
        }
        
        const verified = checks.every(c => c.passed);
        
        return {
            verified,
            reason: verified ? null : 'Failed criteria: ' + 
                checks.filter(c => !c.passed).map(c => c.metric).join(', '),
            metrics,
            checks
        };
    }
    
    // Verify hypothesis
    async verifyHypothesis(hypothesis, metrics) {
        const { baseline, during, after } = metrics;
        
        // Calculate impact
        const impact = this.calculateImpact(baseline, during);
        
        // Evaluate hypothesis conditions
        const conditions = hypothesis.conditions || [];
        const results = conditions.map(condition => {
            return this.evaluateCondition(condition, impact);
        });
        
        const verified = results.every(r => r.met);
        
        // Calculate resilience score
        const resilienceScore = this.calculateResilienceScore(impact, after);
        
        return {
            verified,
            findings: this.generateFindings(impact, results),
            resilienceScore,
            impact,
            conditionResults: results
        };
    }
    
    // Safety and validation
    validateExperiment(plan) {
        const errors = [];
        
        // Check blast radius
        if (plan.blast_radius.percentage > this.safetyControls.blast_radius.max_affected_instances) {
            errors.push(`Blast radius too large: ${plan.blast_radius.percentage * 100}%`);
        }
        
        // Check excluded services
        const affectedServices = plan.blast_radius.services || [];
        const excludedServices = this.safetyControls.blast_radius.excluded_services;
        const forbidden = affectedServices.filter(s => excludedServices.includes(s));
        
        if (forbidden.length > 0) {
            errors.push(`Cannot target excluded services: ${forbidden.join(', ')}`);
        }
        
        // Check duration
        const duration = plan.chaos.duration || 0;
        if (duration > this.safetyControls.duration_limits.max_experiment_duration) {
            errors.push(`Duration too long: ${duration}ms`);
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    async performSafetyChecks(config) {
        const checks = [];
        
        // Check current system state
        const systemHealth = await this.checkSystemHealth();
        checks.push({
            name: 'system-health',
            passed: systemHealth.healthy,
            details: systemHealth
        });
        
        // Check for ongoing incidents
        const incidents = await this.checkForIncidents();
        checks.push({
            name: 'no-active-incidents',
            passed: incidents.length === 0,
            details: incidents
        });
        
        // Check deployment status
        const deployments = await this.checkDeploymentStatus();
        checks.push({
            name: 'no-active-deployments',
            passed: deployments.active.length === 0,
            details: deployments
        });
        
        return checks;
    }
    
    async performSafetyCheck(metrics) {
        const { abort_on_slo_breach, abort_on_error_rate, abort_on_customer_impact } = 
            this.safetyControls.monitoring;
        
        // Check SLO breach
        if (abort_on_slo_breach && metrics.availability < 99.9) {
            return {
                safe: false,
                reason: 'SLO breach detected',
                metric: 'availability',
                value: metrics.availability
            };
        }
        
        // Check error rate
        if (metrics.errorRate > abort_on_error_rate) {
            return {
                safe: false,
                reason: 'High error rate',
                metric: 'errorRate',
                value: metrics.errorRate
            };
        }
        
        // Check customer impact
        if (abort_on_customer_impact && metrics.customerImpact > 0) {
            return {
                safe: false,
                reason: 'Customer impact detected',
                metric: 'customerImpact',
                value: metrics.customerImpact
            };
        }
        
        return { safe: true };
    }
    
    shouldAbortExperiment(safetyCheck) {
        // Abort on critical safety violations
        const criticalReasons = ['SLO breach detected', 'Customer impact detected'];
        return criticalReasons.includes(safetyCheck.reason);
    }
    
    // Rollback chaos
    async rollbackChaos(execution) {
        if (!execution.chaosInjection) return;
        
        console.log('Rolling back chaos injection');
        
        const { type, result } = execution.chaosInjection;
        const [category] = type.split('.');
        
        switch (category) {
            case 'network':
                await this.rollbackNetworkChaos(result);
                break;
                
            case 'resource':
                await this.rollbackResourceChaos(result);
                break;
                
            case 'application':
                await this.rollbackApplicationChaos(result);
                break;
                
            case 'data':
                await this.rollbackDataChaos(result);
                break;
        }
    }
    
    async rollbackNetworkChaos(injection) {
        // Remove network modifications
        console.log('Removing network chaos modifications');
        
        if (injection.command) {
            // Remove tc rules
            const rollbackCommand = injection.command.replace('add', 'del');
            console.log(`Executing: ${rollbackCommand}`);
        }
        
        if (injection.commands) {
            // Remove iptables rules
            for (const cmd of injection.commands) {
                const rollbackCmd = cmd.replace('-A', '-D');
                console.log(`Executing: ${rollbackCmd}`);
            }
        }
    }
    
    async rollbackResourceChaos(injection) {
        // Stop resource consumption
        console.log('Stopping resource chaos processes');
        
        if (injection.processId) {
            console.log(`Killing process ${injection.processId}`);
        }
        
        if (injection.process) {
            console.log(`Stopping memory leak process ${injection.process.pid}`);
        }
    }
    
    async rollbackApplicationChaos(injection) {
        // Restore application state
        console.log('Restoring application state');
        
        if (injection.killed) {
            // Restart killed instances
            for (const instance of injection.killed) {
                console.log(`Restarting ${instance}`);
            }
        }
        
        if (injection.dependency) {
            // Restore dependency
            console.log(`Restoring ${injection.dependency}`);
        }
        
        if (injection.endpoints) {
            // Remove endpoint delays
            console.log('Removing endpoint delays');
        }
    }
    
    async rollbackDataChaos(injection) {
        // Fix data issues
        console.log('Rolling back data chaos');
    }
    
    async emergencyRollback(execution) {
        console.error('EMERGENCY ROLLBACK INITIATED');
        
        try {
            await this.rollbackChaos(execution);
            
            // Additional emergency actions
            await this.notifyOncall('Chaos experiment emergency rollback', execution);
            
        } catch (error) {
            console.error('Emergency rollback failed:', error);
            // Last resort actions
        }
    }
    
    // Reporting
    async generateExperimentReport(execution) {
        const report = {
            experiment: {
                id: execution.plan.id,
                name: execution.plan.name,
                hypothesis: execution.plan.hypothesis,
                duration: execution.duration,
                status: execution.status
            },
            timeline: execution.observations,
            metrics: {
                baseline: execution.metrics.baseline,
                impact: this.calculateImpact(
                    execution.metrics.baseline, 
                    execution.metrics.during
                ),
                recovery: this.calculateRecovery(
                    execution.metrics.baseline,
                    execution.metrics.after
                )
            },
            result: execution.result,
            learnings: this.extractLearnings(execution),
            recommendations: this.generateRecommendations(execution)
        };
        
        return report;
    }
    
    extractLearnings(execution) {
        const learnings = [];
        
        if (execution.result?.hypothesis_verified) {
            learnings.push('System demonstrated resilience to ' + execution.plan.chaos.type);
        } else {
            learnings.push('System vulnerability identified: ' + execution.plan.chaos.type);
        }
        
        // Analyze metrics for insights
        const impact = this.calculateImpact(
            execution.metrics.baseline,
            execution.metrics.during
        );
        
        if (impact.availability.degradation > 1) {
            learnings.push(`Availability degraded by ${impact.availability.degradation.toFixed(2)}%`);
        }
        
        if (impact.latency.increase > 50) {
            learnings.push(`Latency increased by ${impact.latency.increase.toFixed(0)}%`);
        }
        
        return learnings;
    }
    
    generateRecommendations(execution) {
        const recommendations = [];
        
        if (!execution.result?.hypothesis_verified) {
            recommendations.push({
                priority: 'high',
                category: 'resilience',
                action: 'Implement proper failover for ' + execution.plan.chaos.type
            });
        }
        
        const recovery = this.calculateRecovery(
            execution.metrics.baseline,
            execution.metrics.after
        );
        
        if (recovery.time > 300000) { // More than 5 minutes
            recommendations.push({
                priority: 'medium',
                category: 'recovery',
                action: 'Improve recovery time (current: ' + 
                    Math.floor(recovery.time / 60000) + ' minutes)'
            });
        }
        
        return recommendations;
    }
    
    // Helper methods
    calculateBlastRadius(chaos) {
        // Calculate potential impact scope
        const affectedServices = chaos.targets || [];
        const percentage = chaos.percentage || 0.1;
        
        return {
            services: affectedServices,
            percentage,
            risk: percentage > 0.3 ? 'high' : percentage > 0.1 ? 'medium' : 'low'
        };
    }
    
    async collectMetrics(metricDefs) {
        // Simulate metric collection
        return {
            availability: 99.9 + Math.random() * 0.1,
            latency: 100 + Math.random() * 50,
            errorRate: Math.random() * 2,
            throughput: 1000 + Math.random() * 200,
            customerImpact: 0
        };
    }
    
    evaluateCriterion(value, criterion) {
        if (criterion.min !== undefined && value < criterion.min) return false;
        if (criterion.max !== undefined && value > criterion.max) return false;
        if (criterion.equals !== undefined && value !== criterion.equals) return false;
        return true;
    }
    
    evaluateCondition(condition, impact) {
        // Evaluate hypothesis condition against impact
        const { metric, operator, value } = condition;
        const actual = impact[metric]?.value || 0;
        
        let met = false;
        switch (operator) {
            case '<':
                met = actual < value;
                break;
            case '>':
                met = actual > value;
                break;
            case '<=':
                met = actual <= value;
                break;
            case '>=':
                met = actual >= value;
                break;
            case '==':
                met = actual === value;
                break;
        }
        
        return { condition, actual, met };
    }
    
    calculateImpact(baseline, during) {
        const impact = {};
        
        // Calculate average metrics during chaos
        const avgDuring = this.averageMetrics(during);
        
        for (const [metric, baseValue] of Object.entries(baseline)) {
            const duringValue = avgDuring[metric] || baseValue;
            
            impact[metric] = {
                baseline: baseValue,
                during: duringValue,
                change: duringValue - baseValue,
                percentChange: ((duringValue - baseValue) / baseValue) * 100
            };
        }
        
        // Special calculations
        impact.availability = {
            ...impact.availability,
            degradation: Math.max(0, baseline.availability - avgDuring.availability)
        };
        
        impact.latency = {
            ...impact.latency,
            increase: Math.max(0, ((avgDuring.latency - baseline.latency) / baseline.latency) * 100)
        };
        
        return impact;
    }
    
    calculateRecovery(baseline, after) {
        const recovery = {
            time: null,
            complete: true,
            metrics: {}
        };
        
        for (const [metric, baseValue] of Object.entries(baseline)) {
            const afterValue = after[metric] || baseValue;
            const diff = Math.abs(afterValue - baseValue);
            const threshold = baseValue * 0.05; // 5% threshold
            
            recovery.metrics[metric] = {
                recovered: diff <= threshold,
                value: afterValue,
                baseline: baseValue,
                difference: diff
            };
            
            if (diff > threshold) {
                recovery.complete = false;
            }
        }
        
        return recovery;
    }
    
    calculateResilienceScore(impact, after) {
        let score = 100;
        
        // Deduct points for impact
        if (impact.availability?.degradation > 0) {
            score -= impact.availability.degradation * 10;
        }
        
        if (impact.latency?.increase > 0) {
            score -= Math.min(impact.latency.increase, 20);
        }
        
        if (impact.errorRate?.percentChange > 0) {
            score -= Math.min(impact.errorRate.percentChange, 20);
        }
        
        // Bonus for quick recovery
        const recoveryMetrics = Object.values(after).filter(m => m.recovered);
        const recoveryRate = recoveryMetrics.length / Object.keys(after).length;
        score += recoveryRate * 10;
        
        return Math.max(0, Math.min(100, score));
    }
    
    generateFindings(impact, conditionResults) {
        const findings = [];
        
        // Impact findings
        for (const [metric, data] of Object.entries(impact)) {
            if (Math.abs(data.percentChange) > 10) {
                findings.push(`${metric} changed by ${data.percentChange.toFixed(1)}% during chaos`);
            }
        }
        
        // Condition findings
        for (const result of conditionResults) {
            if (!result.met) {
                findings.push(`Condition not met: ${JSON.stringify(result.condition)}`);
            }
        }
        
        return findings;
    }
    
    averageMetrics(metricsArray) {
        if (metricsArray.length === 0) return {};
        
        const sums = {};
        
        for (const entry of metricsArray) {
            for (const [metric, value] of Object.entries(entry.values)) {
                sums[metric] = (sums[metric] || 0) + value;
            }
        }
        
        const avg = {};
        for (const [metric, sum] of Object.entries(sums)) {
            avg[metric] = sum / metricsArray.length;
        }
        
        return avg;
    }
    
    async isHypothesisDisproven(hypothesis, metrics) {
        // Early termination if hypothesis clearly disproven
        return false; // Simplified
    }
    
    async checkSystemHealth() {
        // Check overall system health
        return { healthy: true };
    }
    
    async checkForIncidents() {
        // Check for active incidents
        return [];
    }
    
    async checkDeploymentStatus() {
        // Check for ongoing deployments
        return { active: [] };
    }
    
    async notifyOncall(message, data) {
        console.error('NOTIFY ONCALL:', message);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ChaosFramework;