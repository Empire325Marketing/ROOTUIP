#!/usr/bin/env node

/**
 * ROOTUIP Financial Reporting System
 * Revenue recognition, ARR/MRR tracking, and comprehensive analytics
 */

const { Pool } = require('pg');
const { EventEmitter } = require('events');
const moment = require('moment');
const BigNumber = require('bignumber.js');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');

class FinancialReportingSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            databaseUrl: config.databaseUrl || process.env.DATABASE_URL,
            reportingInterval: config.reportingInterval || 'monthly',
            recognitionMethod: config.recognitionMethod || 'ratable', // ratable, upfront, milestone
            fiscalYearStart: config.fiscalYearStart || 'january',
            currency: config.currency || 'USD',
            ...config
        };
        
        // Database connection
        this.db = new Pool({
            connectionString: this.config.databaseUrl,
            max: 10
        });
        
        // Reporting components
        this.revenueRecognition = new RevenueRecognitionEngine(this);
        this.metricsCalculator = new MetricsCalculator(this);
        this.reportGenerator = new ReportGenerator(this);
        this.analyticsEngine = new AnalyticsEngine(this);
        this.commissionTracker = new CommissionTracker(this);
        this.forecastEngine = new ForecastEngine(this);
        
        // Email configuration
        this.mailer = nodemailer.createTransport({
            host: config.smtpHost || process.env.SMTP_HOST,
            port: config.smtpPort || 587,
            secure: false,
            auth: {
                user: config.smtpUser || process.env.SMTP_USER,
                pass: config.smtpPass || process.env.SMTP_PASS
            }
        });
        
        // Initialize system
        this.initialize();
    }
    
    // Initialize system
    async initialize() {
        console.log('Initializing Financial Reporting System');
        
        try {
            // Create database schema
            await this.createDatabaseSchema();
            
            // Schedule automated reports
            await this.scheduleAutomatedReports();
            
            // Initialize metrics tracking
            await this.initializeMetricsTracking();
            
            console.log('Financial Reporting System initialized');
            
        } catch (error) {
            console.error('Failed to initialize reporting system:', error);
            throw error;
        }
    }
    
    // Create database schema
    async createDatabaseSchema() {
        await this.db.query(`
            CREATE TABLE IF NOT EXISTS revenue_recognition (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                subscription_id UUID REFERENCES subscriptions(id),
                invoice_id UUID REFERENCES invoices(id),
                recognition_date DATE NOT NULL,
                amount DECIMAL(20,2) NOT NULL,
                recognized_amount DECIMAL(20,2) DEFAULT 0,
                remaining_amount DECIMAL(20,2) NOT NULL,
                recognition_method VARCHAR(50) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS financial_metrics (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                metric_date DATE NOT NULL,
                metric_type VARCHAR(50) NOT NULL, -- 'mrr', 'arr', 'ltv', 'cac', 'churn'
                value DECIMAL(20,2) NOT NULL,
                breakdown JSONB DEFAULT '{}',
                period_type VARCHAR(20) DEFAULT 'monthly',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS customer_metrics (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                customer_id UUID NOT NULL,
                metric_date DATE NOT NULL,
                mrr DECIMAL(20,2) DEFAULT 0,
                arr DECIMAL(20,2) DEFAULT 0,
                ltv DECIMAL(20,2) DEFAULT 0,
                total_revenue DECIMAL(20,2) DEFAULT 0,
                subscription_count INTEGER DEFAULT 0,
                churn_risk_score DECIMAL(5,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS cohort_analysis (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                cohort_month DATE NOT NULL,
                month_number INTEGER NOT NULL,
                customers_count INTEGER DEFAULT 0,
                revenue DECIMAL(20,2) DEFAULT 0,
                retention_rate DECIMAL(5,2) DEFAULT 0,
                revenue_retention_rate DECIMAL(5,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS sales_commissions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                sales_rep_id UUID NOT NULL,
                subscription_id UUID REFERENCES subscriptions(id),
                commission_date DATE NOT NULL,
                base_amount DECIMAL(20,2) NOT NULL,
                commission_rate DECIMAL(5,2) NOT NULL,
                commission_amount DECIMAL(20,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                paid_date DATE,
                payment_reference VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS financial_reports (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                report_type VARCHAR(100) NOT NULL,
                report_period VARCHAR(50) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                generated_by VARCHAR(255),
                file_url VARCHAR(500),
                data JSONB DEFAULT '{}',
                status VARCHAR(50) DEFAULT 'completed'
            );
            
            -- Indexes
            CREATE INDEX idx_revenue_recognition_date ON revenue_recognition(recognition_date);
            CREATE INDEX idx_revenue_recognition_subscription ON revenue_recognition(subscription_id);
            CREATE INDEX idx_financial_metrics_date ON financial_metrics(metric_date, metric_type);
            CREATE INDEX idx_customer_metrics_customer ON customer_metrics(customer_id, metric_date);
            CREATE INDEX idx_cohort_analysis_cohort ON cohort_analysis(cohort_month, month_number);
            CREATE INDEX idx_sales_commissions_rep ON sales_commissions(sales_rep_id, commission_date);
        `);
    }
    
    // Calculate MRR (Monthly Recurring Revenue)
    async calculateMRR(date = new Date()) {
        const startOfMonth = moment(date).startOf('month').toDate();
        const endOfMonth = moment(date).endOf('month').toDate();
        
        // Base MRR from active subscriptions
        const baseMRR = await this.db.query(`
            SELECT 
                SUM(
                    CASE 
                        WHEN s.plan_id = 'custom' THEN cs.monthly_value
                        ELSE pt.base_price * (
                            CASE 
                                WHEN s.billing_interval = 'year' THEN 1.0/12
                                WHEN s.billing_interval = 'quarter' THEN 1.0/3
                                ELSE 1
                            END
                        )
                    END
                ) as mrr
            FROM subscriptions s
            LEFT JOIN pricing_tiers pt ON s.plan_id = pt.id
            LEFT JOIN custom_subscriptions cs ON s.id = cs.subscription_id
            WHERE s.status IN ('active', 'trialing')
                AND s.current_period_start <= $1
                AND (s.current_period_end >= $2 OR s.cancel_at_period_end = false)
        `, [endOfMonth, startOfMonth]);
        
        // Add usage-based revenue
        const usageRevenue = await this.calculateUsageRevenue(startOfMonth, endOfMonth);
        
        const totalMRR = new BigNumber(baseMRR.rows[0].mrr || 0)
            .plus(usageRevenue)
            .toNumber();
        
        // Store metric
        await this.storeMetric('mrr', totalMRR, date, {
            subscription_mrr: baseMRR.rows[0].mrr || 0,
            usage_mrr: usageRevenue,
            breakdown: await this.getMRRBreakdown(date)
        });
        
        return totalMRR;
    }
    
    // Calculate ARR (Annual Recurring Revenue)
    async calculateARR(date = new Date()) {
        const mrr = await this.calculateMRR(date);
        const arr = mrr * 12;
        
        await this.storeMetric('arr', arr, date, {
            mrr_base: mrr,
            multiplier: 12
        });
        
        return arr;
    }
    
    // Calculate customer lifetime value
    async calculateCustomerLTV(customerId) {
        // Historical revenue
        const historicalRevenue = await this.db.query(`
            SELECT COALESCE(SUM(amount_paid), 0) as total_revenue
            FROM invoices
            WHERE subscription_id IN (
                SELECT id FROM subscriptions WHERE customer_id = $1
            )
            AND status = 'paid'
        `, [customerId]);
        
        // Average monthly revenue
        const monthlyRevenue = await this.db.query(`
            SELECT 
                COALESCE(AVG(monthly_revenue), 0) as avg_monthly_revenue,
                COUNT(DISTINCT month) as months_active
            FROM (
                SELECT 
                    DATE_TRUNC('month', paid_at) as month,
                    SUM(amount_paid) as monthly_revenue
                FROM invoices
                WHERE subscription_id IN (
                    SELECT id FROM subscriptions WHERE customer_id = $1
                )
                AND status = 'paid'
                GROUP BY DATE_TRUNC('month', paid_at)
            ) monthly_data
        `, [customerId]);
        
        // Churn probability
        const churnProbability = await this.analyticsEngine.predictChurnProbability(customerId);
        
        // Calculate LTV using formula: (Average Revenue per Period) / (Churn Rate)
        const avgMonthlyRevenue = parseFloat(monthlyRevenue.rows[0].avg_monthly_revenue);
        const estimatedLifetime = churnProbability > 0 ? 1 / churnProbability : 24; // Max 24 months
        
        const ltv = avgMonthlyRevenue * estimatedLifetime;
        
        // Store customer metric
        await this.db.query(`
            INSERT INTO customer_metrics (
                customer_id, metric_date, ltv, total_revenue
            ) VALUES ($1, CURRENT_DATE, $2, $3)
            ON CONFLICT (customer_id, metric_date) 
            DO UPDATE SET ltv = $2, total_revenue = $3
        `, [customerId, ltv, historicalRevenue.rows[0].total_revenue]);
        
        return {
            ltv,
            historicalRevenue: parseFloat(historicalRevenue.rows[0].total_revenue),
            avgMonthlyRevenue,
            estimatedLifetimeMonths: estimatedLifetime,
            churnProbability
        };
    }
    
    // Calculate churn metrics
    async calculateChurnMetrics(startDate, endDate) {
        // Customer churn
        const customerChurn = await this.db.query(`
            WITH period_customers AS (
                SELECT 
                    COUNT(DISTINCT customer_id) as start_customers
                FROM subscriptions
                WHERE created_at < $1
                    AND (canceled_at IS NULL OR canceled_at > $1)
            ),
            churned_customers AS (
                SELECT 
                    COUNT(DISTINCT customer_id) as churned_count
                FROM subscriptions
                WHERE canceled_at >= $1 AND canceled_at <= $2
            )
            SELECT 
                pc.start_customers,
                cc.churned_count,
                CASE 
                    WHEN pc.start_customers > 0 
                    THEN (cc.churned_count::DECIMAL / pc.start_customers) * 100
                    ELSE 0 
                END as churn_rate
            FROM period_customers pc, churned_customers cc
        `, [startDate, endDate]);
        
        // Revenue churn
        const revenueChurn = await this.db.query(`
            WITH period_revenue AS (
                SELECT 
                    SUM(mrr) as start_mrr
                FROM customer_metrics
                WHERE metric_date = DATE_TRUNC('month', $1::DATE)
            ),
            churned_revenue AS (
                SELECT 
                    SUM(cm.mrr) as churned_mrr
                FROM customer_metrics cm
                JOIN subscriptions s ON cm.customer_id = s.customer_id
                WHERE s.canceled_at >= $1 AND s.canceled_at <= $2
                    AND cm.metric_date = DATE_TRUNC('month', $1::DATE)
            )
            SELECT 
                pr.start_mrr,
                cr.churned_mrr,
                CASE 
                    WHEN pr.start_mrr > 0 
                    THEN (cr.churned_mrr::DECIMAL / pr.start_mrr) * 100
                    ELSE 0 
                END as revenue_churn_rate
            FROM period_revenue pr, churned_revenue cr
        `, [startDate, endDate]);
        
        return {
            customerChurn: {
                startCustomers: parseInt(customerChurn.rows[0].start_customers),
                churnedCustomers: parseInt(customerChurn.rows[0].churned_count),
                churnRate: parseFloat(customerChurn.rows[0].churn_rate)
            },
            revenueChurn: {
                startMRR: parseFloat(revenueChurn.rows[0].start_mrr || 0),
                churnedMRR: parseFloat(revenueChurn.rows[0].churned_mrr || 0),
                churnRate: parseFloat(revenueChurn.rows[0].revenue_churn_rate || 0)
            }
        };
    }
    
    // Generate monthly financial report
    async generateMonthlyReport(month = moment().subtract(1, 'month')) {
        const startDate = moment(month).startOf('month').toDate();
        const endDate = moment(month).endOf('month').toDate();
        
        console.log(`Generating monthly report for ${moment(month).format('MMMM YYYY')}`);
        
        // Gather all metrics
        const [
            revenue,
            recurringMetrics,
            churnMetrics,
            cohortAnalysis,
            customerMetrics,
            salesMetrics
        ] = await Promise.all([
            this.calculateMonthlyRevenue(startDate, endDate),
            this.calculateRecurringMetrics(startDate, endDate),
            this.calculateChurnMetrics(startDate, endDate),
            this.performCohortAnalysis(startDate),
            this.calculateCustomerMetrics(startDate, endDate),
            this.calculateSalesMetrics(startDate, endDate)
        ]);
        
        const reportData = {
            period: {
                month: moment(month).format('MMMM YYYY'),
                startDate,
                endDate
            },
            revenue,
            recurring: recurringMetrics,
            churn: churnMetrics,
            cohorts: cohortAnalysis,
            customers: customerMetrics,
            sales: salesMetrics,
            forecast: await this.forecastEngine.generateForecast(endDate)
        };
        
        // Generate report files
        const [pdfUrl, excelUrl] = await Promise.all([
            this.reportGenerator.generatePDFReport(reportData),
            this.reportGenerator.generateExcelReport(reportData)
        ]);
        
        // Store report record
        const report = await this.db.query(`
            INSERT INTO financial_reports (
                report_type, report_period, start_date, end_date,
                file_url, data
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [
            'monthly_financial',
            moment(month).format('YYYY-MM'),
            startDate,
            endDate,
            pdfUrl,
            JSON.stringify(reportData)
        ]);
        
        // Send report to stakeholders
        await this.distributeReport(report.rows[0]);
        
        return report.rows[0];
    }
    
    // Calculate monthly revenue with recognition
    async calculateMonthlyRevenue(startDate, endDate) {
        // Recognized revenue
        const recognized = await this.db.query(`
            SELECT 
                SUM(recognized_amount) as recognized_revenue,
                recognition_method,
                COUNT(DISTINCT subscription_id) as subscription_count
            FROM revenue_recognition
            WHERE recognition_date >= $1 AND recognition_date <= $2
                AND status = 'recognized'
            GROUP BY recognition_method
        `, [startDate, endDate]);
        
        // Deferred revenue
        const deferred = await this.db.query(`
            SELECT 
                SUM(remaining_amount) as deferred_revenue,
                COUNT(DISTINCT subscription_id) as subscription_count
            FROM revenue_recognition
            WHERE recognition_date > $2
                AND created_at <= $2
                AND status IN ('pending', 'partial')
        `, [startDate, endDate]);
        
        // Cash collections
        const collections = await this.db.query(`
            SELECT 
                SUM(amount_paid) as total_collected,
                COUNT(*) as invoice_count,
                AVG(EXTRACT(EPOCH FROM (paid_at - created_at))/86400) as avg_days_to_collect
            FROM invoices
            WHERE paid_at >= $1 AND paid_at <= $2
                AND status = 'paid'
        `, [startDate, endDate]);
        
        return {
            recognized: {
                total: recognized.rows.reduce((sum, r) => sum + parseFloat(r.recognized_revenue || 0), 0),
                byMethod: recognized.rows
            },
            deferred: {
                total: parseFloat(deferred.rows[0]?.deferred_revenue || 0),
                subscriptions: parseInt(deferred.rows[0]?.subscription_count || 0)
            },
            collections: {
                total: parseFloat(collections.rows[0]?.total_collected || 0),
                invoices: parseInt(collections.rows[0]?.invoice_count || 0),
                avgDaysToCollect: parseFloat(collections.rows[0]?.avg_days_to_collect || 0)
            }
        };
    }
    
    // Calculate recurring metrics
    async calculateRecurringMetrics(startDate, endDate) {
        const mrr = await this.calculateMRR(endDate);
        const arr = mrr * 12;
        
        // Growth metrics
        const previousMRR = await this.getPreviousMonthMRR(startDate);
        const newMRR = await this.getNewMRR(startDate, endDate);
        const expansionMRR = await this.getExpansionMRR(startDate, endDate);
        const contractionMRR = await this.getContractionMRR(startDate, endDate);
        const churnedMRR = await this.getChurnedMRR(startDate, endDate);
        
        const netNewMRR = newMRR + expansionMRR - contractionMRR - churnedMRR;
        const growthRate = previousMRR > 0 ? (netNewMRR / previousMRR) * 100 : 0;
        
        return {
            mrr: {
                current: mrr,
                previous: previousMRR,
                growth: netNewMRR,
                growthRate
            },
            arr: {
                current: arr,
                runRate: mrr * 12
            },
            movements: {
                new: newMRR,
                expansion: expansionMRR,
                contraction: contractionMRR,
                churn: churnedMRR,
                net: netNewMRR
            }
        };
    }
    
    // Perform cohort analysis
    async performCohortAnalysis(analysisDate) {
        const cohorts = [];
        
        // Analyze last 12 cohorts
        for (let i = 0; i < 12; i++) {
            const cohortMonth = moment(analysisDate).subtract(i, 'months').startOf('month');
            const cohortData = await this.analyzeCohort(cohortMonth.toDate());
            cohorts.push(cohortData);
        }
        
        return cohorts;
    }
    
    // Analyze single cohort
    async analyzeCohort(cohortMonth) {
        const cohortStart = moment(cohortMonth).startOf('month').toDate();
        const cohortEnd = moment(cohortMonth).endOf('month').toDate();
        
        // Get cohort customers
        const cohortCustomers = await this.db.query(`
            SELECT DISTINCT customer_id
            FROM subscriptions
            WHERE created_at >= $1 AND created_at <= $2
        `, [cohortStart, cohortEnd]);
        
        const customerIds = cohortCustomers.rows.map(r => r.customer_id);
        const monthlyMetrics = [];
        
        // Track cohort performance over time
        for (let monthOffset = 0; monthOffset <= 12; monthOffset++) {
            const analysisMonth = moment(cohortMonth).add(monthOffset, 'months');
            
            const metrics = await this.db.query(`
                SELECT 
                    COUNT(DISTINCT s.customer_id) as active_customers,
                    SUM(cm.mrr) as mrr
                FROM subscriptions s
                LEFT JOIN customer_metrics cm ON s.customer_id = cm.customer_id
                    AND cm.metric_date = DATE_TRUNC('month', $2::DATE)
                WHERE s.customer_id = ANY($1)
                    AND s.created_at <= $2
                    AND (s.canceled_at IS NULL OR s.canceled_at > $2)
            `, [customerIds, analysisMonth.toDate()]);
            
            const retentionRate = customerIds.length > 0 
                ? (metrics.rows[0].active_customers / customerIds.length) * 100 
                : 0;
            
            monthlyMetrics.push({
                month: monthOffset,
                activeCustomers: parseInt(metrics.rows[0].active_customers),
                mrr: parseFloat(metrics.rows[0].mrr || 0),
                retentionRate
            });
        }
        
        return {
            cohortMonth: moment(cohortMonth).format('YYYY-MM'),
            initialCustomers: customerIds.length,
            metrics: monthlyMetrics
        };
    }
    
    // Calculate sales metrics and commissions
    async calculateSalesMetrics(startDate, endDate) {
        // Sales performance
        const salesPerformance = await this.db.query(`
            SELECT 
                sr.id as sales_rep_id,
                sr.name as sales_rep_name,
                COUNT(DISTINCT s.id) as deals_closed,
                SUM(CASE 
                    WHEN s.billing_interval = 'year' THEN i.amount_due
                    ELSE i.amount_due * 12
                END) as total_acv,
                AVG(CASE 
                    WHEN s.billing_interval = 'year' THEN i.amount_due
                    ELSE i.amount_due * 12
                END) as avg_deal_size
            FROM sales_reps sr
            JOIN subscriptions s ON s.sales_rep_id = sr.id
            JOIN invoices i ON i.subscription_id = s.id AND i.number = 1
            WHERE s.created_at >= $1 AND s.created_at <= $2
            GROUP BY sr.id, sr.name
            ORDER BY total_acv DESC
        `, [startDate, endDate]);
        
        // Calculate commissions
        const commissions = await this.commissionTracker.calculatePeriodCommissions(
            startDate, 
            endDate
        );
        
        return {
            performance: salesPerformance.rows,
            commissions,
            totals: {
                deals: salesPerformance.rows.reduce((sum, r) => sum + parseInt(r.deals_closed), 0),
                acv: salesPerformance.rows.reduce((sum, r) => sum + parseFloat(r.total_acv), 0),
                commissions: commissions.total
            }
        };
    }
    
    // Store metric
    async storeMetric(type, value, date, breakdown = {}) {
        await this.db.query(`
            INSERT INTO financial_metrics (
                metric_date, metric_type, value, breakdown
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (metric_date, metric_type) 
            DO UPDATE SET value = $3, breakdown = $4
        `, [
            moment(date).startOf('month').toDate(),
            type,
            value,
            JSON.stringify(breakdown)
        ]);
    }
    
    // Distribute report to stakeholders
    async distributeReport(report) {
        const stakeholders = await this.getReportStakeholders(report.report_type);
        
        for (const stakeholder of stakeholders) {
            await this.mailer.sendMail({
                from: 'reports@rootuip.com',
                to: stakeholder.email,
                subject: `${report.report_type} Report - ${report.report_period}`,
                html: this.generateReportEmail(report),
                attachments: [{
                    filename: `${report.report_type}_${report.report_period}.pdf`,
                    path: report.file_url
                }]
            });
        }
        
        this.emit('report:distributed', { report, recipients: stakeholders.length });
    }
    
    // Helper methods
    async calculateUsageRevenue(startDate, endDate) {
        const usage = await this.db.query(`
            SELECT SUM(overage_amount) as usage_revenue
            FROM usage_invoices
            WHERE invoice_date >= $1 AND invoice_date <= $2
                AND status = 'paid'
        `, [startDate, endDate]);
        
        return parseFloat(usage.rows[0]?.usage_revenue || 0);
    }
    
    async getMRRBreakdown(date) {
        const breakdown = await this.db.query(`
            SELECT 
                plan_id,
                COUNT(*) as subscription_count,
                SUM(mrr_amount) as total_mrr
            FROM subscription_metrics
            WHERE metric_date = DATE_TRUNC('month', $1::DATE)
            GROUP BY plan_id
        `, [date]);
        
        return breakdown.rows;
    }
    
    async getPreviousMonthMRR(date) {
        const previousMonth = moment(date).subtract(1, 'month').startOf('month').toDate();
        
        const result = await this.db.query(`
            SELECT value FROM financial_metrics
            WHERE metric_type = 'mrr' 
                AND metric_date = $1
        `, [previousMonth]);
        
        return parseFloat(result.rows[0]?.value || 0);
    }
    
    async getNewMRR(startDate, endDate) {
        const result = await this.db.query(`
            SELECT SUM(mrr_amount) as new_mrr
            FROM subscription_events
            WHERE event_type = 'created'
                AND event_date >= $1 AND event_date <= $2
        `, [startDate, endDate]);
        
        return parseFloat(result.rows[0]?.new_mrr || 0);
    }
    
    async getExpansionMRR(startDate, endDate) {
        const result = await this.db.query(`
            SELECT SUM(mrr_change) as expansion_mrr
            FROM subscription_events
            WHERE event_type = 'upgraded'
                AND event_date >= $1 AND event_date <= $2
                AND mrr_change > 0
        `, [startDate, endDate]);
        
        return parseFloat(result.rows[0]?.expansion_mrr || 0);
    }
    
    async getContractionMRR(startDate, endDate) {
        const result = await this.db.query(`
            SELECT ABS(SUM(mrr_change)) as contraction_mrr
            FROM subscription_events
            WHERE event_type = 'downgraded'
                AND event_date >= $1 AND event_date <= $2
                AND mrr_change < 0
        `, [startDate, endDate]);
        
        return parseFloat(result.rows[0]?.contraction_mrr || 0);
    }
    
    async getChurnedMRR(startDate, endDate) {
        const result = await this.db.query(`
            SELECT SUM(mrr_amount) as churned_mrr
            FROM subscription_events
            WHERE event_type = 'canceled'
                AND event_date >= $1 AND event_date <= $2
        `, [startDate, endDate]);
        
        return parseFloat(result.rows[0]?.churned_mrr || 0);
    }
    
    generateReportEmail(report) {
        return `
            <h2>${report.report_type} Report</h2>
            <p>Period: ${report.report_period}</p>
            <p>Generated: ${moment(report.generated_at).format('MMMM Do YYYY, h:mm a')}</p>
            <p>Please find the detailed report attached.</p>
            
            <h3>Key Highlights:</h3>
            <ul>
                <li>MRR: $${report.data.recurring?.mrr?.current?.toLocaleString()}</li>
                <li>Growth Rate: ${report.data.recurring?.mrr?.growthRate?.toFixed(1)}%</li>
                <li>Churn Rate: ${report.data.churn?.customerChurn?.churnRate?.toFixed(1)}%</li>
            </ul>
        `;
    }
}

// Revenue Recognition Engine
class RevenueRecognitionEngine {
    constructor(parent) {
        this.parent = parent;
    }
    
    async recognizeRevenue(invoice) {
        const subscription = await this.getSubscription(invoice.subscription_id);
        const recognitionMethod = this.determineRecognitionMethod(subscription);
        
        switch (recognitionMethod) {
            case 'ratable':
                return await this.recognizeRatable(invoice, subscription);
            case 'upfront':
                return await this.recognizeUpfront(invoice);
            case 'milestone':
                return await this.recognizeMilestone(invoice, subscription);
            default:
                throw new Error(`Unknown recognition method: ${recognitionMethod}`);
        }
    }
    
    async recognizeRatable(invoice, subscription) {
        const startDate = moment(invoice.period_start);
        const endDate = moment(invoice.period_end);
        const totalDays = endDate.diff(startDate, 'days');
        const dailyAmount = invoice.amount_due / totalDays;
        
        // Create recognition schedule
        const recognitionSchedule = [];
        let currentDate = startDate.clone();
        
        while (currentDate.isSameOrBefore(endDate)) {
            const monthEnd = currentDate.clone().endOf('month');
            const recognitionEnd = monthEnd.isAfter(endDate) ? endDate : monthEnd;
            const daysInPeriod = recognitionEnd.diff(currentDate, 'days') + 1;
            const recognitionAmount = dailyAmount * daysInPeriod;
            
            recognitionSchedule.push({
                subscription_id: subscription.id,
                invoice_id: invoice.id,
                recognition_date: currentDate.clone().endOf('month').toDate(),
                amount: invoice.amount_due,
                recognized_amount: recognitionAmount,
                remaining_amount: invoice.amount_due - recognitionAmount,
                recognition_method: 'ratable'
            });
            
            currentDate = recognitionEnd.clone().add(1, 'day');
        }
        
        // Store recognition schedule
        for (const schedule of recognitionSchedule) {
            await this.parent.db.query(`
                INSERT INTO revenue_recognition (
                    subscription_id, invoice_id, recognition_date,
                    amount, recognized_amount, remaining_amount,
                    recognition_method
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                schedule.subscription_id,
                schedule.invoice_id,
                schedule.recognition_date,
                schedule.amount,
                schedule.recognized_amount,
                schedule.remaining_amount,
                schedule.recognition_method
            ]);
        }
        
        return recognitionSchedule;
    }
    
    determineRecognitionMethod(subscription) {
        // Custom logic for determining recognition method
        if (subscription.contract_type === 'annual') {
            return 'ratable';
        } else if (subscription.plan_id === 'implementation') {
            return 'milestone';
        } else {
            return this.parent.config.recognitionMethod;
        }
    }
}

