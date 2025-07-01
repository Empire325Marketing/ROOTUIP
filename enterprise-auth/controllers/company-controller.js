// ROOTUIP Enterprise Company Management Controller
// Company administration, settings, and SSO configuration

const CryptoUtils = require('../utils/crypto-utils');
const SecurityConfig = require('../config/security-config');

class CompanyController {
    constructor(database) {
        this.db = database;
        this.crypto = CryptoUtils;
        this.config = SecurityConfig;
    }

    // Get company details
    async getCompany(req, res) {
        try {
            const companyQuery = `
                SELECT 
                    c.*,
                    COUNT(u.id) as total_users,
                    COUNT(CASE WHEN u.status = 'active' THEN 1 END) as active_users,
                    COUNT(CASE WHEN u.last_login > NOW() - INTERVAL '30 days' THEN 1 END) as active_users_30d,
                    COUNT(ak.id) as total_api_keys,
                    COUNT(CASE WHEN ak.is_active = true THEN 1 END) as active_api_keys
                FROM companies c
                LEFT JOIN users u ON c.id = u.company_id
                LEFT JOIN api_keys ak ON c.id = ak.company_id
                WHERE c.id = $1
                GROUP BY c.id
            `;

            const result = await this.db.query(companyQuery, [req.user.companyId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Company not found',
                    message: 'Company does not exist'
                });
            }

            const company = result.rows[0];

            // Get SSO configurations
            const ssoQuery = `
                SELECT id, provider, provider_name, is_active, test_mode, created_at, last_tested
                FROM sso_configurations
                WHERE company_id = $1
                ORDER BY created_at DESC
            `;
            const ssoConfigs = await this.db.query(ssoQuery, [req.user.companyId]);

            // Get IP allowlists
            const ipAllowlistQuery = `
                SELECT id, ip_range, description, is_active, created_at
                FROM company_ip_allowlists
                WHERE company_id = $1
                ORDER BY created_at DESC
            `;
            const ipAllowlists = await this.db.query(ipAllowlistQuery, [req.user.companyId]);

            res.json({
                success: true,
                data: {
                    company,
                    ssoConfigurations: ssoConfigs.rows,
                    ipAllowlists: ipAllowlists.rows
                }
            });

        } catch (error) {
            console.error('Get company error:', error);
            res.status(500).json({
                error: 'Failed to retrieve company',
                message: 'Unable to get company details'
            });
        }
    }

    // Update company settings
    async updateCompany(req, res) {
        try {
            const {
                name, domain, vessels, contractValue, billingContactEmail,
                enforceMfa, passwordPolicy, sessionTimeoutMinutes, maxConcurrentSessions
            } = req.body;

            // Build update query dynamically
            const updates = [];
            const values = [req.user.companyId];
            let paramIndex = 2;

            const fieldsToUpdate = {
                name: name,
                domain: domain,
                vessels: vessels,
                contract_value: contractValue,
                billing_contact_email: billingContactEmail,
                enforce_mfa: enforceMfa,
                password_policy: passwordPolicy ? JSON.stringify(passwordPolicy) : undefined,
                session_timeout_minutes: sessionTimeoutMinutes,
                max_concurrent_sessions: maxConcurrentSessions
            };

            for (const [field, value] of Object.entries(fieldsToUpdate)) {
                if (value !== undefined) {
                    updates.push(`${field} = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    error: 'No updates provided',
                    message: 'At least one field must be updated'
                });
            }

            // Add updated_at
            updates.push(`updated_at = NOW()`);

            const updateQuery = `
                UPDATE companies 
                SET ${updates.join(', ')}
                WHERE id = $1
                RETURNING id, name, domain, enforce_mfa, session_timeout_minutes, updated_at
            `;

            const result = await this.db.query(updateQuery, values);

            // Log company update
            await this.logAuditEvent(req, 'company.updated', {
                changes: fieldsToUpdate
            });

            res.json({
                success: true,
                message: 'Company updated successfully',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Update company error:', error);
            res.status(500).json({
                error: 'Company update failed',
                message: 'Unable to update company settings'
            });
        }
    }

    // Get company security settings
    async getSecuritySettings(req, res) {
        try {
            const result = await this.db.query(`
                SELECT 
                    enforce_mfa, password_policy, session_timeout_minutes,
                    max_concurrent_sessions, ip_allowlist, sso_enabled, sso_provider
                FROM companies
                WHERE id = $1
            `, [req.user.companyId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'Company not found',
                    message: 'Company does not exist'
                });
            }

            const settings = result.rows[0];

            // Get security statistics
            const statsQuery = `
                SELECT 
                    COUNT(CASE WHEN u.mfa_enabled = true THEN 1 END) as users_with_mfa,
                    COUNT(u.id) as total_users,
                    COUNT(CASE WHEN u.status = 'locked' THEN 1 END) as locked_users,
                    COUNT(CASE WHEN u.failed_login_attempts > 0 THEN 1 END) as users_with_failed_attempts
                FROM users u
                WHERE u.company_id = $1
            `;
            const statsResult = await this.db.query(statsQuery, [req.user.companyId]);

            res.json({
                success: true,
                data: {
                    settings,
                    statistics: statsResult.rows[0]
                }
            });

        } catch (error) {
            console.error('Get security settings error:', error);
            res.status(500).json({
                error: 'Failed to retrieve security settings',
                message: 'Unable to get security settings'
            });
        }
    }

    // Update security settings
    async updateSecuritySettings(req, res) {
        try {
            const {
                enforceMfa, passwordPolicy, sessionTimeoutMinutes,
                maxConcurrentSessions, enableSso
            } = req.body;

            // Validate password policy if provided
            if (passwordPolicy) {
                const requiredFields = ['minLength', 'requireUppercase', 'requireLowercase', 'requireNumbers'];
                for (const field of requiredFields) {
                    if (passwordPolicy[field] === undefined) {
                        return res.status(400).json({
                            error: 'Invalid password policy',
                            message: `Missing required field: ${field}`
                        });
                    }
                }
            }

            // Update security settings
            await this.db.query(`
                UPDATE companies 
                SET 
                    enforce_mfa = COALESCE($1, enforce_mfa),
                    password_policy = COALESCE($2, password_policy),
                    session_timeout_minutes = COALESCE($3, session_timeout_minutes),
                    max_concurrent_sessions = COALESCE($4, max_concurrent_sessions),
                    sso_enabled = COALESCE($5, sso_enabled),
                    updated_at = NOW()
                WHERE id = $6
            `, [
                enforceMfa,
                passwordPolicy ? JSON.stringify(passwordPolicy) : null,
                sessionTimeoutMinutes,
                maxConcurrentSessions,
                enableSso,
                req.user.companyId
            ]);

            // Log security settings update
            await this.logAuditEvent(req, 'company.security_settings_updated', {
                enforceMfa,
                passwordPolicy: passwordPolicy ? 'updated' : 'unchanged',
                sessionTimeoutMinutes,
                maxConcurrentSessions,
                enableSso
            });

            res.json({
                success: true,
                message: 'Security settings updated successfully'
            });

        } catch (error) {
            console.error('Update security settings error:', error);
            res.status(500).json({
                error: 'Security settings update failed',
                message: 'Unable to update security settings'
            });
        }
    }

    // Add IP to allowlist
    async addIPAllowlist(req, res) {
        try {
            const { ipRange, description } = req.body;

            // Validate IP range format (basic validation)
            const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/;
            if (!ipRegex.test(ipRange)) {
                return res.status(400).json({
                    error: 'Invalid IP range',
                    message: 'Please provide a valid IP address or CIDR range'
                });
            }

            // Check if IP range already exists
            const existingRange = await this.db.query(`
                SELECT id FROM company_ip_allowlists
                WHERE company_id = $1 AND ip_range = $2
            `, [req.user.companyId, ipRange]);

            if (existingRange.rows.length > 0) {
                return res.status(409).json({
                    error: 'IP range exists',
                    message: 'This IP range is already in the allowlist'
                });
            }

            // Add IP range
            const result = await this.db.query(`
                INSERT INTO company_ip_allowlists (company_id, ip_range, description, created_by)
                VALUES ($1, $2, $3, $4)
                RETURNING id, ip_range, description, created_at
            `, [req.user.companyId, ipRange, description, req.user.id]);

            // Log IP allowlist addition
            await this.logAuditEvent(req, 'company.ip_allowlist_added', {
                ipRange,
                description
            });

            res.status(201).json({
                success: true,
                message: 'IP range added to allowlist',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Add IP allowlist error:', error);
            res.status(500).json({
                error: 'Failed to add IP allowlist',
                message: 'Unable to add IP range to allowlist'
            });
        }
    }

    // Remove IP from allowlist
    async removeIPAllowlist(req, res) {
        try {
            const { allowlistId } = req.params;

            // Check if allowlist entry exists and belongs to company
            const existingEntry = await this.db.query(`
                SELECT ip_range FROM company_ip_allowlists
                WHERE id = $1 AND company_id = $2
            `, [allowlistId, req.user.companyId]);

            if (existingEntry.rows.length === 0) {
                return res.status(404).json({
                    error: 'IP allowlist entry not found',
                    message: 'IP allowlist entry does not exist'
                });
            }

            const ipRange = existingEntry.rows[0].ip_range;

            // Remove IP range
            await this.db.query(`
                DELETE FROM company_ip_allowlists
                WHERE id = $1 AND company_id = $2
            `, [allowlistId, req.user.companyId]);

            // Log IP allowlist removal
            await this.logAuditEvent(req, 'company.ip_allowlist_removed', {
                ipRange,
                allowlistId
            });

            res.json({
                success: true,
                message: 'IP range removed from allowlist'
            });

        } catch (error) {
            console.error('Remove IP allowlist error:', error);
            res.status(500).json({
                error: 'Failed to remove IP allowlist',
                message: 'Unable to remove IP range from allowlist'
            });
        }
    }

    // Get company audit logs
    async getAuditLogs(req, res) {
        try {
            const { page = 1, limit = 50, action, userId, startDate, endDate } = req.query;
            const offset = (page - 1) * limit;

            let whereClause = 'company_id = $1';
            let params = [req.user.companyId];
            let paramIndex = 2;

            // Add filters
            if (action) {
                whereClause += ` AND action = $${paramIndex}`;
                params.push(action);
                paramIndex++;
            }

            if (userId) {
                whereClause += ` AND user_id = $${paramIndex}`;
                params.push(userId);
                paramIndex++;
            }

            if (startDate) {
                whereClause += ` AND timestamp >= $${paramIndex}`;
                params.push(startDate);
                paramIndex++;
            }

            if (endDate) {
                whereClause += ` AND timestamp <= $${paramIndex}`;
                params.push(endDate);
                paramIndex++;
            }

            // Get audit logs
            const logsQuery = `
                SELECT 
                    al.id, al.action, al.resource_type, al.resource_id,
                    al.ip_address, al.success, al.error_message, al.timestamp,
                    al.metadata,
                    u.email as user_email,
                    u.first_name as user_first_name,
                    u.last_name as user_last_name
                FROM audit_logs al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE ${whereClause}
                ORDER BY al.timestamp DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            params.push(limit, offset);
            const logsResult = await this.db.query(logsQuery, params);

            // Get total count
            const countQuery = `
                SELECT COUNT(*) as total
                FROM audit_logs
                WHERE ${whereClause}
            `;
            const countResult = await this.db.query(countQuery, params.slice(0, paramIndex - 2));

            res.json({
                success: true,
                data: {
                    logs: logsResult.rows,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: parseInt(countResult.rows[0].total),
                        pages: Math.ceil(countResult.rows[0].total / limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get audit logs error:', error);
            res.status(500).json({
                error: 'Failed to retrieve audit logs',
                message: 'Unable to get audit logs'
            });
        }
    }

    // Get company statistics
    async getStatistics(req, res) {
        try {
            const { period = '30d' } = req.query;

            // Calculate date range
            let intervalClause = "INTERVAL '30 days'";
            switch (period) {
                case '7d':
                    intervalClause = "INTERVAL '7 days'";
                    break;
                case '90d':
                    intervalClause = "INTERVAL '90 days'";
                    break;
                case '1y':
                    intervalClause = "INTERVAL '1 year'";
                    break;
            }

            // Get comprehensive statistics
            const statsQuery = `
                WITH date_series AS (
                    SELECT generate_series(
                        NOW() - ${intervalClause},
                        NOW(),
                        INTERVAL '1 day'
                    )::date as date
                ),
                user_stats AS (
                    SELECT 
                        COUNT(*) as total_users,
                        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
                        COUNT(CASE WHEN mfa_enabled = true THEN 1 END) as mfa_enabled_users,
                        COUNT(CASE WHEN last_login > NOW() - ${intervalClause} THEN 1 END) as active_users_period,
                        COUNT(CASE WHEN created_at > NOW() - ${intervalClause} THEN 1 END) as new_users_period
                    FROM users WHERE company_id = $1
                ),
                session_stats AS (
                    SELECT 
                        COUNT(*) as total_sessions,
                        COUNT(CASE WHEN is_active = true THEN 1 END) as active_sessions,
                        AVG(EXTRACT(HOURS FROM (COALESCE(revoked_at, NOW()) - created_at))) as avg_session_duration
                    FROM user_sessions us
                    JOIN users u ON us.user_id = u.id
                    WHERE u.company_id = $1 AND us.created_at > NOW() - ${intervalClause}
                ),
                api_stats AS (
                    SELECT 
                        COUNT(*) as total_api_keys,
                        COUNT(CASE WHEN is_active = true THEN 1 END) as active_api_keys,
                        SUM(total_requests) as total_api_requests
                    FROM api_keys
                    WHERE company_id = $1
                ),
                login_stats AS (
                    SELECT 
                        COUNT(*) as total_login_attempts,
                        COUNT(CASE WHEN success = true THEN 1 END) as successful_logins,
                        COUNT(CASE WHEN success = false THEN 1 END) as failed_logins
                    FROM login_attempts la
                    LEFT JOIN users u ON la.user_id = u.id
                    WHERE (u.company_id = $1 OR u.company_id IS NULL) 
                    AND la.timestamp > NOW() - ${intervalClause}
                ),
                daily_logins AS (
                    SELECT 
                        ds.date,
                        COALESCE(COUNT(la.id), 0) as login_count
                    FROM date_series ds
                    LEFT JOIN login_attempts la ON la.timestamp::date = ds.date AND la.success = true
                    LEFT JOIN users u ON la.user_id = u.id
                    WHERE u.company_id = $1 OR u.company_id IS NULL
                    GROUP BY ds.date
                    ORDER BY ds.date
                )
                SELECT 
                    (SELECT row_to_json(user_stats) FROM user_stats) as user_statistics,
                    (SELECT row_to_json(session_stats) FROM session_stats) as session_statistics,
                    (SELECT row_to_json(api_stats) FROM api_stats) as api_statistics,
                    (SELECT row_to_json(login_stats) FROM login_stats) as login_statistics,
                    (SELECT json_agg(daily_logins ORDER BY date) FROM daily_logins) as daily_login_trend
            `;

            const result = await this.db.query(statsQuery, [req.user.companyId]);
            const stats = result.rows[0];

            res.json({
                success: true,
                data: {
                    period,
                    userStatistics: stats.user_statistics,
                    sessionStatistics: stats.session_statistics,
                    apiStatistics: stats.api_statistics,
                    loginStatistics: stats.login_statistics,
                    dailyLoginTrend: stats.daily_login_trend
                }
            });

        } catch (error) {
            console.error('Get statistics error:', error);
            res.status(500).json({
                error: 'Failed to retrieve statistics',
                message: 'Unable to get company statistics'
            });
        }
    }

    // Get security events
    async getSecurityEvents(req, res) {
        try {
            const { page = 1, limit = 50, severity, status, eventType } = req.query;
            const offset = (page - 1) * limit;

            let whereClause = 'company_id = $1';
            let params = [req.user.companyId];
            let paramIndex = 2;

            // Add filters
            if (severity) {
                whereClause += ` AND severity = $${paramIndex}`;
                params.push(severity);
                paramIndex++;
            }

            if (status) {
                whereClause += ` AND status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }

            if (eventType) {
                whereClause += ` AND event_type = $${paramIndex}`;
                params.push(eventType);
                paramIndex++;
            }

            // Get security events
            const eventsQuery = `
                SELECT 
                    se.id, se.event_type, se.severity, se.description, se.risk_score,
                    se.status, se.timestamp, se.metadata, se.auto_response_taken,
                    u.email as user_email,
                    u.first_name as user_first_name,
                    u.last_name as user_last_name
                FROM security_events se
                LEFT JOIN users u ON se.user_id = u.id
                WHERE ${whereClause}
                ORDER BY se.timestamp DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            params.push(limit, offset);
            const eventsResult = await this.db.query(eventsQuery, params);

            // Get total count
            const countQuery = `
                SELECT COUNT(*) as total
                FROM security_events
                WHERE ${whereClause}
            `;
            const countResult = await this.db.query(countQuery, params.slice(0, paramIndex - 2));

            res.json({
                success: true,
                data: {
                    events: eventsResult.rows,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: parseInt(countResult.rows[0].total),
                        pages: Math.ceil(countResult.rows[0].total / limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get security events error:', error);
            res.status(500).json({
                error: 'Failed to retrieve security events',
                message: 'Unable to get security events'
            });
        }
    }

    // Helper methods

    async logAuditEvent(req, action, details = {}) {
        try {
            await this.db.query(`
                INSERT INTO audit_logs (
                    user_id, company_id, action, ip_address, user_agent,
                    success, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                req.user?.id,
                req.user?.companyId,
                action,
                req.ip,
                req.get('User-Agent'),
                true,
                JSON.stringify(details)
            ]);
        } catch (error) {
            console.error('Failed to log audit event:', error);
        }
    }
}

module.exports = CompanyController;