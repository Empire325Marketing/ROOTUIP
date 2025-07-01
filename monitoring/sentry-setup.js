// Sentry Error Tracking Setup for ROOTUIP
// Install: npm install @sentry/node @sentry/tracing

const Sentry = require("@sentry/node");
const { ProfilingIntegration } = require("@sentry/profiling-node");

// Initialize Sentry for each service
function initializeSentry(serviceName, dsn) {
  Sentry.init({
    dsn: dsn || process.env.SENTRY_DSN,
    integrations: [
      // Automatic HTTP request tracking
      new Sentry.Integrations.Http({ tracing: true }),
      // Express middleware tracing
      new Sentry.Integrations.Express({ app: true }),
      // PostgreSQL query tracking
      new Sentry.Integrations.Postgres(),
      // Performance profiling
      new ProfilingIntegration(),
    ],
    
    // Performance Monitoring
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    
    // Release tracking
    release: process.env.SENTRY_RELEASE || `${serviceName}@${process.env.npm_package_version}`,
    
    // Environment
    environment: process.env.NODE_ENV || 'production',
    
    // Service identification
    serverName: serviceName,
    
    // Additional context
    beforeSend(event, hint) {
      // Add custom context
      event.tags = {
        ...event.tags,
        service: serviceName,
        deployment: 'vps',
      };
      
      // Filter out sensitive data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers['authorization'];
      }
      
      return event;
    },
    
    // Ignore certain errors
    ignoreErrors: [
      'Non-Error promise rejection captured',
      /Failed to fetch/,
    ],
  });
}

// Error handler middleware
function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler({
    shouldHandleError(error) {
      // Capture all errors with status 500+
      if (error.status >= 500) {
        return true;
      }
      // Capture specific client errors
      if (error.status === 401 || error.status === 403) {
        return true;
      }
      return false;
    },
  });
}

// Request handler middleware
function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler({
    user: ['id', 'email', 'role'],
    ip: true,
    request: ['method', 'url', 'query_string'],
    transaction: 'methodPath',
  });
}

// Tracing middleware
function sentryTracingHandler() {
  return Sentry.Handlers.tracingHandler();
}

// Custom error logging
function logError(error, context = {}) {
  Sentry.withScope((scope) => {
    scope.setContext('additional', context);
    scope.setLevel('error');
    Sentry.captureException(error);
  });
}

// Performance monitoring
function trackPerformance(transactionName, operation, callback) {
  const transaction = Sentry.startTransaction({
    op: operation,
    name: transactionName,
  });
  
  Sentry.configureScope((scope) => {
    scope.setSpan(transaction);
  });
  
  try {
    const result = callback();
    transaction.setStatus('ok');
    return result;
  } catch (error) {
    transaction.setStatus('internal_error');
    throw error;
  } finally {
    transaction.finish();
  }
}

// Business metric tracking
function trackBusinessMetric(metricName, value, tags = {}) {
  Sentry.withScope((scope) => {
    scope.setTag('metric_type', 'business');
    Object.entries(tags).forEach(([key, val]) => {
      scope.setTag(key, val);
    });
    scope.setContext('metric', {
      name: metricName,
      value: value,
      timestamp: new Date().toISOString(),
    });
    Sentry.captureMessage(`Business Metric: ${metricName}`, 'info');
  });
}

// Export for use in services
module.exports = {
  initializeSentry,
  sentryErrorHandler,
  sentryRequestHandler,
  sentryTracingHandler,
  logError,
  trackPerformance,
  trackBusinessMetric,
  Sentry,
};

// Example usage in Express app:
/*
const express = require('express');
const { initializeSentry, sentryRequestHandler, sentryTracingHandler, sentryErrorHandler } = require('./sentry-setup');

const app = express();

// Initialize Sentry
initializeSentry('auth-service', 'YOUR_SENTRY_DSN');

// Request tracking
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

// Your routes here
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling (must be after all other middleware)
app.use(sentryErrorHandler());

// Start server
app.listen(3002);
*/