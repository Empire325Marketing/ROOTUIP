#!/bin/bash

# Update all HTML files to include logo component script
echo "Adding logo component script to all HTML files..."

# Function to add logo script after title tag
add_logo_script() {
    file=$1
    echo "Processing: $file"
    
    # Check if logo-component.js is already included
    if grep -q "logo-component.js" "$file"; then
        echo "  - Already has logo component"
    else
        # Add after title tag
        sed -i '/<title>/a\    <link rel="icon" type="image/svg+xml" href="/brand/logo-icon.svg">\n    <script src="/js/logo-component.js"></script>' "$file"
        echo "  - Added logo component"
    fi
}

# Platform files
add_logo_script "platform/containers.html"
add_logo_script "platform/dd-center.html"

# Investor relations files
add_logo_script "investor-relations/index.html"
add_logo_script "investor-relations/executive-summary.html"
add_logo_script "investor-relations/financial-model.html"
add_logo_script "investor-relations/unit-economics.html"
add_logo_script "investor-relations/market-analysis.html"
add_logo_script "investor-relations/competitive-analysis.html"
add_logo_script "investor-relations/product-roadmap.html"
add_logo_script "investor-relations/management-team.html"

# Sales toolkit files
add_logo_script "sales-toolkit.html"
add_logo_script "roi-calculator.html"
add_logo_script "interactive-demo.html"
add_logo_script "presentation-deck.html"
add_logo_script "presentation-suite-v2.html"

# Sales toolkit subpages
add_logo_script "sales-toolkit/case-study-template.html"
add_logo_script "sales-toolkit/competitive-battle-cards.html"
add_logo_script "sales-toolkit/discovery-questions.html"
add_logo_script "sales-toolkit/implementation-timeline.html"
add_logo_script "sales-toolkit/one-page-overview.html"
add_logo_script "sales-toolkit/pricing-proposal-template.html"
add_logo_script "sales-toolkit/roi-calculator-worksheet.html"
add_logo_script "sales-toolkit/technical-specifications.html"

# Main pages
add_logo_script "index.html"
add_logo_script "sitemap.html"
add_logo_script "domain-index.html"

echo "Logo update complete!"