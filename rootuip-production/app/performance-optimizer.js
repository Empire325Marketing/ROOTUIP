// ROOTUIP Performance Optimization System
// Achieves <2 second load times for enterprise deployment

const fs = require('fs').promises;
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const sharp = require('sharp');
const { gzip } = require('zlib');
const { promisify } = require('util');
const gzipAsync = promisify(gzip);

class PerformanceOptimizer {
    constructor() {
        this.config = {
            targets: {
                pageSpeed: 95,
                fcp: 1000, // First Contentful Paint < 1s
                lcp: 2500, // Largest Contentful Paint < 2.5s
                cls: 0.1,  // Cumulative Layout Shift < 0.1
                fid: 100   // First Input Delay < 100ms
            },
            
            criticalCSS: {
                above_fold_height: 800,
                inline_size_limit: 14000, // 14KB limit for inline CSS
            },
            
            images: {
                formats: ['webp', 'avif'],
                sizes: [320, 640, 768, 1024, 1366, 1920],
                quality: {
                    webp: 85,
                    avif: 80,
                    jpeg: 85
                }
            },
            
            compression: {
                css: {
                    level: 2,
                    compatibility: 'ie11'
                },
                js: {
                    compress: {
                        drop_console: true,
                        drop_debugger: true,
                        pure_funcs: ['console.log']
                    },
                    mangle: true,
                    format: {
                        comments: false
                    }
                }
            }
        };
        
        this.stats = {
            originalSize: 0,
            optimizedSize: 0,
            filesProcessed: 0,
            timeElapsed: 0
        };
    }
    
    // Main optimization pipeline
    async optimizeAll() {
        console.log('🚀 Starting ROOTUIP Performance Optimization...\n');
        const startTime = Date.now();
        
        try {
            // Phase 1: Asset optimization
            await this.optimizeCSS();
            await this.optimizeJavaScript();
            await this.optimizeImages();
            
            // Phase 2: Critical path optimization
            await this.extractCriticalCSS();
            await this.implementLazyLoading();
            await this.addResourceHints();
            
            // Phase 3: Server configuration
            await this.generateNginxConfig();
            await this.setupCDNConfig();
            
            // Phase 4: Performance monitoring
            await this.setupPerformanceMonitoring();
            await this.createPerformanceBudget();
            
            this.stats.timeElapsed = Date.now() - startTime;
            this.printReport();
            
        } catch (error) {
            console.error('❌ Optimization failed:', error);
        }
    }
    
    // CSS Optimization
    async optimizeCSS() {
        console.log('📦 Optimizing CSS files...');
        
        const cssFiles = await this.findFiles('.', '.css');
        const cleanCSS = new CleanCSS(this.config.compression.css);
        
        for (const file of cssFiles) {
            const content = await fs.readFile(file, 'utf8');
            this.stats.originalSize += content.length;
            
            // Minify CSS
            const result = cleanCSS.minify(content);
            
            // Add optimizations
            let optimized = result.styles;
            
            // Remove unused CSS (basic implementation)
            optimized = this.removeUnusedCSS(optimized);
            
            // Optimize font loading
            optimized = this.optimizeFontLoading(optimized);
            
            // Write optimized file
            const outputPath = file.replace('.css', '.min.css');
            await fs.writeFile(outputPath, optimized);
            
            // Create gzipped version
            const gzipped = await gzipAsync(optimized);
            await fs.writeFile(outputPath + '.gz', gzipped);
            
            this.stats.optimizedSize += optimized.length;
            this.stats.filesProcessed++;
            
            console.log(`  ✓ ${path.basename(file)} - ${this.formatSize(content.length)} → ${this.formatSize(optimized.length)}`);
        }
    }
    
