// Homepage V2 JavaScript - Optimized for Performance

// Utility: Debounce function for performance
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Loss Counter Animation
function initLossCounter() {
    const counter = document.getElementById('lossCounter');
    if (!counter) return;
    
    let currentValue = 0;
    const lossPerSecond = 634;
    const startTime = Date.now();
    
    function updateCounter() {
        const elapsed = (Date.now() - startTime) / 1000;
        currentValue = Math.floor(elapsed * lossPerSecond);
        counter.textContent = `$${currentValue.toLocaleString()}`;
        requestAnimationFrame(updateCounter);
    }
    
    updateCounter();
}

// Number Counter Animation
function animateCounters() {
    const counters = document.querySelectorAll('.counter');
    
    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const startCounting = (counter) => {
        const target = parseFloat(counter.dataset.target);
        const decimals = parseInt(counter.dataset.decimals) || 0;
        const duration = 2000;
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;
        
        const updateCounter = () => {
            current += increment;
            if (current < target) {
                counter.textContent = current.toFixed(decimals).toLocaleString();
                requestAnimationFrame(updateCounter);
            } else {
                counter.textContent = target.toFixed(decimals).toLocaleString();
            }
        };
        
        updateCounter();
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                entry.target.classList.add('counted');
                startCounting(entry.target);
            }
        });
    }, observerOptions);
    
    counters.forEach(counter => observer.observe(counter));
}

// Parallax Scrolling
function initParallax() {
    const parallaxElements = document.querySelectorAll('.hero-bg, .particle');
    
    window.addEventListener('scroll', debounce(() => {
        const scrolled = window.pageYOffset;
        
        parallaxElements.forEach(element => {
            const speed = element.dataset.speed || 0.5;
            const yPos = -(scrolled * speed);
            element.style.transform = `translateY(${yPos}px)`;
        });
    }, 10));
}

// Navbar Scroll Effect
function initNavbarScroll() {
    const navbar = document.getElementById('navbar');
    let lastScroll = 0;
    
    window.addEventListener('scroll', debounce(() => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        
        // Hide/show navbar on scroll
        if (currentScroll > lastScroll && currentScroll > 300) {
            navbar.style.transform = 'translateY(-100%)';
        } else {
            navbar.style.transform = 'translateY(0)';
        }
        
        lastScroll = currentScroll;
    }, 10));
}

// Container Visualization Animation
function initContainerAnimation() {
    const containers = document.querySelectorAll('.ship-container');
    
    containers.forEach(container => {
        container.addEventListener('mouseenter', () => {
            container.style.transform = 'rotateY(180deg)';
        });
        
        container.addEventListener('mouseleave', () => {
            container.style.transform = 'rotateY(0)';
        });
    });
}

// Integration Hub Connections
function initIntegrationHub() {
    const integrationTypes = document.querySelectorAll('.integration-type');
    const connectionLines = document.querySelectorAll('.connection-line');
    
    integrationTypes.forEach((type, index) => {
        type.addEventListener('mouseenter', () => {
            connectionLines[index].style.opacity = '1';
            connectionLines[index].style.strokeWidth = '3';
        });
        
        type.addEventListener('mouseleave', () => {
            connectionLines[index].style.opacity = '0';
            connectionLines[index].style.strokeWidth = '2';
        });
    });
}

// AOS-like scroll animations
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('[data-aos]');
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = entry.target.dataset.aosDelay || 0;
                setTimeout(() => {
                    entry.target.classList.add('aos-animate');
                }, delay);
            }
        });
    }, observerOptions);
    
    animatedElements.forEach(element => observer.observe(element));
}

// Demo Video Modal
function initDemoVideo() {
    const playBtn = document.querySelector('.play-demo-btn');
    if (!playBtn) return;
    
    playBtn.addEventListener('click', () => {
        // In production, this would open a video modal
        console.log('Opening demo video...');
        // You can integrate with YouTube, Vimeo, or custom video player
    });
}

// Exit Intent Popup
function initExitIntent() {
    const popup = document.getElementById('exitPopup');
    const closeBtn = popup.querySelector('.popup-close');
    const overlay = popup.querySelector('.popup-overlay');
    const form = popup.querySelector('.popup-form');
    
    let shown = false;
    
    // Exit intent detection
    document.addEventListener('mouseleave', (e) => {
        if (e.clientY <= 0 && !shown && !localStorage.getItem('exitPopupShown')) {
            popup.classList.add('show');
            shown = true;
            localStorage.setItem('exitPopupShown', 'true');
        }
    });
    
    // Close popup
    const closePopup = () => {
        popup.classList.remove('show');
    };
    
    closeBtn.addEventListener('click', closePopup);
    overlay.addEventListener('click', closePopup);
    
    // Form submission
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = form.querySelector('input[type="email"]').value;
        console.log('Case study requested for:', email);
        // In production, send to your backend
        closePopup();
        // Show success message
    });
}

// Live Chat Widget
function initLiveChat() {
    const chatButton = document.querySelector('.chat-button');
    
    chatButton.addEventListener('click', () => {
        // In production, integrate with Intercom, Drift, or custom chat
        console.log('Opening live chat...');
    });
}

// Smooth Scrolling
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            
            if (target) {
                const offset = 80;
                const targetPosition = target.offsetTop - offset;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Mobile Menu
function initMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (!toggle) return;
    
    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        navLinks.classList.toggle('show');
    });
}

// Performance: Lazy Load Images
function initLazyLoad() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    if ('loading' in HTMLImageElement.prototype) {
        // Browser supports native lazy loading
        return;
    }
    
    // Fallback for browsers that don't support native lazy loading
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src || img.src;
                imageObserver.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// Waste Visualization Hover Effects
function initWasteVisualization() {
    const wasteFills = document.querySelectorAll('.waste-fill');
    
    wasteFills.forEach(fill => {
        fill.addEventListener('mouseenter', () => {
            fill.style.filter = 'brightness(1.2) saturate(1.2)';
        });
        
        fill.addEventListener('mouseleave', () => {
            fill.style.filter = 'brightness(1) saturate(1)';
        });
    });
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Core functionality
    initLossCounter();
    animateCounters();
    initParallax();
    initNavbarScroll();
    initSmoothScroll();
    
    // Interactive elements
    initContainerAnimation();
    initIntegrationHub();
    initScrollAnimations();
    initWasteVisualization();
    
    // Conversion features
    initDemoVideo();
    initExitIntent();
    initLiveChat();
    
    // Mobile
    initMobileMenu();
    
    // Performance
    initLazyLoad();
    
    // Additional hover effects
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('mouseenter', (e) => {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            e.target.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    });
    
    // Add loading="eager" to above-the-fold images for better LCP
    const heroImages = document.querySelectorAll('.hero img, .nav-logo');
    heroImages.forEach(img => img.loading = 'eager');
});

// Performance monitoring
if ('PerformanceObserver' in window) {
    // Log Core Web Vitals
    try {
        const po = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                console.log(`${entry.name}: ${entry.value}ms`);
            }
        });
        po.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    } catch (e) {
        // Silently fail if not supported
    }
}