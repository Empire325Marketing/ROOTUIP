// ROOTUIP Container Tracking - Data Normalization Pipeline
// Standardizes data from different carriers and sources

class DataNormalizer {
    constructor(config) {
        this.config = config || {};
        this.normalizationRules = this.initializeNormalizationRules();
        this.statusMappings = this.initializeStatusMappings();
        this.locationCache = new Map();
        this.vesselCache = new Map();
    }

    initializeNormalizationRules() {
        return {
            containerNumber: {
                required: true,
                transform: (value) => this.normalizeContainerNumber(value),
                validate: (value) => this.validateContainerNumber(value)
            },
            timestamp: {
                required: true,
                transform: (value) => this.normalizeTimestamp(value),
                validate: (value) => this.validateTimestamp(value)
            },
            location: {
                required: false,
                transform: (value) => this.normalizeLocation(value),
                validate: (value) => this.validateLocation(value)
            },
            vessel: {
                required: false,
                transform: (value) => this.normalizeVessel(value),
                validate: (value) => this.validateVessel(value)
            },
            status: {
                required: true,
                transform: (value, carrier) => this.normalizeStatus(value, carrier),
                validate: (value) => this.validateStatus(value)
            }
        };
    }

    initializeStatusMappings() {
        return {
            MAEU: { // Maersk
                'GATE-OUT': 'GATE_OUT',
                'LOADED': 'LOADED',
                'VESSEL-DEPARTURE': 'DEPARTED',
                'TRANSSHIPMENT': 'TRANSSHIPMENT',
                'VESSEL-ARRIVAL': 'ARRIVED',
                'DISCHARGED': 'DISCHARGED',
                'GATE-IN': 'GATE_IN',
                'AVAILABLE-FOR-PICKUP': 'AVAILABLE',
                'DELIVERED': 'DELIVERED',
                'EMPTY-RETURNED': 'EMPTY_RETURNED'
            },
            MSCU: { // MSC
                'GTI': 'GATE_IN',
                'GTO': 'GATE_OUT',
                'LOD': 'LOADED',
                'DEP': 'DEPARTED',
                'TSP': 'TRANSSHIPMENT',
                'ARR': 'ARRIVED',
                'DIS': 'DISCHARGED',
                'AVL': 'AVAILABLE',
                'DEL': 'DELIVERED',
                'EMR': 'EMPTY_RETURNED'
            },
            CMDU: { // CMA CGM
                'GATE_OUT': 'GATE_OUT',
                'VESSEL_LOADING': 'LOADED',
                'VESSEL_DEPARTURE': 'DEPARTED',
                'TRANSSHIPMENT': 'TRANSSHIPMENT',
                'VESSEL_ARRIVAL': 'ARRIVED',
                'VESSEL_DISCHARGE': 'DISCHARGED',
                'GATE_IN': 'GATE_IN',
                'AVAILABLE': 'AVAILABLE',
                'DELIVERY': 'DELIVERED',
                'EMPTY_RETURN': 'EMPTY_RETURNED'
            },
            HLCU: { // Hapag-Lloyd
                'GATEOUT': 'GATE_OUT',
                'LOAD': 'LOADED',
                'DEPART': 'DEPARTED',
                'TRANS': 'TRANSSHIPMENT',
                'ARRIVE': 'ARRIVED',
                'DISCHARGE': 'DISCHARGED',
                'GATEIN': 'GATE_IN',
                'STRIP': 'AVAILABLE',
                'DELIVER': 'DELIVERED',
                'RETURN': 'EMPTY_RETURNED'
            }
        };
    }

    // Main normalization entry point
    async normalizeCarrierData(rawData, carrier, dataType = 'tracking') {
        try {
            const normalized = {
                id: this.generateEventId(),
                carrier: carrier,
                dataType: dataType,
                timestamp: new Date().toISOString(),
                original: rawData,
                normalized: {},
                validationErrors: [],
                transformationLog: []
            };

            // Apply carrier-specific normalization
            switch (carrier) {
                case 'MAEU':
                    normalized.normalized = await this.normalizeMaerskData(rawData, dataType);
                    break;
                case 'MSCU':
                    normalized.normalized = await this.normalizeMSCData(rawData, dataType);
                    break;
                case 'CMDU':
                    normalized.normalized = await this.normalizeCMACGMData(rawData, dataType);
                    break;
                case 'HLCU':
                    normalized.normalized = await this.normalizeHapagLloydData(rawData, dataType);
                    break;
                default:
                    normalized.normalized = await this.normalizeGenericData(rawData, dataType);
            }

            // Apply universal validation and transformation
            normalized.normalized = await this.applyUniversalNormalization(normalized.normalized, carrier);

            // Validate final result
            normalized.validationErrors = this.validateNormalizedData(normalized.normalized);

            return normalized;
        } catch (error) {
            console.error('Data normalization failed:', error);
            throw new Error(`Normalization failed: ${error.message}`);
        }
    }

