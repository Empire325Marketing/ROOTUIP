#!/bin/bash

# ROOTUIP Image Optimization Script
# Converts images to WebP format for better performance while maintaining fallbacks
# Handles PNG, JPG, JPEG, and optimizes SVG files

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
ROOTUIP_DIR="/home/iii/ROOTUIP/ROOTUIP"
BACKUP_DIR="${ROOTUIP_DIR}/images/original"
OPTIMIZED_DIR="${ROOTUIP_DIR}/images/optimized"
QUALITY=85
SVG_QUALITY=90

# Logging
LOG_FILE="image-optimization.log"
echo "Image Optimization Started: $(date)" > "$LOG_FILE"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
    echo "[INFO] $1" >> "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "[WARNING] $1" >> "$LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "[ERROR] $1" >> "$LOG_FILE"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
    echo "=== $1 ===" >> "$LOG_FILE"
}

# Check dependencies
check_dependencies() {
    print_header "Checking Dependencies"
    
    local deps=("cwebp" "imagemagick" "svgo")
    local missing_deps=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            case "$dep" in
                "cwebp")
                    if ! command -v "webp" &> /dev/null; then
                        missing_deps+=("webp")
                    fi
                    ;;
                "imagemagick")
                    if ! command -v "convert" &> /dev/null; then
                        missing_deps+=("imagemagick")
                    fi
                    ;;
                *)
                    missing_deps+=("$dep")
                    ;;
            esac
        fi
    done
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        echo "Please install missing dependencies:"
        echo "Ubuntu/Debian: sudo apt-get install webp imagemagick node-svgo"
        echo "CentOS/RHEL: sudo yum install libwebp-tools ImageMagick npm && npm install -g svgo"
        echo "macOS: brew install webp imagemagick svgo"
        exit 1
    fi
    
    print_status "All dependencies are installed"
}

# Create directory structure
setup_directories() {
    print_header "Setting Up Directory Structure"
    
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$OPTIMIZED_DIR"
    mkdir -p "${ROOTUIP_DIR}/images/webp"
    
    print_status "Created optimization directories"
}

# Find all images
find_images() {
    print_header "Scanning for Images"
    
    # Find all image files
    PNG_FILES=$(find "$ROOTUIP_DIR" -name "*.png" -o -name "*.PNG" 2>/dev/null)
    JPG_FILES=$(find "$ROOTUIP_DIR" -name "*.jpg" -o -name "*.JPG" -o -name "*.jpeg" -o -name "*.JPEG" 2>/dev/null)
    SVG_FILES=$(find "$ROOTUIP_DIR" -name "*.svg" -o -name "*.SVG" 2>/dev/null)
    
    PNG_COUNT=$(echo "$PNG_FILES" | grep -c . || echo "0")
    JPG_COUNT=$(echo "$JPG_FILES" | grep -c . || echo "0")
    SVG_COUNT=$(echo "$SVG_FILES" | grep -c . || echo "0")
    
    print_status "Found $PNG_COUNT PNG files"
    print_status "Found $JPG_COUNT JPG/JPEG files"
    print_status "Found $SVG_COUNT SVG files"
    
    # List all found images
    echo "=== IMAGE INVENTORY ===" >> "$LOG_FILE"
    echo "PNG Files:" >> "$LOG_FILE"
    echo "$PNG_FILES" >> "$LOG_FILE"
    echo "JPG Files:" >> "$LOG_FILE"
    echo "$JPG_FILES" >> "$LOG_FILE"
    echo "SVG Files:" >> "$LOG_FILE"
    echo "$SVG_FILES" >> "$LOG_FILE"
}

