const express = require('express');
const cors = require('cors');
const saml2 = require('saml2-js');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const redis = require('redis');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Redis client for session storage
const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
});

// Session configuration
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET || 'rootuip-enterprise-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Database connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rootuip'
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'rootuip-jwt-secret-2024';

// Microsoft Entra SAML Configuration
const sp_options = {
    entity_id: "https://tracking.rootuip.com",
    private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7W8xQ3Y3X5X5X
[Your Private Key Here]
-----END PRIVATE KEY-----`,
    certificate: `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKl3GZW3zK+VMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
[Your Certificate Here]
-----END CERTIFICATE-----`,
    assert_endpoint: "https://tracking.rootuip.com/api/auth/saml/assert",
    force_authn: false,
    sign_get_request: false,
    allow_unencrypted_assertion: false
};

// Identity Provider options (Microsoft Entra)
const idp_options = {
    sso_login_url: "https://login.microsoftonline.com/{tenant-id}/saml2",
    sso_logout_url: "https://login.microsoftonline.com/{tenant-id}/saml2/logout",
    certificates: [`-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKl3GZW3zK+VMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
[Microsoft Entra Certificate Here]
-----END CERTIFICATE-----`],
    force_authn: false,
    sign_get_request: false,
    allow_unencrypted_assertion: false
};

// Create service provider
const sp = new saml2.ServiceProvider(sp_options);

// Create identity provider
const idp = new saml2.IdentityProvider(idp_options);

// SAML Login endpoint
app.get('/api/auth/saml/login', (req, res) => {
    sp.create_login_request_url(idp, {}, (err, login_url, request_id) => {
        if (err) {
            console.error('SAML login error:', err);
            return res.status(500).json({ error: 'Failed to create SAML request' });
        }
        
        // Store request ID in session
        req.session.saml_request_id = request_id;
        
        // Redirect to Microsoft Entra login
        res.redirect(login_url);
    });
});

// SAML Assert endpoint (callback from Microsoft Entra)
app.post('/api/auth/saml/assert', async (req, res) => {
    const options = { request_body: req.body };
    
    sp.post_assert(idp, options, async (err, saml_response) => {
        if (err) {
            console.error('SAML assertion error:', err);
            return res.redirect('/login?error=saml_failed');
        }
        
        try {
            // Extract user information from SAML response
            const user = saml_response.user;
            
            // Check if user exists in database
            let dbUser = await db.query(
                'SELECT * FROM enterprise_users WHERE email = $1',
                [user.email]
            );
            
            if (dbUser.rows.length === 0) {
                // Create new user
                const result = await db.query(`
                    INSERT INTO enterprise_users (
                        email, name, company, department, 
                        azure_ad_id, created_at
                    ) VALUES ($1, $2, $3, $4, $5, NOW())
                    RETURNING id
                `, [
                    user.email,
                    user.name || user.attributes.displayName,
                    user.attributes.company,
                    user.attributes.department,
                    user.name_id
                ]);
                
                dbUser = { rows: [{ id: result.rows[0].id, ...user }] };
            }
            
            // Generate JWT token
            const token = jwt.sign({
                userId: dbUser.rows[0].id,
                email: user.email,
                name: user.name,
                company: user.attributes.company,
                role: user.attributes.role || 'user',
                authMethod: 'saml'
            }, JWT_SECRET, { expiresIn: '24h' });
            
            // Set session
            req.session.user = {
                id: dbUser.rows[0].id,
                email: user.email,
                name: user.name,
                company: user.attributes.company
            };
            
            // Log authentication event
            await db.query(`
                INSERT INTO auth_logs (
                    user_id, auth_method, ip_address, 
                    user_agent, success, created_at
                ) VALUES ($1, $2, $3, $4, $5, NOW())
            `, [
                dbUser.rows[0].id,
                'saml',
                req.ip,
                req.headers['user-agent'],
                true
            ]);
            
            // Redirect to dashboard with token
            res.redirect(`/dashboard?token=${token}`);
            
        } catch (error) {
            console.error('User creation error:', error);
            res.redirect('/login?error=user_creation_failed');
        }
    });
});

// SAML Logout endpoint
app.get('/api/auth/saml/logout', (req, res) => {
    const options = {
        name_id: req.session.user?.email,
        session_index: req.session.session_index
    };
    
    sp.create_logout_request_url(idp, options, (err, logout_url) => {
        if (err) {
            console.error('SAML logout error:', err);
            return res.status(500).json({ error: 'Failed to create logout request' });
        }
        
        // Clear session
        req.session.destroy();
        
        // Redirect to Microsoft Entra logout
        res.redirect(logout_url);
    });
});

// JWT Authentication middleware
const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid token' });
            }
            
            req.user = user;
            next();
        });
    } else {
        res.status(401).json({ error: 'Authentication required' });
    }
};

// Protected API endpoints
app.get('/api/user/profile', authenticateJWT, async (req, res) => {
    try {
        const user = await db.query(
            'SELECT * FROM enterprise_users WHERE id = $1',
            [req.user.userId]
        );
        
        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            user: user.rows[0],
            permissions: await getUserPermissions(req.user.userId)
        });
        
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Get user permissions based on role
async function getUserPermissions(userId) {
    const result = await db.query(`
        SELECT p.* FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = $1
    `, [userId]);
    
    return result.rows.map(p => p.name);
}

// Maersk OAuth Integration
const MAERSK_CLIENT_ID = process.env.MAERSK_CLIENT_ID;
const MAERSK_CLIENT_SECRET = process.env.MAERSK_CLIENT_SECRET;
const MAERSK_REDIRECT_URI = 'https://tracking.rootuip.com/api/auth/maersk/callback';

// Maersk OAuth login
app.get('/api/auth/maersk/login', (req, res) => {
    const authUrl = `https://api.maersk.com/oauth/authorize?` +
        `client_id=${MAERSK_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(MAERSK_REDIRECT_URI)}&` +
        `response_type=code&` +
        `scope=container:read vessel:read`;
    
    res.redirect(authUrl);
});

