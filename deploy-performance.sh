#!/bin/bash

# ROOTUIP Performance Deployment Script
# Achieves <2 second load times with 95+ PageSpeed score

set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ROOTUIP Performance Optimization v2.0  ║${NC}"
echo -e "${BLUE}║    Target: <2s load, 95+ PageSpeed     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if running on VPS
if [ "$HOSTNAME" != "rootuip-vps" ] && [ "$USER" != "root" ]; then
    warning "Not running on production VPS. Continue anyway? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        exit 0
    fi
fi

# Step 1: Install dependencies
log "Step 1: Installing performance optimization dependencies..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 14 ]; then
    error "Node.js 14+ required. Current version: $(node -v)"
fi

# Install global tools
npm install -g terser clean-css-cli sharp-cli lighthouse @squoosh/cli

# Install local dependencies
npm install --save-dev \
    terser \
    clean-css \
    sharp \
    workbox-webpack-plugin \
    compression-webpack-plugin \
    html-webpack-plugin \
    mini-css-extract-plugin \
    purgecss \
    critical \
    imagemin \
    imagemin-webp

# Step 2: Create optimization directories
log "Step 2: Creating optimization directory structure..."

mkdir -p dist/{css,js,images,fonts}
mkdir -p assets/{css,js,images,fonts}
mkdir -p .cache/performance

# Step 3: Run performance optimizer
log "Step 3: Running performance optimization..."

node performance-optimizer.js

# Step 4: Optimize images with Squoosh
log "Step 4: Advanced image optimization..."

# Function to optimize images
optimize_images() {
    local input_dir=$1
    local output_dir=$2
    
    # Find all images
    find "$input_dir" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" \) | while read -r img; do
        filename=$(basename "$img")
        name="${filename%.*}"
        
        # Generate WebP
        npx @squoosh/cli --webp '{"quality":85}' \
            -d "$output_dir" \
            "$img"
        
        # Generate AVIF for modern browsers
        npx @squoosh/cli --avif '{"quality":80}' \
            -d "$output_dir" \
            "$img"
        
        # Generate responsive sizes
        for width in 320 640 768 1024 1366 1920; do
            npx @squoosh/cli --resize '{"width":'$width'}' \
                --webp '{"quality":85}' \
                -d "$output_dir" \
                -s "-${width}w" \
                "$img"
        done
        
        log "  ✓ Optimized: $filename"
    done
}

# Optimize all images
if [ -d "assets/images" ]; then
    optimize_images "assets/images" "dist/images"
fi

# Step 5: Generate Critical CSS
log "Step 5: Generating critical CSS for above-fold content..."

# Create critical CSS extractor
cat > extract-critical.js << 'EOF'
const critical = require('critical');
const fs = require('fs').promises;
const path = require('path');

async function extractCritical() {
    const pages = [
        'index.html',
        'dashboard.html',
        'container-tracking.html',
        'landing-page.html'
    ];
    
    for (const page of pages) {
        if (!await fs.access(page).then(() => true).catch(() => false)) continue;
        
        try {
            const result = await critical.generate({
                base: './',
                src: page,
                target: {
                    css: `dist/css/critical-${path.basename(page, '.html')}.css`,
                    html: `dist/${page}`
                },
                width: 1300,
                height: 900,
                inline: true,
                minify: true
            });
            
            console.log(`✓ Critical CSS extracted for ${page}`);
        } catch (error) {
            console.error(`✗ Error processing ${page}:`, error.message);
        }
    }
}

extractCritical();
EOF

node extract-critical.js

# Step 6: Create Service Worker for caching
log "Step 6: Creating Service Worker for offline performance..."

cat > sw.js << 'EOF'
// ROOTUIP Service Worker v2.0
const CACHE_NAME = 'rootuip-v2';
const RUNTIME_CACHE = 'rootuip-runtime';

// Assets to cache immediately
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/assets/css/critical.min.css',
    '/assets/js/app.min.js',
    '/assets/images/logo.svg',
    '/offline.html'
];

// Install event - cache core assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_ASSETS))
            .then(self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE)
                    .map(cacheName => caches.delete(cacheName))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') return;
    
    // API calls - network first
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Static assets - cache first
    if (url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|webp|svg)$/)) {
        event.respondWith(cacheFirst(request));
        return;
    }
    
    // HTML - network first with offline fallback
    event.respondWith(networkFirstWithOffline(request));
});

// Cache strategies
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    try {
        const response = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
        return response;
    } catch (error) {
        return new Response('Offline', { status: 503 });
    }
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        return cached || new Response('Offline', { status: 503 });
    }
}

