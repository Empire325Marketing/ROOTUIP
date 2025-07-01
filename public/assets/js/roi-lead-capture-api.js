/**
 * ROOTUIP ROI Calculator Lead Capture API
 * Backend integration for lead processing and report generation
 */

// Lead scoring system
const leadScoringFactors = {
    jobTitle: {
        'ceo': 100,
        'cfo': 95,
        'coo': 90,
        'supply_chain': 85,
        'logistics': 70,
        'procurement': 65,
        'other': 40
    },
    companySize: {
        'fortune500': 100,
        'enterprise': 90,
        'midmarket': 75,
        'small': 50,
        'startup': 25
    },
    urgency: {
        'immediate': 100,
        'short': 80,
        'medium': 60,
        'long': 40,
        'research': 20
    },
    annualSavings: {
        'over_50m': 100,
        '20m_to_50m': 90,
        '10m_to_20m': 80,
        '5m_to_10m': 70,
        '1m_to_5m': 60,
        'under_1m': 30
    }
};

// Industry-specific email templates
const industryTemplates = {
    retail: {
        subject: "Your ${{totalSavings}}M Retail Supply Chain Savings Analysis",
        emailTemplate: `
            <h2>Peak Season Protection: Your {{companyName}} ROI Analysis</h2>
            <p>Dear {{contactName}},</p>
            <p>Based on your retail operation's profile, here's how ROOTUIP can protect your peak season performance:</p>
            
            <div class="savings-highlight">
                <h3>Your Potential Annual Savings: ${{totalSavingsFormatted}}</h3>
            </div>
            
            <h4>Retail-Specific Benefits:</h4>
            <ul>
                <li><strong>Peak Season Protection:</strong> Prevent ${{detentionSavingsFormatted}} in detention charges during Q4</li>
                <li><strong>Inventory Assurance:</strong> Ensure ${{shipmentValueFormatted}} shipments arrive on schedule</li>
                <li><strong>Customer Satisfaction:</strong> Maintain 99.8% on-time delivery during holidays</li>
                <li><strong>Cash Flow Optimization:</strong> Free up ${{operationalSavingsFormatted}} in working capital</li>
            </ul>
            
            <h4>What This Means for {{companyName}}:</h4>
            <p>With {{annualVolume}} containers annually, even a 1-day delay can cost your retail operation up to ${{dailyRiskCost}} in lost sales, stockouts, and expedited shipping.</p>
            
            <div class="cta-section">
                <h4>Next Steps:</h4>
                <p>Schedule a 30-minute executive demo to see exactly how we'll protect your peak season operations.</p>
                <a href="https://calendly.com/rootuip/retail-demo" class="cta-button">Schedule Your Retail Demo</a>
            </div>
        `
    },
    manufacturing: {
        subject: "Prevent ${{totalSavings}}M in Production Line Disruptions",
        emailTemplate: `
            <h2>Just-in-Time Protection: Your {{companyName}} ROI Analysis</h2>
            <p>Dear {{contactName}},</p>
            <p>For manufacturing operations like yours, a single delayed component can shut down entire production lines. Here's your protection plan:</p>
            
            <div class="savings-highlight">
                <h3>Your Potential Annual Savings: ${{totalSavingsFormatted}}</h3>
            </div>
            
            <h4>Manufacturing-Critical Benefits:</h4>
            <ul>
                <li><strong>Production Line Protection:</strong> Prevent ${{detentionSavingsFormatted}} in line-stop costs</li>
                <li><strong>JIT Reliability:</strong> Maintain 99.9% component availability</li>
                <li><strong>Quality Assurance:</strong> Avoid rush orders that compromise quality standards</li>
                <li><strong>Supplier Relationship:</strong> Strengthen partnerships with predictable delivery windows</li>
            </ul>
            
            <h4>Manufacturing Risk Assessment:</h4>
            <p>Your {{annualVolume}} annual containers carry critical components worth ${{shipmentValueFormatted}} each. A single day of production delay can cost {{companyName}} up to ${{dailyRiskCost}} in lost output and expedited logistics.</p>
            
            <div class="cta-section">
                <h4>Next Steps:</h4>
                <p>See how Fortune 500 manufacturers protect their production schedules with ROOTUIP.</p>
                <a href="https://calendly.com/rootuip/manufacturing-demo" class="cta-button">Schedule Manufacturing Demo</a>
            </div>
        `
    },
    automotive: {
        subject: "Assembly Line Protection: ${{totalSavings}}M Savings Analysis",
        emailTemplate: `
            <h2>Zero-Downtime Strategy: Your {{companyName}} ROI Analysis</h2>
            <p>Dear {{contactName}},</p>
            <p>In automotive manufacturing, a missing $50 part can halt a $50M production line. Here's how we ensure that never happens:</p>
            
            <div class="savings-highlight">
                <h3>Your Potential Annual Savings: ${{totalSavingsFormatted}}</h3>
            </div>
            
            <h4>Automotive-Specific Protection:</h4>
            <ul>
                <li><strong>Line-Stop Prevention:</strong> Avoid ${{detentionSavingsFormatted}} in production halts</li>
                <li><strong>Critical Parts Tracking:</strong> 100% visibility on tier-1 supplier shipments</li>
                <li><strong>Model Launch Security:</strong> Guarantee new model introduction timelines</li>
                <li><strong>Recall Risk Mitigation:</strong> Prevent quality issues from rushed parts</li>
            </ul>
            
            <h4>Automotive Industry Impact:</h4>
            <p>With {{annualVolume}} containers of critical automotive components, each valued at ${{shipmentValueFormatted}}, {{companyName}} faces potential line-stop costs of ${{dailyRiskCost}} per day of delay.</p>
            
            <div class="cta-section">
                <h4>Next Steps:</h4>
                <p>Discover how leading OEMs achieve zero supply-related line stops.</p>
                <a href="https://calendly.com/rootuip/automotive-demo" class="cta-button">Schedule Automotive Demo</a>
            </div>
        `
    },
    pharmaceuticals: {
        subject: "Compliance-First Savings: ${{totalSavings}}M Analysis for {{companyName}}",
        emailTemplate: `
            <h2>Regulatory-Compliant Logistics: Your {{companyName}} ROI Analysis</h2>
            <p>Dear {{contactName}},</p>
            <p>In pharmaceuticals, compliance isn't optional—it's everything. Here's how ROOTUIP ensures both savings and regulatory adherence:</p>
            
            <div class="savings-highlight">
                <h3>Your Potential Annual Savings: ${{totalSavingsFormatted}}</h3>
            </div>
            
            <h4>Pharmaceutical Compliance Benefits:</h4>
            <ul>
                <li><strong>Cold Chain Integrity:</strong> Prevent ${{detentionSavingsFormatted}} in spoiled products</li>
                <li><strong>FDA Compliance:</strong> Maintain continuous temperature monitoring</li>
                <li><strong>Batch Tracking:</strong> Complete chain of custody documentation</li>
                <li><strong>Regulatory Reporting:</strong> Automated compliance documentation</li>
            </ul>
            
            <h4>Pharmaceutical Risk Profile:</h4>
            <p>Your {{annualVolume}} pharmaceutical shipments, each worth ${{shipmentValueFormatted}}, require temperature-controlled handling. A single temperature excursion can result in ${{dailyRiskCost}} in product loss and regulatory fines.</p>
            
            <div class="cta-section">
                <h4>Next Steps:</h4>
                <p>See how Top 10 pharma companies maintain 100% cold chain compliance.</p>
                <a href="https://calendly.com/rootuip/pharma-demo" class="cta-button">Schedule Pharma Demo</a>
            </div>
        `
    },
    consumer_goods: {
        subject: "Brand Protection Strategy: ${{totalSavings}}M Savings for {{companyName}}",
        emailTemplate: `
            <h2>Market Timing Excellence: Your {{companyName}} ROI Analysis</h2>
            <p>Dear {{contactName}},</p>
            <p>In consumer goods, timing is everything. Missing a market window can mean losing an entire season. Here's your protection strategy:</p>
            
            <div class="savings-highlight">
                <h3>Your Potential Annual Savings: ${{totalSavingsFormatted}}</h3>
            </div>
            
            <h4>Consumer Goods Advantages:</h4>
            <ul>
                <li><strong>Market Window Protection:</strong> Ensure ${{detentionSavingsFormatted}} in on-time launches</li>
                <li><strong>Seasonal Delivery:</strong> Perfect timing for holiday and seasonal products</li>
                <li><strong>Brand Reputation:</strong> Maintain retailer relationships with reliable delivery</li>
                <li><strong>Inventory Optimization:</strong> Reduce ${{operationalSavingsFormatted}} in safety stock</li>
            </ul>
            
            <h4>Consumer Goods Impact:</h4>
            <p>With {{annualVolume}} consumer product shipments annually, each carrying ${{shipmentValueFormatted}} in goods, {{companyName}} needs predictable delivery to capture market opportunities worth ${{dailyRiskCost}} daily.</p>
            
            <div class="cta-section">
                <h4>Next Steps:</h4>
                <p>Learn how leading consumer brands achieve 99.8% on-time market delivery.</p>
                <a href="https://calendly.com/rootuip/consumer-goods-demo" class="cta-button">Schedule Brand Demo</a>
            </div>
        `
    }
};

