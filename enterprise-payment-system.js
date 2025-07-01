#!/usr/bin/env node

/**
 * ROOTUIP Enterprise Payment Processing System
 * Handles $500K annual contracts with ACH/Wire transfers
 * Supports multi-vessel licensing and enterprise billing
 */

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const docusign = require('docusign-esign');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

const app = express();
app.use(express.json());

// Enterprise Contract Configurations
const ENTERPRISE_PLANS = {
    SINGLE_VESSEL: {
        annual: 500000,      // $500K per vessel per year
        monthly: 45000,      // Monthly payment option
        setupFee: 50000      // One-time implementation fee
    },
    MULTI_VESSEL_DISCOUNTS: {
        5: 0.05,   // 5% discount for 5+ vessels
        10: 0.10,  // 10% discount for 10+ vessels
        25: 0.15,  // 15% discount for 25+ vessels
        50: 0.20   // 20% discount for 50+ vessels
    },
    MULTI_YEAR_DISCOUNTS: {
        1: 0,      // No discount for annual
        2: 0.05,   // 5% discount for 2-year commitment
        3: 0.10,   // 10% discount for 3-year commitment
        5: 0.15    // 15% discount for 5-year commitment
    }
};

// Payment Methods Configuration
const PAYMENT_METHODS = {
    ACH: {
        enabled: true,
        processingDays: 3,
        limits: {
            min: 10000,
            max: 10000000  // $10M max per transaction
        }
    },
    WIRE: {
        enabled: true,
        processingDays: 1,
        limits: {
            min: 50000,
            max: 50000000  // $50M max per transaction
        }
    },
    CREDIT_CARD: {
        enabled: true,
        processingDays: 0,
        limits: {
            min: 1000,
            max: 1000000   // $1M max for credit cards
        }
    }
};

// Database schemas (simplified for demo)
const contracts = new Map();
const invoices = new Map();
const payments = new Map();
const subscriptions = new Map();
const vesselUsage = new Map();

// Initialize Stripe Connect for enterprise payments
async function initializeStripeConnect() {
    try {
        // Create connected account for enterprise payments
        const account = await stripe.accounts.create({
            type: 'custom',
            country: 'US',
            email: 'enterprise@rootuip.com',
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
                us_bank_account_ach_payments: { requested: true }
            },
            business_type: 'company',
            company: {
                name: 'ROOTUIP Enterprise',
                tax_id: process.env.COMPANY_TAX_ID
            }
        });
        
        console.log('✅ Stripe Connect account created:', account.id);
        return account;
    } catch (error) {
        console.error('❌ Stripe Connect initialization error:', error);
        throw error;
    }
}

// Create ACH payment intent for large transactions
async function createACHPayment(customerId, amount, contractId) {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount * 100, // Convert to cents
            currency: 'usd',
            customer: customerId,
            payment_method_types: ['us_bank_account'],
            payment_method_options: {
                us_bank_account: {
                    financial_connections: {
                        permissions: ['payment_method', 'balances']
                    }
                }
            },
            metadata: {
                contract_id: contractId,
                type: 'enterprise_license',
                payment_method: 'ACH'
            }
        });
        
        return paymentIntent;
    } catch (error) {
        console.error('ACH payment error:', error);
        throw error;
    }
}

// Create wire transfer instructions
async function createWireTransferInstructions(contractId, amount) {
    const wireInstructions = {
        id: `wire_${uuidv4()}`,
        contractId,
        amount,
        status: 'pending',
        instructions: {
            beneficiaryName: 'ROOTUIP Inc.',
            beneficiaryAddress: '123 Enterprise Ave, San Francisco, CA 94105',
            bankName: 'Bank of America',
            bankAddress: '555 California St, San Francisco, CA 94104',
            accountNumber: 'XXXX-XXXX-1234',
            routingNumber: '121000358',
            swiftCode: 'BOFAUS3N',
            reference: `ROOTUIP-${contractId}`,
            amount: `USD ${amount.toLocaleString()}`
        },
        createdAt: new Date(),
        expiresAt: moment().add(30, 'days').toDate()
    };
    
    payments.set(wireInstructions.id, wireInstructions);
    return wireInstructions;
}

