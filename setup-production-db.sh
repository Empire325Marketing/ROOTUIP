#!/bin/bash

# ROOTUIP Production Database Setup Script
# This script sets up PostgreSQL and Redis for production

echo "🚀 ROOTUIP Production Database Setup"
echo "===================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# PostgreSQL Setup
echo -e "${YELLOW}📦 Setting up PostgreSQL...${NC}"

# Install PostgreSQL if not installed
if ! command -v psql &> /dev/null; then
    apt update
    apt install -y postgresql postgresql-contrib
fi

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
-- Create production database
CREATE DATABASE rootuip_production;

-- Create production user
CREATE USER rootuip_user WITH ENCRYPTED PASSWORD 'secure_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE rootuip_production TO rootuip_user;

-- Connect to the database
\c rootuip_production

-- Create schema
CREATE SCHEMA IF NOT EXISTS rootuip;
GRANT ALL ON SCHEMA rootuip TO rootuip_user;

-- Create tables
CREATE TABLE IF NOT EXISTS rootuip.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    name VARCHAR(255),
    role VARCHAR(50),
    company VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS rootuip.containers (
    id SERIAL PRIMARY KEY,
    container_number VARCHAR(50) UNIQUE NOT NULL,
    carrier VARCHAR(100),
    status VARCHAR(50),
    location VARCHAR(255),
    eta TIMESTAMP,
    risk_score DECIMAL(3,2),
    user_id INTEGER REFERENCES rootuip.users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tracking_data JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS rootuip.activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES rootuip.users(id),
    action VARCHAR(100),
    resource_type VARCHAR(50),
    resource_id INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rootuip.api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES rootuip.users(id),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    permissions JSONB DEFAULT '[]',
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS rootuip.sessions (
    sid VARCHAR PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
);

-- Create indexes
CREATE INDEX idx_containers_user_id ON rootuip.containers(user_id);
CREATE INDEX idx_containers_status ON rootuip.containers(status);
CREATE INDEX idx_activities_user_id ON rootuip.activities(user_id);
CREATE INDEX idx_activities_created_at ON rootuip.activities(created_at);
CREATE INDEX idx_sessions_expire ON rootuip.sessions(expire);

-- Grant permissions on all tables
GRANT ALL ON ALL TABLES IN SCHEMA rootuip TO rootuip_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rootuip TO rootuip_user;

-- Insert default admin user (mjaiii@rootuip.com)
INSERT INTO rootuip.users (email, password_hash, name, role, company) 
VALUES (
    'mjaiii@rootuip.com',
    '\$2b\$12\$KIXxPfE6K5bO5IMfCQvJReOJZL6TszoG3RgJK6u8mKFKqYaD.dVC2', -- bcrypt hash of 'rootuip2024'
    'MJ',
    'admin',
    'ROOTUIP'
) ON CONFLICT (email) DO NOTHING;

EOF

echo -e "${GREEN}✅ PostgreSQL setup complete${NC}"

# Redis Setup
echo -e "${YELLOW}📦 Setting up Redis...${NC}"

# Install Redis if not installed
if ! command -v redis-cli &> /dev/null; then
    apt update
    apt install -y redis-server
fi

# Configure Redis for production
cat > /etc/redis/redis.conf << 'EOF'
# Redis Production Configuration
bind 127.0.0.1 ::1
protected-mode yes
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

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

# Memory management
maxmemory 512mb
maxmemory-policy allkeys-lru

# Performance
databases 16
hz 10
dynamic-hz yes

# Security (uncomment and set password)
# requirepass your_redis_password_here
EOF

# Start Redis
systemctl restart redis-server
systemctl enable redis-server

echo -e "${GREEN}✅ Redis setup complete${NC}"

# Create backup directory
mkdir -p /var/backups/rootuip
chown postgres:postgres /var/backups/rootuip

# Create backup script
cat > /usr/local/bin/rootuip-backup.sh << 'EOF'
#!/bin/bash
# ROOTUIP Database Backup Script

BACKUP_DIR="/var/backups/rootuip"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="rootuip_production"
DB_USER="rootuip_user"

# PostgreSQL backup
pg_dump -U $DB_USER -d $DB_NAME -f "$BACKUP_DIR/postgres_$TIMESTAMP.sql"

# Redis backup
redis-cli BGSAVE
sleep 5
cp /var/lib/redis/dump.rdb "$BACKUP_DIR/redis_$TIMESTAMP.rdb"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +7 -delete

echo "Backup completed: $TIMESTAMP"
EOF

chmod +x /usr/local/bin/rootuip-backup.sh

# Add to crontab for daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/rootuip-backup.sh >> /var/log/rootuip-backup.log 2>&1") | crontab -

echo -e "${GREEN}✅ Backup system configured${NC}"

# Display connection info
echo ""
echo -e "${YELLOW}📋 Database Connection Information:${NC}"
echo "===================================="
echo "PostgreSQL:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: rootuip_production"
echo "  User: rootuip_user"
echo "  Password: secure_password"
echo "  Connection URL: postgresql://rootuip_user:secure_password@localhost:5432/rootuip_production"
echo ""
echo "Redis:"
echo "  Host: localhost"
echo "  Port: 6379"
echo "  Connection URL: redis://localhost:6379"
echo ""
echo -e "${RED}⚠️  IMPORTANT: Change the default passwords in production!${NC}"
echo ""
echo "To update PostgreSQL password:"
echo "  sudo -u postgres psql -c \"ALTER USER rootuip_user PASSWORD 'new_secure_password';\""
echo ""
echo "To set Redis password:"
echo "  1. Edit /etc/redis/redis.conf"
echo "  2. Uncomment and set: requirepass your_secure_password"
echo "  3. Restart Redis: systemctl restart redis-server"
echo ""
echo -e "${GREEN}✅ Database setup complete!${NC}"