// UIP Enterprise Analytics - Google Analytics 4 Implementation
// Comprehensive tracking for $500K+ enterprise sales funnel

class UIPAnalytics {
    constructor() {
        this.gaId = 'G-XXXXXXXXXX'; // Replace with actual GA4 Measurement ID
        this.debugMode = window.location.hostname === 'localhost';
        this.initialized = false;
        this.userSegment = null;
        this.sessionStartTime = Date.now();
        
        this.init();
    }

    // Initialize GA4 and custom tracking
    init() {
        this.loadGA4();
        this.setupCustomEvents();
        this.detectUserSegment();
        this.trackPageLoad();
        this.setupScrollTracking();
        this.setupEngagementTracking();
        this.initialized = true;
        
        if (this.debugMode) {
            console.log('UIP Analytics initialized in debug mode');
        }
    }

    // Load GA4 script
    loadGA4() {
        // Google Analytics 4 Global Site Tag
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${this.gaId}`;
        document.head.appendChild(script);

        // Initialize gtag
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        
        gtag('js', new Date());
        gtag('config', this.gaId, {
            // Enhanced ecommerce and conversion tracking
            send_page_view: true,
            allow_enhanced_conversions: true,
            custom_map: {
                'custom_parameter_1': 'company_size',
                'custom_parameter_2': 'industry',
                'custom_parameter_3': 'lead_score',
                'custom_parameter_4': 'user_segment'
            },
            // Privacy and GDPR compliance
            anonymize_ip: true,
            cookie_flags: 'SameSite=Strict;Secure'
        });

        // Enable enhanced ecommerce
        gtag('config', this.gaId, {
            enable_enhanced_ecommerce: true
        });
    }

    // Detect user segment for personalization
    detectUserSegment() {
        const urlParams = new URLSearchParams(window.location.search);
        const referrer = document.referrer;
        const companySize = this.detectCompanySize();
        
        // Segment based on traffic source and behavior
        if (urlParams.get('utm_source') === 'linkedin' || referrer.includes('linkedin.com')) {
            this.userSegment = 'enterprise_linkedin';
        } else if (urlParams.get('utm_source') === 'google-ads') {
            this.userSegment = 'enterprise_search';
        } else if (referrer.includes('crunchbase.com') || referrer.includes('bloomberg.com')) {
            this.userSegment = 'enterprise_research';
        } else {
            this.userSegment = 'enterprise_organic';
        }

        // Enhanced user properties
        gtag('set', 'user_properties', {
            company_size: companySize,
            user_segment: this.userSegment,
            page_type: this.getPageType(),
            visit_timestamp: new Date().toISOString()
        });

        this.trackEvent('user_segment_detected', {
            segment: this.userSegment,
            company_size: companySize,
            traffic_source: urlParams.get('utm_source') || 'direct'
        });
    }

    // Detect company size from URL parameters or form data
    detectCompanySize() {
        const urlParams = new URLSearchParams(window.location.search);
        const companySize = urlParams.get('company_size') || 
                           localStorage.getItem('uip_company_size') || 
                           'unknown';
        
        if (companySize !== 'unknown') {
            localStorage.setItem('uip_company_size', companySize);
        }
        
        return companySize;
    }

    // Get current page type for segmentation
    getPageType() {
        const path = window.location.pathname;
        if (path.includes('roi-calculator')) return 'roi_calculator';
        if (path.includes('demo')) return 'demo_request';
        if (path.includes('pricing')) return 'pricing';
        if (path.includes('platform')) return 'platform_overview';
        if (path === '/' || path.includes('index')) return 'homepage';
        return 'other';
    }

    // Track ROI Calculator interactions (Enhanced Ecommerce)
    trackROICalculator(action, data = {}) {
        const calculatorData = {
            vessels: data.vessels || 0,
            containers: data.containers || 0,
            ddCharges: data.ddCharges || 0,
            savings: data.savings || 0,
            roi: data.roi || 0
        };

        // Enhanced ecommerce event for ROI calculation
        gtag('event', 'roi_calculator_interaction', {
            event_category: 'conversion_funnel',
            event_label: action,
            value: calculatorData.savings,
            currency: 'USD',
            custom_parameter_1: this.detectCompanySize(),
            custom_parameter_2: this.userSegment,
            roi_vessels: calculatorData.vessels,
            roi_savings: calculatorData.savings,
            roi_timeline: data.roiTimeline || 'unknown'
        });

        // Enhanced ecommerce purchase event when ROI is calculated
        if (action === 'calculation_completed') {
            gtag('event', 'purchase', {
                transaction_id: `roi_calc_${Date.now()}`,
                value: calculatorData.savings / 1000000, // Simplified value in millions
                currency: 'USD',
                event_category: 'roi_calculator',
                items: [{
                    item_id: 'roi_calculation',
                    item_name: 'ROI Calculator Completion',
                    category: 'lead_generation',
                    quantity: 1,
                    price: calculatorData.savings / 1000000
                }]
            });
        }

        this.debugLog('ROI Calculator tracked:', action, calculatorData);
    }

    // Track demo booking with enhanced conversion data
    trackDemoBooking(formData = {}) {
        const leadScore = this.calculateLeadScore(formData);
        
        gtag('event', 'demo_booking', {
            event_category: 'conversion',
            event_label: 'demo_form_submission',
            value: leadScore,
            custom_parameter_1: formData.company_size || 'unknown',
            custom_parameter_2: formData.industry || 'unknown',
            custom_parameter_3: leadScore,
            custom_parameter_4: this.userSegment,
            lead_source: this.getLeadSource(),
            company_name: formData.company || 'unknown'
        });

        // Enhanced ecommerce conversion event
        gtag('event', 'conversion', {
            send_to: this.gaId,
            transaction_id: `demo_${Date.now()}`,
            value: leadScore,
            currency: 'USD'
        });

        this.debugLog('Demo booking tracked:', formData, 'Lead Score:', leadScore);
    }

    // Calculate lead score based on form data and behavior
    calculateLeadScore(formData) {
        let score = 0;
        
        // Company size scoring
        const companySize = formData.company_size || formData.fleet_size;
        if (companySize === '100+') score += 100;
        else if (companySize === '50-100') score += 75;
        else if (companySize === '10-50') score += 50;
        
        // Email domain scoring
        const email = formData.email || '';
        if (email.includes('.gov') || email.includes('.edu')) score += 25;
        else if (!email.includes('gmail') && !email.includes('yahoo')) score += 15;
        
        // User segment scoring
        if (this.userSegment === 'enterprise_linkedin') score += 20;
        else if (this.userSegment === 'enterprise_research') score += 15;
        
        // Engagement scoring
        const timeOnSite = (Date.now() - this.sessionStartTime) / 1000;
        if (timeOnSite > 300) score += 10; // 5+ minutes
        if (timeOnSite > 600) score += 15; // 10+ minutes
        
        return Math.min(score, 200); // Cap at 200
    }

    // Get lead source for attribution
    getLeadSource() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('utm_source') || 
               urlParams.get('source') || 
               (document.referrer ? new URL(document.referrer).hostname : 'direct');
    }

    // Track custom events with enterprise context
    trackEvent(eventName, parameters = {}) {
        const eventData = {
            event_category: parameters.category || 'engagement',
            event_label: parameters.label || eventName,
            custom_parameter_1: this.detectCompanySize(),
            custom_parameter_2: this.userSegment,
            custom_parameter_3: parameters.lead_score || 0,
            custom_parameter_4: this.getPageType(),
            ...parameters
        };

        gtag('event', eventName, eventData);
        this.debugLog('Event tracked:', eventName, eventData);
    }

    // Track page views with enhanced data
    trackPageLoad() {
        gtag('event', 'page_view', {
            page_title: document.title,
            page_location: window.location.href,
            custom_parameter_1: this.detectCompanySize(),
            custom_parameter_2: this.userSegment,
            custom_parameter_4: this.getPageType()
        });
    }

    // Track scroll depth for engagement measurement
    setupScrollTracking() {
        let maxScroll = 0;
        const trackingPoints = [25, 50, 75, 90, 100];
        const tracked = new Set();

        window.addEventListener('scroll', () => {
            const scrollPercent = Math.round(
                ((window.scrollY + window.innerHeight) / document.body.scrollHeight) * 100
            );
            
            maxScroll = Math.max(maxScroll, scrollPercent);

            trackingPoints.forEach(point => {
                if (scrollPercent >= point && !tracked.has(point)) {
                    tracked.add(point);
                    this.trackEvent('scroll_depth', {
                        category: 'engagement',
                        label: `${point}%`,
                        value: point,
                        page_type: this.getPageType()
                    });
                }
            });
        });

        // Track max scroll on page unload
        window.addEventListener('beforeunload', () => {
            this.trackEvent('max_scroll_depth', {
                category: 'engagement',
                value: maxScroll,
                page_type: this.getPageType()
            });
        });
    }

    // Track time-based engagement
    setupEngagementTracking() {
        const engagementPoints = [30, 60, 120, 300, 600]; // seconds
        const tracked = new Set();

        engagementPoints.forEach(seconds => {
            setTimeout(() => {
                if (!tracked.has(seconds)) {
                    tracked.add(seconds);
                    this.trackEvent('time_on_page', {
                        category: 'engagement',
                        label: `${seconds}s`,
                        value: seconds,
                        page_type: this.getPageType()
                    });
                }
            }, seconds * 1000);
        });
    }

    // Setup custom event listeners
    setupCustomEvents() {
        // Track all link clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link) {
                this.trackEvent('link_click', {
                    category: 'navigation',
                    label: link.href,
                    link_text: link.textContent.trim(),
                    link_destination: link.href
                });
            }

            // Track button clicks
            const button = e.target.closest('button, .btn');
            if (button) {
                this.trackEvent('button_click', {
                    category: 'interaction',
                    label: button.textContent.trim() || button.className,
                    button_type: button.className
                });
            }
        });

        // Track form interactions
        document.addEventListener('submit', (e) => {
            const form = e.target;
            if (form.tagName === 'FORM') {
                const formData = new FormData(form);
                const formObject = Object.fromEntries(formData.entries());
                
                if (form.id === 'demoForm') {
                    this.trackDemoBooking(formObject);
                } else {
                    this.trackEvent('form_submission', {
                        category: 'conversion',
                        label: form.id || 'unknown_form',
                        form_id: form.id
                    });
                }
            }
        });

        // Track video interactions (if any)
        document.addEventListener('play', (e) => {
            if (e.target.tagName === 'VIDEO') {
                this.trackEvent('video_play', {
                    category: 'media',
                    label: e.target.src || 'embedded_video',
                    video_duration: e.target.duration
                });
            }
        });

        // Track file downloads
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href) {
                const downloadExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip'];
                const isDownload = downloadExtensions.some(ext => link.href.toLowerCase().includes(ext));
                
                if (isDownload) {
                    this.trackEvent('file_download', {
                        category: 'content',
                        label: link.href,
                        file_type: link.href.split('.').pop(),
                        download_source: this.getPageType()
                    });
                }
            }
        });
    }

    // Track ecommerce events for ROI calculator
    trackEcommerce(action, data = {}) {
        switch(action) {
            case 'begin_checkout':
                gtag('event', 'begin_checkout', {
                    currency: 'USD',
                    value: data.value || 0,
                    items: data.items || []
                });
                break;
                
            case 'add_to_cart':
                gtag('event', 'add_to_cart', {
                    currency: 'USD',
                    value: data.value || 0,
                    items: data.items || []
                });
                break;
        }
    }

    // Enhanced user identification for lead tracking
    identifyUser(userData) {
        gtag('config', this.gaId, {
            custom_map: {
                'custom_parameter_1': userData.company_size,
                'custom_parameter_2': userData.industry,
                'custom_parameter_3': this.calculateLeadScore(userData)
            }
        });

        // Set user properties for audience building
        gtag('set', 'user_properties', {
            company_size: userData.company_size,
            industry: userData.industry,
            lead_score: this.calculateLeadScore(userData),
            first_visit_page: this.getPageType()
        });
    }

    // Debug logging for development
    debugLog(...args) {
        if (this.debugMode) {
            console.log('[UIP Analytics]', ...args);
        }
    }

    // Manual event tracking for external use
    track(eventName, data = {}) {
        this.trackEvent(eventName, data);
    }

    // Get analytics data for dashboards
    getAnalyticsData() {
        return {
            userSegment: this.userSegment,
            sessionDuration: (Date.now() - this.sessionStartTime) / 1000,
            pageType: this.getPageType(),
            companySize: this.detectCompanySize(),
            leadSource: this.getLeadSource()
        };
    }
}

// Initialize analytics when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.uipAnalytics = new UIPAnalytics();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIPAnalytics;
}