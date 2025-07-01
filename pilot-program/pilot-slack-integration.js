// ROOTUIP Pilot Customer Slack Integration
// Creates dedicated channels and automates communication

const { WebClient } = require('@slack/web-api');
const express = require('express');
const router = express.Router();

// Initialize Slack client
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// Pilot Slack channel setup
async function createPilotWorkspace(customerId, customerName) {
    try {
        // Create main pilot channel
        const mainChannel = await slack.conversations.create({
            name: `pilot-${customerName.toLowerCase().replace(/\s+/g, '-')}`,
            is_private: false
        });
        
        // Create sub-channels
        const channels = {
            main: mainChannel.channel.id,
            support: await createChannel(`pilot-${customerName}-support`, true),
            alerts: await createChannel(`pilot-${customerName}-alerts`, false),
            success: await createChannel(`pilot-${customerName}-wins`, false)
        };
        
        // Set channel topics
        await setChannelTopics(channels, customerName);
        
        // Invite team members
        await inviteTeamMembers(channels, customerId);
        
        // Post welcome message
        await postWelcomeMessage(channels.main, customerName);
        
        // Set up auto-responders
        await setupAutoResponders(channels);
        
        return channels;
    } catch (error) {
        console.error('Error creating pilot workspace:', error);
        throw error;
    }
}

// Create individual channel
async function createChannel(name, isPrivate = false) {
    const result = await slack.conversations.create({
        name: name.substring(0, 80), // Slack limit
        is_private: isPrivate
    });
    return result.channel.id;
}

// Set channel topics
async function setChannelTopics(channels, customerName) {
    const topics = {
        main: `${customerName} Pilot Program - Main discussion channel`,
        support: `Technical support for ${customerName} pilot`,
        alerts: `Real-time alerts and notifications`,
        success: `Success stories and wins 🎉`
    };
    
    for (const [type, channelId] of Object.entries(channels)) {
        await slack.conversations.setTopic({
            channel: channelId,
            topic: topics[type]
        });
    }
}

// Invite team members
async function inviteTeamMembers(channels, customerId) {
    // Get team members from database
    const teamMembers = await getTeamMembers(customerId);
    
    // ROOTUIP team members
    const rootuipTeam = [
        process.env.SLACK_CSM_ID,
        process.env.SLACK_TECH_SUPPORT_ID,
        process.env.SLACK_AE_ID
    ];
    
    // Invite to main channel
    await slack.conversations.invite({
        channel: channels.main,
        users: [...teamMembers, ...rootuipTeam].join(',')
    });
    
    // Support channel - technical users only
    const technicalUsers = teamMembers.filter(m => m.role === 'technical');
    await slack.conversations.invite({
        channel: channels.support,
        users: [...technicalUsers, process.env.SLACK_TECH_SUPPORT_ID].join(',')
    });
}

// Post welcome message
async function postWelcomeMessage(channelId, customerName) {
    const welcomeBlocks = [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: `Welcome to the ${customerName} Pilot Program! 🚀`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "We're excited to partner with you on your journey to eliminate D&D charges. This Slack workspace will be our primary communication hub throughout the pilot."
            }
        },
        {
            type: "divider"
        },
        {
            type: "section",
            fields: [
                {
                    type: "mrkdwn",
                    text: "*Pilot Duration:*\n60 days"
                },
                {
                    type: "mrkdwn",
                    text: "*Success Target:*\n94% D&D Prevention"
                },
                {
                    type: "mrkdwn",
                    text: "*Your CSM:*\n<@" + process.env.SLACK_CSM_ID + ">"
                },
                {
                    type: "mrkdwn",
                    text: "*Tech Support:*\n<@" + process.env.SLACK_TECH_SUPPORT_ID + ">"
                }
            ]
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: "*Channel Guide:*\n• `#pilot-main` - General discussion and updates\n• `#pilot-support` - Technical questions and issues\n• `#pilot-alerts` - Real-time system alerts\n• `#pilot-wins` - Celebrate successes and prevented D&D events"
            }
        },
        {
            type: "actions",
            elements: [
                {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "View Dashboard"
                    },
                    url: "https://app.rootuip.com/pilot/dashboard",
                    style: "primary"
                },
                {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "Schedule Training"
                    },
                    url: "https://calendly.com/rootuip-training"
                },
                {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "Documentation"
                    },
                    url: "https://docs.rootuip.com"
                }
            ]
        }
    ];
    
    await slack.chat.postMessage({
        channel: channelId,
        blocks: welcomeBlocks,
        text: `Welcome to the ${customerName} Pilot Program!`
    });
}

