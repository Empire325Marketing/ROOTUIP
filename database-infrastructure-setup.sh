#!/bin/bash

# ROOTUIP PostgreSQL Database Infrastructure Setup
# Complete database deployment and service integration

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Configuration
DB_HOST="localhost"
DB_PORT="5432"
DB_ADMIN_USER="postgres"
DB_ADMIN_PASS="rootuip_admin_2024!"
DB_APP_USER="rootuip_app"
DB_APP_PASS="rootuip_app_secure_2024!"
DB_ANALYTICS_USER="rootuip_analytics"
DB_ANALYTICS_PASS="rootuip_analytics_2024!"

# Database names
DBS=("rootuip_auth" "rootuip_platform" "rootuip_integration")

log "Starting ROOTUIP Database Infrastructure Setup..."

# Step 1: Install PostgreSQL 15
log "Step 1: Installing PostgreSQL 15..."
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-15 postgresql-client-15 postgresql-contrib-15

# Step 2: Configure PostgreSQL
log "Step 2: Configuring PostgreSQL..."

# Backup original configuration
sudo cp /etc/postgresql/15/main/postgresql.conf /etc/postgresql/15/main/postgresql.conf.backup
sudo cp /etc/postgresql/15/main/pg_hba.conf /etc/postgresql/15/main/pg_hba.conf.backup

# Update PostgreSQL configuration for production
sudo tee /etc/postgresql/15/main/postgresql.conf.d/rootuip.conf > /dev/null <<EOF
# ROOTUIP Production Configuration
listen_addresses = 'localhost,127.0.0.1'
port = 5432
max_connections = 200
shared_buffers = 512MB
effective_cache_size = 2GB
maintenance_work_mem = 128MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB

# Connection pooling
max_prepared_transactions = 100

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_file_mode = 0600
log_truncate_on_rotation = off
log_rotation_age = 1d
log_rotation_size = 100MB
log_line_prefix = '%m [%p] %q%u@%d '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_duration = off
log_error_verbosity = default
log_hostname = off
log_lock_waits = on
log_statement = 'mod'
log_timezone = 'UTC'

# Query performance
log_min_duration_statement = 1000  # Log queries taking more than 1 second
auto_explain.log_min_duration = 1000
auto_explain.log_analyze = true

# SSL
ssl = on
ssl_cert_file = '/etc/ssl/certs/ssl-cert-snakeoil.pem'
ssl_key_file = '/etc/ssl/private/ssl-cert-snakeoil.key'
EOF

# Update pg_hba.conf for secure connections
sudo tee /etc/postgresql/15/main/pg_hba.conf > /dev/null <<EOF
# Database administrative login by Unix domain socket
local   all             postgres                                peer

# TYPE  DATABASE        USER            ADDRESS                 METHOD

# "local" is for Unix domain socket connections only
local   all             all                                     peer

# IPv4 local connections:
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256

# SSL connections for application users
hostssl all             rootuip_app     127.0.0.1/32            scram-sha-256
hostssl all             rootuip_analytics 127.0.0.1/32         scram-sha-256

# Replication connections
local   replication     all                                     peer
host    replication     all             127.0.0.1/32            scram-sha-256
host    replication     all             ::1/128                 scram-sha-256
EOF

# Restart PostgreSQL
sudo systemctl restart postgresql@15-main
sleep 5

# Step 3: Create databases and users
log "Step 3: Creating databases and users..."

# Set postgres password
sudo -u postgres psql <<EOF
ALTER USER postgres PASSWORD '$DB_ADMIN_PASS';
EOF

# Create application user
sudo -u postgres psql <<EOF
-- Create application user
CREATE USER $DB_APP_USER WITH PASSWORD '$DB_APP_PASS';
ALTER USER $DB_APP_USER CREATEDB;

-- Create analytics user
CREATE USER $DB_ANALYTICS_USER WITH PASSWORD '$DB_ANALYTICS_PASS';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE postgres TO $DB_APP_USER;
GRANT CONNECT ON DATABASE postgres TO $DB_ANALYTICS_USER;
EOF

# Create databases
for db in "${DBS[@]}"; do
    log "Creating database: $db"
    sudo -u postgres createdb -O $DB_APP_USER $db
    
    # Enable required extensions
    sudo -u postgres psql -d $db <<EOF
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE $db TO $DB_APP_USER;
GRANT CONNECT ON DATABASE $db TO $DB_ANALYTICS_USER;
GRANT USAGE ON SCHEMA public TO $DB_ANALYTICS_USER;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO $DB_ANALYTICS_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO $DB_ANALYTICS_USER;
EOF
done

