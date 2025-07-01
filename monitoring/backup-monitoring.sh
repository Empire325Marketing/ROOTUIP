#!/bin/bash
# ROOTUIP Backup Monitoring Script
# Ensures daily backups complete successfully

BACKUP_DIR="/backup/rootuip"
S3_BUCKET="s3://rootuip-backups"
LOG_FILE="/home/iii/ROOTUIP/logs/backup-monitor.log"
ALERT_EMAIL="ops@rootuip.com"
PROMETHEUS_PUSHGATEWAY="http://localhost:9091"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to send metrics to Prometheus
send_metric() {
    local metric_name=$1
    local metric_value=$2
    local metric_help=$3
    
    cat <<EOF | curl --data-binary @- ${PROMETHEUS_PUSHGATEWAY}/metrics/job/backup_monitor
# HELP ${metric_name} ${metric_help}
# TYPE ${metric_name} gauge
${metric_name} ${metric_value}
EOF
}

# Function to check backup age
check_backup_age() {
    local backup_type=$1
    local max_age_hours=$2
    local latest_backup=""
    
    case "$backup_type" in
        "postgresql")
            latest_backup=$(find "$BACKUP_DIR/postgresql" -name "*.dump" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
            ;;
        "files")
            latest_backup=$(find "$BACKUP_DIR/files" -name "*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
            ;;
        "ml-models")
            latest_backup=$(find "$BACKUP_DIR/ml-models" -name "*.pkl" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
            ;;
    esac
    
    if [ -z "$latest_backup" ]; then
        log "ERROR: No backup found for $backup_type"
        send_metric "backup_${backup_type}_status" 0 "Backup status (1=success, 0=failure)"
        return 1
    fi
    
    local backup_timestamp=$(stat -c %Y "$latest_backup" 2>/dev/null)
    local current_timestamp=$(date +%s)
    local age_hours=$(( (current_timestamp - backup_timestamp) / 3600 ))
    
    send_metric "backup_${backup_type}_age_hours" "$age_hours" "Age of latest backup in hours"
    
    if [ "$age_hours" -gt "$max_age_hours" ]; then
        log "WARNING: $backup_type backup is $age_hours hours old (max: $max_age_hours)"
        send_metric "backup_${backup_type}_status" 0 "Backup status (1=success, 0=failure)"
        return 1
    else
        log "OK: $backup_type backup is $age_hours hours old"
        send_metric "backup_${backup_type}_status" 1 "Backup status (1=success, 0=failure)"
        return 0
    fi
}

# Function to check backup size
check_backup_size() {
    local backup_type=$1
    local min_size_mb=$2
    local latest_backup=""
    
    case "$backup_type" in
        "postgresql")
            latest_backup=$(find "$BACKUP_DIR/postgresql" -name "*.dump" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
            ;;
        "files")
            latest_backup=$(find "$BACKUP_DIR/files" -name "*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
            ;;
    esac
    
    if [ -n "$latest_backup" ]; then
        local size_bytes=$(stat -c %s "$latest_backup" 2>/dev/null)
        local size_mb=$((size_bytes / 1024 / 1024))
        
        send_metric "backup_${backup_type}_size_mb" "$size_mb" "Size of latest backup in MB"
        
        if [ "$size_mb" -lt "$min_size_mb" ]; then
            log "WARNING: $backup_type backup size is only ${size_mb}MB (min: ${min_size_mb}MB)"
            return 1
        else
            log "OK: $backup_type backup size is ${size_mb}MB"
            return 0
        fi
    fi
}

# Function to verify backup integrity
verify_backup_integrity() {
    local backup_type=$1
    local latest_backup=""
    
    case "$backup_type" in
        "postgresql")
            latest_backup=$(find "$BACKUP_DIR/postgresql" -name "*.dump" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
            if [ -n "$latest_backup" ]; then
                # Test PostgreSQL dump integrity
                pg_restore --list "$latest_backup" >/dev/null 2>&1
                if [ $? -eq 0 ]; then
                    log "OK: PostgreSQL backup integrity verified"
                    send_metric "backup_postgresql_integrity" 1 "Backup integrity (1=valid, 0=corrupt)"
                    return 0
                else
                    log "ERROR: PostgreSQL backup appears corrupt"
                    send_metric "backup_postgresql_integrity" 0 "Backup integrity (1=valid, 0=corrupt)"
                    return 1
                fi
            fi
            ;;
        "files")
            latest_backup=$(find "$BACKUP_DIR/files" -name "*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
            if [ -n "$latest_backup" ]; then
                # Test tar archive integrity
                tar -tzf "$latest_backup" >/dev/null 2>&1
                if [ $? -eq 0 ]; then
                    log "OK: File backup integrity verified"
                    send_metric "backup_files_integrity" 1 "Backup integrity (1=valid, 0=corrupt)"
                    return 0
                else
                    log "ERROR: File backup appears corrupt"
                    send_metric "backup_files_integrity" 0 "Backup integrity (1=valid, 0=corrupt)"
                    return 1
                fi
            fi
            ;;
    esac
}

