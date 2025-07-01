-- ROOTUIP Enterprise Authentication Database Schema
-- Comprehensive schema for enterprise-grade authentication and authorization

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    domain VARCHAR(255), -- For SSO configuration
    vessels INTEGER DEFAULT 0,
    subscription_tier VARCHAR(50) DEFAULT 'standard' CHECK (subscription_tier IN ('standard', 'business', 'enterprise')),
    contract_value DECIMAL(12,2),
    billing_contact_email VARCHAR(255),
    
    -- Security settings
    enforce_mfa BOOLEAN DEFAULT false,
    password_policy JSONB DEFAULT '{"minLength": 12, "requireUppercase": true, "requireLowercase": true, "requireNumbers": true, "requireSpecialChars": true, "maxAge": 90}',
    session_timeout_minutes INTEGER DEFAULT 480, -- 8 hours
    max_concurrent_sessions INTEGER DEFAULT 5,
    ip_allowlist TEXT[], -- Array of allowed IP ranges
    
    -- SSO configuration
    sso_enabled BOOLEAN DEFAULT false,
    sso_provider VARCHAR(50), -- 'saml', 'oidc', 'azure', 'okta', etc.
    sso_config JSONB, -- Provider-specific configuration
    
    -- Account status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial', 'churned')),
    trial_ends_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    
    -- Indexes
    CONSTRAINT companies_name_check CHECK (length(name) >= 2),
    CONSTRAINT companies_domain_check CHECK (domain ~ '^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$' OR domain IS NULL)
);

-- Create indexes for companies
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_tier ON companies(subscription_tier);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified BOOLEAN DEFAULT false,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP,
    
    -- Authentication
    password_hash VARCHAR(255), -- NULL for SSO-only users
    password_changed_at TIMESTAMP DEFAULT NOW(),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    
    -- Multi-factor authentication
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255), -- TOTP secret
    mfa_backup_codes TEXT[], -- Array of backup codes
    mfa_setup_completed BOOLEAN DEFAULT false,
    
    -- Profile information
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    title VARCHAR(100),
    department VARCHAR(100),
    
    -- Role and permissions
    role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'viewer', 'api_user')),
    permissions JSONB DEFAULT '[]', -- Additional granular permissions
    
    -- Account status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'locked', 'pending')),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    
    -- Session management
    last_login TIMESTAMP,
    last_login_ip INET,
    current_session_id VARCHAR(255),
    concurrent_sessions INTEGER DEFAULT 0,
    
    -- SSO integration
    sso_provider_id VARCHAR(255), -- External SSO user ID
    sso_attributes JSONB, -- Additional SSO attributes
    
    -- API access
    api_access_enabled BOOLEAN DEFAULT false,
    api_rate_limit INTEGER DEFAULT 1000, -- Requests per hour
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    last_password_change TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT users_email_check CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_phone_check CHECK (phone ~ '^\+?[\d\s\-\(\)]{10,}$' OR phone IS NULL),
    CONSTRAINT users_failed_attempts_check CHECK (failed_login_attempts >= 0 AND failed_login_attempts <= 10)
);

-- Create indexes for users
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_last_login ON users(last_login);
CREATE INDEX idx_users_sso_provider_id ON users(sso_provider_id);

-- User sessions table for comprehensive session management
CREATE TABLE user_sessions (
    id VARCHAR(255) PRIMARY KEY, -- Session ID
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    
    -- Session metadata
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    
    -- Geographic information
    country VARCHAR(2),
    city VARCHAR(100),
    
    -- Session status
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT NOW(),
    
    -- Security flags
    is_suspicious BOOLEAN DEFAULT false,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP,
    revoked_reason VARCHAR(255)
);

-- Create indexes for sessions
CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_sessions_is_active ON user_sessions(is_active);
CREATE INDEX idx_sessions_ip_address ON user_sessions(ip_address);

-- API keys table for integration access
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Key details
    name VARCHAR(100) NOT NULL, -- Human-readable name
    key_prefix VARCHAR(10) NOT NULL, -- First 8 chars for identification
    key_hash VARCHAR(255) NOT NULL, -- Hashed full key
    
    -- Permissions and limits
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read'], -- ['read', 'write', 'admin']
    rate_limit INTEGER DEFAULT 1000, -- Requests per hour
    
    -- Usage tracking
    last_used TIMESTAMP,
    total_requests BIGINT DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP, -- NULL for non-expiring keys
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    revoked_at TIMESTAMP,
    revoked_by UUID REFERENCES users(id),
    revoked_reason VARCHAR(255)
);

