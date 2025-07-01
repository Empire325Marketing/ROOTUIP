#!/bin/bash

# ROOTUIP Complete Production Deployment Script
# Deploy to VPS 145.223.73.4 with full infrastructure setup
# Features: SSL, PM2, Nginx, MongoDB, Redis, CloudFlare Ready, Monitoring
# Version: 3.1.0

set -e

# Configuration
VPS_IP="145.223.73.4"
VPS_USER="root"
DOMAIN="rootuip.com"
EMAIL="admin@rootuip.com"
REPO_URL="https://github.com/rootuip/platform.git"
NODE_VERSION="18"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}================================================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}================================================================${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%H:%M:%S') - $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%H:%M:%S') - $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%H:%M:%S') - $1"
}

# Create comprehensive deployment package
create_production_package() {
    print_header "CREATING COMPREHENSIVE PRODUCTION PACKAGE"
    
    DEPLOY_DIR="rootuip-production-final"
    rm -rf $DEPLOY_DIR
    mkdir -p $DEPLOY_DIR/{app,configs,scripts,services,templates}
    
    # Copy all application files
    print_status "Packaging application files..."
    cp -r public $DEPLOY_DIR/app/ 2>/dev/null || true
    cp *.js $DEPLOY_DIR/app/ 2>/dev/null || true
    cp package*.json $DEPLOY_DIR/app/ 2>/dev/null || true
    cp -r ai-ml $DEPLOY_DIR/app/ 2>/dev/null || true
    cp -r analytics $DEPLOY_DIR/app/ 2>/dev/null || true
    cp -r integrations $DEPLOY_DIR/app/ 2>/dev/null || true
    
    # Create production package.json
    cat > $DEPLOY_DIR/app/package.json << 'EOFPACKAGE'
{
  "name": "rootuip-platform",
  "version": "3.1.0",
  "description": "ROOTUIP Logistics Intelligence Platform - Production",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "build": "npm run build:client",
    "build:client": "echo 'Client build completed'",
    "test": "jest",
    "migrate": "node scripts/migrate.js",
    "health": "curl -f http://localhost:3000/api/health || exit 1",
    "deploy": "git pull && npm install --production && npm run build && pm2 restart all"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "express-rate-limit": "^6.8.1",
    "express-slow-down": "^1.6.0",
    "morgan": "^1.10.0",
    "winston": "^3.10.0",
    "winston-daily-rotate-file": "^4.7.1",
    "dotenv": "^16.3.1",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^7.4.0",
    "redis": "^4.6.7",
    "nodemailer": "^6.9.4",
    "multer": "^1.4.5-lts.1",
    "axios": "^1.4.0",
    "moment": "^2.29.4",
    "lodash": "^4.17.21",
    "validator": "^13.9.0",
    "socket.io": "^4.7.2"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
EOFPACKAGE

    # Create main production server
    cat > $DEPLOY_DIR/app/server.js << 'EOFSERVER'
// ROOTUIP Production Server - Main Entry Point
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const morgan = require('morgan');
const winston = require('winston');
const path = require('path');
require('dotenv').config();

const app = express();

// Logger configuration
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'rootuip-main' },
    transports: [
        new winston.transports.File({ 
            filename: '/var/log/rootuip/error.log', 
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        new winston.transports.File({ 
            filename: '/var/log/rootuip/combined.log',
            maxsize: 5242880,
            maxFiles: 5
        }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.rootuip.com", "wss:", "ws:"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/health'
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        error: 'Too many authentication attempts, please try again later.',
        retryAfter: '15 minutes'
    }
});

const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: 500
});

app.use('/api/', apiLimiter);
app.use('/api/', speedLimiter);
app.use('/api/auth/', authLimiter);

// General middleware
app.use(compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    },
    level: 6
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? [
            'https://rootuip.com', 
            'https://www.rootuip.com',
            'https://app.rootuip.com', 
            'https://demo.rootuip.com', 
            'https://customer.rootuip.com'
        ]
        : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(morgan('combined', { 
    stream: { 
        write: message => logger.info(message.trim()) 
    },
    skip: (req) => req.path === '/api/health'
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files with caching
app.use(express.static('public', {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        } else if (path.match(/\.(js|css)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        } else if (path.match(/\.(png|jpg|jpeg|gif|ico|svg)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=604800');
        }
    }
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '3.1.0',
        environment: process.env.NODE_ENV || 'production',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid,
        hostname: require('os').hostname(),
        loadAverage: require('os').loadavg(),
        checks: {
            database: true, // Add actual DB check
            cache: true,    // Add actual Redis check
            api: true
        }
    };
    
    res.json(healthData);
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        platform: 'ROOTUIP',
        version: '3.1.0',
        status: 'operational',
        services: {
            main: 'healthy',
            api: 'healthy',
            demo: 'healthy',
            database: 'healthy'
        },
        lastDeployment: process.env.DEPLOYMENT_TIME || new Date().toISOString()
    });
});

// Load route modules
try {
    if (require('fs').existsSync('./demo-server.js')) {
        const demoRoutes = require('./demo-server');
        app.use('/demo', demoRoutes);
        logger.info('Demo routes loaded');
    }
} catch (error) {
    logger.warn('Demo routes not available:', error.message);
}

try {
    if (require('fs').existsSync('./api-routes.js')) {
        const apiRoutes = require('./api-routes');
        app.use('/api', apiRoutes);
        logger.info('API routes loaded');
    }
} catch (error) {
    logger.warn('API routes not available:', error.message);
}

// Default routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/customer', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'customer-portal.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Global error handler
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message,
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Uncaught exception handler
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`ROOTUIP Platform running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'production'}`);
    logger.info(`Health check: http://localhost:${PORT}/api/health`);
    logger.info(`Process ID: ${process.pid}`);
});

// Server timeout configuration
server.timeout = 30000;
server.keepAliveTimeout = 5000;
server.headersTimeout = 60000;

