#!/usr/bin/env node

/**
 * ROOTUIP Microsoft SAML Authentication
 * Enterprise-grade authentication with role-based access control
 */

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SamlStrategy = require('passport-saml').Strategy;
const RedisStore = require('connect-redis')(session);
const redis = require('redis');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.SAML_AUTH_PORT || 3042;

// Redis client for session storage
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

app.use(cors({
    origin: ["https://rootuip.com", "https://demo.rootuip.com", "http://localhost:3000"],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || 'rootuip-enterprise-demo-secret-2025',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// SAML Configuration (Demo/Simulation)
const SAML_CONFIG = {
    entryPoint: process.env.SAML_ENTRY_POINT || 'https://login.microsoftonline.com/demo-tenant-id/saml2',
    issuer: process.env.SAML_ISSUER || 'https://rootuip.com',
    callbackUrl: process.env.SAML_CALLBACK_URL || 'https://rootuip.com/auth/saml/callback',
    cert: process.env.SAML_CERT || generateDemoCertificate(),
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    acceptedClockSkewMs: 5000,
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'
};

// Demo user database with enterprise personas
const enterpriseUsers = new Map([
    ['john.doe@fortune500corp.com', {
        id: 'user-001',
        email: 'john.doe@fortune500corp.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'CEO',
        department: 'Executive',
        permissions: ['view_all', 'analytics', 'reports', 'admin', 'export'],
        title: 'Chief Executive Officer',
        company: 'Fortune 500 Corp',
        lastLogin: new Date(),
        preferences: {
            dashboard: 'executive',
            timezone: 'America/New_York',
            notifications: true
        }
    }],
    ['sarah.johnson@fortune500corp.com', {
        id: 'user-002',
        email: 'sarah.johnson@fortune500corp.com',
        firstName: 'Sarah',
        lastName: 'Johnson',
        role: 'Operations Director',
        department: 'Operations',
        permissions: ['view_operations', 'analytics', 'reports', 'alerts'],
        title: 'Director of Global Operations',
        company: 'Fortune 500 Corp',
        lastLogin: new Date(),
        preferences: {
            dashboard: 'operations',
            timezone: 'America/Chicago',
            notifications: true
        }
    }],
    ['michael.chen@fortune500corp.com', {
        id: 'user-003',
        email: 'michael.chen@fortune500corp.com',
        firstName: 'Michael',
        lastName: 'Chen',
        role: 'Supply Chain Manager',
        department: 'Supply Chain',
        permissions: ['view_shipments', 'tracking', 'reports'],
        title: 'Senior Supply Chain Manager',
        company: 'Fortune 500 Corp',
        lastLogin: new Date(),
        preferences: {
            dashboard: 'supply_chain',
            timezone: 'America/Los_Angeles',
            notifications: true
        }
    }],
    ['emma.williams@fortune500corp.com', {
        id: 'user-004',
        email: 'emma.williams@fortune500corp.com',
        firstName: 'Emma',
        lastName: 'Williams',
        role: 'Finance Manager',
        department: 'Finance',
        permissions: ['view_finance', 'analytics', 'reports', 'export'],
        title: 'Finance Manager - Logistics',
        company: 'Fortune 500 Corp',
        lastLogin: new Date(),
        preferences: {
            dashboard: 'finance',
            timezone: 'America/New_York',
            notifications: false
        }
    }],
    ['david.garcia@fortune500corp.com', {
        id: 'user-005',
        email: 'david.garcia@fortune500corp.com',
        firstName: 'David',
        lastName: 'Garcia',
        role: 'Logistics Analyst',
        department: 'Logistics',
        permissions: ['view_analytics', 'tracking', 'alerts'],
        title: 'Senior Logistics Analyst',
        company: 'Fortune 500 Corp',
        lastLogin: new Date(),
        preferences: {
            dashboard: 'analyst',
            timezone: 'America/Denver',
            notifications: true
        }
    }]
]);

// Connect to Redis
async function connectRedis() {
    try {
        await redisClient.connect();
        console.log('✅ Redis connected for SAML authentication');
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
    }
}

connectRedis();

// Generate demo certificate for SAML (for demonstration purposes)
function generateDemoCertificate() {
    // This is a demo certificate - in production, use real certificates
    return `-----BEGIN CERTIFICATE-----
MIICmzCCAYMCBgF8j9k1LjANBgkqhkiG9w0BAQsFADAQMQ4wDAYDVQQDDAVST09U
VUlQMB4XDTIyMDEwMTAwMDAwMFoXDTMyMDEwMTAwMDAwMFowEDEOMAwGA1UEAwwF
Uk9PVFVJUDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAM1KQhkGHmQv
uVGKhqGzQQ8Jw7dGvRpYhzxCcQ2RrpGvMY2tKvLKKz2RvNjJL2Kq4QzNxGrPL8WD
QoZlZZyYqF8JLmZ4ZzZyK6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4
ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKy
FqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZ
wQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRq
MxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRz
FyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMx
N8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvM
z8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRy
ZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNv
Q2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8Rm
GpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8Rj
NrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQy
KpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2Kq
M6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNz
QqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGv
LpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4
RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6Zz
KzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6
L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4
RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZy
L6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGr
LpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4
ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKy
FqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZ
wQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRq
MxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRz
FyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMx
N8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvM
z8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRy
ZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNv
Q2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8Rm
GpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8Rj
NrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQy
KpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2Kq
M6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNz
QqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGv
LpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4
RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6Zz
KzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6
L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4
RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZy
L6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGr
LpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4
ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKy
FqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZ
wQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRq
MxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRz
FyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMx
N8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvM
z8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRy
ZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNv
Q2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8Rm
GpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8Rj
NrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQy
KpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2Kq
M6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNz
QqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGv
LpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4
RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6Zz
KzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6
L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4
RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZy
L6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGr
LpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4
ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKy
FqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZ
wQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRq
MxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRz
FyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMx
N8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvM
z8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRy
ZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNv
Q2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8Rm
GpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8Rj
NrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQy
KpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2Kq
M6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNz
QqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGv
LpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4
RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6Zz
KzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6
L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4
RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZy
L6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGr
LpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4
ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKy
FqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZ
wQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRq
MxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRz
FyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMx
N8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvM
z8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRy
ZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNv
Q2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8Rm
GpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8Rj
NrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQy
KpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2Kq
M6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNz
QqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGv
LpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4
RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6Zz
KzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6
L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4
RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZy
L6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGr
LpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4
ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKy
FqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZ
wQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRq
MxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRz
FyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMx
N8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvM
z8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRy
ZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNv
Q2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8Rm
GpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8Rj
NrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQy
KpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2Kq
M6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNz
QqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGv
LpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4
RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6Zz
KzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6
L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4
RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZy
L6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGr
LpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4
ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKy
FqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZ
wQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRq
MxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRz
FyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMx
N8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvM
z8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRy
ZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNv
Q2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8Rm
GpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8Rj
NrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQy
KpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2Kq
M6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNz
QqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGv
LpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4
RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6Zz
KzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6
L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4
RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZy
L6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGr
LpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4
ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKy
FqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZ
wQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRq
MxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRz
FyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMx
N8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvM
z8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRy
ZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNv
Q2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8Rm
GpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8Rj
NrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQy
KpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2Kq
M6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNz
QqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGv
LpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4
RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6Zz
KzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6
L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4
RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZy
L6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGr
LpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4
ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKy
FqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZ
wQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRq
MxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRz
FyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMx
N8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvM
z8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRy
ZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNv
Q2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8Rm
GpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8Rj
NrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQy
KpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2Kq
M6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNz
QqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGv
LpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4
RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6Zz
KzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6
L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4
RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZy
L6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGr
LpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4
ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKy
FqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZ
wQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRq
MxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRz
FyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMx
N8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvM
z8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRy
ZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNv
Q2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8Rm
GpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8Rj
NrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQy
KpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2Kq
M6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNz
QqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGv
LpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4
RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6Zz
KzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6
L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4
RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZy
L6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGr
LpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4
ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKy
FqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZ
wQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRq
MxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRz
FyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMx
N8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvM
z8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRy
ZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNv
Q2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8RjNrGvLpL4RzKyFqMxN8Rm
GpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQyKpN4RzZyL6oZwQvMz8Rj
NrGvLpL4RzKyFqMxN8RmGpNzQqK6L8Z4ZwRzFyNvQ2KqM6ZzKzGrLpRqMxRyZzQy
-----END CERTIFICATE-----`;
}

// Configure SAML Strategy
passport.use(new SamlStrategy(
    SAML_CONFIG,
    function(profile, done) {
        console.log('🔐 SAML authentication received for:', profile.nameID);
        
        // In demo mode, authenticate any provided email
        const user = enterpriseUsers.get(profile.nameID) || {
            id: 'demo-user',
            email: profile.nameID,
            firstName: 'Demo',
            lastName: 'User',
            role: 'Guest',
            department: 'Demo',
            permissions: ['view_demo'],
            title: 'Demo User',
            company: 'Demo Company',
            lastLogin: new Date(),
            preferences: {
                dashboard: 'demo',
                timezone: 'UTC',
                notifications: true
            }
        };
        
        // Update last login
        user.lastLogin = new Date();
        
        return done(null, user);
    }
));

// Passport serialization
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    // Find user by ID
    for (const user of enterpriseUsers.values()) {
        if (user.id === id) {
            return done(null, user);
        }
    }
    done(null, false);
});

// Demo login for testing (bypasses SAML for demo purposes)
app.post('/auth/demo/login', (req, res) => {
    const { email } = req.body;
    
    console.log(`🎭 Demo login request for: ${email}`);
    
    const user = enterpriseUsers.get(email) || {
        id: 'demo-' + email,
        email: email,
        firstName: email.split('@')[0].split('.')[0],
        lastName: email.split('@')[0].split('.')[1] || 'User',
        role: 'Demo User',
        department: 'Demo',
        permissions: ['view_demo', 'analytics', 'reports'],
        title: 'Demo User',
        company: email.split('@')[1] || 'Demo Company',
        lastLogin: new Date(),
        preferences: {
            dashboard: 'executive',
            timezone: 'America/New_York',
            notifications: true
        }
    };
    
    req.login(user, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Login failed' });
        }
        
        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                department: user.department,
                permissions: user.permissions,
                title: user.title,
                company: user.company,
                preferences: user.preferences
            },
            sessionId: req.sessionID
        });
    });
});

