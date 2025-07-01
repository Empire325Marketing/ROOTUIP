-- ROOTUIP Production Database Schema
-- Enterprise-grade PostgreSQL database structure

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create database and roles
CREATE DATABASE rootuip_prod WITH 
    ENCODING 'UTF8' 
    LC_COLLATE 'en_US.UTF-8' 
    LC_CTYPE 'en_US.UTF-8' 
    TEMPLATE template0;

\c rootuip_prod;

-- Create application user
CREATE ROLE rootuip_user WITH
    LOGIN
    NOSUPERUSER
    NOCREATEDB
    NOCREATEROLE
    NOINHERIT
    NOREPLICATION
    CONNECTION LIMIT 50
    PASSWORD 'RootUIP_Prod_2024!';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE rootuip_prod TO rootuip_user;
GRANT USAGE ON SCHEMA public TO rootuip_user;
GRANT CREATE ON SCHEMA public TO rootuip_user;

-- Companies table (Fortune 500 customers)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    industry VARCHAR(100),
    company_size VARCHAR(50),
    annual_revenue BIGINT,
    annual_container_volume INTEGER,
    headquarters_country VARCHAR(100),
    headquarters_city VARCHAR(100),
    subscription_tier VARCHAR(50) DEFAULT 'trial',
    subscription_status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Users table (Enterprise SSO integration)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    job_title VARCHAR(150),
    department VARCHAR(100),
    phone VARCHAR(50),
    role VARCHAR(50) DEFAULT 'user',
    saml_subject_id VARCHAR(255),
    microsoft_azure_id VARCHAR(255),
    last_login TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    password_hash VARCHAR(255), -- For non-SSO users
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Containers table (Real-time tracking)
CREATE TABLE containers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    container_number VARCHAR(20) NOT NULL,
    booking_number VARCHAR(50),
    carrier_code VARCHAR(10),
    carrier_name VARCHAR(100),
    vessel_name VARCHAR(150),
    voyage_number VARCHAR(50),
    port_of_loading VARCHAR(100),
    port_of_discharge VARCHAR(100),
    final_destination VARCHAR(100),
    container_type VARCHAR(20),
    container_size INTEGER,
    cargo_weight DECIMAL(10,2),
    cargo_value DECIMAL(15,2),
    status VARCHAR(50),
    current_location VARCHAR(255),
    estimated_arrival TIMESTAMP WITH TIME ZONE,
    actual_arrival TIMESTAMP WITH TIME ZONE,
    pickup_appointment TIMESTAMP WITH TIME ZONE,
    return_appointment TIMESTAMP WITH TIME ZONE,
    free_days_detention INTEGER DEFAULT 0,
    free_days_demurrage INTEGER DEFAULT 0,
    detention_charges DECIMAL(10,2) DEFAULT 0,
    demurrage_charges DECIMAL(10,2) DEFAULT 0,
    total_charges DECIMAL(10,2) DEFAULT 0,
    risk_level VARCHAR(20) DEFAULT 'low',
    ai_prediction_accuracy DECIMAL(5,2),
    last_api_update TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Container events table (Audit trail)
