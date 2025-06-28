#!/bin/bash

# ROOTUIP Disaster Recovery Script
# Restores system from backup or handles emergency situations

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOTUIP_HOME="/home/iii/ROOTUIP"
BACKUP_DIR="${ROOTUIP_HOME}/backups"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "======================================"
echo "ROOTUIP Disaster Recovery System"
echo "======================================"
echo ""

# Function to show menu
show_menu() {
    echo "Select recovery option:"
    echo "1. Full System Restore from Backup"
    echo "2. Database Recovery Only"
    echo "3. ML Model Recovery"
    echo "4. Service Recovery (Restart All)"
    echo "5. Emergency Data Export"
    echo "6. Health Check & Diagnostics"
    echo "7. Create Emergency Backup"
    echo "8. Exit"
    echo ""
}

# Function to list available backups
list_backups() {
    echo -e "${YELLOW}Available backups:${NC}"
    if [ -d "$BACKUP_DIR" ]; then
        ls -lht "$BACKUP_DIR"/*.tar.gz 2>/dev/null | head -10
        if [ $? -ne 0 ]; then
            echo "No backups found in $BACKUP_DIR"
            return 1
        fi
    else
        echo "Backup directory not found"
        return 1
    fi
    return 0
}

# 1. Full System Restore
full_restore() {
    echo -e "\n${YELLOW}Full System Restore${NC}"
    echo "==================="
    
    if ! list_backups; then
        echo -e "${RED}No backups available for restore${NC}"
        return 1
    fi
    
    echo ""
    read -p "Enter backup filename (or 'latest' for most recent): " backup_file
    
    if [ "$backup_file" == "latest" ]; then
        backup_file=$(ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | head -1)
    else
        backup_file="$BACKUP_DIR/$backup_file"
    fi
    
    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}Backup file not found: $backup_file${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Restoring from: $(basename $backup_file)${NC}"
    read -p "This will overwrite current data. Continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "Restore cancelled"
        return 1
    fi
    
    # Stop services
    echo "Stopping services..."
    systemctl stop ml-server ml-api auth-service api-gateway 2>/dev/null || {
        pkill -f "ml-server.js"
        pkill -f "uvicorn"
        pkill -f "auth-service"
        pkill -f "api-gateway"
    }
    
    # Extract backup
    temp_dir="/tmp/rootuip_restore_$$"
    mkdir -p "$temp_dir"
    
    echo "Extracting backup..."
    tar -xzf "$backup_file" -C "$temp_dir"
    
    # Find the extracted directory
    restore_dir=$(find "$temp_dir" -maxdepth 1 -type d -name "rootuip_backup_*" | head -1)
    
    if [ -z "$restore_dir" ]; then
        echo -e "${RED}Failed to extract backup${NC}"
        rm -rf "$temp_dir"
        return 1
    fi
    
    # Restore ML models
    if [ -d "$restore_dir/ml_models" ]; then
        echo "Restoring ML models..."
        cp -r "$restore_dir/ml_models"/* "${ROOTUIP_HOME}/models/" 2>/dev/null
        echo -e "${GREEN}✓ ML models restored${NC}"
    fi
    
    # Restore database
    if [ -f "$restore_dir/rootuip_database.sql" ]; then
        echo "Restoring database..."
        PGPASSWORD="U1Pp@ssw0rd!" psql -h localhost -U uip_user -d rootuip < "$restore_dir/rootuip_database.sql"
        echo -e "${GREEN}✓ Database restored${NC}"
    fi
    
    # Restore configurations
    if [ -d "$restore_dir/configs" ]; then
        echo "Restoring configurations..."
        # Backup current configs first
        cp -r "${ROOTUIP_HOME}/systemd" "${ROOTUIP_HOME}/systemd.backup" 2>/dev/null
        cp -r "$restore_dir/configs/systemd"/* "${ROOTUIP_HOME}/systemd/" 2>/dev/null
        echo -e "${GREEN}✓ Configurations restored${NC}"
    fi
    
    # Clean up
    rm -rf "$temp_dir"
    
    # Restart services
    echo "Starting services..."
    systemctl start ml-server ml-api auth-service api-gateway 2>/dev/null || {
        cd ${ROOTUIP_HOME} && ./start-ml-system.sh
    }
    
    echo -e "\n${GREEN}Full restore completed!${NC}"
}

# 2. Database Recovery
database_recovery() {
    echo -e "\n${YELLOW}Database Recovery${NC}"
    echo "================="
    
    echo "1. Restore from backup"
    echo "2. Repair corrupted tables"
    echo "3. Reset to clean state"
    read -p "Select option: " db_option
    
    case $db_option in
        1)
            if ! list_backups; then
                return 1
            fi
            read -p "Enter backup filename: " backup_file
            backup_path="$BACKUP_DIR/$backup_file"
            
            # Extract just the database
            temp_dir="/tmp/db_restore_$$"
            mkdir -p "$temp_dir"
            tar -xzf "$backup_path" -C "$temp_dir" --wildcards "*/rootuip_database.sql" 2>/dev/null
            
            db_file=$(find "$temp_dir" -name "rootuip_database.sql" | head -1)
            if [ -f "$db_file" ]; then
                PGPASSWORD="U1Pp@ssw0rd!" psql -h localhost -U uip_user -d rootuip < "$db_file"
                echo -e "${GREEN}✓ Database restored${NC}"
            else
                echo -e "${RED}Database backup not found${NC}"
            fi
            rm -rf "$temp_dir"
            ;;
        2)
            echo "Running database repair..."
            PGPASSWORD="U1Pp@ssw0rd!" psql -h localhost -U uip_user -d rootuip <<EOF
