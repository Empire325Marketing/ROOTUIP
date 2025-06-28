// Service Registry for ROOTUIP Microservices
const services = {
  auth: {
    name: 'auth-service',
    host: 'localhost',
    port: 3001,
    endpoints: {
      login: '/auth/login',
      register: '/auth/register',
      verify: '/auth/verify',
      logout: '/auth/logout'
    }
  },
  integration: {
    name: 'integration-service',
    host: 'localhost',
    port: 3002,
    endpoints: {
      carriers: '/integrations/carriers',
      terminals: '/integrations/terminals',
      erp: '/integrations/erp',
      status: '/integrations/status'
    }
  },
  aiml: {
    name: 'aiml-service',
    host: 'localhost',
    port: 3003,
    endpoints: {
      predict: '/ai/predict',
      analyze: '/ai/analyze',
      risk: '/ai/risk-assessment',
      optimize: '/ai/optimize'
    }
  },
  portal: {
    name: 'portal-service',
    host: 'localhost',
    port: 3004,
    endpoints: {
      dashboard: '/portal/dashboard',
      analytics: '/portal/analytics',
      reports: '/portal/reports'
    }
  },
  workflow: {
    name: 'workflow-service',
    host: 'localhost',
    port: 3005,
    endpoints: {
      create: '/workflows/create',
      execute: '/workflows/execute',
      monitor: '/workflows/monitor',
      history: '/workflows/history'
    }
  },
  apiGateway: {
    name: 'api-gateway',
    host: 'localhost',
    port: 3006,
    endpoints: {
      health: '/api/health',
      metrics: '/api/metrics',
      containers: '/api/containers',
      roi: '/api/roi-calculator'
    }
  }
};

// Service discovery helper
class ServiceDiscovery {
  constructor() {
    this.services = services;
  }

  getService(serviceName) {
    return this.services[serviceName];
  }

  getServiceUrl(serviceName, endpoint) {
    const service = this.services[serviceName];
    if (!service) throw new Error(`Service ${serviceName} not found`);
    
    const endpointPath = service.endpoints[endpoint];
    if (!endpointPath) throw new Error(`Endpoint ${endpoint} not found in ${serviceName}`);
    
    return `http://${service.host}:${service.port}${endpointPath}`;
  }

  getAllServices() {
    return Object.keys(this.services).map(key => ({
      name: this.services[key].name,
      url: `http://${this.services[key].host}:${this.services[key].port}`,
      status: 'unknown'
    }));
  }

  async checkHealth(serviceName) {
    const service = this.services[serviceName];
    if (!service) return { healthy: false, error: 'Service not found' };
    
    try {
      const response = await fetch(`http://${service.host}:${service.port}/health`);
      return { healthy: response.ok, status: response.status };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = new ServiceDiscovery();