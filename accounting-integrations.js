/**
 * ROOTUIP Accounting System Integrations
 * QuickBooks, NetSuite, and other accounting platform connectors
 */

const EventEmitter = require('events');
const https = require('https');
const crypto = require('crypto');

// QuickBooks Integration
class QuickBooksIntegration extends EventEmitter {
    constructor(config) {
        super();
        this.config = {
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            accessToken: config.accessToken,
            refreshToken: config.refreshToken,
            companyId: config.companyId,
            environment: config.environment || 'sandbox', // 'sandbox' or 'production'
            ...config
        };
        
        this.baseUrl = this.config.environment === 'production' 
            ? 'https://quickbooks-api.intuit.com'
            : 'https://sandbox-quickbooks.api.intuit.com';
            
        this.syncQueue = [];
        this.accountMappings = new Map();
        this.setupAccountMappings();
    }
    
    setupAccountMappings() {
        // Map ROOTUIP accounts to QuickBooks accounts
        this.accountMappings.set('subscription_revenue', {
            qbAccountId: '1001',
            accountType: 'Income',
            name: 'Subscription Revenue'
        });
        
        this.accountMappings.set('setup_revenue', {
            qbAccountId: '1002', 
            accountType: 'Income',
            name: 'Setup Fee Revenue'
        });
        
        this.accountMappings.set('usage_revenue', {
            qbAccountId: '1003',
            accountType: 'Income', 
            name: 'Usage Revenue'
        });
        
        this.accountMappings.set('deferred_revenue', {
            qbAccountId: '2001',
            accountType: 'Other Current Liability',
            name: 'Deferred Revenue'
        });
        
        this.accountMappings.set('accounts_receivable', {
            qbAccountId: '1200',
            accountType: 'Accounts Receivable',
            name: 'Accounts Receivable'
        });
        
        this.accountMappings.set('sales_tax_payable', {
            qbAccountId: '2100',
            accountType: 'Other Current Liability',
            name: 'Sales Tax Payable'
        });
    }
    
    // Sync customer to QuickBooks
    async syncCustomer(customerData) {
        try {
            const existingCustomer = await this.findCustomerByEmail(customerData.email);
            
            if (existingCustomer) {
                return await this.updateCustomer(existingCustomer.Id, customerData);
            } else {
                return await this.createCustomer(customerData);
            }
        } catch (error) {
            this.emit('sync_error', {
                type: 'customer',
                customerId: customerData.id,
                error: error.message
            });
            throw error;
        }
    }
    
    async createCustomer(customerData) {
        const customer = {
            Name: customerData.companyName || customerData.name,
            CompanyName: customerData.companyName,
            PrimaryEmailAddr: {
                Address: customerData.email
            },
            PrimaryPhone: customerData.phone ? {
                FreeFormNumber: customerData.phone
            } : undefined,
            BillAddr: customerData.address ? {
                Line1: customerData.address.line1,
                Line2: customerData.address.line2,
                City: customerData.address.city,
                CountrySubDivisionCode: customerData.address.state,
                PostalCode: customerData.address.postal_code,
                Country: customerData.address.country
            } : undefined,
            Notes: `ROOTUIP Customer ID: ${customerData.id}`,
            PreferredDeliveryMethod: 'Email',
            Taxable: !customerData.taxExempt
        };
        
        const response = await this.makeQuickBooksRequest('POST', 'customer', customer);
        
        this.emit('customer_synced', {
            rootuipCustomerId: customerData.id,
            quickbooksCustomerId: response.Customer.Id,
            action: 'created'
        });
        
        return response.Customer;
    }
    
    async updateCustomer(quickbooksId, customerData) {
        const existingCustomer = await this.getCustomer(quickbooksId);
        
        const updatedCustomer = {
            ...existingCustomer,
            Name: customerData.companyName || customerData.name,
            CompanyName: customerData.companyName,
            PrimaryEmailAddr: {
                Address: customerData.email
            },
            sparse: true
        };
        
        const response = await this.makeQuickBooksRequest('POST', 'customer', updatedCustomer);
        
        this.emit('customer_synced', {
            rootuipCustomerId: customerData.id,
            quickbooksCustomerId: response.Customer.Id,
            action: 'updated'
        });
        
        return response.Customer;
    }
    
