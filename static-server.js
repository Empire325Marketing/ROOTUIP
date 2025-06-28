const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Enable CORS for all origins
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Serve static files from ROOTUIP directory
app.use(express.static('/home/iii/ROOTUIP', {
    extensions: ['html', 'htm'],
    index: 'index.html'
}));

// Special route for root to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join('/home/iii/ROOTUIP', 'index.html'));
});

// API proxy endpoints (pass through to respective services)
app.use('/api', (req, res) => {
    // Proxy to main app API if needed
    res.status(404).json({ error: 'API endpoint not configured' });
});

// Auth service proxy
app.use('/auth', (req, res, next) => {
    const proxy = require('http-proxy-middleware').createProxyMiddleware({
        target: 'http://localhost:3003',
        changeOrigin: true
    });
    proxy(req, res, next);
});

// ML service proxy
app.use('/ml', (req, res, next) => {
    const proxy = require('http-proxy-middleware').createProxyMiddleware({
        target: 'http://localhost:3004',
        changeOrigin: true
    });
    proxy(req, res, next);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        service: 'static-server',
        timestamp: new Date().toISOString()
    });
});

// 404 handler - try to serve the file with .html extension
app.use((req, res, next) => {
    const htmlPath = path.join('/home/iii/ROOTUIP', req.path + '.html');
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>404 - Page Not Found</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    h1 { color: #e53e3e; }
                    a { color: #3182ce; text-decoration: none; }
                </style>
            </head>
            <body>
                <h1>404 - Page Not Found</h1>
                <p>The requested page "${req.path}" was not found.</p>
                <p><a href="/">Return to Home</a></p>
            </body>
            </html>
        `);
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

app.listen(PORT, () => {
    console.log(`Static server running on http://localhost:${PORT}`);
    console.log(`Serving files from: /home/iii/ROOTUIP`);
    console.log('Available endpoints:');
    console.log('  - Static files: http://localhost:3000/*');
    console.log('  - Auth API: http://localhost:3000/auth/*');
    console.log('  - ML API: http://localhost:3000/ml/*');
});