// Auto-responder setup
async function setupAutoResponders(channels) {
    // Support channel auto-responder
    // This would typically be handled by a Slack app with event subscriptions
    const autoResponses = {
        urgent: {
            keywords: ['urgent', 'critical', 'down', 'emergency'],
            response: "🚨 I've detected this might be urgent. Our team has been notified and will respond within 15 minutes. For immediate assistance, call our hotline: 1-800-ROOTUIP"
        },
        password: {
            keywords: ['password', 'reset password', 'forgot password'],
            response: "🔐 To reset your password, please visit: https://app.rootuip.com/reset-password\nIf you need additional help, our support team will assist you shortly."
        },
        integration: {
            keywords: ['integration', 'api', 'connect', 'setup'],
            response: "🔧 For integration help, check our docs: https://docs.rootuip.com/integration\nOur technical team will follow up with specific guidance."
        }
    };
    
    return autoResponses;
}

// Daily summary bot
async function postDailySummary(customerId) {
    const pilot = await getPilotDetails(customerId);
    const metrics = await getDailyMetrics(customerId);
    const channels = await getPilotChannels(customerId);
    
    const summaryBlocks = [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: "📊 Daily Pilot Summary"
            }
        },
        {
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `*${new Date().toLocaleDateString()}* | Day ${pilot.currentDay} of ${pilot.totalDays}`
                }
            ]
        },
        {
            type: "section",
            fields: [
                {
                    type: "mrkdwn",
                    text: `*D&D Prevention Rate*\n${metrics.preventionRate}% ${getTrend(metrics.preventionRate, metrics.previousRate)}`
                },
                {
                    type: "mrkdwn",
                    text: `*Savings Today*\n$${metrics.dailySavings.toLocaleString()}`
                },
                {
                    type: "mrkdwn",
                    text: `*Shipments Processed*\n${metrics.shipmentsProcessed}`
                },
                {
                    type: "mrkdwn",
                    text: `*Active Users*\n${metrics.activeUsers}/${metrics.totalUsers}`
                }
            ]
        }
    ];
    
    // Add success stories if any
    if (metrics.successStories.length > 0) {
        summaryBlocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*🎉 Today's Wins*\n${metrics.successStories.map(s => `• ${s}`).join('\n')}`
            }
        });
    }
    
    // Add action items if any
    if (metrics.actionItems.length > 0) {
        summaryBlocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*⚡ Action Items*\n${metrics.actionItems.map(a => `• ${a}`).join('\n')}`
            }
        });
    }
    
    await slack.chat.postMessage({
        channel: channels.main,
        blocks: summaryBlocks,
        text: "Daily Pilot Summary"
    });
}

// Alert notifications
async function sendAlert(customerId, alert) {
    const channels = await getPilotChannels(customerId);
    
    const alertBlocks = [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `${getAlertEmoji(alert.severity)} *${alert.title}*`
            }
        },
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: alert.description
            },
            fields: [
                {
                    type: "mrkdwn",
                    text: `*Severity:*\n${alert.severity}`
                },
                {
                    type: "mrkdwn",
                    text: `*Time:*\n<!date^${Math.floor(Date.now() / 1000)}^{date_time}|${new Date().toISOString()}>`
                }
            ]
        }
    ];
    
    if (alert.actionRequired) {
        alertBlocks.push({
            type: "section",
            text: {
                type: "mrkdwn",
                text: `*Action Required:*\n${alert.actionRequired}`
            }
        });
    }
    
    await slack.chat.postMessage({
        channel: channels.alerts,
        blocks: alertBlocks,
        text: `Alert: ${alert.title}`
    });
}

// Success celebration
async function celebrateSuccess(customerId, success) {
    const channels = await getPilotChannels(customerId);
    
    const successBlocks = [
        {
            type: "section",
            text: {
                type: "mrkdwn",
                text: `🎉 *D&D Event Prevented!*`
            }
        },
        {
            type: "section",
            fields: [
                {
                    type: "mrkdwn",
                    text: `*Container:*\n${success.containerNumber}`
                },
                {
                    type: "mrkdwn",
                    text: `*Savings:*\n$${success.savings.toLocaleString()}`
                },
                {
                    type: "mrkdwn",
                    text: `*Risk Score:*\n${success.riskScore}%`
                },
                {
                    type: "mrkdwn",
                    text: `*Action Taken:*\n${success.action}`
                }
            ]
        }
    ];
    
    if (success.totalSavings) {
        successBlocks.push({
            type: "context",
            elements: [
                {
                    type: "mrkdwn",
                    text: `Total pilot savings: $${success.totalSavings.toLocaleString()}`
                }
            ]
        });
    }
    
    await slack.chat.postMessage({
        channel: channels.success,
        blocks: successBlocks,
        text: "D&D Event Prevented!"
    });
}

// Slack command handlers
router.post('/slack/commands', async (req, res) => {
    const { command, text, user_id, channel_id } = req.body;
    
    switch (command) {
        case '/pilot-stats':
            await handleStatsCommand(channel_id, user_id);
            break;
            
        case '/pilot-report':
            await handleReportCommand(channel_id, user_id, text);
            break;
            
        case '/pilot-help':
            await handleHelpCommand(channel_id, user_id);
            break;
            
        default:
            res.send('Unknown command');
    }
    
    res.send(''); // Acknowledge receipt
});

// Stats command handler
async function handleStatsCommand(channelId, userId) {
    const stats = await getCurrentPilotStats(channelId);
    
    await slack.chat.postEphemeral({
        channel: channelId,
        user: userId,
        blocks: [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "*Current Pilot Statistics*"
                }
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Prevention Rate:*\n${stats.preventionRate}%`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Total Savings:*\n$${stats.totalSavings.toLocaleString()}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*ROI:*\n${stats.roi}:1`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Days Remaining:*\n${stats.daysRemaining}`
                    }
                ]
            }
        ],
        text: "Current pilot statistics"
    });
}

