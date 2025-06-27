#!/bin/bash
# Generate PWA icons from SVG

# Create icons directory
mkdir -p /var/www/html/assets/icons

# Create base SVG icon
cat > /tmp/rootuip-icon.svg << 'EOF'
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="108" fill="url(#gradient)"/>
  <text x="256" y="320" font-family="Arial, sans-serif" font-size="220" font-weight="bold" text-anchor="middle" fill="white">UI</text>
  <defs>
    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
</svg>
EOF

# Convert SVG to PNG using ImageMagick or rsvg-convert
if command -v convert &> /dev/null; then
    # Generate various sizes
    convert -background transparent /tmp/rootuip-icon.svg -resize 192x192 /var/www/html/assets/icons/icon-192x192.png
    convert -background transparent /tmp/rootuip-icon.svg -resize 512x512 /var/www/html/assets/icons/icon-512x512.png
    convert -background transparent /tmp/rootuip-icon.svg -resize 180x180 /var/www/html/assets/icons/apple-touch-icon.png
    convert -background transparent /tmp/rootuip-icon.svg -resize 32x32 /var/www/html/assets/icons/favicon-32x32.png
    convert -background transparent /tmp/rootuip-icon.svg -resize 16x16 /var/www/html/assets/icons/favicon-16x16.png
    
    # Generate maskable icon with padding
    convert -background white /tmp/rootuip-icon.svg -resize 432x432 -gravity center -extent 512x512 /var/www/html/assets/icons/icon-maskable.png
    
    # Generate badge icon
    convert -background transparent /tmp/rootuip-icon.svg -resize 72x72 /var/www/html/assets/icons/badge-72x72.png
    
    echo "Icons generated successfully using ImageMagick"
elif command -v rsvg-convert &> /dev/null; then
    # Use rsvg-convert as fallback
    rsvg-convert -w 192 -h 192 /tmp/rootuip-icon.svg -o /var/www/html/assets/icons/icon-192x192.png
    rsvg-convert -w 512 -h 512 /tmp/rootuip-icon.svg -o /var/www/html/assets/icons/icon-512x512.png
    rsvg-convert -w 180 -h 180 /tmp/rootuip-icon.svg -o /var/www/html/assets/icons/apple-touch-icon.png
    rsvg-convert -w 32 -h 32 /tmp/rootuip-icon.svg -o /var/www/html/assets/icons/favicon-32x32.png
    rsvg-convert -w 16 -h 16 /tmp/rootuip-icon.svg -o /var/www/html/assets/icons/favicon-16x16.png
    
    echo "Icons generated successfully using rsvg-convert"
else
    echo "Neither ImageMagick nor rsvg-convert found. Creating placeholder icons..."
    
    # Create placeholder PNG files
    for size in 16 32 72 180 192 512; do
        touch /var/www/html/assets/icons/icon-${size}x${size}.png
    done
    touch /var/www/html/assets/icons/apple-touch-icon.png
    touch /var/www/html/assets/icons/favicon-32x32.png
    touch /var/www/html/assets/icons/favicon-16x16.png
    touch /var/www/html/assets/icons/badge-72x72.png
    touch /var/www/html/assets/icons/icon-maskable.png
fi

# Copy favicon to root
cp /var/www/html/assets/icons/favicon-32x32.png /var/www/html/favicon.png

# Create screenshots directory
mkdir -p /var/www/html/assets/screenshots

# Clean up
rm -f /tmp/rootuip-icon.svg

echo "PWA icon setup complete!"