// DocuSign contract generation
async function generateContract(customerData, contractTerms) {
    const contractId = `CTR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize DocuSign API
    const apiClient = new docusign.ApiClient();
    apiClient.setBasePath(process.env.DOCUSIGN_BASE_PATH);
    apiClient.addDefaultHeader('Authorization', 'Bearer ' + process.env.DOCUSIGN_ACCESS_TOKEN);
    
    // Calculate pricing
    const vesselCount = contractTerms.vessels;
    const years = contractTerms.commitmentYears;
    const basePrice = ENTERPRISE_PLANS.SINGLE_VESSEL.annual * vesselCount;
    
    // Apply discounts
    let vesselDiscount = 0;
    for (const [threshold, discount] of Object.entries(ENTERPRISE_PLANS.MULTI_VESSEL_DISCOUNTS)) {
        if (vesselCount >= threshold) vesselDiscount = discount;
    }
    
    const yearDiscount = ENTERPRISE_PLANS.MULTI_YEAR_DISCOUNTS[years] || 0;
    const totalDiscount = vesselDiscount + yearDiscount;
    const finalPrice = basePrice * (1 - totalDiscount);
    const totalContractValue = finalPrice * years;
    
    // Create contract document
    const envelopeDefinition = new docusign.EnvelopeDefinition();
    envelopeDefinition.emailSubject = `ROOTUIP Enterprise License Agreement - ${customerData.company}`;
    
    // Contract template with merge fields
    const doc = new docusign.Document();
    doc.documentBase64 = Buffer.from(generateContractPDF(customerData, contractTerms, {
        contractId,
        basePrice,
        vesselDiscount,
        yearDiscount,
        finalPrice,
        totalContractValue,
        startDate: contractTerms.startDate,
        endDate: moment(contractTerms.startDate).add(years, 'years').format('YYYY-MM-DD')
    })).toString('base64');
    doc.name = 'Enterprise License Agreement';
    doc.fileExtension = 'pdf';
    doc.documentId = '1';
    
    envelopeDefinition.documents = [doc];
    
    // Add signers
    const signer = new docusign.Signer();
    signer.email = customerData.signerEmail;
    signer.name = customerData.signerName;
    signer.recipientId = '1';
    
    // Add signature tabs
    const signHere = new docusign.SignHere();
    signHere.documentId = '1';
    signHere.pageNumber = '5';
    signHere.xPosition = '100';
    signHere.yPosition = '500';
    
    const dateSigned = new docusign.DateSigned();
    dateSigned.documentId = '1';
    dateSigned.pageNumber = '5';
    dateSigned.xPosition = '300';
    dateSigned.yPosition = '500';
    
    signer.tabs = new docusign.Tabs();
    signer.tabs.signHereTabs = [signHere];
    signer.tabs.dateSignedTabs = [dateSigned];
    
    const recipients = new docusign.Recipients();
    recipients.signers = [signer];
    envelopeDefinition.recipients = recipients;
    envelopeDefinition.status = 'sent';
    
    // Send for signature
    const envelopesApi = new docusign.EnvelopesApi(apiClient);
    const results = await envelopesApi.createEnvelope(process.env.DOCUSIGN_ACCOUNT_ID, {
        envelopeDefinition
    });
    
    // Store contract
    const contract = {
        id: contractId,
        envelopeId: results.envelopeId,
        customer: customerData,
        terms: contractTerms,
        pricing: {
            basePrice,
            vesselDiscount,
            yearDiscount,
            finalPrice,
            totalContractValue
        },
        status: 'pending_signature',
        createdAt: new Date(),
        documents: {
            contract: `contracts/${contractId}.pdf`,
            signedContract: null
        }
    };
    
    contracts.set(contractId, contract);
    return contract;
}

// Generate contract PDF
function generateContractPDF(customer, terms, pricing) {
    const doc = new PDFDocument();
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    
    // Header
    doc.fontSize(24).text('ROOTUIP ENTERPRISE LICENSE AGREEMENT', 50, 50);
    doc.fontSize(12).text(`Contract ID: ${pricing.contractId}`, 50, 100);
    doc.text(`Date: ${moment().format('MMMM DD, YYYY')}`, 50, 120);
    
    // Customer Information
    doc.fontSize(16).text('CUSTOMER INFORMATION', 50, 160);
    doc.fontSize(12);
    doc.text(`Company: ${customer.company}`, 50, 190);
    doc.text(`Address: ${customer.address}`, 50, 210);
    doc.text(`Contact: ${customer.signerName}`, 50, 230);
    doc.text(`Email: ${customer.signerEmail}`, 50, 250);
    
    // Contract Terms
    doc.fontSize(16).text('CONTRACT TERMS', 50, 290);
    doc.fontSize(12);
    doc.text(`Number of Vessels: ${terms.vessels}`, 50, 320);
    doc.text(`Contract Duration: ${terms.commitmentYears} year(s)`, 50, 340);
    doc.text(`Start Date: ${terms.startDate}`, 50, 360);
    doc.text(`End Date: ${pricing.endDate}`, 50, 380);
    
    // Pricing Details
    doc.fontSize(16).text('PRICING DETAILS', 50, 420);
    doc.fontSize(12);
    doc.text(`Base Price (per vessel/year): $${ENTERPRISE_PLANS.SINGLE_VESSEL.annual.toLocaleString()}`, 50, 450);
    doc.text(`Total Vessels: ${terms.vessels}`, 50, 470);
    doc.text(`Subtotal: $${pricing.basePrice.toLocaleString()}`, 50, 490);
    
    if (pricing.vesselDiscount > 0) {
        doc.text(`Multi-Vessel Discount: -${(pricing.vesselDiscount * 100).toFixed(0)}%`, 50, 510);
    }
    if (pricing.yearDiscount > 0) {
        doc.text(`Multi-Year Discount: -${(pricing.yearDiscount * 100).toFixed(0)}%`, 50, 530);
    }
    
    doc.fontSize(14).text(`Annual License Fee: $${pricing.finalPrice.toLocaleString()}`, 50, 560);
    doc.fontSize(16).text(`TOTAL CONTRACT VALUE: $${pricing.totalContractValue.toLocaleString()}`, 50, 590);
    
    // Payment Terms
    doc.addPage();
    doc.fontSize(16).text('PAYMENT TERMS', 50, 50);
    doc.fontSize(12);
    doc.text('• Payment Method: ACH Transfer or Wire Transfer', 50, 80);
    doc.text('• Payment Terms: NET-30', 50, 100);
    doc.text('• Annual payment due on contract anniversary', 50, 120);
    doc.text('• Auto-renewal unless cancelled 90 days prior to term end', 50, 140);
    
    // Service Level Agreement
    doc.fontSize(16).text('SERVICE LEVEL AGREEMENT', 50, 180);
    doc.fontSize(12);
    doc.text('• 99.9% Platform Uptime Guarantee', 50, 210);
    doc.text('• 24/7 Enterprise Support', 50, 230);
    doc.text('• Dedicated Customer Success Manager', 50, 250);
    doc.text('• Quarterly Business Reviews', 50, 270);
    doc.text('• Custom API Rate Limits', 50, 290);
    doc.text('• Priority Feature Requests', 50, 310);
    
    // Legal Terms (abbreviated for demo)
    doc.addPage();
    doc.fontSize(16).text('TERMS AND CONDITIONS', 50, 50);
    doc.fontSize(10);
    doc.text('1. LICENSE GRANT: ROOTUIP grants Customer a non-exclusive, non-transferable license...', 50, 80, {
        width: 500,
        align: 'justify'
    });
    
    // Signature Page
    doc.addPage();
    doc.fontSize(16).text('SIGNATURES', 50, 50);
    doc.fontSize(12);
    doc.text('CUSTOMER:', 50, 100);
    doc.text('_______________________________', 50, 150);
    doc.text('Signature', 50, 170);
    doc.text('_______________________________', 300, 150);
    doc.text('Date', 300, 170);
    
    doc.text('ROOTUIP INC:', 50, 250);
    doc.text('_______________________________', 50, 300);
    doc.text('Authorized Representative', 50, 320);
    doc.text('_______________________________', 300, 300);
    doc.text('Date', 300, 320);
    
    doc.end();
    return Buffer.concat(chunks);
}

// Subscription Management
async function createSubscription(contractId) {
    const contract = contracts.get(contractId);
    if (!contract) throw new Error('Contract not found');
    
    const subscription = {
        id: `sub_${uuidv4()}`,
        contractId,
        customerId: contract.customer.id,
        status: 'active',
        currentPeriod: {
            start: moment(contract.terms.startDate),
            end: moment(contract.terms.startDate).add(1, 'year')
        },
        vessels: contract.terms.vessels,
        pricing: contract.pricing,
        autoRenew: true,
        createdAt: new Date(),
        billingSchedule: [],
        usage: {
            vessels: new Map(),
            apiCalls: 0,
            storageGB: 0
        }
    };
    
    // Generate billing schedule
    for (let i = 0; i < contract.terms.commitmentYears; i++) {
        subscription.billingSchedule.push({
            periodStart: moment(contract.terms.startDate).add(i, 'years').toDate(),
            periodEnd: moment(contract.terms.startDate).add(i + 1, 'years').toDate(),
            amount: contract.pricing.finalPrice,
            status: i === 0 ? 'pending' : 'scheduled',
            invoiceId: null
        });
    }
    
    subscriptions.set(subscription.id, subscription);
    return subscription;
}

// Vessel Usage Tracking
async function trackVesselUsage(subscriptionId, vesselId, usage) {
    const subscription = subscriptions.get(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');
    
    const vesselUsageData = {
        vesselId,
        timestamp: new Date(),
        metrics: {
            apiCalls: usage.apiCalls || 0,
            storageGB: usage.storageGB || 0,
            bandwidthGB: usage.bandwidthGB || 0,
            trackingEvents: usage.trackingEvents || 0,
            alerts: usage.alerts || 0
        }
    };
    
    // Store usage data
    if (!vesselUsage.has(subscriptionId)) {
        vesselUsage.set(subscriptionId, new Map());
    }
    
    const subUsage = vesselUsage.get(subscriptionId);
    if (!subUsage.has(vesselId)) {
        subUsage.set(vesselId, []);
    }
    
    subUsage.get(vesselId).push(vesselUsageData);
    
    // Update subscription usage
    subscription.usage.vessels.set(vesselId, {
        lastActive: new Date(),
        totalApiCalls: (subscription.usage.vessels.get(vesselId)?.totalApiCalls || 0) + usage.apiCalls,
        totalStorage: usage.storageGB
    });
    
    return vesselUsageData;
}

// Invoice Generation
async function generateInvoice(subscriptionId, billingPeriodIndex) {
    const subscription = subscriptions.get(subscriptionId);
    if (!subscription) throw new Error('Subscription not found');
    
    const contract = contracts.get(subscription.contractId);
    const billingPeriod = subscription.billingSchedule[billingPeriodIndex];
    
    const invoice = {
        id: `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        subscriptionId,
        contractId: subscription.contractId,
        customer: contract.customer,
        status: 'draft',
        billingPeriod: {
            start: billingPeriod.periodStart,
            end: billingPeriod.periodEnd
        },
        lineItems: [
            {
                description: `ROOTUIP Enterprise License - ${subscription.vessels} Vessels`,
                quantity: subscription.vessels,
                unitPrice: contract.pricing.finalPrice / subscription.vessels,
                amount: contract.pricing.finalPrice
            }
        ],
        subtotal: contract.pricing.finalPrice,
        tax: contract.pricing.finalPrice * 0.0875, // 8.75% tax
        total: contract.pricing.finalPrice * 1.0875,
        dueDate: moment(billingPeriod.periodStart).add(30, 'days').toDate(),
        terms: 'NET-30',
        createdAt: new Date(),
        sentAt: null,
        paidAt: null,
        paymentMethod: null,
        documents: {
            pdf: null,
            html: null
        }
    };
    
    // Add setup fee for first invoice
    if (billingPeriodIndex === 0 && contract.terms.includeSetupFee) {
        invoice.lineItems.push({
            description: 'One-time Implementation Fee',
            quantity: 1,
            unitPrice: ENTERPRISE_PLANS.SINGLE_VESSEL.setupFee,
            amount: ENTERPRISE_PLANS.SINGLE_VESSEL.setupFee
        });
        invoice.subtotal += ENTERPRISE_PLANS.SINGLE_VESSEL.setupFee;
        invoice.tax = invoice.subtotal * 0.0875;
        invoice.total = invoice.subtotal * 1.0875;
    }
    
    // Generate invoice PDF
    invoice.documents.pdf = await generateInvoicePDF(invoice);
    
    invoices.set(invoice.id, invoice);
    billingPeriod.invoiceId = invoice.id;
    
    return invoice;
}

