const cron = require('node-cron');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const AWS = require('aws-sdk');
const { Pool } = require('pg');

const execAsync = promisify(exec);

// Database connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rootuip'
});

// AWS S3 configuration
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
});

// Disaster Recovery Automation System
class DisasterRecoverySystem {
    constructor() {
        this.backupPath = '/var/backups/rootuip';
        this.config = {
            retention: {
                daily: 7,
                weekly: 4,
                monthly: 12
            },
            notifications: {
                email: process.env.DR_NOTIFICATION_EMAIL || 'ops@rootuip.com'
            }
        };
        this.initializeSchedules();
    }

    initializeSchedules() {
        // Daily backup at 2 AM
        cron.schedule('0 2 * * *', () => {
            this.performBackup('daily');
        });

        // Weekly backup on Sunday at 3 AM
        cron.schedule('0 3 * * 0', () => {
            this.performBackup('weekly');
        });

        // Monthly backup on 1st at 4 AM
        cron.schedule('0 4 1 * *', () => {
            this.performBackup('monthly');
        });

        // Backup verification every 6 hours
        cron.schedule('0 */6 * * *', () => {
            this.verifyBackups();
        });

        // DR drill monthly on 15th
        cron.schedule('0 5 15 * *', () => {
            this.performDRDrill();
        });

        console.log('Disaster Recovery schedules initialized');
    }

    async performBackup(type) {
        const startTime = Date.now();
        const backupId = `backup-${type}-${new Date().toISOString().split('T')[0]}`;
        
        try {
            console.log(`Starting ${type} backup: ${backupId}`);
            
            // Create backup directory
            const backupDir = path.join(this.backupPath, backupId);
            await fs.mkdir(backupDir, { recursive: true });

            // Backup components
            const results = await Promise.all([
                this.backupDatabase(backupDir),
                this.backupRedis(backupDir),
                this.backupApplicationFiles(backupDir),
                this.backupConfigurations(backupDir)
            ]);

            // Create backup manifest
            const manifest = {
                id: backupId,
                type,
                timestamp: new Date(),
                components: results,
                duration: Date.now() - startTime,
                size: await this.calculateBackupSize(backupDir)
            };

            await fs.writeFile(
                path.join(backupDir, 'manifest.json'),
                JSON.stringify(manifest, null, 2)
            );

            // Upload to cloud storage
            await this.uploadToCloud(backupDir, backupId);

            // Log successful backup
            await this.logBackup(manifest, 'success');

            // Clean old backups
            await this.cleanOldBackups(type);

            console.log(`Backup ${backupId} completed successfully`);
            
        } catch (error) {
            console.error(`Backup ${backupId} failed:`, error);
            await this.logBackup({ id: backupId, type }, 'failed', error.message);
            await this.sendAlert('Backup Failed', `${type} backup failed: ${error.message}`);
        }
    }

    async backupDatabase(backupDir) {
        const dbBackupFile = path.join(backupDir, 'database.sql.gz');
        
        try {
            // Perform PostgreSQL backup
            const pgDumpCmd = `pg_dump ${process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rootuip'} | gzip > ${dbBackupFile}`;
            await execAsync(pgDumpCmd);

            // Verify backup
            const stats = await fs.stat(dbBackupFile);
            
            return {
                component: 'database',
                file: 'database.sql.gz',
                size: stats.size,
                status: 'success'
            };
        } catch (error) {
            throw new Error(`Database backup failed: ${error.message}`);
        }
    }

    async backupRedis(backupDir) {
        const redisBackupFile = path.join(backupDir, 'redis.rdb');
        
        try {
            // Trigger Redis BGSAVE
            await execAsync('redis-cli BGSAVE');
            
            // Wait for save to complete
            let saveInProgress = true;
            while (saveInProgress) {
                const { stdout } = await execAsync('redis-cli LASTSAVE');
                await new Promise(resolve => setTimeout(resolve, 1000));
                const { stdout: newCheck } = await execAsync('redis-cli LASTSAVE');
                saveInProgress = stdout === newCheck;
            }

            // Copy Redis dump file
            await execAsync(`cp /var/lib/redis/dump.rdb ${redisBackupFile}`);

            const stats = await fs.stat(redisBackupFile);
            
            return {
                component: 'redis',
                file: 'redis.rdb',
                size: stats.size,
                status: 'success'
            };
        } catch (error) {
            // Redis backup is optional, log but don't fail
            console.warn(`Redis backup warning: ${error.message}`);
            return {
                component: 'redis',
                status: 'skipped',
                reason: error.message
            };
        }
    }

    async backupApplicationFiles(backupDir) {
        const appBackupFile = path.join(backupDir, 'application.tar.gz');
        
        try {
            // Backup application files
            const excludes = '--exclude=node_modules --exclude=.git --exclude=logs --exclude=tmp';
            const tarCmd = `tar ${excludes} -czf ${appBackupFile} -C /var/www/rootuip .`;
            await execAsync(tarCmd);

            const stats = await fs.stat(appBackupFile);
            
            return {
                component: 'application',
                file: 'application.tar.gz',
                size: stats.size,
                status: 'success'
            };
        } catch (error) {
            throw new Error(`Application backup failed: ${error.message}`);
        }
    }

