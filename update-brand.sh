#!/bin/bash

# UIP Brand Update Script
# Updates all HTML files with new brand identity

echo "🎨 Starting UIP Brand Update..."

# Define brand colors
PRIMARY_COLOR="#1e40af"
PRIMARY_LIGHT="#3b82f6"
SUCCESS_COLOR="#10b981"
WARNING_COLOR="#f59e0b"
GRAY_50="#f8fafc"
GRAY_200="#e2e8f0"
GRAY_500="#64748b"
GRAY_800="#1e293b"
GRAY_900="#0f172a"

# Create brand CSS to inject
BRAND_CSS='<style>
:root {
    --uip-primary: #1e40af;
    --uip-primary-dark: #1e3a8a;
    --uip-primary-light: #3b82f6;
    --uip-success: #10b981;
    --uip-warning: #f59e0b;
    --uip-gray-50: #f8fafc;
    --uip-gray-200: #e2e8f0;
    --uip-gray-500: #64748b;
    --uip-gray-800: #1e293b;
    --uip-gray-900: #0f172a;
    --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    --font-mono: "JetBrains Mono", Consolas, Monaco, monospace;
}
</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">'

# Function to update HTML file
update_html_file() {
    local file=$1
    echo "Updating: $file"
    
    # Create temp file
    temp_file="${file}.tmp"
    
    # Replace ship emoji with logo reference
    sed -i 's/🚢/<img src="\/brand\/logo-icon.svg" alt="UIP" style="height: 24px; width: 24px; vertical-align: middle;">/g' "$file"
    
    # Update favicon
    sed -i '/<head>/,/<\/head>/ s|<link rel="icon"[^>]*>|<link rel="icon" type="image/svg+xml" href="/brand/logo-icon.svg">|g' "$file"
    
    # If no favicon exists, add one after <head>
    if ! grep -q '<link rel="icon"' "$file"; then
        sed -i '/<head>/a\    <link rel="icon" type="image/svg+xml" href="/brand/logo-icon.svg">' "$file"
    fi
    
    # Update color values
    sed -i "s/#0a0f1c/$GRAY_900/g" "$file"
    sed -i "s/#111827/$GRAY_800/g" "$file"
    sed -i "s/#1f2937/$GRAY_800/g" "$file"
    sed -i "s/#374151/$GRAY_500/g" "$file"
    sed -i "s/#4b5563/$GRAY_500/g" "$file"
    sed -i "s/#6b7280/$GRAY_500/g" "$file"
    sed -i "s/#9ca3af/$GRAY_500/g" "$file"
    sed -i "s/#d1d5db/$GRAY_200/g" "$file"
    sed -i "s/#e5e7eb/$GRAY_200/g" "$file"
    sed -i "s/#f3f4f6/$GRAY_50/g" "$file"
    sed -i "s/#f9fafb/$GRAY_50/g" "$file"
    
    # Update blue colors to brand blue
    sed -i "s/#3b82f6/$PRIMARY_LIGHT/g" "$file"
    sed -i "s/#2563eb/$PRIMARY_COLOR/g" "$file"
    sed -i "s/#1d4ed8/$PRIMARY_COLOR/g" "$file"
    sed -i "s/#60a5fa/$PRIMARY_LIGHT/g" "$file"
    
    # Update green colors to brand green
    sed -i "s/#10b981/$SUCCESS_COLOR/g" "$file"
    sed -i "s/#22c55e/$SUCCESS_COLOR/g" "$file"
    sed -i "s/#16a34a/$SUCCESS_COLOR/g" "$file"
    
    # Update orange colors to brand orange
    sed -i "s/#f59e0b/$WARNING_COLOR/g" "$file"
    sed -i "s/#fb923c/$WARNING_COLOR/g" "$file"
    
    # Update font families
    sed -i "s/font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;/font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;/g" "$file"
    sed -i "s/font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;/font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;/g" "$file"
    
    # Add Inter font import if not present
    if ! grep -q "fonts.googleapis.com/css2?family=Inter" "$file"; then
        sed -i '/<\/head>/i\    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">' "$file"
    fi
    
    echo "✓ Updated $file"
}

# Find all HTML files and update them
echo "Finding all HTML files..."
find /home/iii/ROOTUIP -name "*.html" -type f | while read -r file; do
    # Skip brand guidelines and generator files
    if [[ ! "$file" =~ "brand-guidelines.html" ]] && [[ ! "$file" =~ "generate-assets.html" ]]; then
        update_html_file "$file"
    fi
done

# Create a simple favicon.ico redirect
cat > /home/iii/ROOTUIP/favicon.ico << 'EOF'
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="6" fill="#1e40af"/>
  <path d="M6 8v12c0 3.3 2.7 6 6 6h8c3.3 0 6-2.7 6-6V8" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
  <circle cx="16" cy="4" r="2" fill="white"/>
  <circle cx="6" cy="8" r="1.5" fill="white"/>
  <circle cx="26" cy="8" r="1.5" fill="white"/>
  <circle cx="16" cy="20" r="1.5" fill="white"/>
</svg>
EOF

echo ""
echo "✅ Brand update complete!"
echo ""
echo "Summary:"
echo "- Updated all HTML files with new colors"
echo "- Replaced ship emojis with logo references"
echo "- Added favicon links"
echo "- Updated font families to Inter"
echo "- Applied consistent color scheme"
echo ""
echo "Next steps:"
echo "1. Generate PNG assets using brand/generate-assets.html"
echo "2. Deploy updated files to VPS"
echo "3. Test all pages for visual consistency"