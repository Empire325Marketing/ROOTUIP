// UIP Interactive Scripts

// Loss Counter Animation
function animateLossCounter() {
    const counter = document.getElementById('lossCounter');
    if (!counter) return;
    
    let currentValue = 0;
    const lossPerSecond = 634;
    
    setInterval(() => {
        currentValue += lossPerSecond;
        counter.textContent = `$${currentValue.toLocaleString()}`;
    }, 1000);
}

// ROI Calculator
function initROICalculator() {
    const inputs = {
        vesselCount: document.getElementById('vesselCount'),
        containerVolume: document.getElementById('containerVolume'),
        ddCharges: document.getElementById('ddCharges'),
        manualHours: document.getElementById('manualHours')
    };
    
    const outputs = {
        annualSavings: document.getElementById('annualSavings'),
        roiTimeline: document.getElementById('roiTimeline'),
        fiveYearValue: document.getElementById('fiveYearValue')
    };
    
    function calculateROI() {
        const vessels = parseInt(inputs.vesselCount.value) || 10;
        const containers = parseInt(inputs.containerVolume.value) || 50000;
        const currentDD = parseInt(inputs.ddCharges.value) || 140000000;
        const hours = parseInt(inputs.manualHours.value) || 160;
        
        // Calculate savings
        const ddSavings = currentDD * 0.94; // 94% reduction
        const laborSavings = hours * 52 * 50 * 0.8; // 80% reduction in manual work
        const efficiencySavings = vessels * 2000000; // $2M per vessel in efficiency gains
        
        const totalAnnualSavings = ddSavings + laborSavings + efficiencySavings;
        const fiveYearTotal = totalAnnualSavings * 5;
        
        // Calculate ROI timeline based on investment size
        const investmentSize = vessels * 500000; // $500K per vessel
        const monthsToROI = Math.ceil(investmentSize / (totalAnnualSavings / 12));
        
        // Update display
        outputs.annualSavings.textContent = `$${Math.round(totalAnnualSavings / 1000000)}M`;
        outputs.roiTimeline.textContent = monthsToROI <= 1 ? '30 days' : `${monthsToROI} months`;
        outputs.fiveYearValue.textContent = `$${Math.round(fiveYearTotal / 1000000)}M`;
    }
    
    // Add event listeners
    Object.values(inputs).forEach(input => {
        if (input) {
            input.addEventListener('input', calculateROI);
        }
    });
    
    // Initial calculation
    calculateROI();
}

// Demo Form Handler
function initDemoForm() {
    const form = document.getElementById('demoForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);
        
        // Show success message (in production, this would send to backend)
        const button = form.querySelector('button[type="submit"]');
        const originalText = button.textContent;
        
        button.textContent = 'Booking Demo...';
        button.disabled = true;
        
        // Simulate API call
        setTimeout(() => {
            button.textContent = 'Demo Booked! ✓';
            button.style.background = 'var(--uip-teal-500)';
            
            // Reset after 3 seconds
            setTimeout(() => {
                button.textContent = originalText;
                button.disabled = false;
                button.style.background = '';
                form.reset();
            }, 3000);
        }, 1500);
    });
}

// Smooth Scroll
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 80; // Account for fixed navbar
                const targetPosition = target.offsetTop - offset;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Navbar Scroll Effect
function initNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.boxShadow = 'none';
        }
    });
}

// Animate on Scroll
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Add animation to elements
    const animatedElements = document.querySelectorAll(
        '.problem-card, .feature-card, .integration-card, .trust-item'
    );
    
    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Initialize all features
document.addEventListener('DOMContentLoaded', () => {
    animateLossCounter();
    initROICalculator();
    initDemoForm();
    initSmoothScroll();
    initNavbarScroll();
    initScrollAnimations();
    
    // Add hover effects to integration hub
    const connectionLines = document.querySelectorAll('.connection-line');
    const integrationCards = document.querySelectorAll('.integration-card');
    
    integrationCards.forEach((card, index) => {
        card.addEventListener('mouseenter', () => {
            if (connectionLines[index]) {
                connectionLines[index].style.background = 'var(--uip-teal-500)';
                connectionLines[index].style.opacity = '1';
            }
        });
        
        card.addEventListener('mouseleave', () => {
            if (connectionLines[index]) {
                connectionLines[index].style.background = 'var(--uip-blue-300)';
                connectionLines[index].style.opacity = '0.5';
            }
        });
    });
});