    // Carrier-specific normalization methods
    async normalizeMaerskData(data, dataType) {
        if (dataType === 'tracking') {
            const container = data.containers?.[0] || data;
            return {
                containerNumber: container.containerNumber || container.equipment?.equipmentNumber,
                status: container.transportEvents?.[0]?.eventType || container.status,
                location: {
                    name: this.getLatestLocation(container)?.locationName,
                    code: this.getLatestLocation(container)?.UNLocationCode,
                    country: this.getLatestLocation(container)?.countryCode,
                    coordinates: this.getLatestLocation(container)?.coordinates,
                    facility: this.getLatestLocation(container)?.facilityCode
                },
                vessel: {
                    name: container.vessel?.vesselName || container.transportMode?.vesselName,
                    imo: container.vessel?.vesselIMONumber,
                    voyage: container.voyage?.voyageNumber
                },
                equipment: {
                    size: container.equipment?.ISOEquipmentCode?.slice(0, 2),
                    type: container.equipment?.ISOEquipmentCode,
                    sealNumbers: container.sealNumbers
                },
                timeline: this.normalizeMaerskTimeline(container.transportEvents || []),
                estimatedArrival: container.estimatedTimeOfArrival,
                actualArrival: container.actualTimeOfArrival,
                lastUpdated: container.updatedDateTime || new Date().toISOString()
            };
        }
        return data;
    }

    async normalizeMSCData(data, dataType) {
        if (dataType === 'tracking') {
            const container = data.containerInfo || data;
            return {
                containerNumber: container.containerNumber,
                status: container.statusHistory?.[0]?.statusCode || container.currentStatus,
                location: {
                    name: container.currentLocation?.name,
                    code: container.currentLocation?.unlocode,
                    country: container.currentLocation?.country,
                    coordinates: container.currentLocation?.coordinates,
                    facility: container.currentLocation?.facility
                },
                vessel: {
                    name: container.vessel?.name,
                    imo: container.vessel?.imoNumber,
                    voyage: container.voyage?.number || container.voyageNumber
                },
                equipment: {
                    size: this.extractContainerSize(container.containerType),
                    type: container.containerType,
                    sealNumbers: container.sealNumbers
                },
                timeline: this.normalizeMSCTimeline(container.statusHistory || []),
                estimatedArrival: container.estimatedArrival || container.eta,
                actualArrival: container.actualArrival,
                lastUpdated: container.lastUpdate || new Date().toISOString()
            };
        }
        return data;
    }

    async normalizeCMACGMData(data, dataType) {
        if (dataType === 'tracking') {
            const shipment = data.shipment || data;
            const container = shipment.containers?.[0] || shipment.container || shipment;
            return {
                containerNumber: container.containerNumber || container.equipmentNumber,
                status: container.trackingEvents?.[0]?.milestoneCode || container.status,
                location: {
                    name: container.trackingEvents?.[0]?.location?.locationName || container.currentLocation?.name,
                    code: container.trackingEvents?.[0]?.location?.UNLocationCode || container.currentLocation?.code,
                    country: container.trackingEvents?.[0]?.location?.countryCode || container.currentLocation?.country,
                    coordinates: container.trackingEvents?.[0]?.location?.coordinates,
                    facility: container.trackingEvents?.[0]?.location?.facilityName || container.currentLocation?.facility
                },
                vessel: {
                    name: container.trackingEvents?.[0]?.transport?.vesselName || container.vessel?.name,
                    imo: container.trackingEvents?.[0]?.transport?.vesselIMO || container.vessel?.imo,
                    voyage: container.trackingEvents?.[0]?.transport?.voyageNumber || container.voyage
                },
                equipment: {
                    size: this.extractContainerSizeCMA(container.equipmentType),
                    type: container.equipmentType || container.containerType,
                    sealNumbers: container.sealNumbers
                },
                timeline: this.normalizeCMACGMTimeline(container.trackingEvents || []),
                estimatedArrival: container.estimatedTimeOfArrival || shipment.estimatedArrival,
                actualArrival: container.actualTimeOfArrival || shipment.actualArrival,
                lastUpdated: container.lastUpdated || shipment.lastUpdated || new Date().toISOString()
            };
        }
        return data;
    }

