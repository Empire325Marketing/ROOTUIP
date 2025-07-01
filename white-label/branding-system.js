#!/usr/bin/env node

/**
 * ROOTUIP White-Label Branding System
 * Manages custom branding, theming, and visual identity for tenants
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

class WhiteLabelBrandingSystem {
    constructor(config = {}) {
        this.config = {
            assetsPath: config.assetsPath || 'white-label/assets',
            themesPath: config.themesPath || 'white-label/themes',
            templatesPath: config.templatesPath || 'white-label/templates',
            cdnBucket: config.cdnBucket || process.env.WHITELABEL_CDN_BUCKET,
            cacheTimeout: config.cacheTimeout || 3600, // 1 hour
            ...config
        };
        
        this.s3 = new AWS.S3({
            region: process.env.AWS_REGION || 'us-east-1'
        });
        
        this.brandingCache = new Map();
        this.themeCache = new Map();
        
        // Supported image formats
        this.supportedFormats = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
        
        // Predefined theme presets
        this.themePresets = {
            professional: {
                primary: '#1a365d',
                secondary: '#2d3748',
                accent: '#3182ce',
                background: '#ffffff',
                surface: '#f7fafc',
                text: '#2d3748',
                textSecondary: '#718096'
            },
            modern: {
                primary: '#6366f1',
                secondary: '#8b5cf6',
                accent: '#06b6d4',
                background: '#ffffff',
                surface: '#f8fafc',
                text: '#111827',
                textSecondary: '#6b7280'
            },
            logistics: {
                primary: '#059669',
                secondary: '#0d9488',
                accent: '#f59e0b',
                background: '#ffffff',
                surface: '#f0fdf4',
                text: '#064e3b',
                textSecondary: '#374151'
            },
            enterprise: {
                primary: '#1e293b',
                secondary: '#334155',
                accent: '#0ea5e9',
                background: '#ffffff',
                surface: '#f1f5f9',
                text: '#0f172a',
                textSecondary: '#475569'
            }
        };
    }
    
    // Create tenant branding configuration
    async createTenantBranding(tenantId, brandingData) {
        try {
            console.log(`Creating branding configuration for tenant: ${tenantId}`);
            
            const brandingId = uuidv4();
            const timestamp = new Date().toISOString();
            
            // Validate branding data
            const validatedData = this.validateBrandingData(brandingData);
            
            // Process and upload assets
            const processedAssets = await this.processAssets(tenantId, validatedData.assets);
            
            // Generate theme variations
            const themeVariations = this.generateThemeVariations(validatedData.theme);
            
            // Create branding configuration
            const brandingConfig = {
                brandingId,
                tenantId,
                createdAt: timestamp,
                updatedAt: timestamp,
                version: '1.0.0',
                status: 'active',
                
                // Brand identity
                brand: {
                    name: validatedData.brandName,
                    tagline: validatedData.tagline,
                    description: validatedData.description,
                    website: validatedData.website,
                    
                    // Contact information
                    contact: {
                        email: validatedData.contact?.email,
                        phone: validatedData.contact?.phone,
                        address: validatedData.contact?.address
                    }
                },
                
                // Visual assets
                assets: processedAssets,
                
                // Theme configuration
                theme: {
                    preset: validatedData.theme.preset,
                    colors: validatedData.theme.colors,
                    variations: themeVariations,
                    typography: validatedData.theme.typography || this.getDefaultTypography(),
                    spacing: validatedData.theme.spacing || this.getDefaultSpacing(),
                    borders: validatedData.theme.borders || this.getDefaultBorders(),
                    shadows: validatedData.theme.shadows || this.getDefaultShadows()
                },
                
                // Custom domains
                domains: validatedData.domains || [],
                
                // Application settings
                application: {
                    title: validatedData.applicationTitle || validatedData.brandName,
                    favicon: processedAssets.favicon,
                    manifest: this.generateManifest(validatedData, processedAssets),
                    
                    // Navigation
                    navigation: validatedData.navigation || this.getDefaultNavigation(),
                    
                    // Footer
                    footer: validatedData.footer || this.getDefaultFooter(validatedData)
                },
                
                // Email branding
                email: {
                    fromName: validatedData.emailFromName || validatedData.brandName,
                    replyTo: validatedData.emailReplyTo,
                    signature: validatedData.emailSignature,
                    headerLogo: processedAssets.emailLogo,
                    footerText: validatedData.emailFooter
                },
                
                // Mobile app configuration
                mobile: {
                    appName: validatedData.mobileAppName || validatedData.brandName,
                    bundleId: validatedData.mobileBundleId,
                    splashScreen: processedAssets.splashScreen,
                    icons: processedAssets.mobileIcons
                }
            };
            
            // Save configuration
            await this.saveBrandingConfig(tenantId, brandingConfig);
            
            // Generate CSS files
            await this.generateCustomCSS(tenantId, brandingConfig);
            
            // Update cache
            this.brandingCache.set(tenantId, brandingConfig);
            
            console.log(`Branding configuration created successfully for tenant: ${tenantId}`);
            return {
                success: true,
                brandingId,
                config: brandingConfig
            };
            
        } catch (error) {
            console.error(`Error creating tenant branding: ${error.message}`);
            throw error;
        }
    }
    
    // Validate branding data
    validateBrandingData(data) {
        const required = ['brandName', 'theme'];
        
        for (const field of required) {
            if (!data[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        // Validate theme colors
        if (data.theme.colors) {
            const colorFields = ['primary', 'secondary', 'background', 'text'];
            for (const field of colorFields) {
                if (data.theme.colors[field] && !this.isValidColor(data.theme.colors[field])) {
                    throw new Error(`Invalid color format for ${field}: ${data.theme.colors[field]}`);
                }
            }
        }
        
        // Validate domains
        if (data.domains) {
            for (const domain of data.domains) {
                if (!this.isValidDomain(domain)) {
                    throw new Error(`Invalid domain format: ${domain}`);
                }
            }
        }
        
        return data;
    }
    
    // Process and upload assets
    async processAssets(tenantId, assets = {}) {
        const processedAssets = {};
        
        try {
            // Process logo variations
            if (assets.logo) {
                processedAssets.logo = await this.processLogo(tenantId, assets.logo);
            }
            
            // Process favicon
            if (assets.favicon) {
                processedAssets.favicon = await this.processFavicon(tenantId, assets.favicon);
            }
            
            // Process email logo
            if (assets.emailLogo) {
                processedAssets.emailLogo = await this.processEmailLogo(tenantId, assets.emailLogo);
            }
            
            // Process mobile icons
            if (assets.mobileIcons) {
                processedAssets.mobileIcons = await this.processMobileIcons(tenantId, assets.mobileIcons);
            }
            
            // Process splash screen
            if (assets.splashScreen) {
                processedAssets.splashScreen = await this.processSplashScreen(tenantId, assets.splashScreen);
            }
            
            // Process background images
            if (assets.backgrounds) {
                processedAssets.backgrounds = await this.processBackgrounds(tenantId, assets.backgrounds);
            }
            
            return processedAssets;
            
        } catch (error) {
            console.error(`Error processing assets: ${error.message}`);
            throw error;
        }
    }
    
    // Process logo variations
    async processLogo(tenantId, logoBuffer) {
        const logoVariations = {};
        const baseKey = `tenants/${tenantId}/assets/logo`;
        
        // Original logo
        const originalKey = `${baseKey}/original.png`;
        await this.uploadToS3(originalKey, logoBuffer, 'image/png');
        logoVariations.original = this.getCDNUrl(originalKey);
        
        // Logo variations
        const variations = [
            { name: 'small', width: 120, height: 40 },
            { name: 'medium', width: 240, height: 80 },
            { name: 'large', width: 480, height: 160 },
            { name: 'header', width: 200, height: 50 },
            { name: 'sidebar', width: 150, height: 50 },
            { name: 'footer', width: 100, height: 30 }
        ];
        
        for (const variation of variations) {
            const resizedBuffer = await sharp(logoBuffer)
                .resize(variation.width, variation.height, {
                    fit: 'contain',
                    background: { r: 255, g: 255, b: 255, alpha: 0 }
                })
                .png()
                .toBuffer();
            
            const key = `${baseKey}/${variation.name}.png`;
            await this.uploadToS3(key, resizedBuffer, 'image/png');
            logoVariations[variation.name] = this.getCDNUrl(key);
        }
        
        return logoVariations;
    }
    
    // Process favicon
    async processFavicon(tenantId, faviconBuffer) {
        const faviconVariations = {};
        const baseKey = `tenants/${tenantId}/assets/favicon`;
        
        const sizes = [16, 32, 48, 96, 144, 192];
        
        for (const size of sizes) {
            const resizedBuffer = await sharp(faviconBuffer)
                .resize(size, size)
                .png()
                .toBuffer();
            
            const key = `${baseKey}/favicon-${size}x${size}.png`;
            await this.uploadToS3(key, resizedBuffer, 'image/png');
            faviconVariations[`${size}x${size}`] = this.getCDNUrl(key);
        }
        
        // Generate ICO file
        const icoBuffer = await sharp(faviconBuffer)
            .resize(32, 32)
            .png()
            .toBuffer();
        
        const icoKey = `${baseKey}/favicon.ico`;
        await this.uploadToS3(icoKey, icoBuffer, 'image/x-icon');
        faviconVariations.ico = this.getCDNUrl(icoKey);
        
        return faviconVariations;
    }
    
    // Process mobile icons
    async processMobileIcons(tenantId, iconBuffer) {
        const mobileIcons = {};
        const baseKey = `tenants/${tenantId}/assets/mobile`;
        
        // iOS icons
        const iosSizes = [57, 60, 72, 76, 114, 120, 144, 152, 180];
        mobileIcons.ios = {};
        
        for (const size of iosSizes) {
            const resizedBuffer = await sharp(iconBuffer)
                .resize(size, size)
                .png()
                .toBuffer();
            
            const key = `${baseKey}/ios/icon-${size}x${size}.png`;
            await this.uploadToS3(key, resizedBuffer, 'image/png');
            mobileIcons.ios[`${size}x${size}`] = this.getCDNUrl(key);
        }
        
        // Android icons
        const androidSizes = [36, 48, 72, 96, 144, 192, 512];
        mobileIcons.android = {};
        
        for (const size of androidSizes) {
            const resizedBuffer = await sharp(iconBuffer)
                .resize(size, size)
                .png()
                .toBuffer();
            
            const key = `${baseKey}/android/icon-${size}x${size}.png`;
            await this.uploadToS3(key, resizedBuffer, 'image/png');
            mobileIcons.android[`${size}x${size}`] = this.getCDNUrl(key);
        }
        
        return mobileIcons;
    }
    
    // Generate theme variations
    generateThemeVariations(theme) {
        const baseColors = theme.colors || this.themePresets[theme.preset] || this.themePresets.professional;
        
        return {
            light: {
                ...baseColors,
                mode: 'light'
            },
            dark: {
                primary: baseColors.primary,
                secondary: baseColors.secondary,
                accent: baseColors.accent,
                background: '#1a202c',
                surface: '#2d3748',
                text: '#f7fafc',
                textSecondary: '#a0aec0',
                mode: 'dark'
            },
            highContrast: {
                primary: '#000000',
                secondary: '#333333',
                accent: baseColors.accent,
                background: '#ffffff',
                surface: '#f8f9fa',
                text: '#000000',
                textSecondary: '#666666',
                mode: 'high-contrast'
            }
        };
    }
    
    // Generate custom CSS
    async generateCustomCSS(tenantId, brandingConfig) {
        const { theme, assets } = brandingConfig;
        
        // Main theme CSS
        const mainCSS = this.generateThemeCSS(theme.variations.light, assets);
        
        // Dark theme CSS
        const darkCSS = this.generateThemeCSS(theme.variations.dark, assets, 'dark');
        
        // High contrast CSS
        const contrastCSS = this.generateThemeCSS(theme.variations.highContrast, assets, 'high-contrast');
        
        // Combined CSS
        const combinedCSS = `
/* ROOTUIP White-Label Theme for Tenant: ${tenantId} */
/* Generated on: ${new Date().toISOString()} */

