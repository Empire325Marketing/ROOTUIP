// ROOTUIP Demo Data Generator
const crypto = require('crypto');

class DemoDataGenerator {
    constructor() {
        this.vessels = this.generateVessels();
        this.ports = this.generatePorts();
        this.carriers = this.generateCarriers();
        this.companies = this.generateCompanies();
        this.currentDate = new Date();
    }

    // Generate realistic vessel data
    generateVessels() {
        const vesselPrefixes = ['MSC', 'MAERSK', 'CMA CGM', 'COSCO', 'HAPAG-LLOYD', 'ONE', 'EVERGREEN', 'YANG MING'];
        const vesselNames = ['GULSUN', 'OLIVER', 'MEGAMAX', 'TAURUS', 'AMBITION', 'EXCELLENCE', 'TRIUMPH', 'GALAXY', 
                            'HORIZON', 'PIONEER', 'NAVIGATOR', 'EXPLORER', 'ENDEAVOR', 'VOYAGER', 'ODYSSEY'];
        
        const vessels = [];
        for (let i = 0; i < 50; i++) {
            const carrier = vesselPrefixes[Math.floor(Math.random() * vesselPrefixes.length)];
            const name = vesselNames[Math.floor(Math.random() * vesselNames.length)];
            const teu = Math.floor(Math.random() * 15000) + 8000; // 8,000 to 23,000 TEU
            
            vessels.push({
                id: `vessel-${i}`,
                imo: 9000000 + Math.floor(Math.random() * 999999),
                mmsi: 200000000 + Math.floor(Math.random() * 99999999),
                name: `${carrier} ${name}`,
                carrier: carrier,
                teu: teu,
                class: teu > 20000 ? 'ULCV' : teu > 15000 ? 'Neo-Panamax' : 'Large Container',
                flag: this.randomFrom(['Panama', 'Liberia', 'Marshall Islands', 'Hong Kong', 'Singapore', 'Malta']),
                yearBuilt: 2010 + Math.floor(Math.random() * 15),
                length: Math.floor(teu / 50) + 200, // Approximate length in meters
                beam: Math.floor(teu / 400) + 40,   // Approximate beam in meters
                maxSpeed: 22 + Math.random() * 4,   // 22-26 knots
                currentSpeed: Math.random() * 20,   // 0-20 knots
                position: this.generatePosition(),
                destination: null,
                eta: null,
                status: this.randomFrom(['At Sea', 'In Port', 'Anchored', 'Approaching Port'])
            });
        }
        return vessels;
    }

