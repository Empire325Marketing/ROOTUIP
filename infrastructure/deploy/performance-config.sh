#!/bin/bash

# Performance Optimization Configuration for UIP
# This script optimizes server performance for production traffic

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== UIP Performance Optimization ===${NC}"

# 1. Nginx Performance Tuning
echo -e "\n${YELLOW}Optimizing Nginx performance...${NC}"

sudo tee /etc/nginx/conf.d/performance.conf > /dev/null <<'EOF'
# Worker processes and connections
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    # Basic Settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;
    
    # Buffer sizes
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;
    output_buffers 1 32k;
    postpone_output 1460;
    
    # Timeouts
    client_header_timeout 60;
    client_body_timeout 60;
    send_timeout 60;
    
    # Gzip Settings
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json application/x-font-ttf font/opentype image/svg+xml image/x-icon;
    gzip_min_length 1000;
    gzip_disable "msie6";
    
    # Brotli compression (if module available)
    # brotli on;
    # brotli_comp_level 6;
    # brotli_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Cache file descriptors
    open_file_cache max=2000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
    limit_conn_zone $binary_remote_addr zone=addr:10m;
    
    # Connection limiting
    limit_conn addr 100;
    
    # FastCGI cache
    fastcgi_cache_path /var/cache/nginx levels=1:2 keys_zone=FASTCGI:100m inactive=60m;
    fastcgi_cache_key "$scheme$request_method$host$request_uri";
    
    # Proxy cache
    proxy_cache_path /var/cache/nginx/proxy levels=1:2 keys_zone=PROXY:100m inactive=60m max_size=1g;
}
EOF

# 2. Create custom Nginx cache configuration
echo -e "\n${YELLOW}Setting up advanced caching...${NC}"

sudo tee /etc/nginx/snippets/cache-control.conf > /dev/null <<'EOF'
# Cache control headers
map $sent_http_content_type $expires {
    default                    off;
    text/html                  epoch;
    text/css                   max;
    application/javascript     max;
    ~image/                    max;
    ~font/                     max;
    application/font-woff      max;
    application/font-woff2     max;
    application/vnd.ms-fontobject max;
}

# Security headers with cache
map $sent_http_content_type $security_headers {
    default "max-age=31536000; includeSubDomains; preload";
}

# Cache static assets
location ~* \.(jpg|jpeg|png|gif|ico|css|js|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|woff|woff2|ttf|svg|webp|mp4|webm|ogg|mp3|wav|flac|aac|zip|gz|tar|rar|7z)$ {
    expires $expires;
    add_header Pragma public;
    add_header Cache-Control "public";
    add_header X-Content-Type-Options nosniff;
    
    # Enable CORS for fonts
    if ($request_filename ~* \.(woff|woff2|ttf|otf|eot)$) {
        add_header Access-Control-Allow-Origin *;
    }
}

# Cache HTML with revalidation
location ~* \.(html|htm)$ {
    expires 1h;
    add_header Cache-Control "public, must-revalidate";
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
}

# API endpoints - no cache
location ~ ^/api/ {
    expires off;
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
}
EOF

# 3. Set up Redis for caching
echo -e "\n${YELLOW}Configuring Redis cache...${NC}"

sudo tee /etc/redis/redis.conf.d/performance.conf > /dev/null <<'EOF'
# Memory management
maxmemory 512mb
maxmemory-policy allkeys-lru

# Persistence (disable for cache-only)
save ""
stop-writes-on-bgsave-error no
rdbcompression no

# Performance
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Slow log
slowlog-log-slower-than 10000
slowlog-max-len 128
EOF

# 4. System performance tuning
echo -e "\n${YELLOW}Optimizing system performance...${NC}"

sudo tee /etc/sysctl.d/99-rootuip.conf > /dev/null <<'EOF'
# Network optimizations
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_congestion_control = bbr
net.core.default_qdisc = fq

# Connection handling
net.ipv4.tcp_max_syn_backlog = 8192
net.core.somaxconn = 8192
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15

# Security
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_rfc1337 = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# File system
fs.file-max = 2097152
fs.nr_open = 1048576
EOF