// Metrics Calculator
class MetricsCalculator {
    constructor(parent) {
        this.parent = parent;
    }
    
    async calculateQuickRatio(startDate, endDate) {
        const newMRR = await this.parent.getNewMRR(startDate, endDate);
        const expansionMRR = await this.parent.getExpansionMRR(startDate, endDate);
        const contractionMRR = await this.parent.getContractionMRR(startDate, endDate);
        const churnedMRR = await this.parent.getChurnedMRR(startDate, endDate);
        
        const quickRatio = (newMRR + expansionMRR) / (contractionMRR + churnedMRR);
        
        return {
            quickRatio,
            components: {
                growth: newMRR + expansionMRR,
                loss: contractionMRR + churnedMRR
            }
        };
    }
    
    async calculateCAC(startDate, endDate) {
        // Customer Acquisition Cost
        const marketingCosts = await this.getMarketingCosts(startDate, endDate);
        const salesCosts = await this.getSalesCosts(startDate, endDate);
        const newCustomers = await this.getNewCustomerCount(startDate, endDate);
        
        const totalCosts = marketingCosts + salesCosts;
        const cac = newCustomers > 0 ? totalCosts / newCustomers : 0;
        
        return {
            cac,
            totalCosts,
            newCustomers,
            breakdown: {
                marketing: marketingCosts,
                sales: salesCosts
            }
        };
    }
    