// Helper functions
function getAlertEmoji(severity) {
    const emojis = {
        critical: '🚨',
        high: '⚠️',
        medium: '📢',
        low: 'ℹ️'
    };
    return emojis[severity] || '📌';
}

function getTrend(current, previous) {
    if (current > previous) return '↗️';
    if (current < previous) return '↘️';
    return '→';
}

// Scheduled jobs
function initializeScheduledJobs(customerId) {
    const cron = require('node-cron');
    
    // Daily summary at 9 AM
    cron.schedule('0 9 * * *', async () => {
        await postDailySummary(customerId);
    });
    
    // Weekly check-in reminder
    cron.schedule('0 10 * * 1', async () => {
        const channels = await getPilotChannels(customerId);
        await slack.chat.postMessage({
            channel: channels.main,
            text: "📅 Reminder: Weekly pilot check-in meeting today at 2 PM. See calendar invite for details."
        });
    });
}

// Database helper functions (implement based on your schema)
async function getTeamMembers(customerId) {
    // Return array of Slack user IDs
    return [];
}

async function getPilotDetails(customerId) {
    // Return pilot information
    return {
        currentDay: 15,
        totalDays: 60
    };
}

async function getDailyMetrics(customerId) {
    // Return daily metrics
    return {
        preventionRate: 92.5,
        previousRate: 91.8,
        dailySavings: 15420,
        shipmentsProcessed: 47,
        activeUsers: 18,
        totalUsers: 22,
        successStories: [],
        actionItems: []
    };
}

async function getPilotChannels(customerId) {
    // Return channel IDs
    return {
        main: '',
        support: '',
        alerts: '',
        success: ''
    };
}

module.exports = {
    router,
    createPilotWorkspace,
    sendAlert,
    celebrateSuccess,
    postDailySummary,
    initializeScheduledJobs
};