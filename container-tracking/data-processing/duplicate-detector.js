// ROOTUIP Container Tracking - Duplicate Detection Logic
// Advanced duplicate detection and deduplication system

const crypto = require('crypto');

class DuplicateDetector {
    constructor(config) {
        this.config = config || {};
        this.duplicateStrategies = this.initializeDuplicateStrategies();
        this.hashCache = new Map();
        this.recentEvents = new Map(); // In-memory cache for recent events
        this.cacheSize = config.cacheSize || 10000;
        this.cacheTimeout = config.cacheTimeout || 3600000; // 1 hour
        
        this.startCacheCleanup();
    }

    initializeDuplicateStrategies() {
        return {
            EXACT_MATCH: {
                name: 'Exact Match',
                description: 'Exact match on container number, timestamp, status, and carrier',
                weight: 1.0,
                detector: this.detectExactMatch.bind(this)
            },
            TEMPORAL_WINDOW: {
                name: 'Temporal Window',
                description: 'Same event within time window (default 5 minutes)',
                weight: 0.9,
                detector: this.detectTemporalWindow.bind(this)
            },
            SEMANTIC_DUPLICATE: {
                name: 'Semantic Duplicate',
                description: 'Same semantic meaning but different format',
                weight: 0.8,
                detector: this.detectSemanticDuplicate.bind(this)
            },
            LOCATION_STATUS: {
                name: 'Location-Status Match',
                description: 'Same container, location, and status within time window',
                weight: 0.7,
                detector: this.detectLocationStatusMatch.bind(this)
            },
            FUZZY_MATCH: {
                name: 'Fuzzy Match',
                description: 'Similar events with minor variations',
                weight: 0.6,
                detector: this.detectFuzzyMatch.bind(this)
            }
        };
    }

    // Main duplicate detection entry point
    async detectDuplicates(newEvent, existingEvents = []) {
        const results = {
            eventId: newEvent.id || this.generateEventId(),
            isDuplicate: false,
            confidence: 0,
            duplicateType: null,
            duplicateOf: [],
            strategy: null,
            details: {},
            timestamp: new Date().toISOString()
        };

        try {
            // Check cache first for performance
            const cacheKey = this.generateCacheKey(newEvent);
            if (this.recentEvents.has(cacheKey)) {
                const cachedResult = this.recentEvents.get(cacheKey);
                results.isDuplicate = true;
                results.confidence = 1.0;
                results.duplicateType = 'CACHED_DUPLICATE';
                results.duplicateOf = [cachedResult.eventId];
                results.details.cacheHit = true;
                return results;
            }

            // Get recent events from database/cache if not provided
            if (existingEvents.length === 0) {
                existingEvents = await this.getRecentEvents(newEvent.containerNumber, newEvent.carrier);
            }

            // Apply duplicate detection strategies
            for (const [strategyKey, strategy] of Object.entries(this.duplicateStrategies)) {
                const strategyResult = await strategy.detector(newEvent, existingEvents);
                
                if (strategyResult.isDuplicate) {
                    results.isDuplicate = true;
                    results.confidence = Math.max(results.confidence, strategyResult.confidence * strategy.weight);
                    results.duplicateType = strategyKey;
                    results.strategy = strategy.name;
                    results.duplicateOf = strategyResult.duplicateOf;
                    results.details = { ...results.details, ...strategyResult.details };
                    
                    // Break on high confidence match
                    if (results.confidence >= 0.9) {
                        break;
                    }
                }
            }

            // Cache the event if it's not a duplicate
            if (!results.isDuplicate) {
                this.cacheEvent(newEvent, cacheKey);
            }

            return results;
        } catch (error) {
            console.error('Duplicate detection failed:', error);
            throw new Error(`Duplicate detection failed: ${error.message}`);
        }
    }

    // Duplicate detection strategies
    async detectExactMatch(newEvent, existingEvents) {
        const result = {
            isDuplicate: false,
            confidence: 0,
            duplicateOf: [],
            details: {}
        };

        const newHash = this.generateEventHash(newEvent);
        
        for (const existingEvent of existingEvents) {
            const existingHash = this.generateEventHash(existingEvent);
            
            if (newHash === existingHash) {
                result.isDuplicate = true;
                result.confidence = 1.0;
                result.duplicateOf.push(existingEvent.id);
                result.details.hashMatch = true;
                result.details.matchedHash = newHash;
                break;
            }
        }

        return result;
    }

