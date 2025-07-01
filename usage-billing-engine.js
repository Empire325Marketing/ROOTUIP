/**
 * ROOTUIP Usage-Based Billing Engine
 * Advanced metering and pricing calculations
 */

const EventEmitter = require('events');
const crypto = require('crypto');

// Usage Tracking Service
class UsageTracker extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = config;
        this.usageEvents = new Map();
        this.aggregatedUsage = new Map();
        this.pricingRules = new Map();
        
        this.setupPricingRules();
        this.startAggregationScheduler();
    }
    
    setupPricingRules() {
        // Container tracking usage
        this.pricingRules.set('containers_tracked', {
            name: 'Container Tracking',
            unit: 'containers',
            tiers: [
                { min: 0, max: 100, price: 0 }, // Included in base plan
                { min: 101, max: 1000, price: 5 }, // $0.05 per container
                { min: 1001, max: 10000, price: 3 }, // $0.03 per container (volume discount)
                { min: 10001, max: Infinity, price: 1 } // $0.01 per container (enterprise discount)
            ],
            aggregation: 'sum',
            resetPeriod: 'monthly'
        });
        
        // API calls usage
        this.pricingRules.set('api_calls', {
            name: 'API Calls',
            unit: 'calls',
            tiers: [
                { min: 0, max: 10000, price: 0 }, // Included in base plan
                { min: 10001, max: 100000, price: 1 }, // $0.01 per 100 calls
                { min: 100001, max: 1000000, price: 0.5 }, // $0.005 per 100 calls
                { min: 1000001, max: Infinity, price: 0.1 } // $0.001 per 100 calls
            ],
            aggregation: 'sum',
            resetPeriod: 'monthly',
            batchSize: 100 // Charged per 100 calls
        });
        
        // User seats
        this.pricingRules.set('active_users', {
            name: 'Active Users',
            unit: 'users',
            tiers: [
                { min: 0, max: 5, price: 0 }, // Included in starter
                { min: 6, max: 25, price: 1500 }, // $15 per user
                { min: 26, max: 100, price: 1200 }, // $12 per user (volume discount)
                { min: 101, max: Infinity, price: 1000 } // $10 per user (enterprise)
            ],
            aggregation: 'max', // Highest count during the period
            resetPeriod: 'monthly'
        });
        
        // Data storage usage
        this.pricingRules.set('data_storage', {
            name: 'Data Storage',
            unit: 'GB',
            tiers: [
                { min: 0, max: 10, price: 0 }, // 10GB included
                { min: 11, max: 100, price: 50 }, // $0.50 per GB
                { min: 101, max: 1000, price: 30 }, // $0.30 per GB
                { min: 1001, max: Infinity, price: 20 } // $0.20 per GB
            ],
            aggregation: 'average',
            resetPeriod: 'monthly'
        });
        
        // Webhook delivery
        this.pricingRules.set('webhook_deliveries', {
            name: 'Webhook Deliveries',
            unit: 'deliveries',
            tiers: [
                { min: 0, max: 1000, price: 0 }, // 1000 included
                { min: 1001, max: 10000, price: 1 }, // $0.01 per delivery
                { min: 10001, max: Infinity, price: 0.5 } // $0.005 per delivery
            ],
            aggregation: 'sum',
            resetPeriod: 'monthly'
        });
        
        // Premium support incidents
        this.pricingRules.set('support_incidents', {
            name: 'Premium Support Incidents',
            unit: 'incidents',
            tiers: [
                { min: 0, max: 5, price: 0 }, // 5 included for professional+
                { min: 6, max: Infinity, price: 5000 } // $50 per additional incident
            ],
            aggregation: 'sum',
            resetPeriod: 'monthly'
        });
    }
    
    // Track usage event
    async trackUsage(customerId, metric, quantity, metadata = {}) {
        const usageEvent = {
            id: this.generateUsageId(),
            customerId,
            metric,
            quantity: Number(quantity),
            timestamp: new Date(),
            metadata: {
                ...metadata,
                source: metadata.source || 'api',
                sessionId: metadata.sessionId,
                userId: metadata.userId,
                ipAddress: metadata.ipAddress
            }
        };
        
        // Store individual usage event
        this.usageEvents.set(usageEvent.id, usageEvent);
        
        // Update real-time aggregation
        await this.updateAggregation(customerId, metric, quantity, usageEvent.timestamp);
        
        this.emit('usage_tracked', usageEvent);
        
        return usageEvent.id;
    }
    
    async updateAggregation(customerId, metric, quantity, timestamp) {
        const period = this.getCurrentPeriod(timestamp);
        const key = `${customerId}:${metric}:${period}`;
        
        if (!this.aggregatedUsage.has(key)) {
            this.aggregatedUsage.set(key, {
                customerId,
                metric,
                period,
                values: [],
                sum: 0,
                max: 0,
                average: 0,
                count: 0,
                lastUpdated: timestamp
            });
        }
        
        const aggregation = this.aggregatedUsage.get(key);
        aggregation.values.push({ quantity, timestamp });
        aggregation.sum += quantity;
        aggregation.max = Math.max(aggregation.max, quantity);
        aggregation.count++;
        aggregation.average = aggregation.sum / aggregation.count;
        aggregation.lastUpdated = timestamp;
        
        // Keep only recent values for memory efficiency
        if (aggregation.values.length > 10000) {
            aggregation.values = aggregation.values.slice(-5000);
        }
    }
    
    // Calculate usage charges for a customer
    async calculateUsageCharges(customerId, period = null) {
        const targetPeriod = period || this.getCurrentPeriod();
        const charges = new Map();
        let totalAmount = 0;
        
        // Get customer's plan to determine included quantities
        const customerPlan = await this.getCustomerPlan(customerId);
        
        for (const [metric, rule] of this.pricingRules) {
            const usageKey = `${customerId}:${metric}:${targetPeriod}`;
            const aggregation = this.aggregatedUsage.get(usageKey);
            
            if (!aggregation) continue;
            
            // Get usage quantity based on aggregation method
            let usageQuantity = 0;
            switch (rule.aggregation) {
                case 'sum':
                    usageQuantity = aggregation.sum;
                    break;
                case 'max':
                    usageQuantity = aggregation.max;
                    break;
                case 'average':
                    usageQuantity = Math.ceil(aggregation.average);
                    break;
            }
            
            // Apply batch size if configured
            if (rule.batchSize) {
                usageQuantity = Math.ceil(usageQuantity / rule.batchSize);
            }
            
            // Get included quantity from customer's plan
            const includedQuantity = this.getIncludedQuantity(customerPlan, metric);
            const chargeableQuantity = Math.max(0, usageQuantity - includedQuantity);
            
            if (chargeableQuantity > 0) {
                const charge = this.calculateTieredPricing(chargeableQuantity, rule.tiers);
                
                charges.set(metric, {
                    metric,
                    rule: rule.name,
                    usageQuantity,
                    includedQuantity,
                    chargeableQuantity,
                    amount: charge,
                    unit: rule.unit,
                    period: targetPeriod
                });
                
                totalAmount += charge;
            }
        }
        
        return {
            customerId,
            period: targetPeriod,
            charges: Array.from(charges.values()),
            totalAmount,
            currency: 'usd',
            calculatedAt: new Date()
        };
    }
    
    calculateTieredPricing(quantity, tiers) {
        let totalCharge = 0;
        let remainingQuantity = quantity;
        
        for (const tier of tiers) {
            if (remainingQuantity <= 0) break;
            
            const tierQuantity = Math.min(
                remainingQuantity,
                tier.max === Infinity ? remainingQuantity : tier.max - tier.min + 1
            );
            
            totalCharge += tierQuantity * tier.price;
            remainingQuantity -= tierQuantity;
        }
        
        return totalCharge;
    }
    
    getIncludedQuantity(customerPlan, metric) {
        if (!customerPlan || !customerPlan.usageLimits) return 0;
        
        const limit = customerPlan.usageLimits[metric];
        return limit ? limit.included : 0;
    }
    
    async getCustomerPlan(customerId) {
        // This would typically fetch from database
        // For now, return a mock plan
        return {
            id: 'professional',
            usageLimits: {
                containers_tracked: { included: 1000 },
                api_calls: { included: 100000 },
                active_users: { included: 25 },
                data_storage: { included: 10 },
                webhook_deliveries: { included: 1000 },
                support_incidents: { included: 5 }
            }
        };
    }
    
    // Get usage summary for a customer
    async getUsageSummary(customerId, period = null) {
        const targetPeriod = period || this.getCurrentPeriod();
        const summary = {
            customerId,
            period: targetPeriod,
            metrics: {},
            totalEvents: 0,
            lastActivity: null
        };
        
        for (const [metric, rule] of this.pricingRules) {
            const usageKey = `${customerId}:${metric}:${targetPeriod}`;
            const aggregation = this.aggregatedUsage.get(usageKey);
            
            if (aggregation) {
                summary.metrics[metric] = {
                    name: rule.name,
                    unit: rule.unit,
                    quantity: this.getAggregatedValue(aggregation, rule.aggregation),
                    events: aggregation.count,
                    lastUpdated: aggregation.lastUpdated
                };
                
                summary.totalEvents += aggregation.count;
                
                if (!summary.lastActivity || aggregation.lastUpdated > summary.lastActivity) {
                    summary.lastActivity = aggregation.lastUpdated;
                }
            } else {
                summary.metrics[metric] = {
                    name: rule.name,
                    unit: rule.unit,
                    quantity: 0,
                    events: 0,
                    lastUpdated: null
                };
            }
        }
        
        return summary;
    }
    
    getAggregatedValue(aggregation, method) {
        switch (method) {
            case 'sum':
                return aggregation.sum;
            case 'max':
                return aggregation.max;
            case 'average':
                return Math.ceil(aggregation.average);
            default:
                return aggregation.sum;
        }
    }
    
    // Reset usage for new billing period
    async resetUsageForPeriod(customerId, period) {
        const keysToDelete = [];
        
        for (const key of this.aggregatedUsage.keys()) {
            if (key.startsWith(`${customerId}:`) && key.endsWith(`:${period}`)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.aggregatedUsage.delete(key));
        
        this.emit('usage_reset', { customerId, period });
    }
    
    // Generate usage reports
    async generateUsageReport(customerId, startDate, endDate) {
        const events = Array.from(this.usageEvents.values())
            .filter(event => 
                event.customerId === customerId &&
                event.timestamp >= startDate &&
                event.timestamp <= endDate
            )
            .sort((a, b) => a.timestamp - b.timestamp);
        
        const report = {
            customerId,
            period: {
                startDate,
                endDate
            },
            summary: {
                totalEvents: events.length,
                uniqueMetrics: new Set(events.map(e => e.metric)).size,
                firstEvent: events[0]?.timestamp,
                lastEvent: events[events.length - 1]?.timestamp
            },
            metrics: {},
            events: events.slice(0, 1000) // Limit for performance
        };
        
        // Aggregate by metric
        for (const event of events) {
            if (!report.metrics[event.metric]) {
                const rule = this.pricingRules.get(event.metric);
                report.metrics[event.metric] = {
                    name: rule?.name || event.metric,
                    unit: rule?.unit || 'units',
                    events: [],
                    total: 0,
                    average: 0,
                    max: 0,
                    min: Infinity
                };
            }
            
            const metric = report.metrics[event.metric];
            metric.events.push(event);
            metric.total += event.quantity;
            metric.max = Math.max(metric.max, event.quantity);
            metric.min = Math.min(metric.min, event.quantity);
        }
        
        // Calculate averages
        for (const metric of Object.values(report.metrics)) {
            metric.average = metric.total / metric.events.length;
            if (metric.min === Infinity) metric.min = 0;
        }
        
        return report;
    }
    
    getCurrentPeriod(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }
    
    generateUsageId() {
        return crypto.randomBytes(16).toString('hex');
    }
    
    startAggregationScheduler() {
        // Run aggregation cleanup every hour
        setInterval(() => {
            this.cleanupOldAggregations();
        }, 60 * 60 * 1000);
    }
    
    cleanupOldAggregations() {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - 3); // Keep 3 months
        
        const keysToDelete = [];
        
        for (const [key, aggregation] of this.aggregatedUsage) {
            if (aggregation.lastUpdated < cutoffDate) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => this.aggregatedUsage.delete(key));
        
        if (keysToDelete.length > 0) {
            this.emit('aggregations_cleaned', { deletedCount: keysToDelete.length });
        }
    }
}

