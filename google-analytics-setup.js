// Google Analytics 4 Implementation for ROOTUIP
// Comprehensive tracking setup for production deployment

const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Replace with actual GA4 Measurement ID

// Google Analytics 4 Configuration
const gtag_config = {
    // Basic Configuration
    measurement_id: GA_MEASUREMENT_ID,
    page_title: document.title,
    page_location: window.location.href,
    
    // Enhanced E-commerce Configuration
    currency: 'USD',
    country: 'US',
    
    // Custom Dimensions
    custom_map: {
        'custom_parameter_1': 'user_type',
        'custom_parameter_2': 'subscription_tier',
        'custom_parameter_3': 'company_size'
    },
    
    // Privacy Settings
    anonymize_ip: true,
    allow_google_signals: true,
    allow_ad_personalization_signals: false
};

// Enhanced Event Tracking Functions
const RootuipAnalytics = {
    
    // Initialize Google Analytics
    init() {
        // Load gtag script
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
        document.head.appendChild(script);
        
        // Initialize gtag
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', GA_MEASUREMENT_ID, gtag_config);
        
        // Set global gtag function
        window.gtag = gtag;
        
        console.log('ROOTUIP Analytics initialized');
        this.trackPageView();
    },
    
    // Page View Tracking
    trackPageView(page_path = null) {
        gtag('config', GA_MEASUREMENT_ID, {
            page_path: page_path || window.location.pathname
        });
        
        console.log('Page view tracked:', page_path || window.location.pathname);
    },
    
    // User Registration Tracking
    trackUserRegistration(user_data) {
        gtag('event', 'sign_up', {
            event_category: 'User',
            event_label: 'Registration',
            user_type: user_data.user_type || 'standard',
            company_size: user_data.company_size || 'unknown',
            value: 1
        });
        
        // Set user properties
        gtag('set', {
            user_id: user_data.user_id,
            user_properties: {
                user_type: user_data.user_type,
                registration_date: new Date().toISOString(),
                company_name: user_data.company_name
            }
        });
        
        console.log('User registration tracked:', user_data);
    },
    
    // Login Tracking
    trackUserLogin(user_id, user_type) {
        gtag('event', 'login', {
            event_category: 'User',
            event_label: 'Login',
            user_type: user_type,
            value: 1
        });
        
        gtag('set', {
            user_id: user_id
        });
        
        console.log('User login tracked:', user_id);
    },
    
    // ROI Calculator Usage
    trackROICalculation(calculation_data) {
        gtag('event', 'roi_calculation', {
            event_category: 'Lead Generation',
            event_label: 'ROI Calculator',
            containers_per_month: calculation_data.containers_per_month,
            current_cost: calculation_data.current_cost,
            projected_savings: calculation_data.projected_savings,
            savings_percentage: calculation_data.savings_percentage,
            value: calculation_data.projected_savings
        });
        
        console.log('ROI calculation tracked:', calculation_data);
    },
    
    // Lead Capture Tracking
    trackLeadCapture(lead_data) {
        gtag('event', 'generate_lead', {
            event_category: 'Lead Generation',
            event_label: 'Contact Form',
            company_size: lead_data.company_size,
            industry: lead_data.industry,
            lead_source: lead_data.source || 'website',
            value: 100 // Estimated lead value
        });
        
        // Enhanced E-commerce tracking for lead
        gtag('event', 'purchase', {
            transaction_id: lead_data.lead_id,
            value: 100,
            currency: 'USD',
            items: [{
                item_id: 'lead_generation',
                item_name: 'Sales Lead',
                category: 'Lead Generation',
                quantity: 1,
                price: 100
            }]
        });
        
        console.log('Lead capture tracked:', lead_data);
    },
    
    // Demo Booking Tracking
    trackDemoBooking(demo_data) {
        gtag('event', 'book_demo', {
            event_category: 'Demo',
            event_label: 'Demo Booking',
            demo_type: demo_data.demo_type,
            preferred_date: demo_data.preferred_date,
            company_size: demo_data.company_size,
            value: 200 // Estimated demo value
        });
        
        console.log('Demo booking tracked:', demo_data);
    },
    
    // Container Tracking Usage
    trackContainerSearch(search_data) {
        gtag('event', 'search', {
            event_category: 'Container Tracking',
            search_term: search_data.container_number,
            carrier: search_data.carrier,
            search_results: search_data.results_count
        });
        
        console.log('Container search tracked:', search_data);
    },
    
    // Feature Usage Tracking
    trackFeatureUsage(feature_name, feature_data = {}) {
        gtag('event', 'feature_usage', {
            event_category: 'Features',
            event_label: feature_name,
            feature_name: feature_name,
            ...feature_data
        });
        
        console.log('Feature usage tracked:', feature_name, feature_data);
    },
    
    // Error Tracking
    trackError(error_data) {
        gtag('event', 'exception', {
            event_category: 'Error',
            description: error_data.message,
            fatal: error_data.fatal || false,
            error_type: error_data.type,
            page_path: window.location.pathname
        });
        
        console.log('Error tracked:', error_data);
    },
    
    // Performance Tracking
    trackPerformance(timing_data) {
        gtag('event', 'timing_complete', {
            event_category: 'Performance',
            name: timing_data.name,
            value: timing_data.value,
            event_label: timing_data.label
        });
        
        console.log('Performance tracked:', timing_data);
    },
    
    // Subscription Tracking
    trackSubscription(subscription_data) {
        gtag('event', 'purchase', {
            event_category: 'Subscription',
            transaction_id: subscription_data.transaction_id,
            value: subscription_data.value,
            currency: subscription_data.currency || 'USD',
            items: [{
                item_id: subscription_data.plan_id,
                item_name: subscription_data.plan_name,
                category: 'Subscription',
                quantity: 1,
                price: subscription_data.value
            }]
        });
        
        console.log('Subscription tracked:', subscription_data);
    },
    
    // Custom Event Tracking
    trackCustomEvent(event_name, event_data) {
        gtag('event', event_name, {
            event_category: event_data.category || 'Custom',
            event_label: event_data.label,
            value: event_data.value,
            ...event_data.custom_parameters
        });
        
        console.log('Custom event tracked:', event_name, event_data);
    }
};

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    if (typeof GA_MEASUREMENT_ID !== 'undefined' && GA_MEASUREMENT_ID !== 'G-XXXXXXXXXX') {
        RootuipAnalytics.init();
    } else {
        console.warn('Google Analytics not initialized: Missing or invalid Measurement ID');
    }
});

