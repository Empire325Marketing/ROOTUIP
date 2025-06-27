#!/bin/bash

# PWA Package Extraction Script
# Run this on the server after copying pwa-deployment-package.tar.gz

PACKAGE_FILE="pwa-deployment-package.tar.gz"
EXTRACT_DIR="/var/www/html"

echo "Extracting PWA deployment package..."

# Check if package exists
if [ ! -f "$PACKAGE_FILE" ]; then
    echo "Error: $PACKAGE_FILE not found!"
    echo "Please copy the package to the current directory first."
    exit 1
fi

# Extract the package to the web root
echo "Extracting files to $EXTRACT_DIR..."
tar -xzf $PACKAGE_FILE -C $EXTRACT_DIR

# Set proper permissions
echo "Setting permissions..."
find $EXTRACT_DIR/platform -type f -name "*.js" -exec chmod 644 {} \;
find $EXTRACT_DIR/platform -type f -name "*.html" -exec chmod 644 {} \;
find $EXTRACT_DIR/platform -type f -name "*.json" -exec chmod 644 {} \;
find $EXTRACT_DIR/platform -type f -name "*.css" -exec chmod 644 {} \;
find $EXTRACT_DIR/assets/icons -type f \( -name "*.png" -o -name "*.svg" \) -exec chmod 644 {} \;

# Ensure directories have proper permissions
find $EXTRACT_DIR/platform -type d -exec chmod 755 {} \;
find $EXTRACT_DIR/assets -type d -exec chmod 755 {} \;

echo "PWA deployment extraction completed!"
echo ""
echo "Files deployed:"
echo "- Platform files in: $EXTRACT_DIR/platform/"
echo "- Icons in: $EXTRACT_DIR/assets/icons/"