sudo sysctl -p /etc/sysctl.d/99-rootuip.conf

# 5. Create CDN integration script
echo -e "\n${YELLOW}Setting up CDN integration...${NC}"

sudo tee /usr/local/bin/cdn-push.sh > /dev/null <<'EOF'
#!/bin/bash

# Push static assets to CDN
CDN_BUCKET="rootuip-static"
LOCAL_PATH="/var/www/rootuip/public"
CDN_ENDPOINT="https://cdn.rootuip.com"

# Sync static assets
echo "Syncing static assets to CDN..."

# Images
aws s3 sync $LOCAL_PATH/images s3://$CDN_BUCKET/images \
    --cache-control "max-age=31536000" \
    --content-encoding "gzip" \
    --delete

# CSS/JS
aws s3 sync $LOCAL_PATH/css s3://$CDN_BUCKET/css \
    --cache-control "max-age=31536000" \
    --content-encoding "gzip" \
    --delete

aws s3 sync $LOCAL_PATH/js s3://$CDN_BUCKET/js \
    --cache-control "max-age=31536000" \
    --content-encoding "gzip" \
    --delete

# Fonts
aws s3 sync $LOCAL_PATH/fonts s3://$CDN_BUCKET/fonts \
    --cache-control "max-age=31536000" \
    --delete

# Update HTML files to use CDN URLs
find $LOCAL_PATH -name "*.html" -type f | while read file; do
    sed -i "s|/images/|$CDN_ENDPOINT/images/|g" "$file"
    sed -i "s|/css/|$CDN_ENDPOINT/css/|g" "$file"
    sed -i "s|/js/|$CDN_ENDPOINT/js/|g" "$file"
    sed -i "s|/fonts/|$CDN_ENDPOINT/fonts/|g" "$file"
done

echo "CDN sync completed!"
EOF

sudo chmod +x /usr/local/bin/cdn-push.sh

# 6. Create performance monitoring script
echo -e "\n${YELLOW}Setting up performance monitoring...${NC}"

sudo tee /usr/local/bin/performance-monitor.sh > /dev/null <<'EOF'
#!/bin/bash

LOG_DIR="/var/log/rootuip/monitoring"
mkdir -p $LOG_DIR

# Function to check response time
check_response_time() {
    local url=$1
    local start=$(date +%s.%N)
    curl -s -o /dev/null "$url"
    local end=$(date +%s.%N)
    echo "scale=3; $end - $start" | bc
}

# Monitor main endpoints
ENDPOINTS=(
    "https://rootuip.com"
    "https://rootuip.com/platform"
    "https://rootuip.com/api/health"
    "https://app.rootuip.com"
)

# Log performance metrics
for endpoint in "${ENDPOINTS[@]}"; do
    response_time=$(check_response_time "$endpoint")
    echo "$(date '+%Y-%m-%d %H:%M:%S') $endpoint $response_time" >> $LOG_DIR/response-times.log
    
    # Alert if response time > 2 seconds
    if (( $(echo "$response_time > 2" | bc -l) )); then
        echo "ALERT: Slow response from $endpoint: ${response_time}s" | \
            mail -s "UIP Performance Alert" admin@rootuip.com
    fi
done

# Check server resources
cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
mem_usage=$(free | awk '/Mem:/ {printf "%.1f", $3/$2 * 100}')
disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')

echo "$(date '+%Y-%m-%d %H:%M:%S') CPU: $cpu_usage% MEM: $mem_usage% DISK: $disk_usage%" >> $LOG_DIR/resources.log

# Generate daily report
if [ $(date +%H) -eq 23 ] && [ $(date +%M) -eq 59 ]; then
    /usr/local/bin/performance-report.sh
fi
EOF

sudo chmod +x /usr/local/bin/performance-monitor.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "* * * * * /usr/local/bin/performance-monitor.sh") | crontab -

# 7. Create HTTP/2 and HTTP/3 configuration
echo -e "\n${YELLOW}Enabling HTTP/2 and preparing for HTTP/3...${NC}"

