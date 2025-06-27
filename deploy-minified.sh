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