// Maersk OAuth callback
app.get('/api/auth/maersk/callback', async (req, res) => {
    const { code } = req.query;
    
    if (!code) {
        return res.redirect('/login?error=oauth_failed');
    }
    
    try {
        // Exchange code for token
        const tokenResponse = await fetch('https://api.maersk.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${MAERSK_CLIENT_ID}:${MAERSK_CLIENT_SECRET}`).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: MAERSK_REDIRECT_URI
            })
        });
        
        const tokenData = await tokenResponse.json();
        
        // Store Maersk tokens
        await db.query(`
            INSERT INTO oauth_tokens (
                user_id, provider, access_token, 
                refresh_token, expires_at
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, provider) 
            DO UPDATE SET 
                access_token = $3,
                refresh_token = $4,
                expires_at = $5
        `, [
            req.session.user.id,
            'maersk',
            tokenData.access_token,
            tokenData.refresh_token,
            new Date(Date.now() + tokenData.expires_in * 1000)
        ]);
        
        res.redirect('/dashboard?oauth=success');
        
    } catch (error) {
        console.error('Maersk OAuth error:', error);
        res.redirect('/login?error=oauth_failed');
    }
});

// Role-based access control
const requireRole = (role) => {
    return async (req, res, next) => {
        try {
            const userRole = await db.query(`
                SELECT r.name FROM roles r
                JOIN user_roles ur ON r.id = ur.role_id
                WHERE ur.user_id = $1
            `, [req.user.userId]);
            
            if (userRole.rows.some(r => r.name === role || r.name === 'admin')) {
                next();
            } else {
                res.status(403).json({ error: 'Insufficient permissions' });
            }
        } catch (error) {
            console.error('Role check error:', error);
            res.status(500).json({ error: 'Failed to verify permissions' });
        }
    };
};

// Admin endpoints
app.get('/api/admin/users', authenticateJWT, requireRole('admin'), async (req, res) => {
    try {
        const users = await db.query(`
            SELECT u.*, r.name as role, 
                   COUNT(DISTINCT al.id) as login_count,
                   MAX(al.created_at) as last_login
            FROM enterprise_users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            LEFT JOIN auth_logs al ON u.id = al.user_id
            GROUP BY u.id, r.name
            ORDER BY u.created_at DESC
        `);
        
        res.json(users.rows);
        
    } catch (error) {
        console.error('User list error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Initialize database tables
async function initializeDatabase() {
    try {
        // Enterprise users table
        await db.query(`
            CREATE TABLE IF NOT EXISTS enterprise_users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                name VARCHAR(255),
                company VARCHAR(255),
                department VARCHAR(255),
                azure_ad_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP
            )
        `);
        
        // Roles table
        await db.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT
            )
        `);
        
        // User roles mapping
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_roles (
                user_id INTEGER REFERENCES enterprise_users(id),
                role_id INTEGER REFERENCES roles(id),
                PRIMARY KEY (user_id, role_id)
            )
        `);
        
        // Permissions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS permissions (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                description TEXT
            )
        `);
        
        // Role permissions mapping
        await db.query(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id INTEGER REFERENCES roles(id),
                permission_id INTEGER REFERENCES permissions(id),
                PRIMARY KEY (role_id, permission_id)
            )
        `);
        
        // OAuth tokens
        await db.query(`
            CREATE TABLE IF NOT EXISTS oauth_tokens (
                user_id INTEGER REFERENCES enterprise_users(id),
                provider VARCHAR(50),
                access_token TEXT,
                refresh_token TEXT,
                expires_at TIMESTAMP,
                PRIMARY KEY (user_id, provider)
            )
        `);
        
        // Authentication logs
        await db.query(`
            CREATE TABLE IF NOT EXISTS auth_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES enterprise_users(id),
                auth_method VARCHAR(50),
                ip_address VARCHAR(50),
                user_agent TEXT,
                success BOOLEAN,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Insert default roles
        await db.query(`
            INSERT INTO roles (name, description) VALUES
            ('admin', 'Full system access'),
            ('manager', 'Department management access'),
            ('user', 'Standard user access'),
            ('viewer', 'Read-only access')
            ON CONFLICT (name) DO NOTHING
        `);
        
        console.log('Enterprise auth database initialized');
        
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// Start server
const PORT = process.env.PORT || 3008;
app.listen(PORT, () => {
    console.log(`Enterprise Authentication Server running on port ${PORT}`);
    initializeDatabase();
});

module.exports = app;