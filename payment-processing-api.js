#!/usr/bin/env node

/**
 * ROOTUIP Payment Processing API
 * Handles refunds, credits, and receipt generation
 */

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Refund Management
async function processRefund(invoiceId, amount, reason) {
    try {
        const invoice = await getInvoice(invoiceId);
        if (!invoice) throw new Error('Invoice not found');
        
        if (invoice.status !== 'paid') {
            throw new Error('Cannot refund unpaid invoice');
        }
        
        const maxRefundAmount = invoice.total - (invoice.refundedAmount || 0);
        if (amount > maxRefundAmount) {
            throw new Error(`Maximum refundable amount is $${maxRefundAmount.toLocaleString()}`);
        }
        
        // Create refund in Stripe
        const refund = await stripe.refunds.create({
            payment_intent: invoice.paymentIntentId,
            amount: Math.round(amount * 100), // Convert to cents
            reason: reason || 'requested_by_customer',
            metadata: {
                invoice_id: invoiceId,
                contract_id: invoice.contractId
            }
        });
        
        // Record refund
        const refundRecord = {
            id: `ref_${uuidv4()}`,
            invoiceId,
            stripeRefundId: refund.id,
            amount,
            reason,
            status: refund.status,
            createdAt: new Date(),
            processedAt: refund.status === 'succeeded' ? new Date() : null,
            metadata: {
                processedBy: 'system',
                approvedBy: null,
                notes: null
            }
        };
        
        // Update invoice
        invoice.refundedAmount = (invoice.refundedAmount || 0) + amount;
        invoice.refunds = invoice.refunds || [];
        invoice.refunds.push(refundRecord);
        
        // Update revenue recognition
        await adjustRevenueRecognition(invoice, amount);
        
        // Send notification
        await sendRefundNotification(invoice, refundRecord);
        
        return refundRecord;
    } catch (error) {
        console.error('Refund processing error:', error);
        throw error;
    }
}

// Credit Management
async function issueCredit(customerId, amount, reason, expirationMonths = 12) {
    try {
        const credit = {
            id: `credit_${uuidv4()}`,
            customerId,
            amount,
            remainingAmount: amount,
            reason,
            status: 'active',
            createdAt: new Date(),
            expiresAt: moment().add(expirationMonths, 'months').toDate(),
            applications: [],
            metadata: {
                issuedBy: 'system',
                approvedBy: null,
                contractId: null
            }
        };
        
        // Create credit in Stripe
        await stripe.customers.createBalanceTransaction(customerId, {
            amount: -Math.round(amount * 100), // Negative for credit
            currency: 'usd',
            description: `Credit: ${reason}`,
            metadata: {
                credit_id: credit.id,
                expires_at: credit.expiresAt.toISOString()
            }
        });
        
        // Store credit record
        await saveCredit(credit);
        
        // Send notification
        await sendCreditNotification(customerId, credit);
        
        return credit;
    } catch (error) {
        console.error('Credit issuance error:', error);
        throw error;
    }
}

// Apply credit to invoice
async function applyCredit(creditId, invoiceId, amount) {
    try {
        const credit = await getCredit(creditId);
        const invoice = await getInvoice(invoiceId);
        
        if (!credit || credit.status !== 'active') {
            throw new Error('Credit not found or inactive');
        }
        
        if (amount > credit.remainingAmount) {
            throw new Error(`Insufficient credit balance. Available: $${credit.remainingAmount.toLocaleString()}`);
        }
        
        // Apply credit
        const application = {
            invoiceId,
            amount,
            appliedAt: new Date()
        };
        
        credit.remainingAmount -= amount;
        credit.applications.push(application);
        
        if (credit.remainingAmount === 0) {
            credit.status = 'fully_applied';
        }
        
        // Update invoice
        invoice.creditsApplied = (invoice.creditsApplied || 0) + amount;
        invoice.amountDue = invoice.total - invoice.creditsApplied - (invoice.paidAmount || 0);
        
        await updateCredit(credit);
        await updateInvoice(invoice);
        
        return { credit, invoice, application };
    } catch (error) {
        console.error('Credit application error:', error);
        throw error;
    }
}

