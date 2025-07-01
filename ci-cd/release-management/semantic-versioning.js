#!/usr/bin/env node

/**
 * ROOTUIP Semantic Versioning and Release Management System
 * Automates version bumping, changelog generation, and release coordination
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const semver = require('semver');

class SemanticVersionManager {
    constructor(config = {}) {
        this.config = {
            repoPath: config.repoPath || process.cwd(),
            changelogFile: config.changelogFile || 'CHANGELOG.md',
            packageFile: config.packageFile || 'package.json',
            releaseNotesDir: config.releaseNotesDir || 'releases',
            branchPrefix: config.branchPrefix || 'release/',
            tagPrefix: config.tagPrefix || 'v',
            conventionalCommits: config.conventionalCommits !== false,
            ...config
        };
        
        this.packageInfo = this.loadPackageInfo();
        this.currentVersion = this.packageInfo.version;
        this.gitHistory = [];
        this.changeTypes = {
            'feat': { type: 'minor', label: 'Features', emoji: '✨' },
            'fix': { type: 'patch', label: 'Bug Fixes', emoji: '🐛' },
            'perf': { type: 'patch', label: 'Performance', emoji: '⚡' },
            'refactor': { type: 'patch', label: 'Refactoring', emoji: '♻️' },
            'docs': { type: 'patch', label: 'Documentation', emoji: '📚' },
            'style': { type: 'patch', label: 'Styling', emoji: '💄' },
            'test': { type: 'patch', label: 'Tests', emoji: '🧪' },
            'build': { type: 'patch', label: 'Build', emoji: '👷' },
            'ci': { type: 'patch', label: 'CI/CD', emoji: '🔧' },
            'chore': { type: 'patch', label: 'Maintenance', emoji: '🏠' },
            'revert': { type: 'patch', label: 'Reverts', emoji: '⏪' },
            'breaking': { type: 'major', label: 'Breaking Changes', emoji: '💥' }
        };
    }
    
    // Load package.json information
    loadPackageInfo() {
        const packagePath = path.join(this.config.repoPath, this.config.packageFile);
        
        if (!fs.existsSync(packagePath)) {
            throw new Error(`Package file not found: ${packagePath}`);
        }
        
        return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    }
    
    // Analyze commits since last release
    analyzeCommitsSinceLastRelease() {
        try {
            // Get last release tag
            let lastTag;
            try {
                lastTag = execSync('git describe --tags --abbrev=0', {
                    encoding: 'utf8',
                    cwd: this.config.repoPath
                }).trim();
            } catch (error) {
                // No tags found, use initial commit
                lastTag = execSync('git rev-list --max-parents=0 HEAD', {
                    encoding: 'utf8',
                    cwd: this.config.repoPath
                }).trim();
            }
            
            // Get commits since last tag
            const commitRange = lastTag ? `${lastTag}..HEAD` : 'HEAD';
            const commits = execSync(`git log ${commitRange} --pretty=format:"%H|%s|%b|%an|%ad" --date=iso`, {
                encoding: 'utf8',
                cwd: this.config.repoPath
            }).trim();
            
            if (!commits) {
                return [];
            }
            
            return commits.split('\n').map(line => {
                const [hash, subject, body, author, date] = line.split('|');
                const commit = this.parseConventionalCommit(subject, body);
                
                return {
                    hash: hash.substring(0, 8),
                    fullHash: hash,
                    subject,
                    body,
                    author,
                    date: new Date(date),
                    ...commit
                };
            });
            
        } catch (error) {
            console.error('Failed to analyze commits:', error);
            return [];
        }
    }
    
    // Parse conventional commit format
    parseConventionalCommit(subject, body = '') {
        const conventionalPattern = /^(\w+)(\(.+\))?(!)?:\s*(.+)/;
        const match = subject.match(conventionalPattern);
        
        if (!match) {
            return {
                type: 'unknown',
                scope: null,
                breaking: false,
                description: subject,
                isConventional: false
            };
        }
        
        const [, type, scope, breaking, description] = match;
        
        // Check for breaking changes in body
        const hasBreakingInBody = body.includes('BREAKING CHANGE:') || body.includes('BREAKING-CHANGE:');
        
        return {
            type: type.toLowerCase(),
            scope: scope ? scope.slice(1, -1) : null, // Remove parentheses
            breaking: !!breaking || hasBreakingInBody,
            description,
            isConventional: true,
            breakingDescription: hasBreakingInBody ? this.extractBreakingChange(body) : null
        };
    }
    
    // Extract breaking change description from commit body
    extractBreakingChange(body) {
        const breakingMatch = body.match(/BREAKING[-\s]CHANGE:\s*(.+)/i);
        return breakingMatch ? breakingMatch[1].trim() : null;
    }
    
    // Determine next version based on commits
    determineNextVersion(commits) {
        let versionBump = 'patch';
        
        for (const commit of commits) {
            if (commit.breaking) {
                versionBump = 'major';
                break;
            }
            
            const changeType = this.changeTypes[commit.type];
            if (changeType && changeType.type === 'minor' && versionBump === 'patch') {
                versionBump = 'minor';
            }
        }
        
        const nextVersion = semver.inc(this.currentVersion, versionBump);
        
        return {
            current: this.currentVersion,
            next: nextVersion,
            bump: versionBump,
            tag: `${this.config.tagPrefix}${nextVersion}`
        };
    }
    
    // Generate changelog content
    generateChangelog(commits, version) {
        const groupedCommits = this.groupCommitsByType(commits);
        const releaseDate = new Date().toISOString().split('T')[0];
        
        let changelog = `## [${version.next}](https://github.com/${this.getRepoUrl()}/compare/${this.config.tagPrefix}${version.current}...${version.tag}) (${releaseDate})\n\n`;
        
        // Breaking changes first
        const breakingChanges = commits.filter(c => c.breaking);
        if (breakingChanges.length > 0) {
            changelog += `### 💥 BREAKING CHANGES\n\n`;
            breakingChanges.forEach(commit => {
                changelog += `* ${commit.breakingDescription || commit.description} ([${commit.hash}](https://github.com/${this.getRepoUrl()}/commit/${commit.fullHash}))\n`;
            });
            changelog += '\n';
        }
        
        // Group other changes by type
        Object.entries(groupedCommits).forEach(([type, typeCommits]) => {
            if (typeCommits.length === 0) return;
            
            const changeType = this.changeTypes[type];
            if (!changeType) return;
            
            changelog += `### ${changeType.emoji} ${changeType.label}\n\n`;
            
            typeCommits.forEach(commit => {
                const scope = commit.scope ? `**${commit.scope}**: ` : '';
                changelog += `* ${scope}${commit.description} ([${commit.hash}](https://github.com/${this.getRepoUrl()}/commit/${commit.fullHash}))\n`;
            });
            
            changelog += '\n';
        });
        
        // Contributors
        const contributors = [...new Set(commits.map(c => c.author))];
        if (contributors.length > 0) {
            changelog += `### 👥 Contributors\n\n`;
            contributors.forEach(contributor => {
                changelog += `* ${contributor}\n`;
            });
            changelog += '\n';
        }
        
        return changelog;
    }
    
    // Group commits by type
    groupCommitsByType(commits) {
        const grouped = {};
        
        Object.keys(this.changeTypes).forEach(type => {
            grouped[type] = commits.filter(c => c.type === type && !c.breaking);
        });
        
        return grouped;
    }
    
    // Update CHANGELOG.md file
    updateChangelogFile(newContent) {
        const changelogPath = path.join(this.config.repoPath, this.config.changelogFile);
        
        let existingContent = '';
        if (fs.existsSync(changelogPath)) {
            existingContent = fs.readFileSync(changelogPath, 'utf8');
        } else {
            existingContent = `# Changelog\n\nAll notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\nand this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n`;
        }
        
        // Insert new content after the header
        const lines = existingContent.split('\n');
        const headerEndIndex = lines.findIndex(line => line.startsWith('## '));
        
        if (headerEndIndex === -1) {
            // No existing releases, append after header
            const headerLines = lines.slice(0, -1); // Remove last empty line
            const updatedContent = [...headerLines, '', newContent.trim(), ''].join('\n');
            fs.writeFileSync(changelogPath, updatedContent);
        } else {
            // Insert before first release
            const beforeRelease = lines.slice(0, headerEndIndex);
            const afterHeader = lines.slice(headerEndIndex);
            const updatedContent = [...beforeRelease, newContent.trim(), '', ...afterHeader].join('\n');
            fs.writeFileSync(changelogPath, updatedContent);
        }
        
        console.log(`✅ Updated ${this.config.changelogFile}`);
    }
    
    // Update package.json version
    updatePackageVersion(newVersion) {
        const packagePath = path.join(this.config.repoPath, this.config.packageFile);
        const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        packageData.version = newVersion;
        
        fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');
        console.log(`✅ Updated ${this.config.packageFile} to version ${newVersion}`);
    }
    
    // Generate release notes
    generateReleaseNotes(commits, version) {
        const releaseNotesPath = path.join(
            this.config.repoPath,
            this.config.releaseNotesDir,
            `${version.next}.md`
        );
        
        // Ensure release notes directory exists
        const releaseNotesDir = path.dirname(releaseNotesPath);
        if (!fs.existsSync(releaseNotesDir)) {
            fs.mkdirSync(releaseNotesDir, { recursive: true });
        }
        
        const releaseDate = new Date().toISOString().split('T')[0];
        const groupedCommits = this.groupCommitsByType(commits);
        
        let releaseNotes = `# ROOTUIP ${version.next} Release Notes\n\n`;
        releaseNotes += `**Release Date:** ${releaseDate}\n`;
        releaseNotes += `**Version:** ${version.next}\n`;
        releaseNotes += `**Tag:** ${version.tag}\n\n`;
        
        // Executive summary
        releaseNotes += `## Executive Summary\n\n`;
        releaseNotes += this.generateExecutiveSummary(commits, version);
        releaseNotes += `\n\n`;
        
        // What's new
        const features = groupedCommits.feat || [];
        if (features.length > 0) {
            releaseNotes += `## ✨ What's New\n\n`;
            features.forEach(commit => {
                releaseNotes += `### ${commit.description}\n`;
                if (commit.body) {
                    releaseNotes += `${commit.body}\n`;
                }
                releaseNotes += `\n`;
            });
        }
        
        // Breaking changes
        const breakingChanges = commits.filter(c => c.breaking);
        if (breakingChanges.length > 0) {
            releaseNotes += `## 💥 Breaking Changes\n\n`;
            releaseNotes += `⚠️ **Important:** This release contains breaking changes that may require updates to your integration.\n\n`;
            
            breakingChanges.forEach(commit => {
                releaseNotes += `### ${commit.description}\n`;
                if (commit.breakingDescription) {
                    releaseNotes += `**Breaking Change:** ${commit.breakingDescription}\n\n`;
                }
                if (commit.body) {
                    releaseNotes += `${commit.body}\n\n`;
                }
            });
            
            releaseNotes += `### Migration Guide\n\n`;
            releaseNotes += this.generateMigrationGuide(breakingChanges);
            releaseNotes += `\n\n`;
        }
        
        // Bug fixes
        const bugFixes = groupedCommits.fix || [];
        if (bugFixes.length > 0) {
            releaseNotes += `## 🐛 Bug Fixes\n\n`;
            bugFixes.forEach(commit => {
                const scope = commit.scope ? `**${commit.scope}**: ` : '';
                releaseNotes += `* ${scope}${commit.description}\n`;
            });
            releaseNotes += `\n`;
        }
        
        // Performance improvements
        const perfImprovements = groupedCommits.perf || [];
        if (perfImprovements.length > 0) {
            releaseNotes += `## ⚡ Performance Improvements\n\n`;
            perfImprovements.forEach(commit => {
                const scope = commit.scope ? `**${commit.scope}**: ` : '';
                releaseNotes += `* ${scope}${commit.description}\n`;
            });
            releaseNotes += `\n`;
        }
        
        // Technical details
        releaseNotes += `## 🔧 Technical Details\n\n`;
        releaseNotes += `### Dependencies\n`;
        releaseNotes += this.generateDependencyInfo();
        releaseNotes += `\n\n`;
        
        releaseNotes += `### Deployment\n`;
        releaseNotes += `This release will be deployed using our blue-green deployment strategy with the following schedule:\n\n`;
        releaseNotes += `* **Development:** Automatic upon merge\n`;
        releaseNotes += `* **Staging:** After approval and validation\n`;
        releaseNotes += `* **Production:** Canary deployment starting at 10% traffic\n\n`;
        
        // Full changelog
        releaseNotes += `## 📝 Full Changelog\n\n`;
        releaseNotes += `**Compare:** [${version.current}...${version.next}](https://github.com/${this.getRepoUrl()}/compare/${this.config.tagPrefix}${version.current}...${version.tag})\n\n`;
        
        // All changes
        Object.entries(groupedCommits).forEach(([type, typeCommits]) => {
            if (typeCommits.length === 0) return;
            
            const changeType = this.changeTypes[type];
            if (!changeType) return;
            
            releaseNotes += `### ${changeType.emoji} ${changeType.label}\n`;
            typeCommits.forEach(commit => {
                const scope = commit.scope ? `**${commit.scope}**: ` : '';
                releaseNotes += `* ${scope}${commit.description} ([${commit.hash}](https://github.com/${this.getRepoUrl()}/commit/${commit.fullHash}))\n`;
            });
            releaseNotes += `\n`;
        });
        
        // Contributors
        const contributors = [...new Set(commits.map(c => c.author))];
        releaseNotes += `## 👥 Contributors\n\n`;
        releaseNotes += `Thank you to all contributors who made this release possible:\n\n`;
        contributors.forEach(contributor => {
            releaseNotes += `* ${contributor}\n`;
        });
        
        fs.writeFileSync(releaseNotesPath, releaseNotes);
        console.log(`✅ Generated release notes: ${releaseNotesPath}`);
        
        return releaseNotesPath;
    }
    
    // Generate executive summary
    generateExecutiveSummary(commits, version) {
        const features = commits.filter(c => c.type === 'feat').length;
        const bugFixes = commits.filter(c => c.type === 'fix').length;
        const breakingChanges = commits.filter(c => c.breaking).length;
        
        let summary = `ROOTUIP ${version.next} introduces `;
        
        if (features > 0) {
            summary += `${features} new feature${features > 1 ? 's' : ''}`;
        }
        
        if (bugFixes > 0) {
            if (features > 0) summary += ', ';
            summary += `${bugFixes} bug fix${bugFixes > 1 ? 'es' : ''}`;
        }
        
        if (breakingChanges > 0) {
            if (features > 0 || bugFixes > 0) summary += ', and ';
            summary += `${breakingChanges} breaking change${breakingChanges > 1 ? 's' : ''}`;
        }
        
        summary += `. This ${version.bump} release enhances platform capabilities while maintaining enterprise-grade reliability and security.`;
        
        return summary;
    }
    
    // Generate migration guide for breaking changes
    generateMigrationGuide(breakingChanges) {
        let guide = `Please review the following changes and update your integration accordingly:\n\n`;
        
        breakingChanges.forEach((commit, index) => {
            guide += `${index + 1}. **${commit.description}**\n`;
            if (commit.breakingDescription) {
                guide += `   ${commit.breakingDescription}\n`;
            }
            guide += `\n`;
        });
        
        guide += `For detailed migration instructions, please refer to our [Migration Guide](https://docs.rootuip.com/migration) or contact support.`;
        
        return guide;
    }
    
    // Generate dependency information
    generateDependencyInfo() {
        try {
            const dependencies = this.packageInfo.dependencies || {};
            const devDependencies = this.packageInfo.devDependencies || {};
            
            let info = `**Production Dependencies:** ${Object.keys(dependencies).length}\n`;
            info += `**Development Dependencies:** ${Object.keys(devDependencies).length}\n`;
            info += `**Node.js:** ${this.packageInfo.engines?.node || 'Latest LTS'}\n`;
            info += `**npm:** ${this.packageInfo.engines?.npm || 'Latest'}\n`;
            
            return info;
        } catch (error) {
            return 'Dependency information not available';
        }
    }
    
    // Create release branch
    createReleaseBranch(version) {
        const branchName = `${this.config.branchPrefix}${version.next}`;
        
        try {
            // Create and checkout release branch
            execSync(`git checkout -b ${branchName}`, {
                cwd: this.config.repoPath
            });
            
            console.log(`✅ Created release branch: ${branchName}`);
            return branchName;
        } catch (error) {
            console.error(`Failed to create release branch: ${error.message}`);
            throw error;
        }
    }
    
    // Commit release changes
    commitReleaseChanges(version) {
        try {
            // Stage changes
            execSync(`git add ${this.config.packageFile} ${this.config.changelogFile}`, {
                cwd: this.config.repoPath
            });
            
            // Commit changes
            const commitMessage = `chore(release): prepare ${version.next}\n\n* Update version to ${version.next}\n* Update CHANGELOG.md\n* Generate release notes`;
            
            execSync(`git commit -m "${commitMessage}"`, {
                cwd: this.config.repoPath
            });
            
            console.log(`✅ Committed release changes`);
        } catch (error) {
            console.error(`Failed to commit release changes: ${error.message}`);
            throw error;
        }
    }
    
    // Create and push release tag
    createReleaseTag(version, releaseNotesPath) {
        try {
            // Read release notes for tag message
            const releaseNotes = fs.readFileSync(releaseNotesPath, 'utf8');
            const shortNotes = releaseNotes.split('\n').slice(0, 10).join('\n') + '\n\n...';
            
            // Create annotated tag
            execSync(`git tag -a ${version.tag} -m "${shortNotes}"`, {
                cwd: this.config.repoPath
            });
            
            console.log(`✅ Created release tag: ${version.tag}`);
            
            // Push tag to origin
            execSync(`git push origin ${version.tag}`, {
                cwd: this.config.repoPath
            });
            
            console.log(`✅ Pushed tag to origin`);
            
        } catch (error) {
            console.error(`Failed to create/push release tag: ${error.message}`);
            throw error;
        }
    }
    
    // Get repository URL for links
    getRepoUrl() {
        try {
            const remoteUrl = execSync('git config --get remote.origin.url', {
                encoding: 'utf8',
                cwd: this.config.repoPath
            }).trim();
            
            // Convert SSH to HTTPS format for GitHub
            if (remoteUrl.startsWith('git@github.com:')) {
                return remoteUrl.replace('git@github.com:', '').replace('.git', '');
            }
            
            // Extract from HTTPS URL
            if (remoteUrl.includes('github.com')) {
                return remoteUrl.replace('https://github.com/', '').replace('.git', '');
            }
            
            return 'rootuip/platform'; // Fallback
        } catch (error) {
            return 'rootuip/platform'; // Fallback
        }
    }
    
    // Generate customer notification content
    generateCustomerNotification(version, releaseNotesPath) {
        const releaseNotes = fs.readFileSync(releaseNotesPath, 'utf8');
        const features = releaseNotes.match(/## ✨ What's New([\s\S]*?)(?=##|$)/);
        const bugFixes = releaseNotes.match(/## 🐛 Bug Fixes([\s\S]*?)(?=##|$)/);
        const breakingChanges = releaseNotes.match(/## 💥 Breaking Changes([\s\S]*?)(?=##|$)/);
        
        let notification = `Subject: ROOTUIP ${version.next} Release - Enhanced Platform Capabilities\n\n`;
        notification += `Dear ROOTUIP Customer,\n\n`;
        notification += `We're excited to announce the release of ROOTUIP ${version.next}, bringing enhanced capabilities to your logistics operations.\n\n`;
        
        if (features) {
            notification += `🎉 NEW FEATURES:\n`;
            notification += features[1].trim().replace(/###/g, '•').substring(0, 500) + '\n\n';
        }
        
        if (bugFixes) {
            notification += `🔧 IMPROVEMENTS:\n`;
            notification += `This release includes important bug fixes and performance improvements.\n\n`;
        }
        
        if (breakingChanges) {
            notification += `⚠️ IMPORTANT NOTICE:\n`;
            notification += `This release contains changes that may require updates to your integration. Please review our migration guide.\n\n`;
        }
        
        notification += `📅 DEPLOYMENT SCHEDULE:\n`;
        notification += `• Staging Environment: Available now for testing\n`;
        notification += `• Production Deployment: Rolling out over the next 24 hours\n\n`;
        
        notification += `📖 FULL RELEASE NOTES:\n`;
        notification += `View complete details at: https://github.com/${this.getRepoUrl()}/releases/tag/${version.tag}\n\n`;
        
        notification += `🆘 SUPPORT:\n`;
        notification += `If you have any questions or need assistance, please contact our support team.\n\n`;
        
        notification += `Thank you for choosing ROOTUIP!\n\n`;
        notification += `Best regards,\n`;
        notification += `The ROOTUIP Team`;
        
        return notification;
    }
    
    // Main release process
    async performRelease(options = {}) {
        const {
            dryRun = false,
            skipBranch = false,
            skipTag = false,
            skipNotification = false
        } = options;
        
        console.log('🚀 Starting ROOTUIP release process...');
        
        try {
            // Analyze commits
            console.log('📝 Analyzing commits since last release...');
            const commits = this.analyzeCommitsSinceLastRelease();
            
            if (commits.length === 0) {
                console.log('ℹ️ No commits found since last release');
                return null;
            }
            
            console.log(`Found ${commits.length} commits`);
            
            // Determine next version
            const version = this.determineNextVersion(commits);
            console.log(`📊 Version bump: ${version.current} → ${version.next} (${version.bump})`);
            
            if (dryRun) {
                console.log('🔍 Dry run mode - no changes will be made');
                console.log('Commits:', commits.map(c => `${c.type}: ${c.description}`));
                return { version, commits, dryRun: true };
            }
            
            // Create release branch
            let releaseBranch;
            if (!skipBranch) {
                releaseBranch = this.createReleaseBranch(version);
            }
            
            // Update version in package.json
            this.updatePackageVersion(version.next);
            
            // Generate and update changelog
            const changelogContent = this.generateChangelog(commits, version);
            this.updateChangelogFile(changelogContent);
            
            // Generate release notes
            const releaseNotesPath = this.generateReleaseNotes(commits, version);
            
            // Commit changes
            this.commitReleaseChanges(version);
            
            // Create and push tag
            if (!skipTag) {
                this.createReleaseTag(version, releaseNotesPath);
            }
            
            // Generate customer notification
            if (!skipNotification) {
                const notification = this.generateCustomerNotification(version, releaseNotesPath);
                const notificationPath = path.join(
                    this.config.repoPath,
                    this.config.releaseNotesDir,
                    `${version.next}-notification.txt`
                );
                fs.writeFileSync(notificationPath, notification);
                console.log(`✅ Generated customer notification: ${notificationPath}`);
            }
            
            console.log(`🎉 Release ${version.next} completed successfully!`);
            
            return {
                version,
                commits,
                releaseNotesPath,
                releaseBranch,
                success: true
            };
            
        } catch (error) {
            console.error('❌ Release process failed:', error);
            throw error;
        }
    }
}

// CLI interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        dryRun: args.includes('--dry-run'),
        skipBranch: args.includes('--skip-branch'),
        skipTag: args.includes('--skip-tag'),
        skipNotification: args.includes('--skip-notification')
    };
    
    const config = {
        repoPath: process.cwd()
    };
    
    const versionManager = new SemanticVersionManager(config);
    
    versionManager.performRelease(options)
        .then(result => {
            if (result) {
                console.log('\n📋 Release Summary:');
                console.log(`Version: ${result.version.current} → ${result.version.next}`);
                console.log(`Commits: ${result.commits.length}`);
                if (result.releaseNotesPath) {
                    console.log(`Release Notes: ${result.releaseNotesPath}`);
                }
            }
        })
        .catch(error => {
            console.error('Release failed:', error);
            process.exit(1);
        });
}

module.exports = SemanticVersionManager;