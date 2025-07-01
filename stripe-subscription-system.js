/**
 * ROOTUIP Stripe Subscription Management System
 * Enterprise billing with multi-tier pricing and usage-based components
 */

const stripe = require('stripe')('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');
const EventEmitter = require('events');

// Subscription Management Service
class SubscriptionManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            webhookSecret: config.webhookSecret,
            taxCalculation: config.taxCalculation || true,
            currencySupport: config.currencySupport || ['USD', 'EUR', 'GBP', 'CAD'],
            ...config
        };
        
        this.subscriptions = new Map();
        this.plans = new Map();
        this.usageMetrics = new Map();
        
        this.initializePlans();
        this.setupEventHandlers();
    }
    
    async initializePlans() {
        // Define ROOTUIP pricing tiers
        const plans = [
            {
                id: 'starter',
                name: 'Starter',
                description: 'Perfect for small businesses getting started with container tracking',
                basePrice: 299, // $2.99/month
                currency: 'usd',
                interval: 'month',
                features: {
                    containers: 100,
                    users: 5,
                    apiCalls: 10000,
                    support: 'email',
                    integrations: 2
                },
                usageLimits: {
                    containers: { included: 100, overage: 5 }, // $0.05 per additional container
                    apiCalls: { included: 10000, overage: 1 }, // $0.01 per 100 additional calls
                    users: { included: 5, overage: 15 } // $15 per additional user
                }
            },
            {
                id: 'professional',
                name: 'Professional',
                description: 'Advanced features for growing logistics operations',
                basePrice: 9900, // $99/month
                currency: 'usd',
                interval: 'month',
                features: {
                    containers: 1000,
                    users: 25,
                    apiCalls: 100000,
                    support: 'priority',
                    integrations: 10,
                    analytics: true,
                    customReports: true
                },
                usageLimits: {
                    containers: { included: 1000, overage: 3 },
                    apiCalls: { included: 100000, overage: 0.5 },
                    users: { included: 25, overage: 12 }
                }
            },
            {
                id: 'enterprise',
                name: 'Enterprise',
                description: 'Full-featured solution for large enterprises',
                basePrice: 49900, // $499/month
                currency: 'usd',
                interval: 'month',
                features: {
                    containers: 'unlimited',
                    users: 'unlimited',
                    apiCalls: 'unlimited',
                    support: 'dedicated',
                    integrations: 'unlimited',
                    analytics: true,
                    customReports: true,
                    whiteLabel: true,
                    sla: '99.9%'
                },
                usageLimits: {
                    containers: { included: 10000, overage: 1 },
                    apiCalls: { included: 1000000, overage: 0.1 }
                }
            },
            {
                id: 'starter_annual',
                name: 'Starter Annual',
                description: 'Starter plan with annual billing (20% discount)',
                basePrice: 2872, // $28.72/month billed annually
                currency: 'usd',
                interval: 'year',
                discount: 20,
                features: {
                    containers: 100,
                    users: 5,
                    apiCalls: 10000,
                    support: 'email',
                    integrations: 2
                }
            },
            {
                id: 'professional_annual',
                name: 'Professional Annual',
                description: 'Professional plan with annual billing (20% discount)',
                basePrice: 95040, // $79.20/month billed annually
                currency: 'usd',
                interval: 'year',
                discount: 20,
                features: {
                    containers: 1000,
                    users: 25,
                    apiCalls: 100000,
                    support: 'priority',
                    integrations: 10,
                    analytics: true,
                    customReports: true
                }
            },
            {
                id: 'enterprise_annual',
                name: 'Enterprise Annual',
                description: 'Enterprise plan with annual billing (25% discount)',
                basePrice: 449100, // $374.25/month billed annually
                currency: 'usd',
                interval: 'year',
                discount: 25,
                features: {
                    containers: 'unlimited',
                    users: 'unlimited',
                    apiCalls: 'unlimited',
                    support: 'dedicated',
                    integrations: 'unlimited',
                    analytics: true,
                    customReports: true,
                    whiteLabel: true,
                    sla: '99.9%'
                }
            }
        ];
        
        // Create Stripe products and prices
        for (const plan of plans) {
            try {
                await this.createStripePlan(plan);
                this.plans.set(plan.id, plan);
            } catch (error) {
                console.error(`Failed to create plan ${plan.id}:`, error);
            }
        }
    }
    
    async createStripePlan(plan) {
        // Create product
        const product = await stripe.products.create({
            id: `rootuip_${plan.id}`,
            name: plan.name,
            description: plan.description,
            metadata: {
                plan_id: plan.id,
                features: JSON.stringify(plan.features),
                usage_limits: JSON.stringify(plan.usageLimits || {})
            }
        });
        
        // Create base subscription price
        const price = await stripe.prices.create({
            product: product.id,
            unit_amount: plan.basePrice,
            currency: plan.currency,
            recurring: {
                interval: plan.interval,
                usage_type: 'licensed'
            },
            metadata: {
                plan_id: plan.id,
                price_type: 'base'
            }
        });
        
        plan.stripeProductId = product.id;
        plan.stripePriceId = price.id;
        
        // Create usage-based pricing components
        if (plan.usageLimits) {
            for (const [metric, limits] of Object.entries(plan.usageLimits)) {
                if (limits.overage > 0) {
                    const usagePrice = await stripe.prices.create({
                        product: product.id,
                        unit_amount: limits.overage,
                        currency: plan.currency,
                        recurring: {
                            interval: plan.interval,
                            usage_type: 'metered'
                        },
                        billing_scheme: 'per_unit',
                        metadata: {
                            plan_id: plan.id,
                            price_type: 'usage',
                            metric: metric,
                            included_quantity: limits.included.toString()
                        }
                    });
                    
                    plan[`${metric}UsagePriceId`] = usagePrice.id;
                }
            }
        }
        
        return plan;
    }
    
    // Create new subscription
    async createSubscription(customerId, planId, options = {}) {
        const plan = this.plans.get(planId);
        if (!plan) {
            throw new Error(`Plan ${planId} not found`);
        }
        
        try {
            // Prepare subscription items
            const subscriptionItems = [{
                price: plan.stripePriceId,
                quantity: 1
            }];
            
            // Add usage-based pricing items
            if (plan.usageLimits) {
                for (const [metric, limits] of Object.entries(plan.usageLimits)) {
                    if (limits.overage > 0 && plan[`${metric}UsagePriceId`]) {
                        subscriptionItems.push({
                            price: plan[`${metric}UsagePriceId`],
                            quantity: 0 // Usage will be reported later
                        });
                    }
                }
            }
            
            // Create subscription
            const subscription = await stripe.subscriptions.create({
                customer: customerId,
                items: subscriptionItems,
                payment_behavior: 'default_incomplete',
                payment_settings: {
                    save_default_payment_method: 'on_subscription'
                },
                expand: ['latest_invoice.payment_intent'],
                metadata: {
                    plan_id: planId,
                    company_name: options.companyName || '',
                    billing_email: options.billingEmail || '',
                    created_by: options.createdBy || 'system'
                },
                // Tax calculation
                automatic_tax: {
                    enabled: this.config.taxCalculation
                },
                // Proration behavior
                proration_behavior: options.prorationBehavior || 'create_prorations',
                // Trial period
                trial_period_days: options.trialDays || 0
            });
            
            // Store subscription data
            this.subscriptions.set(subscription.id, {
                ...subscription,
                planId: planId,
                customerId: customerId,
                createdAt: new Date(),
                lastUpdated: new Date()
            });
            
            this.emit('subscription_created', {
                subscriptionId: subscription.id,
                customerId,
                planId,
                subscription
            });
            
            return subscription;
        } catch (error) {
            this.emit('subscription_creation_failed', {
                customerId,
                planId,
                error: error.message
            });
            throw error;
        }
    }
    
    // Update subscription (change plan, upgrade/downgrade)
    async updateSubscription(subscriptionId, newPlanId, options = {}) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const newPlan = this.plans.get(newPlanId);
        
        if (!newPlan) {
            throw new Error(`Plan ${newPlanId} not found`);
        }
        
        try {
            // Calculate proration
            const prorationDate = Math.floor(Date.now() / 1000);
            
            // Prepare new subscription items
            const newItems = [{
                id: subscription.items.data[0].id,
                price: newPlan.stripePriceId,
                quantity: 1
            }];
            
            // Add usage-based items for new plan
            if (newPlan.usageLimits) {
                for (const [metric, limits] of Object.entries(newPlan.usageLimits)) {
                    if (limits.overage > 0 && newPlan[`${metric}UsagePriceId`]) {
                        newItems.push({
                            price: newPlan[`${metric}UsagePriceId`],
                            quantity: 0
                        });
                    }
                }
            }
            
            // Update subscription
            const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
                items: newItems,
                proration_behavior: options.prorationBehavior || 'create_prorations',
                proration_date: options.immediateChange ? prorationDate : undefined,
                metadata: {
                    ...subscription.metadata,
                    plan_id: newPlanId,
                    last_updated: new Date().toISOString(),
                    updated_by: options.updatedBy || 'system'
                }
            });
            
            // Update local storage
            this.subscriptions.set(subscriptionId, {
                ...updatedSubscription,
                planId: newPlanId,
                lastUpdated: new Date()
            });
            
            this.emit('subscription_updated', {
                subscriptionId,
                oldPlanId: subscription.metadata.plan_id,
                newPlanId,
                subscription: updatedSubscription
            });
            
            return updatedSubscription;
        } catch (error) {
            this.emit('subscription_update_failed', {
                subscriptionId,
                newPlanId,
                error: error.message
            });
            throw error;
        }
    }
    
    // Cancel subscription
    async cancelSubscription(subscriptionId, options = {}) {
        try {
            const subscription = await stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: options.atPeriodEnd !== false,
                cancellation_details: {
                    comment: options.reason || 'Customer requested cancellation',
                    feedback: options.feedback
                },
                metadata: {
                    cancelled_at: new Date().toISOString(),
                    cancelled_by: options.cancelledBy || 'customer'
                }
            });
            
            if (!options.atPeriodEnd) {
                await stripe.subscriptions.cancel(subscriptionId);
            }
            
            this.emit('subscription_cancelled', {
                subscriptionId,
                subscription,
                options
            });
            
            return subscription;
        } catch (error) {
            this.emit('subscription_cancellation_failed', {
                subscriptionId,
                error: error.message
            });
            throw error;
        }
    }
    
    // Report usage for metered billing
    async reportUsage(subscriptionId, usageData) {
        const subscription = this.subscriptions.get(subscriptionId) || 
                           await stripe.subscriptions.retrieve(subscriptionId);
        
        const plan = this.plans.get(subscription.metadata.plan_id);
        if (!plan || !plan.usageLimits) {
            return;
        }
        
        try {
            const usageRecords = [];
            
            for (const [metric, usage] of Object.entries(usageData)) {
                if (plan.usageLimits[metric] && plan[`${metric}UsagePriceId`]) {
                    const included = plan.usageLimits[metric].included;
                    const overage = Math.max(0, usage - included);
                    
                    if (overage > 0) {
                        // Find the subscription item for this metric
                        const subscriptionItem = subscription.items.data.find(item => 
                            item.price.metadata.metric === metric
                        );
                        
                        if (subscriptionItem) {
                            const usageRecord = await stripe.subscriptionItems.createUsageRecord(
                                subscriptionItem.id,
                                {
                                    quantity: overage,
                                    timestamp: Math.floor(Date.now() / 1000),
                                    action: 'set'
                                }
                            );
                            
                            usageRecords.push(usageRecord);
                        }
                    }
                }
            }
            
            // Store usage metrics
            this.usageMetrics.set(`${subscriptionId}_${Date.now()}`, {
                subscriptionId,
                usageData,
                overage: usageRecords,
                reportedAt: new Date()
            });
            
            this.emit('usage_reported', {
                subscriptionId,
                usageData,
                usageRecords
            });
            
            return usageRecords;
        } catch (error) {
            this.emit('usage_reporting_failed', {
                subscriptionId,
                usageData,
                error: error.message
            });
            throw error;
        }
    }
    
    // Handle annual contract renewals
    async handleAnnualRenewal(subscriptionId, options = {}) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        
        try {
            // Check if auto-renewal is enabled
            if (subscription.metadata.auto_renewal === 'false') {
                this.emit('renewal_skipped', {
                    subscriptionId,
                    reason: 'auto_renewal_disabled'
                });
                return null;
            }
            
            // Apply any pricing updates for renewal
            let renewalPrice = subscription.items.data[0].price.unit_amount;
            
            if (options.priceIncrease) {
                renewalPrice = Math.round(renewalPrice * (1 + options.priceIncrease));
                
                // Update price for renewal
                await stripe.subscriptions.update(subscriptionId, {
                    items: [{
                        id: subscription.items.data[0].id,
                        price_data: {
                            currency: subscription.items.data[0].price.currency,
                            product: subscription.items.data[0].price.product,
                            unit_amount: renewalPrice,
                            recurring: subscription.items.data[0].price.recurring
                        }
                    }],
                    proration_behavior: 'none'
                });
            }
            
            // Send renewal notification
            this.emit('subscription_renewed', {
                subscriptionId,
                subscription,
                renewalPrice,
                priceIncrease: options.priceIncrease
            });
            
            return subscription;
        } catch (error) {
            this.emit('renewal_failed', {
                subscriptionId,
                error: error.message
            });
            throw error;
        }
    }
    
    // Get subscription analytics
    async getSubscriptionAnalytics(customerId, timeRange = '12m') {
        try {
            const subscriptions = await stripe.subscriptions.list({
                customer: customerId,
                limit: 100
            });
            
            const analytics = {
                totalSubscriptions: subscriptions.data.length,
                activeSubscriptions: subscriptions.data.filter(s => s.status === 'active').length,
                totalRevenue: 0,
                averageRevenuePerUser: 0,
                churnRate: 0,
                usageMetrics: {}
            };
            
            // Calculate revenue
            for (const subscription of subscriptions.data) {
                if (subscription.status === 'active') {
                    analytics.totalRevenue += subscription.items.data[0].price.unit_amount;
                }
            }
            
            analytics.averageRevenuePerUser = analytics.totalRevenue / Math.max(1, analytics.activeSubscriptions);
            
            return analytics;
        } catch (error) {
            throw new Error(`Failed to get subscription analytics: ${error.message}`);
        }
    }
    
    // Setup webhook handlers
    setupEventHandlers() {
        // Handle subscription events
        this.on('subscription_created', (data) => {
            console.log('New subscription created:', data.subscriptionId);
        });
        
        this.on('subscription_updated', (data) => {
            console.log('Subscription updated:', data.subscriptionId);
        });
        
        this.on('subscription_cancelled', (data) => {
            console.log('Subscription cancelled:', data.subscriptionId);
        });
    }
    
    // Process Stripe webhooks
    async processWebhook(body, signature) {
        try {
            const event = stripe.webhooks.constructEvent(
                body,
                signature,
                this.config.webhookSecret
            );
            
            switch (event.type) {
                case 'customer.subscription.created':
                    await this.handleSubscriptionCreated(event.data.object);
                    break;
                    
                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object);
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
                    
                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }
            
            return { received: true };
        } catch (error) {
            console.error('Webhook processing failed:', error);
            throw error;
        }
    }
    
    async handleSubscriptionCreated(subscription) {
        this.emit('webhook_subscription_created', subscription);
    }
    
    async handleSubscriptionUpdated(subscription) {
        this.emit('webhook_subscription_updated', subscription);
    }
    
    async handleSubscriptionDeleted(subscription) {
        this.emit('webhook_subscription_deleted', subscription);
    }
    
    async handlePaymentSucceeded(invoice) {
        this.emit('webhook_payment_succeeded', invoice);
    }
    
    async handlePaymentFailed(invoice) {
        this.emit('webhook_payment_failed', invoice);
    }
}