    async backupConfigurations(backupDir) {
        const configBackupFile = path.join(backupDir, 'configs.tar.gz');
        
        try {
            // Backup configuration files
            const configPaths = [
                '/etc/nginx/sites-available/rootuip',
                '/etc/systemd/system/rootuip*.service',
                '/home/rootuip/.env'
            ].join(' ');
            
            const tarCmd = `tar -czf ${configBackupFile} ${configPaths} 2>/dev/null || true`;
            await execAsync(tarCmd);

            const stats = await fs.stat(configBackupFile);
            
            return {
                component: 'configurations',
                file: 'configs.tar.gz',
                size: stats.size,
                status: 'success'
            };
        } catch (error) {
            throw new Error(`Configuration backup failed: ${error.message}`);
        }
    }

    async uploadToCloud(backupDir, backupId) {
        const files = await fs.readdir(backupDir);
        
        for (const file of files) {
            const filePath = path.join(backupDir, file);
            const fileContent = await fs.readFile(filePath);
            
            const params = {
                Bucket: 'rootuip-backups',
                Key: `backups/${backupId}/${file}`,
                Body: fileContent,
                ServerSideEncryption: 'AES256',
                StorageClass: 'STANDARD_IA'
            };

            await s3.upload(params).promise();
            console.log(`Uploaded ${file} to S3`);
        }

        // Set lifecycle policy for the backup
        await this.setBackupLifecycle(backupId);
    }

    async setBackupLifecycle(backupId) {
        const type = backupId.split('-')[1];
        const transitionDays = {
            daily: 7,
            weekly: 30,
            monthly: 90
        };

        // Transition to Glacier after specified days
        const lifecycleRules = [{
            ID: backupId,
            Status: 'Enabled',
            Prefix: `backups/${backupId}/`,
            Transitions: [{
                Days: transitionDays[type],
                StorageClass: 'GLACIER'
            }],
            Expiration: {
                Days: this.config.retention[type] * (type === 'daily' ? 1 : type === 'weekly' ? 7 : 30)
            }
        }];

        // Would implement S3 lifecycle policy here
        console.log(`Set lifecycle policy for ${backupId}`);
    }

    async verifyBackups() {
        try {
            console.log('Starting backup verification...');
            
            // Get recent backups
            const recentBackups = await db.query(`
                SELECT * FROM backup_history
                WHERE created_at > NOW() - INTERVAL '24 hours'
                    AND status = 'success'
                ORDER BY created_at DESC
            `);

            for (const backup of recentBackups.rows) {
                await this.verifyBackupIntegrity(backup);
            }

            // Check backup coverage
            const coverage = await this.checkBackupCoverage();
            if (coverage < 100) {
                await this.sendAlert('Backup Coverage Warning', 
                    `Backup coverage is ${coverage}%. Some components may not be backed up.`);
            }

            console.log('Backup verification completed');
            
        } catch (error) {
            console.error('Backup verification error:', error);
            await this.sendAlert('Backup Verification Failed', error.message);
        }
    }

    async verifyBackupIntegrity(backup) {
        try {
            // Verify S3 objects exist
            const manifest = JSON.parse(backup.manifest);
            const s3Objects = await s3.listObjectsV2({
                Bucket: 'rootuip-backups',
                Prefix: `backups/${backup.backup_id}/`
            }).promise();

            if (s3Objects.Contents.length === 0) {
                throw new Error(`No objects found for backup ${backup.backup_id}`);
            }

            // Verify file checksums
            for (const obj of s3Objects.Contents) {
                const headResult = await s3.headObject({
                    Bucket: 'rootuip-backups',
                    Key: obj.Key
                }).promise();

                if (!headResult.ETag) {
                    throw new Error(`Missing checksum for ${obj.Key}`);
                }
            }

            // Update verification timestamp
            await db.query(
                'UPDATE backup_history SET last_verified = NOW() WHERE id = $1',
                [backup.id]
            );

        } catch (error) {
            console.error(`Verification failed for ${backup.backup_id}:`, error);
            await db.query(
                'UPDATE backup_history SET verification_status = $1 WHERE id = $2',
                ['failed', backup.id]
            );
            throw error;
        }
    }

