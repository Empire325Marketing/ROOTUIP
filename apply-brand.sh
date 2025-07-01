#!/bin/bash

# ROOTUIP Brand Application Script
# Applies professional brand identity across all platform pages

set -e

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     ROOTUIP Brand Identity Update      ║${NC}"
echo -e "${BLUE}║   Enterprise Ocean Freight Platform    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Create brand assets directory structure
echo -e "${GREEN}Creating brand asset directories...${NC}"
mkdir -p assets/images/logos
mkdir -p assets/images/icons
mkdir -p assets/css
mkdir -p assets/fonts
mkdir -p assets/email-templates

# Copy brand files
echo -e "${GREEN}Copying brand assets...${NC}"
cp -f brand-guidelines.css assets/css/
cp -f brand-implementation.css assets/css/
cp -f logo-*.svg assets/images/logos/
cp -f favicon.svg assets/images/
cp -f social-media-*.svg assets/images/

# Update HTML files
echo -e "${GREEN}Updating HTML pages with new brand...${NC}"

# Function to update HTML files
update_html_file() {
    local file=$1
    echo -e "  Updating: ${file}"
    
    # Add brand CSS if not present
    if ! grep -q "brand-guidelines.css" "$file"; then
        sed -i '/<\/head>/i \    <link rel="stylesheet" href="/assets/css/brand-guidelines.css">' "$file"
        sed -i '/<\/head>/i \    <link rel="stylesheet" href="/assets/css/brand-implementation.css">' "$file"
    fi
    
    # Update favicon
    sed -i 's|<link rel="icon"[^>]*>|<link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml">|g' "$file"
    
    # Remove emoji and update text
    sed -i 's/🚢 //g' "$file"
    sed -i 's/Container Tracking Platform/Ocean Freight Intelligence Platform/g' "$file"
    sed -i 's/Track Your Containers/Stop Losing $14M Per Vessel/g' "$file"
    sed -i 's/ROOTUIP Platform/ROOTUIP/g' "$file"
    
    # Add viewport meta if missing
    if ! grep -q "viewport" "$file"; then
        sed -i '/<head>/a \    <meta name="viewport" content="width=device-width, initial-scale=1.0">' "$file"
    fi
}

# Find and update all HTML files
for file in $(find . -name "*.html" -not -path "./node_modules/*" -not -path "./dist/*" -not -path "./build/*"); do
    update_html_file "$file"
done

# Update JavaScript files
echo -e "${GREEN}Updating JavaScript files...${NC}"
for file in $(find . -name "*.js" -not -path "./node_modules/*" -not -path "./dist/*" -not -path "./build/*"); do
    echo -e "  Updating: ${file}"
    sed -i "s/console\.log('🚢/console.log('/g" "$file"
    sed -i 's/Container Tracking/Ocean Freight Intelligence/g' "$file"
done

# Create brand configuration file
echo -e "${GREEN}Creating brand configuration...${NC}"
cat > assets/brand-config.json << 'EOF'
{
  "name": "ROOTUIP",
  "tagline": "Stop Losing $14M Per Vessel",
  "description": "Ocean Freight Intelligence Platform",
  "value_proposition": "$500K+ Saved Per Vessel Annually",
  "colors": {
    "primary": "#0F3460",
    "secondary": "#00D46A",
    "accent": "#FF6B35",
    "dark": "#16213E",
    "light": "#E7F3FF"
  },
  "fonts": {
    "heading": "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "body": "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    "mono": "'Roboto Mono', 'SF Mono', 'Monaco', monospace"
  },
  "social": {
    "twitter": "@rootuip",
    "linkedin": "/company/rootuip",
    "website": "https://rootuip.com"
  }
}
EOF

# Update package.json with brand info
echo -e "${GREEN}Updating package.json...${NC}"
if [ -f "package.json" ]; then
    # Update description
    sed -i 's/"description": "[^"]*"/"description": "ROOTUIP - Ocean Freight Intelligence Platform | $500K+ Saved Per Vessel"/' package.json
fi

# Create brand usage documentation
echo -e "${GREEN}Creating brand documentation...${NC}"
cat > BRAND-USAGE.md << 'EOF'
# ROOTUIP Brand Usage Guidelines

## Core Message
**ROOTUIP** - Ocean Freight Intelligence Platform
**Value Proposition**: Stop Losing $14M Per Vessel

## Logo Usage
- Always maintain clear space around logo (minimum 40px)
- Never distort or rotate the logo
- Use SVG format for web, PNG for documents
- Minimum size: 120px width

## Color Application
- **Primary (#0F3460)**: Headers, CTAs, important UI elements
- **Success (#00D46A)**: Positive metrics, savings, CTAs
- **Accent (#FF6B35)**: Alerts, important data points
- **Neutrals**: Body text, backgrounds, borders

## Typography
- Headlines: Inter Bold/Semibold
- Body: System font stack
- Data: Roboto Mono

## Voice & Tone
- Professional and authoritative
- Focus on value and ROI
- Use concrete numbers ($500K, $14M)
- Emphasize enterprise capability

## Email Signatures
```
[Name]
[Title]
ROOTUIP | Ocean Freight Intelligence
Stop Losing $14M Per Vessel
[Email] | rootuip.com
```
EOF

# Create email signature template
echo -e "${GREEN}Creating email signature...${NC}"
cat > assets/email-templates/signature.html << 'EOF'
<table cellpadding="0" cellspacing="0" border="0" style="font-family: -apple-system, Arial, sans-serif;">
    <tr>
        <td style="padding-right: 20px; border-right: 2px solid #0F3460;">
            <img src="https://rootuip.com/assets/images/logos/logo-icon.svg" width="60" height="60" alt="ROOTUIP">
        </td>
        <td style="padding-left: 20px;">
            <div style="color: #0F3460; font-weight: 600; font-size: 16px;">{{NAME}}</div>
            <div style="color: #64748b; font-size: 14px; margin: 4px 0;">{{TITLE}}</div>
            <div style="color: #0F3460; font-weight: 600; font-size: 14px; margin: 8px 0;">ROOTUIP</div>
            <div style="color: #00D46A; font-size: 12px;">Stop Losing $14M Per Vessel</div>
            <div style="color: #64748b; font-size: 12px; margin-top: 8px;">
                {{EMAIL}} | <a href="https://rootuip.com" style="color: #0F3460;">rootuip.com</a>
            </div>
        </td>
    </tr>
</table>
EOF

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║      Brand Update Complete! ✓          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Updated Files:${NC}"
echo "  • $(find . -name "*.html" -not -path "./node_modules/*" | wc -l) HTML pages"
echo "  • $(find . -name "*.js" -not -path "./node_modules/*" | wc -l) JavaScript files"
echo "  • Brand assets in /assets/"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Review brand-showcase.html in browser"
echo "  2. Test responsive design on mobile"
echo "  3. Update social media profiles"
echo "  4. Configure email templates"
echo ""
echo -e "${YELLOW}Remember:${NC} Always emphasize '$500K per vessel' value proposition!"