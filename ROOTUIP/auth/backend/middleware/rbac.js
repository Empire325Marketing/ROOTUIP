/**
 * Role-Based Access Control (RBAC) Middleware
 * Enterprise-grade permission system with dynamic role management
 */

const httpStatus = require('http-status');

// Default system permissions
const SYSTEM_PERMISSIONS = {
    // System Administration
    'system.admin': 'Full system administration access',
    'system.settings': 'Modify system-wide settings',
    'system.maintenance': 'System maintenance operations',
    
    // Company Management
    'company.create': 'Create new companies',
    'company.update': 'Update company information',
    'company.delete': 'Delete companies',
    'company.settings': 'Modify company settings',
    
    // User Management
    'user.create': 'Create new users',
    'user.read': 'View user information',
    'user.update': 'Update user information',
    'user.delete': 'Delete users',
    'user.manage': 'Full user management',
    'user.impersonate': 'Impersonate other users',
    
    // Role Management
    'role.create': 'Create new roles',
    'role.read': 'View role information',
    'role.update': 'Update role permissions',
    'role.delete': 'Delete roles',
    'role.manage': 'Full role management',
    'role.assign': 'Assign roles to users',
    
    // API Management
    'api.create': 'Create API keys',
    'api.read': 'View API key information',
    'api.update': 'Update API keys',
    'api.delete': 'Delete API keys',
    'api.manage': 'Full API key management',
    
    // Dashboard & Reports
    'dashboard.view': 'Access dashboard',
    'dashboard.admin': 'Admin dashboard access',
    'reports.view': 'View reports',
    'reports.create': 'Create custom reports',
    'reports.export': 'Export report data',
    
    // Integrations
    'integrations.view': 'View integrations',
    'integrations.create': 'Create new integrations',
    'integrations.update': 'Update integrations',
    'integrations.delete': 'Delete integrations',
    'integrations.manage': 'Full integration management',
    
    // Audit & Security
    'audit.view': 'View audit logs',
    'audit.export': 'Export audit data',
    'security.settings': 'Modify security settings',
    'security.mfa': 'Manage MFA settings',
    
    // Data Management
    'data.import': 'Import data',
    'data.export': 'Export data',
    'data.delete': 'Delete data',
    'data.backup': 'Create backups',
    'data.restore': 'Restore from backups',
    
    // Notifications
    'notifications.send': 'Send notifications',
    'notifications.manage': 'Manage notification settings',
    
    // Billing & Subscriptions
    'billing.view': 'View billing information',
    'billing.manage': 'Manage billing and subscriptions',
    
    // Support
    'support.view': 'View support tickets',
    'support.create': 'Create support tickets',
    'support.manage': 'Manage support system'
};

// Default role definitions
const DEFAULT_ROLES = {
    'Super Admin': {
        description: 'Full system access across all companies',
        permissions: [
            'system.admin', 'company.create', 'company.update', 'company.delete',
            'user.manage', 'role.manage', 'api.manage', 'audit.view',
            'security.settings', 'data.backup', 'data.restore', 'billing.manage'
        ],
        isSystemRole: true
    },
    'Company Admin': {
        description: 'Full access within company scope',
        permissions: [
            'company.update', 'company.settings', 'user.manage', 'role.manage',
            'api.manage', 'dashboard.admin', 'reports.create', 'reports.export',
            'integrations.manage', 'audit.view', 'security.settings', 'security.mfa',
            'data.import', 'data.export', 'notifications.manage', 'billing.view'
        ],
        isSystemRole: true
    },
    'Operations Manager': {
        description: 'Operational management and user oversight',
        permissions: [
            'user.create', 'user.read', 'user.update', 'role.assign',
            'dashboard.view', 'reports.view', 'reports.export',
            'integrations.view', 'integrations.update', 'data.import',
            'data.export', 'notifications.send', 'support.create'
        ],
        isSystemRole: true
    },
    'Viewer': {
        description: 'Read-only access to core features',
        permissions: [
            'dashboard.view', 'reports.view', 'integrations.view',
            'support.create', 'user.read'
        ],
        isSystemRole: true
    }
};

// Permission checking utilities
class PermissionChecker {
    constructor(userPermissions = []) {
        this.permissions = Array.isArray(userPermissions) ? userPermissions : [];
    }

    // Check if user has specific permission
    hasPermission(permission) {
        return this.permissions.includes(permission) || this.permissions.includes('system.admin');
    }

    // Check if user has any of the specified permissions
    hasAnyPermission(permissions) {
        if (!Array.isArray(permissions)) {
            permissions = [permissions];
        }
        return permissions.some(permission => this.hasPermission(permission));
    }

