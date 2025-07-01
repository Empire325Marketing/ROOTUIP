// Quick fix for health check in API gateway
const http = require('http');

async function checkServiceHealth(name, port) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/health',
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200 ? 'online' : 'offline');
    });

    req.on('error', () => resolve('offline'));
    req.on('timeout', () => {
      req.destroy();
      resolve('offline');
    });

    req.end();
  });
}

// Update the health handler in api-gateway-database.js
const healthHandler = async (req, res) => {
  try {
    // Check database connection
    await pool.query("SELECT 1");
    
    // Check other services with simple port check
    const services = {
      auth: await checkServiceHealth('auth', 3001),
      integration: await checkServiceHealth('integration', 3002),
      aiml: await checkServiceHealth('aiml', 3003),
      portal: await checkServiceHealth('portal', 3004),
      workflow: await checkServiceHealth('workflow', 3005),
      apiGateway: 'online' // Self
    };

    res.writeHead(200);
    res.end(JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      platform: "ROOTUIP Enterprise",
      version: "2.0.0",
      database: "connected",
      services
    }));
  } catch (error) {
    res.writeHead(503);
    res.end(JSON.stringify({
      status: "unhealthy",
      error: error.message
    }));
  }
};