    async calculateLTVtoCACRatio(customerId) {
        const ltv = await this.parent.calculateCustomerLTV(customerId);
        const cac = await this.getCustomerCAC(customerId);
        
        return {
            ratio: ltv.ltv / cac,
            ltv: ltv.ltv,
            cac,
            isHealthy: (ltv.ltv / cac) >= 3 // Industry standard
        };
    }
}

// Report Generator
class ReportGenerator {
    constructor(parent) {
        this.parent = parent;
    }
    
    async generatePDFReport(data) {
        const doc = new PDFDocument();
        const filename = `financial_report_${data.period.month.replace(' ', '_')}.pdf`;
        const filepath = `/tmp/${filename}`;
        
        doc.pipe(require('fs').createWriteStream(filepath));
        
        // Header
        doc.fontSize(20).text('ROOTUIP Financial Report', { align: 'center' });
        doc.fontSize(16).text(data.period.month, { align: 'center' });
        doc.moveDown();
        
        // Executive Summary
        doc.fontSize(14).text('Executive Summary', { underline: true });
        doc.fontSize(12);
        doc.text(`MRR: $${data.recurring.mrr.current.toLocaleString()}`);
        doc.text(`MRR Growth: ${data.recurring.mrr.growthRate.toFixed(1)}%`);
        doc.text(`Customer Churn: ${data.churn.customerChurn.churnRate.toFixed(1)}%`);
        doc.text(`Revenue Churn: ${data.churn.revenueChurn.churnRate.toFixed(1)}%`);
        doc.moveDown();
        
        // Revenue Details
        doc.fontSize(14).text('Revenue Recognition', { underline: true });
        doc.fontSize(12);
        doc.text(`Recognized Revenue: $${data.revenue.recognized.total.toLocaleString()}`);
        doc.text(`Deferred Revenue: $${data.revenue.deferred.total.toLocaleString()}`);
        doc.text(`Cash Collections: $${data.revenue.collections.total.toLocaleString()}`);
        doc.moveDown();
        
        // Add charts and graphs
        await this.addChartsToReport(doc, data);
        
        doc.end();
        
        // Upload to S3 or storage
        return await this.uploadReport(filepath, filename);
    }
    