    async detectTemporalWindow(newEvent, existingEvents) {
        const result = {
            isDuplicate: false,
            confidence: 0,
            duplicateOf: [],
            details: {}
        };

        const newTimestamp = new Date(newEvent.timestamp);
        const timeWindow = this.config.temporalWindow || 300000; // 5 minutes

        for (const existingEvent of existingEvents) {
            if (this.isSameContainerAndCarrier(newEvent, existingEvent)) {
                const existingTimestamp = new Date(existingEvent.timestamp);
                const timeDiff = Math.abs(newTimestamp - existingTimestamp);
                
                if (timeDiff <= timeWindow) {
                    // Check if status and location are similar
                    const statusMatch = this.normalizeStatus(newEvent.status) === this.normalizeStatus(existingEvent.status);
                    const locationMatch = this.compareLocations(newEvent.location, existingEvent.location);
                    
                    if (statusMatch && locationMatch.score > 0.8) {
                        result.isDuplicate = true;
                        result.confidence = this.calculateTemporalConfidence(timeDiff, timeWindow, locationMatch.score);
                        result.duplicateOf.push(existingEvent.id);
                        result.details.timeDifference = timeDiff;
                        result.details.timeWindow = timeWindow;
                        result.details.locationScore = locationMatch.score;
                        break;
                    }
                }
            }
        }

        return result;
    }

    async detectSemanticDuplicate(newEvent, existingEvents) {
        const result = {
            isDuplicate: false,
            confidence: 0,
            duplicateOf: [],
            details: {}
        };

        for (const existingEvent of existingEvents) {
            if (this.isSameContainerAndCarrier(newEvent, existingEvent)) {
                const semanticScore = this.calculateSemanticSimilarity(newEvent, existingEvent);
                
                if (semanticScore > 0.85) {
                    result.isDuplicate = true;
                    result.confidence = semanticScore;
                    result.duplicateOf.push(existingEvent.id);
                    result.details.semanticScore = semanticScore;
                    result.details.comparisonDetails = this.getSemanticComparisonDetails(newEvent, existingEvent);
                    break;
                }
            }
        }

        return result;
    }

    async detectLocationStatusMatch(newEvent, existingEvents) {
        const result = {
            isDuplicate: false,
            confidence: 0,
            duplicateOf: [],
            details: {}
        };

        const timeWindow = this.config.locationStatusWindow || 1800000; // 30 minutes
        const newTimestamp = new Date(newEvent.timestamp);

        for (const existingEvent of existingEvents) {
            if (this.isSameContainerAndCarrier(newEvent, existingEvent)) {
                const existingTimestamp = new Date(existingEvent.timestamp);
                const timeDiff = Math.abs(newTimestamp - existingTimestamp);
                
                if (timeDiff <= timeWindow) {
                    const statusMatch = this.normalizeStatus(newEvent.status) === this.normalizeStatus(existingEvent.status);
                    const locationMatch = this.compareLocations(newEvent.location, existingEvent.location);
                    
                    if (statusMatch && locationMatch.score > 0.9) {
                        result.isDuplicate = true;
                        result.confidence = 0.8 * locationMatch.score;
                        result.duplicateOf.push(existingEvent.id);
                        result.details.timeDifference = timeDiff;
                        result.details.locationScore = locationMatch.score;
                        result.details.statusMatch = true;
                        break;
                    }
                }
            }
        }

        return result;
    }

    async detectFuzzyMatch(newEvent, existingEvents) {
        const result = {
            isDuplicate: false,
            confidence: 0,
            duplicateOf: [],
            details: {}
        };

        for (const existingEvent of existingEvents) {
            if (this.isSameContainerAndCarrier(newEvent, existingEvent)) {
                const fuzzyScore = this.calculateFuzzyScore(newEvent, existingEvent);
                
                if (fuzzyScore > 0.75) {
                    result.isDuplicate = true;
                    result.confidence = fuzzyScore;
                    result.duplicateOf.push(existingEvent.id);
                    result.details.fuzzyScore = fuzzyScore;
                    result.details.fuzzyDetails = this.getFuzzyComparisonDetails(newEvent, existingEvent);
                    break;
                }
            }
        }

        return result;
    }

