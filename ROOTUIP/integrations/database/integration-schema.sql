-- Integration System Database Schema
-- PostgreSQL schema for carrier integrations and data processing

-- Carrier integrations configuration
CREATE TABLE carrier_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    carrier VARCHAR(50) NOT NULL,
    carrier_name VARCHAR(255) NOT NULL,
    integration_type VARCHAR(50) NOT NULL, -- 'api', 'edi', 'email', 'manual'
    status VARCHAR(50) DEFAULT 'disconnected',
    config JSONB NOT NULL DEFAULT '{}',
    credentials JSONB, -- Encrypted credentials
    last_sync TIMESTAMP WITH TIME ZONE,
    error_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    metrics JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, carrier)
);

-- Integration data storage
CREATE TABLE integration_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES carrier_integrations(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL, -- 'container_status', 'dd_charges', 'booking', 'invoice'
    data JSONB NOT NULL,
    raw_data JSONB,
    data_hash VARCHAR(64) NOT NULL,
    quality_score INTEGER DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Container tracking data
CREATE TABLE container_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processed_id UUID REFERENCES integration_data(id),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    container_number VARCHAR(11) NOT NULL,
    carrier VARCHAR(50) NOT NULL,
    status VARCHAR(50),
    location JSONB,
    timestamp TIMESTAMP WITH TIME ZONE,
    vessel_name VARCHAR(255),
    voyage_number VARCHAR(50),
    eta TIMESTAMP WITH TIME ZONE,
    events JSONB,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(container_number, carrier)
);

-- D&D charges
CREATE TABLE dd_charges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processed_id UUID REFERENCES integration_data(id),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    container_number VARCHAR(11) NOT NULL,
    carrier VARCHAR(50) NOT NULL,
    charge_type VARCHAR(20) NOT NULL, -- 'demurrage', 'detention'
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days INTEGER NOT NULL,
    rate DECIMAL(10, 2),
    invoice_number VARCHAR(50),
    booking_number VARCHAR(50),
    port_code VARCHAR(10),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'invoiced', 'paid', 'disputed', 'waived'
    dispute_eligible BOOLEAN DEFAULT false,
    scenario VARCHAR(50),
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dispute management
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    charge_id UUID NOT NULL REFERENCES dd_charges(id),
    container_number VARCHAR(11) NOT NULL,
    carrier VARCHAR(50) NOT NULL,
    original_amount DECIMAL(10, 2) NOT NULL,
    disputed_amount DECIMAL(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    evidence JSONB,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'under_review', 'approved', 'rejected', 'settled'
    outcome JSONB,
    created_by UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Bookings
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    processed_id UUID REFERENCES integration_data(id),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    booking_number VARCHAR(50) NOT NULL,
    carrier VARCHAR(50) NOT NULL,
    status VARCHAR(50),
    booking_date DATE,
    origin_port VARCHAR(10),
    destination_port VARCHAR(10),
    containers JSONB,
    vessel_info JSONB,
    customer_reference VARCHAR(100),
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(booking_number, carrier)
);

-- Processing queue
CREATE TABLE processing_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    priority VARCHAR(20) DEFAULT 'normal', -- 'high', 'normal', 'low'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'duplicate'
    data JSONB NOT NULL,
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Processed data archive
CREATE TABLE processed_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    carrier VARCHAR(50),
    data JSONB NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    quality_score INTEGER DEFAULT 0,
    processing_time INTEGER, -- milliseconds
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for processed data
CREATE TABLE processed_data_2024_01 PARTITION OF processed_data
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE processed_data_2024_02 PARTITION OF processed_data
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Continue creating partitions as needed...

-- Integration errors
CREATE TABLE integration_errors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID REFERENCES carrier_integrations(id),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    data_type VARCHAR(50),
    error_type VARCHAR(50),
    error_message TEXT,
    error_stack TEXT,
    raw_data JSONB,
    retry_count INTEGER DEFAULT 0,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhooks configuration
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events JSONB NOT NULL, -- Array of event types
    carriers JSONB, -- Array of carriers, null = all
    secret VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    failure_count INTEGER DEFAULT 0,
    last_triggered TIMESTAMP WITH TIME ZONE,
    last_success TIMESTAMP WITH TIME ZONE,
    last_failure TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Webhook deliveries log
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    response_time INTEGER, -- milliseconds
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Port reference data
CREATE TABLE ports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(2) NOT NULL,
    unlocode VARCHAR(5),
    latitude DECIMAL(10, 6),
    longitude DECIMAL(10, 6),
    timezone VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert common ports
INSERT INTO ports (code, name, country, unlocode, latitude, longitude) VALUES
('USLAX', 'Los Angeles', 'US', 'USLAX', 33.7406, -118.2706),
('USLGB', 'Long Beach', 'US', 'USLGB', 33.7550, -118.2023),
('USNYC', 'New York', 'US', 'USNYC', 40.6892, -74.0445),
('CNSHA', 'Shanghai', 'CN', 'CNSHA', 31.2304, 121.4737),
('SGSIN', 'Singapore', 'SG', 'SGSIN', 1.2655, 103.8186),
('NLRTM', 'Rotterdam', 'NL', 'NLRTM', 51.9225, 4.4792),
('DEHAM', 'Hamburg', 'DE', 'DEHAM', 53.5511, 9.9937);

-- Indexes for performance
CREATE INDEX idx_integration_data_hash ON integration_data(data_hash);
CREATE INDEX idx_integration_data_created ON integration_data(created_at);
CREATE INDEX idx_integration_data_type ON integration_data(data_type);

