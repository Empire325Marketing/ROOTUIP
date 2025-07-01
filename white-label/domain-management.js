#!/usr/bin/env node

/**
 * ROOTUIP Domain Management System
 * Handles custom domain configuration, SSL certificates, and routing
 */

const dns = require('dns').promises;
const AWS = require('aws-sdk');
const { CloudFront, Route53, ACM } = require('aws-sdk');
const crypto = require('crypto');

class DomainManagementSystem {
    constructor(config = {}) {
        this.config = {
            hostedZoneId: config.hostedZoneId || process.env.ROUTE53_HOSTED_ZONE_ID,
            certificateArn: config.certificateArn || process.env.ACM_CERTIFICATE_ARN,
            cloudfrontDistributionId: config.cloudfrontDistributionId || process.env.CLOUDFRONT_DISTRIBUTION_ID,
            defaultDomain: config.defaultDomain || 'rootuip.com',
            ...config
        };
        
        this.cloudfront = new CloudFront({
            region: 'us-east-1' // CloudFront is global but API is in us-east-1
        });
        
        this.route53 = new Route53();
        this.acm = new ACM({ region: 'us-east-1' });
        
        this.domainCache = new Map();
        this.verificationAttempts = new Map();
    }
    
    // Add custom domain for tenant
    async addCustomDomain(tenantId, domain, options = {}) {
        try {
            console.log(`Adding custom domain ${domain} for tenant ${tenantId}`);
            
            // Validate domain
            await this.validateDomain(domain);
            
            // Check if domain already exists
            const existingDomain = await this.getDomainConfig(domain);
            if (existingDomain && existingDomain.tenantId !== tenantId) {
                throw new Error(`Domain ${domain} is already configured for another tenant`);
            }
            
            // Create domain configuration
            const domainConfig = {
                domain,
                tenantId,
                status: 'pending_verification',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                
                // SSL configuration
                ssl: {
                    enabled: options.ssl !== false,
                    autoRenew: options.autoRenew !== false,
                    certificateArn: null,
                    status: 'pending'
                },
                
                // CDN configuration
                cdn: {
                    enabled: options.cdn !== false,
                    distributionId: null,
                    distributionDomain: null,
                    cachePolicy: options.cachePolicy || 'default'
                },
                
                // Subdomain configuration
                subdomains: options.subdomains || {
                    www: true,
                    api: true,
                    admin: false
                },
                
                // Redirect configuration
                redirects: options.redirects || {
                    wwwToNonWww: false,
                    httpToHttps: true
                }
            };
            
            // Generate domain verification token
            const verificationToken = this.generateVerificationToken();
            domainConfig.verification = {
                token: verificationToken,
                method: 'dns',
                records: [
                    {
                        name: `_rootuip-verification.${domain}`,
                        type: 'TXT',
                        value: verificationToken,
                        ttl: 300
                    }
                ]
            };
            
            // Save domain configuration
            await this.saveDomainConfig(domain, domainConfig);
            
            // Start verification process
            await this.startDomainVerification(domain, domainConfig);
            
            console.log(`Custom domain configuration created for ${domain}`);
            return {
                success: true,
                domain,
                config: domainConfig,
                verificationInstructions: this.getVerificationInstructions(domainConfig)
            };
            
        } catch (error) {
            console.error(`Error adding custom domain: ${error.message}`);
            throw error;
        }
    }
    
    // Validate domain
    async validateDomain(domain) {
        // Check domain format
        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
        if (!domainRegex.test(domain)) {
            throw new Error(`Invalid domain format: ${domain}`);
        }
        
        // Check if domain resolves
        try {
            await dns.lookup(domain);
        } catch (error) {
            console.warn(`Domain ${domain} does not currently resolve - this is normal for new domains`);
        }
        
        // Check for prohibited domains
        const prohibitedDomains = [
            'localhost',
            'rootuip.com',
            'app.rootuip.com',
            'api.rootuip.com',
            'admin.rootuip.com'
        ];
        
        if (prohibitedDomains.includes(domain.toLowerCase())) {
            throw new Error(`Domain ${domain} is not allowed`);
        }
    }
    