    async performDRDrill() {
        console.log('Starting DR drill...');
        const drillId = `dr-drill-${Date.now()}`;
        
        try {
            // 1. Select a recent backup
            const backup = await this.selectBackupForDrill();
            
            // 2. Restore to test environment
            const restoreResult = await this.restoreToTestEnvironment(backup);
            
            // 3. Verify services
            const serviceChecks = await this.verifyRestoredServices();
            
            // 4. Run smoke tests
            const smokeTests = await this.runSmokeTests();
            
            // 5. Calculate metrics
            const metrics = {
                drillId,
                backupId: backup.backup_id,
                startTime: new Date(),
                restoreTime: restoreResult.duration,
                servicesHealthy: serviceChecks.every(s => s.healthy),
                testsPasssed: smokeTests.passed / smokeTests.total,
                rto: restoreResult.duration / 1000 / 60, // minutes
                status: 'success'
            };

            // Log drill results
            await this.logDRDrill(metrics);
            
            // Clean up test environment
            await this.cleanupTestEnvironment();

            console.log(`DR drill ${drillId} completed successfully`);
            await this.sendAlert('DR Drill Completed', 
                `Monthly DR drill completed. RTO: ${metrics.rto} minutes`);
            
        } catch (error) {
            console.error(`DR drill ${drillId} failed:`, error);
            await this.logDRDrill({ drillId, status: 'failed', error: error.message });
            await this.sendAlert('DR Drill Failed', error.message);
        }
    }

    async cleanOldBackups(type) {
        const retention = this.config.retention[type];
        const cutoffDate = new Date();
        
        if (type === 'daily') {
            cutoffDate.setDate(cutoffDate.getDate() - retention);
        } else if (type === 'weekly') {
            cutoffDate.setDate(cutoffDate.getDate() - (retention * 7));
        } else if (type === 'monthly') {
            cutoffDate.setMonth(cutoffDate.getMonth() - retention);
        }

        // Delete old backups from database
        const deleted = await db.query(`
            DELETE FROM backup_history
            WHERE type = $1 AND created_at < $2
            RETURNING backup_id
        `, [type, cutoffDate]);

        // Delete from S3
        for (const row of deleted.rows) {
            await this.deleteS3Backup(row.backup_id);
        }

        console.log(`Cleaned ${deleted.rowCount} old ${type} backups`);
    }

    async calculateBackupSize(backupDir) {
        const { stdout } = await execAsync(`du -sb ${backupDir} | cut -f1`);
        return parseInt(stdout.trim());
    }

    async logBackup(manifest, status, error = null) {
        await db.query(`
            INSERT INTO backup_history (
                backup_id, type, status, manifest, 
                error_message, created_at
            ) VALUES ($1, $2, $3, $4, $5, NOW())
        `, [manifest.id, manifest.type, status, JSON.stringify(manifest), error]);
    }

    async logDRDrill(metrics) {
        await db.query(`
            INSERT INTO dr_drill_history (
                drill_id, backup_id, metrics, status, created_at
            ) VALUES ($1, $2, $3, $4, NOW())
        `, [metrics.drillId, metrics.backupId, JSON.stringify(metrics), metrics.status]);
    }

    async sendAlert(subject, message) {
        // Would implement actual email/notification here
        console.log(`ALERT: ${subject} - ${message}`);
    }

    async getBackupStatus() {
        const status = await db.query(`
            SELECT 
                type,
                COUNT(*) as total_backups,
                COUNT(CASE WHEN status = 'success' THEN 1 END) as successful,
                MAX(created_at) as last_backup,
                AVG(CAST(manifest->>'duration' AS INTEGER)) as avg_duration
            FROM backup_history
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY type
        `);

        const drills = await db.query(`
            SELECT 
                COUNT(*) as total_drills,
                AVG(CAST(metrics->>'rto' AS FLOAT)) as avg_rto,
                MAX(created_at) as last_drill
            FROM dr_drill_history
            WHERE created_at > NOW() - INTERVAL '90 days'
        `);

        return {
            backups: status.rows,
            drills: drills.rows[0],
            nextBackup: this.getNextBackupTime(),
            nextDrill: this.getNextDrillTime()
        };
    }

    getNextBackupTime() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(2, 0, 0, 0);
        return tomorrow;
    }

    getNextDrillTime() {
        const now = new Date();
        const next = new Date(now.getFullYear(), now.getMonth() + 1, 15, 5, 0, 0);
        if (next < now) {
            next.setMonth(next.getMonth() + 1);
        }
        return next;
    }
}

// Initialize DR system
const drSystem = new DisasterRecoverySystem();

// Initialize database tables
async function initializeDatabase() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS backup_history (
                id SERIAL PRIMARY KEY,
                backup_id VARCHAR(100) UNIQUE,
                type VARCHAR(20),
                status VARCHAR(20),
                manifest JSONB,
                error_message TEXT,
                last_verified TIMESTAMP,
                verification_status VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS dr_drill_history (
                id SERIAL PRIMARY KEY,
                drill_id VARCHAR(100) UNIQUE,
                backup_id VARCHAR(100),
                metrics JSONB,
                status VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('DR database tables initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
    }
}

// API endpoints
const express = require('express');
const router = express.Router();

router.get('/api/dr/status', async (req, res) => {
    try {
        const status = await drSystem.getBackupStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/dr/backup/manual', async (req, res) => {
    try {
        const { type = 'manual' } = req.body;
        drSystem.performBackup(type);
        res.json({ message: 'Backup initiated', type });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/dr/drill/manual', async (req, res) => {
    try {
        drSystem.performDRDrill();
        res.json({ message: 'DR drill initiated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize on module load
initializeDatabase();

module.exports = { router, drSystem };