-- ROOTUIP Enterprise Authentication Database Schema
-- PostgreSQL schema for production-grade authentication system

-- Create database (run as superuser)
-- CREATE DATABASE rootuip_auth;
-- \c rootuip_auth;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'operations', 'viewer');
CREATE TYPE audit_action AS ENUM (
    'REGISTER',
    'EMAIL_VERIFIED',
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'MFA_ENABLED',
    'MFA_DISABLED',
    'MFA_FAILED',
    'LOGOUT',
    'PASSWORD_RESET_REQUEST',
    'PASSWORD_RESET',
    'PASSWORD_CHANGED',
    'PROFILE_UPDATED',
    'USER_LOCKED',
    'USER_UNLOCKED',
    'USER_ROLE_CHANGED',
    'TOKEN_REVOKED',
    'API_KEY_CREATED',
    'API_KEY_DELETED'
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    company VARCHAR(255),
    role user_role DEFAULT 'viewer',
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    mfa_enabled_at TIMESTAMP,
    locked BOOLEAN DEFAULT FALSE,
    locked_at TIMESTAMP,
    login_attempts INTEGER DEFAULT 0,
    last_login TIMESTAMP,
    password_changed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_company ON users(company);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Verification tokens table
CREATE TABLE verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'email_verification', 'password_reset'
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_tokens_token ON verification_tokens(token);
CREATE INDEX idx_verification_tokens_user_id ON verification_tokens(user_id);
CREATE INDEX idx_verification_tokens_expires_at ON verification_tokens(expires_at);

-- Refresh tokens table
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP,
    revoked_reason VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_session_token ON sessions(session_token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- MFA backup codes table
CREATE TABLE mfa_backup_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mfa_backup_codes_user_id ON mfa_backup_codes(user_id);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action audit_action NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- API keys table (for service-to-service auth)
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    permissions JSONB,
    rate_limit INTEGER DEFAULT 1000, -- requests per hour
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- Login attempts table (for rate limiting)
CREATE TABLE login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255),
    ip_address INET,
    success BOOLEAN DEFAULT FALSE,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_login_attempts_email ON login_attempts(email);
CREATE INDEX idx_login_attempts_ip_address ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_attempted_at ON login_attempts(attempted_at);

-- Password history table (prevent reuse)
CREATE TABLE password_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_history_user_id ON password_history(user_id);

-- User preferences table
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(50) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    email_notifications BOOLEAN DEFAULT TRUE,
    security_alerts BOOLEAN DEFAULT TRUE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OAuth providers table
CREATE TABLE oauth_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google', 'azure', 'okta'
    provider_user_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    profile_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_oauth_providers_user_id ON oauth_providers(user_id);
CREATE INDEX idx_oauth_providers_provider ON oauth_providers(provider);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_oauth_providers_updated_at BEFORE UPDATE ON oauth_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM verification_tokens WHERE expires_at < CURRENT_TIMESTAMP;
    DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP;
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
    DELETE FROM login_attempts WHERE attempted_at < CURRENT_TIMESTAMP - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create stored procedures for common operations

-- Register new user
CREATE OR REPLACE FUNCTION register_user(
    p_email VARCHAR,
    p_password_hash VARCHAR,
    p_first_name VARCHAR,
    p_last_name VARCHAR,
    p_company VARCHAR
)
RETURNS TABLE(user_id UUID, verification_token VARCHAR) AS $$
DECLARE
    v_user_id UUID;
    v_token VARCHAR;
BEGIN
    -- Insert user
    INSERT INTO users (email, password_hash, first_name, last_name, company)
    VALUES (p_email, p_password_hash, p_first_name, p_last_name, p_company)
    RETURNING id INTO v_user_id;
    
    -- Generate verification token
    v_token := encode(gen_random_bytes(32), 'hex');
    
    INSERT INTO verification_tokens (user_id, token, type, expires_at)
    VALUES (v_user_id, v_token, 'email_verification', CURRENT_TIMESTAMP + INTERVAL '24 hours');
    
    RETURN QUERY SELECT v_user_id, v_token;
END;
$$ LANGUAGE plpgsql;

-- Verify user email
CREATE OR REPLACE FUNCTION verify_user_email(p_token VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get user_id from token
    SELECT user_id INTO v_user_id
    FROM verification_tokens
    WHERE token = p_token
        AND type = 'email_verification'
        AND expires_at > CURRENT_TIMESTAMP
        AND used = FALSE;
    
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update user
    UPDATE users SET verified = TRUE, verified_at = CURRENT_TIMESTAMP
    WHERE id = v_user_id;
    
    -- Mark token as used
    UPDATE verification_tokens SET used = TRUE, used_at = CURRENT_TIMESTAMP
    WHERE token = p_token;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Record login attempt
CREATE OR REPLACE FUNCTION record_login_attempt(
    p_email VARCHAR,
    p_ip_address INET,
    p_success BOOLEAN
)
RETURNS void AS $$
BEGIN
    INSERT INTO login_attempts (email, ip_address, success)
    VALUES (p_email, p_ip_address, p_success);
    
    IF NOT p_success THEN
        UPDATE users SET login_attempts = login_attempts + 1
        WHERE email = p_email;
    ELSE
        UPDATE users SET 
            login_attempts = 0,
            last_login = CURRENT_TIMESTAMP
        WHERE email = p_email;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance
CREATE INDEX idx_users_email_password ON users(email, password_hash) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_verified ON users(verified) WHERE deleted_at IS NULL;
CREATE INDEX idx_audit_logs_user_action ON audit_logs(user_id, action);

-- Create views for common queries

-- Active users view
CREATE VIEW active_users AS
SELECT 
    id,
    email,
    first_name,
    last_name,
    company,
    role,
    verified,
    mfa_enabled,
    last_login,
    created_at
FROM users
WHERE deleted_at IS NULL AND locked = FALSE;

-- User sessions view
CREATE VIEW active_sessions AS
SELECT 
    s.id,
    s.user_id,
    u.email,
    u.first_name,
    u.last_name,
    s.ip_address,
    s.user_agent,
    s.last_activity,
    s.created_at
FROM sessions s
JOIN users u ON s.user_id = u.id
WHERE s.expires_at > CURRENT_TIMESTAMP;

-- Recent audit logs view
CREATE VIEW recent_audit_logs AS
SELECT 
    a.id,
    a.user_id,
    u.email,
    u.first_name,
    u.last_name,
    a.action,
    a.details,
    a.ip_address,
    a.created_at
FROM audit_logs a
LEFT JOIN users u ON a.user_id = u.id
WHERE a.created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
ORDER BY a.created_at DESC;

-- Grant permissions (adjust as needed)
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO rootuip_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rootuip_app;

-- Sample data for testing (remove in production)
-- INSERT INTO users (email, password_hash, first_name, last_name, company, role, verified)
-- VALUES 
--     ('admin@rootuip.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpF3xUyJjUJuIi', 'Admin', 'User', 'ROOTUIP', 'admin', true),
--     ('demo@rootuip.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpF3xUyJjUJuIi', 'Demo', 'User', 'Demo Company', 'viewer', true);