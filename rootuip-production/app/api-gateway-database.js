const http = require("http");
const url = require("url");
const { Pool } = require("pg");
const serviceRegistry = require("./service-registry");

// Database connection
const pool = new Pool({
  host: "localhost",
  port: 5432,
  database: "uip_platform",
  user: "uip_user",
  password: "uip_secure_2024",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const port = 3006;

// Initialize database tables
async function initDatabase() {
  try {
    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS containers (
        id SERIAL PRIMARY KEY,
        container_id VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(50),
        origin VARCHAR(100),
        destination VARCHAR(100),
        eta DATE,
        risk_level VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS roi_leads (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        container_volume INTEGER,
        dd_cost_per_day DECIMAL(10,2),
        current_dd_days INTEGER,
        industry VARCHAR(100),
        estimated_savings DECIMAL(12,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform_metrics (
        id SERIAL PRIMARY KEY,
        metric_name VARCHAR(100) UNIQUE NOT NULL,
        metric_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default metrics if not exists
    await pool.query(`
      INSERT INTO platform_metrics (metric_name, metric_value)
      VALUES 
        ('activeShipments', '127'),
        ('onTimeDelivery', '94.2'),
        ('ddRiskScore', '2.8'),
        ('costSavings', '142000')
      ON CONFLICT (metric_name) DO NOTHING
    `);

    // Insert sample containers if table is empty
    const { rowCount } = await pool.query("SELECT COUNT(*) FROM containers");
    if (rowCount === 0 || parseInt(rowCount) === 0) {
      await pool.query(`
        INSERT INTO containers (container_id, status, origin, destination, eta, risk_level)
        VALUES 
          ('MSKU7834521', 'In Transit', 'Shanghai', 'Los Angeles', '2025-01-15', 'Low'),
          ('MSCU8945612', 'At Port', 'Hong Kong', 'New York', '2025-01-12', 'Medium')
      `);
    }

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
  }
}

// API handlers with real database queries
const handlers = {
  health: async (req, res) => {
    try {
      // Check database connection
      await pool.query("SELECT 1");
      
      // Check other services
      const services = {};
      for (const [name, config] of Object.entries(serviceRegistry.services)) {
        try {
          const healthCheck = await serviceRegistry.checkHealth(name);
          services[name] = healthCheck.healthy ? "online" : "offline";
        } catch (error) {
          services[name] = "offline";
        }
      }

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
  },

  metrics: async (req, res) => {
    try {
      const result = await pool.query("SELECT metric_name, metric_value FROM platform_metrics");
      const metrics = {};
      
      result.rows.forEach(row => {
        const value = row.metric_value;
        metrics[row.metric_name] = isNaN(value) ? value : parseFloat(value);
      });

      res.writeHead(200);
      res.end(JSON.stringify(metrics));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Failed to fetch metrics" }));
    }
  },

  containers: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT container_id as id, status, origin, destination, 
               TO_CHAR(eta, 'YYYY-MM-DD') as eta, risk_level as "riskLevel"
        FROM containers 
        ORDER BY created_at DESC 
        LIMIT 10
      `);

      res.writeHead(200);
      res.end(JSON.stringify(result.rows));
    } catch (error) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Failed to fetch containers" }));
    }
  },

  user: async (req, res) => {
    // For now, return mock user - in production, this would check auth token
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      user: {
        name: "Demo User",
        email: "demo@rootuip.com",
        company: "Acme Corporation",
        companyId: "ACME001",
        role: "Admin"
      }
    }));
  },

  roiCalculator: async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405);
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        
        // Calculate estimated savings
        const annualDDCost = (data.ddCostPerDay || 150) * (data.currentDDDays || 500);
        const estimatedSavings = annualDDCost * 0.35; // 35% average reduction

        // Save lead to database
        const result = await pool.query(`
          INSERT INTO roi_leads (email, company, container_volume, dd_cost_per_day, current_dd_days, industry, estimated_savings)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [
          data.email,
          data.company,
          data.containerVolume,
          data.ddCostPerDay || 150,
          data.currentDDDays || 500,
          data.industry || 'other',
          estimatedSavings
        ]);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: "ROI calculation saved successfully",
          leadId: `lead_${result.rows[0].id}`,
          estimatedSavings: Math.round(estimatedSavings)
        }));
      } catch (error) {
        console.error("ROI calculation error:", error);
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Invalid request data" }));
      }
    });
  }
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json");
  
  // Handle OPTIONS
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Route handling
  try {
    if (path === "/api/health") {
      await handlers.health(req, res);
    } else if (path === "/api/metrics") {
      await handlers.metrics(req, res);
    } else if (path === "/api/containers/recent") {
      await handlers.containers(req, res);
    } else if (path === "/api/user") {
      await handlers.user(req, res);
    } else if (path === "/api/roi-calculator/submit") {
      await handlers.roiCalculator(req, res);
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    }
  } catch (error) {
    console.error("Request error:", error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

// Start server
server.listen(port, async () => {
  console.log(`API Gateway with database running on port ${port}`);
  await initDatabase();
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down gracefully...");
  pool.end();
  server.close();
  process.exit(0);
});