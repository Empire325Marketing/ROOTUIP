/**
 * Demo Data Generator
 * Creates realistic container tracking data for live demonstrations
 */

const moment = require('moment');
const crypto = require('crypto');

class DemoDataGenerator {
    constructor() {
        // Realistic container prefixes by carrier
        this.containerPrefixes = {
            'maersk': ['MAEU', 'MSKU', 'MRKU'],
            'msc': ['MSCU', 'MEDU', 'MSMU'],
            'cma-cgm': ['CMAU', 'CGMU', 'CAIU'],
            'hapag-lloyd': ['HLCU', 'HLBU', 'HLXU'],
            'cosco': ['COSU', 'CSNU', 'CBHU'],
            'one': ['ONEU', 'NYKU', 'MOLU']
        };
        
        // Major ports
        this.ports = [
            { code: 'USLAX', name: 'Los Angeles', country: 'US', lat: 33.7406, lng: -118.2706 },
            { code: 'USLGB', name: 'Long Beach', country: 'US', lat: 33.7550, lng: -118.2023 },
            { code: 'USNYC', name: 'New York', country: 'US', lat: 40.6892, lng: -74.0445 },
            { code: 'USOAK', name: 'Oakland', country: 'US', lat: 37.7956, lng: -122.2797 },
            { code: 'USSAV', name: 'Savannah', country: 'US', lat: 32.0835, lng: -81.0998 },
            { code: 'CNSHA', name: 'Shanghai', country: 'CN', lat: 31.2304, lng: 121.4737 },
            { code: 'CNNGB', name: 'Ningbo', country: 'CN', lat: 29.8683, lng: 121.5440 },
            { code: 'SGSIN', name: 'Singapore', country: 'SG', lat: 1.2655, lng: 103.8186 },
            { code: 'NLRTM', name: 'Rotterdam', country: 'NL', lat: 51.9225, lng: 4.4792 },
            { code: 'DEHAM', name: 'Hamburg', country: 'DE', lat: 53.5511, lng: 9.9937 },
            { code: 'AEJEA', name: 'Jebel Ali', country: 'AE', lat: 25.0111, lng: 55.0753 },
            { code: 'KRPUS', name: 'Busan', country: 'KR', lat: 35.1796, lng: 129.0756 }
        ];
        
        // Vessel names
        this.vessels = [
            'Emma Maersk', 'MSC Oscar', 'CMA CGM Antoine', 'Ever Given', 'COSCO Shipping Universe',
            'ONE Innovation', 'HMM Algeciras', 'MSC Gülsün', 'Maersk McKinney', 'Ever Ace',
            'CMA CGM Jacques Saade', 'COSCO Shipping Planet', 'ONE Commitment', 'MSC Mia'
        ];
        
        // Container statuses
        this.statuses = [
            { code: 'gate_in', weight: 15 },
            { code: 'loaded', weight: 20 },
            { code: 'discharged', weight: 20 },
            { code: 'gate_out', weight: 15 },
            { code: 'on_rail', weight: 10 },
            { code: 'off_rail', weight: 10 },
            { code: 'empty_returned', weight: 10 }
        ];
        
        // D&D scenarios
        this.ddScenarios = [
            {
                type: 'port_congestion',
                description: 'Port congestion - container stuck at terminal',
                demurrageDays: 15,
                detentionDays: 0,
                disputeEligible: true
            },
            {
                type: 'customs_hold',
                description: 'Customs examination delay',
                demurrageDays: 7,
                detentionDays: 0,
                disputeEligible: true
            },
            {
                type: 'late_pickup',
                description: 'Container not picked up within free time',
                demurrageDays: 5,
                detentionDays: 12,
                disputeEligible: false
            },
            {
                type: 'equipment_shortage',
                description: 'Chassis shortage at terminal',
                demurrageDays: 8,
                detentionDays: 0,
                disputeEligible: true
            },
            {
                type: 'holiday_delay',
                description: 'Terminal closed for holidays',
                demurrageDays: 4,
                detentionDays: 0,
                disputeEligible: true
            }
        ];
    }

    // Generate container number
    generateContainerNumber(carrier) {
        const prefixes = this.containerPrefixes[carrier] || ['XXXX'];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const numbers = Math.floor(1000000 + Math.random() * 9000000);
        return `${prefix}${numbers}`;
    }