    async generateExcelReport(data) {
        const workbook = new ExcelJS.Workbook();
        
        // Summary sheet
        const summarySheet = workbook.addWorksheet('Summary');
        this.addSummarySheet(summarySheet, data);
        
        // Revenue sheet
        const revenueSheet = workbook.addWorksheet('Revenue');
        this.addRevenueSheet(revenueSheet, data);
        
        // Metrics sheet
        const metricsSheet = workbook.addWorksheet('Metrics');
        this.addMetricsSheet(metricsSheet, data);
        
        // Cohort sheet
        const cohortSheet = workbook.addWorksheet('Cohort Analysis');
        this.addCohortSheet(cohortSheet, data);
        
        // Sales sheet
        const salesSheet = workbook.addWorksheet('Sales Performance');
        this.addSalesSheet(salesSheet, data);
        
        const filename = `financial_report_${data.period.month.replace(' ', '_')}.xlsx`;
        const filepath = `/tmp/${filename}`;
        
        await workbook.xlsx.writeFile(filepath);
        
        return await this.uploadReport(filepath, filename);
    }
    
    addSummarySheet(sheet, data) {
        // Headers
        sheet.columns = [
            { header: 'Metric', key: 'metric', width: 30 },
            { header: 'Current Period', key: 'current', width: 20 },
            { header: 'Previous Period', key: 'previous', width: 20 },
            { header: 'Change', key: 'change', width: 15 },
            { header: '% Change', key: 'changePercent', width: 15 }
        ];
        
        // Add data
        const metrics = [
            {
                metric: 'Monthly Recurring Revenue (MRR)',
                current: data.recurring.mrr.current,
                previous: data.recurring.mrr.previous
            },
            {
                metric: 'Annual Recurring Revenue (ARR)',
                current: data.recurring.arr.current,
                previous: data.recurring.arr.current - (data.recurring.mrr.growth * 12)
            },
            {
                metric: 'Customer Churn Rate',
                current: data.churn.customerChurn.churnRate,
                previous: 0 // Would need historical data
            },
            {
                metric: 'Revenue Churn Rate',
                current: data.churn.revenueChurn.churnRate,
                previous: 0 // Would need historical data
            }
        ];
        
        metrics.forEach(metric => {
            const change = metric.current - metric.previous;
            const changePercent = metric.previous > 0 ? (change / metric.previous) * 100 : 0;
            
            sheet.addRow({
                metric: metric.metric,
                current: metric.current,
                previous: metric.previous,
                change: change,
                changePercent: `${changePercent.toFixed(1)}%`
            });
        });
        
        // Formatting
        sheet.getRow(1).font = { bold: true };
        sheet.getColumn('current').numFmt = '$#,##0.00';
        sheet.getColumn('previous').numFmt = '$#,##0.00';
        sheet.getColumn('change').numFmt = '$#,##0.00';
    }
}