// Pricing Calculator Service
class PricingCalculator {
    constructor(usageTracker) {
        this.usageTracker = usageTracker;
        this.discountRules = new Map();
        this.setupDiscountRules();
    }
    
    setupDiscountRules() {
        // Volume discounts
        this.discountRules.set('volume_discount', {
            name: 'Volume Discount',
            type: 'percentage',
            conditions: [
                { metric: 'monthly_revenue', operator: '>=', value: 10000, discount: 5 }, // 5% for $100+/month
                { metric: 'monthly_revenue', operator: '>=', value: 50000, discount: 10 }, // 10% for $500+/month
                { metric: 'monthly_revenue', operator: '>=', value: 100000, discount: 15 } // 15% for $1000+/month
            ]
        });
        
        // Annual contract discounts
        this.discountRules.set('annual_discount', {
            name: 'Annual Contract Discount',
            type: 'percentage',
            conditions: [
                { metric: 'contract_length', operator: '>=', value: 12, discount: 20 }
            ]
        });
        
        // First-time customer discount
        this.discountRules.set('new_customer_discount', {
            name: 'New Customer Discount',
            type: 'percentage',
            conditions: [
                { metric: 'customer_age_months', operator: '<=', value: 1, discount: 25 }
            ],
            maxDuration: 3 // months
        });
    }
    
