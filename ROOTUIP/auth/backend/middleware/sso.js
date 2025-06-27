/**
 * Single Sign-On (SSO) Integration Framework
 * SAML 2.0 and OIDC support for enterprise authentication
 */

const passport = require('passport');
const SamlStrategy = require('passport-saml').Strategy;
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const crypto = require('crypto');
const xml2js = require('xml2js');
const fs = require('fs').promises;
const path = require('path');
const httpStatus = require('http-status');

// SAML Configuration Manager
class SAMLConfigManager {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
        this.strategies = new Map();
    }

    // Load SAML configuration for a company
    async loadSAMLConfig(companyId) {
        try {
            const result = await this.db.query(`
                SELECT sso_config, domain FROM companies 
                WHERE id = $1 AND sso_enabled = true
            `, [companyId]);

            if (result.rows.length === 0) {
                return null;
            }

            const company = result.rows[0];
            const ssoConfig = company.sso_config || {};

            if (ssoConfig.provider !== 'saml') {
                return null;
            }

            return {
                domain: company.domain,
                ...ssoConfig.saml
            };
        } catch (error) {
            this.logger.error('Failed to load SAML config:', error);
            return null;
        }
    }

    // Create SAML strategy for a company
    async createSAMLStrategy(companyId) {
        const config = await this.loadSAMLConfig(companyId);
        if (!config) {
            return null;
        }

        const strategyConfig = {
            // Identity Provider settings
            entryPoint: config.entryPoint,
            issuer: config.issuer || `uip-auth-${companyId}`,
            cert: config.cert,
            
            // Service Provider settings
            callbackUrl: `${process.env.APP_URL}/api/auth/saml/callback/${companyId}`,
            identifierFormat: config.identifierFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
            
            // Security settings
            validateInResponseTo: true,
            disableRequestedAuthnContext: false,
            authnRequestBinding: 'HTTP-POST',
            
            // Attribute mapping
            attributeConsumingServiceIndex: false,
            acceptedClockSkewMs: 5000,
            
            // Certificates
            privateCert: config.privateCert,
            decryptionPvk: config.privateCert,
            
            // Additional settings
            additionalParams: config.additionalParams || {},
            additionalAuthorizeParams: config.additionalAuthorizeParams || {},
            
            // Logout settings
            logoutUrl: config.logoutUrl,
            logoutCallbackUrl: `${process.env.APP_URL}/api/auth/saml/logout/${companyId}`
        };

        const strategy = new SamlStrategy(strategyConfig, async (profile, done) => {
            try {
                await this.handleSAMLProfile(companyId, profile, done);
            } catch (error) {
                this.logger.error('SAML profile handling error:', error);
                return done(error);
            }
        });

        return strategy;
    }

    // Handle SAML profile after successful authentication
    async handleSAMLProfile(companyId, profile, done) {
        try {
            const email = profile.nameID || profile.email || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
            
            if (!email) {
                return done(new Error('Email not provided in SAML response'));
            }

            // Find or create user
            let userResult = await this.db.query(`
                SELECT u.*, r.permissions, c.name as company_name
                FROM users u
                JOIN roles r ON u.role_id = r.id
                JOIN companies c ON u.company_id = c.id
                WHERE u.email = $1 AND u.company_id = $2 AND u.is_active = true
            `, [email, companyId]);

            let user;

            if (userResult.rows.length === 0) {
                // Auto-provision user if enabled
                const companyResult = await this.db.query(`
                    SELECT sso_config FROM companies WHERE id = $1
                `, [companyId]);

                const ssoConfig = companyResult.rows[0]?.sso_config || {};
                
                if (!ssoConfig.autoProvision) {
                    return done(new Error('User not found and auto-provisioning is disabled'));
                }

                // Get default role for auto-provisioned users
                const defaultRoleResult = await this.db.query(`
                    SELECT id FROM roles 
                    WHERE company_id = $1 AND name = $2
                `, [companyId, ssoConfig.defaultRole || 'Viewer']);

                if (defaultRoleResult.rows.length === 0) {
                    return done(new Error('Default role not found for auto-provisioning'));
                }

                const defaultRoleId = defaultRoleResult.rows[0].id;

                // Extract user attributes from SAML profile
                const firstName = profile.firstName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || '';
                const lastName = profile.lastName || profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] || '';

                // Create user
                const createUserResult = await this.db.query(`
                    INSERT INTO users (
                        company_id, role_id, email, first_name, last_name,
                        password_hash, password_salt, email_verified, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
                    RETURNING *
                `, [
                    companyId, defaultRoleId, email, firstName, lastName,
                    crypto.randomBytes(32).toString('hex'), // Dummy password hash for SSO users
                    crypto.randomBytes(16).toString('hex')  // Dummy salt for SSO users
                ]);

                user = createUserResult.rows[0];

                // Get role permissions
                const roleResult = await this.db.query(`
                    SELECT permissions FROM roles WHERE id = $1
                `, [defaultRoleId]);

                user.permissions = roleResult.rows[0]?.permissions || [];

                // Log auto-provisioning
                await this.logAuditEvent({
                    companyId: companyId,
                    userId: user.id,
                    action: 'sso.user_auto_provisioned',
                    success: true,
                    metadata: {
                        email: email,
                        firstName: firstName,
                        lastName: lastName,
                        provider: 'saml'
                    }
                });

            } else {
                user = userResult.rows[0];
            }

            // Update last login
            await this.db.query(`
                UPDATE users SET last_login_at = NOW() WHERE id = $1
            `, [user.id]);

            // Log successful SSO login
            await this.logAuditEvent({
                companyId: companyId,
                userId: user.id,
                action: 'sso.login_success',
                success: true,
                metadata: {
                    email: email,
                    provider: 'saml',
                    nameId: profile.nameID
                }
            });

            return done(null, user);

        } catch (error) {
            this.logger.error('SAML profile handling error:', error);
            
            await this.logAuditEvent({
                companyId: companyId,
                action: 'sso.login_failed',
                success: false,
                errorMessage: error.message,
                metadata: {
                    provider: 'saml',
                    profile: profile
                }
            });

            return done(error);
        }
    }

    // Register SAML strategy for a company
    async registerSAMLStrategy(companyId) {
        const strategy = await this.createSAMLStrategy(companyId);
        if (!strategy) {
            return false;
        }

        const strategyName = `saml-${companyId}`;
        passport.use(strategyName, strategy);
        this.strategies.set(companyId, strategyName);

        this.logger.info(`SAML strategy registered for company: ${companyId}`);
        return true;
    }

    // Get SAML metadata for a company
    async generateSAMLMetadata(companyId) {
        const config = await this.loadSAMLConfig(companyId);
        if (!config) {
            throw new Error('SAML not configured for this company');
        }

        const metadata = {
            'md:EntityDescriptor': {
                $: {
                    'xmlns:md': 'urn:oasis:names:tc:SAML:2.0:metadata',
                    'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
                    entityID: config.issuer || `uip-auth-${companyId}`
                },
                'md:SPSSODescriptor': {
                    $: {
                        protocolSupportEnumeration: 'urn:oasis:names:tc:SAML:2.0:protocol'
                    },
                    'md:KeyDescriptor': {
                        $: { use: 'signing' },
                        'ds:KeyInfo': {
                            'ds:X509Data': {
                                'ds:X509Certificate': config.cert
                            }
                        }
                    },
                    'md:NameIDFormat': config.identifierFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
                    'md:AssertionConsumerService': {
                        $: {
                            Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
                            Location: `${process.env.APP_URL}/api/auth/saml/callback/${companyId}`,
                            index: '1',
                            isDefault: 'true'
                        }
                    }
                }
            }
        };

        const builder = new xml2js.Builder({
            xmldec: { version: '1.0', encoding: 'UTF-8' }
        });

        return builder.buildObject(metadata);
    }

    // Audit logging helper
    async logAuditEvent(data) {
        try {
            await this.db.query(`
                SELECT log_user_action($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            `, [
                data.companyId, data.userId, data.action, data.resourceType, data.resourceId,
                data.oldValues, data.newValues, data.ipAddress, data.userAgent, data.sessionId,
                data.apiKeyId, data.success, data.errorMessage, data.metadata
            ]);
        } catch (error) {
            this.logger.error('Failed to log audit event:', error);
        }
    }
}