    // Check if user has all specified permissions
    hasAllPermissions(permissions) {
        if (!Array.isArray(permissions)) {
            permissions = [permissions];
        }
        return permissions.every(permission => this.hasPermission(permission));
    }

    // Check if user has permission for resource operation
    hasResourcePermission(resource, operation) {
        const permission = `${resource}.${operation}`;
        return this.hasPermission(permission) || this.hasPermission(`${resource}.manage`);
    }

    // Get effective permissions (includes implied permissions)
    getEffectivePermissions() {
        const effective = new Set(this.permissions);
        
        // System admin gets all permissions
        if (this.hasPermission('system.admin')) {
            Object.keys(SYSTEM_PERMISSIONS).forEach(perm => effective.add(perm));
        }
        
        // Add implied permissions
        if (this.hasPermission('user.manage')) {
            effective.add('user.create');
            effective.add('user.read');
            effective.add('user.update');
            effective.add('user.delete');
        }
        
        if (this.hasPermission('role.manage')) {
            effective.add('role.create');
            effective.add('role.read');
            effective.add('role.update');
            effective.add('role.delete');
            effective.add('role.assign');
        }
        
        if (this.hasPermission('api.manage')) {
            effective.add('api.create');
            effective.add('api.read');
            effective.add('api.update');
            effective.add('api.delete');
        }
        
        if (this.hasPermission('integrations.manage')) {
            effective.add('integrations.view');
            effective.add('integrations.create');
            effective.add('integrations.update');
            effective.add('integrations.delete');
        }
        
        return Array.from(effective);
    }
}

// Middleware to check authentication and load user permissions
const loadUserPermissions = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ 
                error: 'Authentication required' 
            });
        }

        // Get user's role and permissions
        const userResult = await req.db.query(`
            SELECT u.*, r.name as role_name, r.permissions, r.is_system_role,
                   c.name as company_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            JOIN companies c ON u.company_id = c.id
            WHERE u.id = $1 AND u.is_active = true
        `, [req.user.id]);

        if (userResult.rows.length === 0) {
            return res.status(httpStatus.UNAUTHORIZED).json({ 
                error: 'User not found or inactive' 
            });
        }

        const userData = userResult.rows[0];
        
        // Enhance user object with permission checker
        req.user = {
            ...req.user,
            ...userData,
            permissions: userData.permissions || [],
            permissionChecker: new PermissionChecker(userData.permissions || [])
        };

        next();
    } catch (error) {
        req.logger?.error('Permission loading error:', error);
        res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
            error: 'Failed to load user permissions' 
        });
    }
};

// Middleware factory for permission requirements
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user || !req.user.permissionChecker) {
            return res.status(httpStatus.UNAUTHORIZED).json({ 
                error: 'Authentication required' 
            });
        }

        if (!req.user.permissionChecker.hasPermission(permission)) {
            // Log unauthorized access attempt
            req.logAudit?.({
                companyId: req.user.company_id,
                userId: req.user.id,
                action: 'access.denied',
                resourceType: 'permission',
                resourceId: permission,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: 'Insufficient permissions',
                metadata: { 
                    requiredPermission: permission,
                    userPermissions: req.user.permissions 
                }
            });

            return res.status(httpStatus.FORBIDDEN).json({ 
                error: 'Insufficient permissions',
                required: permission,
                code: 'PERMISSION_DENIED'
            });
        }

        next();
    };
};

// Multiple permission requirements (any)
const requireAnyPermission = (permissions) => {
    return (req, res, next) => {
        if (!req.user || !req.user.permissionChecker) {
            return res.status(httpStatus.UNAUTHORIZED).json({ 
                error: 'Authentication required' 
            });
        }

        if (!req.user.permissionChecker.hasAnyPermission(permissions)) {
            req.logAudit?.({
                companyId: req.user.company_id,
                userId: req.user.id,
                action: 'access.denied',
                resourceType: 'permissions',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: 'Insufficient permissions',
                metadata: { 
                    requiredPermissions: permissions,
                    userPermissions: req.user.permissions 
                }
            });

            return res.status(httpStatus.FORBIDDEN).json({ 
                error: 'Insufficient permissions',
                required: permissions,
                code: 'PERMISSION_DENIED'
            });
        }

        next();
    };
};

// Multiple permission requirements (all)
const requireAllPermissions = (permissions) => {
    return (req, res, next) => {
        if (!req.user || !req.user.permissionChecker) {
            return res.status(httpStatus.UNAUTHORIZED).json({ 
                error: 'Authentication required' 
            });
        }

        if (!req.user.permissionChecker.hasAllPermissions(permissions)) {
            req.logAudit?.({
                companyId: req.user.company_id,
                userId: req.user.id,
                action: 'access.denied',
                resourceType: 'permissions',
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: 'Insufficient permissions',
                metadata: { 
                    requiredPermissions: permissions,
                    userPermissions: req.user.permissions 
                }
            });

            return res.status(httpStatus.FORBIDDEN).json({ 
                error: 'Insufficient permissions',
                required: permissions,
                code: 'PERMISSION_DENIED'
            });
        }

        next();
    };
};

