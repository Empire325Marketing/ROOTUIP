const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;

console.log('Starting ROOTUIP Local Proxy Server...');

// Serve local files first
app.use(express.static('/home/iii/ROOTUIP/ROOTUIP', {
    extensions: ['html', 'htm'],
    index: 'index.html'
}));

// Serve files from parent directory too
app.use(express.static('/home/iii/ROOTUIP', {
    extensions: ['html', 'htm']
}));

// ML API proxy
app.use('/ml', createProxyMiddleware({
    target: 'http://localhost:3004',
    changeOrigin: true
}));

// Auth API proxy
app.use('/auth', createProxyMiddleware({
    target: 'http://localhost:3003',
    changeOrigin: true
}));

// Static server API
app.use('/api', createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true
}));

// Fallback to proxy to the real rootuip.com for other content
app.use('/', createProxyMiddleware({
    target: 'https://rootuip.com',
    changeOrigin: true,
    secure: false,
    onProxyReq: (proxyReq, req, res) => {
        // Remove headers that might cause issues
        proxyReq.removeHeader('x-forwarded-for');
        proxyReq.removeHeader('x-forwarded-proto');
    },
    onProxyRes: (proxyRes, req, res) => {
        // Override 404s for our known files
        if (proxyRes.statusCode === 404) {
            const localPath = path.join('/home/iii/ROOTUIP/ROOTUIP', req.url);
            if (fs.existsSync(localPath)) {
                // Don't use the proxy response, serve local file instead
                proxyRes.statusCode = 200;
                res.sendFile(localPath);
                return;
            }
        }
    }
}));

app.listen(PORT, () => {
    console.log(`
========================================
ROOTUIP Local Proxy Server Running
========================================

Access your demos at:
- http://localhost:${PORT}/ml-demo.html
- http://localhost:${PORT}/login.html
- http://localhost:${PORT}/enterprise-security-dashboard.html
- http://localhost:${PORT}/monitoring-dashboard.html

This proxy server:
1. Serves YOUR local files (ml-demo.html, etc.)
2. Proxies ML API calls to localhost:3004
3. Proxies Auth API calls to localhost:3003
4. Falls back to the real rootuip.com for other content

To access from your browser:
1. Open http://localhost:${PORT}
2. All your demos will work with full API access
`);
});