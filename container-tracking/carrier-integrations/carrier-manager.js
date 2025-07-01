// ROOTUIP Container Tracking - Carrier Integration Manager
// Manages all carrier adapters and provides unified tracking interface

const MaerskAdapter = require('./maersk-adapter');
const MSCAdapter = require('./msc-adapter');
const CMACGMAdapter = require('./cmacgm-adapter');
const HapagLloydAdapter = require('./hapag-lloyd-adapter');

class CarrierManager {
    constructor(config) {
        this.carriers = new Map();
        this.config = config || {};
        this.healthCheckInterval = null;
        this.carrierHealth = new Map();
        
        this.initializeCarriers();
        this.startHealthMonitoring();
    }

    initializeCarriers() {
        // Initialize Maersk adapter
        if (this.config.maersk?.enabled) {
            try {
                const maersk = new MaerskAdapter({
                    clientId: this.config.maersk.clientId,
                    clientSecret: this.config.maersk.clientSecret,
                    apiKey: this.config.maersk.apiKey,
                    rateLimit: this.config.maersk.rateLimit || 100
                });
                this.carriers.set('MAEU', maersk);
                console.log('[CarrierManager] Maersk adapter initialized');
            } catch (error) {
                console.error('[CarrierManager] Failed to initialize Maersk adapter:', error.message);
            }
        }

        // Initialize MSC adapter
        if (this.config.msc?.enabled) {
            try {
                const msc = new MSCAdapter({
                    username: this.config.msc.username,
                    password: this.config.msc.password,
                    apiKey: this.config.msc.apiKey,
                    rateLimit: this.config.msc.rateLimit || 80
                });
                this.carriers.set('MSCU', msc);
                console.log('[CarrierManager] MSC adapter initialized');
            } catch (error) {
                console.error('[CarrierManager] Failed to initialize MSC adapter:', error.message);
            }
        }

        // Initialize CMA CGM adapter
        if (this.config.cmacgm?.enabled) {
            try {
                const cmacgm = new CMACGMAdapter({
                    apiKey: this.config.cmacgm.apiKey,
                    apiSecret: this.config.cmacgm.apiSecret,
                    rateLimit: this.config.cmacgm.rateLimit || 60
                });
                this.carriers.set('CMDU', cmacgm);
                console.log('[CarrierManager] CMA CGM adapter initialized');
            } catch (error) {
                console.error('[CarrierManager] Failed to initialize CMA CGM adapter:', error.message);
            }
        }

        // Initialize Hapag-Lloyd adapter
        if (this.config.hapagLloyd?.enabled) {
            try {
                const hapagLloyd = new HapagLloydAdapter({
                    clientId: this.config.hapagLloyd.clientId,
                    clientSecret: this.config.hapagLloyd.clientSecret,
                    ediEnabled: this.config.hapagLloyd.ediEnabled,
                    rateLimit: this.config.hapagLloyd.rateLimit || 50
                });
                this.carriers.set('HLCU', hapagLloyd);
                console.log('[CarrierManager] Hapag-Lloyd adapter initialized');
            } catch (error) {
                console.error('[CarrierManager] Failed to initialize Hapag-Lloyd adapter:', error.message);
            }
        }

        console.log(`[CarrierManager] Initialized ${this.carriers.size} carrier adapters`);
    }

    // Universal container tracking - tries multiple carriers
    async trackContainer(containerNumber, preferredCarrier = null) {
        const results = {
            containerNumber,
            timestamp: new Date().toISOString(),
            results: [],
            errors: [],
            found: false
        };

        // If preferred carrier is specified, try it first
        if (preferredCarrier && this.carriers.has(preferredCarrier)) {
            try {
                const carrier = this.carriers.get(preferredCarrier);
                const result = await carrier.trackContainer(containerNumber);
                results.results.push({
                    carrier: preferredCarrier,
                    status: 'success',
                    data: result,
                    responseTime: Date.now() - new Date(results.timestamp).getTime()
                });
                results.found = true;
                return results; // Return immediately on success
            } catch (error) {
                results.errors.push({
                    carrier: preferredCarrier,
                    error: error.message,
                    type: error.type || 'UNKNOWN_ERROR'
                });
            }
        }

        // Try all carriers in parallel
        const trackingPromises = Array.from(this.carriers.entries()).map(async ([carrierCode, adapter]) => {
            // Skip if already tried as preferred carrier
            if (carrierCode === preferredCarrier) return null;

            try {
                const startTime = Date.now();
                const result = await adapter.trackContainer(containerNumber);
                return {
                    carrier: carrierCode,
                    status: 'success',
                    data: result,
                    responseTime: Date.now() - startTime
                };
            } catch (error) {
                return {
                    carrier: carrierCode,
                    status: 'error',
                    error: error.message,
                    type: error.type || 'UNKNOWN_ERROR'
                };
            }
        });

        const carrierResults = await Promise.all(trackingPromises);

        // Process results
        carrierResults.forEach(result => {
            if (!result) return; // Skip null results

            if (result.status === 'success') {
                results.results.push(result);
                results.found = true;
            } else {
                results.errors.push({
                    carrier: result.carrier,
                    error: result.error,
                    type: result.type
                });
            }
        });

        // Sort successful results by response time
        results.results.sort((a, b) => a.responseTime - b.responseTime);

        return results;
    }