    // Generate realistic port data
    generatePorts() {
        return [
            { id: 'CNSHA', name: 'Shanghai', country: 'China', lat: 31.2304, lon: 121.4737, timezone: 'Asia/Shanghai', congestionLevel: 0.7 },
            { id: 'SGSIN', name: 'Singapore', country: 'Singapore', lat: 1.3521, lon: 103.8198, timezone: 'Asia/Singapore', congestionLevel: 0.6 },
            { id: 'NLRTM', name: 'Rotterdam', country: 'Netherlands', lat: 51.9244, lon: 4.4777, timezone: 'Europe/Amsterdam', congestionLevel: 0.65 },
            { id: 'DEHAM', name: 'Hamburg', country: 'Germany', lat: 53.5511, lon: 9.9937, timezone: 'Europe/Berlin', congestionLevel: 0.55 },
            { id: 'USLA', name: 'Los Angeles', country: 'USA', lat: 33.7406, lon: -118.2706, timezone: 'America/Los_Angeles', congestionLevel: 0.8 },
            { id: 'USLGB', name: 'Long Beach', country: 'USA', lat: 33.7563, lon: -118.1898, timezone: 'America/Los_Angeles', congestionLevel: 0.75 },
            { id: 'AEDXB', name: 'Dubai', country: 'UAE', lat: 25.2769, lon: 55.2962, timezone: 'Asia/Dubai', congestionLevel: 0.5 },
            { id: 'HKHKG', name: 'Hong Kong', country: 'Hong Kong', lat: 22.3193, lon: 114.1694, timezone: 'Asia/Hong_Kong', congestionLevel: 0.6 },
            { id: 'KRPUS', name: 'Busan', country: 'South Korea', lat: 35.1796, lon: 129.0756, timezone: 'Asia/Seoul', congestionLevel: 0.55 },
            { id: 'JPYOK', name: 'Yokohama', country: 'Japan', lat: 35.4437, lon: 139.6380, timezone: 'Asia/Tokyo', congestionLevel: 0.45 },
            { id: 'BEANR', name: 'Antwerp', country: 'Belgium', lat: 51.2194, lon: 4.4025, timezone: 'Europe/Brussels', congestionLevel: 0.6 },
            { id: 'GBFXT', name: 'Felixstowe', country: 'UK', lat: 51.9570, lon: 1.3514, timezone: 'Europe/London', congestionLevel: 0.5 },
            { id: 'MYPKG', name: 'Port Klang', country: 'Malaysia', lat: 3.0000, lon: 101.4000, timezone: 'Asia/Kuala_Lumpur', congestionLevel: 0.55 },
            { id: 'INWFD', name: 'Mumbai', country: 'India', lat: 18.9388, lon: 72.8356, timezone: 'Asia/Kolkata', congestionLevel: 0.7 },
            { id: 'BRSSZ', name: 'Santos', country: 'Brazil', lat: -23.9608, lon: -46.3365, timezone: 'America/Sao_Paulo', congestionLevel: 0.65 }
        ];
    }

    // Generate carrier data
    generateCarriers() {
        return [
            { id: 'MAEU', name: 'Maersk', fullName: 'A.P. Moller-Maersk', code: 'MAEU', color: '#42B0D5' },
            { id: 'MSCU', name: 'MSC', fullName: 'Mediterranean Shipping Company', code: 'MSCU', color: '#FFD700' },
            { id: 'CMDU', name: 'CMA CGM', fullName: 'CMA CGM Group', code: 'CMDU', color: '#E30613' },
            { id: 'COSU', name: 'COSCO', fullName: 'COSCO Shipping', code: 'COSU', color: '#005EB8' },
            { id: 'HLCU', name: 'Hapag-Lloyd', fullName: 'Hapag-Lloyd AG', code: 'HLCU', color: '#F37021' },
            { id: 'ONEY', name: 'ONE', fullName: 'Ocean Network Express', code: 'ONEY', color: '#FF00FF' },
            { id: 'EGLV', name: 'Evergreen', fullName: 'Evergreen Marine', code: 'EGLV', color: '#00A650' },
            { id: 'YMLU', name: 'Yang Ming', fullName: 'Yang Ming Marine Transport', code: 'YMLU', color: '#0072BC' }
        ];
    }

    // Generate company data
    generateCompanies() {
        const industries = ['Manufacturing', 'Retail', 'Automotive', 'Electronics', 'Pharmaceuticals', 'Food & Beverage'];
        const sizes = ['1-50', '51-200', '201-1000', '1001-5000', '5000+'];
        
        return [
            {
                id: 'ACME001',
                name: 'Acme Corporation',
                industry: 'Manufacturing',
                size: '1001-5000',
                annualTEU: 12000,
                primaryRoutes: ['transpacific', 'asia-europe']
            },
            {
                id: 'GLOBAL001',
                name: 'Global Logistics Inc',
                industry: 'Logistics',
                size: '201-1000',
                annualTEU: 8500,
                primaryRoutes: ['transpacific', 'transatlantic']
            },
            {
                id: 'OCEAN001',
                name: 'Ocean Freight Co',
                industry: 'Freight Forwarding',
                size: '51-200',
                annualTEU: 5000,
                primaryRoutes: ['asia-europe', 'intra-asia']
            }
        ];
    }

