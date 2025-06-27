// UIP Enterprise Lead Attribution & Campaign Tracking
// Advanced multi-touch attribution for $500K+ sales pipeline optimization

class LeadAttribution {
    constructor() {
        this.attributionModels = {
            'first_touch': 'First Touch Attribution',
            'last_touch': 'Last Touch Attribution',
            'linear': 'Linear Attribution',
            'time_decay': 'Time Decay Attribution',
            'position_based': 'Position-Based Attribution (40-20-40)',
            'data_driven': 'Data-Driven Attribution'
        };

        this.touchpointTypes = {
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
        };

        this.campaignCategories = {
            'brand': { priority: 'high', expectedCPA: 150 },
            'competitor': { priority: 'high', expectedCPA: 300 },
            'industry_terms': { priority: 'medium', expectedCPA: 250 },
            'solution_focused': { priority: 'medium', expectedCPA: 200 },
            'problem_aware': { priority: 'low', expectedCPA: 400 },
            'retargeting': { priority: 'high', expectedCPA: 100 }
        };

        this.userJourney = this.loadUserJourney();
        this.sessionId = this.generateSessionId();
        this.currentTouchpoint = null;
        
        this.init();
    }

    init() {
        this.detectCurrentTouchpoint();
        this.trackTouchpoint();
        this.setupCampaignTracking();
        this.setupCrossDomainTracking();
        this.setupOfflineConversionTracking();
        this.setupSalesforceIntegration();
        this.setupMarketoIntegration();
        
        console.log('Lead attribution system initialized');
    }

    // Detect and classify the current touchpoint
    detectCurrentTouchpoint() {
        const urlParams = new URLSearchParams(window.location.search);
        const referrer = document.referrer;
        const currentUrl = window.location.href;

        this.currentTouchpoint = {
            timestamp: Date.now(),
            sessionId: this.sessionId,
            url: currentUrl,
            referrer: referrer,
            utmSource: urlParams.get('utm_source'),
            utmMedium: urlParams.get('utm_medium'),
            utmCampaign: urlParams.get('utm_campaign'),
            utmTerm: urlParams.get('utm_term'),
            utmContent: urlParams.get('utm_content'),
            gclid: urlParams.get('gclid'), // Google Ads click ID
            fbclid: urlParams.get('fbclid'), // Facebook click ID
            li_fat_id: urlParams.get('li_fat_id'), // LinkedIn click ID
            touchpointType: this.classifyTouchpoint(urlParams, referrer),
            pageType: this.getPageType(),
            userAgent: navigator.userAgent,
            deviceType: this.getDeviceType(),
            location: this.getUserLocation()
        };

        // Enhanced campaign classification
        this.currentTouchpoint.campaignCategory = this.classifyCampaign(this.currentTouchpoint);
        this.currentTouchpoint.touchpointWeight = this.calculateTouchpointWeight(this.currentTouchpoint);
        this.currentTouchpoint.expectedValue = this.calculateExpectedValue(this.currentTouchpoint);
    }

    classifyTouchpoint(urlParams, referrer) {
        const source = urlParams.get('utm_source')?.toLowerCase();
        const medium = urlParams.get('utm_medium')?.toLowerCase();

        // Paid channels
        if (urlParams.get('gclid') || (source === 'google' && medium === 'cpc')) {
            return 'paid_search';
        }
        if (urlParams.get('fbclid') || (source === 'facebook' && medium === 'cpc')) {
            return 'social_paid';
        }
        if (urlParams.get('li_fat_id') || (source === 'linkedin' && medium === 'cpc')) {
            return 'linkedin';
        }

        // Organic social
        if (source === 'linkedin' && !medium) return 'linkedin';
        if (['facebook', 'twitter', 'instagram'].includes(source)) return 'social_organic';

        // Email
        if (medium === 'email' || source === 'email') return 'email';

        // Content & Events
        if (medium === 'webinar' || source === 'webinar') return 'webinar';
        if (medium === 'conference' || source === 'conference') return 'conference';

        // Referral classification
        if (referrer) {
            const referrerDomain = new URL(referrer).hostname.toLowerCase();
            
            if (referrerDomain.includes('google.com')) return 'organic_search';
            if (referrerDomain.includes('bing.com')) return 'organic_search';
            if (referrerDomain.includes('linkedin.com')) return 'linkedin';
            if (referrerDomain.includes('crunchbase.com')) return 'industry_publication';
            if (referrerDomain.includes('freightwaves.com')) return 'industry_publication';
            if (referrerDomain.includes('supplychaindive.com')) return 'industry_publication';
            
            return 'referral';
        }

        // Direct traffic
        return 'direct';
    }