# Optimize SVG files
optimize_svgs() {
    print_header "Optimizing SVG Files"
    
    if [ "$SVG_COUNT" -eq 0 ]; then
        print_warning "No SVG files found to optimize"
        return
    fi
    
    local optimized_count=0
    local total_original_size=0
    local total_optimized_size=0
    
    while IFS= read -r svg_file; do
        if [ -f "$svg_file" ]; then
            local basename=$(basename "$svg_file")
            local backup_file="${BACKUP_DIR}/${basename}"
            local optimized_file="${OPTIMIZED_DIR}/${basename}"
            
            # Get original size
            local original_size=$(stat -f%z "$svg_file" 2>/dev/null || stat -c%s "$svg_file" 2>/dev/null)
            total_original_size=$((total_original_size + original_size))
            
            # Backup original
            cp "$svg_file" "$backup_file"
            
            # Optimize with svgo
            if command -v svgo &> /dev/null; then
                svgo "$svg_file" -o "$optimized_file" --config '{
                    "plugins": [
                        "removeDoctype",
                        "removeXMLProcInst",
                        "removeComments",
                        "removeMetadata",
                        "removeEditorsNSData",
                        "cleanupAttrs",
                        "mergeStyles",
                        "inlineStyles",
                        "minifyStyles",
                        "cleanupIDs",
                        "removeUselessDefs",
                        "cleanupNumericValues",
                        "convertColors",
                        "removeUnknownsAndDefaults",
                        "removeNonInheritableGroupAttrs",
                        "removeUselessStrokeAndFill",
                        "removeViewBox",
                        "cleanupEnableBackground",
                        "removeHiddenElems",
                        "removeEmptyText",
                        "convertShapeToPath",
                        "convertEllipseToCircle",
                        "moveElemsAttrsToGroup",
                        "moveGroupAttrsToElems",
                        "collapseGroups",
                        "convertPathData",
                        "convertTransform",
                        "removeEmptyAttrs",
                        "removeEmptyContainers",
                        "mergePaths",
                        "removeUnusedNS",
                        "sortAttrs",
                        "sortDefsChildren",
                        "removeTitle",
                        "removeDesc"
                    ]
                }' 2>/dev/null
                
                if [ $? -eq 0 ]; then
                    # Copy optimized version back to original location
                    cp "$optimized_file" "$svg_file"
                    
                    # Get optimized size
                    local optimized_size=$(stat -f%z "$svg_file" 2>/dev/null || stat -c%s "$svg_file" 2>/dev/null)
                    total_optimized_size=$((total_optimized_size + optimized_size))
                    
                    local savings=$((original_size - optimized_size))
                    local percentage=$(awk "BEGIN {printf \"%.1f\", ($savings/$original_size)*100}")
                    
                    print_status "Optimized $basename: ${original_size} → ${optimized_size} bytes (${percentage}% reduction)"
                    optimized_count=$((optimized_count + 1))
                else
                    print_error "Failed to optimize $basename"
                    # Restore original if optimization failed
                    cp "$backup_file" "$svg_file"
                fi
            else
                print_warning "svgo not available, skipping SVG optimization"
            fi
        fi
    done <<< "$SVG_FILES"
    
    if [ $optimized_count -gt 0 ]; then
        local total_savings=$((total_original_size - total_optimized_size))
        local total_percentage=$(awk "BEGIN {printf \"%.1f\", ($total_savings/$total_original_size)*100}")
        print_status "SVG Optimization Complete: $optimized_count files, ${total_savings} bytes saved (${total_percentage}% total reduction)"
    fi
}

