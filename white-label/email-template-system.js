#!/usr/bin/env node

/**
 * ROOTUIP Email Template System
 * Manages branded email templates for white-label tenants
 */

const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const mjml2html = require('mjml');
const nodemailer = require('nodemailer');
const AWS = require('aws-sdk');

class EmailTemplateSystem {
    constructor(config = {}) {
        this.config = {
            templatesPath: config.templatesPath || 'white-label/email-templates',
            compiledPath: config.compiledPath || 'white-label/compiled-templates',
            sesRegion: config.sesRegion || process.env.AWS_SES_REGION || 'us-east-1',
            smtpConfig: config.smtpConfig || {
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT || 587,
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            },
            ...config
        };
        
        this.ses = new AWS.SES({ region: this.config.sesRegion });
        this.templateCache = new Map();
        this.compiledCache = new Map();
        
        // Register Handlebars helpers
        this.registerHelpers();
        
        // Default email categories
        this.emailCategories = {
            TRANSACTIONAL: 'transactional',
            MARKETING: 'marketing',
            NOTIFICATION: 'notification',
            SYSTEM: 'system',
            SUPPORT: 'support'
        };
    }
    
    // Create tenant email templates
    async createTenantEmailTemplates(tenantId, brandingConfig) {
        try {
            console.log(`Creating email templates for tenant: ${tenantId}`);
            
            const templates = {
                // Welcome email
                welcome: await this.createTemplate('welcome', {
                    tenantId,
                    brandingConfig,
                    category: this.emailCategories.TRANSACTIONAL,
                    subject: `Welcome to {{brandName}}!`,
                    preheader: 'Get started with your new logistics platform'
                }),
                
                // Shipment notifications
                shipmentCreated: await this.createTemplate('shipment-created', {
                    tenantId,
                    brandingConfig,
                    category: this.emailCategories.NOTIFICATION,
                    subject: 'New Shipment Created - #{{shipmentId}}',
                    preheader: 'Your shipment has been successfully created'
                }),
                
                shipmentUpdated: await this.createTemplate('shipment-updated', {
                    tenantId,
                    brandingConfig,
                    category: this.emailCategories.NOTIFICATION,
                    subject: 'Shipment Update - #{{shipmentId}}',
                    preheader: 'Your shipment status has been updated'
                }),
                
                shipmentDelivered: await this.createTemplate('shipment-delivered', {
                    tenantId,
                    brandingConfig,
                    category: this.emailCategories.NOTIFICATION,
                    subject: 'Shipment Delivered - #{{shipmentId}}',
                    preheader: 'Your shipment has been successfully delivered'
                }),
                
                // User management
                passwordReset: await this.createTemplate('password-reset', {
                    tenantId,
                    brandingConfig,
                    category: this.emailCategories.SYSTEM,
                    subject: 'Reset Your Password',
                    preheader: 'You requested a password reset'
                }),
                
                userInvitation: await this.createTemplate('user-invitation', {
                    tenantId,
                    brandingConfig,
                    category: this.emailCategories.SYSTEM,
                    subject: `You're invited to join {{brandName}}`,
                    preheader: 'Accept your invitation to get started'
                }),
                
                // Reports and analytics
                weeklyReport: await this.createTemplate('weekly-report', {
                    tenantId,
                    brandingConfig,
                    category: this.emailCategories.NOTIFICATION,
                    subject: 'Your Weekly Logistics Report',
                    preheader: 'Summary of your logistics activity this week'
                }),
                
                monthlyInvoice: await this.createTemplate('monthly-invoice', {
                    tenantId,
                    brandingConfig,
                    category: this.emailCategories.TRANSACTIONAL,
                    subject: 'Invoice for {{monthYear}}',
                    preheader: 'Your monthly invoice is ready'
                }),
                
                // Alerts
                alertThreshold: await this.createTemplate('alert-threshold', {
                    tenantId,
                    brandingConfig,
                    category: this.emailCategories.NOTIFICATION,
                    subject: 'Alert: {{alertType}} Threshold Exceeded',
                    preheader: 'Immediate attention required'
                }),
                
                // Custom templates
                custom: await this.createCustomTemplates(tenantId, brandingConfig)
            };
            
            // Compile all templates
            await this.compileAllTemplates(tenantId, templates);
            
            console.log(`Email templates created successfully for tenant: ${tenantId}`);
            return {
                success: true,
                templates: Object.keys(templates),
                tenantId
            };
            
        } catch (error) {
            console.error(`Error creating email templates: ${error.message}`);
            throw error;
        }
    }
    
