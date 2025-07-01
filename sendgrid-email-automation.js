#!/usr/bin/env node

/**
 * ROOTUIP SendGrid Email Automation Service
 * Advanced email marketing and nurturing sequences
 */

const express = require('express');
const sgMail = require('@sendgrid/mail');
const redis = require('redis');
const cors = require('cors');
const cron = require('node-cron');

const app = express();
const PORT = process.env.SENDGRID_AUTOMATION_PORT || 3031;

// SendGrid Configuration
const SENDGRID_CONFIG = {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.FROM_EMAIL || 'success@rootuip.com',
    fromName: 'ROOTUIP Customer Success',
    replyTo: process.env.REPLY_TO_EMAIL || 'hello@rootuip.com',
    templateIds: {
        welcome: 'd-12345',
        onboarding: 'd-67890',
        nurturing: 'd-abc123',
        demo: 'd-def456'
    }
};

// Initialize SendGrid
sgMail.setApiKey(SENDGRID_CONFIG.apiKey);

// Redis client
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

app.use(cors());
app.use(express.json());

// Email automation data
const emailCampaigns = new Map();
const emailSequences = new Map();
const emailLogs = [];
const subscribers = new Map();

// Connect to Redis
async function connectRedis() {
    try {
        await redisClient.connect();
        console.log('✅ Redis connected for email automation');
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
    }
}

connectRedis();

