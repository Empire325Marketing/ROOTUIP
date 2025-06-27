/**
 * White-Label Domain Support Middleware
 * Handles custom domains, subdomain routing, and brand customization
 */

const httpStatus = require('http-status');
const path = require('path');
const fs = require('fs').promises;

// White-label configuration manager
class WhiteLabelManager {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
        this.domainCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    // Get company configuration by domain
    async getCompanyByDomain(domain) {
        const cacheKey = domain.toLowerCase();
        const cached = this.domainCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            // Check for exact custom domain match first
            let result = await this.db.query(`
                SELECT 
                    id, name, domain, subdomain, custom_domain,
                    white_label_enabled, logo_url, primary_color, secondary_color,
                    sso_enabled, sso_config
                FROM companies 
                WHERE custom_domain = $1 AND white_label_enabled = true
            `, [domain]);

            if (result.rows.length === 0) {
                // Check for subdomain match
                const subdomain = domain.split('.')[0];
                result = await this.db.query(`
                    SELECT 
                        id, name, domain, subdomain, custom_domain,
                        white_label_enabled, logo_url, primary_color, secondary_color,
                        sso_enabled, sso_config
                    FROM companies 
                    WHERE subdomain = $1
                `, [subdomain]);
            }

            const company = result.rows.length > 0 ? result.rows[0] : null;
            
            // Cache the result
            this.domainCache.set(cacheKey, {
                data: company,
                timestamp: Date.now()
            });

            return company;
        } catch (error) {
            this.logger.error('Domain lookup error:', error);
            return null;
        }
    }

    // Generate custom CSS for white-label branding
    generateCustomCSS(company) {
        const primaryColor = company.primary_color || '#1e40af';
        const secondaryColor = company.secondary_color || '#3b82f6';
        
        return `
            :root {
                --brand-primary: ${primaryColor};
                --brand-secondary: ${secondaryColor};
                --brand-primary-rgb: ${this.hexToRgb(primaryColor)};
                --brand-secondary-rgb: ${this.hexToRgb(secondaryColor)};
            }
            
            /* Header and Navigation */
            .auth-header,
            .admin-header {
                background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
            }
            
            /* Buttons */
            .btn-primary,
            .cta-button {
                background: var(--brand-primary);
                border-color: var(--brand-primary);
            }
            
            .btn-primary:hover,
            .cta-button:hover {
                background: var(--brand-secondary);
                border-color: var(--brand-secondary);
            }
            
            /* Links and accents */
            .nav-tab.active {
                border-color: var(--brand-primary);
                color: var(--brand-primary);
                background: rgba(var(--brand-primary-rgb), 0.1);
            }
            
            .form-input:focus {
                border-color: var(--brand-primary);
                box-shadow: 0 0 0 3px rgba(var(--brand-primary-rgb), 0.1);
            }
            
            /* Status indicators */
            .stat-value {
                color: var(--brand-primary);
            }
            
            /* Progress and loading elements */
            .progress-bar {
                background: var(--brand-primary);
            }
            
            /* Custom scrollbar */
            ::-webkit-scrollbar-thumb {
                background: var(--brand-primary);
            }
            
            /* Selection color */
            ::selection {
                background: rgba(var(--brand-primary-rgb), 0.3);
            }
            
            /* Login form specific */
            .login-card .form-submit {
                background: var(--brand-primary);
            }
            
            .login-card .form-submit:hover {
                background: var(--brand-secondary);
            }
            
            /* Dashboard elements */
            .dashboard-header {
                background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%);
            }
            
            /* Custom logo styling */
            .brand-logo {
                max-height: 40px;
                max-width: 200px;
                object-fit: contain;
            }
        `;
    }

    // Convert hex color to RGB values
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
            '30, 64, 175'; // Default blue
    }

    // Generate custom HTML template with branding
    generateBrandedHTML(baseHTML, company) {
        let brandedHTML = baseHTML;
        
        // Replace title
        const companyName = company.name || 'Enterprise Platform';
        brandedHTML = brandedHTML.replace(
            /<title>.*?<\/title>/i, 
            `<title>${companyName} - Authentication</title>`
        );
        
        // Add custom CSS
        const customCSS = this.generateCustomCSS(company);
        brandedHTML = brandedHTML.replace(
            '</head>',
            `<style>${customCSS}</style></head>`
        );
        
        // Replace logo if provided
        if (company.logo_url) {
            // Replace any existing logo placeholders
            brandedHTML = brandedHTML.replace(
                /class="header-title">[^<]*</g,
                `class="header-title"><img src="${company.logo_url}" alt="${company.name}" class="brand-logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline'"><span style="display:none">${company.name}</span>`
            );
            
            // Add logo to login forms
            brandedHTML = brandedHTML.replace(
                /(<div class="login-header">)/,
                `$1<div style="text-align: center; margin-bottom: 24px;"><img src="${company.logo_url}" alt="${company.name}" class="brand-logo"></div>`
            );
        }
        
        // Replace generic company references
        brandedHTML = brandedHTML.replace(/UIP Enterprise/g, companyName);
        brandedHTML = brandedHTML.replace(/UIP Platform/g, `${companyName} Platform`);
        
        return brandedHTML;
    }

    // Clear domain cache for a specific company
    clearDomainCache(domain) {
        if (domain) {
            this.domainCache.delete(domain.toLowerCase());
        } else {
            this.domainCache.clear();
        }
    }

    // Validate custom domain
    async validateCustomDomain(domain, companyId = null) {
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.([a-zA-Z]{2,}\.?)*[a-zA-Z]{2,}$/;
        
        if (!domainRegex.test(domain)) {
            return { valid: false, error: 'Invalid domain format' };
        }

        // Check if domain is already in use
        const query = companyId ? 
            'SELECT id FROM companies WHERE custom_domain = $1 AND id != $2' :
            'SELECT id FROM companies WHERE custom_domain = $1';
        
        const params = companyId ? [domain, companyId] : [domain];
        const result = await this.db.query(query, params);

        if (result.rows.length > 0) {
            return { valid: false, error: 'Domain already in use' };
        }

        return { valid: true };
    }

    // Update company white-label settings
    async updateWhiteLabelSettings(companyId, settings) {
        const {
            whiteLabelEnabled,
            customDomain,
            logoUrl,
            primaryColor,
            secondaryColor
        } = settings;

        try {
            // Validate custom domain if provided
            if (customDomain) {
                const validation = await this.validateCustomDomain(customDomain, companyId);
                if (!validation.valid) {
                    throw new Error(validation.error);
                }
            }

            // Update company settings
            const result = await this.db.query(`
                UPDATE companies 
                SET 
                    white_label_enabled = $1,
                    custom_domain = $2,
                    logo_url = $3,
                    primary_color = $4,
                    secondary_color = $5,
                    updated_at = NOW()
                WHERE id = $6
                RETURNING *
            `, [
                whiteLabelEnabled,
                customDomain || null,
                logoUrl || null,
                primaryColor || '#1e40af',
                secondaryColor || '#3b82f6',
                companyId
            ]);

            if (result.rows.length === 0) {
                throw new Error('Company not found');
            }

            // Clear cache for old and new domains
            this.clearDomainCache();

            return result.rows[0];
        } catch (error) {
            this.logger.error('White-label settings update error:', error);
            throw error;
        }
    }
}