    // Generate realistic shipment data
    generateShipment(companyId) {
        const origin = this.randomFrom(this.ports);
        const destination = this.randomFrom(this.ports.filter(p => p.id !== origin.id));
        const vessel = this.randomFrom(this.vessels);
        const carrier = this.carriers.find(c => c.name === vessel.carrier);
        
        const departureDate = new Date(this.currentDate);
        departureDate.setDate(departureDate.getDate() + Math.floor(Math.random() * 14)); // 0-14 days from now
        
        const transitTime = this.calculateTransitTime(origin, destination);
        const arrivalDate = new Date(departureDate);
        arrivalDate.setDate(arrivalDate.getDate() + transitTime);
        
        const containerCount = Math.floor(Math.random() * 50) + 1; // 1-50 containers
        const status = this.getShipmentStatus(departureDate, arrivalDate);
        
        return {
            id: `SHP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            blNumber: `${carrier.code}${Math.floor(Math.random() * 999999999)}`,
            companyId: companyId,
            origin: origin,
            destination: destination,
            vessel: vessel,
            carrier: carrier,
            containers: this.generateContainers(containerCount, carrier.code),
            departureDate: departureDate,
            arrivalDate: arrivalDate,
            status: status,
            cargoType: this.randomFrom(['Dry', 'Reefer', 'Dangerous Goods', 'Out of Gauge']),
            totalWeight: containerCount * (20 + Math.random() * 10), // tons
            totalValue: containerCount * (50000 + Math.random() * 150000), // USD
            ddRisk: this.calculateDDRisk(origin, destination, vessel, status),
            documents: this.generateDocuments(),
            milestones: this.generateMilestones(departureDate, arrivalDate, status),
            created: new Date(this.currentDate.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Up to 30 days ago
        };
    }

    // Generate containers
    generateContainers(count, carrierCode) {
        const containers = [];
        const types = ['20DC', '40DC', '40HC', '20RF', '40RF'];
        const prefixes = ['MAEU', 'MSCU', 'CMDU', 'COSU', 'HLCU', 'ONEY', 'EGLV', 'YMLU'];
        
        for (let i = 0; i < count; i++) {
            containers.push({
                number: `${this.randomFrom(prefixes)}${Math.floor(Math.random() * 9999999)}`,
                type: this.randomFrom(types),
                sealNumber: `SEAL${Math.floor(Math.random() * 999999)}`,
                weight: 20 + Math.random() * 10, // tons
                status: this.randomFrom(['Loaded', 'In Transit', 'Discharged', 'Available']),
                location: null
            });
        }
        
        return containers;
    }

    // Generate realistic milestones
    generateMilestones(departureDate, arrivalDate, status) {
        const milestones = [
            {
                event: 'Booking Confirmed',
                plannedDate: new Date(departureDate.getTime() - 7 * 24 * 60 * 60 * 1000),
                actualDate: new Date(departureDate.getTime() - 7 * 24 * 60 * 60 * 1000),
                location: 'System',
                status: 'completed'
            },
            {
                event: 'Empty Container Released',
                plannedDate: new Date(departureDate.getTime() - 3 * 24 * 60 * 60 * 1000),
                actualDate: new Date(departureDate.getTime() - 3 * 24 * 60 * 60 * 1000),
                location: 'Depot',
                status: 'completed'
            },
            {
                event: 'Cargo Loaded',
                plannedDate: new Date(departureDate.getTime() - 2 * 24 * 60 * 60 * 1000),
                actualDate: new Date(departureDate.getTime() - 2 * 24 * 60 * 60 * 1000),
                location: 'Shipper Facility',
                status: 'completed'
            },
            {
                event: 'Gate In',
                plannedDate: new Date(departureDate.getTime() - 1 * 24 * 60 * 60 * 1000),
                actualDate: null,
                location: 'Origin Port',
                status: status === 'Booked' ? 'pending' : 'completed'
            },
            {
                event: 'Loaded on Vessel',
                plannedDate: departureDate,
                actualDate: null,
                location: 'Origin Port',
                status: ['In Transit', 'Arrived', 'Delivered'].includes(status) ? 'completed' : 'pending'
            },
            {
                event: 'Departed',
                plannedDate: departureDate,
                actualDate: null,
                location: 'Origin Port',
                status: ['In Transit', 'Arrived', 'Delivered'].includes(status) ? 'completed' : 'pending'
            },
            {
                event: 'Arrived at Port',
                plannedDate: arrivalDate,
                actualDate: null,
                location: 'Destination Port',
                status: ['Arrived', 'Delivered'].includes(status) ? 'completed' : 'pending'
            },
            {
                event: 'Discharged',
                plannedDate: new Date(arrivalDate.getTime() + 1 * 24 * 60 * 60 * 1000),
                actualDate: null,
                location: 'Destination Port',
                status: status === 'Delivered' ? 'completed' : 'pending'
            },
            {
                event: 'Available for Pickup',
                plannedDate: new Date(arrivalDate.getTime() + 2 * 24 * 60 * 60 * 1000),
                actualDate: null,
                location: 'Destination Port',
                status: status === 'Delivered' ? 'completed' : 'pending'
            }
        ];
        
        // Set actual dates for completed milestones
        const now = new Date();
        milestones.forEach(milestone => {
            if (milestone.status === 'completed' && milestone.plannedDate < now) {
                milestone.actualDate = new Date(milestone.plannedDate.getTime() + Math.random() * 6 * 60 * 60 * 1000); // +0-6 hours variance
            }
        });
        
        return milestones;
    }

    // Generate documents
    generateDocuments() {
        return [
            {
                type: 'Bill of Lading',
                number: `BL-${Date.now()}`,
                status: 'Issued',
                issueDate: new Date(this.currentDate.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000),
                url: '/documents/bl-sample.pdf'
            },
            {
                type: 'Commercial Invoice',
                number: `INV-${Date.now()}`,
                status: 'Verified',
                issueDate: new Date(this.currentDate.getTime() - Math.random() * 10 * 24 * 60 * 60 * 1000),
                url: '/documents/invoice-sample.pdf'
            },
            {
                type: 'Packing List',
                number: `PL-${Date.now()}`,
                status: 'Approved',
                issueDate: new Date(this.currentDate.getTime() - Math.random() * 10 * 24 * 60 * 60 * 1000),
                url: '/documents/packing-list-sample.pdf'
            }
        ];
    }

    // Calculate realistic transit time based on route
    calculateTransitTime(origin, destination) {
        const distance = this.calculateDistance(origin.lat, origin.lon, destination.lat, destination.lon);
        const avgSpeed = 20; // knots
        const hoursAtSea = distance / avgSpeed;
        const daysAtSea = Math.ceil(hoursAtSea / 24);
        const portTime = 2; // days for loading/unloading
        
        return daysAtSea + portTime;
    }

    // Calculate distance between two points
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 3440; // Radius of Earth in nautical miles
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(deg) {
        return deg * (Math.PI/180);
    }

    // Calculate D&D risk
    calculateDDRisk(origin, destination, vessel, status) {
        let riskScore = 0;
        
        // Port congestion factor
        riskScore += origin.congestionLevel * 0.3;
        riskScore += destination.congestionLevel * 0.3;
        
        // Vessel size factor (larger vessels = higher risk)
        riskScore += (vessel.teu / 25000) * 0.2;
        
        // Time factor (closer to arrival = higher risk if still in transit)
        if (status === 'In Transit') {
            riskScore += 0.2;
        }
        
        // Random variance
        riskScore += Math.random() * 0.2;
        
        return {
            score: Math.min(riskScore, 1),
            level: riskScore < 0.3 ? 'Low' : riskScore < 0.7 ? 'Medium' : 'High',
            factors: {
                originCongestion: origin.congestionLevel,
                destinationCongestion: destination.congestionLevel,
                vesselSize: vessel.teu,
                currentStatus: status
            }
        };
    }

    // Get shipment status based on dates
    getShipmentStatus(departureDate, arrivalDate) {
        const now = new Date();
        
        if (now < departureDate) {
            return 'Booked';
        } else if (now >= departureDate && now < arrivalDate) {
            return 'In Transit';
        } else if (now >= arrivalDate && now < new Date(arrivalDate.getTime() + 2 * 24 * 60 * 60 * 1000)) {
            return 'Arrived';
        } else {
            return 'Delivered';
        }
    }

    // Generate vessel position
    generatePosition() {
        // Random position in major shipping lanes
        const routes = [
            { latMin: 20, latMax: 40, lonMin: -180, lonMax: -120 }, // Pacific
            { latMin: 30, latMax: 60, lonMin: -80, lonMax: -10 },   // Atlantic
            { latMin: -10, latMax: 30, lonMin: 30, lonMax: 120 },   // Indian Ocean
            { latMin: 20, latMax: 40, lonMin: 100, lonMax: 140 }    // Asia-Pacific
        ];
        
        const route = this.randomFrom(routes);
        return {
            lat: route.latMin + Math.random() * (route.latMax - route.latMin),
            lon: route.lonMin + Math.random() * (route.lonMax - route.lonMin),
            timestamp: new Date()
        };
    }

    // Utility function to get random element from array
    randomFrom(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    // Generate complete demo dataset
    generateDemoData() {
        const data = {
            companies: this.companies,
            vessels: this.vessels,
            ports: this.ports,
            carriers: this.carriers,
            shipments: [],
            notifications: [],
            analytics: {}
        };

        // Generate shipments for each company
        this.companies.forEach(company => {
            const shipmentCount = Math.floor(Math.random() * 20) + 10; // 10-30 shipments per company
            for (let i = 0; i < shipmentCount; i++) {
                data.shipments.push(this.generateShipment(company.id));
            }
        });

        // Generate notifications
        data.notifications = this.generateNotifications(data.shipments);

        // Generate analytics
        data.analytics = this.generateAnalytics(data.shipments);

        return data;
    }

    // Generate realistic notifications
    generateNotifications(shipments) {
        const notifications = [];
        const types = ['vessel_delay', 'document_required', 'dd_risk_alert', 'arrival_notice', 'customs_clearance'];
        
        shipments.slice(0, 10).forEach(shipment => {
            if (Math.random() > 0.5) {
                notifications.push({
                    id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    type: this.randomFrom(types),
                    severity: this.randomFrom(['info', 'warning', 'critical']),
                    shipmentId: shipment.id,
                    title: this.getNotificationTitle(this.randomFrom(types)),
                    message: this.getNotificationMessage(this.randomFrom(types), shipment),
                    timestamp: new Date(Date.now() - Math.random() * 48 * 60 * 60 * 1000), // Last 48 hours
                    read: Math.random() > 0.3
                });
            }
        });
        
        return notifications.sort((a, b) => b.timestamp - a.timestamp);
    }

    getNotificationTitle(type) {
        const titles = {
            vessel_delay: 'Vessel Delay Alert',
            document_required: 'Document Required',
            dd_risk_alert: 'D&D Risk Alert',
            arrival_notice: 'Arrival Notice',
            customs_clearance: 'Customs Update'
        };
        return titles[type];
    }

    getNotificationMessage(type, shipment) {
        const messages = {
            vessel_delay: `${shipment.vessel.name} delayed by 12 hours due to port congestion`,
            document_required: `Original Bill of Lading required for ${shipment.blNumber}`,
            dd_risk_alert: `High D&D risk detected for containers at ${shipment.destination.name}`,
            arrival_notice: `${shipment.vessel.name} arrived at ${shipment.destination.name}`,
            customs_clearance: `Customs clearance completed for ${shipment.containers.length} containers`
        };
        return messages[type];
    }

    // Generate analytics data
    generateAnalytics(shipments) {
        const analytics = {
            overview: {
                totalShipments: shipments.length,
                activeShipments: shipments.filter(s => ['Booked', 'In Transit'].includes(s.status)).length,
                deliveredShipments: shipments.filter(s => s.status === 'Delivered').length,
                totalContainers: shipments.reduce((sum, s) => sum + s.containers.length, 0),
                totalValue: shipments.reduce((sum, s) => sum + s.totalValue, 0),
                avgTransitTime: this.calculateAvgTransitTime(shipments),
                onTimeDeliveryRate: 0.945,
                ddChargesAvoided: Math.floor(Math.random() * 500000) + 1000000
            },
            byCarrier: this.analyzeByCarrier(shipments),
            byRoute: this.analyzeByRoute(shipments),
            byMonth: this.analyzeByMonth(shipments),
            riskAnalysis: this.analyzeRisks(shipments)
        };
        
        return analytics;
    }

    calculateAvgTransitTime(shipments) {
        const transitTimes = shipments
            .filter(s => s.status === 'Delivered')
            .map(s => (s.arrivalDate - s.departureDate) / (1000 * 60 * 60 * 24));
        
        return transitTimes.length > 0 
            ? Math.round(transitTimes.reduce((a, b) => a + b, 0) / transitTimes.length)
            : 0;
    }

    analyzeByCarrier(shipments) {
        const byCarrier = {};
        
        this.carriers.forEach(carrier => {
            const carrierShipments = shipments.filter(s => s.carrier.id === carrier.id);
            byCarrier[carrier.name] = {
                shipments: carrierShipments.length,
                containers: carrierShipments.reduce((sum, s) => sum + s.containers.length, 0),
                onTimeRate: 0.9 + Math.random() * 0.09, // 90-99%
                avgTransitTime: 10 + Math.random() * 20 // 10-30 days
            };
        });
        
        return byCarrier;
    }

    analyzeByRoute(shipments) {
        const routes = ['Asia-Europe', 'Transpacific', 'Transatlantic', 'Intra-Asia'];
        const byRoute = {};
        
        routes.forEach(route => {
            byRoute[route] = {
                shipments: Math.floor(shipments.length / routes.length) + Math.floor(Math.random() * 10),
                avgTransitTime: 10 + Math.random() * 25,
                utilizationRate: 0.7 + Math.random() * 0.25
            };
        });
        
        return byRoute;
    }

    analyzeByMonth(shipments) {
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            
            months.push({
                month: date.toLocaleString('default', { month: 'short' }),
                year: date.getFullYear(),
                shipments: 80 + Math.floor(Math.random() * 40),
                containers: 800 + Math.floor(Math.random() * 400),
                value: 8000000 + Math.floor(Math.random() * 4000000)
            });
        }
        
        return months;
    }

    analyzeRisks(shipments) {
        const activeShipments = shipments.filter(s => ['Booked', 'In Transit'].includes(s.status));
        
        return {
            highRisk: activeShipments.filter(s => s.ddRisk.level === 'High').length,
            mediumRisk: activeShipments.filter(s => s.ddRisk.level === 'Medium').length,
            lowRisk: activeShipments.filter(s => s.ddRisk.level === 'Low').length,
            totalAtRisk: activeShipments.filter(s => s.ddRisk.score > 0.5).length,
            estimatedCharges: activeShipments
                .filter(s => s.ddRisk.score > 0.5)
                .reduce((sum, s) => sum + (s.containers.length * 150 * s.ddRisk.score), 0)
        };
    }
}

// Export for use
module.exports = DemoDataGenerator;