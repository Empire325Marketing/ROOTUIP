#!/bin/bash
# Generate PWA icons locally

# Create base SVG icon
cat > /home/iii/ROOTUIP/assets/icons/rootuip-icon.svg << 'EOF'
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

cd /home/iii/ROOTUIP/assets/icons

# Generate various sizes
convert -background transparent rootuip-icon.svg -resize 192x192 icon-192x192.png
convert -background transparent rootuip-icon.svg -resize 512x512 icon-512x512.png
convert -background transparent rootuip-icon.svg -resize 180x180 apple-touch-icon.png
convert -background transparent rootuip-icon.svg -resize 32x32 favicon-32x32.png
convert -background transparent rootuip-icon.svg -resize 16x16 favicon-16x16.png
convert -background transparent rootuip-icon.svg -resize 96x96 track-icon.png
convert -background transparent rootuip-icon.svg -resize 96x96 booking-icon.png
convert -background transparent rootuip-icon.svg -resize 96x96 reports-icon.png

# Generate maskable icon with padding
convert -background white rootuip-icon.svg -resize 432x432 -gravity center -extent 512x512 icon-maskable.png

# Generate badge icon
convert -background transparent rootuip-icon.svg -resize 72x72 badge-72x72.png

echo "Icons generated successfully!"