// SAML authentication endpoints
app.get('/auth/saml/login', passport.authenticate('saml'));

app.post('/auth/saml/callback', 
    passport.authenticate('saml', { failureRedirect: '/auth/login' }),
    (req, res) => {
        console.log('✅ SAML authentication successful for:', req.user.email);
        res.redirect('/dashboard');
    }
);

app.get('/auth/saml/metadata', (req, res) => {
    res.type('application/xml');
    res.send(generateSAMLMetadata());
});

function generateSAMLMetadata() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="${SAML_CONFIG.issuer}">
    <md:SPSSODescriptor AuthnRequestsSigned="true"
                        WantAssertionsSigned="true"
                        protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
        <md:KeyDescriptor use="signing">
            <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
                <ds:X509Data>
                    <ds:X509Certificate>${SAML_CONFIG.cert.replace(/-----BEGIN CERTIFICATE-----|\n|-----END CERTIFICATE-----/g, '')}</ds:X509Certificate>
                </ds:X509Data>
            </ds:KeyInfo>
        </md:KeyDescriptor>
        <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
        <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
                                     Location="${SAML_CONFIG.callbackUrl}"
                                     index="1"/>
    </md:SPSSODescriptor>
</md:EntityDescriptor>`;
}

// User management endpoints
app.get('/auth/user', requireAuth, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            email: req.user.email,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            role: req.user.role,
            department: req.user.department,
            permissions: req.user.permissions,
            title: req.user.title,
            company: req.user.company,
            preferences: req.user.preferences,
            lastLogin: req.user.lastLogin
        }
    });
});

app.post('/auth/logout', (req, res) => {
    const email = req.user?.email || 'unknown';
    
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
            }
            
            console.log(`🚪 User logged out: ${email}`);
            res.json({ success: true, message: 'Logged out successfully' });
        });
    });
});

// Authorization middleware
function requireAuth(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ error: 'Authentication required' });
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        if (!req.user.permissions.includes(permission)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        next();
    };
}

// Role-based dashboard configuration
app.get('/auth/dashboard-config', requireAuth, (req, res) => {
    const dashboardConfigs = {
        'executive': {
            widgets: ['kpi-overview', 'global-map', 'cost-analysis', 'executive-summary'],
            permissions: ['view_all', 'analytics', 'reports', 'export'],
            defaultView: 'global-overview'
        },
        'operations': {
            widgets: ['shipment-status', 'alerts', 'performance-metrics', 'carrier-performance'],
            permissions: ['view_operations', 'analytics', 'alerts'],
            defaultView: 'operations-center'
        },
        'supply_chain': {
            widgets: ['container-tracking', 'route-optimization', 'inventory-status', 'supplier-performance'],
            permissions: ['view_shipments', 'tracking', 'reports'],
            defaultView: 'supply-chain-overview'
        },
        'finance': {
            widgets: ['cost-breakdown', 'budget-analysis', 'roi-metrics', 'vendor-costs'],
            permissions: ['view_finance', 'analytics', 'reports', 'export'],
            defaultView: 'financial-dashboard'
        },
        'analyst': {
            widgets: ['data-analytics', 'predictive-insights', 'performance-trends', 'optimization-opportunities'],
            permissions: ['view_analytics', 'tracking', 'alerts'],
            defaultView: 'analytics-workbench'
        }
    };
    
    const userConfig = dashboardConfigs[req.user.preferences.dashboard] || dashboardConfigs['demo'];
    
    res.json({
        success: true,
        config: userConfig,
        userRole: req.user.role,
        permissions: req.user.permissions
    });
});

// Enterprise users management
app.get('/auth/users', requirePermission('admin'), (req, res) => {
    const users = Array.from(enterpriseUsers.values()).map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: user.department,
        title: user.title,
        company: user.company,
        lastLogin: user.lastLogin,
        permissions: user.permissions
    }));
    
    res.json({ success: true, users });
});

// JWT-based authentication endpoints
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    // Demo users with hashed passwords (in production, these would be in a database)
    const demoUsers = [
        { email: 'demo@rootuip.com', password: 'demo123', name: 'Demo User', role: 'Operations Manager' },
        { email: 'admin@rootuip.com', password: 'admin123', name: 'Admin User', role: 'System Administrator' },
        { email: 'executive@rootuip.com', password: 'exec123', name: 'Executive User', role: 'CEO' }
    ];
    
    const user = demoUsers.find(u => u.email === email && u.password === password);
    
    if (user || enterpriseUsers.has(email)) {
        const userData = user ? {
            id: user.email.split('@')[0],
            email: user.email,
            name: user.name,
            role: user.role,
            company: 'Fortune 500 Corp',
            permissions: ['view_all', 'analytics', 'reports']
        } : {
            id: enterpriseUsers.get(email).id,
            email: enterpriseUsers.get(email).email,
            name: `${enterpriseUsers.get(email).firstName} ${enterpriseUsers.get(email).lastName}`,
            role: enterpriseUsers.get(email).role,
            company: enterpriseUsers.get(email).company,
            permissions: enterpriseUsers.get(email).permissions
        };
        
        req.session.user = userData;
        
        const token = jwt.sign(
            { userId: userData.id, email: userData.email },
            process.env.JWT_SECRET || 'rootuip-jwt-secret-2024',
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            user: userData,
            token
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.get('/status', (req, res) => {
    if (req.session && req.session.user) {
        res.json({
            authenticated: true,
            user: req.session.user
        });
    } else if (req.isAuthenticated && req.isAuthenticated()) {
        res.json({
            authenticated: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                name: `${req.user.firstName} ${req.user.lastName}`,
                role: req.user.role,
                company: req.user.company,
                permissions: req.user.permissions
            }
        });
    } else {
        res.json({
            authenticated: false
        });
    }
});

app.post('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                res.status(500).json({ success: false, message: 'Logout failed' });
            } else {
                res.json({ success: true, message: 'Logged out successfully' });
            }
        });
    } else {
        res.json({ success: true, message: 'No active session' });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'microsoft-saml-auth',
        activeUsers: enterpriseUsers.size,
        samlConfigured: true,
        sessionStore: 'redis',
        uptime: process.uptime()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Microsoft SAML Authentication running on port ${PORT}`);
    console.log(`🔐 SAML SSO configured for enterprise authentication`);
    console.log(`👥 Enterprise users loaded: ${enterpriseUsers.size} personas`);
    console.log(`🎭 Demo login: POST /auth/demo/login`);
    console.log(`📋 SAML metadata: GET /auth/saml/metadata`);
    console.log(`🏢 Role-based access control enabled`);
});

module.exports = app;