    // Helper methods
    generateEventHash(event) {
        const hashInput = [
            event.containerNumber || '',
            event.carrier || '',
            event.status || '',
            event.timestamp || '',
            event.location?.code || '',
            event.vessel?.name || '',
            event.vessel?.voyage || ''
        ].join('|').toLowerCase();

        return crypto.createHash('sha256').update(hashInput).digest('hex');
    }

    generateCacheKey(event) {
        return `${event.containerNumber}_${event.carrier}_${event.status}_${event.timestamp}`;
    }

    isSameContainerAndCarrier(event1, event2) {
        return event1.containerNumber === event2.containerNumber && 
               event1.carrier === event2.carrier;
    }

    normalizeStatus(status) {
        if (!status) return '';
        return status.toString().toUpperCase().replace(/[\s-_]/g, '');
    }

    compareLocations(loc1, loc2) {
        if (!loc1 || !loc2) {
            return { score: 0, details: 'Missing location data' };
        }

        let score = 0;
        const details = {};

        // Compare location codes (highest weight)
        if (loc1.code && loc2.code) {
            if (loc1.code === loc2.code) {
                score += 0.6;
                details.codeMatch = true;
            }
        }

        // Compare location names
        if (loc1.name && loc2.name) {
            const nameScore = this.calculateStringSimilarity(loc1.name, loc2.name);
            score += nameScore * 0.3;
            details.nameScore = nameScore;
        }

        // Compare countries
        if (loc1.country && loc2.country) {
            if (loc1.country === loc2.country) {
                score += 0.1;
                details.countryMatch = true;
            }
        }

        return { score: Math.min(score, 1.0), details };
    }

    calculateTemporalConfidence(timeDiff, timeWindow, locationScore) {
        const timeScore = 1 - (timeDiff / timeWindow);
        return (timeScore * 0.6 + locationScore * 0.4);
    }

    calculateSemanticSimilarity(event1, event2) {
        let score = 0;
        let totalWeight = 0;

        // Status similarity (40% weight)
        const statusScore = this.normalizeStatus(event1.status) === this.normalizeStatus(event2.status) ? 1 : 0;
        score += statusScore * 0.4;
        totalWeight += 0.4;

        // Location similarity (30% weight)
        const locationMatch = this.compareLocations(event1.location, event2.location);
        score += locationMatch.score * 0.3;
        totalWeight += 0.3;

        // Vessel similarity (20% weight)
        const vesselScore = this.compareVessels(event1.vessel, event2.vessel);
        score += vesselScore * 0.2;
        totalWeight += 0.2;

        // Timestamp proximity (10% weight)
        const timeDiff = Math.abs(new Date(event1.timestamp) - new Date(event2.timestamp));
        const timeScore = Math.max(0, 1 - (timeDiff / 3600000)); // Within 1 hour
        score += timeScore * 0.1;
        totalWeight += 0.1;

        return totalWeight > 0 ? score / totalWeight : 0;
    }

    getSemanticComparisonDetails(event1, event2) {
        return {
            statusMatch: this.normalizeStatus(event1.status) === this.normalizeStatus(event2.status),
            locationScore: this.compareLocations(event1.location, event2.location).score,
            vesselScore: this.compareVessels(event1.vessel, event2.vessel),
            timeDifference: Math.abs(new Date(event1.timestamp) - new Date(event2.timestamp))
        };
    }

    calculateFuzzyScore(event1, event2) {
        const features = [
            this.normalizeStatus(event1.status) === this.normalizeStatus(event2.status) ? 1 : 0,
            this.compareLocations(event1.location, event2.location).score,
            this.compareVessels(event1.vessel, event2.vessel),
            this.compareTimestamps(event1.timestamp, event2.timestamp),
            this.compareDescriptions(event1.description, event2.description)
        ];

        const weights = [0.3, 0.25, 0.2, 0.15, 0.1];
        
        return features.reduce((sum, feature, index) => sum + (feature * weights[index]), 0);
    }

    getFuzzyComparisonDetails(event1, event2) {
        return {
            statusScore: this.normalizeStatus(event1.status) === this.normalizeStatus(event2.status) ? 1 : 0,
            locationScore: this.compareLocations(event1.location, event2.location).score,
            vesselScore: this.compareVessels(event1.vessel, event2.vessel),
            timestampScore: this.compareTimestamps(event1.timestamp, event2.timestamp),
            descriptionScore: this.compareDescriptions(event1.description, event2.description)
        };
    }