    // Create individual template
    async createTemplate(templateName, options) {
        const { tenantId, brandingConfig, category, subject, preheader } = options;
        
        // Get MJML template based on template name
        const mjmlTemplate = this.getMJMLTemplate(templateName, brandingConfig);
        
        // Create Handlebars template
        const template = {
            id: `${tenantId}-${templateName}`,
            tenantId,
            name: templateName,
            category,
            subject,
            preheader,
            mjml: mjmlTemplate,
            variables: this.extractVariables(mjmlTemplate),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: '1.0.0'
        };
        
        // Save template
        await this.saveTemplate(tenantId, templateName, template);
        
        return template;
    }
    
    // Get MJML template
    getMJMLTemplate(templateName, brandingConfig) {
        const { brand, theme, assets, email } = brandingConfig;
        const colors = theme.variations.light;
        
        // Base template structure
        const baseTemplate = `
<mjml>
  <mj-head>
    <mj-title>{{subject}}</mj-title>
    <mj-preview>{{preheader}}</mj-preview>
    <mj-attributes>
      <mj-all font-family="${theme.typography?.fontFamily || 'Arial, sans-serif'}" />
      <mj-button background-color="${colors.primary}" border-radius="6px" font-size="16px" font-weight="600" />
      <mj-text color="${colors.text}" font-size="14px" line-height="1.6" />
      <mj-section background-color="${colors.background}" />
    </mj-attributes>
    <mj-style>
      .brand-link { color: ${colors.primary}; text-decoration: none; }
      .brand-link:hover { text-decoration: underline; }
      .footer-link { color: ${colors.textSecondary}; text-decoration: none; font-size: 12px; }
      .highlight { background-color: ${colors.surface}; padding: 20px; border-radius: 8px; }
      .alert { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; }
      .success { background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; }
    </mj-style>
  </mj-head>
  <mj-body background-color="${colors.surface}">
    <!-- Header -->
    <mj-section background-color="${colors.background}" padding="20px">
      <mj-column>
        ${assets.emailLogo ? 
          `<mj-image src="${assets.emailLogo}" alt="${brand.name}" width="150px" align="center" />` :
          `<mj-text align="center" font-size="24px" font-weight="bold" color="${colors.primary}">${brand.name}</mj-text>`
        }
      </mj-column>
    </mj-section>
    
    <!-- Content -->
    ${this.getTemplateContent(templateName)}
    
    <!-- Footer -->
    <mj-section background-color="${colors.surface}" padding-top="40px">
      <mj-column>
        <mj-divider border-color="${colors.secondary}" border-width="1px" />
        <mj-text align="center" font-size="12px" color="${colors.textSecondary}" padding-top="20px">
          ${email.footerText || `© ${new Date().getFullYear()} ${brand.name}. All rights reserved.`}
        </mj-text>
        <mj-text align="center" padding-top="10px">
          <a href="{{unsubscribeUrl}}" class="footer-link">Unsubscribe</a> | 
          <a href="{{preferencesUrl}}" class="footer-link">Email Preferences</a> | 
          <a href="{{privacyUrl}}" class="footer-link">Privacy Policy</a>
        </mj-text>
        ${brand.contact?.address ? 
          `<mj-text align="center" font-size="11px" color="${colors.textSecondary}" padding-top="10px">
            ${brand.contact.address}
          </mj-text>` : ''
        }
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>
        `;
        
        return baseTemplate;
    }
    