// Resource-based permission checking
const requireResourcePermission = (resource, operation) => {
    return (req, res, next) => {
        if (!req.user || !req.user.permissionChecker) {
            return res.status(httpStatus.UNAUTHORIZED).json({ 
                error: 'Authentication required' 
            });
        }

        if (!req.user.permissionChecker.hasResourcePermission(resource, operation)) {
            const requiredPermission = `${resource}.${operation}`;
            
            req.logAudit?.({
                companyId: req.user.company_id,
                userId: req.user.id,
                action: 'access.denied',
                resourceType: resource,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                success: false,
                errorMessage: 'Insufficient resource permissions',
                metadata: { 
                    resource,
                    operation,
                    requiredPermission,
                    userPermissions: req.user.permissions 
                }
            });

            return res.status(httpStatus.FORBIDDEN).json({ 
                error: 'Insufficient permissions',
                required: requiredPermission,
                code: 'RESOURCE_PERMISSION_DENIED'
            });
        }

        next();
    };
};

// Self-service permission (user can only access their own resources)
const requireSelfOrPermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ 
                error: 'Authentication required' 
            });
        }

        const targetUserId = req.params.userId || req.params.id;
        
        // Allow if user is accessing their own resources
        if (targetUserId === req.user.id) {
            return next();
        }

        // Otherwise require specified permission
        if (!req.user.permissionChecker?.hasPermission(permission)) {
            return res.status(httpStatus.FORBIDDEN).json({ 
                error: 'Can only access your own resources or insufficient permissions',
                code: 'SELF_OR_PERMISSION_REQUIRED'
            });
        }

        next();
    };
};

// Company isolation middleware
const requireSameCompany = (req, res, next) => {
    if (!req.user) {
        return res.status(httpStatus.UNAUTHORIZED).json({ 
            error: 'Authentication required' 
        });
    }

    // Set company context for database queries
    req.db.query('SET app.current_company_id = $1', [req.user.company_id])
        .then(() => next())
        .catch(error => {
            req.logger?.error('Company context error:', error);
            res.status(httpStatus.INTERNAL_SERVER_ERROR).json({ 
                error: 'Failed to set company context' 
            });
        });
};

// Permission validation utility
const validatePermissions = (permissions) => {
    if (!Array.isArray(permissions)) {
        return { valid: false, error: 'Permissions must be an array' };
    }

    const invalidPermissions = permissions.filter(
        permission => !SYSTEM_PERMISSIONS.hasOwnProperty(permission)
    );

    if (invalidPermissions.length > 0) {
        return { 
            valid: false, 
            error: 'Invalid permissions', 
            invalid: invalidPermissions 
        };
    }

    return { valid: true };
};

// Role management utilities
const createRole = async (db, companyId, roleData) => {
    const { name, description, permissions } = roleData;
    
    // Validate permissions
    const validation = validatePermissions(permissions);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const result = await db.query(`
        INSERT INTO roles (company_id, name, description, permissions)
        VALUES ($1, $2, $3, $4)
        RETURNING *
    `, [companyId, name, description, JSON.stringify(permissions)]);

    return result.rows[0];
};

const updateRole = async (db, roleId, companyId, updates) => {
    const { name, description, permissions } = updates;
    
    if (permissions) {
        const validation = validatePermissions(permissions);
        if (!validation.valid) {
            throw new Error(validation.error);
        }
    }

    const setParts = [];
    const values = [];
    let valueIndex = 1;

    if (name) {
        setParts.push(`name = $${valueIndex++}`);
        values.push(name);
    }
    if (description) {
        setParts.push(`description = $${valueIndex++}`);
        values.push(description);
    }
    if (permissions) {
        setParts.push(`permissions = $${valueIndex++}`);
        values.push(JSON.stringify(permissions));
    }

    setParts.push(`updated_at = NOW()`);
    values.push(roleId, companyId);

    const result = await db.query(`
        UPDATE roles 
        SET ${setParts.join(', ')}
        WHERE id = $${valueIndex++} AND company_id = $${valueIndex++} AND is_system_role = false
        RETURNING *
    `, values);

    return result.rows[0];
};

module.exports = {
    SYSTEM_PERMISSIONS,
    DEFAULT_ROLES,
    PermissionChecker,
    loadUserPermissions,
    requirePermission,
    requireAnyPermission,
    requireAllPermissions,
    requireResourcePermission,
    requireSelfOrPermission,
    requireSameCompany,
    validatePermissions,
    createRole,
    updateRole
};