// Calculate lead score
function calculateLeadScore(leadData) {
    let score = 0;
    
    // Job title scoring
    score += leadScoringFactors.jobTitle[leadData.jobTitle] || 40;
    
    // Company size scoring
    score += leadScoringFactors.companySize[leadData.companySize] || 50;
    
    // Urgency scoring
    score += leadScoringFactors.urgency[leadData.urgency] || 40;
    
    // Annual savings scoring
    const savingsM = leadData.totalSavings / 1000000;
    if (savingsM >= 50) score += 100;
    else if (savingsM >= 20) score += 90;
    else if (savingsM >= 10) score += 80;
    else if (savingsM >= 5) score += 70;
    else if (savingsM >= 1) score += 60;
    else score += 30;
    
    // Volume bonus
    if (leadData.annualVolume >= 25000) score += 20;
    else if (leadData.annualVolume >= 10000) score += 15;
    else if (leadData.annualVolume >= 5000) score += 10;
    
    // Email domain scoring (corporate vs personal)
    const emailDomain = leadData.email.split('@')[1];
    if (!['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(emailDomain)) {
        score += 15;
    }
    
    return Math.min(score, 400); // Cap at 400 points
}

// Generate personalized ROI report
function generateROIReport(leadData) {
    const template = industryTemplates[leadData.industry] || industryTemplates.retail;
    
    // Format numbers for display
    const formatCurrency = (amount) => {
        if (amount >= 1000000) {
            return '$' + (amount / 1000000).toFixed(1) + 'M';
        } else if (amount >= 1000) {
            return '$' + (amount / 1000).toFixed(0) + 'K';
        } else {
            return '$' + amount.toLocaleString();
        }
    };
    
    // Calculate daily risk cost
    const dailyRiskCost = Math.round((leadData.totalSavings / 365) / 1000) * 1000;
    
    // Template variables
    const templateVars = {
        companyName: leadData.companyName,
        contactName: leadData.contactName,
        totalSavings: (leadData.totalSavings / 1000000).toFixed(1),
        totalSavingsFormatted: formatCurrency(leadData.totalSavings),
        detentionSavingsFormatted: formatCurrency(leadData.detentionSavings),
        demurrageSavingsFormatted: formatCurrency(leadData.demurrageSavings),
        operationalSavingsFormatted: formatCurrency(leadData.operationalSavings),
        annualVolume: leadData.annualVolume.toLocaleString(),
        shipmentValueFormatted: formatCurrency(leadData.averageShipmentValue),
        dailyRiskCost: formatCurrency(dailyRiskCost)
    };
    
    // Replace template variables
    let emailContent = template.emailTemplate;
    let emailSubject = template.subject;
    
    Object.entries(templateVars).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        emailContent = emailContent.replace(regex, value);
        emailSubject = emailSubject.replace(regex, value);
    });
    
    return {
        subject: emailSubject,
        content: emailContent,
        leadScore: calculateLeadScore(leadData),
        templateVars
    };
}