    // Get template-specific content
    getTemplateContent(templateName) {
        const templates = {
            welcome: `
    <mj-section padding="40px 20px">
      <mj-column>
        <mj-text font-size="28px" font-weight="bold" align="center" padding-bottom="20px">
          Welcome to {{brandName}}, {{userName}}!
        </mj-text>
        <mj-text font-size="16px" align="center" padding-bottom="30px">
          We're excited to have you on board. Let's get you started with your logistics management journey.
        </mj-text>
        <mj-button href="{{dashboardUrl}}" padding="20px 0">
          Access Your Dashboard
        </mj-button>
      </mj-column>
    </mj-section>
    
    <mj-section background-color="#f8fafc" padding="30px 20px">
      <mj-column>
        <mj-text font-size="20px" font-weight="600" padding-bottom="15px">
          Getting Started
        </mj-text>
        <mj-text padding-bottom="10px">
          <strong>1. Complete Your Profile:</strong> Add your company details and preferences
        </mj-text>
        <mj-text padding-bottom="10px">
          <strong>2. Create Your First Shipment:</strong> Start tracking your logistics operations
        </mj-text>
        <mj-text padding-bottom="10px">
          <strong>3. Invite Your Team:</strong> Collaborate with your colleagues
        </mj-text>
      </mj-column>
    </mj-section>
            `,
            
            'shipment-created': `
    <mj-section padding="40px 20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="bold" align="center" padding-bottom="20px">
          Shipment Created Successfully
        </mj-text>
        <mj-text align="center" font-size="16px" padding-bottom="30px">
          Your shipment #{{shipmentId}} has been created and is ready for tracking.
        </mj-text>
      </mj-column>
    </mj-section>
    
    <mj-section background-color="#f8fafc" padding="20px">
      <mj-column>
        <mj-text font-size="16px" font-weight="600" padding-bottom="15px">
          Shipment Details
        </mj-text>
        <mj-table>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Shipment ID:</td>
            <td style="padding: 8px 0;">{{shipmentId}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Origin:</td>
            <td style="padding: 8px 0;">{{origin}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Destination:</td>
            <td style="padding: 8px 0;">{{destination}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Estimated Delivery:</td>
            <td style="padding: 8px 0;">{{estimatedDelivery}}</td>
          </tr>
        </mj-table>
      </mj-column>
    </mj-section>
    
    <mj-section padding="30px 20px">
      <mj-column>
        <mj-button href="{{trackingUrl}}">
          Track Shipment
        </mj-button>
      </mj-column>
    </mj-section>
            `,
            
            'password-reset': `
    <mj-section padding="40px 20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="bold" align="center" padding-bottom="20px">
          Reset Your Password
        </mj-text>
        <mj-text align="center" font-size="16px" padding-bottom="30px">
          You requested to reset your password. Click the button below to create a new password.
        </mj-text>
        <mj-button href="{{resetUrl}}" padding="20px 0">
          Reset Password
        </mj-button>
        <mj-text align="center" font-size="14px" color="#6b7280" padding-top="20px">
          This link will expire in 1 hour. If you didn't request this, please ignore this email.
        </mj-text>
      </mj-column>
    </mj-section>
            `,
            
            'weekly-report': `
    <mj-section padding="40px 20px">
      <mj-column>
        <mj-text font-size="28px" font-weight="bold" align="center" padding-bottom="10px">
          Your Weekly Logistics Report
        </mj-text>
        <mj-text align="center" font-size="16px" color="#6b7280" padding-bottom="30px">
          {{weekStartDate}} - {{weekEndDate}}
        </mj-text>
      </mj-column>
    </mj-section>
    
    <!-- Key Metrics -->
    <mj-section>
      <mj-column width="50%">
        <mj-text align="center" font-size="36px" font-weight="bold" color="#10b981">
          {{totalShipments}}
        </mj-text>
        <mj-text align="center" font-size="14px" color="#6b7280">
          Total Shipments
        </mj-text>
      </mj-column>
      <mj-column width="50%">
        <mj-text align="center" font-size="36px" font-weight="bold" color="#3b82f6">
          {{onTimeDelivery}}%
        </mj-text>
        <mj-text align="center" font-size="14px" color="#6b7280">
          On-Time Delivery
        </mj-text>
      </mj-column>
    </mj-section>
    
    <!-- Performance Summary -->
    <mj-section background-color="#f8fafc" padding="30px 20px">
      <mj-column>
        <mj-text font-size="20px" font-weight="600" padding-bottom="15px">
          Performance Summary
        </mj-text>
        <mj-table>
          <tr>
            <td style="padding: 8px 0;">Active Shipments:</td>
            <td style="padding: 8px 0; text-align: right;">{{activeShipments}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">Completed Deliveries:</td>
            <td style="padding: 8px 0; text-align: right;">{{completedDeliveries}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">Average Transit Time:</td>
            <td style="padding: 8px 0; text-align: right;">{{avgTransitTime}} days</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;">Cost Savings:</td>
            <td style="padding: 8px 0; text-align: right; color: #10b981; font-weight: 600;">{{costSavings}}</td>
          </tr>
        </mj-table>
      </mj-column>
    </mj-section>
    
    <mj-section padding="30px 20px">
      <mj-column>
        <mj-button href="{{fullReportUrl}}">
          View Full Report
        </mj-button>
      </mj-column>
    </mj-section>
            `
        };
        
        return templates[templateName] || this.getGenericContent();
    }
    
