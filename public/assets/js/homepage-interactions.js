/**
 * ROOTUIP Homepage Interactions
 * Premium interactions for conversion optimization
 */

// Header scroll effect
window.addEventListener('scroll', function() {
    const header = document.querySelector('.homepage-header');
    if (window.scrollY > 100) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// Intersection Observer for animations
const observeElements = () => {
    const options = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                
                // Special handling for stat counters
                if (entry.target.classList.contains('stat-value')) {
                    animateStatValue(entry.target);
                }
            }
        });
    }, options);

    // Observe all animatable elements
    document.querySelectorAll('.animate-fade-in, .animate-slide-up, .stat-value').forEach(el => {
        observer.observe(el);
    });
};

// Animate stat values
function animateStatValue(element) {
    const text = element.textContent;
    const hasPercentage = text.includes('%');
    const hasDollar = text.includes('$');
    const hasB = text.includes('B');
    const hasM = text.includes('M');
    const hasPlus = text.includes('+');
    
    // Extract numeric value
    let targetValue = parseFloat(text.replace(/[^0-9.]/g, ''));
    
    if (isNaN(targetValue)) return;
    
    let currentValue = 0;
    const increment = targetValue / 100;
    const duration = 2000;
    const stepTime = duration / 100;
    
    const timer = setInterval(() => {
        currentValue += increment;
        
        if (currentValue >= targetValue) {
            currentValue = targetValue;
            clearInterval(timer);
        }
        
        // Format the display value
        let displayValue = currentValue;
        
        if (hasPercentage) {
            displayValue = currentValue.toFixed(currentValue === targetValue && targetValue % 1 !== 0 ? 2 : 0) + '%';
        } else if (hasDollar) {
            if (hasB) {
                displayValue = '$' + currentValue.toFixed(0) + 'B';
            } else if (hasM) {
                displayValue = '$' + currentValue.toFixed(0) + 'M';
            } else {
                displayValue = '$' + currentValue.toFixed(0);
            }
        } else {
            displayValue = currentValue.toFixed(0);
        }
        
        if (hasPlus && currentValue === targetValue) {
            displayValue += '+';
        }
        
        element.textContent = displayValue;
    }, stepTime);
}

// Video background fallback
document.addEventListener('DOMContentLoaded', function() {
    const video = document.querySelector('.hero-video');
    if (video) {
        video.addEventListener('error', function() {
            // If video fails to load, use gradient background
            const heroBackground = document.querySelector('.hero-background');
            heroBackground.style.background = 'linear-gradient(135deg, #1E40AF 0%, #1557B0 100%)';
        });
    }
    
    // Initialize animations
    observeElements();
});

// Form validation and submission
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validateForm(form) {
    const inputs = form.querySelectorAll('[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            isValid = false;
            input.classList.add('error');
        } else {
            input.classList.remove('error');
        }
        
        if (input.type === 'email' && !validateEmail(input.value)) {
            isValid = false;
            input.classList.add('error');
        }
    });
    
    return isValid;
}

// ROI Calculator interactions
function calculateROI(containers, value, charges) {
    // Complex ROI calculation based on industry averages
    const avgSavingsRate = 0.87; // 87% reduction in D&D charges
    const operationalSavings = containers * 50; // $50 per container in operational efficiency
    const disputeSavings = charges * 0.15; // 15% of charges recovered through better dispute management
    
    const totalSavings = (charges * avgSavingsRate) + operationalSavings + disputeSavings;
    
    return {
        ddSavings: charges * avgSavingsRate,
        operationalSavings: operationalSavings,
        disputeSavings: disputeSavings,
        totalSavings: totalSavings,
        roi: ((totalSavings - 500000) / 500000) * 100 // Assuming $500K annual platform cost
    };
}

// Platform showcase interactions
let currentShowcase = 'dashboard';

window.switchShowcase = function(panel) {
    if (currentShowcase === panel) return;
    
    // Update tabs
    document.querySelectorAll('.showcase-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.closest('.showcase-tab').classList.add('active');
    
    // Hide current panel
    document.querySelector('.showcase-panel.active').classList.remove('active');
    
    // Show new panel with animation
    setTimeout(() => {
        const newPanel = document.getElementById(panel + '-panel');
        if (newPanel) {
            newPanel.classList.add('active');
        }
    }, 300);
    
    currentShowcase = panel;
};

// Lead scoring
function scoreLeadQuality(formData) {
    let score = 0;
    
    // Volume scoring
    const volume = parseInt(formData.get('volume') || '0');
    if (volume >= 25000) score += 40;
    else if (volume >= 10000) score += 30;
    else if (volume >= 5000) score += 20;
    else if (volume >= 1000) score += 10;
    
    // Company email domain scoring
    const email = formData.get('email') || '';
    const domain = email.split('@')[1] || '';
    if (!domain.includes('gmail') && !domain.includes('yahoo') && !domain.includes('hotmail')) {
        score += 20;
    }
    
    // Challenge scoring
    const challenge = formData.get('challenge') || '';
    if (challenge === 'dd-charges') score += 20;
    else if (challenge === 'visibility') score += 15;
    else if (challenge === 'manual') score += 10;
    
    return score;
}

// Analytics tracking
function trackEvent(category, action, label, value) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, {
            'event_category': category,
            'event_label': label,
            'value': value
        });
    }
}

// CTA click tracking
document.addEventListener('click', function(e) {
    if (e.target.matches('.btn')) {
        const label = e.target.textContent.trim();
        trackEvent('CTA', 'click', label);
    }
});

// Optimize page performance
if ('IntersectionObserver' in window) {
    // Lazy load images
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            }
        });
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// A/B testing framework placeholder
const experiments = {
    heroHeadline: {
        control: 'Prevent $14M+ Annual Losses',
        variant: 'Save $14M+ Every Year'
    },
    ctaText: {
        control: 'Calculate Your $25M+ Savings',
        variant: 'Get Your Savings Report'
    }
};

// Exit intent detection
let exitIntentShown = false;
document.addEventListener('mouseleave', function(e) {
    if (e.clientY <= 0 && !exitIntentShown) {
        exitIntentShown = true;
        // Could trigger exit-intent popup here
        trackEvent('Engagement', 'exit_intent', 'triggered');
    }
});

// Scroll depth tracking
let maxScroll = 0;
window.addEventListener('scroll', function() {
    const scrollPercentage = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    
    if (scrollPercentage > maxScroll) {
        maxScroll = scrollPercentage;
        
        // Track milestones
        if (maxScroll >= 25 && maxScroll < 26) {
            trackEvent('Engagement', 'scroll_depth', '25%');
        } else if (maxScroll >= 50 && maxScroll < 51) {
            trackEvent('Engagement', 'scroll_depth', '50%');
        } else if (maxScroll >= 75 && maxScroll < 76) {
            trackEvent('Engagement', 'scroll_depth', '75%');
        } else if (maxScroll >= 90) {
            trackEvent('Engagement', 'scroll_depth', '90%');
        }
    }
});

// Time on page tracking
let startTime = Date.now();
window.addEventListener('beforeunload', function() {
    const timeOnPage = Math.round((Date.now() - startTime) / 1000);
    trackEvent('Engagement', 'time_on_page', 'seconds', timeOnPage);
});