    async calculateTotalBill(customerId, period, options = {}) {
        // Get usage charges
        const usageCharges = await this.usageTracker.calculateUsageCharges(customerId, period);
        
        // Get base subscription cost
        const baseSubscription = await this.getBaseSubscriptionCost(customerId);
        
        // Calculate applicable discounts
        const discounts = await this.calculateDiscounts(customerId, usageCharges.totalAmount + baseSubscription.amount);
        
        // Apply taxes
        const taxes = await this.calculateTaxes(customerId, usageCharges.totalAmount + baseSubscription.amount - discounts.totalDiscount);
        
        const bill = {
            customerId,
            period,
            baseSubscription,
            usageCharges: usageCharges.charges,
            subtotal: baseSubscription.amount + usageCharges.totalAmount,
            discounts: discounts.applied,
            totalDiscount: discounts.totalDiscount,
            taxableAmount: baseSubscription.amount + usageCharges.totalAmount - discounts.totalDiscount,
            taxes: taxes.breakdown,
            totalTax: taxes.total,
            totalAmount: baseSubscription.amount + usageCharges.totalAmount - discounts.totalDiscount + taxes.total,
            currency: 'usd',
            calculatedAt: new Date()
        };
        
        return bill;
    }
    
    async getBaseSubscriptionCost(customerId) {
        // This would fetch from subscription data
        return {
            planId: 'professional',
            planName: 'Professional',
            amount: 9900, // $99.00
            currency: 'usd',
            billingInterval: 'monthly'
        };
    }
    
