// Google Analytics 4 (GA4) Setup for ROOTUIP
// Replace GA_MEASUREMENT_ID with your actual GA4 measurement ID

// Global site tag (gtag.js) - Google Analytics
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());

// Configure GA4 with enhanced measurement
gtag('config', 'GA_MEASUREMENT_ID', {
    page_title: document.title,
    page_location: window.location.href,
    page_path: window.location.pathname,
    send_page_view: true,
    
    // Enhanced ecommerce settings
    currency: 'USD',
    
    // Custom dimensions
    custom_map: {
        'dimension1': 'user_type',
        'dimension2': 'company_id',
        'dimension3': 'shipment_count',
        'dimension4': 'integration_status'
    },
    
    // User properties
    user_properties: {
        user_type: getUserType(),
        company_size: getCompanySize(),
        industry: getIndustry()
    }
});

// Track custom events for ROOTUIP
const RootUIAnalytics = {
    // Track user login
    trackLogin: function(method) {
        gtag('event', 'login', {
            method: method, // 'email', 'sso', 'mfa'
            event_category: 'engagement',
            event_label: 'user_authentication'
        });
    },
    
    // Track shipment searches
    trackShipmentSearch: function(searchType, resultsCount) {
        gtag('event', 'search', {
            search_term: searchType,
            results_count: resultsCount,
            event_category: 'shipment_tracking',
            event_label: 'search_performed'
        });
    },
    
    // Track document uploads
    trackDocumentUpload: function(docType, fileSize) {
        gtag('event', 'file_upload', {
            file_type: docType,
            file_size: fileSize,
            event_category: 'document_management',
            event_label: 'document_uploaded'
        });
    },
    
    // Track API usage
    trackAPICall: function(endpoint, responseTime) {
        gtag('event', 'api_call', {
            api_endpoint: endpoint,
            response_time: responseTime,
            event_category: 'api_usage',
            event_label: endpoint
        });
    },
    
    // Track feature usage
    trackFeatureUsage: function(featureName, action) {
        gtag('event', 'feature_usage', {
            feature_name: featureName,
            action: action,
            event_category: 'product_engagement',
            event_label: featureName
        });
    },
    
    // Track conversion events
    trackConversion: function(conversionType, value) {
        gtag('event', 'conversion', {
            conversion_type: conversionType,
            value: value,
            currency: 'USD',
            event_category: 'conversions',
            event_label: conversionType
        });
    },
    
    // Track page timing
    trackPageTiming: function() {
        if (window.performance && window.performance.timing) {
            const timing = window.performance.timing;
            const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
            const domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
            
            gtag('event', 'timing_complete', {
                name: 'load',
                value: pageLoadTime,
                event_category: 'performance',
                event_label: 'page_load'
            });
            
            gtag('event', 'timing_complete', {
                name: 'dom_ready',
                value: domReadyTime,
                event_category: 'performance',
                event_label: 'dom_ready'
            });
        }
    },
    
    // Track errors
    trackError: function(errorMessage, errorSource) {
        gtag('event', 'exception', {
            description: errorMessage,
            fatal: false,
            error_source: errorSource
        });
    },
    
    // Enhanced ecommerce tracking
    trackPurchase: function(transactionData) {
        gtag('event', 'purchase', {
            transaction_id: transactionData.id,
            value: transactionData.total,
            currency: 'USD',
            shipping: transactionData.shipping || 0,
            items: transactionData.items.map(item => ({
                item_id: item.id,
                item_name: item.name,
                item_category: item.category,
                quantity: item.quantity,
                price: item.price
            }))
        });
    },
    
    // Track user engagement
    trackEngagement: function(engagementType, duration) {
        gtag('event', 'user_engagement', {
            engagement_type: engagementType,
            engagement_time_msec: duration,
            event_category: 'engagement',
            event_label: engagementType
        });
    }
};

// Helper functions
function getUserType() {
    // Logic to determine user type
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role || 'anonymous';
}

function getCompanySize() {
    // Logic to determine company size
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.companySize || 'unknown';
}

function getIndustry() {
    // Logic to determine industry
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.industry || 'shipping';
}

// Auto-track page timing when page loads
window.addEventListener('load', function() {
    setTimeout(function() {
        RootUIAnalytics.trackPageTiming();
    }, 0);
});

// Track JavaScript errors
window.addEventListener('error', function(e) {
    RootUIAnalytics.trackError(e.message, e.filename);
});

// Track single page application route changes
let previousPath = window.location.pathname;
const trackRouteChange = function() {
    if (window.location.pathname !== previousPath) {
        gtag('config', 'GA_MEASUREMENT_ID', {
            page_path: window.location.pathname,
            page_title: document.title
        });
        previousPath = window.location.pathname;
    }
};

// Listen for route changes
window.addEventListener('popstate', trackRouteChange);

// Override pushState and replaceState
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
    originalPushState.apply(history, arguments);
    trackRouteChange();
};

history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    trackRouteChange();
};

// Export for use in other modules
window.RootUIAnalytics = RootUIAnalytics;