// Receipt Generation
async function generateReceipt(paymentId) {
    try {
        const payment = await getPayment(paymentId);
        if (!payment) throw new Error('Payment not found');
        
        const invoice = await getInvoice(payment.invoiceId);
        const customer = await getCustomer(payment.customerId);
        
        const doc = new PDFDocument();
        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        
        // Header
        doc.fontSize(24).text('PAYMENT RECEIPT', 50, 50);
        doc.fontSize(10).text('ROOTUIP Inc.', 450, 50);
        doc.text('123 Enterprise Ave', 450, 65);
        doc.text('San Francisco, CA 94105', 450, 80);
        doc.text('Tax ID: 12-3456789', 450, 95);
        
        // Receipt Details
        doc.fontSize(12);
        doc.text(`Receipt Number: ${payment.receiptNumber}`, 50, 130);
        doc.text(`Payment Date: ${moment(payment.paidAt).format('MMMM DD, YYYY')}`, 50, 150);
        doc.text(`Payment Method: ${payment.paymentMethod}`, 50, 170);
        
        // Customer Info
        doc.fontSize(14).text('RECEIVED FROM:', 50, 210);
        doc.fontSize(12);
        doc.text(customer.company, 50, 230);
        doc.text(customer.address, 50, 250);
        
        // Payment Details
        doc.fontSize(14).text('PAYMENT DETAILS', 50, 300);
        
        // Table
        doc.fontSize(10);
        doc.text('Invoice Number', 50, 330);
        doc.text('Invoice Date', 200, 330);
        doc.text('Invoice Amount', 350, 330);
        doc.text('Payment Amount', 450, 330);
        
        doc.fontSize(12);
        doc.text(invoice.id, 50, 350);
        doc.text(moment(invoice.createdAt).format('MM/DD/YYYY'), 200, 350);
        doc.text(`$${invoice.total.toLocaleString()}`, 350, 350);
        doc.text(`$${payment.amount.toLocaleString()}`, 450, 350);
        
        // Total
        doc.fontSize(14);
        doc.text('TOTAL PAYMENT:', 350, 400);
        doc.text(`$${payment.amount.toLocaleString()}`, 450, 400);
        
        // Payment confirmation
        doc.fontSize(10);
        doc.text('This receipt confirms payment has been received and applied to your account.', 50, 450);
        
        if (payment.paymentMethod === 'wire') {
            doc.text(`Wire Reference: ${payment.wireReference}`, 50, 470);
        } else if (payment.paymentMethod === 'ach') {
            doc.text(`ACH Transaction ID: ${payment.achTransactionId}`, 50, 470);
        }
        
        // Footer
        doc.fontSize(8);
        doc.text('Thank you for your business!', 50, 550);
        doc.text('For questions about this receipt, contact billing@rootuip.com', 50, 565);
        
        doc.end();
        
        const pdfBuffer = Buffer.concat(chunks);
        const filename = `receipt_${payment.receiptNumber}.pdf`;
        
        // Save receipt
        payment.receipt = {
            filename,
            generatedAt: new Date(),
            url: `/receipts/${filename}`
        };
        
        await updatePayment(payment);
        
        // Send receipt via email
        await sendReceiptEmail(customer.billingEmail, payment, pdfBuffer);
        
        return { payment, receiptUrl: payment.receipt.url };
    } catch (error) {
        console.error('Receipt generation error:', error);
        throw error;
    }
}

// Tax Documentation
async function generateTaxDocument(customerId, year) {
    try {
        const customer = await getCustomer(customerId);
        const payments = await getPaymentsByCustomerAndYear(customerId, year);
        
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        
        const doc = new PDFDocument();
        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        
        // 1099-MISC Form simulation
        doc.fontSize(18).text('TAX DOCUMENT - 1099-MISC', 50, 50);
        doc.fontSize(10).text(`Tax Year ${year}`, 50, 80);
        
        // Payer Information
        doc.fontSize(12).text('PAYER INFORMATION', 50, 120);
        doc.fontSize(10);
        doc.text('ROOTUIP Inc.', 50, 140);
        doc.text('123 Enterprise Ave', 50, 155);
        doc.text('San Francisco, CA 94105', 50, 170);
        doc.text('Tax ID: 12-3456789', 50, 185);
        
        // Recipient Information
        doc.fontSize(12).text('RECIPIENT INFORMATION', 300, 120);
        doc.fontSize(10);
        doc.text(customer.company, 300, 140);
        doc.text(customer.address, 300, 155);
        doc.text(`Tax ID: ${customer.taxId || 'Not provided'}`, 300, 185);
        
        // Payment Summary
        doc.fontSize(14).text('PAYMENT SUMMARY', 50, 240);
        
        // Box 1 - Rents
        doc.rect(50, 270, 500, 40).stroke();
        doc.fontSize(10).text('1. Rents', 55, 275);
        doc.fontSize(14).text(`$${totalPaid.toLocaleString()}`, 55, 290);
        
        // Monthly breakdown
        doc.fontSize(12).text('MONTHLY BREAKDOWN', 50, 340);
        doc.fontSize(10);
        
        let y = 370;
        const monthlyTotals = {};
        
        payments.forEach(payment => {
            const month = moment(payment.paidAt).format('MMMM YYYY');
            monthlyTotals[month] = (monthlyTotals[month] || 0) + payment.amount;
        });
        
        Object.entries(monthlyTotals).forEach(([month, amount]) => {
            doc.text(month, 50, y);
            doc.text(`$${amount.toLocaleString()}`, 450, y);
            y += 20;
        });
        
        // Footer
        doc.fontSize(8);
        doc.text('This is an electronic document. No signature required.', 50, 650);
        doc.text('Keep this document for your tax records.', 50, 665);
        doc.text(`Generated on: ${moment().format('MMMM DD, YYYY')}`, 50, 680);
        
        doc.end();
        
        const pdfBuffer = Buffer.concat(chunks);
        const filename = `tax_document_${customerId}_${year}.pdf`;
        
        return {
            filename,
            year,
            totalPaid,
            documentType: '1099-MISC',
            generatedAt: new Date(),
            buffer: pdfBuffer
        };
    } catch (error) {
        console.error('Tax document generation error:', error);
        throw error;
    }
}

