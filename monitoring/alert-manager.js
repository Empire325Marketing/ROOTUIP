/**
 * ROOTUIP Enterprise Alert Management System
 * Real-time notifications for critical events
 */

const EventEmitter = require('events');
const nodemailer = require('nodemailer');
const { WebClient } = require('@slack/web-api');
const twilio = require('twilio');

class AlertManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            email: {
                enabled: config.email?.enabled || false,
                smtp: {
                    host: config.email?.smtp?.host || 'smtp.gmail.com',
                    port: config.email?.smtp?.port || 587,
                    secure: config.email?.smtp?.secure || false,
                    auth: {
                        user: config.email?.smtp?.auth?.user || '',
                        pass: config.email?.smtp?.auth?.pass || ''
                    }
                },
                from: config.email?.from || 'alerts@rootuip.com',
                recipients: config.email?.recipients || []
            },
            slack: {
                enabled: config.slack?.enabled || false,
                token: config.slack?.token || '',
                channel: config.slack?.channel || '#alerts',
                criticalChannel: config.slack?.criticalChannel || '#critical-alerts'
            },
            sms: {
                enabled: config.sms?.enabled || false,
                accountSid: config.sms?.accountSid || '',
                authToken: config.sms?.authToken || '',
                from: config.sms?.from || '',
                recipients: config.sms?.recipients || []
            },
            webhook: {
                enabled: config.webhook?.enabled || false,
                urls: config.webhook?.urls || []
            },
            thresholds: {
                responseTime: {
                    warning: config.thresholds?.responseTime?.warning || 100,
                    critical: config.thresholds?.responseTime?.critical || 200
                },
                errorRate: {
                    warning: config.thresholds?.errorRate?.warning || 1,
                    critical: config.thresholds?.errorRate?.critical || 5
                },
                cpuUsage: {
                    warning: config.thresholds?.cpuUsage?.warning || 70,
                    critical: config.thresholds?.cpuUsage?.critical || 90
                },
                memoryUsage: {
                    warning: config.thresholds?.memoryUsage?.warning || 80,
                    critical: config.thresholds?.memoryUsage?.critical || 95
                },
                diskUsage: {
                    warning: config.thresholds?.diskUsage?.warning || 80,
                    critical: config.thresholds?.diskUsage?.critical || 90
                },
                cacheHitRate: {
                    warning: config.thresholds?.cacheHitRate?.warning || 85,
                    critical: config.thresholds?.cacheHitRate?.critical || 70
                }
            },
            cooldown: {
                default: config.cooldown?.default || 300, // 5 minutes
                critical: config.cooldown?.critical || 60  // 1 minute for critical
            }
        };

        this.alertHistory = new Map();
        this.activeAlerts = new Map();
        this.emailTransporter = null;
        this.slackClient = null;
        this.twilioClient = null;
        
        this.initialize();
    }

    async initialize() {
        // Initialize email transport
        if (this.config.email.enabled) {
            this.emailTransporter = nodemailer.createTransport(this.config.email.smtp);
            await this.verifyEmailTransport();
        }

        // Initialize Slack client
        if (this.config.slack.enabled) {
            this.slackClient = new WebClient(this.config.slack.token);
        }

        // Initialize Twilio client
        if (this.config.sms.enabled) {
            this.twilioClient = twilio(
                this.config.sms.accountSid,
                this.config.sms.authToken
            );
        }

        console.log('Alert Manager initialized with channels:', {
            email: this.config.email.enabled,
            slack: this.config.slack.enabled,
            sms: this.config.sms.enabled,
            webhook: this.config.webhook.enabled
        });
    }

    async verifyEmailTransport() {
        try {
            await this.emailTransporter.verify();
            console.log('Email transport verified successfully');
        } catch (error) {
            console.error('Email transport verification failed:', error);
            this.config.email.enabled = false;
        }
    }

    generateAlertId(type, metric, severity) {
        return `${type}:${metric}:${severity}`;
    }

    shouldAlert(alertId, severity) {
        const lastAlert = this.alertHistory.get(alertId);
        if (!lastAlert) return true;

        const cooldownPeriod = severity === 'critical' ? 
            this.config.cooldown.critical * 1000 : 
            this.config.cooldown.default * 1000;

        return Date.now() - lastAlert.timestamp > cooldownPeriod;
    }

    async sendAlert(alert) {
        const alertId = this.generateAlertId(alert.type, alert.metric, alert.severity);
        
        // Check cooldown
        if (!this.shouldAlert(alertId, alert.severity)) {
            return { sent: false, reason: 'cooldown' };
        }

        // Record alert
        this.alertHistory.set(alertId, {
            ...alert,
            timestamp: Date.now()
        });

        this.activeAlerts.set(alertId, alert);

        // Format alert message
        const message = this.formatAlertMessage(alert);
        
        // Send through all enabled channels
        const results = await Promise.allSettled([
            this.sendEmail(alert, message),
            this.sendSlack(alert, message),
            this.sendSMS(alert, message),
            this.sendWebhook(alert)
        ]);

        // Emit event for monitoring
        this.emit('alert:sent', {
            alert,
            channels: results.map((r, i) => ({
                channel: ['email', 'slack', 'sms', 'webhook'][i],
                status: r.status,
                error: r.reason
            }))
        });

        return { sent: true, results };
    }

    formatAlertMessage(alert) {
        const timestamp = new Date().toISOString();
        const emoji = {
            info: 'ℹ️',
            warning: '⚠️',
            critical: '🚨'
        }[alert.severity] || '📢';

        return {
            text: `${emoji} ${alert.severity.toUpperCase()}: ${alert.title}`,
            html: `
                <div style="font-family: Arial, sans-serif;">
                    <h2 style="color: ${this.getSeverityColor(alert.severity)};">
                        ${emoji} ${alert.severity.toUpperCase()} Alert
                    </h2>
                    <h3>${alert.title}</h3>
                    <p><strong>Type:</strong> ${alert.type}</p>
                    <p><strong>Metric:</strong> ${alert.metric}</p>
                    <p><strong>Value:</strong> ${alert.value} ${alert.unit || ''}</p>
                    <p><strong>Threshold:</strong> ${alert.threshold} ${alert.unit || ''}</p>
                    <p><strong>Time:</strong> ${timestamp}</p>
                    ${alert.description ? `<p><strong>Description:</strong> ${alert.description}</p>` : ''}
                    ${alert.recommendation ? `<p><strong>Recommendation:</strong> ${alert.recommendation}</p>` : ''}
                </div>
            `,
            markdown: `
*${emoji} ${alert.severity.toUpperCase()} Alert*
*Title:* ${alert.title}
*Type:* ${alert.type}
*Metric:* ${alert.metric}
*Value:* ${alert.value} ${alert.unit || ''}
*Threshold:* ${alert.threshold} ${alert.unit || ''}
*Time:* ${timestamp}
${alert.description ? `*Description:* ${alert.description}` : ''}
${alert.recommendation ? `*Recommendation:* ${alert.recommendation}` : ''}
            `
        };
    }

    getSeverityColor(severity) {
        return {
            info: '#3498db',
            warning: '#f39c12',
            critical: '#e74c3c'
        }[severity] || '#95a5a6';
    }

    async sendEmail(alert, message) {
        if (!this.config.email.enabled || this.config.email.recipients.length === 0) {
            return;
        }

        try {
            const mailOptions = {
                from: this.config.email.from,
                to: this.config.email.recipients.join(', '),
                subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
                text: message.text,
                html: message.html
            };

            await this.emailTransporter.sendMail(mailOptions);
            console.log('Email alert sent successfully');
        } catch (error) {
            console.error('Failed to send email alert:', error);
            throw error;
        }
    }

    async sendSlack(alert, message) {
        if (!this.config.slack.enabled) {
            return;
        }

        try {
            const channel = alert.severity === 'critical' ? 
                this.config.slack.criticalChannel : 
                this.config.slack.channel;

            const color = this.getSeverityColor(alert.severity);

            await this.slackClient.chat.postMessage({
                channel: channel,
                text: message.text,
                attachments: [{
                    color: color,
                    fields: [
                        {
                            title: 'Type',
                            value: alert.type,
                            short: true
                        },
                        {
                            title: 'Metric',
                            value: alert.metric,
                            short: true
                        },
                        {
                            title: 'Value',
                            value: `${alert.value} ${alert.unit || ''}`,
                            short: true
                        },
                        {
                            title: 'Threshold',
                            value: `${alert.threshold} ${alert.unit || ''}`,
                            short: true
                        }
                    ],
                    footer: 'ROOTUIP Alert System',
                    ts: Math.floor(Date.now() / 1000)
                }]
            });

            console.log('Slack alert sent successfully');
        } catch (error) {
            console.error('Failed to send Slack alert:', error);
            throw error;
        }
    }

    async sendSMS(alert, message) {
        if (!this.config.sms.enabled || 
            this.config.sms.recipients.length === 0 ||
            alert.severity !== 'critical') {
            return;
        }

        try {
            const smsText = `${message.text}\nValue: ${alert.value} ${alert.unit || ''}\nThreshold: ${alert.threshold}`;
            
            const promises = this.config.sms.recipients.map(recipient =>
                this.twilioClient.messages.create({
                    body: smsText.substring(0, 160), // SMS limit
                    from: this.config.sms.from,
                    to: recipient
                })
            );

            await Promise.all(promises);
            console.log('SMS alerts sent successfully');
        } catch (error) {
            console.error('Failed to send SMS alert:', error);
            throw error;
        }
    }

    async sendWebhook(alert) {
        if (!this.config.webhook.enabled || this.config.webhook.urls.length === 0) {
            return;
        }

        const payload = {
            timestamp: new Date().toISOString(),
            severity: alert.severity,
            type: alert.type,
            metric: alert.metric,
            value: alert.value,
            threshold: alert.threshold,
            unit: alert.unit,
            title: alert.title,
            description: alert.description,
            recommendation: alert.recommendation,
            metadata: alert.metadata || {}
        };

        const promises = this.config.webhook.urls.map(async (url) => {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Alert-Severity': alert.severity,
                        'X-Alert-Type': alert.type
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`Webhook failed: ${response.status}`);
                }
            } catch (error) {
                console.error(`Failed to send webhook to ${url}:`, error);
                throw error;
            }
        });

        await Promise.allSettled(promises);
    }

    async resolveAlert(alertId, resolution = {}) {
        const alert = this.activeAlerts.get(alertId);
        if (!alert) {
            return false;
        }

        this.activeAlerts.delete(alertId);
        
        const resolvedAlert = {
            ...alert,
            status: 'resolved',
            resolvedAt: new Date().toISOString(),
            resolution: resolution.message || 'Alert condition cleared',
            resolvedBy: resolution.by || 'system'
        };

        // Send resolution notification
        await this.sendAlert({
            ...resolvedAlert,
            severity: 'info',
            title: `Resolved: ${alert.title}`,
            description: `Previous alert has been resolved. ${resolution.message || ''}`
        });

        this.emit('alert:resolved', resolvedAlert);
        return true;
    }

    // Alert checking methods
    async checkSystemMetrics(metrics) {
        const alerts = [];

        // CPU Usage
        if (metrics.cpu > this.config.thresholds.cpuUsage.critical) {
            alerts.push({
                severity: 'critical',
                type: 'performance',
                metric: 'cpu_usage',
                value: metrics.cpu,
                threshold: this.config.thresholds.cpuUsage.critical,
                unit: '%',
                title: 'Critical CPU Usage',
                description: `CPU usage is at ${metrics.cpu}%, exceeding critical threshold`,
                recommendation: 'Consider scaling up resources or optimizing CPU-intensive operations'
            });
        } else if (metrics.cpu > this.config.thresholds.cpuUsage.warning) {
            alerts.push({
                severity: 'warning',
                type: 'performance',
                metric: 'cpu_usage',
                value: metrics.cpu,
                threshold: this.config.thresholds.cpuUsage.warning,
                unit: '%',
                title: 'High CPU Usage',
                description: `CPU usage is at ${metrics.cpu}%, exceeding warning threshold`
            });
        }

        // Memory Usage
        const memoryPercent = (metrics.memoryUsed / metrics.memoryTotal) * 100;
        if (memoryPercent > this.config.thresholds.memoryUsage.critical) {
            alerts.push({
                severity: 'critical',
                type: 'performance',
                metric: 'memory_usage',
                value: memoryPercent.toFixed(1),
                threshold: this.config.thresholds.memoryUsage.critical,
                unit: '%',
                title: 'Critical Memory Usage',
                description: `Memory usage is at ${memoryPercent.toFixed(1)}%, exceeding critical threshold`,
                recommendation: 'Memory leak may be occurring. Restart services or increase memory allocation'
            });
        }

        // Response Time
        if (metrics.avgResponseTime > this.config.thresholds.responseTime.critical) {
            alerts.push({
                severity: 'critical',
                type: 'performance',
                metric: 'response_time',
                value: metrics.avgResponseTime,
                threshold: this.config.thresholds.responseTime.critical,
                unit: 'ms',
                title: 'Critical Response Time',
                description: `Average response time is ${metrics.avgResponseTime}ms, exceeding critical threshold`,
                recommendation: 'Check database performance and API optimization'
            });
        }

        // Error Rate
        if (metrics.errorRate > this.config.thresholds.errorRate.critical) {
            alerts.push({
                severity: 'critical',
                type: 'availability',
                metric: 'error_rate',
                value: metrics.errorRate,
                threshold: this.config.thresholds.errorRate.critical,
                unit: '%',
                title: 'High Error Rate',
                description: `Error rate is at ${metrics.errorRate}%, indicating service issues`,
                recommendation: 'Check application logs and recent deployments'
            });
        }

        // Process alerts
        for (const alert of alerts) {
            await this.sendAlert(alert);
        }

        return alerts;
    }

    // Get alert statistics
    getStats() {
        const now = Date.now();
        const hourAgo = now - (60 * 60 * 1000);
        
        const recentAlerts = Array.from(this.alertHistory.values())
            .filter(alert => alert.timestamp > hourAgo);

        return {
            active: this.activeAlerts.size,
            lastHour: recentAlerts.length,
            bySeverity: {
                critical: recentAlerts.filter(a => a.severity === 'critical').length,
                warning: recentAlerts.filter(a => a.severity === 'warning').length,
                info: recentAlerts.filter(a => a.severity === 'info').length
            },
            byType: recentAlerts.reduce((acc, alert) => {
                acc[alert.type] = (acc[alert.type] || 0) + 1;
                return acc;
            }, {})
        };
    }
}

module.exports = AlertManager;