# Step 4: Install pgBouncer for connection pooling
log "Step 4: Installing pgBouncer for connection pooling..."
sudo apt install -y pgbouncer

# Configure pgBouncer
sudo tee /etc/pgbouncer/pgbouncer.ini > /dev/null <<EOF
[databases]
rootuip_auth = host=127.0.0.1 port=5432 dbname=rootuip_auth
rootuip_platform = host=127.0.0.1 port=5432 dbname=rootuip_platform
rootuip_integration = host=127.0.0.1 port=5432 dbname=rootuip_integration

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
admin_users = postgres
stats_users = stats, postgres
pool_mode = transaction
server_reset_query = DISCARD ALL
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 3
server_lifetime = 3600
server_idle_timeout = 600
server_connect_timeout = 15
server_login_retry = 15
query_timeout = 0
query_wait_timeout = 120
client_idle_timeout = 0
client_login_timeout = 60
autodb_idle_timeout = 3600
suspend_timeout = 10
ignore_startup_parameters = extra_float_digits

# Logging
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
log_stats = 1
stats_period = 60

# SSL settings
server_tls_sslmode = prefer
server_tls_ca_file = /etc/ssl/certs/ca-certificates.crt
EOF

# Create pgBouncer user list
sudo tee /etc/pgbouncer/userlist.txt > /dev/null <<EOF
"$DB_APP_USER" "$DB_APP_PASS"
"$DB_ANALYTICS_USER" "$DB_ANALYTICS_PASS"
"postgres" "$DB_ADMIN_PASS"
EOF

sudo chown postgres:postgres /etc/pgbouncer/userlist.txt
sudo chmod 600 /etc/pgbouncer/userlist.txt

# Start pgBouncer
sudo systemctl enable pgbouncer
sudo systemctl restart pgbouncer

# Step 5: Create database schemas
log "Step 5: Creating database schemas..."

# Auth database schema
PGPASSWORD=$DB_APP_PASS psql -h localhost -U $DB_APP_USER -d rootuip_auth <<EOF
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    company_id UUID,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
EOF

# Platform database schema
PGPASSWORD=$DB_APP_PASS psql -h localhost -U $DB_APP_USER -d rootuip_platform <<EOF
-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    industry VARCHAR(100),
    size VARCHAR(50),
    annual_container_volume INTEGER,
    status VARCHAR(50) DEFAULT 'active',
    subscription_tier VARCHAR(50) DEFAULT 'trial',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Containers table
CREATE TABLE IF NOT EXISTS containers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    container_number VARCHAR(20) NOT NULL,
    booking_number VARCHAR(50),
    carrier_code VARCHAR(10),
    origin_port VARCHAR(10),
    destination_port VARCHAR(10),
    status VARCHAR(50),
    current_location JSONB,
    eta TIMESTAMP WITH TIME ZONE,
    last_api_update TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    container_id UUID REFERENCES containers(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    data JSONB,
    status VARCHAR(20) DEFAULT 'active',
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    request_size INTEGER,
    response_size INTEGER,
    ip_address INET,
    user_agent TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_containers_company ON containers(company_id);
CREATE INDEX idx_containers_number ON containers(container_number);
CREATE INDEX idx_containers_status ON containers(status);
CREATE INDEX idx_alerts_company ON alerts(company_id);
CREATE INDEX idx_alerts_container ON alerts(container_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_api_usage_company ON api_usage(company_id);
CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX idx_api_usage_created ON api_usage(created_at);
EOF

# Integration database schema
PGPASSWORD=$DB_APP_PASS psql -h localhost -U $DB_APP_USER -d rootuip_integration <<EOF
-- Carrier credentials table
CREATE TABLE IF NOT EXISTS carrier_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    carrier_code VARCHAR(10) NOT NULL,
    credentials JSONB NOT NULL, -- Encrypted in application
    is_active BOOLEAN DEFAULT true,
    last_used TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, carrier_code)
);

-- Integration logs
CREATE TABLE IF NOT EXISTS integration_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    carrier_code VARCHAR(10),
    action VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    request_data JSONB,
    response_data JSONB,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Webhook configurations
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_triggered TIMESTAMP WITH TIME ZONE,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_carrier_creds_company ON carrier_credentials(company_id);
CREATE INDEX idx_integration_logs_company ON integration_logs(company_id);
CREATE INDEX idx_integration_logs_created ON integration_logs(created_at);
CREATE INDEX idx_webhooks_company ON webhooks(company_id);
EOF

