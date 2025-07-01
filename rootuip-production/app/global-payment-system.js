/**
 * ROOTUIP Global Payment System
 * Multi-region payment processing with local payment methods
 */

const EventEmitter = require('events');
const crypto = require('crypto');

// Global Payment Manager
class GlobalPaymentManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            defaultCurrency: config.defaultCurrency || 'USD',
            enabledRegions: config.enabledRegions || ['US', 'EU', 'UK', 'CA', 'AU', 'SG', 'JP'],
            fallbackPaymentMethod: config.fallbackPaymentMethod || 'stripe',
            ...config
        };
        
        this.paymentProviders = new Map();
        this.regionalMethods = new Map();
        this.currencyRates = new Map();
        this.taxRates = new Map();
        this.complianceRules = new Map();
        
        this.setupPaymentProviders();
        this.setupRegionalMethods();
        this.setupTaxRates();
        this.setupComplianceRules();
    }
    
    // Setup payment providers by region
    setupPaymentProviders() {
        // Stripe - Global coverage
        this.paymentProviders.set('stripe', {
            id: 'stripe',
            name: 'Stripe',
            regions: ['US', 'EU', 'UK', 'CA', 'AU', 'SG', 'JP', 'MX', 'BR'],
            currencies: [
                'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'JPY', 
                'MXN', 'BRL', 'CHF', 'SEK', 'NOK', 'DKK'
            ],
            paymentMethods: [
                'card', 'apple_pay', 'google_pay', 'link', 'bank_transfer'
            ],
            features: {
                subscriptions: true,
                multiparty: true,
                marketplace: true,
                connect: true,
                radar: true
            },
            fees: {
                card: 2.9,
                bank_transfer: 0.8,
                apple_pay: 2.9,
                google_pay: 2.9
            },
            apiVersion: '2023-10-16'
        });
        
        // PayPal - Global coverage
        this.paymentProviders.set('paypal', {
            id: 'paypal',
            name: 'PayPal',
            regions: ['US', 'EU', 'UK', 'CA', 'AU', 'SG', 'JP', 'MX', 'BR'],
            currencies: [
                'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD', 'JPY',
                'MXN', 'BRL', 'CHF', 'SEK', 'NOK', 'DKK'
            ],
            paymentMethods: ['paypal', 'paypal_credit', 'venmo'],
            features: {
                subscriptions: true,
                express_checkout: true,
                buyer_protection: true
            },
            fees: {
                paypal: 3.4,
                venmo: 3.4
            }
        });
        
        // Adyen - Europe & Asia Pacific
        this.paymentProviders.set('adyen', {
            id: 'adyen',
            name: 'Adyen',
            regions: ['EU', 'UK', 'SG', 'AU', 'JP'],
            currencies: [
                'EUR', 'GBP', 'SGD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK'
            ],
            paymentMethods: [
                'card', 'ideal', 'sofort', 'bancontact', 'giropay', 
                'eps', 'multibanco', 'alipay', 'wechat_pay'
            ],
            features: {
                risk_management: true,
                dynamic_3ds: true,
                account_updater: true
            },
            fees: {
                card: 2.8,
                ideal: 0.29,
                sofort: 0.9
            }
        });
        
        // Square - US, Canada, UK, Australia
        this.paymentProviders.set('square', {
            id: 'square',
            name: 'Square',
            regions: ['US', 'CA', 'UK', 'AU'],
            currencies: ['USD', 'CAD', 'GBP', 'AUD'],
            paymentMethods: ['card', 'apple_pay', 'google_pay', 'cash_app'],
            features: {
                invoicing: true,
                recurring: true,
                terminal: true
            },
            fees: {
                card: 2.9,
                apple_pay: 2.9,
                google_pay: 2.9
            }
        });
        
        // Razorpay - India
        this.paymentProviders.set('razorpay', {
            id: 'razorpay',
            name: 'Razorpay',
            regions: ['IN'],
            currencies: ['INR'],
            paymentMethods: [
                'card', 'netbanking', 'upi', 'wallet', 'emi', 'bank_transfer'
            ],
            features: {
                smart_collect: true,
                payment_links: true,
                subscriptions: true
            },
            fees: {
                card: 2.0,
                netbanking: 2.0,
                upi: 0.0
            }
        });
    }
    
    // Setup regional payment methods
    setupRegionalMethods() {
        // United States
        this.regionalMethods.set('US', {
            region: 'US',
            currency: 'USD',
            preferredProviders: ['stripe', 'paypal', 'square'],
            localMethods: [
                {
                    id: 'ach',
                    name: 'ACH Bank Transfer',
                    type: 'bank_transfer',
                    processingTime: '3-5 business days',
                    fees: { fixed: 50, percentage: 0 }, // $0.50
                    popular: true
                },
                {
                    id: 'wire_transfer',
                    name: 'Wire Transfer',
                    type: 'bank_transfer',
                    processingTime: '1-2 business days',
                    fees: { fixed: 2500, percentage: 0 }, // $25.00
                    popular: false
                },
                {
                    id: 'apple_pay',
                    name: 'Apple Pay',
                    type: 'digital_wallet',
                    processingTime: 'instant',
                    fees: { fixed: 0, percentage: 2.9 },
                    popular: true
                },
                {
                    id: 'google_pay',
                    name: 'Google Pay',
                    type: 'digital_wallet',
                    processingTime: 'instant',
                    fees: { fixed: 0, percentage: 2.9 },
                    popular: true
                }
            ],
            taxInfo: {
                salesTaxRequired: true,
                stateSpecific: true,
                exemptionCertificates: true
            }
        });
        
        // European Union
        this.regionalMethods.set('EU', {
            region: 'EU',
            currency: 'EUR',
            preferredProviders: ['stripe', 'adyen', 'paypal'],
            localMethods: [
                {
                    id: 'sepa_debit',
                    name: 'SEPA Direct Debit',
                    type: 'bank_debit',
                    processingTime: '2-3 business days',
                    fees: { fixed: 35, percentage: 0 }, // €0.35
                    popular: true,
                    countries: ['DE', 'FR', 'NL', 'BE', 'AT', 'IT', 'ES']
                },
                {
                    id: 'ideal',
                    name: 'iDEAL',
                    type: 'bank_redirect',
                    processingTime: 'instant',
                    fees: { fixed: 29, percentage: 0 }, // €0.29
                    popular: true,
                    countries: ['NL']
                },
                {
                    id: 'sofort',
                    name: 'Sofort',
                    type: 'bank_redirect',
                    processingTime: 'instant',
                    fees: { fixed: 25, percentage: 1.4 },
                    popular: true,
                    countries: ['DE', 'AT', 'CH']
                },
                {
                    id: 'bancontact',
                    name: 'Bancontact',
                    type: 'bank_redirect',
                    processingTime: 'instant',
                    fees: { fixed: 25, percentage: 0 },
                    popular: true,
                    countries: ['BE']
                },
                {
                    id: 'giropay',
                    name: 'giropay',
                    type: 'bank_redirect',
                    processingTime: 'instant',
                    fees: { fixed: 25, percentage: 1.2 },
                    popular: true,
                    countries: ['DE']
                }
            ],
            taxInfo: {
                vatRequired: true,
                vatRates: 'country_specific',
                ossAvailable: true,
                iossRequired: false
            }
        });
        
        // United Kingdom
        this.regionalMethods.set('UK', {
            region: 'UK',
            currency: 'GBP',
            preferredProviders: ['stripe', 'adyen', 'paypal'],
            localMethods: [
                {
                    id: 'bacs_debit',
                    name: 'Bacs Direct Debit',
                    type: 'bank_debit',
                    processingTime: '3-5 business days',
                    fees: { fixed: 20, percentage: 0 }, // £0.20
                    popular: true
                },
                {
                    id: 'faster_payments',
                    name: 'Faster Payments',
                    type: 'bank_transfer',
                    processingTime: 'instant',
                    fees: { fixed: 30, percentage: 0 }, // £0.30
                    popular: true
                }
            ],
            taxInfo: {
                vatRequired: true,
                vatRate: 20.0,
                reverseCharge: false
            }
        });
        
        // Singapore
        this.regionalMethods.set('SG', {
            region: 'SG',
            currency: 'SGD',
            preferredProviders: ['stripe', 'adyen'],
            localMethods: [
                {
                    id: 'paynow',
                    name: 'PayNow',
                    type: 'real_time_payment',
                    processingTime: 'instant',
                    fees: { fixed: 0, percentage: 0 },
                    popular: true
                },
                {
                    id: 'grabpay',
                    name: 'GrabPay',
                    type: 'digital_wallet',
                    processingTime: 'instant',
                    fees: { fixed: 0, percentage: 2.5 },
                    popular: true
                }
            ],
            taxInfo: {
                gstRequired: true,
                gstRate: 8.0,
                exemptThreshold: 100000 // S$1M
            }
        });
        
        // Japan
        this.regionalMethods.set('JP', {
            region: 'JP',
            currency: 'JPY',
            preferredProviders: ['stripe', 'adyen'],
            localMethods: [
                {
                    id: 'konbini',
                    name: 'Konbini',
                    type: 'cash_payment',
                    processingTime: '1-3 business days',
                    fees: { fixed: 150, percentage: 0 }, // ¥150
                    popular: true
                },
                {
                    id: 'pay_easy',
                    name: 'Pay-easy',
                    type: 'bank_transfer',
                    processingTime: '1-2 business days',
                    fees: { fixed: 100, percentage: 0 }, // ¥100
                    popular: true
                }
            ],
            taxInfo: {
                consumptionTaxRequired: true,
                consumptionTaxRate: 10.0,
                qualifiedInvoiceRequired: true
            }
        });
        
        // Australia
        this.regionalMethods.set('AU', {
            region: 'AU',
            currency: 'AUD',
            preferredProviders: ['stripe', 'square'],
            localMethods: [
                {
                    id: 'bpay',
                    name: 'BPAY',
                    type: 'bank_transfer',
                    processingTime: '1-2 business days',
                    fees: { fixed: 0, percentage: 0 },
                    popular: true
                },
                {
                    id: 'poli',
                    name: 'POLi',
                    type: 'bank_redirect',
                    processingTime: 'instant',
                    fees: { fixed: 95, percentage: 0 }, // $0.95
                    popular: false
                }
            ],
            taxInfo: {
                gstRequired: true,
                gstRate: 10.0,
                abn_required: true
            }
        });
        
        // Canada
        this.regionalMethods.set('CA', {
            region: 'CA',
            currency: 'CAD',
            preferredProviders: ['stripe', 'paypal', 'square'],
            localMethods: [
                {
                    id: 'interac',
                    name: 'Interac',
                    type: 'bank_debit',
                    processingTime: 'instant',
                    fees: { fixed: 125, percentage: 0 }, // $1.25
                    popular: true
                }
            ],
            taxInfo: {
                hstRequired: true,
                provincialTax: true,
                gstRate: 5.0
            }
        });
    }
    
    // Setup tax rates by region
    setupTaxRates() {
        // US State Sales Tax Rates
        this.taxRates.set('US', {
            type: 'sales_tax',
            rates: {
                'AL': 4.0, 'AK': 0.0, 'AZ': 5.6, 'AR': 6.5, 'CA': 7.25,
                'CO': 2.9, 'CT': 6.35, 'DE': 0.0, 'FL': 6.0, 'GA': 4.0,
                'HI': 4.17, 'ID': 6.0, 'IL': 6.25, 'IN': 7.0, 'IA': 6.0,
                'KS': 6.5, 'KY': 6.0, 'LA': 4.45, 'ME': 5.5, 'MD': 6.0,
                'MA': 6.25, 'MI': 6.0, 'MN': 6.88, 'MS': 7.0, 'MO': 4.23,
                'MT': 0.0, 'NE': 5.5, 'NV': 6.85, 'NH': 0.0, 'NJ': 6.63,
                'NM': 5.13, 'NY': 8.0, 'NC': 4.75, 'ND': 5.0, 'OH': 5.75,
                'OK': 4.5, 'OR': 0.0, 'PA': 6.0, 'RI': 7.0, 'SC': 6.0,
                'SD': 4.5, 'TN': 7.0, 'TX': 6.25, 'UT': 4.85, 'VT': 6.0,
                'VA': 5.3, 'WA': 6.5, 'WV': 6.0, 'WI': 5.0, 'WY': 4.0
            },
            exemptions: ['resale_certificate', 'nonprofit_exemption']
        });
        
        // EU VAT Rates
        this.taxRates.set('EU', {
            type: 'vat',
            rates: {
                'AT': 20.0, 'BE': 21.0, 'BG': 20.0, 'HR': 25.0, 'CY': 19.0,
                'CZ': 21.0, 'DK': 25.0, 'EE': 20.0, 'FI': 24.0, 'FR': 20.0,
                'DE': 19.0, 'GR': 24.0, 'HU': 27.0, 'IE': 23.0, 'IT': 22.0,
                'LV': 21.0, 'LT': 21.0, 'LU': 17.0, 'MT': 18.0, 'NL': 21.0,
                'PL': 23.0, 'PT': 23.0, 'RO': 19.0, 'SK': 20.0, 'SI': 22.0,
                'ES': 21.0, 'SE': 25.0
            },
            threshold: 10000, // €10,000 for OSS
            ossAvailable: true
        });
        
        // Other regions
        this.taxRates.set('UK', { type: 'vat', rate: 20.0 });
        this.taxRates.set('CA', { type: 'gst_hst', gstRate: 5.0, provincialRates: true });
        this.taxRates.set('AU', { type: 'gst', rate: 10.0, threshold: 75000 });
        this.taxRates.set('SG', { type: 'gst', rate: 8.0, threshold: 100000 });
        this.taxRates.set('JP', { type: 'consumption_tax', rate: 10.0 });
    }
    
    // Setup compliance rules
    setupComplianceRules() {
        this.complianceRules.set('PCI_DSS', {
            scope: 'global',
            requirements: [
                'encrypted_transmission',
                'secure_storage',
                'access_control',
                'monitoring',
                'testing',
                'information_security_policy'
            ],
            validation: 'annual'
        });
        
        this.complianceRules.set('PSD2', {
            scope: 'EU',
            requirements: [
                'strong_customer_authentication',
                'open_banking_apis',
                'transaction_monitoring',
                'fraud_prevention'
            ],
            validation: 'continuous'
        });
        
        this.complianceRules.set('SOX', {
            scope: 'US',
            requirements: [
                'financial_controls',
                'audit_trails',
                'segregation_of_duties',
                'change_management'
            ],
            validation: 'annual'
        });
    }
    
    // Determine optimal payment methods for user
    async getOptimalPaymentMethods(userLocation, amount, currency) {
        const region = this.getRegionFromLocation(userLocation);
        const regionalMethods = this.regionalMethods.get(region);
        
        if (!regionalMethods) {
            throw new Error(`Unsupported region: ${region}`);
        }
        
        const recommendations = {
            region,
            currency: currency || regionalMethods.currency,
            amount,
            methods: [],
            providers: regionalMethods.preferredProviders,
            taxInfo: regionalMethods.taxInfo
        };
        
        // Add credit/debit cards (universal)
        recommendations.methods.push({
            id: 'card',
            name: 'Credit/Debit Card',
            type: 'card',
            processingTime: 'instant',
            fees: this.calculateCardFees(amount, region),
            popular: true,
            supported: true,
            logos: ['visa', 'mastercard', 'amex']
        });
        
        // Add regional payment methods
        for (const method of regionalMethods.localMethods) {
            const fees = this.calculateMethodFees(amount, method.fees);
            
            recommendations.methods.push({
                ...method,
                fees,
                supported: this.isMethodSupported(method, userLocation),
                recommendationScore: this.scorePaymentMethod(method, amount, userLocation)
            });
        }
        
        // Sort by recommendation score and popularity
        recommendations.methods.sort((a, b) => {
            if (b.popular !== a.popular) return b.popular ? 1 : -1;
            return (b.recommendationScore || 0) - (a.recommendationScore || 0);
        });
        
        return recommendations;
    }
    
    // Process payment with optimal provider
    async processPayment(paymentData) {
        const {
            amount,
            currency,
            paymentMethod,
            customerInfo,
            metadata = {}
        } = paymentData;
        
        // Determine optimal provider
        const provider = await this.selectOptimalProvider(
            paymentMethod,
            customerInfo.region,
            currency
        );
        
        // Validate compliance
        await this.validateCompliance(paymentData, provider);
        
        // Calculate taxes
        const taxCalculation = await this.calculateTaxes(
            amount,
            customerInfo.region,
            customerInfo.address
        );
        
        // Create payment intent
        const paymentIntent = {
            id: this.generatePaymentId(),
            amount: amount + taxCalculation.totalTax,
            currency,
            provider: provider.id,
            paymentMethod,
            customer: customerInfo,
            taxes: taxCalculation,
            metadata: {
                ...metadata,
                originalAmount: amount,
                taxAmount: taxCalculation.totalTax
            },
            status: 'pending',
            createdAt: new Date()
        };
        
        try {
            // Process with selected provider
            const result = await this.processWithProvider(provider, paymentIntent);
            
            paymentIntent.status = result.status;
            paymentIntent.providerResponse = result;
            paymentIntent.processedAt = new Date();
            
            // Record for compliance
            await this.recordPaymentForCompliance(paymentIntent);
            
            this.emit('payment_processed', {
                paymentId: paymentIntent.id,
                amount: paymentIntent.amount,
                currency,
                status: result.status,
                provider: provider.id
            });
            
            return paymentIntent;
            
        } catch (error) {
            paymentIntent.status = 'failed';
            paymentIntent.error = error.message;
            paymentIntent.failedAt = new Date();
            
            this.emit('payment_failed', {
                paymentId: paymentIntent.id,
                error: error.message,
                provider: provider.id
            });
            
            throw error;
        }
    }
    
    // Calculate taxes for payment
    async calculateTaxes(amount, region, address) {
        const taxInfo = this.taxRates.get(region);
        
        if (!taxInfo) {
            return {
                applicable: false,
                totalTax: 0,
                breakdown: []
            };
        }
        
        const calculation = {
            applicable: true,
            totalTax: 0,
            breakdown: [],
            exemptionApplied: false
        };
        
        switch (taxInfo.type) {
            case 'sales_tax':
                calculation.totalTax = this.calculateUSSalesTax(amount, address);
                calculation.breakdown.push({
                    type: 'state_sales_tax',
                    rate: taxInfo.rates[address.state] || 0,
                    amount: calculation.totalTax
                });
                break;
                
            case 'vat':
                const vatRate = taxInfo.rates ? taxInfo.rates[address.country] : taxInfo.rate;
                calculation.totalTax = Math.round(amount * (vatRate / 100));
                calculation.breakdown.push({
                    type: 'vat',
                    rate: vatRate,
                    amount: calculation.totalTax
                });
                break;
                
            case 'gst':
                calculation.totalTax = Math.round(amount * (taxInfo.rate / 100));
                calculation.breakdown.push({
                    type: 'gst',
                    rate: taxInfo.rate,
                    amount: calculation.totalTax
                });
                break;
                
            case 'gst_hst':
                const gstAmount = Math.round(amount * (taxInfo.gstRate / 100));
                calculation.totalTax = gstAmount;
                calculation.breakdown.push({
                    type: 'gst',
                    rate: taxInfo.gstRate,
                    amount: gstAmount
                });
                
                // Add provincial tax if applicable
                if (taxInfo.provincialRates && address.province) {
                    const provincialRate = this.getProvincialTaxRate(address.province);
                    if (provincialRate > 0) {
                        const provincialAmount = Math.round(amount * (provincialRate / 100));
                        calculation.totalTax += provincialAmount;
                        calculation.breakdown.push({
                            type: 'provincial_tax',
                            rate: provincialRate,
                            amount: provincialAmount
                        });
                    }
                }
                break;
        }
        
        return calculation;
    }
    
    // Multi-currency support
    async convertCurrency(amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) {
            return { amount, rate: 1.0, timestamp: new Date() };
        }
        
        const rate = await this.getExchangeRate(fromCurrency, toCurrency);
        const convertedAmount = Math.round(amount * rate);
        
        return {
            originalAmount: amount,
            originalCurrency: fromCurrency,
            amount: convertedAmount,
            currency: toCurrency,
            rate,
            timestamp: new Date(),
            provider: 'xe_currency_api'
        };
    }
    
    async getExchangeRate(fromCurrency, toCurrency) {
        // Mock exchange rates - in production, would fetch from currency API
        const mockRates = {
            'USD_EUR': 0.85,
            'USD_GBP': 0.73,
            'USD_CAD': 1.35,
            'USD_AUD': 1.45,
            'USD_SGD': 1.35,
            'USD_JPY': 110.0,
            'EUR_GBP': 0.86,
            'EUR_USD': 1.18,
            'GBP_USD': 1.37,
            'GBP_EUR': 1.16
        };
        
        const rateKey = `${fromCurrency}_${toCurrency}`;
        const reverseKey = `${toCurrency}_${fromCurrency}`;
        
        if (mockRates[rateKey]) {
            return mockRates[rateKey];
        } else if (mockRates[reverseKey]) {
            return 1 / mockRates[reverseKey];
        }
        
        // Fallback to USD conversion
        const usdFromRate = mockRates[`${fromCurrency}_USD`] || (1 / mockRates[`USD_${fromCurrency}`]);
        const usdToRate = mockRates[`USD_${toCurrency}`] || (1 / mockRates[`${toCurrency}_USD`]);
        
        return usdFromRate * usdToRate;
    }
    
    // Subscription billing with global support
    async createGlobalSubscription(subscriptionData) {
        const {
            customerId,
            planId,
            paymentMethod,
            billingAddress,
            trialDays = 0
        } = subscriptionData;
        
        const customer = await this.getCustomer(customerId);
        const region = this.getRegionFromLocation(customer.country);
        
        // Get regional payment methods and pricing
        const regionalInfo = this.regionalMethods.get(region);
        const provider = await this.selectOptimalProvider(
            paymentMethod,
            region,
            regionalInfo.currency
        );
        
        // Create subscription with localized pricing
        const subscription = {
            id: this.generateSubscriptionId(),
            customerId,
            planId,
            provider: provider.id,
            currency: regionalInfo.currency,
            region,
            paymentMethod,
            billingAddress,
            status: trialDays > 0 ? 'trialing' : 'active',
            trialEnd: trialDays > 0 ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null,
            currentPeriodStart: new Date(),
            currentPeriodEnd: this.calculateNextBillingDate(new Date()),
            createdAt: new Date(),
            metadata: {
                region,
                localPaymentMethods: regionalInfo.localMethods.map(m => m.id)
            }
        };
        
        // Set up automatic tax calculation
        subscription.taxSettings = {
            enabled: regionalInfo.taxInfo.vatRequired || regionalInfo.taxInfo.gstRequired,
            type: this.getTaxType(region),
            automaticCollection: true
        };
        
        this.emit('subscription_created', {
            subscriptionId: subscription.id,
            customerId,
            region,
            currency: subscription.currency
        });
        
        return subscription;
    }
    
    // Fraud detection and prevention
    async detectFraud(paymentData) {
        const riskScore = await this.calculateRiskScore(paymentData);
        
        const analysis = {
            paymentId: paymentData.id || 'unknown',
            riskScore,
            riskLevel: this.categorizeRisk(riskScore),
            flags: [],
            recommendations: [],
            decision: 'allow' // 'allow', 'review', 'decline'
        };
        
        // Check for suspicious patterns
        if (paymentData.amount > 500000) { // $5,000
            analysis.flags.push('high_amount');
            analysis.riskScore += 20;
        }
        
        if (this.isHighRiskCountry(paymentData.customer?.country)) {
            analysis.flags.push('high_risk_country');
            analysis.riskScore += 15;
        }
        
        if (paymentData.customer?.email?.includes('temp')) {
            analysis.flags.push('suspicious_email');
            analysis.riskScore += 10;
        }
        
        // Check velocity limits
        const recentPayments = await this.getRecentPayments(paymentData.customer?.id);
        if (recentPayments.length > 5) {
            analysis.flags.push('high_velocity');
            analysis.riskScore += 25;
        }
        
        // Determine final decision
        if (analysis.riskScore > 80) {
            analysis.decision = 'decline';
            analysis.recommendations.push('Transaction declined due to high risk score');
        } else if (analysis.riskScore > 50) {
            analysis.decision = 'review';
            analysis.recommendations.push('Manual review required');
        }
        
        return analysis;
    }
    
    // Utility methods
    getRegionFromLocation(country) {
        const regionMapping = {
            'US': 'US',
            'CA': 'CA',
            'GB': 'UK', 'UK': 'UK',
            'AU': 'AU',
            'SG': 'SG',
            'JP': 'JP',
            'IN': 'IN'
        };
        
        // EU countries
        const euCountries = [
            'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
            'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
            'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
        ];
        
        if (euCountries.includes(country)) {
            return 'EU';
        }
        
        return regionMapping[country] || 'US'; // Default fallback
    }
    
    calculateCardFees(amount, region) {
        const baseFee = Math.round(amount * 0.029); // 2.9%
        const fixedFee = region === 'US' ? 30 : 25; // $0.30 or €0.25
        
        return {
            percentage: 2.9,
            fixed: fixedFee,
            total: baseFee + fixedFee
        };
    }
    
    calculateMethodFees(amount, feeStructure) {
        const percentageFee = Math.round(amount * (feeStructure.percentage / 100));
        const totalFee = percentageFee + feeStructure.fixed;
        
        return {
            percentage: feeStructure.percentage,
            fixed: feeStructure.fixed,
            total: totalFee
        };
    }
    
    scorePaymentMethod(method, amount, userLocation) {
        let score = 0;
        
        // Popularity bonus
        if (method.popular) score += 30;
        
        // Low fee bonus
        const feePercentage = method.fees.total / amount * 100;
        if (feePercentage < 1) score += 20;
        else if (feePercentage < 2) score += 10;
        
        // Speed bonus
        if (method.processingTime === 'instant') score += 15;
        
        // Regional preference
        if (method.countries && method.countries.includes(userLocation)) {
            score += 25;
        }
        
        return score;
    }
    
    isMethodSupported(method, userLocation) {
        if (!method.countries) return true;
        return method.countries.includes(userLocation);
    }
    
    calculateUSSalesTax(amount, address) {
        const taxRates = this.taxRates.get('US').rates;
        const stateRate = taxRates[address.state] || 0;
        return Math.round(amount * (stateRate / 100));
    }
    
    getProvincialTaxRate(province) {
        const rates = {
            'ON': 8.0, 'QC': 9.975, 'BC': 7.0, 'AB': 0.0,
            'MB': 7.0, 'SK': 6.0, 'NS': 10.0, 'NB': 10.0,
            'NL': 10.0, 'PE': 10.0, 'YT': 0.0, 'NT': 0.0, 'NU': 0.0
        };
        return rates[province] || 0;
    }
    
    getTaxType(region) {
        const typeMapping = {
            'US': 'sales_tax',
            'EU': 'vat',
            'UK': 'vat',
            'CA': 'gst_hst',
            'AU': 'gst',
            'SG': 'gst',
            'JP': 'consumption_tax'
        };
        return typeMapping[region] || 'none';
    }
    
    calculateRiskScore(paymentData) {
        let score = 0;
        
        // Base score
        score += Math.random() * 30; // Simulate ML model output
        
        return Math.min(100, Math.max(0, score));
    }
    
    categorizeRisk(score) {
        if (score > 80) return 'high';
        if (score > 50) return medium';
        if (score > 20) return 'low';
        return 'minimal';
    }
    
    isHighRiskCountry(country) {
        const highRiskCountries = ['XX', 'YY']; // Placeholder
        return highRiskCountries.includes(country);
    }
    
    async selectOptimalProvider(paymentMethod, region, currency) {
        const providers = Array.from(this.paymentProviders.values())
            .filter(p => 
                p.regions.includes(region) &&
                p.currencies.includes(currency) &&
                p.paymentMethods.includes(paymentMethod)
            );
        
        if (providers.length === 0) {
            throw new Error(`No provider supports ${paymentMethod} in ${region} with ${currency}`);
        }
        
        // Score providers and return the best one
        return providers.sort((a, b) => {
            const scoreA = this.scoreProvider(a, paymentMethod);
            const scoreB = this.scoreProvider(b, paymentMethod);
            return scoreB - scoreA;
        })[0];
    }
    
    scoreProvider(provider, paymentMethod) {
        let score = 0;
        
        // Lower fees = higher score
        const fees = provider.fees[paymentMethod] || 3.0;
        score += (5.0 - fees) * 20;
        
        // More features = higher score
        score += Object.keys(provider.features).length * 5;
        
        return score;
    }
    
    generatePaymentId() {
        return `pay_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
    
    generateSubscriptionId() {
        return `sub_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }
    
    calculateNextBillingDate(startDate) {
        const nextDate = new Date(startDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
        return nextDate;
    }
    
    // Mock methods for external dependencies
    async validateCompliance(paymentData, provider) {
        // PCI DSS validation would occur here
        return true;
    }
    
    async processWithProvider(provider, paymentIntent) {
        // Actual provider API calls would occur here
        return {
            status: 'succeeded',
            providerId: `${provider.id}_${crypto.randomBytes(8).toString('hex')}`,
            processingTime: '1.2s'
        };
    }
    
    async recordPaymentForCompliance(paymentIntent) {
        // Compliance logging would occur here
        console.log('Payment recorded for compliance:', paymentIntent.id);
    }
    
    async getCustomer(customerId) {
        return {
            id: customerId,
            country: 'US',
            email: 'customer@example.com'
        };
    }
    
    async getRecentPayments(customerId) {
        return []; // Mock implementation
    }
}

module.exports = {
    GlobalPaymentManager
};