    // Start domain verification process
    async startDomainVerification(domain, domainConfig) {
        try {
            console.log(`Starting verification for domain: ${domain}`);
            
            // Check verification records
            const verificationStatus = await this.checkVerificationRecords(domain, domainConfig.verification.records);
            
            if (verificationStatus.verified) {
                // Domain is verified, proceed with setup
                await this.completeDomainSetup(domain, domainConfig);
            } else {
                // Schedule verification check
                this.scheduleVerificationCheck(domain);
            }
            
            return verificationStatus;
            
        } catch (error) {
            console.error(`Error starting domain verification: ${error.message}`);
            throw error;
        }
    }
    
    // Check verification records
    async checkVerificationRecords(domain, records) {
        try {
            const verificationResults = [];
            
            for (const record of records) {
                try {
                    const dnsRecords = await dns.resolveTxt(record.name);
                    const found = dnsRecords.some(txtRecord => 
                        txtRecord.join('').includes(record.value)
                    );
                    
                    verificationResults.push({
                        name: record.name,
                        type: record.type,
                        expected: record.value,
                        found,
                        status: found ? 'verified' : 'pending'
                    });
                    
                } catch (error) {
                    verificationResults.push({
                        name: record.name,
                        type: record.type,
                        expected: record.value,
                        found: false,
                        status: 'not_found',
                        error: error.message
                    });
                }
            }
            
            const allVerified = verificationResults.every(result => result.found);
            
            return {
                verified: allVerified,
                results: verificationResults,
                checkedAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Error checking verification records: ${error.message}`);
            throw error;
        }
    }
    
    // Complete domain setup after verification
    async completeDomainSetup(domain, domainConfig) {
        try {
            console.log(`Completing domain setup for: ${domain}`);
            
            // Request SSL certificate
            if (domainConfig.ssl.enabled) {
                const certificateArn = await this.requestSSLCertificate(domain, domainConfig.subdomains);
                domainConfig.ssl.certificateArn = certificateArn;
                domainConfig.ssl.status = 'issued';
            }
            
            // Create CloudFront distribution
            if (domainConfig.cdn.enabled) {
                const distribution = await this.createCloudFrontDistribution(domain, domainConfig);
                domainConfig.cdn.distributionId = distribution.Id;
                domainConfig.cdn.distributionDomain = distribution.DomainName;
            }
            
            // Create DNS records
            await this.createDNSRecords(domain, domainConfig);
            
            // Update status
            domainConfig.status = 'active';
            domainConfig.activatedAt = new Date().toISOString();
            domainConfig.updatedAt = new Date().toISOString();
            
            // Save updated configuration
            await this.saveDomainConfig(domain, domainConfig);
            
            // Update cache
            this.domainCache.set(domain, domainConfig);
            
            console.log(`Domain setup completed for: ${domain}`);
            return domainConfig;
            
        } catch (error) {
            console.error(`Error completing domain setup: ${error.message}`);
            
            // Update status to failed
            domainConfig.status = 'failed';
            domainConfig.error = error.message;
            domainConfig.updatedAt = new Date().toISOString();
            await this.saveDomainConfig(domain, domainConfig);
            
            throw error;
        }
    }
    
    // Request SSL certificate
    async requestSSLCertificate(domain, subdomains = {}) {
        try {
            console.log(`Requesting SSL certificate for: ${domain}`);
            
            // Build domain list
            const domainList = [domain];
            
            // Add subdomains
            if (subdomains.www) domainList.push(`www.${domain}`);
            if (subdomains.api) domainList.push(`api.${domain}`);
            if (subdomains.admin) domainList.push(`admin.${domain}`);
            
            // Request certificate
            const params = {
                DomainName: domain,
                SubjectAlternativeNames: domainList.slice(1), // Exclude primary domain
                ValidationMethod: 'DNS',
                Tags: [
                    {
                        Key: 'Service',
                        Value: 'ROOTUIP'
                    },
                    {
                        Key: 'Domain',
                        Value: domain
                    }
                ]
            };
            
            const result = await this.acm.requestCertificate(params).promise();
            
            console.log(`SSL certificate requested: ${result.CertificateArn}`);
            return result.CertificateArn;
            
        } catch (error) {
            console.error(`Error requesting SSL certificate: ${error.message}`);
            throw error;
        }
    }
    
    // Create CloudFront distribution
    async createCloudFrontDistribution(domain, domainConfig) {
        try {
            console.log(`Creating CloudFront distribution for: ${domain}`);
            
            const originDomain = `${domainConfig.tenantId}.${this.config.defaultDomain}`;
            
            const params = {
                DistributionConfig: {
                    CallerReference: `${domain}-${Date.now()}`,
                    Comment: `ROOTUIP White-label distribution for ${domain}`,
                    Enabled: true,
                    
                    // Origins
                    Origins: {
                        Quantity: 1,
                        Items: [
                            {
                                Id: 'rootuip-origin',
                                DomainName: originDomain,
                                CustomOriginConfig: {
                                    HTTPPort: 443,
                                    HTTPSPort: 443,
                                    OriginProtocolPolicy: 'https-only',
                                    OriginSslProtocols: {
                                        Quantity: 1,
                                        Items: ['TLSv1.2']
                                    }
                                },
                                OriginPath: '',
                                ConnectionAttempts: 3,
                                ConnectionTimeout: 10
                            }
                        ]
                    },
                    
                    // Default cache behavior
                    DefaultCacheBehavior: {
                        TargetOriginId: 'rootuip-origin',
                        ViewerProtocolPolicy: 'redirect-to-https',
                        MinTTL: 0,
                        ForwardedValues: {
                            QueryString: true,
                            Cookies: {
                                Forward: 'all'
                            },
                            Headers: {
                                Quantity: 3,
                                Items: ['Host', 'Authorization', 'CloudFront-Forwarded-Proto']
                            }
                        },
                        TrustedSigners: {
                            Enabled: false,
                            Quantity: 0
                        },
                        Compress: true
                    },
                    
                    // Cache behaviors
                    CacheBehaviors: {
                        Quantity: 2,
                        Items: [
                            // API requests - no caching
                            {
                                PathPattern: '/api/*',
                                TargetOriginId: 'rootuip-origin',
                                ViewerProtocolPolicy: 'https-only',
                                MinTTL: 0,
                                MaxTTL: 0,
                                DefaultTTL: 0,
                                ForwardedValues: {
                                    QueryString: true,
                                    Cookies: { Forward: 'all' },
                                    Headers: { Quantity: 1, Items: ['*'] }
                                }
                            },
                            // Static assets - long caching
                            {
                                PathPattern: '/assets/*',
                                TargetOriginId: 'rootuip-origin',
                                ViewerProtocolPolicy: 'https-only',
                                MinTTL: 86400,
                                MaxTTL: 31536000,
                                DefaultTTL: 86400,
                                ForwardedValues: {
                                    QueryString: false,
                                    Cookies: { Forward: 'none' }
                                },
                                Compress: true
                            }
                        ]
                    },
                    
                    // Aliases
                    Aliases: {
                        Quantity: 1,
                        Items: [domain]
                    },
                    
                    // SSL certificate
                    ViewerCertificate: domainConfig.ssl.certificateArn ? {
                        ACMCertificateArn: domainConfig.ssl.certificateArn,
                        SSLSupportMethod: 'sni-only',
                        MinimumProtocolVersion: 'TLSv1.2_2021'
                    } : {
                        CloudFrontDefaultCertificate: true
                    },
                    
                    // Error pages
                    CustomErrorResponses: {
                        Quantity: 2,
                        Items: [
                            {
                                ErrorCode: 404,
                                ResponseCode: 200,
                                ResponsePagePath: '/index.html',
                                ErrorCachingMinTTL: 300
                            },
                            {
                                ErrorCode: 403,
                                ResponseCode: 200,
                                ResponsePagePath: '/index.html',
                                ErrorCachingMinTTL: 300
                            }
                        ]
                    },
                    
                    // Geo restrictions
                    Restrictions: {
                        GeoRestriction: {
                            RestrictionType: 'none'
                        }
                    },
                    
                    // Logging
                    Logging: {
                        Enabled: true,
                        IncludeCookies: false,
                        Bucket: `${this.config.logsBucket}.s3.amazonaws.com`,
                        Prefix: `cloudfront-logs/${domain}/`
                    },
                    
                    // Price class
                    PriceClass: 'PriceClass_100', // US, Canada, Europe
                    
                    // HTTP version
                    HttpVersion: 'http2'
                }
            };
            
            const result = await this.cloudfront.createDistribution(params).promise();
            
            console.log(`CloudFront distribution created: ${result.Distribution.Id}`);
            return result.Distribution;
            
        } catch (error) {
            console.error(`Error creating CloudFront distribution: ${error.message}`);
            throw error;
        }
    }
    
    // Create DNS records
    async createDNSRecords(domain, domainConfig) {
        try {
            console.log(`Creating DNS records for: ${domain}`);
            
            const changes = [];
            
            // Main domain record
            if (domainConfig.cdn.enabled) {
                changes.push({
                    Action: 'UPSERT',
                    ResourceRecordSet: {
                        Name: domain,
                        Type: 'CNAME',
                        TTL: 300,
                        ResourceRecords: [
                            { Value: domainConfig.cdn.distributionDomain }
                        ]
                    }
                });
            }
            
            // WWW subdomain
            if (domainConfig.subdomains.www) {
                changes.push({
                    Action: 'UPSERT',
                    ResourceRecordSet: {
                        Name: `www.${domain}`,
                        Type: 'CNAME',
                        TTL: 300,
                        ResourceRecords: [
                            { Value: domainConfig.cdn.enabled ? domainConfig.cdn.distributionDomain : domain }
                        ]
                    }
                });
            }
            
            // API subdomain
            if (domainConfig.subdomains.api) {
                changes.push({
                    Action: 'UPSERT',
                    ResourceRecordSet: {
                        Name: `api.${domain}`,
                        Type: 'CNAME',
                        TTL: 300,
                        ResourceRecords: [
                            { Value: `api.${this.config.defaultDomain}` }
                        ]
                    }
                });
            }
            
            // Create change batch
            const params = {
                HostedZoneId: this.config.hostedZoneId,
                ChangeBatch: {
                    Comment: `ROOTUIP domain setup for ${domain}`,
                    Changes: changes
                }
            };
            
            const result = await this.route53.changeResourceRecordSets(params).promise();
            
            console.log(`DNS records created for ${domain}: ${result.ChangeInfo.Id}`);
            return result.ChangeInfo;
            
        } catch (error) {
            console.error(`Error creating DNS records: ${error.message}`);
            throw error;
        }
    }
    
    // Get domain configuration
    async getDomainConfig(domain) {
        try {
            // Check cache first
            if (this.domainCache.has(domain)) {
                return this.domainCache.get(domain);
            }
            
            // Load from storage
            const config = await this.loadDomainConfig(domain);
            
            if (config) {
                this.domainCache.set(domain, config);
            }
            
            return config;
            
        } catch (error) {
            console.error(`Error getting domain config: ${error.message}`);
            return null;
        }
    }
    
    // Remove custom domain
    async removeCustomDomain(domain, tenantId) {
        try {
            console.log(`Removing custom domain ${domain} for tenant ${tenantId}`);
            
            const domainConfig = await this.getDomainConfig(domain);
            
            if (!domainConfig) {
                throw new Error(`Domain ${domain} not found`);
            }
            
            if (domainConfig.tenantId !== tenantId) {
                throw new Error(`Domain ${domain} does not belong to tenant ${tenantId}`);
            }
            
            // Remove CloudFront distribution
            if (domainConfig.cdn.distributionId) {
                await this.removeCloudFrontDistribution(domainConfig.cdn.distributionId);
            }
            
            // Remove DNS records
            await this.removeDNSRecords(domain, domainConfig);
            
            // Revoke SSL certificate
            if (domainConfig.ssl.certificateArn) {
                await this.revokeSSLCertificate(domainConfig.ssl.certificateArn);
            }
            
            // Remove configuration
            await this.deleteDomainConfig(domain);
            
            // Remove from cache
            this.domainCache.delete(domain);
            
            console.log(`Custom domain ${domain} removed successfully`);
            return { success: true, domain };
            
        } catch (error) {
            console.error(`Error removing custom domain: ${error.message}`);
            throw error;
        }
    }
    
    // Get tenant domains
    async getTenantDomains(tenantId) {
        try {
            const domains = [];
            const configFiles = await this.listDomainConfigs();
            
            for (const configFile of configFiles) {
                const config = await this.loadDomainConfig(configFile.replace('.json', ''));
                if (config && config.tenantId === tenantId) {
                    domains.push(config);
                }
            }
            
            return domains;
            
        } catch (error) {
            console.error(`Error getting tenant domains: ${error.message}`);
            return [];
        }
    }
    
    // Schedule verification check
    scheduleVerificationCheck(domain) {
        const attempts = this.verificationAttempts.get(domain) || 0;
        
        if (attempts < 10) { // Max 10 attempts
            setTimeout(async () => {
                try {
                    const domainConfig = await this.getDomainConfig(domain);
                    if (domainConfig && domainConfig.status === 'pending_verification') {
                        const verification = await this.checkVerificationRecords(domain, domainConfig.verification.records);
                        
                        if (verification.verified) {
                            await this.completeDomainSetup(domain, domainConfig);
                        } else {
                            this.verificationAttempts.set(domain, attempts + 1);
                            this.scheduleVerificationCheck(domain);
                        }
                    }
                } catch (error) {
                    console.error(`Verification check failed for ${domain}: ${error.message}`);
                }
            }, Math.min(300000 * Math.pow(2, attempts), 3600000)); // Exponential backoff, max 1 hour
        }
    }
    
    // Utility functions
    generateVerificationToken() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    getVerificationInstructions(domainConfig) {
        return {
            method: 'DNS',
            instructions: [
                'Add the following TXT record to your domain\'s DNS configuration:',
                `Name: ${domainConfig.verification.records[0].name}`,
                `Type: TXT`,
                `Value: ${domainConfig.verification.records[0].value}`,
                `TTL: 300 (or your provider\'s minimum)`,
                '',
                'After adding the record, verification will complete automatically within a few minutes.',
                'You can check the status in your domain management dashboard.'
            ].join('\n')
        };
    }
    
    // Storage functions
    async saveDomainConfig(domain, config) {
        const configPath = path.join(process.cwd(), 'white-label', 'domains', `${domain}.json`);
        await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
        await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
    }
    
    async loadDomainConfig(domain) {
        const configPath = path.join(process.cwd(), 'white-label', 'domains', `${domain}.json`);
        
        try {
            const data = await fs.promises.readFile(configPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }
    
    async deleteDomainConfig(domain) {
        const configPath = path.join(process.cwd(), 'white-label', 'domains', `${domain}.json`);
        
        try {
            await fs.promises.unlink(configPath);
        } catch (error) {
            // File doesn't exist, that's fine
        }
    }
    
    async listDomainConfigs() {
        const domainsPath = path.join(process.cwd(), 'white-label', 'domains');
        
        try {
            const files = await fs.promises.readdir(domainsPath);
            return files.filter(file => file.endsWith('.json'));
        } catch (error) {
            return [];
        }
    }
}

module.exports = DomainManagementSystem;