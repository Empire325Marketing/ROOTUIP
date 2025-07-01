// ROOTUIP Brand Application Script
// Applies brand identity across all platform pages

const fs = require('fs').promises;
const path = require('path');

class BrandApplication {
    constructor() {
        this.brandConfig = {
            // Text replacements
            replacements: {
                '🚢': '', // Remove emoji
                'ROOTUIP Platform': 'ROOTUIP',
                'Container Tracking Platform': 'Ocean Freight Intelligence Platform',
                'Track Your Containers': 'Stop Losing $14M Per Vessel'
            },
            
            // Header configuration
            headerHTML: `
                <header class="rootuip-header">
                    <div class="container">
                        <div class="header-content">
                            <div class="logo-section">
                                <svg class="logo" width="160" height="40" viewBox="0 0 160 40">
                                    <defs>
                                        <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" style="stop-color:#0F3460;stop-opacity:1" />
                                            <stop offset="100%" style="stop-color:#16213E;stop-opacity:1" />
                                        </linearGradient>
                                    </defs>
                                    <path d="M5 20 Q 10 10, 20 20 T 40 20 L 40 35 L 5 35 Z" fill="url(#waveGradient)"/>
                                    <rect x="15" y="15" width="10" height="15" fill="#FF6B35" rx="1"/>
                                    <text x="50" y="26" font-family="Inter, sans-serif" font-size="20" font-weight="700" fill="#0F3460">ROOTUIP</text>
                                </svg>
                                <span class="tagline">Stop Losing $14M Per Vessel</span>
                            </div>
                            <nav class="main-nav">
                                <a href="/dashboard">Dashboard</a>
                                <a href="/tracking">Tracking</a>
                                <a href="/analytics">Analytics</a>
                                <a href="/alerts">Alerts</a>
                            </nav>
                        </div>
                    </div>
                </header>
            `,
            
            // Footer configuration
            footerHTML: `
                <footer class="rootuip-footer">
                    <div class="container">
                        <div class="footer-content">
                            <div class="footer-brand">
                                <svg class="footer-logo" width="120" height="30" viewBox="0 0 120 30">
                                    <path d="M5 15 Q 10 7.5, 20 15 T 40 15 L 40 25 L 5 25 Z" fill="#0F3460" opacity="0.8"/>
                                    <rect x="15" y="10" width="10" height="12" fill="#00D46A" rx="1"/>
                                    <text x="45" y="20" font-family="Inter, sans-serif" font-size="16" font-weight="600" fill="#0F3460">ROOTUIP</text>
                                </svg>
                                <p class="footer-tagline">Ocean Freight Intelligence Platform</p>
                                <p class="footer-value">$500K+ Saved Per Vessel Annually</p>
                            </div>
                            <div class="footer-links">
                                <div class="footer-column">
                                    <h4>Platform</h4>
                                    <a href="/features">Features</a>
                                    <a href="/pricing">Pricing</a>
                                    <a href="/api">API</a>
                                </div>
                                <div class="footer-column">
                                    <h4>Company</h4>
                                    <a href="/about">About</a>
                                    <a href="/contact">Contact</a>
                                    <a href="/careers">Careers</a>
                                </div>
                                <div class="footer-column">
                                    <h4>Resources</h4>
                                    <a href="/docs">Documentation</a>
                                    <a href="/roi-calculator">ROI Calculator</a>
                                    <a href="/case-studies">Case Studies</a>
                                </div>
                            </div>
                        </div>
                        <div class="footer-bottom">
                            <p>&copy; 2024 ROOTUIP. Enterprise Ocean Freight Intelligence.</p>
                        </div>
                    </div>
                </footer>
            `,
            
            // Email template
            emailTemplate: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f7fa; }
                        .email-container { max-width: 600px; margin: 0 auto; background: white; }
                        .email-header { background: linear-gradient(135deg, #0F3460 0%, #16213E 100%); padding: 40px; text-align: center; }
                        .email-logo { color: white; font-size: 24px; font-weight: 700; margin: 0; }
                        .email-tagline { color: #00D46A; font-size: 14px; margin-top: 10px; }
                        .email-content { padding: 40px; }
                        .email-footer { background: #f5f7fa; padding: 30px; text-align: center; font-size: 14px; color: #64748b; }
                        .btn-primary { display: inline-block; padding: 12px 24px; background: #00D46A; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; }
                        .metric-box { background: #f8fafc; border-left: 4px solid #FF6B35; padding: 20px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="email-container">
                        <div class="email-header">
                            <h1 class="email-logo">ROOTUIP</h1>
                            <p class="email-tagline">Stop Losing $14M Per Vessel</p>
                        </div>
                        <div class="email-content">
                            {{CONTENT}}
                        </div>
                        <div class="email-footer">
                            <p>ROOTUIP - Ocean Freight Intelligence Platform</p>
                            <p>Enterprise Solution • $500K+ Saved Per Vessel</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            
            // Component styles
            componentStyles: `
                /* Value Proposition Badge */
                .value-badge {
                    display: inline-flex;
                    align-items: center;
                    background: linear-gradient(135deg, #FF6B35 0%, #FF8E53 100%);
                    color: white;
                    padding: 8px 16px;
                    border-radius: 24px;
                    font-weight: 600;
                    font-size: 14px;
                    box-shadow: 0 2px 8px rgba(255, 107, 53, 0.25);
                }
                
                /* Enterprise Metric Card */
                .metric-card {
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 2px 8px rgba(15, 52, 96, 0.08);
                    border-top: 4px solid var(--color-primary);
                }
                
                .metric-card-value {
                    font-size: 36px;
                    font-weight: 700;
                    color: var(--color-primary);
                    margin: 8px 0;
                }
                
                .metric-card-label {
                    color: var(--color-text-secondary);
                    font-size: 14px;
                    font-weight: 500;
                }
                
                /* Trust Indicators */
                .trust-indicators {
                    display: flex;
                    gap: 32px;
                    padding: 24px 0;
                    border-top: 1px solid var(--color-border);
                }
                
                .trust-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                
                .trust-icon {
                    width: 40px;
                    height: 40px;
                    background: var(--color-background-secondary);
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-success);
                }
                
                /* Enterprise CTA */
                .enterprise-cta {
                    background: linear-gradient(135deg, #0F3460 0%, #16213E 100%);
                    padding: 48px;
                    border-radius: 16px;
                    text-align: center;
                    position: relative;
                    overflow: hidden;
                }
                
                .enterprise-cta::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    right: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(0, 212, 106, 0.1) 0%, transparent 70%);
                    animation: pulse 4s ease-in-out infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 0.5; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                }
                
                .enterprise-cta h2 {
                    color: white;
                    font-size: 32px;
                    margin-bottom: 16px;
                    position: relative;
                }
                
                .enterprise-cta .value-highlight {
                    color: var(--color-success);
                    font-size: 48px;
                    font-weight: 700;
                }
            `
        };
    }
    
    async applyBrandToFile(filePath) {
        try {
            let content = await fs.readFile(filePath, 'utf8');
            
            // Apply text replacements
            for (const [oldText, newText] of Object.entries(this.brandConfig.replacements)) {
                content = content.replace(new RegExp(oldText, 'g'), newText);
            }
            
            // Update HTML files
            if (filePath.endsWith('.html')) {
                // Add brand CSS
                if (!content.includes('brand-guidelines.css')) {
                    content = content.replace('</head>', 
                        `    <link rel="stylesheet" href="/assets/css/brand-guidelines.css">\n</head>`);
                }
                
                // Update favicon
                content = content.replace(
                    /<link rel="icon"[^>]*>/g,
                    '<link rel="icon" href="/assets/images/favicon.svg" type="image/svg+xml">'
                );
                
                // Add header if missing
                if (!content.includes('rootuip-header')) {
                    content = content.replace('<body>', `<body>\n${this.brandConfig.headerHTML}`);
                }
                
                // Add footer if missing
                if (!content.includes('rootuip-footer')) {
                    content = content.replace('</body>', `${this.brandConfig.footerHTML}\n</body>`);
                }
            }
            
            // Update JavaScript files
            if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
                // Update console logs
                content = content.replace(/console\.log\('🚢/g, "console.log('");
                
                // Update component names
                content = content.replace(/Container Tracking/g, 'Ocean Freight Intelligence');
            }
            
            await fs.writeFile(filePath, content, 'utf8');
            return true;
            
        } catch (error) {
            console.error(`Error processing ${filePath}:`, error);
            return false;
        }
    }
    
    async findAllFiles(directory, extensions = ['.html', '.js', '.jsx', '.css']) {
        const files = [];
        
        async function scanDirectory(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    // Skip node_modules and other build directories
                    if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
                        await scanDirectory(fullPath);
                    }
                } else if (extensions.some(ext => entry.name.endsWith(ext))) {
                    files.push(fullPath);
                }
            }
        }
        
        await scanDirectory(directory);
        return files;
    }
    
    async applyBrandAcrossPlatform() {
        console.log('Starting ROOTUIP brand application...');
        
        const projectRoot = process.cwd();
        const files = await this.findAllFiles(projectRoot);
        
        console.log(`Found ${files.length} files to update`);
        
        let updated = 0;
        for (const file of files) {
            if (await this.applyBrandToFile(file)) {
                updated++;
                console.log(`✓ Updated: ${path.relative(projectRoot, file)}`);
            }
        }
        
        console.log(`\nBrand application complete! Updated ${updated} files.`);
        
        // Create brand assets directory
        const assetsDir = path.join(projectRoot, 'assets');
        const imagesDir = path.join(assetsDir, 'images');
        const cssDir = path.join(assetsDir, 'css');
        
        await fs.mkdir(assetsDir, { recursive: true });
        await fs.mkdir(imagesDir, { recursive: true });
        await fs.mkdir(cssDir, { recursive: true });
        
        // Copy brand files
        console.log('\nCopying brand assets...');
        
        // Save email template
        await fs.writeFile(
            path.join(assetsDir, 'email-template.html'),
            this.brandConfig.emailTemplate
        );
        
        // Save component styles
        await fs.writeFile(
            path.join(cssDir, 'brand-components.css'),
            this.brandConfig.componentStyles
        );
        
        console.log('✓ Brand assets saved');
        console.log('\nNext steps:');
        console.log('1. Copy SVG logo files to /assets/images/');
        console.log('2. Include brand-guidelines.css in all pages');
        console.log('3. Update DNS favicon records');
        console.log('4. Test responsive design across devices');
    }
}

// Run if called directly
if (require.main === module) {
    const brandApp = new BrandApplication();
    brandApp.applyBrandAcrossPlatform().catch(console.error);
}

module.exports = BrandApplication;