    async normalizeHapagLloydData(data, dataType) {
        if (dataType === 'tracking') {
            const shipment = data.shipmentDetails || data;
            const equipment = shipment.equipments?.[0] || shipment.equipment || {};
            return {
                containerNumber: equipment.equipmentNumber || equipment.containerNumber,
                status: equipment.transportEvents?.[0]?.eventTypeCode || equipment.status,
                location: {
                    name: equipment.transportEvents?.[0]?.location?.locationName || equipment.currentLocation?.name,
                    code: equipment.transportEvents?.[0]?.location?.UNLocationCode || equipment.currentLocation?.code,
                    country: equipment.transportEvents?.[0]?.location?.countryCode || equipment.currentLocation?.country,
                    coordinates: equipment.transportEvents?.[0]?.location?.geoCoordinates,
                    facility: equipment.transportEvents?.[0]?.location?.facilityTypeCode || equipment.currentLocation?.facility
                },
                vessel: {
                    name: equipment.transportEvents?.[0]?.transport?.vesselName || equipment.vessel?.name,
                    imo: equipment.transportEvents?.[0]?.transport?.vesselIMONumber || equipment.vessel?.imo,
                    voyage: equipment.transportEvents?.[0]?.transport?.carrierVoyageNumber || equipment.voyage
                },
                equipment: {
                    size: this.extractContainerSizeHL(equipment.equipmentType),
                    type: equipment.equipmentType,
                    sealNumbers: equipment.sealNumbers
                },
                timeline: this.normalizeHapagLloydTimeline(equipment.transportEvents || []),
                estimatedArrival: equipment.estimatedTimeOfArrival || shipment.estimatedArrival,
                actualArrival: equipment.actualTimeOfArrival || shipment.actualArrival,
                lastUpdated: equipment.updatedDateTime || shipment.lastUpdate || new Date().toISOString()
            };
        }
        return data;
    }

    async normalizeGenericData(data, dataType) {
        // Generic normalization for unknown carriers
        return {
            containerNumber: data.containerNumber || data.container || data.equipment,
            status: data.status || data.eventType || data.state,
            location: this.normalizeLocation(data.location || data.currentLocation),
            vessel: this.normalizeVessel(data.vessel || data.ship),
            equipment: {
                size: data.containerSize || data.size,
                type: data.containerType || data.type,
                sealNumbers: data.sealNumbers || data.seals
            },
            timeline: data.events || data.timeline || [],
            estimatedArrival: data.eta || data.estimatedArrival,
            actualArrival: data.actualArrival || data.arrival,
            lastUpdated: data.lastUpdated || data.timestamp || new Date().toISOString()
        };
    }