// Middleware factory
const createWhiteLabelMiddleware = (db, logger) => {
    const whiteLabelManager = new WhiteLabelManager(db, logger);

    return {
        whiteLabelManager,

        // Domain resolution middleware
        async resolveDomain(req, res, next) {
            try {
                const host = req.get('host');
                const company = await whiteLabelManager.getCompanyByDomain(host);
                
                if (company) {
                    req.company = company;
                    req.isWhiteLabel = company.white_label_enabled;
                    
                    // Add company context for database queries
                    if (req.db) {
                        await req.db.query('SET app.current_company_id = $1', [company.id]);
                    }
                }

                next();
            } catch (error) {
                logger.error('Domain resolution error:', error);
                next(); // Continue without company context
            }
        },

        // Custom branding middleware for HTML responses
        async applyBranding(req, res, next) {
            if (!req.company || !req.isWhiteLabel) {
                return next();
            }

            // Override res.send for HTML responses
            const originalSend = res.send;
            
            res.send = function(body) {
                if (typeof body === 'string' && body.includes('<!DOCTYPE html>')) {
                    body = whiteLabelManager.generateBrandedHTML(body, req.company);
                }
                originalSend.call(this, body);
            };

            next();
        },

        // API endpoint to get white-label configuration
        async getWhiteLabelConfig(req, res) {
            try {
                if (!req.user || !req.user.permissionChecker) {
                    return res.status(httpStatus.UNAUTHORIZED).json({ 
                        error: 'Authentication required' 
                    });
                }

                if (!req.user.permissionChecker.hasPermission('company.settings')) {
                    return res.status(httpStatus.FORBIDDEN).json({ 
                        error: 'Insufficient permissions' 
                    });
                }

                const companyId = req.user.company_id;
                const result = await db.query(`
                    SELECT 
                        white_label_enabled, custom_domain, logo_url,
                        primary_color, secondary_color
                    FROM companies 
                    WHERE id = $1
                `, [companyId]);

                if (result.rows.length === 0) {
                    return res.status(httpStatus.NOT_FOUND).json({ 
                        error: 'Company not found' 
                    });
                }

                res.json({
                    success: true,
                    whiteLabelConfig: result.rows[0]
                });

            } catch (error) {
                logger.error('Get white-label config error:', error);
                res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
                    error: 'Failed to retrieve white-label configuration' 
                });
            }
        },

        // API endpoint to update white-label settings
        async updateWhiteLabelConfig(req, res) {
            try {
                if (!req.user || !req.user.permissionChecker) {
                    return res.status(httpStatus.UNAUTHORIZED).json({ 
                        error: 'Authentication required' 
                    });
                }

                if (!req.user.permissionChecker.hasPermission('company.settings')) {
                    return res.status(httpStatus.FORBIDDEN).json({ 
                        error: 'Insufficient permissions' 
                    });
                }

                const companyId = req.user.company_id;
                const settings = req.body;

                const updatedCompany = await whiteLabelManager.updateWhiteLabelSettings(
                    companyId, 
                    settings
                );

                // Log the configuration change
                await req.logAudit({
                    companyId: companyId,
                    userId: req.user.id,
                    action: 'company.white_label_updated',
                    resourceType: 'company',
                    resourceId: companyId,
                    newValues: settings,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    success: true
                });

                res.json({
                    success: true,
                    message: 'White-label configuration updated successfully',
                    company: {
                        white_label_enabled: updatedCompany.white_label_enabled,
                        custom_domain: updatedCompany.custom_domain,
                        logo_url: updatedCompany.logo_url,
                        primary_color: updatedCompany.primary_color,
                        secondary_color: updatedCompany.secondary_color
                    }
                });

            } catch (error) {
                logger.error('Update white-label config error:', error);
                res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
                    error: error.message || 'Failed to update white-label configuration' 
                });
            }
        },

        // Custom CSS endpoint for white-label domains
        async getCustomCSS(req, res) {
            try {
                const host = req.get('host');
                const company = await whiteLabelManager.getCompanyByDomain(host);
                
                if (!company || !company.white_label_enabled) {
                    return res.status(httpStatus.NOT_FOUND).send('/* No custom styling available */');
                }

                const customCSS = whiteLabelManager.generateCustomCSS(company);
                
                res.set('Content-Type', 'text/css');
                res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
                res.send(customCSS);

            } catch (error) {
                logger.error('Custom CSS error:', error);
                res.status(httpStatus.INTERNAL_SERVER_ERROR).send('/* Error generating custom CSS */');
            }
        },

        // Subdomain redirect middleware
        async handleSubdomainRedirect(req, res, next) {
            try {
                const host = req.get('host');
                const subdomain = host.split('.')[0];
                
                // Check if this is a subdomain request to the main domain
                if (subdomain !== host && subdomain !== 'www') {
                    const company = await whiteLabelManager.getCompanyByDomain(host);
                    
                    if (company && company.custom_domain && company.white_label_enabled) {
                        // Redirect to custom domain
                        const protocol = req.secure ? 'https' : 'http';
                        const redirectUrl = `${protocol}://${company.custom_domain}${req.originalUrl}`;
                        return res.redirect(301, redirectUrl);
                    }
                }

                next();
            } catch (error) {
                logger.error('Subdomain redirect error:', error);
                next();
            }
        },

        // Domain verification endpoint
        async verifyDomain(req, res) {
            try {
                const { domain } = req.body;
                
                if (!domain) {
                    return res.status(httpStatus.BAD_REQUEST).json({ 
                        error: 'Domain is required' 
                    });
                }

                const validation = await whiteLabelManager.validateCustomDomain(domain);
                
                res.json({
                    success: true,
                    valid: validation.valid,
                    error: validation.error || null
                });

            } catch (error) {
                logger.error('Domain verification error:', error);
                res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
                    error: 'Failed to verify domain' 
                });
            }
        }
    };
};

module.exports = {
    WhiteLabelManager,
    createWhiteLabelMiddleware
};