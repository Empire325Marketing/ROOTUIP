// ROOTUIP Container Tracking - Main Container Tracker
// Real-time container tracking with predictions and analytics

const CarrierManager = require('../carrier-integrations/carrier-manager');
const WebhookHandler = require('../data-processing/webhook-handler');
const DataNormalizer = require('../data-processing/data-normalizer');
const DuplicateDetector = require('../data-processing/duplicate-detector');

class ContainerTracker {
    constructor(config) {
        this.config = config || {};
        this.carrierManager = new CarrierManager(config.carriers);
        this.webhookHandler = new WebhookHandler(config.webhooks);
        this.dataNormalizer = new DataNormalizer(config.normalization);
        this.duplicateDetector = new DuplicateDetector(config.duplication);
        
        // Tracking state
        this.activeTracking = new Map(); // containerNumber -> tracking info
        this.subscriptions = new Map(); // containerNumber -> subscription info
        this.predictions = new Map(); // containerNumber -> prediction data
        
        // Event listeners
        this.eventListeners = new Map();
        
        this.initializeTracking();
    }

    initializeTracking() {
        console.log('[ContainerTracker] Initializing container tracking system...');
        
        // Start webhook server
        this.webhookHandler.start(this.config.webhookPort || 3030);
        
        // Set up webhook event processing
        this.setupWebhookProcessing();
        
        // Start periodic tracking updates
        this.startPeriodicUpdates();
        
        console.log('[ContainerTracker] Container tracking system initialized');
    }

    setupWebhookProcessing() {
        // Register webhook event processor
        this.webhookHandler.registerProcessor('container_update', async (event) => {
            await this.processContainerUpdate(event);
        });
    }

    // Main tracking methods
    async trackContainer(containerNumber, options = {}) {
        try {
            const trackingId = this.generateTrackingId();
            
            console.log(`[ContainerTracker] Starting tracking for container ${containerNumber}`);
            
            // Get initial tracking data
            const trackingResult = await this.carrierManager.trackContainer(
                containerNumber, 
                options.preferredCarrier
            );

            if (!trackingResult.found) {
                throw new Error(`Container ${containerNumber} not found in any carrier system`);
            }

            // Use the best result (fastest response time)
            const bestResult = trackingResult.results[0];
            const carrierData = bestResult.data;

            // Normalize the data
            const normalizedData = await this.dataNormalizer.normalizeCarrierData(
                carrierData, 
                bestResult.carrier, 
                'tracking'
            );

            // Check for duplicates
            const duplicateCheck = await this.duplicateDetector.detectDuplicates(
                normalizedData.normalized
            );

            // Create tracking entry
            const trackingInfo = {
                id: trackingId,
                containerNumber: containerNumber,
                carrier: bestResult.carrier,
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                data: normalizedData.normalized,
                subscription: null,
                predictions: null,
                alerts: [],
                options: options
            };

            // Store tracking info
            this.activeTracking.set(containerNumber, trackingInfo);

            // Subscribe to real-time updates if requested
            if (options.realTimeUpdates !== false) {
                await this.subscribeToUpdates(containerNumber, bestResult.carrier);
            }

            // Generate predictions
            if (options.generatePredictions !== false) {
                trackingInfo.predictions = await this.generatePredictions(trackingInfo);
            }

            // Store in database
            await this.storeTrackingData(trackingInfo);

            // Trigger tracking started event
            this.emitEvent('tracking_started', {
                containerNumber,
                trackingId,
                carrier: bestResult.carrier,
                initialData: normalizedData.normalized
            });

            return {
                trackingId: trackingId,
                containerNumber: containerNumber,
                carrier: bestResult.carrier,
                status: normalizedData.normalized.status,
                location: normalizedData.normalized.location,
                vessel: normalizedData.normalized.vessel,
                estimatedArrival: normalizedData.normalized.estimatedArrival,
                predictions: trackingInfo.predictions,
                timeline: normalizedData.normalized.timeline,
                lastUpdated: normalizedData.normalized.lastUpdated,
                subscription: trackingInfo.subscription
            };

        } catch (error) {
            console.error(`[ContainerTracker] Failed to track container ${containerNumber}:`, error);
            throw error;
        }
    }

