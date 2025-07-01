// ROOTUIP Enterprise User Management Controller
// Comprehensive user administration for enterprise companies

const CryptoUtils = require('../utils/crypto-utils');
const SecurityConfig = require('../config/security-config');

class UserController {
    constructor(database) {
        this.db = database;
        this.crypto = CryptoUtils;
        this.config = SecurityConfig;
    }

    // List all users in company (with pagination and filtering)
    async getUsers(req, res) {
        try {
            const { page = 1, limit = 50, role, status, search } = req.query;
            const offset = (page - 1) * limit;
            
            let whereClause = 'u.company_id = $1';
            let params = [req.user.companyId];
            let paramIndex = 2;

            // Add filters
            if (role) {
                whereClause += ` AND u.role = $${paramIndex}`;
                params.push(role);
                paramIndex++;
            }

            if (status) {
                whereClause += ` AND u.status = $${paramIndex}`;
                params.push(status);
                paramIndex++;
            }

            if (search) {
                whereClause += ` AND (u.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex})`;
                params.push(`%${search}%`);
                paramIndex++;
            }

            // Get users with pagination
            const usersQuery = `
                SELECT 
                    u.id, u.email, u.first_name, u.last_name, u.role, u.status,
                    u.last_login, u.mfa_enabled, u.api_access_enabled, u.created_at,
                    u.concurrent_sessions, u.failed_login_attempts,
                    COUNT(s.id) as active_sessions,
                    COUNT(ak.id) as api_keys_count
                FROM users u
                LEFT JOIN user_sessions s ON u.id = s.user_id AND s.is_active = true AND s.expires_at > NOW()
                LEFT JOIN api_keys ak ON u.id = ak.user_id AND ak.is_active = true
                WHERE ${whereClause}
                GROUP BY u.id
                ORDER BY u.created_at DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            params.push(limit, offset);
            const usersResult = await this.db.query(usersQuery, params);

            // Get total count
            const countQuery = `
                SELECT COUNT(*) as total
                FROM users u
                WHERE ${whereClause}
            `;
            const countResult = await this.db.query(countQuery, params.slice(0, paramIndex - 2));

            res.json({
                success: true,
                data: {
                    users: usersResult.rows,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: parseInt(countResult.rows[0].total),
                        pages: Math.ceil(countResult.rows[0].total / limit)
                    }
                }
            });

        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({
                error: 'Failed to retrieve users',
                message: 'Unable to get user list'
            });
        }
    }

    // Get specific user details
    async getUser(req, res) {
        try {
            const { userId } = req.params;

            const userQuery = `
                SELECT 
                    u.id, u.email, u.first_name, u.last_name, u.role, u.status,
                    u.phone, u.title, u.department, u.permissions, u.last_login,
                    u.last_login_ip, u.mfa_enabled, u.api_access_enabled, u.api_rate_limit,
                    u.created_at, u.updated_at, u.last_password_change,
                    u.concurrent_sessions, u.failed_login_attempts, u.locked_until,
                    COUNT(s.id) as active_sessions,
                    COUNT(ak.id) as api_keys_count,
                    COALESCE(
                        JSON_AGG(
                            JSON_BUILD_OBJECT(
                                'id', s.id,
                                'ip_address', s.ip_address,
                                'user_agent', s.user_agent,
                                'created_at', s.created_at,
                                'last_activity', s.last_activity,
                                'country', s.country,
                                'city', s.city,
                                'is_suspicious', s.is_suspicious
                            )
                        ) FILTER (WHERE s.id IS NOT NULL), '[]'
                    ) as sessions
                FROM users u
                LEFT JOIN user_sessions s ON u.id = s.user_id AND s.is_active = true AND s.expires_at > NOW()
                LEFT JOIN api_keys ak ON u.id = ak.user_id AND ak.is_active = true
                WHERE u.id = $1 AND u.company_id = $2
                GROUP BY u.id
            `;

            const result = await this.db.query(userQuery, [userId, req.user.companyId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'User does not exist or is not in your company'
                });
            }

            const user = result.rows[0];

            // Get recent login attempts
            const loginAttemptsQuery = `
                SELECT ip_address, success, failure_reason, timestamp
                FROM login_attempts
                WHERE user_id = $1
                ORDER BY timestamp DESC
                LIMIT 10
            `;
            const loginAttempts = await this.db.query(loginAttemptsQuery, [userId]);

            // Get API keys (without sensitive data)
            const apiKeysQuery = `
                SELECT id, name, scopes, rate_limit, last_used, total_requests, created_at, expires_at
                FROM api_keys
                WHERE user_id = $1 AND is_active = true
                ORDER BY created_at DESC
            `;
            const apiKeys = await this.db.query(apiKeysQuery, [userId]);

            res.json({
                success: true,
                data: {
                    user,
                    loginAttempts: loginAttempts.rows,
                    apiKeys: apiKeys.rows
                }
            });

        } catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({
                error: 'Failed to retrieve user',
                message: 'Unable to get user details'
            });
        }
    }

    // Create new user
    async createUser(req, res) {
        try {
            const { 
                email, firstName, lastName, role, phone, title, department,
                sendInvite = true, temporaryPassword, permissions = []
            } = req.body;

            // Check if user already exists
            const existingUser = await this.db.query(
                'SELECT id FROM users WHERE email = $1',
                [email.toLowerCase()]
            );

            if (existingUser.rows.length > 0) {
                return res.status(409).json({
                    error: 'User exists',
                    message: 'A user with this email already exists'
                });
            }

            // Generate password if not provided
            let passwordHash = null;
            let generatedPassword = null;

            if (temporaryPassword) {
                // Validate password
                const company = await this.db.query('SELECT subscription_tier FROM companies WHERE id = $1', [req.user.companyId]);
                const passwordPolicy = this.config.getPasswordPolicy(company.rows[0].subscription_tier);
                
                const passwordValidation = this.crypto.validatePassword(temporaryPassword, passwordPolicy);
                if (!passwordValidation.isValid) {
                    return res.status(400).json({
                        error: 'Password validation failed',
                        errors: passwordValidation.errors
                    });
                }

                passwordHash = await this.crypto.hashPassword(temporaryPassword);
            } else if (!sendInvite) {
                // Generate secure temporary password
                generatedPassword = this.crypto.generateSecureToken(16);
                passwordHash = await this.crypto.hashPassword(generatedPassword);
            }

            // Create user
            const userResult = await this.db.query(`
                INSERT INTO users (
                    company_id, email, password_hash, first_name, last_name, role,
                    phone, title, department, permissions, status, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id, email, first_name, last_name, role, created_at
            `, [
                req.user.companyId,
                email.toLowerCase(),
                passwordHash,
                firstName,
                lastName,
                role,
                phone,
                title,
                department,
                JSON.stringify(permissions),
                sendInvite ? 'pending' : 'active',
                req.user.id
            ]);

            const user = userResult.rows[0];

            // Store password in history if created
            if (passwordHash) {
                await this.db.query(`
                    INSERT INTO password_history (user_id, password_hash)
                    VALUES ($1, $2)
                `, [user.id, passwordHash]);
            }

            // Send invite or welcome email
            if (sendInvite) {
                await this.sendUserInvite(user.email, user.first_name, req.user.companyName);
            } else {
                await this.sendWelcomeEmail(user.email, user.first_name, generatedPassword);
            }

            // Log user creation
            req.user = { ...req.user, id: req.user.id }; // Ensure user object has id
            await this.logAuditEvent(req, 'user.created', {
                createdUserId: user.id,
                createdUserEmail: user.email,
                role: role
            });

            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: {
                    user,
                    temporaryPassword: generatedPassword // Only returned if not using invite
                }
            });

        } catch (error) {
            console.error('Create user error:', error);
            res.status(500).json({
                error: 'User creation failed',
                message: 'Unable to create user account'
            });
        }
    }

    // Update user
    async updateUser(req, res) {
        try {
            const { userId } = req.params;
            const { 
                firstName, lastName, role, phone, title, department, 
                permissions, status, apiAccess, apiRateLimit 
            } = req.body;

            // Check if user exists and is in same company
            const existingUser = await this.db.query(
                'SELECT id, role FROM users WHERE id = $1 AND company_id = $2',
                [userId, req.user.companyId]
            );

            if (existingUser.rows.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'User does not exist or is not in your company'
                });
            }

            // Prevent role escalation (non-admins can't create admins)
            if (role === 'admin' && req.user.role !== 'admin') {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    message: 'Only admins can assign admin role'
                });
            }

            // Build update query dynamically
            const updates = [];
            const values = [userId];
            let paramIndex = 2;

            const fieldsToUpdate = {
                first_name: firstName,
                last_name: lastName,
                role: role,
                phone: phone,
                title: title,
                department: department,
                permissions: permissions ? JSON.stringify(permissions) : undefined,
                status: status,
                api_access_enabled: apiAccess,
                api_rate_limit: apiRateLimit
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
                UPDATE users 
                SET ${updates.join(', ')}
                WHERE id = $1 AND company_id = $${paramIndex}
                RETURNING id, email, first_name, last_name, role, status, updated_at
            `;

            values.push(req.user.companyId);
            const result = await this.db.query(updateQuery, values);

            // Log user update
            await this.logAuditEvent(req, 'user.updated', {
                updatedUserId: userId,
                changes: fieldsToUpdate
            });

            res.json({
                success: true,
                message: 'User updated successfully',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({
                error: 'User update failed',
                message: 'Unable to update user account'
            });
        }
    }

    // Delete user
    async deleteUser(req, res) {
        try {
            const { userId } = req.params;

            // Check if user exists and is in same company
            const existingUser = await this.db.query(
                'SELECT id, email, role FROM users WHERE id = $1 AND company_id = $2',
                [userId, req.user.companyId]
            );

            if (existingUser.rows.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'User does not exist or is not in your company'
                });
            }

            const user = existingUser.rows[0];

            // Prevent self-deletion
            if (userId === req.user.id) {
                return res.status(403).json({
                    error: 'Cannot delete self',
                    message: 'You cannot delete your own account'
                });
            }

            // Prevent deleting the last admin
            if (user.role === 'admin') {
                const adminCount = await this.db.query(
                    'SELECT COUNT(*) as count FROM users WHERE company_id = $1 AND role = $2 AND status = $3',
                    [req.user.companyId, 'admin', 'active']
                );

                if (parseInt(adminCount.rows[0].count) <= 1) {
                    return res.status(403).json({
                        error: 'Cannot delete last admin',
                        message: 'At least one admin must remain in the company'
                    });
                }
            }

            // Soft delete: update status instead of actual deletion
            await this.db.query(`
                UPDATE users 
                SET status = 'inactive', updated_at = NOW()
                WHERE id = $1
            `, [userId]);

            // Revoke all active sessions
            await this.db.query(`
                UPDATE user_sessions 
                SET is_active = false, revoked_at = NOW(), revoked_reason = 'user_deleted'
                WHERE user_id = $1
            `, [userId]);

            // Deactivate all API keys
            await this.db.query(`
                UPDATE api_keys 
                SET is_active = false, revoked_at = NOW(), revoked_by = $2, revoked_reason = 'user_deleted'
                WHERE user_id = $1
            `, [userId, req.user.id]);

            // Log user deletion
            await this.logAuditEvent(req, 'user.deleted', {
                deletedUserId: userId,
                deletedUserEmail: user.email
            });

            res.json({
                success: true,
                message: 'User deleted successfully'
            });

        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({
                error: 'User deletion failed',
                message: 'Unable to delete user account'
            });
        }
    }

    // Lock/Unlock user account
    async toggleUserLock(req, res) {
        try {
            const { userId } = req.params;
            const { lock } = req.body; // true to lock, false to unlock

            // Check if user exists and is in same company
            const existingUser = await this.db.query(
                'SELECT id, email, status FROM users WHERE id = $1 AND company_id = $2',
                [userId, req.user.companyId]
            );

            if (existingUser.rows.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'User does not exist or is not in your company'
                });
            }

            const user = existingUser.rows[0];

            // Prevent self-locking
            if (userId === req.user.id) {
                return res.status(403).json({
                    error: 'Cannot lock self',
                    message: 'You cannot lock your own account'
                });
            }

            const newStatus = lock ? 'locked' : 'active';
            const lockUntil = lock ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null; // 24 hours if locking

            await this.db.query(`
                UPDATE users 
                SET status = $1, locked_until = $2, failed_login_attempts = 0, updated_at = NOW()
                WHERE id = $3
            `, [newStatus, lockUntil, userId]);

            // Revoke active sessions if locking
            if (lock) {
                await this.db.query(`
                    UPDATE user_sessions 
                    SET is_active = false, revoked_at = NOW(), revoked_reason = 'account_locked'
                    WHERE user_id = $1 AND is_active = true
                `, [userId]);
            }

            // Log action
            await this.logAuditEvent(req, lock ? 'user.locked' : 'user.unlocked', {
                targetUserId: userId,
                targetUserEmail: user.email
            });

            res.json({
                success: true,
                message: `User ${lock ? 'locked' : 'unlocked'} successfully`
            });

        } catch (error) {
            console.error('Toggle user lock error:', error);
            res.status(500).json({
                error: 'User lock toggle failed',
                message: 'Unable to change user lock status'
            });
        }
    }

    // Reset user password
    async resetUserPassword(req, res) {
        try {
            const { userId } = req.params;
            const { temporaryPassword, sendEmail = true } = req.body;

            // Check if user exists and is in same company
            const existingUser = await this.db.query(
                'SELECT id, email, first_name FROM users WHERE id = $1 AND company_id = $2',
                [userId, req.user.companyId]
            );

            if (existingUser.rows.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'User does not exist or is not in your company'
                });
            }

            const user = existingUser.rows[0];

            // Generate password if not provided
            let newPassword = temporaryPassword;
            if (!newPassword) {
                newPassword = this.crypto.generateSecureToken(16);
            }

            // Validate password
            const company = await this.db.query('SELECT subscription_tier FROM companies WHERE id = $1', [req.user.companyId]);
            const passwordPolicy = this.config.getPasswordPolicy(company.rows[0].subscription_tier);
            
            const passwordValidation = this.crypto.validatePassword(newPassword, passwordPolicy);
            if (!passwordValidation.isValid) {
                return res.status(400).json({
                    error: 'Password validation failed',
                    errors: passwordValidation.errors
                });
            }

            // Hash password
            const passwordHash = await this.crypto.hashPassword(newPassword);

            // Update password
            await this.db.query(`
                UPDATE users 
                SET password_hash = $1, last_password_change = NOW(), 
                    failed_login_attempts = 0, locked_until = NULL
                WHERE id = $2
            `, [passwordHash, userId]);

            // Store in password history
            await this.db.query(`
                INSERT INTO password_history (user_id, password_hash)
                VALUES ($1, $2)
            `, [userId, passwordHash]);

            // Revoke all active sessions
            await this.db.query(`
                UPDATE user_sessions 
                SET is_active = false, revoked_at = NOW(), revoked_reason = 'password_reset'
                WHERE user_id = $1 AND is_active = true
            `, [userId]);

            // Send password reset email
            if (sendEmail) {
                await this.sendPasswordResetEmail(user.email, user.first_name, newPassword);
            }

            // Log password reset
            await this.logAuditEvent(req, 'user.password_reset', {
                targetUserId: userId,
                targetUserEmail: user.email,
                resetBy: req.user.id
            });

            res.json({
                success: true,
                message: 'Password reset successfully',
                data: {
                    temporaryPassword: sendEmail ? undefined : newPassword
                }
            });

        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({
                error: 'Password reset failed',
                message: 'Unable to reset user password'
            });
        }
    }

    // Get user permissions
    async getUserPermissions(req, res) {
        try {
            const { userId } = req.params;

            const result = await this.db.query(`
                SELECT 
                    u.role,
                    u.permissions,
                    CASE 
                        WHEN u.role = 'admin' THEN ARRAY['users:read', 'users:write', 'company:read', 'company:write', 'api:read', 'api:write']
                        WHEN u.role = 'manager' THEN ARRAY['users:read', 'users:write', 'company:read', 'api:read']
                        WHEN u.role = 'viewer' THEN ARRAY['company:read']
                        WHEN u.role = 'api_user' THEN ARRAY['api:read', 'api:write']
                        ELSE ARRAY[]::TEXT[]
                    END as role_permissions
                FROM users u
                WHERE u.id = $1 AND u.company_id = $2
            `, [userId, req.user.companyId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    message: 'User does not exist or is not in your company'
                });
            }

            const user = result.rows[0];
            const customPermissions = user.permissions || [];
            const allPermissions = [...new Set([...user.role_permissions, ...customPermissions])];

            res.json({
                success: true,
                data: {
                    role: user.role,
                    rolePermissions: user.role_permissions,
                    customPermissions: customPermissions,
                    effectivePermissions: allPermissions
                }
            });

        } catch (error) {
            console.error('Get user permissions error:', error);
            res.status(500).json({
                error: 'Failed to retrieve permissions',
                message: 'Unable to get user permissions'
            });
        }
    }

    // Helper methods

    async sendUserInvite(email, firstName, companyName) {
        // Implementation depends on email service
        console.log(`Sending invite to ${email} for ${companyName}`);
        // TODO: Implement actual email sending
    }

    async sendWelcomeEmail(email, firstName, temporaryPassword) {
        // Implementation depends on email service
        console.log(`Sending welcome email to ${email} with temp password`);
        // TODO: Implement actual email sending
    }

    async sendPasswordResetEmail(email, firstName, newPassword) {
        // Implementation depends on email service
        console.log(`Sending password reset email to ${email}`);
        // TODO: Implement actual email sending
    }

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

module.exports = UserController;