    // Sync invoice to QuickBooks
    async syncInvoice(invoiceData) {
        try {
            const customer = await this.findCustomerByEmail(invoiceData.customerData.email);
            if (!customer) {
                throw new Error('Customer not found in QuickBooks');
            }
            
            const invoice = {
                CustomerRef: {
                    value: customer.Id
                },
                DocNumber: invoiceData.number,
                TxnDate: invoiceData.issueDate.toISOString().split('T')[0],
                DueDate: invoiceData.dueDate.toISOString().split('T')[0],
                Line: this.buildInvoiceLines(invoiceData.lineItems),
                CurrencyRef: {
                    value: invoiceData.currency || 'USD'
                },
                PrivateNote: invoiceData.notes,
                CustomerMemo: {
                    value: invoiceData.purchaseOrder ? `PO: ${invoiceData.purchaseOrder}` : ''
                }
            };
            
            // Add tax lines if applicable
            if (invoiceData.taxes && invoiceData.taxes.length > 0) {
                invoice.TxnTaxDetail = this.buildTaxDetail(invoiceData.taxes);
            }
            
            const response = await this.makeQuickBooksRequest('POST', 'invoice', invoice);
            
            this.emit('invoice_synced', {
                rootuipInvoiceId: invoiceData.id,
                quickbooksInvoiceId: response.Invoice.Id,
                action: 'created'
            });
            
            return response.Invoice;
        } catch (error) {
            this.emit('sync_error', {
                type: 'invoice',
                invoiceId: invoiceData.id,
                error: error.message
            });
            throw error;
        }
    }
    
    buildInvoiceLines(lineItems) {
        return lineItems.map((item, index) => {
            const accountMapping = this.getAccountMappingForItem(item);
            
            return {
                Id: (index + 1).toString(),
                LineNum: index + 1,
                DetailType: 'SalesItemLineDetail',
                Amount: item.lineTotal / 100, // Convert from cents
                SalesItemLineDetail: {
                    ItemRef: {
                        value: accountMapping.qbAccountId
                    },
                    Qty: item.quantity,
                    UnitPrice: item.unitPrice / 100,
                    TaxCodeRef: item.taxable ? { value: 'TAX' } : { value: 'NON' }
                },
                Description: item.description
            };
        });
    }
    
    getAccountMappingForItem(item) {
        // Map line items to appropriate revenue accounts
        if (item.category === 'setup') {
            return this.accountMappings.get('setup_revenue');
        } else if (item.category === 'usage') {
            return this.accountMappings.get('usage_revenue');
        } else {
            return this.accountMappings.get('subscription_revenue');
        }
    }
    
    buildTaxDetail(taxes) {
        return {
            TotalTax: taxes.reduce((sum, tax) => sum + tax.amount, 0) / 100,
            TaxLine: taxes.map(tax => ({
                Amount: tax.amount / 100,
                DetailType: 'TaxLineDetail',
                TaxLineDetail: {
                    TaxRateRef: {
                        value: tax.taxRateId || 'DEFAULT_TAX_RATE'
                    }
                }
            }))
        };
    }
    
    // Sync payment to QuickBooks
    async syncPayment(paymentData) {
        try {
            const invoice = await this.findInvoiceByNumber(paymentData.invoiceNumber);
            if (!invoice) {
                throw new Error('Invoice not found in QuickBooks');
            }
            
            const payment = {
                CustomerRef: {
                    value: invoice.CustomerRef.value
                },
                TotalAmt: paymentData.amount / 100,
                TxnDate: paymentData.paymentDate.toISOString().split('T')[0],
                PaymentMethodRef: {
                    value: this.getPaymentMethodId(paymentData.paymentMethod)
                },
                DepositToAccountRef: {
                    value: this.accountMappings.get('accounts_receivable').qbAccountId
                },
                Line: [{
                    Amount: paymentData.amount / 100,
                    LinkedTxn: [{
                        TxnId: invoice.Id,
                        TxnType: 'Invoice'
                    }]
                }],
                PrivateNote: `Payment for invoice ${paymentData.invoiceNumber}`
            };
            
            const response = await this.makeQuickBooksRequest('POST', 'payment', payment);
            
            this.emit('payment_synced', {
                rootuipPaymentId: paymentData.id,
                quickbooksPaymentId: response.Payment.Id,
                action: 'created'
            });
            
            return response.Payment;
        } catch (error) {
            this.emit('sync_error', {
                type: 'payment',
                paymentId: paymentData.id,
                error: error.message
            });
            throw error;
        }
    }
    