# Function to check S3 sync status
check_s3_sync() {
    local local_count=$(find "$BACKUP_DIR" -type f -name "*.dump" -o -name "*.tar.gz" | wc -l)
    local s3_count=$(aws s3 ls "$S3_BUCKET/" --recursive | grep -E '\.(dump|tar\.gz)$' | wc -l)
    
    send_metric "backup_local_count" "$local_count" "Number of local backups"
    send_metric "backup_s3_count" "$s3_count" "Number of S3 backups"
    
    if [ "$s3_count" -lt "$local_count" ]; then
        log "WARNING: S3 sync may be behind. Local: $local_count, S3: $s3_count"
        return 1
    else
        log "OK: S3 sync up to date. Local: $local_count, S3: $s3_count"
        return 0
    fi
}

# Function to check disk space
check_disk_space() {
    local backup_partition=$(df "$BACKUP_DIR" | tail -1 | awk '{print $1}')
    local used_percent=$(df "$BACKUP_DIR" | tail -1 | awk '{print $5}' | tr -d '%')
    local available_gb=$(df -BG "$BACKUP_DIR" | tail -1 | awk '{print $4}' | tr -d 'G')
    
    send_metric "backup_disk_used_percent" "$used_percent" "Backup disk usage percentage"
    send_metric "backup_disk_available_gb" "$available_gb" "Backup disk available space in GB"
    
    if [ "$used_percent" -gt 80 ]; then
        log "WARNING: Backup disk usage at ${used_percent}%"
        return 1
    elif [ "$available_gb" -lt 10 ]; then
        log "WARNING: Only ${available_gb}GB available on backup disk"
        return 1
    else
        log "OK: Backup disk usage at ${used_percent}%, ${available_gb}GB available"
        return 0
    fi
}

# Main monitoring routine
main() {
    log "Starting backup monitoring check"
    
    local alert_needed=false
    local alert_message=""
    
    # Check PostgreSQL backups (max 24 hours old, min 10MB)
    if ! check_backup_age "postgresql" 24; then
        alert_needed=true
        alert_message="${alert_message}\n- PostgreSQL backup is too old or missing"
    fi
    
    if ! check_backup_size "postgresql" 10; then
        alert_needed=true
        alert_message="${alert_message}\n- PostgreSQL backup size is suspiciously small"
    fi
    
    if ! verify_backup_integrity "postgresql"; then
        alert_needed=true
        alert_message="${alert_message}\n- PostgreSQL backup integrity check failed"
    fi
    
    # Check file backups (max 24 hours old, min 50MB)
    if ! check_backup_age "files" 24; then
        alert_needed=true
        alert_message="${alert_message}\n- File backup is too old or missing"
    fi
    
    if ! check_backup_size "files" 50; then
        alert_needed=true
        alert_message="${alert_message}\n- File backup size is suspiciously small"
    fi
    
    if ! verify_backup_integrity "files"; then
        alert_needed=true
        alert_message="${alert_message}\n- File backup integrity check failed"
    fi
    
    # Check ML model backups (max 72 hours old)
    if ! check_backup_age "ml-models" 72; then
        alert_needed=true
        alert_message="${alert_message}\n- ML model backup is too old or missing"
    fi
    
    # Check S3 sync
    if ! check_s3_sync; then
        alert_needed=true
        alert_message="${alert_message}\n- S3 backup sync appears to be behind"
    fi
    
    # Check disk space
    if ! check_disk_space; then
        alert_needed=true
        alert_message="${alert_message}\n- Backup disk space is running low"
    fi
    
    # Record last check timestamp
    send_metric "backup_last_check_timestamp" "$(date +%s)" "Timestamp of last backup check"
    
    # Send alert if needed
    if [ "$alert_needed" = true ]; then
        log "ALERT: Backup issues detected"
        echo -e "ROOTUIP Backup Monitoring Alert\n\nThe following issues were detected:${alert_message}\n\nPlease investigate immediately." | \
            mail -s "[CRITICAL] ROOTUIP Backup Issues Detected" "$ALERT_EMAIL"
        
        # Also send to monitoring system
        curl -X POST http://localhost:3001/api/alerts \
            -H "Content-Type: application/json" \
            -d "{\"severity\": \"critical\", \"source\": \"backup-monitor\", \"message\": \"Backup issues detected\", \"details\": \"${alert_message}\"}"
        
        send_metric "backup_overall_status" 0 "Overall backup health (1=healthy, 0=issues)"
    else
        log "All backup checks passed"
        send_metric "backup_overall_status" 1 "Overall backup health (1=healthy, 0=issues)"
    fi
    
    log "Backup monitoring check completed"
}

# Run main function
main

# Make executable: chmod +x /home/iii/ROOTUIP/monitoring/backup-monitoring.sh
# Add to crontab: 0 6 * * * /home/iii/ROOTUIP/monitoring/backup-monitoring.sh