// Customer Management
class CustomerManager {
    constructor() {
        this.customers = new Map();
    }
    
    async createCustomer(customerData) {
        try {
            const customer = await stripe.customers.create({
                email: customerData.email,
                name: customerData.name || customerData.companyName,
                phone: customerData.phone,
                metadata: {
                    company_name: customerData.companyName,
                    industry: customerData.industry,
                    company_size: customerData.companySize,
                    signup_source: customerData.signupSource || 'website',
                    sales_rep: customerData.salesRep
                },
                address: customerData.address,
                tax_exempt: customerData.taxExempt ? 'exempt' : 'none',
                invoice_settings: {
                    default_payment_method: customerData.defaultPaymentMethod
                }
            });
            
            this.customers.set(customer.id, customer);
            return customer;
        } catch (error) {
            throw new Error(`Failed to create customer: ${error.message}`);
        }
    }
    
    async updateCustomer(customerId, updates) {
        try {
            const customer = await stripe.customers.update(customerId, updates);
            this.customers.set(customerId, customer);
            return customer;
        } catch (error) {
            throw new Error(`Failed to update customer: ${error.message}`);
        }
    }
    
    async getCustomer(customerId) {
        try {
            const customer = await stripe.customers.retrieve(customerId);
            return customer;
        } catch (error) {
            throw new Error(`Failed to retrieve customer: ${error.message}`);
        }
    }
    
    async attachPaymentMethod(customerId, paymentMethodId) {
        try {
            await stripe.paymentMethods.attach(paymentMethodId, {
                customer: customerId
            });
            
            // Set as default payment method
            await stripe.customers.update(customerId, {
                invoice_settings: {
                    default_payment_method: paymentMethodId
                }
            });
            
            return paymentMethodId;
        } catch (error) {
            throw new Error(`Failed to attach payment method: ${error.message}`);
        }
    }
}

module.exports = {
    SubscriptionManager,
    CustomerManager
};