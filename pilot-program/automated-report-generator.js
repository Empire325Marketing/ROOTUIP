// ROOTUIP Automated Pilot Report Generator
// Generates comprehensive reports showing D&D prevented, routes optimized, and costs saved

const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs').promises;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://uip_user:U1Pp@ssw0rd!@localhost:5432/rootuip'
});

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Report generation endpoint
router.post('/generate-report', async (req, res) => {
  try {
    const { customerId, reportType, dateRange, recipients } = req.body;
    
    // Collect all necessary data
    const reportData = await collectReportData(customerId, dateRange);
    
    // Generate reports based on type
    let reportPath;
    switch (reportType) {
      case 'weekly':
        reportPath = await generateWeeklyReport(reportData, customerId);
        break;
      case 'comprehensive':
        reportPath = await generateComprehensiveReport(reportData, customerId);
        break;
      case 'executive':
        reportPath = await generateExecutiveReport(reportData, customerId);
        break;
      default:
        reportPath = await generateWeeklyReport(reportData, customerId);
    }
    
    // Send report via email if recipients provided
    if (recipients && recipients.length > 0) {
      await sendReportEmail(reportPath, recipients, reportType, reportData);
    }
    
    res.json({
      success: true,
      reportPath,
      message: 'Report generated successfully'
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Collect comprehensive report data
async function collectReportData(customerId, dateRange) {
  const { startDate, endDate } = dateRange || getDefaultDateRange();
  
  const [
    performanceMetrics,
    savingsData,
    preventedEvents,
    userActivity,
    systemPerformance,
    routeOptimizations
  ] = await Promise.all([
    getPerformanceMetrics(customerId, startDate, endDate),
    getSavingsData(customerId, startDate, endDate),
    getPreventedEvents(customerId, startDate, endDate),
    getUserActivity(customerId, startDate, endDate),
    getSystemPerformance(customerId, startDate, endDate),
    getRouteOptimizations(customerId, startDate, endDate)
  ]);
  
  return {
    customerId,
    dateRange: { startDate, endDate },
    performanceMetrics,
    savingsData,
    preventedEvents,
    userActivity,
    systemPerformance,
    routeOptimizations,
    generatedAt: new Date().toISOString()
  };
}

// Get performance metrics
async function getPerformanceMetrics(customerId, startDate, endDate) {
  const query = `
    WITH pilot_metrics AS (
      SELECT 
        COUNT(*) as total_predictions,
        COUNT(CASE WHEN dd_prevented = true THEN 1 END) as dd_prevented_count,
        AVG(risk_score) as avg_risk_score,
        AVG(confidence_score) as avg_confidence,
        AVG(processing_time_ms) as avg_processing_time,
        SUM(estimated_savings) as total_savings
      FROM ml_predictions
      WHERE customer_id = $1
        AND created_at BETWEEN $2 AND $3
    ),
    baseline_metrics AS (
      SELECT 
        historical_dd_rate,
        avg_dd_cost,
        monthly_shipments
      FROM customer_baselines
      WHERE customer_id = $1
    )
    SELECT 
      pm.*,
      bm.*,
      CASE 
        WHEN pm.total_predictions > 0 
        THEN (pm.dd_prevented_count::float / pm.total_predictions * 100)
        ELSE 0 
      END as prevention_rate,
      pm.total_savings / NULLIF(
        (SELECT pilot_fee FROM pilot_agreements WHERE customer_id = $1), 
        0
      ) as roi_ratio
    FROM pilot_metrics pm
    CROSS JOIN baseline_metrics bm
  `;
  
  const result = await pool.query(query, [customerId, startDate, endDate]);
  return result.rows[0] || {};
}

// Get detailed savings data
async function getSavingsData(customerId, startDate, endDate) {
  const query = `
    SELECT 
      DATE_TRUNC('day', created_at) as date,
      SUM(estimated_savings) as daily_savings,
      COUNT(*) as events_prevented,
      AVG(risk_score) as avg_risk_score,
      STRING_AGG(DISTINCT prevention_method, ', ') as methods_used
    FROM ml_predictions
    WHERE customer_id = $1
      AND created_at BETWEEN $2 AND $3
      AND dd_prevented = true
    GROUP BY DATE_TRUNC('day', created_at)
    ORDER BY date
  `;
  
  const result = await pool.query(query, [customerId, startDate, endDate]);
  
  // Calculate cumulative savings
  let cumulative = 0;
  return result.rows.map(row => ({
    ...row,
    cumulative_savings: (cumulative += parseFloat(row.daily_savings))
  }));
}

// Get prevented D&D events details
async function getPreventedEvents(customerId, startDate, endDate) {
  const query = `
    SELECT 
      p.container_number,
      p.port,
      p.carrier,
      p.risk_score,
      p.prevention_method,
      p.estimated_savings,
      p.created_at,
      p.eta,
      p.actual_outcome,
      s.status as shipment_status
    FROM ml_predictions p
    LEFT JOIN shipments s ON p.shipment_id = s.id
    WHERE p.customer_id = $1
      AND p.created_at BETWEEN $2 AND $3
      AND p.dd_prevented = true
    ORDER BY p.estimated_savings DESC
    LIMIT 100
  `;
  
  const result = await pool.query(query, [customerId, startDate, endDate]);
  return result.rows;
}

// Get user activity metrics
async function getUserActivity(customerId, startDate, endDate) {
  const query = `
    WITH user_metrics AS (
      SELECT 
        u.id,
        u.name,
        u.role,
        COUNT(DISTINCT DATE(s.created_at)) as active_days,
        COUNT(s.id) as total_sessions,
        AVG(s.duration_minutes) as avg_session_duration,
        COUNT(DISTINCT p.id) as predictions_viewed,
        COUNT(DISTINCT a.id) as actions_taken
      FROM users u
      LEFT JOIN sessions s ON u.id = s.user_id
        AND s.created_at BETWEEN $2 AND $3
      LEFT JOIN prediction_views p ON u.id = p.user_id
        AND p.created_at BETWEEN $2 AND $3
      LEFT JOIN user_actions a ON u.id = a.user_id
        AND a.created_at BETWEEN $2 AND $3
      WHERE u.customer_id = $1
      GROUP BY u.id, u.name, u.role
    )
    SELECT 
      COUNT(DISTINCT id) as total_users,
      COUNT(DISTINCT CASE WHEN active_days > 0 THEN id END) as active_users,
      AVG(active_days) as avg_active_days,
      SUM(predictions_viewed) as total_predictions_viewed,
      json_agg(
        json_build_object(
          'name', name,
          'role', role,
          'active_days', active_days,
          'sessions', total_sessions,
          'engagement_score', 
            CASE 
              WHEN active_days > 0 
              THEN ROUND((active_days::float / 30 * 100))
              ELSE 0 
            END
        ) ORDER BY active_days DESC
      ) as user_details
    FROM user_metrics
  `;
  
  const result = await pool.query(query, [customerId, startDate, endDate]);
  return result.rows[0] || {};
}

// Get system performance metrics
async function getSystemPerformance(customerId, startDate, endDate) {
  const query = `
    SELECT 
      AVG(response_time_ms) as avg_response_time,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time,
      COUNT(CASE WHEN status_code >= 500 THEN 1 END)::float / 
        NULLIF(COUNT(*), 0) * 100 as error_rate,
      COUNT(*) as total_requests,
      SUM(CASE WHEN response_time_ms > 2000 THEN 1 ELSE 0 END) as slow_requests
    FROM api_logs
    WHERE customer_id = $1
      AND created_at BETWEEN $2 AND $3
  `;
  
  const result = await pool.query(query, [customerId, startDate, endDate]);
  return result.rows[0] || {};
}

// Get route optimization data
async function getRouteOptimizations(customerId, startDate, endDate) {
  const query = `
    SELECT 
      ro.optimization_type,
      COUNT(*) as count,
      SUM(ro.time_saved_hours) as total_time_saved,
      SUM(ro.cost_saved) as total_cost_saved,
      AVG(ro.efficiency_gain) as avg_efficiency_gain,
      json_agg(
        json_build_object(
          'route', ro.original_route || ' -> ' || ro.optimized_route,
          'time_saved', ro.time_saved_hours,
          'cost_saved', ro.cost_saved
        ) ORDER BY ro.cost_saved DESC
        LIMIT 10
      ) as top_optimizations
    FROM route_optimizations ro
    WHERE ro.customer_id = $1
      AND ro.created_at BETWEEN $2 AND $3
    GROUP BY ro.optimization_type
  `;
  
  const result = await pool.query(query, [customerId, startDate, endDate]);
  return result.rows;
}

// Generate weekly report
async function generateWeeklyReport(data, customerId) {
  const doc = new PDFDocument({ margin: 50 });
  const filename = `weekly-report-${customerId}-${Date.now()}.pdf`;
  const filepath = path.join(__dirname, '../reports', filename);
  
  // Ensure reports directory exists
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  
  // Create write stream
  doc.pipe(fs.createWriteStream(filepath));
  
  // Header
  doc.fontSize(24).text('ROOTUIP Weekly Pilot Report', { align: 'center' });
  doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
  doc.moveDown();
  
  // Executive Summary
  doc.fontSize(18).text('Executive Summary', { underline: true });
  doc.fontSize(12);
  doc.text(`Prevention Rate: ${data.performanceMetrics.prevention_rate?.toFixed(1) || 0}%`);
  doc.text(`Total Savings: $${(data.performanceMetrics.total_savings || 0).toLocaleString()}`);
  doc.text(`ROI Achievement: ${data.performanceMetrics.roi_ratio?.toFixed(1) || 0}:1`);
  doc.moveDown();
  
  // Key Metrics
  doc.fontSize(18).text('Key Performance Metrics', { underline: true });
  doc.fontSize(12);
  
  // Add metrics table
  const metrics = [
    ['Metric', 'This Week', 'Target', 'Status'],
    ['D&D Prevention Rate', `${data.performanceMetrics.prevention_rate?.toFixed(1)}%`, '94%', getStatus(data.performanceMetrics.prevention_rate, 94)],
    ['Avg Confidence Score', `${data.performanceMetrics.avg_confidence?.toFixed(1)}%`, '90%', getStatus(data.performanceMetrics.avg_confidence, 90)],
    ['User Adoption', `${((data.userActivity.active_users / data.userActivity.total_users) * 100).toFixed(1)}%`, '75%', getStatus((data.userActivity.active_users / data.userActivity.total_users) * 100, 75)]
  ];
  
  // Simple table rendering
  metrics.forEach((row, i) => {
    const y = doc.y;
    row.forEach((cell, j) => {
      doc.text(cell, 50 + (j * 120), y, { width: 110 });
    });
    doc.moveDown();
    if (i === 0) {
      doc.moveDown(0.5);
    }
  });
  
  // Recent Prevented Events
  doc.addPage();
  doc.fontSize(18).text('Recent D&D Events Prevented', { underline: true });
  doc.fontSize(10);
  
  data.preventedEvents.slice(0, 10).forEach(event => {
    doc.text(`Container: ${event.container_number} | Port: ${event.port} | Savings: $${event.estimated_savings.toLocaleString()}`);
    doc.text(`Method: ${event.prevention_method} | Risk Score: ${event.risk_score}`, { indent: 20 });
    doc.moveDown(0.5);
  });
  
  // Finalize PDF
  doc.end();
  
  return filepath;
}

// Generate comprehensive report (Excel)
async function generateComprehensiveReport(data, customerId) {
  const workbook = new ExcelJS.Workbook();
  const filename = `comprehensive-report-${customerId}-${Date.now()}.xlsx`;
  const filepath = path.join(__dirname, '../reports', filename);
  
  // Executive Summary Sheet
  const summarySheet = workbook.addWorksheet('Executive Summary');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 },
    { header: 'Target', key: 'target', width: 20 },
    { header: 'Status', key: 'status', width: 15 }
  ];
  
  summarySheet.addRows([
    { 
      metric: 'D&D Prevention Rate', 
      value: `${data.performanceMetrics.prevention_rate?.toFixed(1)}%`,
      target: '94%',
      status: data.performanceMetrics.prevention_rate >= 94 ? 'Achieved' : 'In Progress'
    },
    { 
      metric: 'Total Savings', 
      value: `$${(data.performanceMetrics.total_savings || 0).toLocaleString()}`,
      target: 'N/A',
      status: 'Tracking'
    },
    { 
      metric: 'ROI Achievement', 
      value: `${data.performanceMetrics.roi_ratio?.toFixed(1)}:1`,
      target: '5:1',
      status: data.performanceMetrics.roi_ratio >= 5 ? 'Achieved' : 'In Progress'
    }
  ]);
  
  // Daily Savings Sheet
  const savingsSheet = workbook.addWorksheet('Daily Savings');
  savingsSheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Daily Savings', key: 'daily_savings', width: 15 },
    { header: 'Events Prevented', key: 'events_prevented', width: 20 },
    { header: 'Cumulative Savings', key: 'cumulative_savings', width: 20 },
    { header: 'Methods Used', key: 'methods_used', width: 30 }
  ];
  
  data.savingsData.forEach(row => {
    savingsSheet.addRow({
      date: new Date(row.date).toLocaleDateString(),
      daily_savings: parseFloat(row.daily_savings),
      events_prevented: row.events_prevented,
      cumulative_savings: row.cumulative_savings,
      methods_used: row.methods_used
    });
  });
  
  // Format currency columns
  ['B', 'D'].forEach(col => {
    savingsSheet.getColumn(col).numFmt = '$#,##0.00';
  });
  
  // Prevented Events Sheet
  const eventsSheet = workbook.addWorksheet('Prevented Events');
  eventsSheet.columns = [
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Container', key: 'container', width: 15 },
    { header: 'Port', key: 'port', width: 15 },
    { header: 'Carrier', key: 'carrier', width: 15 },
    { header: 'Risk Score', key: 'risk_score', width: 12 },
    { header: 'Method', key: 'method', width: 20 },
    { header: 'Savings', key: 'savings', width: 12 }
  ];
  
  data.preventedEvents.forEach(event => {
    eventsSheet.addRow({
      date: new Date(event.created_at).toLocaleDateString(),
      container: event.container_number,
      port: event.port,
      carrier: event.carrier,
      risk_score: event.risk_score,
      method: event.prevention_method,
      savings: parseFloat(event.estimated_savings)
    });
  });
  
  eventsSheet.getColumn('G').numFmt = '$#,##0.00';
  
  // User Activity Sheet
  const userSheet = workbook.addWorksheet('User Activity');
  userSheet.columns = [
    { header: 'User Name', key: 'name', width: 25 },
    { header: 'Role', key: 'role', width: 15 },
    { header: 'Active Days', key: 'active_days', width: 12 },
    { header: 'Sessions', key: 'sessions', width: 10 },
    { header: 'Engagement %', key: 'engagement_score', width: 15 }
  ];
  
  if (data.userActivity.user_details) {
    data.userActivity.user_details.forEach(user => {
      userSheet.addRow(user);
    });
  }
  
  // Save workbook
  await workbook.xlsx.writeFile(filepath);
  return filepath;
}

// Generate executive report
async function generateExecutiveReport(data, customerId) {
  // Create HTML report for executives
  const templatePath = path.join(__dirname, '../templates/executive-report.html');
  let template = await fs.readFile(templatePath, 'utf8');
  
  // Replace placeholders with data
  const replacements = {
    '{{CUSTOMER_ID}}': customerId,
    '{{REPORT_DATE}}': new Date().toLocaleDateString(),
    '{{PREVENTION_RATE}}': data.performanceMetrics.prevention_rate?.toFixed(1) || '0',
    '{{TOTAL_SAVINGS}}': (data.performanceMetrics.total_savings || 0).toLocaleString(),
    '{{ROI_RATIO}}': data.performanceMetrics.roi_ratio?.toFixed(1) || '0',
    '{{ACTIVE_USERS}}': data.userActivity.active_users || 0,
    '{{TOTAL_USERS}}': data.userActivity.total_users || 0,
    '{{AVG_RESPONSE_TIME}}': Math.round(data.systemPerformance.avg_response_time || 0),
    '{{UPTIME}}': calculateUptime(data.systemPerformance),
    '{{TOTAL_PREVENTED}}': data.performanceMetrics.dd_prevented_count || 0,
    '{{AVG_CONFIDENCE}}': data.performanceMetrics.avg_confidence?.toFixed(1) || '0'
  };
  
  Object.entries(replacements).forEach(([key, value]) => {
    template = template.replace(new RegExp(key, 'g'), value);
  });
  
  // Save HTML report
  const filename = `executive-report-${customerId}-${Date.now()}.html`;
  const filepath = path.join(__dirname, '../reports', filename);
  await fs.writeFile(filepath, template);
  
  return filepath;
}

// Send report via email
async function sendReportEmail(reportPath, recipients, reportType, data) {
  const subject = `ROOTUIP ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report - ${new Date().toLocaleDateString()}`;
  
  const htmlContent = `
    <h2>ROOTUIP Pilot Report</h2>
    <p>Please find attached your ${reportType} pilot report.</p>
    
    <h3>Key Highlights:</h3>
    <ul>
      <li>D&D Prevention Rate: ${data.performanceMetrics.prevention_rate?.toFixed(1)}%</li>
      <li>Total Savings: $${(data.performanceMetrics.total_savings || 0).toLocaleString()}</li>
      <li>ROI Achievement: ${data.performanceMetrics.roi_ratio?.toFixed(1)}:1</li>
    </ul>
    
    <p>For questions or to schedule a review, please contact your Customer Success Manager.</p>
    
    <p>Best regards,<br>ROOTUIP Team</p>
  `;
  
  const mailOptions = {
    from: process.env.SMTP_FROM || 'reports@rootuip.com',
    to: recipients.join(', '),
    subject: subject,
    html: htmlContent,
    attachments: [
      {
        filename: path.basename(reportPath),
        path: reportPath
      }
    ]
  };
  
  await transporter.sendMail(mailOptions);
}

// Helper functions
function getDefaultDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  return { startDate, endDate };
}

function getStatus(actual, target) {
  if (actual >= target) return '✓';
  if (actual >= target * 0.9) return '→';
  return '✗';
}

function calculateUptime(systemPerformance) {
  const errorRate = systemPerformance.error_rate || 0;
  return (100 - errorRate).toFixed(2) + '%';
}

// Schedule automated reports
function scheduleAutomatedReports() {
  const cron = require('node-cron');
  
  // Weekly reports every Monday at 8 AM
  cron.schedule('0 8 * * 1', async () => {
    console.log('Generating weekly reports...');
    const pilots = await getActivePilots();
    
    for (const pilot of pilots) {
      try {
        const reportData = await collectReportData(pilot.customer_id, getDefaultDateRange());
        const reportPath = await generateWeeklyReport(reportData, pilot.customer_id);
        await sendReportEmail(reportPath, pilot.report_recipients, 'weekly', reportData);
      } catch (error) {
        console.error(`Failed to generate report for ${pilot.customer_id}:`, error);
      }
    }
  });
  
  // Monthly comprehensive reports
  cron.schedule('0 8 1 * *', async () => {
    console.log('Generating monthly comprehensive reports...');
    const pilots = await getActivePilots();
    
    for (const pilot of pilots) {
      try {
        const dateRange = getMonthlyDateRange();
        const reportData = await collectReportData(pilot.customer_id, dateRange);
        const reportPath = await generateComprehensiveReport(reportData, pilot.customer_id);
        await sendReportEmail(reportPath, pilot.report_recipients, 'comprehensive', reportData);
      } catch (error) {
        console.error(`Failed to generate report for ${pilot.customer_id}:`, error);
      }
    }
  });
}

async function getActivePilots() {
  const query = `
    SELECT 
      customer_id,
      company_name,
      report_recipients
    FROM pilot_agreements
    WHERE status = 'active'
      AND end_date > NOW()
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

function getMonthlyDateRange() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);
  return { startDate, endDate };
}

// Initialize scheduled reports
scheduleAutomatedReports();

module.exports = router;