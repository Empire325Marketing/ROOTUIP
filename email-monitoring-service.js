#!/usr/bin/env node

/**
 * ROOTUIP Email Monitoring and Parsing Service
 * Automated email parsing for shipping updates and notifications
 */

const express = require('express');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const redis = require('redis');
const cors = require('cors');

const app = express();
const PORT = process.env.EMAIL_MONITORING_PORT || 3027;

// Redis client
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

app.use(cors());
app.use(express.json());

// Email monitoring configuration
const EMAIL_CONFIG = {
    host: process.env.EMAIL_HOST || 'imap.gmail.com',
    port: 993,
    tls: true,
    user: process.env.EMAIL_USER || 'alerts@rootuip.com',
    password: process.env.EMAIL_PASSWORD || 'demo_password',
    tlsOptions: { rejectUnauthorized: false }
};

// Email storage and parsing results
const monitoredEmails = new Map();
const parsedData = [];
const emailRules = new Map();

// Connect to Redis
async function connectRedis() {
    try {
        await redisClient.connect();
        console.log('✅ Redis connected for email monitoring');
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
    }
}

connectRedis();

// Initialize email parsing rules
function initializeEmailRules() {
    // Maersk email patterns
    emailRules.set('maersk', {
        fromPatterns: ['@maersk.com', '@apmterminals.com'],
        subjectPatterns: ['container', 'shipment', 'vessel', 'booking'],
        containerRegex: /([A-Z]{4}\d{7})/g,
        statusRegex: /(loaded|discharged|departed|arrived|gate in|gate out|delivered)/gi,
        vesselRegex: /vessel[:\s]*([\w\s]+)/gi,
        voyageRegex: /voyage[:\s]*(\w+)/gi,
        etaRegex: /eta[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/gi,
        locationRegex: /(singapore|los angeles|rotterdam|hamburg|shanghai|hong kong)/gi
    });

    // MSC email patterns
    emailRules.set('msc', {
        fromPatterns: ['@msc.com', '@mscgva.ch'],
        subjectPatterns: ['container notification', 'vessel update', 'cargo'],
        containerRegex: /([A-Z]{4}\d{7})/g,
        statusRegex: /(loaded|unloaded|in transit|at berth|customs cleared)/gi,
        vesselRegex: /m\.?s\.?\s*([\w\s]+)/gi,
        voyageRegex: /voyage[:\s]*(\w+)/gi,
        etaRegex: /estimated arrival[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/gi
    });

    // Generic shipping patterns
    emailRules.set('generic', {
        fromPatterns: ['shipping', 'logistics', 'freight', 'cargo'],
        subjectPatterns: ['shipment update', 'container status', 'delivery notification'],
        containerRegex: /([A-Z]{4}\d{7})/g,
        statusRegex: /(picked up|in transit|delivered|delayed|on hold)/gi,
        trackingRegex: /tracking[:\s#]*(\w+)/gi,
        dateRegex: /(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/gi
    });

    console.log(`📧 Initialized ${emailRules.size} email parsing rule sets`);
}

// Email monitoring with IMAP
function startEmailMonitoring() {
    const imap = new Imap(EMAIL_CONFIG);

    imap.once('ready', () => {
        console.log('✅ Connected to email server');
        
        imap.openBox('INBOX', false, (err, box) => {
            if (err) {
                console.error('❌ Error opening inbox:', err);
                return;
            }
            
            console.log(`📬 Monitoring inbox with ${box.messages.total} messages`);
            
            // Monitor for new emails
            imap.on('mail', () => {
                console.log('📨 New email received, processing...');
                processNewEmails(imap);
            });
            
            // Process recent emails on startup
            processRecentEmails(imap);
        });
    });

    imap.once('error', (err) => {
        console.error('❌ IMAP error:', err.message);
        // Use demo mode if email connection fails
        startDemoEmailMonitoring();
    });

    imap.once('end', () => {
        console.log('📧 Email connection ended');
        // Attempt to reconnect after 30 seconds
        setTimeout(() => {
            console.log('🔄 Attempting to reconnect to email server...');
            startEmailMonitoring();
        }, 30000);
    });

    try {
        imap.connect();
    } catch (error) {
        console.error('❌ Failed to connect to email server:', error.message);
        startDemoEmailMonitoring();
    }
}

// Demo email monitoring (generates mock emails)
function startDemoEmailMonitoring() {
    console.log('🔄 Starting demo email monitoring mode');
    
    // Generate demo emails every 2 minutes
    setInterval(() => {
        const demoEmail = generateDemoEmail();
        processEmailContent(demoEmail);
    }, 2 * 60 * 1000);
    
    // Generate initial demo emails
    setTimeout(() => {
        for (let i = 0; i < 3; i++) {
            const demoEmail = generateDemoEmail();
            processEmailContent(demoEmail);
        }
    }, 5000);
}

function generateDemoEmail() {
    const carriers = ['maersk', 'msc', 'hapag-lloyd', 'cosco'];
    const carrier = carriers[Math.floor(Math.random() * carriers.length)];
    const containerNumbers = ['MSKU1234567', 'MSCU2345678', 'HLBU3456789', 'EVGU4567890'];
    const statuses = ['Loaded on Vessel', 'Departed Singapore', 'In Transit', 'Arrived at Port', 'Gate Out'];
    
    const containerNumber = containerNumbers[Math.floor(Math.random() * containerNumbers.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    return {
        messageId: `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        from: `notifications@${carrier}.com`,
        to: 'alerts@rootuip.com',
        subject: `Container ${containerNumber} - ${status}`,
        date: new Date(),
        text: `
Dear Customer,

We are pleased to inform you of an update regarding your container shipment.

Container Number: ${containerNumber}
Status: ${status}
Vessel: Ever Given
Voyage: EG${Math.floor(Math.random() * 1000)}
Location: Singapore Port
ETA: ${new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}

For more information, please contact our customer service.

Best regards,
${carrier.charAt(0).toUpperCase() + carrier.slice(1)} Customer Service
        `,
        html: `<p>Container update notification for ${containerNumber}</p>`,
        isDemoEmail: true
    };
}

function processRecentEmails(imap) {
    // Search for emails from last 7 days
    const searchCriteria = ['UNSEEN', ['SINCE', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)]];
    
    imap.search(searchCriteria, (err, results) => {
        if (err) {
            console.error('❌ Email search error:', err);
            return;
        }
        
        if (results.length === 0) {
            console.log('📭 No recent emails found');
            return;
        }
        
        console.log(`📨 Found ${results.length} recent emails to process`);
        
        const fetch = imap.fetch(results, { bodies: '' });
        
        fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream, info) => {
                simpleParser(stream, (err, parsed) => {
                    if (err) {
                        console.error('❌ Error parsing email:', err);
                        return;
                    }
                    
                    processEmailContent(parsed);
                });
            });
        });
        
        fetch.once('error', (err) => {
            console.error('❌ Fetch error:', err);
        });
    });
}

function processNewEmails(imap) {
    // Process the most recent email
    imap.search(['UNSEEN'], (err, results) => {
        if (err || results.length === 0) return;
        
        const fetch = imap.fetch([results[results.length - 1]], { bodies: '' });
        
        fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream, info) => {
                simpleParser(stream, (err, parsed) => {
                    if (!err) {
                        processEmailContent(parsed);
                    }
                });
            });
        });
    });
}

// Parse email content for shipping information
async function processEmailContent(email) {
    try {
        const fromEmail = email.from?.text || email.from || '';
        const subject = email.subject || '';
        const textContent = email.text || '';
        const htmlContent = email.html || '';
        
        // Determine which rule set to use
        let ruleSet = null;
        let carrier = 'unknown';
        
        for (const [carrierName, rules] of emailRules) {
            if (rules.fromPatterns.some(pattern => fromEmail.toLowerCase().includes(pattern.toLowerCase()))) {
                ruleSet = rules;
                carrier = carrierName;
                break;
            }
        }
        
        if (!ruleSet) {
            // Use generic rules
            ruleSet = emailRules.get('generic');
            carrier = 'generic';
        }
        
        // Extract shipping information
        const extractedData = {
            messageId: email.messageId,
            from: fromEmail,
            subject: subject,
            date: email.date || new Date(),
            carrier: carrier,
            containers: extractContainers(textContent, ruleSet),
            statuses: extractStatuses(textContent, ruleSet),
            vessels: extractVessels(textContent, ruleSet),
            voyages: extractVoyages(textContent, ruleSet),
            locations: extractLocations(textContent, ruleSet),
            dates: extractDates(textContent, ruleSet),
            isShippingRelated: isShippingRelated(subject, textContent, ruleSet),
            processedAt: new Date().toISOString(),
            isDemoEmail: email.isDemoEmail || false
        };
        
        // Store the processed email
        monitoredEmails.set(email.messageId, extractedData);
        parsedData.unshift(extractedData);
        
        // Keep only last 100 parsed emails
        if (parsedData.length > 100) {
            parsedData.pop();
        }
        
        console.log(`📧 Processed email from ${carrier}: ${subject}`);
        
        // If this is shipping-related and has container info, publish updates
        if (extractedData.isShippingRelated && extractedData.containers.length > 0) {
            await publishContainerUpdates(extractedData);
        }
        
        return extractedData;
        
    } catch (error) {
        console.error('❌ Error processing email:', error);
        return null;
    }
}

function extractContainers(text, rules) {
    const matches = text.match(rules.containerRegex) || [];
    return [...new Set(matches)]; // Remove duplicates
}

function extractStatuses(text, rules) {
    const matches = text.match(rules.statusRegex) || [];
    return [...new Set(matches.map(match => match.toLowerCase()))];
}

function extractVessels(text, rules) {
    const matches = text.match(rules.vesselRegex) || [];
    return matches.map(match => match.replace(/vessel[:\s]*/gi, '').trim());
}

function extractVoyages(text, rules) {
    const matches = text.match(rules.voyageRegex) || [];
    return matches.map(match => match.replace(/voyage[:\s]*/gi, '').trim());
}

function extractLocations(text, rules) {
    if (rules.locationRegex) {
        const matches = text.match(rules.locationRegex) || [];
        return [...new Set(matches.map(match => match.trim()))];
    }
    return [];
}

function extractDates(text, rules) {
    const matches = text.match(rules.dateRegex || rules.etaRegex) || [];
    return matches.map(match => {
        // Try to parse the date
        const cleaned = match.replace(/eta[:\s]*/gi, '').trim();
        const date = new Date(cleaned);
        return date.toString() !== 'Invalid Date' ? date.toISOString() : cleaned;
    });
}

function isShippingRelated(subject, text, rules) {
    const combinedText = (subject + ' ' + text).toLowerCase();
    
    // Check if any subject patterns match
    const hasSubjectMatch = rules.subjectPatterns.some(pattern => 
        combinedText.includes(pattern.toLowerCase())
    );
    
    // Check for shipping keywords
    const shippingKeywords = ['container', 'shipment', 'vessel', 'cargo', 'freight', 'booking', 'bill of lading'];
    const hasShippingKeywords = shippingKeywords.some(keyword => 
        combinedText.includes(keyword)
    );
    
    return hasSubjectMatch || hasShippingKeywords;
}

async function publishContainerUpdates(emailData) {
    try {
        for (const container of emailData.containers) {
            const updateData = {
                id: container,
                containerId: container,
                source: `email_${emailData.carrier}`,
                carrier: emailData.carrier === 'generic' ? 'Unknown' : emailData.carrier,
                status: emailData.statuses[0] || 'Update Received',
                vessel: emailData.vessels[0] || null,
                voyage: emailData.voyages[0] || null,
                location: emailData.locations[0] || 'Unknown',
                lastUpdate: emailData.date || new Date().toISOString(),
                emailSource: {
                    from: emailData.from,
                    subject: emailData.subject,
                    messageId: emailData.messageId
                }
            };
            
            // Publish to real-time system
            await redisClient.publish('container-updates', JSON.stringify(updateData));
            
            console.log(`📡 Published email-based update for container ${container}`);
        }
    } catch (error) {
        console.error('❌ Error publishing container updates:', error);
    }
}

// API Endpoints
app.get('/api/emails', (req, res) => {
    const { limit = 20, carrier, shippingOnly } = req.query;
    
    let emails = parsedData;
    
    if (carrier) {
        emails = emails.filter(email => email.carrier === carrier);
    }
    
    if (shippingOnly === 'true') {
        emails = emails.filter(email => email.isShippingRelated);
    }
    
    emails = emails.slice(0, parseInt(limit));
    
    res.json({
        success: true,
        emails,
        total: emails.length,
        filtered: carrier || shippingOnly === 'true'
    });
});

app.get('/api/emails/:messageId', (req, res) => {
    const email = monitoredEmails.get(req.params.messageId);
    if (email) {
        res.json({ success: true, email });
    } else {
        res.status(404).json({ error: 'Email not found' });
    }
});

app.get('/api/emails/containers/:containerId', (req, res) => {
    const { containerId } = req.params;
    const containerEmails = parsedData.filter(email => 
        email.containers.includes(containerId)
    );
    
    res.json({
        success: true,
        containerId,
        emails: containerEmails,
        count: containerEmails.length
    });
});

app.post('/api/emails/rules', (req, res) => {
    try {
        const { name, rules } = req.body;
        emailRules.set(name, rules);
        
        res.json({
            success: true,
            message: `Email rules for ${name} updated`,
            rulesCount: emailRules.size
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/emails/rules', (req, res) => {
    const rules = {};
    for (const [name, ruleSet] of emailRules) {
        rules[name] = ruleSet;
    }
    
    res.json({
        success: true,
        rules,
        count: emailRules.size
    });
});

app.post('/api/emails/test', (req, res) => {
    try {
        const demoEmail = generateDemoEmail();
        const processed = processEmailContent(demoEmail);
        
        res.json({
            success: true,
            message: 'Demo email processed',
            emailData: processed
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'email-monitoring-service',
        emailsProcessed: parsedData.length,
        shippingRelatedEmails: parsedData.filter(e => e.isShippingRelated).length,
        emailRules: emailRules.size,
        redisConnected: redisClient.isReady,
        uptime: process.uptime()
    });
});

// Initialize and start services
initializeEmailRules();

// Start email monitoring (will fall back to demo mode if connection fails)
setTimeout(startEmailMonitoring, 3000);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Email Monitoring Service running on port ${PORT}`);
    console.log(`📧 Email config: ${EMAIL_CONFIG.user}@${EMAIL_CONFIG.host}`);
    console.log(`📋 Monitoring rules: ${Array.from(emailRules.keys()).join(', ')}`);
    console.log(`🔗 API endpoint: http://localhost:${PORT}/api/emails`);
});

module.exports = app;