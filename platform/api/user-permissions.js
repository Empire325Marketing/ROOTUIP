// ROOTUIP User Permissions Management API
const express = require('express');
const router = express.Router();

// Permission definitions
const PERMISSIONS = {
    // Shipment permissions
    'shipments.view': 'View all company shipments',
    'shipments.create': 'Create new shipment bookings',
    'shipments.edit': 'Edit existing shipments',
    'shipments.delete': 'Delete shipments',
    'shipments.export': 'Export shipment data',
    
    // Document permissions
    'documents.view': 'View shipping documents',
    'documents.upload': 'Upload new documents',
    'documents.edit': 'Edit document details',
    'documents.delete': 'Delete documents',
    'documents.approve': 'Approve documents',
    
    // Financial permissions
    'finance.view': 'View financial data',
    'finance.invoices': 'Manage invoices',
    'finance.payments': 'Process payments',
    'finance.reports': 'Generate financial reports',
    
    // Analytics permissions
    'analytics.view': 'View analytics dashboard',
    'analytics.export': 'Export analytics data',
    'analytics.custom': 'Create custom reports',
    
    // User management permissions
    'users.view': 'View company users',
    'users.create': 'Add new users',
    'users.edit': 'Edit user details',
    'users.delete': 'Remove users',
    'users.permissions': 'Manage user permissions',
    
    // Integration permissions
    'integrations.view': 'View integrations',
    'integrations.manage': 'Configure integrations',
    'integrations.api': 'Manage API keys',
    
    // System permissions
    'system.settings': 'Manage system settings',
    'system.audit': 'View audit logs',
    'system.billing': 'Manage billing',
};

// Role templates
const ROLE_TEMPLATES = {
    admin: {
        name: 'Administrator',
        description: 'Full system access',
        permissions: Object.keys(PERMISSIONS)
    },
    manager: {
        name: 'Manager',
        description: 'Manage shipments and team',
        permissions: [
            'shipments.view', 'shipments.create', 'shipments.edit', 'shipments.export',
            'documents.view', 'documents.upload', 'documents.edit', 'documents.approve',
            'finance.view', 'finance.invoices',
            'analytics.view', 'analytics.export',
            'users.view', 'users.create', 'users.edit'
        ]
    },
    user: {
        name: 'User',
        description: 'Create and track shipments',
        permissions: [
            'shipments.view', 'shipments.create', 'shipments.edit',
            'documents.view', 'documents.upload',
            'analytics.view'
        ]
    },
    viewer: {
        name: 'Viewer',
        description: 'Read-only access',
        permissions: [
            'shipments.view',
            'documents.view',
            'analytics.view'
        ]
    }
};