    // Generate realistic container tracking data
    generateContainerTracking(options = {}) {
        const carrier = options.carrier || this.randomCarrier();
        const containerNumber = options.containerNumber || this.generateContainerNumber(carrier);
        const route = this.generateRoute();
        const vessel = this.randomVessel();
        const voyage = 'V' + Math.floor(100 + Math.random() * 900) + this.randomChar();
        
        // Generate journey timeline
        const journeyStart = moment().subtract(30 + Math.random() * 30, 'days');
        const events = this.generateTrackingEvents(journeyStart, route);
        const currentEvent = events[events.length - 1];
        
        // Calculate free time and charges
        const freeTime = this.calculateFreeTime(events);
        const charges = this.calculateCharges(events, freeTime);
        
        return {
            containerNumber,
            carrier,
            status: currentEvent.status,
            location: currentEvent.location,
            timestamp: currentEvent.timestamp,
            vessel: {
                name: vessel,
                voyage: voyage,
                imo: this.generateIMO()
            },
            origin: route.origin,
            destination: route.destination,
            eta: moment(journeyStart).add(35, 'days').toISOString(),
            events: events,
            freeTime: freeTime,
            charges: charges,
            booking: {
                number: 'BKG' + Math.floor(10000000 + Math.random() * 90000000),
                customer: this.generateCustomer(),
                commodity: this.generateCommodity()
            }
        };
    }

    // Generate tracking events
    generateTrackingEvents(startDate, route) {
        const events = [];
        let currentDate = moment(startDate);
        
        // Gate in at origin
        events.push({
            type: 'gate_in',
            status: 'gate_in',
            location: route.origin,
            timestamp: currentDate.toISOString(),
            description: 'Container gated in at terminal'
        });
        
        // Loading
        currentDate.add(1 + Math.random() * 3, 'days');
        events.push({
            type: 'loaded',
            status: 'loaded',
            location: route.origin,
            timestamp: currentDate.toISOString(),
            description: 'Container loaded on vessel'
        });
        
        // Transit events
        route.transshipments.forEach(port => {
            currentDate.add(5 + Math.random() * 10, 'days');
            events.push({
                type: 'discharged',
                status: 'discharged',
                location: port,
                timestamp: currentDate.toISOString(),
                description: 'Container discharged for transshipment'
            });
            
            currentDate.add(1 + Math.random() * 2, 'days');
            events.push({
                type: 'loaded',
                status: 'loaded',
                location: port,
                timestamp: currentDate.toISOString(),
                description: 'Container loaded on connecting vessel'
            });
        });
        
        // Discharge at destination
        currentDate.add(7 + Math.random() * 14, 'days');
        events.push({
            type: 'discharged',
            status: 'discharged',
            location: route.destination,
            timestamp: currentDate.toISOString(),
            description: 'Container discharged at destination'
        });
        
        // Possible additional events based on scenario
        if (Math.random() > 0.3) {
            currentDate.add(1 + Math.random() * 5, 'days');
            events.push({
                type: 'gate_out',
                status: 'gate_out',
                location: route.destination,
                timestamp: currentDate.toISOString(),
                description: 'Container picked up from terminal'
            });
            
            if (Math.random() > 0.5) {
                currentDate.add(5 + Math.random() * 10, 'days');
                events.push({
                    type: 'empty_returned',
                    status: 'empty_returned',
                    location: route.destination,
                    timestamp: currentDate.toISOString(),
                    description: 'Empty container returned to depot'
                });
            }
        }
        
        return events;
    }

    // Generate route
    generateRoute() {
        const originIndex = Math.floor(Math.random() * this.ports.length);
        let destinationIndex = Math.floor(Math.random() * this.ports.length);
        
        // Ensure different origin and destination
        while (destinationIndex === originIndex) {
            destinationIndex = Math.floor(Math.random() * this.ports.length);
        }
        
        const origin = this.ports[originIndex];
        const destination = this.ports[destinationIndex];
        
        // Add transshipment ports for long routes
        const transshipments = [];
        if (Math.random() > 0.5) {
            const transshipPort = this.ports[Math.floor(Math.random() * this.ports.length)];
            if (transshipPort.code !== origin.code && transshipPort.code !== destination.code) {
                transshipments.push(transshipPort);
            }
        }
        
        return { origin, destination, transshipments };
    }

    // Calculate free time
    calculateFreeTime(events) {
        const dischargeEvent = events.find(e => e.type === 'discharged' && e.status === 'discharged');
        if (!dischargeEvent) return null;
        
        const dischargeDate = moment(dischargeEvent.timestamp);
        const demurrageFreeTime = 5; // Standard 5 days
        const detentionFreeTime = 14; // Standard 14 days
        
        return {
            demurrage: {
                days: demurrageFreeTime,
                expires: dischargeDate.clone().add(demurrageFreeTime, 'days').toISOString()
            },
            detention: {
                days: detentionFreeTime,
                expires: dischargeDate.clone().add(detentionFreeTime, 'days').toISOString()
            }
        };
    }