// Generate Invoice PDF
async function generateInvoicePDF(invoice) {
    const doc = new PDFDocument();
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    
    // Header
    doc.fontSize(24).text('INVOICE', 50, 50);
    doc.fontSize(10).text('ROOTUIP Inc.', 450, 50);
    doc.text('123 Enterprise Ave', 450, 65);
    doc.text('San Francisco, CA 94105', 450, 80);
    doc.text('Tax ID: 12-3456789', 450, 95);
    
    // Invoice Details
    doc.fontSize(12);
    doc.text(`Invoice Number: ${invoice.id}`, 50, 130);
    doc.text(`Date: ${moment(invoice.createdAt).format('MMMM DD, YYYY')}`, 50, 150);
    doc.text(`Due Date: ${moment(invoice.dueDate).format('MMMM DD, YYYY')}`, 50, 170);
    doc.text(`Terms: ${invoice.terms}`, 50, 190);
    
    // Bill To
    doc.fontSize(14).text('BILL TO:', 50, 230);
    doc.fontSize(12);
    doc.text(invoice.customer.company, 50, 250);
    doc.text(invoice.customer.address, 50, 270);
    doc.text(`Attn: ${invoice.customer.billingContact}`, 50, 290);
    
    // Line Items
    doc.fontSize(14).text('SERVICES', 50, 340);
    
    // Table Header
    doc.fontSize(10);
    doc.text('Description', 50, 370);
    doc.text('Qty', 350, 370);
    doc.text('Unit Price', 400, 370);
    doc.text('Amount', 480, 370);
    
    // Table Lines
    let y = 390;
    invoice.lineItems.forEach(item => {
        doc.text(item.description, 50, y);
        doc.text(item.quantity.toString(), 350, y);
        doc.text(`$${item.unitPrice.toLocaleString()}`, 400, y);
        doc.text(`$${item.amount.toLocaleString()}`, 480, y);
        y += 20;
    });
    
    // Totals
    y += 20;
    doc.text('Subtotal:', 400, y);
    doc.text(`$${invoice.subtotal.toLocaleString()}`, 480, y);
    
    y += 20;
    doc.text('Tax (8.75%):', 400, y);
    doc.text(`$${invoice.tax.toLocaleString()}`, 480, y);
    
    y += 20;
    doc.fontSize(12);
    doc.text('TOTAL DUE:', 400, y);
    doc.text(`$${invoice.total.toLocaleString()}`, 480, y);
    
    // Payment Instructions
    doc.fontSize(14).text('PAYMENT INSTRUCTIONS', 50, y + 60);
    doc.fontSize(10);
    doc.text('ACH Transfer:', 50, y + 90);
    doc.text('Bank: Bank of America', 70, y + 110);
    doc.text('Routing: 121000358', 70, y + 125);
    doc.text('Account: XXXX-XXXX-1234', 70, y + 140);
    doc.text(`Reference: ${invoice.id}`, 70, y + 155);
    
    doc.text('Wire Transfer:', 250, y + 90);
    doc.text('Bank: Bank of America', 270, y + 110);
    doc.text('SWIFT: BOFAUS3N', 270, y + 125);
    doc.text('Account: XXXX-XXXX-1234', 270, y + 140);
    doc.text(`Reference: ${invoice.id}`, 270, y + 155);
    
    doc.end();
    
    const pdfBuffer = Buffer.concat(chunks);
    const filename = `invoice_${invoice.id}.pdf`;
    
    // In production, save to S3 or cloud storage
    return filename;
}

