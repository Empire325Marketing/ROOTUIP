#!/bin/bash

# ROOTUIP Automated Backup Script
BACKUP_DIR="/var/backups/rootuip"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR/$DATE"

# Backup MongoDB
if command -v mongodump &> /dev/null; then
    mongodump --db rootuip_production --out "$BACKUP_DIR/$DATE/mongodb"
fi

# Backup application files
tar -czf "$BACKUP_DIR/$DATE/application.tar.gz" -C /var/www rootuip

# Backup configurations
tar -czf "$BACKUP_DIR/$DATE/configs.tar.gz" /etc/nginx/sites-enabled /etc/rootuip

# Create manifest
cat > "$BACKUP_DIR/$DATE/manifest.txt" << EOF
ROOTUIP Backup Created: $(date)
Application: Production
Database: MongoDB
Files: Application, configurations
Size: $(du -sh "$BACKUP_DIR/$DATE" | cut -f1)
EOF

# Cleanup old backups
find "$BACKUP_DIR" -type d -name "*_*" -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null

logger "ROOTUIP backup completed: $BACKUP_DIR/$DATE"
echo "Backup completed: $DATE"
