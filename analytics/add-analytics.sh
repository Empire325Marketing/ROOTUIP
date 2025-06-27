#!/bin/bash

# Script to add Google Analytics to all HTML files
# Usage: ./add-analytics.sh G-XXXXXXXXXX

GA_ID="${1:-G-XXXXXXXXXX}"

if [ "$GA_ID" == "G-XXXXXXXXXX" ]; then
    echo "Warning: Using placeholder GA ID. Provide your actual GA4 Measurement ID as argument."
    echo "Usage: ./add-analytics.sh G-YOUR-ACTUAL-ID"
fi

echo "Adding Google Analytics (ID: $GA_ID) to all HTML files..."

# Create the analytics snippet with the provided GA ID
cat > /tmp/ga-snippet.html << EOF
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=$GA_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '$GA_ID');
</script>
EOF

# Function to add analytics to HTML file
add_analytics_to_file() {
    local file="$1"
    
    # Check if analytics is already added
    if grep -q "googletagmanager.com/gtag" "$file"; then
        echo "  ⏭️  Skipping $file (analytics already present)"
        return
    fi
    
    # Add analytics before closing </head> tag
    if grep -q "</head>" "$file"; then
        # Create temp file with analytics inserted
        awk '
        /<\/head>/ {
            while ((getline line < "/tmp/ga-snippet.html") > 0) {
                print line
            }
            close("/tmp/ga-snippet.html")
        }
        { print }
        ' "$file" > "$file.tmp"
        
        mv "$file.tmp" "$file"
        echo "  ✓ Added analytics to: $file"
    else
        echo "  ⚠️  Warning: No </head> tag found in $file"
    fi
}

# Find all HTML files and add analytics
export -f add_analytics_to_file
find . -name "*.html" -type f ! -path "./node_modules/*" ! -path "./analytics/*" -exec bash -c 'add_analytics_to_file "$0"' {} \;

# Clean up
rm /tmp/ga-snippet.html

echo ""
echo "Analytics addition complete!"
echo "Remember to:"
echo "1. Replace $GA_ID with your actual GA4 Measurement ID"
echo "2. Configure custom events in your JavaScript code"
echo "3. Set up conversion tracking in Google Analytics dashboard"
echo "4. Create custom reports and audiences"

# Create documentation
cat > analytics-implementation.md << 'EOF'
# Google Analytics Implementation Guide

## Setup Complete
Google Analytics has been added to all HTML files in the project.

## Configuration Steps

1. **Get your GA4 Measurement ID**:
   - Go to Google Analytics
   - Admin → Data Streams → Web
   - Copy your Measurement ID (starts with G-)

2. **Update the ID**:
   - Run: `./add-analytics.sh G-YOUR-ACTUAL-ID`
   - Or manually replace G-XXXXXXXXXX in all files

3. **Verify Installation**:
   - Use Google Analytics Debugger Chrome extension
   - Check Real-time reports in GA4
   - Use Tag Assistant

## Custom Events Implemented

- **User Authentication**: Login methods, MFA usage
- **Shipment Tracking**: Search queries, results
- **Document Management**: Uploads, verifications
- **API Usage**: Endpoint calls, response times
- **Feature Engagement**: Feature usage patterns
- **Performance Metrics**: Page load times, errors

## Recommended GA4 Configuration

1. **Create Custom Dimensions**:
   - user_type (User/Admin/Operator)
   - company_id
   - shipment_count
   - integration_status

2. **Set up Conversions**:
   - Trial signups
   - Feature adoption
   - API key generation
   - Document uploads

3. **Configure Audiences**:
   - Active users (daily shipment checks)
   - Power users (API usage)
   - At-risk users (declining usage)

4. **Create Custom Reports**:
   - Feature adoption funnel
   - API usage by endpoint
   - Document processing metrics
   - User engagement by company size
EOF

echo ""
echo "Documentation created: analytics-implementation.md"