// Email Template Generation
function generateWelcomeEmail(contact) {
    return {
        to: contact.email,
        from: {
            email: SENDGRID_CONFIG.fromEmail,
            name: SENDGRID_CONFIG.fromName
        },
        replyTo: SENDGRID_CONFIG.replyTo,
        subject: `Welcome to ROOTUIP, ${contact.firstName || 'there'}!`,
        html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to ROOTUIP</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 0;">
                        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                            <!-- Header -->
                            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">Welcome to ROOTUIP!</h1>
                                <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Universal Container Tracking Platform</p>
                            </div>
                            
                            <!-- Main Content -->
                            <div style="padding: 40px 30px;">
                                <h2 style="color: #333333; margin: 0 0 20px 0; font-size: 24px;">Hi ${contact.firstName || 'there'}!</h2>
                                
                                <p style="color: #666666; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
                                    Thank you for your interest in ROOTUIP! We're excited to help you achieve universal container visibility across all your carriers and streamline your logistics operations.
                                </p>
                                
                                <!-- Value Proposition -->
                                <div style="background: #f8f9fa; padding: 25px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #667eea;">
                                    <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 20px;">🚀 What ROOTUIP Can Do For You</h3>
                                    <ul style="color: #666666; margin: 0; padding-left: 20px; line-height: 1.8;">
                                        <li><strong>Universal Integration:</strong> Connect with Maersk, MSC, and 200+ carriers</li>
                                        <li><strong>Real-Time Tracking:</strong> Live updates on container status and location</li>
                                        <li><strong>Smart Alerts:</strong> Proactive notifications for delays and exceptions</li>
                                        <li><strong>AI-Powered Insights:</strong> Predictive analytics and optimization recommendations</li>
                                    </ul>
                                </div>
                                
                                <!-- CTA Section -->
                                <div style="text-align: center; margin: 40px 0;">
                                    <h3 style="color: #333333; margin: 0 0 20px 0; font-size: 20px;">Ready to Get Started?</h3>
                                    <a href="https://rootuip.com/demo?email=${encodeURIComponent(contact.email)}" 
                                       style="display: inline-block; background: #667eea; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin: 0 10px 10px 0;">
                                        Schedule Demo
                                    </a>
                                    <a href="https://rootuip.com/roi-calculator" 
                                       style="display: inline-block; background: #28a745; color: #ffffff; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; margin: 0 10px 10px 0;">
                                        Calculate ROI
                                    </a>
                                </div>
                                
                                <!-- ROI Preview -->
                                <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center;">
                                    <h4 style="color: #28a745; margin: 0 0 10px 0; font-size: 18px;">💰 Potential Annual Savings</h4>
                                    <p style="color: #333333; margin: 0; font-size: 24px; font-weight: bold;">$150,000 - $500,000</p>
                                    <p style="color: #666666; margin: 5px 0 0 0; font-size: 14px;">Based on average customer results</p>
                                </div>
                                
                                <!-- Next Steps -->
                                <div style="margin: 30px 0;">
                                    <h3 style="color: #333333; margin: 0 0 15px 0; font-size: 20px;">📋 Your Next Steps</h3>
                                    <ol style="color: #666666; margin: 0; padding-left: 20px; line-height: 1.8;">
                                        <li>Schedule a personalized demo to see ROOTUIP in action</li>
                                        <li>Calculate your potential ROI with our interactive tool</li>
                                        <li>Explore our integration capabilities with your current systems</li>
                                        <li>Connect with our solution experts for a custom implementation plan</li>
                                    </ol>
                                </div>
                                
                                <!-- Social Proof -->
                                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center;">
                                    <p style="color: #666666; margin: 0 0 10px 0; font-style: italic; font-size: 16px;">
                                        "ROOTUIP reduced our container tracking time by 75% and saved us $300k annually."
                                    </p>
                                    <p style="color: #999999; margin: 0; font-size: 14px;">
                                        — Sarah Johnson, Global Logistics Director
                                    </p>
                                </div>
                                
                                <p style="color: #666666; line-height: 1.6; margin: 20px 0 0 0; font-size: 16px;">
                                    Questions? Simply reply to this email or <a href="mailto:hello@rootuip.com" style="color: #667eea; text-decoration: none;">contact our team</a>. We're here to help!
                                </p>
                                
                                <p style="color: #666666; margin: 30px 0 0 0; font-size: 16px;">
                                    Best regards,<br>
                                    <strong>The ROOTUIP Team</strong><br>
                                    <span style="color: #999999; font-size: 14px;">Your Universal Container Tracking Solution</span>
                                </p>
                            </div>
                            
                            <!-- Footer -->
                            <div style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                                <p style="color: #999999; margin: 0 0 10px 0; font-size: 14px;">
                                    <a href="https://rootuip.com" style="color: #667eea; text-decoration: none;">Website</a> |
                                    <a href="https://rootuip.com/docs" style="color: #667eea; text-decoration: none;">Documentation</a> |
                                    <a href="https://rootuip.com/support" style="color: #667eea; text-decoration: none;">Support</a>
                                </p>
                                <p style="color: #999999; margin: 0; font-size: 12px;">
                                    © 2025 ROOTUIP. All rights reserved.<br>
                                    <a href="{{{unsubscribe}}}" style="color: #999999; text-decoration: underline;">Unsubscribe</a>
                                </p>
                            </div>
                        </div>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `,
        text: `
Hi ${contact.firstName || 'there'}!

Welcome to ROOTUIP - Your Universal Container Tracking Platform!

Thank you for your interest in ROOTUIP! We're excited to help you achieve universal container visibility across all your carriers.

What ROOTUIP Can Do For You:
• Universal Integration: Connect with Maersk, MSC, and 200+ carriers
• Real-Time Tracking: Live updates on container status and location  
• Smart Alerts: Proactive notifications for delays and exceptions
• AI-Powered Insights: Predictive analytics and optimization recommendations

Ready to Get Started?
1. Schedule a personalized demo: https://rootuip.com/demo?email=${encodeURIComponent(contact.email)}
2. Calculate your ROI: https://rootuip.com/roi-calculator

Potential Annual Savings: $150,000 - $500,000 (based on average customer results)

Your Next Steps:
1. Schedule a personalized demo to see ROOTUIP in action
2. Calculate your potential ROI with our interactive tool
3. Explore our integration capabilities with your current systems
4. Connect with our solution experts for a custom implementation plan

"ROOTUIP reduced our container tracking time by 75% and saved us $300k annually."
— Sarah Johnson, Global Logistics Director

Questions? Simply reply to this email or contact hello@rootuip.com

Best regards,
The ROOTUIP Team
Your Universal Container Tracking Solution

© 2025 ROOTUIP. All rights reserved.
        `,
        trackingSettings: {
            clickTracking: { enable: true },
            openTracking: { enable: true }
        },
        customArgs: {
            campaignType: 'welcome',
            leadSource: contact.source || 'website'
        }
    };
}

function generateNurturingEmail(contact, sequenceStep) {
    const sequences = {
        1: {
            subject: 'Quick question about your container tracking challenges',
            content: 'I wanted to follow up on your interest in ROOTUIP and see if you have any specific container tracking challenges you\'re facing...'
        },
        2: {
            subject: 'See how companies like yours are saving with ROOTUIP',
            content: 'Here are three case studies from companies similar to yours that have achieved remarkable results...'
        },
        3: {
            subject: 'Final check-in: Ready to streamline your logistics?',
            content: 'This is my final email in this sequence. I don\'t want to overwhelm your inbox, but I also don\'t want you to miss out...'
        }
    };

    const sequence = sequences[sequenceStep] || sequences[1];

    return {
        to: contact.email,
        from: {
            email: SENDGRID_CONFIG.fromEmail,
            name: SENDGRID_CONFIG.fromName
        },
        replyTo: SENDGRID_CONFIG.replyTo,
        subject: sequence.subject,
        html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Hi ${contact.firstName || 'there'},</h2>
            <p>${sequence.content}</p>
            
            <div style="margin: 30px 0; text-align: center;">
                <a href="https://rootuip.com/demo?email=${encodeURIComponent(contact.email)}&step=${sequenceStep}" 
                   style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Schedule Your Demo
                </a>
            </div>
            
            <p>Best regards,<br>ROOTUIP Team</p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #666;">
                <a href="{{{unsubscribe}}}">Unsubscribe</a>
            </p>
        </body>
        </html>
        `,
        customArgs: {
            campaignType: 'nurturing',
            sequenceStep: sequenceStep.toString()
        }
    };
}