    // Sync journal entries for revenue recognition
    async syncJournalEntry(journalEntryData) {
        try {
            const journalEntry = {
                DocNumber: journalEntryData.reference || journalEntryData.id,
                TxnDate: journalEntryData.date.toISOString().split('T')[0],
                Line: journalEntryData.entries.map((entry, index) => ({
                    Id: (index + 1).toString(),
                    DetailType: 'JournalEntryLineDetail',
                    Amount: Math.abs(entry.debit || entry.credit) / 100,
                    JournalEntryLineDetail: {
                        PostingType: entry.debit > 0 ? 'Debit' : 'Credit',
                        AccountRef: {
                            value: this.accountMappings.get(entry.account)?.qbAccountId
                        },
                        DepartmentRef: entry.department ? {
                            value: entry.department
                        } : undefined
                    },
                    Description: entry.description || journalEntryData.description
                })),
                PrivateNote: journalEntryData.description
            };
            
            const response = await this.makeQuickBooksRequest('POST', 'journalentry', journalEntry);
            
            this.emit('journal_entry_synced', {
                rootuipJournalEntryId: journalEntryData.id,
                quickbooksJournalEntryId: response.JournalEntry.Id,
                action: 'created'
            });
            
            return response.JournalEntry;
        } catch (error) {
            this.emit('sync_error', {
                type: 'journal_entry',
                journalEntryId: journalEntryData.id,
                error: error.message
            });
            throw error;
        }
    }
    
    // Helper methods
    async findCustomerByEmail(email) {
        const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email}'`;
        const response = await this.makeQuickBooksRequest('GET', `query?query=${encodeURIComponent(query)}`);
        
        return response.QueryResponse?.Customer?.[0];
    }
    
    async findInvoiceByNumber(invoiceNumber) {
        const query = `SELECT * FROM Invoice WHERE DocNumber = '${invoiceNumber}'`;
        const response = await this.makeQuickBooksRequest('GET', `query?query=${encodeURIComponent(query)}`);
        
        return response.QueryResponse?.Invoice?.[0];
    }
    
    async getCustomer(customerId) {
        const response = await this.makeQuickBooksRequest('GET', `customer/${customerId}`);
        return response.Customer;
    }
    
    getPaymentMethodId(paymentMethod) {
        const paymentMethods = {
            'credit_card': '1',
            'bank_transfer': '2', 
            'check': '3',
            'cash': '4'
        };
        
        return paymentMethods[paymentMethod] || '1';
    }
    
    // Make API request to QuickBooks
    async makeQuickBooksRequest(method, endpoint, data = null) {
        const url = `${this.baseUrl}/v3/company/${this.config.companyId}/${endpoint}`;
        
        const options = {
            method: method,
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        try {
            const response = await this.makeHTTPRequest(url, options);
            return JSON.parse(response);
        } catch (error) {
            if (error.statusCode === 401) {
                // Token expired, try to refresh
                await this.refreshAccessToken();
                options.headers['Authorization'] = `Bearer ${this.config.accessToken}`;
                const response = await this.makeHTTPRequest(url, options);
                return JSON.parse(response);
            }
            throw error;
        }
    }
    
    async refreshAccessToken() {
        const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
        
        const params = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: this.config.refreshToken
        });
        
        const options = {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        };
        
        const response = await this.makeHTTPRequest(tokenUrl, options);
        const tokenData = JSON.parse(response);
        
        this.config.accessToken = tokenData.access_token;
        this.config.refreshToken = tokenData.refresh_token;
        
        this.emit('token_refreshed', {
            accessToken: this.config.accessToken,
            refreshToken: this.config.refreshToken
        });
    }
    
    makeHTTPRequest(url, options) {
        return new Promise((resolve, reject) => {
            const req = https.request(url, options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject({
                            statusCode: res.statusCode,
                            message: data
                        });
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            if (options.body) {
                req.write(options.body);
            }
            
            req.end();
        });
    }
}