// Analytics Engine
class AnalyticsEngine {
    constructor(parent) {
        this.parent = parent;
    }
    
    async predictChurnProbability(customerId) {
        // Factors: payment history, usage patterns, support tickets, engagement
        const factors = await this.gatherChurnFactors(customerId);
        
        // Simple scoring model (would use ML in production)
        let churnScore = 0;
        
        // Payment delays
        if (factors.avgPaymentDelay > 7) churnScore += 0.2;
        if (factors.failedPayments > 0) churnScore += 0.1 * factors.failedPayments;
        
        // Usage decline
        if (factors.usageDeclineRate > 0.2) churnScore += 0.3;
        
        // Support tickets
        if (factors.unresolvedTickets > 0) churnScore += 0.1 * factors.unresolvedTickets;
        
        // Engagement
        if (factors.lastLoginDays > 30) churnScore += 0.2;
        if (factors.apiUsageDecline > 0.3) churnScore += 0.2;
        
        return Math.min(churnScore, 1); // Cap at 100%
    }
    
    async gatherChurnFactors(customerId) {
        // This would query various data sources
        return {
            avgPaymentDelay: 3,
            failedPayments: 0,
            usageDeclineRate: 0.1,
            unresolvedTickets: 0,
            lastLoginDays: 7,
            apiUsageDecline: 0.05
        };
    }
}