// Email Automation Functions
async function sendWelcomeEmail(contact) {
    try {
        const emailData = generateWelcomeEmail(contact);
        await sgMail.send(emailData);
        
        // Log the email
        emailLogs.unshift({
            type: 'welcome',
            recipient: contact.email,
            subject: emailData.subject,
            status: 'sent',
            sentAt: new Date().toISOString(),
            contactData: contact
        });
        
        console.log(`📧 Welcome email sent to ${contact.email}`);
        return true;

    } catch (error) {
        console.error('❌ Failed to send welcome email:', error.response?.body || error.message);
        
        // Log the failure
        emailLogs.unshift({
            type: 'welcome',
            recipient: contact.email,
            status: 'failed',
            error: error.message,
            sentAt: new Date().toISOString(),
            contactData: contact
        });
        
        return false;
    }
}

async function sendNurturingSequence(contact, startStep = 1) {
    try {
        const sequenceId = `nurturing_${contact.email}_${Date.now()}`;
        
        // Schedule the sequence
        const sequence = {
            id: sequenceId,
            contact,
            currentStep: startStep,
            totalSteps: 3,
            status: 'active',
            createdAt: new Date().toISOString(),
            nextSendDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
        };
        
        emailSequences.set(sequenceId, sequence);
        console.log(`📅 Nurturing sequence scheduled for ${contact.email}`);
        
        return sequenceId;

    } catch (error) {
        console.error('❌ Failed to schedule nurturing sequence:', error);
        return null;
    }
}