// OIDC Configuration Manager
class OIDCConfigManager {
    constructor(db, logger) {
        this.db = db;
        this.logger = logger;
    }

    // Load OIDC configuration for a company
    async loadOIDCConfig(companyId) {
        try {
            const result = await this.db.query(`
                SELECT sso_config, domain FROM companies 
                WHERE id = $1 AND sso_enabled = true
            `, [companyId]);

            if (result.rows.length === 0) {
                return null;
            }

            const company = result.rows[0];
            const ssoConfig = company.sso_config || {};

            if (ssoConfig.provider !== 'oidc') {
                return null;
            }

            return {
                domain: company.domain,
                ...ssoConfig.oidc
            };
        } catch (error) {
            this.logger.error('Failed to load OIDC config:', error);
            return null;
        }
    }

    // Generate OIDC well-known configuration
    async generateWellKnownConfig(companyId) {
        const config = await this.loadOIDCConfig(companyId);
        if (!config) {
            throw new Error('OIDC not configured for this company');
        }

        const baseUrl = `${process.env.APP_URL}/api/auth/oidc/${companyId}`;

        return {
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/authorize`,
            token_endpoint: `${baseUrl}/token`,
            userinfo_endpoint: `${baseUrl}/userinfo`,
            jwks_uri: `${baseUrl}/jwks`,
            end_session_endpoint: `${baseUrl}/logout`,
            
            response_types_supported: ['code', 'id_token', 'token id_token'],
            subject_types_supported: ['public'],
            id_token_signing_alg_values_supported: ['RS256'],
            scopes_supported: ['openid', 'profile', 'email'],
            
            token_endpoint_auth_methods_supported: [
                'client_secret_basic',
                'client_secret_post'
            ],
            
            claims_supported: [
                'sub', 'iss', 'aud', 'exp', 'iat', 'auth_time',
                'email', 'email_verified', 'name', 'given_name',
                'family_name', 'preferred_username'
            ]
        };
    }
}

// SSO Middleware Factory
const createSSOMiddleware = (db, logger) => {
    const samlManager = new SAMLConfigManager(db, logger);
    const oidcManager = new OIDCConfigManager(db, logger);

    return {
        samlManager,
        oidcManager,

        // Initialize SAML for company
        async initializeSAML(companyId) {
            return await samlManager.registerSAMLStrategy(companyId);
        },

        // SAML authentication middleware
        authenticateSAML(companyId) {
            return (req, res, next) => {
                const strategyName = `saml-${companyId}`;
                if (!samlManager.strategies.has(companyId)) {
                    return res.status(httpStatus.BAD_REQUEST).json({
                        error: 'SAML not configured for this company'
                    });
                }

                passport.authenticate(strategyName, {
                    failureRedirect: '/login?error=saml_failed',
                    session: false
                })(req, res, next);
            };
        },

        // SAML callback handler
        handleSAMLCallback(companyId) {
            return async (req, res, next) => {
                const strategyName = `saml-${companyId}`;
                
                passport.authenticate(strategyName, { session: false }, async (err, user) => {
                    if (err) {
                        logger.error('SAML callback error:', err);
                        return res.redirect('/login?error=saml_error');
                    }

                    if (!user) {
                        return res.redirect('/login?error=saml_no_user');
                    }

                    try {
                        // Create session for the user
                        const sessionId = crypto.randomUUID();
                        const sessionToken = crypto.randomBytes(32).toString('hex');
                        const refreshToken = crypto.randomBytes(32).toString('hex');
                        const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

                        await db.query(`
                            INSERT INTO user_sessions (
                                id, user_id, session_token, refresh_token, ip_address,
                                user_agent, expires_at, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                        `, [sessionId, user.id, sessionToken, refreshToken, req.ip, req.get('User-Agent'), expiresAt]);

                        // Generate JWT
                        const jwt = require('jsonwebtoken');
                        const tokenPayload = {
                            userId: user.id,
                            companyId: user.company_id,
                            roleId: user.role_id,
                            sessionId: sessionId,
                            permissions: user.permissions,
                            ssoProvider: 'saml'
                        };

                        const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
                            expiresIn: '8h',
                            issuer: 'uip-auth',
                            audience: 'uip-platform'
                        });

                        // Set secure cookie
                        res.cookie('session_token', sessionToken, {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production',
                            sameSite: 'strict',
                            maxAge: 8 * 60 * 60 * 1000 // 8 hours
                        });

                        // Redirect to dashboard with token
                        res.redirect(`/dashboard?token=${accessToken}`);

                    } catch (error) {
                        logger.error('Session creation error:', error);
                        res.redirect('/login?error=session_failed');
                    }
                })(req, res, next);
            };
        },

        // Get SAML metadata
        async getSAMLMetadata(req, res) {
            try {
                const { companyId } = req.params;
                const metadata = await samlManager.generateSAMLMetadata(companyId);
                
                res.set('Content-Type', 'application/xml');
                res.send(metadata);
            } catch (error) {
                logger.error('SAML metadata error:', error);
                res.status(httpStatus.BAD_REQUEST).json({
                    error: 'Failed to generate SAML metadata'
                });
            }
        },

        // Get OIDC well-known configuration
        async getOIDCWellKnown(req, res) {
            try {
                const { companyId } = req.params;
                const config = await oidcManager.generateWellKnownConfig(companyId);
                
                res.json(config);
            } catch (error) {
                logger.error('OIDC well-known error:', error);
                res.status(httpStatus.BAD_REQUEST).json({
                    error: 'Failed to generate OIDC configuration'
                });
            }
        },

        // Company domain resolution middleware
        async resolveCompanyFromDomain(req, res, next) {
            try {
                const host = req.get('host');
                const subdomain = host.split('.')[0];

                // Check for custom domain or subdomain
                const result = await db.query(`
                    SELECT id, name, sso_enabled, sso_config
                    FROM companies 
                    WHERE custom_domain = $1 OR subdomain = $2
                `, [host, subdomain]);

                if (result.rows.length > 0) {
                    req.company = result.rows[0];
                }

                next();
            } catch (error) {
                logger.error('Company resolution error:', error);
                next();
            }
        }
    };
};

module.exports = {
    SAMLConfigManager,
    OIDCConfigManager,
    createSSOMiddleware
};