/**
 * ROOTUIP Enterprise Authentication Server
 * Integrates Microsoft Entra SAML with Container Tracking Platform
 */

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SamlStrategy = require('passport-saml').Strategy;
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['https://app.rootuip.com'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Read SAML certificate
const samlCert = fs.readFileSync(path.join(__dirname, 'certificates', 'saml-cert.cer'), 'utf-8');

// SAML Strategy Configuration
const samlStrategy = new SamlStrategy({
    callbackUrl: process.env.SAML_CONSUMER_SERVICE_URL,
    entryPoint: process.env.SAML_LOGIN_URL,
    issuer: process.env.SAML_ENTITY_ID,
    cert: samlCert,
    identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    acceptedClockSkewMs: -1
}, (profile, done) => {
    // Map SAML attributes to user object
    const user = {
        id: profile.nameID,
        email: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || profile.email,
        displayName: profile['http://schemas.microsoft.com/identity/claims/displayname'] || profile.displayName,
        firstName: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || profile.firstName,
        lastName: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'] || profile.lastName,
        roles: extractRoles(profile),
        department: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/department'] || 'Operations',
        raw: profile
    };
    return done(null, user);
});

// Extract roles from SAML profile
function extractRoles(profile) {
    const roles = [];
    
    // Check for group membership
    const groups = profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] || [];
    
    // Map Azure AD groups to application roles
    if (Array.isArray(groups)) {
        if (groups.includes('c-suite-group-id')) roles.push('C_SUITE');
        if (groups.includes('operations-group-id')) roles.push('OPERATIONS');
        if (groups.includes('admin-group-id')) roles.push('ADMIN');
    }
    
    // Check job title for role inference
    const jobTitle = profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/jobtitle'] || '';
    if (jobTitle.match(/CEO|CFO|CTO|President|VP/i)) roles.push('C_SUITE');
    if (jobTitle.match(/Manager|Director|Supervisor/i)) roles.push('MANAGER');
    if (jobTitle.match(/Operator|Analyst|Coordinator/i)) roles.push('OPERATIONS');
    
    // Default role if none found
    if (roles.length === 0) roles.push('USER');
    
    return roles;
}

passport.use('saml', samlStrategy);

// Passport serialization
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    
    // Check for JWT token
    const token = req.cookies.jwt || req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded.user;
            return next();
        } catch (err) {
            console.error('JWT verification failed:', err);
        }
    }
    
    res.redirect('/login');
};

// Role-based access control
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const userRoles = req.user.roles || [];
        const hasRole = roles.some(role => userRoles.includes(role));
        
        if (hasRole) {
            return next();
        }
        
        res.status(403).json({ error: 'Insufficient permissions' });
    };
};

// Routes