// NetSuite Integration
class NetSuiteIntegration extends EventEmitter {
    constructor(config) {
        super();
        this.config = {
            accountId: config.accountId,
            consumerKey: config.consumerKey,
            consumerSecret: config.consumerSecret,
            tokenId: config.tokenId,
            tokenSecret: config.tokenSecret,
            environment: config.environment || 'sandbox',
            ...config
        };
        
        this.baseUrl = `https://${this.config.accountId}.suitetalk.api.netsuite.com/services/rest/record/v1`;
        this.subsidiaryMappings = new Map();
        this.setupSubsidiaryMappings();
    }
    
    setupSubsidiaryMappings() {
        // Map currencies/regions to NetSuite subsidiaries
        this.subsidiaryMappings.set('USD', { id: '1', name: 'ROOTUIP USA' });
        this.subsidiaryMappings.set('EUR', { id: '2', name: 'ROOTUIP Europe' });
        this.subsidiaryMappings.set('GBP', { id: '3', name: 'ROOTUIP UK' });
    }
    
    // Sync customer to NetSuite
    async syncCustomer(customerData) {
        try {
            const customer = {
                entityid: customerData.id,
                companyname: customerData.companyName,
                email: customerData.email,
                phone: customerData.phone,
                subsidiary: this.getSubsidiaryId(customerData.currency),
                currency: customerData.currency || 'USD',
                category: '1', // Customer category
                addressbook: customerData.address ? [{
                    defaultbilling: true,
                    defaultshipping: true,
                    addr1: customerData.address.line1,
                    addr2: customerData.address.line2,
                    city: customerData.address.city,
                    state: customerData.address.state,
                    zip: customerData.address.postal_code,
                    country: customerData.address.country
                }] : undefined
            };
            
            const response = await this.makeNetSuiteRequest('POST', 'customer', customer);
            
            this.emit('customer_synced', {
                rootuipCustomerId: customerData.id,
                netsuiteCustomerId: response.id,
                action: 'created'
            });
            
            return response;
        } catch (error) {
            this.emit('sync_error', {
                type: 'customer',
                customerId: customerData.id,
                error: error.message
            });
            throw error;
        }
    }
    
    // Sync invoice to NetSuite
    async syncInvoice(invoiceData) {
        try {
            const customer = await this.findCustomerByEmail(invoiceData.customerData.email);
            if (!customer) {
                throw new Error('Customer not found in NetSuite');
            }
            
            const invoice = {
                entity: customer.id,
                trandate: invoiceData.issueDate.toISOString().split('T')[0],
                duedate: invoiceData.dueDate.toISOString().split('T')[0],
                tranid: invoiceData.number,
                subsidiary: this.getSubsidiaryId(invoiceData.currency),
                currency: invoiceData.currency || 'USD',
                memo: invoiceData.notes,
                custbody_po_number: invoiceData.purchaseOrder,
                item: this.buildInvoiceItems(invoiceData.lineItems)
            };
            
            const response = await this.makeNetSuiteRequest('POST', 'invoice', invoice);
            
            this.emit('invoice_synced', {
                rootuipInvoiceId: invoiceData.id,
                netsuiteInvoiceId: response.id,
                action: 'created'
            });
            
            return response;
        } catch (error) {
            this.emit('sync_error', {
                type: 'invoice',
                invoiceId: invoiceData.id,
                error: error.message
            });
            throw error;
        }
    }
    
    buildInvoiceItems(lineItems) {
        return lineItems.map(item => ({
            item: this.getItemId(item.category),
            quantity: item.quantity,
            rate: item.unitPrice / 100,
            amount: item.lineTotal / 100,
            description: item.description,
            taxcode: item.taxable ? 'TAX' : 'NOTAX'
        }));
    }
    
    getItemId(category) {
        const itemMappings = {
            'subscription': '1',
            'setup': '2',
            'usage': '3',
            'support': '4'
        };
        
        return itemMappings[category] || '1';
    }
    
    getSubsidiaryId(currency) {
        const subsidiary = this.subsidiaryMappings.get(currency);
        return subsidiary ? subsidiary.id : '1';
    }
    