# Step 6: Set up automated backups
log "Step 6: Setting up automated backups..."

# Create backup directory
sudo mkdir -p /var/backups/postgresql
sudo chown postgres:postgres /var/backups/postgresql

# Create backup script
sudo tee /usr/local/bin/rootuip-db-backup.sh > /dev/null <<'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Create backup
for db in rootuip_auth rootuip_platform rootuip_integration; do
    pg_dump -U postgres -h localhost $db | gzip > "$BACKUP_DIR/${db}_${DATE}.sql.gz"
done

# Remove old backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Log backup completion
echo "[$(date)] Database backup completed" >> /var/log/postgresql/backup.log
EOF

sudo chmod +x /usr/local/bin/rootuip-db-backup.sh

# Add to crontab (every 6 hours)
(crontab -l 2>/dev/null; echo "0 */6 * * * /usr/local/bin/rootuip-db-backup.sh") | sudo crontab -u postgres -

# Step 7: Create monitoring setup
log "Step 7: Setting up database monitoring..."

# Create monitoring user and database
sudo -u postgres psql <<EOF
CREATE USER monitoring WITH PASSWORD 'monitoring_2024!';
CREATE DATABASE monitoring OWNER monitoring;
GRANT pg_monitor TO monitoring;
EOF

# Create monitoring queries
PGPASSWORD=$DB_APP_PASS psql -h localhost -U $DB_APP_USER -d rootuip_platform <<EOF
-- Create monitoring schema
CREATE SCHEMA IF NOT EXISTS monitoring;

-- Connection stats view
CREATE OR REPLACE VIEW monitoring.connection_stats AS
SELECT 
    datname as database,
    numbackends as connections,
    xact_commit as commits,
    xact_rollback as rollbacks,
    blks_read as disk_reads,
    blks_hit as cache_hits,
    tup_returned as rows_returned,
    tup_fetched as rows_fetched,
    tup_inserted as rows_inserted,
    tup_updated as rows_updated,
    tup_deleted as rows_deleted
FROM pg_stat_database
WHERE datname LIKE 'rootuip_%';

-- Slow query monitoring
CREATE OR REPLACE VIEW monitoring.slow_queries AS
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    stddev_exec_time,
    rows
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 20;
EOF

# Step 8: Create health check endpoints
log "Step 8: Creating health check script..."

sudo tee /usr/local/bin/rootuip-db-health.sh > /dev/null <<'EOF'
#!/bin/bash
# Database health check script

check_connection() {
    local db=$1
    if PGPASSWORD=rootuip_app_secure_2024! psql -h localhost -p 6432 -U rootuip_app -d $db -c "SELECT 1" > /dev/null 2>&1; then
        echo "OK"
    else
        echo "FAIL"
    fi
}

# Check each database
for db in rootuip_auth rootuip_platform rootuip_integration; do
    status=$(check_connection $db)
    echo "$db: $status"
done

# Check pgBouncer
if systemctl is-active --quiet pgbouncer; then
    echo "pgBouncer: OK"
else
    echo "pgBouncer: FAIL"
fi

# Check PostgreSQL
if systemctl is-active --quiet postgresql@15-main; then
    echo "PostgreSQL: OK"
else
    echo "PostgreSQL: FAIL"
fi
EOF

sudo chmod +x /usr/local/bin/rootuip-db-health.sh

log "Database infrastructure setup completed!"
echo ""
echo "=== Database Connection Information ==="
echo "Host: localhost (or 127.0.0.1)"
echo "Port: 6432 (pgBouncer) or 5432 (direct PostgreSQL)"
echo "Databases: rootuip_auth, rootuip_platform, rootuip_integration"
echo "Application User: rootuip_app"
echo "Application Password: rootuip_app_secure_2024!"
echo ""
echo "=== Next Steps ==="
echo "1. Update your application .env files with the database connection strings"
echo "2. Run database migrations"
echo "3. Test service connections"
echo ""
echo "Connection strings for your services:"
echo "DATABASE_URL=postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_platform"
echo "AUTH_DATABASE_URL=postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_auth"
echo "INTEGRATION_DATABASE_URL=postgresql://rootuip_app:rootuip_app_secure_2024!@localhost:6432/rootuip_integration"