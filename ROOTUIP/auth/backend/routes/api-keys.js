/**
 * API Key Management Routes
 * Enterprise API key generation, management, and security
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult, param } = require('express-validator');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const httpStatus = require('http-status');

const router = express.Router();

// Rate limiting for API key operations
const apiKeyRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 API key operations per window
    message: { error: 'Too many API key operations, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Generate secure API key
const generateApiKey = () => {
    const prefix = 'uip';
    const version = 'v1';
    const random = crypto.randomBytes(24).toString('hex');
    return `${prefix}_${version}_${random}`;
};

// Hash API key for storage
const hashApiKey = (apiKey) => {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
};

// Get API key prefix for display
const getApiKeyPrefix = (apiKey) => {
    return apiKey.substring(0, 12) + '...';
};

// Create new API key
router.post('/', apiKeyRateLimit, [
    body('name').trim().isLength({ min: 1, max: 100 }).withMessage('API key name is required (1-100 characters)'),
    body('permissions').isArray({ min: 1 }).withMessage('At least one permission is required'),
    body('permissions.*').isString().withMessage('Permissions must be strings'),
    body('expiresIn').optional().isInt({ min: 1, max: 365 }).withMessage('Expiration must be 1-365 days'),
    body('description').optional().isLength({ max: 500 }).withMessage('Description too long (max 500 characters)')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        if (!req.user || !req.user.permissionChecker) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        // Check if user has permission to create API keys
        if (!req.user.permissionChecker.hasAnyPermission(['api.create', 'api.manage'])) {
            return res.status(httpStatus.FORBIDDEN).json({ 
                error: 'Insufficient permissions to create API keys' 
            });
        }

        const { name, permissions, expiresIn, description } = req.body;
        const userId = req.user.id;
        const companyId = req.user.company_id;

        // Validate that user has all the permissions they're trying to grant
        for (const permission of permissions) {
            if (!req.user.permissionChecker.hasPermission(permission)) {
                return res.status(httpStatus.FORBIDDEN).json({ 
                    error: `You don't have permission to grant: ${permission}` 
                });
            }
        }

        // Check if API key name already exists for this user
        const existingKey = await req.db.query(`
            SELECT id FROM api_keys 
            WHERE user_id = $1 AND name = $2 AND is_active = true
        `, [userId, name]);

        if (existingKey.rows.length > 0) {
            return res.status(httpStatus.CONFLICT).json({ 
                error: 'API key with this name already exists' 
            });
        }

        // Generate API key
        const apiKey = generateApiKey();
        const keyHash = hashApiKey(apiKey);
        const keyPrefix = getApiKeyPrefix(apiKey);
        
        // Calculate expiration date
        const expiresAt = expiresIn ? 
            new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : 
            null;

        // Create API key record
        const result = await req.db.query(`
            INSERT INTO api_keys (
                user_id, company_id, name, key_hash, key_prefix, 
                permissions, expires_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING id, name, key_prefix, permissions, expires_at, created_at
        `, [
            userId, companyId, name, keyHash, keyPrefix, 
            JSON.stringify(permissions), expiresAt
        ]);

        const apiKeyRecord = result.rows[0];

        // Log API key creation
        await req.logAudit({
            companyId: companyId,
            userId: userId,
            action: 'api_key.created',
            resourceType: 'api_key',
            resourceId: apiKeyRecord.id,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: true,
            metadata: { 
                keyName: name,
                keyPrefix: keyPrefix,
                permissions: permissions,
                expiresAt: expiresAt?.toISOString()
            }
        });

        res.status(httpStatus.CREATED).json({
            success: true,
            message: 'API key created successfully',
            apiKey: {
                id: apiKeyRecord.id,
                name: apiKeyRecord.name,
                key: apiKey, // Only returned once during creation
                keyPrefix: apiKeyRecord.key_prefix,
                permissions: apiKeyRecord.permissions,
                expiresAt: apiKeyRecord.expires_at,
                createdAt: apiKeyRecord.created_at
            },
            warning: 'This is the only time the full API key will be shown. Please save it securely.'
        });

    } catch (error) {
        req.logger.error('API key creation error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            error: 'Failed to create API key' 
        });
    }
});

// List user's API keys
router.get('/', async (req, res) => {
    try {
        if (!req.user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        const userId = req.user.id;
        const { page = 1, limit = 20, active } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE user_id = $1';
        let params = [userId];

        if (active !== undefined) {
            whereClause += ' AND is_active = $2';
            params.push(active === 'true');
        }

        // Get API keys with usage stats
        const result = await req.db.query(`
            SELECT 
                id, name, key_prefix, permissions, last_used_at, 
                last_used_ip, expires_at, is_active, created_at,
                CASE 
                    WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN true
                    ELSE false
                END as is_expired
            FROM api_keys 
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, [...params, limit, offset]);

        // Get total count
        const countResult = await req.db.query(`
            SELECT COUNT(*) FROM api_keys ${whereClause}
        `, params);

        const totalCount = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            success: true,
            apiKeys: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalCount,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        req.logger.error('API key listing error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            error: 'Failed to retrieve API keys' 
        });
    }
});

// Get specific API key details
router.get('/:keyId', [
    param('keyId').isUUID().withMessage('Valid API key ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        if (!req.user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        const { keyId } = req.params;
        const userId = req.user.id;

        // Get API key details with usage statistics
        const result = await req.db.query(`
            SELECT 
                ak.id, ak.name, ak.key_prefix, ak.permissions, ak.last_used_at,
                ak.last_used_ip, ak.expires_at, ak.is_active, ak.created_at,
                ak.updated_at,
                CASE 
                    WHEN ak.expires_at IS NOT NULL AND ak.expires_at < NOW() THEN true
                    ELSE false
                END as is_expired,
                COUNT(al.id) as usage_count
            FROM api_keys ak
            LEFT JOIN audit_logs al ON al.api_key_id = ak.id AND al.created_at > NOW() - INTERVAL '30 days'
            WHERE ak.id = $1 AND ak.user_id = $2
            GROUP BY ak.id
        `, [keyId, userId]);

        if (result.rows.length === 0) {
            return res.status(httpStatus.NOT_FOUND).json({ 
                error: 'API key not found' 
            });
        }

        const apiKey = result.rows[0];

        // Get recent usage (last 10 requests)
        const usageResult = await req.db.query(`
            SELECT action, created_at, ip_address, success
            FROM audit_logs
            WHERE api_key_id = $1
            ORDER BY created_at DESC
            LIMIT 10
        `, [keyId]);

        res.json({
            success: true,
            apiKey: {
                ...apiKey,
                recentUsage: usageResult.rows,
                usageStats: {
                    last30Days: parseInt(apiKey.usage_count),
                    lastUsed: apiKey.last_used_at,
                    lastUsedIp: apiKey.last_used_ip
                }
            }
        });

    } catch (error) {
        req.logger.error('API key details error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            error: 'Failed to retrieve API key details' 
        });
    }
});

// Update API key
router.put('/:keyId', apiKeyRateLimit, [
    param('keyId').isUUID().withMessage('Valid API key ID required'),
    body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('API key name must be 1-100 characters'),
    body('permissions').optional().isArray({ min: 1 }).withMessage('At least one permission is required'),
    body('permissions.*').optional().isString().withMessage('Permissions must be strings'),
    body('expiresIn').optional().isInt({ min: 1, max: 365 }).withMessage('Expiration must be 1-365 days'),
    body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        if (!req.user || !req.user.permissionChecker) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        // Check permissions
        if (!req.user.permissionChecker.hasAnyPermission(['api.update', 'api.manage'])) {
            return res.status(httpStatus.FORBIDDEN).json({ 
                error: 'Insufficient permissions to update API keys' 
            });
        }

        const { keyId } = req.params;
        const { name, permissions, expiresIn, isActive } = req.body;
        const userId = req.user.id;

        // Get current API key
        const currentResult = await req.db.query(`
            SELECT * FROM api_keys WHERE id = $1 AND user_id = $2
        `, [keyId, userId]);

        if (currentResult.rows.length === 0) {
            return res.status(httpStatus.NOT_FOUND).json({ 
                error: 'API key not found' 
            });
        }

        const currentKey = currentResult.rows[0];

        // Validate permissions if provided
        if (permissions) {
            for (const permission of permissions) {
                if (!req.user.permissionChecker.hasPermission(permission)) {
                    return res.status(httpStatus.FORBIDDEN).json({ 
                        error: `You don't have permission to grant: ${permission}` 
                    });
                }
            }
        }

        // Build update query
        const updates = [];
        const values = [];
        let valueIndex = 1;

        if (name && name !== currentKey.name) {
            // Check for name conflicts
            const existingKey = await req.db.query(`
                SELECT id FROM api_keys 
                WHERE user_id = $1 AND name = $2 AND id != $3 AND is_active = true
            `, [userId, name, keyId]);

            if (existingKey.rows.length > 0) {
                return res.status(httpStatus.CONFLICT).json({ 
                    error: 'API key with this name already exists' 
                });
            }

            updates.push(`name = $${valueIndex++}`);
            values.push(name);
        }

        if (permissions) {
            updates.push(`permissions = $${valueIndex++}`);
            values.push(JSON.stringify(permissions));
        }

        if (expiresIn !== undefined) {
            const expiresAt = expiresIn ? 
                new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : 
                null;
            updates.push(`expires_at = $${valueIndex++}`);
            values.push(expiresAt);
        }

        if (isActive !== undefined) {
            updates.push(`is_active = $${valueIndex++}`);
            values.push(isActive);
        }

        if (updates.length === 0) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'No valid updates provided' 
            });
        }

        updates.push(`updated_at = NOW()`);
        values.push(keyId);

        // Perform update
        const result = await req.db.query(`
            UPDATE api_keys 
            SET ${updates.join(', ')}
            WHERE id = $${valueIndex}
            RETURNING id, name, key_prefix, permissions, expires_at, is_active, updated_at
        `, values);

        const updatedKey = result.rows[0];

        // Log API key update
        await req.logAudit({
            companyId: req.user.company_id,
            userId: userId,
            action: 'api_key.updated',
            resourceType: 'api_key',
            resourceId: keyId,
            oldValues: {
                name: currentKey.name,
                permissions: currentKey.permissions,
                expires_at: currentKey.expires_at,
                is_active: currentKey.is_active
            },
            newValues: {
                name: updatedKey.name,
                permissions: updatedKey.permissions,
                expires_at: updatedKey.expires_at,
                is_active: updatedKey.is_active
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: true
        });

        res.json({
            success: true,
            message: 'API key updated successfully',
            apiKey: updatedKey
        });

    } catch (error) {
        req.logger.error('API key update error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            error: 'Failed to update API key' 
        });
    }
});

// Delete API key
router.delete('/:keyId', apiKeyRateLimit, [
    param('keyId').isUUID().withMessage('Valid API key ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        if (!req.user || !req.user.permissionChecker) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        // Check permissions
        if (!req.user.permissionChecker.hasAnyPermission(['api.delete', 'api.manage'])) {
            return res.status(httpStatus.FORBIDDEN).json({ 
                error: 'Insufficient permissions to delete API keys' 
            });
        }

        const { keyId } = req.params;
        const userId = req.user.id;

        // Get API key details before deletion
        const keyResult = await req.db.query(`
            SELECT name, key_prefix, permissions FROM api_keys 
            WHERE id = $1 AND user_id = $2
        `, [keyId, userId]);

        if (keyResult.rows.length === 0) {
            return res.status(httpStatus.NOT_FOUND).json({ 
                error: 'API key not found' 
            });
        }

        const keyData = keyResult.rows[0];

        // Soft delete (deactivate) the API key
        await req.db.query(`
            UPDATE api_keys 
            SET is_active = false, updated_at = NOW()
            WHERE id = $1 AND user_id = $2
        `, [keyId, userId]);

        // Log API key deletion
        await req.logAudit({
            companyId: req.user.company_id,
            userId: userId,
            action: 'api_key.deleted',
            resourceType: 'api_key',
            resourceId: keyId,
            oldValues: keyData,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: true,
            metadata: { 
                keyName: keyData.name,
                keyPrefix: keyData.key_prefix
            }
        });

        res.json({
            success: true,
            message: 'API key deleted successfully'
        });

    } catch (error) {
        req.logger.error('API key deletion error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            error: 'Failed to delete API key' 
        });
    }
});

// Regenerate API key
router.post('/:keyId/regenerate', apiKeyRateLimit, [
    param('keyId').isUUID().withMessage('Valid API key ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        if (!req.user || !req.user.permissionChecker) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        // Check permissions
        if (!req.user.permissionChecker.hasAnyPermission(['api.update', 'api.manage'])) {
            return res.status(httpStatus.FORBIDDEN).json({ 
                error: 'Insufficient permissions to regenerate API keys' 
            });
        }

        const { keyId } = req.params;
        const userId = req.user.id;

        // Get current API key
        const currentResult = await req.db.query(`
            SELECT * FROM api_keys WHERE id = $1 AND user_id = $2 AND is_active = true
        `, [keyId, userId]);

        if (currentResult.rows.length === 0) {
            return res.status(httpStatus.NOT_FOUND).json({ 
                error: 'API key not found or inactive' 
            });
        }

        const currentKey = currentResult.rows[0];

        // Generate new API key
        const newApiKey = generateApiKey();
        const newKeyHash = hashApiKey(newApiKey);
        const newKeyPrefix = getApiKeyPrefix(newApiKey);

        // Update the API key
        const result = await req.db.query(`
            UPDATE api_keys 
            SET key_hash = $1, key_prefix = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING id, name, key_prefix, permissions, expires_at, is_active, updated_at
        `, [newKeyHash, newKeyPrefix, keyId]);

        const updatedKey = result.rows[0];

        // Log API key regeneration
        await req.logAudit({
            companyId: req.user.company_id,
            userId: userId,
            action: 'api_key.regenerated',
            resourceType: 'api_key',
            resourceId: keyId,
            oldValues: { key_prefix: currentKey.key_prefix },
            newValues: { key_prefix: newKeyPrefix },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            success: true,
            metadata: { 
                keyName: currentKey.name,
                oldPrefix: currentKey.key_prefix,
                newPrefix: newKeyPrefix
            }
        });

        res.json({
            success: true,
            message: 'API key regenerated successfully',
            apiKey: {
                ...updatedKey,
                key: newApiKey // Only returned once during regeneration
            },
            warning: 'This is the only time the full API key will be shown. Please update your applications with the new key.'
        });

    } catch (error) {
        req.logger.error('API key regeneration error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            error: 'Failed to regenerate API key' 
        });
    }
});

// Get API key usage statistics
router.get('/:keyId/usage', [
    param('keyId').isUUID().withMessage('Valid API key ID required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(httpStatus.BAD_REQUEST).json({ 
                error: 'Validation failed', 
                details: errors.array() 
            });
        }

        if (!req.user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ error: 'Authentication required' });
        }

        const { keyId } = req.params;
        const userId = req.user.id;
        const { days = 30 } = req.query;

        // Verify API key ownership
        const keyResult = await req.db.query(`
            SELECT name FROM api_keys WHERE id = $1 AND user_id = $2
        `, [keyId, userId]);

        if (keyResult.rows.length === 0) {
            return res.status(httpStatus.NOT_FOUND).json({ 
                error: 'API key not found' 
            });
        }

        // Get usage statistics
        const usageResult = await req.db.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as total_requests,
                COUNT(*) FILTER (WHERE success = true) as successful_requests,
                COUNT(*) FILTER (WHERE success = false) as failed_requests,
                COUNT(DISTINCT ip_address) as unique_ips
            FROM audit_logs
            WHERE api_key_id = $1 AND created_at > NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `, [keyId]);

        // Get top actions
        const actionsResult = await req.db.query(`
            SELECT action, COUNT(*) as count
            FROM audit_logs
            WHERE api_key_id = $1 AND created_at > NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY action
            ORDER BY count DESC
            LIMIT 10
        `, [keyId]);

        // Get top IP addresses
        const ipsResult = await req.db.query(`
            SELECT ip_address, COUNT(*) as count
            FROM audit_logs
            WHERE api_key_id = $1 AND created_at > NOW() - INTERVAL '${parseInt(days)} days'
            GROUP BY ip_address
            ORDER BY count DESC
            LIMIT 10
        `, [keyId]);

        res.json({
            success: true,
            usage: {
                dailyStats: usageResult.rows,
                topActions: actionsResult.rows,
                topIpAddresses: ipsResult.rows,
                periodDays: parseInt(days)
            }
        });

    } catch (error) {
        req.logger.error('API key usage stats error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            error: 'Failed to retrieve usage statistics' 
        });
    }
});

module.exports = router;