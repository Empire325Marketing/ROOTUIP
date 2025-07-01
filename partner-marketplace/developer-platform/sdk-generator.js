/**
 * ROOTUIP SDK Generator
 * Generate SDKs for multiple programming languages
 */

class SDKGenerator {
    constructor() {
        this.languages = ['javascript', 'python', 'java', 'csharp', 'php'];
        this.apiSpec = this.getAPISpecification();
    }
    
    // Generate SDK for specified language
    generateSDK(language) {
        switch (language) {
            case 'javascript':
                return this.generateJavaScriptSDK();
            case 'python':
                return this.generatePythonSDK();
            case 'java':
                return this.generateJavaSDK();
            case 'csharp':
                return this.generateCSharpSDK();
            case 'php':
                return this.generatePHPSDK();
            default:
                throw new Error(`Unsupported language: ${language}`);
        }
    }
    
    // JavaScript/Node.js SDK
    generateJavaScriptSDK() {
        return {
            'package.json': `{
  "name": "@rootuip/partner-sdk",
  "version": "2.0.0",
  "description": "ROOTUIP Partner Integration SDK for JavaScript/Node.js",
  "main": "lib/index.js",
  "types": "lib/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "ws": "^8.14.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0"
  }
}`,
            
            'lib/index.js': `/**
 * ROOTUIP Partner SDK for JavaScript
 * @module rootuip-partner-sdk
 */

const axios = require('axios');
const WebSocket = require('ws');
const EventEmitter = require('events');

class RootuipClient extends EventEmitter {
    constructor(config) {
        super();
        
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://api.rootuip.com/partner/v2';
        this.sandbox = config.sandbox || false;
        
        if (this.sandbox) {
            this.baseUrl = 'https://sandbox-api.rootuip.com/partner/v2';
        }
        
        // Initialize HTTP client
        this.http = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'X-API-Key': this.apiKey,
                'Content-Type': 'application/json',
                'User-Agent': 'ROOTUIP-SDK-JS/2.0.0'
            }
        });
        
        // Initialize sub-services
        this.containers = new ContainerService(this);
        this.shipments = new ShipmentService(this);
        this.bookings = new BookingService(this);
        this.webhooks = new WebhookService(this);
        this.analytics = new AnalyticsService(this);
    }
    
    // Make authenticated request
    async request(method, path, data = null) {
        try {
            const response = await this.http({
                method,
                url: path,
                data
            });
            
            return response.data;
        } catch (error) {
            if (error.response) {
                const err = new Error(error.response.data.message || 'API Error');
                err.statusCode = error.response.status;
                err.details = error.response.data;
                throw err;
            }
            throw error;
        }
    }
    
    // Connect to WebSocket for real-time updates
    connectWebSocket() {
        const wsUrl = this.baseUrl.replace('https://', 'wss://') + '/ws';
        
        this.ws = new WebSocket(wsUrl, {
            headers: {
                'X-API-Key': this.apiKey
            }
        });
        
        this.ws.on('open', () => {
            this.emit('connected');
        });
        
        this.ws.on('message', (data) => {
            const event = JSON.parse(data);
            this.emit(event.type, event.data);
        });
        
        this.ws.on('close', () => {
            this.emit('disconnected');
            // Auto-reconnect after 5 seconds
            setTimeout(() => this.connectWebSocket(), 5000);
        });
        
        this.ws.on('error', (error) => {
            this.emit('error', error);
        });
    }
}

// Container Service
class ContainerService {
    constructor(client) {
        this.client = client;
    }
    
    async get(containerId) {
        return this.client.request('GET', \`/containers/\${containerId}\`);
    }
    
    async getEvents(containerId, options = {}) {
        const params = new URLSearchParams(options).toString();
        return this.client.request('GET', \`/containers/\${containerId}/events?\${params}\`);
    }
    
    async getDocuments(containerId) {
        return this.client.request('GET', \`/containers/\${containerId}/documents\`);
    }
    
    async updateStatus(containerId, update) {
        return this.client.request('POST', \`/containers/\${containerId}/updates\`, update);
    }
    
    async track(containerIds) {
        // Batch tracking
        const promises = containerIds.map(id => this.get(id));
        return Promise.all(promises);
    }
}

// Shipment Service
class ShipmentService {
    constructor(client) {
        this.client = client;
    }
    
    async list(options = {}) {
        const params = new URLSearchParams(options).toString();
        return this.client.request('GET', \`/shipments?\${params}\`);
    }
    
    async get(shipmentId) {
        return this.client.request('GET', \`/shipments/\${shipmentId}\`);
    }
    
    async create(shipmentData) {
        return this.client.request('POST', '/shipments', shipmentData);
    }
    
    async update(shipmentId, updates) {
        return this.client.request('PUT', \`/shipments/\${shipmentId}\`, updates);
    }
    
    async uploadDocument(shipmentId, document) {
        return this.client.request('POST', \`/shipments/\${shipmentId}/documents\`, document);
    }
}

// Booking Service
class BookingService {
    constructor(client) {
        this.client = client;
    }
    
    async getQuote(quoteRequest) {
        return this.client.request('POST', '/bookings/quote', quoteRequest);
    }
    
    async create(bookingData) {
        return this.client.request('POST', '/bookings', bookingData);
    }
    
    async get(bookingId) {
        return this.client.request('GET', \`/bookings/\${bookingId}\`);
    }
    
    async confirm(bookingId) {
        return this.client.request('PUT', \`/bookings/\${bookingId}/confirm\`);
    }
    
    async cancel(bookingId) {
        return this.client.request('DELETE', \`/bookings/\${bookingId}\`);
    }
}

// Webhook Service
class WebhookService {
    constructor(client) {
        this.client = client;
    }
    
    async list() {
        return this.client.request('GET', '/webhooks');
    }
    
    async create(webhookConfig) {
        return this.client.request('POST', '/webhooks', webhookConfig);
    }
    
    async update(webhookId, updates) {
        return this.client.request('PUT', \`/webhooks/\${webhookId}\`, updates);
    }
    
    async delete(webhookId) {
        return this.client.request('DELETE', \`/webhooks/\${webhookId}\`);
    }
    
    async test(webhookId) {
        return this.client.request('POST', \`/webhooks/\${webhookId}/test\`);
    }
    
    // Helper to verify webhook signatures
    verifySignature(payload, signature, secret) {
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
        
        return signature === \`sha256=\${expectedSignature}\`;
    }
}

// Analytics Service
class AnalyticsService {
    constructor(client) {
        this.client = client;
    }
    
    async getUsage(period = '30d') {
        return this.client.request('GET', \`/analytics/usage?period=\${period}\`);
    }
    
    async getPerformance(period = '30d') {
        return this.client.request('GET', \`/analytics/performance?period=\${period}\`);
    }
    
    async getRevenue(period = '30d') {
        return this.client.request('GET', \`/analytics/revenue?period=\${period}\`);
    }
}

module.exports = RootuipClient;`,

            'examples/quick-start.js': `/**
 * ROOTUIP Partner SDK - Quick Start Example
 */

const RootuipClient = require('@rootuip/partner-sdk');

// Initialize client
const client = new RootuipClient({
    apiKey: 'your-api-key',
    sandbox: true // Use sandbox environment
});

// Example 1: Track a container
async function trackContainer() {
    try {
        const container = await client.containers.get('MSKU1234567');
        console.log('Container Status:', container.status);
        console.log('Current Location:', container.location);
        console.log('ETA:', container.destination.eta);
    } catch (error) {
        console.error('Error tracking container:', error.message);
    }
}

// Example 2: Create a shipment
async function createShipment() {
    try {
        const shipment = await client.shipments.create({
            reference: 'PO-2024-001',
            origin: {
                port: 'CNSHA',
                address: {
                    street: '123 Export St',
                    city: 'Shanghai',
                    country: 'CN'
                }
            },
            destination: {
                port: 'USOAK',
                address: {
                    street: '456 Import Ave',
                    city: 'Oakland',
                    state: 'CA',
                    country: 'US'
                }
            },
            cargo: {
                type: 'FCL',
                containerType: '40HC',
                weight: 18500,
                weightUnit: 'kg',
                description: 'Electronics'
            }
        });
        
        console.log('Shipment created:', shipment.id);
    } catch (error) {
        console.error('Error creating shipment:', error.message);
    }
}

// Example 3: Get shipping quote
async function getQuote() {
    try {
        const quote = await client.bookings.getQuote({
            origin: { port: 'CNSHA' },
            destination: { port: 'USOAK' },
            cargo: {
                type: 'FCL',
                containerType: '40HC',
                weight: 18500
            },
            preferredDepartureDate: '2024-02-01'
        });
        
        console.log('Available services:');
        quote.services.forEach(service => {
            console.log(\`- \${service.carrier}: $\${service.price.amount} (\${service.transitTime} days)\`);
        });
    } catch (error) {
        console.error('Error getting quote:', error.message);
    }
}

// Example 4: Set up webhook
async function setupWebhook() {
    try {
        const webhook = await client.webhooks.create({
            url: 'https://your-domain.com/webhooks/rootuip',
            events: [
                'container.status_changed',
                'shipment.delivered',
                'document.uploaded'
            ]
        });
        
        console.log('Webhook created:', webhook.id);
        console.log('Secret:', webhook.secret);
    } catch (error) {
        console.error('Error creating webhook:', error.message);
    }
}

// Example 5: Real-time tracking with WebSocket
function startRealTimeTracking() {
    // Connect to WebSocket
    client.connectWebSocket();
    
    // Listen for events
    client.on('connected', () => {
        console.log('Connected to real-time updates');
    });
    
    client.on('container.status_changed', (data) => {
        console.log('Container status changed:', data);
    });
    
    client.on('shipment.milestone_reached', (data) => {
        console.log('Shipment milestone:', data);
    });
}

// Run examples
async function main() {
    await trackContainer();
    await createShipment();
    await getQuote();
    await setupWebhook();
    startRealTimeTracking();
}

main();`
        };
    }
    