    // Track container with specific carrier
    async trackContainerWithCarrier(containerNumber, carrierCode) {
        if (!this.carriers.has(carrierCode)) {
            throw new Error(`Carrier ${carrierCode} is not available`);
        }

        const carrier = this.carriers.get(carrierCode);
        return await carrier.trackContainer(containerNumber);
    }

    // Track bill of lading across carriers
    async trackBillOfLading(blNumber, preferredCarrier = null) {
        const results = {
            blNumber,
            timestamp: new Date().toISOString(),
            results: [],
            errors: [],
            found: false
        };

        // If preferred carrier is specified, try it first
        if (preferredCarrier && this.carriers.has(preferredCarrier)) {
            try {
                const carrier = this.carriers.get(preferredCarrier);
                const result = await carrier.trackBillOfLading(blNumber);
                results.results.push({
                    carrier: preferredCarrier,
                    status: 'success',
                    data: result,
                    responseTime: Date.now() - new Date(results.timestamp).getTime()
                });
                results.found = true;
                return results;
            } catch (error) {
                results.errors.push({
                    carrier: preferredCarrier,
                    error: error.message,
                    type: error.type || 'UNKNOWN_ERROR'
                });
            }
        }

        // Try all carriers in parallel
        const trackingPromises = Array.from(this.carriers.entries()).map(async ([carrierCode, adapter]) => {
            if (carrierCode === preferredCarrier) return null;

            try {
                const startTime = Date.now();
                const result = await adapter.trackBillOfLading(blNumber);
                return {
                    carrier: carrierCode,
                    status: 'success',
                    data: result,
                    responseTime: Date.now() - startTime
                };
            } catch (error) {
                return {
                    carrier: carrierCode,
                    status: 'error',
                    error: error.message,
                    type: error.type || 'UNKNOWN_ERROR'
                };
            }
        });

        const carrierResults = await Promise.all(trackingPromises);

        // Process results
        carrierResults.forEach(result => {
            if (!result) return;

            if (result.status === 'success') {
                results.results.push(result);
                results.found = true;
            } else {
                results.errors.push({
                    carrier: result.carrier,
                    error: result.error,
                    type: result.type
                });
            }
        });

        results.results.sort((a, b) => a.responseTime - b.responseTime);
        return results;
    }

    // Get vessel schedules from all carriers
    async getVesselSchedules(vesselName, voyageNumber = null) {
        const results = {
            vesselName,
            voyageNumber,
            timestamp: new Date().toISOString(),
            schedules: [],
            errors: []
        };

        const schedulePromises = Array.from(this.carriers.entries()).map(async ([carrierCode, adapter]) => {
            try {
                const schedules = await adapter.getVesselSchedule(vesselName, voyageNumber);
                return {
                    carrier: carrierCode,
                    status: 'success',
                    schedules: Array.isArray(schedules) ? schedules : [schedules]
                };
            } catch (error) {
                return {
                    carrier: carrierCode,
                    status: 'error',
                    error: error.message,
                    type: error.type || 'UNKNOWN_ERROR'
                };
            }
        });

        const carrierResults = await Promise.all(schedulePromises);

        carrierResults.forEach(result => {
            if (result.status === 'success') {
                results.schedules.push(...result.schedules);
            } else {
                results.errors.push({
                    carrier: result.carrier,
                    error: result.error,
                    type: result.type
                });
            }
        });

        return results;
    }

    // Subscribe to container updates across carriers
    async subscribeToContainerUpdates(containerNumber, webhookUrl, carrierCode = null) {
        const subscriptions = [];
        const errors = [];

        if (carrierCode) {
            // Subscribe with specific carrier
            if (!this.carriers.has(carrierCode)) {
                throw new Error(`Carrier ${carrierCode} is not available`);
            }

            try {
                const carrier = this.carriers.get(carrierCode);
                const subscription = await carrier.subscribeToUpdates(containerNumber, webhookUrl);
                subscriptions.push(subscription);
            } catch (error) {
                errors.push({
                    carrier: carrierCode,
                    error: error.message,
                    type: error.type || 'UNKNOWN_ERROR'
                });
            }
        } else {
            // Subscribe with all available carriers
            const subscriptionPromises = Array.from(this.carriers.entries()).map(async ([code, adapter]) => {
                try {
                    const subscription = await adapter.subscribeToUpdates(containerNumber, webhookUrl);
                    return { carrier: code, subscription };
                } catch (error) {
                    return {
                        carrier: code,
                        error: error.message,
                        type: error.type || 'UNKNOWN_ERROR'
                    };
                }
            });

            const results = await Promise.all(subscriptionPromises);
            
            results.forEach(result => {
                if (result.subscription) {
                    subscriptions.push(result.subscription);
                } else {
                    errors.push({
                        carrier: result.carrier,
                        error: result.error,
                        type: result.type
                    });
                }
            });
        }

        return {
            containerNumber,
            subscriptions,
            errors,
            timestamp: new Date().toISOString()
        };
    }

