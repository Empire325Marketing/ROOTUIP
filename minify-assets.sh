#!/bin/bash

# Minify JavaScript and CSS files for ROOTUIP

echo "Starting asset minification..."

# Create minified directory structure
mkdir -p minified/js minified/css

# Function to minify JavaScript
minify_js() {
    local input="$1"
    local output="$2"
    
    # Simple minification: remove comments and excess whitespace
    sed -e 's|//.*||g' \
        -e 's|/\*[^*]*\*\+\([^/*][^*]*\*\+\)*/||g' \
        -e 's|\s\+| |g' \
        -e 's|^ ||' \
        -e 's| $||' \
        -e '/^$/d' \
        "$input" | tr -d '\n' > "$output"
}

# Function to minify CSS
minify_css() {
    local input="$1"
    local output="$2"
    
    # Simple minification: remove comments and excess whitespace
    sed -e 's|/\*[^*]*\*\+\([^/*][^*]*\*\+\)*/||g' \
        -e 's|\s\+| |g' \
        -e 's|^ ||' \
        -e 's| $||' \
        -e 's|: |:|g' \
        -e 's|; |;|g' \
        -e 's| {|{|g' \
        -e 's|} |}|g' \
        -e '/^$/d' \
        "$input" | tr -d '\n' > "$output"
}

# Minify JavaScript files
echo "Minifying JavaScript files..."
for file in js/*.js; do
    if [[ -f "$file" && ! "$file" =~ \.min\.js$ ]]; then
        filename=$(basename "$file" .js)
        minify_js "$file" "minified/js/${filename}.min.js"
        echo "  ✓ Minified: $file → minified/js/${filename}.min.js"
    fi
done

# Minify CSS files
echo "Minifying CSS files..."
for file in css/*.css; do
    if [[ -f "$file" && ! "$file" =~ \.min\.css$ ]]; then
        filename=$(basename "$file" .css)
        minify_css "$file" "minified/css/${filename}.min.css"
        echo "  ✓ Minified: $file → minified/css/${filename}.min.css"
    fi
done

# Count savings
original_js_size=$(du -ch js/*.js 2>/dev/null | grep total | awk '{print $1}')
minified_js_size=$(du -ch minified/js/*.min.js 2>/dev/null | grep total | awk '{print $1}')
original_css_size=$(du -ch css/*.css 2>/dev/null | grep total | awk '{print $1}')
minified_css_size=$(du -ch minified/css/*.min.css 2>/dev/null | grep total | awk '{print $1}')

echo ""
echo "Minification complete!"
echo "JavaScript: $original_js_size → $minified_js_size"
echo "CSS: $original_css_size → $minified_css_size"

# Create deployment script
cat > deploy-minified.sh << 'EOF'
#!/bin/bash
# Deploy minified assets
echo "Deploying minified assets..."

# Backup original files
cp -r js js.backup
cp -r css css.backup

# Copy minified files over originals
cp minified/js/*.min.js js/
cp minified/css/*.min.css css/

# Update HTML files to use minified versions
find . -name "*.html" -type f -exec sed -i 's/\.js"/\.min.js"/g' {} \;
find . -name "*.html" -type f -exec sed -i 's/\.css"/\.min.css"/g' {} \;

echo "Deployment complete!"
EOF

chmod +x deploy-minified.sh

echo ""
echo "To deploy minified assets, run: ./deploy-minified.sh"