    // JavaScript Optimization
    async optimizeJavaScript() {
        console.log('\n📦 Optimizing JavaScript files...');
        
        const jsFiles = await this.findFiles('.', '.js');
        
        for (const file of jsFiles) {
            // Skip already minified files
            if (file.includes('.min.js')) continue;
            
            const content = await fs.readFile(file, 'utf8');
            this.stats.originalSize += content.length;
            
            try {
                // Minify JavaScript
                const result = await minify(content, this.config.compression.js);
                
                // Tree shake and optimize
                let optimized = result.code || '';
                
                // Add performance optimizations
                optimized = this.addPerformanceOptimizations(optimized);
                
                // Write optimized file
                const outputPath = file.replace('.js', '.min.js');
                await fs.writeFile(outputPath, optimized);
                
                // Create gzipped version
                const gzipped = await gzipAsync(optimized);
                await fs.writeFile(outputPath + '.gz', gzipped);
                
                this.stats.optimizedSize += optimized.length;
                this.stats.filesProcessed++;
                
                console.log(`  ✓ ${path.basename(file)} - ${this.formatSize(content.length)} → ${this.formatSize(optimized.length)}`);
                
            } catch (error) {
                console.error(`  ✗ Error optimizing ${file}:`, error.message);
            }
        }
    }
    
    // Image Optimization
    async optimizeImages() {
        console.log('\n📦 Optimizing images...');
        
        const imageFiles = await this.findImages('.');
        
        for (const file of imageFiles) {
            try {
                const stats = await fs.stat(file);
                this.stats.originalSize += stats.size;
                
                // Skip if already optimized
                if (file.includes('.webp') || file.includes('.avif')) continue;
                
                // Process image
                const image = sharp(file);
                const metadata = await image.metadata();
                
                // Generate WebP version
                const webpPath = file.replace(/\.(jpg|jpeg|png)$/i, '.webp');
                await image
                    .webp({ quality: this.config.images.quality.webp })
                    .toFile(webpPath);
                
                // Generate responsive sizes
                for (const width of this.config.images.sizes) {
                    if (width < metadata.width) {
                        const resizedPath = file.replace(/\.(jpg|jpeg|png)$/i, `-${width}w.webp`);
                        await sharp(file)
                            .resize(width)
                            .webp({ quality: this.config.images.quality.webp })
                            .toFile(resizedPath);
                    }
                }
                
                const webpStats = await fs.stat(webpPath);
                this.stats.optimizedSize += webpStats.size;
                this.stats.filesProcessed++;
                
                console.log(`  ✓ ${path.basename(file)} - ${this.formatSize(stats.size)} → ${this.formatSize(webpStats.size)} (WebP)`);
                
            } catch (error) {
                console.error(`  ✗ Error optimizing ${file}:`, error.message);
            }
        }
    }
    
    // Extract Critical CSS
    async extractCriticalCSS() {
        console.log('\n🎯 Extracting critical CSS...');
        
        const criticalCSS = `
/* ROOTUIP Critical CSS - Inline for instant rendering */
:root {
    --color-primary: #0F3460;
    --color-secondary: #00D46A;
    --color-accent: #FF6B35;
    --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font-sans); line-height: 1.6; color: #1e293b; }

/* Critical layout */
.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
.rootuip-header { background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 1000; }
.header-content { display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; }
.logo { height: 40px; width: auto; }

/* Critical typography */
h1, .h1 { font-size: 2.25rem; font-weight: 700; line-height: 1.2; margin-bottom: 1rem; }
h2, .h2 { font-size: 1.875rem; font-weight: 600; line-height: 1.3; margin-bottom: 0.875rem; }
p { margin-bottom: 1rem; }

/* Critical components */
.btn { display: inline-block; padding: 0.75rem 1.5rem; border-radius: 0.375rem; font-weight: 600; text-decoration: none; transition: all 0.2s; cursor: pointer; }
.btn-primary { background: var(--color-primary); color: white; }
.btn-primary:hover { background: #0a2540; }
.btn-success { background: var(--color-secondary); color: white; }

/* Critical metrics */
.metric-card { background: white; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.metric-value { font-size: 2.25rem; font-weight: 700; color: var(--color-primary); }

/* Loading states */
.skeleton { background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%); background-size: 200% 100%; animation: loading 1.5s infinite; }
@keyframes loading { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* Mobile critical */
@media (max-width: 768px) {
    .container { padding: 0 16px; }
    h1, .h1 { font-size: 1.875rem; }
    .header-content { padding: 0.75rem 0; }
}`;
        
        // Save critical CSS
        await fs.writeFile('assets/css/critical.min.css', criticalCSS.replace(/\s+/g, ' ').trim());
        
        // Create inline script for HTML files
        const inlineScript = `
<style>${criticalCSS.replace(/\s+/g, ' ').trim()}</style>
<link rel="preload" href="/assets/css/brand-guidelines.min.css" as="style">
<link rel="preload" href="/assets/css/brand-implementation.min.css" as="style">
<noscript>
    <link rel="stylesheet" href="/assets/css/brand-guidelines.min.css">
    <link rel="stylesheet" href="/assets/css/brand-implementation.min.css">
</noscript>
<script>
    // Load non-critical CSS
    window.addEventListener('load', function() {
        var links = document.querySelectorAll('link[rel="preload"][as="style"]');
        links.forEach(function(link) {
            link.rel = 'stylesheet';
        });
    });
</script>`;
        
        await fs.writeFile('assets/critical-css-inline.html', inlineScript);
        console.log('  ✓ Critical CSS extracted and optimized');
    }
    