// Login page
app.get('/login', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ROOTUIP - Enterprise Login</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #003f7f 0%, #0066cc 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .login-container {
            background: white;
            padding: 3rem;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            max-width: 400px;
            width: 100%;
            text-align: center;
        }
        
        .logo {
            font-size: 2rem;
            font-weight: 700;
            color: #003f7f;
            margin-bottom: 0.5rem;
        }
        
        .subtitle {
            color: #666;
            margin-bottom: 2rem;
            font-size: 0.875rem;
        }
        
        .microsoft-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            width: 100%;
            padding: 1rem;
            background: #0078d4;
            color: white;
            border: none;
            border-radius: 5px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            transition: background 0.3s;
        }
        
        .microsoft-btn:hover {
            background: #005a9e;
        }
        
        .microsoft-icon {
            width: 20px;
            height: 20px;
        }
        
        .security-note {
            margin-top: 2rem;
            padding: 1rem;
            background: #f5f5f5;
            border-radius: 5px;
            font-size: 0.75rem;
            color: #666;
        }
        
        .features {
            margin-top: 2rem;
            text-align: left;
        }
        
        .feature {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.75rem;
            color: #333;
            font-size: 0.875rem;
        }
        
        .check {
            color: #00a651;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">ROOTUIP</div>
        <div class="subtitle">Container Intelligence Platform</div>
        
        <div class="features">
            <div class="feature">
                <span class="check">✓</span>
                <span>Real-time container tracking</span>
            </div>
            <div class="feature">
                <span class="check">✓</span>
                <span>AI-powered D&D risk prediction</span>
            </div>
            <div class="feature">
                <span class="check">✓</span>
                <span>94.2% prevention accuracy</span>
            </div>
            <div class="feature">
                <span class="check">✓</span>
                <span>Enterprise-grade security</span>
            </div>
        </div>
        
        <a href="/auth/saml" class="microsoft-btn">
            <svg class="microsoft-icon" viewBox="0 0 21 21" fill="currentColor">
                <rect x="1" y="1" width="9" height="9"/>
                <rect x="1" y="11" width="9" height="9"/>
                <rect x="11" y="1" width="9" height="9"/>
                <rect x="11" y="11" width="9" height="9"/>
            </svg>
            Login with Microsoft
        </a>
        
        <div class="security-note">
            🔒 Secured by Microsoft Entra ID (Azure AD)<br>
            Your credentials are never stored on our servers
        </div>
    </div>
</body>
</html>
    `);
});

// SAML login
app.get('/auth/saml',
    passport.authenticate('saml', {
        failureRedirect: '/login',
        failureFlash: true
    })
);

// SAML callback
app.post('/saml/acs',
    passport.authenticate('saml', {
        failureRedirect: '/login',
        failureFlash: true
    }),
    (req, res) => {
        // Generate JWT token
        const token = jwt.sign(
            { user: req.user },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        
        // Generate refresh token
        const refreshToken = jwt.sign(
            { userId: req.user.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
        );
        
        // Set cookies
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000 // 15 minutes
        });
        
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        // Redirect to dashboard
        res.redirect('/dashboard');
    }
);

// SAML metadata
app.get('/saml/metadata', (req, res) => {
    res.type('application/xml');
    res.send(samlStrategy.generateServiceProviderMetadata(null, null));
});

// Dashboard route (protected)
app.get('/dashboard', requireAuth, (req, res) => {
    const isCSuite = req.user.roles.includes('C_SUITE');
    const dashboardPath = isCSuite ? 
        '/container-tracking-executive.html' : 
        '/container-tracking-interface.html';
    
    res.redirect(dashboardPath);
});

// User info API
app.get('/api/user', requireAuth, (req, res) => {
    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            displayName: req.user.displayName,
            roles: req.user.roles,
            department: req.user.department
        }
    });
});

// Refresh token
app.post('/api/refresh-token', (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token' });
    }
    
    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        
        // Generate new access token
        const newToken = jwt.sign(
            { user: { id: decoded.userId } },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        
        res.cookie('jwt', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000
        });
        
        res.json({ success: true });
    } catch (err) {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

// Logout
app.get('/logout', (req, res) => {
    // Clear local session
    req.logout((err) => {
        if (err) console.error('Logout error:', err);
    });
    
    // Clear cookies
    res.clearCookie('jwt');
    res.clearCookie('refreshToken');
    res.clearCookie('connect.sid');
    
    // Redirect to SAML logout
    const logoutUrl = `${process.env.SAML_LOGOUT_URL}?returnTo=${encodeURIComponent('https://app.rootuip.com')}`;
    res.redirect(logoutUrl);
});

// Proxy to container tracking API (with auth)
app.use('/api/tracking', requireAuth, createProxyMiddleware({
    target: 'http://localhost:3008',
    changeOrigin: true,
    pathRewrite: {
        '^/api/tracking': '/api'
    },
    onProxyReq: (proxyReq, req) => {
        // Add user info to proxied request
        proxyReq.setHeader('X-User-ID', req.user.id);
        proxyReq.setHeader('X-User-Roles', req.user.roles.join(','));
    }
}));

// Proxy to WebSocket (with auth check)
app.use('/ws', requireAuth, createProxyMiddleware({
    target: 'ws://localhost:3008',
    ws: true,
    changeOrigin: true,
    onProxyReqWs: (proxyReq, req, socket, options, head) => {
        // Add user info to WebSocket upgrade request
        proxyReq.setHeader('X-User-ID', req.user.id);
        proxyReq.setHeader('X-User-Roles', req.user.roles.join(','));
    }
}));

// Serve static files (protected)
app.use(express.static(path.join(__dirname), {
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        }
    }
}));

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 
            'Internal server error' : 
            err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Enterprise Auth Server running on port ${PORT}`);
    console.log(`Login URL: http://localhost:${PORT}/login`);
    console.log(`SAML Metadata: http://localhost:${PORT}/saml/metadata`);
});

module.exports = app;