    async calculateDiscounts(customerId, subtotal) {
        const customerData = await this.getCustomerData(customerId);
        const appliedDiscounts = [];
        let totalDiscount = 0;
        
        for (const [ruleId, rule] of this.discountRules) {
            if (this.isDiscountApplicable(rule, customerData, subtotal)) {
                const discount = this.calculateDiscount(rule, subtotal, customerData);
                
                appliedDiscounts.push({
                    ruleId,
                    name: rule.name,
                    type: rule.type,
                    amount: discount,
                    percentage: rule.type === 'percentage' ? (discount / subtotal) * 100 : null
                });
                
                totalDiscount += discount;
            }
        }
        
        return {
            applied: appliedDiscounts,
            totalDiscount
        };
    }
    
    isDiscountApplicable(rule, customerData, subtotal) {
        return rule.conditions.every(condition => {
            const value = this.getCustomerMetric(customerData, condition.metric, subtotal);
            return this.evaluateCondition(value, condition.operator, condition.value);
        });
    }
    
    getCustomerMetric(customerData, metric, subtotal) {
        switch (metric) {
            case 'monthly_revenue':
                return subtotal;
            case 'contract_length':
                return customerData.contractLengthMonths || 1;
            case 'customer_age_months':
                return customerData.ageMonths || 0;
            default:
                return 0;
        }
    }
    
