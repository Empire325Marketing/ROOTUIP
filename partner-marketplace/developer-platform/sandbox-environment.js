/**
 * ROOTUIP Sandbox Environment
 * Safe testing environment for partner integrations
 */

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class SandboxEnvironment extends EventEmitter {
    constructor() {
        super();
        
        // Sandbox configuration
        this.config = {
            dataRetentionDays: 30,
            rateLimits: {
                default: 10000, // 10k requests per hour
                burst: 100 // 100 requests per minute burst
            },
            features: {
                webhooks: true,
                realTimeTracking: true,
                bulkOperations: true,
                customWorkflows: true
            }
        };
        
        // Sandbox data stores
        this.sandboxData = {
            containers: new Map(),
            shipments: new Map(),
            bookings: new Map(),
            documents: new Map(),
            webhooks: new Map()
        };
        
        // Test data generators
        this.testDataGenerators = {
            containers: this.generateTestContainers.bind(this),
            shipments: this.generateTestShipments.bind(this),
            events: this.generateTestEvents.bind(this),
            documents: this.generateTestDocuments.bind(this)
        };
        
        // Sandbox accounts
        this.sandboxAccounts = new Map();
        
        this.initialize();
    }
    
    async initialize() {
        // Preload test data
        await this.loadTestData();
        
        // Start event simulation
        this.startEventSimulation();
        
        console.log('Sandbox Environment initialized');
    }
    
    // Create sandbox account
    async createSandboxAccount(partnerData) {
        const account = {
            id: uuidv4(),
            partnerId: partnerData.partnerId,
            apiKey: this.generateSandboxAPIKey(),
            secretKey: this.generateSecretKey(),
            environment: 'sandbox',
            created: new Date(),
            limits: {
                containers: 1000,
                shipments: 500,
                webhooks: 10,
                apiCalls: 10000
            },
            usage: {
                containers: 0,
                shipments: 0,
                webhooks: 0,
                apiCalls: 0
            },
            testData: {
                containersGenerated: false,
                shipmentsGenerated: false
            }
        };
        
        this.sandboxAccounts.set(account.apiKey, account);
        
        // Generate initial test data
        await this.generateAccountTestData(account);
        
        return account;
    }
    
    // Generate test data for account
    async generateAccountTestData(account) {
        // Generate test containers
        const containers = await this.generateTestContainers(10);
        containers.forEach(container => {
            container.accountId = account.id;
            this.sandboxData.containers.set(container.containerId, container);
        });
        
        // Generate test shipments
        const shipments = await this.generateTestShipments(5);
        shipments.forEach(shipment => {
            shipment.accountId = account.id;
            this.sandboxData.shipments.set(shipment.id, shipment);
        });
        
        account.testData.containersGenerated = true;
        account.testData.shipmentsGenerated = true;
        
        return {
            containers: containers.map(c => c.containerId),
            shipments: shipments.map(s => s.id)
        };
    }
    
    // Generate test containers
    async generateTestContainers(count = 10) {
        const containers = [];
        const ports = ['CNSHA', 'SGSIN', 'USOAK', 'DEHAM', 'NLRTM', 'BEANR'];
        const statuses = ['in_transit', 'at_port', 'on_vessel', 'delivered', 'customs_hold'];
        const carriers = ['Maersk Line', 'MSC', 'CMA CGM', 'COSCO', 'Hapag-Lloyd'];
        
        for (let i = 0; i < count; i++) {
            const origin = ports[Math.floor(Math.random() * ports.length)];
            let destination;
            do {
                destination = ports[Math.floor(Math.random() * ports.length)];
            } while (destination === origin);
            
            const container = {
                containerId: `TEST${Math.random().toString(36).substr(2, 7).toUpperCase()}`,
                shipmentId: `SHIP-TEST-${i + 1}`,
                status: statuses[Math.floor(Math.random() * statuses.length)],
                type: Math.random() > 0.5 ? '40HC' : '20GP',
                
                location: this.generateLocation(),
                
                origin: {
                    port: origin,
                    portName: this.getPortName(origin),
                    departureDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
                },
                
                destination: {
                    port: destination,
                    portName: this.getPortName(destination),
                    eta: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000)
                },
                
                vessel: {
                    name: `${carriers[Math.floor(Math.random() * carriers.length)]} VESSEL`,
                    imo: `9${Math.floor(Math.random() * 900000 + 100000)}`,
                    voyage: `W${Math.floor(Math.random() * 900 + 100)}`
                },
                
                cargo: {
                    description: this.getRandomCargo(),
                    weight: Math.floor(Math.random() * 25000 + 5000),
                    weightUnit: 'kg'
                },
                
                milestones: [],
                events: [],
                documents: [],
                
                createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
                updatedAt: new Date()
            };
            
            // Generate milestones
            container.milestones = this.generateMilestones(container);
            
            containers.push(container);
        }
        
        return containers;
    }
    
    // Generate test shipments
    async generateTestShipments(count = 5) {
        const shipments = [];
        const statuses = ['draft', 'booked', 'in_transit', 'delivered', 'cancelled'];
        
        for (let i = 0; i < count; i++) {
            const shipment = {
                id: `SHIP-TEST-${Date.now()}-${i}`,
                reference: `PO-TEST-${Math.floor(Math.random() * 9000 + 1000)}`,
                status: statuses[Math.floor(Math.random() * statuses.length)],
                
                origin: {
                    port: 'CNSHA',
                    address: {
                        company: 'Test Exporter Co.',
                        street: '123 Test Export St',
                        city: 'Shanghai',
                        country: 'CN'
                    }
                },
                
                destination: {
                    port: 'USOAK',
                    address: {
                        company: 'Test Importer Inc.',
                        street: '456 Test Import Ave',
                        city: 'Oakland',
                        state: 'CA',
                        country: 'US'
                    }
                },
                
                cargo: {
                    type: 'FCL',
                    containers: Math.floor(Math.random() * 5 + 1),
                    totalWeight: Math.floor(Math.random() * 50000 + 10000),
                    weightUnit: 'kg',
                    description: this.getRandomCargo()
                },
                
                documents: [],
                containers: [],
                
                createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
                updatedAt: new Date()
            };
            
            shipments.push(shipment);
        }
        
        return shipments;
    }
    
    // Generate test events
    generateTestEvents(containerId, count = 5) {
        const events = [];
        const eventTypes = [
            'status_change',
            'location_update',
            'document_uploaded',
            'milestone_reached',
            'customs_cleared',
            'temperature_alert'
        ];
        
        for (let i = 0; i < count; i++) {
            const event = {
                id: uuidv4(),
                containerId,
                type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
                timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
                data: this.generateEventData(eventTypes[i])
            };
            
            events.push(event);
        }
        
        return events.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    // Generate test documents
    generateTestDocuments(shipmentId) {
        const documentTypes = [
            { type: 'bill_of_lading', name: 'Bill of Lading' },
            { type: 'commercial_invoice', name: 'Commercial Invoice' },
            { type: 'packing_list', name: 'Packing List' },
            { type: 'certificate_of_origin', name: 'Certificate of Origin' },
            { type: 'customs_declaration', name: 'Customs Declaration' }
        ];
        
        const documents = [];
        
        // Generate random subset of documents
        const numDocs = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < numDocs && i < documentTypes.length; i++) {
            const docType = documentTypes[i];
            
            documents.push({
                id: uuidv4(),
                shipmentId,
                type: docType.type,
                name: `${docType.name}_${shipmentId}.pdf`,
                size: Math.floor(Math.random() * 500000 + 100000), // 100KB - 500KB
                mimeType: 'application/pdf',
                uploadedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
                status: 'validated',
                url: `https://sandbox-docs.rootuip.com/${uuidv4()}.pdf`
            });
        }
        
        return documents;
    }
    
    // Simulate real-time events
    startEventSimulation() {
        // Simulate container movements every 30 seconds
        setInterval(() => {
            this.simulateContainerMovements();
        }, 30000);
        
        // Simulate status changes every minute
        setInterval(() => {
            this.simulateStatusChanges();
        }, 60000);
        
        // Simulate new milestones every 2 minutes
        setInterval(() => {
            this.simulateMilestones();
        }, 120000);
    }
    
    simulateContainerMovements() {
        for (const [containerId, container] of this.sandboxData.containers) {
            if (container.status === 'in_transit' || container.status === 'on_vessel') {
                // Update location
                const oldLocation = container.location;
                container.location = this.generateLocation(oldLocation);
                container.updatedAt = new Date();
                
                // Emit event
                const event = {
                    id: uuidv4(),
                    type: 'location_update',
                    containerId,
                    timestamp: new Date(),
                    data: {
                        previousLocation: oldLocation,
                        newLocation: container.location
                    }
                };
                
                this.emit('container:location_updated', event);
                
                // Send webhooks
                this.sendWebhooks('container.location_updated', event);
            }
        }
    }
    
    simulateStatusChanges() {
        const transitions = {
            'at_port': ['loaded', 'on_vessel'],
            'loaded': ['on_vessel'],
            'on_vessel': ['in_transit', 'transshipment'],
            'in_transit': ['arrived', 'at_port'],
            'arrived': ['unloaded', 'customs_hold'],
            'unloaded': ['delivered'],
            'customs_hold': ['customs_cleared', 'unloaded']
        };
        
        for (const [containerId, container] of this.sandboxData.containers) {
            // 10% chance of status change
            if (Math.random() < 0.1 && transitions[container.status]) {
                const possibleStatuses = transitions[container.status];
                const newStatus = possibleStatuses[Math.floor(Math.random() * possibleStatuses.length)];
                
                const oldStatus = container.status;
                container.status = newStatus;
                container.updatedAt = new Date();
                
                // Emit event
                const event = {
                    id: uuidv4(),
                    type: 'status_change',
                    containerId,
                    timestamp: new Date(),
                    data: {
                        previousStatus: oldStatus,
                        newStatus: newStatus
                    }
                };
                
                this.emit('container:status_changed', event);
                
                // Send webhooks
                this.sendWebhooks('container.status_changed', event);
            }
        }
    }
    
    simulateMilestones() {
        for (const [containerId, container] of this.sandboxData.containers) {
            // 5% chance of new milestone
            if (Math.random() < 0.05) {
                const milestone = {
                    event: this.getNextMilestone(container),
                    location: container.location.port || container.location.coordinates,
                    timestamp: new Date(),
                    description: 'Automated milestone from sandbox'
                };
                
                container.milestones.push(milestone);
                container.updatedAt = new Date();
                
                // Emit event
                const event = {
                    id: uuidv4(),
                    type: 'milestone_reached',
                    containerId,
                    timestamp: new Date(),
                    data: milestone
                };
                
                this.emit('container:milestone_reached', event);
                
                // Send webhooks
                this.sendWebhooks('container.milestone_reached', event);
            }
        }
    }
    
    // Send webhooks to registered endpoints
    async sendWebhooks(eventType, data) {
        for (const [id, webhook] of this.sandboxData.webhooks) {
            if (webhook.events.includes(eventType)) {
                // In sandbox, just log the webhook
                console.log(`[SANDBOX] Webhook sent to ${webhook.url}:`, {
                    event: eventType,
                    data: data
                });
                
                // Update webhook stats
                webhook.lastDelivery = new Date();
                webhook.deliveryStats.successful++;
            }
        }
    }
    
    // Helper methods
    generateLocation(previousLocation = null) {
        if (previousLocation && previousLocation.latitude) {
            // Generate new location based on previous (simulate movement)
            return {
                latitude: previousLocation.latitude + (Math.random() - 0.5) * 0.5,
                longitude: previousLocation.longitude + (Math.random() - 0.5) * 0.5,
                speed: Math.floor(Math.random() * 20 + 10), // 10-30 knots
                heading: Math.floor(Math.random() * 360),
                updatedAt: new Date()
            };
        } else {
            // Generate port location
            const ports = ['CNSHA', 'SGSIN', 'USOAK', 'DEHAM', 'NLRTM', 'BEANR'];
            return {
                port: ports[Math.floor(Math.random() * ports.length)],
                portName: this.getPortName(ports[0]),
                terminal: `Terminal ${Math.floor(Math.random() * 5 + 1)}`,
                berth: `B${Math.floor(Math.random() * 20 + 1)}`,
                updatedAt: new Date()
            };
        }
    }
    
    generateMilestones(container) {
        const milestones = [
            {
                event: 'gate_in',
                location: container.origin.port,
                timestamp: new Date(container.origin.departureDate.getTime() - 24 * 60 * 60 * 1000)
            },
            {
                event: 'loaded',
                location: container.origin.port,
                timestamp: container.origin.departureDate
            }
        ];
        
        if (container.status === 'delivered' || container.status === 'at_port') {
            milestones.push({
                event: 'discharged',
                location: container.destination.port,
                timestamp: new Date(container.destination.eta.getTime() - 6 * 60 * 60 * 1000)
            });
        }
        
        return milestones;
    }
    
    generateEventData(eventType) {
        switch (eventType) {
            case 'location_update':
                return {
                    latitude: 1.290270 + (Math.random() - 0.5) * 10,
                    longitude: 103.851959 + (Math.random() - 0.5) * 10,
                    speed: Math.floor(Math.random() * 25 + 5),
                    heading: Math.floor(Math.random() * 360)
                };
                
            case 'temperature_alert':
                return {
                    temperature: Math.floor(Math.random() * 10 + 25),
                    unit: 'celsius',
                    threshold: 30,
                    severity: 'warning'
                };
                
            default:
                return {};
        }
    }
    
    getPortName(code) {
        const portNames = {
            'CNSHA': 'Shanghai',
            'SGSIN': 'Singapore',
            'USOAK': 'Oakland',
            'DEHAM': 'Hamburg',
            'NLRTM': 'Rotterdam',
            'BEANR': 'Antwerp'
        };
        return portNames[code] || code;
    }
    
    getRandomCargo() {
        const cargoTypes = [
            'Electronics',
            'Textiles',
            'Machinery',
            'Auto Parts',
            'Consumer Goods',
            'Chemicals (Non-Hazardous)',
            'Furniture',
            'Medical Equipment'
        ];
        return cargoTypes[Math.floor(Math.random() * cargoTypes.length)];
    }
    
    getNextMilestone(container) {
        const allMilestones = [
            'gate_in', 'loaded', 'departed', 'transshipment',
            'arrived', 'discharged', 'gate_out', 'delivered'
        ];
        
        const completedMilestones = container.milestones.map(m => m.event);
        const availableMilestones = allMilestones.filter(m => !completedMilestones.includes(m));
        
        return availableMilestones[0] || 'update';
    }
    
    generateSandboxAPIKey() {
        return 'sk_test_' + Buffer.from(Math.random().toString()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    }
    
    generateSecretKey() {
        return 'secret_' + Buffer.from(Math.random().toString()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 24);
    }
    
    // Load initial test data
    async loadTestData() {
        // Create some default test containers and shipments
        const containers = await this.generateTestContainers(20);
        containers.forEach(container => {
            this.sandboxData.containers.set(container.containerId, container);
        });
        
        const shipments = await this.generateTestShipments(10);
        shipments.forEach(shipment => {
            this.sandboxData.shipments.set(shipment.id, shipment);
        });
        
        console.log(`Loaded ${containers.length} test containers and ${shipments.length} test shipments`);
    }
    
    // Clean up old sandbox data
    async cleanupOldData() {
        const retentionDate = new Date(Date.now() - this.config.dataRetentionDays * 24 * 60 * 60 * 1000);
        
        // Clean up old containers
        for (const [id, container] of this.sandboxData.containers) {
            if (container.createdAt < retentionDate) {
                this.sandboxData.containers.delete(id);
            }
        }
        
        // Clean up old shipments
        for (const [id, shipment] of this.sandboxData.shipments) {
            if (shipment.createdAt < retentionDate) {
                this.sandboxData.shipments.delete(id);
            }
        }
    }
}

module.exports = SandboxEnvironment;