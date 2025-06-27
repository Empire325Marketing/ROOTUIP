#!/bin/bash

# ROOTUIP Production Build and Deployment Script
# This script optimizes and deploys the ROOTUIP platform to production

set -e  # Exit on any error

echo "🚀 ROOTUIP Production Build & Deployment"
echo "========================================"

# Configuration
VPS_HOST="145.223.73.4"
VPS_USER="root"
DOMAIN="rootuip.com"
LOCAL_BUILD_DIR="/home/iii/ROOTUIP/build"
REMOTE_WEB_DIR="/var/www/html"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

# Step 1: Clean and prepare build directory
log "Step 1: Preparing build environment..."
rm -rf "$LOCAL_BUILD_DIR"
mkdir -p "$LOCAL_BUILD_DIR"

# Step 2: Copy and optimize source files
log "Step 2: Copying source files..."
cp -r ROOTUIP/* "$LOCAL_BUILD_DIR/"

# Step 3: Optimize images (if imageoptim or similar is available)
log "Step 3: Optimizing images..."
if command -v optipng >/dev/null 2>&1; then
    find "$LOCAL_BUILD_DIR" -name "*.png" -exec optipng -o7 {} \;
else
    warn "optipng not found - skipping PNG optimization"
fi

# Step 4: Minify CSS
log "Step 4: Minifying CSS..."
for css_file in $(find "$LOCAL_BUILD_DIR" -name "*.css" -not -path "*/node_modules/*"); do
    if command -v csso >/dev/null 2>&1; then
        csso "$css_file" --output "$css_file"
        log "Minified: $css_file"
    else
        # Basic CSS minification using sed
        sed -i 's/\/\*.*\*\///g; s/[[:space:]]\+/ /g; s/; /;/g; s/ {/{/g; s/{ /{/g' "$css_file"
        log "Basic minification: $css_file"
    fi
done

# Step 5: Minify JavaScript
log "Step 5: Minifying JavaScript..."
for js_file in $(find "$LOCAL_BUILD_DIR" -name "*.js" -not -path "*/node_modules/*"); do
    if command -v uglifyjs >/dev/null 2>&1; then
        uglifyjs "$js_file" --compress --mangle --output "$js_file"
        log "Minified: $js_file"
    else
        # Basic JS minification using sed (removes comments and extra whitespace)
        sed -i '/^[[:space:]]*\/\//d; /^[[:space:]]*$/d; s/[[:space:]]\+/ /g' "$js_file"
        log "Basic minification: $js_file"
    fi
done

# Step 6: Generate gzip versions for better compression
log "Step 6: Creating gzip versions..."
find "$LOCAL_BUILD_DIR" \( -name "*.css" -o -name "*.js" -o -name "*.html" \) -exec gzip -k9 {} \;

# Step 7: Add cache-busting to critical files
log "Step 7: Adding cache-busting..."
TIMESTAMP=$(date +%s)
find "$LOCAL_BUILD_DIR" -name "*.html" -exec sed -i "s/\.css/\.css?v=$TIMESTAMP/g; s/\.js/\.js?v=$TIMESTAMP/g" {} \;

# Step 8: Create .htaccess for Apache optimization
log "Step 8: Creating .htaccess for performance..."
cat > "$LOCAL_BUILD_DIR/.htaccess" << 'EOF'
# ROOTUIP Production .htaccess
# Performance and Security Optimizations

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
    AddOutputFilterByType DEFLATE application/json
    AddOutputFilterByType DEFLATE image/svg+xml
</IfModule>

# Browser Caching
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType image/png "access plus 1 month"
    ExpiresByType image/jpg "access plus 1 month"
    ExpiresByType image/jpeg "access plus 1 month"
    ExpiresByType image/gif "access plus 1 month"
    ExpiresByType image/svg+xml "access plus 1 month"
    ExpiresByType image/x-icon "access plus 1 year"
</IfModule>

# Security Headers
<IfModule mod_headers.c>
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options DENY
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
    Header always set Permissions-Policy "geolocation=(), microphone=(), camera=()"
</IfModule>

# Force HTTPS
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Pretty URLs
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^([^\.]+)$ $1.html [NC,L]
EOF

# Step 9: Create robots.txt
log "Step 9: Creating robots.txt..."
cat > "$LOCAL_BUILD_DIR/robots.txt" << EOF
User-agent: *
Allow: /

Sitemap: https://$DOMAIN/sitemap.xml
EOF

# Step 10: Create sitemap.xml
log "Step 10: Creating sitemap.xml..."
cat > "$LOCAL_BUILD_DIR/sitemap.xml" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>https://$DOMAIN/</loc>
        <lastmod>$(date -u +%Y-%m-%d)</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>https://$DOMAIN/roi-calculator</loc>
        <lastmod>$(date -u +%Y-%m-%d)</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.9</priority>
    </url>
    <url>
        <loc>https://$DOMAIN/platform</loc>
        <lastmod>$(date -u +%Y-%m-%d)</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.8</priority>
    </url>
</urlset>
EOF

# Step 11: Create service worker for caching
log "Step 11: Creating service worker..."
cat > "$LOCAL_BUILD_DIR/sw.js" << 'EOF'
const CACHE_NAME = 'uip-v1';
const urlsToCache = [
  '/',
  '/css/uip-style.css',
  '/js/uip-scripts.js',
  '/brand/logo.svg',
  '/brand/logo-icon.svg'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
EOF

# Step 12: Add Google Analytics and performance tracking
log "Step 12: Adding analytics and performance tracking..."
cat > "$LOCAL_BUILD_DIR/js/analytics.js" << 'EOF'
// Google Analytics 4
(function() {
  var script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID';
  document.head.appendChild(script);
  
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
  
  // Track ROI Calculator usage
  gtag('event', 'roi_calculator_interaction', {
    'event_category': 'engagement',
    'event_label': 'roi_calculator'
  });
})();

// Performance monitoring
(function() {
  window.addEventListener('load', function() {
    setTimeout(function() {
      var perfData = performance.timing;
      var pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      
      if (window.gtag) {
        gtag('event', 'page_load_time', {
          'event_category': 'performance',
          'value': pageLoadTime
        });
      }
    }, 0);
  });
})();
EOF

# Step 13: Build tarball for deployment
log "Step 13: Creating deployment package..."
cd "$(dirname "$LOCAL_BUILD_DIR")"
tar -czf "rootuip-production-$(date +%Y%m%d-%H%M%S).tar.gz" -C "$LOCAL_BUILD_DIR" .

log "Step 14: Deployment package ready!"
echo -e "${BLUE}📦 Build completed successfully!${NC}"
echo -e "${BLUE}📁 Build directory: $LOCAL_BUILD_DIR${NC}"
echo -e "${BLUE}📦 Deployment package: rootuip-production-$(date +%Y%m%d-%H%M%S).tar.gz${NC}"
echo ""
echo -e "${YELLOW}🚀 To deploy to production VPS:${NC}"
echo -e "${YELLOW}1. scp rootuip-production-*.tar.gz root@$VPS_HOST:/tmp/${NC}"
echo -e "${YELLOW}2. ssh root@$VPS_HOST${NC}"
echo -e "${YELLOW}3. cd /var/www/html && rm -rf * && tar -xzf /tmp/rootuip-production-*.tar.gz${NC}"
echo -e "${YELLOW}4. systemctl reload nginx${NS}"
echo ""
echo -e "${GREEN}✅ Ready for production deployment!${NC}"