    // Get generic content for custom templates
    getGenericContent() {
        return `
    <mj-section padding="40px 20px">
      <mj-column>
        <mj-text font-size="24px" font-weight="bold" align="center" padding-bottom="20px">
          {{title}}
        </mj-text>
        <mj-text font-size="16px" padding-bottom="20px">
          {{content}}
        </mj-text>
        {{#if ctaUrl}}
        <mj-button href="{{ctaUrl}}" padding="20px 0">
          {{ctaText}}
        </mj-button>
        {{/if}}
      </mj-column>
    </mj-section>
        `;
    }
    
    // Create custom templates
    async createCustomTemplates(tenantId, brandingConfig) {
        // Allow tenants to create their own custom templates
        return {
            generic: await this.createTemplate('generic', {
                tenantId,
                brandingConfig,
                category: this.emailCategories.MARKETING,
                subject: '{{subject}}',
                preheader: '{{preheader}}'
            })
        };
    }
    
    // Compile all templates
    async compileAllTemplates(tenantId, templates) {
        const compiledTemplates = {};
        
        for (const [name, template] of Object.entries(templates)) {
            if (typeof template === 'object' && template.mjml) {
                try {
                    // Compile MJML to HTML
                    const { html, errors } = mjml2html(template.mjml, {
                        keepComments: false,
                        minify: true,
                        validationLevel: 'soft'
                    });
                    
                    if (errors.length > 0) {
                        console.warn(`MJML compilation warnings for ${name}:`, errors);
                    }
                    
                    // Compile with Handlebars
                    const handlebarsTemplate = handlebars.compile(html);
                    
                    // Store compiled template
                    compiledTemplates[name] = {
                        html: handlebarsTemplate,
                        subject: handlebars.compile(template.subject),
                        variables: template.variables
                    };
                    
                    // Cache compiled template
                    const cacheKey = `${tenantId}-${name}`;
                    this.compiledCache.set(cacheKey, compiledTemplates[name]);
                    
                    // Save compiled template
                    await this.saveCompiledTemplate(tenantId, name, html);
                    
                } catch (error) {
                    console.error(`Error compiling template ${name}: ${error.message}`);
                }
            }
        }
        
        return compiledTemplates;
    }
    
