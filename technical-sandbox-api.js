const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// Mock data generator for sandbox
class SandboxDataGenerator {
    static generateContainers(count = 100) {
        const containers = [];
        const carriers = ['Maersk', 'MSC', 'CMA CGM', 'Hapag-Lloyd', 'ONE', 'Evergreen'];
        const statuses = ['In Transit', 'At Port', 'Delayed', 'Delivered', 'Loading'];
        const ports = [
            { code: 'SGSIN', name: 'Singapore' },
            { code: 'CNSHA', name: 'Shanghai' },
            { code: 'NLRTM', name: 'Rotterdam' },
            { code: 'USNYC', name: 'New York' },
            { code: 'JPTYO', name: 'Tokyo' },
            { code: 'DEHAM', name: 'Hamburg' }
        ];

        for (let i = 0; i < count; i++) {
            const origin = ports[Math.floor(Math.random() * ports.length)];
            let destination = ports[Math.floor(Math.random() * ports.length)];
            while (destination.code === origin.code) {
                destination = ports[Math.floor(Math.random() * ports.length)];
            }

            containers.push({
                id: `cnt_${uuidv4()}`,
                number: `${carriers[Math.floor(Math.random() * carriers.length)].substring(0, 4).toUpperCase()}${Math.floor(Math.random() * 9000000 + 1000000)}`,
                carrier: carriers[Math.floor(Math.random() * carriers.length)],
                status: statuses[Math.floor(Math.random() * statuses.length)],
                origin: origin,
                destination: destination,
                eta: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                lastUpdate: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
                temperature: Math.random() > 0.7 ? Math.floor(Math.random() * 10 - 5) : null,
                humidity: Math.random() > 0.7 ? Math.floor(Math.random() * 30 + 60) : null
            });
        }

        return containers;
    }