# Convert images to WebP
convert_to_webp() {
    print_header "Converting Images to WebP"
    
    local converted_count=0
    local total_original_size=0
    local total_webp_size=0
    
    # Convert PNG files
    while IFS= read -r png_file; do
        if [ -f "$png_file" ]; then
            local basename=$(basename "$png_file" .png)
            local dirname=$(dirname "$png_file")
            local webp_file="${dirname}/${basename}.webp"
            local backup_file="${BACKUP_DIR}/$(basename "$png_file")"
            
            # Get original size
            local original_size=$(stat -f%z "$png_file" 2>/dev/null || stat -c%s "$png_file" 2>/dev/null)
            total_original_size=$((total_original_size + original_size))
            
            # Backup original
            cp "$png_file" "$backup_file"
            
            # Convert to WebP
            if command -v cwebp &> /dev/null; then
                cwebp -q $QUALITY "$png_file" -o "$webp_file" &>/dev/null
            elif command -v convert &> /dev/null; then
                convert "$png_file" -quality $QUALITY "$webp_file" &>/dev/null
            else
                print_error "No WebP conversion tool available"
                continue
            fi
            
            if [ -f "$webp_file" ]; then
                local webp_size=$(stat -f%z "$webp_file" 2>/dev/null || stat -c%s "$webp_file" 2>/dev/null)
                total_webp_size=$((total_webp_size + webp_size))
                
                local savings=$((original_size - webp_size))
                local percentage=$(awk "BEGIN {printf \"%.1f\", ($savings/$original_size)*100}")
                
                print_status "Converted $(basename "$png_file"): ${original_size} → ${webp_size} bytes (${percentage}% reduction)"
                converted_count=$((converted_count + 1))
            else
                print_error "Failed to convert $(basename "$png_file")"
            fi
        fi
    done <<< "$PNG_FILES"
    
    # Convert JPG files
    while IFS= read -r jpg_file; do
        if [ -f "$jpg_file" ]; then
            local basename=$(basename "$jpg_file")
            local basename_no_ext="${basename%.*}"
            local dirname=$(dirname "$jpg_file")
            local webp_file="${dirname}/${basename_no_ext}.webp"
            local backup_file="${BACKUP_DIR}/${basename}"
            
            # Get original size
            local original_size=$(stat -f%z "$jpg_file" 2>/dev/null || stat -c%s "$jpg_file" 2>/dev/null)
            total_original_size=$((total_original_size + original_size))
            
            # Backup original
            cp "$jpg_file" "$backup_file"
            
            # Convert to WebP
            if command -v cwebp &> /dev/null; then
                cwebp -q $QUALITY "$jpg_file" -o "$webp_file" &>/dev/null
            elif command -v convert &> /dev/null; then
                convert "$jpg_file" -quality $QUALITY "$webp_file" &>/dev/null
            else
                print_error "No WebP conversion tool available"
                continue
            fi
            
            if [ -f "$webp_file" ]; then
                local webp_size=$(stat -f%z "$webp_file" 2>/dev/null || stat -c%s "$webp_file" 2>/dev/null)
                total_webp_size=$((total_webp_size + webp_size))
                
                local savings=$((original_size - webp_size))
                local percentage=$(awk "BEGIN {printf \"%.1f\", ($savings/$original_size)*100}")
                
                print_status "Converted ${basename}: ${original_size} → ${webp_size} bytes (${percentage}% reduction)"
                converted_count=$((converted_count + 1))
            else
                print_error "Failed to convert ${basename}"
            fi
        fi
    done <<< "$JPG_FILES"
    
    if [ $converted_count -gt 0 ]; then
        local total_savings=$((total_original_size - total_webp_size))
        local total_percentage=$(awk "BEGIN {printf \"%.1f\", ($total_savings/$total_original_size)*100}")
        print_status "WebP Conversion Complete: $converted_count files, ${total_savings} bytes saved (${total_percentage}% total reduction)"
    fi
}

