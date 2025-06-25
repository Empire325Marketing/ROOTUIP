// API Configuration and Management
const APIConfig = {
  // API Version Management
  versions: {
    v1: {
      status: 'deprecated',
      deprecationDate: '2024-06-01',
      endOfLife: '2024-12-31',
      baseUrl: '/api/v1'
    },
    v2: {
      status: 'stable',
      releaseDate: '2024-01-01',
      baseUrl: '/api/v2'
    },
    v3: {
      status: 'beta',
      releaseDate: '2024-03-01',
      baseUrl: '/api/v3'
    }
  },

  // API Key Structure
  apiKeyConfig: {
    prefix: 'uip_',
    length: 32,
    algorithm: 'sha256',
    expirationDays: 365,
    rotationReminder: 30, // days before expiration
    maxKeysPerOrg: 10,
    scopes: [
      'read:containers',
      'write:containers',
      'read:dd_charges',
      'write:dd_charges',
      'read:analytics',
      'write:analytics',
      'read:documents',
      'write:documents',
      'read:integrations',
      'write:integrations',
      'admin:all'
    ]
  },

  // REST API Endpoints
  endpoints: {
    // Authentication
    auth: {
      login: {
        method: 'POST',
        path: '/auth/login',
        rateLimit: 5,
        description: 'Authenticate user and receive access token'
      },
      refresh: {
        method: 'POST',
        path: '/auth/refresh',
        rateLimit: 10,
        description: 'Refresh access token'
      },
      logout: {
        method: 'POST',
        path: '/auth/logout',
        rateLimit: 10,
        description: 'Invalidate access token'
      }
    },

    // Container Management
    containers: {
      list: {
        method: 'GET',
        path: '/containers',
        rateLimit: 100,
        scopes: ['read:containers'],
        description: 'List all containers with filtering and pagination'
      },
      get: {
        method: 'GET',
        path: '/containers/:id',
        rateLimit: 200,
        scopes: ['read:containers'],
        description: 'Get detailed container information'
      },
      create: {
        method: 'POST',
        path: '/containers',
        rateLimit: 50,
        scopes: ['write:containers'],
        description: 'Create new container tracking'
      },
      update: {
        method: 'PUT',
        path: '/containers/:id',
        rateLimit: 100,
        scopes: ['write:containers'],
        description: 'Update container information'
      },
      delete: {
        method: 'DELETE',
        path: '/containers/:id',
        rateLimit: 20,
        scopes: ['write:containers'],
        description: 'Remove container from tracking'
      },
      track: {
        method: 'GET',
        path: '/containers/:id/track',
        rateLimit: 100,
        scopes: ['read:containers'],
        description: 'Get real-time container location and status'
      },
      bulkUpdate: {
        method: 'POST',
        path: '/containers/bulk',
        rateLimit: 10,
        scopes: ['write:containers'],
        description: 'Bulk update multiple containers'
      }
    },

    // D&D Management
    ddCharges: {
      list: {
        method: 'GET',
        path: '/dd-charges',
        rateLimit: 100,
        scopes: ['read:dd_charges'],
        description: 'List all D&D charges and exposures'
      },
      prevent: {
        method: 'POST',
        path: '/dd-charges/prevent',
        rateLimit: 50,
        scopes: ['write:dd_charges'],
        description: 'Execute D&D prevention action'
      },
      dispute: {
        method: 'POST',
        path: '/dd-charges/dispute',
        rateLimit: 20,
        scopes: ['write:dd_charges'],
        description: 'File D&D dispute'
      },
      analytics: {
        method: 'GET',
        path: '/dd-charges/analytics',
        rateLimit: 50,
        scopes: ['read:analytics'],
        description: 'Get D&D analytics and trends'
      }
    },

    // Analytics
    analytics: {
      dashboard: {
        method: 'GET',
        path: '/analytics/dashboard',
        rateLimit: 50,
        scopes: ['read:analytics'],
        description: 'Get dashboard metrics and KPIs'
      },
      reports: {
        method: 'POST',
        path: '/analytics/reports',
        rateLimit: 20,
        scopes: ['read:analytics'],
        description: 'Generate custom reports'
      },
      export: {
        method: 'POST',
        path: '/analytics/export',
        rateLimit: 10,
        scopes: ['read:analytics'],
        description: 'Export analytics data'
      }
    },

    // Webhooks
    webhooks: {
      list: {
        method: 'GET',
        path: '/webhooks',
        rateLimit: 50,
        scopes: ['admin:all'],
        description: 'List configured webhooks'
      },
      create: {
        method: 'POST',
        path: '/webhooks',
        rateLimit: 10,
        scopes: ['admin:all'],
        description: 'Create new webhook'
      },
      test: {
        method: 'POST',
        path: '/webhooks/:id/test',
        rateLimit: 10,
        scopes: ['admin:all'],
        description: 'Test webhook configuration'
      }
    }
  },

  // WebSocket Events
  websocketEvents: {
    // Container Events
    'container.created': {
      description: 'New container added to tracking',
      payload: 'Container object'
    },
    'container.updated': {
      description: 'Container information updated',
      payload: 'Updated fields'
    },
    'container.status_changed': {
      description: 'Container status changed',
      payload: 'Old and new status'
    },
    'container.location_updated': {
      description: 'Container location updated',
      payload: 'Location details'
    },
    'container.at_risk': {
      description: 'Container at risk of D&D charges',
      payload: 'Risk details and recommendations'
    },

    // D&D Events
    'dd.charge_prevented': {
      description: 'D&D charge successfully prevented',
      payload: 'Prevention details and savings'
    },
    'dd.charge_incurred': {
      description: 'D&D charge incurred',
      payload: 'Charge details'
    },
    'dd.dispute_filed': {
      description: 'Dispute filed for D&D charge',
      payload: 'Dispute details'
    },
    'dd.dispute_resolved': {
      description: 'D&D dispute resolved',
      payload: 'Resolution details'
    },

    // System Events
    'integration.connected': {
      description: 'Integration successfully connected',
      payload: 'Integration details'
    },
    'integration.disconnected': {
      description: 'Integration disconnected',
      payload: 'Disconnection reason'
    },
    'system.alert': {
      description: 'System alert or notification',
      payload: 'Alert details'
    }
  },

  // Rate Limiting Configuration
  rateLimiting: {
    windowMs: 60000, // 1 minute
    skipSuccessfulRequests: false,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: res.getHeader('Retry-After')
      });
    }
  },

  // Response Formats
  responseFormats: {
    success: {
      success: true,
      data: {},
      meta: {
        timestamp: 'ISO 8601',
        version: 'API version',
        requestId: 'UUID'
      }
    },
    error: {
      success: false,
      error: {
        code: 'ERROR_CODE',
        message: 'Human readable message',
        details: {},
        documentation: 'Link to docs'
      },
      meta: {
        timestamp: 'ISO 8601',
        version: 'API version',
        requestId: 'UUID'
      }
    },
    pagination: {
      data: [],
      pagination: {
        page: 1,
        perPage: 50,
        total: 1000,
        totalPages: 20,
        hasNext: true,
        hasPrev: false
      }
    }
  },

  // Error Codes
  errorCodes: {
    // Authentication Errors (1xxx)
    AUTH_INVALID_CREDENTIALS: {
      code: 1001,
      message: 'Invalid credentials provided',
      httpStatus: 401
    },
    AUTH_TOKEN_EXPIRED: {
      code: 1002,
      message: 'Authentication token has expired',
      httpStatus: 401
    },
    AUTH_INSUFFICIENT_PERMISSIONS: {
      code: 1003,
      message: 'Insufficient permissions for this operation',
      httpStatus: 403
    },
    AUTH_API_KEY_INVALID: {
      code: 1004,
      message: 'Invalid or expired API key',
      httpStatus: 401
    },

    // Validation Errors (2xxx)
    VALIDATION_FAILED: {
      code: 2001,
      message: 'Request validation failed',
      httpStatus: 400
    },
    VALIDATION_MISSING_FIELD: {
      code: 2002,
      message: 'Required field missing',
      httpStatus: 400
    },
    VALIDATION_INVALID_FORMAT: {
      code: 2003,
      message: 'Invalid data format',
      httpStatus: 400
    },

    // Resource Errors (3xxx)
    RESOURCE_NOT_FOUND: {
      code: 3001,
      message: 'Requested resource not found',
      httpStatus: 404
    },
    RESOURCE_ALREADY_EXISTS: {
      code: 3002,
      message: 'Resource already exists',
      httpStatus: 409
    },
    RESOURCE_LOCKED: {
      code: 3003,
      message: 'Resource is locked and cannot be modified',
      httpStatus: 423
    },

    // Rate Limiting (4xxx)
    RATE_LIMIT_EXCEEDED: {
      code: 4001,
      message: 'Rate limit exceeded',
      httpStatus: 429
    },
    QUOTA_EXCEEDED: {
      code: 4002,
      message: 'API quota exceeded',
      httpStatus: 429
    },

    // Server Errors (5xxx)
    INTERNAL_ERROR: {
      code: 5001,
      message: 'Internal server error',
      httpStatus: 500
    },
    SERVICE_UNAVAILABLE: {
      code: 5002,
      message: 'Service temporarily unavailable',
      httpStatus: 503
    },
    INTEGRATION_ERROR: {
      code: 5003,
      message: 'External integration error',
      httpStatus: 502
    }
  },

  // SDK Configuration
  sdkConfig: {
    languages: ['javascript', 'python', 'java', 'go', 'ruby', 'php'],
    npmPackage: '@uip/api-client',
    githubRepo: 'https://github.com/uip/api-sdks',
    documentation: 'https://api.uip.ai/docs'
  },

  // Webhook Configuration
  webhookConfig: {
    maxRetries: 3,
    retryDelay: [1000, 5000, 30000], // milliseconds
    timeout: 30000, // 30 seconds
    signatureHeader: 'X-UIP-Signature',
    signatureAlgorithm: 'sha256',
    events: [
      'container.*',
      'dd.*',
      'integration.*',
      'system.alert'
    ]
  }
};

// Export for use in application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APIConfig;
}