    // Sync payment to NetSuite
    async syncPayment(paymentData) {
        try {
            const invoice = await this.findInvoiceByNumber(paymentData.invoiceNumber);
            if (!invoice) {
                throw new Error('Invoice not found in NetSuite');
            }
            
            const payment = {
                customer: invoice.entity,
                trandate: paymentData.paymentDate.toISOString().split('T')[0],
                payment: paymentData.amount / 100,
                account: this.getPaymentAccount(paymentData.paymentMethod),
                apply: [{
                    doc: invoice.id,
                    amount: paymentData.amount / 100
                }],
                memo: `Payment for invoice ${paymentData.invoiceNumber}`
            };
            
            const response = await this.makeNetSuiteRequest('POST', 'customerpayment', payment);
            
            this.emit('payment_synced', {
                rootuipPaymentId: paymentData.id,
                netsuitePaymentId: response.id,
                action: 'created'
            });
            
            return response;
        } catch (error) {
            this.emit('sync_error', {
                type: 'payment',
                paymentId: paymentData.id,
                error: error.message
            });
            throw error;
        }
    }
    
    getPaymentAccount(paymentMethod) {
        const accountMappings = {
            'credit_card': '101', // Credit Card Clearing
            'bank_transfer': '102', // Bank Account
            'check': '103', // Undeposited Funds
            'cash': '104' // Cash Account
        };
        
        return accountMappings[paymentMethod] || '101';
    }
    
    // Helper methods
    async findCustomerByEmail(email) {
        const query = `SELECT id, companyname FROM customer WHERE email = '${email}'`;
        const response = await this.makeNetSuiteRequest('GET', `customer?q=${encodeURIComponent(query)}`);
        
        return response.items?.[0];
    }
    
    async findInvoiceByNumber(invoiceNumber) {
        const query = `SELECT id, entity FROM invoice WHERE tranid = '${invoiceNumber}'`;
        const response = await this.makeNetSuiteRequest('GET', `invoice?q=${encodeURIComponent(query)}`);
        
        return response.items?.[0];
    }
    
    // Make API request to NetSuite
    async makeNetSuiteRequest(method, endpoint, data = null) {
        const url = `${this.baseUrl}/${endpoint}`;
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = crypto.randomBytes(16).toString('hex');
        
        const options = {
            method: method,
            headers: {
                'Authorization': this.generateOAuthSignature(method, url, timestamp, nonce),
                'Content-Type': 'application/json'
            }
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }
        
        const response = await this.makeHTTPRequest(url, options);
        return JSON.parse(response);
    }
    
    generateOAuthSignature(method, url, timestamp, nonce) {
        const oauthParams = {
            oauth_consumer_key: this.config.consumerKey,
            oauth_nonce: nonce,
            oauth_signature_method: 'HMAC-SHA256',
            oauth_timestamp: timestamp,
            oauth_token: this.config.tokenId,
            oauth_version: '1.0'
        };
        
        // Build signature base string
        const paramString = Object.keys(oauthParams)
            .sort()
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
            .join('&');
            
        const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
        
        // Generate signature
        const signingKey = `${encodeURIComponent(this.config.consumerSecret)}&${encodeURIComponent(this.config.tokenSecret)}`;
        const signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64');
        
        oauthParams.oauth_signature = signature;
        
        // Build authorization header
        const authHeader = 'OAuth ' + Object.keys(oauthParams)
            .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
            .join(', ');
            
        return authHeader;
    }
    
    makeHTTPRequest(url, options) {
        return new Promise((resolve, reject) => {
            const req = https.request(url, options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject({
                            statusCode: res.statusCode,
                            message: data
                        });
                    }
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            if (options.body) {
                req.write(options.body);
            }
            
            req.end();
        });
    }
}