    async getTrackingStatus(containerNumber) {
        const trackingInfo = this.activeTracking.get(containerNumber);
        
        if (!trackingInfo) {
            // Try to get from database
            const dbTrackingInfo = await this.getTrackingFromDatabase(containerNumber);
            if (dbTrackingInfo) {
                this.activeTracking.set(containerNumber, dbTrackingInfo);
                return this.formatTrackingResponse(dbTrackingInfo);
            }
            
            throw new Error(`Container ${containerNumber} is not being tracked`);
        }

        return this.formatTrackingResponse(trackingInfo);
    }

    async refreshTrackingData(containerNumber, forceRefresh = false) {
        const trackingInfo = this.activeTracking.get(containerNumber);
        
        if (!trackingInfo) {
            throw new Error(`Container ${containerNumber} is not being tracked`);
        }

        // Check if refresh is needed
        const lastUpdate = new Date(trackingInfo.lastUpdated);
        const refreshInterval = this.config.refreshInterval || 1800000; // 30 minutes
        
        if (!forceRefresh && (Date.now() - lastUpdate.getTime()) < refreshInterval) {
            return this.formatTrackingResponse(trackingInfo);
        }

        try {
            // Get fresh data from carrier
            const freshData = await this.carrierManager.trackContainerWithCarrier(
                containerNumber, 
                trackingInfo.carrier
            );

            // Normalize fresh data
            const normalizedData = await this.dataNormalizer.normalizeCarrierData(
                freshData, 
                trackingInfo.carrier, 
                'tracking'
            );

            // Check for new events
            const newEvents = this.detectNewEvents(trackingInfo.data, normalizedData.normalized);
            
            if (newEvents.length > 0) {
                // Process new events
                for (const event of newEvents) {
                    await this.processNewEvent(containerNumber, event);
                }
                
                // Update predictions
                trackingInfo.predictions = await this.generatePredictions(trackingInfo);
            }

            // Update tracking info
            trackingInfo.data = normalizedData.normalized;
            trackingInfo.lastUpdated = new Date().toISOString();

            // Update in database
            await this.updateTrackingData(trackingInfo);

            // Emit update event
            this.emitEvent('tracking_updated', {
                containerNumber,
                trackingId: trackingInfo.id,
                newEvents: newEvents,
                updatedData: normalizedData.normalized
            });

            return this.formatTrackingResponse(trackingInfo);

        } catch (error) {
            console.error(`[ContainerTracker] Failed to refresh tracking data for ${containerNumber}:`, error);
            throw error;
        }
    }

    async subscribeToUpdates(containerNumber, carrier) {
        try {
            const webhookUrl = `${this.config.webhookBaseUrl}/webhooks/${carrier.toLowerCase()}`;
            
            const subscription = await this.carrierManager.subscribeToContainerUpdates(
                containerNumber,
                webhookUrl,
                carrier
            );

            const trackingInfo = this.activeTracking.get(containerNumber);
            if (trackingInfo) {
                trackingInfo.subscription = subscription;
                this.subscriptions.set(containerNumber, subscription);
            }

            console.log(`[ContainerTracker] Subscribed to updates for ${containerNumber} via ${carrier}`);
            
            return subscription;
        } catch (error) {
            console.warn(`[ContainerTracker] Failed to subscribe to updates for ${containerNumber}:`, error.message);
            return null;
        }
    }