    // Calculate charges
    calculateCharges(events, freeTime) {
        if (!freeTime) return null;
        
        const dischargeEvent = events.find(e => e.type === 'discharged');
        const gateOutEvent = events.find(e => e.type === 'gate_out');
        const emptyReturnEvent = events.find(e => e.type === 'empty_returned');
        
        if (!dischargeEvent) return null;
        
        const charges = [];
        const dischargeDate = moment(dischargeEvent.timestamp);
        
        // Calculate demurrage
        if (gateOutEvent) {
            const gateOutDate = moment(gateOutEvent.timestamp);
            const demurrageDays = Math.max(0, gateOutDate.diff(dischargeDate, 'days') - freeTime.demurrage.days);
            
            if (demurrageDays > 0) {
                const scenario = this.randomDDScenario();
                charges.push({
                    type: 'demurrage',
                    containerNumber: events[0].containerNumber,
                    days: demurrageDays,
                    rate: 150 + Math.random() * 100, // $150-250 per day
                    amount: demurrageDays * (150 + Math.random() * 100),
                    currency: 'USD',
                    startDate: moment(freeTime.demurrage.expires).toISOString(),
                    endDate: gateOutDate.toISOString(),
                    status: 'pending',
                    scenario: scenario.type,
                    description: scenario.description,
                    disputeEligible: scenario.disputeEligible
                });
            }
        }
        
        // Calculate detention
        if (gateOutEvent && emptyReturnEvent) {
            const gateOutDate = moment(gateOutEvent.timestamp);
            const returnDate = moment(emptyReturnEvent.timestamp);
            const detentionDays = Math.max(0, returnDate.diff(gateOutDate, 'days') - freeTime.detention.days);
            
            if (detentionDays > 0) {
                charges.push({
                    type: 'detention',
                    containerNumber: events[0].containerNumber,
                    days: detentionDays,
                    rate: 100 + Math.random() * 50, // $100-150 per day
                    amount: detentionDays * (100 + Math.random() * 50),
                    currency: 'USD',
                    startDate: gateOutDate.clone().add(freeTime.detention.days, 'days').toISOString(),
                    endDate: returnDate.toISOString(),
                    status: 'pending',
                    disputeEligible: false
                });
            }
        }
        
        return charges;
    }

    // Generate D&D charge history
    generateDDChargeHistory(days = 30) {
        const charges = [];
        const startDate = moment().subtract(days, 'days');
        
        for (let i = 0; i < days * 5; i++) { // ~5 charges per day
            const chargeDate = moment(startDate).add(Math.random() * days, 'days');
            const carrier = this.randomCarrier();
            const containerNumber = this.generateContainerNumber(carrier);
            const scenario = this.randomDDScenario();
            
            const charge = {
                id: crypto.randomUUID(),
                containerNumber,
                carrier,
                type: Math.random() > 0.4 ? 'demurrage' : 'detention',
                days: scenario.demurrageDays || Math.floor(1 + Math.random() * 20),
                rate: 150 + Math.random() * 100,
                amount: 0, // Calculated below
                currency: 'USD',
                startDate: chargeDate.toISOString(),
                endDate: chargeDate.clone().add(scenario.demurrageDays || 10, 'days').toISOString(),
                status: this.randomChargeStatus(),
                scenario: scenario.type,
                description: scenario.description,
                disputeEligible: scenario.disputeEligible,
                booking: 'BKG' + Math.floor(10000000 + Math.random() * 90000000),
                invoice: Math.random() > 0.3 ? 'INV' + Math.floor(100000 + Math.random() * 900000) : null,
                customer: this.generateCustomer(),
                port: this.randomPort()
            };
            
            charge.amount = charge.days * charge.rate;
            charges.push(charge);
        }
        
        return charges.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    }

    // Generate dispute cases
    generateDisputeCases(charges) {
        const disputes = [];
        const eligibleCharges = charges.filter(c => c.disputeEligible && c.status === 'pending');
        
        eligibleCharges.slice(0, 10).forEach(charge => {
            const dispute = {
                id: crypto.randomUUID(),
                chargeId: charge.id,
                containerNumber: charge.containerNumber,
                carrier: charge.carrier,
                originalAmount: charge.amount,
                disputedAmount: charge.amount,
                reason: this.getDisputeReason(charge.scenario),
                status: this.randomDisputeStatus(),
                createdDate: moment(charge.startDate).add(5, 'days').toISOString(),
                lastUpdate: moment().subtract(Math.random() * 10, 'days').toISOString(),
                evidence: this.generateEvidence(charge.scenario),
                notes: [],
                outcome: null
            };
            
            // Add outcome for resolved disputes
            if (dispute.status === 'approved' || dispute.status === 'rejected') {
                dispute.outcome = {
                    decision: dispute.status,
                    adjustedAmount: dispute.status === 'approved' ? 0 : charge.amount,
                    savings: dispute.status === 'approved' ? charge.amount : 0,
                    resolvedDate: moment().subtract(Math.random() * 5, 'days').toISOString()
                };
            }
            
            disputes.push(dispute);
        });
        
        return disputes;
    }

