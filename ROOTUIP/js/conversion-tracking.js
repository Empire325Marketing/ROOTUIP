// UIP Enterprise Conversion Tracking System
// Advanced conversion funnel analytics for $500K+ sales optimization

class ConversionTracker {
    constructor() {
        this.conversionGoals = {
            roi_calculator_start: { value: 10, category: 'engagement' },
            roi_calculator_complete: { value: 50, category: 'lead_generation' },
            demo_booking: { value: 200, category: 'conversion' },
            contact_form: { value: 75, category: 'lead_generation' },
            pricing_view: { value: 25, category: 'interest' },
            case_study_download: { value: 30, category: 'content_engagement' },
            video_watch_complete: { value: 40, category: 'content_engagement' },
            platform_demo_view: { value: 60, category: 'product_interest' }
        };

        this.funnelSteps = [
            'homepage_view',
            'roi_calculator_start', 
            'roi_calculator_complete',
            'demo_booking',
            'demo_completed'
        ];

        this.userJourney = [];
        this.sessionData = this.initSessionData();
        this.formInteractions = new Map();
        
        this.init();
    }

    init() {
        this.setupConversionTracking();
        this.setupFormTracking();
        this.setupEngagementTracking();
        this.setupROICalculatorTracking();
        this.setupVideoTracking();
        this.setupHeatmapIntegration();
        this.trackSessionStart();
        
        console.log('Conversion tracking initialized');
    }

    initSessionData() {
        return {
            sessionId: this.generateSessionId(),
            startTime: Date.now(),
            pageViews: 0,
            conversions: [],
            leadScore: 0,
            touchpoints: [],
            utmData: this.getUTMData(),
            referrerData: this.getReferrerData()
        };
    }

    generateSessionId() {
        return 'uip_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getUTMData() {
        const urlParams = new URLSearchParams(window.location.search);
        return {
            source: urlParams.get('utm_source'),
            medium: urlParams.get('utm_medium'),
            campaign: urlParams.get('utm_campaign'),
            term: urlParams.get('utm_term'),
            content: urlParams.get('utm_content')
        };
    }

    getReferrerData() {
        const referrer = document.referrer;
        if (!referrer) return { type: 'direct', domain: null };
        
        const referrerDomain = new URL(referrer).hostname;
        
        // Categorize traffic sources
        if (referrerDomain.includes('google.com')) return { type: 'search', domain: referrerDomain, engine: 'google' };
        if (referrerDomain.includes('bing.com')) return { type: 'search', domain: referrerDomain, engine: 'bing' };
        if (referrerDomain.includes('linkedin.com')) return { type: 'social', domain: referrerDomain, platform: 'linkedin' };
        if (referrerDomain.includes('twitter.com')) return { type: 'social', domain: referrerDomain, platform: 'twitter' };
        if (referrerDomain.includes('crunchbase.com')) return { type: 'business_intel', domain: referrerDomain };
        
        return { type: 'referral', domain: referrerDomain };
    }

    // Track conversion events with enhanced data
    trackConversion(goalName, additionalData = {}) {
        if (!this.conversionGoals[goalName]) {
            console.warn('Unknown conversion goal:', goalName);
            return;
        }

        const goal = this.conversionGoals[goalName];
        const conversionData = {
            goal: goalName,
            timestamp: Date.now(),
            value: goal.value,
            category: goal.category,
            sessionId: this.sessionData.sessionId,
            pageUrl: window.location.href,
            userAgent: navigator.userAgent,
            ...additionalData
        };

        // Add to session conversions
        this.sessionData.conversions.push(conversionData);
        this.sessionData.leadScore += goal.value;

        // Track in analytics
        if (window.uipAnalytics) {
            window.uipAnalytics.trackEvent('conversion_' + goalName, {
                category: goal.category,
                value: goal.value,
                lead_score: this.sessionData.leadScore,
                session_id: this.sessionData.sessionId,
                conversion_funnel_step: this.getFunnelStep(goalName),
                ...additionalData
            });
        }

        // Track in Google Analytics
        if (window.gtag) {
            gtag('event', 'conversion', {
                event_category: goal.category,
                event_label: goalName,
                value: goal.value,
                custom_parameter_1: this.sessionData.leadScore,
                custom_parameter_2: goalName,
                conversion_id: conversionData.timestamp
            });
        }

        // Send to server for lead scoring
        this.sendConversionToServer(conversionData);
        
        console.log('Conversion tracked:', goalName, conversionData);
    }