// Commission Calculation for Sales Team
async function calculateSalesCommission(contractId, salesRepId) {
    try {
        const contract = await getContract(contractId);
        const salesRep = await getSalesRep(salesRepId);
        
        // Commission structure
        const commissionRates = {
            base: 0.10, // 10% base commission
            tiers: [
                { min: 0, max: 1000000, rate: 0.10 },
                { min: 1000000, max: 5000000, rate: 0.12 },
                { min: 5000000, max: 10000000, rate: 0.15 },
                { min: 10000000, max: Infinity, rate: 0.18 }
            ],
            bonuses: {
                multiYear: 0.02, // +2% for multi-year deals
                expansion: 0.03, // +3% for expansion deals
                strategic: 0.05  // +5% for strategic accounts
            }
        };
        
        const contractValue = contract.pricing.totalContractValue;
        let commissionRate = commissionRates.base;
        
        // Apply tiered rates
        for (const tier of commissionRates.tiers) {
            if (contractValue >= tier.min && contractValue < tier.max) {
                commissionRate = tier.rate;
                break;
            }
        }
        
        // Apply bonuses
        if (contract.terms.commitmentYears > 1) {
            commissionRate += commissionRates.bonuses.multiYear;
        }
        
        if (contract.type === 'expansion') {
            commissionRate += commissionRates.bonuses.expansion;
        }
        
        if (contract.customer.tier === 'strategic') {
            commissionRate += commissionRates.bonuses.strategic;
        }
        
        const commissionAmount = contractValue * commissionRate;
        
        // Create commission record
        const commission = {
            id: `comm_${uuidv4()}`,
            contractId,
            salesRepId,
            contractValue,
            commissionRate,
            commissionAmount,
            status: 'pending',
            earnedDate: contract.signedAt,
            paymentSchedule: [],
            createdAt: new Date()
        };
        
        // Split commission over payment terms
        if (contract.paymentTerms === 'annual') {
            const years = contract.terms.commitmentYears;
            const annualCommission = commissionAmount / years;
            
            for (let i = 0; i < years; i++) {
                commission.paymentSchedule.push({
                    year: i + 1,
                    amount: annualCommission,
                    dueDate: moment(contract.startDate).add(i, 'years').add(30, 'days').toDate(),
                    status: 'scheduled',
                    paidAt: null
                });
            }
        } else {
            // Upfront commission for prepaid deals
            commission.paymentSchedule.push({
                year: 1,
                amount: commissionAmount,
                dueDate: moment(contract.signedAt).add(30, 'days').toDate(),
                status: 'scheduled',
                paidAt: null
            });
        }
        
        await saveCommission(commission);
        
        // Update sales rep metrics
        salesRep.totalSales += contractValue;
        salesRep.totalCommissions += commissionAmount;
        salesRep.dealsCount += 1;
        await updateSalesRep(salesRep);
        
        return commission;
    } catch (error) {
        console.error('Commission calculation error:', error);
        throw error;
    }
}

// API Routes

