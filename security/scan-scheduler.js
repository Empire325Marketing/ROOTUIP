const cron = require('node-cron');
const SecurityScanner = require('./security-scanner');
const DependencyChecker = require('./dependency-checker');
const fs = require('fs');
const path = require('path');

class SecurityScheduler {
    constructor() {
        this.isRunning = false;
    }
    
    async runSecurityScan() {
        if (this.isRunning) {
            console.log('Security scan already running, skipping...');
            return;
        }
        
        this.isRunning = true;
        console.log('Starting scheduled security scan...');
        
        try {
            // Run security scanner
            const scanner = new SecurityScanner();
            const securityReport = await scanner.runAllTests();
            
            // Run dependency checker
            const depChecker = new DependencyChecker();
            const dependencyReport = depChecker.run();
            
            // Send alerts if needed
            this.checkForAlerts(securityReport, dependencyReport);
            
        } catch (error) {
            console.error('Error during scheduled security scan:', error);
        } finally {
            this.isRunning = false;
        }
    }
    
    checkForAlerts(securityReport, dependencyReport) {
        const alerts = [];
        
        // Check security score
        if (securityReport.overallScore < 70) {
            alerts.push({
                type: 'security_score',
                severity: 'high',
                message: `Security score dropped to ${securityReport.overallScore}/100`
            });
        }
        
        // Check for critical vulnerabilities
        if (securityReport.vulnerabilities.critical > 0) {
            alerts.push({
                type: 'critical_vulnerability',
                severity: 'critical',
                message: `${securityReport.vulnerabilities.critical} critical security vulnerabilities found`
            });
        }
        
        // Check dependency vulnerabilities
        if (dependencyReport.summary.critical > 0) {
            alerts.push({
                type: 'dependency_vulnerability',
                severity: 'critical',
                message: `${dependencyReport.summary.critical} critical dependency vulnerabilities found`
            });
        }
        
        if (alerts.length > 0) {
            this.sendAlerts(alerts);
        }
    }
    
    sendAlerts(alerts) {
        // Log alerts (in production, send to monitoring system)
        const alertLog = {
            timestamp: new Date().toISOString(),
            alerts: alerts
        };
        
        fs.appendFileSync(
            path.join(__dirname, 'reports', 'security-alerts.log'),
            JSON.stringify(alertLog) + '\n'
        );
        
        console.log('SECURITY ALERTS:');
        alerts.forEach(alert => {
            console.log(`[${alert.severity.toUpperCase()}] ${alert.message}`);
        });
    }
    
    start() {
        console.log('Starting security scan scheduler...');
        
        // Run daily security scans at 2 AM
        cron.schedule('0 2 * * *', () => {
            this.runSecurityScan();
        });
        
        // Run dependency checks weekly on Sundays at 3 AM
        cron.schedule('0 3 * * 0', () => {
            const depChecker = new DependencyChecker();
            depChecker.run();
        });
        
        // Initial scan
        setTimeout(() => {
            this.runSecurityScan();
        }, 5000);
        
        console.log('Security scan scheduler started');
        console.log('- Daily security scans at 2:00 AM');
        console.log('- Weekly dependency checks on Sundays at 3:00 AM');
    }
}

if (require.main === module) {
    const scheduler = new SecurityScheduler();
    scheduler.start();
    
    // Keep the process running
    process.on('SIGINT', () => {
        console.log('Shutting down security scheduler...');
        process.exit(0);
    });
}

module.exports = SecurityScheduler;