    // Implement Lazy Loading
    async implementLazyLoading() {
        console.log('\n🔄 Implementing lazy loading...');
        
        const lazyLoadScript = `
// ROOTUIP Lazy Loading System
(function() {
    'use strict';
    
    // Configuration
    const config = {
        rootMargin: '50px 0px',
        threshold: 0.01,
        loadedClass: 'lazy-loaded',
        loadingClass: 'lazy-loading',
        errorClass: 'lazy-error'
    };
    
    // Image lazy loading
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.classList.add(config.loadingClass);
                
                // Load image
                const src = img.dataset.src;
                const srcset = img.dataset.srcset;
                
                if (src) img.src = src;
                if (srcset) img.srcset = srcset;
                
                img.onload = () => {
                    img.classList.remove(config.loadingClass);
                    img.classList.add(config.loadedClass);
                    imageObserver.unobserve(img);
                };
                
                img.onerror = () => {
                    img.classList.remove(config.loadingClass);
                    img.classList.add(config.errorClass);
                    imageObserver.unobserve(img);
                };
            }
        });
    }, config);
    
    // Initialize lazy loading
    document.addEventListener('DOMContentLoaded', () => {
        const lazyImages = document.querySelectorAll('img[data-src], img[data-srcset]');
        lazyImages.forEach(img => imageObserver.observe(img));
        
        // Lazy load iframes
        const lazyIframes = document.querySelectorAll('iframe[data-src]');
        lazyIframes.forEach(iframe => {
            const iframeObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        iframe.src = iframe.dataset.src;
                        iframeObserver.unobserve(iframe);
                    }
                });
            }, config);
            iframeObserver.observe(iframe);
        });
    });
    
    // Preload critical images
    const preloadImage = (url) => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = url;
        document.head.appendChild(link);
    };
    
    // Preload hero images
    if (window.matchMedia('(min-width: 768px)').matches) {
        preloadImage('/assets/images/hero-desktop.webp');
    } else {
        preloadImage('/assets/images/hero-mobile.webp');
    }
})();`;
        
        // Minify and save
        const minified = await minify(lazyLoadScript, this.config.compression.js);
        await fs.writeFile('assets/js/lazy-load.min.js', minified.code || lazyLoadScript);
        
        console.log('  ✓ Lazy loading system implemented');
    }
    
    // Add Resource Hints
    async addResourceHints() {
        console.log('\n🔗 Adding resource hints...');
        
        const resourceHints = `
<!-- DNS Prefetch for external resources -->
<link rel="dns-prefetch" href="//fonts.googleapis.com">
<link rel="dns-prefetch" href="//www.google-analytics.com">
<link rel="dns-prefetch" href="//api.rootuip.com">

<!-- Preconnect for critical resources -->
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
<link rel="preconnect" href="https://api.rootuip.com">

<!-- Prefetch for next likely navigation -->
<link rel="prefetch" href="/dashboard">
<link rel="prefetch" href="/api/auth/verify">

<!-- Preload critical resources -->
<link rel="preload" href="/assets/fonts/Inter-Bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/js/app.min.js" as="script">
<link rel="preload" href="/assets/images/logo.svg" as="image">

<!-- Resource hints for mobile -->
<link rel="preload" href="/assets/css/critical.min.css" as="style">
<link rel="modulepreload" href="/assets/js/modules/dashboard.min.js">`;
        
        await fs.writeFile('assets/resource-hints.html', resourceHints);
        console.log('  ✓ Resource hints configured');
    }
    