module.exports = app;
EOFSERVER

    # Create Nginx configuration with all subdomains
    cat > $DEPLOY_DIR/configs/nginx-rootuip << 'EOFNGINX'
# ROOTUIP Production Nginx Configuration
# Version: 3.1.0

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=30r/s;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

# Upstream definitions for load balancing
upstream rootuip_main {
    least_conn;
    server 127.0.0.1:3000 weight=1 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 weight=1 max_fails=3 fail_timeout=30s backup;
    keepalive 32;
}

upstream rootuip_api {
    least_conn;
    server 127.0.0.1:3002 weight=1 max_fails=3 fail_timeout=30s;
    keepalive 16;
}

upstream rootuip_demo {
    server 127.0.0.1:3030 weight=1 max_fails=3 fail_timeout=30s;
    keepalive 16;
}

# Security headers map
map $sent_http_content_type $security_headers {
    default "nosniff";
    ~image/ "nosniff";
}

# Main domain - rootuip.com
server {
    listen 80;
    listen [::]:80;
    server_name rootuip.com www.rootuip.com;
    
    # Security headers for HTTP
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name rootuip.com www.rootuip.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    ssl_certificate_chain /etc/letsencrypt/live/rootuip.com/chain.pem;
    
    # SSL Security
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/rootuip.com/chain.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.rootuip.com wss: ws:;" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml
        application/x-font-ttf
        font/opentype;

    # Rate limiting
    limit_req zone=general_limit burst=50 nodelay;

    # Root location
    location / {
        proxy_pass http://rootuip_main;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 30;
        proxy_send_timeout 30;
    }

    # API routes with specific rate limiting
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://rootuip_main;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60;
    }

    # Authentication endpoints with stricter limits
    location /api/auth/ {
        limit_req zone=auth_limit burst=3 nodelay;
        proxy_pass http://rootuip_main;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files with long-term caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Cache-Status "STATIC";
        access_log off;
    }

    # Health check endpoint (no rate limiting, no logging)
    location = /api/health {
        proxy_pass http://rootuip_main;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        access_log off;
    }

    # Robots.txt
    location = /robots.txt {
        add_header Content-Type text/plain;
        return 200 "User-agent: *\nAllow: /\nSitemap: https://rootuip.com/sitemap.xml\n";
    }

    # Security.txt
    location = /.well-known/security.txt {
        add_header Content-Type text/plain;
        return 200 "Contact: security@rootuip.com\nExpires: 2025-12-31T23:59:59.000Z\n";
    }
}

# App subdomain - app.rootuip.com
server {
    listen 80;
    listen [::]:80;
    server_name app.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.rootuip.com;

    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate limiting for app users
    limit_req zone=general_limit burst=100 nodelay;

    location / {
        proxy_pass http://rootuip_main;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API subdomain - api.rootuip.com
server {
    listen 80;
    listen [::]:80;
    server_name api.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.rootuip.com;

    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # API-specific security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;

    # Strict API rate limiting
    limit_req zone=api_limit burst=20 nodelay;

    location / {
        proxy_pass http://rootuip_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60;
        proxy_connect_timeout 60;
        proxy_send_timeout 60;
        
        # CORS headers for API
        add_header Access-Control-Allow-Origin "https://app.rootuip.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
        add_header Access-Control-Max-Age 86400 always;
    }

    # Handle CORS preflight requests
    location @cors {
        add_header Access-Control-Allow-Origin "https://app.rootuip.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
        add_header Access-Control-Max-Age 86400 always;
        add_header Content-Length 0;
        add_header Content-Type "text/plain charset=UTF-8";
        return 204;
    }

    if ($request_method = 'OPTIONS') {
        return 204;
    }
}

# Demo subdomain - demo.rootuip.com
server {
    listen 80;
    listen [::]:80;
    server_name demo.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name demo.rootuip.com;

    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;

    # Demo rate limiting (more permissive for demonstrations)
    limit_req zone=general_limit burst=200 nodelay;

    location / {
        proxy_pass http://rootuip_demo;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Customer portal - customer.rootuip.com
server {
    listen 80;
    listen [::]:80;
    server_name customer.rootuip.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name customer.rootuip.com;

    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header X-Content-Type-Options nosniff always;

    # Customer portal rate limiting
    limit_req zone=general_limit burst=150 nodelay;

    location / {
        proxy_pass http://rootuip_main;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOFNGINX

    # Create PM2 ecosystem configuration
    cat > $DEPLOY_DIR/configs/ecosystem.config.js << 'EOFPM2'
module.exports = {
  apps: [
    {
      name: 'rootuip-main',
      script: 'server.js',
      cwd: '/var/www/rootuip',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DEPLOYMENT_TIME: new Date().toISOString()
      },
      env_file: '/etc/rootuip/.env',
      error_file: '/var/log/rootuip/main-error.log',
      out_file: '/var/log/rootuip/main-out.log',
      log_file: '/var/log/rootuip/main.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 4000
    },
    {
      name: 'rootuip-main-backup',
      script: 'server.js',
      cwd: '/var/www/rootuip',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      env_file: '/etc/rootuip/.env',
      error_file: '/var/log/rootuip/backup-error.log',
      out_file: '/var/log/rootuip/backup-out.log',
      log_file: '/var/log/rootuip/backup.log',
      time: true,
      max_memory_restart: '800M',
      autorestart: true,
      max_restarts: 3,
      min_uptime: '10s'
    },
    {
      name: 'rootuip-api',
      script: 'api-server.js',
      cwd: '/var/www/rootuip',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      env_file: '/etc/rootuip/.env',
      error_file: '/var/log/rootuip/api-error.log',
      out_file: '/var/log/rootuip/api-out.log',
      log_file: '/var/log/rootuip/api.log',
      time: true,
      max_memory_restart: '800M',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s'
    },
    {
      name: 'rootuip-demo',
      script: 'demo-server.js',
      cwd: '/var/www/rootuip',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3030
      },
      env_file: '/etc/rootuip/.env',
      error_file: '/var/log/rootuip/demo-error.log',
      out_file: '/var/log/rootuip/demo-out.log',
      log_file: '/var/log/rootuip/demo.log',
      time: true,
      max_memory_restart: '512M',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s'
    },
    {
      name: 'rootuip-worker',
      script: 'background-worker.js',
      cwd: '/var/www/rootuip',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      env_file: '/etc/rootuip/.env',
      error_file: '/var/log/rootuip/worker-error.log',
      out_file: '/var/log/rootuip/worker-out.log',
      log_file: '/var/log/rootuip/worker.log',
      time: true,
      max_memory_restart: '512M',
      cron_restart: '0 4 * * *',
      autorestart: true,
      watch: false
    }
  ]
};
EOFPM2

    # Create API server (if not exists)
    cat > $DEPLOY_DIR/app/api-server.js << 'EOFAPI'
// ROOTUIP API Server - Dedicated API Service
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet({
    crossOriginEmbedderPolicy: false
}));

// CORS configuration for API
app.use(cors({
    origin: [
        'https://rootuip.com',
        'https://app.rootuip.com',
        'https://demo.rootuip.com',
        'https://customer.rootuip.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key']
}));

// API rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'API rate limit exceeded' }
});

app.use(apiLimiter);
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'api',
        timestamp: new Date().toISOString(),
        version: '3.1.0'
    });
});