// Revenue Recognition
async function recognizeRevenue(invoiceId) {
    const invoice = invoices.get(invoiceId);
    if (!invoice || invoice.status !== 'paid') {
        throw new Error('Invoice not found or not paid');
    }
    
    const subscription = subscriptions.get(invoice.subscriptionId);
    const monthsInPeriod = moment(invoice.billingPeriod.end).diff(moment(invoice.billingPeriod.start), 'months');
    
    const revenueSchedule = [];
    const monthlyRevenue = invoice.subtotal / monthsInPeriod;
    
    for (let i = 0; i < monthsInPeriod; i++) {
        revenueSchedule.push({
            month: moment(invoice.billingPeriod.start).add(i, 'months').format('YYYY-MM'),
            amount: monthlyRevenue,
            recognized: false,
            recognizedAt: null
        });
    }
    
    invoice.revenueSchedule = revenueSchedule;
    
    // Schedule monthly revenue recognition
    cron.schedule('0 0 1 * *', async () => {
        const currentMonth = moment().format('YYYY-MM');
        
        for (const [id, inv] of invoices.entries()) {
            if (inv.revenueSchedule) {
                const monthSchedule = inv.revenueSchedule.find(r => 
                    r.month === currentMonth && !r.recognized
                );
                
                if (monthSchedule) {
                    monthSchedule.recognized = true;
                    monthSchedule.recognizedAt = new Date();
                    
                    console.log(`Revenue recognized: ${monthSchedule.amount} for ${currentMonth}`);
                }
            }
        }
    });
    
    return revenueSchedule;
}