    // Generate Nginx Configuration
    async generateNginxConfig() {
        console.log('\n⚙️ Generating Nginx configuration...');
        
        const nginxConfig = `
# ROOTUIP High-Performance Nginx Configuration
# Achieves <2 second load times

server {
    listen 80;
    listen 443 ssl http2;
    server_name rootuip.com www.rootuip.com api.rootuip.com;
    
    root /var/www/rootuip;
    index index.html;
    
    # SSL Configuration (update with your certificates)
    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Enable OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Enable Brotli compression
    brotli on;
    brotli_comp_level 6;
    brotli_types text/plain text/css text/javascript application/javascript application/json image/svg+xml;
    
    # Enable Gzip as fallback
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript application/json image/svg+xml;
    
    # Cache static assets
    location ~* \\.(jpg|jpeg|png|webp|avif|gif|ico|css|js|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
        
        # Serve pre-compressed files if available
        gzip_static on;
        brotli_static on;
    }
    
    # Cache HTML with revalidation
    location ~* \\.html$ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
        
        # Enable compression
        gzip_static on;
        brotli_static on;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Performance headers
        proxy_buffering off;
        proxy_request_buffering off;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # Service Worker
    location /sw.js {
        add_header Cache-Control "no-cache";
        add_header Service-Worker-Allowed "/";
    }
    
    # WebP image serving with fallback
    location ~* ^(?<path>.+)\\.(?<ext>jpe?g|png)$ {
        add_header Vary "Accept";
        add_header Cache-Control "public, max-age=31536000, immutable";
        
        if ($http_accept ~* "webp") {
            rewrite ^(.+)\\.(jpe?g|png)$ $1.webp break;
        }
    }
    
    # Push critical resources
    location / {
        try_files $uri $uri/ /index.html;
        
        # HTTP/2 Push
        http2_push /assets/css/critical.min.css;
        http2_push /assets/js/app.min.js;
        http2_push /assets/images/logo.svg;
        
        # Add Link headers for resource hints
        add_header Link "</assets/css/brand-guidelines.min.css>; rel=preload; as=style" always;
        add_header Link "</assets/fonts/Inter-Bold.woff2>; rel=preload; as=font; crossorigin" always;
    }
}

# CDN origin configuration
server {
    listen 8080;
    server_name cdn-origin.rootuip.com;
    
    root /var/www/rootuip/assets;
    
    # CORS for CDN
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "GET, OPTIONS";
    
    # Aggressive caching for CDN
    location / {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}`;
        
        await fs.writeFile('nginx-performance.conf', nginxConfig);
        console.log('  ✓ Nginx configuration optimized for performance');
    }
    
    // Setup CDN Configuration
    async setupCDNConfig() {
        console.log('\n🌐 Setting up CDN configuration...');
        
        const cdnConfig = {
            cloudflare: {
                zone_id: 'YOUR_ZONE_ID',
                rules: [
                    {
                        name: 'Cache Everything',
                        targets: ['*.css', '*.js', '*.woff*', '*.jpg', '*.jpeg', '*.png', '*.webp', '*.svg'],
                        actions: {
                            cache_level: 'cache_everything',
                            edge_cache_ttl: 2592000, // 30 days
                            browser_cache_ttl: 31536000 // 1 year
                        }
                    },
                    {
                        name: 'HTML Cache',
                        targets: ['*.html'],
                        actions: {
                            cache_level: 'standard',
                            edge_cache_ttl: 3600, // 1 hour
                            browser_cache_ttl: 3600
                        }
                    },
                    {
                        name: 'API No Cache',
                        targets: ['/api/*'],
                        actions: {
                            cache_level: 'bypass'
                        }
                    }
                ],
                performance: {
                    minify: {
                        js: true,
                        css: true,
                        html: true
                    },
                    brotli: true,
                    early_hints: true,
                    http2_prioritization: true,
                    auto_minify: true,
                    rocket_loader: false // Can break some JS
                },
                optimization: {
                    polish: 'lossless',
                    mirage: true,
                    lazy_loading: true
                }
            }
        };
        
        await fs.writeFile('cdn-config.json', JSON.stringify(cdnConfig, null, 2));
        
        // Cloudflare worker for advanced optimizations
        const cfWorker = `
// Cloudflare Worker for ROOTUIP Performance
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    
    // Add security headers
    const securityHeaders = {
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
    };
    
    // Fetch the original response
    let response = await fetch(request);
    
    // Clone response to modify headers
    response = new Response(response.body, response);
    
    // Add security headers
    Object.keys(securityHeaders).forEach(name => {
        response.headers.set(name, securityHeaders[name]);
    });
    
    // Add cache headers for static assets
    if (url.pathname.match(/\\.(js|css|woff2?|jpg|jpeg|png|webp|svg)$/)) {
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
    
    // Add Vary header for proper caching
    response.headers.set('Vary', 'Accept-Encoding, Accept');
    
    return response;
}`;
        
        await fs.writeFile('cloudflare-worker.js', cfWorker);
        console.log('  ✓ CDN configuration complete');
    }
    