    compareVessels(vessel1, vessel2) {
        if (!vessel1 || !vessel2) return 0;

        let score = 0;
        
        // Compare vessel names
        if (vessel1.name && vessel2.name) {
            score = Math.max(score, this.calculateStringSimilarity(vessel1.name, vessel2.name));
        }

        // Compare IMO numbers (exact match)
        if (vessel1.imo && vessel2.imo) {
            score = Math.max(score, vessel1.imo === vessel2.imo ? 1 : 0);
        }

        // Compare voyage numbers
        if (vessel1.voyage && vessel2.voyage) {
            score = Math.max(score, this.calculateStringSimilarity(vessel1.voyage, vessel2.voyage));
        }

        return score;
    }

    compareTimestamps(timestamp1, timestamp2) {
        if (!timestamp1 || !timestamp2) return 0;

        const timeDiff = Math.abs(new Date(timestamp1) - new Date(timestamp2));
        const maxDiff = 7200000; // 2 hours
        
        return Math.max(0, 1 - (timeDiff / maxDiff));
    }

    compareDescriptions(desc1, desc2) {
        if (!desc1 || !desc2) return 0;
        
        return this.calculateStringSimilarity(desc1, desc2);
    }

    calculateStringSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;

        // Simple Levenshtein distance-based similarity
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    // Cache management
    cacheEvent(event, cacheKey) {
        if (this.recentEvents.size >= this.cacheSize) {
            // Remove oldest entries
            const entries = Array.from(this.recentEvents.entries());
            const toRemove = Math.floor(this.cacheSize * 0.1); // Remove 10%
            
            for (let i = 0; i < toRemove; i++) {
                this.recentEvents.delete(entries[i][0]);
            }
        }

        this.recentEvents.set(cacheKey, {
            eventId: event.id,
            timestamp: Date.now(),
            containerNumber: event.containerNumber,
            carrier: event.carrier,
            status: event.status
        });
    }

    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            const toDelete = [];

            for (const [key, value] of this.recentEvents.entries()) {
                if (now - value.timestamp > this.cacheTimeout) {
                    toDelete.push(key);
                }
            }

            toDelete.forEach(key => this.recentEvents.delete(key));
            
            if (toDelete.length > 0) {
                console.log(`[DuplicateDetector] Cleaned up ${toDelete.length} expired cache entries`);
            }
        }, 300000); // Clean every 5 minutes
    }

    // Database integration methods
    async getRecentEvents(containerNumber, carrier, timeWindow = 86400000) { // 24 hours
        // This would query your database for recent events
        // Mock implementation for now
        return [];
    }

    async markAsDuplicate(eventId, duplicateOfId, strategy, confidence) {
        // Mark event as duplicate in database
        console.log(`[DuplicateDetector] Marking event ${eventId} as duplicate of ${duplicateOfId} (${strategy}, confidence: ${confidence})`);
    }

    // Batch duplicate detection
    async detectBatchDuplicates(events, options = {}) {
        const results = {
            total: events.length,
            duplicates: 0,
            unique: 0,
            processed: []
        };

        const batchSize = options.batchSize || 100;
        
        for (let i = 0; i < events.length; i += batchSize) {
            const batch = events.slice(i, i + batchSize);
            
            for (const event of batch) {
                try {
                    const duplicateResult = await this.detectDuplicates(event, events.slice(0, i));
                    
                    results.processed.push({
                        eventId: event.id,
                        isDuplicate: duplicateResult.isDuplicate,
                        confidence: duplicateResult.confidence,
                        duplicateType: duplicateResult.duplicateType,
                        duplicateOf: duplicateResult.duplicateOf
                    });

                    if (duplicateResult.isDuplicate) {
                        results.duplicates++;
                    } else {
                        results.unique++;
                    }
                } catch (error) {
                    console.error(`Failed to process event ${event.id}:`, error);
                }
            }
            
            console.log(`[DuplicateDetector] Processed batch ${Math.floor(i / batchSize) + 1}, ${i + batch.length}/${events.length} events`);
        }

        return results;
    }

    generateEventId() {
        return `dup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Get duplicate detection statistics
    getStatistics() {
        return {
            cacheSize: this.recentEvents.size,
            maxCacheSize: this.cacheSize,
            cacheTimeout: this.cacheTimeout,
            strategies: Object.keys(this.duplicateStrategies),
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = DuplicateDetector;