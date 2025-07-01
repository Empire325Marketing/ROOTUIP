/**
 * ROOTUIP Compliance Server
 * Main server integrating all compliance components
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Import compliance components
const ComplianceManagementFramework = require('./compliance-management-framework');
const SecurityComplianceSystem = require('./security-compliance-system');
const AuditLoggingSystem = require('./audit-logging-system');
const AutomatedComplianceChecking = require('./automated-compliance-checking');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize compliance systems
const complianceFramework = new ComplianceManagementFramework();
const securityCompliance = new SecurityComplianceSystem();
const auditLogger = new AuditLoggingSystem({
    storageDir: './audit-logs',
    blockchainEnabled: true,
    encryptionEnabled: true
});
const automatedChecking = new AutomatedComplianceChecking(
    complianceFramework,
    securityCompliance,
    auditLogger
);

// API Routes

// Compliance Framework Routes
app.get('/api/compliance/status', async (req, res) => {
    try {
        const frameworks = {};
        for (const [id, framework] of complianceFramework.frameworks) {
            frameworks[id] = {
                name: framework.name,
                complianceScore: framework.complianceScore,
                lastAssessment: framework.lastAssessment,
                status: framework.status
            };
        }
        
        res.json({
            frameworks,
            policies: complianceFramework.policies.size,
            controls: complianceFramework.controlObjectives.size,
            assessments: complianceFramework.assessments.size
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/compliance/assess/:framework', async (req, res) => {
    try {
        const assessment = await complianceFramework.performAssessment(
            req.params.framework,
            req.body
        );
        res.json(assessment);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/compliance/dsr', async (req, res) => {
    try {
        const result = await complianceFramework.handleDataSubjectRequest(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Security Compliance Routes
app.get('/api/security/status', async (req, res) => {
    try {
        const iso27001 = await securityCompliance.calculateISO27001Readiness();
        
        res.json({
            iso27001ReadinessScore: iso27001.readinessScore,
            vulnerabilitiesOpen: securityCompliance.metrics.vulnerabilitiesOpen,
            vulnerabilitiesCritical: securityCompliance.metrics.vulnerabilitiesCritical,
            incidentsOpen: securityCompliance.metrics.incidentsOpen,
            meanTimeToRespond: securityCompliance.metrics.meanTimeToRespond,
            encryptionCoverage: securityCompliance.metrics.encryptionCoverage,
            privilegedAccessReviews: securityCompliance.metrics.privilegedAccessReviews
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/security/pentest', async (req, res) => {
    try {
        const test = await securityCompliance.performPenetrationTest(
            req.body.scope,
            req.body.options
        );
        res.json(test);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/security/incident', async (req, res) => {
    try {
        const incident = await securityCompliance.handleSecurityIncident(req.body);
        res.json(incident);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Audit Logging Routes
app.get('/api/audit/status', async (req, res) => {
    try {
        res.json({
            totalLogs: auditLogger.metrics.totalLogs,
            totalBlocks: auditLogger.metrics.totalBlocks,
            storageUsed: auditLogger.formatBytes(auditLogger.metrics.storageUsed),
            integrityChecks: auditLogger.metrics.integrityChecks,
            violations: auditLogger.metrics.violations
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/audit/log', async (req, res) => {
    try {
        const result = await auditLogger.writeAuditLog(req.body.category, req.body.data);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/audit/search', async (req, res) => {
    try {
        const results = await auditLogger.searchAuditLogs(req.query);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/audit/verify/:category', async (req, res) => {
    try {
        const verification = await auditLogger.verifyIntegrity(req.params.category);
        res.json(verification);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Automated Checking Routes
app.get('/api/checks/status', (req, res) => {
    try {
        const status = automatedChecking.getComplianceStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/checks/run/:checkId', async (req, res) => {
    try {
        const result = await automatedChecking.runComplianceCheck(req.params.checkId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/checks/remediate', async (req, res) => {
    try {
        const result = await automatedChecking.executeRemediation(
            req.body.remediationId,
            req.body.checkResult
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Report Generation Routes
app.get('/api/compliance/report/:type', async (req, res) => {
    try {
        let report;
        
        switch (req.params.type) {
            case 'compliance':
                report = await complianceFramework.generateComplianceReport(req.query);
                break;
            case 'security':
                report = await securityCompliance.generateSecurityComplianceReport(req.query);
                break;
            case 'audit':
                report = await auditLogger.generateAuditReport(req.query);
                break;
            case 'executive':
                report = await generateExecutiveReport();
                break;
            default:
                return res.status(400).json({ error: 'Invalid report type' });
        }
        
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dashboard route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'compliance-dashboard.html'));
});

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log('Client connected to compliance dashboard');
    
    // Send initial status
    socket.emit('compliance:update', {
        frameworks: Object.fromEntries(complianceFramework.frameworks)
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Forward events to connected clients
complianceFramework.on('assessment:completed', (assessment) => {
    io.emit('assessment:completed', assessment);
});

complianceFramework.on('dsr:completed', (dsr) => {
    io.emit('dsr:completed', dsr);
});

securityCompliance.on('incident:created', (incident) => {
    io.emit('incident:created', incident);
});

securityCompliance.on('vulnerability:critical', (vuln) => {
    io.emit('vulnerability:critical', vuln);
});

auditLogger.on('audit:logged', (audit) => {
    io.emit('audit:logged', audit);
});

auditLogger.on('integrity:checked', (result) => {
    io.emit('integrity:checked', result);
});

automatedChecking.on('check:completed', (result) => {
    io.emit('check:completed', result);
});

automatedChecking.on('compliance:alert', (alert) => {
    io.emit('compliance:alert', alert);
});

automatedChecking.on('remediation:approval_required', (approval) => {
    io.emit('remediation:approval_required', approval);
});

// Generate executive report
async function generateExecutiveReport() {
    const complianceReport = await complianceFramework.generateComplianceReport();
    const securityReport = await securityCompliance.generateSecurityComplianceReport();
    const auditReport = await auditLogger.generateAuditReport();
    const checkingStatus = automatedChecking.getComplianceStatus();
    
    return {
        generatedAt: new Date(),
        executiveSummary: {
            overallCompliance: calculateOverallCompliance(complianceReport, securityReport),
            keyMetrics: {
                soc2Compliance: complianceReport.framework_compliance.SOC2_TYPE_II?.complianceScore || 0,
                gdprCompliance: complianceReport.framework_compliance.GDPR?.complianceScore || 0,
                iso27001Readiness: securityReport.iso27001.readinessScore,
                openIncidents: securityReport.incidents.open,
                criticalVulnerabilities: securityReport.vulnerabilities.critical,
                auditIntegrity: auditReport.integrity.violations === 0
            },
            criticalIssues: [
                ...checkingStatus.issues.filter(i => i.critical),
                ...securityReport.executive_summary.criticalIssues
            ],
            recommendations: [
                ...complianceReport.upcoming_requirements.slice(0, 3),
                ...securityReport.recommendations.slice(0, 3)
            ]
        },
        compliance: complianceReport,
        security: securityReport,
        audit: auditReport,
        automatedChecks: checkingStatus
    };
}

// Calculate overall compliance
function calculateOverallCompliance(complianceReport, securityReport) {
    const scores = [];
    
    // Add framework scores
    for (const framework of Object.values(complianceReport.framework_compliance)) {
        if (framework.complianceScore > 0) {
            scores.push(framework.complianceScore);
        }
    }
    
    // Add security compliance
    scores.push(securityReport.executive_summary.overallCompliance);
    
    return scores.length > 0 ? 
        scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

// Start server
const PORT = process.env.PORT || 3008;
server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║         ROOTUIP Compliance Management System           ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  🛡️  Compliance Dashboard: http://localhost:${PORT}      ║
║  📊 API Endpoint: http://localhost:${PORT}/api          ║
║                                                        ║
║  Components:                                           ║
║  ✅ SOC 2 Type II Compliance Framework                ║
║  ✅ GDPR Compliance Management                        ║
║  ✅ ISO 27001 Security Compliance                    ║
║  ✅ Tamper-proof Audit Logging                       ║
║  ✅ Automated Compliance Checking                     ║
║  ✅ Real-time Compliance Monitoring                   ║
║                                                        ║
║  Status: All systems operational                       ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
    
    // Log initial compliance status
    console.log('\nInitial Compliance Status:');
    console.log(`- Frameworks configured: ${complianceFramework.frameworks.size}`);
    console.log(`- Policies active: ${complianceFramework.policies.size}`);
    console.log(`- Control objectives: ${complianceFramework.controlObjectives.size}`);
    console.log(`- Automated checks: ${automatedChecking.complianceChecks.size}`);
    console.log(`- Audit categories: ${auditLogger.categories.size}`);
});

// Demo compliance activities
setTimeout(() => {
    console.log('\n🔍 Running initial compliance assessments...');
    
    // Perform SOC 2 assessment
    complianceFramework.performAssessment('SOC2_TYPE_II', {
        scope: 'Full assessment',
        assessor: 'System'
    }).then(assessment => {
        console.log(`✅ SOC 2 Assessment completed: ${assessment.overallScore.toFixed(1)}%`);
    });
    
    // Check ISO 27001 readiness
    securityCompliance.calculateISO27001Readiness().then(readiness => {
        console.log(`✅ ISO 27001 Readiness: ${readiness.readinessScore.toFixed(1)}%`);
    });
    
    // Log sample audit events
    auditLogger.writeAuditLog('authentication', {
        userId: 'admin',
        action: 'login',
        result: 'success',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0'
    });
    
    auditLogger.writeAuditLog('configuration', {
        userId: 'system',
        component: 'compliance-server',
        change: 'startup',
        previousValue: 'stopped',
        newValue: 'running'
    });
    
}, 5000);

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('\n📴 Shutting down compliance server...');
    
    // Stop automated checks
    for (const task of automatedChecking.checkSchedules.values()) {
        task.stop();
    }
    
    // Close server
    server.close(() => {
        console.log('✅ Compliance server shut down successfully');
        process.exit(0);
    });
});

module.exports = app;