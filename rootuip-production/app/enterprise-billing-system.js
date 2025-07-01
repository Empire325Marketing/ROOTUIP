/**
 * ROOTUIP Enterprise Billing Features
 * Custom invoicing, PO processing, net terms, and multi-currency support
 */

const EventEmitter = require('events');
const crypto = require('crypto');

// Enterprise Invoice Generator
class EnterpriseInvoiceGenerator extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = config;
        this.invoices = new Map();
        this.templates = new Map();
        this.customFields = new Map();
        
        this.setupInvoiceTemplates();
        this.setupCustomFields();
    }
    
    setupInvoiceTemplates() {
        // Standard enterprise template
        this.templates.set('enterprise_standard', {
            id: 'enterprise_standard',
            name: 'Enterprise Standard',
            layout: 'standard',
            branding: {
                logo: true,
                colors: {
                    primary: '#1a73e8',
                    secondary: '#34a853'
                },
                fonts: {
                    header: 'Arial Bold',
                    body: 'Arial'
                }
            },
            sections: [
                'header',
                'billing_details',
                'line_items',
                'summary',
                'payment_terms',
                'footer'
            ],
            customization: {
                allowCustomFields: true,
                allowAttachments: true,
                allowNotes: true
            }
        });
        
        // White-label template for enterprise customers
        this.templates.set('white_label', {
            id: 'white_label',
            name: 'White Label',
            layout: 'minimal',
            branding: {
                logo: false,
                colors: {
                    primary: '#000000',
                    secondary: '#666666'
                }
            },
            sections: [
                'billing_details',
                'line_items',
                'summary',
                'payment_terms'
            ],
            customization: {
                allowCustomBranding: true,
                allowCustomFields: true
            }
        });
        
        // Detailed services template
        this.templates.set('detailed_services', {
            id: 'detailed_services',
            name: 'Detailed Services',
            layout: 'detailed',
            sections: [
                'header',
                'project_details',
                'billing_details',
                'detailed_line_items',
                'time_tracking',
                'expenses',
                'summary',
                'payment_terms',
                'footer'
            ],
            customization: {
                allowTimeTracking: true,
                allowExpenses: true,
                allowMilestones: true
            }
        });
    }
    
    setupCustomFields() {
        // Common enterprise custom fields
        this.customFields.set('po_number', {
            id: 'po_number',
            name: 'Purchase Order Number',
            type: 'text',
            required: false,
            validation: '^[A-Z0-9-]+$'
        });
        
        this.customFields.set('cost_center', {
            id: 'cost_center',
            name: 'Cost Center',
            type: 'text',
            required: false
        });
        
        this.customFields.set('project_code', {
            id: 'project_code',
            name: 'Project Code',
            type: 'text',
            required: false
        });
        
        this.customFields.set('department', {
            id: 'department',
            name: 'Department',
            type: 'select',
            options: ['IT', 'Finance', 'Operations', 'Sales', 'Marketing'],
            required: false
        });
        
        this.customFields.set('budget_year', {
            id: 'budget_year',
            name: 'Budget Year',
            type: 'number',
            required: false,
            min: 2020,
            max: 2030
        });
    }
    
    // Generate custom invoice for enterprise customer
    async generateCustomInvoice(invoiceData) {
        const invoice = {
            id: this.generateInvoiceId(),
            number: invoiceData.number || this.generateInvoiceNumber(),
            customerId: invoiceData.customerId,
            customerData: invoiceData.customerData,
            templateId: invoiceData.templateId || 'enterprise_standard',
            
            // Invoice details
            issueDate: new Date(invoiceData.issueDate || Date.now()),
            dueDate: new Date(invoiceData.dueDate || this.calculateDueDate(invoiceData.paymentTerms)),
            currency: invoiceData.currency || 'USD',
            
            // Line items
            lineItems: invoiceData.lineItems.map(item => this.processLineItem(item)),
            
            // Financial details
            subtotal: 0,
            discounts: invoiceData.discounts || [],
            taxes: invoiceData.taxes || [],
            total: 0,
            
            // Enterprise features
            paymentTerms: invoiceData.paymentTerms || 'Net 30',
            purchaseOrder: invoiceData.purchaseOrder,
            customFields: invoiceData.customFields || {},
            notes: invoiceData.notes,
            attachments: invoiceData.attachments || [],
            
            // Status tracking
            status: 'draft',
            sentDate: null,
            paidDate: null,
            
            // Approval workflow
            approvalRequired: invoiceData.approvalRequired || false,
            approvedBy: null,
            approvedDate: null,
            
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Calculate totals
        this.calculateInvoiceTotals(invoice);
        
        // Validate invoice
        await this.validateInvoice(invoice);
        
        // Store invoice
        this.invoices.set(invoice.id, invoice);
        
        this.emit('invoice_generated', {
            invoiceId: invoice.id,
            invoice
        });
        
        return invoice;
    }
    
    processLineItem(item) {
        return {
            id: this.generateLineItemId(),
            description: item.description,
            quantity: item.quantity || 1,
            unitPrice: item.unitPrice,
            lineTotal: (item.quantity || 1) * item.unitPrice,
            taxable: item.taxable !== false,
            category: item.category,
            periodStart: item.periodStart ? new Date(item.periodStart) : null,
            periodEnd: item.periodEnd ? new Date(item.periodEnd) : null,
            metadata: item.metadata || {}
        };
    }
    
    calculateInvoiceTotals(invoice) {
        // Calculate subtotal
        invoice.subtotal = invoice.lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
        
        // Apply discounts
        let discountAmount = 0;
        for (const discount of invoice.discounts) {
            if (discount.type === 'percentage') {
                discountAmount += (invoice.subtotal * discount.value) / 100;
            } else {
                discountAmount += discount.value;
            }
        }
        
        // Calculate taxes
        let taxAmount = 0;
        const taxableAmount = invoice.subtotal - discountAmount;
        
        for (const tax of invoice.taxes) {
            if (tax.type === 'percentage') {
                taxAmount += (taxableAmount * tax.rate) / 100;
            } else {
                taxAmount += tax.amount;
            }
        }
        
        // Calculate total
        invoice.total = invoice.subtotal - discountAmount + taxAmount;
        invoice.discountAmount = discountAmount;
        invoice.taxAmount = taxAmount;
    }
    
    async validateInvoice(invoice) {
        const errors = [];
        
        // Required fields validation
        if (!invoice.customerId) {
            errors.push('Customer ID is required');
        }
        
        if (!invoice.lineItems || invoice.lineItems.length === 0) {
            errors.push('At least one line item is required');
        }
        
        // Amount validation
        if (invoice.total <= 0) {
            errors.push('Invoice total must be greater than zero');
        }
        
        // Custom field validation
        for (const [fieldId, value] of Object.entries(invoice.customFields)) {
            const field = this.customFields.get(fieldId);
            if (field && field.required && !value) {
                errors.push(`${field.name} is required`);
            }
            
            if (field && field.validation && value) {
                const regex = new RegExp(field.validation);
                if (!regex.test(value)) {
                    errors.push(`${field.name} format is invalid`);
                }
            }
        }
        
        if (errors.length > 0) {
            throw new Error(`Invoice validation failed: ${errors.join(', ')}`);
        }
    }
    
    // Send invoice for approval
    async submitForApproval(invoiceId, approverEmail) {
        const invoice = this.invoices.get(invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }
        
        if (invoice.status !== 'draft') {
            throw new Error('Only draft invoices can be submitted for approval');
        }
        
        invoice.status = 'pending_approval';
        invoice.approvalSubmittedDate = new Date();
        invoice.approverEmail = approverEmail;
        
        this.emit('invoice_submitted_for_approval', {
            invoiceId,
            approverEmail,
            invoice
        });
        
        return invoice;
    }
    
    // Approve invoice
    async approveInvoice(invoiceId, approvedBy, notes = '') {
        const invoice = this.invoices.get(invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }
        
        if (invoice.status !== 'pending_approval') {
            throw new Error('Invoice is not pending approval');
        }
        
        invoice.status = 'approved';
        invoice.approvedBy = approvedBy;
        invoice.approvedDate = new Date();
        invoice.approvalNotes = notes;
        
        this.emit('invoice_approved', {
            invoiceId,
            approvedBy,
            invoice
        });
        
        return invoice;
    }
    
    // Generate invoice in multiple formats
    async generateInvoiceDocument(invoiceId, format = 'pdf') {
        const invoice = this.invoices.get(invoiceId);
        if (!invoice) {
            throw new Error('Invoice not found');
        }
        
        const template = this.templates.get(invoice.templateId);
        
        switch (format) {
            case 'pdf':
                return await this.generatePDF(invoice, template);
            case 'html':
                return await this.generateHTML(invoice, template);
            case 'excel':
                return await this.generateExcel(invoice, template);
            default:
                throw new Error(`Format ${format} not supported`);
        }
    }
    
    async generatePDF(invoice, template) {
        // PDF generation logic (would use a library like puppeteer or pdfkit)
        return {
            format: 'pdf',
            data: Buffer.from(`PDF content for invoice ${invoice.number}`),
            filename: `invoice_${invoice.number}.pdf`,
            size: 125000
        };
    }
    
    async generateHTML(invoice, template) {
        const html = this.buildInvoiceHTML(invoice, template);
        
        return {
            format: 'html',
            data: html,
            filename: `invoice_${invoice.number}.html`,
            size: html.length
        };
    }
    
    buildInvoiceHTML(invoice, template) {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Invoice ${invoice.number}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .company-info { font-size: 18px; font-weight: bold; }
        .invoice-info { text-align: right; }
        .customer-info { margin-bottom: 30px; }
        .line-items { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        .line-items th, .line-items td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        .line-items th { background-color: #f2f2f2; }
        .totals { margin-left: auto; width: 300px; }
        .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .total-row.final { font-weight: bold; border-top: 2px solid #000; }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-info">
            <div>ROOTUIP</div>
            <div>Container Tracking Platform</div>
        </div>
        <div class="invoice-info">
            <h2>INVOICE</h2>
            <div>Invoice #: ${invoice.number}</div>
            <div>Date: ${invoice.issueDate.toLocaleDateString()}</div>
            <div>Due: ${invoice.dueDate.toLocaleDateString()}</div>
        </div>
    </div>
    
    <div class="customer-info">
        <h3>Bill To:</h3>
        <div>${invoice.customerData.name}</div>
        <div>${invoice.customerData.address?.line1 || ''}</div>
        <div>${invoice.customerData.address?.city || ''}, ${invoice.customerData.address?.state || ''} ${invoice.customerData.address?.postal_code || ''}</div>
        ${invoice.purchaseOrder ? `<div><strong>PO Number:</strong> ${invoice.purchaseOrder}</div>` : ''}
    </div>
    
    <table class="line-items">
        <thead>
            <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            ${invoice.lineItems.map(item => `
                <tr>
                    <td>${item.description}</td>
                    <td>${item.quantity}</td>
                    <td>$${(item.unitPrice / 100).toFixed(2)}</td>
                    <td>$${(item.lineTotal / 100).toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div class="totals">
        <div class="total-row">
            <span>Subtotal:</span>
            <span>$${(invoice.subtotal / 100).toFixed(2)}</span>
        </div>
        ${invoice.discountAmount > 0 ? `
        <div class="total-row">
            <span>Discount:</span>
            <span>-$${(invoice.discountAmount / 100).toFixed(2)}</span>
        </div>
        ` : ''}
        ${invoice.taxAmount > 0 ? `
        <div class="total-row">
            <span>Tax:</span>
            <span>$${(invoice.taxAmount / 100).toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row final">
            <span>Total:</span>
            <span>$${(invoice.total / 100).toFixed(2)}</span>
        </div>
    </div>
    
    <div class="payment-terms">
        <h3>Payment Terms</h3>
        <p>${invoice.paymentTerms}</p>
        ${invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
    </div>
</body>
</html>`;
    }
    
    calculateDueDate(paymentTerms) {
        const dueDate = new Date();
        
        switch (paymentTerms) {
            case 'Net 15':
                dueDate.setDate(dueDate.getDate() + 15);
                break;
            case 'Net 30':
                dueDate.setDate(dueDate.getDate() + 30);
                break;
            case 'Net 60':
                dueDate.setDate(dueDate.getDate() + 60);
                break;
            case 'Net 90':
                dueDate.setDate(dueDate.getDate() + 90);
                break;
            case 'Due on Receipt':
                // Due immediately
                break;
            default:
                dueDate.setDate(dueDate.getDate() + 30); // Default to Net 30
        }
        
        return dueDate;
    }
    
    generateInvoiceId() {
        return `inv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    generateInvoiceNumber() {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `INV-${year}${month}-${random}`;
    }
    
    generateLineItemId() {
        return `li_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    }
}

// Purchase Order Processing System
class PurchaseOrderProcessor extends EventEmitter {
    constructor() {
        super();
        this.purchaseOrders = new Map();
        this.poWorkflows = new Map();
        this.approvalChains = new Map();
        
        this.setupWorkflows();
    }
    
    setupWorkflows() {
        // Standard PO workflow
        this.poWorkflows.set('standard', {
            id: 'standard',
            name: 'Standard PO Workflow',
            steps: [
                { step: 'received', name: 'PO Received', autoAdvance: true },
                { step: 'validated', name: 'PO Validated', autoAdvance: false },
                { step: 'approved', name: 'PO Approved', autoAdvance: false },
                { step: 'fulfilled', name: 'Services Delivered', autoAdvance: false },
                { step: 'invoiced', name: 'Invoice Sent', autoAdvance: true },
                { step: 'completed', name: 'Payment Received', autoAdvance: true }
            ]
        });
        
        // Enterprise PO workflow with multiple approvals
        this.poWorkflows.set('enterprise', {
            id: 'enterprise',
            name: 'Enterprise PO Workflow',
            steps: [
                { step: 'received', name: 'PO Received', autoAdvance: true },
                { step: 'validated', name: 'PO Validated', autoAdvance: false },
                { step: 'legal_review', name: 'Legal Review', autoAdvance: false },
                { step: 'finance_approved', name: 'Finance Approved', autoAdvance: false },
                { step: 'exec_approved', name: 'Executive Approved', autoAdvance: false },
                { step: 'fulfilled', name: 'Services Delivered', autoAdvance: false },
                { step: 'invoiced', name: 'Invoice Sent', autoAdvance: true },
                { step: 'completed', name: 'Payment Received', autoAdvance: true }
            ]
        });
    }
    
    // Process incoming purchase order
    async processPurchaseOrder(poData) {
        const po = {
            id: this.generatePOId(),
            number: poData.number,
            customerId: poData.customerId,
            customerInfo: poData.customerInfo,
            
            // PO details
            issueDate: new Date(poData.issueDate),
            deliveryDate: poData.deliveryDate ? new Date(poData.deliveryDate) : null,
            expirationDate: poData.expirationDate ? new Date(poData.expirationDate) : null,
            
            // Financial details
            currency: poData.currency || 'USD',
            total: poData.total,
            
            // Line items
            lineItems: poData.lineItems,
            
            // Terms and conditions
            paymentTerms: poData.paymentTerms,
            deliveryTerms: poData.deliveryTerms,
            terms: poData.terms || [],
            
            // Workflow
            workflowId: poData.workflowId || 'standard',
            currentStep: 'received',
            history: [{
                step: 'received',
                timestamp: new Date(),
                user: 'system',
                notes: 'PO received and processed'
            }],
            
            // Status
            status: 'active',
            
            // Attachments
            attachments: poData.attachments || [],
            
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        // Validate PO
        await this.validatePurchaseOrder(po);
        
        // Store PO
        this.purchaseOrders.set(po.id, po);
        
        // Auto-advance if possible
        await this.advanceWorkflow(po.id);
        
        this.emit('purchase_order_received', {
            poId: po.id,
            po
        });
        
        return po;
    }
    
    async validatePurchaseOrder(po) {
        const errors = [];
        
        // Required fields
        if (!po.number) {
            errors.push('PO number is required');
        }
        
        if (!po.customerId) {
            errors.push('Customer ID is required');
        }
        
        if (!po.lineItems || po.lineItems.length === 0) {
            errors.push('At least one line item is required');
        }
        
        if (!po.total || po.total <= 0) {
            errors.push('PO total must be greater than zero');
        }
        
        // Check for duplicate PO number
        const existingPO = Array.from(this.purchaseOrders.values())
            .find(existingPO => existingPO.number === po.number && existingPO.customerId === po.customerId);
        
        if (existingPO) {
            errors.push(`PO number ${po.number} already exists for this customer`);
        }
        
        // Validate expiration date
        if (po.expirationDate && po.expirationDate < new Date()) {
            errors.push('PO has expired');
        }
        
        if (errors.length > 0) {
            throw new Error(`PO validation failed: ${errors.join(', ')}`);
        }
    }
    
    // Advance PO through workflow
    async advanceWorkflow(poId, user = 'system', notes = '') {
        const po = this.purchaseOrders.get(poId);
        if (!po) {
            throw new Error('Purchase order not found');
        }
        
        const workflow = this.poWorkflows.get(po.workflowId);
        if (!workflow) {
            throw new Error('Workflow not found');
        }
        
        const currentStepIndex = workflow.steps.findIndex(step => step.step === po.currentStep);
        if (currentStepIndex === -1) {
            throw new Error('Current step not found in workflow');
        }
        
        const currentStep = workflow.steps[currentStepIndex];
        const nextStepIndex = currentStepIndex + 1;
        
        // Check if we can advance
        if (nextStepIndex >= workflow.steps.length) {
            return po; // Already at final step
        }
        
        const nextStep = workflow.steps[nextStepIndex];
        
        // Update PO
        po.currentStep = nextStep.step;
        po.updatedAt = new Date();
        
        // Add to history
        po.history.push({
            step: nextStep.step,
            timestamp: new Date(),
            user,
            notes
        });
        
        this.emit('po_workflow_advanced', {
            poId,
            fromStep: currentStep.step,
            toStep: nextStep.step,
            user,
            po
        });
        
        // Auto-advance if configured
        if (nextStep.autoAdvance) {
            await this.advanceWorkflow(poId, 'system', 'Auto-advanced');
        }
        
        return po;
    }
    
    // Approve PO step
    async approvePOStep(poId, stepName, approver, notes = '') {
        const po = this.purchaseOrders.get(poId);
        if (!po) {
            throw new Error('Purchase order not found');
        }
        
        if (po.currentStep !== stepName) {
            throw new Error(`PO is not currently at step: ${stepName}`);
        }
        
        // Add approval to history
        po.history.push({
            step: stepName,
            action: 'approved',
            timestamp: new Date(),
            user: approver,
            notes
        });
        
        // Advance workflow
        await this.advanceWorkflow(poId, approver, `Approved: ${notes}`);
        
        this.emit('po_step_approved', {
            poId,
            step: stepName,
            approver,
            po
        });
        
        return po;
    }
    
    // Generate invoice from PO
    async generateInvoiceFromPO(poId, invoiceGenerator) {
        const po = this.purchaseOrders.get(poId);
        if (!po) {
            throw new Error('Purchase order not found');
        }
        
        if (po.currentStep !== 'fulfilled') {
            throw new Error('PO must be fulfilled before invoicing');
        }
        
        const invoiceData = {
            customerId: po.customerId,
            customerData: po.customerInfo,
            lineItems: po.lineItems.map(item => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                category: item.category
            })),
            currency: po.currency,
            paymentTerms: po.paymentTerms,
            purchaseOrder: po.number,
            notes: `Invoice for PO ${po.number}`,
            customFields: {
                po_number: po.number,
                po_id: po.id
            }
        };
        
        const invoice = await invoiceGenerator.generateCustomInvoice(invoiceData);
        
        // Update PO status
        await this.advanceWorkflow(poId, 'system', `Invoice generated: ${invoice.number}`);
        
        this.emit('invoice_generated_from_po', {
            poId,
            invoiceId: invoice.id,
            po,
            invoice
        });
        
        return invoice;
    }
    
    generatePOId() {
        return `po_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
}

// Multi-Currency Support System
class MultiCurrencyManager {
    constructor(config = {}) {
        this.config = config;
        this.exchangeRates = new Map();
        this.supportedCurrencies = new Set([
            'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'SEK', 'NOK', 'DKK'
        ]);
        this.baseCurrency = config.baseCurrency || 'USD';
        
        this.setupExchangeRates();
    }
    
    setupExchangeRates() {
        // Mock exchange rates - in production, would fetch from API
        this.exchangeRates.set('USD_EUR', { rate: 0.85, lastUpdated: new Date() });
        this.exchangeRates.set('USD_GBP', { rate: 0.73, lastUpdated: new Date() });
        this.exchangeRates.set('USD_CAD', { rate: 1.35, lastUpdated: new Date() });
        this.exchangeRates.set('USD_AUD', { rate: 1.45, lastUpdated: new Date() });
        this.exchangeRates.set('USD_JPY', { rate: 110.50, lastUpdated: new Date() });
        this.exchangeRates.set('USD_CHF', { rate: 0.92, lastUpdated: new Date() });
        this.exchangeRates.set('USD_SEK', { rate: 8.75, lastUpdated: new Date() });
        this.exchangeRates.set('USD_NOK', { rate: 8.50, lastUpdated: new Date() });
        this.exchangeRates.set('USD_DKK', { rate: 6.25, lastUpdated: new Date() });
    }
    
    // Convert amount between currencies
    convertCurrency(amount, fromCurrency, toCurrency) {
        if (fromCurrency === toCurrency) {
            return amount;
        }
        
        if (!this.supportedCurrencies.has(fromCurrency) || !this.supportedCurrencies.has(toCurrency)) {
            throw new Error(`Unsupported currency: ${fromCurrency} or ${toCurrency}`);
        }
        
        // Convert to base currency first, then to target currency
        let usdAmount = amount;
        
        if (fromCurrency !== this.baseCurrency) {
            const rate = this.getExchangeRate(this.baseCurrency, fromCurrency);
            usdAmount = amount / rate;
        }
        
        if (toCurrency !== this.baseCurrency) {
            const rate = this.getExchangeRate(this.baseCurrency, toCurrency);
            return usdAmount * rate;
        }
        
        return usdAmount;
    }
    
    getExchangeRate(fromCurrency, toCurrency) {
        const rateKey = `${fromCurrency}_${toCurrency}`;
        const rate = this.exchangeRates.get(rateKey);
        
        if (!rate) {
            throw new Error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
        }
        
        return rate.rate;
    }
    
    // Format currency for display
    formatCurrency(amount, currency, locale = 'en-US') {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount / 100); // Assuming amounts are in cents
    }
    
    // Get currency symbol
    getCurrencySymbol(currency) {
        const symbols = {
            'USD': '$',
            'EUR': '€',
            'GBP': '£',
            'CAD': 'C$',
            'AUD': 'A$',
            'JPY': '¥',
            'CHF': 'Fr',
            'SEK': 'kr',
            'NOK': 'kr',
            'DKK': 'kr'
        };
        
        return symbols[currency] || currency;
    }
    
    // Update exchange rates (would be called periodically)
    async updateExchangeRates() {
        // In production, this would fetch from a currency API
        // For now, just emit an event
        this.emit('exchange_rates_updated', {
            baseCurrency: this.baseCurrency,
            rates: Object.fromEntries(this.exchangeRates),
            updatedAt: new Date()
        });
    }
}

// Financial Audit Trail System
class AuditTrailManager extends EventEmitter {
    constructor() {
        super();
        this.auditLogs = new Map();
        this.retentionPeriod = 7 * 365 * 24 * 60 * 60 * 1000; // 7 years in milliseconds
    }
    
    // Log financial transaction
    logTransaction(transaction) {
        const auditEntry = {
            id: this.generateAuditId(),
            timestamp: new Date(),
            transactionType: transaction.type,
            transactionId: transaction.id,
            userId: transaction.userId,
            userRole: transaction.userRole,
            action: transaction.action,
            entityType: transaction.entityType,
            entityId: transaction.entityId,
            changes: transaction.changes,
            previousValues: transaction.previousValues,
            newValues: transaction.newValues,
            amount: transaction.amount,
            currency: transaction.currency,
            ipAddress: transaction.ipAddress,
            userAgent: transaction.userAgent,
            sessionId: transaction.sessionId,
            metadata: transaction.metadata || {}
        };
        
        this.auditLogs.set(auditEntry.id, auditEntry);
        
        this.emit('audit_logged', auditEntry);
        
        return auditEntry.id;
    }
    
    // Search audit trail
    searchAuditTrail(criteria) {
        const results = [];
        
        for (const entry of this.auditLogs.values()) {
            if (this.matchesCriteria(entry, criteria)) {
                results.push(entry);
            }
        }
        
        return results.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    matchesCriteria(entry, criteria) {
        if (criteria.userId && entry.userId !== criteria.userId) return false;
        if (criteria.transactionType && entry.transactionType !== criteria.transactionType) return false;
        if (criteria.entityType && entry.entityType !== criteria.entityType) return false;
        if (criteria.entityId && entry.entityId !== criteria.entityId) return false;
        if (criteria.action && entry.action !== criteria.action) return false;
        
        if (criteria.startDate && entry.timestamp < new Date(criteria.startDate)) return false;
        if (criteria.endDate && entry.timestamp > new Date(criteria.endDate)) return false;
        
        if (criteria.amountMin && entry.amount < criteria.amountMin) return false;
        if (criteria.amountMax && entry.amount > criteria.amountMax) return false;
        
        return true;
    }
    
    // Generate compliance report
    generateComplianceReport(startDate, endDate) {
        const entries = this.searchAuditTrail({ startDate, endDate });
        
        const report = {
            period: { startDate, endDate },
            totalTransactions: entries.length,
            transactionTypes: {},
            userActivity: {},
            entityChanges: {},
            suspiciousActivity: [],
            generatedAt: new Date()
        };
        
        for (const entry of entries) {
            // Count by transaction type
            report.transactionTypes[entry.transactionType] = 
                (report.transactionTypes[entry.transactionType] || 0) + 1;
            
            // Count by user
            report.userActivity[entry.userId] = 
                (report.userActivity[entry.userId] || 0) + 1;
            
            // Count by entity type
            report.entityChanges[entry.entityType] = 
                (report.entityChanges[entry.entityType] || 0) + 1;
            
            // Detect suspicious activity
            if (this.isSuspiciousActivity(entry)) {
                report.suspiciousActivity.push(entry);
            }
        }
        
        return report;
    }
    
    isSuspiciousActivity(entry) {
        // Define suspicious activity patterns
        if (entry.amount > 1000000) return true; // Large transactions
        if (entry.action === 'delete' && entry.entityType === 'invoice') return true; // Invoice deletions
        if (entry.timestamp.getHours() < 6 || entry.timestamp.getHours() > 22) return true; // Off-hours activity
        
        return false;
    }
    
    generateAuditId() {
        return `audit_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    }
    
    // Cleanup old audit logs (run periodically)
    cleanupOldLogs() {
        const cutoffDate = new Date(Date.now() - this.retentionPeriod);
        const keysToDelete = [];
        
        for (const [id, entry] of this.auditLogs) {
            if (entry.timestamp < cutoffDate) {
                keysToDelete.push(id);
            }
        }
        
        keysToDelete.forEach(id => this.auditLogs.delete(id));
        
        if (keysToDelete.length > 0) {
            this.emit('audit_logs_cleaned', { deletedCount: keysToDelete.length });
        }
    }
}

module.exports = {
    EnterpriseInvoiceGenerator,
    PurchaseOrderProcessor,
    MultiCurrencyManager,
    AuditTrailManager
};