// Payment Reminder System
async function sendPaymentReminder(invoiceId, reminderType = 'due_soon') {
    const invoice = invoices.get(invoiceId);
    if (!invoice || invoice.status === 'paid') return;
    
    const templates = {
        due_soon: {
            subject: `Payment Reminder: Invoice ${invoice.id} Due Soon`,
            daysBeforeDue: 7
        },
        due_today: {
            subject: `Payment Due Today: Invoice ${invoice.id}`,
            daysBeforeDue: 0
        },
        overdue: {
            subject: `Overdue Notice: Invoice ${invoice.id}`,
            daysBeforeDue: -1
        },
        final_notice: {
            subject: `Final Notice: Invoice ${invoice.id} - Service Suspension Warning`,
            daysBeforeDue: -30
        }
    };
    
    const template = templates[reminderType];
    const emailContent = `
Dear ${invoice.customer.company},

This is a reminder regarding invoice ${invoice.id} with a balance of $${invoice.total.toLocaleString()}.

Due Date: ${moment(invoice.dueDate).format('MMMM DD, YYYY')}
Amount Due: $${invoice.total.toLocaleString()}

Please remit payment via ACH or wire transfer using the instructions provided in the invoice.

If you have already sent payment, please disregard this notice.

For questions, contact:
Enterprise Billing: billing@rootuip.com
Phone: 1-800-ROOT-UIP

Best regards,
ROOTUIP Billing Department
    `;
    
    // Send email (simplified for demo)
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: 587,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
    
    await transporter.sendMail({
        from: 'billing@rootuip.com',
        to: invoice.customer.billingEmail,
        subject: template.subject,
        text: emailContent
    });
    
    // Log reminder
    if (!invoice.reminders) invoice.reminders = [];
    invoice.reminders.push({
        type: reminderType,
        sentAt: new Date()
    });
    
    return true;
}

