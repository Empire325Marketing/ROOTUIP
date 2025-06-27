// Lead Tracking and Analytics
class LeadTracker {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.pageViews = [];
        this.interactions = [];
        this.startTime = new Date();
        
        // Initialize tracking
        this.trackPageView();
        this.setupEventListeners();
        this.trackTimeOnPage();
    }
    
    generateSessionId() {
        return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    trackPageView() {
        const pageData = {
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toISOString(),
            referrer: document.referrer,
            source: this.getTrafficSource()
        };
        
        this.pageViews.push(pageData);
        
        // Send to analytics
        if (typeof gtag !== 'undefined') {
            gtag('event', 'page_view', {
                page_title: pageData.title,
                page_location: pageData.url,
                page_referrer: pageData.referrer,
                traffic_source: pageData.source
            });
        }
        
        // Track in custom analytics
        this.sendToAnalytics('page_view', pageData);
    }
    
    setupEventListeners() {
        // Track form field focus
        document.addEventListener('focusin', (e) => {
            if (e.target.matches('input, textarea, select')) {
                this.trackInteraction('field_focus', {
                    field_name: e.target.name,
                    field_type: e.target.type
                });
            }
        });
        
        // Track form field changes
        document.addEventListener('change', (e) => {
            if (e.target.matches('input, textarea, select')) {
                this.trackInteraction('field_change', {
                    field_name: e.target.name,
                    field_type: e.target.type,
                    has_value: !!e.target.value
                });
            }
        });
        
        // Track clicks
        document.addEventListener('click', (e) => {
            const target = e.target.closest('a, button, .cta-button');
            if (target) {
                this.trackInteraction('click', {
                    element: target.tagName,
                    text: target.textContent.trim().substring(0, 50),
                    href: target.href,
                    class: target.className
                });
            }
        });
        
        // Track scroll depth
        let maxScroll = 0;
        window.addEventListener('scroll', () => {
            const scrollPercentage = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight * 100;
            if (scrollPercentage > maxScroll) {
                maxScroll = scrollPercentage;
                
                // Track milestones
                if (maxScroll >= 25 && !this.scrollMilestones?.['25']) {
                    this.trackScrollMilestone(25);
                }
                if (maxScroll >= 50 && !this.scrollMilestones?.['50']) {
                    this.trackScrollMilestone(50);
                }
                if (maxScroll >= 75 && !this.scrollMilestones?.['75']) {
                    this.trackScrollMilestone(75);
                }
                if (maxScroll >= 90 && !this.scrollMilestones?.['90']) {
                    this.trackScrollMilestone(90);
                }
            }
        });
        
        // Track form abandonment
        window.addEventListener('beforeunload', () => {
            this.trackFormAbandonment();
        });
    }
    
    trackInteraction(type, data) {
        const interaction = {
            type: type,
            data: data,
            timestamp: new Date().toISOString(),
            time_on_page: Math.round((new Date() - this.startTime) / 1000)
        };
        
        this.interactions.push(interaction);
        
        // Send to analytics
        this.sendToAnalytics('interaction', interaction);
    }
    
    trackScrollMilestone(percentage) {
        this.scrollMilestones = this.scrollMilestones || {};
        this.scrollMilestones[percentage] = true;
        
        this.trackInteraction('scroll_milestone', {
            percentage: percentage,
            time_to_scroll: Math.round((new Date() - this.startTime) / 1000)
        });
        
        if (typeof gtag !== 'undefined') {
            gtag('event', 'scroll', {
                'event_category': 'Engagement',
                'event_label': `${percentage}%`,
                'value': percentage
            });
        }
    }
    
    trackFormAbandonment() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            const filledFields = form.querySelectorAll('input[value]:not([value=""]), textarea:not(:empty), select option:checked:not([value=""])');
            
            if (filledFields.length > 0 && !form.dataset.submitted) {
                const abandonmentData = {
                    form_id: form.id,
                    filled_fields: filledFields.length,
                    total_fields: form.querySelectorAll('input, textarea, select').length,
                    time_spent: Math.round((new Date() - this.startTime) / 1000),
                    last_field: this.getLastInteractedField()
                };
                
                this.sendToAnalytics('form_abandonment', abandonmentData);
            }
        });
    }
    
    trackTimeOnPage() {
        // Send time on page every 30 seconds
        setInterval(() => {
            const timeSpent = Math.round((new Date() - this.startTime) / 1000);
            
            this.sendToAnalytics('time_on_page', {
                seconds: timeSpent,
                page: window.location.pathname,
                engaged: document.hasFocus()
            });
        }, 30000);
    }
    
    getTrafficSource() {
        const urlParams = new URLSearchParams(window.location.search);
        const referrer = document.referrer;
        
        // Check UTM parameters
        if (urlParams.get('utm_source')) {
            return {
                type: 'campaign',
                source: urlParams.get('utm_source'),
                medium: urlParams.get('utm_medium'),
                campaign: urlParams.get('utm_campaign')
            };
        }
        
        // Check referrer
        if (!referrer) {
            return { type: 'direct' };
        }
        
        // Parse referrer domain
        try {
            const referrerDomain = new URL(referrer).hostname;
            
            // Search engines
            if (referrerDomain.includes('google.')) return { type: 'organic', source: 'google' };
            if (referrerDomain.includes('bing.')) return { type: 'organic', source: 'bing' };
            if (referrerDomain.includes('yahoo.')) return { type: 'organic', source: 'yahoo' };
            
            // Social media
            if (referrerDomain.includes('facebook.')) return { type: 'social', source: 'facebook' };
            if (referrerDomain.includes('linkedin.')) return { type: 'social', source: 'linkedin' };
            if (referrerDomain.includes('twitter.')) return { type: 'social', source: 'twitter' };
            
            // Other referrers
            return { type: 'referral', source: referrerDomain };
            
        } catch (e) {
            return { type: 'other' };
        }
    }
    
    getLastInteractedField() {
        const fieldInteractions = this.interactions.filter(i => 
            i.type === 'field_focus' || i.type === 'field_change'
        );
        
        if (fieldInteractions.length > 0) {
            return fieldInteractions[fieldInteractions.length - 1].data.field_name;
        }
        
        return null;
    }
    
    sendToAnalytics(eventType, data) {
        // Send to custom analytics endpoint
        const payload = {
            session_id: this.sessionId,
            event_type: eventType,
            data: data,
            timestamp: new Date().toISOString(),
            page: window.location.pathname,
            user_agent: navigator.userAgent
        };
        
        // Use beacon API for reliability
        if (navigator.sendBeacon) {
            navigator.sendBeacon('/api/analytics/track', JSON.stringify(payload));
        } else {
            // Fallback to fetch
            fetch('/api/analytics/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                keepalive: true
            }).catch(err => console.error('Analytics error:', err));
        }
    }
    
    // Public methods for custom tracking
    trackCustomEvent(eventName, eventData) {
        this.trackInteraction('custom', {
            event_name: eventName,
            ...eventData
        });
        
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, eventData);
        }
    }
    
    identifyLead(email, additionalData = {}) {
        const leadData = {
            email: email,
            session_id: this.sessionId,
            identified_at: new Date().toISOString(),
            page_views: this.pageViews.length,
            interactions: this.interactions.length,
            time_spent: Math.round((new Date() - this.startTime) / 1000),
            ...additionalData
        };
        
        this.sendToAnalytics('lead_identified', leadData);
        
        // Store for future tracking
        if (window.localStorage) {
            localStorage.setItem('lead_email', email);
        }
    }
}

// Initialize lead tracker
const leadTracker = new LeadTracker();

// Export for use in forms
window.leadTracker = leadTracker;