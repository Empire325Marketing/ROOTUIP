/**
 * ROOTUIP Personalization Engine
 * Advanced user customization and preference management
 */

const EventEmitter = require('events');

class PersonalizationEngine extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            storageType: config.storageType || 'localStorage', // localStorage, database, redis
            autoSave: config.autoSave !== false,
            saveInterval: config.saveInterval || 5000, // 5 seconds
            enableAnalytics: config.enableAnalytics !== false
        };
        
        // User preferences store
        this.userPreferences = new Map();
        
        // Dashboard layouts store
        this.dashboardLayouts = new Map();
        
        // Saved views and filters
        this.savedViews = new Map();
        
        // Workflow customizations
        this.workflowCustomizations = new Map();
        
        // Role-based configurations
        this.roleConfigurations = new Map();
        
        // Usage analytics
        this.usageAnalytics = new Map();
        
        // Default configurations
        this.initializeDefaults();
        
        // Auto-save timer
        if (this.config.autoSave) {
            this.startAutoSave();
        }
    }
    
    // Initialize default configurations
    initializeDefaults() {
        // Default role configurations
        this.roleConfigurations.set('admin', {
            dashboardLayout: 'admin-full',
            enabledFeatures: ['user-management', 'system-settings', 'analytics', 'reporting'],
            defaultViews: {
                shipments: 'admin-overview',
                users: 'detailed-list',
                analytics: 'executive-summary'
            },
            permissions: {
                canExport: true,
                canBulkEdit: true,
                canManageUsers: true,
                canAccessReports: true
            }
        });
        
        this.roleConfigurations.set('logistics_manager', {
            dashboardLayout: 'operations-focused',
            enabledFeatures: ['shipment-tracking', 'carrier-management', 'reporting'],
            defaultViews: {
                shipments: 'operations-board',
                carriers: 'performance-view',
                analytics: 'operations-kpi'
            },
            permissions: {
                canExport: true,
                canBulkEdit: true,
                canManageUsers: false,
                canAccessReports: true
            }
        });
        
        this.roleConfigurations.set('customer_service', {
            dashboardLayout: 'customer-focused',
            enabledFeatures: ['shipment-tracking', 'customer-communication', 'issue-management'],
            defaultViews: {
                shipments: 'customer-view',
                communications: 'timeline-view',
                issues: 'priority-queue'
            },
            permissions: {
                canExport: true,
                canBulkEdit: false,
                canManageUsers: false,
                canAccessReports: false
            }
        });
        
        this.roleConfigurations.set('customer', {
            dashboardLayout: 'simple-tracking',
            enabledFeatures: ['shipment-tracking', 'notifications'],
            defaultViews: {
                shipments: 'my-shipments',
                notifications: 'recent-updates'
            },
            permissions: {
                canExport: false,
                canBulkEdit: false,
                canManageUsers: false,
                canAccessReports: false
            }
        });
        
        // Default dashboard layouts
        this.initializeDefaultLayouts();
        
        // Default themes
        this.initializeDefaultThemes();
    }
    
    // Initialize default dashboard layouts
    initializeDefaultLayouts() {
        // Admin full layout
        this.dashboardLayouts.set('admin-full', {
            name: 'Admin Dashboard',
            description: 'Complete administrative overview',
            layout: {
                rows: 4,
                columns: 4,
                widgets: [
                    { id: 'system-status', x: 0, y: 0, w: 2, h: 1, type: 'status-overview' },
                    { id: 'user-analytics', x: 2, y: 0, w: 2, h: 1, type: 'user-metrics' },
                    { id: 'shipment-overview', x: 0, y: 1, w: 4, h: 1, type: 'shipment-summary' },
                    { id: 'performance-charts', x: 0, y: 2, w: 3, h: 2, type: 'performance-dashboard' },
                    { id: 'recent-activities', x: 3, y: 2, w: 1, h: 2, type: 'activity-feed' }
                ]
            }
        });
        
        // Operations focused layout
        this.dashboardLayouts.set('operations-focused', {
            name: 'Operations Dashboard',
            description: 'Logistics operations management',
            layout: {
                rows: 3,
                columns: 4,
                widgets: [
                    { id: 'active-shipments', x: 0, y: 0, w: 2, h: 1, type: 'shipment-board' },
                    { id: 'carrier-performance', x: 2, y: 0, w: 2, h: 1, type: 'carrier-metrics' },
                    { id: 'shipment-map', x: 0, y: 1, w: 3, h: 2, type: 'tracking-map' },
                    { id: 'alerts-issues', x: 3, y: 1, w: 1, h: 2, type: 'alerts-panel' }
                ]
            }
        });
        
        // Customer focused layout
        this.dashboardLayouts.set('customer-focused', {
            name: 'Customer Service Dashboard',
            description: 'Customer support and communication',
            layout: {
                rows: 3,
                columns: 3,
                widgets: [
                    { id: 'customer-shipments', x: 0, y: 0, w: 2, h: 1, type: 'customer-tracking' },
                    { id: 'communication-hub', x: 2, y: 0, w: 1, h: 2, type: 'communication-panel' },
                    { id: 'issue-queue', x: 0, y: 1, w: 2, h: 1, type: 'support-tickets' },
                    { id: 'knowledge-base', x: 0, y: 2, w: 3, h: 1, type: 'knowledge-panel' }
                ]
            }
        });
        
        // Simple tracking layout
        this.dashboardLayouts.set('simple-tracking', {
            name: 'Customer Portal',
            description: 'Simple shipment tracking',
            layout: {
                rows: 2,
                columns: 2,
                widgets: [
                    { id: 'my-shipments', x: 0, y: 0, w: 2, h: 1, type: 'shipment-list' },
                    { id: 'tracking-details', x: 0, y: 1, w: 2, h: 1, type: 'tracking-timeline' }
                ]
            }
        });
    }
    
    // Initialize default themes
    initializeDefaultThemes() {
        this.themes = {
            'default': {
                name: 'ROOTUIP Default',
                colors: {
                    primary: '#00d4ff',
                    secondary: '#1a1f35',
                    background: '#0a0e1a',
                    surface: '#1a1f35',
                    text: '#e0e0e0',
                    textSecondary: '#a0a0a0'
                },
                fonts: {
                    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    monospace: '"SF Mono", "Monaco", "Inconsolata", monospace'
                }
            },
            'light': {
                name: 'Light Mode',
                colors: {
                    primary: '#0066cc',
                    secondary: '#f5f5f5',
                    background: '#ffffff',
                    surface: '#f8f9fa',
                    text: '#212529',
                    textSecondary: '#6c757d'
                },
                fonts: {
                    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    monospace: '"SF Mono", "Monaco", "Inconsolata", monospace'
                }
            },
            'high-contrast': {
                name: 'High Contrast',
                colors: {
                    primary: '#ffff00',
                    secondary: '#000000',
                    background: '#000000',
                    surface: '#1a1a1a',
                    text: '#ffffff',
                    textSecondary: '#cccccc'
                },
                fonts: {
                    primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    monospace: '"SF Mono", "Monaco", "Inconsolata", monospace'
                }
            }
        };
    }
    
    // Get user preferences
    getUserPreferences(userId) {
        if (!this.userPreferences.has(userId)) {
            this.initializeUserPreferences(userId);
        }
        return this.userPreferences.get(userId);
    }
    
    // Initialize user preferences
    initializeUserPreferences(userId, role = 'customer') {
        const roleConfig = this.roleConfigurations.get(role) || this.roleConfigurations.get('customer');
        
        const defaultPreferences = {
            userId,
            role,
            theme: 'default',
            language: 'en',
            timezone: 'UTC',
            dateFormat: 'MM/DD/YYYY',
            timeFormat: '12h',
            notifications: {
                email: true,
                push: true,
                sms: false,
                whatsapp: false
            },
            dashboard: {
                layout: roleConfig.dashboardLayout,
                autoRefresh: true,
                refreshInterval: 30000, // 30 seconds
                compactMode: false
            },
            interface: {
                enableKeyboardShortcuts: true,
                enableTooltips: true,
                enableAnimations: true,
                sidebarCollapsed: false,
                fontSize: 'medium', // small, medium, large
                density: 'comfortable' // compact, comfortable, spacious
            },
            accessibility: {
                highContrast: false,
                reducedMotion: false,
                screenReader: false,
                largeText: false,
                keyboardNavigation: true
            },
            privacy: {
                allowAnalytics: true,
                allowTracking: false,
                shareUsageData: true
            },
            workflow: {
                defaultFilters: {},
                quickActions: [],
                customColumns: {}
            },
            lastModified: new Date(),
            version: '1.0.0'
        };
        
        this.userPreferences.set(userId, defaultPreferences);
        this.emit('preferences:initialized', { userId, preferences: defaultPreferences });
        
        return defaultPreferences;
    }
    
    // Update user preferences
    updateUserPreferences(userId, updates) {
        const preferences = this.getUserPreferences(userId);
        
        // Deep merge updates
        const updatedPreferences = this.deepMerge(preferences, updates);
        updatedPreferences.lastModified = new Date();
        
        this.userPreferences.set(userId, updatedPreferences);
        
        // Track analytics
        if (this.config.enableAnalytics) {
            this.trackPreferenceChange(userId, updates);
        }
        
        this.emit('preferences:updated', { userId, updates, preferences: updatedPreferences });
        
        return updatedPreferences;
    }
    
    // Get dashboard layout
    getDashboardLayout(userId, layoutId = null) {
        const preferences = this.getUserPreferences(userId);
        const targetLayoutId = layoutId || preferences.dashboard.layout;
        
        // Check for custom layout first
        const customLayoutKey = `${userId}:${targetLayoutId}`;
        if (this.dashboardLayouts.has(customLayoutKey)) {
            return this.dashboardLayouts.get(customLayoutKey);
        }
        
        // Return default layout
        return this.dashboardLayouts.get(targetLayoutId) || this.dashboardLayouts.get('simple-tracking');
    }
    
    // Save dashboard layout
    saveDashboardLayout(userId, layoutId, layout) {
        const customLayoutKey = `${userId}:${layoutId}`;
        
        const layoutConfig = {
            ...layout,
            id: layoutId,
            userId,
            isCustom: true,
            created: new Date(),
            lastModified: new Date()
        };
        
        this.dashboardLayouts.set(customLayoutKey, layoutConfig);
        
        // Update user preferences to use this layout
        this.updateUserPreferences(userId, {
            dashboard: { layout: layoutId }
        });
        
        this.emit('layout:saved', { userId, layoutId, layout: layoutConfig });
        
        return layoutConfig;
    }
    
    // Clone dashboard layout
    cloneDashboardLayout(userId, sourceLayoutId, newLayoutId, newName) {
        const sourceLayout = this.getDashboardLayout(userId, sourceLayoutId);
        
        if (!sourceLayout) {
            throw new Error('Source layout not found');
        }
        
        const clonedLayout = {
            ...JSON.parse(JSON.stringify(sourceLayout)),
            name: newName,
            description: `Cloned from ${sourceLayout.name}`,
            id: newLayoutId
        };
        
        return this.saveDashboardLayout(userId, newLayoutId, clonedLayout);
    }
    
    // Save view/filter
    saveView(userId, viewId, viewConfig) {
        const viewKey = `${userId}:${viewId}`;
        
        const savedView = {
            id: viewId,
            userId,
            name: viewConfig.name,
            description: viewConfig.description,
            page: viewConfig.page,
            filters: viewConfig.filters,
            columns: viewConfig.columns,
            sorting: viewConfig.sorting,
            grouping: viewConfig.grouping,
            isPublic: viewConfig.isPublic || false,
            created: new Date(),
            lastUsed: new Date()
        };
        
        this.savedViews.set(viewKey, savedView);
        
        this.emit('view:saved', { userId, viewId, view: savedView });
        
        return savedView;
    }
    
    // Get saved views
    getSavedViews(userId, page = null) {
        const userViews = [];
        
        for (const [key, view] of this.savedViews) {
            if (key.startsWith(`${userId}:`)) {
                if (!page || view.page === page) {
                    userViews.push(view);
                }
            }
        }
        
        return userViews.sort((a, b) => b.lastUsed - a.lastUsed);
    }
    
    // Apply saved view
    applySavedView(userId, viewId) {
        const viewKey = `${userId}:${viewId}`;
        const view = this.savedViews.get(viewKey);
        
        if (!view) {
            throw new Error('Saved view not found');
        }
        
        // Update last used
        view.lastUsed = new Date();
        this.savedViews.set(viewKey, view);
        
        this.emit('view:applied', { userId, viewId, view });
        
        return view;
    }
    
    // Customize workflow
    customizeWorkflow(userId, workflowId, customization) {
        const workflowKey = `${userId}:${workflowId}`;
        
        const workflowConfig = {
            id: workflowId,
            userId,
            customization,
            created: new Date(),
            lastModified: new Date()
        };
        
        this.workflowCustomizations.set(workflowKey, workflowConfig);
        
        this.emit('workflow:customized', { userId, workflowId, customization: workflowConfig });
        
        return workflowConfig;
    }
    
    // Get workflow customization
    getWorkflowCustomization(userId, workflowId) {
        const workflowKey = `${userId}:${workflowId}`;
        return this.workflowCustomizations.get(workflowKey);
    }
    
    // Track usage analytics
    trackUsage(userId, action, data = {}) {
        if (!this.config.enableAnalytics) return;
        
        const analyticsKey = `${userId}:${new Date().toDateString()}`;
        
        if (!this.usageAnalytics.has(analyticsKey)) {
            this.usageAnalytics.set(analyticsKey, {
                userId,
                date: new Date().toDateString(),
                actions: [],
                pageViews: 0,
                timeSpent: 0
            });
        }
        
        const analytics = this.usageAnalytics.get(analyticsKey);
        analytics.actions.push({
            action,
            data,
            timestamp: new Date()
        });
        
        this.emit('analytics:tracked', { userId, action, data });
    }
    
    // Track preference changes for optimization
    trackPreferenceChange(userId, changes) {
        this.trackUsage(userId, 'preference_change', {
            changes: Object.keys(changes),
            timestamp: new Date()
        });
    }
    
    // Get usage analytics
    getUsageAnalytics(userId, days = 7) {
        const analytics = [];
        const now = new Date();
        
        for (let i = 0; i < days; i++) {
            const date = new Date(now - i * 24 * 60 * 60 * 1000);
            const analyticsKey = `${userId}:${date.toDateString()}`;
            
            if (this.usageAnalytics.has(analyticsKey)) {
                analytics.push(this.usageAnalytics.get(analyticsKey));
            }
        }
        
        return analytics;
    }
    
    // Generate personalization recommendations
    generateRecommendations(userId) {
        const preferences = this.getUserPreferences(userId);
        const analytics = this.getUsageAnalytics(userId, 30);
        const recommendations = [];
        
        // Analyze usage patterns
        const actionCounts = {};
        analytics.forEach(day => {
            day.actions.forEach(action => {
                actionCounts[action.action] = (actionCounts[action.action] || 0) + 1;
            });
        });
        
        // Theme recommendations
        if (actionCounts.night_usage > actionCounts.day_usage) {
            recommendations.push({
                type: 'theme',
                title: 'Dark Theme Recommendation',
                description: 'Based on your usage patterns, you might prefer the dark theme.',
                action: 'switch_to_dark_theme',
                priority: 'medium'
            });
        }
        
        // Layout recommendations
        if (actionCounts.shipment_view > actionCounts.dashboard_view * 2) {
            recommendations.push({
                type: 'layout',
                title: 'Shipment-Focused Layout',
                description: 'Consider switching to a shipment-focused dashboard layout.',
                action: 'suggest_operations_layout',
                priority: 'high'
            });
        }
        
        // Keyboard shortcut recommendations
        if (!preferences.interface.enableKeyboardShortcuts && actionCounts.click_action > 50) {
            recommendations.push({
                type: 'productivity',
                title: 'Enable Keyboard Shortcuts',
                description: 'Keyboard shortcuts can speed up your workflow significantly.',
                action: 'enable_shortcuts',
                priority: 'medium'
            });
        }
        
        return recommendations;
    }
    
    // Export user configuration
    exportUserConfiguration(userId) {
        const preferences = this.getUserPreferences(userId);
        const customLayouts = [];
        const savedViews = this.getSavedViews(userId);
        const workflowCustomizations = [];
        
        // Get custom layouts
        for (const [key, layout] of this.dashboardLayouts) {
            if (key.startsWith(`${userId}:`) && layout.isCustom) {
                customLayouts.push(layout);
            }
        }
        
        // Get workflow customizations
        for (const [key, workflow] of this.workflowCustomizations) {
            if (key.startsWith(`${userId}:`)) {
                workflowCustomizations.push(workflow);
            }
        }
        
        return {
            userId,
            exportDate: new Date(),
            version: '1.0.0',
            preferences,
            customLayouts,
            savedViews,
            workflowCustomizations
        };
    }
    
    // Import user configuration
    importUserConfiguration(userId, configuration) {
        try {
            // Import preferences
            if (configuration.preferences) {
                this.userPreferences.set(userId, {
                    ...configuration.preferences,
                    userId,
                    lastModified: new Date()
                });
            }
            
            // Import custom layouts
            if (configuration.customLayouts) {
                configuration.customLayouts.forEach(layout => {
                    const layoutKey = `${userId}:${layout.id}`;
                    this.dashboardLayouts.set(layoutKey, {
                        ...layout,
                        userId,
                        imported: true,
                        lastModified: new Date()
                    });
                });
            }
            
            // Import saved views
            if (configuration.savedViews) {
                configuration.savedViews.forEach(view => {
                    const viewKey = `${userId}:${view.id}`;
                    this.savedViews.set(viewKey, {
                        ...view,
                        userId,
                        imported: true,
                        lastUsed: new Date()
                    });
                });
            }
            
            // Import workflow customizations
            if (configuration.workflowCustomizations) {
                configuration.workflowCustomizations.forEach(workflow => {
                    const workflowKey = `${userId}:${workflow.id}`;
                    this.workflowCustomizations.set(workflowKey, {
                        ...workflow,
                        userId,
                        imported: true,
                        lastModified: new Date()
                    });
                });
            }
            
            this.emit('configuration:imported', { userId, configuration });
            
            return true;
        } catch (error) {
            this.emit('configuration:import_error', { userId, error: error.message });
            throw error;
        }
    }
    
    // Deep merge objects
    deepMerge(target, source) {
        const result = JSON.parse(JSON.stringify(target));
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (result[key] && typeof result[key] === 'object') {
                    result[key] = this.deepMerge(result[key], source[key]);
                } else {
                    result[key] = source[key];
                }
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }
    
    // Start auto-save
    startAutoSave() {
        setInterval(() => {
            this.saveToStorage();
        }, this.config.saveInterval);
    }
    
    // Save to storage
    async saveToStorage() {
        try {
            if (this.config.storageType === 'localStorage' && typeof localStorage !== 'undefined') {
                localStorage.setItem('rootuip_preferences', JSON.stringify(Array.from(this.userPreferences.entries())));
                localStorage.setItem('rootuip_layouts', JSON.stringify(Array.from(this.dashboardLayouts.entries())));
                localStorage.setItem('rootuip_views', JSON.stringify(Array.from(this.savedViews.entries())));
            }
            
            this.emit('storage:saved');
        } catch (error) {
            this.emit('storage:error', { error: error.message });
        }
    }
    
    // Load from storage
    async loadFromStorage() {
        try {
            if (this.config.storageType === 'localStorage' && typeof localStorage !== 'undefined') {
                const preferences = localStorage.getItem('rootuip_preferences');
                if (preferences) {
                    this.userPreferences = new Map(JSON.parse(preferences));
                }
                
                const layouts = localStorage.getItem('rootuip_layouts');
                if (layouts) {
                    const loadedLayouts = new Map(JSON.parse(layouts));
                    // Merge with defaults
                    for (const [key, layout] of loadedLayouts) {
                        this.dashboardLayouts.set(key, layout);
                    }
                }
                
                const views = localStorage.getItem('rootuip_views');
                if (views) {
                    this.savedViews = new Map(JSON.parse(views));
                }
            }
            
            this.emit('storage:loaded');
        } catch (error) {
            this.emit('storage:error', { error: error.message });
        }
    }
    
    // Get available themes
    getAvailableThemes() {
        return Object.keys(this.themes).map(key => ({
            id: key,
            ...this.themes[key]
        }));
    }
    
    // Get theme configuration
    getTheme(themeId) {
        return this.themes[themeId] || this.themes.default;
    }
    
    // Reset user preferences to defaults
    resetUserPreferences(userId, role = null) {
        const currentPreferences = this.getUserPreferences(userId);
        const userRole = role || currentPreferences.role;
        
        // Remove current preferences
        this.userPreferences.delete(userId);
        
        // Initialize with defaults
        const newPreferences = this.initializeUserPreferences(userId, userRole);
        
        this.emit('preferences:reset', { userId, preferences: newPreferences });
        
        return newPreferences;
    }
}

module.exports = PersonalizationEngine;