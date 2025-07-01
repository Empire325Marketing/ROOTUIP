/**
 * ROOTUIP Client-Side Performance Tracker
 * Tracks page load times, Core Web Vitals, and sends metrics to monitoring service
 */

(function() {
    'use strict';

    const BEACON_URL = window.PERF_BEACON_URL || '/beacon';
    const SAMPLE_RATE = window.PERF_SAMPLE_RATE || 1.0; // 100% sampling by default

    class PerformanceTracker {
        constructor() {
            this.metrics = {
                navigation: {},
                paint: {},
                vitals: {},
                resources: []
            };
            
            this.observers = {
                lcp: null,
                fid: null,
                cls: null
            };

            this.init();
        }

        init() {
            // Check if we should track this session
            if (Math.random() > SAMPLE_RATE) return;

            // Wait for page load
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.trackMetrics());
                window.addEventListener('load', () => this.trackLoadMetrics());
            } else {
                this.trackMetrics();
                this.trackLoadMetrics();
            }

            // Track Core Web Vitals
            this.trackWebVitals();

            // Track errors
            this.trackErrors();

            // Send metrics before unload
            window.addEventListener('beforeunload', () => this.sendMetrics());
        }

        trackMetrics() {
            // Navigation timing
            if (window.performance && performance.timing) {
                const timing = performance.timing;
                const navigation = performance.navigation;

                this.metrics.navigation = {
                    // Page load phases
                    dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
                    tcpConnection: timing.connectEnd - timing.connectStart,
                    request: timing.responseStart - timing.requestStart,
                    response: timing.responseEnd - timing.responseStart,
                    domProcessing: timing.domComplete - timing.domLoading,
                    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                    loadComplete: timing.loadEventEnd - timing.navigationStart,
                    
                    // Key metrics
                    firstByte: timing.responseStart - timing.navigationStart,
                    domInteractive: timing.domInteractive - timing.navigationStart,
                    
                    // Navigation type
                    type: navigation.type, // 0: navigate, 1: reload, 2: back/forward
                    redirectCount: navigation.redirectCount
                };
            }

            // Paint timing
            if (window.performance && performance.getEntriesByType) {
                const paintEntries = performance.getEntriesByType('paint');
                paintEntries.forEach(entry => {
                    this.metrics.paint[entry.name] = entry.startTime;
                });
            }

            // Resource timing (sample top 10 slowest)
            if (window.performance && performance.getEntriesByType) {
                const resources = performance.getEntriesByType('resource');
                this.metrics.resources = resources
                    .map(resource => ({
                        name: resource.name,
                        type: resource.initiatorType,
                        duration: resource.duration,
                        size: resource.transferSize || 0,
                        protocol: resource.nextHopProtocol
                    }))
                    .sort((a, b) => b.duration - a.duration)
                    .slice(0, 10);
            }
        }

        trackLoadMetrics() {
            // Additional metrics after load
            if (window.performance && performance.timing) {
                const timing = performance.timing;
                this.metrics.navigation.totalPageLoad = timing.loadEventEnd - timing.navigationStart;
            }

            // Memory usage (if available)
            if (performance.memory) {
                this.metrics.memory = {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                };
            }
        }

        trackWebVitals() {
            // Largest Contentful Paint (LCP)
            try {
                this.observers.lcp = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    this.metrics.vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
                });
                this.observers.lcp.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {
                console.warn('LCP tracking not supported');
            }

            // First Input Delay (FID)
            try {
                this.observers.fid = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const firstEntry = entries[0];
                    this.metrics.vitals.fid = firstEntry.processingStart - firstEntry.startTime;
                });
                this.observers.fid.observe({ entryTypes: ['first-input'] });
            } catch (e) {
                console.warn('FID tracking not supported');
            }

            // Cumulative Layout Shift (CLS)
            try {
                let clsValue = 0;
                let clsEntries = [];
                let sessionValue = 0;
                let sessionEntries = [];

                this.observers.cls = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        // Only count if the layout shift doesn't have user input
                        if (!entry.hadRecentInput) {
                            const firstSessionEntry = sessionEntries[0];
                            const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

                            // If the entry is within 1 second of the previous entry and
                            // within 5 seconds of the first entry in the session,
                            // add to the current session. Otherwise, start a new session.
                            if (sessionValue &&
                                entry.startTime - lastSessionEntry.startTime < 1000 &&
                                entry.startTime - firstSessionEntry.startTime < 5000) {
                                sessionValue += entry.value;
                                sessionEntries.push(entry);
                            } else {
                                sessionValue = entry.value;
                                sessionEntries = [entry];
                            }

                            // If the current session value is larger than the
                            // current CLS value, update CLS and the entries.
                            if (sessionValue > clsValue) {
                                clsValue = sessionValue;
                                clsEntries = sessionEntries;
                                this.metrics.vitals.cls = clsValue;
                            }
                        }
                    }
                });
                this.observers.cls.observe({ entryTypes: ['layout-shift'] });
            } catch (e) {
                console.warn('CLS tracking not supported');
            }

            // Time to Interactive (approximation)
            this.calculateTTI();

            // Total Blocking Time (TBT)
            this.calculateTBT();
        }

        calculateTTI() {
            // Simplified TTI calculation
            if (window.performance && performance.timing) {
                const timing = performance.timing;
                const interactive = timing.domInteractive - timing.navigationStart;
                
                // Check for long tasks after interactive
                if (window.PerformanceObserver) {
                    let lastLongTask = interactive;
                    
                    try {
                        const observer = new PerformanceObserver((list) => {
                            for (const entry of list.getEntries()) {
                                if (entry.duration > 50) {
                                    lastLongTask = Math.max(lastLongTask, entry.startTime + entry.duration);
                                }
                            }
                        });
                        observer.observe({ entryTypes: ['longtask'] });
                        
                        // Estimate TTI as 5 seconds after last long task
                        setTimeout(() => {
                            this.metrics.vitals.tti = lastLongTask + 5000;
                            observer.disconnect();
                        }, 10000);
                    } catch (e) {
                        this.metrics.vitals.tti = interactive;
                    }
                } else {
                    this.metrics.vitals.tti = interactive;
                }
            }
        }

        calculateTBT() {
            // Total Blocking Time (between FCP and TTI)
            if (window.PerformanceObserver) {
                let totalBlockingTime = 0;
                const fcp = this.metrics.paint['first-contentful-paint'] || 0;
                
                try {
                    const observer = new PerformanceObserver((list) => {
                        for (const entry of list.getEntries()) {
                            if (entry.startTime > fcp && entry.duration > 50) {
                                totalBlockingTime += entry.duration - 50;
                            }
                        }
                        this.metrics.vitals.tbt = totalBlockingTime;
                    });
                    observer.observe({ entryTypes: ['longtask'] });
                    
                    // Stop observing after 10 seconds
                    setTimeout(() => observer.disconnect(), 10000);
                } catch (e) {
                    console.warn('TBT tracking not supported');
                }
            }
        }

        trackErrors() {
            // JavaScript errors
            window.addEventListener('error', (event) => {
                this.sendBeacon('error', {
                    message: event.message,
                    url: event.filename,
                    line: event.lineno,
                    column: event.colno,
                    stack: event.error?.stack,
                    type: 'javascript',
                    severity: 'error',
                    userAgent: navigator.userAgent,
                    timestamp: Date.now()
                });
            });

            // Promise rejections
            window.addEventListener('unhandledrejection', (event) => {
                this.sendBeacon('error', {
                    message: event.reason?.message || event.reason,
                    stack: event.reason?.stack,
                    type: 'unhandledRejection',
                    severity: 'error',
                    userAgent: navigator.userAgent,
                    timestamp: Date.now()
                });
            });

            // Resource loading errors
            window.addEventListener('error', (event) => {
                if (event.target !== window) {
                    this.sendBeacon('error', {
                        message: `Failed to load resource: ${event.target.src || event.target.href}`,
                        type: 'resource',
                        tagName: event.target.tagName,
                        severity: 'warning',
                        timestamp: Date.now()
                    });
                }
            }, true);
        }

        sendMetrics() {
            // Combine all metrics
            const data = {
                url: window.location.href,
                loadTime: this.metrics.navigation.totalPageLoad || 0,
                domContentLoaded: this.metrics.navigation.domContentLoaded || 0,
                firstPaint: this.metrics.paint['first-paint'] || 0,
                firstContentfulPaint: this.metrics.paint['first-contentful-paint'] || 0,
                largestContentfulPaint: this.metrics.vitals.lcp || 0,
                firstInputDelay: this.metrics.vitals.fid || 0,
                cumulativeLayoutShift: this.metrics.vitals.cls || 0,
                timeToInteractive: this.metrics.vitals.tti || 0,
                totalBlockingTime: this.metrics.vitals.tbt || 0,
                ...this.metrics.navigation
            };

            this.sendBeacon('pageLoad', data);

            // Send resource timing data
            if (this.metrics.resources.length > 0) {
                this.metrics.resources.forEach(resource => {
                    this.sendBeacon('resource', resource);
                });
            }

            // Send Core Web Vitals
            this.sendBeacon('vitals', {
                lcp: this.metrics.vitals.lcp || 0,
                fid: this.metrics.vitals.fid || 0,
                cls: this.metrics.vitals.cls || 0,
                tti: this.metrics.vitals.tti || 0,
                tbt: this.metrics.vitals.tbt || 0
            });
        }

        sendBeacon(type, data) {
            const payload = {
                type,
                data: {
                    ...data,
                    timestamp: Date.now(),
                    url: window.location.href,
                    referrer: document.referrer,
                    screenResolution: `${screen.width}x${screen.height}`,
                    viewport: `${window.innerWidth}x${window.innerHeight}`,
                    connection: navigator.connection ? {
                        effectiveType: navigator.connection.effectiveType,
                        downlink: navigator.connection.downlink,
                        rtt: navigator.connection.rtt
                    } : null
                }
            };

            // Use sendBeacon if available for reliability
            if (navigator.sendBeacon) {
                navigator.sendBeacon(BEACON_URL, JSON.stringify(payload));
            } else {
                // Fallback to fetch
                fetch(BEACON_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    keepalive: true
                }).catch(() => {
                    // Silently fail to not impact user experience
                });
            }
        }

        // Expose method to manually track custom metrics
        track(name, value, unit = 'ms') {
            this.sendBeacon('custom', {
                name,
                value,
                unit
            });
        }
    }

    // Initialize tracker
    window.perfTracker = new PerformanceTracker();

    // Expose public API
    window.ROOTUIP = window.ROOTUIP || {};
    window.ROOTUIP.performance = {
        track: (name, value, unit) => window.perfTracker.track(name, value, unit),
        mark: (name) => performance.mark(name),
        measure: (name, startMark, endMark) => {
            performance.measure(name, startMark, endMark);
            const measure = performance.getEntriesByName(name, 'measure')[0];
            if (measure) {
                window.perfTracker.track(name, measure.duration);
            }
        }
    };

})();