    // Generate integration health metrics
    generateIntegrationMetrics() {
        const carriers = Object.keys(this.containerPrefixes);
        const metrics = {};
        
        carriers.forEach(carrier => {
            metrics[carrier] = {
                status: this.randomIntegrationStatus(),
                uptime: 95 + Math.random() * 4.9, // 95-99.9%
                lastSync: moment().subtract(Math.random() * 30, 'minutes').toISOString(),
                recordsProcessed: Math.floor(50000 + Math.random() * 200000),
                errorRate: Math.random() * 0.5, // 0-0.5%
                avgResponseTime: 50 + Math.random() * 150, // 50-200ms
                dataQuality: 85 + Math.random() * 14, // 85-99%
                configuration: {
                    apiEnabled: true,
                    ediEnabled: Math.random() > 0.3,
                    webhooksEnabled: Math.random() > 0.5,
                    rateLimit: Math.floor(60 + Math.random() * 240) // 60-300 req/min
                }
            };
        });
        
        return metrics;
    }

    // Generate real-time events for live demo
    generateLiveEvent() {
        const eventTypes = [
            { type: 'container_update', weight: 40 },
            { type: 'new_charge', weight: 20 },
            { type: 'dispute_update', weight: 10 },
            { type: 'integration_alert', weight: 5 },
            { type: 'webhook_received', weight: 25 }
        ];
        
        const eventType = this.weightedRandom(eventTypes);
        
        switch (eventType) {
            case 'container_update':
                return this.generateContainerUpdateEvent();
            case 'new_charge':
                return this.generateNewChargeEvent();
            case 'dispute_update':
                return this.generateDisputeUpdateEvent();
            case 'integration_alert':
                return this.generateIntegrationAlertEvent();
            case 'webhook_received':
                return this.generateWebhookEvent();
        }
    }

    // Generate container update event
    generateContainerUpdateEvent() {
        const carrier = this.randomCarrier();
        const containerNumber = this.generateContainerNumber(carrier);
        const status = this.randomStatus();
        const port = this.randomPort();
        
        return {
            type: 'container_update',
            timestamp: new Date().toISOString(),
            data: {
                containerNumber,
                carrier,
                previousStatus: 'loaded',
                newStatus: status,
                location: port,
                vessel: this.randomVessel(),
                voyage: 'V' + Math.floor(100 + Math.random() * 900) + this.randomChar()
            }
        };
    }

    // Generate new charge event
    generateNewChargeEvent() {
        const carrier = this.randomCarrier();
        const containerNumber = this.generateContainerNumber(carrier);
        const scenario = this.randomDDScenario();
        
        return {
            type: 'new_charge',
            timestamp: new Date().toISOString(),
            data: {
                containerNumber,
                carrier,
                chargeType: Math.random() > 0.5 ? 'demurrage' : 'detention',
                amount: 1000 + Math.random() * 5000,
                currency: 'USD',
                days: scenario.demurrageDays || Math.floor(1 + Math.random() * 15),
                port: this.randomPort(),
                scenario: scenario.type,
                disputeEligible: scenario.disputeEligible
            }
        };
    }

    // Helper methods
    randomCarrier() {
        const carriers = Object.keys(this.containerPrefixes);
        return carriers[Math.floor(Math.random() * carriers.length)];
    }
    
    randomPort() {
        return this.ports[Math.floor(Math.random() * this.ports.length)];
    }
    
    randomVessel() {
        return this.vessels[Math.floor(Math.random() * this.vessels.length)];
    }
    
    randomStatus() {
        return this.weightedRandom(this.statuses);
    }
    
    randomDDScenario() {
        return this.ddScenarios[Math.floor(Math.random() * this.ddScenarios.length)];
    }
    
    randomChargeStatus() {
        const statuses = ['pending', 'invoiced', 'paid', 'disputed', 'waived'];
        const weights = [40, 30, 20, 8, 2];
        return this.weightedRandomFromArrays(statuses, weights);
    }
    
