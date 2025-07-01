// ROOTUIP Enterprise Security Configuration
// Comprehensive security settings and policies

const crypto = require('crypto');

const SecurityConfig = {
    // JWT Configuration
    jwt: {
        accessTokenSecret: process.env.JWT_ACCESS_SECRET || crypto.randomBytes(64).toString('hex'),
        refreshTokenSecret: process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex'),
        accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
        refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
        issuer: 'rootuip.com',
        audience: 'rootuip-enterprise',
        algorithm: 'HS256'
    },

    // Password Policy Configuration
    passwordPolicy: {
        default: {
            minLength: 12,
            maxLength: 128,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            maxAge: 90, // days
            preventReuse: 12, // last N passwords
            lockoutThreshold: 5, // failed attempts
            lockoutDuration: 30, // minutes
            complexity: {
                minScore: 3, // out of 4
                patterns: [
                    /[a-z]/, // lowercase
                    /[A-Z]/, // uppercase
                    /\d/,    // numbers
                    /[!@#$%^&*(),.?":{}|<>]/ // special chars
                ]
            }
        },
        enterprise: {
            minLength: 14,
            maxLength: 128,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            maxAge: 60, // days
            preventReuse: 24, // last N passwords
            lockoutThreshold: 3, // failed attempts
            lockoutDuration: 60, // minutes
            complexity: {
                minScore: 4, // out of 4
                patterns: [
                    /[a-z]/, // lowercase
                    /[A-Z]/, // uppercase
                    /\d/,    // numbers
                    /[!@#$%^&*(),.?":{}|<>]/ // special chars
                ]
            }
        }
    },

    // Multi-Factor Authentication
    mfa: {
        issuer: 'ROOTUIP',
        window: 2, // Allow 2 time windows (past and future) for TOTP
        step: 30, // 30-second time step
        digits: 6, // 6-digit codes
        algorithm: 'sha1',
        backupCodes: {
            count: 10,
            length: 8,
            format: 'alphanumeric'
        },
        qrCodeOptions: {
            width: 300,
            height: 300,
            color: {
                dark: '#0F3460',
                light: '#FFFFFF'
            }
        }
    },

    // Session Management
    session: {
        defaultTimeoutMinutes: 480, // 8 hours
        maxConcurrentSessions: 5,
        extendOnActivity: true,
        secureFlags: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        },
        fingerprintAlgorithm: 'sha256',
        suspiciousActivityThreshold: {
            newLocationScore: 30,
            unusualTimeScore: 20,
            newDeviceScore: 40,
            rapidLocationChangeScore: 50
        }
    },

    // Rate Limiting Configuration
    rateLimiting: {
        login: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 attempts per window
            skipSuccessfulRequests: true,
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                error: 'Too many login attempts, please try again later',
                retryAfter: '15 minutes'
            }
        },
        api: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 1000, // 1000 requests per hour (default)
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                return req.apiKey?.id || req.ip;
            }
        },
        registration: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 3, // 3 registration attempts per hour
            skipSuccessfulRequests: true
        },
        passwordReset: {
            windowMs: 60 * 60 * 1000, // 1 hour
            max: 3, // 3 password reset attempts per hour
            skipSuccessfulRequests: true
        },
        mfaVerification: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 10, // 10 MFA verification attempts
            skipSuccessfulRequests: true
        }
    },

    // API Key Configuration
    apiKey: {
        prefix: 'rk_', // ROOTUIP key prefix
        length: 32, // bytes (will be base64 encoded)
        defaultScopes: ['read'],
        availableScopes: [
            'read',           // Read access to resources
            'write',          // Write access to resources
            'admin',          // Administrative operations
            'containers:read', // Container-specific read access
            'containers:write', // Container-specific write access
            'analytics:read',  // Analytics data access
            'webhooks:manage'  // Webhook management
        ],
        defaultRateLimit: 1000, // requests per hour
        maxRateLimit: 10000 // maximum configurable rate limit
    },

    // CSRF Protection
    csrf: {
        secret: process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex'),
        cookieName: '_csrf',
        headerName: 'x-csrf-token',
        bodyName: '_csrf',
        expiry: 60 * 60 * 1000, // 1 hour
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production'
    },

    // Security Headers Configuration
    securityHeaders: {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'", // Needed for inline scripts
                    'https://cdnjs.cloudflare.com',
                    'https://cdn.jsdelivr.net'
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    'https://fonts.googleapis.com',
                    'https://cdnjs.cloudflare.com'
                ],
                fontSrc: [
                    "'self'",
                    'https://fonts.gstatic.com'
                ],
                imgSrc: [
                    "'self'",
                    'data:',
                    'https:'
                ],
                connectSrc: [
                    "'self'",
                    'https://api.rootuip.com'
                ],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: []
            }
        },
        hsts: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true
        },
        noSniff: true,
        frameguard: { action: 'deny' },
        xssFilter: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    },

    // Encryption Configuration
    encryption: {
        algorithm: 'aes-256-gcm',
        keyDerivation: {
            algorithm: 'pbkdf2',
            iterations: 100000,
            keyLength: 32,
            digest: 'sha512'
        },
        bcrypt: {
            rounds: process.env.NODE_ENV === 'production' ? 14 : 12
        }
    },

    // Audit Configuration
    audit: {
        enabled: true,
        sensitiveFields: [
            'password',
            'password_hash',
            'mfa_secret',
            'api_key',
            'client_secret',
            'refresh_token'
        ],
        retentionDays: 2555, // 7 years for compliance
        events: {
            // Authentication events
            'auth.login.success': { level: 'info', retention: 90 },
            'auth.login.failure': { level: 'warn', retention: 365 },
            'auth.logout': { level: 'info', retention: 30 },
            'auth.password_change': { level: 'info', retention: 365 },
            'auth.mfa_enabled': { level: 'info', retention: 365 },
            'auth.mfa_disabled': { level: 'warn', retention: 365 },
            
            // User management events
            'user.created': { level: 'info', retention: 365 },
            'user.updated': { level: 'info', retention: 365 },
            'user.deleted': { level: 'warn', retention: 2555 },
            'user.role_changed': { level: 'warn', retention: 365 },
            'user.locked': { level: 'warn', retention: 365 },
            'user.unlocked': { level: 'info', retention: 365 },
            
            // API key events
            'api_key.created': { level: 'info', retention: 365 },
            'api_key.revoked': { level: 'warn', retention: 365 },
            'api_key.used': { level: 'debug', retention: 30 },
            
            // Security events
            'security.suspicious_login': { level: 'warn', retention: 365 },
            'security.brute_force': { level: 'error', retention: 365 },
            'security.ip_blocked': { level: 'warn', retention: 90 },
            'security.privilege_escalation': { level: 'error', retention: 2555 }
        }
    },

    // IP Allowlisting
    ipAllowlist: {
        enabled: process.env.ENABLE_IP_ALLOWLIST === 'true',
        enforceForAPI: true,
        enforceForSSO: false, // Usually handled by SSO provider
        allowPrivateNetworks: process.env.NODE_ENV !== 'production',
        commonPrivateRanges: [
            '10.0.0.0/8',
            '172.16.0.0/12',
            '192.168.0.0/16',
            '127.0.0.0/8'
        ]
    },

    // SSO Configuration
    sso: {
        saml: {
            callbackUrl: process.env.SAML_CALLBACK_URL || 'https://app.rootuip.com/auth/saml/callback',
            logoutUrl: process.env.SAML_LOGOUT_URL || 'https://app.rootuip.com/auth/saml/logout',
            issuer: 'urn:rootuip:enterprise',
            signatureAlgorithm: 'sha256',
            digestAlgorithm: 'sha256',
            authnRequestsSigned: true,
            wantResponsesSigned: true,
            clockTolerance: 30 // seconds
        },
        oidc: {
            callbackUrl: process.env.OIDC_CALLBACK_URL || 'https://app.rootuip.com/auth/oidc/callback',
            scopes: ['openid', 'profile', 'email'],
            responseType: 'code',
            clockTolerance: 30
        },
        attributeMapping: {
            email: ['email', 'emailAddress', 'mail'],
            firstName: ['given_name', 'givenName', 'first_name', 'firstName'],
            lastName: ['family_name', 'familyName', 'last_name', 'lastName', 'surname'],
            role: ['role', 'roles', 'groups', 'memberOf']
        },
        autoProvision: true, // Automatically create users from SSO
        updateOnLogin: true  // Update user attributes on each login
    },

    // Monitoring and Alerting
    monitoring: {
        enabled: true,
        thresholds: {
            failedLoginsPerMinute: 10,
            suspiciousActivitiesPerHour: 5,
            apiErrorRatePercent: 5,
            sessionConcurrencyThreshold: 1000
        },
        webhooks: {
            enabled: process.env.SECURITY_WEBHOOKS_ENABLED === 'true',
            endpoints: [
                process.env.SLACK_SECURITY_WEBHOOK,
                process.env.PAGERDUTY_WEBHOOK
            ].filter(Boolean)
        }
    },

    // Data Protection
    dataProtection: {
        encryptPII: true,
        hashEmails: false, // Keep emails readable for SSO matching
        dataRetention: {
            userAccounts: 2555, // 7 years after deletion
            auditLogs: 2555,    // 7 years
            loginAttempts: 90,   // 3 months
            sessions: 30         // 1 month after expiry
        },
        gdprCompliance: {
            enabled: true,
            dataProcessingBasis: 'legitimate_interest',
            rightToErasure: true,
            dataPortability: true
        }
    }
};

