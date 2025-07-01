#!/usr/bin/env node

/**
 * Automated Code Review System for ROOTUIP
 * Performs comprehensive code analysis and generates review comments
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AutomatedCodeReview {
    constructor(config = {}) {
        this.config = {
            repoPath: config.repoPath || process.cwd(),
            pullRequestId: config.pullRequestId || process.env.GITHUB_PR_NUMBER,
            githubToken: config.githubToken || process.env.GITHUB_TOKEN,
            baseBranch: config.baseBranch || 'main',
            reviewers: config.reviewers || ['senior-engineers', 'code-quality-team'],
            ...config
        };
        
        this.reviewComments = [];
        this.metrics = {
            filesChanged: 0,
            linesAdded: 0,
            linesRemoved: 0,
            complexityScore: 0,
            testCoverage: 0,
            securityIssues: 0,
            performanceIssues: 0
        };
        
        this.rules = this.loadReviewRules();
    }
    
    // Load code review rules
    loadReviewRules() {
        return {
            complexity: {
                maxCyclomaticComplexity: 10,
                maxCognitiveComplexity: 15,
                maxNestingDepth: 4,
                maxFunctionLength: 50
            },
            security: {
                requireSecurityReview: ['auth', 'crypto', 'database', 'api'],
                bannedFunctions: ['eval', 'innerHTML', 'document.write'],
                sensitivePatterns: [
                    /password\s*=\s*['"]/i,
                    /api[_-]?key\s*=\s*['"]/i,
                    /secret\s*=\s*['"]/i,
                    /token\s*=\s*['"]/i
                ]
            },
            performance: {
                maxBundleSize: 500000, // 500KB
                requirePerformanceReview: ['database', 'cache', 'api'],
                bannedSyncOperations: ['readFileSync', 'writeFileSync']
            },
            testing: {
                minCoverageThreshold: 80,
                requireTestsFor: ['controllers', 'services', 'utils'],
                testFilePatterns: ['.test.js', '.test.ts', '.spec.js', '.spec.ts']
            },
            documentation: {
                requireJSDoc: ['public methods', 'exported functions'],
                requireReadmeUpdate: ['new features', 'api changes'],
                requireChangelogUpdate: ['breaking changes', 'new features']
            }
        };
    }
    
    // Main review process
    async performReview() {
        console.log('🔍 Starting automated code review...');
        
        try {
            // Get changed files
            const changedFiles = await this.getChangedFiles();
            this.metrics.filesChanged = changedFiles.length;
            
            // Analyze each changed file
            for (const file of changedFiles) {
                await this.analyzeFile(file);
            }
            
            // Perform overall analysis
            await this.performOverallAnalysis();
            
            // Generate review summary
            const reviewSummary = await this.generateReviewSummary();
            
            // Post review comments
            await this.postReviewComments();
            
            console.log('✅ Automated code review completed');
            return reviewSummary;
            
        } catch (error) {
            console.error('❌ Code review failed:', error);
            throw error;
        }
    }
    
    // Get list of changed files
    async getChangedFiles() {
        try {
            const output = execSync(
                `git diff --name-only ${this.config.baseBranch}..HEAD`,
                { encoding: 'utf8', cwd: this.config.repoPath }
            );
            
            return output.trim().split('\n').filter(file => {
                // Filter relevant files only
                return file.match(/\.(js|ts|jsx|tsx|json|md)$/) && 
                       !file.includes('node_modules') &&
                       !file.includes('.git');
            });
        } catch (error) {
            console.error('Failed to get changed files:', error);
            return [];
        }
    }
    
    // Analyze individual file
    async analyzeFile(filePath) {
        console.log(`Analyzing ${filePath}...`);
        
        const fullPath = path.join(this.config.repoPath, filePath);
        
        if (!fs.existsSync(fullPath)) {
            return; // File might have been deleted
        }
        
        const content = fs.readFileSync(fullPath, 'utf8');
        const fileExtension = path.extname(filePath);
        
        // File-specific analysis
        switch (fileExtension) {
            case '.js':
            case '.ts':
                await this.analyzeJavaScriptFile(filePath, content);
                break;
            case '.jsx':
            case '.tsx':
                await this.analyzeReactFile(filePath, content);
                break;
            case '.json':
                await this.analyzeJSONFile(filePath, content);
                break;
            case '.md':
                await this.analyzeMarkdownFile(filePath, content);
                break;
        }
    }
    
    // Analyze JavaScript/TypeScript files
    async analyzeJavaScriptFile(filePath, content) {
        // Check for security issues
        await this.checkSecurityIssues(filePath, content);
        
        // Check complexity
        await this.checkComplexity(filePath, content);
        
        // Check performance issues
        await this.checkPerformanceIssues(filePath, content);
        
        // Check for tests
        await this.checkTestCoverage(filePath, content);
        
        // Check documentation
        await this.checkDocumentation(filePath, content);
        
        // Check code style
        await this.checkCodeStyle(filePath, content);
    }
    
    // Check for security issues
    async checkSecurityIssues(filePath, content) {
        const issues = [];
        
        // Check for sensitive data patterns
        this.rules.security.sensitivePatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                issues.push({
                    type: 'security',
                    severity: 'high',
                    message: 'Potential sensitive data exposure detected',
                    line: this.getLineNumber(content, matches.index),
                    suggestion: 'Use environment variables or secure vault for sensitive data'
                });
                this.metrics.securityIssues++;
            }
        });
        
        // Check for banned functions
        this.rules.security.bannedFunctions.forEach(func => {
            if (content.includes(func)) {
                issues.push({
                    type: 'security',
                    severity: 'medium',
                    message: `Usage of potentially unsafe function: ${func}`,
                    suggestion: `Consider safer alternatives to ${func}`
                });
                this.metrics.securityIssues++;
            }
        });
        
        // Check if file requires security review
        const requiresSecurityReview = this.rules.security.requireSecurityReview.some(
            keyword => filePath.includes(keyword) || content.includes(keyword)
        );
        
        if (requiresSecurityReview) {
            issues.push({
                type: 'security',
                severity: 'info',
                message: 'This file may require security team review',
                suggestion: 'Request review from security team'
            });
        }
        
        if (issues.length > 0) {
            this.addReviewComment(filePath, 'Security Analysis', issues);
        }
    }
    
    // Check code complexity
    async checkComplexity(filePath, content) {
        try {
            // Run ESLint complexity analysis
            const eslintOutput = execSync(
                `npx eslint ${filePath} --format=json --rule="complexity: [error, ${this.rules.complexity.maxCyclomaticComplexity}]"`,
                { encoding: 'utf8', cwd: this.config.repoPath, stdio: 'pipe' }
            );
            
            const results = JSON.parse(eslintOutput);
            const issues = [];
            
            results.forEach(result => {
                result.messages.forEach(message => {
                    if (message.ruleId === 'complexity') {
                        issues.push({
                            type: 'complexity',
                            severity: 'medium',
                            line: message.line,
                            message: message.message,
                            suggestion: 'Consider breaking this function into smaller, more focused functions'
                        });
                        this.metrics.complexityScore += message.severity === 2 ? 2 : 1;
                    }
                });
            });
            
            if (issues.length > 0) {
                this.addReviewComment(filePath, 'Complexity Analysis', issues);
            }
            
        } catch (error) {
            // ESLint might fail, continue with basic analysis
            console.warn(`Complexity analysis failed for ${filePath}:`, error.message);
        }
    }
    
    // Check for performance issues
    async checkPerformanceIssues(filePath, content) {
        const issues = [];
        
        // Check for banned synchronous operations
        this.rules.performance.bannedSyncOperations.forEach(operation => {
            if (content.includes(operation)) {
                issues.push({
                    type: 'performance',
                    severity: 'medium',
                    message: `Synchronous operation detected: ${operation}`,
                    suggestion: `Use async alternative: ${operation.replace('Sync', '')}`
                });
                this.metrics.performanceIssues++;
            }
        });
        
        // Check for potential memory leaks
        const memoryLeakPatterns = [
            /setInterval\s*\(/g,
            /setTimeout\s*\(/g,
            /addEventListener\s*\(/g
        ];
        
        memoryLeakPatterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches && matches.length > 3) {
                issues.push({
                    type: 'performance',
                    severity: 'low',
                    message: 'Multiple timer/event listeners detected',
                    suggestion: 'Ensure proper cleanup to prevent memory leaks'
                });
            }
        });
        
        // Check if file requires performance review
        const requiresPerformanceReview = this.rules.performance.requirePerformanceReview.some(
            keyword => filePath.includes(keyword)
        );
        
        if (requiresPerformanceReview) {
            issues.push({
                type: 'performance',
                severity: 'info',
                message: 'This file may require performance review',
                suggestion: 'Consider performance implications and add performance tests'
            });
        }
        
        if (issues.length > 0) {
            this.addReviewComment(filePath, 'Performance Analysis', issues);
        }
    }
    
    // Check test coverage
    async checkTestCoverage(filePath, content) {
        const issues = [];
        
        // Check if file should have tests
        const requiresTests = this.rules.testing.requireTestsFor.some(
            pattern => filePath.includes(pattern)
        );
        
        if (requiresTests) {
            const testFile = this.findTestFile(filePath);
            
            if (!testFile) {
                issues.push({
                    type: 'testing',
                    severity: 'medium',
                    message: 'No test file found for this module',
                    suggestion: `Create test file: ${this.suggestTestFileName(filePath)}`
                });
            } else {
                // Check if test file is comprehensive
                const testContent = fs.readFileSync(testFile, 'utf8');
                const functionCount = (content.match(/function\s+\w+|const\s+\w+\s*=\s*\(/g) || []).length;
                const testCount = (testContent.match(/it\s*\(|test\s*\(/g) || []).length;
                
                if (testCount < functionCount * 0.8) {
                    issues.push({
                        type: 'testing',
                        severity: 'low',
                        message: 'Test coverage appears insufficient',
                        suggestion: 'Consider adding more comprehensive tests'
                    });
                }
            }
        }
        
        if (issues.length > 0) {
            this.addReviewComment(filePath, 'Test Coverage Analysis', issues);
        }
    }
    
    // Check documentation
    async checkDocumentation(filePath, content) {
        const issues = [];
        
        // Check for JSDoc comments on exported functions
        const exportedFunctions = content.match(/export\s+(function\s+\w+|const\s+\w+\s*=)/g);
        
        if (exportedFunctions) {
            exportedFunctions.forEach(func => {
                const funcIndex = content.indexOf(func);
                const beforeFunc = content.substring(Math.max(0, funcIndex - 200), funcIndex);
                
                if (!beforeFunc.includes('/**')) {
                    issues.push({
                        type: 'documentation',
                        severity: 'low',
                        message: 'Exported function missing JSDoc documentation',
                        suggestion: 'Add JSDoc comments with parameter and return type documentation'
                    });
                }
            });
        }
        
        // Check for README updates if API changes detected
        if (content.includes('express') || content.includes('router') || content.includes('app.')) {
            if (!this.hasReadmeUpdate()) {
                issues.push({
                    type: 'documentation',
                    severity: 'low',
                    message: 'API changes detected but no README update found',
                    suggestion: 'Update README.md to document API changes'
                });
            }
        }
        
        if (issues.length > 0) {
            this.addReviewComment(filePath, 'Documentation Analysis', issues);
        }
    }
    
    // Check code style
    async checkCodeStyle(filePath, content) {
        try {
            // Run ESLint for style issues
            const eslintOutput = execSync(
                `npx eslint ${filePath} --format=json`,
                { encoding: 'utf8', cwd: this.config.repoPath, stdio: 'pipe' }
            );
            
            const results = JSON.parse(eslintOutput);
            const issues = [];
            
            results.forEach(result => {
                result.messages.forEach(message => {
                    if (message.severity === 2) { // Error level
                        issues.push({
                            type: 'style',
                            severity: 'medium',
                            line: message.line,
                            column: message.column,
                            message: message.message,
                            ruleId: message.ruleId,
                            suggestion: 'Fix ESLint error'
                        });
                    }
                });
            });
            
            if (issues.length > 0) {
                this.addReviewComment(filePath, 'Code Style Analysis', issues);
            }
            
        } catch (error) {
            // ESLint might fail, but don't block the review
            console.warn(`Style analysis failed for ${filePath}:`, error.message);
        }
    }
    
    // Analyze React components
    async analyzeReactFile(filePath, content) {
        await this.analyzeJavaScriptFile(filePath, content);
        
        const issues = [];
        
        // Check for React-specific issues
        if (content.includes('useState') && !content.includes('useEffect')) {
            issues.push({
                type: 'react',
                severity: 'low',
                message: 'Component uses state but no effects - consider if cleanup is needed',
                suggestion: 'Add useEffect for cleanup if necessary'
            });
        }
        
        // Check for key prop in lists
        if (content.includes('.map(') && !content.includes('key=')) {
            issues.push({
                type: 'react',
                severity: 'medium',
                message: 'Missing key prop in list rendering',
                suggestion: 'Add unique key prop to list items'
            });
        }
        
        if (issues.length > 0) {
            this.addReviewComment(filePath, 'React Analysis', issues);
        }
    }
    
    // Analyze JSON files
    async analyzeJSONFile(filePath, content) {
        try {
            JSON.parse(content);
        } catch (error) {
            this.addReviewComment(filePath, 'JSON Validation', [{
                type: 'syntax',
                severity: 'high',
                message: 'Invalid JSON syntax',
                suggestion: 'Fix JSON syntax errors'
            }]);
        }
    }
    
    // Analyze Markdown files
    async analyzeMarkdownFile(filePath, content) {
        const issues = [];
        
        // Check for broken links (basic check)
        const links = content.match(/\[.*?\]\(.*?\)/g) || [];
        links.forEach(link => {
            const url = link.match(/\((.+?)\)/)[1];
            if (url.startsWith('http') && !this.isValidUrl(url)) {
                issues.push({
                    type: 'documentation',
                    severity: 'low',
                    message: `Potentially broken link: ${url}`,
                    suggestion: 'Verify link is accessible'
                });
            }
        });
        
        if (issues.length > 0) {
            this.addReviewComment(filePath, 'Documentation Review', issues);
        }
    }
    
    // Perform overall analysis
    async performOverallAnalysis() {
        const issues = [];
        
        // Check overall metrics
        if (this.metrics.filesChanged > 20) {
            issues.push({
                type: 'change-size',
                severity: 'medium',
                message: `Large changeset: ${this.metrics.filesChanged} files changed`,
                suggestion: 'Consider breaking this into smaller, focused pull requests'
            });
        }
        
        if (this.metrics.securityIssues > 0) {
            issues.push({
                type: 'security',
                severity: 'high',
                message: `${this.metrics.securityIssues} security issues found`,
                suggestion: 'Address all security issues before merging'
            });
        }
        
        if (this.metrics.complexityScore > 10) {
            issues.push({
                type: 'complexity',
                severity: 'medium',
                message: 'High overall complexity detected',
                suggestion: 'Consider refactoring complex functions'
            });
        }
        
        if (issues.length > 0) {
            this.addReviewComment('OVERALL', 'Overall Analysis', issues);
        }
    }
    
    // Generate review summary
    async generateReviewSummary() {
        const summary = {
            timestamp: new Date().toISOString(),
            pullRequestId: this.config.pullRequestId,
            metrics: this.metrics,
            totalIssues: this.reviewComments.length,
            issuesByType: this.getIssuesByType(),
            issuesBySeverity: this.getIssuesBySeverity(),
            recommendations: this.generateRecommendations(),
            approvalStatus: this.determineApprovalStatus()
        };
        
        // Save summary to file
        const summaryPath = path.join(this.config.repoPath, 'review-summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        
        return summary;
    }
    
    // Post review comments to GitHub
    async postReviewComments() {
        if (!this.config.githubToken || !this.config.pullRequestId) {
            console.log('GitHub integration not configured, skipping comment posting');
            return;
        }
        
        try {
            const { Octokit } = require('@octokit/rest');
            const octokit = new Octokit({ auth: this.config.githubToken });
            
            const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
            
            // Post overall review
            const reviewBody = this.formatReviewBody();
            
            await octokit.pulls.createReview({
                owner,
                repo,
                pull_number: this.config.pullRequestId,
                body: reviewBody,
                event: this.determineReviewEvent(),
                comments: this.formatInlineComments()
            });
            
            console.log('Review comments posted to GitHub');
            
        } catch (error) {
            console.error('Failed to post review comments:', error);
        }
    }
    
    // Helper methods
    addReviewComment(file, category, issues) {
        this.reviewComments.push({
            file,
            category,
            issues,
            timestamp: new Date().toISOString()
        });
    }
    
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }
    
    findTestFile(filePath) {
        const dir = path.dirname(filePath);
        const name = path.basename(filePath, path.extname(filePath));
        
        const possibleTestFiles = [
            path.join(dir, `${name}.test.js`),
            path.join(dir, `${name}.test.ts`),
            path.join(dir, `${name}.spec.js`),
            path.join(dir, `${name}.spec.ts`),
            path.join(dir, '__tests__', `${name}.test.js`),
            path.join(dir, '__tests__', `${name}.test.ts`)
        ];
        
        return possibleTestFiles.find(testFile => 
            fs.existsSync(path.join(this.config.repoPath, testFile))
        );
    }
    
    suggestTestFileName(filePath) {
        const dir = path.dirname(filePath);
        const name = path.basename(filePath, path.extname(filePath));
        const ext = path.extname(filePath);
        
        return path.join(dir, `${name}.test${ext}`);
    }
    
    hasReadmeUpdate() {
        try {
            const diffOutput = execSync(
                `git diff --name-only ${this.config.baseBranch}..HEAD`,
                { encoding: 'utf8', cwd: this.config.repoPath }
            );
            
            return diffOutput.toLowerCase().includes('readme');
        } catch (error) {
            return false;
        }
    }
    
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }
    
    getIssuesByType() {
        const typeCount = {};
        this.reviewComments.forEach(comment => {
            comment.issues.forEach(issue => {
                typeCount[issue.type] = (typeCount[issue.type] || 0) + 1;
            });
        });
        return typeCount;
    }
    
    getIssuesBySeverity() {
        const severityCount = {};
        this.reviewComments.forEach(comment => {
            comment.issues.forEach(issue => {
                severityCount[issue.severity] = (severityCount[issue.severity] || 0) + 1;
            });
        });
        return severityCount;
    }
    
    generateRecommendations() {
        const recommendations = [];
        
        if (this.metrics.securityIssues > 0) {
            recommendations.push('Address all security issues before merging');
        }
        
        if (this.metrics.complexityScore > 10) {
            recommendations.push('Refactor complex functions to improve maintainability');
        }
        
        if (this.metrics.testCoverage < 80) {
            recommendations.push('Increase test coverage to meet quality standards');
        }
        
        return recommendations;
    }
    
    determineApprovalStatus() {
        const criticalIssues = this.reviewComments.some(comment =>
            comment.issues.some(issue => 
                issue.severity === 'high' && issue.type === 'security'
            )
        );
        
        if (criticalIssues) {
            return 'CHANGES_REQUESTED';
        }
        
        const mediumIssues = this.reviewComments.some(comment =>
            comment.issues.some(issue => issue.severity === 'medium')
        );
        
        if (mediumIssues) {
            return 'REVIEW_REQUIRED';
        }
        
        return 'APPROVED';
    }
    
    determineReviewEvent() {
        const status = this.determineApprovalStatus();
        
        switch (status) {
            case 'CHANGES_REQUESTED':
                return 'REQUEST_CHANGES';
            case 'APPROVED':
                return 'APPROVE';
            default:
                return 'COMMENT';
        }
    }
    
    formatReviewBody() {
        const summary = `## 🤖 Automated Code Review Summary

**Files Changed:** ${this.metrics.filesChanged}
**Security Issues:** ${this.metrics.securityIssues}
**Performance Issues:** ${this.metrics.performanceIssues}
**Complexity Score:** ${this.metrics.complexityScore}

### Issues by Type
${Object.entries(this.getIssuesByType()).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

### Issues by Severity
${Object.entries(this.getIssuesBySeverity()).map(([severity, count]) => `- ${severity}: ${count}`).join('\n')}

### Recommendations
${this.generateRecommendations().map(rec => `- ${rec}`).join('\n')}

---
*This review was generated automatically. Please address the issues and re-run the review.*`;

        return summary;
    }
    
    formatInlineComments() {
        // Convert review comments to GitHub inline comment format
        return this.reviewComments
            .filter(comment => comment.file !== 'OVERALL')
            .map(comment => ({
                path: comment.file,
                line: comment.issues[0].line || 1,
                body: `**${comment.category}**\n\n${comment.issues.map(issue => 
                    `- **${issue.severity.toUpperCase()}**: ${issue.message}\n  *Suggestion: ${issue.suggestion}*`
                ).join('\n\n')}`
            }));
    }
}

// Main execution
if (require.main === module) {
    const config = {
        repoPath: process.argv[2] || process.cwd(),
        pullRequestId: process.argv[3] || process.env.GITHUB_PR_NUMBER,
        githubToken: process.env.GITHUB_TOKEN,
        baseBranch: process.argv[4] || 'main'
    };
    
    const reviewer = new AutomatedCodeReview(config);
    
    reviewer.performReview()
        .then(summary => {
            console.log('\n✅ Review completed successfully');
            console.log(`📊 Summary: ${summary.totalIssues} issues found`);
            console.log(`🔍 Approval Status: ${summary.approvalStatus}`);
            
            // Exit with error code if critical issues found
            if (summary.approvalStatus === 'CHANGES_REQUESTED') {
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Review failed:', error);
            process.exit(1);
        });
}

module.exports = AutomatedCodeReview;