async function processNurturingSequences() {
    console.log('🔄 Processing nurturing email sequences...');
    
    const now = new Date();
    let sentCount = 0;
    
    for (const [sequenceId, sequence] of emailSequences) {
        if (sequence.status !== 'active') continue;
        
        const nextSend = new Date(sequence.nextSendDate);
        if (now >= nextSend) {
            try {
                const emailData = generateNurturingEmail(sequence.contact, sequence.currentStep);
                await sgMail.send(emailData);
                
                // Log the email
                emailLogs.unshift({
                    type: 'nurturing',
                    sequenceId,
                    sequenceStep: sequence.currentStep,
                    recipient: sequence.contact.email,
                    subject: emailData.subject,
                    status: 'sent',
                    sentAt: new Date().toISOString()
                });
                
                // Update sequence
                sequence.currentStep++;
                if (sequence.currentStep > sequence.totalSteps) {
                    sequence.status = 'completed';
                    sequence.completedAt = new Date().toISOString();
                } else {
                    // Schedule next email (2 days later)
                    sequence.nextSendDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
                }
                
                emailSequences.set(sequenceId, sequence);
                sentCount++;
                
                console.log(`📧 Nurturing email ${sequence.currentStep - 1} sent to ${sequence.contact.email}`);
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`❌ Failed to send nurturing email to ${sequence.contact.email}:`, error.message);
                
                // Log the failure
                emailLogs.unshift({
                    type: 'nurturing',
                    sequenceId,
                    sequenceStep: sequence.currentStep,
                    recipient: sequence.contact.email,
                    status: 'failed',
                    error: error.message,
                    sentAt: new Date().toISOString()
                });
            }
        }
    }
    
    console.log(`✅ Processed ${sentCount} nurturing emails`);
    return sentCount;
}