    // Setup ROI Calculator specific tracking
    setupROICalculatorTracking() {
        // Track calculator start
        const calculatorInputs = document.querySelectorAll('#vesselCount, #containerVolume, #ddCharges, #manualHours');
        let calculatorStarted = false;

        calculatorInputs.forEach(input => {
            if (input) {
                input.addEventListener('focus', () => {
                    if (!calculatorStarted) {
                        this.trackConversion('roi_calculator_start', {
                            first_input: input.id,
                            input_method: 'focus'
                        });
                        calculatorStarted = true;
                    }
                });

                input.addEventListener('input', (e) => {
                    this.trackROICalculatorInteraction(input.id, e.target.value);
                });
            }
        });

        // Track calculator completion
        this.monitorROICompletion();
    }

    trackROICalculatorInteraction(inputField, value) {
        if (window.uipAnalytics) {
            window.uipAnalytics.trackEvent('roi_calculator_input', {
                category: 'roi_calculator',
                label: inputField,
                input_field: inputField,
                input_value: value,
                interaction_type: 'input_change'
            });
        }
    }

    monitorROICompletion() {
        // Monitor for ROI calculation completion
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.id === 'annualSavings' || 
                    mutation.target.id === 'roiTimeline' || 
                    mutation.target.id === 'fiveYearValue') {
                    
                    const savings = document.getElementById('annualSavings')?.textContent;
                    const timeline = document.getElementById('roiTimeline')?.textContent;
                    const fiveYear = document.getElementById('fiveYearValue')?.textContent;
                    
                    if (savings && timeline && fiveYear) {
                        this.trackConversion('roi_calculator_complete', {
                            calculated_savings: savings,
                            roi_timeline: timeline,
                            five_year_value: fiveYear,
                            completion_method: 'automatic_calculation'
                        });
                        
                        // Track enhanced ecommerce
                        if (window.uipAnalytics) {
                            window.uipAnalytics.trackROICalculator('calculation_completed', {
                                savings: this.parseCurrency(savings),
                                roiTimeline: timeline,
                                fiveYearValue: this.parseCurrency(fiveYear)
                            });
                        }
                    }
                }
            });
        });

        const savingsElement = document.getElementById('annualSavings');
        if (savingsElement) {
            observer.observe(savingsElement, { childList: true, subtree: true });
        }
    }

    // Setup comprehensive form tracking
    setupFormTracking() {
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.tagName === 'FORM') {
                this.trackFormSubmission(form);
            }
        });

        // Track form field interactions
        document.addEventListener('focus', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                this.trackFormFieldInteraction(e.target, 'focus');
            }
        });

        document.addEventListener('blur', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
                this.trackFormFieldInteraction(e.target, 'blur');
            }
        });
    }

    trackFormSubmission(form) {
        const formData = new FormData(form);
        const formObject = Object.fromEntries(formData.entries());
        
        // Calculate form completion score
        const completionScore = this.calculateFormCompletionScore(form);
        
        // Determine conversion type
        let conversionType = 'contact_form';
        if (form.id === 'demoForm') {
            conversionType = 'demo_booking';
        }
        
        this.trackConversion(conversionType, {
            form_id: form.id,
            form_completion_score: completionScore,
            form_data: this.sanitizeFormData(formObject),
            time_to_complete: this.getFormCompletionTime(form.id),
            interaction_count: this.getFormInteractionCount(form.id)
        });

        // Enhanced demo booking tracking
        if (conversionType === 'demo_booking') {
            const leadScore = this.calculateDemoLeadScore(formObject);
            
            if (window.uipAnalytics) {
                window.uipAnalytics.trackDemoBooking(formObject);
            }
            
            // Send lead data to CRM/marketing automation
            this.sendLeadToMarketing(formObject, leadScore);
        }
    }

    trackFormFieldInteraction(field, action) {
        const formId = field.closest('form')?.id || 'unknown';
        const interactionKey = `${formId}_${field.name}`;
        
        if (!this.formInteractions.has(interactionKey)) {
            this.formInteractions.set(interactionKey, {
                fieldName: field.name,
                formId: formId,
                focusTime: null,
                blurTime: null,
                focusCount: 0,
                totalTime: 0
            });
        }
        
        const interaction = this.formInteractions.get(interactionKey);
        
        if (action === 'focus') {
            interaction.focusTime = Date.now();
            interaction.focusCount++;
        } else if (action === 'blur' && interaction.focusTime) {
            interaction.blurTime = Date.now();
            interaction.totalTime += interaction.blurTime - interaction.focusTime;
        }
        
        if (window.uipAnalytics) {
            window.uipAnalytics.trackEvent('form_field_interaction', {
                category: 'form_interaction',
                label: `${formId}_${field.name}_${action}`,
                form_id: formId,
                field_name: field.name,
                action: action,
                focus_count: interaction.focusCount
            });
        }
    }

    // Setup video engagement tracking
    setupVideoTracking() {
        document.addEventListener('loadedmetadata', (e) => {
            if (e.target.tagName === 'VIDEO') {
                this.setupVideoEventListeners(e.target);
            }
        });
    }

    setupVideoEventListeners(video) {
        const videoData = {
            src: video.src || video.currentSrc,
            duration: video.duration,
            watchTime: 0,
            quartiles: { 25: false, 50: false, 75: false, 100: false }
        };

        video.addEventListener('play', () => {
            if (window.uipAnalytics) {
                window.uipAnalytics.trackEvent('video_play', {
                    category: 'video_engagement',
                    label: videoData.src,
                    video_duration: videoData.duration
                });
            }
        });

        video.addEventListener('timeupdate', () => {
            const progress = (video.currentTime / video.duration) * 100;
            
            Object.keys(videoData.quartiles).forEach(quartile => {
                if (progress >= parseInt(quartile) && !videoData.quartiles[quartile]) {
                    videoData.quartiles[quartile] = true;
                    
                    if (window.uipAnalytics) {
                        window.uipAnalytics.trackEvent('video_progress', {
                            category: 'video_engagement',
                            label: `${quartile}%`,
                            video_src: videoData.src,
                            progress_percent: quartile
                        });
                    }
                    
                    if (quartile === '100') {
                        this.trackConversion('video_watch_complete', {
                            video_src: videoData.src,
                            video_duration: videoData.duration
                        });
                    }
                }
            });
        });
    }

    // Setup comprehensive engagement tracking
    setupEngagementTracking() {
        // Track time on page
        let startTime = Date.now();
        let isActive = true;
        
        // Track when user becomes inactive
        const inactivityEvents = ['blur', 'visibilitychange'];
        const activityEvents = ['focus', 'visibilitychange', 'mousemove', 'keydown', 'scroll', 'click'];
        
        inactivityEvents.forEach(event => {
            window.addEventListener(event, () => {
                if (document.hidden || event === 'blur') {
                    isActive = false;
                }
            });
        });
        
        activityEvents.forEach(event => {
            window.addEventListener(event, () => {
                if (!isActive && (!document.hidden || event !== 'visibilitychange')) {
                    isActive = true;
                    startTime = Date.now(); // Reset timer on return
                }
            });
        });
        
        // Track engagement milestones
        const engagementMilestones = [30, 60, 120, 300, 600]; // seconds
        engagementMilestones.forEach(seconds => {
            setTimeout(() => {
                if (isActive) {
                    this.trackEngagementMilestone(seconds);
                }
            }, seconds * 1000);
        });
        
        // Track page exit with engagement data
        window.addEventListener('beforeunload', () => {
            this.trackSessionEnd();
        });
    }

    trackEngagementMilestone(seconds) {
        if (window.uipAnalytics) {
            window.uipAnalytics.trackEvent('engagement_milestone', {
                category: 'engagement',
                label: `${seconds}s`,
                value: seconds,
                lead_score: this.sessionData.leadScore,
                page_type: window.uipAnalytics ? window.uipAnalytics.getPageType() : 'unknown'
            });
        }
    }

    // Utility functions
    parseCurrency(currencyString) {
        if (!currencyString) return 0;
        return parseInt(currencyString.replace(/[$,M]/g, '')) || 0;
    }

    calculateFormCompletionScore(form) {
        const requiredFields = form.querySelectorAll('[required]');
        const filledFields = Array.from(requiredFields).filter(field => field.value.trim() !== '');
        return requiredFields.length > 0 ? (filledFields.length / requiredFields.length) * 100 : 100;
    }

    calculateDemoLeadScore(formData) {
        let score = 0;
        
        // Company size scoring
        const fleetSize = formData.fleet_size || formData.company_size;
        if (fleetSize === '100+') score += 100;
        else if (fleetSize === '50-100') score += 75;
        else if (fleetSize === '10-50') score += 50;
        
        // Email quality
        const email = formData.email || '';
        if (email.includes('.gov') || email.includes('.edu')) score += 25;
        else if (!email.includes('gmail') && !email.includes('yahoo') && !email.includes('hotmail')) score += 15;
        
        // Company name provided
        if (formData.company && formData.company.length > 2) score += 10;
        
        // Phone number provided
        if (formData.phone && formData.phone.length > 7) score += 10;
        
        // Behavioral scoring
        score += Math.min(this.sessionData.leadScore, 50);
        
        return Math.min(score, 200);
    }

    sanitizeFormData(formData) {
        // Remove sensitive data but keep structure for analytics
        const sanitized = {};
        Object.keys(formData).forEach(key => {
            if (!['password', 'ssn', 'credit_card'].includes(key.toLowerCase())) {
                sanitized[key] = typeof formData[key] === 'string' && formData[key].length > 50 
                    ? formData[key].substring(0, 50) + '...' 
                    : formData[key];
            }
        });
        return sanitized;
    }

    getFormCompletionTime(formId) {
        const interactions = Array.from(this.formInteractions.values()).filter(i => i.formId === formId);
        return interactions.reduce((total, interaction) => total + interaction.totalTime, 0);
    }

    getFormInteractionCount(formId) {
        const interactions = Array.from(this.formInteractions.values()).filter(i => i.formId === formId);
        return interactions.reduce((total, interaction) => total + interaction.focusCount, 0);
    }

    getFunnelStep(goalName) {
        return this.funnelSteps.indexOf(goalName) + 1;
    }

    // Setup Hotjar integration
    setupHeatmapIntegration() {
        // This will be configured with actual Hotjar ID
        if (typeof hj !== 'undefined') {
            // Track conversion events in Hotjar
            hj('event', 'uip_conversion_tracking_loaded');
        }
    }

    // Send conversion data to server
    sendConversionToServer(conversionData) {
        if (navigator.sendBeacon) {
            const data = JSON.stringify({
                ...conversionData,
                sessionData: this.sessionData
            });
            navigator.sendBeacon('/api/conversions', data);
        } else {
            // Fallback for older browsers
            fetch('/api/conversions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...conversionData, sessionData: this.sessionData })
            }).catch(err => console.warn('Failed to send conversion data:', err));
        }
    }

    sendLeadToMarketing(formData, leadScore) {
        const leadData = {
            ...formData,
            leadScore: leadScore,
            sessionId: this.sessionData.sessionId,
            utmData: this.sessionData.utmData,
            referrerData: this.sessionData.referrerData,
            touchpoints: this.sessionData.touchpoints,
            timestamp: Date.now()
        };

        // Send to marketing automation platform
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/leads', JSON.stringify(leadData));
        }
    }

    trackSessionStart() {
        this.sessionData.pageViews++;
        if (window.uipAnalytics) {
            window.uipAnalytics.trackEvent('session_start', {
                category: 'session',
                session_id: this.sessionData.sessionId,
                utm_source: this.sessionData.utmData.source,
                referrer_type: this.sessionData.referrerData.type
            });
        }
    }

    trackSessionEnd() {
        const sessionDuration = Date.now() - this.sessionData.startTime;
        if (window.uipAnalytics) {
            window.uipAnalytics.trackEvent('session_end', {
                category: 'session',
                value: Math.round(sessionDuration / 1000),
                session_id: this.sessionData.sessionId,
                conversions_count: this.sessionData.conversions.length,
                final_lead_score: this.sessionData.leadScore,
                page_views: this.sessionData.pageViews
            });
        }
    }

    // Public API for manual tracking
    track(eventName, data = {}) {
        this.trackConversion(eventName, data);
    }

    getSessionData() {
        return { ...this.sessionData };
    }
}

// Initialize conversion tracking
document.addEventListener('DOMContentLoaded', () => {
    window.conversionTracker = new ConversionTracker();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConversionTracker;
}