// Unified Accounting Integration Manager
class AccountingIntegrationManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.integrations = new Map();
        this.syncQueue = [];
        this.isProcessing = false;
        
        // Initialize integrations based on config
        if (config.quickbooks) {
            this.integrations.set('quickbooks', new QuickBooksIntegration(config.quickbooks));
        }
        
        if (config.netsuite) {
            this.integrations.set('netsuite', new NetSuiteIntegration(config.netsuite));
        }
        
        this.setupEventHandlers();
        this.startQueueProcessor();
    }
    
    setupEventHandlers() {
        // Forward events from individual integrations
        for (const [name, integration] of this.integrations) {
            integration.on('customer_synced', (data) => {
                this.emit('customer_synced', { integration: name, ...data });
            });
            
            integration.on('invoice_synced', (data) => {
                this.emit('invoice_synced', { integration: name, ...data });
            });
            
            integration.on('payment_synced', (data) => {
                this.emit('payment_synced', { integration: name, ...data });
            });
            
            integration.on('sync_error', (data) => {
                this.emit('sync_error', { integration: name, ...data });
            });
        }
    }
    
    // Queue sync operation
    queueSync(operation, data, integrations = null) {
        const syncItem = {
            id: this.generateSyncId(),
            operation,
            data,
            integrations: integrations || Array.from(this.integrations.keys()),
            attempts: 0,
            maxAttempts: 3,
            queuedAt: new Date(),
            status: 'queued'
        };
        
        this.syncQueue.push(syncItem);
        
        if (!this.isProcessing) {
            this.processQueue();
        }
        
        return syncItem.id;
    }
    
    // Process sync queue
    async processQueue() {
        if (this.isProcessing || this.syncQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        while (this.syncQueue.length > 0) {
            const syncItem = this.syncQueue.shift();
            
            try {
                await this.processSyncItem(syncItem);
                syncItem.status = 'completed';
                syncItem.completedAt = new Date();
            } catch (error) {
                syncItem.attempts++;
                syncItem.lastError = error.message;
                
                if (syncItem.attempts < syncItem.maxAttempts) {
                    syncItem.status = 'retrying';
                    // Re-queue with delay
                    setTimeout(() => {
                        this.syncQueue.push(syncItem);
                    }, 5000 * syncItem.attempts); // Exponential backoff
                } else {
                    syncItem.status = 'failed';
                    syncItem.failedAt = new Date();
                    
                    this.emit('sync_failed', {
                        syncId: syncItem.id,
                        operation: syncItem.operation,
                        error: error.message,
                        attempts: syncItem.attempts
                    });
                }
            }
        }
        
        this.isProcessing = false;
    }
    
    async processSyncItem(syncItem) {
        const results = {};
        
        for (const integrationName of syncItem.integrations) {
            const integration = this.integrations.get(integrationName);
            
            if (!integration) {
                throw new Error(`Integration ${integrationName} not found`);
            }
            
            try {
                let result;
                
                switch (syncItem.operation) {
                    case 'sync_customer':
                        result = await integration.syncCustomer(syncItem.data);
                        break;
                    case 'sync_invoice':
                        result = await integration.syncInvoice(syncItem.data);
                        break;
                    case 'sync_payment':
                        result = await integration.syncPayment(syncItem.data);
                        break;
                    case 'sync_journal_entry':
                        if (integration.syncJournalEntry) {
                            result = await integration.syncJournalEntry(syncItem.data);
                        }
                        break;
                    default:
                        throw new Error(`Unknown operation: ${syncItem.operation}`);
                }
                
                results[integrationName] = result;
            } catch (error) {
                results[integrationName] = { error: error.message };
            }
        }
        
        this.emit('sync_completed', {
            syncId: syncItem.id,
            operation: syncItem.operation,
            results
        });
        
        return results;
    }
    
    startQueueProcessor() {
        // Process queue every 30 seconds
        setInterval(() => {
            if (!this.isProcessing && this.syncQueue.length > 0) {
                this.processQueue();
            }
        }, 30000);
    }
    
    generateSyncId() {
        return `sync_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    // Get sync status
    getSyncStatus() {
        return {
            queueLength: this.syncQueue.length,
            isProcessing: this.isProcessing,
            activeIntegrations: Array.from(this.integrations.keys()),
            queuedItems: this.syncQueue.map(item => ({
                id: item.id,
                operation: item.operation,
                status: item.status,
                attempts: item.attempts,
                queuedAt: item.queuedAt
            }))
        };
    }
}

module.exports = {
    QuickBooksIntegration,
    NetSuiteIntegration,
    AccountingIntegrationManager
};