#!/usr/bin/env node

/**
 * ROOTUIP Enterprise Billing Features
 * Custom invoicing, PO processing, multi-currency support
 */

const { Pool } = require('pg');
const { EventEmitter } = require('events');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const BigNumber = require('bignumber.js');
const axios = require('axios');
const crypto = require('crypto');

class EnterpriseBillingSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            databaseUrl: config.databaseUrl || process.env.DATABASE_URL,
            defaultCurrency: config.defaultCurrency || 'USD',
            supportedCurrencies: config.supportedCurrencies || ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'],
            invoicePrefix: config.invoicePrefix || 'INV',
            creditMemoPrefix: config.creditMemoPrefix || 'CM',
            exchangeRateAPI: config.exchangeRateAPI || process.env.EXCHANGE_RATE_API,
            ...config
        };
        
        // Database connection
        this.db = new Pool({
            connectionString: this.config.databaseUrl,
            max: 10
        });
        
        // Components
        this.invoiceManager = new CustomInvoiceManager(this);
        this.purchaseOrderManager = new PurchaseOrderManager(this);
        this.currencyManager = new MultiCurrencyManager(this);
        this.creditManager = new CreditManager(this);
        this.dunningManager = new DunningManager(this);
        this.paymentProcessor = new EnterprisePaymentProcessor(this);
        
        // Invoice templates
        this.templates = new InvoiceTemplateManager(this);
        
        // Initialize system
        this.initialize();
    }
    
    // Initialize system
    async initialize() {
        console.log('Initializing Enterprise Billing System');
        
        try {
            // Create database schema
            await this.createDatabaseSchema();
            
            // Load invoice templates
            await this.templates.loadTemplates();
            
            // Initialize currency rates
            await this.currencyManager.updateExchangeRates();
            
            // Schedule automated processes
            this.scheduleAutomatedProcesses();
            
            console.log('Enterprise Billing System initialized');
            
        } catch (error) {
            console.error('Failed to initialize enterprise billing:', error);
            throw error;
        }
    }
    
    // Create database schema
    async createDatabaseSchema() {
        await this.db.query(`
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                po_number VARCHAR(100) UNIQUE NOT NULL,
                customer_id UUID NOT NULL,
                status VARCHAR(50) DEFAULT 'draft',
                issue_date DATE NOT NULL,
                expiry_date DATE,
                total_amount DECIMAL(20,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                terms TEXT,
                approved_by VARCHAR(255),
                approved_at TIMESTAMP,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS custom_invoices (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_number VARCHAR(100) UNIQUE NOT NULL,
                customer_id UUID NOT NULL,
                po_id UUID REFERENCES purchase_orders(id),
                status VARCHAR(50) DEFAULT 'draft',
                issue_date DATE NOT NULL,
                due_date DATE NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                exchange_rate DECIMAL(10,6) DEFAULT 1,
                subtotal DECIMAL(20,2) NOT NULL,
                tax_amount DECIMAL(20,2) DEFAULT 0,
                discount_amount DECIMAL(20,2) DEFAULT 0,
                total_amount DECIMAL(20,2) NOT NULL,
                paid_amount DECIMAL(20,2) DEFAULT 0,
                balance_due DECIMAL(20,2) NOT NULL,
                payment_terms VARCHAR(100),
                notes TEXT,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS invoice_line_items (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id UUID REFERENCES custom_invoices(id) ON DELETE CASCADE,
                description TEXT NOT NULL,
                quantity DECIMAL(20,6) NOT NULL,
                unit_price DECIMAL(20,6) NOT NULL,
                amount DECIMAL(20,2) NOT NULL,
                tax_rate DECIMAL(5,2) DEFAULT 0,
                tax_amount DECIMAL(20,2) DEFAULT 0,
                discount_rate DECIMAL(5,2) DEFAULT 0,
                discount_amount DECIMAL(20,2) DEFAULT 0,
                accounting_code VARCHAR(100),
                metadata JSONB DEFAULT '{}',
                sort_order INTEGER DEFAULT 0
            );
            
            CREATE TABLE IF NOT EXISTS credit_memos (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                credit_memo_number VARCHAR(100) UNIQUE NOT NULL,
                customer_id UUID NOT NULL,
                invoice_id UUID REFERENCES custom_invoices(id),
                status VARCHAR(50) DEFAULT 'draft',
                issue_date DATE NOT NULL,
                amount DECIMAL(20,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                reason TEXT,
                applied_amount DECIMAL(20,2) DEFAULT 0,
                remaining_amount DECIMAL(20,2) NOT NULL,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS payment_schedules (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id UUID REFERENCES custom_invoices(id),
                installment_number INTEGER NOT NULL,
                due_date DATE NOT NULL,
                amount DECIMAL(20,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                paid_date DATE,
                paid_amount DECIMAL(20,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS enterprise_payments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                payment_number VARCHAR(100) UNIQUE NOT NULL,
                customer_id UUID NOT NULL,
                payment_method VARCHAR(50) NOT NULL, -- 'wire', 'ach', 'check', 'credit_card'
                amount DECIMAL(20,2) NOT NULL,
                currency VARCHAR(3) DEFAULT 'USD',
                status VARCHAR(50) DEFAULT 'pending',
                reference_number VARCHAR(255),
                received_date DATE,
                cleared_date DATE,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS payment_applications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                payment_id UUID REFERENCES enterprise_payments(id),
                invoice_id UUID REFERENCES custom_invoices(id),
                amount DECIMAL(20,2) NOT NULL,
                applied_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS currency_rates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                base_currency VARCHAR(3) NOT NULL,
                target_currency VARCHAR(3) NOT NULL,
                rate DECIMAL(10,6) NOT NULL,
                rate_date DATE NOT NULL,
                source VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(base_currency, target_currency, rate_date)
            );
            
            CREATE TABLE IF NOT EXISTS dunning_campaigns (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'active',
                rules JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS dunning_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id UUID REFERENCES custom_invoices(id),
                campaign_id UUID REFERENCES dunning_campaigns(id),
                step_number INTEGER NOT NULL,
                action_type VARCHAR(50) NOT NULL, -- 'email', 'phone', 'letter'
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                response TEXT,
                success BOOLEAN DEFAULT true
            );
            
            -- Indexes
            CREATE INDEX idx_purchase_orders_customer ON purchase_orders(customer_id);
            CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
            CREATE INDEX idx_custom_invoices_customer ON custom_invoices(customer_id);
            CREATE INDEX idx_custom_invoices_status ON custom_invoices(status);
            CREATE INDEX idx_custom_invoices_due ON custom_invoices(due_date);
            CREATE INDEX idx_invoice_line_items_invoice ON invoice_line_items(invoice_id);
            CREATE INDEX idx_credit_memos_customer ON credit_memos(customer_id);
            CREATE INDEX idx_payment_schedules_invoice ON payment_schedules(invoice_id);
            CREATE INDEX idx_enterprise_payments_customer ON enterprise_payments(customer_id);
            CREATE INDEX idx_payment_applications_payment ON payment_applications(payment_id);
            CREATE INDEX idx_payment_applications_invoice ON payment_applications(invoice_id);
        `);
    }
    
    // Create custom invoice
    async createCustomInvoice(data) {
        try {
            const invoiceNumber = await this.generateInvoiceNumber();
            
            // Validate PO if provided
            if (data.poNumber) {
                const po = await this.purchaseOrderManager.validatePO(data.poNumber, data.customerId);
                if (!po.valid) {
                    throw new Error(`Invalid PO: ${po.reason}`);
                }
                data.poId = po.id;
            }
            
            // Get customer details
            const customer = await this.getCustomer(data.customerId);
            
            // Apply customer-specific settings
            const invoiceData = {
                ...data,
                invoice_number: invoiceNumber,
                currency: data.currency || customer.default_currency || this.config.defaultCurrency,
                payment_terms: data.paymentTerms || customer.payment_terms || 'Net 30',
                due_date: this.calculateDueDate(data.issueDate, data.paymentTerms || customer.payment_terms)
            };
            
            // Get exchange rate if not base currency
            if (invoiceData.currency !== this.config.defaultCurrency) {
                invoiceData.exchange_rate = await this.currencyManager.getExchangeRate(
                    this.config.defaultCurrency,
                    invoiceData.currency,
                    invoiceData.issue_date
                );
            }
            
            // Calculate totals
            const totals = this.calculateInvoiceTotals(invoiceData.lineItems, {
                taxRate: data.taxRate || customer.tax_rate || 0,
                discountRate: data.discountRate || 0
            });
            
            // Begin transaction
            const client = await this.db.connect();
            
            try {
                await client.query('BEGIN');
                
                // Create invoice
                const invoice = await client.query(`
                    INSERT INTO custom_invoices (
                        invoice_number, customer_id, po_id, status,
                        issue_date, due_date, currency, exchange_rate,
                        subtotal, tax_amount, discount_amount, total_amount,
                        balance_due, payment_terms, notes, metadata
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                    RETURNING *
                `, [
                    invoiceData.invoice_number,
                    invoiceData.customer_id,
                    invoiceData.poId,
                    'draft',
                    invoiceData.issue_date,
                    invoiceData.due_date,
                    invoiceData.currency,
                    invoiceData.exchange_rate || 1,
                    totals.subtotal,
                    totals.taxAmount,
                    totals.discountAmount,
                    totals.total,
                    totals.total, // Initial balance due
                    invoiceData.payment_terms,
                    invoiceData.notes,
                    JSON.stringify(invoiceData.metadata || {})
                ]);
                
                // Create line items
                for (let i = 0; i < invoiceData.lineItems.length; i++) {
                    const item = invoiceData.lineItems[i];
                    await client.query(`
                        INSERT INTO invoice_line_items (
                            invoice_id, description, quantity, unit_price,
                            amount, tax_rate, tax_amount, discount_rate,
                            discount_amount, accounting_code, sort_order
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    `, [
                        invoice.rows[0].id,
                        item.description,
                        item.quantity,
                        item.unitPrice,
                        item.amount,
                        item.taxRate || totals.taxRate,
                        item.taxAmount || 0,
                        item.discountRate || 0,
                        item.discountAmount || 0,
                        item.accountingCode,
                        i
                    ]);
                }
                
                // Create payment schedule if specified
                if (invoiceData.paymentSchedule) {
                    await this.createPaymentSchedule(
                        client,
                        invoice.rows[0].id,
                        invoiceData.paymentSchedule
                    );
                }
                
                await client.query('COMMIT');
                
                // Generate PDF
                const pdfUrl = await this.invoiceManager.generateInvoicePDF(invoice.rows[0]);
                
                this.emit('invoice:created', invoice.rows[0]);
                
                return {
                    invoice: invoice.rows[0],
                    pdfUrl
                };
                
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
            
        } catch (error) {
            console.error('Error creating custom invoice:', error);
            throw error;
        }
    }
    
    // Process purchase order
    async processPurchaseOrder(poData) {
        try {
            const poNumber = poData.poNumber || await this.generatePONumber();
            
            // Validate customer credit
            const creditCheck = await this.creditManager.checkCredit(
                poData.customerId,
                poData.totalAmount
            );
            
            if (!creditCheck.approved) {
                throw new Error(`Credit check failed: ${creditCheck.reason}`);
            }
            
            // Create PO
            const po = await this.db.query(`
                INSERT INTO purchase_orders (
                    po_number, customer_id, status, issue_date,
                    expiry_date, total_amount, currency, terms, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [
                poNumber,
                poData.customerId,
                'pending_approval',
                poData.issueDate || new Date(),
                poData.expiryDate,
                poData.totalAmount,
                poData.currency || this.config.defaultCurrency,
                poData.terms,
                JSON.stringify(poData.metadata || {})
            ]);
            
            // Process approval workflow
            if (poData.autoApprove || creditCheck.autoApprove) {
                await this.approvePurchaseOrder(po.rows[0].id, {
                    approvedBy: 'system',
                    reason: 'Auto-approved based on credit check'
                });
            } else {
                // Send for manual approval
                await this.sendPOForApproval(po.rows[0]);
            }
            
            this.emit('po:created', po.rows[0]);
            
            return po.rows[0];
            
        } catch (error) {
            console.error('Error processing purchase order:', error);
            throw error;
        }
    }
    
    // Apply payment to invoices
    async applyPayment(paymentData) {
        const client = await this.db.connect();
        
        try {
            await client.query('BEGIN');
            
            // Create payment record
            const payment = await client.query(`
                INSERT INTO enterprise_payments (
                    payment_number, customer_id, payment_method,
                    amount, currency, status, reference_number,
                    received_date, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [
                await this.generatePaymentNumber(),
                paymentData.customerId,
                paymentData.paymentMethod,
                paymentData.amount,
                paymentData.currency || this.config.defaultCurrency,
                'pending',
                paymentData.referenceNumber,
                paymentData.receivedDate || new Date(),
                JSON.stringify(paymentData.metadata || {})
            ]);
            
            // Get unpaid invoices
            const unpaidInvoices = await client.query(`
                SELECT * FROM custom_invoices
                WHERE customer_id = $1
                    AND balance_due > 0
                    AND status != 'canceled'
                ORDER BY due_date, invoice_number
            `, [paymentData.customerId]);
            
            // Apply payment to invoices
            let remainingAmount = new BigNumber(paymentData.amount);
            const applications = [];
            
            for (const invoice of unpaidInvoices.rows) {
                if (remainingAmount.isLessThanOrEqualTo(0)) break;
                
                const balanceDue = new BigNumber(invoice.balance_due);
                const applicationAmount = BigNumber.min(remainingAmount, balanceDue);
                
                // Apply payment
                await client.query(`
                    INSERT INTO payment_applications (
                        payment_id, invoice_id, amount, applied_date
                    ) VALUES ($1, $2, $3, $4)
                `, [
                    payment.rows[0].id,
                    invoice.id,
                    applicationAmount.toNumber(),
                    new Date()
                ]);
                
                // Update invoice
                const newPaidAmount = new BigNumber(invoice.paid_amount).plus(applicationAmount);
                const newBalance = balanceDue.minus(applicationAmount);
                
                await client.query(`
                    UPDATE custom_invoices
                    SET paid_amount = $1,
                        balance_due = $2,
                        status = CASE WHEN $2 = 0 THEN 'paid' ELSE 'partial' END,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $3
                `, [
                    newPaidAmount.toNumber(),
                    newBalance.toNumber(),
                    invoice.id
                ]);
                
                applications.push({
                    invoiceId: invoice.id,
                    invoiceNumber: invoice.invoice_number,
                    amount: applicationAmount.toNumber()
                });
                
                remainingAmount = remainingAmount.minus(applicationAmount);
            }
            
            // Update payment status
            await client.query(`
                UPDATE enterprise_payments
                SET status = 'applied'
                WHERE id = $1
            `, [payment.rows[0].id]);
            
            await client.query('COMMIT');
            
            // Handle any remaining credit
            if (remainingAmount.isGreaterThan(0)) {
                await this.creditManager.createCustomerCredit({
                    customerId: paymentData.customerId,
                    amount: remainingAmount.toNumber(),
                    paymentId: payment.rows[0].id,
                    reason: 'Overpayment'
                });
            }
            
            this.emit('payment:applied', {
                payment: payment.rows[0],
                applications
            });
            
            return {
                payment: payment.rows[0],
                applications,
                unappliedAmount: remainingAmount.toNumber()
            };
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
    
    // Create credit memo
    async createCreditMemo(data) {
        try {
            const creditMemoNumber = await this.generateCreditMemoNumber();
            
            const creditMemo = await this.db.query(`
                INSERT INTO credit_memos (
                    credit_memo_number, customer_id, invoice_id,
                    status, issue_date, amount, currency,
                    reason, remaining_amount, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [
                creditMemoNumber,
                data.customerId,
                data.invoiceId,
                'issued',
                data.issueDate || new Date(),
                data.amount,
                data.currency || this.config.defaultCurrency,
                data.reason,
                data.amount, // Initial remaining amount
                JSON.stringify(data.metadata || {})
            ]);
            
            // Apply to invoice if specified
            if (data.applyToInvoice && data.invoiceId) {
                await this.applyCreditMemo(creditMemo.rows[0].id, data.invoiceId);
            }
            
            this.emit('credit_memo:created', creditMemo.rows[0]);
            
            return creditMemo.rows[0];
            
        } catch (error) {
            console.error('Error creating credit memo:', error);
            throw error;
        }
    }
    
    // Process wire transfer
    async processWireTransfer(wireData) {
        try {
            // Validate wire details
            const validation = await this.validateWireTransfer(wireData);
            if (!validation.valid) {
                throw new Error(`Invalid wire transfer: ${validation.reason}`);
            }
            
            // Create payment record
            const payment = await this.applyPayment({
                customerId: wireData.customerId,
                paymentMethod: 'wire',
                amount: wireData.amount,
                currency: wireData.currency,
                referenceNumber: wireData.wireReference,
                receivedDate: wireData.receivedDate,
                metadata: {
                    bankName: wireData.bankName,
                    bankReference: wireData.bankReference,
                    swiftCode: wireData.swiftCode
                }
            });
            
            // Send confirmation
            await this.sendWireConfirmation(payment);
            
            return payment;
            
        } catch (error) {
            console.error('Error processing wire transfer:', error);
            throw error;
        }
    }
    
    // Generate consolidated invoice
    async generateConsolidatedInvoice(customerId, options = {}) {
        const {
            startDate = moment().startOf('month').toDate(),
            endDate = moment().endOf('month').toDate(),
            includeSubscriptions = true,
            includeUsage = true,
            includeOneTime = true
        } = options;
        
        // Gather all billable items
        const billableItems = [];
        
        // Subscription charges
        if (includeSubscriptions) {
            const subscriptions = await this.getSubscriptionCharges(customerId, startDate, endDate);
            billableItems.push(...subscriptions);
        }
        
        // Usage charges
        if (includeUsage) {
            const usage = await this.getUsageCharges(customerId, startDate, endDate);
            billableItems.push(...usage);
        }
        
        // One-time charges
        if (includeOneTime) {
            const oneTime = await this.getOneTimeCharges(customerId, startDate, endDate);
            billableItems.push(...oneTime);
        }
        
        // Create consolidated invoice
        const invoice = await this.createCustomInvoice({
            customerId,
            issueDate: new Date(),
            lineItems: billableItems,
            notes: `Consolidated invoice for period ${moment(startDate).format('MMM DD')} - ${moment(endDate).format('MMM DD, YYYY')}`,
            metadata: {
                type: 'consolidated',
                period: { startDate, endDate }
            }
        });
        
        return invoice;
    }
    
    // Schedule automated processes
    scheduleAutomatedProcesses() {
        // Update exchange rates daily
        setInterval(() => {
            this.currencyManager.updateExchangeRates();
        }, 24 * 60 * 60 * 1000);
        
        // Process dunning campaigns
        setInterval(() => {
            this.dunningManager.processDunningCampaigns();
        }, 6 * 60 * 60 * 1000); // Every 6 hours
        
        // Generate recurring invoices
        setInterval(() => {
            this.generateRecurringInvoices();
        }, 24 * 60 * 60 * 1000); // Daily
    }
    
    // Helper methods
    async generateInvoiceNumber() {
        const date = moment().format('YYYYMM');
        const sequence = await this.getNextSequence('invoice', date);
        return `${this.config.invoicePrefix}-${date}-${String(sequence).padStart(4, '0')}`;
    }
    
    async generatePONumber() {
        const date = moment().format('YYYYMM');
        const sequence = await this.getNextSequence('po', date);
        return `PO-${date}-${String(sequence).padStart(4, '0')}`;
    }
    
    async generateCreditMemoNumber() {
        const date = moment().format('YYYYMM');
        const sequence = await this.getNextSequence('credit_memo', date);
        return `${this.config.creditMemoPrefix}-${date}-${String(sequence).padStart(4, '0')}`;
    }
    
    async generatePaymentNumber() {
        const date = moment().format('YYYYMM');
        const sequence = await this.getNextSequence('payment', date);
        return `PMT-${date}-${String(sequence).padStart(5, '0')}`;
    }
    
    async getNextSequence(type, period) {
        const result = await this.db.query(`
            INSERT INTO sequences (type, period, sequence)
            VALUES ($1, $2, 1)
            ON CONFLICT (type, period)
            DO UPDATE SET sequence = sequences.sequence + 1
            RETURNING sequence
        `, [type, period]);
        
        return result.rows[0].sequence;
    }
    
    calculateDueDate(issueDate, paymentTerms) {
        const date = moment(issueDate);
        
        switch (paymentTerms) {
            case 'Due on Receipt':
                return date.toDate();
            case 'Net 15':
                return date.add(15, 'days').toDate();
            case 'Net 30':
                return date.add(30, 'days').toDate();
            case 'Net 45':
                return date.add(45, 'days').toDate();
            case 'Net 60':
                return date.add(60, 'days').toDate();
            case 'Net 90':
                return date.add(90, 'days').toDate();
            case 'EOM': // End of Month
                return date.endOf('month').toDate();
            case '2/10 Net 30': // 2% discount if paid in 10 days, otherwise net 30
                return date.add(30, 'days').toDate();
            default:
                return date.add(30, 'days').toDate();
        }
    }
    
    calculateInvoiceTotals(lineItems, options) {
        let subtotal = new BigNumber(0);
        let taxAmount = new BigNumber(0);
        let discountAmount = new BigNumber(0);
        
        for (const item of lineItems) {
            const itemAmount = new BigNumber(item.quantity).times(item.unitPrice);
            subtotal = subtotal.plus(itemAmount);
            
            if (item.discountRate) {
                const itemDiscount = itemAmount.times(item.discountRate).dividedBy(100);
                discountAmount = discountAmount.plus(itemDiscount);
                item.discountAmount = itemDiscount.toNumber();
            }
            
            if (item.taxRate || options.taxRate) {
                const taxableAmount = itemAmount.minus(item.discountAmount || 0);
                const itemTax = taxableAmount.times(item.taxRate || options.taxRate).dividedBy(100);
                taxAmount = taxAmount.plus(itemTax);
                item.taxAmount = itemTax.toNumber();
            }
            
            item.amount = itemAmount.toNumber();
        }
        
        // Apply invoice-level discount
        if (options.discountRate) {
            const invoiceDiscount = subtotal.times(options.discountRate).dividedBy(100);
            discountAmount = discountAmount.plus(invoiceDiscount);
        }
        
        const total = subtotal.minus(discountAmount).plus(taxAmount);
        
        return {
            subtotal: subtotal.toNumber(),
            taxAmount: taxAmount.toNumber(),
            discountAmount: discountAmount.toNumber(),
            total: total.toNumber(),
            taxRate: options.taxRate
        };
    }
}

// Custom Invoice Manager
class CustomInvoiceManager {
    constructor(parent) {
        this.parent = parent;
    }
    
    async generateInvoicePDF(invoice) {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const filename = `invoice_${invoice.invoice_number}.pdf`;
        const filepath = `/tmp/${filename}`;
        
        doc.pipe(require('fs').createWriteStream(filepath));
        
        // Get customer details
        const customer = await this.parent.getCustomer(invoice.customer_id);
        
        // Get line items
        const lineItems = await this.parent.db.query(`
            SELECT * FROM invoice_line_items
            WHERE invoice_id = $1
            ORDER BY sort_order
        `, [invoice.id]);
        
        // Company header
        doc.fontSize(20).text('ROOTUIP Logistics', 50, 50);
        doc.fontSize(10)
            .text('123 Shipping Lane', 50, 80)
            .text('Port City, PC 12345', 50, 95)
            .text('Phone: (555) 123-4567', 50, 110)
            .text('Email: billing@rootuip.com', 50, 125);
        
        // Invoice title
        doc.fontSize(20).text('INVOICE', 400, 50, { align: 'right' });
        doc.fontSize(10)
            .text(`Invoice #: ${invoice.invoice_number}`, 400, 80, { align: 'right' })
            .text(`Date: ${moment(invoice.issue_date).format('MMM DD, YYYY')}`, 400, 95, { align: 'right' })
            .text(`Due Date: ${moment(invoice.due_date).format('MMM DD, YYYY')}`, 400, 110, { align: 'right' });
        
        // Customer details
        doc.fontSize(12).text('Bill To:', 50, 160);
        doc.fontSize(10)
            .text(customer.company_name || customer.name, 50, 180)
            .text(customer.address_line1, 50, 195)
            .text(`${customer.city}, ${customer.state} ${customer.postal_code}`, 50, 210)
            .text(customer.country, 50, 225);
        
        // PO Number if exists
        if (invoice.po_id) {
            const po = await this.parent.db.query(
                'SELECT po_number FROM purchase_orders WHERE id = $1',
                [invoice.po_id]
            );
            doc.text(`PO Number: ${po.rows[0].po_number}`, 300, 180);
        }
        
        // Line items table
        const tableTop = 270;
        const tableHeaders = ['Description', 'Qty', 'Unit Price', 'Amount'];
        const columnWidths = [250, 60, 100, 100];
        let currentY = tableTop;
        
        // Table headers
        doc.fontSize(10).font('Helvetica-Bold');
        let currentX = 50;
        tableHeaders.forEach((header, i) => {
            doc.text(header, currentX, currentY);
            currentX += columnWidths[i];
        });
        
        // Draw line under headers
        doc.moveTo(50, currentY + 15)
            .lineTo(560, currentY + 15)
            .stroke();
        
        currentY += 25;
        
        // Table rows
        doc.font('Helvetica');
        for (const item of lineItems.rows) {
            currentX = 50;
            
            doc.text(item.description, currentX, currentY, {
                width: columnWidths[0] - 10,
                ellipsis: true
            });
            currentX += columnWidths[0];
            
            doc.text(item.quantity.toString(), currentX, currentY);
            currentX += columnWidths[1];
            
            doc.text(`${invoice.currency} ${parseFloat(item.unit_price).toFixed(2)}`, currentX, currentY);
            currentX += columnWidths[2];
            
            doc.text(`${invoice.currency} ${parseFloat(item.amount).toFixed(2)}`, currentX, currentY);
            
            currentY += 20;
            
            // Add new page if needed
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
            }
        }
        
        // Totals
        const totalsX = 400;
        currentY += 20;
        
        doc.text(`Subtotal:`, totalsX, currentY);
        doc.text(`${invoice.currency} ${parseFloat(invoice.subtotal).toFixed(2)}`, totalsX + 100, currentY, { align: 'right' });
        
        if (invoice.discount_amount > 0) {
            currentY += 15;
            doc.text(`Discount:`, totalsX, currentY);
            doc.text(`-${invoice.currency} ${parseFloat(invoice.discount_amount).toFixed(2)}`, totalsX + 100, currentY, { align: 'right' });
        }
        
        if (invoice.tax_amount > 0) {
            currentY += 15;
            doc.text(`Tax:`, totalsX, currentY);
            doc.text(`${invoice.currency} ${parseFloat(invoice.tax_amount).toFixed(2)}`, totalsX + 100, currentY, { align: 'right' });
        }
        
        currentY += 20;
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(`Total:`, totalsX, currentY);
        doc.text(`${invoice.currency} ${parseFloat(invoice.total_amount).toFixed(2)}`, totalsX + 100, currentY, { align: 'right' });
        
        if (invoice.paid_amount > 0) {
            currentY += 15;
            doc.fontSize(10).font('Helvetica');
            doc.text(`Paid:`, totalsX, currentY);
            doc.text(`-${invoice.currency} ${parseFloat(invoice.paid_amount).toFixed(2)}`, totalsX + 100, currentY, { align: 'right' });
            
            currentY += 15;
            doc.fontSize(12).font('Helvetica-Bold');
            doc.text(`Balance Due:`, totalsX, currentY);
            doc.text(`${invoice.currency} ${parseFloat(invoice.balance_due).toFixed(2)}`, totalsX + 100, currentY, { align: 'right' });
        }
        
        // Payment terms and notes
        if (invoice.payment_terms) {
            doc.fontSize(10).font('Helvetica');
            doc.text(`Payment Terms: ${invoice.payment_terms}`, 50, currentY + 40);
        }
        
        if (invoice.notes) {
            doc.text('Notes:', 50, currentY + 60);
            doc.text(invoice.notes, 50, currentY + 75, { width: 400 });
        }
        
        // Footer
        doc.fontSize(8)
            .text('Thank you for your business!', 50, 750, { align: 'center', width: 500 });
        
        doc.end();
        
        // Upload to storage
        return await this.uploadInvoice(filepath, filename);
    }
    
    async uploadInvoice(filepath, filename) {
        // Implementation would upload to S3 or similar
        // For now, return local path
        return filepath;
    }
}

// Purchase Order Manager
class PurchaseOrderManager {
    constructor(parent) {
        this.parent = parent;
    }
    
    async validatePO(poNumber, customerId) {
        const po = await this.parent.db.query(`
            SELECT * FROM purchase_orders
            WHERE po_number = $1 AND customer_id = $2
        `, [poNumber, customerId]);
        
        if (po.rows.length === 0) {
            return { valid: false, reason: 'PO not found' };
        }
        
        const purchaseOrder = po.rows[0];
        
        // Check status
        if (purchaseOrder.status !== 'approved') {
            return { valid: false, reason: 'PO not approved' };
        }
        
        // Check expiry
        if (purchaseOrder.expiry_date && moment(purchaseOrder.expiry_date).isBefore(moment())) {
            return { valid: false, reason: 'PO expired' };
        }
        
        // Check remaining balance
        const used = await this.getPOUsedAmount(purchaseOrder.id);
        const remaining = new BigNumber(purchaseOrder.total_amount).minus(used);
        
        if (remaining.isLessThanOrEqualTo(0)) {
            return { valid: false, reason: 'PO fully utilized' };
        }
        
        return {
            valid: true,
            id: purchaseOrder.id,
            remaining: remaining.toNumber()
        };
    }
    
    async getPOUsedAmount(poId) {
        const result = await this.parent.db.query(`
            SELECT COALESCE(SUM(total_amount), 0) as used_amount
            FROM custom_invoices
            WHERE po_id = $1 AND status != 'canceled'
        `, [poId]);
        
        return parseFloat(result.rows[0].used_amount);
    }
}

// Multi-Currency Manager
class MultiCurrencyManager {
    constructor(parent) {
        this.parent = parent;
        this.ratesCache = new Map();
    }
    
    async updateExchangeRates() {
        try {
            const response = await axios.get(this.parent.config.exchangeRateAPI, {
                params: {
                    base: this.parent.config.defaultCurrency,
                    symbols: this.parent.config.supportedCurrencies.join(',')
                }
            });
            
            const rates = response.data.rates;
            const date = moment().format('YYYY-MM-DD');
            
            for (const [currency, rate] of Object.entries(rates)) {
                await this.parent.db.query(`
                    INSERT INTO currency_rates (
                        base_currency, target_currency, rate, rate_date, source
                    ) VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (base_currency, target_currency, rate_date)
                    DO UPDATE SET rate = $3
                `, [
                    this.parent.config.defaultCurrency,
                    currency,
                    rate,
                    date,
                    'exchange_rate_api'
                ]);
                
                // Update cache
                const cacheKey = `${this.parent.config.defaultCurrency}-${currency}-${date}`;
                this.ratesCache.set(cacheKey, rate);
            }
            
            console.log('Exchange rates updated successfully');
            
        } catch (error) {
            console.error('Failed to update exchange rates:', error);
        }
    }
    
    async getExchangeRate(baseCurrency, targetCurrency, date) {
        if (baseCurrency === targetCurrency) return 1;
        
        const rateDate = moment(date).format('YYYY-MM-DD');
        const cacheKey = `${baseCurrency}-${targetCurrency}-${rateDate}`;
        
        // Check cache
        if (this.ratesCache.has(cacheKey)) {
            return this.ratesCache.get(cacheKey);
        }
        
        // Query database
        const result = await this.parent.db.query(`
            SELECT rate FROM currency_rates
            WHERE base_currency = $1
                AND target_currency = $2
                AND rate_date <= $3
            ORDER BY rate_date DESC
            LIMIT 1
        `, [baseCurrency, targetCurrency, rateDate]);
        
        if (result.rows.length > 0) {
            const rate = parseFloat(result.rows[0].rate);
            this.ratesCache.set(cacheKey, rate);
            return rate;
        }
        
        // If no rate found, try reverse
        const reverseResult = await this.parent.db.query(`
            SELECT rate FROM currency_rates
            WHERE base_currency = $1
                AND target_currency = $2
                AND rate_date <= $3
            ORDER BY rate_date DESC
            LIMIT 1
        `, [targetCurrency, baseCurrency, rateDate]);
        
        if (reverseResult.rows.length > 0) {
            const rate = 1 / parseFloat(reverseResult.rows[0].rate);
            this.ratesCache.set(cacheKey, rate);
            return rate;
        }
        
        throw new Error(`Exchange rate not found for ${baseCurrency} to ${targetCurrency}`);
    }
    
    async convertAmount(amount, fromCurrency, toCurrency, date = new Date()) {
        const rate = await this.getExchangeRate(fromCurrency, toCurrency, date);
        return new BigNumber(amount).times(rate).toNumber();
    }
}

// Credit Manager
class CreditManager {
    constructor(parent) {
        this.parent = parent;
    }
    
    async checkCredit(customerId, requestedAmount) {
        // Get customer credit limit
        const customer = await this.parent.getCustomer(customerId);
        const creditLimit = customer.credit_limit || 0;
        
        if (creditLimit === 0) {
            return { approved: false, reason: 'No credit limit set' };
        }
        
        // Calculate current exposure
        const exposure = await this.calculateExposure(customerId);
        const available = creditLimit - exposure;
        
        if (requestedAmount > available) {
            return {
                approved: false,
                reason: 'Exceeds available credit',
                creditLimit,
                currentExposure: exposure,
                available,
                requested: requestedAmount
            };
        }
        
        // Check payment history
        const paymentHistory = await this.getPaymentHistory(customerId);
        
        if (paymentHistory.averageDaysLate > 30) {
            return {
                approved: false,
                reason: 'Poor payment history',
                averageDaysLate: paymentHistory.averageDaysLate
            };
        }
        
        return {
            approved: true,
            autoApprove: requestedAmount < creditLimit * 0.5, // Auto-approve if less than 50% of limit
            creditLimit,
            currentExposure: exposure,
            available,
            requested: requestedAmount
        };
    }
    
    async calculateExposure(customerId) {
        const result = await this.parent.db.query(`
            SELECT 
                COALESCE(SUM(balance_due), 0) as invoice_exposure,
                COALESCE(SUM(
                    CASE 
                        WHEN po.status = 'approved' 
                        THEN po.total_amount - COALESCE(used.amount, 0)
                        ELSE 0
                    END
                ), 0) as po_exposure
            FROM custom_invoices i
            FULL OUTER JOIN purchase_orders po ON po.customer_id = i.customer_id
            LEFT JOIN (
                SELECT po_id, SUM(total_amount) as amount
                FROM custom_invoices
                WHERE status != 'canceled'
                GROUP BY po_id
            ) used ON used.po_id = po.id
            WHERE (i.customer_id = $1 OR po.customer_id = $1)
                AND (i.balance_due > 0 OR po.status = 'approved')
        `, [customerId]);
        
        return parseFloat(result.rows[0].invoice_exposure) + 
               parseFloat(result.rows[0].po_exposure);
    }
    
    async getPaymentHistory(customerId) {
        const history = await this.parent.db.query(`
            SELECT 
                AVG(EXTRACT(EPOCH FROM (p.received_date - i.due_date))/86400) as avg_days_late,
                COUNT(CASE WHEN p.received_date > i.due_date THEN 1 END) as late_payments,
                COUNT(*) as total_payments
            FROM custom_invoices i
            JOIN payment_applications pa ON pa.invoice_id = i.id
            JOIN enterprise_payments p ON p.id = pa.payment_id
            WHERE i.customer_id = $1
                AND p.status = 'applied'
                AND i.due_date < CURRENT_DATE
        `, [customerId]);
        
        return {
            averageDaysLate: parseFloat(history.rows[0].avg_days_late || 0),
            latePayments: parseInt(history.rows[0].late_payments || 0),
            totalPayments: parseInt(history.rows[0].total_payments || 0)
        };
    }
}

// Dunning Manager
class DunningManager {
    constructor(parent) {
        this.parent = parent;
    }
    
    async processDunningCampaigns() {
        const campaigns = await this.parent.db.query(`
            SELECT * FROM dunning_campaigns
            WHERE status = 'active'
        `);
        
        for (const campaign of campaigns.rows) {
            await this.processCampaign(campaign);
        }
    }
    
    async processCampaign(campaign) {
        const rules = campaign.rules;
        
        // Get overdue invoices
        const overdueInvoices = await this.parent.db.query(`
            SELECT i.*, c.email, c.name, c.company_name
            FROM custom_invoices i
            JOIN customers c ON c.id = i.customer_id
            WHERE i.balance_due > 0
                AND i.due_date < CURRENT_DATE
                AND i.status NOT IN ('canceled', 'disputed')
            ORDER BY i.due_date
        `);
        
        for (const invoice of overdueInvoices.rows) {
            const daysOverdue = moment().diff(moment(invoice.due_date), 'days');
            
            // Find applicable rule
            const applicableRule = rules.steps.find(step => 
                daysOverdue >= step.daysOverdue && 
                daysOverdue < (step.daysOverdue + step.gracePeriod)
            );
            
            if (applicableRule) {
                await this.executeDunningStep(invoice, campaign, applicableRule);
            }
        }
    }
    
    async executeDunningStep(invoice, campaign, step) {
        // Check if already processed
        const existing = await this.parent.db.query(`
            SELECT * FROM dunning_history
            WHERE invoice_id = $1
                AND campaign_id = $2
                AND step_number = $3
                AND sent_at > CURRENT_DATE - INTERVAL '7 days'
        `, [invoice.id, campaign.id, step.stepNumber]);
        
        if (existing.rows.length > 0) return;
        
        try {
            switch (step.action) {
                case 'email':
                    await this.sendDunningEmail(invoice, step);
                    break;
                case 'phone':
                    await this.scheduleDunningCall(invoice, step);
                    break;
                case 'letter':
                    await this.generateDunningLetter(invoice, step);
                    break;
                case 'suspend':
                    await this.suspendAccount(invoice.customer_id);
                    break;
            }
            
            // Record action
            await this.parent.db.query(`
                INSERT INTO dunning_history (
                    invoice_id, campaign_id, step_number,
                    action_type, success
                ) VALUES ($1, $2, $3, $4, $5)
            `, [
                invoice.id,
                campaign.id,
                step.stepNumber,
                step.action,
                true
            ]);
            
        } catch (error) {
            console.error('Dunning step failed:', error);
            
            await this.parent.db.query(`
                INSERT INTO dunning_history (
                    invoice_id, campaign_id, step_number,
                    action_type, success, response
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                invoice.id,
                campaign.id,
                step.stepNumber,
                step.action,
                false,
                error.message
            ]);
        }
    }
}

// Enterprise Payment Processor
class EnterprisePaymentProcessor {
    constructor(parent) {
        this.parent = parent;
    }
    
    async processACHPayment(achData) {
        // Validate ACH details
        const validation = this.validateACH(achData);
        if (!validation.valid) {
            throw new Error(`Invalid ACH details: ${validation.reason}`);
        }
        
        // Create payment record
        const payment = await this.parent.applyPayment({
            customerId: achData.customerId,
            paymentMethod: 'ach',
            amount: achData.amount,
            currency: 'USD', // ACH is USD only
            referenceNumber: achData.traceNumber,
            metadata: {
                routingNumber: achData.routingNumber,
                accountNumber: this.maskAccountNumber(achData.accountNumber),
                accountType: achData.accountType
            }
        });
        
        return payment;
    }
    
    validateACH(achData) {
        // Validate routing number (9 digits)
        if (!/^\d{9}$/.test(achData.routingNumber)) {
            return { valid: false, reason: 'Invalid routing number' };
        }
        
        // Validate account number
        if (!achData.accountNumber || achData.accountNumber.length < 4) {
            return { valid: false, reason: 'Invalid account number' };
        }
        
        return { valid: true };
    }
    
    maskAccountNumber(accountNumber) {
        const last4 = accountNumber.slice(-4);
        return `****${last4}`;
    }
}

// Invoice Template Manager
class InvoiceTemplateManager {
    constructor(parent) {
        this.parent = parent;
        this.templates = new Map();
    }
    
    async loadTemplates() {
        // Load default templates
        this.templates.set('standard', {
            name: 'Standard Invoice',
            sections: ['header', 'billTo', 'lineItems', 'totals', 'terms', 'footer']
        });
        
        this.templates.set('detailed', {
            name: 'Detailed Invoice',
            sections: ['header', 'billTo', 'shipTo', 'lineItems', 'itemDetails', 'totals', 'terms', 'notes', 'footer']
        });
        
        this.templates.set('minimal', {
            name: 'Minimal Invoice',
            sections: ['header', 'billTo', 'lineItems', 'totals']
        });
    }
    
    getTemplate(templateName) {
        return this.templates.get(templateName) || this.templates.get('standard');
    }
}

module.exports = EnterpriseBillingSystem;