    classifyCampaign(touchpoint) {
        const campaign = touchpoint.utmCampaign?.toLowerCase() || '';
        const keywords = touchpoint.utmTerm?.toLowerCase() || '';
        
        // Brand campaigns
        if (campaign.includes('brand') || keywords.includes('uip') || keywords.includes('unified integration')) {
            return 'brand';
        }
        
        // Competitor campaigns
        if (keywords.includes('maersk') || keywords.includes('hapag') || keywords.includes('msc') || 
            campaign.includes('competitor')) {
            return 'competitor';
        }
        
        // Solution-focused campaigns
        if (campaign.includes('roi') || campaign.includes('demo') || keywords.includes('platform')) {
            return 'solution_focused';
        }
        
        // Problem-aware campaigns
        if (keywords.includes('detention') || keywords.includes('demurrage') || 
            campaign.includes('problem')) {
            return 'problem_aware';
        }
        
        // Retargeting
        if (campaign.includes('retarget') || campaign.includes('remarketing')) {
            return 'retargeting';
        }
        
        // Industry terms
        return 'industry_terms';
    }

    calculateTouchpointWeight(touchpoint) {
        const baseWeight = this.touchpointTypes[touchpoint.touchpointType]?.weight || 1.0;
        let adjustedWeight = baseWeight;

        // Adjust based on campaign category
        const category = this.campaignCategories[touchpoint.campaignCategory];
        if (category) {
            if (category.priority === 'high') adjustedWeight *= 1.2;
            if (category.priority === 'low') adjustedWeight *= 0.8;
        }

        // Adjust based on page type
        if (touchpoint.pageType === 'demo_request') adjustedWeight *= 1.3;
        if (touchpoint.pageType === 'roi_calculator') adjustedWeight *= 1.2;
        if (touchpoint.pageType === 'pricing') adjustedWeight *= 1.1;

        // Adjust based on device type (enterprise users often use desktop)
        if (touchpoint.deviceType === 'desktop') adjustedWeight *= 1.1;

        return Math.round(adjustedWeight * 100) / 100;
    }

    calculateExpectedValue(touchpoint) {
        const category = this.campaignCategories[touchpoint.campaignCategory];
        const baseCPA = category?.expectedCPA || 250;
        
        // Conversion rate estimates by touchpoint type
        const conversionRates = {
            'linkedin': 0.035,
            'direct': 0.045,
            'paid_search': 0.025,
            'organic_search': 0.020,
            'email': 0.040,
            'webinar': 0.060,
            'conference': 0.080
        };

        const conversionRate = conversionRates[touchpoint.touchpointType] || 0.020;
        const expectedConversions = conversionRate;
        const leadValue = 2500; // Average lead value for enterprise customers

        return Math.round(expectedConversions * leadValue);
    }

    // Track the current touchpoint
    trackTouchpoint() {
        // Add to user journey
        this.userJourney.touchpoints.push(this.currentTouchpoint);
        this.saveUserJourney();

        // Track in analytics systems
        this.trackInGA4();
        this.trackInSalesforce();
        this.trackInMarketo();

        // Update attribution models
        this.updateAttributionModels();

        console.log('Touchpoint tracked:', this.currentTouchpoint);
    }

