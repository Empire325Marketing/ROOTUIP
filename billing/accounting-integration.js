#!/usr/bin/env node

/**
 * ROOTUIP Accounting Integration System
 * QuickBooks and NetSuite integration for seamless accounting
 */

const { EventEmitter } = require('events');
const axios = require('axios');
const OAuth = require('oauth-1.0a');
const crypto = require('crypto');
const { Pool } = require('pg');
const moment = require('moment');
const BigNumber = require('bignumber.js');

class AccountingIntegrationSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            databaseUrl: config.databaseUrl || process.env.DATABASE_URL,
            quickbooksConfig: {
                clientId: config.qbClientId || process.env.QB_CLIENT_ID,
                clientSecret: config.qbClientSecret || process.env.QB_CLIENT_SECRET,
                redirectUri: config.qbRedirectUri || process.env.QB_REDIRECT_URI,
                environment: config.qbEnvironment || 'production',
                minorVersion: config.qbMinorVersion || '65'
            },
            netsuiteConfig: {
                accountId: config.nsAccountId || process.env.NS_ACCOUNT_ID,
                consumerKey: config.nsConsumerKey || process.env.NS_CONSUMER_KEY,
                consumerSecret: config.nsConsumerSecret || process.env.NS_CONSUMER_SECRET,
                tokenId: config.nsTokenId || process.env.NS_TOKEN_ID,
                tokenSecret: config.nsTokenSecret || process.env.NS_TOKEN_SECRET,
                restletUrl: config.nsRestletUrl || process.env.NS_RESTLET_URL
            },
            syncInterval: config.syncInterval || 300000, // 5 minutes
            ...config
        };
        
        // Database connection
        this.db = new Pool({
            connectionString: this.config.databaseUrl,
            max: 10
        });
        
        // Integration managers
        this.quickbooksIntegration = new QuickBooksIntegration(this);
        this.netsuiteIntegration = new NetSuiteIntegration(this);
        this.syncManager = new SyncManager(this);
        this.mappingManager = new MappingManager(this);
        this.reconciliationEngine = new ReconciliationEngine(this);
        
        // Initialize system
        this.initialize();
    }
    
    // Initialize system
    async initialize() {
        console.log('Initializing Accounting Integration System');
        
        try {
            // Create database schema
            await this.createDatabaseSchema();
            
            // Initialize integrations
            await this.initializeIntegrations();
            
            // Start sync processes
            this.startSyncProcesses();
            
            console.log('Accounting Integration System initialized');
            
        } catch (error) {
            console.error('Failed to initialize accounting integration:', error);
            throw error;
        }
    }
    
    // Create database schema
    async createDatabaseSchema() {
        await this.db.query(`
            CREATE TABLE IF NOT EXISTS accounting_connections (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                provider VARCHAR(50) NOT NULL, -- 'quickbooks', 'netsuite'
                company_id VARCHAR(255) NOT NULL,
                access_token TEXT,
                refresh_token TEXT,
                token_expires_at TIMESTAMP,
                realm_id VARCHAR(255),
                status VARCHAR(50) DEFAULT 'active',
                last_sync_at TIMESTAMP,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS accounting_sync_queue (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                entity_type VARCHAR(50) NOT NULL, -- 'customer', 'invoice', 'payment', 'credit_memo'
                entity_id UUID NOT NULL,
                operation VARCHAR(20) NOT NULL, -- 'create', 'update', 'delete'
                provider VARCHAR(50) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                attempts INTEGER DEFAULT 0,
                last_attempt_at TIMESTAMP,
                error_message TEXT,
                external_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS accounting_mappings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                provider VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                internal_id UUID NOT NULL,
                external_id VARCHAR(255) NOT NULL,
                external_sync_token VARCHAR(255),
                last_synced_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(provider, entity_type, internal_id)
            );
            
            CREATE TABLE IF NOT EXISTS accounting_field_mappings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                provider VARCHAR(50) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                internal_field VARCHAR(100) NOT NULL,
                external_field VARCHAR(100) NOT NULL,
                transform_function VARCHAR(100),
                is_required BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS accounting_sync_log (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                sync_id UUID NOT NULL,
                provider VARCHAR(50) NOT NULL,
                sync_type VARCHAR(50) NOT NULL, -- 'full', 'incremental'
                start_time TIMESTAMP NOT NULL,
                end_time TIMESTAMP,
                status VARCHAR(50) NOT NULL,
                records_synced INTEGER DEFAULT 0,
                errors_count INTEGER DEFAULT 0,
                details JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS accounting_reconciliation (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                provider VARCHAR(50) NOT NULL,
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                internal_total DECIMAL(20,2) NOT NULL,
                external_total DECIMAL(20,2) NOT NULL,
                difference DECIMAL(20,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                reconciled_by VARCHAR(255),
                reconciled_at TIMESTAMP,
                discrepancies JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS chart_of_accounts_mapping (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                provider VARCHAR(50) NOT NULL,
                account_type VARCHAR(100) NOT NULL,
                internal_account_code VARCHAR(100) NOT NULL,
                external_account_id VARCHAR(255) NOT NULL,
                external_account_name VARCHAR(255),
                external_account_number VARCHAR(100),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Indexes
            CREATE INDEX idx_accounting_connections_provider ON accounting_connections(provider, status);
            CREATE INDEX idx_accounting_sync_queue_status ON accounting_sync_queue(status, provider);
            CREATE INDEX idx_accounting_mappings_lookup ON accounting_mappings(provider, entity_type, internal_id);
            CREATE INDEX idx_accounting_mappings_external ON accounting_mappings(provider, external_id);
            CREATE INDEX idx_accounting_sync_log_sync ON accounting_sync_log(sync_id);
            CREATE INDEX idx_chart_of_accounts_mapping ON chart_of_accounts_mapping(provider, account_type);
        `);
    }
    
    // Initialize integrations
    async initializeIntegrations() {
        // Check for existing connections
        const connections = await this.db.query(`
            SELECT * FROM accounting_connections
            WHERE status = 'active'
        `);
        
        for (const connection of connections.rows) {
            if (connection.provider === 'quickbooks') {
                await this.quickbooksIntegration.initialize(connection);
            } else if (connection.provider === 'netsuite') {
                await this.netsuiteIntegration.initialize(connection);
            }
        }
        
        // Load field mappings
        await this.mappingManager.loadFieldMappings();
    }
    
    // Start sync processes
    startSyncProcesses() {
        // Process sync queue
        setInterval(() => {
            this.syncManager.processSyncQueue();
        }, 30000); // Every 30 seconds
        
        // Full sync
        setInterval(() => {
            this.syncManager.performIncrementalSync();
        }, this.config.syncInterval);
        
        // Reconciliation
        setInterval(() => {
            this.reconciliationEngine.performDailyReconciliation();
        }, 24 * 60 * 60 * 1000); // Daily
    }
    
    // Queue entity for sync
    async queueEntitySync(entityType, entityId, operation, providers = ['all']) {
        const targetProviders = providers[0] === 'all' 
            ? ['quickbooks', 'netsuite'] 
            : providers;
        
        for (const provider of targetProviders) {
            // Check if provider is connected
            const isConnected = await this.isProviderConnected(provider);
            if (!isConnected) continue;
            
            await this.db.query(`
                INSERT INTO accounting_sync_queue (
                    entity_type, entity_id, operation, provider
                ) VALUES ($1, $2, $3, $4)
                ON CONFLICT (entity_type, entity_id, provider, operation)
                DO UPDATE SET 
                    status = 'pending',
                    attempts = 0,
                    updated_at = CURRENT_TIMESTAMP
            `, [entityType, entityId, operation, provider]);
        }
        
        this.emit('sync:queued', { entityType, entityId, operation, providers: targetProviders });
    }
    
    // Get sync status
    async getSyncStatus(entityType, entityId) {
        const status = await this.db.query(`
            SELECT 
                m.provider,
                m.external_id,
                m.last_synced_at,
                sq.status as sync_status,
                sq.error_message
            FROM accounting_mappings m
            LEFT JOIN accounting_sync_queue sq ON 
                sq.entity_type = m.entity_type 
                AND sq.entity_id = m.internal_id
                AND sq.provider = m.provider
            WHERE m.entity_type = $1 AND m.internal_id = $2
        `, [entityType, entityId]);
        
        return status.rows;
    }
    
    // Connect to QuickBooks
    async connectQuickBooks(authCode) {
        return await this.quickbooksIntegration.connect(authCode);
    }
    
    // Connect to NetSuite
    async connectNetSuite(credentials) {
        return await this.netsuiteIntegration.connect(credentials);
    }
    
    // Disconnect provider
    async disconnectProvider(provider) {
        await this.db.query(`
            UPDATE accounting_connections
            SET status = 'inactive',
                updated_at = CURRENT_TIMESTAMP
            WHERE provider = $1 AND status = 'active'
        `, [provider]);
        
        this.emit('provider:disconnected', { provider });
    }
    
    // Check if provider is connected
    async isProviderConnected(provider) {
        const result = await this.db.query(`
            SELECT COUNT(*) as count
            FROM accounting_connections
            WHERE provider = $1 AND status = 'active'
        `, [provider]);
        
        return parseInt(result.rows[0].count) > 0;
    }
    
    // Get reconciliation report
    async getReconciliationReport(provider, startDate, endDate) {
        return await this.reconciliationEngine.generateReport(provider, startDate, endDate);
    }
}