// Middleware to check company admin permissions
const requireCompanyAdmin = (req, res, next) => {
    if (!req.user || !req.user.permissions.includes('users.permissions')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
};

// Get all company users
router.get('/users', async (req, res) => {
    const { companyId } = req.user;
    const { role, status, search, page = 1, limit = 20 } = req.query;
    
    try {
        const users = await getCompanyUsers(companyId, {
            role,
            status,
            search,
            page: parseInt(page),
            limit: parseInt(limit)
        });
        
        res.json({
            success: true,
            users: users.data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: users.total,
                pages: Math.ceil(users.total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get single user details
router.get('/users/:userId', async (req, res) => {
    const { companyId } = req.user;
    const { userId } = req.params;
    
    try {
        const user = await getUserDetails(companyId, userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
                status: user.status,
                permissions: user.permissions,
                createdAt: user.createdAt,
                lastActive: user.lastActive,
                activitySummary: await getUserActivitySummary(userId)
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user details' });
    }
});

// Create new user (send invitation)
router.post('/users', requireCompanyAdmin, async (req, res) => {
    const { companyId } = req.user;
    const { name, email, role, department, permissions } = req.body;
    
    try {
        // Validate email doesn't already exist
        const existing = await getUserByEmail(email);
        if (existing) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        
        // Check company user limit
        const userCount = await getCompanyUserCount(companyId);
        const userLimit = await getCompanyUserLimit(companyId);
        
        if (userCount >= userLimit) {
            return res.status(400).json({ 
                error: 'User limit reached. Please upgrade your plan.' 
            });
        }
        
        // Create user and send invitation
        const user = await createUser({
            companyId,
            name,
            email,
            role,
            department,
            permissions: permissions || ROLE_TEMPLATES[role]?.permissions || [],
            status: 'pending',
            invitedBy: req.user.id
        });
        
        // Send invitation email
        await sendInvitationEmail(user);
        
        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                status: 'pending'
            },
            message: `Invitation sent to ${email}`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user
router.put('/users/:userId', requireCompanyAdmin, async (req, res) => {
    const { companyId } = req.user;
    const { userId } = req.params;
    const { name, role, department, permissions, status } = req.body;
    
    try {
        const user = await getUserDetails(companyId, userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Prevent self-demotion for admins
        if (userId === req.user.id && role !== 'admin' && req.user.role === 'admin') {
            return res.status(400).json({ 
                error: 'Cannot change your own admin role' 
            });
        }
        
        const updated = await updateUser(userId, {
            name,
            role,
            department,
            permissions: permissions || ROLE_TEMPLATES[role]?.permissions || [],
            status,
            updatedBy: req.user.id
        });
        
        res.json({
            success: true,
            user: updated,
            message: 'User updated successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.delete('/users/:userId', requireCompanyAdmin, async (req, res) => {
    const { companyId } = req.user;
    const { userId } = req.params;
    
    try {
        const user = await getUserDetails(companyId, userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Prevent self-deletion
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        
        await deleteUser(userId);
        
        res.json({
            success: true,
            message: `User ${user.name} has been removed`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Resend invitation
router.post('/users/:userId/resend-invite', requireCompanyAdmin, async (req, res) => {
    const { companyId } = req.user;
    const { userId } = req.params;
    
    try {
        const user = await getUserDetails(companyId, userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (user.status !== 'pending') {
            return res.status(400).json({ 
                error: 'Can only resend invitations to pending users' 
            });
        }
        
        await sendInvitationEmail(user);
        
        res.json({
            success: true,
            message: `Invitation resent to ${user.email}`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to resend invitation' });
    }
});

// Reset user password
router.post('/users/:userId/reset-password', requireCompanyAdmin, async (req, res) => {
    const { companyId } = req.user;
    const { userId } = req.params;
    
    try {
        const user = await getUserDetails(companyId, userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await sendPasswordResetEmail(user);
        
        res.json({
            success: true,
            message: `Password reset email sent to ${user.email}`
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Get user activity log
router.get('/users/:userId/activity', async (req, res) => {
    const { companyId } = req.user;
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    
    try {
        const user = await getUserDetails(companyId, userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const activities = await getUserActivityLog(userId, {
            limit: parseInt(limit)
        });
        
        res.json({
            success: true,
            activities: activities.map(activity => ({
                id: activity.id,
                action: activity.action,
                resource: activity.resource,
                details: activity.details,
                ipAddress: activity.ipAddress,
                timestamp: activity.timestamp
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch activity log' });
    }
});

// Get available permissions
router.get('/permissions', (req, res) => {
    res.json({
        success: true,
        permissions: Object.entries(PERMISSIONS).map(([key, description]) => ({
            key,
            description,
            category: key.split('.')[0]
        }))
    });
});

// Get role templates
router.get('/roles', (req, res) => {
    res.json({
        success: true,
        roles: Object.entries(ROLE_TEMPLATES).map(([key, role]) => ({
            key,
            name: role.name,
            description: role.description,
            permissions: role.permissions
        }))
    });
});

// Check user permission
router.post('/check-permission', (req, res) => {
    const { permission } = req.body;
    const hasPermission = req.user.permissions.includes(permission);
    
    res.json({
        success: true,
        hasPermission,
        permission
    });
});

// Helper functions (in production, these would be in a separate service/model)
async function getCompanyUsers(companyId, filters) {
    // Simulated data - replace with database queries
    const allUsers = [
        {
            id: '1',
            companyId,
            name: 'John Smith',
            email: 'john.smith@company.com',
            role: 'admin',
            department: 'Management',
            status: 'active',
            permissions: ROLE_TEMPLATES.admin.permissions,
            createdAt: new Date('2025-01-15'),
            lastActive: new Date()
        },
        {
            id: '2',
            companyId,
            name: 'Sarah Johnson',
            email: 'sarah.j@company.com',
            role: 'manager',
            department: 'Operations',
            status: 'active',
            permissions: ROLE_TEMPLATES.manager.permissions,
            createdAt: new Date('2025-02-01'),
            lastActive: new Date(Date.now() - 60 * 60 * 1000)
        }
    ];
    
    // Apply filters
    let filtered = allUsers;
    
    if (filters.role) {
        filtered = filtered.filter(u => u.role === filters.role);
    }
    
    if (filters.status) {
        filtered = filtered.filter(u => u.status === filters.status);
    }
    
    if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(u => 
            u.name.toLowerCase().includes(search) ||
            u.email.toLowerCase().includes(search) ||
            u.department.toLowerCase().includes(search)
        );
    }
    
    // Pagination
    const start = (filters.page - 1) * filters.limit;
    const paginatedUsers = filtered.slice(start, start + filters.limit);
    
    return {
        data: paginatedUsers,
        total: filtered.length
    };
}

async function getUserDetails(companyId, userId) {
    // In production, fetch from database
    const users = await getCompanyUsers(companyId, {});
    return users.data.find(u => u.id === userId);
}

async function getUserByEmail(email) {
    // Check if user exists across all companies
    return null; // Placeholder
}

async function createUser(userData) {
    // Create user in database
    return {
        id: Date.now().toString(),
        ...userData,
        createdAt: new Date()
    };
}

async function updateUser(userId, updates) {
    // Update user in database
    return {
        id: userId,
        ...updates,
        updatedAt: new Date()
    };
}

async function deleteUser(userId) {
    // Soft delete user in database
    return true;
}

async function sendInvitationEmail(user) {
    // Send email via email service
    console.log(`Sending invitation to ${user.email}`);
    return true;
}

async function sendPasswordResetEmail(user) {
    // Send password reset email
    console.log(`Sending password reset to ${user.email}`);
    return true;
}

async function getUserActivityLog(userId, options) {
    // Fetch from activity log table
    return [
        {
            id: '1',
            userId,
            action: 'login',
            resource: 'auth',
            details: 'Successful login',
            ipAddress: '192.168.1.1',
            timestamp: new Date()
        },
        {
            id: '2',
            userId,
            action: 'view',
            resource: 'shipment',
            details: 'Viewed shipment MAEU1234567',
            ipAddress: '192.168.1.1',
            timestamp: new Date(Date.now() - 30 * 60 * 1000)
        }
    ];
}

async function getUserActivitySummary(userId) {
    return {
        totalLogins: 156,
        lastLogin: new Date(),
        shipmentsCreated: 45,
        documentsUploaded: 23,
        lastActivity: new Date()
    };
}

async function getCompanyUserCount(companyId) {
    const users = await getCompanyUsers(companyId, {});
    return users.total;
}

async function getCompanyUserLimit(companyId) {
    // Get from company subscription plan
    return 50; // Default limit
}

module.exports = router;