${mainCSS}

@media (prefers-color-scheme: dark) {
    ${darkCSS}
}

@media (prefers-contrast: high) {
    ${contrastCSS}
}

/* Custom animations */
@keyframes brand-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.8; }
}

@keyframes brand-slide-in {
    from { transform: translateX(-100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

/* Responsive design helpers */
@media (max-width: 768px) {
    .brand-logo-header {
        max-width: 120px;
    }
    
    .brand-navigation {
        flex-direction: column;
    }
}
        `;
        
        // Save CSS files
        const cssKey = `tenants/${tenantId}/assets/css/theme.css`;
        await this.uploadToS3(cssKey, Buffer.from(combinedCSS), 'text/css');
        
        return {
            main: this.getCDNUrl(cssKey),
            css: combinedCSS
        };
    }
    
    // Generate theme-specific CSS
    generateThemeCSS(colors, assets, variant = '') {
        const prefix = variant ? `[data-theme="${variant}"]` : ':root';
        
        return `
${prefix} {
    /* Brand Colors */
    --brand-primary: ${colors.primary};
    --brand-secondary: ${colors.secondary};
    --brand-accent: ${colors.accent};
    --brand-background: ${colors.background};
    --brand-surface: ${colors.surface};
    --brand-text: ${colors.text};
    --brand-text-secondary: ${colors.textSecondary};
    
    /* Color variations */
    --brand-primary-light: ${this.lightenColor(colors.primary, 20)};
    --brand-primary-dark: ${this.darkenColor(colors.primary, 20)};
    --brand-secondary-light: ${this.lightenColor(colors.secondary, 20)};
    --brand-secondary-dark: ${this.darkenColor(colors.secondary, 20)};
    
    /* Status colors */
    --brand-success: #10b981;
    --brand-warning: #f59e0b;
    --brand-error: #ef4444;
    --brand-info: #3b82f6;
    
    /* Background images */
    ${assets.logo ? `--brand-logo-url: url('${assets.logo.header}');` : ''}
    ${assets.backgrounds ? `--brand-bg-pattern: url('${assets.backgrounds.pattern}');` : ''}
}

${prefix} .brand-button {
    background-color: var(--brand-primary);
    color: var(--brand-background);
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 0.375rem;
    font-weight: 600;
    transition: all 0.2s ease;
}

${prefix} .brand-button:hover {
    background-color: var(--brand-primary-dark);
    transform: translateY(-1px);
}

${prefix} .brand-button-secondary {
    background-color: var(--brand-secondary);
    color: var(--brand-background);
}

${prefix} .brand-card {
    background-color: var(--brand-surface);
    border: 1px solid var(--brand-secondary);
    border-radius: 0.5rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

${prefix} .brand-header {
    background-color: var(--brand-background);
    border-bottom: 1px solid var(--brand-secondary);
    padding: 1rem 2rem;
}

${prefix} .brand-logo {
    ${assets.logo ? `background-image: var(--brand-logo-url);` : ''}
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
}

${prefix} .brand-navigation {
    background-color: var(--brand-primary);
}

${prefix} .brand-navigation a {
    color: var(--brand-background);
    text-decoration: none;
    padding: 0.75rem 1rem;
    border-radius: 0.25rem;
    transition: background-color 0.2s ease;
}

${prefix} .brand-navigation a:hover {
    background-color: var(--brand-primary-light);
}

${prefix} .brand-text-primary {
    color: var(--brand-text);
}

${prefix} .brand-text-secondary {
    color: var(--brand-text-secondary);
}

${prefix} .brand-bg-primary {
    background-color: var(--brand-primary);
}

${prefix} .brand-bg-secondary {
    background-color: var(--brand-secondary);
}

${prefix} .brand-bg-surface {
    background-color: var(--brand-surface);
}
        `;
    }
    
    // Get tenant branding
    async getTenantBranding(tenantId) {
        try {
            // Check cache first
            if (this.brandingCache.has(tenantId)) {
                const cached = this.brandingCache.get(tenantId);
                if (Date.now() - cached.cachedAt < this.config.cacheTimeout * 1000) {
                    return cached;
                }
            }
            
            // Load from storage
            const brandingConfig = await this.loadBrandingConfig(tenantId);
            
            if (brandingConfig) {
                // Update cache
                brandingConfig.cachedAt = Date.now();
                this.brandingCache.set(tenantId, brandingConfig);
                
                return brandingConfig;
            }
            
            // Return default branding if none exists
            return this.getDefaultBranding();
            
        } catch (error) {
            console.error(`Error getting tenant branding: ${error.message}`);
            return this.getDefaultBranding();
        }
    }
    
    // Update tenant branding
    async updateTenantBranding(tenantId, updates) {
        try {
            const existingConfig = await this.getTenantBranding(tenantId);
            
            // Merge updates
            const updatedConfig = {
                ...existingConfig,
                ...updates,
                updatedAt: new Date().toISOString(),
                version: this.incrementVersion(existingConfig.version)
            };
            
            // Process new assets if provided
            if (updates.assets) {
                const processedAssets = await this.processAssets(tenantId, updates.assets);
                updatedConfig.assets = { ...existingConfig.assets, ...processedAssets };
            }
            
            // Regenerate theme if colors changed
            if (updates.theme) {
                updatedConfig.theme.variations = this.generateThemeVariations(updatedConfig.theme);
                await this.generateCustomCSS(tenantId, updatedConfig);
            }
            
            // Save updated configuration
            await this.saveBrandingConfig(tenantId, updatedConfig);
            
            // Update cache
            this.brandingCache.set(tenantId, updatedConfig);
            
            return {
                success: true,
                config: updatedConfig
            };
            
        } catch (error) {
            console.error(`Error updating tenant branding: ${error.message}`);
            throw error;
        }
    }
    
    // Generate web app manifest
    generateManifest(brandingData, assets) {
        return {
            name: brandingData.brandName,
            short_name: brandingData.brandName.substring(0, 12),
            description: brandingData.description,
            start_url: '/',
            display: 'standalone',
            theme_color: brandingData.theme.colors?.primary || '#1a365d',
            background_color: brandingData.theme.colors?.background || '#ffffff',
            icons: assets.mobileIcons ? [
                {
                    src: assets.mobileIcons.android['192x192'],
                    sizes: '192x192',
                    type: 'image/png'
                },
                {
                    src: assets.mobileIcons.android['512x512'],
                    sizes: '512x512',
                    type: 'image/png'
                }
            ] : []
        };
    }
    
    // Utility functions
    isValidColor(color) {
        const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        const rgbRegex = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/;
        const rgbaRegex = /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[01]?\.?\d*\s*\)$/;
        
        return hexRegex.test(color) || rgbRegex.test(color) || rgbaRegex.test(color);
    }
    
    isValidDomain(domain) {
        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
        return domainRegex.test(domain);
    }
    
    lightenColor(color, percent) {
        // Simplified color lightening
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
    
    darkenColor(color, percent) {
        return this.lightenColor(color, -percent);
    }
    
    incrementVersion(version) {
        const parts = version.split('.');
        parts[2] = parseInt(parts[2]) + 1;
        return parts.join('.');
    }
    
    // Storage functions
    async uploadToS3(key, buffer, contentType) {
        const params = {
            Bucket: this.config.cdnBucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            CacheControl: 'max-age=31536000', // 1 year
            ACL: 'public-read'
        };
        
        return this.s3.upload(params).promise();
    }
    
    getCDNUrl(key) {
        return `https://${this.config.cdnBucket}.s3.amazonaws.com/${key}`;
    }
    
    async saveBrandingConfig(tenantId, config) {
        const configPath = path.join(this.config.assetsPath, 'configs', `${tenantId}.json`);
        await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
        await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
    }
    
    async loadBrandingConfig(tenantId) {
        const configPath = path.join(this.config.assetsPath, 'configs', `${tenantId}.json`);
        
        try {
            const data = await fs.promises.readFile(configPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }
    
    // Default configurations
    getDefaultBranding() {
        return {
            brand: { name: 'ROOTUIP' },
            theme: { colors: this.themePresets.professional },
            assets: {},
            domains: []
        };
    }
    
    getDefaultTypography() {
        return {
            fontFamily: 'Inter, system-ui, sans-serif',
            headingFont: 'Inter, system-ui, sans-serif',
            sizes: {
                xs: '0.75rem',
                sm: '0.875rem',
                base: '1rem',
                lg: '1.125rem',
                xl: '1.25rem',
                '2xl': '1.5rem',
                '3xl': '1.875rem',
                '4xl': '2.25rem'
            },
            weights: {
                normal: '400',
                medium: '500',
                semibold: '600',
                bold: '700'
            }
        };
    }
    
    getDefaultSpacing() {
        return {
            xs: '0.25rem',
            sm: '0.5rem',
            md: '1rem',
            lg: '1.5rem',
            xl: '2rem',
            '2xl': '3rem'
        };
    }
    
    getDefaultBorders() {
        return {
            radius: {
                sm: '0.125rem',
                md: '0.375rem',
                lg: '0.5rem',
                xl: '0.75rem'
            },
            width: {
                thin: '1px',
                medium: '2px',
                thick: '4px'
            }
        };
    }
    
    getDefaultShadows() {
        return {
            sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
        };
    }
    
    getDefaultNavigation() {
        return {
            items: [
                { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
                { label: 'Shipments', path: '/shipments', icon: 'shipping' },
                { label: 'Analytics', path: '/analytics', icon: 'chart' },
                { label: 'Settings', path: '/settings', icon: 'settings' }
            ]
        };
    }
    
    getDefaultFooter(brandingData) {
        return {
            copyright: `© ${new Date().getFullYear()} ${brandingData.brandName}. All rights reserved.`,
            links: [
                { label: 'Privacy Policy', url: '/privacy' },
                { label: 'Terms of Service', url: '/terms' },
                { label: 'Support', url: '/support' }
            ]
        };
    }
}

module.exports = WhiteLabelBrandingSystem;