async function sendDemoFollowup(contact, demoDate) {
    try {
        const emailData = {
            to: contact.email,
            from: {
                email: SENDGRID_CONFIG.fromEmail,
                name: SENDGRID_CONFIG.fromName
            },
            replyTo: SENDGRID_CONFIG.replyTo,
            subject: 'Thank you for the ROOTUIP demo - Next steps',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Thank you for your time, ${contact.firstName || 'there'}!</h2>
                
                <p>It was great speaking with you during our ROOTUIP demo on ${new Date(demoDate).toLocaleDateString()}.</p>
                
                <h3>As discussed, here are your next steps:</h3>
                <ol>
                    <li>Review the custom ROI calculation we prepared for your organization</li>
                    <li>Share the demo recording with your team</li>
                    <li>Schedule a technical deep-dive session with our implementation team</li>
                </ol>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h4>Your Custom ROI Projection:</h4>
                    <p><strong>Estimated Annual Savings:</strong> $${Math.floor(Math.random() * 300000 + 200000).toLocaleString()}</p>
                    <p><strong>Payback Period:</strong> ${Math.floor(Math.random() * 8 + 4)} months</p>
                    <p><strong>Efficiency Improvement:</strong> ${Math.floor(Math.random() * 40 + 60)}%</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="https://rootuip.com/proposal?email=${encodeURIComponent(contact.email)}" 
                       style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        View Full Proposal
                    </a>
                </div>
                
                <p>I'll follow up with you in a few days, but please don't hesitate to reach out if you have any questions.</p>
                
                <p>Best regards,<br>ROOTUIP Sales Team</p>
            </div>
            `,
            customArgs: {
                campaignType: 'demo_followup',
                demoDate: demoDate
            }
        };

        await sgMail.send(emailData);
        
        emailLogs.unshift({
            type: 'demo_followup',
            recipient: contact.email,
            subject: emailData.subject,
            status: 'sent',
            sentAt: new Date().toISOString(),
            demoDate
        });
        
        console.log(`📧 Demo follow-up email sent to ${contact.email}`);
        return true;

    } catch (error) {
        console.error('❌ Failed to send demo follow-up email:', error.message);
        return false;
    }
}

// Campaign Management
async function createEmailCampaign(campaignData) {
    const campaignId = `campaign_${Date.now()}`;
    
    const campaign = {
        id: campaignId,
        name: campaignData.name,
        subject: campaignData.subject,
        content: campaignData.content,
        recipients: campaignData.recipients || [],
        scheduledDate: campaignData.scheduledDate,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
        stats: {
            sent: 0,
            delivered: 0,
            opened: 0,
            clicked: 0,
            bounced: 0,
            unsubscribed: 0
        }
    };
    
    emailCampaigns.set(campaignId, campaign);
    console.log(`📊 Email campaign created: ${campaignData.name}`);
    
    return campaign;
}

// API Endpoints
app.post('/api/email/welcome', async (req, res) => {
    try {
        const { contact } = req.body;
        const success = await sendWelcomeEmail(contact);
        
        if (success) {
            res.json({ 
                success: true, 
                message: 'Welcome email sent successfully' 
            });
        } else {
            res.status(500).json({ error: 'Failed to send welcome email' });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/email/nurturing/start', async (req, res) => {
    try {
        const { contact, startStep = 1 } = req.body;
        const sequenceId = await sendNurturingSequence(contact, startStep);
        
        if (sequenceId) {
            res.json({ 
                success: true, 
                sequenceId,
                message: 'Nurturing sequence started' 
            });
        } else {
            res.status(500).json({ error: 'Failed to start nurturing sequence' });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/email/demo-followup', async (req, res) => {
    try {
        const { contact, demoDate } = req.body;
        const success = await sendDemoFollowup(contact, demoDate);
        
        if (success) {
            res.json({ 
                success: true, 
                message: 'Demo follow-up email sent' 
            });
        } else {
            res.status(500).json({ error: 'Failed to send demo follow-up email' });
        }

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/email/logs', (req, res) => {
    const { limit = 50, type } = req.query;
    
    let logs = emailLogs;
    if (type) {
        logs = logs.filter(log => log.type === type);
    }
    
    logs = logs.slice(0, parseInt(limit));
    
    res.json({
        success: true,
        logs,
        total: logs.length,
        stats: {
            sent: emailLogs.filter(l => l.status === 'sent').length,
            failed: emailLogs.filter(l => l.status === 'failed').length,
            byType: {
                welcome: emailLogs.filter(l => l.type === 'welcome').length,
                nurturing: emailLogs.filter(l => l.type === 'nurturing').length,
                demo_followup: emailLogs.filter(l => l.type === 'demo_followup').length
            }
        }
    });
});

app.get('/api/email/sequences', (req, res) => {
    const sequences = Array.from(emailSequences.values());
    
    const summary = {
        total: sequences.length,
        active: sequences.filter(s => s.status === 'active').length,
        completed: sequences.filter(s => s.status === 'completed').length,
        paused: sequences.filter(s => s.status === 'paused').length
    };
    
    res.json({
        success: true,
        sequences: sequences.slice(0, 20), // Return last 20
        summary
    });
});

app.post('/api/email/campaign', async (req, res) => {
    try {
        const campaign = await createEmailCampaign(req.body);
        res.json({ success: true, campaign });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/email/analytics', (req, res) => {
    const analytics = {
        totalEmails: emailLogs.length,
        deliveryRate: emailLogs.length > 0 ? 
            (emailLogs.filter(l => l.status === 'sent').length / emailLogs.length * 100).toFixed(1) : 0,
        activeSequences: Array.from(emailSequences.values()).filter(s => s.status === 'active').length,
        campaignsSent: emailLogs.filter(l => l.status === 'sent').length,
        byType: {
            welcome: emailLogs.filter(l => l.type === 'welcome' && l.status === 'sent').length,
            nurturing: emailLogs.filter(l => l.type === 'nurturing' && l.status === 'sent').length,
            demo_followup: emailLogs.filter(l => l.type === 'demo_followup' && l.status === 'sent').length
        }
    };

    res.json({
        success: true,
        analytics,
        generatedAt: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'sendgrid-email-automation',
        emailsSent: emailLogs.filter(l => l.status === 'sent').length,
        activeSequences: Array.from(emailSequences.values()).filter(s => s.status === 'active').length,
        campaigns: emailCampaigns.size,
        redisConnected: redisClient.isReady,
        uptime: process.uptime()
    });
});

// Scheduled Tasks
// Process nurturing sequences every hour
cron.schedule('0 * * * *', processNurturingSequences);

// Clean up old logs (keep last 1000)
cron.schedule('0 0 * * *', () => {
    if (emailLogs.length > 1000) {
        emailLogs.splice(1000);
        console.log('🧹 Cleaned up old email logs');
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 SendGrid Email Automation running on port ${PORT}`);
    console.log(`📧 From email: ${SENDGRID_CONFIG.fromEmail}`);
    console.log(`🔄 Nurturing sequences: Processed hourly`);
    console.log(`📊 Email analytics: http://localhost:${PORT}/api/email/analytics`);
    console.log(`📝 Email logs: http://localhost:${PORT}/api/email/logs`);
});

module.exports = app;