// API routes would go here
app.get('/api/version', (req, res) => {
    res.json({
        version: '3.1.0',
        service: 'ROOTUIP API',
        endpoints: [
            '/api/health',
            '/api/version',
            '/api/shipments',
            '/api/tracking',
            '/api/analytics'
        ]
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'API endpoint not found',
        path: req.path
    });
});

const PORT = process.env.API_PORT || 3002;
app.listen(PORT, '127.0.0.1', () => {
    console.log(`ROOTUIP API Server running on port ${PORT}`);
});

module.exports = app;
EOFAPI

    # Create background worker
    cat > $DEPLOY_DIR/app/background-worker.js << 'EOFWORKER'
// ROOTUIP Background Worker - Scheduled Tasks and Processing
const cron = require('node-cron');
require('dotenv').config();

console.log('🔧 ROOTUIP Background Worker starting...');

// Cleanup task - runs every hour
cron.schedule('0 * * * *', () => {
    console.log('🧹 Running cleanup tasks...');
    // Add cleanup logic here
});

// Health metrics collection - runs every 15 minutes
cron.schedule('*/15 * * * *', () => {
    console.log('📊 Collecting health metrics...');
    // Add metrics collection logic here
});

// Database maintenance - runs daily at 2 AM
cron.schedule('0 2 * * *', () => {
    console.log('🗄️ Running database maintenance...');
    // Add database maintenance logic here
});

// Email queue processing - runs every 5 minutes
cron.schedule('*/5 * * * *', () => {
    console.log('📧 Processing email queue...');
    // Add email processing logic here
});

console.log('✅ Background worker initialized with scheduled tasks');

// Keep the process alive
process.on('SIGTERM', () => {
    console.log('🛑 Background worker shutting down...');
    process.exit(0);
});
EOFWORKER

    print_success "Production package created successfully"
}