// Process refund
router.post('/refunds/process', async (req, res) => {
    try {
        const { invoiceId, amount, reason } = req.body;
        const refund = await processRefund(invoiceId, amount, reason);
        res.json({ success: true, refund });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Issue credit
router.post('/credits/issue', async (req, res) => {
    try {
        const { customerId, amount, reason, expirationMonths } = req.body;
        const credit = await issueCredit(customerId, amount, reason, expirationMonths);
        res.json({ success: true, credit });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Apply credit
router.post('/credits/apply', async (req, res) => {
    try {
        const { creditId, invoiceId, amount } = req.body;
        const result = await applyCredit(creditId, invoiceId, amount);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate receipt
router.post('/receipts/generate', async (req, res) => {
    try {
        const { paymentId } = req.body;
        const result = await generateReceipt(paymentId);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate tax document
router.get('/tax-documents/:customerId/:year', async (req, res) => {
    try {
        const { customerId, year } = req.params;
        const document = await generateTaxDocument(customerId, parseInt(year));
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${document.filename}"`);
        res.send(document.buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Calculate commission
router.post('/commissions/calculate', async (req, res) => {
    try {
        const { contractId, salesRepId } = req.body;
        const commission = await calculateSalesCommission(contractId, salesRepId);
        res.json({ success: true, commission });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get customer credits
router.get('/credits/customer/:customerId', async (req, res) => {
    try {
        const { customerId } = req.params;
        const credits = await getCustomerCredits(customerId);
        const activeCredits = credits.filter(c => c.status === 'active' && c.remainingAmount > 0);
        
        res.json({
            credits: activeCredits,
            totalAvailable: activeCredits.reduce((sum, c) => sum + c.remainingAmount, 0)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get refund history
router.get('/refunds/invoice/:invoiceId', async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await getInvoice(invoiceId);
        
        res.json({
            refunds: invoice.refunds || [],
            totalRefunded: invoice.refundedAmount || 0,
            remainingBalance: invoice.total - (invoice.refundedAmount || 0)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper functions (simplified for demo)
async function getInvoice(invoiceId) {
    // In production, fetch from database
    return invoices.get(invoiceId);
}

async function getPayment(paymentId) {
    // In production, fetch from database
    return payments.get(paymentId);
}

async function getCustomer(customerId) {
    // In production, fetch from database
    return customers.get(customerId);
}

async function getContract(contractId) {
    // In production, fetch from database
    return contracts.get(contractId);
}

async function getCredit(creditId) {
    // In production, fetch from database
    return credits.get(creditId);
}

async function saveCredit(credit) {
    // In production, save to database
    credits.set(credit.id, credit);
}

async function updateCredit(credit) {
    // In production, update in database
    credits.set(credit.id, credit);
}

async function updateInvoice(invoice) {
    // In production, update in database
    invoices.set(invoice.id, invoice);
}

async function updatePayment(payment) {
    // In production, update in database
    payments.set(payment.id, payment);
}

async function adjustRevenueRecognition(invoice, refundAmount) {
    // Adjust revenue recognition schedule for refund
    if (invoice.revenueSchedule) {
        const monthlyAdjustment = refundAmount / invoice.revenueSchedule.length;
        invoice.revenueSchedule.forEach(schedule => {
            if (!schedule.recognized) {
                schedule.amount = Math.max(0, schedule.amount - monthlyAdjustment);
            }
        });
    }
}

async function sendRefundNotification(invoice, refund) {
    // Send email notification
    console.log(`Refund notification sent for ${refund.id}`);
}

async function sendCreditNotification(customerId, credit) {
    // Send email notification
    console.log(`Credit notification sent for ${credit.id}`);
}

async function sendReceiptEmail(email, payment, pdfBuffer) {
    // Send receipt via email
    console.log(`Receipt sent to ${email} for payment ${payment.id}`);
}

async function getPaymentsByCustomerAndYear(customerId, year) {
    // In production, query database
    const allPayments = Array.from(payments.values());
    return allPayments.filter(p => 
        p.customerId === customerId && 
        moment(p.paidAt).year() === year
    );
}

async function getCustomerCredits(customerId) {
    // In production, query database
    const allCredits = Array.from(credits.values());
    return allCredits.filter(c => c.customerId === customerId);
}

async function getSalesRep(salesRepId) {
    // In production, fetch from database
    return salesReps.get(salesRepId) || {
        id: salesRepId,
        totalSales: 0,
        totalCommissions: 0,
        dealsCount: 0
    };
}

async function updateSalesRep(salesRep) {
    // In production, update in database
    salesReps.set(salesRep.id, salesRep);
}

async function saveCommission(commission) {
    // In production, save to database
    commissions.set(commission.id, commission);
}

// In-memory storage for demo
const invoices = new Map();
const payments = new Map();
const customers = new Map();
const contracts = new Map();
const credits = new Map();
const salesReps = new Map();
const commissions = new Map();

module.exports = router;