// API endpoint for lead capture
async function handleROILeadCapture(request) {
    try {
        const leadData = await request.json();
        
        // Validate required fields
        const requiredFields = ['contactName', 'email', 'companyName', 'jobTitle', 'industry', 'companySize'];
        for (const field of requiredFields) {
            if (!leadData[field]) {
                return new Response(JSON.stringify({ error: `Missing required field: ${field}` }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        // Generate ROI report
        const roiReport = generateROIReport(leadData);
        
        // Enhanced lead data with scoring
        const enhancedLeadData = {
            ...leadData,
            leadScore: roiReport.leadScore,
            reportGenerated: new Date().toISOString(),
            source: 'ROI Calculator',
            qualified: roiReport.leadScore >= 300, // High-value threshold
            followUpPriority: roiReport.leadScore >= 350 ? 'immediate' : 
                             roiReport.leadScore >= 300 ? 'high' : 
                             roiReport.leadScore >= 250 ? 'medium' : 'low'
        };
        
        // Send to multiple systems in parallel
        const integrationPromises = [
            sendToHubSpot(enhancedLeadData),
            sendToSalesforce(enhancedLeadData),
            sendEmailReport(leadData.email, roiReport),
            sendSlackNotification(enhancedLeadData),
            logToAnalytics(enhancedLeadData)
        ];
        
        // Wait for critical integrations
        await Promise.allSettled(integrationPromises);
        
        // Return success response
        return new Response(JSON.stringify({
            success: true,
            leadScore: roiReport.leadScore,
            qualified: enhancedLeadData.qualified,
            followUpPriority: enhancedLeadData.followUpPriority,
            reportSent: true
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (error) {
        console.error('ROI lead capture error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// HubSpot integration
async function sendToHubSpot(leadData) {
    const hubspotData = {
        properties: {
            email: leadData.email,
            firstname: leadData.contactName.split(' ')[0],
            lastname: leadData.contactName.split(' ').slice(1).join(' ') || 'Unknown',
            company: leadData.companyName,
            jobtitle: leadData.jobTitle,
            industry: leadData.industry,
            annual_shipping_volume: leadData.annualVolume,
            calculated_roi: leadData.totalSavings,
            lead_score: leadData.leadScore,
            lead_source: 'ROI Calculator',
            urgency_timeline: leadData.urgency,
            company_size: leadData.companySize,
            qualified_lead: leadData.qualified,
            follow_up_priority: leadData.followUpPriority
        }
    };
    
    return fetch(`https://api.hubapi.com/crm/v3/objects/contacts`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(hubspotData)
    });
}

// Salesforce integration
async function sendToSalesforce(leadData) {
    const salesforceData = {
        FirstName: leadData.contactName.split(' ')[0],
        LastName: leadData.contactName.split(' ').slice(1).join(' ') || 'Unknown',
        Email: leadData.email,
        Company: leadData.companyName,
        Title: leadData.jobTitle,
        Industry: leadData.industry,
        LeadSource: 'ROI Calculator',
        Annual_Shipping_Volume__c: leadData.annualVolume,
        Calculated_ROI__c: leadData.totalSavings,
        Lead_Score__c: leadData.leadScore,
        Urgency_Timeline__c: leadData.urgency,
        Company_Size__c: leadData.companySize,
        Description: `ROI Calculator Lead - Potential savings: $${(leadData.totalSavings / 1000000).toFixed(1)}M annually`
    };
    
    return fetch(`${process.env.SALESFORCE_INSTANCE_URL}/services/data/v54.0/sobjects/Lead/`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(salesforceData)
    });
}

// Email report delivery
async function sendEmailReport(email, roiReport) {
    const emailData = {
        personalizations: [{
            to: [{ email: email }],
            subject: roiReport.subject
        }],
        from: {
            email: 'noreply@rootuip.com',
            name: 'ROOTUIP ROI Calculator'
        },
        content: [{
            type: 'text/html',
            value: roiReport.content
        }]
    };
    
    return fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailData)
    });
}

// Slack notification for sales team
async function sendSlackNotification(leadData) {
    const priorityEmoji = {
        'immediate': '🚨',
        'high': '🔥',
        'medium': '⚡',
        'low': '📝'
    };
    
    const slackMessage = {
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: `${priorityEmoji[leadData.followUpPriority]} New ${leadData.followUpPriority.toUpperCase()} Priority Lead`
                }
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*Company:*\n${leadData.companyName}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Contact:*\n${leadData.contactName}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Title:*\n${leadData.jobTitle}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Industry:*\n${leadData.industry}`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Annual Volume:*\n${leadData.annualVolume.toLocaleString()} containers`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Potential Savings:*\n$${(leadData.totalSavings / 1000000).toFixed(1)}M annually`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Lead Score:*\n${leadData.leadScore}/400`
                    },
                    {
                        type: "mrkdwn",
                        text: `*Timeline:*\n${leadData.urgency}`
                    }
                ]
            },
            {
                type: "actions",
                elements: [
                    {
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "📧 Email Lead"
                        },
                        style: "primary",
                        url: `mailto:${leadData.email}?subject=Following up on your ROOTUIP ROI calculation`
                    },
                    {
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "📅 Schedule Demo"
                        },
                        url: `https://calendly.com/rootuip/executive-demo?prefill_email=${leadData.email}&prefill_name=${encodeURIComponent(leadData.contactName)}`
                    },
                    {
                        type: "button",
                        text: {
                            type: "plain_text",
                            text: "🔍 View in CRM"
                        },
                        url: "https://app.hubspot.com/contacts/"
                    }
                ]
            }
        ]
    };
    
    return fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(slackMessage)
    });
}