    trackInGA4() {
        if (window.gtag) {
            gtag('event', 'touchpoint_tracked', {
                event_category: 'attribution',
                touchpoint_type: this.currentTouchpoint.touchpointType,
                campaign_category: this.currentTouchpoint.campaignCategory,
                touchpoint_weight: this.currentTouchpoint.touchpointWeight,
                expected_value: this.currentTouchpoint.expectedValue,
                session_id: this.sessionId,
                custom_parameter_1: this.currentTouchpoint.touchpointType,
                custom_parameter_2: this.currentTouchpoint.campaignCategory,
                custom_parameter_3: this.currentTouchpoint.touchpointWeight
            });
        }
    }

    // Setup campaign performance tracking
    setupCampaignTracking() {
        // Track campaign performance metrics
        this.campaignMetrics = {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            cost: 0,
            revenue: 0
        };

        // Monitor campaign-specific events
        this.setupCampaignEventListeners();
    }

    setupCampaignEventListeners() {
        // Track campaign-specific interactions
        document.addEventListener('click', (e) => {
            const element = e.target.closest('a, button');
            if (element) {
                this.trackCampaignInteraction(element, 'click');
            }
        });

        // Track form submissions with campaign attribution
        document.addEventListener('submit', (e) => {
            if (e.target.tagName === 'FORM') {
                this.trackCampaignConversion(e.target);
            }
        });
    }

    trackCampaignInteraction(element, action) {
        const interactionData = {
            action: action,
            element_text: element.textContent?.trim(),
            element_href: element.href,
            campaign_attribution: this.getCurrentAttribution(),
            timestamp: Date.now()
        };

        // Send to analytics
        if (window.gtag) {
            gtag('event', 'campaign_interaction', {
                event_category: 'campaign_attribution',
                event_label: action,
                campaign_category: this.currentTouchpoint?.campaignCategory,
                touchpoint_type: this.currentTouchpoint?.touchpointType,
                interaction_value: this.currentTouchpoint?.expectedValue
            });
        }
    }

    trackCampaignConversion(form) {
        const attribution = this.calculateConversionAttribution();
        
        const conversionData = {
            form_id: form.id,
            conversion_value: this.calculateConversionValue(),
            attribution_model: 'data_driven',
            attributed_touchpoints: attribution.touchpoints,
            primary_campaign: attribution.primaryCampaign,
            assist_campaigns: attribution.assistCampaigns,
            conversion_path_length: this.userJourney.touchpoints.length,
            time_to_conversion: Date.now() - this.userJourney.firstTouchpoint,
            timestamp: Date.now()
        };

        // Track in all systems
        this.sendConversionAttribution(conversionData);
    }

    // Attribution model calculations
    calculateConversionAttribution() {
        const touchpoints = this.userJourney.touchpoints;
        if (touchpoints.length === 0) return null;

        const attribution = {
            firstTouch: touchpoints[0],
            lastTouch: touchpoints[touchpoints.length - 1],
            touchpoints: touchpoints.map(tp => ({
                ...tp,
                linearCredit: 1 / touchpoints.length,
                timeDecayCredit: this.calculateTimeDecayCredit(tp, touchpoints),
                positionBasedCredit: this.calculatePositionBasedCredit(tp, touchpoints),
                dataDrivenCredit: this.calculateDataDrivenCredit(tp, touchpoints)
            }))
        };

        // Identify primary and assist campaigns
        attribution.primaryCampaign = this.identifyPrimaryCampaign(attribution.touchpoints);
        attribution.assistCampaigns = this.identifyAssistCampaigns(attribution.touchpoints);

        return attribution;
    }

    calculateTimeDecayCredit(touchpoint, allTouchpoints) {
        const conversionTime = Date.now();
        const touchpointTime = touchpoint.timestamp;
        const timeDiff = conversionTime - touchpointTime;
        const halfLife = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        
        const decay = Math.pow(0.5, timeDiff / halfLife);
        const totalDecay = allTouchpoints.reduce((sum, tp) => {
            const tpTimeDiff = conversionTime - tp.timestamp;
            return sum + Math.pow(0.5, tpTimeDiff / halfLife);
        }, 0);
        
        return decay / totalDecay;
    }