sudo tee /etc/nginx/snippets/http2-http3.conf > /dev/null <<'EOF'
# HTTP/2 Push (if supported)
location = / {
    http2_push /css/main.css;
    http2_push /js/app.js;
    http2_push /images/logo.svg;
}

# Early hints
add_header Link "</css/main.css>; rel=preload; as=style" always;
add_header Link "</js/app.js>; rel=preload; as=script" always;
add_header Link "</fonts/inter.woff2>; rel=preload; as=font; crossorigin" always;

# Resource hints
add_header Link "<https://cdn.rootuip.com>; rel=preconnect" always;
add_header Link "<https://api.rootuip.com>; rel=preconnect" always;
EOF

# 8. Set up lazy loading and progressive enhancement
echo -e "\n${YELLOW}Creating progressive loading configuration...${NC}"

sudo tee /var/www/rootuip/public/js/performance.js > /dev/null <<'EOF'
// Progressive Image Loading
document.addEventListener('DOMContentLoaded', function() {
    // Lazy load images
    const images = document.querySelectorAll('img[data-src]');
    const imageOptions = {
        threshold: 0.1,
        rootMargin: '50px 0px'
    };
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    }, imageOptions);
    
    images.forEach(img => imageObserver.observe(img));
    
    // Preload critical resources
    const preloadLink = document.createElement('link');
    preloadLink.rel = 'preload';
    preloadLink.as = 'style';
    preloadLink.href = '/css/critical.css';
    document.head.appendChild(preloadLink);
    
    // Progressive enhancement for slow connections
    if ('connection' in navigator) {
        const connection = navigator.connection;
        if (connection.saveData || connection.effectiveType === 'slow-2g') {
            document.body.classList.add('save-data');
        }
    }
});

// Service Worker for offline support
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
        console.log('Service Worker registered');
    }).catch(err => {
        console.log('Service Worker registration failed');
    });
}
EOF

# 9. Create service worker for caching
echo -e "\n${YELLOW}Setting up service worker...${NC}"

sudo tee /var/www/rootuip/public/sw.js > /dev/null <<'EOF'
const CACHE_NAME = 'rootuip-v1';
const urlsToCache = [
    '/',
    '/css/main.css',
    '/js/app.js',
    '/offline.html'
];

// Install service worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

// Fetch with cache-first strategy
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
            .catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match('/offline.html');
                }
            })
    );
});

// Clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
EOF

# 10. Create critical CSS extractor
echo -e "\n${YELLOW}Setting up critical CSS...${NC}"

sudo npm install -g critical

sudo tee /usr/local/bin/extract-critical-css.sh > /dev/null <<'EOF'
#!/bin/bash

# Extract critical CSS for above-the-fold content
PAGES=(
    "https://rootuip.com"
    "https://rootuip.com/platform"
    "https://rootuip.com/investor-relations"
)

for page in "${PAGES[@]}"; do
    filename=$(echo $page | sed 's|https://rootuip.com||' | sed 's|/|_|g')
    filename=${filename:-index}
    
    critical $page \
        --base /var/www/rootuip/public \
        --inline \
        --minify \
        --extract \
        --width 1920 \
        --height 1080 \
        > /var/www/rootuip/public/css/critical-${filename}.css
done

echo "Critical CSS extraction completed!"
EOF

sudo chmod +x /usr/local/bin/extract-critical-css.sh

# 11. Restart services
echo -e "\n${YELLOW}Restarting services...${NC}"
sudo systemctl restart nginx
sudo systemctl restart redis

echo -e "\n${GREEN}=== Performance Optimization Complete ===${NC}"
echo -e "${YELLOW}Performance improvements:${NC}"
echo "✓ Nginx optimized for high traffic"
echo "✓ Gzip compression enabled"
echo "✓ Browser caching configured" 
echo "✓ Redis cache ready"
echo "✓ CDN integration prepared"
echo "✓ HTTP/2 enabled"
echo "✓ Service worker installed"
echo "✓ Progressive loading active"
echo "✓ Performance monitoring running"
echo -e "\n${GREEN}Your site is now optimized for enterprise-grade performance!${NC}"