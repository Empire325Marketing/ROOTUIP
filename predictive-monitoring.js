/**
 * ROOTUIP Predictive Monitoring System
 * ML-based anomaly detection, capacity planning, and proactive alerting
 */

const EventEmitter = require('events');
const crypto = require('crypto');

// Predictive Monitoring Manager
class PredictiveMonitoringManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            anomalyThreshold: config.anomalyThreshold || 0.8,
            predictionWindow: config.predictionWindow || 3600000, // 1 hour
            capacityThreshold: config.capacityThreshold || 0.85, // 85%
            modelUpdateInterval: config.modelUpdateInterval || 86400000, // 24 hours
            ...config
        };
        
        this.models = new Map();
        this.predictions = new Map();
        this.anomalies = new Map();
        this.capacityForecasts = new Map();
        this.historicalData = new Map();
        this.alerts = new Map();
        
        this.setupModels();
        this.startPredictiveMonitoring();
    }
    
    // Setup ML models for different prediction types
    setupModels() {
        // Response Time Prediction Model
        this.models.set('response_time', {
            id: 'response_time',
            type: 'time_series_forecasting',
            algorithm: 'exponential_smoothing',
            features: ['hour_of_day', 'day_of_week', 'historical_avg', 'recent_trend'],
            targetVariable: 'response_time',
            window: 168, // 7 days of hourly data
            accuracy: 0.85,
            lastTrained: new Date(),
            parameters: {
                alpha: 0.3, // level smoothing
                beta: 0.1,  // trend smoothing
                gamma: 0.2, // seasonal smoothing
                seasonalPeriod: 24 // daily seasonality
            }
        });
        
        // Error Rate Anomaly Detection Model
        this.models.set('error_rate_anomaly', {
            id: 'error_rate_anomaly',
            type: 'anomaly_detection',
            algorithm: 'isolation_forest',
            features: ['error_rate', 'request_volume', 'avg_response_time', 'cpu_usage', 'memory_usage'],
            threshold: 0.1, // 10% contamination
            accuracy: 0.92,
            lastTrained: new Date(),
            parameters: {
                nEstimators: 100,
                maxSamples: 256,
                contamination: 0.1
            }
        });
        
        // Capacity Prediction Model
        this.models.set('capacity_planning', {
            id: 'capacity_planning',
            type: 'regression',
            algorithm: 'linear_regression',
            features: ['request_volume', 'active_users', 'data_volume', 'time_of_day', 'seasonality'],
            targetVariable: 'resource_utilization',
            accuracy: 0.78,
            lastTrained: new Date(),
            parameters: {
                coefficients: [0.4, 0.3, 0.2, 0.1, 0.05],
                intercept: 0.1
            }
        });
        
        // Customer Churn Prediction Model
        this.models.set('churn_prediction', {
            id: 'churn_prediction',
            type: 'classification',
            algorithm: 'random_forest',
            features: [
                'usage_frequency', 'feature_adoption', 'support_tickets',
                'payment_issues', 'session_duration', 'last_login_days'
            ],
            targetVariable: 'churn_probability',
            accuracy: 0.88,
            lastTrained: new Date(),
            parameters: {
                nEstimators: 200,
                maxDepth: 10,
                minSamplesLeaf: 5
            }
        });
        
        // Performance Degradation Model
        this.models.set('performance_degradation', {
            id: 'performance_degradation',
            type: 'multivariate_anomaly',
            algorithm: 'autoencoder',
            features: [
                'response_time', 'throughput', 'error_rate', 'cpu_usage',
                'memory_usage', 'disk_io', 'network_io', 'queue_depth'
            ],
            threshold: 0.05, // reconstruction error threshold
            accuracy: 0.91,
            lastTrained: new Date(),
            parameters: {
                hiddenLayers: [64, 32, 16, 32, 64],
                epochs: 100,
                batchSize: 32
            }
        });
    }
    
    // Start predictive monitoring processes
    startPredictiveMonitoring() {
        // Continuous anomaly detection
        setInterval(async () => {
            await this.detectAnomalies();
        }, 60000); // Every minute
        
        // Capacity forecasting
        setInterval(async () => {
            await this.forecastCapacity();
        }, 300000); // Every 5 minutes
        
        // Performance predictions
        setInterval(async () => {
            await this.predictPerformance();
        }, 600000); // Every 10 minutes
        
        // Model retraining
        setInterval(async () => {
            await this.retrainModels();
        }, this.config.modelUpdateInterval);
        
        // Proactive alerting
        setInterval(async () => {
            await this.generateProactiveAlerts();
        }, 120000); // Every 2 minutes
    }
    
    // Real-time anomaly detection
    async detectAnomalies() {
        const currentTime = new Date();
        const timeWindow = 600000; // 10 minutes
        const startTime = new Date(currentTime.getTime() - timeWindow);
        
        // Collect recent metrics
        const metrics = await this.collectMetricsForAnomalyDetection(startTime, currentTime);
        
        // Run anomaly detection for each service
        for (const [serviceId, serviceMetrics] of Object.entries(metrics)) {
            const anomalies = await this.detectServiceAnomalies(serviceId, serviceMetrics);
            
            if (anomalies.length > 0) {
                for (const anomaly of anomalies) {
                    await this.recordAnomaly(anomaly);
                    this.emit('anomaly_detected', anomaly);
                }
            }
        }
    }
    
    async collectMetricsForAnomalyDetection(startTime, endTime) {
        // Simulate metric collection from various services
        const services = [
            'api-gateway', 'auth-service', 'container-service', 'location-service',
            'notification-service', 'billing-service', 'analytics-service'
        ];
        
        const metrics = {};
        
        for (const service of services) {
            metrics[service] = {
                timestamp: endTime,
                error_rate: Math.random() * 0.1, // 0-10%
                request_volume: Math.floor(Math.random() * 1000) + 100,
                avg_response_time: Math.random() * 2000 + 200,
                cpu_usage: Math.random() * 0.8 + 0.1, // 10-90%
                memory_usage: Math.random() * 0.7 + 0.2, // 20-90%
                disk_io: Math.random() * 100,
                network_io: Math.random() * 1000,
                queue_depth: Math.floor(Math.random() * 50)
            };
            
            // Introduce some anomalies occasionally
            if (Math.random() < 0.05) { // 5% chance
                metrics[service].error_rate = Math.random() * 0.3 + 0.1; // High error rate
                metrics[service].avg_response_time = Math.random() * 5000 + 3000; // High response time
            }
        }
        
        return metrics;
    }
    
    async detectServiceAnomalies(serviceId, metrics) {
        const anomalies = [];
        
        // Error Rate Anomaly Detection
        const errorRateAnomaly = await this.detectErrorRateAnomaly(serviceId, metrics);
        if (errorRateAnomaly) {
            anomalies.push(errorRateAnomaly);
        }
        
        // Performance Degradation Detection
        const performanceAnomaly = await this.detectPerformanceDegradation(serviceId, metrics);
        if (performanceAnomaly) {
            anomalies.push(performanceAnomaly);
        }
        
        // Resource Usage Anomaly Detection
        const resourceAnomaly = await this.detectResourceAnomaly(serviceId, metrics);
        if (resourceAnomaly) {
            anomalies.push(resourceAnomaly);
        }
        
        return anomalies;
    }
    
    async detectErrorRateAnomaly(serviceId, metrics) {
        const model = this.models.get('error_rate_anomaly');
        const historical = this.getHistoricalMetrics(serviceId, 'error_rate', 24); // Last 24 hours
        
        if (historical.length < 10) {
            return null; // Need more historical data
        }
        
        // Calculate statistical bounds
        const mean = this.calculateMean(historical);
        const stdDev = this.calculateStandardDeviation(historical, mean);
        const upperBound = mean + (3 * stdDev); // 3-sigma rule
        
        if (metrics.error_rate > upperBound && metrics.error_rate > 0.05) { // Above 5%
            return {
                id: this.generateAnomalyId(),
                type: 'error_rate_spike',
                service: serviceId,
                timestamp: new Date(),
                severity: this.calculateAnomalySeverity(metrics.error_rate, upperBound),
                details: {
                    current_value: metrics.error_rate,
                    expected_range: [0, upperBound],
                    deviation_score: (metrics.error_rate - mean) / stdDev,
                    confidence: Math.min(0.99, Math.abs((metrics.error_rate - mean) / stdDev) / 3)
                },
                metadata: {
                    model_used: model.id,
                    historical_mean: mean,
                    historical_stddev: stdDev
                }
            };
        }
        
        return null;
    }
    
    async detectPerformanceDegradation(serviceId, metrics) {
        const model = this.models.get('performance_degradation');
        const features = [
            metrics.avg_response_time, metrics.request_volume, metrics.error_rate,
            metrics.cpu_usage, metrics.memory_usage, metrics.disk_io,
            metrics.network_io, metrics.queue_depth
        ];
        
        // Simulate autoencoder reconstruction error
        const reconstructionError = this.calculateReconstructionError(features);
        
        if (reconstructionError > model.threshold) {
            return {
                id: this.generateAnomalyId(),
                type: 'performance_degradation',
                service: serviceId,
                timestamp: new Date(),
                severity: this.calculateDegradationSeverity(reconstructionError),
                details: {
                    reconstruction_error: reconstructionError,
                    threshold: model.threshold,
                    affected_metrics: this.identifyAffectedMetrics(features),
                    confidence: Math.min(0.95, reconstructionError / model.threshold)
                },
                metadata: {
                    model_used: model.id,
                    features_analyzed: model.features
                }
            };
        }
        
        return null;
    }
    
    async detectResourceAnomaly(serviceId, metrics) {
        const thresholds = {
            cpu_usage: 0.9,      // 90%
            memory_usage: 0.85,   // 85%
            disk_io: 95,         // 95 IOPS
            queue_depth: 40      // 40 items
        };
        
        const anomalies = [];
        
        for (const [metric, threshold] of Object.entries(thresholds)) {
            if (metrics[metric] > threshold) {
                anomalies.push({
                    metric,
                    current: metrics[metric],
                    threshold,
                    severity: metrics[metric] > threshold * 1.1 ? 'high' : 'medium'
                });
            }
        }
        
        if (anomalies.length > 0) {
            return {
                id: this.generateAnomalyId(),
                type: 'resource_exhaustion',
                service: serviceId,
                timestamp: new Date(),
                severity: anomalies.some(a => a.severity === 'high') ? 'high' : 'medium',
                details: {
                    resource_violations: anomalies,
                    risk_level: anomalies.length > 2 ? 'critical' : 'moderate'
                }
            };
        }
        
        return null;
    }
    
    // Capacity forecasting
    async forecastCapacity() {
        const forecast = {
            timestamp: new Date(),
            predictions: {},
            recommendations: []
        };
        
        // Forecast for each service
        const services = [
            'api-gateway', 'auth-service', 'container-service', 'billing-service'
        ];
        
        for (const service of services) {
            const capacityPrediction = await this.predictServiceCapacity(service);
            forecast.predictions[service] = capacityPrediction;
            
            if (capacityPrediction.predicted_utilization > this.config.capacityThreshold) {
                forecast.recommendations.push({
                    service,
                    action: 'scale_up',
                    urgency: capacityPrediction.predicted_utilization > 0.95 ? 'immediate' : 'planned',
                    details: capacityPrediction
                });
            }
        }
        
        this.capacityForecasts.set(forecast.timestamp.getTime(), forecast);
        this.emit('capacity_forecast_updated', forecast);
        
        return forecast;
    }
    
    async predictServiceCapacity(serviceId) {
        const model = this.models.get('capacity_planning');
        const currentTime = new Date();
        
        // Get historical usage patterns
        const historicalData = this.getHistoricalCapacityData(serviceId, 168); // 7 days
        
        // Extract features for prediction
        const features = this.extractCapacityFeatures(serviceId, currentTime);
        
        // Make prediction using linear regression
        const predictedUtilization = this.predictLinearRegression(model, features);
        
        // Calculate confidence intervals
        const confidence = this.calculatePredictionConfidence(historicalData, predictedUtilization);
        
        return {
            service: serviceId,
            current_utilization: features.current_utilization,
            predicted_utilization: predictedUtilization,
            prediction_window: '1_hour',
            confidence_interval: confidence,
            trend: this.calculateCapacityTrend(historicalData),
            factors: {
                request_volume_impact: features.request_volume * model.parameters.coefficients[0],
                time_of_day_impact: features.time_of_day * model.parameters.coefficients[3],
                seasonal_impact: features.seasonality * model.parameters.coefficients[4]
            }
        };
    }
    
    extractCapacityFeatures(serviceId, timestamp) {
        // Simulate feature extraction
        const hour = timestamp.getHours();
        const dayOfWeek = timestamp.getDay();
        
        return {
            request_volume: Math.random() * 1000 + 200,
            active_users: Math.floor(Math.random() * 500) + 50,
            data_volume: Math.random() * 1000,
            time_of_day: hour / 24,
            seasonality: Math.sin((hour / 24) * 2 * Math.PI),
            current_utilization: Math.random() * 0.6 + 0.2
        };
    }
    
    predictLinearRegression(model, features) {
        const coefficients = model.parameters.coefficients;
        const intercept = model.parameters.intercept;
        
        let prediction = intercept;
        prediction += features.request_volume * 0.0004 * coefficients[0]; // Normalize request volume
        prediction += features.active_users * 0.001 * coefficients[1];   // Normalize active users
        prediction += features.data_volume * 0.0001 * coefficients[2];   // Normalize data volume
        prediction += features.time_of_day * coefficients[3];
        prediction += features.seasonality * coefficients[4];
        
        return Math.max(0, Math.min(1, prediction)); // Constrain to 0-1 range
    }
    
    // Performance prediction
    async predictPerformance() {
        const prediction = {
            timestamp: new Date(),
            services: {},
            system_wide: {}
        };
        
        // Predict performance for each service
        for (const serviceId of ['api-gateway', 'container-service', 'billing-service']) {
            const servicePrediction = await this.predictServicePerformance(serviceId);
            prediction.services[serviceId] = servicePrediction;
        }
        
        // System-wide predictions
        prediction.system_wide = await this.predictSystemPerformance(prediction.services);
        
        this.predictions.set(prediction.timestamp.getTime(), prediction);
        this.emit('performance_predicted', prediction);
        
        return prediction;
    }
    
    async predictServicePerformance(serviceId) {
        const model = this.models.get('response_time');
        const currentTime = new Date();
        
        // Get recent performance data
        const historicalData = this.getHistoricalMetrics(serviceId, 'response_time', 168);
        
        // Apply exponential smoothing
        const prediction = this.exponentialSmoothing(historicalData, model.parameters);
        
        return {
            service: serviceId,
            predicted_response_time: prediction.forecast,
            confidence_interval: prediction.confidence,
            trend: prediction.trend,
            seasonality_factor: prediction.seasonality,
            prediction_horizon: '1_hour',
            model_accuracy: model.accuracy
        };
    }
    
    exponentialSmoothing(data, params) {
        if (data.length < 24) {
            return {
                forecast: data.length > 0 ? data[data.length - 1] : 500,
                confidence: [400, 600],
                trend: 'stable',
                seasonality: 1.0
            };
        }
        
        const { alpha, beta, gamma, seasonalPeriod } = params;
        
        // Simple exponential smoothing implementation
        let level = data[0];
        let trend = 0;
        let seasonal = Array(seasonalPeriod).fill(1);
        
        for (let i = 1; i < data.length; i++) {
            const prevLevel = level;
            level = alpha * (data[i] / seasonal[i % seasonalPeriod]) + (1 - alpha) * (level + trend);
            trend = beta * (level - prevLevel) + (1 - beta) * trend;
            seasonal[i % seasonalPeriod] = gamma * (data[i] / level) + (1 - gamma) * seasonal[i % seasonalPeriod];
        }
        
        // Make forecast
        const forecast = (level + trend) * seasonal[data.length % seasonalPeriod];
        const error = this.calculateMeanAbsoluteError(data.slice(-24), level);
        
        return {
            forecast: Math.max(0, forecast),
            confidence: [Math.max(0, forecast - 2 * error), forecast + 2 * error],
            trend: trend > 10 ? 'increasing' : trend < -10 ? 'decreasing' : 'stable',
            seasonality: seasonal[data.length % seasonalPeriod]
        };
    }
    
    // Proactive alerting
    async generateProactiveAlerts() {
        const alerts = [];
        
        // Check for predicted capacity issues
        const latestCapacityForecast = this.getLatestCapacityForecast();
        if (latestCapacityForecast) {
            for (const recommendation of latestCapacityForecast.recommendations) {
                if (recommendation.urgency === 'immediate') {
                    alerts.push({
                        id: this.generateAlertId(),
                        type: 'proactive_capacity',
                        severity: 'high',
                        title: `Immediate capacity scaling needed for ${recommendation.service}`,
                        description: `Predicted utilization will exceed 95% within the next hour`,
                        service: recommendation.service,
                        action_required: recommendation.action,
                        prediction: recommendation.details,
                        timestamp: new Date()
                    });
                }
            }
        }
        
        // Check for performance degradation predictions
        const latestPerformancePrediction = this.getLatestPerformancePrediction();
        if (latestPerformancePrediction) {
            for (const [serviceId, prediction] of Object.entries(latestPerformancePrediction.services)) {
                if (prediction.predicted_response_time > 3000 && prediction.trend === 'increasing') {
                    alerts.push({
                        id: this.generateAlertId(),
                        type: 'proactive_performance',
                        severity: 'medium',
                        title: `Performance degradation predicted for ${serviceId}`,
                        description: `Response time expected to reach ${Math.round(prediction.predicted_response_time)}ms`,
                        service: serviceId,
                        prediction: prediction,
                        timestamp: new Date()
                    });
                }
            }
        }
        
        // Check for churn risk
        const churnPredictions = await this.predictCustomerChurn();
        for (const churnRisk of churnPredictions.high_risk_customers) {
            alerts.push({
                id: this.generateAlertId(),
                type: 'proactive_churn',
                severity: 'medium',
                title: `High churn risk detected for customer ${churnRisk.customer_id}`,
                description: `Churn probability: ${Math.round(churnRisk.churn_probability * 100)}%`,
                customer_id: churnRisk.customer_id,
                risk_factors: churnRisk.risk_factors,
                timestamp: new Date()
            });
        }
        
        // Store and emit alerts
        for (const alert of alerts) {
            this.alerts.set(alert.id, alert);
            this.emit('proactive_alert', alert);
            
            console.log(`PROACTIVE ALERT [${alert.severity}]: ${alert.title}`);
        }
        
        return alerts;
    }
    
    async predictCustomerChurn() {
        // Simulate customer churn prediction
        const customers = this.generateMockCustomerData();
        const highRiskCustomers = [];
        
        for (const customer of customers) {
            const churnProbability = this.calculateChurnProbability(customer);
            
            if (churnProbability > 0.7) {
                highRiskCustomers.push({
                    customer_id: customer.id,
                    churn_probability: churnProbability,
                    risk_factors: this.identifyChurnRiskFactors(customer),
                    recommended_actions: this.generateChurnPreventionActions(customer)
                });
            }
        }
        
        return {
            prediction_date: new Date(),
            total_customers_analyzed: customers.length,
            high_risk_customers: highRiskCustomers,
            overall_churn_risk: highRiskCustomers.length / customers.length
        };
    }
    
    calculateChurnProbability(customer) {
        const model = this.models.get('churn_prediction');
        
        // Simple scoring based on risk factors
        let score = 0;
        
        // Usage frequency (higher = lower churn risk)
        score += (1 - customer.usage_frequency) * 0.3;
        
        // Feature adoption (lower = higher churn risk)
        score += (1 - customer.feature_adoption) * 0.25;
        
        // Support tickets (more tickets = higher risk)
        score += Math.min(customer.support_tickets / 10, 1) * 0.2;
        
        // Payment issues (any issues = higher risk)
        score += customer.payment_issues ? 0.15 : 0;
        
        // Last login (longer time = higher risk)
        score += Math.min(customer.last_login_days / 30, 1) * 0.1;
        
        return Math.min(1, score);
    }
    
    identifyChurnRiskFactors(customer) {
        const factors = [];
        
        if (customer.usage_frequency < 0.3) factors.push('low_usage');
        if (customer.feature_adoption < 0.4) factors.push('poor_feature_adoption');
        if (customer.support_tickets > 5) factors.push('high_support_burden');
        if (customer.payment_issues) factors.push('payment_problems');
        if (customer.last_login_days > 14) factors.push('inactive_user');
        if (customer.session_duration < 300) factors.push('short_sessions');
        
        return factors;
    }
    
    // Model retraining
    async retrainModels() {
        console.log('Starting model retraining process...');
        
        for (const [modelId, model] of this.models) {
            try {
                const retrainResult = await this.retrainModel(modelId);
                console.log(`Model ${modelId} retrained. New accuracy: ${retrainResult.accuracy}`);
                
                // Update model if accuracy improved
                if (retrainResult.accuracy > model.accuracy) {
                    model.accuracy = retrainResult.accuracy;
                    model.lastTrained = new Date();
                    model.parameters = retrainResult.parameters;
                }
                
            } catch (error) {
                console.error(`Failed to retrain model ${modelId}:`, error.message);
                
                this.emit('model_retrain_failed', {
                    modelId,
                    error: error.message,
                    timestamp: new Date()
                });
            }
        }
        
        this.emit('models_retrained', {
            timestamp: new Date(),
            models_updated: Array.from(this.models.keys())
        });
    }
    
    async retrainModel(modelId) {
        // Simulate model retraining with improved accuracy
        const currentModel = this.models.get(modelId);
        const improvement = (Math.random() - 0.5) * 0.1; // ±5% change
        const newAccuracy = Math.max(0.5, Math.min(0.99, currentModel.accuracy + improvement));
        
        // Simulate training time
        await this.sleep(Math.random() * 2000 + 1000);
        
        return {
            accuracy: newAccuracy,
            parameters: { ...currentModel.parameters } // Simulate parameter updates
        };
    }
    
    // Utility methods
    calculateMean(values) {
        return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    }
    
    calculateStandardDeviation(values, mean) {
        if (values.length < 2) return 0;
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }
    
    calculateMeanAbsoluteError(actual, predicted) {
        const errors = actual.map(val => Math.abs(val - predicted));
        return this.calculateMean(errors);
    }
    
    calculateReconstructionError(features) {
        // Simulate autoencoder reconstruction error
        const noise = features.map(() => (Math.random() - 0.5) * 0.1);
        const reconstructed = features.map((f, i) => f + noise[i]);
        
        let error = 0;
        for (let i = 0; i < features.length; i++) {
            error += Math.pow(features[i] - reconstructed[i], 2);
        }
        
        return Math.sqrt(error / features.length);
    }
    
    calculateAnomalySeverity(currentValue, expectedValue) {
        const ratio = currentValue / expectedValue;
        if (ratio > 3) return 'critical';
        if (ratio > 2) return 'high';
        if (ratio > 1.5) return 'medium';
        return 'low';
    }
    
    calculateDegradationSeverity(reconstructionError) {
        if (reconstructionError > 0.2) return 'critical';
        if (reconstructionError > 0.1) return 'high';
        if (reconstructionError > 0.05) return 'medium';
        return 'low';
    }
    
    identifyAffectedMetrics(features) {
        const metricNames = [
            'response_time', 'throughput', 'error_rate', 'cpu_usage',
            'memory_usage', 'disk_io', 'network_io', 'queue_depth'
        ];
        
        // Identify metrics that deviate most from normal
        return metricNames.filter((_, i) => features[i] > 0.7); // Simplified threshold
    }
    
    calculateCapacityTrend(historicalData) {
        if (historicalData.length < 10) return 'stable';
        
        const recent = historicalData.slice(-24);
        const older = historicalData.slice(-48, -24);
        
        const recentAvg = this.calculateMean(recent);
        const olderAvg = this.calculateMean(older);
        
        const change = (recentAvg - olderAvg) / olderAvg;
        
        if (change > 0.1) return 'increasing';
        if (change < -0.1) return 'decreasing';
        return 'stable';
    }
    
    calculatePredictionConfidence(historicalData, prediction) {
        const recent = historicalData.slice(-24);
        const stdDev = this.calculateStandardDeviation(recent, this.calculateMean(recent));
        
        return [
            Math.max(0, prediction - 2 * stdDev),
            prediction + 2 * stdDev
        ];
    }
    
    getHistoricalMetrics(serviceId, metricType, hours) {
        // Simulate historical metrics retrieval
        const data = [];
        for (let i = 0; i < hours; i++) {
            data.push(Math.random() * 1000 + 200 + Math.sin(i / 24 * 2 * Math.PI) * 100);
        }
        return data;
    }
    
    getHistoricalCapacityData(serviceId, hours) {
        // Simulate historical capacity data
        const data = [];
        for (let i = 0; i < hours; i++) {
            data.push(Math.random() * 0.6 + 0.2); // 20-80% utilization
        }
        return data;
    }
    
    getLatestCapacityForecast() {
        const timestamps = Array.from(this.capacityForecasts.keys()).sort();
        const latest = timestamps[timestamps.length - 1];
        return latest ? this.capacityForecasts.get(latest) : null;
    }
    
    getLatestPerformancePrediction() {
        const timestamps = Array.from(this.predictions.keys()).sort();
        const latest = timestamps[timestamps.length - 1];
        return latest ? this.predictions.get(latest) : null;
    }
    
    generateMockCustomerData() {
        const customers = [];
        for (let i = 0; i < 50; i++) {
            customers.push({
                id: `customer_${i}`,
                usage_frequency: Math.random(),
                feature_adoption: Math.random(),
                support_tickets: Math.floor(Math.random() * 15),
                payment_issues: Math.random() < 0.1,
                session_duration: Math.random() * 3600,
                last_login_days: Math.floor(Math.random() * 30)
            });
        }
        return customers;
    }
    
    generateChurnPreventionActions(customer) {
        const actions = [];
        const factors = this.identifyChurnRiskFactors(customer);
        
        if (factors.includes('low_usage')) {
            actions.push('Send re-engagement email campaign');
            actions.push('Offer personalized onboarding session');
        }
        
        if (factors.includes('poor_feature_adoption')) {
            actions.push('Provide feature training materials');
            actions.push('Schedule product demo call');
        }
        
        if (factors.includes('high_support_burden')) {
            actions.push('Escalate to customer success manager');
            actions.push('Provide additional documentation');
        }
        
        if (factors.includes('payment_problems')) {
            actions.push('Contact billing department');
            actions.push('Offer payment plan options');
        }
        
        return actions;
    }
    
    async recordAnomaly(anomaly) {
        this.anomalies.set(anomaly.id, anomaly);
        
        // Keep only recent anomalies (last 24 hours)
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        for (const [id, anom] of this.anomalies) {
            if (anom.timestamp < cutoffTime) {
                this.anomalies.delete(id);
            }
        }
    }
    
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    generateAnomalyId() {
        return `anomaly_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    }
    
    generateAlertId() {
        return `alert_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
}

module.exports = {
    PredictiveMonitoringManager
};