    // Timeline normalization methods
    normalizeMaerskTimeline(events) {
        return events.map(event => ({
            timestamp: event.eventDateTime,
            status: this.normalizeStatus(event.eventType, 'MAEU'),
            location: {
                name: event.location?.locationName,
                code: event.location?.UNLocationCode,
                country: event.location?.countryCode
            },
            vessel: event.transportMode?.vesselName,
            description: event.eventTypeDescription || event.description,
            delayReason: event.delayReasonCode
        })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    normalizeMSCTimeline(events) {
        return events.map(event => ({
            timestamp: event.eventDateTime || event.timestamp,
            status: this.normalizeStatus(event.statusCode, 'MSCU'),
            location: {
                name: event.location?.name,
                code: event.location?.unlocode,
                country: event.location?.country
            },
            vessel: event.vessel?.name,
            description: event.description || event.statusDescription,
            remarks: event.remarks
        })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    normalizeCMACGMTimeline(events) {
        return events.map(event => ({
            timestamp: event.eventDateTime || event.timestamp,
            status: this.normalizeStatus(event.milestoneCode, 'CMDU'),
            location: {
                name: event.location?.locationName,
                code: event.location?.UNLocationCode,
                country: event.location?.countryCode
            },
            vessel: event.transport?.vesselName,
            description: event.eventDescription || event.milestoneDescription,
            transport: event.transport
        })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    normalizeHapagLloydTimeline(events) {
        return events.map(event => ({
            timestamp: event.eventDateTime,
            status: this.normalizeStatus(event.eventTypeCode, 'HLCU'),
            location: {
                name: event.location?.locationName,
                code: event.location?.UNLocationCode,
                country: event.location?.countryCode
            },
            vessel: event.transport?.vesselName,
            description: event.eventDescription || event.eventTypeDescription,
            documentNumbers: event.documentReferences
        })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    // Universal normalization methods
    async applyUniversalNormalization(data, carrier) {
        const normalized = { ...data };

        // Apply normalization rules
        for (const [field, rules] of Object.entries(this.normalizationRules)) {
            if (normalized[field] !== undefined && rules.transform) {
                try {
                    normalized[field] = rules.transform(normalized[field], carrier);
                } catch (error) {
                    console.warn(`Failed to transform field ${field}:`, error.message);
                }
            }
        }

        // Enrich with additional data
        normalized.location = await this.enrichLocation(normalized.location);
        normalized.vessel = await this.enrichVessel(normalized.vessel);

        return normalized;
    }

    // Data transformation methods
    normalizeContainerNumber(containerNumber) {
        if (!containerNumber) return null;
        return containerNumber.replace(/[\s-]/g, '').toUpperCase();
    }

    normalizeTimestamp(timestamp) {
        if (!timestamp) return null;
        
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid timestamp format');
        }
        
        return date.toISOString();
    }

    normalizeLocation(location) {
        if (!location || typeof location !== 'object') {
            return null;
        }

        return {
            name: location.name?.trim(),
            code: location.code?.toUpperCase(),
            country: location.country?.toUpperCase(),
            coordinates: this.normalizeCoordinates(location.coordinates),
            facility: location.facility?.trim(),
            timezone: location.timezone
        };
    }

    normalizeCoordinates(coordinates) {
        if (!coordinates) return null;
        
        if (typeof coordinates === 'string') {
            const parts = coordinates.split(',');
            if (parts.length === 2) {
                return {
                    latitude: parseFloat(parts[0].trim()),
                    longitude: parseFloat(parts[1].trim())
                };
            }
        }
        
        if (coordinates.latitude !== undefined && coordinates.longitude !== undefined) {
            return {
                latitude: parseFloat(coordinates.latitude),
                longitude: parseFloat(coordinates.longitude)
            };
        }
        
        return null;
    }

    normalizeVessel(vessel) {
        if (!vessel || typeof vessel !== 'object') {
            return null;
        }

        return {
            name: vessel.name?.trim(),
            imo: vessel.imo?.toString(),
            voyage: vessel.voyage?.trim(),
            mmsi: vessel.mmsi?.toString(),
            callSign: vessel.callSign?.trim(),
            flag: vessel.flag?.toUpperCase()
        };
    }

    normalizeStatus(status, carrier) {
        if (!status) return 'UNKNOWN';

        const statusUpper = status.toString().toUpperCase().replace(/[\s-]/g, '_');
        
        // Try carrier-specific mapping first
        if (carrier && this.statusMappings[carrier] && this.statusMappings[carrier][statusUpper]) {
            return this.statusMappings[carrier][statusUpper];
        }

        // Try direct mapping to standard statuses
        const standardStatuses = [
            'GATE_OUT', 'LOADED', 'DEPARTED', 'TRANSSHIPMENT', 'ARRIVED',
            'DISCHARGED', 'GATE_IN', 'AVAILABLE', 'DELIVERED', 'EMPTY_RETURNED'
        ];

        if (standardStatuses.includes(statusUpper)) {
            return statusUpper;
        }

        // Return original if no mapping found
        return statusUpper;
    }

    // Validation methods
    validateNormalizedData(data) {
        const errors = [];

        for (const [field, rules] of Object.entries(this.normalizationRules)) {
            if (rules.required && (data[field] === undefined || data[field] === null)) {
                errors.push(`Required field '${field}' is missing`);
            }

            if (data[field] !== undefined && rules.validate) {
                try {
                    const isValid = rules.validate(data[field]);
                    if (!isValid) {
                        errors.push(`Field '${field}' validation failed`);
                    }
                } catch (error) {
                    errors.push(`Field '${field}' validation error: ${error.message}`);
                }
            }
        }

        return errors;
    }

    validateContainerNumber(containerNumber) {
        if (!containerNumber) return false;
        
        const containerRegex = /^[A-Z]{4}[0-9]{7}$/;
        return containerRegex.test(containerNumber);
    }

    validateTimestamp(timestamp) {
        if (!timestamp) return false;
        
        const date = new Date(timestamp);
        return !isNaN(date.getTime());
    }

    validateLocation(location) {
        if (!location) return true; // Optional field
        
        return typeof location === 'object' && location.name;
    }

    validateVessel(vessel) {
        if (!vessel) return true; // Optional field
        
        return typeof vessel === 'object' && vessel.name;
    }

    validateStatus(status) {
        return status && typeof status === 'string' && status.length > 0;
    }

    // Enrichment methods
    async enrichLocation(location) {
        if (!location || !location.code) return location;

        // Check cache first
        if (this.locationCache.has(location.code)) {
            return { ...location, ...this.locationCache.get(location.code) };
        }

        // Mock location enrichment
        const enriched = {
            timezone: this.getTimezoneForLocation(location.code),
            portType: this.getPortType(location.code),
            region: this.getRegion(location.country)
        };

        this.locationCache.set(location.code, enriched);
        return { ...location, ...enriched };
    }

    async enrichVessel(vessel) {
        if (!vessel || !vessel.imo) return vessel;

        // Check cache first
        if (this.vesselCache.has(vessel.imo)) {
            return { ...vessel, ...this.vesselCache.get(vessel.imo) };
        }

        // Mock vessel enrichment
        const enriched = {
            vesselType: 'Container Ship',
            buildYear: 2015,
            capacity: {
                teu: 18000,
                dwt: 197000
            },
            operator: this.getVesselOperator(vessel.name)
        };

        this.vesselCache.set(vessel.imo, enriched);
        return { ...vessel, ...enriched };
    }

    // Helper methods
    getLatestLocation(container) {
        const events = container.transportEvents || [];
        if (events.length === 0) return null;
        
        const sortedEvents = events.sort((a, b) => new Date(b.eventDateTime) - new Date(a.eventDateTime));
        return sortedEvents[0].location;
    }

    extractContainerSize(containerType) {
        if (!containerType) return null;
        const sizeMatch = containerType.match(/(\d{2})/);
        return sizeMatch ? sizeMatch[1] + 'FT' : null;
    }

    extractContainerSizeCMA(equipmentType) {
        if (!equipmentType) return null;
        const sizePatterns = { '20': '20FT', '40': '40FT', '45': '45FT' };
        for (const [size, description] of Object.entries(sizePatterns)) {
            if (equipmentType.includes(size)) return description;
        }
        return equipmentType;
    }

    extractContainerSizeHL(equipmentType) {
        if (!equipmentType) return null;
        const isoToSize = { '22G1': '20FT', '42G1': '40FT', '45G1': '40FT', 'L5G1': '45FT' };
        return isoToSize[equipmentType] || equipmentType?.substring(0, 2) + 'FT';
    }

    getTimezoneForLocation(locationCode) {
        const timezoneMap = {
            'NLRTM': 'Europe/Amsterdam',
            'DEHAM': 'Europe/Berlin',
            'USNYC': 'America/New_York',
            'CNSHA': 'Asia/Shanghai',
            'SGSIN': 'Asia/Singapore'
        };
        return timezoneMap[locationCode] || 'UTC';
    }

    getPortType(locationCode) {
        // Mock implementation
        return 'Container Terminal';
    }

    getRegion(country) {
        const regionMap = {
            'NL': 'Europe', 'DE': 'Europe', 'GB': 'Europe',
            'US': 'North America', 'CA': 'North America',
            'CN': 'Asia', 'SG': 'Asia', 'JP': 'Asia'
        };
        return regionMap[country] || 'Unknown';
    }

    getVesselOperator(vesselName) {
        // Mock implementation based on vessel name patterns
        if (vesselName?.includes('MAERSK')) return 'Maersk Line';
        if (vesselName?.includes('MSC')) return 'MSC';
        if (vesselName?.includes('CMA')) return 'CMA CGM';
        if (vesselName?.includes('HAPAG')) return 'Hapag-Lloyd';
        return 'Unknown';
    }

    generateEventId() {
        return `norm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Bulk normalization for batch processing
    async normalizeBatch(dataArray, carrier, dataType = 'tracking', batchSize = 100) {
        const results = {
            total: dataArray.length,
            processed: 0,
            successful: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < dataArray.length; i += batchSize) {
            const batch = dataArray.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (data, index) => {
                try {
                    const normalized = await this.normalizeCarrierData(data, carrier, dataType);
                    results.successful++;
                    return normalized;
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        index: i + index,
                        error: error.message,
                        data: data
                    });
                    return null;
                }
            });

            await Promise.all(batchPromises);
            results.processed += batch.length;
            
            console.log(`[DataNormalizer] Processed batch ${Math.floor(i / batchSize) + 1}, ${results.processed}/${results.total} complete`);
        }

        return results;
    }
}

module.exports = DataNormalizer;