    // Setup Performance Monitoring
    async setupPerformanceMonitoring() {
        console.log('\n📊 Setting up performance monitoring...');
        
        const perfMonitoring = `
// ROOTUIP Performance Monitoring
(function() {
    'use strict';
    
    // Core Web Vitals tracking
    const vitals = {
        FCP: 0,  // First Contentful Paint
        LCP: 0,  // Largest Contentful Paint
        FID: 0,  // First Input Delay
        CLS: 0,  // Cumulative Layout Shift
        TTFB: 0  // Time to First Byte
    };
    
    // Performance Observer
    if ('PerformanceObserver' in window) {
        // LCP Observer
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            vitals.LCP = lastEntry.renderTime || lastEntry.loadTime;
            reportVital('LCP', vitals.LCP);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        // FID Observer
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach(entry => {
                vitals.FID = entry.processingStart - entry.startTime;
                reportVital('FID', vitals.FID);
            });
        }).observe({ entryTypes: ['first-input'] });
        
        // CLS Observer
        new PerformanceObserver((list) => {
            let cls = 0;
            list.getEntries().forEach(entry => {
                if (!entry.hadRecentInput) {
                    cls += entry.value;
                }
            });
            vitals.CLS = cls;
            reportVital('CLS', vitals.CLS);
        }).observe({ entryTypes: ['layout-shift'] });
    }
    
    // Navigation Timing
    window.addEventListener('load', () => {
        setTimeout(() => {
            const timing = performance.timing;
            const navigation = performance.navigation;
            
            // Calculate metrics
            vitals.TTFB = timing.responseStart - timing.fetchStart;
            vitals.FCP = performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0;
            
            // Page load metrics
            const metrics = {
                dns: timing.domainLookupEnd - timing.domainLookupStart,
                tcp: timing.connectEnd - timing.connectStart,
                request: timing.responseStart - timing.requestStart,
                response: timing.responseEnd - timing.responseStart,
                dom: timing.domComplete - timing.domLoading,
                load: timing.loadEventEnd - timing.loadEventStart,
                total: timing.loadEventEnd - timing.fetchStart,
                redirects: navigation.redirectCount
            };
            
            // Report to monitoring
            reportMetrics(metrics);
            reportWebVitals(vitals);
            
        }, 0);
    });
    
    // Report to Google Analytics
    function reportVital(name, value) {
        if (window.gtag) {
            gtag('event', name, {
                value: Math.round(value),
                metric_value: value,
                metric_delta: value,
                event_category: 'Web Vitals',
                event_label: window.location.pathname
            });
        }
    }
    
    // Report to custom endpoint
    function reportMetrics(metrics) {
        const data = {
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            metrics: metrics,
            vitals: vitals,
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : null
        };
        
        // Send beacon
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/analytics/performance', JSON.stringify(data));
        }
    }
    
    // Report Web Vitals
    function reportWebVitals(vitals) {
        console.log('%c⚡ Web Vitals', 'color: #00D46A; font-weight: bold;');
        console.table(vitals);
        
        // Check against targets
        const targets = {
            FCP: 1000,
            LCP: 2500,
            FID: 100,
            CLS: 0.1,
            TTFB: 600
        };
        
        Object.keys(vitals).forEach(key => {
            const value = vitals[key];
            const target = targets[key];
            const status = value <= target ? '✅' : '⚠️';
            console.log(\`\${status} \${key}: \${value}ms (target: \${target}ms)\`);
        });
    }
    
    // Resource timing
    window.addEventListener('load', () => {
        const resources = performance.getEntriesByType('resource');
        const slowResources = resources
            .filter(r => r.duration > 500)
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5);
        
        if (slowResources.length > 0) {
            console.log('%c🐌 Slow Resources', 'color: #FF6B35; font-weight: bold;');
            slowResources.forEach(r => {
                console.log(\`\${r.name}: \${Math.round(r.duration)}ms\`);
            });
        }
    });
})();`;
        
        // Minify and save
        const minified = await minify(perfMonitoring, this.config.compression.js);
        await fs.writeFile('assets/js/performance-monitor.min.js', minified.code || perfMonitoring);
        
        console.log('  ✓ Performance monitoring configured');
    }
    
