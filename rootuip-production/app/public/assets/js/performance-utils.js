/**
 * ROOTUIP Performance Utilities
 * Optimization helpers for production performance
 */

const PerformanceUtils = {
    // Lazy loading for images
    initLazyLoading() {
        if ('IntersectionObserver' in window) {
            const lazyImages = document.querySelectorAll('.lazy-load');
            
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.classList.remove('lazy-load');
                            img.classList.add('lazy-loaded');
                        }
                        
                        if (img.dataset.srcset) {
                            img.srcset = img.dataset.srcset;
                        }
                        
                        observer.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });
            
            lazyImages.forEach(img => imageObserver.observe(img));
        } else {
            // Fallback for older browsers
            const lazyImages = document.querySelectorAll('.lazy-load');
            lazyImages.forEach(img => {
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                }
            });
        }
    },
    
    // Debounce function for performance
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle function for scroll events
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Virtual scrolling for large lists
    virtualScroll(container, items, itemHeight, renderItem) {
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        
        const startIndex = Math.floor(scrollTop / itemHeight);
        const endIndex = Math.ceil((scrollTop + containerHeight) / itemHeight);
        
        const visibleItems = items.slice(startIndex, endIndex + 1);
        
        // Create spacer for items above
        const spacerHeight = startIndex * itemHeight;
        const spacer = document.createElement('div');
        spacer.style.height = `${spacerHeight}px`;
        
        // Clear container
        container.innerHTML = '';
        container.appendChild(spacer);
        
        // Render visible items
        visibleItems.forEach((item, index) => {
            const element = renderItem(item, startIndex + index);
            container.appendChild(element);
        });
        
        // Create spacer for items below
        const remainingHeight = (items.length - endIndex - 1) * itemHeight;
        if (remainingHeight > 0) {
            const bottomSpacer = document.createElement('div');
            bottomSpacer.style.height = `${remainingHeight}px`;
            container.appendChild(bottomSpacer);
        }
    },
    
    // Request idle callback polyfill
    requestIdleCallback(callback, options) {
        if ('requestIdleCallback' in window) {
            return window.requestIdleCallback(callback, options);
        }
        
        // Polyfill using setTimeout
        const start = Date.now();
        return setTimeout(() => {
            callback({
                didTimeout: false,
                timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
            });
        }, 1);
    },
    
    // Batch DOM updates
    batchUpdate(updates) {
        requestAnimationFrame(() => {
            updates.forEach(update => update());
        });
    },
    
    // Cache API responses
    cache: {
        storage: new Map(),
        
        set(key, data, ttl = 300000) { // 5 minutes default
            this.storage.set(key, {
                data,
                timestamp: Date.now(),
                ttl
            });
        },
        
        get(key) {
            const cached = this.storage.get(key);
            if (!cached) return null;
            
            if (Date.now() - cached.timestamp > cached.ttl) {
                this.storage.delete(key);
                return null;
            }
            
            return cached.data;
        },
        
        clear() {
            this.storage.clear();
        },
        
        prune() {
            const now = Date.now();
            for (const [key, value] of this.storage.entries()) {
                if (now - value.timestamp > value.ttl) {
                    this.storage.delete(key);
                }
            }
        }
    },
    
    // Preload critical resources
    preloadResources(resources) {
        resources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource.href;
            link.as = resource.type;
            
            if (resource.type === 'font') {
                link.crossOrigin = 'anonymous';
            }
            
            document.head.appendChild(link);
        });
    },
    
    // Monitor performance metrics
    measurePerformance() {
        if ('performance' in window && 'PerformanceObserver' in window) {
            // First Contentful Paint
            const paintObserver = new PerformanceObserver(list => {
                for (const entry of list.getEntries()) {
                    console.log(`${entry.name}: ${entry.startTime}ms`);
                    
                    // Send to analytics
                    if (window.gtag) {
                        gtag('event', 'performance', {
                            event_category: 'Web Vitals',
                            event_label: entry.name,
                            value: Math.round(entry.startTime)
                        });
                    }
                }
            });
            
            paintObserver.observe({ entryTypes: ['paint'] });
            
            // Largest Contentful Paint
            const lcpObserver = new PerformanceObserver(list => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                console.log(`LCP: ${lastEntry.startTime}ms`);
            });
            
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            
            // First Input Delay
            const fidObserver = new PerformanceObserver(list => {
                for (const entry of list.getEntries()) {
                    const delay = entry.processingStart - entry.startTime;
                    console.log(`FID: ${delay}ms`);
                }
            });
            
            fidObserver.observe({ entryTypes: ['first-input'] });
        }
    },
    
    // Progressive enhancement check
    checkFeatureSupport() {
        const features = {
            intersectionObserver: 'IntersectionObserver' in window,
            webSocket: 'WebSocket' in window,
            serviceWorker: 'serviceWorker' in navigator,
            webGL: (() => {
                try {
                    const canvas = document.createElement('canvas');
                    return !!(window.WebGLRenderingContext && 
                        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
                } catch(e) {
                    return false;
                }
            })(),
            localStorage: (() => {
                try {
                    localStorage.setItem('test', 'test');
                    localStorage.removeItem('test');
                    return true;
                } catch(e) {
                    return false;
                }
            })(),
            touch: 'ontouchstart' in window,
            geolocation: 'geolocation' in navigator
        };
        
        return features;
    },
    
    // Optimize animations
    optimizeAnimations() {
        // Pause animations when tab is not visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                document.querySelectorAll('.animated').forEach(el => {
                    el.style.animationPlayState = 'paused';
                });
            } else {
                document.querySelectorAll('.animated').forEach(el => {
                    el.style.animationPlayState = 'running';
                });
            }
        });
        
        // Use will-change for heavy animations
        document.querySelectorAll('.heavy-animation').forEach(el => {
            el.style.willChange = 'transform';
            
            // Remove will-change after animation
            el.addEventListener('animationend', () => {
                el.style.willChange = 'auto';
            }, { once: true });
        });
    },
    
    // Initialize all optimizations
    init() {
        // Start performance monitoring
        this.measurePerformance();
        
        // Initialize lazy loading
        this.initLazyLoading();
        
        // Optimize animations
        this.optimizeAnimations();
        
        // Prune cache periodically
        setInterval(() => this.cache.prune(), 60000); // Every minute
        
        // Check feature support
        const features = this.checkFeatureSupport();
        document.documentElement.classList.add(
            ...Object.entries(features)
                .filter(([_, supported]) => supported)
                .map(([feature]) => `supports-${feature}`)
        );
        
        // Preload critical resources
        this.preloadResources([
            { href: '/assets/fonts/inter-var.woff2', type: 'font' },
            { href: '/assets/css/rootuip-design-system.css', type: 'style' },
            { href: '/assets/js/realtime-client.js', type: 'script' }
        ]);
        
        console.log('Performance optimizations initialized');
    }
};

// Export for use
window.PerformanceUtils = PerformanceUtils;