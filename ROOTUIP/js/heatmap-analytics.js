// UIP Enterprise Heatmap & User Behavior Analytics
// Comprehensive user experience tracking for conversion optimization

class HeatmapAnalytics {
    constructor() {
        this.hotjarId = 'YOUR_HOTJAR_ID'; // Replace with actual Hotjar ID
        this.fullstoryOrgId = 'YOUR_FULLSTORY_ORG'; // Replace with actual FullStory Org ID
        this.crazyEggId = 'YOUR_CRAZYEGG_ID'; // Replace with actual Crazy Egg ID
        
        this.userBehaviorData = {
            clicks: [],
            scrolls: [],
            hovers: [],
            formInteractions: [],
            mouseMovements: [],
            keystrokes: []
        };
        
        this.sessionRecordingEnabled = true;
        this.heatmapEnabled = true;
        this.userFeedbackEnabled = true;
        
        this.init();
    }

    init() {
        this.loadHotjar();
        this.loadFullStory();
        this.setupMouseTracking();
        this.setupScrollTracking();
        this.setupClickTracking();
        this.setupFormInteractionTracking();
        this.setupUserFeedbackWidgets();
        this.setupConversionFunnelTracking();
        this.setupABTestingIntegration();
        
        console.log('Heatmap analytics initialized');
    }

    // Load Hotjar for heatmaps and session recordings
    loadHotjar() {
        (function(h,o,t,j,a,r){
            h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
            h._hjSettings={hjid: this.hotjarId, hjsv:6};
            a=o.getElementsByTagName('head')[0];
            r=o.createElement('script');r.async=1;
            r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
            a.appendChild(r);
        })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');

        // Configure Hotjar for enterprise use
        if (typeof hj !== 'undefined') {
            // Set user attributes for segmentation
            hj('identify', this.getUserId(), {
                'company_size': this.getCompanySize(),
                'user_segment': this.getUserSegment(),
                'lead_score': this.getLeadScore(),
                'page_type': this.getPageType()
            });

            // Track custom events
            hj('event', 'uip_session_start');
            
            // Setup conversion funnels
            this.setupHotjarFunnels();
        }
    }

    // Load FullStory for detailed session recordings
    loadFullStory() {
        window['_fs_debug'] = false;
        window['_fs_host'] = 'fullstory.com';
        window['_fs_script'] = 'edge.fullstory.com/s/fs.js';
        window['_fs_org'] = this.fullstoryOrgId;
        window['_fs_namespace'] = 'FS';
        
        (function(m,n,e,t,l,o,g,y){
            if (e in m) {if(m.console && m.console.log) { m.console.log('FullStory namespace conflict. Please set window["_fs_namespace"].'); return;}}
            g=m[e]=function(a,b,s){g.q?g.q.push([a,b,s]):g._c(a,b,s);};
            g.q=[];
            o=n.createElement(t);o.async=1;o.crossOrigin='anonymous';o.src='https://'+_fs_script;
            y=n.getElementsByTagName(t)[0];y.parentNode.insertBefore(o,y);
            g.identify=function(i,v,s){g(l,{uid:i},s);if(v)g(l,v,s)};g.setUserVars=function(v,s){g(l,v,s)};g.event=function(i,v,s){g('event',{n:i,p:v},s)};
            g.anonymize=function(){g.identify(!!0)};
            g.shutdown=function(){g("rec",!1)};g.restart=function(){g("rec",!0)};
            g.log = function(a,b){g("log",[a,b])};
            g.consent=function(a){g("consent",!arguments.length||a)};
            g.identifyAccount=function(i,v){o='account';v=v||{};v.acctId=i;g(o,v)};
            g.clearUserCookie=function(){};
            g.setVars=function(n, p){g('setVars',[n,p]);};
            m[e]=g;
        })(window,document,window['_fs_namespace'],'script','user');

        // Configure FullStory for enterprise tracking
        if (typeof FS !== 'undefined') {
            FS.identify(this.getUserId(), {
                displayName: 'UIP User',
                email: this.getUserEmail(),
                company_size_str: this.getCompanySize(),
                user_segment_str: this.getUserSegment(),
                lead_score_int: this.getLeadScore(),
                page_type_str: this.getPageType()
            });

            // Track custom events
            FS.event('UIP Session Start', {
                timestamp: new Date().toISOString(),
                page_url: window.location.href,
                user_agent: navigator.userAgent
            });
        }
    }