// Schedule payment reminders
cron.schedule('0 9 * * *', async () => {
    const today = moment();
    
    for (const [id, invoice] of invoices.entries()) {
        if (invoice.status !== 'paid') {
            const daysUntilDue = moment(invoice.dueDate).diff(today, 'days');
            
            if (daysUntilDue === 7) {
                await sendPaymentReminder(id, 'due_soon');
            } else if (daysUntilDue === 0) {
                await sendPaymentReminder(id, 'due_today');
            } else if (daysUntilDue === -1) {
                await sendPaymentReminder(id, 'overdue');
            } else if (daysUntilDue === -30) {
                await sendPaymentReminder(id, 'final_notice');
            }
        }
    }
});

// Commission Tracking
async function calculateCommission(contractId) {
    const contract = contracts.get(contractId);
    if (!contract) throw new Error('Contract not found');
    
    const commissionRates = {
        base: 0.10,      // 10% base commission
        volume: {
            1000000: 0.02,   // +2% for deals over $1M
            5000000: 0.03,   // +3% for deals over $5M
            10000000: 0.05   // +5% for deals over $10M
        }
    };
    
    let rate = commissionRates.base;
    const contractValue = contract.pricing.totalContractValue;
    
    // Apply volume bonuses
    for (const [threshold, bonus] of Object.entries(commissionRates.volume)) {
        if (contractValue >= parseFloat(threshold)) {
            rate += bonus;
        }
    }
    
    const commission = {
        contractId,
        salesRep: contract.salesRep,
        contractValue,
        commissionRate: rate,
        commissionAmount: contractValue * rate,
        status: 'pending',
        paymentSchedule: []
    };
    
    // Split commission over contract term
    const years = contract.terms.commitmentYears;
    const annualCommission = commission.commissionAmount / years;
    
    for (let i = 0; i < years; i++) {
        commission.paymentSchedule.push({
            year: i + 1,
            amount: annualCommission,
            dueDate: moment(contract.terms.startDate).add(i, 'years').add(30, 'days').toDate(),
            paid: false,
            paidAt: null
        });
    }
    
    return commission;
}

