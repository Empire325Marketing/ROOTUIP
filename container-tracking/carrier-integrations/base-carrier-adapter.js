// ROOTUIP Container Tracking - Base Carrier Adapter
// Abstract base class for all carrier integrations

const axios = require('axios');
const crypto = require('crypto');

class BaseCarrierAdapter {
    constructor(config) {
        this.carrierCode = config.carrierCode;
        this.apiBaseUrl = config.apiBaseUrl;
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.rateLimit = config.rateLimit || 60; // requests per minute
        this.timeout = config.timeout || 30000; // 30 seconds
        
        // Rate limiting
        this.requestCount = 0;
        this.requestWindow = Date.now();
        
        // Initialize HTTP client
        this.client = axios.create({
            baseURL: this.apiBaseUrl,
            timeout: this.timeout,
            headers: {
                'User-Agent': 'ROOTUIP-ContainerTracking/1.0',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        // Add request/response interceptors
        this.setupInterceptors();
    }

    setupInterceptors() {
        // Request interceptor for authentication and rate limiting
        this.client.interceptors.request.use(
            async (config) => {
                // Rate limiting
                await this.handleRateLimit();
                
                // Add authentication
                config = await this.addAuthentication(config);
                
                // Log request
                console.log(`[${this.carrierCode}] API Request: ${config.method?.toUpperCase()} ${config.url}`);
                
                return config;
            },
            (error) => {
                console.error(`[${this.carrierCode}] Request Error:`, error);
                return Promise.reject(error);
            }
        );

        // Response interceptor for error handling
        this.client.interceptors.response.use(
            (response) => {
                console.log(`[${this.carrierCode}] API Response: ${response.status} ${response.statusText}`);
                return response;
            },
            (error) => {
                console.error(`[${this.carrierCode}] Response Error:`, {
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data
                });
                return Promise.reject(this.handleApiError(error));
            }
        );
    }

    async handleRateLimit() {
        const now = Date.now();
        const windowDuration = 60000; // 1 minute

        // Reset counter if window has passed
        if (now - this.requestWindow > windowDuration) {
            this.requestCount = 0;
            this.requestWindow = now;
        }

        // Check if rate limit exceeded
        if (this.requestCount >= this.rateLimit) {
            const waitTime = windowDuration - (now - this.requestWindow);
            console.log(`[${this.carrierCode}] Rate limit reached, waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.requestCount = 0;
            this.requestWindow = Date.now();
        }

        this.requestCount++;
    }

    async addAuthentication(config) {
        // Override in child classes for carrier-specific authentication
        if (this.apiKey) {
            config.headers['X-API-Key'] = this.apiKey;
        }
        return config;
    }

    handleApiError(error) {
        const carrierError = {
            carrier: this.carrierCode,
            originalError: error.message,
            status: error.response?.status,
            timestamp: new Date().toISOString()
        };

        if (error.response?.status === 401) {
            carrierError.type = 'AUTHENTICATION_ERROR';
            carrierError.message = 'API authentication failed';
        } else if (error.response?.status === 403) {
            carrierError.type = 'AUTHORIZATION_ERROR';
            carrierError.message = 'API access forbidden';
        } else if (error.response?.status === 429) {
            carrierError.type = 'RATE_LIMIT_ERROR';
            carrierError.message = 'API rate limit exceeded';
        } else if (error.response?.status >= 500) {
            carrierError.type = 'CARRIER_API_ERROR';
            carrierError.message = 'Carrier API server error';
        } else if (error.code === 'ECONNABORTED') {
            carrierError.type = 'TIMEOUT_ERROR';
            carrierError.message = 'API request timeout';
        } else {
            carrierError.type = 'UNKNOWN_ERROR';
            carrierError.message = 'Unknown API error';
        }

        return carrierError;
    }

    // Abstract methods to be implemented by carrier-specific adapters
    async trackContainer(containerNumber) {
        throw new Error('trackContainer method must be implemented by carrier adapter');
    }

    async trackBillOfLading(blNumber) {
        throw new Error('trackBillOfLading method must be implemented by carrier adapter');
    }

    async getVesselSchedule(vesselName, voyageNumber) {
        throw new Error('getVesselSchedule method must be implemented by carrier adapter');
    }

    async subscribeToUpdates(containerNumber, webhookUrl) {
        throw new Error('subscribeToUpdates method must be implemented by carrier adapter');
    }

    // Common helper methods
    normalizeContainerNumber(containerNumber) {
        // Remove spaces, hyphens, and convert to uppercase
        return containerNumber.replace(/[\s-]/g, '').toUpperCase();
    }

    validateContainerNumber(containerNumber) {
        const normalized = this.normalizeContainerNumber(containerNumber);
        
        // Basic container number format validation (4 letters + 7 digits)
        const containerRegex = /^[A-Z]{4}[0-9]{7}$/;
        if (!containerRegex.test(normalized)) {
            return { valid: false, message: 'Invalid container number format' };
        }

        // Check digit validation using ISO 6346 standard
        const checkDigit = this.calculateCheckDigit(normalized.substring(0, 10));
        const providedCheckDigit = parseInt(normalized.substring(10, 11));
        
        if (checkDigit !== providedCheckDigit) {
            return { valid: false, message: 'Invalid container number check digit' };
        }

        return { valid: true, normalized };
    }

    calculateCheckDigit(containerCode) {
        const values = {
            A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
            K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
            U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38
        };

        let sum = 0;
        for (let i = 0; i < 10; i++) {
            const char = containerCode[i];
            const value = isNaN(char) ? values[char] : parseInt(char);
            sum += value * Math.pow(2, i);
        }

        const remainder = sum % 11;
        return remainder === 10 ? 0 : remainder;
    }

    // Standardized data format for all carriers
    formatTrackingResponse(rawData) {
        return {
            carrier: this.carrierCode,
            timestamp: new Date().toISOString(),
            container: {
                number: rawData.containerNumber,
                size: rawData.containerSize,
                type: rawData.containerType,
                status: this.normalizeStatus(rawData.status)
            },
            location: {
                current: {
                    name: rawData.currentLocation?.name,
                    code: rawData.currentLocation?.code,
                    country: rawData.currentLocation?.country,
                    coordinates: rawData.currentLocation?.coordinates,
                    facility: rawData.currentLocation?.facility
                },
                destination: {
                    name: rawData.destination?.name,
                    code: rawData.destination?.code,
                    country: rawData.destination?.country
                }
            },
            vessel: {
                name: rawData.vesselName,
                imo: rawData.vesselIMO,
                voyage: rawData.voyageNumber,
                eta: rawData.estimatedArrival
            },
            timeline: this.formatTimeline(rawData.events),
            estimatedArrival: rawData.estimatedArrival,
            actualArrival: rawData.actualArrival,
            demurrageRisk: this.calculateDemurrageRisk(rawData),
            lastUpdated: rawData.lastUpdated || new Date().toISOString(),
            rawData: rawData // Keep original for debugging
        };
    }

    normalizeStatus(status) {
        const statusMap = {
            'empty_returned': 'EMPTY_RETURNED',
            'gate_out': 'GATE_OUT',
            'loaded': 'LOADED',
            'departed': 'DEPARTED',
            'transshipment': 'TRANSSHIPMENT',
            'arrived': 'ARRIVED',
            'discharged': 'DISCHARGED',
            'gate_in': 'GATE_IN',
            'available': 'AVAILABLE',
            'delivered': 'DELIVERED'
        };

        const normalizedStatus = status?.toLowerCase().replace(/[\s-]/g, '_');
        return statusMap[normalizedStatus] || status?.toUpperCase() || 'UNKNOWN';
    }

    formatTimeline(events) {
        if (!events || !Array.isArray(events)) return [];

        return events.map(event => ({
            timestamp: event.timestamp || event.date,
            status: this.normalizeStatus(event.status || event.eventType),
            location: {
                name: event.location?.name || event.place,
                code: event.location?.code || event.locationCode,
                country: event.location?.country
            },
            vessel: event.vesselName,
            description: event.description || event.eventDescription,
            facilityCode: event.facilityCode
        })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    calculateDemurrageRisk(data) {
        // Basic demurrage risk calculation
        if (!data.estimatedArrival) return { score: 0, level: 'UNKNOWN' };

        const eta = new Date(data.estimatedArrival);
        const now = new Date();
        const daysUntilArrival = Math.ceil((eta - now) / (1000 * 60 * 60 * 24));

        let score = 0;
        let level = 'LOW';

        // Risk factors
        if (daysUntilArrival < 2) score += 40; // Arriving soon
        if (data.delays && data.delays.length > 0) score += 30; // Has delays
        if (data.status === 'TRANSSHIPMENT') score += 20; // Transshipment risk
        if (data.currentLocation?.port === data.destination?.port) score += 25; // At destination

        // Determine risk level
        if (score >= 70) level = 'CRITICAL';
        else if (score >= 50) level = 'HIGH';
        else if (score >= 30) level = 'MEDIUM';

        return {
            score: Math.min(score, 100),
            level,
            factors: this.getDemurrageFactors(data, daysUntilArrival)
        };
    }

    getDemurrageFactors(data, daysUntilArrival) {
        const factors = [];

        if (daysUntilArrival < 2) {
            factors.push({ type: 'ARRIVAL_IMMINENT', severity: 'HIGH', description: 'Container arriving within 48 hours' });
        }

        if (data.delays && data.delays.length > 0) {
            factors.push({ type: 'DELAYS_DETECTED', severity: 'MEDIUM', description: 'Historical delays detected' });
        }

        if (data.status === 'TRANSSHIPMENT') {
            factors.push({ type: 'TRANSSHIPMENT_RISK', severity: 'MEDIUM', description: 'Container in transshipment' });
        }

        return factors;
    }

    // Webhook validation
    validateWebhook(payload, signature, secret) {
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');

        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }

    // Health check
    async healthCheck() {
        try {
            const response = await this.client.get('/health', { timeout: 5000 });
            return {
                carrier: this.carrierCode,
                status: 'healthy',
                responseTime: response.duration,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                carrier: this.carrierCode,
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = BaseCarrierAdapter;