    async stopTracking(containerNumber) {
        const trackingInfo = this.activeTracking.get(containerNumber);
        
        if (!trackingInfo) {
            throw new Error(`Container ${containerNumber} is not being tracked`);
        }

        try {
            // Unsubscribe from updates
            if (trackingInfo.subscription) {
                // This would call carrier API to unsubscribe
                console.log(`[ContainerTracker] Unsubscribing from updates for ${containerNumber}`);
            }

            // Mark as stopped in database
            await this.markTrackingAsStopped(containerNumber);

            // Remove from active tracking
            this.activeTracking.delete(containerNumber);
            this.subscriptions.delete(containerNumber);
            this.predictions.delete(containerNumber);

            // Emit stopped event
            this.emitEvent('tracking_stopped', {
                containerNumber,
                trackingId: trackingInfo.id,
                stoppedAt: new Date().toISOString()
            });

            console.log(`[ContainerTracker] Stopped tracking container ${containerNumber}`);
            
            return { success: true, message: 'Tracking stopped successfully' };

        } catch (error) {
            console.error(`[ContainerTracker] Failed to stop tracking ${containerNumber}:`, error);
            throw error;
        }
    }

    // Batch tracking methods
    async trackMultipleContainers(containerNumbers, options = {}) {
        const results = {
            timestamp: new Date().toISOString(),
            total: containerNumbers.length,
            successful: 0,
            failed: 0,
            containers: []
        };

        const batchSize = options.batchSize || 5;
        const concurrency = options.concurrency || 3;

        // Process in batches
        for (let i = 0; i < containerNumbers.length; i += batchSize) {
            const batch = containerNumbers.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (containerNumber) => {
                try {
                    const trackingResult = await this.trackContainer(containerNumber, options);
                    results.successful++;
                    return {
                        containerNumber,
                        status: 'success',
                        trackingId: trackingResult.trackingId,
                        carrier: trackingResult.carrier,
                        currentStatus: trackingResult.status,
                        location: trackingResult.location
                    };
                } catch (error) {
                    results.failed++;
                    return {
                        containerNumber,
                        status: 'failed',
                        error: error.message
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            results.containers.push(...batchResults);

            console.log(`[ContainerTracker] Processed batch ${Math.floor(i / batchSize) + 1}, ${results.successful + results.failed}/${results.total} complete`);

            // Small delay between batches
            if (i + batchSize < containerNumbers.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return results;
    }

    // Event processing
    async processContainerUpdate(event) {
        const containerNumber = event.data.containerNumber;
        const trackingInfo = this.activeTracking.get(containerNumber);

        if (!trackingInfo) {
            console.log(`[ContainerTracker] Received update for untracked container: ${containerNumber}`);
            return;
        }

        try {
            // Normalize webhook data
            const normalizedData = await this.dataNormalizer.normalizeCarrierData(
                event.rawData,
                event.carrier,
                'webhook'
            );

            // Check for duplicates
            const duplicateCheck = await this.duplicateDetector.detectDuplicates(
                normalizedData.normalized,
                trackingInfo.data.timeline || []
            );

            if (duplicateCheck.isDuplicate) {
                console.log(`[ContainerTracker] Duplicate event detected for ${containerNumber}, ignoring`);
                return;
            }

            // Process new event
            await this.processNewEvent(containerNumber, normalizedData.normalized);

            // Update tracking data
            trackingInfo.data = await this.mergeTrackingData(trackingInfo.data, normalizedData.normalized);
            trackingInfo.lastUpdated = new Date().toISOString();

            // Regenerate predictions
            trackingInfo.predictions = await this.generatePredictions(trackingInfo);

            // Update in database
            await this.updateTrackingData(trackingInfo);

            // Emit real-time update
            this.emitEvent('real_time_update', {
                containerNumber,
                carrier: event.carrier,
                event: normalizedData.normalized,
                predictions: trackingInfo.predictions
            });

            console.log(`[ContainerTracker] Processed real-time update for ${containerNumber}`);

        } catch (error) {
            console.error(`[ContainerTracker] Failed to process update for ${containerNumber}:`, error);
        }
    }

    async processNewEvent(containerNumber, eventData) {
        const trackingInfo = this.activeTracking.get(containerNumber);
        if (!trackingInfo) return;

        // Add to timeline
        if (!trackingInfo.data.timeline) {
            trackingInfo.data.timeline = [];
        }
        
        trackingInfo.data.timeline.push(eventData);
        trackingInfo.data.timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Update current status and location
        if (new Date(eventData.timestamp) > new Date(trackingInfo.data.lastUpdated || 0)) {
            trackingInfo.data.status = eventData.status;
            trackingInfo.data.location = eventData.location;
            trackingInfo.data.vessel = eventData.vessel || trackingInfo.data.vessel;
        }

        // Check for alerts
        const alerts = await this.checkForAlerts(trackingInfo, eventData);
        if (alerts.length > 0) {
            trackingInfo.alerts.push(...alerts);
            
            // Emit alert events
            for (const alert of alerts) {
                this.emitEvent('alert_triggered', {
                    containerNumber,
                    alert,
                    event: eventData
                });
            }
        }

        // Store event in database
        await this.storeContainerEvent(containerNumber, eventData);
    }

    // Prediction methods
    async generatePredictions(trackingInfo) {
        try {
            const predictions = {
                generatedAt: new Date().toISOString(),
                eta: await this.predictETA(trackingInfo),
                delays: await this.predictDelays(trackingInfo),
                demurrage: await this.calculateDemurrageRisk(trackingInfo),
                nextEvents: await this.predictNextEvents(trackingInfo)
            };

            // Cache predictions
            this.predictions.set(trackingInfo.containerNumber, predictions);

            return predictions;
        } catch (error) {
            console.error('Failed to generate predictions:', error);
            return null;
        }
    }

    async predictETA(trackingInfo) {
        const data = trackingInfo.data;
        
        // Base ETA from carrier
        let eta = data.estimatedArrival ? new Date(data.estimatedArrival) : null;
        
        if (!eta) {
            // Estimate based on typical transit times
            eta = this.estimateETAFromRoute(data);
        }

        // Adjust for historical performance
        const carrierPerformance = await this.getCarrierPerformance(trackingInfo.carrier);
        const delayFactor = carrierPerformance.avgDelayDays || 0;

        if (eta) {
            eta.setDate(eta.getDate() + delayFactor);
        }

        // Adjust for current delays
        const currentDelays = this.calculateCurrentDelays(data);
        if (eta && currentDelays > 0) {
            eta.setDate(eta.getDate() + currentDelays);
        }

        return {
            estimated: eta ? eta.toISOString() : null,
            confidence: this.calculateETAConfidence(data),
            adjustments: {
                carrierPerformance: delayFactor,
                currentDelays: currentDelays
            }
        };
    }

    async predictDelays(trackingInfo) {
        const data = trackingInfo.data;
        const delays = [];

        // Check for transshipment delays
        if (data.status === 'TRANSSHIPMENT') {
            delays.push({
                type: 'TRANSSHIPMENT_DELAY',
                probability: 0.3,
                estimatedDays: 2,
                reason: 'Container in transshipment hub'
            });
        }

        // Check for port congestion
        if (data.location?.code) {
            const congestion = await this.getPortCongestion(data.location.code);
            if (congestion.level === 'HIGH') {
                delays.push({
                    type: 'PORT_CONGESTION',
                    probability: 0.6,
                    estimatedDays: congestion.avgDelayDays,
                    reason: `High congestion at ${data.location.name}`
                });
            }
        }

        // Check for weather delays
        const weatherRisk = await this.getWeatherRisk(data.location, data.vessel);
        if (weatherRisk.risk > 0.5) {
            delays.push({
                type: 'WEATHER_DELAY',
                probability: weatherRisk.risk,
                estimatedDays: weatherRisk.estimatedDays,
                reason: weatherRisk.description
            });
        }

        return delays;
    }

    async calculateDemurrageRisk(trackingInfo) {
        const data = trackingInfo.data;
        let riskScore = 0;
        const factors = [];

        // Time until arrival
        if (data.estimatedArrival) {
            const daysUntilArrival = Math.ceil(
                (new Date(data.estimatedArrival) - new Date()) / (1000 * 60 * 60 * 24)
            );
            
            if (daysUntilArrival < 3) {
                riskScore += 40;
                factors.push({
                    type: 'ARRIVAL_IMMINENT',
                    impact: 40,
                    description: `Container arriving in ${daysUntilArrival} days`
                });
            }
        }

        // Check for delays
        const delays = await this.predictDelays(trackingInfo);
        if (delays.length > 0) {
            const delayRisk = delays.reduce((sum, delay) => sum + (delay.probability * 20), 0);
            riskScore += delayRisk;
            factors.push({
                type: 'PREDICTED_DELAYS',
                impact: delayRisk,
                description: `${delays.length} potential delays detected`
            });
        }

        // Port efficiency
        if (data.location?.code) {
            const portEfficiency = await this.getPortEfficiency(data.location.code);
            if (portEfficiency < 0.7) {
                riskScore += 20;
                factors.push({
                    type: 'PORT_INEFFICIENCY',
                    impact: 20,
                    description: `Low efficiency at ${data.location.name}`
                });
            }
        }

        // Historical carrier performance
        const carrierPerformance = await this.getCarrierPerformance(trackingInfo.carrier);
        if (carrierPerformance.onTimePerformance < 0.8) {
            riskScore += 15;
            factors.push({
                type: 'CARRIER_PERFORMANCE',
                impact: 15,
                description: `Carrier on-time performance: ${(carrierPerformance.onTimePerformance * 100).toFixed(1)}%`
            });
        }

        // Determine risk level
        let riskLevel = 'LOW';
        if (riskScore >= 70) riskLevel = 'CRITICAL';
        else if (riskScore >= 50) riskLevel = 'HIGH';
        else if (riskScore >= 30) riskLevel = 'MEDIUM';

        return {
            score: Math.min(riskScore, 100),
            level: riskLevel,
            factors: factors,
            recommendations: this.getDemurrageRecommendations(riskLevel, factors)
        };
    }

    async predictNextEvents(trackingInfo) {
        const data = trackingInfo.data;
        const nextEvents = [];

        // Predict based on current status
        switch (data.status) {
            case 'LOADED':
                nextEvents.push({
                    event: 'DEPARTED',
                    probability: 0.9,
                    estimatedTime: this.addHours(new Date(), 6),
                    description: 'Vessel departure from origin port'
                });
                break;

            case 'DEPARTED':
                if (data.vessel?.voyage) {
                    nextEvents.push({
                        event: 'ARRIVED',
                        probability: 0.8,
                        estimatedTime: data.estimatedArrival,
                        description: 'Vessel arrival at destination port'
                    });
                }
                break;

            case 'ARRIVED':
                nextEvents.push({
                    event: 'DISCHARGED',
                    probability: 0.85,
                    estimatedTime: this.addHours(new Date(data.estimatedArrival || new Date()), 24),
                    description: 'Container discharge from vessel'
                });
                break;

            case 'DISCHARGED':
                nextEvents.push({
                    event: 'AVAILABLE',
                    probability: 0.8,
                    estimatedTime: this.addDays(new Date(), 2),
                    description: 'Container available for pickup'
                });
                break;
        }

        return nextEvents;
    }

    // Alert checking
    async checkForAlerts(trackingInfo, eventData) {
        const alerts = [];

        // Delay alerts
        if (this.isDelayEvent(eventData)) {
            alerts.push({
                type: 'DELAY_DETECTED',
                severity: 'MEDIUM',
                message: `Delay detected for container ${trackingInfo.containerNumber}`,
                data: eventData,
                timestamp: new Date().toISOString()
            });
        }

        // Arrival alerts
        if (eventData.status === 'ARRIVED' || eventData.status === 'DISCHARGED') {
            alerts.push({
                type: 'ARRIVAL_NOTIFICATION',
                severity: 'LOW',
                message: `Container ${trackingInfo.containerNumber} has ${eventData.status.toLowerCase()}`,
                data: eventData,
                timestamp: new Date().toISOString()
            });
        }

        // Critical status alerts
        const criticalStatuses = ['CUSTOMS_HOLD', 'DAMAGE', 'SECURITY_ALERT'];
        if (criticalStatuses.some(status => eventData.status.includes(status))) {
            alerts.push({
                type: 'CRITICAL_STATUS',
                severity: 'HIGH',
                message: `Critical status update for container ${trackingInfo.containerNumber}: ${eventData.status}`,
                data: eventData,
                timestamp: new Date().toISOString()
            });
        }

        return alerts;
    }

    // Utility methods
    formatTrackingResponse(trackingInfo) {
        return {
            trackingId: trackingInfo.id,
            containerNumber: trackingInfo.containerNumber,
            carrier: trackingInfo.carrier,
            status: trackingInfo.data.status,
            location: trackingInfo.data.location,
            vessel: trackingInfo.data.vessel,
            equipment: trackingInfo.data.equipment,
            timeline: trackingInfo.data.timeline || [],
            estimatedArrival: trackingInfo.data.estimatedArrival,
            actualArrival: trackingInfo.data.actualArrival,
            predictions: trackingInfo.predictions,
            alerts: trackingInfo.alerts,
            subscription: trackingInfo.subscription,
            lastUpdated: trackingInfo.lastUpdated,
            createdAt: trackingInfo.createdAt
        };
    }

    detectNewEvents(oldData, newData) {
        const oldTimeline = oldData.timeline || [];
        const newTimeline = newData.timeline || [];
        
        return newTimeline.filter(newEvent => 
            !oldTimeline.some(oldEvent => 
                oldEvent.timestamp === newEvent.timestamp && 
                oldEvent.status === newEvent.status
            )
        );
    }

    async mergeTrackingData(oldData, newData) {
        const merged = { ...oldData };
        
        // Update current status if newer
        if (new Date(newData.timestamp || 0) > new Date(oldData.lastUpdated || 0)) {
            merged.status = newData.status || oldData.status;
            merged.location = newData.location || oldData.location;
            merged.vessel = newData.vessel || oldData.vessel;
            merged.lastUpdated = newData.timestamp || oldData.lastUpdated;
        }

        // Merge timelines
        if (newData.timeline) {
            const combinedTimeline = [...(oldData.timeline || []), ...newData.timeline];
            merged.timeline = this.deduplicateTimeline(combinedTimeline);
        }

        return merged;
    }

    deduplicateTimeline(timeline) {
        const seen = new Set();
        return timeline.filter(event => {
            const key = `${event.timestamp}_${event.status}_${event.location?.code}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // Mock methods for data that would come from ML models or external APIs
    async getCarrierPerformance(carrier) {
        return {
            onTimePerformance: 0.85,
            avgDelayDays: 1.2,
            reliability: 88
        };
    }

    async getPortCongestion(portCode) {
        return {
            level: 'MEDIUM',
            avgDelayDays: 1.5,
            congestionScore: 65
        };
    }

    async getPortEfficiency(portCode) {
        return 0.75; // 75% efficiency
    }

    async getWeatherRisk(location, vessel) {
        return {
            risk: 0.2,
            estimatedDays: 0.5,
            description: 'Mild weather conditions'
        };
    }

    // Helper methods
    estimateETAFromRoute(data) {
        // Mock implementation
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    }

    calculateETAConfidence(data) {
        if (data.estimatedArrival && data.vessel?.name) return 0.8;
        if (data.estimatedArrival) return 0.6;
        return 0.3;
    }

    calculateCurrentDelays(data) {
        // Mock delay calculation
        return 0;
    }

    isDelayEvent(eventData) {
        const delayKeywords = ['DELAY', 'LATE', 'POSTPONED', 'CONGESTION'];
        return delayKeywords.some(keyword => 
            eventData.description?.toUpperCase().includes(keyword)
        );
    }

    getDemurrageRecommendations(riskLevel, factors) {
        const recommendations = [];
        
        if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
            recommendations.push('Contact carrier immediately to expedite container release');
            recommendations.push('Prepare demurrage and detention documentation');
            recommendations.push('Consider alternative pickup arrangements');
        }
        
        if (factors.some(f => f.type === 'PORT_CONGESTION')) {
            recommendations.push('Monitor port congestion updates');
            recommendations.push('Consider off-peak pickup times');
        }
        
        return recommendations;
    }

    addHours(date, hours) {
        const result = new Date(date);
        result.setHours(result.getHours() + hours);
        return result.toISOString();
    }

    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString();
    }

    generateTrackingId() {
        return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Event system
    on(eventType, listener) {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType).push(listener);
    }

    emitEvent(eventType, data) {
        const listeners = this.eventListeners.get(eventType) || [];
        listeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error(`Error in event listener for ${eventType}:`, error);
            }
        });
    }

    // Periodic updates
    startPeriodicUpdates() {
        const updateInterval = this.config.updateInterval || 1800000; // 30 minutes
        
        setInterval(async () => {
            await this.performPeriodicUpdates();
        }, updateInterval);
        
        console.log(`[ContainerTracker] Periodic updates started (${updateInterval}ms interval)`);
    }

    async performPeriodicUpdates() {
        const activeContainers = Array.from(this.activeTracking.keys());
        if (activeContainers.length === 0) return;

        console.log(`[ContainerTracker] Performing periodic updates for ${activeContainers.length} containers`);

        for (const containerNumber of activeContainers) {
            try {
                await this.refreshTrackingData(containerNumber);
            } catch (error) {
                console.error(`[ContainerTracker] Failed periodic update for ${containerNumber}:`, error.message);
            }
        }
    }

    // Database integration methods (mock implementations)
    async storeTrackingData(trackingInfo) {
        console.log(`[ContainerTracker] Storing tracking data for ${trackingInfo.containerNumber}`);
    }

    async updateTrackingData(trackingInfo) {
        console.log(`[ContainerTracker] Updating tracking data for ${trackingInfo.containerNumber}`);
    }

    async getTrackingFromDatabase(containerNumber) {
        console.log(`[ContainerTracker] Getting tracking data from database for ${containerNumber}`);
        return null;
    }

    async storeContainerEvent(containerNumber, eventData) {
        console.log(`[ContainerTracker] Storing event for ${containerNumber}: ${eventData.status}`);
    }

    async markTrackingAsStopped(containerNumber) {
        console.log(`[ContainerTracker] Marking tracking as stopped for ${containerNumber}`);
    }

    // Get tracking statistics
    getStatistics() {
        return {
            activeTracking: this.activeTracking.size,
            activeSubscriptions: this.subscriptions.size,
            cachedPredictions: this.predictions.size,
            eventListeners: Array.from(this.eventListeners.entries()).map(([type, listeners]) => ({
                eventType: type,
                listenerCount: listeners.length
            })),
            timestamp: new Date().toISOString()
        };
    }

    // Cleanup
    async shutdown() {
        console.log('[ContainerTracker] Shutting down container tracker...');
        
        // Stop all active tracking
        const activeContainers = Array.from(this.activeTracking.keys());
        for (const containerNumber of activeContainers) {
            try {
                await this.stopTracking(containerNumber);
            } catch (error) {
                console.warn(`Failed to stop tracking for ${containerNumber}:`, error.message);
            }
        }

        // Shutdown components
        await this.carrierManager.shutdown();
        
        console.log('[ContainerTracker] Container tracker shutdown complete');
    }
}

module.exports = ContainerTracker;