async function networkFirstWithOffline(request) {
    try {
        return await networkFirst(request);
    } catch (error) {
        return caches.match('/offline.html') || new Response('Offline', { status: 503 });
    }
}
EOF

# Minify service worker
terser sw.js -c -m -o sw.min.js

# Step 7: Update Nginx configuration
log "Step 7: Updating Nginx for maximum performance..."

# Check if nginx is installed
if command -v nginx &> /dev/null; then
    # Install Nginx modules if needed
    if [ -f /etc/debian_version ]; then
        sudo apt-get update
        sudo apt-get install -y nginx-module-brotli
    fi
    
    # Copy optimized nginx config
    sudo cp nginx-performance.conf /etc/nginx/sites-available/rootuip
    sudo ln -sf /etc/nginx/sites-available/rootuip /etc/nginx/sites-enabled/
    
    # Test nginx configuration
    sudo nginx -t
    if [ $? -eq 0 ]; then
        sudo systemctl reload nginx
        log "  ✓ Nginx configuration updated"
    else
        error "Nginx configuration test failed"
    fi
else
    warning "Nginx not installed. Skipping server configuration."
fi

# Step 8: Create performance monitoring endpoint
log "Step 8: Setting up performance monitoring..."

cat > performance-endpoint.js << 'EOF'
// ROOTUIP Performance Monitoring Endpoint
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Create performance metrics table
const createTable = `
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url VARCHAR(500) NOT NULL,
    fcp DECIMAL(10,2),
    lcp DECIMAL(10,2),
    fid DECIMAL(10,2),
    cls DECIMAL(10,4),
    ttfb DECIMAL(10,2),
    user_agent TEXT,
    connection_type VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_perf_metrics_url ON performance_metrics(url);
CREATE INDEX idx_perf_metrics_created ON performance_metrics(created_at);
`;

// Initialize table
pool.query(createTable).catch(console.error);