    calculatePositionBasedCredit(touchpoint, allTouchpoints) {
        const index = allTouchpoints.indexOf(touchpoint);
        const totalTouchpoints = allTouchpoints.length;
        
        if (totalTouchpoints === 1) return 1.0;
        if (totalTouchpoints === 2) return 0.5;
        
        // First and last get 40% each, middle ones share 20%
        if (index === 0) return 0.4;
        if (index === totalTouchpoints - 1) return 0.4;
        
        const middleTouchpoints = totalTouchpoints - 2;
        return 0.2 / middleTouchpoints;
    }

    calculateDataDrivenCredit(touchpoint, allTouchpoints) {
        // Simplified data-driven model based on touchpoint weights and conversion probability
        const baseCredit = touchpoint.touchpointWeight || 1.0;
        const totalWeight = allTouchpoints.reduce((sum, tp) => sum + (tp.touchpointWeight || 1.0), 0);
        
        let adjustedCredit = baseCredit / totalWeight;
        
        // Boost for high-intent touchpoints
        if (touchpoint.touchpointType === 'direct') adjustedCredit *= 1.2;
        if (touchpoint.touchpointType === 'linkedin') adjustedCredit *= 1.1;
        if (touchpoint.campaignCategory === 'brand') adjustedCredit *= 1.1;
        
        return adjustedCredit;
    }

