#!/bin/bash

# ROOTUIP Database Setup Script for VPS
# Sets up PostgreSQL with TimescaleDB and Redis

set -e

echo "======================================"
echo "ROOTUIP Database Infrastructure Setup"
echo "======================================"
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}This script must be run as root${NC}"
        exit 1
    fi
}

# Function to print status
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if running as root
check_root

# Update system
echo "Updating system packages..."
apt update -y
apt upgrade -y
print_status "System updated"

# Install PostgreSQL
echo ""
echo "Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib
print_status "PostgreSQL installed"

# Get PostgreSQL version
PG_VERSION=$(psql --version | awk '{print $3}' | cut -d. -f1)
echo "PostgreSQL version: $PG_VERSION"

# Install TimescaleDB
echo ""
echo "Installing TimescaleDB..."
apt install -y gnupg postgresql-common apt-transport-https lsb-release wget

# Add TimescaleDB repository
echo "deb https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -c -s) main" > /etc/apt/sources.list.d/timescaledb.list
wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | apt-key add -
apt update

# Install TimescaleDB
apt install -y timescaledb-2-postgresql-$PG_VERSION
print_status "TimescaleDB installed"

# Configure PostgreSQL for TimescaleDB
echo ""
echo "Configuring PostgreSQL for TimescaleDB..."
timescaledb-tune --quiet --yes
print_status "TimescaleDB tuned"

# Restart PostgreSQL
systemctl restart postgresql
print_status "PostgreSQL restarted"

# Install Redis
echo ""
echo "Installing Redis..."
apt install -y redis-server
print_status "Redis installed"

# Configure Redis for production
echo ""
echo "Configuring Redis..."
cat > /etc/redis/redis.conf << 'EOF'
# Basic configuration
bind 127.0.0.1 ::1
protected-mode yes
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Memory management
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Performance
databases 16
always-show-logo no
set-proc-title yes
proc-title-template "{title} {listen-addr} {server-mode}"

# Security
requirepass $(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
EOF

systemctl restart redis-server
print_status "Redis configured and restarted"

# Create ROOTUIP database and user
echo ""
echo "Setting up ROOTUIP database..."

# Generate secure password
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-24)

sudo -u postgres psql << EOF
-- Create user
CREATE USER uip_user WITH PASSWORD '$DB_PASSWORD';

-- Create database
CREATE DATABASE uip_production OWNER uip_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE uip_production TO uip_user;

-- Connect to the database
\c uip_production

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create schema
CREATE SCHEMA IF NOT EXISTS rootuip AUTHORIZATION uip_user;

-- Set search path
ALTER DATABASE uip_production SET search_path TO rootuip, public;
EOF

print_status "Database created"

# Create initial tables with TimescaleDB
echo ""
echo "Creating database schema..."

sudo -u postgres psql -d uip_production << 'EOF'
-- Container tracking table
CREATE TABLE IF NOT EXISTS container_events (
    event_id BIGSERIAL,
    container_number VARCHAR(20) NOT NULL,
    vessel_name VARCHAR(100),
    carrier VARCHAR(50),
    port_code VARCHAR(10),
    terminal VARCHAR(100),
    event_type VARCHAR(50) NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    eta_change INTERVAL,
    demurrage_risk_score DECIMAL(3,2),
    detention_risk_score DECIMAL(3,2),
    alert_generated BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable for time-series optimization
SELECT create_hypertable('container_events', 'event_timestamp', if_not_exists => TRUE);

-- Create indexes for performance
CREATE INDEX idx_container_events_container ON container_events(container_number, event_timestamp DESC);
CREATE INDEX idx_container_events_risk ON container_events(demurrage_risk_score, detention_risk_score) 
WHERE demurrage_risk_score > 0.7 OR detention_risk_score > 0.7;

-- ML predictions table
CREATE TABLE IF NOT EXISTS ml_predictions (
    prediction_id BIGSERIAL PRIMARY KEY,
    container_number VARCHAR(20) NOT NULL,
    prediction_type VARCHAR(50) NOT NULL,
    risk_score DECIMAL(3,2) NOT NULL,
    confidence_score DECIMAL(3,2) NOT NULL,
    factors JSONB,
    model_version VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    azure_oid VARCHAR(255) UNIQUE,
    maersk_customer_code VARCHAR(50),
    company_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    user_id BIGINT REFERENCES users(user_id),
    data JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
    usage_id BIGSERIAL,
    user_id BIGINT REFERENCES users(user_id),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Convert to hypertable for analytics
SELECT create_hypertable('api_usage', 'timestamp', if_not_exists => TRUE);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO uip_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO uip_user;
EOF

print_status "Database schema created"

# Configure PostgreSQL for production
echo ""
echo "Optimizing PostgreSQL configuration..."

cat >> /etc/postgresql/$PG_VERSION/main/postgresql.conf << EOF

# ROOTUIP Production Settings
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 4
max_parallel_workers_per_gather = 2
max_parallel_workers = 4
max_parallel_maintenance_workers = 2
EOF

# Restart PostgreSQL
systemctl restart postgresql
print_status "PostgreSQL optimized"

# Create .env.database file with connection info
echo ""
echo "Creating database configuration file..."

cat > /home/rootuip/platform/.env.database << EOF
# Database Configuration
# Generated: $(date)

# PostgreSQL Connection
DATABASE_URL=postgresql://uip_user:$DB_PASSWORD@localhost:5432/uip_production

# Redis Connection
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=$(grep requirepass /etc/redis/redis.conf | awk '{print $2}')

# TimescaleDB is enabled on the main database
TIMESCALE_ENABLED=true

# Connection Pool Settings
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_IDLE_TIMEOUT_MILLIS=30000

# SSL Settings (for production)
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=false
EOF

chmod 600 /home/rootuip/platform/.env.database
print_status "Database configuration saved"

# Enable services
echo ""
echo "Enabling services..."
systemctl enable postgresql
systemctl enable redis-server
print_status "Services enabled"

# Create backup script
echo ""
echo "Creating backup script..."

cat > /usr/local/bin/backup-rootuip-db.sh << 'EOF'
#!/bin/bash
# ROOTUIP Database Backup Script

BACKUP_DIR="/var/backups/rootuip"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="uip_production"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
pg_dump -U postgres -d $DB_NAME | gzip > $BACKUP_DIR/postgres_$TIMESTAMP.sql.gz

# Backup Redis
redis-cli BGSAVE
sleep 5
cp /var/lib/redis/dump.rdb $BACKUP_DIR/redis_$TIMESTAMP.rdb

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +7 -delete

echo "Backup completed: $TIMESTAMP"
EOF

chmod +x /usr/local/bin/backup-rootuip-db.sh
print_status "Backup script created"

# Add to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-rootuip-db.sh") | crontab -
print_status "Daily backup scheduled"

# Final summary
echo ""
echo "======================================"
echo -e "${GREEN}Database Setup Complete!${NC}"
echo "======================================"
echo ""
echo "PostgreSQL Database:"
echo "  Database: uip_production"
echo "  User: uip_user"
echo "  Password: Saved in /home/rootuip/platform/.env.database"
echo "  TimescaleDB: Enabled"
echo ""
echo "Redis Cache:"
echo "  Port: 6379"
echo "  Password: Configured (see .env.database)"
echo "  Max Memory: 2GB"
echo ""
echo "Next Steps:"
echo "1. Update your .env file with the database credentials from .env.database"
echo "2. Test the connection: psql -U uip_user -d uip_production -h localhost"
echo "3. Run your application migrations"
echo ""
print_warning "Note: The Maersk OAuth credentials may need activation. Contact Maersk support if the API key error persists."