// QuickBooks Integration
class QuickBooksIntegration {
    constructor(parent) {
        this.parent = parent;
        this.baseUrl = parent.config.quickbooksConfig.environment === 'production'
            ? 'https://quickbooks.api.intuit.com'
            : 'https://sandbox-quickbooks.api.intuit.com';
    }
    
    async initialize(connection) {
        this.connection = connection;
        
        // Check token expiry
        if (moment(connection.token_expires_at).isBefore(moment())) {
            await this.refreshAccessToken();
        }
    }
    
    async connect(authCode) {
        try {
            // Exchange auth code for tokens
            const tokenResponse = await axios.post(
                'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
                new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: authCode,
                    redirect_uri: this.parent.config.quickbooksConfig.redirectUri
                }),
                {
                    auth: {
                        username: this.parent.config.quickbooksConfig.clientId,
                        password: this.parent.config.quickbooksConfig.clientSecret
                    },
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );
            
            const { access_token, refresh_token, expires_in, x_refresh_token_expires_in } = tokenResponse.data;
            
            // Get company info
            const companyInfo = await this.makeRequest('GET', '/v3/company/{realmId}/companyinfo/{realmId}', {
                realmId: tokenResponse.data.realmId
            });
            
            // Save connection
            const connection = await this.parent.db.query(`
                INSERT INTO accounting_connections (
                    provider, company_id, access_token, refresh_token,
                    token_expires_at, realm_id, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (provider, company_id)
                DO UPDATE SET 
                    access_token = $3,
                    refresh_token = $4,
                    token_expires_at = $5,
                    status = 'active',
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `, [
                'quickbooks',
                companyInfo.CompanyInfo.Id,
                access_token,
                refresh_token,
                moment().add(expires_in, 'seconds').toDate(),
                tokenResponse.data.realmId,
                JSON.stringify(companyInfo.CompanyInfo)
            ]);
            
            this.connection = connection.rows[0];
            
            // Setup chart of accounts mapping
            await this.syncChartOfAccounts();
            
            this.parent.emit('quickbooks:connected', { companyInfo: companyInfo.CompanyInfo });
            
            return connection.rows[0];
            
        } catch (error) {
            console.error('QuickBooks connection error:', error);
            throw error;
        }
    }
    
    async refreshAccessToken() {
        try {
            const tokenResponse = await axios.post(
                'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: this.connection.refresh_token
                }),
                {
                    auth: {
                        username: this.parent.config.quickbooksConfig.clientId,
                        password: this.parent.config.quickbooksConfig.clientSecret
                    },
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );
            
            const { access_token, refresh_token, expires_in } = tokenResponse.data;
            
            // Update tokens
            await this.parent.db.query(`
                UPDATE accounting_connections
                SET access_token = $1,
                    refresh_token = $2,
                    token_expires_at = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
            `, [
                access_token,
                refresh_token,
                moment().add(expires_in, 'seconds').toDate(),
                this.connection.id
            ]);
            
            this.connection.access_token = access_token;
            this.connection.refresh_token = refresh_token;
            
        } catch (error) {
            console.error('Token refresh error:', error);
            throw error;
        }
    }
    
    async makeRequest(method, endpoint, data = {}) {
        // Ensure valid token
        if (moment(this.connection.token_expires_at).isBefore(moment().add(5, 'minutes'))) {
            await this.refreshAccessToken();
        }
        
        const url = `${this.baseUrl}${endpoint.replace('{realmId}', this.connection.realm_id)}`;
        
        try {
            const response = await axios({
                method,
                url,
                data: method !== 'GET' ? data : undefined,
                params: method === 'GET' ? data : undefined,
                headers: {
                    'Authorization': `Bearer ${this.connection.access_token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            return response.data;
            
        } catch (error) {
            console.error('QuickBooks API error:', error.response?.data || error);
            throw error;
        }
    }
    
    async syncCustomer(customer) {
        try {
            // Check if customer exists
            const mapping = await this.parent.mappingManager.getMapping(
                'quickbooks',
                'customer',
                customer.id
            );
            
            const qbCustomer = {
                DisplayName: customer.company_name || `${customer.first_name} ${customer.last_name}`,
                CompanyName: customer.company_name,
                GivenName: customer.first_name,
                FamilyName: customer.last_name,
                PrimaryEmailAddr: {
                    Address: customer.email
                },
                PrimaryPhone: {
                    FreeFormNumber: customer.phone
                },
                BillAddr: {
                    Line1: customer.address_line1,
                    Line2: customer.address_line2,
                    City: customer.city,
                    CountrySubDivisionCode: customer.state,
                    PostalCode: customer.postal_code,
                    Country: customer.country
                }
            };
            
            let result;
            if (mapping) {
                // Update existing
                qbCustomer.Id = mapping.external_id;
                qbCustomer.SyncToken = mapping.external_sync_token;
                
                result = await this.makeRequest('POST', `/v3/company/${this.connection.realm_id}/customer`, qbCustomer);
            } else {
                // Create new
                result = await this.makeRequest('POST', `/v3/company/${this.connection.realm_id}/customer`, qbCustomer);
            }
            
            // Save mapping
            await this.parent.mappingManager.saveMapping(
                'quickbooks',
                'customer',
                customer.id,
                result.Customer.Id,
                result.Customer.SyncToken
            );
            
            return result.Customer;
            
        } catch (error) {
            console.error('Error syncing customer to QuickBooks:', error);
            throw error;
        }
    }
    
    async syncInvoice(invoice) {
        try {
            // Get customer mapping
            const customerMapping = await this.parent.mappingManager.getMapping(
                'quickbooks',
                'customer',
                invoice.customer_id
            );
            
            if (!customerMapping) {
                throw new Error('Customer not synced to QuickBooks');
            }
            
            // Get line items
            const lineItems = await this.parent.db.query(`
                SELECT * FROM invoice_line_items
                WHERE invoice_id = $1
                ORDER BY sort_order
            `, [invoice.id]);
            
            // Build QuickBooks invoice
            const qbInvoice = {
                DocNumber: invoice.invoice_number,
                TxnDate: moment(invoice.issue_date).format('YYYY-MM-DD'),
                DueDate: moment(invoice.due_date).format('YYYY-MM-DD'),
                CustomerRef: {
                    value: customerMapping.external_id
                },
                Line: await Promise.all(lineItems.rows.map(async (item, index) => ({
                    Amount: item.amount,
                    DetailType: 'SalesItemLineDetail',
                    SalesItemLineDetail: {
                        ItemRef: {
                            value: await this.getOrCreateItem(item)
                        },
                        Qty: item.quantity,
                        UnitPrice: item.unit_price,
                        TaxCodeRef: {
                            value: item.tax_rate > 0 ? 'TAX' : 'NON'
                        }
                    },
                    Description: item.description,
                    LineNum: index + 1
                }))),
                CustomerMemo: {
                    value: invoice.notes
                }
            };
            
            // Check if invoice exists
            const mapping = await this.parent.mappingManager.getMapping(
                'quickbooks',
                'invoice',
                invoice.id
            );
            
            let result;
            if (mapping) {
                // Update existing
                qbInvoice.Id = mapping.external_id;
                qbInvoice.SyncToken = mapping.external_sync_token;
                
                result = await this.makeRequest('POST', `/v3/company/${this.connection.realm_id}/invoice`, qbInvoice);
            } else {
                // Create new
                result = await this.makeRequest('POST', `/v3/company/${this.connection.realm_id}/invoice`, qbInvoice);
            }
            
            // Save mapping
            await this.parent.mappingManager.saveMapping(
                'quickbooks',
                'invoice',
                invoice.id,
                result.Invoice.Id,
                result.Invoice.SyncToken
            );
            
            return result.Invoice;
            
        } catch (error) {
            console.error('Error syncing invoice to QuickBooks:', error);
            throw error;
        }
    }
    
    async syncPayment(payment) {
        try {
            // Get customer mapping
            const customerMapping = await this.parent.mappingManager.getMapping(
                'quickbooks',
                'customer',
                payment.customer_id
            );
            
            if (!customerMapping) {
                throw new Error('Customer not synced to QuickBooks');
            }
            
            // Get payment applications
            const applications = await this.parent.db.query(`
                SELECT pa.*, am.external_id as qb_invoice_id
                FROM payment_applications pa
                LEFT JOIN accounting_mappings am ON 
                    am.entity_type = 'invoice' 
                    AND am.internal_id = pa.invoice_id
                    AND am.provider = 'quickbooks'
                WHERE pa.payment_id = $1
            `, [payment.id]);
            
            const qbPayment = {
                TxnDate: moment(payment.received_date).format('YYYY-MM-DD'),
                CustomerRef: {
                    value: customerMapping.external_id
                },
                TotalAmt: payment.amount,
                PaymentMethodRef: {
                    value: await this.getPaymentMethodRef(payment.payment_method)
                },
                DepositToAccountRef: {
                    value: await this.getDepositAccountRef()
                },
                PaymentRefNum: payment.reference_number,
                Line: applications.rows.map(app => ({
                    Amount: app.amount,
                    LinkedTxn: [{
                        TxnId: app.qb_invoice_id,
                        TxnType: 'Invoice'
                    }]
                }))
            };
            
            const result = await this.makeRequest('POST', `/v3/company/${this.connection.realm_id}/payment`, qbPayment);
            
            // Save mapping
            await this.parent.mappingManager.saveMapping(
                'quickbooks',
                'payment',
                payment.id,
                result.Payment.Id,
                result.Payment.SyncToken
            );
            
            return result.Payment;
            
        } catch (error) {
            console.error('Error syncing payment to QuickBooks:', error);
            throw error;
        }
    }
    
    async syncChartOfAccounts() {
        try {
            const accounts = await this.makeRequest('GET', `/v3/company/${this.connection.realm_id}/query`, {
                query: "SELECT * FROM Account WHERE Active = true"
            });
            
            for (const account of accounts.QueryResponse.Account) {
                await this.parent.db.query(`
                    INSERT INTO chart_of_accounts_mapping (
                        provider, account_type, internal_account_code,
                        external_account_id, external_account_name,
                        external_account_number
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (provider, internal_account_code)
                    DO UPDATE SET 
                        external_account_id = $4,
                        external_account_name = $5,
                        external_account_number = $6
                `, [
                    'quickbooks',
                    account.AccountType,
                    this.mapAccountType(account.AccountType),
                    account.Id,
                    account.Name,
                    account.AcctNum
                ]);
            }
            
        } catch (error) {
            console.error('Error syncing chart of accounts:', error);
            throw error;
        }
    }
    
    mapAccountType(qbAccountType) {
        const mapping = {
            'Income': 'revenue',
            'Other Income': 'other_revenue',
            'Expense': 'expense',
            'Other Expense': 'other_expense',
            'Fixed Asset': 'fixed_asset',
            'Bank': 'bank',
            'Accounts Receivable': 'accounts_receivable',
            'Other Current Asset': 'current_asset',
            'Other Asset': 'other_asset',
            'Accounts Payable': 'accounts_payable',
            'Credit Card': 'credit_card',
            'Other Current Liability': 'current_liability',
            'Long Term Liability': 'long_term_liability',
            'Equity': 'equity'
        };
        
        return mapping[qbAccountType] || qbAccountType.toLowerCase();
    }
    
    async getOrCreateItem(lineItem) {
        // Check if item exists
        const items = await this.makeRequest('GET', `/v3/company/${this.connection.realm_id}/query`, {
            query: `SELECT * FROM Item WHERE Name = '${lineItem.description.substring(0, 100)}'`
        });
        
        if (items.QueryResponse.Item && items.QueryResponse.Item.length > 0) {
            return items.QueryResponse.Item[0].Id;
        }
        
        // Create new item
        const newItem = await this.makeRequest('POST', `/v3/company/${this.connection.realm_id}/item`, {
            Name: lineItem.description.substring(0, 100),
            Type: 'Service',
            IncomeAccountRef: {
                value: await this.getIncomeAccountRef()
            }
        });
        
        return newItem.Item.Id;
    }
    
    async getPaymentMethodRef(method) {
        const methodMap = {
            'wire': 'Wire Transfer',
            'ach': 'ACH',
            'check': 'Check',
            'credit_card': 'Credit Card'
        };
        
        const qbMethod = methodMap[method] || 'Other';
        
        const methods = await this.makeRequest('GET', `/v3/company/${this.connection.realm_id}/query`, {
            query: `SELECT * FROM PaymentMethod WHERE Name = '${qbMethod}'`
        });
        
        if (methods.QueryResponse.PaymentMethod && methods.QueryResponse.PaymentMethod.length > 0) {
            return methods.QueryResponse.PaymentMethod[0].Id;
        }
        
        // Create payment method
        const newMethod = await this.makeRequest('POST', `/v3/company/${this.connection.realm_id}/paymentmethod`, {
            Name: qbMethod
        });
        
        return newMethod.PaymentMethod.Id;
    }
    
    async getDepositAccountRef() {
        const account = await this.parent.db.query(`
            SELECT external_account_id
            FROM chart_of_accounts_mapping
            WHERE provider = 'quickbooks'
                AND account_type = 'Bank'
                AND is_active = true
            LIMIT 1
        `);
        
        return account.rows[0]?.external_account_id || '1'; // Default to account 1
    }
    
    async getIncomeAccountRef() {
        const account = await this.parent.db.query(`
            SELECT external_account_id
            FROM chart_of_accounts_mapping
            WHERE provider = 'quickbooks'
                AND account_type = 'Income'
                AND is_active = true
            LIMIT 1
        `);
        
        return account.rows[0]?.external_account_id || '1'; // Default to account 1
    }
}

// NetSuite Integration
class NetSuiteIntegration {
    constructor(parent) {
        this.parent = parent;
        
        // OAuth 1.0a setup
        this.oauth = OAuth({
            consumer: {
                key: parent.config.netsuiteConfig.consumerKey,
                secret: parent.config.netsuiteConfig.consumerSecret
            },
            signature_method: 'HMAC-SHA256',
            hash_function(base_string, key) {
                return crypto
                    .createHmac('sha256', key)
                    .update(base_string)
                    .digest('base64');
            }
        });
    }
    
    async initialize(connection) {
        this.connection = connection;
    }
    
    async connect(credentials) {
        try {
            // Test connection with a simple request
            const testResult = await this.makeRequest('GET', '/customer', {
                limit: 1
            });
            
            // Save connection
            const connection = await this.parent.db.query(`
                INSERT INTO accounting_connections (
                    provider, company_id, metadata
                ) VALUES ($1, $2, $3)
                ON CONFLICT (provider, company_id)
                DO UPDATE SET 
                    status = 'active',
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `, [
                'netsuite',
                this.parent.config.netsuiteConfig.accountId,
                JSON.stringify({
                    accountId: this.parent.config.netsuiteConfig.accountId,
                    restletUrl: this.parent.config.netsuiteConfig.restletUrl
                })
            ]);
            
            this.connection = connection.rows[0];
            
            // Setup chart of accounts mapping
            await this.syncChartOfAccounts();
            
            this.parent.emit('netsuite:connected', { accountId: this.parent.config.netsuiteConfig.accountId });
            
            return connection.rows[0];
            
        } catch (error) {
            console.error('NetSuite connection error:', error);
            throw error;
        }
    }
    
    async makeRequest(method, endpoint, data = {}) {
        const token = {
            key: this.parent.config.netsuiteConfig.tokenId,
            secret: this.parent.config.netsuiteConfig.tokenSecret
        };
        
        const url = `${this.parent.config.netsuiteConfig.restletUrl}${endpoint}`;
        
        const requestData = {
            url,
            method,
            data: method !== 'GET' ? JSON.stringify(data) : undefined
        };
        
        const headers = this.oauth.toHeader(
            this.oauth.authorize(requestData, token)
        );
        
        headers['Content-Type'] = 'application/json';
        headers['Accept'] = 'application/json';
        
        try {
            const response = await axios({
                method,
                url,
                data: method !== 'GET' ? data : undefined,
                params: method === 'GET' ? data : undefined,
                headers
            });
            
            return response.data;
            
        } catch (error) {
            console.error('NetSuite API error:', error.response?.data || error);
            throw error;
        }
    }
    
    async syncCustomer(customer) {
        try {
            // Check if customer exists
            const mapping = await this.parent.mappingManager.getMapping(
                'netsuite',
                'customer',
                customer.id
            );
            
            const nsCustomer = {
                entityid: customer.company_name || `${customer.first_name} ${customer.last_name}`,
                companyname: customer.company_name,
                firstname: customer.first_name,
                lastname: customer.last_name,
                email: customer.email,
                phone: customer.phone,
                addressbook: [{
                    defaultbilling: true,
                    defaultshipping: true,
                    addr1: customer.address_line1,
                    addr2: customer.address_line2,
                    city: customer.city,
                    state: customer.state,
                    zip: customer.postal_code,
                    country: this.getCountryCode(customer.country)
                }]
            };
            
            let result;
            if (mapping) {
                // Update existing
                nsCustomer.internalid = mapping.external_id;
                result = await this.makeRequest('PUT', `/customer/${mapping.external_id}`, nsCustomer);
            } else {
                // Create new
                result = await this.makeRequest('POST', '/customer', nsCustomer);
            }
            
            // Save mapping
            await this.parent.mappingManager.saveMapping(
                'netsuite',
                'customer',
                customer.id,
                result.internalid
            );
            
            return result;
            
        } catch (error) {
            console.error('Error syncing customer to NetSuite:', error);
            throw error;
        }
    }
    
    async syncInvoice(invoice) {
        try {
            // Get customer mapping
            const customerMapping = await this.parent.mappingManager.getMapping(
                'netsuite',
                'customer',
                invoice.customer_id
            );
            
            if (!customerMapping) {
                throw new Error('Customer not synced to NetSuite');
            }
            
            // Get line items
            const lineItems = await this.parent.db.query(`
                SELECT * FROM invoice_line_items
                WHERE invoice_id = $1
                ORDER BY sort_order
            `, [invoice.id]);
            
            // Build NetSuite invoice
            const nsInvoice = {
                entity: customerMapping.external_id,
                tranid: invoice.invoice_number,
                trandate: moment(invoice.issue_date).format('MM/DD/YYYY'),
                duedate: moment(invoice.due_date).format('MM/DD/YYYY'),
                currency: await this.getCurrencyId(invoice.currency),
                exchangerate: invoice.exchange_rate || 1,
                item: await Promise.all(lineItems.rows.map(async item => ({
                    item: await this.getOrCreateItem(item),
                    quantity: item.quantity,
                    rate: item.unit_price,
                    amount: item.amount,
                    description: item.description,
                    taxcode: item.tax_rate > 0 ? await this.getTaxCodeId(item.tax_rate) : '-Not Taxable-'
                }))),
                memo: invoice.notes
            };
            
            // Check if invoice exists
            const mapping = await this.parent.mappingManager.getMapping(
                'netsuite',
                'invoice',
                invoice.id
            );
            
            let result;
            if (mapping) {
                // Update existing
                result = await this.makeRequest('PUT', `/invoice/${mapping.external_id}`, nsInvoice);
            } else {
                // Create new
                result = await this.makeRequest('POST', '/invoice', nsInvoice);
            }
            
            // Save mapping
            await this.parent.mappingManager.saveMapping(
                'netsuite',
                'invoice',
                invoice.id,
                result.internalid
            );
            
            return result;
            
        } catch (error) {
            console.error('Error syncing invoice to NetSuite:', error);
            throw error;
        }
    }
    
    async syncPayment(payment) {
        try {
            // Get customer mapping
            const customerMapping = await this.parent.mappingManager.getMapping(
                'netsuite',
                'customer',
                payment.customer_id
            );
            
            if (!customerMapping) {
                throw new Error('Customer not synced to NetSuite');
            }
            
            // Get payment applications
            const applications = await this.parent.db.query(`
                SELECT pa.*, am.external_id as ns_invoice_id
                FROM payment_applications pa
                LEFT JOIN accounting_mappings am ON 
                    am.entity_type = 'invoice' 
                    AND am.internal_id = pa.invoice_id
                    AND am.provider = 'netsuite'
                WHERE pa.payment_id = $1
            `, [payment.id]);
            
            const nsPayment = {
                customer: customerMapping.external_id,
                payment: payment.amount,
                trandate: moment(payment.received_date).format('MM/DD/YYYY'),
                paymentmethod: await this.getPaymentMethodId(payment.payment_method),
                account: await this.getDepositAccountId(),
                checknum: payment.reference_number,
                apply: applications.rows.map(app => ({
                    doc: app.ns_invoice_id,
                    amount: app.amount,
                    apply: true
                }))
            };
            
            const result = await this.makeRequest('POST', '/customerpayment', nsPayment);
            
            // Save mapping
            await this.parent.mappingManager.saveMapping(
                'netsuite',
                'payment',
                payment.id,
                result.internalid
            );
            
            return result;
            
        } catch (error) {
            console.error('Error syncing payment to NetSuite:', error);
            throw error;
        }
    }
    
    async syncChartOfAccounts() {
        try {
            const accounts = await this.makeRequest('GET', '/account', {
                limit: 1000
            });
            
            for (const account of accounts) {
                await this.parent.db.query(`
                    INSERT INTO chart_of_accounts_mapping (
                        provider, account_type, internal_account_code,
                        external_account_id, external_account_name,
                        external_account_number
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (provider, internal_account_code)
                    DO UPDATE SET 
                        external_account_id = $4,
                        external_account_name = $5,
                        external_account_number = $6
                `, [
                    'netsuite',
                    account.type.name,
                    this.mapAccountType(account.type.name),
                    account.internalid,
                    account.name,
                    account.number
                ]);
            }
            
        } catch (error) {
            console.error('Error syncing chart of accounts:', error);
            throw error;
        }
    }
    
    mapAccountType(nsAccountType) {
        const mapping = {
            'Income': 'revenue',
            'Other Income': 'other_revenue',
            'Expense': 'expense',
            'Other Expense': 'other_expense',
            'Fixed Asset': 'fixed_asset',
            'Bank': 'bank',
            'Accounts Receivable': 'accounts_receivable',
            'Other Current Asset': 'current_asset',
            'Other Asset': 'other_asset',
            'Accounts Payable': 'accounts_payable',
            'Credit Card Liability': 'credit_card',
            'Other Current Liability': 'current_liability',
            'Long Term Liability': 'long_term_liability',
            'Equity': 'equity'
        };
        
        return mapping[nsAccountType] || nsAccountType.toLowerCase().replace(/\s+/g, '_');
    }
    
    getCountryCode(country) {
        // Map country names to NetSuite country codes
        const countryMap = {
            'United States': 'US',
            'Canada': 'CA',
            'United Kingdom': 'GB',
            'Australia': 'AU',
            'Germany': 'DE',
            'France': 'FR',
            'Japan': 'JP'
        };
        
        return countryMap[country] || country;
    }
    
    async getCurrencyId(currencyCode) {
        // This would typically query NetSuite for currency internal ID
        const currencyMap = {
            'USD': '1',
            'EUR': '2',
            'GBP': '3',
            'JPY': '4',
            'AUD': '5',
            'CAD': '6'
        };
        
        return currencyMap[currencyCode] || '1';
    }
    
    async getOrCreateItem(lineItem) {
        // Search for existing item
        const searchResult = await this.makeRequest('GET', '/item', {
            q: lineItem.description.substring(0, 100)
        });
        
        if (searchResult.length > 0) {
            return searchResult[0].internalid;
        }
        
        // Create new service item
        const newItem = await this.makeRequest('POST', '/serviceitem', {
            itemid: lineItem.description.substring(0, 100),
            displayname: lineItem.description,
            incomeaccount: await this.getIncomeAccountId()
        });
        
        return newItem.internalid;
    }
    
    async getPaymentMethodId(method) {
        const methodMap = {
            'wire': '1', // Wire Transfer
            'ach': '2', // ACH
            'check': '3', // Check
            'credit_card': '4' // Credit Card
        };
        
        return methodMap[method] || '1';
    }
    
    async getTaxCodeId(rate) {
        // This would typically query NetSuite for tax code
        // For now, return a default tax code ID
        return '1'; // Standard tax code
    }
    
    async getDepositAccountId() {
        const account = await this.parent.db.query(`
            SELECT external_account_id
            FROM chart_of_accounts_mapping
            WHERE provider = 'netsuite'
                AND account_type = 'Bank'
                AND is_active = true
            LIMIT 1
        `);
        
        return account.rows[0]?.external_account_id || '1';
    }
    
    async getIncomeAccountId() {
        const account = await this.parent.db.query(`
            SELECT external_account_id
            FROM chart_of_accounts_mapping
            WHERE provider = 'netsuite'
                AND account_type = 'Income'
                AND is_active = true
            LIMIT 1
        `);
        
        return account.rows[0]?.external_account_id || '1';
    }
}

// Sync Manager
class SyncManager {
    constructor(parent) {
        this.parent = parent;
    }
    
    async processSyncQueue() {
        // Get pending items
        const pendingItems = await this.parent.db.query(`
            SELECT * FROM accounting_sync_queue
            WHERE status = 'pending'
                AND (last_attempt_at IS NULL OR last_attempt_at < NOW() - INTERVAL '5 minutes')
                AND attempts < 3
            ORDER BY created_at
            LIMIT 50
        `);
        
        for (const item of pendingItems.rows) {
            await this.processSyncItem(item);
        }
    }
    
    async processSyncItem(item) {
        try {
            // Update attempt count
            await this.parent.db.query(`
                UPDATE accounting_sync_queue
                SET attempts = attempts + 1,
                    last_attempt_at = CURRENT_TIMESTAMP,
                    status = 'processing'
                WHERE id = $1
            `, [item.id]);
            
            // Get entity data
            const entity = await this.getEntity(item.entity_type, item.entity_id);
            
            if (!entity) {
                throw new Error(`Entity not found: ${item.entity_type} ${item.entity_id}`);
            }
            
            // Sync to provider
            let result;
            if (item.provider === 'quickbooks') {
                result = await this.syncToQuickBooks(item.entity_type, entity, item.operation);
            } else if (item.provider === 'netsuite') {
                result = await this.syncToNetSuite(item.entity_type, entity, item.operation);
            }
            
            // Update queue item
            await this.parent.db.query(`
                UPDATE accounting_sync_queue
                SET status = 'completed',
                    external_id = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [item.id, result.id || result.Id || result.internalid]);
            
            this.parent.emit('sync:completed', { item, result });
            
        } catch (error) {
            console.error(`Sync failed for item ${item.id}:`, error);
            
            await this.parent.db.query(`
                UPDATE accounting_sync_queue
                SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
                    error_message = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [item.id, error.message]);
            
            this.parent.emit('sync:failed', { item, error });
        }
    }
    
    async getEntity(entityType, entityId) {
        let query;
        
        switch (entityType) {
            case 'customer':
                query = 'SELECT * FROM customers WHERE id = $1';
                break;
            case 'invoice':
                query = 'SELECT * FROM custom_invoices WHERE id = $1';
                break;
            case 'payment':
                query = 'SELECT * FROM enterprise_payments WHERE id = $1';
                break;
            case 'credit_memo':
                query = 'SELECT * FROM credit_memos WHERE id = $1';
                break;
            default:
                throw new Error(`Unknown entity type: ${entityType}`);
        }
        
        const result = await this.parent.db.query(query, [entityId]);
        return result.rows[0];
    }
    
    async syncToQuickBooks(entityType, entity, operation) {
        const qb = this.parent.quickbooksIntegration;
        
        switch (entityType) {
            case 'customer':
                return await qb.syncCustomer(entity);
            case 'invoice':
                return await qb.syncInvoice(entity);
            case 'payment':
                return await qb.syncPayment(entity);
            case 'credit_memo':
                return await qb.syncCreditMemo(entity);
            default:
                throw new Error(`QuickBooks sync not implemented for: ${entityType}`);
        }
    }
    
    async syncToNetSuite(entityType, entity, operation) {
        const ns = this.parent.netsuiteIntegration;
        
        switch (entityType) {
            case 'customer':
                return await ns.syncCustomer(entity);
            case 'invoice':
                return await ns.syncInvoice(entity);
            case 'payment':
                return await ns.syncPayment(entity);
            case 'credit_memo':
                return await ns.syncCreditMemo(entity);
            default:
                throw new Error(`NetSuite sync not implemented for: ${entityType}`);
        }
    }
    
    async performIncrementalSync() {
        const syncId = crypto.randomUUID();
        const startTime = new Date();
        
        try {
            // Log sync start
            await this.parent.db.query(`
                INSERT INTO accounting_sync_log (
                    sync_id, provider, sync_type, start_time, status
                ) VALUES ($1, $2, $3, $4, $5)
            `, [syncId, 'all', 'incremental', startTime, 'running']);
            
            // Get recently modified entities
            const modifiedEntities = await this.getModifiedEntities();
            
            // Queue entities for sync
            for (const entity of modifiedEntities) {
                await this.parent.queueEntitySync(
                    entity.entity_type,
                    entity.entity_id,
                    'update'
                );
            }
            
            // Update sync log
            await this.parent.db.query(`
                UPDATE accounting_sync_log
                SET end_time = CURRENT_TIMESTAMP,
                    status = 'completed',
                    records_synced = $2
                WHERE sync_id = $1
            `, [syncId, modifiedEntities.length]);
            
        } catch (error) {
            console.error('Incremental sync failed:', error);
            
            await this.parent.db.query(`
                UPDATE accounting_sync_log
                SET end_time = CURRENT_TIMESTAMP,
                    status = 'failed',
                    details = $2
                WHERE sync_id = $1
            `, [syncId, JSON.stringify({ error: error.message })]);
        }
    }
    
    async getModifiedEntities() {
        const lastSync = await this.parent.db.query(`
            SELECT MAX(end_time) as last_sync
            FROM accounting_sync_log
            WHERE status = 'completed' AND sync_type = 'incremental'
        `);
        
        const lastSyncTime = lastSync.rows[0]?.last_sync || moment().subtract(1, 'day').toDate();
        
        const entities = [];
        
        // Check customers
        const customers = await this.parent.db.query(`
            SELECT id, 'customer' as entity_type
            FROM customers
            WHERE updated_at > $1
        `, [lastSyncTime]);
        entities.push(...customers.rows.map(r => ({ entity_type: 'customer', entity_id: r.id })));
        
        // Check invoices
        const invoices = await this.parent.db.query(`
            SELECT id, 'invoice' as entity_type
            FROM custom_invoices
            WHERE updated_at > $1
        `, [lastSyncTime]);
        entities.push(...invoices.rows.map(r => ({ entity_type: 'invoice', entity_id: r.id })));
        
        // Check payments
        const payments = await this.parent.db.query(`
            SELECT id, 'payment' as entity_type
            FROM enterprise_payments
            WHERE created_at > $1
        `, [lastSyncTime]);
        entities.push(...payments.rows.map(r => ({ entity_type: 'payment', entity_id: r.id })));
        
        return entities;
    }
}

// Mapping Manager
class MappingManager {
    constructor(parent) {
        this.parent = parent;
        this.fieldMappings = new Map();
    }
    
    async loadFieldMappings() {
        const mappings = await this.parent.db.query(`
            SELECT * FROM accounting_field_mappings
        `);
        
        for (const mapping of mappings.rows) {
            const key = `${mapping.provider}-${mapping.entity_type}`;
            if (!this.fieldMappings.has(key)) {
                this.fieldMappings.set(key, []);
            }
            this.fieldMappings.get(key).push(mapping);
        }
    }
    
    async getMapping(provider, entityType, internalId) {
        const result = await this.parent.db.query(`
            SELECT * FROM accounting_mappings
            WHERE provider = $1 AND entity_type = $2 AND internal_id = $3
        `, [provider, entityType, internalId]);
        
        return result.rows[0];
    }
    
    async saveMapping(provider, entityType, internalId, externalId, syncToken = null) {
        await this.parent.db.query(`
            INSERT INTO accounting_mappings (
                provider, entity_type, internal_id, external_id,
                external_sync_token, last_synced_at
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            ON CONFLICT (provider, entity_type, internal_id)
            DO UPDATE SET 
                external_id = $4,
                external_sync_token = $5,
                last_synced_at = CURRENT_TIMESTAMP
        `, [provider, entityType, internalId, externalId, syncToken]);
    }
    
    transformField(provider, entityType, field, value) {
        const key = `${provider}-${entityType}`;
        const mappings = this.fieldMappings.get(key) || [];
        
        const mapping = mappings.find(m => m.internal_field === field);
        if (!mapping) return value;
        
        // Apply transformation if specified
        if (mapping.transform_function) {
            return this.applyTransformation(mapping.transform_function, value);
        }
        
        return value;
    }
    
    applyTransformation(transformFunction, value) {
        switch (transformFunction) {
            case 'uppercase':
                return value?.toUpperCase();
            case 'lowercase':
                return value?.toLowerCase();
            case 'trim':
                return value?.trim();
            case 'date_format':
                return moment(value).format('YYYY-MM-DD');
            default:
                return value;
        }
    }
}

// Reconciliation Engine
class ReconciliationEngine {
    constructor(parent) {
        this.parent = parent;
    }
    
    async performDailyReconciliation() {
        const providers = ['quickbooks', 'netsuite'];
        const yesterday = moment().subtract(1, 'day');
        
        for (const provider of providers) {
            if (await this.parent.isProviderConnected(provider)) {
                await this.reconcileProvider(
                    provider,
                    yesterday.startOf('day').toDate(),
                    yesterday.endOf('day').toDate()
                );
            }
        }
    }
    
    async reconcileProvider(provider, startDate, endDate) {
        try {
            // Get internal totals
            const internalTotals = await this.getInternalTotals(startDate, endDate);
            
            // Get external totals
            const externalTotals = await this.getExternalTotals(provider, startDate, endDate);
            
            // Compare totals
            const difference = new BigNumber(internalTotals.total)
                .minus(externalTotals.total)
                .toNumber();
            
            // Find discrepancies
            const discrepancies = await this.findDiscrepancies(
                provider,
                internalTotals.details,
                externalTotals.details
            );
            
            // Save reconciliation record
            await this.parent.db.query(`
                INSERT INTO accounting_reconciliation (
                    provider, period_start, period_end,
                    internal_total, external_total, difference,
                    status, discrepancies
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                provider,
                startDate,
                endDate,
                internalTotals.total,
                externalTotals.total,
                difference,
                Math.abs(difference) < 0.01 ? 'balanced' : 'unbalanced',
                JSON.stringify(discrepancies)
            ]);
            
            // Alert if unbalanced
            if (Math.abs(difference) >= 0.01) {
                this.parent.emit('reconciliation:unbalanced', {
                    provider,
                    difference,
                    discrepancies
                });
            }
            
        } catch (error) {
            console.error(`Reconciliation failed for ${provider}:`, error);
        }
    }
    
    async getInternalTotals(startDate, endDate) {
        const invoices = await this.parent.db.query(`
            SELECT 
                SUM(total_amount) as total,
                COUNT(*) as count,
                array_agg(invoice_number) as invoice_numbers
            FROM custom_invoices
            WHERE issue_date >= $1 AND issue_date <= $2
                AND status != 'canceled'
        `, [startDate, endDate]);
        
        const payments = await this.parent.db.query(`
            SELECT 
                SUM(amount) as total,
                COUNT(*) as count,
                array_agg(payment_number) as payment_numbers
            FROM enterprise_payments
            WHERE received_date >= $1 AND received_date <= $2
                AND status != 'canceled'
        `, [startDate, endDate]);
        
        return {
            total: parseFloat(invoices.rows[0].total || 0) - parseFloat(payments.rows[0].total || 0),
            details: {
                invoices: {
                    total: parseFloat(invoices.rows[0].total || 0),
                    count: parseInt(invoices.rows[0].count || 0),
                    numbers: invoices.rows[0].invoice_numbers || []
                },
                payments: {
                    total: parseFloat(payments.rows[0].total || 0),
                    count: parseInt(payments.rows[0].count || 0),
                    numbers: payments.rows[0].payment_numbers || []
                }
            }
        };
    }
    
    async getExternalTotals(provider, startDate, endDate) {
        if (provider === 'quickbooks') {
            return await this.getQuickBooksTotals(startDate, endDate);
        } else if (provider === 'netsuite') {
            return await this.getNetSuiteTotals(startDate, endDate);
        }
    }
    
    async getQuickBooksTotals(startDate, endDate) {
        const qb = this.parent.quickbooksIntegration;
        
        // Query invoices
        const invoices = await qb.makeRequest('GET', `/v3/company/${qb.connection.realm_id}/query`, {
            query: `SELECT * FROM Invoice WHERE TxnDate >= '${moment(startDate).format('YYYY-MM-DD')}' AND TxnDate <= '${moment(endDate).format('YYYY-MM-DD')}'`
        });
        
        // Query payments
        const payments = await qb.makeRequest('GET', `/v3/company/${qb.connection.realm_id}/query`, {
            query: `SELECT * FROM Payment WHERE TxnDate >= '${moment(startDate).format('YYYY-MM-DD')}' AND TxnDate <= '${moment(endDate).format('YYYY-MM-DD')}'`
        });
        
        const invoiceTotal = invoices.QueryResponse.Invoice?.reduce((sum, inv) => sum + parseFloat(inv.TotalAmt), 0) || 0;
        const paymentTotal = payments.QueryResponse.Payment?.reduce((sum, pmt) => sum + parseFloat(pmt.TotalAmt), 0) || 0;
        
        return {
            total: invoiceTotal - paymentTotal,
            details: {
                invoices: {
                    total: invoiceTotal,
                    count: invoices.QueryResponse.Invoice?.length || 0
                },
                payments: {
                    total: paymentTotal,
                    count: payments.QueryResponse.Payment?.length || 0
                }
            }
        };
    }
    
    async getNetSuiteTotals(startDate, endDate) {
        const ns = this.parent.netsuiteIntegration;
        
        // Query through RESTlet
        const result = await ns.makeRequest('POST', '/reconciliation', {
            startDate: moment(startDate).format('MM/DD/YYYY'),
            endDate: moment(endDate).format('MM/DD/YYYY')
        });
        
        return {
            total: result.netAmount,
            details: {
                invoices: result.invoices,
                payments: result.payments
            }
        };
    }
    
    async findDiscrepancies(provider, internalDetails, externalDetails) {
        const discrepancies = [];
        
        // Compare counts
        if (internalDetails.invoices.count !== externalDetails.invoices.count) {
            discrepancies.push({
                type: 'invoice_count_mismatch',
                internal: internalDetails.invoices.count,
                external: externalDetails.invoices.count
            });
        }
        
        if (internalDetails.payments.count !== externalDetails.payments.count) {
            discrepancies.push({
                type: 'payment_count_mismatch',
                internal: internalDetails.payments.count,
                external: externalDetails.payments.count
            });
        }
        
        // Compare totals
        const invoiceDiff = Math.abs(internalDetails.invoices.total - externalDetails.invoices.total);
        if (invoiceDiff >= 0.01) {
            discrepancies.push({
                type: 'invoice_total_mismatch',
                internal: internalDetails.invoices.total,
                external: externalDetails.invoices.total,
                difference: invoiceDiff
            });
        }
        
        const paymentDiff = Math.abs(internalDetails.payments.total - externalDetails.payments.total);
        if (paymentDiff >= 0.01) {
            discrepancies.push({
                type: 'payment_total_mismatch',
                internal: internalDetails.payments.total,
                external: externalDetails.payments.total,
                difference: paymentDiff
            });
        }
        
        return discrepancies;
    }
    
    async generateReport(provider, startDate, endDate) {
        const reconciliations = await this.parent.db.query(`
            SELECT * FROM accounting_reconciliation
            WHERE provider = $1
                AND period_start >= $2
                AND period_end <= $3
            ORDER BY period_start DESC
        `, [provider, startDate, endDate]);
        
        const summary = {
            provider,
            period: { startDate, endDate },
            totalReconciliations: reconciliations.rows.length,
            balanced: reconciliations.rows.filter(r => r.status === 'balanced').length,
            unbalanced: reconciliations.rows.filter(r => r.status === 'unbalanced').length,
            totalDifference: reconciliations.rows.reduce((sum, r) => sum + Math.abs(r.difference), 0),
            details: reconciliations.rows
        };
        
        return summary;
    }
}

module.exports = AccountingIntegrationSystem;