    // Cross-domain tracking for enterprise sales process
    setupCrossDomainTracking() {
        // Track across demo.uip.com, app.uip.com, etc.
        const domains = ['rootuip.com', 'demo.rootuip.com', 'app.rootuip.com'];
        
        // Set up cross-domain parameters
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href) {
                const linkDomain = new URL(link.href).hostname;
                if (domains.some(domain => linkDomain.includes(domain))) {
                    this.addCrossDomainParams(link);
                }
            }
        });
    }

    addCrossDomainParams(link) {
        const url = new URL(link.href);
        url.searchParams.set('uip_session', this.sessionId);
        url.searchParams.set('uip_touchpoint', this.userJourney.touchpoints.length);
        url.searchParams.set('uip_source', this.currentTouchpoint?.touchpointType || 'unknown');
        link.href = url.toString();
    }

    // Offline conversion tracking integration
    setupOfflineConversionTracking() {
        // Track offline conversions from CRM
        this.setupSalesforceWebhooks();
        this.setupCalendlyIntegration();
        this.setupZoomIntegration();
    }

    setupSalesforceWebhooks() {
        // Listen for Salesforce conversion notifications
        window.addEventListener('message', (event) => {
            if (event.data.type === 'salesforce_conversion') {
                this.trackOfflineConversion(event.data);
            }
        });
    }

    trackOfflineConversion(conversionData) {
        const attribution = this.calculateConversionAttribution();
        
        // Send offline conversion data back to ad platforms
        this.sendGoogleOfflineConversion(conversionData, attribution);
        this.sendLinkedInOfflineConversion(conversionData, attribution);
        this.sendFacebookOfflineConversion(conversionData, attribution);
    }

    // CRM Integration methods
    setupSalesforceIntegration() {
        // Salesforce Web-to-Lead integration with attribution data
        this.salesforceConfig = {
            endpoint: 'https://webto.salesforce.com/servlet/servlet.WebToLead',
            orgId: 'YOUR_SALESFORCE_ORG_ID',
            fields: {
                'company': 'company',
                'first_name': 'first_name',
                'last_name': 'last_name',
                'email': 'email',
                'phone': 'phone'
            }
        };
    }

    setupMarketoIntegration() {
        // Marketo integration for lead scoring and nurturing
        this.marketoConfig = {
            munchkinId: 'YOUR_MARKETO_MUNCHKIN_ID',
            endpoint: 'https://YOUR_INSTANCE.marketo.com/rest/v1/'
        };
    }

    sendToSalesforce(leadData, attribution) {
        const salesforceData = {
            ...leadData,
            '00N000000000000': JSON.stringify(attribution), // Custom field for attribution data
            '00N000000000001': this.sessionId, // Session ID
            '00N000000000002': this.currentTouchpoint?.touchpointType, // Lead source detail
            '00N000000000003': this.currentTouchpoint?.utmCampaign, // Campaign
            'lead_source': this.currentTouchpoint?.touchpointType || 'Website',
            'campaign_id': this.currentTouchpoint?.utmCampaign
        };

        // Send to Salesforce
        fetch(this.salesforceConfig.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(salesforceData)
        });
    }

    // Utility methods
    loadUserJourney() {
        const stored = localStorage.getItem('uip_user_journey');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.warn('Failed to parse stored user journey');
            }
        }
        
        return {
            userId: this.generateUserId(),
            firstTouchpoint: Date.now(),
            touchpoints: [],
            conversions: [],
            lastActivity: Date.now()
        };
    }

    saveUserJourney() {
        this.userJourney.lastActivity = Date.now();
        localStorage.setItem('uip_user_journey', JSON.stringify(this.userJourney));
    }

    generateSessionId() {
        return 'uip_session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateUserId() {
        let userId = localStorage.getItem('uip_user_id');
        if (!userId) {
            userId = 'uip_user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('uip_user_id', userId);
        }
        return userId;
    }

    getPageType() {
        const path = window.location.pathname;
        if (path.includes('roi-calculator')) return 'roi_calculator';
        if (path.includes('demo')) return 'demo_request';
        if (path.includes('pricing')) return 'pricing';
        if (path.includes('platform')) return 'platform_overview';
        if (path === '/' || path.includes('index')) return 'homepage';
        return 'other';
    }

    getDeviceType() {
        const userAgent = navigator.userAgent;
        if (/tablet|ipad|playbook|silk/i.test(userAgent)) return 'tablet';
        if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(userAgent)) return 'mobile';
        return 'desktop';
    }

    getUserLocation() {
        // This would typically integrate with a geolocation service
        return {
            country: 'Unknown',
            region: 'Unknown',
            city: 'Unknown'
        };
    }

    getCurrentAttribution() {
        return {
            currentTouchpoint: this.currentTouchpoint,
            totalTouchpoints: this.userJourney.touchpoints.length,
            firstTouchpoint: this.userJourney.touchpoints[0],
            sessionId: this.sessionId
        };
    }

    calculateConversionValue() {
        // Base enterprise lead value
        let value = 2500;
        
        // Adjust based on touchpoint quality
        if (this.currentTouchpoint?.touchpointType === 'linkedin') value *= 1.3;
        if (this.currentTouchpoint?.touchpointType === 'direct') value *= 1.4;
        if (this.currentTouchpoint?.campaignCategory === 'brand') value *= 1.2;
        
        return Math.round(value);
    }

    identifyPrimaryCampaign(touchpoints) {
        // Find touchpoint with highest data-driven credit
        return touchpoints.reduce((primary, tp) => 
            (tp.dataDrivenCredit > primary.dataDrivenCredit) ? tp : primary
        );
    }

    identifyAssistCampaigns(touchpoints) {
        const primary = this.identifyPrimaryCampaign(touchpoints);
        return touchpoints.filter(tp => tp !== primary && tp.dataDrivenCredit > 0.1);
    }

    sendConversionAttribution(conversionData) {
        // Send to internal API
        fetch('/api/attribution', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(conversionData)
        });

        // Send to analytics platforms
        if (window.gtag) {
            gtag('event', 'conversion_attribution', {
                event_category: 'attribution',
                conversion_value: conversionData.conversion_value,
                path_length: conversionData.conversion_path_length,
                time_to_conversion: conversionData.time_to_conversion,
                primary_campaign: conversionData.primary_campaign?.utmCampaign
            });
        }
    }

    // Public API methods
    getAttribution() {
        return this.calculateConversionAttribution();
    }

    getUserJourney() {
        return { ...this.userJourney };
    }

    trackCustomTouchpoint(touchpointData) {
        const customTouchpoint = {
            ...this.currentTouchpoint,
            ...touchpointData,
            timestamp: Date.now(),
            type: 'custom'
        };
        
        this.userJourney.touchpoints.push(customTouchpoint);
        this.saveUserJourney();
    }
}

// Initialize lead attribution
document.addEventListener('DOMContentLoaded', () => {
    window.leadAttribution = new LeadAttribution();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeadAttribution;
}