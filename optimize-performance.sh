#!/bin/bash

# Performance optimization script for UIP platform pages
# Focuses on infrastructure, international, and innovation sections

echo "🚀 Starting UIP Platform Performance Optimization..."

# Create minified CSS directory
mkdir -p /home/iii/ROOTUIP/assets/css/minified

# Function to optimize HTML files
optimize_html() {
    local file=$1
    local filename=$(basename "$file")
    echo "Optimizing: $filename"
    
    # Create backup
    cp "$file" "$file.backup"
    
    # Optimize font loading - add font-display: swap
    sed -i '/<link.*fonts.googleapis.com/s/<link/<link rel="preload" as="style" onload="this.onload=null;this.rel='"'"'stylesheet'"'"'"/' "$file"
    
    # Add critical CSS inline for above-the-fold content
    critical_css='<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0f172a;color:#e2e8f0}.sidebar{display:none}@media(min-width:768px){.sidebar{display:block}}</style>'
    
    # Insert critical CSS after <title>
    sed -i "/<\/title>/a\\    $critical_css" "$file"
    
    # Defer non-critical CSS
    sed -i 's/<style>/<style media="print" onload="this.media='"'"'all'"'"'">/' "$file"
    
    # Add loading="lazy" to images
    sed -i 's/<img/<img loading="lazy"/' "$file"
    
    # Minify inline styles (basic minification)
    # Remove comments
    sed -i '/<style>/,/<\/style>/{s/\/\*[^*]*\*\///g}' "$file"
    # Remove unnecessary whitespace
    sed -i '/<style>/,/<\/style>/{s/  */ /g}' "$file"
    sed -i '/<style>/,/<\/style>/{s/: /:/g}' "$file"
    sed -i '/<style>/,/<\/style>/{s/; /;/g}' "$file"
    sed -i '/<style>/,/<\/style>/{s/ {/{/g}' "$file"
    sed -i '/<style>/,/<\/style>/{s/} /}/g}' "$file"
    
    # Add resource hints
    if ! grep -q "dns-prefetch" "$file"; then
        sed -i '/<head>/a\    <link rel="dns-prefetch" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' "$file"
    fi
    
    # Optimize JavaScript loading
    sed -i 's/<script>/<script defer>/' "$file"
    
    # Add performance monitoring script
    if ! grep -q "Performance Observer" "$file"; then
        perf_script='<script>
// Performance monitoring
if ("PerformanceObserver" in window) {
    const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (entry.entryType === "largest-contentful-paint") {
                console.log("LCP:", entry.startTime);
            }
        }
    });
    observer.observe({ entryTypes: ["largest-contentful-paint"] });
}
</script>'
        sed -i "/<\/body>/i\\$perf_script" "$file"
    fi
    
    # Compress HTML (remove extra whitespace)
    sed -i 's/^[[:space:]]*//g' "$file"
    sed -i '/^$/d' "$file"
    
    echo "✓ Optimized: $filename"
}

# Function to create service worker for caching
create_service_worker() {
    cat > /home/iii/ROOTUIP/sw.js << 'EOF'
const CACHE_NAME = 'uip-platform-v1';
const urlsToCache = [
    '/',
    '/brand/logo-icon.svg',
    '/brand/logo-primary.svg',
    '/brand/brand-colors.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
EOF
    echo "✓ Created service worker"
}

# Function to create optimized CSS bundle
create_css_bundle() {
    echo "Creating optimized CSS bundle..."
    
    # Extract all inline CSS from HTML files
    find /home/iii/ROOTUIP/{infrastructure,international,innovation} -name "*.html" | while read file; do
        sed -n '/<style>/,/<\/style>/p' "$file" | sed '1d;$d' >> /tmp/all-styles.css
    done
    
    # Remove duplicates and minify
    sort -u /tmp/all-styles.css > /home/iii/ROOTUIP/assets/css/platform-bundle.css
    
    # Basic minification
    sed -i 's/  */ /g' /home/iii/ROOTUIP/assets/css/platform-bundle.css
    sed -i 's/: /:/g' /home/iii/ROOTUIP/assets/css/platform-bundle.css
    sed -i 's/; /;/g' /home/iii/ROOTUIP/assets/css/platform-bundle.css
    sed -i 's/ {/{/g' /home/iii/ROOTUIP/assets/css/platform-bundle.css
    sed -i 's/} /}/g' /home/iii/ROOTUIP/assets/css/platform-bundle.css
    
    rm -f /tmp/all-styles.css
    echo "✓ Created CSS bundle"
}

# Optimize infrastructure pages
echo -e "\n📦 Optimizing Infrastructure Platform pages..."
for file in /home/iii/ROOTUIP/infrastructure/*/index.html; do
    [ -f "$file" ] && optimize_html "$file"
done

# Optimize international pages  
echo -e "\n🌍 Optimizing International Expansion pages..."
for file in /home/iii/ROOTUIP/international/*/index.html; do
    [ -f "$file" ] && optimize_html "$file"
done

# Optimize innovation pages
echo -e "\n🚀 Optimizing Innovation Pipeline pages..."
for file in /home/iii/ROOTUIP/innovation/*/index.html; do
    [ -f "$file" ] && optimize_html "$file"
done

# Create service worker
create_service_worker

# Create CSS bundle
create_css_bundle

# Generate performance report
echo -e "\n📊 Performance Optimization Report:"
echo "===================================="

# Count optimized files
optimized_count=$(find /home/iii/ROOTUIP/{infrastructure,international,innovation} -name "*.html" | wc -l)
echo "✓ Optimized $optimized_count HTML files"

# Calculate size reduction
original_size=$(find /home/iii/ROOTUIP/{infrastructure,international,innovation} -name "*.html.backup" -exec du -cb {} + | grep total | awk '{print $1}')
new_size=$(find /home/iii/ROOTUIP/{infrastructure,international,innovation} -name "*.html" -not -name "*.backup" -exec du -cb {} + | grep total | awk '{print $1}')

if [ -n "$original_size" ] && [ -n "$new_size" ]; then
    reduction=$((original_size - new_size))
    percentage=$((reduction * 100 / original_size))
    echo "✓ Reduced file sizes by ${percentage}% (saved $(numfmt --to=iec $reduction))"
fi

echo -e "\n🎯 Optimizations Applied:"
echo "  • Added critical CSS inline"
echo "  • Deferred non-critical CSS loading"
echo "  • Added lazy loading for images"
echo "  • Minified inline styles"
echo "  • Added resource hints (dns-prefetch, preconnect)"
echo "  • Deferred JavaScript execution"
echo "  • Created service worker for caching"
echo "  • Generated optimized CSS bundle"
echo "  • Added performance monitoring"

echo -e "\n⚡ Next Steps:"
echo "  1. Deploy service worker registration"
echo "  2. Enable HTTP/2 on server"
echo "  3. Configure CDN for static assets"
echo "  4. Enable Brotli compression"
echo "  5. Implement image optimization pipeline"

echo -e "\n✅ Performance optimization complete!"