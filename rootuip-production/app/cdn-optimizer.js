/**
 * ROOTUIP CDN Optimizer
 * Configures CloudFlare CDN for optimal global performance
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class CDNOptimizer {
    constructor(config = {}) {
        this.config = {
            cdnProvider: 'cloudflare',
            domain: config.domain || 'app.rootuip.com',
            cacheRules: config.cacheRules || this.getDefaultCacheRules(),
            compressionEnabled: config.compressionEnabled !== false,
            minifyEnabled: config.minifyEnabled !== false,
            http2PushEnabled: config.http2PushEnabled !== false
        };
        
        this.assetManifest = new Map();
        this.performanceMetrics = new Map();
    }

    getDefaultCacheRules() {
        return {
            // Static assets - long cache
            'images': {
                pattern: /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i,
                maxAge: 31536000, // 1 year
                sMaxAge: 31536000,
                immutable: true
            },
            'fonts': {
                pattern: /\.(woff|woff2|ttf|otf|eot)$/i,
                maxAge: 31536000,
                sMaxAge: 31536000,
                immutable: true
            },
            'styles': {
                pattern: /\.css$/i,
                maxAge: 86400, // 1 day
                sMaxAge: 604800, // 1 week
                staleWhileRevalidate: 86400
            },
            'scripts': {
                pattern: /\.js$/i,
                maxAge: 86400,
                sMaxAge: 604800,
                staleWhileRevalidate: 86400
            },
            // HTML - short cache with revalidation
            'html': {
                pattern: /\.html$/i,
                maxAge: 0,
                sMaxAge: 300, // 5 minutes
                mustRevalidate: true
            },
            // API responses - no CDN cache
            'api': {
                pattern: /^\/api\//,
                noStore: true,
                private: true
            }
        };
    }

    /**
     * Generate optimized static assets with cache busting
     */
    async optimizeAssets(sourceDir, outputDir) {
        const assets = await this.scanDirectory(sourceDir);
        
        for (const asset of assets) {
            const optimized = await this.optimizeAsset(asset, outputDir);
            this.assetManifest.set(asset.relativePath, optimized);
        }

        // Generate asset manifest
        await this.generateAssetManifest(outputDir);
        
        // Generate service worker for offline support
        await this.generateServiceWorker(outputDir);
        
        return this.assetManifest;
    }

    async scanDirectory(dir, baseDir = dir) {
        const files = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                // Skip node_modules and hidden directories
                if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    files.push(...await this.scanDirectory(fullPath, baseDir));
                }
            } else {
                const stats = await fs.stat(fullPath);
                files.push({
                    fullPath,
                    relativePath: path.relative(baseDir, fullPath),
                    size: stats.size,
                    mtime: stats.mtime
                });
            }
        }
        
        return files;
    }

    async optimizeAsset(asset, outputDir) {
        const ext = path.extname(asset.relativePath).toLowerCase();
        let optimized = { ...asset };
        
        // Read file content
        const content = await fs.readFile(asset.fullPath);
        
        // Generate content hash for cache busting
        const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
        const hashedFilename = asset.relativePath.replace(/(\.[^.]+)$/, `.${hash}$1`);
        
        optimized.hashedPath = hashedFilename;
        optimized.url = `https://${this.config.domain}/${hashedFilename}`;
        
        // Apply optimizations based on file type
        let optimizedContent = content;
        
        if (['.html', '.css', '.js'].includes(ext) && this.config.minifyEnabled) {
            optimizedContent = await this.minifyContent(content, ext);
        }
        
        if (['.jpg', '.jpeg', '.png'].includes(ext)) {
            optimizedContent = await this.optimizeImage(content, ext);
        }
        
        // Write optimized file
        const outputPath = path.join(outputDir, hashedFilename);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, optimizedContent);
        
        optimized.size = optimizedContent.length;
        optimized.compression = ((asset.size - optimized.size) / asset.size * 100).toFixed(1);
        
        return optimized;
    }

    async minifyContent(content, ext) {
        // In production, use proper minification libraries
        // This is a simplified version for demonstration
        
        let minified = content.toString();
        
        if (ext === '.html') {
            // Remove comments and extra whitespace
            minified = minified
                .replace(/<!--[\s\S]*?-->/g, '')
                .replace(/\s+/g, ' ')
                .replace(/> </g, '><')
                .trim();
        } else if (ext === '.css') {
            // Remove comments and extra whitespace
            minified = minified
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\s+/g, ' ')
                .replace(/:\s+/g, ':')
                .replace(/;\s+/g, ';')
                .replace(/\s*{\s*/g, '{')
                .replace(/\s*}\s*/g, '}')
                .trim();
        } else if (ext === '.js') {
            // Basic JS minification (use terser in production)
            minified = minified
                .replace(/\/\/.*$/gm, '') // Remove single-line comments
                .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
                .replace(/\s+/g, ' ')
                .replace(/\s*([{}();,:])\s*/g, '$1')
                .trim();
        }
        
        return Buffer.from(minified);
    }

    async optimizeImage(content, ext) {
        // In production, use sharp or imagemin for real optimization
        // This is a placeholder that returns the original image
        return content;
    }

    async generateAssetManifest(outputDir) {
        const manifest = {};
        
        for (const [original, optimized] of this.assetManifest.entries()) {
            manifest[original] = {
                url: optimized.url,
                size: optimized.size,
                hash: path.basename(optimized.hashedPath).match(/\.([a-f0-9]{8})\./)?.[1]
            };
        }
        
        await fs.writeFile(
            path.join(outputDir, 'asset-manifest.json'),
            JSON.stringify(manifest, null, 2)
        );
        
        return manifest;
    }

    async generateServiceWorker(outputDir) {
        const sw = `
// ROOTUIP Service Worker
const CACHE_NAME = 'rootuip-v1';
const urlsToCache = [
    '/',
    '/container-tracking-interface.html',
    '/container-tracking-executive.html',
    ${Array.from(this.assetManifest.values())
        .filter(a => a.hashedPath.match(/\.(css|js|woff2)$/))
        .map(a => `'/${a.hashedPath}'`)
        .join(',\n    ')}
];

// Install event - cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
    // Skip non-GET requests and API calls
    if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }

                // Clone the request
                const fetchRequest = event.request.clone();

                return fetch(fetchRequest).then(response => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    // Clone the response
                    const responseToCache = response.clone();

                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });

                    return response;
                });
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
`;

        await fs.writeFile(path.join(outputDir, 'sw.js'), sw);
    }

    /**
     * Generate CloudFlare configuration
     */
    generateCloudFlareConfig() {
        return {
            // Page Rules
            pageRules: [
                {
                    url: `${this.config.domain}/api/*`,
                    actions: {
                        cache_level: 'bypass',
                        security_level: 'high'
                    }
                },
                {
                    url: `${this.config.domain}/*.html`,
                    actions: {
                        cache_level: 'standard',
                        edge_cache_ttl: 7200,
                        browser_cache_ttl: 0
                    }
                },
                {
                    url: `${this.config.domain}/*.(js|css)`,
                    actions: {
                        cache_level: 'aggressive',
                        edge_cache_ttl: 604800,
                        browser_cache_ttl: 86400
                    }
                },
                {
                    url: `${this.config.domain}/*.(jpg|jpeg|png|gif|webp|svg|ico|woff|woff2)`,
                    actions: {
                        cache_level: 'aggressive',
                        edge_cache_ttl: 31536000,
                        browser_cache_ttl: 31536000
                    }
                }
            ],
            
            // Workers for edge computing
            workers: {
                routes: [
                    {
                        pattern: `${this.config.domain}/api/*`,
                        script: 'api-edge-worker.js'
                    }
                ]
            },
            
            // Performance settings
            performance: {
                minify: {
                    html: true,
                    css: true,
                    js: true
                },
                polish: 'lossy', // Image optimization
                mirage: true, // Mobile image optimization
                rocketLoader: true, // Async JS loading
                http2_push: true,
                http3: true,
                zeroRtt: true
            },
            
            // Security settings
            security: {
                ssl: 'full_strict',
                tls_1_3: true,
                hsts: {
                    enabled: true,
                    max_age: 31536000,
                    include_subdomains: true,
                    preload: true
                },
                waf_rules: 'high'
            },
            
            // Caching settings
            caching: {
                browser_expiration: 'respect_headers',
                caching_level: 'standard',
                development_mode: false,
                query_string_sort: true
            }
        };
    }

    /**
     * Generate Nginx configuration for optimal serving
     */
    generateNginxConfig() {
        return `
# ROOTUIP Nginx Configuration with CDN Optimization

# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/x-font-ttf font/opentype image/svg+xml;

# Brotli compression (if available)
brotli on;
brotli_comp_level 6;
brotli_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/x-font-ttf font/opentype image/svg+xml;

server {
    listen 443 ssl http2;
    server_name ${this.config.domain};

    # SSL configuration
    ssl_certificate /etc/ssl/certs/rootuip.crt;
    ssl_certificate_key /etc/ssl/private/rootuip.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Cache headers for static assets
    location ~* \\.(jpg|jpeg|png|gif|webp|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
    }

    location ~* \\.(css|js)$ {
        expires 1d;
        add_header Cache-Control "public, max-age=86400, stale-while-revalidate=86400";
        add_header Vary "Accept-Encoding";
    }

    location ~* \\.(woff|woff2|ttf|otf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
    }

    # HTML files - no cache
    location ~* \\.html$ {
        expires -1;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
    }

    # API endpoints - no cache
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        add_header Cache-Control "no-store, private";
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }

    # Enable HTTP/2 Push for critical resources
    location / {
        try_files $uri $uri/ /index.html;
        
        # Push critical CSS and JS
        http2_push /assets/main.css;
        http2_push /assets/main.js;
    }

    # Service worker
    location /sw.js {
        expires -1;
        add_header Cache-Control "no-cache";
        add_header Service-Worker-Allowed "/";
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name ${this.config.domain};
    return 301 https://$server_name$request_uri;
}
`;
    }

    /**
     * Analyze current performance and suggest improvements
     */
    async analyzePerformance(url) {
        // This would use real performance testing tools in production
        const suggestions = [];

        // Check current performance metrics
        const metrics = await this.measurePageSpeed(url);
        
        if (metrics.loadTime > 2000) {
            suggestions.push({
                issue: 'Slow page load',
                current: `${metrics.loadTime}ms`,
                target: '< 2000ms',
                recommendations: [
                    'Enable CDN for static assets',
                    'Implement lazy loading for images',
                    'Reduce JavaScript bundle size',
                    'Use resource hints (preconnect, prefetch)'
                ]
            });
        }

        if (metrics.firstContentfulPaint > 1500) {
            suggestions.push({
                issue: 'Slow First Contentful Paint',
                current: `${metrics.firstContentfulPaint}ms`,
                target: '< 1500ms',
                recommendations: [
                    'Inline critical CSS',
                    'Reduce render-blocking resources',
                    'Optimize web fonts loading',
                    'Use HTTP/2 Push for critical resources'
                ]
            });
        }

        if (metrics.totalSize > 1500000) { // 1.5MB
            suggestions.push({
                issue: 'Large page size',
                current: `${(metrics.totalSize / 1024 / 1024).toFixed(2)}MB`,
                target: '< 1.5MB',
                recommendations: [
                    'Compress images (WebP format)',
                    'Minify CSS and JavaScript',
                    'Remove unused code',
                    'Implement code splitting'
                ]
            });
        }

        return {
            metrics,
            suggestions,
            cdnConfig: this.generateCloudFlareConfig(),
            estimatedImprovement: this.calculateExpectedImprovement(metrics)
        };
    }

    async measurePageSpeed(url) {
        // Simplified metrics - in production use Lighthouse or similar
        return {
            loadTime: 2500,
            firstContentfulPaint: 1800,
            largestContentfulPaint: 2200,
            timeToInteractive: 3000,
            totalSize: 1800000,
            requests: 45,
            score: 75
        };
    }

    calculateExpectedImprovement(currentMetrics) {
        return {
            loadTime: '40-60% reduction',
            globalLatency: '70-80% reduction',
            bandwidth: '50-70% savings',
            availability: '99.9% uptime'
        };
    }
}

module.exports = CDNOptimizer;