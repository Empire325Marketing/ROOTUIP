// Health Monitor for ROOTUIP Microservices
const http = require('http');
const serviceRegistry = require('./service-registry');

class HealthMonitor {
  constructor() {
    this.healthStatus = {};
    this.startMonitoring();
  }

  async checkServiceHealth(serviceName, serviceConfig) {
    return new Promise((resolve) => {
      const options = {
        hostname: serviceConfig.host,
        port: serviceConfig.port,
        path: '/health',
        method: 'GET',
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            service: serviceName,
            healthy: res.statusCode === 200,
            status: res.statusCode,
            response: data,
            timestamp: new Date().toISOString()
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          service: serviceName,
          healthy: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      });

      req.on('timeout', () => {
        req.abort();
        resolve({
          service: serviceName,
          healthy: false,
          error: 'Timeout',
          timestamp: new Date().toISOString()
        });
      });

      req.end();
    });
  }

  async checkAllServices() {
    const services = serviceRegistry.services;
    const healthChecks = [];

    for (const [name, config] of Object.entries(services)) {
      healthChecks.push(this.checkServiceHealth(name, config));
    }

    const results = await Promise.all(healthChecks);
    
    // Update health status
    results.forEach(result => {
      this.healthStatus[result.service] = result;
    });

    return this.healthStatus;
  }

  startMonitoring() {
    // Check health every 30 seconds
    setInterval(() => {
      this.checkAllServices();
    }, 30000);

    // Initial check
    this.checkAllServices();
  }

  getStatus() {
    return this.healthStatus;
  }

  getServiceStatus(serviceName) {
    return this.healthStatus[serviceName] || { healthy: false, error: 'Not monitored yet' };
  }

  // Create health check endpoint
  createHealthEndpoint(port = 3007) {
    const server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');

      if (req.url === '/health/all') {
        res.writeHead(200);
        res.end(JSON.stringify({
          timestamp: new Date().toISOString(),
          services: this.healthStatus,
          summary: {
            total: Object.keys(this.healthStatus).length,
            healthy: Object.values(this.healthStatus).filter(s => s.healthy).length,
            unhealthy: Object.values(this.healthStatus).filter(s => !s.healthy).length
          }
        }, null, 2));
      } else if (req.url.startsWith('/health/')) {
        const serviceName = req.url.split('/')[2];
        const status = this.getServiceStatus(serviceName);
        res.writeHead(status.healthy ? 200 : 503);
        res.end(JSON.stringify(status, null, 2));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    server.listen(port, () => {
      console.log(`Health monitor running on port ${port}`);
    });
  }
}

// Start health monitor if run directly
if (require.main === module) {
  const monitor = new HealthMonitor();
  monitor.createHealthEndpoint();
}

module.exports = HealthMonitor;