// Enhanced form tracking
document.addEventListener('submit', function(e) {
    const form = e.target;
    const formId = form.id || form.className || 'unknown_form';
    
    // Track form submissions
    RootuipAnalytics.trackCustomEvent('form_submission', {
        category: 'Forms',
        label: formId,
        form_id: formId,
        page_path: window.location.pathname
    });
});

// Enhanced link tracking
document.addEventListener('click', function(e) {
    const link = e.target.closest('a');
    if (link) {
        const href = link.href;
        const text = link.textContent.trim();
        
        // Track external link clicks
        if (href && !href.includes(window.location.hostname)) {
            RootuipAnalytics.trackCustomEvent('external_link_click', {
                category: 'External Links',
                label: href,
                link_text: text,
                destination: href
            });
        }
        
        // Track CTA button clicks
        if (link.classList.contains('cta-button') || link.classList.contains('btn-primary')) {
            RootuipAnalytics.trackCustomEvent('cta_click', {
                category: 'CTA',
                label: text,
                button_text: text,
                page_path: window.location.pathname
            });
        }
    }
});

// Performance monitoring
window.addEventListener('load', function() {
    setTimeout(() => {
        const perfData = performance.timing;
        const loadTime = perfData.loadEventEnd - perfData.navigationStart;
        
        RootuipAnalytics.trackPerformance({
            name: 'page_load_time',
            value: loadTime,
            label: window.location.pathname
        });
    }, 1000);
});

// Error tracking
window.addEventListener('error', function(e) {
    RootuipAnalytics.trackError({
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        type: 'javascript_error',
        fatal: false
    });
});

// Scroll depth tracking
let maxScrollDepth = 0;
window.addEventListener('scroll', function() {
    const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
    
    if (scrollPercent > maxScrollDepth && scrollPercent % 25 === 0) {
        maxScrollDepth = scrollPercent;
        RootuipAnalytics.trackCustomEvent('scroll_depth', {
            category: 'Engagement',
            label: `${scrollPercent}%`,
            value: scrollPercent
        });
    }
});

// Session duration tracking
let sessionStartTime = Date.now();
window.addEventListener('beforeunload', function() {
    const sessionDuration = Date.now() - sessionStartTime;
    RootuipAnalytics.trackCustomEvent('session_duration', {
        category: 'Engagement',
        label: 'Session End',
        value: Math.round(sessionDuration / 1000) // in seconds
    });
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RootuipAnalytics;
} else {
    window.RootuipAnalytics = RootuipAnalytics;
}

console.log('ROOTUIP Google Analytics setup loaded successfully');