    randomDisputeStatus() {
        const statuses = ['pending', 'under_review', 'approved', 'rejected'];
        const weights = [30, 40, 20, 10];
        return this.weightedRandomFromArrays(statuses, weights);
    }
    
    randomIntegrationStatus() {
        const statuses = ['connected', 'disconnected', 'error', 'maintenance'];
        const weights = [85, 5, 8, 2];
        return this.weightedRandomFromArrays(statuses, weights);
    }
    
    randomChar() {
        return String.fromCharCode(65 + Math.floor(Math.random() * 26));
    }
    
    generateIMO() {
        return 'IMO' + Math.floor(1000000 + Math.random() * 9000000);
    }
    
    generateCustomer() {
        const customers = [
            'Global Logistics Inc', 'Pacific Shipping Co', 'Atlantic Transport Ltd',
            'Express Cargo Services', 'Continental Freight', 'Maritime Solutions LLC',
            'Ocean Bridge Logistics', 'TradeWind Shipping', 'Apex Global Transport'
        ];
        return customers[Math.floor(Math.random() * customers.length)];
    }
    
    generateCommodity() {
        const commodities = [
            'Electronics', 'Auto Parts', 'Textiles', 'Machinery', 'Consumer Goods',
            'Chemicals (Non-Hazardous)', 'Food Products', 'Raw Materials', 'Medical Supplies'
        ];
        return commodities[Math.floor(Math.random() * commodities.length)];
    }
    
    getDisputeReason(scenario) {
        const reasons = {
            'port_congestion': 'Port congestion beyond carrier control',
            'customs_hold': 'Government inspection delay',
            'equipment_shortage': 'Terminal equipment unavailability',
            'holiday_delay': 'Terminal closed for public holiday',
            'late_pickup': 'Customer failed to pickup within free time'
        };
        return reasons[scenario] || 'Operational delay';
    }
    
    generateEvidence(scenario) {
        const evidence = {
            'port_congestion': ['Port congestion notice', 'Terminal wait time report', 'VGM submission proof'],
            'customs_hold': ['Customs exam notice', 'Hold release documentation'],
            'equipment_shortage': ['Terminal equipment report', 'Chassis availability notice'],
            'holiday_delay': ['Terminal holiday schedule', 'Carrier notice'],
            'late_pickup': ['Pickup appointment history', 'Free time calculation']
        };
        return evidence[scenario] || ['Supporting documentation'];
    }
    
    weightedRandom(items) {
        const weights = items.map(item => item.weight);
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < items.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return items[i].code || items[i].type;
            }
        }
        
        return items[0].code || items[0].type;
    }
    
    weightedRandomFromArrays(items, weights) {
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < items.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return items[i];
            }
        }
        
        return items[0];
    }

    // Generate dispute update event
    generateDisputeUpdateEvent() {
        return {
            type: 'dispute_update',
            timestamp: new Date().toISOString(),
            data: {
                disputeId: crypto.randomUUID(),
                containerNumber: this.generateContainerNumber(this.randomCarrier()),
                previousStatus: 'pending',
                newStatus: 'under_review',
                amount: 2000 + Math.random() * 8000,
                carrier: this.randomCarrier()
            }
        };
    }

    // Generate integration alert event
    generateIntegrationAlertEvent() {
        const alerts = [
            { type: 'connection_lost', severity: 'error' },
            { type: 'rate_limit_warning', severity: 'warning' },
            { type: 'data_quality_issue', severity: 'warning' },
            { type: 'authentication_expiring', severity: 'info' }
        ];
        
        const alert = alerts[Math.floor(Math.random() * alerts.length)];
        
        return {
            type: 'integration_alert',
            timestamp: new Date().toISOString(),
            data: {
                carrier: this.randomCarrier(),
                alertType: alert.type,
                severity: alert.severity,
                message: this.getAlertMessage(alert.type)
            }
        };
    }

    // Generate webhook event
    generateWebhookEvent() {
        return {
            type: 'webhook_received',
            timestamp: new Date().toISOString(),
            data: {
                carrier: this.randomCarrier(),
                webhookType: 'container_event',
                containerNumber: this.generateContainerNumber(this.randomCarrier()),
                event: this.randomStatus()
            }
        };
    }

    // Get alert message
    getAlertMessage(alertType) {
        const messages = {
            'connection_lost': 'Lost connection to carrier API',
            'rate_limit_warning': 'Approaching API rate limit (90% used)',
            'data_quality_issue': 'Missing required fields in recent data',
            'authentication_expiring': 'API credentials expire in 7 days'
        };
        return messages[alertType] || 'System alert';
    }
}

module.exports = DemoDataGenerator;