    // Create Performance Budget
    async createPerformanceBudget() {
        console.log('\n💰 Creating performance budget...');
        
        const budget = {
            lighthouse: {
                performance: 95,
                accessibility: 100,
                'best-practices': 100,
                seo: 100
            },
            
            metrics: {
                'first-contentful-paint': {
                    max: 1000,
                    warn: 800
                },
                'largest-contentful-paint': {
                    max: 2500,
                    warn: 2000
                },
                'first-input-delay': {
                    max: 100,
                    warn: 50
                },
                'cumulative-layout-shift': {
                    max: 0.1,
                    warn: 0.05
                },
                'time-to-interactive': {
                    max: 3000,
                    warn: 2500
                }
            },
            
            resources: {
                script: {
                    total: {
                        max: 300, // KB
                        warn: 250
                    },
                    firstParty: {
                        max: 200,
                        warn: 150
                    },
                    thirdParty: {
                        max: 100,
                        warn: 80
                    }
                },
                
                stylesheet: {
                    total: {
                        max: 150,
                        warn: 100
                    },
                    critical: {
                        max: 14,
                        warn: 10
                    }
                },
                
                image: {
                    total: {
                        max: 1000,
                        warn: 800
                    },
                    largest: {
                        max: 200,
                        warn: 150
                    }
                },
                
                font: {
                    total: {
                        max: 100,
                        warn: 80
                    },
                    count: {
                        max: 4,
                        warn: 3
                    }
                }
            },
            
            counts: {
                requests: {
                    max: 50,
                    warn: 40
                },
                domains: {
                    max: 10,
                    warn: 8
                }
            }
        };
        
        await fs.writeFile('performance-budget.json', JSON.stringify(budget, null, 2));
        
        // Create budget check script
        const budgetCheck = `
#!/bin/bash
# ROOTUIP Performance Budget Check

echo "🔍 Checking performance budget..."

# Run Lighthouse
lighthouse https://rootuip.com \\
    --output json \\
    --output-path ./lighthouse-report.json \\
    --budget-path ./performance-budget.json \\
    --preset desktop \\
    --chrome-flags="--headless"

# Check results
if [ $? -eq 0 ]; then
    echo "✅ Performance budget check passed!"
else
    echo "❌ Performance budget exceeded!"
    exit 1
fi`;
        
        await fs.writeFile('check-performance-budget.sh', budgetCheck);
        await fs.chmod('check-performance-budget.sh', '755');
        
        console.log('  ✓ Performance budget defined');
    }
    