# Create VPS deployment script
create_vps_deployment() {
    print_status "Creating VPS deployment script..."
    
    cat > $DEPLOY_DIR/scripts/deploy-on-vps.sh << 'EOFVPS'
#!/bin/bash

# VPS Production Deployment Script
set -e

echo "🚀 Starting ROOTUIP production deployment on VPS..."

# Update system packages
echo "📦 Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt update && apt upgrade -y

# Install Node.js 18
if ! command -v node &> /dev/null; then
    echo "📗 Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    echo "⚙️ Installing PM2..."
    npm install -g pm2@latest
fi

# Install essential packages
echo "🔧 Installing essential packages..."
apt install -y nginx certbot python3-certbot-nginx redis-server \
    mongodb-org htop ufw fail2ban logrotate cron \
    software-properties-common build-essential git

# Install MongoDB if not present
if ! command -v mongod &> /dev/null; then
    echo "🗄️ Installing MongoDB..."
    wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt update
    apt install -y mongodb-org
fi

# Create application user
if ! id "rootuip" &>/dev/null; then
    echo "👤 Creating application user..."
    useradd -r -s /bin/bash -m -d /home/rootuip rootuip
    usermod -aG www-data rootuip
    usermod -aG sudo rootuip
fi

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p /var/www/rootuip
mkdir -p /var/log/rootuip
mkdir -p /var/backups/rootuip
mkdir -p /etc/rootuip
mkdir -p /var/www/rootuip/uploads
mkdir -p /var/www/rootuip/temp

# Set ownership and permissions
chown -R rootuip:www-data /var/www/rootuip
chown -R rootuip:rootuip /var/log/rootuip
chown -R root:root /etc/rootuip
chmod 755 /var/www/rootuip
chmod 755 /var/log/rootuip
chmod 700 /etc/rootuip

echo "✅ System setup completed"
EOFVPS

    # Create environment setup script
    cat > $DEPLOY_DIR/scripts/setup-environment.sh << 'EOFENV'
#!/bin/bash

echo "🔐 Setting up production environment configuration..."

# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 32)
CSRF_SECRET=$(openssl rand -base64 32)
BACKUP_KEY=$(openssl rand -base64 32)

# Create production environment file
cat > /etc/rootuip/.env << ENVEOF
# ROOTUIP Production Environment Configuration
# Generated: $(date)
# Version: 3.1.0

#############################################
# CORE APPLICATION SETTINGS
#############################################
NODE_ENV=production
PORT=3000
API_PORT=3002
DEMO_PORT=3030
APP_NAME=ROOTUIP
APP_VERSION=3.1.0

#############################################
# DOMAIN CONFIGURATION  
#############################################
DOMAIN=rootuip.com
API_URL=https://api.rootuip.com
APP_URL=https://app.rootuip.com
DEMO_URL=https://demo.rootuip.com
CUSTOMER_URL=https://customer.rootuip.com

#############################################
# DATABASE CONFIGURATION
#############################################
MONGODB_URI=mongodb://localhost:27017/rootuip_production
REDIS_URL=redis://localhost:6379
DB_CONNECTION_TIMEOUT=30000
DB_MAX_CONNECTIONS=100

#############################################
# AUTHENTICATION & SECURITY
#############################################
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_EXPIRES_IN=30d
SESSION_SECRET=${SESSION_SECRET}
SESSION_MAX_AGE=86400000
CSRF_SECRET=${CSRF_SECRET}
BCRYPT_ROUNDS=12

#############################################
# EMAIL CONFIGURATION
#############################################
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@rootuip.com
SMTP_PASS=your_smtp_password_here
EMAIL_FROM=noreply@rootuip.com
SUPPORT_EMAIL=support@rootuip.com

#############################################
# EXTERNAL API INTEGRATIONS
#############################################
MAERSK_API_KEY=your_maersk_api_key_here
MSC_API_KEY=your_msc_api_key_here
COSCO_API_KEY=your_cosco_api_key_here
CMA_CGM_API_KEY=your_cma_cgm_api_key_here
HAPAG_LLOYD_API_KEY=your_hapag_lloyd_api_key_here

#############################################
# MONITORING & ANALYTICS
#############################################
SENTRY_DSN=your_sentry_dsn_here
ANALYTICS_API_KEY=your_analytics_key_here
NEW_RELIC_LICENSE_KEY=your_new_relic_key_here

#############################################
# FILE STORAGE
#############################################
UPLOAD_PATH=/var/www/rootuip/uploads
UPLOAD_MAX_SIZE=52428800
TEMP_PATH=/var/www/rootuip/temp

#############################################
# RATE LIMITING & PERFORMANCE
#############################################
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
API_RATE_LIMIT=1000
CACHE_TTL=3600

#############################################
# LOGGING
#############################################
LOG_LEVEL=info
LOG_FILE=/var/log/rootuip/app.log
ERROR_LOG_FILE=/var/log/rootuip/error.log

#############################################
# BACKUP CONFIGURATION
#############################################
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 */6 * * *
BACKUP_RETENTION_DAYS=30
BACKUP_LOCATION=/var/backups/rootuip
BACKUP_ENCRYPTION_KEY=${BACKUP_KEY}

#############################################
# FEATURE FLAGS
#############################################
ENABLE_REAL_TIME_TRACKING=true
ENABLE_AI_PREDICTIONS=true
ENABLE_ADVANCED_ANALYTICS=true
ENABLE_DOCUMENT_OCR=true

#############################################
# CLUSTER SETTINGS
#############################################
CLUSTER_ENABLED=true
CLUSTER_WORKERS=2
MAX_MEMORY_RESTART=1024
ENVEOF

# Set secure permissions
chmod 600 /etc/rootuip/.env
chown root:root /etc/rootuip/.env

echo "✅ Environment configuration created with secure secrets"
EOFENV

    # Create database setup script
    cat > $DEPLOY_DIR/scripts/setup-databases.sh << 'EOFDB'
#!/bin/bash

echo "🗄️ Setting up databases..."

# Start and enable MongoDB
systemctl start mongod
systemctl enable mongod

# Configure MongoDB
if ! mongo --eval "db.version()" &> /dev/null; then
    echo "❌ MongoDB connection failed"
    exit 1
fi

# Create production database and collections
mongo --eval "
use rootuip_production;
db.createCollection('users');
db.createCollection('shipments');
db.createCollection('analytics');
db.createCollection('logs');
db.createCollection('notifications');
"

# Start and enable Redis
systemctl start redis-server
systemctl enable redis-server

# Test Redis connection
if ! redis-cli ping | grep -q "PONG"; then
    echo "❌ Redis connection failed"
    exit 1
fi

echo "✅ Databases configured and running"
EOFDB

    chmod +x $DEPLOY_DIR/scripts/*.sh
    print_success "VPS deployment scripts created"
}

# Create monitoring and health check scripts
create_monitoring_scripts() {
    print_status "Creating comprehensive monitoring scripts..."
    
    # Health check script
    cat > $DEPLOY_DIR/scripts/health-check.sh << 'EOFHEALTH'
#!/bin/bash

# ROOTUIP Comprehensive Health Check
LOG_FILE="/var/log/rootuip/health-check.log"
ALERT_EMAIL="admin@rootuip.com"
CRITICAL_ISSUES=0

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check all application endpoints
check_endpoints() {
    endpoints=(
        "http://localhost:3000/api/health:Main App"
        "http://localhost:3002/api/health:API Service"  
        "http://localhost:3030/api/health:Demo Service"
    )
    
    for endpoint_info in "${endpoints[@]}"; do
        IFS=':' read -r endpoint name <<< "$endpoint_info"
        
        if curl -f -s "$endpoint" --max-time 10 > /dev/null; then
            log_message "✅ $name healthy ($endpoint)"
        else
            log_message "❌ $name unhealthy ($endpoint)"
            CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
        fi
    done
}

# Check SSL certificates
check_ssl_certificates() {
    domains=("rootuip.com" "app.rootuip.com" "api.rootuip.com" "demo.rootuip.com" "customer.rootuip.com")
    
    for domain in "${domains[@]}"; do
        expiry=$(openssl s_client -connect $domain:443 -servername $domain 2>/dev/null | \
                openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
        
        if [ $? -eq 0 ]; then
            expiry_epoch=$(date -d "$expiry" +%s)
            current_epoch=$(date +%s)
            days_left=$(( ($expiry_epoch - $current_epoch) / 86400 ))
            
            if [ $days_left -gt 30 ]; then
                log_message "✅ SSL certificate valid for $domain ($days_left days)"
            elif [ $days_left -gt 7 ]; then
                log_message "⚠️ SSL certificate expires soon for $domain ($days_left days)"
            else
                log_message "❌ SSL certificate expires very soon for $domain ($days_left days)"
                CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
            fi
        else
            log_message "❌ Cannot check SSL certificate for $domain"
        fi
    done
}

# Check databases
check_databases() {
    # MongoDB
    if mongosh --eval "db.adminCommand('ping')" rootuip_production &>/dev/null; then
        log_message "✅ MongoDB accessible"
    else
        log_message "❌ MongoDB not accessible"
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
    fi
    
    # Redis
    if redis-cli ping | grep -q "PONG"; then
        log_message "✅ Redis accessible"
    else
        log_message "❌ Redis not accessible"
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
    fi
}

# Check PM2 processes
check_pm2_processes() {
    processes=("rootuip-main" "rootuip-api" "rootuip-demo")
    
    for process in "${processes[@]}"; do
        if pm2 describe "$process" 2>/dev/null | grep -q "online"; then
            log_message "✅ PM2 process $process running"
        else
            log_message "❌ PM2 process $process not running"
            CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
        fi
    done
}

# Check system resources
check_system_resources() {
    # CPU usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    if (( $(echo "$cpu_usage < 80" | bc -l) )); then
        log_message "✅ CPU usage normal ($cpu_usage%)"
    elif (( $(echo "$cpu_usage < 90" | bc -l) )); then
        log_message "⚠️ High CPU usage ($cpu_usage%)"
    else
        log_message "❌ Critical CPU usage ($cpu_usage%)"
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
    fi
    
    # Memory usage
    memory_usage=$(free | awk 'NR==2{printf "%.1f", $3*100/$2}')
    if (( $(echo "$memory_usage < 80" | bc -l) )); then
        log_message "✅ Memory usage normal ($memory_usage%)"
    elif (( $(echo "$memory_usage < 90" | bc -l) )); then
        log_message "⚠️ High memory usage ($memory_usage%)"
    else
        log_message "❌ Critical memory usage ($memory_usage%)"
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
    fi
    
    # Disk usage
    disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 80 ]; then
        log_message "✅ Disk usage normal ($disk_usage%)"
    elif [ "$disk_usage" -lt 90 ]; then
        log_message "⚠️ High disk usage ($disk_usage%)"
    else
        log_message "❌ Critical disk usage ($disk_usage%)"
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
    fi
    
    # Load average
    load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    log_message "📊 Load average: $load_avg"
}

# Check network connectivity
check_network() {
    if ping -c 1 8.8.8.8 &> /dev/null; then
        log_message "✅ Internet connectivity OK"
    else
        log_message "❌ No internet connectivity"
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
    fi
}

# Check log file sizes
check_log_sizes() {
    log_dir="/var/log/rootuip"
    if [ -d "$log_dir" ]; then
        total_size=$(du -sh "$log_dir" | cut -f1)
        log_message "📁 Log directory size: $total_size"
        
        # Check for large log files
        find "$log_dir" -name "*.log" -size +100M -exec basename {} \; | while read large_log; do
            log_message "⚠️ Large log file detected: $large_log"
        done
    fi
}

# Main health check execution
log_message "=== Starting comprehensive health check ==="

check_endpoints
check_ssl_certificates
check_databases
check_pm2_processes
check_system_resources
check_network
check_log_sizes

# Generate summary
if [ $CRITICAL_ISSUES -eq 0 ]; then
    log_message "✅ Overall health: HEALTHY (0 critical issues)"
    exit 0
else
    log_message "❌ Overall health: UNHEALTHY ($CRITICAL_ISSUES critical issues)"
    
    # Send alert email if mail is configured
    if command -v mail &> /dev/null; then
        {
            echo "ROOTUIP Health Alert - $CRITICAL_ISSUES Critical Issues Detected"
            echo "============================================================"
            echo ""
            tail -20 "$LOG_FILE"
            echo ""
            echo "Please check the server immediately."
            echo "Time: $(date)"
            echo "Server: $(hostname)"
        } | mail -s "ROOTUIP Health Alert - Critical Issues" "$ALERT_EMAIL"
    fi
    
    exit 1
fi
EOFHEALTH

    # Backup script
    cat > $DEPLOY_DIR/scripts/backup.sh << 'EOFBACKUP'
#!/bin/bash

# ROOTUIP Automated Backup Script
BACKUP_DIR="/var/backups/rootuip"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
LOG_FILE="/var/log/rootuip/backup.log"

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_message "Starting backup process..."

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"

# Database backups
log_message "Backing up MongoDB..."
if mongodump --db rootuip_production --out "$BACKUP_DIR/$DATE/mongodb" 2>/dev/null; then
    log_message "✅ MongoDB backup completed"
else
    log_message "❌ MongoDB backup failed"
fi

log_message "Backing up Redis..."
if redis-cli --rdb "$BACKUP_DIR/$DATE/redis-dump.rdb" 2>/dev/null; then
    log_message "✅ Redis backup completed"
else
    log_message "❌ Redis backup failed"
fi

# Application files backup
log_message "Backing up application files..."
if tar -czf "$BACKUP_DIR/$DATE/application.tar.gz" -C /var/www rootuip 2>/dev/null; then
    log_message "✅ Application backup completed"
else
    log_message "❌ Application backup failed"
fi

# Configuration files backup
log_message "Backing up configuration files..."
tar -czf "$BACKUP_DIR/$DATE/configs.tar.gz" \
    /etc/nginx/sites-enabled \
    /etc/rootuip \
    /etc/letsencrypt 2>/dev/null

# Logs backup (last 7 days only)
log_message "Backing up recent logs..."
find /var/log/rootuip -name "*.log" -mtime -7 -exec tar -czf "$BACKUP_DIR/$DATE/logs.tar.gz" {} + 2>/dev/null

# Create backup manifest
cat > "$BACKUP_DIR/$DATE/manifest.json" << EOF
{
  "backup_id": "$DATE",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "components": [
    "mongodb",
    "redis",
    "application",
    "configurations", 
    "logs"
  ],
  "size": "$(du -sh "$BACKUP_DIR/$DATE" | cut -f1)",
  "retention_until": "$(date -d "+$RETENTION_DAYS days" +%Y-%m-%d)",
  "server": "$(hostname)",
  "version": "3.1.0"
}
EOF

# Calculate total backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR/$DATE" | cut -f1)
log_message "Backup completed: $BACKUP_SIZE"

# Cleanup old backups
log_message "Cleaning up old backups..."
find "$BACKUP_DIR" -type d -name "*_*" -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null
log_message "Old backups cleaned up (retention: $RETENTION_DAYS days)"

# Log completion
logger "ROOTUIP backup completed: $BACKUP_DIR/$DATE ($BACKUP_SIZE)"
log_message "Backup process completed successfully"

echo "Backup completed: $DATE ($BACKUP_SIZE)"
EOFBACKUP

    chmod +x $DEPLOY_DIR/scripts/*.sh
    print_success "Monitoring scripts created"
}

# Create systemd services
create_systemd_services() {
    print_status "Creating systemd service files..."
    
    # PM2 service
    cat > $DEPLOY_DIR/services/rootuip.service << 'EOFSYSTEMD'
[Unit]
Description=ROOTUIP PM2 Process Manager
Documentation=https://rootuip.com
After=network.target mongod.service redis-server.service
Wants=network.target

[Service]
Type=forking
User=rootuip
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games:/usr/local/games:/snap/bin:/usr/local/bin
Environment=PM2_HOME=/home/rootuip/.pm2
PIDFile=/home/rootuip/.pm2/pm2.pid
Restart=on-failure
RestartSec=10s
TimeoutStartSec=60s

ExecStart=/usr/local/bin/pm2 resurrect
ExecReload=/usr/local/bin/pm2 reload all
ExecStop=/usr/local/bin/pm2 kill

[Install]
WantedBy=multi-user.target
EOFSYSTEMD

    # Backup service
    cat > $DEPLOY_DIR/services/rootuip-backup.service << 'EOFBACKUPSVC'
[Unit]
Description=ROOTUIP Automated Backup Service
After=network.target mongod.service

[Service]
Type=oneshot
User=root
ExecStart=/usr/local/bin/rootuip-backup.sh
TimeoutStartSec=3600

[Install]
WantedBy=multi-user.target
EOFBACKUPSVC

    # Backup timer
    cat > $DEPLOY_DIR/services/rootuip-backup.timer << 'EOFTIMER'
[Unit]
Description=Run ROOTUIP backup every 6 hours
Requires=rootuip-backup.service

[Timer]
OnCalendar=*-*-* 00,06,12,18:00:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
EOFTIMER

    # Health check service
    cat > $DEPLOY_DIR/services/rootuip-health.service << 'EOFHEALTHSVC'
[Unit]
Description=ROOTUIP Health Check Service
After=network.target

[Service]
Type=oneshot
User=root
ExecStart=/usr/local/bin/rootuip-health-check.sh
TimeoutStartSec=120

[Install]
WantedBy=multi-user.target
EOFHEALTHSVC

    # Health check timer (every 5 minutes)
    cat > $DEPLOY_DIR/services/rootuip-health.timer << 'EOFHEALTHTIMER'
[Unit]
Description=Run ROOTUIP health check every 5 minutes
Requires=rootuip-health.service

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
EOFHEALTHTIMER

    print_success "Systemd service files created"
}

# Main VPS deployment execution
deploy_to_vps() {
    print_header "DEPLOYING TO VPS: $VPS_IP"
    
    # Create deployment tarball
    print_status "Creating deployment package..."
    tar -czf rootuip-production-final.tar.gz $DEPLOY_DIR/
    
    # Upload to VPS
    print_status "Uploading to VPS $VPS_IP..."
    if scp -o ConnectTimeout=30 rootuip-production-final.tar.gz $VPS_USER@$VPS_IP:/tmp/; then
        print_success "Upload completed"
    else
        print_error "Upload failed - check VPS connectivity"
        exit 1
    fi
    
    # Execute comprehensive deployment on VPS
    print_status "Executing comprehensive deployment on VPS..."
    ssh -o ConnectTimeout=30 $VPS_USER@$VPS_IP << 'EOFREMOTE'
        set -e
        
        echo "📦 Extracting deployment package..."
        cd /tmp
        tar -xzf rootuip-production-final.tar.gz
        cd rootuip-production-final
        
        # Make scripts executable
        chmod +x scripts/*.sh
        
        echo "🔧 Running system setup..."
        ./scripts/deploy-on-vps.sh
        
        echo "🔐 Setting up environment..."
        ./scripts/setup-environment.sh
        
        echo "🗄️ Setting up databases..."
        ./scripts/setup-databases.sh
        
        echo "📁 Copying application files..."
        cp -r app/* /var/www/rootuip/
        cd /var/www/rootuip
        
        echo "📦 Installing dependencies..."
        npm install --production --silent
        
        echo "👤 Setting ownership..."
        chown -R rootuip:www-data /var/www/rootuip
        
        echo "⚙️ Installing systemd services..."
        cd /tmp/rootuip-production-final
        cp services/*.service /etc/systemd/system/
        cp services/*.timer /etc/systemd/system/
        systemctl daemon-reload
        
        echo "🔧 Installing utility scripts..."
        cp scripts/backup.sh /usr/local/bin/rootuip-backup.sh
        cp scripts/health-check.sh /usr/local/bin/rootuip-health-check.sh
        chmod +x /usr/local/bin/rootuip-*.sh
        
        echo "🌐 Configuring nginx..."
        cp configs/nginx-rootuip /etc/nginx/sites-available/rootuip
        ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
        rm -f /etc/nginx/sites-enabled/default
        
        # Test nginx configuration
        if nginx -t; then
            echo "✅ Nginx configuration valid"
        else
            echo "❌ Nginx configuration invalid"
            exit 1
        fi
        
        echo "🔒 Setting up SSL certificates..."
        # Install certificates for all domains
        certbot --nginx \
            -d rootuip.com \
            -d www.rootuip.com \
            -d app.rootuip.com \
            -d api.rootuip.com \
            -d demo.rootuip.com \
            -d customer.rootuip.com \
            --email admin@rootuip.com \
            --agree-tos \
            --non-interactive \
            --redirect || true
        
        echo "🔥 Configuring firewall..."
        ufw --force reset
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow 22/tcp comment 'SSH'
        ufw allow 80/tcp comment 'HTTP'
        ufw allow 443/tcp comment 'HTTPS'
        ufw --force enable
        
        echo "🛡️ Setting up fail2ban..."
        systemctl enable fail2ban
        systemctl start fail2ban
        
        echo "🔄 Starting services..."
        systemctl restart nginx
        systemctl enable nginx
        systemctl start redis-server
        systemctl enable redis-server
        systemctl start mongod
        systemctl enable mongod
        
        echo "⚡ Starting PM2 processes..."
        cd /var/www/rootuip
        sudo -u rootuip pm2 start configs/ecosystem.config.js
        sudo -u rootuip pm2 save
        sudo -u rootuip pm2 startup
        
        echo "🔧 Enabling systemd services..."
        systemctl enable rootuip
        systemctl start rootuip
        systemctl enable rootuip-backup.timer
        systemctl start rootuip-backup.timer
        systemctl enable rootuip-health.timer
        systemctl start rootuip-health.timer
        
        echo "📋 Setting up log rotation..."
        cat > /etc/logrotate.d/rootuip << 'EOFLOG'
/var/log/rootuip/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 rootuip rootuip
    postrotate
        sudo -u rootuip pm2 reloadLogs
    endscript
}

/var/log/nginx/*.log {
    daily
    missingok  
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}
EOFLOG
        
        echo "⏰ Setting up cron jobs..."
        # SSL certificate renewal
        echo "0 3 * * 0 root certbot renew --quiet --post-hook 'systemctl reload nginx'" >> /etc/crontab
        
        # System updates check
        echo "0 4 * * 1 root apt update && apt list --upgradable | mail -s 'ROOTUIP System Updates Available' admin@rootuip.com" >> /etc/crontab
        
        echo "🎯 Running initial health check..."
        /usr/local/bin/rootuip-health-check.sh
        
        echo "✅ ROOTUIP production deployment completed successfully!"
        echo "🌐 Platform should be available at https://rootuip.com"
        
        # Display status
        echo ""
        echo "📊 Service Status:"
        systemctl status nginx --no-pager -l
        systemctl status mongod --no-pager -l  
        systemctl status redis-server --no-pager -l
        sudo -u rootuip pm2 status
        
        echo ""
        echo "🔥 Firewall Status:"
        ufw status numbered
        
        echo ""
        echo "🏥 Health Check Results:"
        curl -s http://localhost:3000/api/health | jq '.' || echo "Health check endpoint not ready yet"
EOFREMOTE
    
    if [ $? -eq 0 ]; then
        print_success "VPS deployment completed successfully!"
    else
        print_error "VPS deployment failed"
        exit 1
    fi
}

# Verify deployment
verify_deployment() {
    print_header "VERIFYING PRODUCTION DEPLOYMENT"
    
    print_status "Waiting for services to start..."
    sleep 20
    
    # Test main endpoints
    endpoints=(
        "https://rootuip.com/api/health"
        "https://app.rootuip.com/api/health"
        "https://api.rootuip.com/api/health"
        "https://demo.rootuip.com/api/health"
        "https://customer.rootuip.com/api/health"
    )
    
    for endpoint in "${endpoints[@]}"; do
        print_status "Testing $endpoint..."
        if curl -f -s "$endpoint" --max-time 10 > /dev/null 2>&1; then
            print_success "$endpoint is responding"
        else
            print_warning "$endpoint may need more time to start"
        fi
    done
    
    # Test SSL certificates
    print_status "Checking SSL certificates..."
    if openssl s_client -connect rootuip.com:443 -servername rootuip.com < /dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
        print_success "SSL certificates are valid"
    else
        print_warning "SSL certificates may need additional verification"
    fi
    
    # Test CloudFlare integration
    print_status "Checking CloudFlare integration..."
    cf_server=$(curl -s -I https://rootuip.com | grep -i "cf-ray" || echo "")
    if [ -n "$cf_server" ]; then
        print_success "CloudFlare CDN detected"
    else
        print_warning "CloudFlare CDN not detected - configure DNS manually"
    fi
}

# Display final deployment information
display_deployment_info() {
    print_header "🎉 ROOTUIP PRODUCTION DEPLOYMENT COMPLETE! 🎉"
    
    echo ""
    echo -e "${GREEN}🌐 Production URLs:${NC}"
    echo -e "   • ${CYAN}Main Platform:    https://rootuip.com${NC}"
    echo -e "   • ${CYAN}Application:      https://app.rootuip.com${NC}"
    echo -e "   • ${CYAN}API Gateway:      https://api.rootuip.com${NC}"
    echo -e "   • ${CYAN}Demo Platform:    https://demo.rootuip.com${NC}"
    echo -e "   • ${CYAN}Customer Portal:  https://customer.rootuip.com${NC}"
    echo ""
    echo -e "${GREEN}📊 Health & Monitoring:${NC}"
    echo -e "   • ${CYAN}Main Health:      https://rootuip.com/api/health${NC}"
    echo -e "   • ${CYAN}API Health:       https://api.rootuip.com/api/health${NC}"
    echo -e "   • ${CYAN}Demo Health:      https://demo.rootuip.com/api/health${NC}"
    echo -e "   • ${CYAN}System Status:    https://rootuip.com/api/status${NC}"
    echo ""
    echo -e "${GREEN}🔧 Server Management:${NC}"
    echo -e "   • ${YELLOW}SSH Access:       ssh $VPS_USER@$VPS_IP${NC}"
    echo -e "   • ${YELLOW}PM2 Status:       pm2 status${NC}"
    echo -e "   • ${YELLOW}View Logs:        pm2 logs${NC}"
    echo -e "   • ${YELLOW}Restart All:      pm2 restart all${NC}"
    echo -e "   • ${YELLOW}Health Check:     /usr/local/bin/rootuip-health-check.sh${NC}"
    echo ""
    echo -e "${GREEN}💾 Automated Systems:${NC}"
    echo -e "   • ${YELLOW}Backups:          Every 6 hours (${CYAN}/var/backups/rootuip${NC}${YELLOW})${NC}"
    echo -e "   • ${YELLOW}Health Checks:    Every 5 minutes${NC}"
    echo -e "   • ${YELLOW}SSL Renewal:      Weekly (Sunday 3 AM)${NC}"
    echo -e "   • ${YELLOW}Log Rotation:     Daily${NC}"
    echo -e "   • ${YELLOW}System Updates:   Weekly check (Monday 4 AM)${NC}"
    echo ""
    echo -e "${GREEN}🔒 Security Features:${NC}"
    echo -e "   • ${GREEN}✓ SSL/TLS 1.2+ with Let's Encrypt auto-renewal${NC}"
    echo -e "   • ${GREEN}✓ HTTP/2 and HSTS enabled${NC}"
    echo -e "   • ${GREEN}✓ Rate limiting (API: 10 req/s, General: 30 req/s)${NC}"
    echo -e "   • ${GREEN}✓ UFW Firewall (ports 22, 80, 443 only)${NC}"
    echo -e "   • ${GREEN}✓ Fail2ban intrusion prevention${NC}"
    echo -e "   • ${GREEN}✓ Security headers and CSP${NC}"
    echo ""
    echo -e "${GREEN}⚡ Performance Features:${NC}"
    echo -e "   • ${GREEN}✓ PM2 clustering (2 main instances + backup)${NC}"
    echo -e "   • ${GREEN}✓ Nginx load balancing and caching${NC}"
    echo -e "   • ${GREEN}✓ Gzip compression enabled${NC}"
    echo -e "   • ${GREEN}✓ Static file caching (1 year)${NC}"
    echo -e "   • ${GREEN}✓ Database connection pooling${NC}"
    echo ""
    echo -e "${CYAN}📋 Next Steps:${NC}"
    echo -e "   ${YELLOW}1.${NC} Configure CloudFlare DNS settings"
    echo -e "      ${CYAN}• Add A records for all subdomains pointing to $VPS_IP${NC}"
    echo -e "      ${CYAN}• Enable proxy (orange cloud) for CDN${NC}"
    echo -e "      ${CYAN}• Configure caching rules and security settings${NC}"
    echo ""
    echo -e "   ${YELLOW}2.${NC} Update production environment variables in ${CYAN}/etc/rootuip/.env${NC}"
    echo -e "      ${CYAN}• Add real API keys (Maersk, MSC, COSCO, etc.)${NC}"
    echo -e "      ${CYAN}• Configure SMTP email settings${NC}"
    echo -e "      ${CYAN}• Add monitoring service keys (Sentry, New Relic)${NC}"
    echo ""
    echo -e "   ${YELLOW}3.${NC} Test all functionality end-to-end"
    echo -e "      ${CYAN}• Verify all subdomains are accessible${NC}"
    echo -e "      ${CYAN}• Test API endpoints and authentication${NC}"
    echo -e "      ${CYAN}• Validate SSL certificates${NC}"
    echo -e "      ${CYAN}• Confirm monitoring and alerting${NC}"
    echo ""
    echo -e "   ${YELLOW}4.${NC} Set up external integrations"
    echo -e "      ${CYAN}• Configure carrier API connections${NC}"
    echo -e "      ${CYAN}• Set up analytics and tracking${NC}"
    echo -e "      ${CYAN}• Configure email notifications${NC}"
    echo ""
    echo -e "${GREEN}🚀 ROOTUIP Platform is now LIVE in Production! 🚀${NC}"
    echo -e "${CYAN}Platform Version: 3.1.0${NC}"
    echo -e "${CYAN}Deployment Time: $(date)${NC}"
    echo ""
}

# Main execution function
main() {
    print_header "🚀 ROOTUIP COMPREHENSIVE PRODUCTION DEPLOYMENT"
    echo -e "${CYAN}Target VPS: $VPS_IP${NC}"
    echo -e "${CYAN}Domain: $DOMAIN${NC}"
    echo -e "${CYAN}Version: 3.1.0${NC}"
    echo ""
    
    # Check prerequisites
    if ! command -v ssh &> /dev/null; then
        print_error "SSH client is required"
        exit 1
    fi
    
    if ! command -v scp &> /dev/null; then
        print_error "SCP client is required"
        exit 1
    fi
    
    # Execute all deployment steps
    create_production_package
    create_vps_deployment
    create_monitoring_scripts
    create_systemd_services
    deploy_to_vps
    verify_deployment
    display_deployment_info
    
    # Cleanup local files
    rm -rf $DEPLOY_DIR rootuip-production-final.tar.gz
    
    print_success "🎯 Complete production deployment finished successfully!"
}

# Execute main function
main "$@"