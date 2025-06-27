// UIP Enterprise Analytics Configuration
// Central configuration for all analytics and tracking systems

window.UIPAnalyticsConfig = {
    // Google Analytics 4 Configuration
    ga4: {
        measurementId: 'G-XXXXXXXXXX', // Replace with actual GA4 Measurement ID
        debugMode: window.location.hostname === 'localhost',
        enhancedEcommerce: true,
        customDimensions: {
            'company_size': 'custom_parameter_1',
            'industry': 'custom_parameter_2', 
            'lead_score': 'custom_parameter_3',
            'user_segment': 'custom_parameter_4'
        }
    },

    // Hotjar Configuration
    hotjar: {
        hjid: 'YOUR_HOTJAR_ID', // Replace with actual Hotjar ID
        hjsv: 6,
        enabled: true
    },

    // FullStory Configuration  
    fullstory: {
        orgId: 'YOUR_FULLSTORY_ORG', // Replace with actual FullStory Org ID
        enabled: true,
        namespace: 'FS'
    },

    // Salesforce Integration
    salesforce: {
        orgId: 'YOUR_SALESFORCE_ORG_ID', // Replace with actual Salesforce Org ID
        webToLeadEndpoint: 'https://webto.salesforce.com/servlet/servlet.WebToLead',
        customFields: {
            attribution_data: '00N000000000000',
            session_id: '00N000000000001', 
            lead_source_detail: '00N000000000002',
            campaign_name: '00N000000000003'
        }
    },

    // Marketo Integration
    marketo: {
        munchkinId: 'YOUR_MARKETO_MUNCHKIN_ID', // Replace with actual Marketo Munchkin ID
        endpoint: 'https://YOUR_INSTANCE.marketo.com/rest/v1/',
        enabled: false // Enable when Marketo is set up
    },

    // HubSpot Integration
    hubspot: {
        portalId: 'YOUR_HUBSPOT_PORTAL_ID', // Replace with actual HubSpot Portal ID
        enabled: false // Enable when HubSpot is set up
    },

    // Slack Integration for Alerts
    slack: {
        webhookUrl: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK', // Replace with actual Slack webhook
        channels: {
            alerts: '#uip-alerts',
            reports: '#uip-reports', 
            performance: '#uip-performance'
        },
        enabled: true
    },

    // Email Reporting Configuration
    email: {
        apiEndpoint: '/api/send-email',
        from: 'analytics@uip.com',
        recipients: {
            daily: ['ceo@uip.com', 'cmo@uip.com'],
            weekly: ['team@uip.com'],
            monthly: ['board@uip.com'],
            alerts: ['sales@uip.com']
        }
    },

    // Attribution Configuration
    attribution: {
        lookbackWindow: 90, // days
        touchpointTypes: {
            'organic_search': { weight: 1.0, category: 'organic' },
            'paid_search': { weight: 1.2, category: 'paid' },
            'social_organic': { weight: 0.8, category: 'social' },
            'social_paid': { weight: 1.1, category: 'social' },
            'direct': { weight: 1.3, category: 'direct' },
            'referral': { weight: 0.9, category: 'referral' },
            'email': { weight: 1.1, category: 'email' },
            'linkedin': { weight: 1.4, category: 'social' },
            'industry_publication': { weight: 1.2, category: 'content' },
            'webinar': { weight: 1.3, category: 'content' },
            'conference': { weight: 1.5, category: 'event' }
        },
        conversionGoals: {
            roi_calculator_start: { value: 10, category: 'engagement' },
            roi_calculator_complete: { value: 50, category: 'lead_generation' },
            demo_booking: { value: 200, category: 'conversion' },
            contact_form: { value: 75, category: 'lead_generation' },
            pricing_view: { value: 25, category: 'interest' },
            case_study_download: { value: 30, category: 'content_engagement' },
            video_watch_complete: { value: 40, category: 'content_engagement' },
            platform_demo_view: { value: 60, category: 'product_interest' }
        }
    },

    // Alert Thresholds
    alerts: {
        conversionRateDrop: 0.8, // Alert if conversion rate drops 20%
        highValueLead: 150, // Alert for leads with score >150
        trafficSpike: 2.0, // Alert if traffic increases 100%
        campaignUnderperform: 0.5, // Alert if campaign performance drops 50%
        sitePerformance: 3000, // Alert if page load time >3s
        formAbandonment: 0.6 // Alert if form abandonment >60%
    },

    // KPI Targets
    kpiTargets: {
        monthly_leads: 100,
        monthly_demos: 25,
        conversion_rate: 0.035,
        avg_lead_score: 120,
        cost_per_lead: 250,
        pipeline_value: 1500000
    },

    // Report Schedules
    reportSchedules: {
        daily_performance: { 
            frequency: 'daily', 
            time: '08:00', 
            recipients: ['ceo@uip.com', 'cmo@uip.com'],
            enabled: true
        },
        weekly_summary: { 
            frequency: 'weekly', 
            day: 'monday', 
            time: '09:00', 
            recipients: ['team@uip.com'],
            enabled: true
        },
        monthly_executive: { 
            frequency: 'monthly', 
            date: 1, 
            time: '08:00', 
            recipients: ['board@uip.com'],
            enabled: true
        }
    },

    // Cross-Domain Tracking
    crossDomain: {
        domains: ['rootuip.com', 'demo.rootuip.com', 'app.rootuip.com'],
        enabled: true
    },

    // Privacy & GDPR Configuration
    privacy: {
        anonymizeIp: true,
        cookieFlags: 'SameSite=Strict;Secure',
        consentRequired: true,
        dataRetention: 26 // months
    },

    // Performance Monitoring
    performance: {
        coreWebVitals: true,
        userTiming: true,
        resourceTiming: true,
        errorTracking: true
    },

    // A/B Testing Configuration
    abTesting: {
        enabled: true,
        tests: {
            'hero_cta_text': {
                variants: ['Calculate Your Savings', 'See Your ROI Now', 'Get My Savings Report'],
                traffic: 100 // percentage
            },
            'demo_form_fields': {
                variants: ['standard', 'minimal', 'detailed'],
                traffic: 50 // percentage
            }
        }
    },

    // Debug Configuration
    debug: {
        enabled: window.location.hostname === 'localhost',
        verbose: false,
        logLevel: 'info' // error, warn, info, debug
    }
};

// Initialize analytics configuration
if (typeof window !== 'undefined') {
    console.log('UIP Analytics Configuration loaded');
    
    // Apply configuration to analytics systems
    if (window.uipAnalytics) {
        window.uipAnalytics.gaId = window.UIPAnalyticsConfig.ga4.measurementId;
    }
    
    if (window.heatmapAnalytics) {
        window.heatmapAnalytics.hotjarId = window.UIPAnalyticsConfig.hotjar.hjid;
        window.heatmapAnalytics.fullstoryOrgId = window.UIPAnalyticsConfig.fullstory.orgId;
    }
}