    evaluateCondition(value, operator, threshold) {
        switch (operator) {
            case '>=':
                return value >= threshold;
            case '<=':
                return value <= threshold;
            case '>':
                return value > threshold;
            case '<':
                return value < threshold;
            case '==':
                return value === threshold;
            default:
                return false;
        }
    }
    
    calculateDiscount(rule, amount, customerData) {
        // Find the highest applicable discount
        const applicableConditions = rule.conditions.filter(condition => {
            const value = this.getCustomerMetric(customerData, condition.metric, amount);
            return this.evaluateCondition(value, condition.operator, condition.value);
        });
        
        if (applicableConditions.length === 0) return 0;
        
        const highestDiscount = Math.max(...applicableConditions.map(c => c.discount));
        
        if (rule.type === 'percentage') {
            return Math.round(amount * (highestDiscount / 100));
        } else {
            return highestDiscount;
        }
    }
    
    async calculateTaxes(customerId, taxableAmount) {
        const customerData = await this.getCustomerData(customerId);
        const taxBreakdown = [];
        let totalTax = 0;
        
        // Example tax calculation (would integrate with tax service)
        if (customerData.country === 'US') {
            const stateTax = this.calculateStateTax(customerData.state, taxableAmount);
            if (stateTax > 0) {
                taxBreakdown.push({
                    name: `${customerData.state} Sales Tax`,
                    rate: this.getStateTaxRate(customerData.state),
                    amount: stateTax
                });
                totalTax += stateTax;
            }
        } else if (customerData.country === 'GB') {
            const vatRate = 0.20; // 20% VAT
            const vatAmount = Math.round(taxableAmount * vatRate);
            taxBreakdown.push({
                name: 'VAT',
                rate: vatRate,
                amount: vatAmount
            });
            totalTax += vatAmount;
        }
        
        return {
            breakdown: taxBreakdown,
            total: totalTax
        };
    }
    
    calculateStateTax(state, amount) {
        const taxRate = this.getStateTaxRate(state);
        return Math.round(amount * taxRate);
    }
    
    getStateTaxRate(state) {
        const rates = {
            'CA': 0.0875, // California
            'NY': 0.08, // New York
            'TX': 0.0625, // Texas
            'FL': 0.06, // Florida
            // Add more states as needed
        };
        
        return rates[state] || 0;
    }
    
    async getCustomerData(customerId) {
        // Mock customer data - would fetch from database
        return {
            customerId,
            country: 'US',
            state: 'CA',
            contractLengthMonths: 12,
            ageMonths: 6,
            taxExempt: false
        };
    }
}

module.exports = {
    UsageTracker,
    PricingCalculator
};