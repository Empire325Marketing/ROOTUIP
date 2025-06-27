const http = require("http");
const url = require("url");

const port = 3006;

// Mock data
const mockData = {
  health: {
    status: "healthy",
    timestamp: new Date().toISOString(),
    platform: "ROOTUIP Enterprise",
    version: "1.0.0",
    services: {
      auth: "online",
      integrations: "online",
      aiml: "online",
      portal: "online",
      workflows: "online"
    }
  },
  metrics: {
    activeShipments: 127,
    onTimeDelivery: "94.2%",
    ddRiskScore: "2.8",
    costSavings: 142000
  },
  containers: [
    {
      id: "MSKU7834521",
      status: "In Transit",
      origin: "Shanghai",
      destination: "Los Angeles",
      eta: "2024-01-15",
      riskLevel: "Low"
    },
    {
      id: "MSCU8945612",
      status: "At Port",
      origin: "Hong Kong",
      destination: "New York",
      eta: "2024-01-12",
      riskLevel: "Medium"
    }
  ],
  user: {
    success: true,
    user: {
      name: "Demo User",
      email: "demo@rootuip.com",
      company: "Acme Corporation",
      companyId: "ACME001",
      role: "Admin"
    }
  }
};

const server = http.createServer((req, res) => {
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
  if (path === "/api/health") {
    res.writeHead(200);
    res.end(JSON.stringify(mockData.health));
  } else if (path === "/api/metrics") {
    res.writeHead(200);
    res.end(JSON.stringify(mockData.metrics));
  } else if (path === "/api/containers/recent") {
    res.writeHead(200);
    res.end(JSON.stringify(mockData.containers));
  } else if (path === "/api/user") {
    res.writeHead(200);
    res.end(JSON.stringify(mockData.user));
  } else if (path === "/api/roi-calculator/submit" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        message: "ROI calculation saved successfully",
        leadId: "lead_" + Date.now()
      }));
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(port, () => {
  console.log(`API Gateway running on port ${port}`);
});