    static generateEvents(containerId, count = 10) {
        const events = [];
        const eventTypes = [
            { type: 'DEPARTED', description: 'Vessel departed from port' },
            { type: 'ARRIVED', description: 'Vessel arrived at port' },
            { type: 'LOADED', description: 'Container loaded onto vessel' },
            { type: 'DISCHARGED', description: 'Container discharged from vessel' },
            { type: 'GATE_IN', description: 'Container gated in at terminal' },
            { type: 'GATE_OUT', description: 'Container gated out from terminal' },
            { type: 'CUSTOMS_CLEARED', description: 'Customs clearance completed' }
        ];

        const baseTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago

        for (let i = 0; i < count; i++) {
            const event = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            events.push({
                id: `evt_${uuidv4()}`,
                containerId,
                timestamp: new Date(baseTime + i * 24 * 60 * 60 * 1000).toISOString(),
                type: event.type,
                description: event.description,
                location: `Port ${i + 1}`,
                vessel: `Vessel ${Math.floor(Math.random() * 100)}`
            });
        }

        return events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    static generatePerformanceMetrics() {
        return {
            timestamp: new Date().toISOString(),
            metrics: {
                api: {
                    latency: {
                        p50: Math.floor(Math.random() * 50 + 30),
                        p95: Math.floor(Math.random() * 100 + 80),
                        p99: Math.floor(Math.random() * 150 + 150)
                    },
                    throughput: {
                        current: Math.floor(Math.random() * 5000 + 5000),
                        peak: 15000
                    },
                    errors: {
                        rate: (Math.random() * 0.1).toFixed(3),
                        count: Math.floor(Math.random() * 10)
                    }
                },
                processing: {
                    eventsPerSecond: Math.floor(Math.random() * 1000 + 1000),
                    avgProcessingTime: Math.floor(Math.random() * 100 + 50)
                },
                storage: {
                    used: '2.4 GB',
                    limit: '10 GB',
                    retention: '30 days'
                }
            }
        };
    }
}

// Sandbox API endpoints
router.get('/sandbox/:sandboxId/containers', async (req, res) => {
    try {
        const { status, carrier, limit = 100, offset = 0 } = req.query;
        
        // Generate mock containers
        let containers = SandboxDataGenerator.generateContainers(500);
        
        // Apply filters
        if (status) {
            containers = containers.filter(c => c.status.toLowerCase() === status.toLowerCase());
        }
        if (carrier) {
            containers = containers.filter(c => c.carrier.toLowerCase() === carrier.toLowerCase());
        }

        // Pagination
        const total = containers.length;
        containers = containers.slice(offset, offset + parseInt(limit));

        res.json({
            containers,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: offset + parseInt(limit) < total
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch containers' });
    }
});

router.get('/sandbox/:sandboxId/containers/:containerId', async (req, res) => {
    try {
        const container = SandboxDataGenerator.generateContainers(1)[0];
        container.id = req.params.containerId;
        
        res.json({
            container,
            events: SandboxDataGenerator.generateEvents(container.id, 8)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch container details' });
    }
});

router.post('/sandbox/:sandboxId/containers/track', async (req, res) => {
    try {
        const { containerNumber, carrier } = req.body;
        
        // Simulate tracking
        const container = SandboxDataGenerator.generateContainers(1)[0];
        container.number = containerNumber;
        container.carrier = carrier || container.carrier;
        
        res.json({
            tracked: true,
            container,
            subscription: {
                id: `sub_${uuidv4()}`,
                webhook: req.body.webhook || null,
                events: ['status_change', 'location_update', 'eta_change']
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to track container' });
    }
});

router.get('/sandbox/:sandboxId/analytics/performance', async (req, res) => {
    try {
        res.json(SandboxDataGenerator.generatePerformanceMetrics());
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch performance metrics' });
    }
});

router.post('/sandbox/:sandboxId/webhooks/subscribe', async (req, res) => {
    try {
        const { url, events, secret } = req.body;
        
        const subscription = {
            id: `webhook_${uuidv4()}`,
            url,
            events: events || ['all'],
            secret: secret || crypto.randomBytes(32).toString('hex'),
            status: 'active',
            created: new Date().toISOString()
        };
        
        res.json({
            subscription,
            message: 'Webhook subscription created successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create webhook subscription' });
    }
});

router.post('/sandbox/:sandboxId/webhooks/test', async (req, res) => {
    try {
        const { subscriptionId } = req.body;
        
        // Simulate webhook delivery
        const testEvent = {
            id: `evt_${uuidv4()}`,
            type: 'container.status.changed',
            timestamp: new Date().toISOString(),
            data: {
                containerId: 'cnt_test123',
                previousStatus: 'In Transit',
                newStatus: 'Arrived',
                location: 'Port of Los Angeles'
            }
        };
        
        res.json({
            success: true,
            message: 'Test webhook sent',
            event: testEvent
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send test webhook' });
    }
});

router.post('/sandbox/:sandboxId/simulate/delay', async (req, res) => {
    try {
        const { containerId, hours } = req.body;
        
        res.json({
            simulated: true,
            containerId,
            delay: {
                hours,
                newEta: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
                reason: 'Port congestion',
                impact: 'Medium',
                recommendations: [
                    'Notify customer of delay',
                    'Update delivery schedule',
                    'Check alternative routing options'
                ]
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to simulate delay' });
    }
});

router.get('/sandbox/:sandboxId/openapi.yaml', async (req, res) => {
    const openApiSpec = `
openapi: 3.0.0
info:
  title: ROOTUIP Sandbox API
  version: 1.0.0
  description: Enterprise container tracking and logistics optimization platform
servers:
  - url: https://sandbox.rootuip.com/{sandboxId}/api/v1
    variables:
      sandboxId:
        default: your-sandbox-id
paths:
  /containers:
    get:
      summary: List containers
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [In Transit, At Port, Delayed, Delivered, Loading]
        - name: carrier
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 100
      responses:
        200:
          description: List of containers
          content:
            application/json:
              schema:
                type: object
                properties:
                  containers:
                    type: array
                    items:
                      $ref: '#/components/schemas/Container'
  /containers/{containerId}:
    get:
      summary: Get container details
      parameters:
        - name: containerId
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: Container details with events
components:
  schemas:
    Container:
      type: object
      properties:
        id:
          type: string
        number:
          type: string
        carrier:
          type: string
        status:
          type: string
        origin:
          type: object
        destination:
          type: object
        eta:
          type: string
          format: date-time
`;

    res.type('text/yaml').send(openApiSpec);
});

router.get('/sandbox/:sandboxId/postman-collection', async (req, res) => {
    const collection = {
        info: {
            name: "ROOTUIP Sandbox API",
            description: "Test collection for ROOTUIP container tracking API",
            schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        auth: {
            type: "bearer",
            bearer: [{
                key: "token",
                value: "{{api_key}}",
                type: "string"
            }]
        },
        item: [
            {
                name: "List Containers",
                request: {
                    method: "GET",
                    header: [],
                    url: {
                        raw: "{{base_url}}/containers?status=In Transit&limit=10",
                        host: ["{{base_url}}"],
                        path: ["containers"],
                        query: [
                            { key: "status", value: "In Transit" },
                            { key: "limit", value: "10" }
                        ]
                    }
                }
            },
            {
                name: "Track Container",
                request: {
                    method: "POST",
                    header: [
                        { key: "Content-Type", value: "application/json" }
                    ],
                    body: {
                        mode: "raw",
                        raw: JSON.stringify({
                            containerNumber: "MSKU1234567",
                            carrier: "Maersk"
                        }, null, 2)
                    },
                    url: {
                        raw: "{{base_url}}/containers/track",
                        host: ["{{base_url}}"],
                        path: ["containers", "track"]
                    }
                }
            }
        ],
        variable: [
            {
                key: "base_url",
                value: `https://sandbox.rootuip.com/${req.params.sandboxId}/api/v1`
            },
            {
                key: "api_key",
                value: "your_api_key_here"
            }
        ]
    };

    res.json(collection);
});

// SDK Examples endpoint
router.get('/sandbox/:sandboxId/examples/:language', async (req, res) => {
    const { language } = req.params;
    
    const examples = {
        python: `
# ROOTUIP Python SDK Example
from rootuip import Client

# Initialize client
client = Client(
    api_key="your_api_key",
    sandbox_id="${req.params.sandboxId}"
)

# List containers
containers = client.containers.list(
    status="In Transit",
    limit=10
)

for container in containers:
    print(f"Container {container.number}: {container.status}")

# Track specific container
tracking = client.containers.track(
    container_number="MSKU1234567",
    carrier="Maersk"
)

# Subscribe to webhooks
subscription = client.webhooks.subscribe(
    url="https://your-domain.com/webhooks",
    events=["container.status.changed", "container.delayed"],
    secret="your_webhook_secret"
)

# Get performance metrics
metrics = client.analytics.performance()
print(f"API Latency (p95): {metrics.api.latency.p95}ms")
`,
        javascript: `
// ROOTUIP JavaScript SDK Example
const ROOTUIP = require('@rootuip/sdk');

// Initialize client
const client = new ROOTUIP.Client({
    apiKey: 'your_api_key',
    sandboxId: '${req.params.sandboxId}'
});

// List containers
const containers = await client.containers.list({
    status: 'In Transit',
    limit: 10
});

containers.forEach(container => {
    console.log(\`Container \${container.number}: \${container.status}\`);
});

// Track specific container
const tracking = await client.containers.track({
    containerNumber: 'MSKU1234567',
    carrier: 'Maersk'
});

// Subscribe to real-time updates
client.realtime.on('container.status.changed', (event) => {
    console.log('Container status changed:', event);
});

// Get performance metrics
const metrics = await client.analytics.performance();
console.log(\`Current throughput: \${metrics.api.throughput.current} req/s\`);
`,
        java: `
// ROOTUIP Java SDK Example
import com.rootuip.sdk.Client;
import com.rootuip.sdk.models.*;

public class Example {
    public static void main(String[] args) {
        // Initialize client
        Client client = new Client.Builder()
            .apiKey("your_api_key")
            .sandboxId("${req.params.sandboxId}")
            .build();
        
        // List containers
        ContainerList containers = client.containers().list()
            .withStatus("In Transit")
            .withLimit(10)
            .execute();
        
        for (Container container : containers) {
            System.out.println("Container " + container.getNumber() + 
                              ": " + container.getStatus());
        }
        
        // Track specific container
        TrackingResult tracking = client.containers()
            .track("MSKU1234567", "Maersk");
        
        // Subscribe to webhooks
        WebhookSubscription subscription = client.webhooks()
            .subscribe("https://your-domain.com/webhooks")
            .withEvents("container.status.changed", "container.delayed")
            .withSecret("your_webhook_secret")
            .execute();
    }
}
`
    };

    const example = examples[language];
    if (!example) {
        return res.status(404).json({ error: 'Language not supported' });
    }

    res.type('text/plain').send(example.trim());
});

module.exports = router;