-- Create indexes for API keys
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_company_id ON api_keys(company_id);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);

-- Audit log table for comprehensive activity tracking
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Actor information
    user_id UUID REFERENCES users(id),
    company_id UUID REFERENCES companies(id),
    api_key_id UUID REFERENCES api_keys(id),
    
    -- Action details
    action VARCHAR(100) NOT NULL, -- 'login', 'logout', 'create_user', 'delete_api_key', etc.
    resource_type VARCHAR(50), -- 'user', 'company', 'api_key', 'session', etc.
    resource_id VARCHAR(255), -- ID of the affected resource
    
    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(255), -- For correlation with application logs
    
    -- Change details
    old_values JSONB, -- Previous state (for updates)
    new_values JSONB, -- New state (for creates/updates)
    
    -- Result
    success BOOLEAN NOT NULL,
    error_message TEXT, -- If success = false
    
    -- Metadata
    timestamp TIMESTAMP DEFAULT NOW(),
    
    -- Additional context
    metadata JSONB -- Additional contextual information
);

-- Create indexes for audit logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);

-- Login attempts table for security monitoring
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Attempt details
    email VARCHAR(255), -- Email attempted (may not exist)
    ip_address INET NOT NULL,
    user_agent TEXT,
    
    -- Result
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100), -- 'invalid_password', 'account_locked', 'mfa_failed', etc.
    
    -- Associated user (if login succeeded or email exists)
    user_id UUID REFERENCES users(id),
    company_id UUID REFERENCES companies(id),
    
    -- Metadata
    timestamp TIMESTAMP DEFAULT NOW(),
    
    -- Geographic information
    country VARCHAR(2),
    city VARCHAR(100)
);

-- Create indexes for login attempts
CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_ip_address ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_timestamp ON login_attempts(timestamp);
CREATE INDEX idx_login_attempts_success ON login_attempts(success);
CREATE INDEX idx_login_attempts_user_id ON login_attempts(user_id);

-- Password history table to prevent reuse
CREATE TABLE password_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for password history
CREATE INDEX idx_password_history_user_id ON password_history(user_id);
CREATE INDEX idx_password_history_created_at ON password_history(created_at);

-- Company IP allowlists table
CREATE TABLE company_ip_allowlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- IP range information
    ip_range CIDR NOT NULL, -- Can be single IP or CIDR range
    description VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

-- Create indexes for IP allowlists
CREATE INDEX idx_ip_allowlists_company_id ON company_ip_allowlists(company_id);
CREATE INDEX idx_ip_allowlists_ip_range ON company_ip_allowlists USING GIST (ip_range);

-- Security events table for threat detection
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Event details
    event_type VARCHAR(50) NOT NULL, -- 'suspicious_login', 'brute_force', 'privilege_escalation', etc.
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Affected entities
    user_id UUID REFERENCES users(id),
    company_id UUID REFERENCES companies(id),
    ip_address INET,
    
    -- Event data
    description TEXT NOT NULL,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    
    -- Response
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    assigned_to UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    
    -- Metadata
    timestamp TIMESTAMP DEFAULT NOW(),
    metadata JSONB,
    
    -- Automated response
    auto_response_taken VARCHAR(255), -- Description of any automated action taken
    manual_review_required BOOLEAN DEFAULT false
);

-- Create indexes for security events
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_company_id ON security_events(company_id);
CREATE INDEX idx_security_events_status ON security_events(status);

-- SSO configurations table
CREATE TABLE sso_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- SSO provider details
    provider VARCHAR(50) NOT NULL, -- 'saml2', 'oidc', 'azure_ad', 'okta', etc.
    provider_name VARCHAR(100), -- Human-readable name
    
    -- Configuration
    configuration JSONB NOT NULL, -- Provider-specific config (encrypted sensitive data)
    
    -- SAML 2.0 specific fields
    entity_id VARCHAR(255),
    sso_url VARCHAR(500),
    slo_url VARCHAR(500),
    certificate TEXT, -- X.509 certificate
    
    -- OIDC specific fields
    client_id VARCHAR(255),
    client_secret_encrypted TEXT, -- Encrypted client secret
    discovery_url VARCHAR(500),
    scopes TEXT[],
    
    -- Attribute mapping
    attribute_mappings JSONB DEFAULT '{"email": "email", "firstName": "given_name", "lastName": "family_name"}',
    
    -- Status
    is_active BOOLEAN DEFAULT false,
    test_mode BOOLEAN DEFAULT true, -- For testing before going live
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    last_tested TIMESTAMP,
    test_results JSONB
);