// Commission Tracker
class CommissionTracker {
    constructor(parent) {
        this.parent = parent;
        
        this.commissionRules = {
            standard: {
                new: 0.10, // 10% for new deals
                expansion: 0.08, // 8% for expansions
                renewal: 0.05 // 5% for renewals
            },
            accelerated: {
                threshold: 150, // 150% of quota
                multiplier: 1.5 // 1.5x commission rate
            }
        };
    }
    
    async calculatePeriodCommissions(startDate, endDate) {
        const commissions = await this.parent.db.query(`
            SELECT 
                sr.id as sales_rep_id,
                sr.name as sales_rep_name,
                s.id as subscription_id,
                s.created_at,
                i.amount_due as deal_value,
                CASE 
                    WHEN s.previous_subscription_id IS NULL THEN 'new'
                    WHEN i.amount_due > prev_i.amount_due THEN 'expansion'
                    ELSE 'renewal'
                END as deal_type
            FROM sales_reps sr
            JOIN subscriptions s ON s.sales_rep_id = sr.id
            JOIN invoices i ON i.subscription_id = s.id AND i.number = 1
            LEFT JOIN subscriptions prev_s ON prev_s.id = s.previous_subscription_id
            LEFT JOIN invoices prev_i ON prev_i.subscription_id = prev_s.id AND prev_i.number = 1
            WHERE s.created_at >= $1 AND s.created_at <= $2
        `, [startDate, endDate]);
        
        const commissionsByRep = {};
        let totalCommissions = 0;
        
        for (const deal of commissions.rows) {
            const commission = this.calculateCommission(deal);
            
            if (!commissionsByRep[deal.sales_rep_id]) {
                commissionsByRep[deal.sales_rep_id] = {
                    name: deal.sales_rep_name,
                    deals: [],
                    total: 0
                };
            }
            
            commissionsByRep[deal.sales_rep_id].deals.push({
                subscriptionId: deal.subscription_id,
                dealValue: parseFloat(deal.deal_value),
                dealType: deal.deal_type,
                commission: commission
            });
            
            commissionsByRep[deal.sales_rep_id].total += commission;
            totalCommissions += commission;
            
            // Store commission record
            await this.storeCommission(deal, commission);
        }
        
        return {
            byRep: commissionsByRep,
            total: totalCommissions
        };
    }
    