// Analytics logging
async function logToAnalytics(leadData) {
    const analyticsData = {
        event: 'roi_calculator_conversion',
        properties: {
            lead_score: leadData.leadScore,
            total_savings: leadData.totalSavings,
            annual_volume: leadData.annualVolume,
            industry: leadData.industry,
            company_size: leadData.companySize,
            urgency: leadData.urgency,
            qualified: leadData.qualified,
            timestamp: new Date().toISOString()
        },
        user_id: leadData.email,
        traits: {
            email: leadData.email,
            name: leadData.contactName,
            company: leadData.companyName,
            title: leadData.jobTitle
        }
    };
    
    // Log to multiple analytics platforms
    return Promise.all([
        // Google Analytics 4
        fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${process.env.GA4_MEASUREMENT_ID}&api_secret=${process.env.GA4_API_SECRET}`, {
            method: 'POST',
            body: JSON.stringify({
                client_id: generateClientId(leadData.email),
                events: [{
                    name: 'roi_calculator_conversion',
                    parameters: analyticsData.properties
                }]
            })
        }),
        
        // Mixpanel
        fetch('https://api.mixpanel.com/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                event: analyticsData.event,
                properties: {
                    ...analyticsData.properties,
                    token: process.env.MIXPANEL_TOKEN,
                    distinct_id: leadData.email
                }
            })
        })
    ]);
}

// Utility function to generate consistent client ID
function generateClientId(email) {
    // Simple hash function for consistent client ID
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
        const char = email.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
}

// Export the main handler
export { handleROILeadCapture };