-- Create indexes for SSO configurations
CREATE INDEX idx_sso_configurations_company_id ON sso_configurations(company_id);
CREATE INDEX idx_sso_configurations_provider ON sso_configurations(provider);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ip_allowlists_updated_at BEFORE UPDATE ON company_ip_allowlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sso_configurations_updated_at BEFORE UPDATE ON sso_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS (Row Level Security) policies for multi-tenancy
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Sample RLS policy (users can only see users in their company)
CREATE POLICY users_company_isolation ON users
    FOR ALL
    TO authenticated_users
    USING (company_id = current_setting('app.current_company_id')::UUID);

-- Views for common queries
CREATE VIEW active_users AS
SELECT 
    u.*,
    c.name as company_name,
    c.subscription_tier
FROM users u
JOIN companies c ON u.company_id = c.id
WHERE u.status = 'active' AND c.status = 'active';

CREATE VIEW user_permissions AS
SELECT 
    u.id,
    u.email,
    u.role,
    u.permissions,
    c.enforce_mfa,
    c.password_policy,
    CASE 
        WHEN u.role = 'admin' THEN ARRAY['users:read', 'users:write', 'company:read', 'company:write', 'api:read', 'api:write']
        WHEN u.role = 'manager' THEN ARRAY['users:read', 'users:write', 'company:read', 'api:read']
        WHEN u.role = 'viewer' THEN ARRAY['company:read']
        WHEN u.role = 'api_user' THEN ARRAY['api:read', 'api:write']
        ELSE ARRAY[]::TEXT[]
    END as effective_permissions
FROM users u
JOIN companies c ON u.company_id = c.id
WHERE u.status = 'active';

-- Function to check if IP is allowed for company
CREATE OR REPLACE FUNCTION is_ip_allowed(company_uuid UUID, client_ip INET)
RETURNS BOOLEAN AS $$
DECLARE
    ip_count INTEGER;
BEGIN
    -- If no IP allowlist is configured, allow all IPs
    SELECT COUNT(*) INTO ip_count
    FROM company_ip_allowlists
    WHERE company_id = company_uuid AND is_active = true;
    
    IF ip_count = 0 THEN
        RETURN true;
    END IF;
    
    -- Check if client IP is in any allowed range
    SELECT COUNT(*) INTO ip_count
    FROM company_ip_allowlists
    WHERE company_id = company_uuid 
    AND is_active = true 
    AND ip_range >> client_ip;
    
    RETURN ip_count > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() OR (last_activity < NOW() - INTERVAL '7 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to generate secure API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
BEGIN
    RETURN 'rk_' || encode(gen_random_bytes(32), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Insert default company and admin user (for initial setup)
INSERT INTO companies (id, name, subscription_tier, status) VALUES 
('00000000-0000-0000-0000-000000000001', 'ROOTUIP System', 'enterprise', 'active');

-- Create application roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'rootuip_app') THEN
        CREATE ROLE rootuip_app LOGIN PASSWORD 'change_this_password';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated_users') THEN
        CREATE ROLE authenticated_users;
    END IF;
END
$$;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO rootuip_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rootuip_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO rootuip_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO rootuip_app;

-- Grant authenticated_users role to app
GRANT authenticated_users TO rootuip_app;

-- Create indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_timestamp_desc ON audit_logs (timestamp DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_login_attempts_recent ON login_attempts (timestamp) WHERE timestamp > NOW() - INTERVAL '1 hour';

-- Add comments for documentation
COMMENT ON TABLE companies IS 'Enterprise customer organizations with security policies and SSO configuration';
COMMENT ON TABLE users IS 'Individual user accounts with MFA, role-based access, and session management';
COMMENT ON TABLE user_sessions IS 'Active user sessions with security tracking and device fingerprinting';
COMMENT ON TABLE api_keys IS 'API keys for system integrations with scoped permissions and usage tracking';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all system activities and security events';
COMMENT ON TABLE login_attempts IS 'Login attempts tracking for security monitoring and threat detection';
COMMENT ON TABLE security_events IS 'Security incidents and threats requiring investigation or response';
COMMENT ON TABLE sso_configurations IS 'Single Sign-On provider configurations for enterprise SSO integration';

-- Security settings
ALTER DATABASE rootuip SET log_statement = 'all';
ALTER DATABASE rootuip SET log_connections = on;
ALTER DATABASE rootuip SET log_disconnections = on;