    // Python SDK
    generatePythonSDK() {
        return {
            'setup.py': `from setuptools import setup, find_packages

setup(
    name="rootuip-partner-sdk",
    version="2.0.0",
    description="ROOTUIP Partner Integration SDK for Python",
    author="ROOTUIP",
    author_email="developers@rootuip.com",
    url="https://github.com/rootuip/partner-sdk-python",
    packages=find_packages(),
    install_requires=[
        "requests>=2.28.0",
        "websocket-client>=1.4.0",
        "python-dateutil>=2.8.0"
    ],
    python_requires=">=3.7",
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.7",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
    ]
)`,

            'rootuip/__init__.py': `"""
ROOTUIP Partner SDK for Python
"""

import requests
import json
import hmac
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Any
from urllib.parse import urlencode

__version__ = "2.0.0"


class RootuipClient:
    """Main client for ROOTUIP Partner API"""
    
    def __init__(self, api_key: str, sandbox: bool = False):
        self.api_key = api_key
        self.sandbox = sandbox
        
        if sandbox:
            self.base_url = "https://sandbox-api.rootuip.com/partner/v2"
        else:
            self.base_url = "https://api.rootuip.com/partner/v2"
        
        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": api_key,
            "Content-Type": "application/json",
            "User-Agent": f"ROOTUIP-SDK-Python/{__version__}"
        })
        
        # Initialize services
        self.containers = ContainerService(self)
        self.shipments = ShipmentService(self)
        self.bookings = BookingService(self)
        self.webhooks = WebhookService(self)
        self.analytics = AnalyticsService(self)
    
    def request(self, method: str, path: str, data: Optional[Dict] = None) -> Dict:
        """Make authenticated API request"""
        url = f"{self.base_url}{path}"
        
        response = self.session.request(
            method=method,
            url=url,
            json=data
        )
        
        if response.status_code >= 400:
            error_data = response.json()
            raise RootuipAPIError(
                message=error_data.get("message", "API Error"),
                status_code=response.status_code,
                details=error_data
            )
        
        return response.json()


class RootuipAPIError(Exception):
    """API Error exception"""
    
    def __init__(self, message: str, status_code: int, details: Dict):
        super().__init__(message)
        self.status_code = status_code
        self.details = details


class ContainerService:
    """Container tracking service"""
    
    def __init__(self, client: RootuipClient):
        self.client = client
    
    def get(self, container_id: str) -> Dict:
        """Get container details"""
        return self.client.request("GET", f"/containers/{container_id}")
    
    def get_events(self, container_id: str, limit: int = 50, offset: int = 0) -> Dict:
        """Get container events"""
        params = {"limit": limit, "offset": offset}
        query = urlencode(params)
        return self.client.request("GET", f"/containers/{container_id}/events?{query}")
    
    def get_documents(self, container_id: str) -> List[Dict]:
        """Get container documents"""
        return self.client.request("GET", f"/containers/{container_id}/documents")
    
    def update_status(self, container_id: str, update: Dict) -> Dict:
        """Update container status"""
        return self.client.request("POST", f"/containers/{container_id}/updates", update)
    
    def track_multiple(self, container_ids: List[str]) -> List[Dict]:
        """Track multiple containers"""
        containers = []
        for container_id in container_ids:
            try:
                container = self.get(container_id)
                containers.append(container)
            except RootuipAPIError:
                containers.append({"containerId": container_id, "error": "Not found"})
        return containers


class ShipmentService:
    """Shipment management service"""
    
    def __init__(self, client: RootuipClient):
        self.client = client
    
    def list(self, status: Optional[str] = None, limit: int = 50, offset: int = 0) -> Dict:
        """List shipments"""
        params = {"limit": limit, "offset": offset}
        if status:
            params["status"] = status
        query = urlencode(params)
        return self.client.request("GET", f"/shipments?{query}")
    
    def get(self, shipment_id: str) -> Dict:
        """Get shipment details"""
        return self.client.request("GET", f"/shipments/{shipment_id}")
    
    def create(self, shipment_data: Dict) -> Dict:
        """Create new shipment"""
        return self.client.request("POST", "/shipments", shipment_data)
    
    def update(self, shipment_id: str, updates: Dict) -> Dict:
        """Update shipment"""
        return self.client.request("PUT", f"/shipments/{shipment_id}", updates)
    
    def upload_document(self, shipment_id: str, document: Dict) -> Dict:
        """Upload document to shipment"""
        return self.client.request("POST", f"/shipments/{shipment_id}/documents", document)


class BookingService:
    """Booking service"""
    
    def __init__(self, client: RootuipClient):
        self.client = client
    
    def get_quote(self, quote_request: Dict) -> Dict:
        """Get shipping quote"""
        return self.client.request("POST", "/bookings/quote", quote_request)
    
    def create(self, booking_data: Dict) -> Dict:
        """Create booking"""
        return self.client.request("POST", "/bookings", booking_data)
    
    def get(self, booking_id: str) -> Dict:
        """Get booking details"""
        return self.client.request("GET", f"/bookings/{booking_id}")
    
    def confirm(self, booking_id: str) -> Dict:
        """Confirm booking"""
        return self.client.request("PUT", f"/bookings/{booking_id}/confirm")
    
    def cancel(self, booking_id: str) -> Dict:
        """Cancel booking"""
        return self.client.request("DELETE", f"/bookings/{booking_id}")


class WebhookService:
    """Webhook management service"""
    
    def __init__(self, client: RootuipClient):
        self.client = client
    
    def list(self) -> List[Dict]:
        """List webhooks"""
        return self.client.request("GET", "/webhooks")
    
    def create(self, webhook_config: Dict) -> Dict:
        """Create webhook"""
        return self.client.request("POST", "/webhooks", webhook_config)
    
    def update(self, webhook_id: str, updates: Dict) -> Dict:
        """Update webhook"""
        return self.client.request("PUT", f"/webhooks/{webhook_id}", updates)
    
    def delete(self, webhook_id: str) -> None:
        """Delete webhook"""
        self.client.request("DELETE", f"/webhooks/{webhook_id}")
    
    def test(self, webhook_id: str) -> Dict:
        """Test webhook"""
        return self.client.request("POST", f"/webhooks/{webhook_id}/test")
    
    @staticmethod
    def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
        """Verify webhook signature"""
        expected_signature = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        return signature == f"sha256={expected_signature}"


class AnalyticsService:
    """Analytics service"""
    
    def __init__(self, client: RootuipClient):
        self.client = client
    
    def get_usage(self, period: str = "30d") -> Dict:
        """Get usage analytics"""
        return self.client.request("GET", f"/analytics/usage?period={period}")
    
    def get_performance(self, period: str = "30d") -> Dict:
        """Get performance analytics"""
        return self.client.request("GET", f"/analytics/performance?period={period}")
    
    def get_revenue(self, period: str = "30d") -> Dict:
        """Get revenue analytics"""
        return self.client.request("GET", f"/analytics/revenue?period={period}")`,

            'examples/quickstart.py': `#!/usr/bin/env python
"""
ROOTUIP Partner SDK - Python Quick Start
"""

import asyncio
from datetime import datetime, timedelta
from rootuip import RootuipClient, RootuipAPIError


def main():
    # Initialize client
    client = RootuipClient(
        api_key="your-api-key",
        sandbox=True  # Use sandbox environment
    )
    
    # Example 1: Track a container
    print("=== Container Tracking ===")
    try:
        container = client.containers.get("MSKU1234567")
        print(f"Container ID: {container['containerId']}")
        print(f"Status: {container['status']}")
        print(f"Location: {container['location']['portName']}")
        print(f"ETA: {container['destination']['eta']}")
        
        # Get recent events
        events = client.containers.get_events(container['containerId'], limit=5)
        print(f"\\nRecent events:")
        for event in events['events']:
            print(f"  - {event['type']}: {event['timestamp']}")
    
    except RootuipAPIError as e:
        print(f"Error: {e.message}")
    
    # Example 2: Create a shipment
    print("\\n=== Create Shipment ===")
    try:
        shipment = client.shipments.create({
            "reference": "PO-2024-001",
            "origin": {
                "port": "CNSHA",
                "address": {
                    "street": "123 Export St",
                    "city": "Shanghai",
                    "country": "CN"
                }
            },
            "destination": {
                "port": "USOAK",
                "address": {
                    "street": "456 Import Ave",
                    "city": "Oakland",
                    "state": "CA",
                    "country": "US"
                }
            },
            "cargo": {
                "type": "FCL",
                "containerType": "40HC",
                "weight": 18500,
                "weightUnit": "kg",
                "description": "Electronics"
            }
        })
        
        print(f"Shipment created: {shipment['id']}")
        print(f"Status: {shipment['status']}")
    
    except RootuipAPIError as e:
        print(f"Error: {e.message}")
    
    # Example 3: Get shipping quote
    print("\\n=== Get Quote ===")
    try:
        quote = client.bookings.get_quote({
            "origin": {"port": "CNSHA"},
            "destination": {"port": "USOAK"},
            "cargo": {
                "type": "FCL",
                "containerType": "40HC",
                "weight": 18500
            },
            "preferredDepartureDate": (datetime.now() + timedelta(days=7)).isoformat()
        })
        
        print(f"Quote ID: {quote['id']}")
        print(f"Valid until: {quote['validUntil']}")
        print("\\nAvailable services:")
        for service in quote['services']:
            print(f"  - {service['carrier']}: ${service['price']['amount']} ({service['transitTime']} days)")
    
    except RootuipAPIError as e:
        print(f"Error: {e.message}")
    
    # Example 4: Set up webhook
    print("\\n=== Webhook Setup ===")
    try:
        webhook = client.webhooks.create({
            "url": "https://your-domain.com/webhooks/rootuip",
            "events": [
                "container.status_changed",
                "shipment.delivered",
                "document.uploaded"
            ]
        })
        
        print(f"Webhook created: {webhook['id']}")
        print(f"Secret: {webhook['secret']}")
        print(f"Events: {', '.join(webhook['events'])}")
        
        # Test webhook
        test_result = client.webhooks.test(webhook['id'])
        print(f"Test result: {test_result['message']}")
    
    except RootuipAPIError as e:
        print(f"Error: {e.message}")
    
    # Example 5: Analytics
    print("\\n=== Analytics ===")
    try:
        usage = client.analytics.get_usage(period="7d")
        print(f"Total API calls (7 days): {usage['summary']['totalRequests']}")
        print(f"Unique containers tracked: {usage['summary']['uniqueContainers']}")
        
        revenue = client.analytics.get_revenue(period="30d")
        print(f"\\nRevenue (30 days): ${revenue['summary']['totalRevenue']}")
        print(f"Pending payout: ${revenue['summary']['pendingPayout']}")
    
    except RootuipAPIError as e:
        print(f"Error: {e.message}")


if __name__ == "__main__":
    main()`
        };
    }
    