    // Setup detailed mouse movement tracking
    setupMouseTracking() {
        let mouseMovements = [];
        let lastMouseTime = 0;
        const throttleMs = 100; // Track every 100ms

        document.addEventListener('mousemove', (e) => {
            const currentTime = Date.now();
            if (currentTime - lastMouseTime > throttleMs) {
                mouseMovements.push({
                    x: e.clientX,
                    y: e.clientY,
                    timestamp: currentTime,
                    pageX: e.pageX,
                    pageY: e.pageY
                });
                lastMouseTime = currentTime;

                // Limit array size for performance
                if (mouseMovements.length > 1000) {
                    mouseMovements = mouseMovements.slice(-500);
                }
            }
        });

        // Track mouse hovers on important elements
        const importantElements = document.querySelectorAll('.btn, .nav-links a, .calculator-inputs input, .hero-cta a');
        importantElements.forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                this.trackElementHover(e.target, 'enter');
            });

            element.addEventListener('mouseleave', (e) => {
                this.trackElementHover(e.target, 'leave');
            });
        });

        // Send mouse data periodically
        setInterval(() => {
            if (mouseMovements.length > 0) {
                this.sendMouseData(mouseMovements);
                mouseMovements = [];
            }
        }, 30000); // Send every 30 seconds
    }

    // Enhanced scroll tracking with heatmap zones
    setupScrollTracking() {
        let maxScrollDepth = 0;
        const scrollZones = this.defineScrollZones();
        const visitedZones = new Set();

        window.addEventListener('scroll', () => {
            const scrollPercent = Math.round(
                ((window.scrollY + window.innerHeight) / document.body.scrollHeight) * 100
            );
            
            maxScrollDepth = Math.max(maxScrollDepth, scrollPercent);

            // Track scroll zones
            scrollZones.forEach(zone => {
                if (scrollPercent >= zone.start && scrollPercent <= zone.end && !visitedZones.has(zone.name)) {
                    visitedZones.add(zone.name);
                    this.trackScrollZone(zone.name, scrollPercent);
                }
            });

            // Track rage scrolling (rapid scroll events)
            this.detectRageScrolling();
        });

        // Track scroll pause points (where users stop scrolling)
        let scrollTimer;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(() => {
                this.trackScrollPause(window.scrollY, maxScrollDepth);
            }, 1500); // 1.5 second pause
        });
    }

    // Comprehensive click tracking with context
    setupClickTracking() {
        document.addEventListener('click', (e) => {
            const clickData = this.getClickContext(e);
            this.trackClick(clickData);

            // Special tracking for important elements
            if (e.target.closest('.btn')) {
                this.trackButtonClick(e.target.closest('.btn'));
            }

            if (e.target.closest('.nav-links a')) {
                this.trackNavigationClick(e.target.closest('a'));
            }

            if (e.target.closest('.calculator-inputs')) {
                this.trackCalculatorInteraction(e.target);
            }
        });

        // Track dead clicks (clicks that don't lead to actions)
        document.addEventListener('click', (e) => {
            const element = e.target;
            if (!element.closest('a, button, input, select, textarea, [onclick]') && 
                !element.hasAttribute('onclick') && 
                !element.style.cursor.includes('pointer')) {
                this.trackDeadClick(e);
            }
        });
    }

    // Advanced form interaction tracking
    setupFormInteractionTracking() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            this.trackFormBehavior(form);
        });
    }

    trackFormBehavior(form) {
        const formData = {
            formId: form.id || 'unnamed',
            fields: [],
            startTime: null,
            completionTime: null,
            abandonmentPoint: null,
            errorCount: 0,
            correctionCount: 0
        };

        // Track form start
        form.addEventListener('focusin', (e) => {
            if (!formData.startTime) {
                formData.startTime = Date.now();
                this.trackFormStart(form);
            }
        });

        // Track field interactions
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            this.trackFieldBehavior(input, formData);
        });

        // Track form submission
        form.addEventListener('submit', (e) => {
            formData.completionTime = Date.now();
            this.trackFormCompletion(formData);
        });

        // Track form abandonment
        document.addEventListener('beforeunload', () => {
            if (formData.startTime && !formData.completionTime) {
                this.trackFormAbandonment(formData);
            }
        });
    }

    trackFieldBehavior(field, formData) {
        const fieldData = {
            name: field.name || field.id,
            type: field.type,
            focusCount: 0,
            totalFocusTime: 0,
            valueChanges: 0,
            lastValue: '',
            errorStates: 0
        };

        field.addEventListener('focus', () => {
            fieldData.focusCount++;
            fieldData.focusStart = Date.now();
        });

        field.addEventListener('blur', () => {
            if (fieldData.focusStart) {
                fieldData.totalFocusTime += Date.now() - fieldData.focusStart;
            }
        });

        field.addEventListener('input', () => {
            if (field.value !== fieldData.lastValue) {
                fieldData.valueChanges++;
                fieldData.lastValue = field.value;
            }
        });

        field.addEventListener('invalid', () => {
            fieldData.errorStates++;
            formData.errorCount++;
        });

        formData.fields.push(fieldData);
    }

    // Setup user feedback collection
    setupUserFeedbackWidgets() {
        // Create feedback widget
        this.createFeedbackWidget();
        
        // Setup exit-intent feedback
        this.setupExitIntentFeedback();
        
        // Setup NPS survey for qualified leads
        this.setupNPSSurvey();
    }

    createFeedbackWidget() {
        const feedbackWidget = document.createElement('div');
        feedbackWidget.id = 'uip-feedback-widget';
        feedbackWidget.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #1e40af;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            cursor: pointer;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;
        feedbackWidget.innerHTML = '💬 Feedback';
        
        feedbackWidget.addEventListener('click', () => {
            this.showFeedbackModal();
        });

        // Show after user has been on site for 30 seconds
        setTimeout(() => {
            document.body.appendChild(feedbackWidget);
        }, 30000);
    }

    showFeedbackModal() {
        // Create and show feedback modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        modal.innerHTML = `
            <div style="background: white; padding: 32px; border-radius: 12px; max-width: 500px; margin: 20px;">
                <h3 style="margin-bottom: 16px; color: #1e293b;">Help us improve UIP</h3>
                <p style="margin-bottom: 20px; color: #64748b;">Your feedback helps us build a better platform for enterprise customers.</p>
                <form id="feedback-form">
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500;">How likely are you to recommend UIP?</label>
                        <input type="range" name="nps" min="0" max="10" style="width: 100%;">
                        <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b;">
                            <span>Not likely</span>
                            <span>Very likely</span>
                        </div>
                    </div>
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500;">What's your biggest challenge with ocean freight?</label>
                        <textarea name="feedback" rows="3" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px;"></textarea>
                    </div>
                    <div style="display: flex; gap: 12px; justify-content: flex-end;">
                        <button type="button" onclick="this.closest('.feedback-modal').remove()" style="padding: 8px 16px; border: 1px solid #e2e8f0; background: white; border-radius: 4px;">Cancel</button>
                        <button type="submit" style="padding: 8px 16px; background: #1e40af; color: white; border: none; border-radius: 4px;">Submit</button>
                    </div>
                </form>
            </div>
        `;

        modal.className = 'feedback-modal';
        document.body.appendChild(modal);

        // Handle form submission
        modal.querySelector('#feedback-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            this.submitFeedback(Object.fromEntries(formData.entries()));
            modal.remove();
        });
    }

    // Setup conversion funnel tracking
    setupConversionFunnelTracking() {
        const funnelSteps = [
            { name: 'landing', selector: 'body', event: 'page_load' },
            { name: 'roi_calculator_view', selector: '#roi', event: 'scroll_into_view' },
            { name: 'roi_calculator_start', selector: '#vesselCount', event: 'focus' },
            { name: 'roi_calculator_complete', selector: '#annualSavings', event: 'value_populated' },
            { name: 'demo_form_view', selector: '#demo', event: 'scroll_into_view' },
            { name: 'demo_form_start', selector: '#demoForm input', event: 'focus' },
            { name: 'demo_form_complete', selector: '#demoForm', event: 'submit' }
        ];

        this.setupFunnelStepTracking(funnelSteps);
    }

    setupFunnelStepTracking(steps) {
        steps.forEach(step => {
            const elements = document.querySelectorAll(step.selector);
            elements.forEach(element => {
                this.trackFunnelStep(element, step);
            });
        });
    }

    // A/B Testing Integration
    setupABTestingIntegration() {
        // Simple A/B testing framework
        this.abTests = {
            'hero_cta_text': {
                variants: ['Calculate Your Savings', 'See Your ROI Now', 'Get My Savings Report'],
                current: null
            },
            'demo_form_fields': {
                variants: ['standard', 'minimal', 'detailed'],
                current: null
            }
        };

        // Initialize A/B tests
        Object.keys(this.abTests).forEach(testName => {
            this.runABTest(testName);
        });
    }

    runABTest(testName) {
        const test = this.abTests[testName];
        const userId = this.getUserId();
        
        // Consistent assignment based on user ID
        const variantIndex = this.hashUserId(userId) % test.variants.length;
        test.current = test.variants[variantIndex];
        
        // Track test assignment
        if (typeof FS !== 'undefined') {
            FS.setVars({
                [`ab_test_${testName}`]: test.current
            });
        }

        if (typeof hj !== 'undefined') {
            hj('event', 'ab_test_assignment', {
                test_name: testName,
                variant: test.current
            });
        }

        // Apply test variant
        this.applyABTestVariant(testName, test.current);
    }

    // Utility functions
    getClickContext(event) {
        const element = event.target;
        return {
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            innerText: element.innerText?.substring(0, 100),
            href: element.href,
            x: event.clientX,
            y: event.clientY,
            pageX: event.pageX,
            pageY: event.pageY,
            timestamp: Date.now(),
            scrollY: window.scrollY,
            elementRect: element.getBoundingClientRect()
        };
    }

    defineScrollZones() {
        return [
            { name: 'hero', start: 0, end: 25 },
            { name: 'problem', start: 25, end: 40 },
            { name: 'platform', start: 40, end: 60 },
            { name: 'roi_calculator', start: 60, end: 80 },
            { name: 'demo_form', start: 80, end: 95 },
            { name: 'footer', start: 95, end: 100 }
        ];
    }

    getUserId() {
        return localStorage.getItem('uip_user_id') || 
               sessionStorage.getItem('uip_session_id') || 
               'anonymous_' + Date.now();
    }

    getUserEmail() {
        return localStorage.getItem('uip_user_email') || '';
    }

    getCompanySize() {
        return localStorage.getItem('uip_company_size') || 'unknown';
    }

    getUserSegment() {
        return window.uipAnalytics ? window.uipAnalytics.userSegment : 'unknown';
    }

    getLeadScore() {
        return window.conversionTracker ? window.conversionTracker.sessionData.leadScore : 0;
    }

    getPageType() {
        return window.uipAnalytics ? window.uipAnalytics.getPageType() : 'unknown';
    }

    hashUserId(userId) {
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            const char = userId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    // Tracking methods
    trackElementHover(element, action) {
        if (typeof FS !== 'undefined') {
            FS.event('Element Hover', {
                action: action,
                element_id: element.id,
                element_class: element.className,
                element_text: element.innerText?.substring(0, 50)
            });
        }
    }

    trackScrollZone(zoneName, scrollPercent) {
        if (typeof hj !== 'undefined') {
            hj('event', 'scroll_zone_reached', {
                zone: zoneName,
                scroll_percent: scrollPercent
            });
        }
    }

    trackClick(clickData) {
        this.userBehaviorData.clicks.push(clickData);
        
        if (typeof FS !== 'undefined') {
            FS.event('Click', clickData);
        }
    }

    trackFormStart(form) {
        if (typeof hj !== 'undefined') {
            hj('event', 'form_start', {
                form_id: form.id,
                form_action: form.action
            });
        }
    }

    submitFeedback(feedbackData) {
        if (typeof FS !== 'undefined') {
            FS.event('User Feedback', feedbackData);
        }

        if (typeof hj !== 'undefined') {
            hj('event', 'user_feedback_submitted', feedbackData);
        }

        // Send to server
        fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...feedbackData,
                timestamp: new Date().toISOString(),
                page_url: window.location.href,
                user_id: this.getUserId()
            })
        });
    }

    sendMouseData(movements) {
        // Send mouse movement data to analytics endpoint
        fetch('/api/mouse-tracking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                movements: movements,
                session_id: this.getUserId(),
                page_url: window.location.href,
                timestamp: Date.now()
            })
        }).catch(() => {}); // Fail silently
    }

    // Public API
    trackCustomEvent(eventName, data = {}) {
        if (typeof FS !== 'undefined') {
            FS.event(eventName, data);
        }
        
        if (typeof hj !== 'undefined') {
            hj('event', eventName, data);
        }
    }
}

// Initialize heatmap analytics
document.addEventListener('DOMContentLoaded', () => {
    window.heatmapAnalytics = new HeatmapAnalytics();
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeatmapAnalytics;
}