    calculateCommission(deal) {
        const baseRate = this.commissionRules.standard[deal.deal_type];
        const dealValue = parseFloat(deal.deal_value);
        
        // Annual deals get full commission, monthly deals get 12-month value
        const commissionableValue = deal.billing_interval === 'year' 
            ? dealValue 
            : dealValue * 12;
        
        return commissionableValue * baseRate;
    }
    
    async storeCommission(deal, amount) {
        await this.parent.db.query(`
            INSERT INTO sales_commissions (
                sales_rep_id, subscription_id, commission_date,
                base_amount, commission_rate, commission_amount
            ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
            deal.sales_rep_id,
            deal.subscription_id,
            deal.created_at,
            deal.deal_value,
            this.commissionRules.standard[deal.deal_type],
            amount
        ]);
    }
}

// Forecast Engine
class ForecastEngine {
    constructor(parent) {
        this.parent = parent;
    }
    
    async generateForecast(baseDate) {
        const historicalData = await this.getHistoricalData(baseDate);
        
        // Simple linear regression for MRR forecast
        const mrrForecast = this.forecastMetric(historicalData.mrr, 6); // 6 months
        
        // Factor in known churn and expansion
        const adjustedForecast = this.adjustForecast(mrrForecast, {
            expectedChurn: historicalData.avgChurnRate,
            expectedExpansion: historicalData.avgExpansionRate,
            pipeline: await this.getPipelineValue()
        });
        
        return {
            mrr: adjustedForecast,
            arr: adjustedForecast.map(m => ({ ...m, value: m.value * 12 })),
            confidence: this.calculateConfidence(historicalData),
            assumptions: {
                churnRate: historicalData.avgChurnRate,
                expansionRate: historicalData.avgExpansionRate,
                newBusinessGrowth: historicalData.avgGrowthRate
            }
        };
    }
    
    forecastMetric(historicalData, periods) {
        // Simple linear regression
        const n = historicalData.length;
        const x = historicalData.map((_, i) => i);
        const y = historicalData.map(d => d.value);
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
        const sumXX = x.reduce((total, xi) => total + xi * xi, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        const forecast = [];
        for (let i = 0; i < periods; i++) {
            const forecastIndex = n + i;
            const forecastValue = intercept + slope * forecastIndex;
            
            forecast.push({
                period: moment(historicalData[n-1].date).add(i + 1, 'months').format('YYYY-MM'),
                value: Math.max(0, forecastValue), // Ensure non-negative
                type: 'forecast'
            });
        }
        
        return forecast;
    }
}

module.exports = FinancialReportingSystem;