// PCI Compliance
function initializePCICompliance() {
    // Implement PCI DSS requirements
    const pciConfig = {
        encryption: {
            algorithm: 'AES-256-GCM',
            keyRotation: 90 // days
        },
        tokenization: {
            provider: 'stripe',
            vault: 'pci-compliant-vault'
        },
        logging: {
            enabled: true,
            retention: 365, // days
            masking: ['pan', 'cvv', 'account_number']
        },
        accessControl: {
            mfa: true,
            roleBasedAccess: true,
            auditTrail: true
        },
        networkSecurity: {
            firewall: true,
            ids: true,
            waf: true
        }
    };
    
    // Never store sensitive payment data
    // Always use tokenization for payment methods
    // Implement secure key management
    // Regular security scans and audits
    
    return pciConfig;
}

// API Endpoints

// Create enterprise contract
app.post('/api/contracts/create', async (req, res) => {
    try {
        const { customer, terms } = req.body;
        const contract = await generateContract(customer, terms);
        res.json({ success: true, contract });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Process ACH payment
app.post('/api/payments/ach', async (req, res) => {
    try {
        const { customerId, amount, contractId } = req.body;
        const payment = await createACHPayment(customerId, amount, contractId);
        res.json({ success: true, payment });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get wire transfer instructions
app.post('/api/payments/wire', async (req, res) => {
    try {
        const { contractId, amount } = req.body;
        const instructions = await createWireTransferInstructions(contractId, amount);
        res.json({ success: true, instructions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create subscription
app.post('/api/subscriptions/create', async (req, res) => {
    try {
        const { contractId } = req.body;
        const subscription = await createSubscription(contractId);
        res.json({ success: true, subscription });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Track vessel usage
app.post('/api/usage/track', async (req, res) => {
    try {
        const { subscriptionId, vesselId, usage } = req.body;
        const tracked = await trackVesselUsage(subscriptionId, vesselId, usage);
        res.json({ success: true, usage: tracked });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate invoice
app.post('/api/invoices/generate', async (req, res) => {
    try {
        const { subscriptionId, billingPeriodIndex } = req.body;
        const invoice = await generateInvoice(subscriptionId, billingPeriodIndex);
        res.json({ success: true, invoice });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get financial metrics
app.get('/api/metrics/financial', async (req, res) => {
    try {
        // Calculate MRR, ARR, and churn
        let mrr = 0;
        let activeSubscriptions = 0;
        let churnedSubscriptions = 0;
        
        for (const [id, sub] of subscriptions.entries()) {
            if (sub.status === 'active') {
                activeSubscriptions++;
                mrr += sub.pricing.finalPrice / 12;
            } else if (sub.status === 'churned') {
                churnedSubscriptions++;
            }
        }
        
        const arr = mrr * 12;
        const churnRate = activeSubscriptions > 0 ? 
            (churnedSubscriptions / (activeSubscriptions + churnedSubscriptions)) * 100 : 0;
        
        // Calculate collections and revenue
        let totalCollected = 0;
        let outstandingAmount = 0;
        
        for (const [id, invoice] of invoices.entries()) {
            if (invoice.status === 'paid') {
                totalCollected += invoice.total;
            } else if (invoice.status === 'sent' && moment(invoice.dueDate).isBefore(moment())) {
                outstandingAmount += invoice.total;
            }
        }
        
        res.json({
            metrics: {
                mrr: Math.round(mrr),
                arr: Math.round(arr),
                activeSubscriptions,
                churnRate: churnRate.toFixed(2),
                totalCollected: Math.round(totalCollected),
                outstandingAmount: Math.round(outstandingAmount),
                averageContractValue: activeSubscriptions > 0 ? 
                    Math.round(arr / activeSubscriptions) : 0
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize system
async function initialize() {
    console.log('🚀 Initializing ROOTUIP Enterprise Payment System...');
    
    // Initialize Stripe Connect
    if (process.env.STRIPE_SECRET_KEY) {
        await initializeStripeConnect();
    }
    
    // Initialize PCI compliance
    const pciConfig = initializePCICompliance();
    console.log('✅ PCI compliance configured');
    
    // Start server
    const PORT = process.env.PORT || 8090;
    app.listen(PORT, () => {
        console.log(`✅ Enterprise Payment System running on port ${PORT}`);
        console.log('📊 Financial endpoints available:');
        console.log('   POST /api/contracts/create');
        console.log('   POST /api/payments/ach');
        console.log('   POST /api/payments/wire');
        console.log('   POST /api/subscriptions/create');
        console.log('   POST /api/invoices/generate');
        console.log('   GET  /api/metrics/financial');
    });
}

// Export for testing
module.exports = {
    app,
    generateContract,
    createACHPayment,
    createSubscription,
    generateInvoice,
    calculateCommission,
    recognizeRevenue
};

// Run if main module
if (require.main === module) {
    initialize().catch(console.error);
}