/**
 * ROOTUIP User Feedback Collection and UX Optimization System
 * Collects user feedback and optimizes user experience
 */

const EventEmitter = require('events');

class UserFeedbackSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            enableFeedbackCollection: config.enableFeedbackCollection !== false,
            enableAnalytics: config.enableAnalytics !== false,
            enableABTesting: config.enableABTesting !== false,
            enableHeatmaps: config.enableHeatmaps !== false,
            feedbackTypes: config.feedbackTypes || ['rating', 'comment', 'bug_report', 'feature_request'],
            storageType: config.storageType || 'localStorage',
            submitEndpoint: config.submitEndpoint || '/api/feedback',
            autoShowInterval: config.autoShowInterval || 30000, // 30 seconds
            maxFeedbackPerSession: config.maxFeedbackPerSession || 3
        };
        
        // Feedback storage
        this.feedbackQueue = [];
        this.userBehaviorData = [];
        this.sessionData = {
            sessionId: this.generateSessionId(),
            startTime: new Date(),
            pageViews: [],
            interactions: [],
            errors: [],
            performance: {}
        };
        
        // UX metrics
        this.uxMetrics = {
            taskCompletionRate: 0,
            timeOnTask: 0,
            errorRate: 0,
            satisfactionScore: 0,
            npsScore: 0,
            conversionRate: 0
        };
        
        // A/B testing
        this.abTests = new Map();
        this.userVariants = new Map();
        
        // Heat map data
        this.heatmapData = {
            clicks: [],
            scrolls: [],
            hovers: [],
            attention: []
        };
        
        // Feedback widgets
        this.feedbackWidgets = new Map();
        
        // User journey tracking
        this.userJourney = [];
        this.conversionFunnels = new Map();
        
        // Sentiment analysis
        this.sentimentKeywords = {
            positive: ['good', 'great', 'excellent', 'amazing', 'love', 'perfect', 'awesome', 'fantastic'],
            negative: ['bad', 'terrible', 'awful', 'hate', 'horrible', 'broken', 'slow', 'confusing'],
            neutral: ['okay', 'fine', 'average', 'normal', 'standard']
        };
        
        // Initialize system
        this.initializeFeedbackSystem();
        this.startBehaviorTracking();
        this.setupEventListeners();
    }
    
    // Initialize feedback system
    initializeFeedbackSystem() {
        if (typeof document === 'undefined') return;
        
        // Create feedback widgets
        this.createFeedbackWidgets();
        
        // Setup automatic feedback prompts
        this.setupAutomaticPrompts();
        
        // Initialize A/B testing
        this.initializeABTesting();
        
        // Setup performance monitoring
        this.setupPerformanceMonitoring();
        
        // Initialize heat mapping
        this.initializeHeatMapping();
        
        // Setup error tracking
        this.setupErrorTracking();
    }
    
    // Create feedback widgets
    createFeedbackWidgets() {
        // Quick rating widget
        this.createQuickRatingWidget();
        
        // Feedback button
        this.createFeedbackButton();
        
        // NPS survey widget
        this.createNPSWidget();
        
        // Bug report widget
        this.createBugReportWidget();
        
        // Feature request widget
        this.createFeatureRequestWidget();
    }
    
    // Create quick rating widget
    createQuickRatingWidget() {
        const widget = document.createElement('div');
        widget.id = 'quick-rating-widget';
        widget.className = 'feedback-widget quick-rating hidden';
        widget.innerHTML = `
            <div class="feedback-content">
                <h3>How was your experience?</h3>
                <div class="rating-stars">
                    ${[1, 2, 3, 4, 5].map(rating => 
                        `<button class="star" data-rating="${rating}">⭐</button>`
                    ).join('')}
                </div>
                <div class="rating-actions">
                    <button class="btn-skip">Skip</button>
                    <button class="btn-comment" style="display: none;">Add Comment</button>
                </div>
                <textarea class="rating-comment" placeholder="Tell us more..." style="display: none;"></textarea>
                <button class="btn-submit" style="display: none;">Submit</button>
            </div>
            <button class="widget-close">×</button>
        `;
        
        // Add event listeners
        this.setupQuickRatingEvents(widget);
        
        document.body.appendChild(widget);
        this.feedbackWidgets.set('quick-rating', widget);
    }
    
    // Setup quick rating events
    setupQuickRatingEvents(widget) {
        const stars = widget.querySelectorAll('.star');
        const commentBtn = widget.querySelector('.btn-comment');
        const textarea = widget.querySelector('.rating-comment');
        const submitBtn = widget.querySelector('.btn-submit');
        const skipBtn = widget.querySelector('.btn-skip');
        const closeBtn = widget.querySelector('.widget-close');
        
        let selectedRating = 0;
        
        stars.forEach(star => {
            star.addEventListener('click', () => {
                selectedRating = parseInt(star.dataset.rating);
                
                // Update star display
                stars.forEach((s, index) => {
                    s.classList.toggle('selected', index < selectedRating);
                });
                
                // Show comment option for low ratings
                if (selectedRating <= 3) {
                    commentBtn.style.display = 'inline-block';
                } else {
                    // Auto-submit for high ratings
                    this.submitFeedback({
                        type: 'rating',
                        rating: selectedRating,
                        timestamp: new Date(),
                        page: window.location.pathname
                    });
                    this.hideWidget('quick-rating');
                }
            });
        });
        
        commentBtn.addEventListener('click', () => {
            textarea.style.display = 'block';
            submitBtn.style.display = 'inline-block';
            commentBtn.style.display = 'none';
            textarea.focus();
        });
        
        submitBtn.addEventListener('click', () => {
            this.submitFeedback({
                type: 'rating',
                rating: selectedRating,
                comment: textarea.value,
                timestamp: new Date(),
                page: window.location.pathname
            });
            this.hideWidget('quick-rating');
        });
        
        skipBtn.addEventListener('click', () => {
            this.hideWidget('quick-rating');
        });
        
        closeBtn.addEventListener('click', () => {
            this.hideWidget('quick-rating');
        });
    }
    
    // Create feedback button
    createFeedbackButton() {
        const button = document.createElement('div');
        button.id = 'feedback-button';
        button.className = 'feedback-button';
        button.innerHTML = `
            <button class="feedback-btn">
                💬 Feedback
            </button>
        `;
        
        button.addEventListener('click', () => {
            this.showFeedbackModal();
        });
        
        document.body.appendChild(button);
        this.feedbackWidgets.set('feedback-button', button);
    }
    
    // Create NPS widget
    createNPSWidget() {
        const widget = document.createElement('div');
        widget.id = 'nps-widget';
        widget.className = 'feedback-widget nps-survey hidden';
        widget.innerHTML = `
            <div class="feedback-content">
                <h3>How likely are you to recommend ROOTUIP to a colleague?</h3>
                <div class="nps-scale">
                    ${Array.from({length: 11}, (_, i) => 
                        `<button class="nps-score" data-score="${i}">${i}</button>`
                    ).join('')}
                </div>
                <div class="nps-labels">
                    <span>Not at all likely</span>
                    <span>Extremely likely</span>
                </div>
                <textarea class="nps-comment" placeholder="What's the primary reason for your score?" style="display: none;"></textarea>
                <button class="btn-submit" style="display: none;">Submit</button>
            </div>
            <button class="widget-close">×</button>
        `;
        
        this.setupNPSEvents(widget);
        document.body.appendChild(widget);
        this.feedbackWidgets.set('nps', widget);
    }
    
    // Setup NPS events
    setupNPSEvents(widget) {
        const scores = widget.querySelectorAll('.nps-score');
        const textarea = widget.querySelector('.nps-comment');
        const submitBtn = widget.querySelector('.btn-submit');
        const closeBtn = widget.querySelector('.widget-close');
        
        let selectedScore = -1;
        
        scores.forEach(score => {
            score.addEventListener('click', () => {
                selectedScore = parseInt(score.dataset.score);
                
                // Update score display
                scores.forEach(s => s.classList.remove('selected'));
                score.classList.add('selected');
                
                // Show comment field
                textarea.style.display = 'block';
                submitBtn.style.display = 'inline-block';
                textarea.focus();
            });
        });
        
        submitBtn.addEventListener('click', () => {
            const category = selectedScore <= 6 ? 'detractor' : 
                           selectedScore <= 8 ? 'passive' : 'promoter';
            
            this.submitFeedback({
                type: 'nps',
                score: selectedScore,
                category,
                comment: textarea.value,
                timestamp: new Date(),
                page: window.location.pathname
            });
            
            this.hideWidget('nps');
        });
        
        closeBtn.addEventListener('click', () => {
            this.hideWidget('nps');
        });
    }
    
    // Create bug report widget
    createBugReportWidget() {
        const widget = document.createElement('div');
        widget.id = 'bug-report-widget';
        widget.className = 'feedback-widget bug-report hidden';
        widget.innerHTML = `
            <div class="feedback-content">
                <h3>Report a Bug</h3>
                <form class="bug-report-form">
                    <label for="bug-title">What went wrong?</label>
                    <input type="text" id="bug-title" placeholder="Brief description" required>
                    
                    <label for="bug-description">Detailed description</label>
                    <textarea id="bug-description" placeholder="Steps to reproduce, expected behavior, etc." required></textarea>
                    
                    <label for="bug-severity">Severity</label>
                    <select id="bug-severity">
                        <option value="low">Low - Minor issue</option>
                        <option value="medium">Medium - Affects functionality</option>
                        <option value="high">High - Blocks important tasks</option>
                        <option value="critical">Critical - System unusable</option>
                    </select>
                    
                    <label for="bug-browser">Browser/Device</label>
                    <input type="text" id="bug-browser" readonly>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-cancel">Cancel</button>
                        <button type="submit" class="btn-submit">Submit Bug Report</button>
                    </div>
                </form>
            </div>
        `;
        
        this.setupBugReportEvents(widget);
        document.body.appendChild(widget);
        this.feedbackWidgets.set('bug-report', widget);
    }
    
    // Setup bug report events
    setupBugReportEvents(widget) {
        const form = widget.querySelector('.bug-report-form');
        const browserField = widget.querySelector('#bug-browser');
        const cancelBtn = widget.querySelector('.btn-cancel');
        
        // Pre-fill browser info
        browserField.value = navigator.userAgent;
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const bugReport = {
                type: 'bug_report',
                title: formData.get('bug-title') || document.getElementById('bug-title').value,
                description: formData.get('bug-description') || document.getElementById('bug-description').value,
                severity: formData.get('bug-severity') || document.getElementById('bug-severity').value,
                browser: browserField.value,
                url: window.location.href,
                timestamp: new Date(),
                userAgent: navigator.userAgent,
                screenResolution: `${screen.width}x${screen.height}`,
                viewport: `${window.innerWidth}x${window.innerHeight}`
            };
            
            this.submitFeedback(bugReport);
            this.hideWidget('bug-report');
            
            // Show thank you message
            this.showNotification('Thank you for the bug report! We\'ll investigate this issue.');
        });
        
        cancelBtn.addEventListener('click', () => {
            this.hideWidget('bug-report');
        });
    }
    
    // Create feature request widget
    createFeatureRequestWidget() {
        const widget = document.createElement('div');
        widget.id = 'feature-request-widget';
        widget.className = 'feedback-widget feature-request hidden';
        widget.innerHTML = `
            <div class="feedback-content">
                <h3>Request a Feature</h3>
                <form class="feature-request-form">
                    <label for="feature-title">Feature Title</label>
                    <input type="text" id="feature-title" placeholder="What feature would you like?" required>
                    
                    <label for="feature-description">Description</label>
                    <textarea id="feature-description" placeholder="Describe the feature and how it would help you" required></textarea>
                    
                    <label for="feature-priority">Priority</label>
                    <select id="feature-priority">
                        <option value="low">Nice to have</option>
                        <option value="medium">Would be helpful</option>
                        <option value="high">Important for my workflow</option>
                        <option value="critical">Essential for my work</option>
                    </select>
                    
                    <label for="feature-use-case">Use Case</label>
                    <textarea id="feature-use-case" placeholder="How would you use this feature?"></textarea>
                    
                    <div class="form-actions">
                        <button type="button" class="btn-cancel">Cancel</button>
                        <button type="submit" class="btn-submit">Submit Request</button>
                    </div>
                </form>
            </div>
        `;
        
        this.setupFeatureRequestEvents(widget);
        document.body.appendChild(widget);
        this.feedbackWidgets.set('feature-request', widget);
    }
    
    // Setup feature request events
    setupFeatureRequestEvents(widget) {
        const form = widget.querySelector('.feature-request-form');
        const cancelBtn = widget.querySelector('.btn-cancel');
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const featureRequest = {
                type: 'feature_request',
                title: document.getElementById('feature-title').value,
                description: document.getElementById('feature-description').value,
                priority: document.getElementById('feature-priority').value,
                useCase: document.getElementById('feature-use-case').value,
                url: window.location.href,
                timestamp: new Date()
            };
            
            this.submitFeedback(featureRequest);
            this.hideWidget('feature-request');
            
            // Show thank you message
            this.showNotification('Thank you for the feature request! We\'ll consider it for future updates.');
        });
        
        cancelBtn.addEventListener('click', () => {
            this.hideWidget('feature-request');
        });
    }
    
    // Setup automatic feedback prompts
    setupAutomaticPrompts() {
        // Show rating widget after user interaction
        setTimeout(() => {
            if (this.sessionData.interactions.length > 5) {
                this.showWidget('quick-rating');
            }
        }, this.config.autoShowInterval);
        
        // Show NPS survey for returning users
        const visitCount = parseInt(localStorage.getItem('rootuip_visit_count') || '0') + 1;
        localStorage.setItem('rootuip_visit_count', visitCount.toString());
        
        if (visitCount % 10 === 0) { // Every 10th visit
            setTimeout(() => {
                this.showWidget('nps');
            }, this.config.autoShowInterval * 2);
        }
    }
    
    // Start behavior tracking
    startBehaviorTracking() {
        if (!this.config.enableAnalytics) return;
        
        // Track page views
        this.trackPageView();
        
        // Track user interactions
        this.trackUserInteractions();
        
        // Track scroll behavior
        this.trackScrollBehavior();
        
        // Track time on page
        this.trackTimeOnPage();
        
        // Track task completion
        this.trackTaskCompletion();
    }
    
    // Track page view
    trackPageView() {
        const pageView = {
            url: window.location.href,
            title: document.title,
            timestamp: new Date(),
            referrer: document.referrer,
            userAgent: navigator.userAgent
        };
        
        this.sessionData.pageViews.push(pageView);
        this.userJourney.push({
            type: 'page_view',
            ...pageView
        });
        
        this.emit('analytics:page_view', pageView);
    }
    
    // Track user interactions
    trackUserInteractions() {
        const interactionTypes = ['click', 'submit', 'change', 'input'];
        
        interactionTypes.forEach(type => {
            document.addEventListener(type, (event) => {
                const interaction = {
                    type,
                    element: event.target.tagName,
                    elementId: event.target.id,
                    elementClass: event.target.className,
                    timestamp: new Date(),
                    coordinates: type === 'click' ? {
                        x: event.clientX,
                        y: event.clientY
                    } : null
                };
                
                this.sessionData.interactions.push(interaction);
                
                // Track for heatmaps
                if (type === 'click' && this.config.enableHeatmaps) {
                    this.heatmapData.clicks.push({
                        x: event.clientX,
                        y: event.clientY,
                        timestamp: new Date(),
                        element: event.target
                    });
                }
                
                this.emit('analytics:interaction', interaction);
            });
        });
    }
    
    // Track scroll behavior
    trackScrollBehavior() {
        let scrollTimeout;
        
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                const scrollData = {
                    scrollY: window.scrollY,
                    scrollPercent: (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100,
                    timestamp: new Date()
                };
                
                if (this.config.enableHeatmaps) {
                    this.heatmapData.scrolls.push(scrollData);
                }
                
                this.emit('analytics:scroll', scrollData);
            }, 100);
        });
    }
    
    // Track time on page
    trackTimeOnPage() {
        let startTime = new Date();
        let isActive = true;
        
        // Track when user becomes inactive
        let inactivityTimer;
        const resetInactivityTimer = () => {
            clearTimeout(inactivityTimer);
            isActive = true;
            
            inactivityTimer = setTimeout(() => {
                isActive = false;
            }, 30000); // 30 seconds of inactivity
        };
        
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, resetInactivityTimer, true);
        });
        
        // Track time when page unloads
        window.addEventListener('beforeunload', () => {
            const timeOnPage = new Date() - startTime;
            this.sessionData.performance.timeOnPage = timeOnPage;
            
            this.emit('analytics:time_on_page', { timeOnPage, isActive });
        });
    }
    
    // Track task completion
    trackTaskCompletion() {
        // Define task completion indicators
        const taskIndicators = [
            { selector: '.success-message', task: 'general_success' },
            { selector: '[data-task="shipment-created"]', task: 'shipment_creation' },
            { selector: '[data-task="tracking-viewed"]', task: 'shipment_tracking' },
            { selector: '[data-task="report-generated"]', task: 'report_generation' }
        ];
        
        // Observe for task completion
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        taskIndicators.forEach(indicator => {
                            const elements = document.querySelectorAll(indicator.selector);
                            if (elements.length > 0) {
                                this.trackTaskCompleted(indicator.task);
                            }
                        });
                    }
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }
    
    // Track completed task
    trackTaskCompleted(taskType) {
        const task = {
            type: taskType,
            timestamp: new Date(),
            page: window.location.pathname,
            sessionTime: new Date() - this.sessionData.startTime
        };
        
        this.userJourney.push({
            type: 'task_completion',
            ...task
        });
        
        this.emit('analytics:task_completed', task);
    }
    
    // Initialize A/B testing
    initializeABTesting() {
        if (!this.config.enableABTesting) return;
        
        // Load existing tests from storage
        this.loadABTests();
        
        // Assign user to variants
        this.assignUserVariants();
    }
    
    // Load A/B tests
    loadABTests() {
        // Example A/B tests
        this.abTests.set('button_color', {
            id: 'button_color',
            name: 'Primary Button Color Test',
            variants: ['blue', 'green', 'orange'],
            traffic: 0.5, // 50% of users
            metric: 'click_rate'
        });
        
        this.abTests.set('dashboard_layout', {
            id: 'dashboard_layout',
            name: 'Dashboard Layout Test',
            variants: ['grid', 'list', 'cards'],
            traffic: 0.3, // 30% of users
            metric: 'task_completion'
        });
    }
    
    // Assign user to variants
    assignUserVariants() {
        const userId = this.getUserId();
        
        this.abTests.forEach(test => {
            // Check if user should be included in test
            if (Math.random() < test.traffic) {
                const variantIndex = Math.floor(Math.random() * test.variants.length);
                const variant = test.variants[variantIndex];
                
                this.userVariants.set(test.id, variant);
                
                // Apply variant
                this.applyVariant(test.id, variant);
                
                this.emit('ab_test:assigned', {
                    testId: test.id,
                    variant,
                    userId
                });
            }
        });
    }
    
    // Apply A/B test variant
    applyVariant(testId, variant) {
        switch (testId) {
            case 'button_color':
                document.documentElement.style.setProperty('--primary-color', 
                    variant === 'blue' ? '#00d4ff' :
                    variant === 'green' ? '#00ff88' : '#ff9500'
                );
                break;
                
            case 'dashboard_layout':
                document.body.classList.add(`layout-${variant}`);
                break;
        }
    }
    
    // Initialize heat mapping
    initializeHeatMapping() {
        if (!this.config.enableHeatmaps) return;
        
        // Track mouse hovers
        let hoverTimeout;
        document.addEventListener('mousemove', (event) => {
            clearTimeout(hoverTimeout);
            hoverTimeout = setTimeout(() => {
                this.heatmapData.hovers.push({
                    x: event.clientX,
                    y: event.clientY,
                    timestamp: new Date()
                });
            }, 100);
        });
        
        // Track attention (mouse stops)
        let lastMoveTime = new Date();
        document.addEventListener('mousemove', (event) => {
            const now = new Date();
            if (now - lastMoveTime > 2000) { // Mouse stopped for 2 seconds
                this.heatmapData.attention.push({
                    x: event.clientX,
                    y: event.clientY,
                    duration: now - lastMoveTime,
                    timestamp: new Date()
                });
            }
            lastMoveTime = now;
        });
    }
    
    // Setup performance monitoring
    setupPerformanceMonitoring() {
        // Track page load performance
        window.addEventListener('load', () => {
            setTimeout(() => {
                const navigation = performance.getEntriesByType('navigation')[0];
                if (navigation) {
                    this.sessionData.performance = {
                        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
                        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
                        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
                    };
                    
                    this.emit('analytics:performance', this.sessionData.performance);
                }
            }, 0);
        });
    }
    
    // Setup error tracking
    setupErrorTracking() {
        // Track JavaScript errors
        window.addEventListener('error', (event) => {
            const error = {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: new Date(),
                url: window.location.href
            };
            
            this.sessionData.errors.push(error);
            this.emit('analytics:error', error);
        });
        
        // Track unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            const error = {
                type: 'unhandled_rejection',
                reason: event.reason,
                timestamp: new Date(),
                url: window.location.href
            };
            
            this.sessionData.errors.push(error);
            this.emit('analytics:error', error);
        });
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Listen for form submissions to track conversions
        document.addEventListener('submit', (event) => {
            const form = event.target;
            if (form.dataset.conversionEvent) {
                this.trackConversion(form.dataset.conversionEvent);
            }
        });
        
        // Listen for custom events
        document.addEventListener('ux:feedback_requested', (event) => {
            this.showWidget(event.detail.type || 'quick-rating');
        });
    }
    
    // Show widget
    showWidget(widgetType) {
        const widget = this.feedbackWidgets.get(widgetType);
        if (widget) {
            widget.classList.remove('hidden');
            widget.classList.add('visible');
            
            // Focus first input
            const firstInput = widget.querySelector('input, textarea, button');
            if (firstInput) {
                firstInput.focus();
            }
            
            this.emit('feedback:widget_shown', { type: widgetType });
        }
    }
    
    // Hide widget
    hideWidget(widgetType) {
        const widget = this.feedbackWidgets.get(widgetType);
        if (widget) {
            widget.classList.remove('visible');
            widget.classList.add('hidden');
            
            this.emit('feedback:widget_hidden', { type: widgetType });
        }
    }
    
    // Show feedback modal
    showFeedbackModal() {
        // Create modal with all feedback options
        const modal = document.createElement('div');
        modal.className = 'feedback-modal';
        modal.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h2>We'd love your feedback!</h2>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="feedback-options">
                        <button class="feedback-option" data-type="rating">
                            ⭐ Rate your experience
                        </button>
                        <button class="feedback-option" data-type="bug-report">
                            🐛 Report a bug
                        </button>
                        <button class="feedback-option" data-type="feature-request">
                            💡 Request a feature
                        </button>
                        <button class="feedback-option" data-type="nps">
                            📊 Quick survey
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners
        modal.querySelectorAll('.feedback-option').forEach(option => {
            option.addEventListener('click', () => {
                const type = option.dataset.type;
                document.body.removeChild(modal);
                this.showWidget(type);
            });
        });
        
        modal.querySelector('.modal-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.querySelector('.modal-backdrop').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        document.body.appendChild(modal);
    }
    
    // Submit feedback
    async submitFeedback(feedback) {
        // Add session context
        const enrichedFeedback = {
            ...feedback,
            sessionId: this.sessionData.sessionId,
            userAgent: navigator.userAgent,
            screenResolution: `${screen.width}x${screen.height}`,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            sessionData: this.getSessionSummary()
        };
        
        // Perform sentiment analysis
        if (feedback.comment) {
            enrichedFeedback.sentiment = this.analyzeSentiment(feedback.comment);
        }
        
        // Add to queue
        this.feedbackQueue.push(enrichedFeedback);
        
        // Try to submit immediately
        try {
            await this.sendFeedbackToServer(enrichedFeedback);
            this.emit('feedback:submitted', enrichedFeedback);
        } catch (error) {
            // Store locally for later submission
            this.storeFeedbackLocally(enrichedFeedback);
            this.emit('feedback:queued', enrichedFeedback);
        }
        
        // Update UX metrics
        this.updateUXMetrics(feedback);
    }
    
    // Send feedback to server
    async sendFeedbackToServer(feedback) {
        const response = await fetch(this.config.submitEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(feedback)
        });
        
        if (!response.ok) {
            throw new Error(`Failed to submit feedback: ${response.statusText}`);
        }
        
        return response.json();
    }
    
    // Store feedback locally
    storeFeedbackLocally(feedback) {
        const stored = JSON.parse(localStorage.getItem('rootuip_feedback_queue') || '[]');
        stored.push(feedback);
        
        // Keep only last 50 items
        if (stored.length > 50) {
            stored.splice(0, stored.length - 50);
        }
        
        localStorage.setItem('rootuip_feedback_queue', JSON.stringify(stored));
    }
    
    // Analyze sentiment
    analyzeSentiment(text) {
        const words = text.toLowerCase().split(/\s+/);
        let score = 0;
        let wordCount = 0;
        
        words.forEach(word => {
            if (this.sentimentKeywords.positive.includes(word)) {
                score += 1;
                wordCount++;
            } else if (this.sentimentKeywords.negative.includes(word)) {
                score -= 1;
                wordCount++;
            }
        });
        
        if (wordCount === 0) return 'neutral';
        
        const averageScore = score / wordCount;
        
        if (averageScore > 0.1) return 'positive';
        if (averageScore < -0.1) return 'negative';
        return 'neutral';
    }
    
    // Update UX metrics
    updateUXMetrics(feedback) {
        switch (feedback.type) {
            case 'rating':
                this.uxMetrics.satisfactionScore = (this.uxMetrics.satisfactionScore + feedback.rating) / 2;
                break;
                
            case 'nps':
                this.uxMetrics.npsScore = feedback.score;
                break;
                
            case 'bug_report':
                this.uxMetrics.errorRate += 0.1;
                break;
        }
        
        this.emit('ux_metrics:updated', this.uxMetrics);
    }
    
    // Track conversion
    trackConversion(eventType) {
        const conversion = {
            type: eventType,
            timestamp: new Date(),
            userJourney: [...this.userJourney]
        };
        
        this.userJourney.push({
            type: 'conversion',
            ...conversion
        });
        
        // Update conversion rate
        this.uxMetrics.conversionRate = (this.uxMetrics.conversionRate + 1) / this.sessionData.pageViews.length;
        
        this.emit('analytics:conversion', conversion);
    }
    
    // Show notification
    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `feedback-notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('visible');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('visible');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // Get session summary
    getSessionSummary() {
        return {
            sessionId: this.sessionData.sessionId,
            startTime: this.sessionData.startTime,
            pageViewCount: this.sessionData.pageViews.length,
            interactionCount: this.sessionData.interactions.length,
            errorCount: this.sessionData.errors.length,
            performance: this.sessionData.performance
        };
    }
    
    // Generate session ID
    generateSessionId() {
        return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Get user ID
    getUserId() {
        let userId = localStorage.getItem('rootuip_user_id');
        if (!userId) {
            userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('rootuip_user_id', userId);
        }
        return userId;
    }
    
    // Get UX metrics
    getUXMetrics() {
        return { ...this.uxMetrics };
    }
    
    // Get heat map data
    getHeatMapData() {
        return { ...this.heatmapData };
    }
    
    // Get user journey
    getUserJourney() {
        return [...this.userJourney];
    }
    
    // Generate UX report
    generateUXReport() {
        return {
            timestamp: new Date(),
            sessionData: this.getSessionSummary(),
            uxMetrics: this.getUXMetrics(),
            userJourney: this.getUserJourney(),
            heatmapData: this.config.enableHeatmaps ? this.getHeatMapData() : null,
            abTestVariants: Object.fromEntries(this.userVariants),
            feedbackCount: this.feedbackQueue.length
        };
    }
}

module.exports = UserFeedbackSystem;