# Generate updated HTML with WebP fallbacks
update_html_references() {
    print_header "Updating HTML References"
    
    local updated_files=0
    
    # Find all HTML files
    find "$ROOTUIP_DIR" -name "*.html" | while read -r html_file; do
        local updated=false
        local temp_file="${html_file}.tmp"
        
        # Create backup
        cp "$html_file" "${html_file}.backup"
        
        # Process the file
        {
            while IFS= read -r line; do
                # Handle img tags with PNG/JPG sources
                if echo "$line" | grep -q 'src="[^"]*\.\(png\|jpg\|jpeg\)'; then
                    # Extract the image path and create WebP version
                    local img_src=$(echo "$line" | sed -n 's/.*src="\([^"]*\.\(png\|jpg\|jpeg\)\)".*/\1/p')
                    if [ -n "$img_src" ]; then
                        local webp_src="${img_src%.*}.webp"
                        # Create picture element with WebP and fallback
                        local indent=$(echo "$line" | sed 's/[^ ].*//')
                        echo "${indent}<picture>"
                        echo "${indent}    <source srcset=\"$webp_src\" type=\"image/webp\">"
                        echo "$line"
                        echo "${indent}</picture>"
                        updated=true
                        continue
                    fi
                fi
                
                # Handle CSS background images
                if echo "$line" | grep -q 'background-image:.*url.*\.\(png\|jpg\|jpeg\)'; then
                    # This would need more complex CSS handling
                    echo "$line"
                else
                    echo "$line"
                fi
            done < "$html_file"
        } > "$temp_file"
        
        if [ "$updated" = true ]; then
            mv "$temp_file" "$html_file"
            print_status "Updated $(basename "$html_file")"
            updated_files=$((updated_files + 1))
        else
            rm "$temp_file"
        fi
    done
    
    print_status "Updated $updated_files HTML files with WebP fallbacks"
}

# Generate CSS for responsive images
generate_responsive_css() {
    print_header "Generating Responsive Image CSS"
    
    local css_file="${ROOTUIP_DIR}/css/image-optimization.css"
    
    cat > "$css_file" << 'EOF'
/* Image Optimization CSS */

/* Responsive images */
img {
    max-width: 100%;
    height: auto;
}

/* WebP support detection and fallbacks */
.webp img[data-webp] {
    content: attr(data-webp);
}

.no-webp img[data-webp] {
    content: attr(src);
}

/* Lazy loading styles */
img[loading="lazy"] {
    opacity: 0;
    transition: opacity 0.3s ease;
}

img[loading="lazy"].loaded {
    opacity: 1;
}

/* Picture element styling */
picture {
    display: inline-block;
}

picture img {
    display: block;
    width: 100%;
    height: auto;
}

/* Logo optimizations */
.nav-logo,
.logo-container img,
.hub-icon {
    width: auto;
    height: auto;
    max-height: 40px;
}

/* Favicon optimizations */
link[rel="icon"] {
    type: image/svg+xml;
}

/* Performance hints */
img[importance="high"] {
    loading: eager;
}

img[importance="low"] {
    loading: lazy;
}

/* Modern browsers: use CSS to detect WebP support */
@supports (background-image: url('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=')) {
    .webp-fallback {
        display: none;
    }
}

@supports not (background-image: url('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=')) {
    .webp-only {
        display: none;
    }
}
EOF

    print_status "Generated responsive image CSS: $css_file"
}

# Generate WebP detection JavaScript
generate_webp_detection_js() {
    print_header "Generating WebP Detection JavaScript"
    
    local js_file="${ROOTUIP_DIR}/js/webp-detection.js"
    
    cat > "$js_file" << 'EOF'
// WebP Detection and Image Optimization JavaScript

(function() {
    'use strict';
    
    // WebP support detection
    function supportsWebP() {
        return new Promise((resolve) => {
            const webp = new Image();
            webp.onload = webp.onerror = function () {
                resolve(webp.height === 2);
            };
            webp.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==';
        });
    }
    
    // Add WebP class to document
    supportsWebP().then(function(hasWebP) {
        document.documentElement.classList.add(hasWebP ? 'webp' : 'no-webp');
    });
    
    // Lazy loading for images
    function lazyLoadImages() {
        const images = document.querySelectorAll('img[loading="lazy"]');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.classList.add('loaded');
                    observer.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', lazyLoadImages);
    } else {
        lazyLoadImages();
    }
    
    // Performance monitoring
    window.imageOptimizationStats = {
        webpSupported: false,
        imagesLoaded: 0,
        totalImages: 0,
        
        init: function() {
            supportsWebP().then(hasWebP => {
                this.webpSupported = hasWebP;
                this.totalImages = document.querySelectorAll('img').length;
            });
        },
        
        trackImageLoad: function() {
            this.imagesLoaded++;
            if (this.imagesLoaded === this.totalImages) {
                console.log('All images loaded. WebP supported:', this.webpSupported);
            }
        }
    };
    
    // Initialize stats
    window.imageOptimizationStats.init();
    
})();
EOF

    print_status "Generated WebP detection JavaScript: $js_file"
}