    // Health monitoring
    startHealthMonitoring() {
        const checkInterval = this.config.healthCheckInterval || 300000; // 5 minutes

        this.healthCheckInterval = setInterval(async () => {
            await this.checkCarrierHealth();
        }, checkInterval);

        console.log(`[CarrierManager] Health monitoring started (${checkInterval}ms interval)`);
    }

    async checkCarrierHealth() {
        const healthPromises = Array.from(this.carriers.entries()).map(async ([carrierCode, adapter]) => {
            try {
                const health = await adapter.healthCheck();
                this.carrierHealth.set(carrierCode, health);
                return { carrier: carrierCode, health };
            } catch (error) {
                const health = {
                    carrier: carrierCode,
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
                this.carrierHealth.set(carrierCode, health);
                return { carrier: carrierCode, health };
            }
        });

        const healthResults = await Promise.all(healthPromises);
        
        // Log unhealthy carriers
        healthResults.forEach(({ carrier, health }) => {
            if (health.status !== 'healthy') {
                console.warn(`[CarrierManager] Carrier ${carrier} is unhealthy:`, health.error);
            }
        });
    }

    getCarrierHealth(carrierCode = null) {
        if (carrierCode) {
            return this.carrierHealth.get(carrierCode) || { status: 'unknown' };
        }
        
        return Object.fromEntries(this.carrierHealth);
    }

    // Get available carriers
    getAvailableCarriers() {
        return Array.from(this.carriers.keys());
    }

    // Get carrier by container number prefix
    getCarrierByContainer(containerNumber) {
        const prefixMap = {
            'MAEU': 'MAEU', // Maersk
            'MSCU': 'MSCU', // MSC
            'CMAU': 'CMDU', // CMA CGM
            'HJMU': 'HLCU', // Hapag-Lloyd
            'HLCU': 'HLCU', // Hapag-Lloyd
            'HASU': 'HLCU', // Hapag-Lloyd subsidiary
        };

        const containerPrefix = containerNumber.substring(0, 4).toUpperCase();
        return prefixMap[containerPrefix] || null;
    }

    // Detect container carrier from number
    async detectCarrierFromContainer(containerNumber) {
        // First try to match by prefix
        const carrierByPrefix = this.getCarrierByContainer(containerNumber);
        if (carrierByPrefix && this.carriers.has(carrierByPrefix)) {
            return carrierByPrefix;
        }

        // If no prefix match, try tracking with all carriers
        const trackingResult = await this.trackContainer(containerNumber);
        if (trackingResult.found && trackingResult.results.length > 0) {
            return trackingResult.results[0].carrier;
        }

        return null;
    }

    // Batch tracking
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

        // Process containers in batches
        for (let i = 0; i < containerNumbers.length; i += batchSize) {
            const batch = containerNumbers.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (containerNumber) => {
                try {
                    const trackingResult = await this.trackContainer(
                        containerNumber, 
                        options.preferredCarrier
                    );
                    
                    return {
                        containerNumber,
                        status: 'success',
                        found: trackingResult.found,
                        data: trackingResult.results[0]?.data || null,
                        carrier: trackingResult.results[0]?.carrier || null,
                        errors: trackingResult.errors
                    };
                } catch (error) {
                    return {
                        containerNumber,
                        status: 'error',
                        found: false,
                        error: error.message,
                        type: error.type || 'UNKNOWN_ERROR'
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            
            batchResults.forEach(result => {
                results.containers.push(result);
                if (result.status === 'success') {
                    results.successful++;
                } else {
                    results.failed++;
                }
            });

            // Small delay between batches to avoid overwhelming APIs
            if (i + batchSize < containerNumbers.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return results;
    }

    // Cleanup
    stopHealthMonitoring() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
            console.log('[CarrierManager] Health monitoring stopped');
        }
    }

    async shutdown() {
        this.stopHealthMonitoring();
        
        // Cleanup carrier adapters
        for (const [carrierCode, adapter] of this.carriers) {
            try {
                if (typeof adapter.logout === 'function') {
                    await adapter.logout();
                }
                console.log(`[CarrierManager] ${carrierCode} adapter cleaned up`);
            } catch (error) {
                console.warn(`[CarrierManager] Failed to cleanup ${carrierCode} adapter:`, error.message);
            }
        }

        this.carriers.clear();
        this.carrierHealth.clear();
        console.log('[CarrierManager] Shutdown complete');
    }
}

module.exports = CarrierManager;