// Environment-specific overrides
if (process.env.NODE_ENV === 'development') {
    // Relaxed settings for development
    SecurityConfig.passwordPolicy.default.minLength = 8;
    SecurityConfig.passwordPolicy.default.lockoutThreshold = 10;
    SecurityConfig.rateLimiting.login.max = 20;
    SecurityConfig.securityHeaders.contentSecurityPolicy.directives.scriptSrc.push("'unsafe-eval'");
}

if (process.env.NODE_ENV === 'production') {
    // Strict settings for production
    SecurityConfig.session.secureFlags.secure = true;
    SecurityConfig.csrf.secure = true;
    SecurityConfig.monitoring.enabled = true;
}

// Validation function
SecurityConfig.validate = function() {
    const errors = [];
    
    // Check required environment variables
    const requiredEnvVars = [
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'DATABASE_URL'
    ];
    
    for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
            errors.push(`Missing required environment variable: ${envVar}`);
        }
    }
    
    // Check JWT secrets are different
    if (this.jwt.accessTokenSecret === this.jwt.refreshTokenSecret) {
        errors.push('JWT access and refresh secrets must be different');
    }
    
    // Check JWT secrets are long enough
    if (this.jwt.accessTokenSecret.length < 32) {
        errors.push('JWT access secret must be at least 32 characters');
    }
    
    if (this.jwt.refreshTokenSecret.length < 32) {
        errors.push('JWT refresh secret must be at least 32 characters');
    }
    
    return errors;
};

// Helper function to get password policy for subscription tier
SecurityConfig.getPasswordPolicy = function(subscriptionTier) {
    return subscriptionTier === 'enterprise' 
        ? this.passwordPolicy.enterprise 
        : this.passwordPolicy.default;
};

// Helper function to get rate limit for API key
SecurityConfig.getApiRateLimit = function(userRole, customLimit) {
    if (customLimit && customLimit <= this.apiKey.maxRateLimit) {
        return customLimit;
    }
    
    const roleLimits = {
        'admin': 5000,
        'manager': 2000,
        'viewer': 1000,
        'api_user': 3000
    };
    
    return roleLimits[userRole] || this.apiKey.defaultRateLimit;
};

module.exports = SecurityConfig;