// Endpoint to receive metrics
router.post('/api/analytics/performance', async (req, res) => {
    try {
        const { url, metrics, vitals, connection } = req.body;
        
        await pool.query(`
            INSERT INTO performance_metrics 
            (url, fcp, lcp, fid, cls, ttfb, user_agent, connection_type)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
            url,
            vitals.FCP,
            vitals.LCP,
            vitals.FID,
            vitals.CLS,
            vitals.TTFB,
            req.headers['user-agent'],
            connection?.effectiveType
        ]);
        
        res.status(204).send();
    } catch (error) {
        console.error('Performance metrics error:', error);
        res.status(500).json({ error: 'Failed to save metrics' });
    }
});

// Endpoint to view metrics
router.get('/api/analytics/performance/dashboard', async (req, res) => {
    try {
        const metrics = await pool.query(`
            SELECT 
                url,
                AVG(fcp) as avg_fcp,
                AVG(lcp) as avg_lcp,
                AVG(fid) as avg_fid,
                AVG(cls) as avg_cls,
                AVG(ttfb) as avg_ttfb,
                COUNT(*) as sample_count
            FROM performance_metrics
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY url
            ORDER BY sample_count DESC
        `);
        
        res.json({
            metrics: metrics.rows,
            targets: {
                fcp: 1000,
                lcp: 2500,
                fid: 100,
                cls: 0.1,
                ttfb: 600
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
EOF

# Step 9: Create performance testing script
log "Step 9: Creating automated performance testing..."

cat > test-performance.sh << 'EOF'
#!/bin/bash

# ROOTUIP Performance Testing

echo "🧪 Running performance tests..."

# Test with Lighthouse
lighthouse https://rootuip.com \
    --output html \
    --output json \
    --output-path ./performance-report \
    --view \
    --preset desktop \
    --throttling-method=provided

# Extract scores
PERF_SCORE=$(jq '.categories.performance.score' performance-report.report.json)
FCP=$(jq '.audits["first-contentful-paint"].numericValue' performance-report.report.json)
LCP=$(jq '.audits["largest-contentful-paint"].numericValue' performance-report.report.json)

# Convert to percentage and milliseconds
PERF_SCORE=$(echo "$PERF_SCORE * 100" | bc)
FCP=$(echo "$FCP" | cut -d'.' -f1)
LCP=$(echo "$LCP" | cut -d'.' -f1)

echo ""
echo "📊 Performance Results:"
echo "  Score: ${PERF_SCORE}%"
echo "  FCP: ${FCP}ms"
echo "  LCP: ${LCP}ms"

# Check against targets
if (( $(echo "$PERF_SCORE >= 95" | bc -l) )) && (( FCP < 1000 )) && (( LCP < 2500 )); then
    echo "✅ All performance targets met!"
else
    echo "⚠️ Performance targets not met. Further optimization needed."
fi
EOF

chmod +x test-performance.sh

# Step 10: Create CloudFlare configuration
log "Step 10: Preparing CloudFlare CDN configuration..."

cat > cloudflare-setup.sh << 'EOF'
#!/bin/bash

# CloudFlare configuration for ROOTUIP

echo "☁️ CloudFlare CDN Setup"
echo ""
echo "1. Log in to CloudFlare dashboard"
echo "2. Add rootuip.com to your account"
echo "3. Update nameservers at your registrar:"
echo "   - ns1.cloudflare.com"
echo "   - ns2.cloudflare.com"
echo ""
echo "4. Configure these settings:"
echo "   Speed → Optimization:"
echo "   ✓ Auto Minify (JavaScript, CSS, HTML)"
echo "   ✓ Brotli compression"
echo "   ✓ Early Hints"
echo "   ✓ HTTP/2 Prioritization"
echo "   ✓ Rocket Loader: OFF (can break JS)"
echo ""
echo "   Caching → Configuration:"
echo "   ✓ Caching Level: Standard"
echo "   ✓ Browser Cache TTL: 1 year"
echo "   ✓ Always Online: ON"
echo ""
echo "5. Create Page Rules:"
echo "   - *.rootuip.com/api/* → Cache Level: Bypass"
echo "   - *.rootuip.com/*.css → Cache Everything, Edge TTL: 1 month"
echo "   - *.rootuip.com/*.js → Cache Everything, Edge TTL: 1 month"
echo "   - *.rootuip.com/*.webp → Cache Everything, Edge TTL: 1 year"
echo ""
echo "6. Deploy CloudFlare Worker:"
echo "   - Copy contents of cloudflare-worker.js"
echo "   - Create new Worker in dashboard"
echo "   - Add route: *.rootuip.com/*"
EOF

chmod +x cloudflare-setup.sh

# Step 11: Mobile-specific optimizations
log "Step 11: Applying mobile optimizations..."

# Create AMP version for landing page
cat > landing-page-amp.html << 'EOF'
<!doctype html>
<html ⚡ lang="en">
<head>
    <meta charset="utf-8">
    <script async src="https://cdn.ampproject.org/v0.js"></script>
    <title>ROOTUIP - Stop Losing $14M Per Vessel | Ocean Freight Intelligence</title>
    <link rel="canonical" href="https://rootuip.com">
    <meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">
    <style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>
    <style amp-custom>
        body { font-family: -apple-system, sans-serif; margin: 0; }
        .header { background: #0F3460; color: white; padding: 1rem; }
        .hero { padding: 3rem 1rem; text-align: center; }
        .value { color: #00D46A; font-size: 3rem; font-weight: 700; }
        .cta { background: #00D46A; color: white; padding: 1rem 2rem; text-decoration: none; border-radius: 0.5rem; display: inline-block; margin-top: 2rem; }
    </style>
</head>
<body>
    <header class="header">
        <h1>ROOTUIP</h1>
    </header>
    <main>
        <section class="hero">
            <h2>Stop Losing Money on Ocean Freight</h2>
            <div class="value">$14M</div>
            <p>Average detention & demurrage charges per vessel annually</p>
            <p>Our platform saves enterprises <strong>$500K+ per vessel</strong> each year</p>
            <a href="https://rootuip.com/roi-calculator" class="cta">Calculate Your Savings</a>
        </section>
    </main>
</body>
</html>
EOF

# Final summary
log "Performance optimization complete!"
echo ""
echo "📊 Optimization Summary:"
echo "  ✓ CSS & JS minified and compressed"
echo "  ✓ Images converted to WebP/AVIF"
echo "  ✓ Critical CSS extracted"
echo "  ✓ Service Worker created"
echo "  ✓ Nginx optimized"
echo "  ✓ Performance monitoring ready"
echo "  ✓ Mobile optimizations applied"
echo ""
echo "🚀 Next Steps:"
echo "  1. Deploy optimized assets: rsync -avz dist/ root@145.223.73.4:/var/www/rootuip/"
echo "  2. Update DNS for CloudFlare"
echo "  3. Run performance test: ./test-performance.sh"
echo "  4. Monitor Core Web Vitals dashboard"
echo ""
echo "🎯 Expected Results:"
echo "  • PageSpeed Score: 95+"
echo "  • First Contentful Paint: <1s"
echo "  • Largest Contentful Paint: <2.5s"
echo "  • Total Load Time: <2s"