#!/usr/bin/env node

/**
 * ROOTUIP Unified Authentication Service
 * Handles authentication for the unified application
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.AUTH_PORT || 3003;

app.use(cors({
    origin: ["https://rootuip.com", "http://localhost:3000", "http://localhost:3001"],
    credentials: true
}));

app.use(express.json());

// Demo users for the unified application
const demoUsers = [
    {
        id: 'primary-001',
        email: 'mjaiii@rootuip.com',
        password: 'rootuip2024', // In production, this would be hashed
        name: 'MJ',
        role: 'admin',
        title: 'Platform Administrator',
        company: 'ROOTUIP',
        permissions: ['*'] // Full access to all features
    },
    {
        id: 'demo-exec',
        email: 'demo-executive@rootuip.com',
        password: 'demo123',
        name: 'Demo Executive',
        role: 'executive',
        title: 'VP Supply Chain',
        company: 'Demo Company',
        permissions: ['view_all', 'analytics', 'reports', 'admin', 'export']
    },
    {
        id: 'demo-ops',
        email: 'demo-operations@rootuip.com',
        password: 'demo456',
        name: 'Demo Operations',
        role: 'operations',
        title: 'Operations Manager',
        company: 'Demo Company',
        permissions: ['view_operations', 'tracking', 'reports', 'alerts']
    }
];

// Login endpoint
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    console.log(`🔐 Login attempt for: ${email}`);
    
    // Find user
    const user = demoUsers.find(u => u.email === email && u.password === password);
    
    if (!user) {
        return res.status(401).json({ 
            error: 'Invalid credentials',
            message: 'Please check your email and password'
        });
    }
    
    // Create JWT token
    const token = jwt.sign(
        { 
            userId: user.id, 
            email: user.email, 
            role: user.role,
            permissions: user.permissions
        },
        process.env.JWT_SECRET || 'rootuip-jwt-secret-2024',
        { expiresIn: '7d' }
    );
    
    // Return user data without password
    const userData = { ...user };
    delete userData.password;
    
    res.json({ 
        success: true,
        message: 'Login successful',
        user: userData,
        token,
        redirectUrl: '/app.html#dashboard'
    });
});

// SSO login endpoint (simulated)
app.post('/sso/microsoft', async (req, res) => {
    // Simulate Microsoft SSO
    const mockSSOUser = {
        id: 'sso-001',
        email: 'enterprise.user@fortune500.com',
        name: 'Enterprise User',
        role: 'executive',
        title: 'Chief Operations Officer',
        company: 'Fortune 500 Enterprise',
        permissions: ['view_all', 'analytics', 'reports', 'export']
    };
    
    const token = jwt.sign(
        { 
            userId: mockSSOUser.id, 
            email: mockSSOUser.email, 
            role: mockSSOUser.role,
            permissions: mockSSOUser.permissions
        },
        process.env.JWT_SECRET || 'rootuip-jwt-secret-2024',
        { expiresIn: '7d' }
    );
    
    res.json({ 
        success: true,
        message: 'SSO login successful',
        user: mockSSOUser,
        token,
        redirectUrl: '/app.html#dashboard'
    });
});

// Token validation endpoint
app.get('/validate', async (req, res) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'rootuip-jwt-secret-2024');
        const user = demoUsers.find(u => u.id === decoded.userId);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        const userData = { ...user };
        delete userData.password;
        
        res.json({ valid: true, user: userData });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// Logout endpoint
app.post('/logout', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Logged out successfully',
        redirectUrl: '/'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'unified-auth',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`🔐 Unified Authentication Service running on port ${PORT}`);
    console.log(`📧 Demo users available:`);
    demoUsers.forEach(user => {
        console.log(`   ${user.email} (${user.role})`);
    });
});

module.exports = app;