    // Java SDK
    generateJavaSDK() {
        return {
            'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>com.rootuip</groupId>
    <artifactId>partner-sdk</artifactId>
    <version>2.0.0</version>
    <packaging>jar</packaging>
    
    <name>ROOTUIP Partner SDK</name>
    <description>ROOTUIP Partner Integration SDK for Java</description>
    <url>https://developers.rootuip.com</url>
    
    <properties>
        <maven.compiler.source>11</maven.compiler.source>
        <maven.compiler.target>11</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>com.squareup.okhttp3</groupId>
            <artifactId>okhttp</artifactId>
            <version>4.11.0</version>
        </dependency>
        <dependency>
            <groupId>com.google.code.gson</groupId>
            <artifactId>gson</artifactId>
            <version>2.10.1</version>
        </dependency>
        <dependency>
            <groupId>org.java-websocket</groupId>
            <artifactId>Java-WebSocket</artifactId>
            <version>1.5.4</version>
        </dependency>
        <dependency>
            <groupId>junit</groupId>
            <artifactId>junit</artifactId>
            <version>4.13.2</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>`,

            'src/main/java/com/rootuip/sdk/RootuipClient.java': `package com.rootuip.sdk;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import okhttp3.*;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * ROOTUIP Partner SDK Client for Java
 */
public class RootuipClient {
    private static final String PRODUCTION_URL = "https://api.rootuip.com/partner/v2";
    private static final String SANDBOX_URL = "https://sandbox-api.rootuip.com/partner/v2";
    
    private final String apiKey;
    private final String baseUrl;
    private final OkHttpClient httpClient;
    private final Gson gson;
    
    // Services
    private final ContainerService containers;
    private final ShipmentService shipments;
    private final BookingService bookings;
    private final WebhookService webhooks;
    private final AnalyticsService analytics;
    
    /**
     * Initialize ROOTUIP client
     * @param apiKey Your API key
     * @param sandbox Use sandbox environment
     */
    public RootuipClient(String apiKey, boolean sandbox) {
        this.apiKey = apiKey;
        this.baseUrl = sandbox ? SANDBOX_URL : PRODUCTION_URL;
        
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build();
        
        this.gson = new GsonBuilder()
            .setDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'")
            .create();
        
        // Initialize services
        this.containers = new ContainerService(this);
        this.shipments = new ShipmentService(this);
        this.bookings = new BookingService(this);
        this.webhooks = new WebhookService(this);
        this.analytics = new AnalyticsService(this);
    }
    
    /**
     * Make authenticated API request
     */
    public <T> T request(String method, String path, Object body, Class<T> responseType) 
            throws RootuipException {
        String url = baseUrl + path;
        
        Request.Builder requestBuilder = new Request.Builder()
            .url(url)
            .header("X-API-Key", apiKey)
            .header("Content-Type", "application/json")
            .header("User-Agent", "ROOTUIP-SDK-Java/2.0.0");
        
        if (body != null) {
            String jsonBody = gson.toJson(body);
            RequestBody requestBody = RequestBody.create(
                jsonBody, MediaType.parse("application/json")
            );
            requestBuilder.method(method, requestBody);
        } else {
            if (method.equals("GET")) {
                requestBuilder.get();
            } else {
                requestBuilder.method(method, RequestBody.create("", null));
            }
        }
        
        try (Response response = httpClient.newCall(requestBuilder.build()).execute()) {
            String responseBody = response.body().string();
            
            if (!response.isSuccessful()) {
                ErrorResponse error = gson.fromJson(responseBody, ErrorResponse.class);
                throw new RootuipException(
                    error.getMessage(), 
                    response.code(), 
                    error
                );
            }
            
            return gson.fromJson(responseBody, responseType);
        } catch (IOException e) {
            throw new RootuipException("Network error: " + e.getMessage(), 0, null);
        }
    }
    
    // Getters for services
    public ContainerService containers() { return containers; }
    public ShipmentService shipments() { return shipments; }
    public BookingService bookings() { return bookings; }
    public WebhookService webhooks() { return webhooks; }
    public AnalyticsService analytics() { return analytics; }
    
    // Inner classes for services would go here...
    
    /**
     * Container tracking service
     */
    public static class ContainerService {
        private final RootuipClient client;
        
        ContainerService(RootuipClient client) {
            this.client = client;
        }
        
        public Container get(String containerId) throws RootuipException {
            return client.request("GET", "/containers/" + containerId, null, Container.class);
        }
        
        public ContainerEvents getEvents(String containerId, int limit, int offset) 
                throws RootuipException {
            String path = String.format("/containers/%s/events?limit=%d&offset=%d", 
                containerId, limit, offset);
            return client.request("GET", path, null, ContainerEvents.class);
        }
        
        // Other methods...
    }
    
    // Model classes
    public static class Container {
        private String containerId;
        private String shipmentId;
        private String status;
        private Location location;
        private Destination destination;
        
        // Getters and setters...
    }
    
    public static class Location {
        private String port;
        private String portName;
        private double latitude;
        private double longitude;
        
        // Getters and setters...
    }
    
    public static class ErrorResponse {
        private String error;
        private String message;
        private Map<String, Object> details;
        
        public String getMessage() {
            return message != null ? message : error;
        }
        
        // Other getters...
    }
    
    /**
     * API Exception
     */
    public static class RootuipException extends Exception {
        private final int statusCode;
        private final ErrorResponse errorResponse;
        
        public RootuipException(String message, int statusCode, ErrorResponse errorResponse) {
            super(message);
            this.statusCode = statusCode;
            this.errorResponse = errorResponse;
        }
        
        public int getStatusCode() { return statusCode; }
        public ErrorResponse getErrorResponse() { return errorResponse; }
    }
}`
        };
    }
    
    // C# SDK
    generateCSharpSDK() {
        return {
            'Rootuip.Partner.SDK.csproj': `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>netstandard2.0</TargetFramework>
    <PackageId>Rootuip.Partner.SDK</PackageId>
    <Version>2.0.0</Version>
    <Authors>ROOTUIP</Authors>
    <Company>ROOTUIP</Company>
    <Description>ROOTUIP Partner Integration SDK for .NET</Description>
    <PackageProjectUrl>https://developers.rootuip.com</PackageProjectUrl>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
    <PackageReference Include="RestSharp" Version="110.2.0" />
  </ItemGroup>
</Project>`,

            'RootuipClient.cs': `using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Newtonsoft.Json;
using RestSharp;

namespace Rootuip.Partner.SDK
{
    /// <summary>
    /// ROOTUIP Partner SDK Client for .NET
    /// </summary>
    public class RootuipClient
    {
        private const string ProductionUrl = "https://api.rootuip.com/partner/v2";
        private const string SandboxUrl = "https://sandbox-api.rootuip.com/partner/v2";
        
        private readonly string _apiKey;
        private readonly RestClient _client;
        
        public ContainerService Containers { get; }
        public ShipmentService Shipments { get; }
        public BookingService Bookings { get; }
        public WebhookService Webhooks { get; }
        public AnalyticsService Analytics { get; }
        
        /// <summary>
        /// Initialize ROOTUIP client
        /// </summary>
        /// <param name="apiKey">Your API key</param>
        /// <param name="sandbox">Use sandbox environment</param>
        public RootuipClient(string apiKey, bool sandbox = false)
        {
            _apiKey = apiKey;
            
            var options = new RestClientOptions(sandbox ? SandboxUrl : ProductionUrl)
            {
                MaxTimeout = 30000
            };
            
            _client = new RestClient(options);
            _client.AddDefaultHeader("X-API-Key", apiKey);
            _client.AddDefaultHeader("User-Agent", "ROOTUIP-SDK-DotNet/2.0.0");
            
            // Initialize services
            Containers = new ContainerService(this);
            Shipments = new ShipmentService(this);
            Bookings = new BookingService(this);
            Webhooks = new WebhookService(this);
            Analytics = new AnalyticsService(this);
        }
        
        /// <summary>
        /// Make authenticated API request
        /// </summary>
        internal async Task<T> RequestAsync<T>(Method method, string resource, object body = null)
        {
            var request = new RestRequest(resource, method);
            
            if (body != null)
            {
                request.AddJsonBody(body);
            }
            
            var response = await _client.ExecuteAsync<T>(request);
            
            if (!response.IsSuccessful)
            {
                var error = JsonConvert.DeserializeObject<ErrorResponse>(response.Content);
                throw new RootuipException(
                    error?.Message ?? response.ErrorMessage,
                    (int)response.StatusCode,
                    error
                );
            }
            
            return response.Data;
        }
    }
    
    /// <summary>
    /// Container tracking service
    /// </summary>
    public class ContainerService
    {
        private readonly RootuipClient _client;
        
        internal ContainerService(RootuipClient client)
        {
            _client = client;
        }
        
        /// <summary>
        /// Get container details
        /// </summary>
        public async Task<Container> GetAsync(string containerId)
        {
            return await _client.RequestAsync<Container>(
                Method.Get, 
                $"/containers/{containerId}"
            );
        }
        
        /// <summary>
        /// Get container events
        /// </summary>
        public async Task<ContainerEvents> GetEventsAsync(string containerId, int limit = 50, int offset = 0)
        {
            return await _client.RequestAsync<ContainerEvents>(
                Method.Get,
                $"/containers/{containerId}/events?limit={limit}&offset={offset}"
            );
        }
        
        // Other methods...
    }
    
    // Model classes
    public class Container
    {
        public string ContainerId { get; set; }
        public string ShipmentId { get; set; }
        public string Status { get; set; }
        public Location Location { get; set; }
        public Destination Destination { get; set; }
        public List<Milestone> Milestones { get; set; }
    }
    
    public class Location
    {
        public string Port { get; set; }
        public string PortName { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
    
    public class ErrorResponse
    {
        public string Error { get; set; }
        public string Message { get; set; }
        public Dictionary<string, object> Details { get; set; }
    }
    
    /// <summary>
    /// ROOTUIP API Exception
    /// </summary>
    public class RootuipException : Exception
    {
        public int StatusCode { get; }
        public ErrorResponse ErrorResponse { get; }
        
        public RootuipException(string message, int statusCode, ErrorResponse errorResponse) 
            : base(message)
        {
            StatusCode = statusCode;
            ErrorResponse = errorResponse;
        }
    }
}`
        };
    }
    
    // PHP SDK
    generatePHPSDK() {
        return {
            'composer.json': `{
    "name": "rootuip/partner-sdk",
    "description": "ROOTUIP Partner Integration SDK for PHP",
    "type": "library",
    "license": "MIT",
    "authors": [
        {
            "name": "ROOTUIP",
            "email": "developers@rootuip.com"
        }
    ],
    "require": {
        "php": ">=7.2",
        "guzzlehttp/guzzle": "^7.0",
        "ext-json": "*"
    },
    "require-dev": {
        "phpunit/phpunit": "^9.0"
    },
    "autoload": {
        "psr-4": {
            "Rootuip\\\\Partner\\\\": "src/"
        }
    }
}`,

            'src/RootuipClient.php': `<?php

namespace Rootuip\\Partner;

use GuzzleHttp\\Client;
use GuzzleHttp\\Exception\\RequestException;

/**
 * ROOTUIP Partner SDK Client for PHP
 */
class RootuipClient
{
    const PRODUCTION_URL = 'https://api.rootuip.com/partner/v2';
    const SANDBOX_URL = 'https://sandbox-api.rootuip.com/partner/v2';
    
    private $apiKey;
    private $httpClient;
    private $baseUrl;
    
    public $containers;
    public $shipments;
    public $bookings;
    public $webhooks;
    public $analytics;
    
    /**
     * Initialize ROOTUIP client
     * 
     * @param string $apiKey Your API key
     * @param bool $sandbox Use sandbox environment
     */
    public function __construct(string $apiKey, bool $sandbox = false)
    {
        $this->apiKey = $apiKey;
        $this->baseUrl = $sandbox ? self::SANDBOX_URL : self::PRODUCTION_URL;
        
        $this->httpClient = new Client([
            'base_uri' => $this->baseUrl,
            'timeout' => 30,
            'headers' => [
                'X-API-Key' => $apiKey,
                'Content-Type' => 'application/json',
                'User-Agent' => 'ROOTUIP-SDK-PHP/2.0.0'
            ]
        ]);
        
        // Initialize services
        $this->containers = new Services\\ContainerService($this);
        $this->shipments = new Services\\ShipmentService($this);
        $this->bookings = new Services\\BookingService($this);
        $this->webhooks = new Services\\WebhookService($this);
        $this->analytics = new Services\\AnalyticsService($this);
    }
    
    /**
     * Make authenticated API request
     * 
     * @param string $method HTTP method
     * @param string $uri URI path
     * @param array $options Request options
     * @return array
     * @throws RootuipException
     */
    public function request(string $method, string $uri, array $options = []): array
    {
        try {
            $response = $this->httpClient->request($method, $uri, $options);
            $body = $response->getBody()->getContents();
            
            return json_decode($body, true);
            
        } catch (RequestException $e) {
            $response = $e->getResponse();
            $statusCode = $response ? $response->getStatusCode() : 0;
            $body = $response ? $response->getBody()->getContents() : '';
            $error = json_decode($body, true);
            
            throw new RootuipException(
                $error['message'] ?? 'API Error',
                $statusCode,
                $error
            );
        }
    }
}

namespace Rootuip\\Partner\\Services;

use Rootuip\\Partner\\RootuipClient;

/**
 * Container tracking service
 */
class ContainerService
{
    private $client;
    
    public function __construct(RootuipClient $client)
    {
        $this->client = $client;
    }
    
    /**
     * Get container details
     * 
     * @param string $containerId
     * @return array
     */
    public function get(string $containerId): array
    {
        return $this->client->request('GET', "/containers/{$containerId}");
    }
    
    /**
     * Get container events
     * 
     * @param string $containerId
     * @param int $limit
     * @param int $offset
     * @return array
     */
    public function getEvents(string $containerId, int $limit = 50, int $offset = 0): array
    {
        return $this->client->request('GET', "/containers/{$containerId}/events", [
            'query' => [
                'limit' => $limit,
                'offset' => $offset
            ]
        ]);
    }
    
    // Other methods...
}

namespace Rootuip\\Partner;

use Exception;

/**
 * ROOTUIP API Exception
 */
class RootuipException extends Exception
{
    private $statusCode;
    private $errorResponse;
    
    public function __construct(string $message, int $statusCode, ?array $errorResponse)
    {
        parent::__construct($message);
        $this->statusCode = $statusCode;
        $this->errorResponse = $errorResponse;
    }
    
    public function getStatusCode(): int
    {
        return $this->statusCode;
    }
    
    public function getErrorResponse(): ?array
    {
        return $this->errorResponse;
    }
}`
        };
    }
    
    // Get API specification
    getAPISpecification() {
        return {
            openapi: '3.0.0',
            info: {
                title: 'ROOTUIP Partner API',
                version: '2.0.0',
                description: 'RESTful API for logistics partner integrations'
            },
            servers: [
                { url: 'https://api.rootuip.com/partner/v2', description: 'Production' },
                { url: 'https://sandbox-api.rootuip.com/partner/v2', description: 'Sandbox' }
            ],
            paths: {
                '/containers/{containerId}': {
                    get: {
                        summary: 'Get container details',
                        parameters: [
                            {
                                name: 'containerId',
                                in: 'path',
                                required: true,
                                schema: { type: 'string' }
                            }
                        ]
                    }
                }
                // ... more endpoints
            }
        };
    }
}

module.exports = SDKGenerator;