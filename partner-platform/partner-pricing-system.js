#!/usr/bin/env node

/**
 * ROOTUIP Partner-Specific Pricing and Co-Branded Marketing System
 * Manages dynamic pricing, marketing materials, and partner branding
 */

const { DynamoDB, S3 } = require('aws-sdk');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PartnerPricingMarketingSystem {
    constructor(config = {}) {
        this.config = {
            dynamoTableName: config.dynamoTableName || 'rootuip-partner-pricing',
            s3Bucket: config.s3Bucket || 'rootuip-partner-assets',
            baseUrl: config.baseUrl || 'https://partners.rootuip.com',
            ...config
        };
        
        this.dynamodb = new DynamoDB.DocumentClient();
        this.s3 = new S3();
        
        // Pricing models
        this.pricingModels = {
            FIXED: 'fixed',
            TIERED: 'tiered',
            VOLUME: 'volume',
            CUSTOM: 'custom',
            PERCENTAGE: 'percentage'
        };
        
        // Marketing material types
        this.materialTypes = {
            PITCH_DECK: 'pitch_deck',
            BROCHURE: 'brochure',
            CASE_STUDY: 'case_study',
            WHITE_PAPER: 'white_paper',
            EMAIL_TEMPLATE: 'email_template',
            SOCIAL_MEDIA: 'social_media',
            VIDEO: 'video',
            DEMO_SCRIPT: 'demo_script'
        };
        
        // Default pricing tiers
        this.defaultPricingTiers = this.initializeDefaultPricing();
    }
    
    // Initialize default pricing structure
    initializeDefaultPricing() {
        return {
            starter: {
                name: 'Starter',
                basePrice: 299,
                description: 'Perfect for small logistics operations',
                features: {
                    shipments: 100,
                    users: 5,
                    apiCalls: 10000,
                    storage: 10,
                    support: 'email'
                },
                addons: {
                    additionalShipments: { price: 0.50, unit: 'shipment' },
                    additionalUsers: { price: 10, unit: 'user' },
                    additionalStorage: { price: 5, unit: 'GB' }
                }
            },
            professional: {
                name: 'Professional',
                basePrice: 999,
                description: 'For growing logistics companies',
                features: {
                    shipments: 500,
                    users: 20,
                    apiCalls: 100000,
                    storage: 50,
                    support: 'priority',
                    analytics: true,
                    integrations: 3
                },
                addons: {
                    additionalShipments: { price: 0.35, unit: 'shipment' },
                    additionalUsers: { price: 8, unit: 'user' },
                    additionalStorage: { price: 3, unit: 'GB' },
                    additionalIntegrations: { price: 100, unit: 'integration' }
                }
            },
            enterprise: {
                name: 'Enterprise',
                basePrice: 2999,
                description: 'Full-featured solution for large operations',
                features: {
                    shipments: 'unlimited',
                    users: 'unlimited',
                    apiCalls: 'unlimited',
                    storage: 500,
                    support: 'dedicated',
                    analytics: true,
                    integrations: 'unlimited',
                    whiteLabel: true,
                    sla: '99.9%'
                },
                addons: {
                    dedicatedSupport: { price: 500, unit: 'month' },
                    customIntegration: { price: 2000, unit: 'integration' },
                    additionalStorage: { price: 2, unit: 'GB' }
                }
            }
        };
    }
    
    // Create partner pricing configuration
    async createPartnerPricing(partnerId, pricingConfig) {
        try {
            console.log(`Creating pricing configuration for partner: ${partnerId}`);
            
            const pricing = {
                partnerId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'active',
                
                // Pricing model
                model: pricingConfig.model || this.pricingModels.PERCENTAGE,
                
                // Base pricing adjustments
                adjustments: {
                    discount: pricingConfig.discount || 0,
                    markup: pricingConfig.markup || 0,
                    currency: pricingConfig.currency || 'USD',
                    taxRate: pricingConfig.taxRate || 0
                },
                
                // Custom pricing tiers
                tiers: await this.generatePartnerTiers(partnerId, pricingConfig),
                
                // Volume discounts
                volumeDiscounts: pricingConfig.volumeDiscounts || [
                    { minQuantity: 10, discount: 0.05 },
                    { minQuantity: 25, discount: 0.10 },
                    { minQuantity: 50, discount: 0.15 },
                    { minQuantity: 100, discount: 0.20 }
                ],
                
                // Bundle packages
                bundles: await this.createPartnerBundles(partnerId, pricingConfig),
                
                // Promotional offers
                promotions: pricingConfig.promotions || [],
                
                // Payment terms
                paymentTerms: {
                    net: pricingConfig.paymentNet || 30,
                    earlyPaymentDiscount: pricingConfig.earlyPaymentDiscount || 0.02,
                    earlyPaymentDays: pricingConfig.earlyPaymentDays || 10,
                    acceptedMethods: pricingConfig.acceptedMethods || ['credit_card', 'ach', 'wire']
                },
                
                // Commission structure
                commission: {
                    rate: pricingConfig.commissionRate || 0.20,
                    model: pricingConfig.commissionModel || 'recurring',
                    payoutSchedule: pricingConfig.payoutSchedule || 'monthly',
                    minimumPayout: pricingConfig.minimumPayout || 100
                }
            };
            
            // Save pricing configuration
            await this.dynamodb.put({
                TableName: this.config.dynamoTableName,
                Item: pricing
            }).promise();
            
            // Generate pricing sheets
            await this.generatePricingSheets(partnerId, pricing);
            
            console.log(`Partner pricing created successfully for: ${partnerId}`);
            return {
                success: true,
                pricing
            };
            
        } catch (error) {
            console.error(`Error creating partner pricing: ${error.message}`);
            throw error;
        }
    }
    
    // Generate partner-specific pricing tiers
    async generatePartnerTiers(partnerId, config) {
        const baseTiers = { ...this.defaultPricingTiers };
        const partnerTiers = {};
        
        for (const [tierName, tier] of Object.entries(baseTiers)) {
            const partnerTier = { ...tier };
            
            // Apply partner adjustments
            if (config.model === this.pricingModels.PERCENTAGE) {
                // Percentage-based pricing
                const adjustment = 1 - (config.discount || 0) + (config.markup || 0);
                partnerTier.basePrice = Math.round(tier.basePrice * adjustment);
                
                // Adjust addon prices
                for (const [addonName, addon] of Object.entries(partnerTier.addons || {})) {
                    addon.price = Math.round(addon.price * adjustment * 100) / 100;
                }
            } else if (config.model === this.pricingModels.FIXED) {
                // Fixed pricing override
                if (config.fixedPrices?.[tierName]) {
                    partnerTier.basePrice = config.fixedPrices[tierName];
                }
            }
            
            // Add partner-specific features
            if (config.additionalFeatures?.[tierName]) {
                partnerTier.features = {
                    ...partnerTier.features,
                    ...config.additionalFeatures[tierName]
                };
            }
            
            // Custom tier names
            if (config.customTierNames?.[tierName]) {
                partnerTier.name = config.customTierNames[tierName];
            }
            
            // Partner branding
            partnerTier.partnerId = partnerId;
            partnerTier.customDescription = config.tierDescriptions?.[tierName] || partnerTier.description;
            
            partnerTiers[tierName] = partnerTier;
        }
        
        // Add custom tiers
        if (config.customTiers) {
            for (const [tierName, tierConfig] of Object.entries(config.customTiers)) {
                partnerTiers[tierName] = {
                    name: tierConfig.name,
                    basePrice: tierConfig.price,
                    description: tierConfig.description,
                    features: tierConfig.features,
                    addons: tierConfig.addons || {},
                    partnerId,
                    custom: true
                };
            }
        }
        
        return partnerTiers;
    }
    
    // Create partner bundles
    async createPartnerBundles(partnerId, config) {
        const bundles = [];
        
        // Industry-specific bundles
        const industryBundles = {
            freight_forwarding: {
                name: 'Freight Forwarder Suite',
                description: 'Complete solution for freight forwarding operations',
                components: ['professional', 'customs_integration', 'carrier_integration'],
                discount: 0.15,
                features: {
                    customsManagement: true,
                    multiCarrier: true,
                    documentGeneration: true,
                    clientPortal: true
                }
            },
            third_party_logistics: {
                name: '3PL Management Platform',
                description: 'Comprehensive 3PL warehouse and fulfillment solution',
                components: ['enterprise', 'warehouse_integration', 'inventory_module'],
                discount: 0.20,
                features: {
                    warehouseManagement: true,
                    inventoryTracking: true,
                    crossDocking: true,
                    billingAutomation: true
                }
            },
            shipping_lines: {
                name: 'Container Line Solution',
                description: 'Specialized for container shipping lines',
                components: ['enterprise', 'vessel_tracking', 'container_module'],
                discount: 0.18,
                features: {
                    vesselTracking: true,
                    containerManagement: true,
                    portOperations: true,
                    bookingManagement: true
                }
            }
        };
        
        // Create partner-specific bundles
        if (config.targetIndustries) {
            for (const industry of config.targetIndustries) {
                if (industryBundles[industry]) {
                    const bundle = { ...industryBundles[industry] };
                    
                    // Calculate bundle price
                    let totalPrice = 0;
                    for (const component of bundle.components) {
                        if (component.includes('integration') || component.includes('module')) {
                            totalPrice += 500; // Add-on pricing
                        } else {
                            totalPrice += this.defaultPricingTiers[component]?.basePrice || 0;
                        }
                    }
                    
                    bundle.regularPrice = totalPrice;
                    bundle.bundlePrice = Math.round(totalPrice * (1 - bundle.discount));
                    bundle.savings = totalPrice - bundle.bundlePrice;
                    bundle.partnerId = partnerId;
                    
                    bundles.push(bundle);
                }
            }
        }
        
        // Custom bundles
        if (config.customBundles) {
            for (const customBundle of config.customBundles) {
                bundles.push({
                    ...customBundle,
                    partnerId
                });
            }
        }
        
        return bundles;
    }
    
    // Generate pricing sheets
    async generatePricingSheets(partnerId, pricing) {
        try {
            // Generate PDF pricing sheet
            const pdfPath = await this.generatePDFPricingSheet(partnerId, pricing);
            
            // Generate Excel pricing calculator
            const excelPath = await this.generateExcelCalculator(partnerId, pricing);
            
            // Generate web-based pricing page
            const webPath = await this.generateWebPricingPage(partnerId, pricing);
            
            // Upload to S3
            const assets = {
                pdf: await this.uploadToS3(pdfPath, `partners/${partnerId}/pricing/pricing-sheet.pdf`),
                excel: await this.uploadToS3(excelPath, `partners/${partnerId}/pricing/pricing-calculator.xlsx`),
                web: webPath
            };
            
            return assets;
            
        } catch (error) {
            console.error(`Error generating pricing sheets: ${error.message}`);
            throw error;
        }
    }
    
    // Generate PDF pricing sheet
    async generatePDFPricingSheet(partnerId, pricing) {
        const doc = new PDFDocument({
            size: 'A4',
            margins: { top: 50, bottom: 50, left: 50, right: 50 }
        });
        
        const pdfPath = `/tmp/${partnerId}-pricing-sheet.pdf`;
        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);
        
        // Get partner info
        const partner = await this.getPartnerInfo(partnerId);
        
        // Header with co-branding
        doc.fontSize(24)
           .fillColor('#1a365d')
           .text('ROOTUIP Platform Pricing', { align: 'center' });
        
        doc.fontSize(14)
           .fillColor('#4a5568')
           .text(`Prepared for ${partner.companyName}`, { align: 'center' })
           .moveDown(2);
        
        // Pricing tiers
        doc.fontSize(18)
           .fillColor('#2d3748')
           .text('Subscription Plans')
           .moveDown();
        
        for (const [tierName, tier] of Object.entries(pricing.tiers)) {
            // Tier header
            doc.fontSize(16)
               .fillColor('#3182ce')
               .text(tier.name)
               .fontSize(20)
               .fillColor('#2d3748')
               .text(`$${tier.basePrice}/month`, { continued: true })
               .fontSize(12)
               .fillColor('#718096')
               .text(` (${pricing.adjustments.currency})`)
               .moveDown(0.5);
            
            // Description
            doc.fontSize(11)
               .fillColor('#4a5568')
               .text(tier.customDescription || tier.description)
               .moveDown(0.5);
            
            // Features
            doc.fontSize(10)
               .fillColor('#2d3748');
            
            for (const [feature, value] of Object.entries(tier.features)) {
                let displayValue = value;
                if (typeof value === 'boolean') {
                    displayValue = value ? '✓' : '✗';
                } else if (value === 'unlimited') {
                    displayValue = 'Unlimited';
                }
                
                doc.text(`• ${this.formatFeatureName(feature)}: ${displayValue}`);
            }
            
            doc.moveDown(1.5);
        }
        
        // Volume discounts
        if (pricing.volumeDiscounts.length > 0) {
            doc.addPage()
               .fontSize(18)
               .fillColor('#2d3748')
               .text('Volume Discounts')
               .moveDown();
            
            doc.fontSize(11)
               .fillColor('#4a5568');
            
            for (const discount of pricing.volumeDiscounts) {
                doc.text(`• ${discount.minQuantity}+ licenses: ${discount.discount * 100}% discount`);
            }
            
            doc.moveDown();
        }
        
        // Bundles
        if (pricing.bundles.length > 0) {
            doc.fontSize(18)
               .fillColor('#2d3748')
               .text('Solution Bundles')
               .moveDown();
            
            for (const bundle of pricing.bundles) {
                doc.fontSize(14)
                   .fillColor('#3182ce')
                   .text(bundle.name)
                   .fontSize(11)
                   .fillColor('#4a5568')
                   .text(bundle.description)
                   .moveDown(0.5);
                
                doc.fontSize(12)
                   .fillColor('#2d3748')
                   .text(`Regular Price: $${bundle.regularPrice}`, { strikethrough: true })
                   .fillColor('#48bb78')
                   .text(`Bundle Price: $${bundle.bundlePrice} (Save $${bundle.savings})`)
                   .moveDown();
            }
        }
        
        // Payment terms
        doc.addPage()
           .fontSize(18)
           .fillColor('#2d3748')
           .text('Payment Terms')
           .moveDown()
           .fontSize(11)
           .fillColor('#4a5568')
           .text(`• Net ${pricing.paymentTerms.net} days`)
           .text(`• ${pricing.paymentTerms.earlyPaymentDiscount * 100}% discount for payment within ${pricing.paymentTerms.earlyPaymentDays} days`)
           .text(`• Accepted payment methods: ${pricing.paymentTerms.acceptedMethods.join(', ')}`)
           .moveDown();
        
        // Partner commission
        if (partner.type === 'reseller') {
            doc.fontSize(18)
               .fillColor('#2d3748')
               .text('Partner Commission')
               .moveDown()
               .fontSize(11)
               .fillColor('#4a5568')
               .text(`• Commission rate: ${pricing.commission.rate * 100}%`)
               .text(`• Commission model: ${pricing.commission.model}`)
               .text(`• Payout schedule: ${pricing.commission.payoutSchedule}`)
               .text(`• Minimum payout: $${pricing.commission.minimumPayout}`);
        }
        
        // Footer
        doc.fontSize(9)
           .fillColor('#a0aec0')
           .text(`Generated on ${new Date().toLocaleDateString()}`, 50, 750, { align: 'center' })
           .text('Pricing subject to change. Contact your account manager for custom pricing.', { align: 'center' });
        
        doc.end();
        
        await new Promise(resolve => stream.on('finish', resolve));
        
        return pdfPath;
    }
    
    // Generate Excel pricing calculator
    async generateExcelCalculator(partnerId, pricing) {
        // This would use a library like exceljs to create an interactive pricing calculator
        // For now, return a placeholder
        const excelPath = `/tmp/${partnerId}-pricing-calculator.xlsx`;
        
        // Mock implementation
        fs.writeFileSync(excelPath, 'Excel pricing calculator placeholder');
        
        return excelPath;
    }
    
    // Generate web pricing page
    async generateWebPricingPage(partnerId, pricing) {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ROOTUIP Pricing - ${partnerId}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2d3748; }
        .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 3rem; }
        .header h1 { color: #1a365d; font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header p { color: #718096; font-size: 1.25rem; }
        .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; margin-bottom: 3rem; }
        .pricing-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: transform 0.2s, box-shadow 0.2s; }
        .pricing-card:hover { transform: translateY(-4px); box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .pricing-card.featured { border-color: #3182ce; position: relative; }
        .pricing-card.featured::before { content: 'MOST POPULAR'; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: #3182ce; color: white; padding: 0.25rem 1rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
        .tier-name { font-size: 1.5rem; font-weight: 600; color: #2d3748; margin-bottom: 0.5rem; }
        .tier-price { font-size: 2.5rem; font-weight: 700; color: #1a365d; margin-bottom: 0.5rem; }
        .tier-price span { font-size: 1rem; font-weight: 400; color: #718096; }
        .tier-description { color: #718096; margin-bottom: 1.5rem; }
        .features { list-style: none; }
        .features li { padding: 0.5rem 0; border-bottom: 1px solid #f7fafc; display: flex; align-items: center; }
        .features li:last-child { border-bottom: none; }
        .features li::before { content: '✓'; color: #48bb78; font-weight: 600; margin-right: 0.5rem; }
        .cta-button { display: block; width: 100%; padding: 0.75rem 1.5rem; background: #3182ce; color: white; text-align: center; text-decoration: none; border-radius: 0.375rem; font-weight: 600; transition: background 0.2s; margin-top: 1.5rem; }
        .cta-button:hover { background: #2c5282; }
        .bundles { background: #f7fafc; padding: 3rem 0; margin: 0 -2rem; }
        .bundles .container { padding: 0 2rem; }
        .bundle-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 2rem; margin-top: 2rem; }
        .bundle-card { background: white; padding: 2rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; }
        .bundle-name { font-size: 1.25rem; font-weight: 600; color: #2d3748; margin-bottom: 0.5rem; }
        .bundle-description { color: #718096; margin-bottom: 1rem; }
        .bundle-pricing { display: flex; align-items: baseline; gap: 1rem; margin-bottom: 1rem; }
        .regular-price { color: #a0aec0; text-decoration: line-through; }
        .bundle-price { font-size: 1.5rem; font-weight: 700; color: #48bb78; }
        .savings { color: #48bb78; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Choose Your ROOTUIP Plan</h1>
            <p>Flexible pricing options for logistics operations of all sizes</p>
        </div>
        
        <div class="pricing-grid">
            ${Object.entries(pricing.tiers).map(([tierName, tier], index) => `
                <div class="pricing-card ${index === 1 ? 'featured' : ''}">
                    <h3 class="tier-name">${tier.name}</h3>
                    <div class="tier-price">
                        $${tier.basePrice}<span>/month</span>
                    </div>
                    <p class="tier-description">${tier.customDescription || tier.description}</p>
                    <ul class="features">
                        ${Object.entries(tier.features).map(([feature, value]) => {
                            let display = value;
                            if (typeof value === 'boolean') {
                                display = value ? this.formatFeatureName(feature) : '';
                            } else if (value === 'unlimited') {
                                display = `Unlimited ${this.formatFeatureName(feature)}`;
                            } else {
                                display = `${value} ${this.formatFeatureName(feature)}`;
                            }
                            return display ? `<li>${display}</li>` : '';
                        }).filter(Boolean).join('')}
                    </ul>
                    <a href="#contact" class="cta-button">Get Started</a>
                </div>
            `).join('')}
        </div>
        
        ${pricing.bundles.length > 0 ? `
        <div class="bundles">
            <div class="container">
                <h2 style="text-align: center; margin-bottom: 1rem; color: #1a365d;">Industry-Specific Solutions</h2>
                <p style="text-align: center; color: #718096; margin-bottom: 2rem;">Pre-configured bundles tailored to your industry needs</p>
                <div class="bundle-grid">
                    ${pricing.bundles.map(bundle => `
                        <div class="bundle-card">
                            <h3 class="bundle-name">${bundle.name}</h3>
                            <p class="bundle-description">${bundle.description}</p>
                            <div class="bundle-pricing">
                                <span class="regular-price">$${bundle.regularPrice}</span>
                                <span class="bundle-price">$${bundle.bundlePrice}</span>
                            </div>
                            <p class="savings">Save $${bundle.savings} (${Math.round(bundle.discount * 100)}% off)</p>
                            <a href="#contact" class="cta-button">Learn More</a>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        ` : ''}
    </div>
</body>
</html>
        `;
        
        const webPath = `/tmp/${partnerId}-pricing.html`;
        fs.writeFileSync(webPath, html);
        
        return webPath;
    }
    
    // Create co-branded marketing materials
    async createCoBrandedMaterials(partnerId, brandingConfig) {
        try {
            console.log(`Creating co-branded materials for partner: ${partnerId}`);
            
            const materials = {
                partnerId,
                createdAt: new Date().toISOString(),
                brandingConfig,
                assets: {}
            };
            
            // Generate pitch deck
            materials.assets.pitchDeck = await this.generatePitchDeck(partnerId, brandingConfig);
            
            // Generate brochures
            materials.assets.brochures = await this.generateBrochures(partnerId, brandingConfig);
            
            // Generate case studies
            materials.assets.caseStudies = await this.generateCaseStudies(partnerId, brandingConfig);
            
            // Generate email templates
            materials.assets.emailTemplates = await this.generateEmailTemplates(partnerId, brandingConfig);
            
            // Generate social media assets
            materials.assets.socialMedia = await this.generateSocialMediaAssets(partnerId, brandingConfig);
            
            // Generate demo scripts
            materials.assets.demoScripts = await this.generateDemoScripts(partnerId, brandingConfig);
            
            // Store material configuration
            await this.dynamodb.put({
                TableName: `${this.config.dynamoTableName}-materials`,
                Item: materials
            }).promise();
            
            console.log(`Co-branded materials created successfully for partner: ${partnerId}`);
            return {
                success: true,
                materials
            };
            
        } catch (error) {
            console.error(`Error creating co-branded materials: ${error.message}`);
            throw error;
        }
    }
    
    // Generate pitch deck
    async generatePitchDeck(partnerId, brandingConfig) {
        const slides = [
            {
                title: 'Transform Your Logistics Operations',
                subtitle: `${brandingConfig.partnerName} + ROOTUIP`,
                content: 'Comprehensive logistics management platform'
            },
            {
                title: 'The Challenge',
                bullets: [
                    'Fragmented logistics data across multiple systems',
                    'Limited real-time visibility',
                    'Manual processes and inefficiencies',
                    'Difficulty scaling operations'
                ]
            },
            {
                title: 'The Solution',
                bullets: [
                    'Unified platform for all logistics operations',
                    'Real-time tracking and visibility',
                    'Automated workflows and AI-powered insights',
                    'Scalable cloud infrastructure'
                ]
            },
            {
                title: 'Key Features',
                features: [
                    { name: 'Shipment Tracking', description: 'Real-time visibility across all modes' },
                    { name: 'Container Management', description: 'Complete container lifecycle tracking' },
                    { name: 'Document Management', description: 'Digital document processing and storage' },
                    { name: 'Analytics & Reporting', description: 'Advanced analytics and custom reports' }
                ]
            },
            {
                title: 'ROI & Benefits',
                metrics: [
                    { metric: '30%', description: 'Reduction in operational costs' },
                    { metric: '50%', description: 'Faster document processing' },
                    { metric: '25%', description: 'Improvement in on-time delivery' },
                    { metric: '40%', description: 'Increase in team productivity' }
                ]
            },
            {
                title: 'Implementation Process',
                phases: [
                    { phase: 'Discovery', duration: '1 week', activities: 'Requirements gathering and planning' },
                    { phase: 'Setup', duration: '2 weeks', activities: 'Platform configuration and integration' },
                    { phase: 'Training', duration: '1 week', activities: 'User training and onboarding' },
                    { phase: 'Go-Live', duration: 'Ongoing', activities: 'Launch and continuous support' }
                ]
            }
        ];
        
        // Generate PowerPoint file (mock implementation)
        const deckPath = `/tmp/${partnerId}-pitch-deck.pptx`;
        fs.writeFileSync(deckPath, JSON.stringify(slides, null, 2));
        
        // Upload to S3
        const s3Key = `partners/${partnerId}/materials/pitch-deck.pptx`;
        await this.uploadToS3(deckPath, s3Key);
        
        return {
            type: this.materialTypes.PITCH_DECK,
            url: `${this.config.baseUrl}/${s3Key}`,
            slides: slides.length,
            customizable: true
        };
    }
    
    // Generate brochures
    async generateBrochures(partnerId, brandingConfig) {
        const brochures = [];
        
        // Product overview brochure
        const overviewBrochure = await this.generateBrochure(partnerId, {
            title: 'ROOTUIP Platform Overview',
            type: 'product_overview',
            sections: [
                { title: 'Platform Overview', content: 'Comprehensive logistics management...' },
                { title: 'Key Features', content: 'Real-time tracking, automation...' },
                { title: 'Benefits', content: 'Reduce costs, improve efficiency...' },
                { title: 'Get Started', content: 'Contact us for a demo...' }
            ],
            branding: brandingConfig
        });
        brochures.push(overviewBrochure);
        
        // Industry-specific brochures
        const industries = ['freight_forwarding', '3pl', 'shipping_lines'];
        for (const industry of industries) {
            const industryBrochure = await this.generateBrochure(partnerId, {
                title: `ROOTUIP for ${this.formatIndustryName(industry)}`,
                type: `industry_${industry}`,
                sections: this.getIndustryContent(industry),
                branding: brandingConfig
            });
            brochures.push(industryBrochure);
        }
        
        return brochures;
    }
    
    // Generate case studies
    async generateCaseStudies(partnerId, brandingConfig) {
        const caseStudies = [
            {
                title: 'Global Freight Forwarder Reduces Costs by 30%',
                client: 'Leading International Freight Forwarder',
                industry: 'Freight Forwarding',
                challenge: 'Fragmented systems and manual processes',
                solution: 'Implemented ROOTUIP unified platform',
                results: [
                    '30% reduction in operational costs',
                    '50% faster shipment processing',
                    '99.9% shipment visibility'
                ],
                testimonial: 'ROOTUIP transformed our operations...'
            },
            {
                title: '3PL Provider Scales Operations 3x',
                client: 'Regional 3PL Provider',
                industry: 'Third-Party Logistics',
                challenge: 'Unable to scale with growing demand',
                solution: 'Deployed ROOTUIP cloud platform',
                results: [
                    '3x growth without adding staff',
                    '40% improvement in warehouse efficiency',
                    '25% reduction in fulfillment errors'
                ],
                testimonial: 'The scalability has been game-changing...'
            }
        ];
        
        const processedCaseStudies = [];
        for (const caseStudy of caseStudies) {
            const pdfPath = await this.generateCaseStudyPDF(partnerId, caseStudy, brandingConfig);
            const s3Key = `partners/${partnerId}/materials/case-studies/${caseStudy.title.toLowerCase().replace(/\s+/g, '-')}.pdf`;
            await this.uploadToS3(pdfPath, s3Key);
            
            processedCaseStudies.push({
                ...caseStudy,
                type: this.materialTypes.CASE_STUDY,
                url: `${this.config.baseUrl}/${s3Key}`
            });
        }
        
        return processedCaseStudies;
    }
    
    // Generate email templates
    async generateEmailTemplates(partnerId, brandingConfig) {
        const templates = [
            {
                name: 'Introduction Email',
                subject: 'Transform Your Logistics Operations with ROOTUIP',
                type: 'introduction',
                personalization: ['recipientName', 'companyName', 'industry']
            },
            {
                name: 'Follow-up Email',
                subject: 'Following up on ROOTUIP Demo',
                type: 'follow_up',
                personalization: ['recipientName', 'demoDate', 'nextSteps']
            },
            {
                name: 'ROI Analysis Email',
                subject: 'Your Personalized ROOTUIP ROI Analysis',
                type: 'roi_analysis',
                personalization: ['recipientName', 'companyName', 'savings', 'efficiency']
            },
            {
                name: 'Case Study Email',
                subject: 'See How {{similarCompany}} Transformed Their Logistics',
                type: 'case_study',
                personalization: ['recipientName', 'similarCompany', 'industry', 'results']
            }
        ];
        
        const processedTemplates = [];
        for (const template of templates) {
            const htmlTemplate = await this.generateEmailTemplate(partnerId, template, brandingConfig);
            const s3Key = `partners/${partnerId}/materials/email-templates/${template.type}.html`;
            await this.uploadToS3(htmlTemplate, s3Key);
            
            processedTemplates.push({
                ...template,
                type: this.materialTypes.EMAIL_TEMPLATE,
                url: `${this.config.baseUrl}/${s3Key}`,
                preview: `${this.config.baseUrl}/${s3Key}?preview=true`
            });
        }
        
        return processedTemplates;
    }
    
    // Generate social media assets
    async generateSocialMediaAssets(partnerId, brandingConfig) {
        const assets = [];
        
        // LinkedIn posts
        const linkedInPosts = [
            {
                type: 'announcement',
                text: `Excited to partner with ROOTUIP to bring cutting-edge logistics technology to our clients! 🚀`,
                image: 'partnership-announcement.png'
            },
            {
                type: 'case_study',
                text: `See how we helped a client reduce logistics costs by 30% with ROOTUIP platform 📊`,
                image: 'case-study-results.png'
            },
            {
                type: 'feature_highlight',
                text: `Real-time shipment tracking across all modes - just one of the powerful features in ROOTUIP platform 🌍`,
                image: 'feature-tracking.png'
            }
        ];
        
        // Generate images for each post
        for (const post of linkedInPosts) {
            const imagePath = await this.generateSocialMediaImage(partnerId, post, brandingConfig);
            const s3Key = `partners/${partnerId}/materials/social-media/linkedin/${post.image}`;
            await this.uploadToS3(imagePath, s3Key);
            
            assets.push({
                platform: 'linkedin',
                type: post.type,
                text: post.text,
                imageUrl: `${this.config.baseUrl}/${s3Key}`,
                dimensions: { width: 1200, height: 627 }
            });
        }
        
        return assets;
    }
    
    // Generate demo scripts
    async generateDemoScripts(partnerId, brandingConfig) {
        const scripts = [
            {
                name: 'Standard Demo Script',
                duration: '30 minutes',
                audience: 'General',
                sections: [
                    { title: 'Introduction', duration: '5 min', talking_points: ['Partner introduction', 'ROOTUIP overview'] },
                    { title: 'Platform Tour', duration: '15 min', talking_points: ['Dashboard', 'Shipment tracking', 'Reports'] },
                    { title: 'Use Cases', duration: '5 min', talking_points: ['Industry examples', 'ROI metrics'] },
                    { title: 'Q&A', duration: '5 min', talking_points: ['Address questions', 'Next steps'] }
                ]
            },
            {
                name: 'Executive Demo Script',
                duration: '15 minutes',
                audience: 'C-Level',
                sections: [
                    { title: 'Business Value', duration: '5 min', talking_points: ['ROI', 'Strategic benefits'] },
                    { title: 'High-Level Demo', duration: '5 min', talking_points: ['Dashboard', 'Analytics'] },
                    { title: 'Implementation', duration: '3 min', talking_points: ['Timeline', 'Support'] },
                    { title: 'Next Steps', duration: '2 min', talking_points: ['Proposal', 'Pilot program'] }
                ]
            }
        ];
        
        const processedScripts = [];
        for (const script of scripts) {
            const scriptPath = `/tmp/${partnerId}-demo-script-${script.name.toLowerCase().replace(/\s+/g, '-')}.pdf`;
            fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
            
            const s3Key = `partners/${partnerId}/materials/demo-scripts/${script.name.toLowerCase().replace(/\s+/g, '-')}.pdf`;
            await this.uploadToS3(scriptPath, s3Key);
            
            processedScripts.push({
                ...script,
                type: this.materialTypes.DEMO_SCRIPT,
                url: `${this.config.baseUrl}/${s3Key}`,
                customizable: true
            });
        }
        
        return processedScripts;
    }
    
    // Calculate quote for customer
    async calculateQuote(partnerId, quoteRequest) {
        try {
            const pricing = await this.getPartnerPricing(partnerId);
            
            const quote = {
                id: `Q-${Date.now()}`,
                partnerId,
                customer: quoteRequest.customer,
                createdAt: new Date().toISOString(),
                validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                items: [],
                subtotal: 0,
                discounts: [],
                tax: 0,
                total: 0
            };
            
            // Add subscription
            const tier = pricing.tiers[quoteRequest.plan];
            if (tier) {
                const subscriptionItem = {
                    type: 'subscription',
                    name: `${tier.name} Plan`,
                    description: tier.description,
                    quantity: quoteRequest.users || 1,
                    unitPrice: tier.basePrice,
                    total: tier.basePrice * (quoteRequest.users || 1)
                };
                
                quote.items.push(subscriptionItem);
                quote.subtotal += subscriptionItem.total;
            }
            
            // Add addons
            if (quoteRequest.addons) {
                for (const addon of quoteRequest.addons) {
                    const addonConfig = tier.addons[addon.type];
                    if (addonConfig) {
                        const addonItem = {
                            type: 'addon',
                            name: this.formatFeatureName(addon.type),
                            quantity: addon.quantity,
                            unitPrice: addonConfig.price,
                            total: addonConfig.price * addon.quantity
                        };
                        
                        quote.items.push(addonItem);
                        quote.subtotal += addonItem.total;
                    }
                }
            }
            
            // Apply volume discounts
            const volumeDiscount = this.calculateVolumeDiscount(
                quoteRequest.users || 1,
                pricing.volumeDiscounts
            );
            
            if (volumeDiscount > 0) {
                quote.discounts.push({
                    name: 'Volume Discount',
                    amount: quote.subtotal * volumeDiscount
                });
            }
            
            // Apply partner discount
            if (pricing.adjustments.discount > 0) {
                quote.discounts.push({
                    name: 'Partner Discount',
                    amount: quote.subtotal * pricing.adjustments.discount
                });
            }
            
            // Calculate totals
            const totalDiscounts = quote.discounts.reduce((sum, d) => sum + d.amount, 0);
            const discountedSubtotal = quote.subtotal - totalDiscounts;
            quote.tax = discountedSubtotal * (pricing.adjustments.taxRate || 0);
            quote.total = discountedSubtotal + quote.tax;
            
            // Generate quote document
            const quotePDF = await this.generateQuotePDF(quote, pricing);
            quote.documentUrl = quotePDF;
            
            return quote;
            
        } catch (error) {
            console.error(`Error calculating quote: ${error.message}`);
            throw error;
        }
    }
    
    // Utility functions
    async getPartnerPricing(partnerId) {
        const result = await this.dynamodb.get({
            TableName: this.config.dynamoTableName,
            Key: { partnerId }
        }).promise();
        
        return result.Item;
    }
    
    async getPartnerInfo(partnerId) {
        // Mock partner info
        return {
            id: partnerId,
            companyName: 'Partner Company',
            type: 'reseller'
        };
    }
    
    formatFeatureName(feature) {
        return feature
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }
    
    formatIndustryName(industry) {
        const names = {
            freight_forwarding: 'Freight Forwarding',
            '3pl': 'Third-Party Logistics',
            shipping_lines: 'Shipping Lines'
        };
        
        return names[industry] || industry;
    }
    
    getIndustryContent(industry) {
        const content = {
            freight_forwarding: [
                { title: 'Industry Challenges', content: 'Complex documentation, multi-modal coordination...' },
                { title: 'ROOTUIP Solutions', content: 'Unified platform, automated documentation...' },
                { title: 'Key Benefits', content: 'Faster quotes, improved visibility...' }
            ],
            '3pl': [
                { title: 'Industry Challenges', content: 'Inventory management, client portals...' },
                { title: 'ROOTUIP Solutions', content: 'WMS integration, white-label portals...' },
                { title: 'Key Benefits', content: 'Increased efficiency, client satisfaction...' }
            ],
            shipping_lines: [
                { title: 'Industry Challenges', content: 'Container tracking, port congestion...' },
                { title: 'ROOTUIP Solutions', content: 'Real-time tracking, predictive analytics...' },
                { title: 'Key Benefits', content: 'Optimized operations, reduced delays...' }
            ]
        };
        
        return content[industry] || [];
    }
    
    calculateVolumeDiscount(quantity, volumeDiscounts) {
        let discount = 0;
        
        for (const tier of volumeDiscounts.sort((a, b) => b.minQuantity - a.minQuantity)) {
            if (quantity >= tier.minQuantity) {
                discount = tier.discount;
                break;
            }
        }
        
        return discount;
    }
    
    async uploadToS3(filePath, s3Key) {
        const fileContent = fs.readFileSync(filePath);
        
        await this.s3.putObject({
            Bucket: this.config.s3Bucket,
            Key: s3Key,
            Body: fileContent,
            ContentType: this.getContentType(filePath)
        }).promise();
        
        return `https://${this.config.s3Bucket}.s3.amazonaws.com/${s3Key}`;
    }
    
    getContentType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const types = {
            '.pdf': 'application/pdf',
            '.html': 'text/html',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };
        
        return types[ext] || 'application/octet-stream';
    }
    
    async generateBrochure(partnerId, config) {
        // Mock implementation
        const brochurePath = `/tmp/${partnerId}-${config.type}-brochure.pdf`;
        fs.writeFileSync(brochurePath, JSON.stringify(config, null, 2));
        
        const s3Key = `partners/${partnerId}/materials/brochures/${config.type}.pdf`;
        await this.uploadToS3(brochurePath, s3Key);
        
        return {
            type: this.materialTypes.BROCHURE,
            name: config.title,
            url: `${this.config.baseUrl}/${s3Key}`,
            pages: config.sections.length + 2
        };
    }
    
    async generateCaseStudyPDF(partnerId, caseStudy, brandingConfig) {
        // Mock implementation
        const pdfPath = `/tmp/${partnerId}-case-study.pdf`;
        fs.writeFileSync(pdfPath, JSON.stringify(caseStudy, null, 2));
        
        return pdfPath;
    }
    
    async generateEmailTemplate(partnerId, template, brandingConfig) {
        // Mock implementation
        const html = `
            <html>
                <head><title>${template.subject}</title></head>
                <body>
                    <h1>${template.name}</h1>
                    <p>Email template for ${partnerId}</p>
                </body>
            </html>
        `;
        
        const templatePath = `/tmp/${partnerId}-${template.type}-email.html`;
        fs.writeFileSync(templatePath, html);
        
        return templatePath;
    }
    
    async generateSocialMediaImage(partnerId, post, brandingConfig) {
        // Mock implementation - would use sharp to generate actual images
        const imagePath = `/tmp/${partnerId}-${post.image}`;
        
        // Create a simple placeholder image
        const image = await sharp({
            create: {
                width: 1200,
                height: 627,
                channels: 4,
                background: { r: 26, g: 54, b: 93, alpha: 1 }
            }
        })
        .png()
        .toFile(imagePath);
        
        return imagePath;
    }
    
    async generateQuotePDF(quote, pricing) {
        // Mock implementation
        const pdfPath = `/tmp/${quote.id}-quote.pdf`;
        fs.writeFileSync(pdfPath, JSON.stringify(quote, null, 2));
        
        const s3Key = `partners/${quote.partnerId}/quotes/${quote.id}.pdf`;
        await this.uploadToS3(pdfPath, s3Key);
        
        return `${this.config.baseUrl}/${s3Key}`;
    }
}

module.exports = PartnerPricingMarketingSystem;