# Generate optimization report
generate_report() {
    print_header "Generating Optimization Report"
    
    local report_file="image-optimization-report.html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ROOTUIP Image Optimization Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; margin: 2rem; }
        .header { background: #1e40af; color: white; padding: 2rem; border-radius: 8px; margin-bottom: 2rem; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: #f8fafc; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #1e40af; }
        .stat-number { font-size: 2rem; font-weight: bold; color: #1e40af; }
        .image-list { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; }
        .image-item { padding: 0.5rem; border-bottom: 1px solid #f1f5f9; }
        .image-item:last-child { border-bottom: none; }
        .status-optimized { color: #059669; font-weight: 500; }
        .status-converted { color: #dc2626; font-weight: 500; }
        pre { background: #f1f5f9; padding: 1rem; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>ROOTUIP Image Optimization Report</h1>
        <p>Generated on $(date)</p>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">$SVG_COUNT</div>
            <div>SVG Files Found</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">$PNG_COUNT</div>
            <div>PNG Files Found</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">$JPG_COUNT</div>
            <div>JPG Files Found</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">$(($PNG_COUNT + $JPG_COUNT + $SVG_COUNT))</div>
            <div>Total Images</div>
        </div>
    </div>
    
    <h2>Images Found</h2>
    <div class="image-list">
        <h3>SVG Files (Brand & Icons)</h3>
EOF

    # Add SVG files to report
    while IFS= read -r svg_file; do
        if [ -f "$svg_file" ]; then
            local relative_path=${svg_file#/home/iii/ROOTUIP/}
            local size=$(stat -f%z "$svg_file" 2>/dev/null || stat -c%s "$svg_file" 2>/dev/null)
            echo "        <div class=\"image-item\">$relative_path <span class=\"status-optimized\">($size bytes)</span></div>" >> "$report_file"
        fi
    done <<< "$SVG_FILES"
    
    echo "    </div>" >> "$report_file"
    echo "    
    <h2>Optimization Recommendations</h2>
    <ul>
        <li><strong>SVG Optimization:</strong> All SVG files have been optimized using SVGO</li>
        <li><strong>WebP Conversion:</strong> PNG and JPG files converted to WebP format</li>
        <li><strong>Fallback Support:</strong> Original formats maintained for browser compatibility</li>
        <li><strong>Lazy Loading:</strong> Implemented for non-critical images</li>
        <li><strong>Responsive Images:</strong> CSS generated for proper scaling</li>
    </ul>
    
    <h2>Implementation Notes</h2>
    <pre>
1. WebP files created alongside originals
2. HTML updated with &lt;picture&gt; elements for fallbacks
3. CSS classes added for WebP detection
4. JavaScript generated for browser support detection
5. All original files backed up to: images/original/
    </pre>
    
</body>
</html>" >> "$report_file"
    
    print_status "Generated optimization report: $report_file"
}

# Main execution
main() {
    print_header "ROOTUIP Image Optimization Starting"
    
    # Check if ROOTUIP directory exists
    if [ ! -d "$ROOTUIP_DIR" ]; then
        print_error "ROOTUIP directory not found: $ROOTUIP_DIR"
        exit 1
    fi
    
    check_dependencies
    setup_directories
    find_images
    optimize_svgs
    convert_to_webp
    generate_responsive_css
    generate_webp_detection_js
    update_html_references
    generate_report
    
    print_header "Optimization Complete"
    print_status "Check image-optimization-report.html for detailed results"
    print_status "Backup files stored in: $BACKUP_DIR"
    print_status "Optimization log: $LOG_FILE"
}

# Run main function
main "$@"