CREATE TABLE container_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    container_id UUID REFERENCES containers(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_description TEXT,
    location VARCHAR(255),
    coordinates POINT,
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    carrier_reported BOOLEAN DEFAULT false,
    ai_detected BOOLEAN DEFAULT false,
    confidence_score DECIMAL(5,2),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- AI predictions table
CREATE TABLE ai_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    container_id UUID REFERENCES containers(id) ON DELETE CASCADE,
    prediction_type VARCHAR(50) NOT NULL, -- 'detention', 'demurrage', 'delay'
    predicted_outcome VARCHAR(100),
    confidence_score DECIMAL(5,2),
    predicted_cost DECIMAL(10,2),
    prediction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    actual_outcome VARCHAR(100),
    actual_cost DECIMAL(10,2),
    accuracy_verified BOOLEAN DEFAULT false,
    model_version VARCHAR(20),
    features_used JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ROI calculations table (Lead generation)
CREATE TABLE roi_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255),
    company_name VARCHAR(255),
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    job_title VARCHAR(150),
    industry VARCHAR(100),
    company_size VARCHAR(50),
    annual_container_volume INTEGER,
    current_dd_charges DECIMAL(15,2),
    calculated_savings DECIMAL(15,2),
    detention_savings DECIMAL(15,2),
    demurrage_savings DECIMAL(15,2),
    operational_savings DECIMAL(15,2),
    roi_percentage DECIMAL(8,2),
    payback_period_months INTEGER,
    lead_score INTEGER,
    lead_qualified BOOLEAN DEFAULT false,
    follow_up_priority VARCHAR(20),
    hubspot_contact_id VARCHAR(50),
    salesforce_lead_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table (Real-time notifications)
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    container_id UUID REFERENCES containers(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    potential_cost DECIMAL(10,2),
    recommended_action TEXT,
    status VARCHAR(20) DEFAULT 'active',
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    notification_sent BOOLEAN DEFAULT false,
    email_sent BOOLEAN DEFAULT false,
    slack_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API usage tracking
CREATE TABLE api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    ip_address INET,
    user_agent TEXT,
    api_key_used VARCHAR(100),
    rate_limited BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System metrics table
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4),
    metric_unit VARCHAR(20),
    tags JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Audit log table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_industry ON companies(industry);
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_saml_subject_id ON users(saml_subject_id);
CREATE INDEX idx_containers_company_id ON containers(company_id);
CREATE INDEX idx_containers_number ON containers(container_number);
CREATE INDEX idx_containers_status ON containers(status);
CREATE INDEX idx_containers_risk_level ON containers(risk_level);
CREATE INDEX idx_containers_eta ON containers(estimated_arrival);
CREATE INDEX idx_container_events_container_id ON container_events(container_id);
CREATE INDEX idx_container_events_timestamp ON container_events(event_timestamp);
CREATE INDEX idx_ai_predictions_container_id ON ai_predictions(container_id);
CREATE INDEX idx_ai_predictions_type ON ai_predictions(prediction_type);
CREATE INDEX idx_roi_calculations_email ON roi_calculations(contact_email);
CREATE INDEX idx_roi_calculations_created ON roi_calculations(created_at);
CREATE INDEX idx_alerts_company_id ON alerts(company_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_created ON alerts(created_at);
CREATE INDEX idx_api_usage_company_id ON api_usage(company_id);
CREATE INDEX idx_api_usage_created ON api_usage(created_at);
CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Create composite indexes for complex queries
CREATE INDEX idx_containers_company_status ON containers(company_id, status);
CREATE INDEX idx_containers_company_risk ON containers(company_id, risk_level);
CREATE INDEX idx_alerts_company_status ON alerts(company_id, status);
CREATE INDEX idx_api_usage_company_endpoint ON api_usage(company_id, endpoint);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create updated_at triggers
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_containers_updated_at BEFORE UPDATE ON containers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant table permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rootuip_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rootuip_user;

-- Insert sample Fortune 500 companies
INSERT INTO companies (name, domain, industry, company_size, annual_revenue, annual_container_volume, headquarters_country, headquarters_city, subscription_tier) VALUES
('Walmart Inc.', 'walmart.com', 'retail', 'fortune500', 611289000000, 45000, 'United States', 'Bentonville', 'enterprise'),
('Amazon.com Inc.', 'amazon.com', 'retail', 'fortune500', 469822000000, 75000, 'United States', 'Seattle', 'enterprise'),
('Apple Inc.', 'apple.com', 'consumer_goods', 'fortune500', 394328000000, 25000, 'United States', 'Cupertino', 'enterprise'),
('Target Corporation', 'target.com', 'retail', 'fortune500', 109120000000, 35000, 'United States', 'Minneapolis', 'professional'),
('The Home Depot Inc.', 'homedepot.com', 'retail', 'fortune500', 151157000000, 28000, 'United States', 'Atlanta', 'professional');

-- Insert sample users (Fortune 500 executives)
INSERT INTO users (company_id, email, first_name, last_name, job_title, department, role, is_active) VALUES
((SELECT id FROM companies WHERE domain = 'walmart.com'), 'supply.chain@walmart.com', 'Jennifer', 'Martinez', 'VP Supply Chain', 'Operations', 'admin', true),
((SELECT id FROM companies WHERE domain = 'amazon.com'), 'logistics@amazon.com', 'David', 'Thompson', 'Director of Logistics', 'Operations', 'admin', true),
((SELECT id FROM companies WHERE domain = 'apple.com'), 'procurement@apple.com', 'Sarah', 'Chen', 'Senior Manager Procurement', 'Supply Chain', 'user', true),
((SELECT id FROM companies WHERE domain = 'target.com'), 'operations@target.com', 'Michael', 'Rodriguez', 'Operations Manager', 'Operations', 'user', true),
((SELECT id FROM companies WHERE domain = 'homedepot.com'), 'shipping@homedepot.com', 'Lisa', 'Johnson', 'Shipping Manager', 'Logistics', 'user', true);

-- Insert sample containers with realistic data
INSERT INTO containers (
    company_id, container_number, booking_number, carrier_code, carrier_name, 
    vessel_name, voyage_number, port_of_loading, port_of_discharge, 
    container_type, container_size, cargo_value, status, current_location,
    estimated_arrival, risk_level, ai_prediction_accuracy
) VALUES
((SELECT id FROM companies WHERE domain = 'walmart.com'), 'TCLU1234567', 'WALMART2024001', 'MSC', 'Mediterranean Shipping Company', 'MSC MARIA', '24001W', 'Shanghai', 'Los Angeles', '40HC', 40, 250000.00, 'In Transit', 'Pacific Ocean', CURRENT_TIMESTAMP + INTERVAL '5 days', 'medium', 94.2),
((SELECT id FROM companies WHERE domain = 'amazon.com'), 'AMZU9876543', 'AMAZON2024002', 'MAEU', 'Maersk Line', 'MAERSK ESSEX', '24002E', 'Ningbo', 'Long Beach', '40GP', 40, 180000.00, 'At Port', 'Port of Long Beach', CURRENT_TIMESTAMP + INTERVAL '1 day', 'high', 91.8),
((SELECT id FROM companies WHERE domain = 'apple.com'), 'APLU5555555', 'APPLE2024003', 'COSCO', 'COSCO Shipping', 'COSCO GLORY', '24003G', 'Shenzhen', 'Oakland', '20GP', 20, 500000.00, 'In Transit', 'Pacific Ocean', CURRENT_TIMESTAMP + INTERVAL '7 days', 'low', 96.5),
((SELECT id FROM companies WHERE domain = 'target.com'), 'TGTU7777777', 'TARGET2024004', 'HAPAG', 'Hapag-Lloyd', 'HAPAG EXPRESS', '24004H', 'Qingdao', 'Seattle', '40HC', 40, 120000.00, 'Delivered', 'Seattle Port', CURRENT_TIMESTAMP - INTERVAL '2 days', 'low', 93.1),
((SELECT id FROM companies WHERE domain = 'homedepot.com'), 'HMDU3333333', 'HOMEDEPOT2024005', 'EVERGREEN', 'Evergreen Line', 'EVER GLORY', '24005G', 'Kaohsiung', 'Tacoma', '20GP', 20, 85000.00, 'At Port', 'Port of Tacoma', CURRENT_TIMESTAMP, 'medium', 89.7);

-- Insert sample AI predictions
INSERT INTO ai_predictions (
    container_id, prediction_type, predicted_outcome, confidence_score, 
    predicted_cost, model_version, features_used
) VALUES
((SELECT id FROM containers WHERE container_number = 'TCLU1234567'), 'detention', 'likely_detention', 87.5, 15000.00, 'v2.1.0', '{"weather_delay": true, "port_congestion": "medium", "historical_pattern": "high_risk"}'),
((SELECT id FROM containers WHERE container_number = 'AMZU9876543'), 'demurrage', 'high_demurrage_risk', 92.3, 25000.00, 'v2.1.0', '{"port_congestion": "high", "vessel_delay": true, "free_days": 3}'),
((SELECT id FROM containers WHERE container_number = 'APLU5555555'), 'delay', 'on_time_delivery', 94.1, 0.00, 'v2.1.0', '{"weather_favorable": true, "port_congestion": "low", "vessel_performance": "excellent"}');

-- Insert sample alerts
INSERT INTO alerts (
    company_id, container_id, alert_type, severity, title, message, 
    potential_cost, recommended_action, status
) VALUES
((SELECT id FROM companies WHERE domain = 'walmart.com'), (SELECT id FROM containers WHERE container_number = 'TCLU1234567'), 'detention_risk', 'high', 'High Detention Risk Detected', 'Container TCLU1234567 has 87.5% probability of incurring detention charges', 15000.00, 'Schedule pickup appointment within 24 hours', 'active'),
((SELECT id FROM companies WHERE domain = 'amazon.com'), (SELECT id FROM containers WHERE container_number = 'AMZU9876543'), 'demurrage_risk', 'critical', 'Critical Demurrage Risk', 'Container AMZU9876543 at Port of Long Beach faces high demurrage charges due to port congestion', 25000.00, 'Expedite pickup or negotiate extended free time', 'active'),
((SELECT id FROM companies WHERE domain = 'apple.com'), (SELECT id FROM containers WHERE container_number = 'APLU5555555'), 'on_time_delivery', 'low', 'On-Time Delivery Confirmed', 'Container APLU5555555 expected to arrive on schedule with minimal risk', 0.00, 'Continue monitoring', 'resolved');

-- Insert sample ROI calculations (leads)
INSERT INTO roi_calculations (
    company_name, contact_name, contact_email, job_title, industry, 
    company_size, annual_container_volume, calculated_savings, 
    detention_savings, demurrage_savings, operational_savings, 
    roi_percentage, payback_period_months, lead_score, lead_qualified
) VALUES
('Fortune 100 Retailer', 'Jennifer Martinez', 'supply.chain@fortune100retailer.com', 'VP Supply Chain', 'retail', 'fortune500', 45000, 18500000.00, 11000000.00, 7000000.00, 500000.00, 847.3, 8, 385, true),
('Global Manufacturing Corp', 'David Thompson', 'operations@globalmanufacturing.com', 'COO', 'manufacturing', 'enterprise', 32000, 25200000.00, 15000000.00, 9500000.00, 700000.00, 1156.8, 6, 392, true),
('Tech Innovation Inc', 'Sarah Chen', 'procurement@techinnovation.com', 'Procurement Director', 'consumer_goods', 'enterprise', 18000, 12800000.00, 7200000.00, 4800000.00, 800000.00, 512.0, 12, 298, true);

-- Create views for reporting
CREATE VIEW company_metrics AS
SELECT 
    c.name as company_name,
    c.industry,
    c.annual_container_volume,
    COUNT(cont.id) as active_containers,
    SUM(cont.detention_charges + cont.demurrage_charges) as total_charges,
    AVG(ap.confidence_score) as avg_prediction_accuracy,
    COUNT(CASE WHEN a.severity = 'critical' THEN 1 END) as critical_alerts
FROM companies c
LEFT JOIN containers cont ON c.id = cont.company_id AND cont.status != 'Delivered'
LEFT JOIN ai_predictions ap ON cont.id = ap.container_id
LEFT JOIN alerts a ON c.id = a.company_id AND a.status = 'active'
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, c.industry, c.annual_container_volume;

CREATE VIEW risk_dashboard AS
SELECT 
    cont.container_number,
    comp.name as company_name,
    cont.status,
    cont.risk_level,
    cont.estimated_arrival,
    cont.detention_charges + cont.demurrage_charges as total_charges,
    ap.confidence_score,
    ap.predicted_cost,
    COUNT(a.id) as active_alerts
FROM containers cont
JOIN companies comp ON cont.company_id = comp.id
LEFT JOIN ai_predictions ap ON cont.id = ap.container_id
LEFT JOIN alerts a ON cont.id = a.container_id AND a.status = 'active'
WHERE cont.status IN ('In Transit', 'At Port')
GROUP BY cont.id, cont.container_number, comp.name, cont.status, cont.risk_level, 
         cont.estimated_arrival, cont.detention_charges, cont.demurrage_charges,
         ap.confidence_score, ap.predicted_cost
ORDER BY cont.risk_level DESC, ap.predicted_cost DESC;

-- Create materialized view for performance
CREATE MATERIALIZED VIEW daily_metrics AS
SELECT 
    DATE(created_at) as metric_date,
    COUNT(*) as total_containers,
    COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_risk_containers,
    AVG(ai_prediction_accuracy) as avg_prediction_accuracy,
    SUM(detention_charges + demurrage_charges) as total_charges_prevented,
    COUNT(DISTINCT company_id) as active_companies
FROM containers
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY metric_date DESC;

-- Refresh materialized view daily
-- Add this to cron: 0 1 * * * psql -d rootuip_prod -c "REFRESH MATERIALIZED VIEW daily_metrics;"

-- Create function for ROI calculation
CREATE OR REPLACE FUNCTION calculate_roi(
    p_annual_volume INTEGER,
    p_industry VARCHAR,
    p_company_size VARCHAR,
    p_current_charges DECIMAL DEFAULT NULL
) RETURNS TABLE(
    total_savings DECIMAL,
    detention_savings DECIMAL,
    demurrage_savings DECIMAL,
    operational_savings DECIMAL,
    roi_percentage DECIMAL,
    payback_months INTEGER
) AS $$
DECLARE
    industry_multiplier DECIMAL := 1.0;
    size_multiplier DECIMAL := 1.0;
    base_savings DECIMAL;
    estimated_charges DECIMAL;
BEGIN
    -- Industry-specific multipliers
    CASE p_industry
        WHEN 'retail' THEN industry_multiplier := 1.3;
        WHEN 'manufacturing' THEN industry_multiplier := 1.5;
        WHEN 'automotive' THEN industry_multiplier := 1.7;
        WHEN 'pharmaceuticals' THEN industry_multiplier := 1.8;
        ELSE industry_multiplier := 1.0;
    END CASE;
    
    -- Company size multipliers
    CASE p_company_size
        WHEN 'fortune500' THEN size_multiplier := 3.2;
        WHEN 'enterprise' THEN size_multiplier := 1.8;
        WHEN 'midmarket' THEN size_multiplier := 1.0;
        WHEN 'small' THEN size_multiplier := 0.6;
        ELSE size_multiplier := 1.0;
    END CASE;
    
    -- Calculate base savings
    IF p_current_charges IS NOT NULL THEN
        estimated_charges := p_current_charges;
    ELSE
        -- Industry average: $2000 per container detention + $1500 demurrage
        estimated_charges := p_annual_volume * 3500 * industry_multiplier * size_multiplier;
    END IF;
    
    -- ROOTUIP prevents 85% of D&D charges on average
    base_savings := estimated_charges * 0.85;
    
    RETURN QUERY SELECT
        base_savings as total_savings,
        base_savings * 0.6 as detention_savings,  -- 60% typically detention
        base_savings * 0.4 as demurrage_savings,  -- 40% typically demurrage
        p_annual_volume * 500.0 as operational_savings,  -- $500 per container operational savings
        ((base_savings + (p_annual_volume * 500.0)) / 100000.0) * 100 as roi_percentage,  -- Assuming $100k investment
        GREATEST(1, (100000.0 / ((base_savings + (p_annual_volume * 500.0)) / 12.0))::INTEGER) as payback_months;
END;
$$ LANGUAGE plpgsql;

-- Create function for alert scoring
CREATE OR REPLACE FUNCTION calculate_alert_score(
    p_container_id UUID,
    p_risk_factors JSONB
) RETURNS INTEGER AS $$
DECLARE
    score INTEGER := 0;
    container_rec RECORD;
    port_congestion TEXT;
    weather_risk TEXT;
    vessel_delay BOOLEAN;
BEGIN
    -- Get container details
    SELECT * INTO container_rec FROM containers WHERE id = p_container_id;
    
    -- Base risk scoring
    CASE container_rec.risk_level
        WHEN 'high' THEN score := score + 40;
        WHEN 'medium' THEN score := score + 20;
        WHEN 'low' THEN score := score + 5;
    END CASE;
    
    -- Extract risk factors from JSONB
    port_congestion := p_risk_factors->>'port_congestion';
    weather_risk := p_risk_factors->>'weather_risk';
    vessel_delay := (p_risk_factors->>'vessel_delay')::BOOLEAN;
    
    -- Port congestion scoring
    CASE port_congestion
        WHEN 'high' THEN score := score + 30;
        WHEN 'medium' THEN score := score + 15;
        WHEN 'low' THEN score := score + 5;
    END CASE;
    
    -- Weather risk scoring
    CASE weather_risk
        WHEN 'severe' THEN score := score + 25;
        WHEN 'moderate' THEN score := score + 10;
        WHEN 'minimal' THEN score := score + 2;
    END CASE;
    
    -- Vessel delay penalty
    IF vessel_delay THEN
        score := score + 20;
    END IF;
    
    -- Time to arrival urgency
    IF container_rec.estimated_arrival <= CURRENT_TIMESTAMP + INTERVAL '2 days' THEN
        score := score + 15;
    ELSIF container_rec.estimated_arrival <= CURRENT_TIMESTAMP + INTERVAL '5 days' THEN
        score := score + 8;
    END IF;
    
    -- Cargo value factor
    IF container_rec.cargo_value > 500000 THEN
        score := score + 15;
    ELSIF container_rec.cargo_value > 200000 THEN
        score := score + 8;
    END IF;
    
    RETURN LEAST(score, 100);  -- Cap at 100
END;
$$ LANGUAGE plpgsql;

-- Create performance monitoring function
CREATE OR REPLACE FUNCTION get_platform_metrics()
RETURNS TABLE(
    metric_name TEXT,
    metric_value DECIMAL,
    metric_unit TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'total_companies'::TEXT,
        COUNT(*)::DECIMAL,
        'count'::TEXT
    FROM companies WHERE deleted_at IS NULL
    
    UNION ALL
    
    SELECT 
        'active_containers'::TEXT,
        COUNT(*)::DECIMAL,
        'count'::TEXT
    FROM containers WHERE status IN ('In Transit', 'At Port')
    
    UNION ALL
    
    SELECT 
        'avg_prediction_accuracy'::TEXT,
        AVG(ai_prediction_accuracy),
        'percentage'::TEXT
    FROM containers WHERE ai_prediction_accuracy IS NOT NULL
    
    UNION ALL
    
    SELECT 
        'total_savings_ytd'::TEXT,
        COALESCE(SUM(calculated_savings), 0),
        'usd'::TEXT
    FROM roi_calculations 
    WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)
    
    UNION ALL
    
    SELECT 
        'active_alerts'::TEXT,
        COUNT(*)::DECIMAL,
        'count'::TEXT
    FROM alerts WHERE status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION calculate_roi TO rootuip_user;
GRANT EXECUTE ON FUNCTION calculate_alert_score TO rootuip_user;
GRANT EXECUTE ON FUNCTION get_platform_metrics TO rootuip_user;

-- Create database backup function
CREATE OR REPLACE FUNCTION backup_database()
RETURNS TEXT AS $$
DECLARE
    backup_file TEXT;
    backup_timestamp TEXT;
BEGIN
    backup_timestamp := TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DD_HH24-MI-SS');
    backup_file := '/var/www/rootuip/backups/db_backup_' || backup_timestamp || '.sql';
    
    -- This would be called by external script, not executed directly
    RETURN backup_file;
END;
$$ LANGUAGE plpgsql;

-- Insert initial system metrics
INSERT INTO system_metrics (metric_name, metric_value, metric_unit, tags) VALUES
('platform_version', 1.0, 'version', '{"environment": "production"}'),
('database_version', 15.0, 'version', '{"type": "postgresql"}'),
('api_endpoints', 25.0, 'count', '{"status": "active"}'),
('supported_carriers', 15.0, 'count', '{"integration": "api"}');

-- Create data retention policy
-- Delete old API usage logs after 90 days
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS VOID AS $$
BEGIN
    -- Delete old API usage logs
    DELETE FROM api_usage WHERE created_at < CURRENT_DATE - INTERVAL '90 days';
    
    -- Delete old audit logs (keep 1 year)
    DELETE FROM audit_logs WHERE created_at < CURRENT_DATE - INTERVAL '365 days';
    
    -- Delete old container events (keep 2 years)
    DELETE FROM container_events WHERE created_at < CURRENT_DATE - INTERVAL '730 days';
    
    -- Delete old system metrics (keep 6 months)
    DELETE FROM system_metrics WHERE timestamp < CURRENT_DATE - INTERVAL '180 days';
    
    -- Refresh materialized view
    REFRESH MATERIALIZED VIEW daily_metrics;
END;
$$ LANGUAGE plpgsql;

-- Final permissions check
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.role_table_grants 
                   WHERE grantee = 'rootuip_user' AND table_name = 'companies') THEN
        RAISE EXCEPTION 'Permissions not properly granted to rootuip_user';
    END IF;
    
    RAISE NOTICE 'Database setup completed successfully!';
    RAISE NOTICE 'Tables created: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public');
    RAISE NOTICE 'Indexes created: %', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public');
    RAISE NOTICE 'Sample data inserted: % companies, % users, % containers', 
        (SELECT COUNT(*) FROM companies),
        (SELECT COUNT(*) FROM users),
        (SELECT COUNT(*) FROM containers);
END $$;