/**
 * ROOTUIP Revenue Sharing System
 * Automated revenue calculation and distribution
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class RevenueSharingSystem extends EventEmitter {
    constructor() {
        super();
        
        // Revenue models
        this.revenueModels = {
            TRANSACTION_BASED: {
                name: 'Transaction Based',
                description: 'Revenue share based on transaction fees',
                calculations: {
                    base_rate: 0.02, // 2% of transaction value
                    partner_share: 0.70, // 70% to partner
                    platform_share: 0.30 // 30% to platform
                }
            },
            SUBSCRIPTION_BASED: {
                name: 'Subscription Based',
                description: 'Revenue share from subscription fees',
                calculations: {
                    partner_share: 0.20, // 20% of subscription revenue
                    platform_share: 0.80 // 80% to platform
                }
            },
            USAGE_BASED: {
                name: 'Usage Based',
                description: 'Revenue based on API usage',
                calculations: {
                    price_per_call: 0.001, // $0.001 per API call
                    partner_share: 0.60, // 60% to partner
                    platform_share: 0.40 // 40% to platform
                }
            },
            TIERED: {
                name: 'Tiered Revenue Share',
                description: 'Progressive revenue share based on volume',
                tiers: [
                    { min: 0, max: 10000, partner_share: 0.50 },
                    { min: 10001, max: 50000, partner_share: 0.60 },
                    { min: 50001, max: 100000, partner_share: 0.70 },
                    { min: 100001, max: null, partner_share: 0.80 }
                ]
            },
            HYBRID: {
                name: 'Hybrid Model',
                description: 'Combination of multiple revenue models',
                components: ['TRANSACTION_BASED', 'SUBSCRIPTION_BASED']
            }
        };
        
        // Transaction records
        this.transactions = new Map();
        
        // Partner accounts
        this.partnerAccounts = new Map();
        
        // Payout schedules
        this.payoutSchedules = {
            DAILY: { name: 'Daily', interval: 24 * 60 * 60 * 1000 },
            WEEKLY: { name: 'Weekly', interval: 7 * 24 * 60 * 60 * 1000 },
            BIWEEKLY: { name: 'Bi-weekly', interval: 14 * 24 * 60 * 60 * 1000 },
            MONTHLY: { name: 'Monthly', interval: 30 * 24 * 60 * 60 * 1000 },
            NET30: { name: 'Net 30', interval: 30 * 24 * 60 * 60 * 1000 },
            NET60: { name: 'Net 60', interval: 60 * 24 * 60 * 60 * 1000 }
        };
        
        // Payout methods
        this.payoutMethods = {
            BANK_TRANSFER: {
                name: 'Bank Transfer',
                processingTime: '2-3 business days',
                fees: { fixed: 0, percentage: 0 },
                minPayout: 100
            },
            WIRE_TRANSFER: {
                name: 'Wire Transfer',
                processingTime: '1-2 business days',
                fees: { fixed: 25, percentage: 0 },
                minPayout: 1000
            },
            PAYPAL: {
                name: 'PayPal',
                processingTime: 'Instant',
                fees: { fixed: 0, percentage: 0.02 },
                minPayout: 10
            },
            CHECK: {
                name: 'Check',
                processingTime: '5-10 business days',
                fees: { fixed: 2, percentage: 0 },
                minPayout: 50
            }
        };
        
        // Revenue categories
        this.revenueCategories = {
            CONTAINER_TRACKING: 'container_tracking',
            SHIPMENT_BOOKING: 'shipment_booking',
            DOCUMENT_PROCESSING: 'document_processing',
            CUSTOMS_CLEARANCE: 'customs_clearance',
            ANALYTICS_SERVICES: 'analytics_services',
            PREMIUM_FEATURES: 'premium_features'
        };
        
        // Tax configurations
        this.taxConfigurations = new Map();
        
        // Dispute management
        this.disputes = new Map();
        
        this.initialize();
    }
    
    async initialize() {
        // Start payout processing
        this.startPayoutProcessing();
        
        // Start reconciliation
        this.startReconciliation();
        
        console.log('Revenue Sharing System initialized');
    }
    
    // Create partner account
    async createPartnerAccount(partnerId, config) {
        const account = {
            partnerId,
            accountId: uuidv4(),
            status: 'active',
            
            // Revenue configuration
            revenueModel: config.revenueModel || 'TRANSACTION_BASED',
            customRates: config.customRates || {},
            
            // Payout configuration
            payoutSchedule: config.payoutSchedule || 'MONTHLY',
            payoutMethod: config.payoutMethod || 'BANK_TRANSFER',
            payoutDetails: config.payoutDetails || {},
            minPayoutAmount: config.minPayoutAmount || 100,
            
            // Tax information
            taxInfo: {
                taxId: config.taxId,
                vatNumber: config.vatNumber,
                w9Submitted: config.w9Submitted || false,
                taxRate: config.taxRate || 0
            },
            
            // Financial data
            balance: {
                available: 0,
                pending: 0,
                processing: 0,
                lifetime: 0
            },
            
            // Transaction history
            transactions: [],
            payouts: [],
            
            // Metadata
            createdAt: new Date(),
            updatedAt: new Date(),
            lastPayoutAt: null
        };
        
        this.partnerAccounts.set(partnerId, account);
        
        this.emit('account:created', account);
        
        return account;
    }
    
    // Record transaction
    async recordTransaction(data) {
        const transaction = {
            id: uuidv4(),
            partnerId: data.partnerId,
            customerId: data.customerId,
            type: data.type, // 'sale', 'refund', 'chargeback'
            category: data.category,
            
            // Financial details
            amount: data.amount,
            currency: data.currency || 'USD',
            exchangeRate: data.exchangeRate || 1,
            
            // Revenue calculation
            revenueModel: data.revenueModel,
            grossRevenue: data.amount,
            partnerRevenue: 0,
            platformRevenue: 0,
            fees: 0,
            netRevenue: 0,
            
            // Status
            status: 'pending', // 'pending', 'processed', 'settled', 'disputed'
            
            // Metadata
            description: data.description,
            metadata: data.metadata || {},
            timestamp: new Date(),
            processedAt: null,
            settledAt: null
        };
        
        // Calculate revenue split
        const revenueCalculation = await this.calculateRevenue(transaction);
        Object.assign(transaction, revenueCalculation);
        
        // Store transaction
        this.transactions.set(transaction.id, transaction);
        
        // Update partner account
        await this.updatePartnerBalance(transaction);
        
        this.emit('transaction:recorded', transaction);
        
        return transaction;
    }
    
    // Calculate revenue split
    async calculateRevenue(transaction) {
        const account = this.partnerAccounts.get(transaction.partnerId);
        if (!account) throw new Error('Partner account not found');
        
        const model = this.revenueModels[account.revenueModel];
        let partnerRevenue = 0;
        let platformRevenue = 0;
        let fees = 0;
        
        switch (account.revenueModel) {
            case 'TRANSACTION_BASED':
                const transactionFee = transaction.amount * model.calculations.base_rate;
                partnerRevenue = transactionFee * model.calculations.partner_share;
                platformRevenue = transactionFee * model.calculations.platform_share;
                break;
                
            case 'SUBSCRIPTION_BASED':
                partnerRevenue = transaction.amount * model.calculations.partner_share;
                platformRevenue = transaction.amount * model.calculations.platform_share;
                break;
                
            case 'USAGE_BASED':
                const usageFee = (transaction.metadata.apiCalls || 0) * model.calculations.price_per_call;
                partnerRevenue = usageFee * model.calculations.partner_share;
                platformRevenue = usageFee * model.calculations.platform_share;
                break;
                
            case 'TIERED':
                const tier = model.tiers.find(t => 
                    transaction.amount >= t.min && 
                    (t.max === null || transaction.amount <= t.max)
                );
                partnerRevenue = transaction.amount * tier.partner_share;
                platformRevenue = transaction.amount * (1 - tier.partner_share);
                break;
                
            case 'HYBRID':
                // Calculate each component
                for (const component of model.components) {
                    const componentModel = this.revenueModels[component];
                    // Simplified calculation for hybrid model
                    partnerRevenue += transaction.amount * 0.1;
                    platformRevenue += transaction.amount * 0.05;
                }
                break;
        }
        
        // Apply custom rates if configured
        if (account.customRates && account.customRates[transaction.category]) {
            const customRate = account.customRates[transaction.category];
            partnerRevenue = transaction.amount * customRate.partner_share;
            platformRevenue = transaction.amount * customRate.platform_share;
        }
        
        // Apply fees
        if (transaction.type === 'refund') {
            fees = transaction.amount * 0.03; // 3% refund fee
            partnerRevenue = -partnerRevenue;
            platformRevenue = -platformRevenue;
        } else if (transaction.type === 'chargeback') {
            fees = 15; // $15 chargeback fee
            partnerRevenue = -transaction.amount;
            platformRevenue = 0;
        }
        
        // Calculate net revenue
        const netRevenue = partnerRevenue - fees;
        
        return {
            partnerRevenue: Math.round(partnerRevenue * 100) / 100,
            platformRevenue: Math.round(platformRevenue * 100) / 100,
            fees: Math.round(fees * 100) / 100,
            netRevenue: Math.round(netRevenue * 100) / 100
        };
    }
    
    // Update partner balance
    async updatePartnerBalance(transaction) {
        const account = this.partnerAccounts.get(transaction.partnerId);
        if (!account) return;
        
        // Update balance based on transaction status
        if (transaction.status === 'pending') {
            account.balance.pending += transaction.netRevenue;
        } else if (transaction.status === 'processed') {
            account.balance.pending -= transaction.netRevenue;
            account.balance.available += transaction.netRevenue;
        }
        
        account.balance.lifetime += Math.max(0, transaction.netRevenue);
        account.updatedAt = new Date();
        
        // Add to transaction history
        account.transactions.push({
            transactionId: transaction.id,
            amount: transaction.netRevenue,
            type: transaction.type,
            timestamp: transaction.timestamp
        });
        
        this.emit('balance:updated', {
            partnerId: transaction.partnerId,
            balance: account.balance
        });
    }
    
    // Process payout
    async processPayout(partnerId, amount = null) {
        const account = this.partnerAccounts.get(partnerId);
        if (!account) throw new Error('Partner account not found');
        
        // Determine payout amount
        const payoutAmount = amount || account.balance.available;
        
        // Validate payout
        if (payoutAmount < account.minPayoutAmount) {
            throw new Error(`Minimum payout amount is ${account.minPayoutAmount}`);
        }
        
        if (payoutAmount > account.balance.available) {
            throw new Error('Insufficient available balance');
        }
        
        // Calculate payout fees
        const method = this.payoutMethods[account.payoutMethod];
        const payoutFees = method.fees.fixed + (payoutAmount * method.fees.percentage);
        const netPayout = payoutAmount - payoutFees;
        
        // Create payout record
        const payout = {
            id: uuidv4(),
            partnerId,
            amount: payoutAmount,
            fees: payoutFees,
            netAmount: netPayout,
            currency: 'USD',
            method: account.payoutMethod,
            status: 'processing',
            
            // Payout details
            reference: `PAYOUT-${Date.now()}`,
            description: `Partner payout for ${account.partnerId}`,
            
            // Transaction references
            transactions: await this.getPayoutTransactions(partnerId, payoutAmount),
            
            // Timestamps
            requestedAt: new Date(),
            processedAt: null,
            completedAt: null,
            
            // Payment details
            paymentDetails: {
                method: account.payoutMethod,
                destination: account.payoutDetails
            }
        };
        
        // Update balances
        account.balance.available -= payoutAmount;
        account.balance.processing += payoutAmount;
        account.lastPayoutAt = new Date();
        
        // Store payout
        account.payouts.push(payout);
        
        // Process payment
        await this.processPayment(payout);
        
        this.emit('payout:initiated', payout);
        
        return payout;
    }
    
    // Get transactions for payout
    async getPayoutTransactions(partnerId, amount) {
        const transactions = [];
        let total = 0;
        
        // Get transactions that make up this payout
        for (const [id, transaction] of this.transactions) {
            if (transaction.partnerId === partnerId && 
                transaction.status === 'processed' &&
                !transaction.payoutId) {
                transactions.push(transaction.id);
                total += transaction.netRevenue;
                
                if (total >= amount) break;
            }
        }
        
        return transactions;
    }
    
    // Process payment
    async processPayment(payout) {
        // Simulate payment processing
        setTimeout(async () => {
            payout.status = 'completed';
            payout.processedAt = new Date();
            payout.completedAt = new Date();
            
            // Update partner balance
            const account = this.partnerAccounts.get(payout.partnerId);
            account.balance.processing -= payout.amount;
            
            // Mark transactions as paid
            for (const transactionId of payout.transactions) {
                const transaction = this.transactions.get(transactionId);
                if (transaction) {
                    transaction.payoutId = payout.id;
                    transaction.settledAt = new Date();
                    transaction.status = 'settled';
                }
            }
            
            this.emit('payout:completed', payout);
        }, 5000); // 5 second delay for demo
    }
    
    // Generate revenue report
    async generateRevenueReport(partnerId, period) {
        const account = this.partnerAccounts.get(partnerId);
        if (!account) throw new Error('Partner account not found');
        
        const startDate = this.getStartDate(period);
        const endDate = new Date();
        
        // Get transactions for period
        const transactions = account.transactions.filter(t => {
            const transaction = this.transactions.get(t.transactionId);
            return transaction && 
                   transaction.timestamp >= startDate && 
                   transaction.timestamp <= endDate;
        });
        
        // Calculate totals
        const summary = {
            totalTransactions: transactions.length,
            grossRevenue: 0,
            partnerRevenue: 0,
            platformRevenue: 0,
            fees: 0,
            netRevenue: 0
        };
        
        // Group by category
        const byCategory = {};
        const byStatus = {};
        const daily = {};
        
        for (const t of transactions) {
            const transaction = this.transactions.get(t.transactionId);
            if (!transaction) continue;
            
            // Update summary
            summary.grossRevenue += transaction.grossRevenue;
            summary.partnerRevenue += transaction.partnerRevenue;
            summary.platformRevenue += transaction.platformRevenue;
            summary.fees += transaction.fees;
            summary.netRevenue += transaction.netRevenue;
            
            // Group by category
            if (!byCategory[transaction.category]) {
                byCategory[transaction.category] = {
                    count: 0,
                    revenue: 0
                };
            }
            byCategory[transaction.category].count++;
            byCategory[transaction.category].revenue += transaction.netRevenue;
            
            // Group by status
            if (!byStatus[transaction.status]) {
                byStatus[transaction.status] = {
                    count: 0,
                    revenue: 0
                };
            }
            byStatus[transaction.status].count++;
            byStatus[transaction.status].revenue += transaction.netRevenue;
            
            // Daily breakdown
            const day = transaction.timestamp.toISOString().split('T')[0];
            if (!daily[day]) {
                daily[day] = {
                    transactions: 0,
                    revenue: 0
                };
            }
            daily[day].transactions++;
            daily[day].revenue += transaction.netRevenue;
        }
        
        // Get payouts for period
        const payouts = account.payouts.filter(p => 
            p.requestedAt >= startDate && p.requestedAt <= endDate
        );
        
        const report = {
            partnerId,
            period,
            generatedAt: new Date(),
            dateRange: {
                start: startDate,
                end: endDate
            },
            summary,
            breakdown: {
                byCategory,
                byStatus,
                daily
            },
            payouts: {
                count: payouts.length,
                total: payouts.reduce((sum, p) => sum + p.netAmount, 0),
                list: payouts.map(p => ({
                    id: p.id,
                    amount: p.netAmount,
                    date: p.completedAt,
                    status: p.status
                }))
            },
            currentBalance: account.balance,
            projectedPayout: this.calculateProjectedPayout(account)
        };
        
        return report;
    }
    
    // Calculate projected payout
    calculateProjectedPayout(account) {
        const schedule = this.payoutSchedules[account.payoutSchedule];
        const lastPayout = account.lastPayoutAt || account.createdAt;
        const nextPayout = new Date(lastPayout.getTime() + schedule.interval);
        
        return {
            amount: account.balance.available + account.balance.pending,
            date: nextPayout,
            schedule: account.payoutSchedule
        };
    }
    
    // Handle disputes
    async createDispute(transactionId, reason, evidence = {}) {
        const transaction = this.transactions.get(transactionId);
        if (!transaction) throw new Error('Transaction not found');
        
        const dispute = {
            id: uuidv4(),
            transactionId,
            partnerId: transaction.partnerId,
            amount: transaction.amount,
            reason,
            evidence,
            status: 'open', // 'open', 'under_review', 'resolved', 'lost'
            
            createdAt: new Date(),
            updatedAt: new Date(),
            resolvedAt: null,
            
            communications: [],
            resolution: null
        };
        
        // Update transaction status
        transaction.status = 'disputed';
        
        // Hold funds
        const account = this.partnerAccounts.get(transaction.partnerId);
        if (account && transaction.netRevenue > 0) {
            account.balance.available -= transaction.netRevenue;
            account.balance.pending += transaction.netRevenue;
        }
        
        this.disputes.set(dispute.id, dispute);
        
        this.emit('dispute:created', dispute);
        
        return dispute;
    }
    
    // Resolve dispute
    async resolveDispute(disputeId, resolution) {
        const dispute = this.disputes.get(disputeId);
        if (!dispute) throw new Error('Dispute not found');
        
        const transaction = this.transactions.get(dispute.transactionId);
        const account = this.partnerAccounts.get(dispute.partnerId);
        
        dispute.status = 'resolved';
        dispute.resolvedAt = new Date();
        dispute.resolution = resolution;
        
        // Update balances based on resolution
        if (resolution.outcome === 'partner_wins') {
            // Release held funds
            if (account && transaction.netRevenue > 0) {
                account.balance.pending -= transaction.netRevenue;
                account.balance.available += transaction.netRevenue;
            }
            transaction.status = 'processed';
        } else if (resolution.outcome === 'customer_wins') {
            // Remove revenue
            if (account && transaction.netRevenue > 0) {
                account.balance.pending -= transaction.netRevenue;
            }
            transaction.status = 'refunded';
        }
        
        this.emit('dispute:resolved', {
            dispute,
            resolution
        });
        
        return dispute;
    }
    
    // Configure tax settings
    async configureTax(partnerId, taxConfig) {
        const config = {
            partnerId,
            ...taxConfig,
            updatedAt: new Date()
        };
        
        this.taxConfigurations.set(partnerId, config);
        
        // Update partner account
        const account = this.partnerAccounts.get(partnerId);
        if (account) {
            account.taxInfo = {
                ...account.taxInfo,
                ...taxConfig
            };
        }
        
        return config;
    }
    
    // Calculate tax withholding
    calculateTaxWithholding(partnerId, amount) {
        const taxConfig = this.taxConfigurations.get(partnerId);
        if (!taxConfig || !taxConfig.withholding) return 0;
        
        let withholding = 0;
        
        // US tax withholding
        if (taxConfig.country === 'US' && !taxConfig.w9Submitted) {
            withholding = amount * 0.24; // 24% backup withholding
        }
        
        // International withholding
        if (taxConfig.country !== 'US' && !taxConfig.taxTreatyBenefit) {
            withholding = amount * 0.30; // 30% withholding
        }
        
        return withholding;
    }
    
    // Generate tax documents
    async generateTaxDocuments(partnerId, year) {
        const account = this.partnerAccounts.get(partnerId);
        if (!account) throw new Error('Partner account not found');
        
        // Get all transactions for the year
        const yearTransactions = account.transactions.filter(t => {
            const transaction = this.transactions.get(t.transactionId);
            return transaction && 
                   transaction.timestamp.getFullYear() === year &&
                   transaction.status === 'settled';
        });
        
        // Calculate totals
        let totalRevenue = 0;
        let totalFees = 0;
        let totalPayouts = 0;
        
        for (const t of yearTransactions) {
            const transaction = this.transactions.get(t.transactionId);
            totalRevenue += transaction.partnerRevenue;
            totalFees += transaction.fees;
        }
        
        // Get payouts for the year
        const yearPayouts = account.payouts.filter(p => 
            p.completedAt && p.completedAt.getFullYear() === year
        );
        
        totalPayouts = yearPayouts.reduce((sum, p) => sum + p.netAmount, 0);
        
        const taxDocument = {
            partnerId,
            year,
            type: account.taxInfo.country === 'US' ? '1099-K' : 'MISC',
            
            summary: {
                grossRevenue: totalRevenue,
                fees: totalFees,
                netRevenue: totalRevenue - totalFees,
                totalPayouts,
                transactionCount: yearTransactions.length
            },
            
            partnerInfo: {
                name: account.partnerName,
                taxId: account.taxInfo.taxId,
                address: account.taxInfo.address
            },
            
            generatedAt: new Date(),
            documentUrl: `/tax-documents/${partnerId}/${year}`
        };
        
        return taxDocument;
    }
    
    // Reconciliation
    async reconcileTransactions(date = new Date()) {
        const reconciledTransactions = [];
        
        // Process pending transactions older than 24 hours
        const cutoffTime = new Date(date.getTime() - 24 * 60 * 60 * 1000);
        
        for (const [id, transaction] of this.transactions) {
            if (transaction.status === 'pending' && 
                transaction.timestamp < cutoffTime) {
                
                // Mark as processed
                transaction.status = 'processed';
                transaction.processedAt = new Date();
                
                // Update partner balance
                await this.updatePartnerBalance(transaction);
                
                reconciledTransactions.push(transaction);
            }
        }
        
        // Generate reconciliation report
        const report = {
            date,
            transactionsReconciled: reconciledTransactions.length,
            totalAmount: reconciledTransactions.reduce((sum, t) => sum + t.amount, 0),
            partnerBreakdown: this.groupByPartner(reconciledTransactions)
        };
        
        this.emit('reconciliation:completed', report);
        
        return report;
    }
    
    // Helper methods
    getStartDate(period) {
        const now = new Date();
        const match = period.match(/(\d+)([dwmy])/);
        if (!match) return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const value = parseInt(match[1]);
        const unit = match[2];
        
        switch (unit) {
            case 'd': return new Date(now.getTime() - value * 24 * 60 * 60 * 1000);
            case 'w': return new Date(now.getTime() - value * 7 * 24 * 60 * 60 * 1000);
            case 'm': 
                const monthsAgo = new Date(now);
                monthsAgo.setMonth(monthsAgo.getMonth() - value);
                return monthsAgo;
            case 'y':
                const yearsAgo = new Date(now);
                yearsAgo.setFullYear(yearsAgo.getFullYear() - value);
                return yearsAgo;
            default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
    }
    
    groupByPartner(transactions) {
        const grouped = {};
        
        for (const transaction of transactions) {
            if (!grouped[transaction.partnerId]) {
                grouped[transaction.partnerId] = {
                    count: 0,
                    amount: 0,
                    revenue: 0
                };
            }
            
            grouped[transaction.partnerId].count++;
            grouped[transaction.partnerId].amount += transaction.amount;
            grouped[transaction.partnerId].revenue += transaction.partnerRevenue;
        }
        
        return grouped;
    }
    
    // Start payout processing
    startPayoutProcessing() {
        // Check for scheduled payouts every hour
        setInterval(async () => {
            await this.processScheduledPayouts();
        }, 60 * 60 * 1000);
    }
    
    async processScheduledPayouts() {
        for (const [partnerId, account] of this.partnerAccounts) {
            const schedule = this.payoutSchedules[account.payoutSchedule];
            const lastPayout = account.lastPayoutAt || account.createdAt;
            const nextPayout = new Date(lastPayout.getTime() + schedule.interval);
            
            if (new Date() >= nextPayout && account.balance.available >= account.minPayoutAmount) {
                try {
                    await this.processPayout(partnerId);
                } catch (error) {
                    console.error(`Failed to process payout for ${partnerId}:`, error);
                }
            }
        }
    }
    
    // Start reconciliation
    startReconciliation() {
        // Run reconciliation daily at 2 AM
        const now = new Date();
        const tomorrow2am = new Date(now);
        tomorrow2am.setDate(tomorrow2am.getDate() + 1);
        tomorrow2am.setHours(2, 0, 0, 0);
        
        const timeUntil2am = tomorrow2am.getTime() - now.getTime();
        
        setTimeout(() => {
            this.reconcileTransactions();
            
            // Then run daily
            setInterval(() => {
                this.reconcileTransactions();
            }, 24 * 60 * 60 * 1000);
        }, timeUntil2am);
    }
}

module.exports = RevenueSharingSystem;