    // Send email using template
    async sendEmail(tenantId, templateName, recipientData, variables = {}) {
        try {
            console.log(`Sending ${templateName} email for tenant ${tenantId} to ${recipientData.email}`);
            
            // Get tenant branding
            const brandingConfig = await this.getTenantBranding(tenantId);
            
            // Get compiled template
            const template = await this.getCompiledTemplate(tenantId, templateName);
            
            if (!template) {
                throw new Error(`Template ${templateName} not found for tenant ${tenantId}`);
            }
            
            // Merge variables with branding data
            const emailVariables = {
                ...variables,
                brandName: brandingConfig.brand.name,
                recipientName: recipientData.name,
                recipientEmail: recipientData.email,
                currentYear: new Date().getFullYear(),
                dashboardUrl: `https://${brandingConfig.domains[0] || 'app.rootuip.com'}/dashboard`,
                unsubscribeUrl: `https://${brandingConfig.domains[0] || 'app.rootuip.com'}/unsubscribe?token=${recipientData.unsubscribeToken}`,
                preferencesUrl: `https://${brandingConfig.domains[0] || 'app.rootuip.com'}/preferences`,
                privacyUrl: `https://${brandingConfig.domains[0] || 'app.rootuip.com'}/privacy`
            };
            
            // Render HTML and subject
            const html = template.html(emailVariables);
            const subject = template.subject(emailVariables);
            
            // Send email
            const result = await this.sendViaSES({
                from: `${brandingConfig.email.fromName} <${brandingConfig.email.replyTo || 'noreply@rootuip.com'}>`,
                to: recipientData.email,
                subject,
                html,
                replyTo: brandingConfig.email.replyTo,
                tags: {
                    tenantId,
                    templateName,
                    category: template.category
                }
            });
            
            // Log email sent
            await this.logEmailSent(tenantId, templateName, recipientData.email, result.MessageId);
            
            return {
                success: true,
                messageId: result.MessageId,
                recipient: recipientData.email
            };
            
        } catch (error) {
            console.error(`Error sending email: ${error.message}`);
            throw error;
        }
    }
    
    // Send via AWS SES
    async sendViaSES(emailData) {
        const params = {
            Destination: {
                ToAddresses: [emailData.to]
            },
            Message: {
                Body: {
                    Html: {
                        Charset: 'UTF-8',
                        Data: emailData.html
                    }
                },
                Subject: {
                    Charset: 'UTF-8',
                    Data: emailData.subject
                }
            },
            Source: emailData.from,
            ReplyToAddresses: emailData.replyTo ? [emailData.replyTo] : [],
            Tags: Object.entries(emailData.tags || {}).map(([Name, Value]) => ({ Name, Value }))
        };
        
        return this.ses.sendEmail(params).promise();
    }
    
    // Update email template
    async updateEmailTemplate(tenantId, templateName, updates) {
        try {
            const template = await this.loadTemplate(tenantId, templateName);
            
            if (!template) {
                throw new Error(`Template ${templateName} not found`);
            }
            
            // Update template
            const updatedTemplate = {
                ...template,
                ...updates,
                updatedAt: new Date().toISOString(),
                version: this.incrementVersion(template.version)
            };
            
            // Save updated template
            await this.saveTemplate(tenantId, templateName, updatedTemplate);
            
            // Recompile if MJML changed
            if (updates.mjml) {
                await this.compileTemplate(tenantId, templateName, updatedTemplate);
            }
            
            // Clear cache
            this.templateCache.delete(`${tenantId}-${templateName}`);
            this.compiledCache.delete(`${tenantId}-${templateName}`);
            
            return {
                success: true,
                template: updatedTemplate
            };
            
        } catch (error) {
            console.error(`Error updating email template: ${error.message}`);
            throw error;
        }
    }
    
