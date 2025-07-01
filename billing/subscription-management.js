#!/usr/bin/env node

/**
 * ROOTUIP Subscription Management System
 * Stripe integration for enterprise billing with usage-based pricing
 */

const stripe = require('stripe')('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');
const { Pool } = require('pg');
const Redis = require('ioredis');
const { EventEmitter } = require('events');
const moment = require('moment');
const BigNumber = require('bignumber.js');

class SubscriptionManagementSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            databaseUrl: config.databaseUrl || process.env.DATABASE_URL,
            redisUrl: config.redisUrl || process.env.REDIS_URL,
            webhookSecret: config.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET,
            taxJarApiKey: config.taxJarApiKey || process.env.TAXJAR_API_KEY,
            ...config
        };
        
        // Database connection
        this.db = new Pool({
            connectionString: this.config.databaseUrl,
            max: 20
        });
        
        // Redis for caching
        this.redis = new Redis(this.config.redisUrl);
        
        // Pricing tiers
        this.pricingTiers = this.initializePricingTiers();
        
        // Usage-based components
        this.usageComponents = this.initializeUsageComponents();
        
        // Contract manager
        this.contractManager = new ContractManager(this);
        
        // Billing calculator
        this.billingCalculator = new BillingCalculator(this);
        
        // Tax calculator
        this.taxCalculator = new TaxCalculator(this);
        
        // Initialize system
        this.initialize();
    }
    
    // Initialize pricing tiers
    initializePricingTiers() {
        return {
            starter: {
                id: 'price_starter_monthly',
                name: 'Starter',
                basePrice: 299,
                interval: 'month',
                features: {
                    users: 10,
                    shipments: 1000,
                    apiCalls: 100000,
                    storage: 100, // GB
                    support: 'email',
                    customIntegrations: 0
                },
                overage: {
                    users: 10, // per user
                    shipments: 0.25, // per shipment
                    apiCalls: 0.001, // per call
                    storage: 1 // per GB
                }
            },
            professional: {
                id: 'price_professional_monthly',
                name: 'Professional',
                basePrice: 999,
                interval: 'month',
                features: {
                    users: 50,
                    shipments: 10000,
                    apiCalls: 1000000,
                    storage: 500,
                    support: 'priority',
                    customIntegrations: 3
                },
                overage: {
                    users: 8,
                    shipments: 0.20,
                    apiCalls: 0.0008,
                    storage: 0.80
                }
            },
            enterprise: {
                id: 'price_enterprise_monthly',
                name: 'Enterprise',
                basePrice: 2999,
                interval: 'month',
                features: {
                    users: -1, // Unlimited
                    shipments: 50000,
                    apiCalls: 10000000,
                    storage: 2000,
                    support: 'dedicated',
                    customIntegrations: -1 // Unlimited
                },
                overage: {
                    shipments: 0.15,
                    apiCalls: 0.0005,
                    storage: 0.60
                },
                customPricing: true
            },
            custom: {
                id: 'price_custom',
                name: 'Custom',
                basePrice: null, // Negotiated
                interval: 'month',
                features: {
                    // All custom
                },
                requiresContract: true
            }
        };
    }
    
    // Initialize usage-based components
    initializeUsageComponents() {
        return {
            shipments: {
                name: 'Shipments Processed',
                unit: 'shipment',
                aggregation: 'sum',
                resetInterval: 'month'
            },
            apiCalls: {
                name: 'API Calls',
                unit: 'call',
                aggregation: 'sum',
                resetInterval: 'month'
            },
            storage: {
                name: 'Storage Usage',
                unit: 'GB',
                aggregation: 'max',
                resetInterval: null // Continuous
            },
            containers: {
                name: 'Container Tracking',
                unit: 'container-day',
                aggregation: 'sum',
                resetInterval: 'month'
            },
            ediTransactions: {
                name: 'EDI Transactions',
                unit: 'transaction',
                aggregation: 'sum',
                resetInterval: 'month'
            }
        };
    }
    
    // Initialize system
    async initialize() {
        console.log('Initializing Subscription Management System');
        
        try {
            // Create database tables
            await this.createDatabaseSchema();
            
            // Sync products with Stripe
            await this.syncStripeProducts();
            
            // Setup webhook endpoint
            await this.setupWebhooks();
            
            // Initialize usage tracking
            await this.initializeUsageTracking();
            
            // Start background jobs
            this.startBackgroundJobs();
            
            console.log('Subscription Management System initialized');
            
        } catch (error) {
            console.error('Failed to initialize subscription system:', error);
            throw error;
        }
    }
    
    // Create database schema
    async createDatabaseSchema() {
        await this.db.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                customer_id UUID NOT NULL,
                stripe_subscription_id VARCHAR(255) UNIQUE,
                stripe_customer_id VARCHAR(255),
                plan_id VARCHAR(100) NOT NULL,
                status VARCHAR(50) NOT NULL,
                current_period_start TIMESTAMP,
                current_period_end TIMESTAMP,
                trial_end TIMESTAMP,
                cancel_at_period_end BOOLEAN DEFAULT false,
                canceled_at TIMESTAMP,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS usage_records (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                subscription_id UUID REFERENCES subscriptions(id),
                component VARCHAR(100) NOT NULL,
                quantity DECIMAL(20,6) NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS invoices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                subscription_id UUID REFERENCES subscriptions(id),
                stripe_invoice_id VARCHAR(255) UNIQUE,
                number VARCHAR(100) UNIQUE,
                status VARCHAR(50) NOT NULL,
                amount_due DECIMAL(20,2) NOT NULL,
                amount_paid DECIMAL(20,2) DEFAULT 0,
                currency VARCHAR(3) DEFAULT 'USD',
                due_date DATE,
                paid_at TIMESTAMP,
                line_items JSONB DEFAULT '[]',
                tax_amount DECIMAL(20,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS contracts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                customer_id UUID NOT NULL,
                subscription_id UUID REFERENCES subscriptions(id),
                contract_number VARCHAR(100) UNIQUE,
                type VARCHAR(50) NOT NULL, -- 'annual', 'multi-year'
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                auto_renewal BOOLEAN DEFAULT true,
                renewal_notice_days INTEGER DEFAULT 90,
                terms JSONB DEFAULT '{}',
                signed_at TIMESTAMP,
                signed_by VARCHAR(255),
                document_url VARCHAR(500),
                status VARCHAR(50) DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS pricing_overrides (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                subscription_id UUID REFERENCES subscriptions(id),
                component VARCHAR(100) NOT NULL,
                override_type VARCHAR(50) NOT NULL, -- 'discount', 'volume', 'custom'
                value DECIMAL(20,6) NOT NULL,
                valid_from DATE,
                valid_until DATE,
                approved_by VARCHAR(255),
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Indexes
            CREATE INDEX idx_subscriptions_customer ON subscriptions(customer_id);
            CREATE INDEX idx_subscriptions_status ON subscriptions(status);
            CREATE INDEX idx_usage_records_subscription ON usage_records(subscription_id, component, timestamp);
            CREATE INDEX idx_invoices_subscription ON invoices(subscription_id);
            CREATE INDEX idx_invoices_status ON invoices(status);
        `);
    }
    
    // Sync products with Stripe
    async syncStripeProducts() {
        for (const [key, tier] of Object.entries(this.pricingTiers)) {
            if (tier.basePrice !== null) {
                try {
                    // Create or update product
                    const product = await stripe.products.create({
                        id: `prod_rootuip_${key}`,
                        name: `ROOTUIP ${tier.name}`,
                        description: `${tier.name} plan for ROOTUIP logistics platform`,
                        metadata: {
                            tier: key,
                            features: JSON.stringify(tier.features)
                        }
                    }).catch(async (error) => {
                        if (error.code === 'resource_already_exists') {
                            return await stripe.products.update(`prod_rootuip_${key}`, {
                                name: `ROOTUIP ${tier.name}`,
                                description: `${tier.name} plan for ROOTUIP logistics platform`
                            });
                        }
                        throw error;
                    });
                    
                    // Create or update price
                    const price = await stripe.prices.create({
                        product: product.id,
                        currency: 'usd',
                        unit_amount: tier.basePrice * 100, // Convert to cents
                        recurring: {
                            interval: tier.interval
                        },
                        metadata: {
                            tier: key
                        }
                    }).catch(error => {
                        console.log(`Price already exists for ${key}`);
                    });
                    
                } catch (error) {
                    console.error(`Error syncing ${key} tier:`, error);
                }
            }
        }
    }
    
    // Create subscription
    async createSubscription(customerId, options = {}) {
        try {
            const {
                planId = 'starter',
                paymentMethodId,
                trialDays = 14,
                metadata = {},
                contractTerms = null
            } = options;
            
            // Get or create Stripe customer
            const stripeCustomer = await this.getOrCreateStripeCustomer(customerId);
            
            // Attach payment method if provided
            if (paymentMethodId) {
                await stripe.paymentMethods.attach(paymentMethodId, {
                    customer: stripeCustomer.id
                });
                
                await stripe.customers.update(stripeCustomer.id, {
                    invoice_settings: {
                        default_payment_method: paymentMethodId
                    }
                });
            }
            
            // Get pricing tier
            const tier = this.pricingTiers[planId];
            if (!tier) {
                throw new Error(`Invalid plan: ${planId}`);
            }
            
            // Create subscription in Stripe
            const stripeSubscription = await stripe.subscriptions.create({
                customer: stripeCustomer.id,
                items: [{
                    price: tier.id
                }],
                trial_period_days: trialDays,
                metadata: {
                    customerId,
                    planId,
                    ...metadata
                },
                expand: ['latest_invoice.payment_intent']
            });
            
            // Save to database
            const subscription = await this.db.query(`
                INSERT INTO subscriptions (
                    customer_id, stripe_subscription_id, stripe_customer_id,
                    plan_id, status, current_period_start, current_period_end,
                    trial_end, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [
                customerId,
                stripeSubscription.id,
                stripeCustomer.id,
                planId,
                stripeSubscription.status,
                new Date(stripeSubscription.current_period_start * 1000),
                new Date(stripeSubscription.current_period_end * 1000),
                stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
                JSON.stringify(metadata)
            ]);
            
            // Create contract if required
            if (contractTerms || tier.requiresContract) {
                await this.contractManager.createContract({
                    customerId,
                    subscriptionId: subscription.rows[0].id,
                    terms: contractTerms
                });
            }
            
            // Initialize usage tracking
            await this.initializeSubscriptionUsage(subscription.rows[0].id);
            
            this.emit('subscription:created', subscription.rows[0]);
            
            return {
                subscription: subscription.rows[0],
                stripeSubscription,
                setupIntent: stripeSubscription.latest_invoice?.payment_intent
            };
            
        } catch (error) {
            console.error('Error creating subscription:', error);
            throw error;
        }
    }
    
    // Update subscription
    async updateSubscription(subscriptionId, updates) {
        try {
            const subscription = await this.getSubscription(subscriptionId);
            
            if (!subscription) {
                throw new Error('Subscription not found');
            }
            
            const {
                planId,
                quantity,
                priceOverrides,
                addOns,
                removeAddOns
            } = updates;
            
            // Calculate prorated amount if changing plans
            let proratedAmount = 0;
            if (planId && planId !== subscription.plan_id) {
                proratedAmount = await this.calculateProration(subscription, planId);
            }
            
            // Update in Stripe
            const updateParams = {};
            
            if (planId) {
                const tier = this.pricingTiers[planId];
                updateParams.items = [{
                    id: subscription.stripe_subscription_item_id,
                    price: tier.id
                }];
            }
            
            if (quantity) {
                updateParams.quantity = quantity;
            }
            
            const stripeSubscription = await stripe.subscriptions.update(
                subscription.stripe_subscription_id,
                {
                    ...updateParams,
                    proration_behavior: 'create_prorations'
                }
            );
            
            // Update database
            await this.db.query(`
                UPDATE subscriptions
                SET plan_id = COALESCE($2, plan_id),
                    status = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [subscriptionId, planId, stripeSubscription.status]);
            
            // Apply price overrides
            if (priceOverrides) {
                await this.applyPriceOverrides(subscriptionId, priceOverrides);
            }
            
            this.emit('subscription:updated', {
                subscriptionId,
                updates,
                proratedAmount
            });
            
            return {
                subscription: await this.getSubscription(subscriptionId),
                proratedAmount
            };
            
        } catch (error) {
            console.error('Error updating subscription:', error);
            throw error;
        }
    }
    
    // Cancel subscription
    async cancelSubscription(subscriptionId, options = {}) {
        try {
            const {
                immediately = false,
                reason = null,
                feedback = null
            } = options;
            
            const subscription = await this.getSubscription(subscriptionId);
            
            if (!subscription) {
                throw new Error('Subscription not found');
            }
            
            // Cancel in Stripe
            const stripeSubscription = await stripe.subscriptions.update(
                subscription.stripe_subscription_id,
                {
                    cancel_at_period_end: !immediately,
                    cancellation_details: {
                        comment: reason,
                        feedback
                    }
                }
            );
            
            if (immediately) {
                await stripe.subscriptions.del(subscription.stripe_subscription_id);
            }
            
            // Update database
            await this.db.query(`
                UPDATE subscriptions
                SET status = $2,
                    cancel_at_period_end = $3,
                    canceled_at = $4,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [
                subscriptionId,
                immediately ? 'canceled' : subscription.status,
                !immediately,
                new Date()
            ]);
            
            // Handle contract cancellation
            await this.contractManager.handleSubscriptionCancellation(subscriptionId);
            
            this.emit('subscription:canceled', {
                subscriptionId,
                immediately,
                reason
            });
            
            return {
                success: true,
                cancelAtPeriodEnd: !immediately,
                effectiveDate: immediately ? new Date() : subscription.current_period_end
            };
            
        } catch (error) {
            console.error('Error canceling subscription:', error);
            throw error;
        }
    }
    
    // Record usage
    async recordUsage(subscriptionId, component, quantity, options = {}) {
        try {
            const {
                timestamp = new Date(),
                metadata = {},
                idempotencyKey = null
            } = options;
            
            // Validate component
            if (!this.usageComponents[component]) {
                throw new Error(`Invalid usage component: ${component}`);
            }
            
            // Check for duplicate with idempotency key
            if (idempotencyKey) {
                const existing = await this.checkIdempotencyKey(idempotencyKey);
                if (existing) {
                    return existing;
                }
            }
            
            // Record in database
            const usage = await this.db.query(`
                INSERT INTO usage_records (
                    subscription_id, component, quantity, timestamp, metadata
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [
                subscriptionId,
                component,
                quantity,
                timestamp,
                JSON.stringify(metadata)
            ]);
            
            // Update cache
            await this.updateUsageCache(subscriptionId, component, quantity);
            
            // Check for overage alerts
            await this.checkUsageAlerts(subscriptionId, component);
            
            this.emit('usage:recorded', usage.rows[0]);
            
            return usage.rows[0];
            
        } catch (error) {
            console.error('Error recording usage:', error);
            throw error;
        }
    }
    
    // Get usage summary
    async getUsageSummary(subscriptionId, options = {}) {
        const {
            startDate = moment().startOf('month').toDate(),
            endDate = moment().endOf('month').toDate(),
            components = Object.keys(this.usageComponents)
        } = options;
        
        const summary = {
            subscriptionId,
            period: { startDate, endDate },
            components: {}
        };
        
        for (const component of components) {
            const usage = await this.db.query(`
                SELECT 
                    SUM(quantity) as total,
                    COUNT(*) as count,
                    MAX(quantity) as max,
                    AVG(quantity) as average
                FROM usage_records
                WHERE subscription_id = $1
                    AND component = $2
                    AND timestamp >= $3
                    AND timestamp <= $4
            `, [subscriptionId, component, startDate, endDate]);
            
            const subscription = await this.getSubscription(subscriptionId);
            const tier = this.pricingTiers[subscription.plan_id];
            const included = tier.features[component] || 0;
            const overage = Math.max(0, (usage.rows[0].total || 0) - included);
            
            summary.components[component] = {
                total: parseFloat(usage.rows[0].total || 0),
                count: parseInt(usage.rows[0].count || 0),
                max: parseFloat(usage.rows[0].max || 0),
                average: parseFloat(usage.rows[0].average || 0),
                included,
                overage,
                overageCost: overage * (tier.overage?.[component] || 0)
            };
        }
        
        summary.totalOverageCost = Object.values(summary.components)
            .reduce((sum, comp) => sum + comp.overageCost, 0);
        
        return summary;
    }
    
    // Calculate prorated amount
    async calculateProration(subscription, newPlanId) {
        const currentTier = this.pricingTiers[subscription.plan_id];
        const newTier = this.pricingTiers[newPlanId];
        
        const now = moment();
        const periodStart = moment(subscription.current_period_start);
        const periodEnd = moment(subscription.current_period_end);
        
        const totalDays = periodEnd.diff(periodStart, 'days');
        const remainingDays = periodEnd.diff(now, 'days');
        const usedDays = totalDays - remainingDays;
        
        // Calculate unused amount from current plan
        const currentMonthlyAmount = currentTier.basePrice;
        const currentDailyRate = currentMonthlyAmount / totalDays;
        const unusedAmount = currentDailyRate * remainingDays;
        
        // Calculate new amount for remaining period
        const newMonthlyAmount = newTier.basePrice;
        const newDailyRate = newMonthlyAmount / totalDays;
        const newAmount = newDailyRate * remainingDays;
        
        // Prorated amount (positive = customer owes, negative = credit)
        const proratedAmount = newAmount - unusedAmount;
        
        return {
            proratedAmount,
            credit: unusedAmount,
            charge: newAmount,
            remainingDays,
            breakdown: {
                currentPlan: {
                    monthlyAmount: currentMonthlyAmount,
                    dailyRate: currentDailyRate,
                    unusedDays: remainingDays,
                    credit: unusedAmount
                },
                newPlan: {
                    monthlyAmount: newMonthlyAmount,
                    dailyRate: newDailyRate,
                    days: remainingDays,
                    charge: newAmount
                }
            }
        };
    }
    
    // Process billing cycle
    async processBillingCycle(subscriptionId) {
        try {
            console.log(`Processing billing cycle for subscription: ${subscriptionId}`);
            
            const subscription = await this.getSubscription(subscriptionId);
            const usage = await this.getUsageSummary(subscriptionId);
            
            // Calculate charges
            const charges = await this.billingCalculator.calculateCharges({
                subscription,
                usage,
                includeOverages: true,
                includeAddOns: true
            });
            
            // Apply taxes
            const taxDetails = await this.taxCalculator.calculateTax({
                subscription,
                charges,
                address: await this.getCustomerBillingAddress(subscription.customer_id)
            });
            
            // Create invoice items in Stripe
            for (const item of charges.lineItems) {
                await stripe.invoiceItems.create({
                    customer: subscription.stripe_customer_id,
                    subscription: subscription.stripe_subscription_id,
                    amount: Math.round(item.amount * 100), // Convert to cents
                    currency: 'usd',
                    description: item.description,
                    metadata: {
                        type: item.type,
                        component: item.component
                    }
                });
            }
            
            // Add tax item
            if (taxDetails.totalTax > 0) {
                await stripe.invoiceItems.create({
                    customer: subscription.stripe_customer_id,
                    subscription: subscription.stripe_subscription_id,
                    amount: Math.round(taxDetails.totalTax * 100),
                    currency: 'usd',
                    description: 'Sales Tax',
                    metadata: {
                        type: 'tax',
                        breakdown: JSON.stringify(taxDetails.breakdown)
                    }
                });
            }
            
            // Finalize invoice
            const invoice = await stripe.invoices.finalizeInvoice(
                subscription.stripe_latest_invoice_id
            );
            
            // Save to database
            await this.saveInvoice(subscription.id, invoice, charges, taxDetails);
            
            // Reset usage counters
            await this.resetUsageCounters(subscriptionId);
            
            this.emit('billing:processed', {
                subscriptionId,
                invoiceId: invoice.id,
                total: charges.total + taxDetails.totalTax
            });
            
            return {
                success: true,
                invoice,
                charges,
                tax: taxDetails
            };
            
        } catch (error) {
            console.error('Error processing billing cycle:', error);
            throw error;
        }
    }
    
    // Handle Stripe webhook
    async handleWebhook(event) {
        try {
            switch (event.type) {
                case 'customer.subscription.created':
                case 'customer.subscription.updated':
                    await this.syncSubscriptionFromStripe(event.data.object);
                    break;
                    
                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object);
                    break;
                    
                case 'invoice.payment_succeeded':
                    await this.handlePaymentSucceeded(event.data.object);
                    break;
                    
                case 'invoice.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;
                    
                case 'customer.subscription.trial_will_end':
                    await this.handleTrialEnding(event.data.object);
                    break;
            }
            
            return { received: true };
            
        } catch (error) {
            console.error('Webhook processing error:', error);
            throw error;
        }
    }
    
    // Get or create Stripe customer
    async getOrCreateStripeCustomer(customerId) {
        // Check if customer already has Stripe ID
        const customer = await this.db.query(
            'SELECT stripe_customer_id FROM customers WHERE id = $1',
            [customerId]
        );
        
        if (customer.rows[0]?.stripe_customer_id) {
            return await stripe.customers.retrieve(customer.rows[0].stripe_customer_id);
        }
        
        // Get customer details
        const customerDetails = await this.db.query(
            'SELECT * FROM customers WHERE id = $1',
            [customerId]
        );
        
        if (customerDetails.rows.length === 0) {
            throw new Error('Customer not found');
        }
        
        const customerData = customerDetails.rows[0];
        
        // Create Stripe customer
        const stripeCustomer = await stripe.customers.create({
            email: customerData.email,
            name: customerData.company_name || `${customerData.first_name} ${customerData.last_name}`,
            metadata: {
                customerId: customerId.toString(),
                companyName: customerData.company_name
            }
        });
        
        // Update customer record
        await this.db.query(
            'UPDATE customers SET stripe_customer_id = $1 WHERE id = $2',
            [stripeCustomer.id, customerId]
        );
        
        return stripeCustomer;
    }
    
    // Helper methods
    async getSubscription(subscriptionId) {
        const result = await this.db.query(
            'SELECT * FROM subscriptions WHERE id = $1',
            [subscriptionId]
        );
        return result.rows[0];
    }
    
    async saveInvoice(subscriptionId, stripeInvoice, charges, taxDetails) {
        const invoiceNumber = `INV-${moment().format('YYYYMM')}-${stripeInvoice.number}`;
        
        await this.db.query(`
            INSERT INTO invoices (
                subscription_id, stripe_invoice_id, number, status,
                amount_due, currency, due_date, line_items, tax_amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            subscriptionId,
            stripeInvoice.id,
            invoiceNumber,
            stripeInvoice.status,
            stripeInvoice.amount_due / 100, // Convert from cents
            stripeInvoice.currency.toUpperCase(),
            stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : null,
            JSON.stringify(charges.lineItems),
            taxDetails.totalTax
        ]);
    }
    
    // Start background jobs
    startBackgroundJobs() {
        // Process billing cycles daily
        setInterval(() => {
            this.processAllBillingCycles();
        }, 24 * 60 * 60 * 1000);
        
        // Check contract renewals
        setInterval(() => {
            this.contractManager.checkRenewals();
        }, 24 * 60 * 60 * 1000);
        
        // Update usage metrics every hour
        setInterval(() => {
            this.updateUsageMetrics();
        }, 60 * 60 * 1000);
    }
}

// Contract Manager
class ContractManager {
    constructor(parent) {
        this.parent = parent;
    }
    
    async createContract(options) {
        const {
            customerId,
            subscriptionId,
            type = 'annual',
            startDate = new Date(),
            duration = 12, // months
            autoRenewal = true,
            terms = {}
        } = options;
        
        const contractNumber = `CTR-${moment().format('YYYYMM')}-${Math.random().toString(36).substring(7).toUpperCase()}`;
        const endDate = moment(startDate).add(duration, 'months').toDate();
        
        const contract = await this.parent.db.query(`
            INSERT INTO contracts (
                customer_id, subscription_id, contract_number, type,
                start_date, end_date, auto_renewal, terms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            customerId,
            subscriptionId,
            contractNumber,
            type,
            startDate,
            endDate,
            autoRenewal,
            JSON.stringify(terms)
        ]);
        
        return contract.rows[0];
    }
    
    async checkRenewals() {
        const renewalDate = moment().add(90, 'days').toDate();
        
        const contracts = await this.parent.db.query(`
            SELECT * FROM contracts
            WHERE status = 'active'
                AND end_date <= $1
                AND auto_renewal = true
        `, [renewalDate]);
        
        for (const contract of contracts.rows) {
            await this.processRenewal(contract);
        }
    }
    
    async processRenewal(contract) {
        const daysUntilExpiry = moment(contract.end_date).diff(moment(), 'days');
        
        if (daysUntilExpiry === contract.renewal_notice_days) {
            // Send renewal notice
            this.parent.emit('contract:renewal_notice', contract);
        }
        
        if (daysUntilExpiry <= 0 && contract.auto_renewal) {
            // Auto-renew contract
            const newContract = await this.createContract({
                customerId: contract.customer_id,
                subscriptionId: contract.subscription_id,
                type: contract.type,
                startDate: moment(contract.end_date).add(1, 'day').toDate(),
                duration: contract.type === 'annual' ? 12 : 24,
                autoRenewal: contract.auto_renewal,
                terms: contract.terms
            });
            
            // Update old contract
            await this.parent.db.query(
                'UPDATE contracts SET status = $1 WHERE id = $2',
                ['renewed', contract.id]
            );
            
            this.parent.emit('contract:renewed', {
                oldContract: contract,
                newContract
            });
        }
    }
}

// Billing Calculator
class BillingCalculator {
    constructor(parent) {
        this.parent = parent;
    }
    
    async calculateCharges(options) {
        const { subscription, usage, includeOverages, includeAddOns } = options;
        
        const tier = this.parent.pricingTiers[subscription.plan_id];
        const lineItems = [];
        let total = 0;
        
        // Base subscription charge
        lineItems.push({
            type: 'subscription',
            description: `${tier.name} Plan - Monthly Subscription`,
            amount: tier.basePrice,
            quantity: 1
        });
        total += tier.basePrice;
        
        // Calculate overages
        if (includeOverages) {
            for (const [component, componentUsage] of Object.entries(usage.components)) {
                if (componentUsage.overage > 0) {
                    const overageRate = tier.overage?.[component] || 0;
                    const overageAmount = componentUsage.overage * overageRate;
                    
                    lineItems.push({
                        type: 'overage',
                        component,
                        description: `${component} Overage (${componentUsage.overage} units @ $${overageRate})`,
                        amount: overageAmount,
                        quantity: componentUsage.overage
                    });
                    
                    total += overageAmount;
                }
            }
        }
        
        // Apply pricing overrides
        const overrides = await this.getPricingOverrides(subscription.id);
        for (const override of overrides) {
            const adjustment = this.applyOverride(lineItems, override);
            total += adjustment;
        }
        
        return {
            lineItems,
            subtotal: total,
            total, // Before tax
            currency: 'USD'
        };
    }
    
    applyOverride(lineItems, override) {
        // Implementation for applying pricing overrides
        return 0;
    }
}

// Tax Calculator
class TaxCalculator {
    constructor(parent) {
        this.parent = parent;
        this.taxJar = require('taxjar')({
            apiKey: parent.config.taxJarApiKey
        });
    }
    
    async calculateTax(options) {
        const { subscription, charges, address } = options;
        
        if (!address || !address.country) {
            return { totalTax: 0, breakdown: [] };
        }
        
        try {
            const taxCalculation = await this.taxJar.taxForOrder({
                from_country: 'US',
                from_zip: '10001',
                from_state: 'NY',
                to_country: address.country,
                to_zip: address.postal_code,
                to_state: address.state,
                amount: charges.total,
                shipping: 0,
                line_items: charges.lineItems.map((item, index) => ({
                    id: index.toString(),
                    quantity: item.quantity || 1,
                    unit_price: item.amount,
                    product_tax_code: '81162000' // Software as a Service
                }))
            });
            
            return {
                totalTax: taxCalculation.tax.amount_to_collect,
                rate: taxCalculation.tax.rate,
                breakdown: taxCalculation.tax.breakdown
            };
            
        } catch (error) {
            console.error('Tax calculation error:', error);
            return { totalTax: 0, breakdown: [] };
        }
    }
}

module.exports = SubscriptionManagementSystem;