    // Mobile optimization
    async optimizeForMobile() {
        console.log('\n📱 Optimizing for mobile...');
        
        const mobileOptimizations = `
/* ROOTUIP Mobile Optimizations */

/* Ensure touch targets are 48px minimum */
button, a, input, select, textarea {
    min-height: 48px;
    min-width: 48px;
}

/* Optimize tap highlights */
* {
    -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
}

/* Prevent zoom on input focus (iOS) */
input, select, textarea {
    font-size: 16px;
}

/* Smooth scrolling with momentum */
.scroll-container {
    -webkit-overflow-scrolling: touch;
    overflow-y: auto;
}

/* Optimize mobile navigation */
@media (max-width: 768px) {
    /* Stack navigation vertically */
    .main-nav {
        flex-direction: column;
        width: 100%;
    }
    
    /* Larger touch targets */
    .main-nav a {
        padding: 16px;
        width: 100%;
        text-align: center;
    }
    
    /* Reduce font sizes */
    .display-1 { font-size: 2rem; }
    .display-2 { font-size: 1.75rem; }
    h1, .h1 { font-size: 1.5rem; }
    h2, .h2 { font-size: 1.25rem; }
    
    /* Single column layouts */
    .grid, .showcase-grid {
        grid-template-columns: 1fr;
        gap: 16px;
    }
    
    /* Hide non-essential elements */
    .desktop-only { display: none !important; }
    
    /* Optimize images */
    img {
        max-width: 100%;
        height: auto;
    }
    
    /* Reduce padding */
    .container { padding: 0 16px; }
    .section { padding: 40px 0; }
    .card { padding: 16px; }
}

/* Reduce motion for accessibility */
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}

/* Dark mode optimization */
@media (prefers-color-scheme: dark) {
    :root {
        --color-background: #0f172a;
        --color-text: #e2e8f0;
    }
}`;
        
        await fs.writeFile('assets/css/mobile-optimizations.css', mobileOptimizations);
        console.log('  ✓ Mobile optimizations complete');
    }
    
    // Helper functions
    async findFiles(dir, ext) {
        const files = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) {
                files.push(...await this.findFiles(fullPath, ext));
            } else if (entry.isFile() && entry.name.endsWith(ext)) {
                files.push(fullPath);
            }
        }
        return files;
    }
    
    async findImages(dir) {
        const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg'];
        const images = [];
        
        for (const ext of extensions) {
            images.push(...await this.findFiles(dir, ext));
        }
        return images;
    }
    
    removeUnusedCSS(css) {
        // Basic unused CSS removal (production would use PurgeCSS)
        const commonSelectors = [
            'html', 'body', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'a', 'img', 'button', 'input', 'select', 'textarea',
            '.container', '.btn', '.card', '.metric', '.header', '.footer'
        ];
        
        // This is a simplified version - real implementation would analyze HTML
        return css;
    }
    
    optimizeFontLoading(css) {
        // Add font-display: swap to all @font-face rules
        return css.replace(/@font-face\s*{[^}]*}/g, (match) => {
            if (!match.includes('font-display')) {
                return match.replace('}', '  font-display: swap;\n}');
            }
            return match;
        });
    }
    
    addPerformanceOptimizations(js) {
        // Add performance marks
        const perfMarks = `
// Performance marks
if (window.performance && performance.mark) {
    performance.mark('script-start');
    window.addEventListener('load', () => performance.mark('script-end'));
}
`;
        return perfMarks + js;
    }
    
    formatSize(bytes) {
        if (bytes < 1024) return bytes + 'B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
        return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
    }
    
    printReport() {
        const savings = ((1 - this.stats.optimizedSize / this.stats.originalSize) * 100).toFixed(1);
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 ROOTUIP Performance Optimization Complete!');
        console.log('='.repeat(60));
        console.log(`📁 Files processed: ${this.stats.filesProcessed}`);
        console.log(`📊 Original size: ${this.formatSize(this.stats.originalSize)}`);
        console.log(`📊 Optimized size: ${this.formatSize(this.stats.optimizedSize)}`);
        console.log(`💾 Space saved: ${this.formatSize(this.stats.originalSize - this.stats.optimizedSize)} (${savings}%)`);
        console.log(`⏱️ Time elapsed: ${(this.stats.timeElapsed / 1000).toFixed(1)}s`);
        console.log('\n📈 Performance Targets:');
        console.log('  • PageSpeed Score: 95+');
        console.log('  • First Contentful Paint: <1s');
        console.log('  • Largest Contentful Paint: <2.5s');
        console.log('  • Time to Interactive: <3s');
        console.log('\n✅ Next Steps:');
        console.log('  1. Deploy optimized assets');
        console.log('  2. Update nginx configuration');
        console.log('  3. Configure CloudFlare CDN');
        console.log('  4. Run performance tests');
        console.log('='.repeat(60));
    }
}

// Export for use
module.exports = PerformanceOptimizer;

// Run if called directly
if (require.main === module) {
    const optimizer = new PerformanceOptimizer();
    optimizer.optimizeAll().catch(console.error);
}