    // Preview email template
    async previewEmailTemplate(tenantId, templateName, sampleData = {}) {
        try {
            const template = await this.getCompiledTemplate(tenantId, templateName);
            const brandingConfig = await this.getTenantBranding(tenantId);
            
            // Default sample data
            const defaultSampleData = {
                userName: 'John Doe',
                shipmentId: 'SHP-2024-001234',
                origin: 'Shanghai, China',
                destination: 'Los Angeles, USA',
                estimatedDelivery: 'March 15, 2024',
                totalShipments: '127',
                onTimeDelivery: '96.5',
                activeShipments: '23',
                completedDeliveries: '104',
                avgTransitTime: '12.3',
                costSavings: '$15,420',
                weekStartDate: 'March 4, 2024',
                weekEndDate: 'March 10, 2024'
            };
            
            const variables = {
                ...defaultSampleData,
                ...sampleData,
                brandName: brandingConfig.brand.name
            };
            
            const html = template.html(variables);
            const subject = template.subject(variables);
            
            return {
                subject,
                html,
                variables: template.variables
            };
            
        } catch (error) {
            console.error(`Error previewing email template: ${error.message}`);
            throw error;
        }
    }
    
    // Helper functions
    registerHelpers() {
        // Date formatting
        handlebars.registerHelper('formatDate', (date, format) => {
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        });
        
        // Currency formatting
        handlebars.registerHelper('formatCurrency', (amount, currency = 'USD') => {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency
            }).format(amount);
        });
        
        // Conditional helpers
        handlebars.registerHelper('ifEquals', function(a, b, options) {
            return a === b ? options.fn(this) : options.inverse(this);
        });
    }
    
    extractVariables(template) {
        const regex = /{{([^}]+)}}/g;
        const variables = new Set();
        let match;
        
        while ((match = regex.exec(template)) !== null) {
            variables.add(match[1].trim());
        }
        
        return Array.from(variables);
    }
    
    incrementVersion(version) {
        const parts = version.split('.');
        parts[2] = parseInt(parts[2]) + 1;
        return parts.join('.');
    }
    
    // Storage functions
    async saveTemplate(tenantId, templateName, template) {
        const templatePath = path.join(this.config.templatesPath, tenantId, `${templateName}.json`);
        await fs.promises.mkdir(path.dirname(templatePath), { recursive: true });
        await fs.promises.writeFile(templatePath, JSON.stringify(template, null, 2));
    }
    
    async loadTemplate(tenantId, templateName) {
        const templatePath = path.join(this.config.templatesPath, tenantId, `${templateName}.json`);
        
        try {
            const data = await fs.promises.readFile(templatePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }
    
    async saveCompiledTemplate(tenantId, templateName, html) {
        const compiledPath = path.join(this.config.compiledPath, tenantId, `${templateName}.html`);
        await fs.promises.mkdir(path.dirname(compiledPath), { recursive: true });
        await fs.promises.writeFile(compiledPath, html);
    }
    
    async getCompiledTemplate(tenantId, templateName) {
        const cacheKey = `${tenantId}-${templateName}`;
        
        if (this.compiledCache.has(cacheKey)) {
            return this.compiledCache.get(cacheKey);
        }
        
        const template = await this.loadTemplate(tenantId, templateName);
        if (template) {
            const compiled = await this.compileTemplate(tenantId, templateName, template);
            this.compiledCache.set(cacheKey, compiled);
            return compiled;
        }
        
        return null;
    }
    
    async compileTemplate(tenantId, templateName, template) {
        const { html } = mjml2html(template.mjml, {
            keepComments: false,
            minify: true,
            validationLevel: 'soft'
        });
        
        return {
            html: handlebars.compile(html),
            subject: handlebars.compile(template.subject),
            variables: template.variables,
            category: template.category
        };
    }
    
    async getTenantBranding(tenantId) {
        // This would integrate with the branding system
        // For now, return mock data
        return {
            brand: { name: 'ROOTUIP' },
            domains: ['app.rootuip.com'],
            email: { fromName: 'ROOTUIP', replyTo: 'support@rootuip.com' }
        };
    }
    
    async logEmailSent(tenantId, templateName, recipient, messageId) {
        const log = {
            tenantId,
            templateName,
            recipient,
            messageId,
            sentAt: new Date().toISOString()
        };
        
        // Log to file or database
        console.log('Email sent:', log);
    }
}

module.exports = EmailTemplateSystem;