VACUUM FULL;
REINDEX DATABASE rootuip;
ANALYZE;
EOF
            echo -e "${GREEN}✓ Database repaired${NC}"
            ;;
        3)
            read -p "WARNING: This will delete all data. Continue? (yes/no): " confirm
            if [ "$confirm" == "yes" ]; then
                # Re-run schema creation
                if [ -f "${ROOTUIP_HOME}/enterprise-auth-schema.sql" ]; then
                    PGPASSWORD="U1Pp@ssw0rd!" psql -h localhost -U uip_user -d rootuip < "${ROOTUIP_HOME}/enterprise-auth-schema.sql"
                    echo -e "${GREEN}✓ Database reset to clean state${NC}"
                else
                    echo -e "${RED}Schema file not found${NC}"
                fi
            fi
            ;;
    esac
}

# 3. ML Model Recovery
ml_model_recovery() {
    echo -e "\n${YELLOW}ML Model Recovery${NC}"
    echo "================="
    
    echo "1. Restore from backup"
    echo "2. Retrain model with existing data"
    echo "3. Use fallback model"
    read -p "Select option: " ml_option
    
    case $ml_option in
        1)
            if ! list_backups; then
                return 1
            fi
            read -p "Enter backup filename: " backup_file
            backup_path="$BACKUP_DIR/$backup_file"
            
            # Extract ML models
            temp_dir="/tmp/ml_restore_$$"
            mkdir -p "$temp_dir"
            tar -xzf "$backup_path" -C "$temp_dir" --wildcards "*/ml_models/*" 2>/dev/null
            
            model_dir=$(find "$temp_dir" -type d -name "ml_models" | head -1)
            if [ -d "$model_dir" ]; then
                cp -r "$model_dir"/* "${ROOTUIP_HOME}/models/"
                echo -e "${GREEN}✓ ML models restored${NC}"
            else
                echo -e "${RED}ML models not found in backup${NC}"
            fi
            rm -rf "$temp_dir"
            ;;
        2)
            echo "Retraining ML model..."
            cd ${ROOTUIP_HOME}/ml-system
            python3 train_model.py
            ;;
        3)
            echo "Creating fallback model..."
            # The predict.py already has fallback logic
            echo -e "${GREEN}✓ System will use fallback model${NC}"
            ;;
    esac
}

# 4. Service Recovery
service_recovery() {
    echo -e "\n${YELLOW}Service Recovery${NC}"
    echo "==============="
    
    # Stop all services
    echo "Stopping all services..."
    systemctl stop ml-server ml-api auth-service api-gateway 2>/dev/null
    pkill -f "ml-server.js" 2>/dev/null
    pkill -f "uvicorn" 2>/dev/null
    pkill -f "auth-service" 2>/dev/null
    pkill -f "api-gateway" 2>/dev/null
    
    sleep 2
    
    # Clear any locks or stale files
    rm -f ${ROOTUIP_HOME}/logs/*.lock 2>/dev/null
    
    # Start services
    echo "Starting services..."
    cd ${ROOTUIP_HOME}
    
    # Start ML server
    nohup node ml_system/ml-server.js > logs/ml-server-recovery.log 2>&1 &
    echo -e "${GREEN}✓ ML server started${NC}"
    
    sleep 2
    
    # Start Python API
    source .venv/bin/activate 2>/dev/null
    cd ml-system
    nohup python -m uvicorn api:app --host 0.0.0.0 --port 8000 > ../logs/python-api-recovery.log 2>&1 &
    echo -e "${GREEN}✓ Python API started${NC}"
    
    cd ..
    
    # Check health
    sleep 3
    ${ROOTUIP_HOME}/scripts/health-check.sh
}

# 5. Emergency Data Export
emergency_export() {
    echo -e "\n${YELLOW}Emergency Data Export${NC}"
    echo "===================="
    
    export_dir="${ROOTUIP_HOME}/emergency_export_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$export_dir"
    
    echo "Exporting critical data to: $export_dir"
    
    # Export database
    echo "Exporting database..."
    PGPASSWORD="U1Pp@ssw0rd!" pg_dump -h localhost -U uip_user -d rootuip > "$export_dir/database.sql" 2>/dev/null
    
    # Export ML models
    echo "Exporting ML models..."
    cp -r ${ROOTUIP_HOME}/models "$export_dir/" 2>/dev/null
    
    # Export configurations
    echo "Exporting configurations..."
    cp -r ${ROOTUIP_HOME}/systemd "$export_dir/" 2>/dev/null
    cp ${ROOTUIP_HOME}/.env* "$export_dir/" 2>/dev/null
    
    # Export recent logs
    echo "Exporting recent logs..."
    mkdir -p "$export_dir/logs"
    tail -1000 ${ROOTUIP_HOME}/logs/*.log > "$export_dir/logs/combined_recent.log" 2>/dev/null
    
    # Create manifest
    cat > "$export_dir/manifest.txt" <<EOF
Emergency Export - $(date)
=========================
System: ROOTUIP Platform
Version: 1.0.0
Export Reason: Emergency/Disaster Recovery

Contents:
- database.sql: PostgreSQL database dump
- models/: ML model files
- systemd/: Service configurations
- logs/: Recent log entries

To restore:
1. Database: psql -U uip_user -d rootuip < database.sql
2. Models: cp -r models/* /path/to/rootuip/models/
3. Configs: cp -r systemd/* /path/to/rootuip/systemd/
EOF
    
    # Compress
    echo "Compressing export..."
    tar -czf "$export_dir.tar.gz" -C "$(dirname $export_dir)" "$(basename $export_dir)"
    rm -rf "$export_dir"
    
    echo -e "\n${GREEN}Emergency export completed!${NC}"
    echo "Export file: $export_dir.tar.gz"
    echo "Size: $(du -h $export_dir.tar.gz | cut -f1)"
    echo ""
    echo "Transfer this file to a safe location immediately!"
}

# 6. Health Check & Diagnostics
health_diagnostics() {
    echo -e "\n${YELLOW}System Health Diagnostics${NC}"
    echo "========================"
    
    # Check services
    echo -e "\n${BLUE}Service Status:${NC}"
    ${ROOTUIP_HOME}/scripts/health-check.sh
    
    # Check disk space
    echo -e "\n${BLUE}Disk Space:${NC}"
    df -h | grep -E "Filesystem|/home"
    
    # Check memory
    echo -e "\n${BLUE}Memory Usage:${NC}"
    free -h
    
    # Check database
    echo -e "\n${BLUE}Database Status:${NC}"
    PGPASSWORD="U1Pp@ssw0rd!" psql -h localhost -U uip_user -d rootuip -c "SELECT count(*) as table_count FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null
    
    # Check ML metrics
    echo -e "\n${BLUE}ML System Metrics:${NC}"
    curl -s http://localhost:3004/ml/metrics | python3 -m json.tool 2>/dev/null | head -20
    
    # Check recent errors
    echo -e "\n${BLUE}Recent Errors (last 10):${NC}"
    grep -i error ${ROOTUIP_HOME}/logs/*.log 2>/dev/null | tail -10
    
    # System recommendations
    echo -e "\n${BLUE}Recommendations:${NC}"
    
    # Check if backup exists
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        echo -e "${RED}⚠ No backups found - run backup script immediately${NC}"
    fi
    
    # Check service uptime
    if ! curl -s http://localhost:3004/ml/health >/dev/null 2>&1; then
        echo -e "${RED}⚠ ML service not responding - run service recovery${NC}"
    fi
}

# 7. Create Emergency Backup
emergency_backup() {
    echo -e "\n${YELLOW}Creating Emergency Backup${NC}"
    echo "========================"
    
    ${ROOTUIP_HOME}/scripts/backup-system.sh
}

# Main menu loop
while true; do
    show_menu
    read -p "Enter choice [1-8]: " choice
    
    case $choice in
        1) full_restore ;;
        2) database_recovery ;;
        3) ml_model_recovery ;;
        4) service_recovery ;;
        5) emergency_export ;;
        6) health_diagnostics ;;
        7) emergency_backup ;;
        8) 
            echo "Exiting disaster recovery..."
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    echo ""
done