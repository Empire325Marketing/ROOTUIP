#!/bin/bash

# ROOTUIP Automated Backup System
# Backs up ML models, database, and critical configurations

BACKUP_DIR="/home/iii/ROOTUIP/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="rootuip_backup_${TIMESTAMP}"
RETENTION_DAYS=7

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "ROOTUIP Automated Backup System"
echo "======================================"
echo "Timestamp: $(date)"
echo ""

# Create backup directory
mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"
cd "${BACKUP_DIR}/${BACKUP_NAME}"

# 1. Backup ML Models
echo -e "${YELLOW}1. Backing up ML models...${NC}"
if [ -d "/home/iii/ROOTUIP/models" ]; then
    cp -r /home/iii/ROOTUIP/models ./ml_models
    echo -e "${GREEN}✓ ML models backed up${NC}"
else
    echo -e "${RED}✗ ML models directory not found${NC}"
fi

# 2. Backup PostgreSQL Database
echo -e "\n${YELLOW}2. Backing up PostgreSQL database...${NC}"
if command -v pg_dump &> /dev/null; then
    PGPASSWORD="U1Pp@ssw0rd!" pg_dump -h localhost -U uip_user -d rootuip > ./rootuip_database.sql
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database backed up${NC}"
    else
        echo -e "${RED}✗ Database backup failed${NC}"
    fi
else
    echo -e "${RED}✗ pg_dump not found${NC}"
fi

# 3. Backup Configuration Files
echo -e "\n${YELLOW}3. Backing up configuration files...${NC}"
mkdir -p ./configs

# Nginx configs
if [ -d "/etc/nginx/sites-available" ]; then
    cp /etc/nginx/sites-available/rootuip* ./configs/ 2>/dev/null
    cp /etc/nginx/sites-available/app.rootuip* ./configs/ 2>/dev/null
fi

# Systemd services
if [ -d "/home/iii/ROOTUIP/systemd" ]; then
    cp -r /home/iii/ROOTUIP/systemd ./configs/
fi

# Environment files
cp /home/iii/ROOTUIP/.env* ./configs/ 2>/dev/null
cp /home/iii/ROOTUIP/auth-enterprise/.env* ./configs/ 2>/dev/null

echo -e "${GREEN}✓ Configuration files backed up${NC}"

# 4. Backup ML Training Data
echo -e "\n${YELLOW}4. Backing up ML training data...${NC}"
if [ -d "/home/iii/ROOTUIP/ml-system/data" ]; then
    cp -r /home/iii/ROOTUIP/ml-system/data ./ml_training_data
    echo -e "${GREEN}✓ ML training data backed up${NC}"
fi

# 5. Backup Logs (last 1000 lines of each)
echo -e "\n${YELLOW}5. Backing up recent logs...${NC}"
mkdir -p ./logs
for log in /home/iii/ROOTUIP/logs/*.log; do
    if [ -f "$log" ]; then
        filename=$(basename "$log")
        tail -1000 "$log" > "./logs/${filename}"
    fi
done
echo -e "${GREEN}✓ Logs backed up${NC}"

# 6. Create backup manifest
echo -e "\n${YELLOW}6. Creating backup manifest...${NC}"
cat > backup_manifest.json << EOF
{
    "backup_name": "${BACKUP_NAME}",
    "timestamp": "$(date -Iseconds)",
    "system_info": {
        "hostname": "$(hostname)",
        "ip_address": "145.223.73.4",
        "platform_version": "1.0.0"
    },
    "contents": {
        "ml_models": $([ -d "./ml_models" ] && echo "true" || echo "false"),
        "database": $([ -f "./rootuip_database.sql" ] && echo "true" || echo "false"),
        "configs": $([ -d "./configs" ] && echo "true" || echo "false"),
        "ml_training_data": $([ -d "./ml_training_data" ] && echo "true" || echo "false"),
        "logs": $([ -d "./logs" ] && echo "true" || echo "false")
    },
    "sizes": {
        "total": "$(du -sh . | cut -f1)",
        "database": "$([ -f "./rootuip_database.sql" ] && du -h ./rootuip_database.sql | cut -f1 || echo "0")",
        "ml_models": "$([ -d "./ml_models" ] && du -sh ./ml_models | cut -f1 || echo "0")"
    }
}
EOF
echo -e "${GREEN}✓ Manifest created${NC}"

# 7. Compress backup
echo -e "\n${YELLOW}7. Compressing backup...${NC}"
cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}/"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backup compressed${NC}"
    # Remove uncompressed directory
    rm -rf "${BACKUP_NAME}/"
else
    echo -e "${RED}✗ Compression failed${NC}"
fi

# 8. Clean up old backups
echo -e "\n${YELLOW}8. Cleaning up old backups...${NC}"
find "${BACKUP_DIR}" -name "rootuip_backup_*.tar.gz" -mtime +${RETENTION_DAYS} -exec rm {} \;
echo -e "${GREEN}✓ Old backups cleaned (retention: ${RETENTION_DAYS} days)${NC}"

# 9. Upload to remote storage (optional)
# Uncomment and configure if you have remote backup storage
# echo -e "\n${YELLOW}9. Uploading to remote storage...${NC}"
# aws s3 cp "${BACKUP_NAME}.tar.gz" s3://your-backup-bucket/rootuip/
# rsync -avz "${BACKUP_NAME}.tar.gz" user@backup-server:/backups/rootuip/

# Summary
echo -e "\n${GREEN}======================================"
echo "Backup Complete!"
echo "======================================${NC}"
echo "Backup location: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo "Size: $(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)"
echo ""
echo "To restore from this backup:"
echo "tar -xzf ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
echo ""

# Log backup completion
echo "$(date): Backup completed - ${BACKUP_NAME}.tar.gz" >> /home/iii/ROOTUIP/logs/backup.log