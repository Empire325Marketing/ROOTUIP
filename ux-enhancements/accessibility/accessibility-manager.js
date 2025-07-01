/**
 * ROOTUIP Accessibility Manager
 * WCAG 2.1 AA compliance and accessibility improvements
 */

const EventEmitter = require('events');

class AccessibilityManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            enableHighContrast: config.enableHighContrast !== false,
            enableScreenReader: config.enableScreenReader !== false,
            enableKeyboardNavigation: config.enableKeyboardNavigation !== false,
            enableFocusManagement: config.enableFocusManagement !== false,
            enableAriaLabels: config.enableAriaLabels !== false,
            enableReducedMotion: config.enableReducedMotion !== false
        };
        
        // Accessibility state
        this.accessibilityState = {
            highContrast: false,
            reducedMotion: false,
            largeText: false,
            screenReader: false,
            keyboardNavigation: true,
            focusVisible: true,
            colorBlindSupport: false
        };
        
        // Screen reader announcements queue
        this.announcements = [];
        
        // Focus management
        this.focusHistory = [];
        this.currentFocusIndex = -1;
        
        // Keyboard navigation
        this.keyboardHandlers = new Map();
        this.focusableElements = [];
        
        // Color contrast ratios
        this.contrastRatios = {
            normal: 4.5,  // WCAG AA standard
            large: 3.0,   // WCAG AA for large text
            enhanced: 7.0 // WCAG AAA standard
        };
        
        // Initialize accessibility features
        this.initializeAccessibility();
        this.setupEventListeners();
        this.detectSystemPreferences();
    }
    
    // Initialize accessibility features
    initializeAccessibility() {
        if (typeof document === 'undefined') return;
        
        // Create accessibility announcer
        this.createAccessibilityAnnouncer();
        
        // Setup focus management
        this.setupFocusManagement();
        
        // Setup keyboard navigation
        this.setupKeyboardNavigation();
        
        // Setup high contrast mode
        this.setupHighContrastMode();
        
        // Setup reduced motion support
        this.setupReducedMotionSupport();
        
        // Setup text scaling
        this.setupTextScaling();
        
        // Setup color blind support
        this.setupColorBlindSupport();
        
        // Initialize ARIA labels
        this.initializeAriaLabels();
        
        // Setup skip links
        this.setupSkipLinks();
    }
    
    // Create screen reader announcer
    createAccessibilityAnnouncer() {
        if (document.getElementById('accessibility-announcer')) return;
        
        const announcer = document.createElement('div');
        announcer.id = 'accessibility-announcer';
        announcer.setAttribute('aria-live', 'polite');
        announcer.setAttribute('aria-atomic', 'true');
        announcer.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
        `;
        
        document.body.appendChild(announcer);
        
        // Create assertive announcer for urgent messages
        const urgentAnnouncer = document.createElement('div');
        urgentAnnouncer.id = 'accessibility-announcer-urgent';
        urgentAnnouncer.setAttribute('aria-live', 'assertive');
        urgentAnnouncer.setAttribute('aria-atomic', 'true');
        urgentAnnouncer.style.cssText = announcer.style.cssText;
        
        document.body.appendChild(urgentAnnouncer);
    }
    
    // Announce to screen readers
    announce(message, urgent = false) {
        if (!this.config.enableScreenReader) return;
        
        const announcerId = urgent ? 'accessibility-announcer-urgent' : 'accessibility-announcer';
        const announcer = document.getElementById(announcerId);
        
        if (announcer) {
            // Clear previous announcement
            announcer.textContent = '';
            
            // Add new announcement after a brief delay
            setTimeout(() => {
                announcer.textContent = message;
                
                // Log announcement
                this.emit('accessibility:announced', { message, urgent });
                
                // Clear after announcement
                setTimeout(() => {
                    announcer.textContent = '';
                }, 1000);
            }, 100);
        }
    }
    
    // Setup focus management
    setupFocusManagement() {
        if (!this.config.enableFocusManagement) return;
        
        // Track focus changes
        document.addEventListener('focusin', (event) => {
            this.handleFocusIn(event);
        });
        
        document.addEventListener('focusout', (event) => {
            this.handleFocusOut(event);
        });
        
        // Create focus indicator styles
        this.createFocusStyles();
        
        // Setup focus trapping for modals
        this.setupFocusTrapping();
    }
    
    // Handle focus in events
    handleFocusIn(event) {
        const element = event.target;
        
        // Add to focus history
        this.focusHistory.push(element);
        this.currentFocusIndex = this.focusHistory.length - 1;
        
        // Announce focused element to screen readers
        const announcement = this.generateFocusAnnouncement(element);
        if (announcement) {
            this.announce(announcement);
        }
        
        // Ensure element is visible
        this.ensureElementVisible(element);
        
        this.emit('accessibility:focus_changed', { element, announcement });
    }
    
    // Handle focus out events
    handleFocusOut(event) {
        const element = event.target;
        this.emit('accessibility:focus_lost', { element });
    }
    
    // Generate focus announcement
    generateFocusAnnouncement(element) {
        const role = element.getAttribute('role') || element.tagName.toLowerCase();
        const label = element.getAttribute('aria-label') || 
                     element.getAttribute('aria-labelledby') ||
                     element.textContent ||
                     element.value ||
                     element.alt ||
                     element.title;
        
        let announcement = '';
        
        if (label) {
            announcement += label + ', ';
        }
        
        // Add role information
        switch (role) {
            case 'button':
                announcement += 'button';
                break;
            case 'link':
                announcement += 'link';
                break;
            case 'textbox':
            case 'input':
                announcement += element.type === 'password' ? 'password field' : 'text field';
                break;
            case 'checkbox':
                announcement += element.checked ? 'checked checkbox' : 'unchecked checkbox';
                break;
            case 'radio':
                announcement += element.checked ? 'selected radio button' : 'radio button';
                break;
            default:
                if (label) {
                    announcement += role;
                }
        }
        
        // Add state information
        if (element.hasAttribute('aria-expanded')) {
            const expanded = element.getAttribute('aria-expanded') === 'true';
            announcement += expanded ? ', expanded' : ', collapsed';
        }
        
        if (element.hasAttribute('aria-selected')) {
            const selected = element.getAttribute('aria-selected') === 'true';
            announcement += selected ? ', selected' : ', not selected';
        }
        
        if (element.disabled) {
            announcement += ', disabled';
        }
        
        return announcement.trim();
    }
    
    // Ensure element is visible in viewport
    ensureElementVisible(element) {
        const rect = element.getBoundingClientRect();
        const isVisible = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth
        );
        
        if (!isVisible) {
            element.scrollIntoView({
                behavior: this.accessibilityState.reducedMotion ? 'auto' : 'smooth',
                block: 'nearest',
                inline: 'nearest'
            });
        }
    }
    
    // Create focus indicator styles
    createFocusStyles() {
        if (document.getElementById('accessibility-focus-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'accessibility-focus-styles';
        style.textContent = `
            /* High visibility focus indicators */
            *:focus {
                outline: 3px solid #00d4ff !important;
                outline-offset: 2px !important;
                box-shadow: 0 0 0 1px #ffffff, 0 0 0 4px #00d4ff !important;
            }
            
            /* Button focus styles */
            button:focus, 
            [role="button"]:focus {
                outline: 3px solid #00d4ff !important;
                background-color: rgba(0, 212, 255, 0.1) !important;
            }
            
            /* Link focus styles */
            a:focus,
            [role="link"]:focus {
                outline: 3px solid #00d4ff !important;
                text-decoration: underline !important;
                background-color: rgba(0, 212, 255, 0.1) !important;
            }
            
            /* Form element focus styles */
            input:focus,
            textarea:focus,
            select:focus {
                outline: 3px solid #00d4ff !important;
                border-color: #00d4ff !important;
                box-shadow: 0 0 0 1px #ffffff, 0 0 0 4px #00d4ff !important;
            }
            
            /* Skip link styles */
            .skip-link {
                position: absolute;
                top: -40px;
                left: 6px;
                background: #000000;
                color: #ffffff;
                padding: 8px;
                z-index: 10000;
                text-decoration: none;
                border-radius: 4px;
                font-weight: bold;
                border: 2px solid #00d4ff;
                transition: top 0.3s ease;
            }
            
            .skip-link:focus {
                top: 6px;
                outline: 3px solid #00d4ff;
            }
            
            /* High contrast mode styles */
            body.high-contrast {
                background: #000000 !important;
                color: #ffffff !important;
            }
            
            body.high-contrast * {
                background: #000000 !important;
                color: #ffffff !important;
                border-color: #ffffff !important;
            }
            
            body.high-contrast button,
            body.high-contrast [role="button"] {
                background: #ffffff !important;
                color: #000000 !important;
                border: 2px solid #ffffff !important;
            }
            
            body.high-contrast a,
            body.high-contrast [role="link"] {
                color: #00ffff !important;
                text-decoration: underline !important;
            }
            
            /* Reduced motion styles */
            @media (prefers-reduced-motion: reduce) {
                *, *::before, *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            }
            
            body.reduced-motion *, 
            body.reduced-motion *::before, 
            body.reduced-motion *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
                scroll-behavior: auto !important;
            }
            
            /* Large text styles */
            body.large-text {
                font-size: 1.25em !important;
            }
            
            body.large-text * {
                line-height: 1.6 !important;
            }
            
            /* Color blind support */
            body.protanopia {
                filter: url(#protanopia-filter);
            }
            
            body.deuteranopia {
                filter: url(#deuteranopia-filter);
            }
            
            body.tritanopia {
                filter: url(#tritanopia-filter);
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Setup keyboard navigation
    setupKeyboardNavigation() {
        if (!this.config.enableKeyboardNavigation) return;
        
        // Arrow key navigation for lists and grids
        this.addKeyboardHandler('ArrowDown', (event) => {
            this.navigateList('down', event);
        });
        
        this.addKeyboardHandler('ArrowUp', (event) => {
            this.navigateList('up', event);
        });
        
        this.addKeyboardHandler('ArrowRight', (event) => {
            this.navigateList('right', event);
        });
        
        this.addKeyboardHandler('ArrowLeft', (event) => {
            this.navigateList('left', event);
        });
        
        // Home and End navigation
        this.addKeyboardHandler('Home', (event) => {
            this.navigateToFirst(event);
        });
        
        this.addKeyboardHandler('End', (event) => {
            this.navigateToLast(event);
        });
        
        // Escape key handling
        this.addKeyboardHandler('Escape', (event) => {
            this.handleEscape(event);
        });
        
        // Tab trapping for modals
        this.addKeyboardHandler('Tab', (event) => {
            this.handleTabNavigation(event);
        });
        
        // Setup keyboard event listener
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
    }
    
    // Add keyboard handler
    addKeyboardHandler(key, handler) {
        if (!this.keyboardHandlers.has(key)) {
            this.keyboardHandlers.set(key, []);
        }
        this.keyboardHandlers.get(key).push(handler);
    }
    
    // Handle keyboard events
    handleKeyDown(event) {
        const handlers = this.keyboardHandlers.get(event.key);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(event);
                } catch (error) {
                    console.error('Keyboard handler error:', error);
                }
            });
        }
    }
    
    // Navigate lists with arrow keys
    navigateList(direction, event) {
        const activeElement = document.activeElement;
        const container = activeElement.closest('[role="listbox"], [role="grid"], [role="menu"], .nav-tabs, .list-group');
        
        if (!container) return;
        
        const items = container.querySelectorAll('[role="option"], [role="gridcell"], [role="menuitem"], [tabindex], button, a');
        const currentIndex = Array.from(items).indexOf(activeElement);
        
        if (currentIndex === -1) return;
        
        let nextIndex = currentIndex;
        const gridCols = parseInt(container.getAttribute('aria-colcount')) || 1;
        
        switch (direction) {
            case 'down':
                nextIndex = gridCols > 1 ? currentIndex + gridCols : currentIndex + 1;
                break;
            case 'up':
                nextIndex = gridCols > 1 ? currentIndex - gridCols : currentIndex - 1;
                break;
            case 'right':
                nextIndex = currentIndex + 1;
                break;
            case 'left':
                nextIndex = currentIndex - 1;
                break;
        }
        
        // Wrap around if needed
        if (nextIndex < 0) nextIndex = items.length - 1;
        if (nextIndex >= items.length) nextIndex = 0;
        
        if (items[nextIndex]) {
            event.preventDefault();
            items[nextIndex].focus();
        }
    }
    
    // Navigate to first item
    navigateToFirst(event) {
        const activeElement = document.activeElement;
        const container = activeElement.closest('[role="listbox"], [role="grid"], [role="menu"]');
        
        if (container) {
            const firstItem = container.querySelector('[role="option"], [role="gridcell"], [role="menuitem"]');
            if (firstItem) {
                event.preventDefault();
                firstItem.focus();
            }
        }
    }
    
    // Navigate to last item
    navigateToLast(event) {
        const activeElement = document.activeElement;
        const container = activeElement.closest('[role="listbox"], [role="grid"], [role="menu"]');
        
        if (container) {
            const items = container.querySelectorAll('[role="option"], [role="gridcell"], [role="menuitem"]');
            const lastItem = items[items.length - 1];
            if (lastItem) {
                event.preventDefault();
                lastItem.focus();
            }
        }
    }
    
    // Handle escape key
    handleEscape(event) {
        // Close modals or dropdowns
        const modal = document.querySelector('.modal.show, .dropdown.show, [aria-expanded="true"]');
        if (modal) {
            event.preventDefault();
            this.closeModal(modal);
        }
    }
    
    // Setup focus trapping
    setupFocusTrapping() {
        this.trapFocus = (container) => {
            const focusableElements = container.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            
            const firstFocusable = focusableElements[0];
            const lastFocusable = focusableElements[focusableElements.length - 1];
            
            const handleTabKey = (event) => {
                if (event.key !== 'Tab') return;
                
                if (event.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        event.preventDefault();
                        lastFocusable.focus();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        event.preventDefault();
                        firstFocusable.focus();
                    }
                }
            };
            
            container.addEventListener('keydown', handleTabKey);
            
            return () => {
                container.removeEventListener('keydown', handleTabKey);
            };
        };
    }
    
    // Setup high contrast mode
    setupHighContrastMode() {
        if (!this.config.enableHighContrast) return;
        
        this.toggleHighContrast = (enabled) => {
            this.accessibilityState.highContrast = enabled;
            
            if (enabled) {
                document.body.classList.add('high-contrast');
                this.announce('High contrast mode enabled');
            } else {
                document.body.classList.remove('high-contrast');
                this.announce('High contrast mode disabled');
            }
            
            this.emit('accessibility:high_contrast_changed', { enabled });
        };
    }
    
    // Setup reduced motion support
    setupReducedMotionSupport() {
        if (!this.config.enableReducedMotion) return;
        
        this.toggleReducedMotion = (enabled) => {
            this.accessibilityState.reducedMotion = enabled;
            
            if (enabled) {
                document.body.classList.add('reduced-motion');
                this.announce('Reduced motion enabled');
            } else {
                document.body.classList.remove('reduced-motion');
                this.announce('Reduced motion disabled');
            }
            
            this.emit('accessibility:reduced_motion_changed', { enabled });
        };
        
        // Check system preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.toggleReducedMotion(prefersReducedMotion.matches);
        
        prefersReducedMotion.addEventListener('change', (e) => {
            this.toggleReducedMotion(e.matches);
        });
    }
    
    // Setup text scaling
    setupTextScaling() {
        this.toggleLargeText = (enabled) => {
            this.accessibilityState.largeText = enabled;
            
            if (enabled) {
                document.body.classList.add('large-text');
                this.announce('Large text enabled');
            } else {
                document.body.classList.remove('large-text');
                this.announce('Large text disabled');
            }
            
            this.emit('accessibility:large_text_changed', { enabled });
        };
        
        this.setFontSize = (scale) => {
            document.documentElement.style.fontSize = `${scale}em`;
            this.announce(`Font size set to ${scale * 100}%`);
            this.emit('accessibility:font_size_changed', { scale });
        };
    }
    
    // Setup color blind support
    setupColorBlindSupport() {
        this.createColorBlindFilters();
        
        this.toggleColorBlindSupport = (type) => {
            // Remove existing filters
            document.body.classList.remove('protanopia', 'deuteranopia', 'tritanopia');
            
            if (type && type !== 'none') {
                document.body.classList.add(type);
                this.accessibilityState.colorBlindSupport = type;
                this.announce(`Color blind support enabled: ${type}`);
            } else {
                this.accessibilityState.colorBlindSupport = false;
                this.announce('Color blind support disabled');
            }
            
            this.emit('accessibility:color_blind_support_changed', { type });
        };
    }
    
    // Create SVG filters for color blindness simulation
    createColorBlindFilters() {
        if (document.getElementById('accessibility-filters')) return;
        
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'accessibility-filters';
        svg.style.cssText = 'position: absolute; width: 0; height: 0;';
        
        svg.innerHTML = `
            <defs>
                <filter id="protanopia-filter">
                    <feColorMatrix type="matrix" values="0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0"/>
                </filter>
                <filter id="deuteranopia-filter">
                    <feColorMatrix type="matrix" values="0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0"/>
                </filter>
                <filter id="tritanopia-filter">
                    <feColorMatrix type="matrix" values="0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0"/>
                </filter>
            </defs>
        `;
        
        document.body.appendChild(svg);
    }
    
    // Initialize ARIA labels
    initializeAriaLabels() {
        if (!this.config.enableAriaLabels) return;
        
        // Add ARIA labels to common elements
        this.addAriaLabelsToButtons();
        this.addAriaLabelsToForms();
        this.addAriaLabelsToNavigation();
        this.addAriaLabelsToTables();
        this.addLandmarkRoles();
    }
    
    // Add ARIA labels to buttons
    addAriaLabelsToButtons() {
        const buttons = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
        buttons.forEach(button => {
            const text = button.textContent.trim();
            const icon = button.querySelector('i, svg, .icon');
            
            if (!text && icon) {
                // Button with only icon needs aria-label
                const title = button.title || button.getAttribute('data-tooltip') || 'Button';
                button.setAttribute('aria-label', title);
            } else if (text) {
                button.setAttribute('aria-label', text);
            }
        });
    }
    
    // Add ARIA labels to forms
    addAriaLabelsToForms() {
        const inputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
        inputs.forEach(input => {
            const label = document.querySelector(`label[for="${input.id}"]`);
            const placeholder = input.placeholder;
            const type = input.type;
            
            if (label) {
                input.setAttribute('aria-labelledby', label.id || this.generateId('label'));
                if (!label.id) {
                    label.id = input.getAttribute('aria-labelledby');
                }
            } else if (placeholder) {
                input.setAttribute('aria-label', placeholder);
            } else {
                input.setAttribute('aria-label', `${type} field`);
            }
            
            // Add required indicator
            if (input.required) {
                const currentLabel = input.getAttribute('aria-label') || label?.textContent || '';
                input.setAttribute('aria-label', `${currentLabel} (required)`);
            }
        });
    }
    
    // Add ARIA labels to navigation
    addAriaLabelsToNavigation() {
        const navs = document.querySelectorAll('nav:not([aria-label])');
        navs.forEach((nav, index) => {
            const heading = nav.querySelector('h1, h2, h3, h4, h5, h6');
            if (heading) {
                nav.setAttribute('aria-labelledby', heading.id || this.generateId('nav-heading'));
                if (!heading.id) {
                    heading.id = nav.getAttribute('aria-labelledby');
                }
            } else {
                nav.setAttribute('aria-label', `Navigation ${index + 1}`);
            }
        });
        
        // Add role to navigation lists
        const navLists = document.querySelectorAll('nav ul:not([role])');
        navLists.forEach(list => {
            list.setAttribute('role', 'menubar');
            
            const items = list.querySelectorAll('li:not([role])');
            items.forEach(item => {
                item.setAttribute('role', 'none');
                const link = item.querySelector('a');
                if (link) {
                    link.setAttribute('role', 'menuitem');
                }
            });
        });
    }
    
    // Add ARIA labels to tables
    addAriaLabelsToTables() {
        const tables = document.querySelectorAll('table:not([aria-label]):not([aria-labelledby])');
        tables.forEach((table, index) => {
            const caption = table.querySelector('caption');
            if (caption) {
                table.setAttribute('aria-labelledby', caption.id || this.generateId('table-caption'));
                if (!caption.id) {
                    caption.id = table.getAttribute('aria-labelledby');
                }
            } else {
                table.setAttribute('aria-label', `Data table ${index + 1}`);
            }
            
            // Add scope to headers
            const headers = table.querySelectorAll('th:not([scope])');
            headers.forEach(header => {
                const isRowHeader = header.parentElement.querySelector('th') === header;
                header.setAttribute('scope', isRowHeader ? 'row' : 'col');
            });
        });
    }
    
    // Add landmark roles
    addLandmarkRoles() {
        // Main content
        const main = document.querySelector('main, #main, .main-content');
        if (main && !main.getAttribute('role')) {
            main.setAttribute('role', 'main');
        }
        
        // Header
        const header = document.querySelector('header, .header, .page-header');
        if (header && !header.getAttribute('role')) {
            header.setAttribute('role', 'banner');
        }
        
        // Footer
        const footer = document.querySelector('footer, .footer, .page-footer');
        if (footer && !footer.getAttribute('role')) {
            footer.setAttribute('role', 'contentinfo');
        }
        
        // Sidebar/complementary content
        const sidebar = document.querySelector('aside, .sidebar, .complementary');
        if (sidebar && !sidebar.getAttribute('role')) {
            sidebar.setAttribute('role', 'complementary');
        }
    }
    
    // Setup skip links
    setupSkipLinks() {
        if (document.querySelector('.skip-link')) return;
        
        const skipLink = document.createElement('a');
        skipLink.href = '#main';
        skipLink.className = 'skip-link';
        skipLink.textContent = 'Skip to main content';
        skipLink.setAttribute('aria-label', 'Skip to main content');
        
        document.body.insertBefore(skipLink, document.body.firstChild);
        
        // Ensure main content has an ID
        let main = document.querySelector('#main');
        if (!main) {
            main = document.querySelector('main, .main-content, .container');
            if (main) {
                main.id = 'main';
            }
        }
    }
    
    // Detect system accessibility preferences
    detectSystemPreferences() {
        // High contrast preference
        const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
        if (prefersHighContrast.matches) {
            this.toggleHighContrast(true);
        }
        
        // Reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (prefersReducedMotion.matches) {
            this.toggleReducedMotion(true);
        }
        
        // Color scheme preference
        const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');
        this.emit('accessibility:color_scheme_preference', { 
            dark: prefersDarkMode.matches 
        });
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Listen for dynamic content changes
        if (typeof MutationObserver !== 'undefined') {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        // Re-initialize ARIA labels for new content
                        setTimeout(() => {
                            this.initializeAriaLabels();
                        }, 100);
                    }
                });
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }
    
    // Check color contrast ratio
    checkColorContrast(foreground, background) {
        const getLuminance = (hex) => {
            const rgb = this.hexToRgb(hex);
            const sRGB = [rgb.r, rgb.g, rgb.b].map(c => {
                c = c / 255;
                return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
        };
        
        const l1 = getLuminance(foreground);
        const l2 = getLuminance(background);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        
        return {
            ratio: ratio,
            aa: ratio >= this.contrastRatios.normal,
            aaLarge: ratio >= this.contrastRatios.large,
            aaa: ratio >= this.contrastRatios.enhanced
        };
    }
    
    // Convert hex color to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
    
    // Generate unique ID
    generateId(prefix = 'element') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Get accessibility state
    getAccessibilityState() {
        return { ...this.accessibilityState };
    }
    
    // Update accessibility setting
    updateAccessibilitySetting(setting, value) {
        this.accessibilityState[setting] = value;
        
        // Apply the setting
        switch (setting) {
            case 'highContrast':
                this.toggleHighContrast(value);
                break;
            case 'reducedMotion':
                this.toggleReducedMotion(value);
                break;
            case 'largeText':
                this.toggleLargeText(value);
                break;
            case 'colorBlindSupport':
                this.toggleColorBlindSupport(value);
                break;
        }
        
        this.emit('accessibility:setting_changed', { setting, value });
    }
    
    // Validate accessibility compliance
    validateAccessibility() {
        const issues = [];
        
        // Check for missing alt text
        const images = document.querySelectorAll('img:not([alt])');
        if (images.length > 0) {
            issues.push({
                type: 'missing_alt_text',
                count: images.length,
                elements: Array.from(images)
            });
        }
        
        // Check for missing form labels
        const unlabeledInputs = document.querySelectorAll('input:not([aria-label]):not([aria-labelledby])');
        if (unlabeledInputs.length > 0) {
            issues.push({
                type: 'missing_form_labels',
                count: unlabeledInputs.length,
                elements: Array.from(unlabeledInputs)
            });
        }
        
        // Check for missing headings structure
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length === 0) {
            issues.push({
                type: 'missing_headings',
                message: 'No heading structure found'
            });
        }
        
        // Check for proper heading hierarchy
        let lastLevel = 0;
        Array.from(headings).forEach(heading => {
            const level = parseInt(heading.tagName.substr(1));
            if (level > lastLevel + 1) {
                issues.push({
                    type: 'heading_hierarchy_skip',
                    element: heading,
                    message: `Heading skips from h${lastLevel} to h${level}`
                });
            }
            lastLevel = level;
        });
        
        return {
            isCompliant: issues.length === 0,
            issues,
            timestamp: new Date()
        };
    }
    
    // Generate accessibility report
    generateAccessibilityReport() {
        const validation = this.validateAccessibility();
        const state = this.getAccessibilityState();
        
        return {
            timestamp: new Date(),
            state,
            validation,
            features: {
                highContrastAvailable: this.config.enableHighContrast,
                screenReaderSupport: this.config.enableScreenReader,
                keyboardNavigation: this.config.enableKeyboardNavigation,
                focusManagement: this.config.enableFocusManagement,
                reducedMotionSupport: this.config.enableReducedMotion
            },
            compliance: {
                wcag21AA: validation.isCompliant,
                issueCount: validation.issues.length,
                criticalIssues: validation.issues.filter(issue => 
                    ['missing_alt_text', 'missing_form_labels'].includes(issue.type)
                ).length
            }
        };
    }
}

module.exports = AccessibilityManager;