CREATE INDEX idx_container_tracking_number ON container_tracking(container_number);
CREATE INDEX idx_container_tracking_carrier ON container_tracking(carrier);
CREATE INDEX idx_container_tracking_status ON container_tracking(status);
CREATE INDEX idx_container_tracking_timestamp ON container_tracking(timestamp);

CREATE INDEX idx_dd_charges_container ON dd_charges(container_number);
CREATE INDEX idx_dd_charges_carrier ON dd_charges(carrier);
CREATE INDEX idx_dd_charges_status ON dd_charges(status);
CREATE INDEX idx_dd_charges_dates ON dd_charges(start_date, end_date);
CREATE INDEX idx_dd_charges_amount ON dd_charges(amount);

CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_container ON disputes(container_number);
CREATE INDEX idx_disputes_created ON disputes(created_at);

CREATE INDEX idx_bookings_number ON bookings(booking_number);
CREATE INDEX idx_bookings_carrier ON bookings(carrier);
CREATE INDEX idx_bookings_date ON bookings(booking_date);

CREATE INDEX idx_processing_queue_status ON processing_queue(status);
CREATE INDEX idx_processing_queue_priority ON processing_queue(priority, created_at);

CREATE INDEX idx_processed_data_hash ON processed_data(content_hash);
CREATE INDEX idx_processed_data_type ON processed_data(type);
CREATE INDEX idx_processed_data_created ON processed_data(created_at);

CREATE INDEX idx_integration_errors_created ON integration_errors(created_at);
CREATE INDEX idx_integration_errors_integration ON integration_errors(integration_id);
CREATE INDEX idx_integration_errors_resolved ON integration_errors(resolved);

CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_created ON webhook_deliveries(created_at);
CREATE INDEX idx_webhook_deliveries_event ON webhook_deliveries(event_type);

-- Functions for data processing

-- Function to check data quality
CREATE OR REPLACE FUNCTION check_data_quality(data JSONB, data_type VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    quality_score INTEGER := 100;
    required_fields TEXT[];
BEGIN
    -- Define required fields by data type
    CASE data_type
        WHEN 'container_status' THEN
            required_fields := ARRAY['containerNumber', 'status', 'timestamp'];
        WHEN 'dd_charges' THEN
            required_fields := ARRAY['containerNumber', 'chargeType', 'amount', 'currency'];
        WHEN 'booking' THEN
            required_fields := ARRAY['bookingNumber', 'origin', 'destination'];
        ELSE
            required_fields := ARRAY[]::TEXT[];
    END CASE;
    
    -- Check for missing fields
    FOREACH field IN ARRAY required_fields
    LOOP
        IF data->field IS NULL THEN
            quality_score := quality_score - 10;
        END IF;
    END LOOP;
    
    -- Check data freshness
    IF data->>'timestamp' IS NOT NULL THEN
        IF (NOW() - (data->>'timestamp')::TIMESTAMP) > INTERVAL '48 hours' THEN
            quality_score := quality_score - 20;
        ELSIF (NOW() - (data->>'timestamp')::TIMESTAMP) > INTERVAL '24 hours' THEN
            quality_score := quality_score - 10;
        END IF;
    END IF;
    
    RETURN GREATEST(0, quality_score);
END;
$$ LANGUAGE plpgsql;

-- Function to merge duplicate data
CREATE OR REPLACE FUNCTION merge_duplicate_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for existing container tracking data
    IF TG_TABLE_NAME = 'container_tracking' THEN
        UPDATE container_tracking
        SET 
            status = NEW.status,
            location = NEW.location,
            timestamp = NEW.timestamp,
            vessel_name = NEW.vessel_name,
            voyage_number = NEW.voyage_number,
            eta = NEW.eta,
            events = NEW.events,
            data = NEW.data,
            updated_at = NOW()
        WHERE container_number = NEW.container_number 
            AND carrier = NEW.carrier
            AND id != NEW.id;
        
        -- Delete the new duplicate record
        IF FOUND THEN
            RETURN NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for duplicate handling
CREATE TRIGGER handle_duplicate_containers
    BEFORE INSERT ON container_tracking
    FOR EACH ROW
    EXECUTE FUNCTION merge_duplicate_data();

-- Views for common queries

-- Active containers with charges
CREATE VIEW containers_with_charges AS
SELECT 
    ct.container_number,
    ct.carrier,
    ct.status,
    ct.location,
    ct.timestamp as last_update,
    COALESCE(SUM(dc.amount), 0) as total_charges,
    COUNT(dc.id) as charge_count,
    ARRAY_AGG(DISTINCT dc.charge_type) as charge_types
FROM container_tracking ct
LEFT JOIN dd_charges dc ON ct.container_number = dc.container_number
GROUP BY ct.container_number, ct.carrier, ct.status, ct.location, ct.timestamp;

-- Integration performance metrics
CREATE VIEW integration_performance AS
SELECT 
    ci.carrier,
    ci.carrier_name,
    ci.status,
    ci.last_sync,
    ci.error_count,
    ci.success_count,
    CASE 
        WHEN (ci.error_count + ci.success_count) > 0 
        THEN (ci.success_count::FLOAT / (ci.error_count + ci.success_count) * 100)
        ELSE 0 
    END as success_rate,
    COUNT(DISTINCT id.id) as total_records,
    AVG(id.quality_score) as avg_quality_score
FROM carrier_integrations ci
LEFT JOIN integration_data id ON ci.id = id.integration_id
GROUP BY ci.id, ci.carrier, ci.carrier_name, ci.status, ci.last_sync, ci.error_count, ci.success_count;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO uip_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO uip_app;