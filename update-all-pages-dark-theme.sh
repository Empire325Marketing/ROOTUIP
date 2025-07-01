#!/bin/bash

# Script to update all pages with the new dark theme

echo "🎨 Updating all ROOTUIP pages with modern dark theme..."

# Create a dark theme CSS file that can be included
cat > /home/iii/ROOTUIP/assets/css/rootuip-dark-theme.css << 'EOF'
/* ROOTUIP Dark Theme Design System */
:root {
    /* Modern color palette */
    --primary: #0A0E27;
    --primary-light: #161B3D;
    --accent: #6366F1;
    --accent-bright: #818CF8;
    --accent-glow: #6366F120;
    --success: #10B981;
    --warning: #F59E0B;
    --danger: #EF4444;
    --text-primary: #F9FAFB;
    --text-secondary: #9CA3AF;
    --text-muted: #6B7280;
    --bg-dark: #030712;
    --bg-card: #111827;
    --bg-hover: #1F2937;
    --border: #374151;
    --gradient-primary: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
    --gradient-dark: linear-gradient(180deg, #0A0E27 0%, #030712 100%);
    --gradient-card: linear-gradient(135deg, #111827 0%, #1F2937 100%);
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
    --shadow-glow: 0 0 50px rgba(99, 102, 241, 0.3);
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background-color: var(--bg-dark);
    color: var(--text-primary);
    line-height: 1.6;
}

/* Navigation */
.navbar, nav, header {
    background: rgba(10, 14, 39, 0.8) !important;
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
}

/* Cards and Containers */
.card, .panel, .box, .container-box {
    background: var(--gradient-card) !important;
    border: 1px solid var(--border) !important;
    color: var(--text-primary) !important;
}

/* Buttons */
.btn, button {
    transition: all 0.2s;
}

.btn-primary, button[type="submit"] {
    background: var(--gradient-primary) !important;
    color: white !important;
    border: none !important;
    box-shadow: 0 4px 14px 0 rgba(99, 102, 241, 0.4);
}

.btn-primary:hover, button[type="submit"]:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px 0 rgba(99, 102, 241, 0.6);
}

/* Forms */
input, textarea, select {
    background: var(--bg-dark) !important;
    border: 1px solid var(--border) !important;
    color: var(--text-primary) !important;
}

input:focus, textarea:focus, select:focus {
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 3px var(--accent-glow) !important;
    outline: none !important;
}

/* Text Colors */
h1, h2, h3, h4, h5, h6 {
    color: var(--text-primary) !important;
}

p, span, div {
    color: var(--text-primary);
}

a {
    color: var(--accent);
    transition: color 0.2s;
}

a:hover {
    color: var(--accent-bright);
}

/* Tables */
table {
    background: var(--bg-card) !important;
}

th {
    background: var(--primary-light) !important;
    color: var(--text-primary) !important;
}

td {
    border-color: var(--border) !important;
    color: var(--text-primary) !important;
}

tr:hover {
    background: var(--bg-hover) !important;
}

/* Modals */
.modal-content {
    background: var(--bg-card) !important;
    border: 1px solid var(--border) !important;
}

/* Override any white backgrounds */
.bg-white, .background-white {
    background: var(--bg-card) !important;
}

.bg-light, .bg-gray-50 {
    background: var(--primary-light) !important;
}

/* Dashboard specific */
.dashboard-card {
    background: var(--gradient-card) !important;
    border: 1px solid var(--border) !important;
    transition: all 0.3s;
}

.dashboard-card:hover {
    transform: translateY(-4px);
    border-color: var(--accent);
    box-shadow: var(--shadow-glow);
}

/* Charts */
.chart-container {
    background: var(--bg-card) !important;
    border: 1px solid var(--border) !important;
    border-radius: 0.5rem;
    padding: 1rem;
}

/* Animations */
@keyframes glow {
    0% { box-shadow: 0 0 5px var(--accent); }
    50% { box-shadow: 0 0 20px var(--accent), 0 0 30px var(--accent-glow); }
    100% { box-shadow: 0 0 5px var(--accent); }
}

.glow {
    animation: glow 2s ease-in-out infinite;
}

/* Gradients */
.gradient-primary {
    background: var(--gradient-primary) !important;
}

.gradient-dark {
    background: var(--gradient-dark) !important;
}

/* Remove any forced white text on dark backgrounds */
.text-white {
    color: var(--text-primary) !important;
}

.text-black, .text-dark {
    color: var(--text-primary) !important;
}
EOF

# Function to add dark theme to HTML files
update_html_file() {
    local file=$1
    echo "Updating: $file"
    
    # Check if file exists
    if [ ! -f "$file" ]; then
        echo "File not found: $file"
        return
    fi
    
    # Add dark theme CSS link after existing stylesheets
    sed -i '/<\/head>/i\    <link rel="stylesheet" href="/assets/css/rootuip-dark-theme.css">' "$file"
    
    # Update body background if it has inline styles
    sed -i 's/background-color:[[:space:]]*#fff/background-color: var(--bg-dark)/g' "$file"
    sed -i 's/background-color:[[:space:]]*white/background-color: var(--bg-dark)/g' "$file"
    sed -i 's/background:[[:space:]]*#fff/background: var(--bg-dark)/g' "$file"
    sed -i 's/background:[[:space:]]*white/background: var(--bg-dark)/g' "$file"
    
    # Update text colors
    sed -i 's/color:[[:space:]]*#000/color: var(--text-primary)/g' "$file"
    sed -i 's/color:[[:space:]]*black/color: var(--text-primary)/g' "$file"
}

# Update all HTML files
echo "🔍 Finding all HTML files..."
find /home/iii/ROOTUIP -name "*.html" -type f | while read -r file; do
    # Skip already updated files and backups
    if ! grep -q "rootuip-dark-theme.css" "$file" 2>/dev/null; then
        update_html_file "$file"
    else
        echo "Already updated: $file"
    fi
done

echo "✅ Dark theme update complete!"
echo ""
echo "📋 Next steps:"
echo "1. Deploy the CSS file to VPS: scp /home/iii/ROOTUIP/assets/css/rootuip-dark-theme.css root@145.223.73.4:/root/ROOTUIP/assets/css/"
echo "2. Deploy updated HTML files to VPS"
echo "3. Clear browser cache and test"