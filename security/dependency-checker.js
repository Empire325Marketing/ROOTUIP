const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DependencyChecker {
    constructor() {
        this.vulnerabilities = [];
        this.packages = [];
    }
    
    checkNpmAudit() {
        console.log('Running npm audit...');
        
        try {
            const auditResult = execSync('npm audit --json', { 
                cwd: '/home/iii/ROOTUIP',
                encoding: 'utf8' 
            });
            
            const audit = JSON.parse(auditResult);
            
            if (audit.vulnerabilities) {
                Object.entries(audit.vulnerabilities).forEach(([packageName, vuln]) => {
                    this.vulnerabilities.push({
                        package: packageName,
                        severity: vuln.severity,
                        title: vuln.title,
                        url: vuln.url,
                        fixAvailable: vuln.fixAvailable
                    });
                });
            }
            
        } catch (error) {
            console.log('npm audit completed with findings');
            // npm audit returns non-zero exit code when vulnerabilities found
        }
    }
    
    checkPackageVersions() {
        console.log('Checking package versions...');
        
        const packageJsonPath = '/home/iii/ROOTUIP/package.json';
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            
            // Check for outdated packages
            try {
                const outdatedResult = execSync('npm outdated --json', {
                    cwd: '/home/iii/ROOTUIP',
                    encoding: 'utf8'
                });
                
                const outdated = JSON.parse(outdatedResult);
                Object.entries(outdated).forEach(([packageName, info]) => {
                    this.packages.push({
                        name: packageName,
                        current: info.current,
                        wanted: info.wanted,
                        latest: info.latest,
                        status: 'outdated'
                    });
                });
                
            } catch (error) {
                // No outdated packages or error occurred
            }
        }
    }
    
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            vulnerabilities: this.vulnerabilities,
            packages: this.packages,
            summary: {
                totalVulnerabilities: this.vulnerabilities.length,
                critical: this.vulnerabilities.filter(v => v.severity === 'critical').length,
                high: this.vulnerabilities.filter(v => v.severity === 'high').length,
                moderate: this.vulnerabilities.filter(v => v.severity === 'moderate').length,
                low: this.vulnerabilities.filter(v => v.severity === 'low').length,
                outdatedPackages: this.packages.length
            }
        };
        
        // Save report
        const reportPath = path.join(__dirname, 'reports', `dependency-scan-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`Dependency check completed.`);
        console.log(`Vulnerabilities found: ${report.summary.totalVulnerabilities}`);
        console.log(`Outdated packages: ${report.summary.outdatedPackages}`);
        console.log(`Report saved to: ${reportPath}`);
        
        return report;
    }
    
    run() {
        this.checkNpmAudit();
        this.checkPackageVersions();
        return this.generateReport();
    }
}

if (require.main === module) {
    const checker = new DependencyChecker();
    checker.run();
}

module.exports = DependencyChecker;
