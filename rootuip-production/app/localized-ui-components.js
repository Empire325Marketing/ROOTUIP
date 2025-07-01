/**
 * ROOTUIP Localized UI Components
 * Multi-language UI components with RTL support
 */

const { InternationalizationManager } = require('./i18n-framework');

// Localized Header Component
class LocalizedHeader {
    constructor(i18nManager) {
        this.i18n = i18nManager;
    }
    
    render(locale, user) {
        const isRTL = this.i18n.isRTL(locale);
        const direction = this.i18n.getTextDirection(locale);
        
        return `
        <header class="header" dir="${direction}" data-locale="${locale}">
            <div class="header-container ${isRTL ? 'rtl' : 'ltr'}">
                <div class="header-brand">
                    <img src="/assets/images/rootuip-logo.svg" alt="ROOTUIP" class="logo">
                    <span class="brand-text">${this.i18n.translate('navigation.dashboard', { locale })}</span>
                </div>
                
                <nav class="header-nav">
                    <a href="/dashboard" class="nav-link">
                        ${this.i18n.translate('navigation.dashboard', { locale })}
                    </a>
                    <a href="/containers" class="nav-link">
                        ${this.i18n.translate('navigation.containers', { locale })}
                    </a>
                    <a href="/analytics" class="nav-link">
                        ${this.i18n.translate('navigation.analytics', { locale })}
                    </a>
                    <a href="/billing" class="nav-link">
                        ${this.i18n.translate('navigation.billing', { locale })}
                    </a>
                </nav>
                
                <div class="header-actions">
                    <!-- Language Selector -->
                    <div class="language-selector">
                        <select id="languageSelect" onchange="changeLanguage(this.value)">
                            ${this.renderLanguageOptions(locale)}
                        </select>
                    </div>
                    
                    <!-- User Menu -->
                    <div class="user-menu">
                        <button class="user-menu-trigger" onclick="toggleUserMenu()">
                            <img src="${user.avatar || '/assets/images/default-avatar.png'}" 
                                 alt="${user.name}" class="user-avatar">
                            <span class="user-name">${user.name}</span>
                            <svg class="chevron ${isRTL ? 'rotate-180' : ''}" width="16" height="16">
                                <path d="M4 6l4 4 4-4" stroke="currentColor" fill="none"/>
                            </svg>
                        </button>
                        
                        <div class="user-menu-dropdown" id="userMenuDropdown">
                            <a href="/settings" class="dropdown-item">
                                ${this.i18n.translate('navigation.settings', { locale })}
                            </a>
                            <a href="/support" class="dropdown-item">
                                ${this.i18n.translate('navigation.support', { locale })}
                            </a>
                            <div class="dropdown-divider"></div>
                            <button onclick="logout()" class="dropdown-item logout-btn">
                                ${this.i18n.translate('navigation.logout', { locale })}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
        
        <style>
            .header {
                background: white;
                border-bottom: 1px solid #e5e7eb;
                position: sticky;
                top: 0;
                z-index: 1000;
            }
            
            .header-container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 0 1rem;
                display: flex;
                align-items: center;
                justify-content: space-between;
                height: 64px;
            }
            
            .header-container.rtl {
                direction: rtl;
            }
            
            .header-brand {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            
            .logo {
                height: 32px;
                width: auto;
            }
            
            .brand-text {
                font-size: 1.25rem;
                font-weight: 600;
                color: #1f2937;
            }
            
            .header-nav {
                display: flex;
                gap: 2rem;
            }
            
            .rtl .header-nav {
                flex-direction: row-reverse;
            }
            
            .nav-link {
                color: #6b7280;
                text-decoration: none;
                font-weight: 500;
                transition: color 0.2s;
            }
            
            .nav-link:hover,
            .nav-link.active {
                color: #1f2937;
            }
            
            .header-actions {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .rtl .header-actions {
                flex-direction: row-reverse;
            }
            
            .language-selector select {
                padding: 0.5rem;
                border: 1px solid #d1d5db;
                border-radius: 0.375rem;
                background: white;
                font-size: 0.875rem;
            }
            
            .user-menu {
                position: relative;
            }
            
            .user-menu-trigger {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem;
                background: none;
                border: none;
                cursor: pointer;
                border-radius: 0.375rem;
                transition: background-color 0.2s;
            }
            
            .user-menu-trigger:hover {
                background-color: #f3f4f6;
            }
            
            .user-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .user-name {
                font-weight: 500;
                color: #1f2937;
            }
            
            .chevron {
                transition: transform 0.2s;
            }
            
            .user-menu-dropdown {
                position: absolute;
                top: 100%;
                right: 0;
                width: 200px;
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 0.5rem;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                padding: 0.5rem;
                display: none;
                z-index: 1000;
            }
            
            .rtl .user-menu-dropdown {
                right: auto;
                left: 0;
            }
            
            .dropdown-item {
                display: block;
                width: 100%;
                padding: 0.5rem 0.75rem;
                text-align: left;
                color: #1f2937;
                text-decoration: none;
                border: none;
                background: none;
                border-radius: 0.25rem;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            
            .rtl .dropdown-item {
                text-align: right;
            }
            
            .dropdown-item:hover {
                background-color: #f3f4f6;
            }
            
            .dropdown-divider {
                height: 1px;
                background-color: #e5e7eb;
                margin: 0.5rem 0;
            }
            
            .logout-btn {
                color: #dc2626;
            }
            
            .logout-btn:hover {
                background-color: #fef2f2;
            }
        </style>`;
    }
    
    renderLanguageOptions(currentLocale) {
        const supportedLocales = this.i18n.getSupportedLocales();
        
        return supportedLocales.map(localeInfo => {
            const selected = localeInfo.locale === currentLocale ? 'selected' : '';
            return `<option value="${localeInfo.locale}" ${selected}>
                ${localeInfo.nativeName}
            </option>`;
        }).join('');
    }
}

// Localized Dashboard Component
class LocalizedDashboard {
    constructor(i18nManager) {
        this.i18n = i18nManager;
    }
    
    render(locale, data) {
        const isRTL = this.i18n.isRTL(locale);
        const direction = this.i18n.getTextDirection(locale);
        const currency = this.i18n.getLocaleCurrency(locale);
        
        return `
        <div class="dashboard" dir="${direction}" data-locale="${locale}">
            <div class="dashboard-header">
                <h1 class="dashboard-title">
                    ${this.i18n.translate('dashboard.title', { locale })}
                </h1>
                <p class="dashboard-welcome">
                    ${this.i18n.translate('dashboard.welcome', { locale })}
                </p>
            </div>
            
            <!-- Metrics Cards -->
            <div class="metrics-grid ${isRTL ? 'rtl' : 'ltr'}">
                <div class="metric-card">
                    <div class="metric-header">
                        <h3 class="metric-title">
                            ${this.i18n.translate('dashboard.totalContainers', { locale })}
                        </h3>
                        <svg class="metric-icon" width="24" height="24">
                            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" fill="none"/>
                        </svg>
                    </div>
                    <div class="metric-value">
                        ${this.i18n.formatNumber(data.totalContainers, locale)}
                    </div>
                    <div class="metric-change positive">
                        +${this.i18n.formatNumber(data.containersGrowth, locale, { 
                            style: 'percent', 
                            minimumFractionDigits: 1 
                        })}
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-header">
                        <h3 class="metric-title">
                            ${this.i18n.translate('dashboard.activeShipments', { locale })}
                        </h3>
                        <svg class="metric-icon" width="24" height="24">
                            <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke="currentColor" fill="none"/>
                        </svg>
                    </div>
                    <div class="metric-value">
                        ${this.i18n.formatNumber(data.activeShipments, locale)}
                    </div>
                    <div class="metric-change neutral">
                        ${this.i18n.formatNumber(data.shipmentsChange, locale, { 
                            signDisplay: 'always' 
                        })}
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-header">
                        <h3 class="metric-title">
                            ${this.i18n.translate('dashboard.alertsCount', { locale })}
                        </h3>
                        <svg class="metric-icon" width="24" height="24">
                            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" fill="none"/>
                        </svg>
                    </div>
                    <div class="metric-value">
                        ${this.i18n.formatNumber(data.alertsCount, locale)}
                    </div>
                    <div class="metric-change ${data.alertsChange > 0 ? 'negative' : 'positive'}">
                        ${this.i18n.formatNumber(data.alertsChange, locale, { 
                            signDisplay: 'always' 
                        })}
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-header">
                        <h3 class="metric-title">
                            ${this.i18n.translate('billing.monthlyRecurring', { locale })}
                        </h3>
                        <svg class="metric-icon" width="24" height="24">
                            <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" stroke="currentColor" fill="none"/>
                        </svg>
                    </div>
                    <div class="metric-value">
                        ${this.i18n.formatCurrency(data.monthlyRevenue, currency, locale)}
                    </div>
                    <div class="metric-change positive">
                        +${this.i18n.formatNumber(data.revenueGrowth, locale, { 
                            style: 'percent', 
                            minimumFractionDigits: 1 
                        })}
                    </div>
                </div>
            </div>
            
            <!-- Quick Actions -->
            <div class="quick-actions ${isRTL ? 'rtl' : 'ltr'}">
                <h2 class="section-title">
                    ${this.i18n.translate('dashboard.quickActions', { locale })}
                </h2>
                <div class="actions-grid">
                    <button class="action-btn primary" onclick="addContainer()">
                        <svg width="20" height="20">
                            <path d="M12 5v14m-7-7h14" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        ${this.i18n.translate('dashboard.addContainer', { locale })}
                    </button>
                    <button class="action-btn secondary" onclick="viewReports()">
                        <svg width="20" height="20">
                            <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H4a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" fill="none"/>
                        </svg>
                        ${this.i18n.translate('dashboard.viewReports', { locale })}
                    </button>
                    <button class="action-btn secondary" onclick="manageAlerts()">
                        <svg width="20" height="20">
                            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke="currentColor" fill="none"/>
                        </svg>
                        ${this.i18n.translate('dashboard.manageAlerts', { locale })}
                    </button>
                </div>
            </div>
            
            <!-- Recent Activity -->
            <div class="recent-activity ${isRTL ? 'rtl' : 'ltr'}">
                <h2 class="section-title">
                    ${this.i18n.translate('dashboard.recentActivity', { locale })}
                </h2>
                <div class="activity-list">
                    ${this.renderActivityItems(locale, data.recentActivity)}
                </div>
            </div>
        </div>
        
        <style>
            .dashboard {
                padding: 2rem;
                max-width: 1200px;
                margin: 0 auto;
            }
            
            .dashboard-header {
                margin-bottom: 2rem;
            }
            
            .dashboard-title {
                font-size: 2rem;
                font-weight: 700;
                color: #1f2937;
                margin-bottom: 0.5rem;
            }
            
            .dashboard-welcome {
                color: #6b7280;
                font-size: 1.125rem;
            }
            
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1.5rem;
                margin-bottom: 3rem;
            }
            
            .metrics-grid.rtl {
                direction: rtl;
            }
            
            .metric-card {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 0.5rem;
                padding: 1.5rem;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            
            .metric-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
            }
            
            .metric-title {
                font-size: 0.875rem;
                font-weight: 500;
                color: #6b7280;
                margin: 0;
            }
            
            .metric-icon {
                color: #9ca3af;
            }
            
            .metric-value {
                font-size: 2rem;
                font-weight: 700;
                color: #1f2937;
                margin-bottom: 0.5rem;
            }
            
            .metric-change {
                font-size: 0.875rem;
                font-weight: 500;
            }
            
            .metric-change.positive {
                color: #059669;
            }
            
            .metric-change.negative {
                color: #dc2626;
            }
            
            .metric-change.neutral {
                color: #6b7280;
            }
            
            .section-title {
                font-size: 1.5rem;
                font-weight: 600;
                color: #1f2937;
                margin-bottom: 1rem;
            }
            
            .quick-actions {
                margin-bottom: 3rem;
            }
            
            .actions-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
            }
            
            .action-btn {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 1rem;
                border: none;
                border-radius: 0.5rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                text-align: left;
            }
            
            .rtl .action-btn {
                text-align: right;
                flex-direction: row-reverse;
            }
            
            .action-btn.primary {
                background: #3b82f6;
                color: white;
            }
            
            .action-btn.primary:hover {
                background: #2563eb;
            }
            
            .action-btn.secondary {
                background: white;
                color: #1f2937;
                border: 1px solid #e5e7eb;
            }
            
            .action-btn.secondary:hover {
                background: #f9fafb;
            }
            
            .activity-list {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 0.5rem;
                overflow: hidden;
            }
            
            .activity-item {
                padding: 1rem;
                border-bottom: 1px solid #f3f4f6;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .rtl .activity-item {
                flex-direction: row-reverse;
            }
            
            .activity-item:last-child {
                border-bottom: none;
            }
            
            .activity-content {
                flex: 1;
            }
            
            .activity-title {
                font-weight: 500;
                color: #1f2937;
                margin-bottom: 0.25rem;
            }
            
            .activity-description {
                font-size: 0.875rem;
                color: #6b7280;
            }
            
            .activity-time {
                font-size: 0.875rem;
                color: #9ca3af;
                white-space: nowrap;
            }
            
            .rtl .activity-time {
                margin-right: 1rem;
                margin-left: 0;
            }
        </style>`;
    }
    
    renderActivityItems(locale, activities) {
        return activities.map(activity => `
            <div class="activity-item">
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-description">${activity.description}</div>
                </div>
                <div class="activity-time">
                    ${this.i18n.formatRelativeTime(new Date(activity.timestamp), locale)}
                </div>
            </div>
        `).join('');
    }
}

// Localized Form Component
class LocalizedForm {
    constructor(i18nManager) {
        this.i18n = i18nManager;
    }
    
    render(locale, formConfig) {
        const isRTL = this.i18n.isRTL(locale);
        const direction = this.i18n.getTextDirection(locale);
        
        return `
        <form class="localized-form ${isRTL ? 'rtl' : 'ltr'}" 
              dir="${direction}" 
              data-locale="${locale}"
              onsubmit="handleFormSubmit(event)">
            <div class="form-header">
                <h2 class="form-title">${formConfig.title}</h2>
                ${formConfig.description ? `<p class="form-description">${formConfig.description}</p>` : ''}
            </div>
            
            <div class="form-fields">
                ${this.renderFormFields(locale, formConfig.fields)}
            </div>
            
            <div class="form-actions">
                <button type="button" class="btn btn-secondary" onclick="cancelForm()">
                    ${this.i18n.translate('common.cancel', { locale })}
                </button>
                <button type="submit" class="btn btn-primary">
                    ${formConfig.submitText || this.i18n.translate('common.submit', { locale })}
                </button>
            </div>
        </form>
        
        <style>
            .localized-form {
                max-width: 600px;
                margin: 0 auto;
                background: white;
                padding: 2rem;
                border-radius: 0.5rem;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            
            .localized-form.rtl {
                direction: rtl;
            }
            
            .form-header {
                margin-bottom: 2rem;
            }
            
            .form-title {
                font-size: 1.5rem;
                font-weight: 600;
                color: #1f2937;
                margin-bottom: 0.5rem;
            }
            
            .form-description {
                color: #6b7280;
                margin: 0;
            }
            
            .form-field {
                margin-bottom: 1.5rem;
            }
            
            .field-label {
                display: block;
                font-weight: 500;
                color: #374151;
                margin-bottom: 0.5rem;
            }
            
            .field-input {
                width: 100%;
                padding: 0.75rem;
                border: 1px solid #d1d5db;
                border-radius: 0.375rem;
                font-size: 1rem;
                transition: border-color 0.2s;
            }
            
            .field-input:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }
            
            .field-error {
                color: #dc2626;
                font-size: 0.875rem;
                margin-top: 0.25rem;
            }
            
            .field-help {
                color: #6b7280;
                font-size: 0.875rem;
                margin-top: 0.25rem;
            }
            
            .form-actions {
                display: flex;
                justify-content: flex-end;
                gap: 1rem;
                margin-top: 2rem;
            }
            
            .rtl .form-actions {
                justify-content: flex-start;
                flex-direction: row-reverse;
            }
            
            .btn {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 0.375rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .btn-primary {
                background: #3b82f6;
                color: white;
            }
            
            .btn-primary:hover {
                background: #2563eb;
            }
            
            .btn-secondary {
                background: white;
                color: #374151;
                border: 1px solid #d1d5db;
            }
            
            .btn-secondary:hover {
                background: #f9fafb;
            }
            
            .checkbox-field,
            .radio-field {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .rtl .checkbox-field,
            .rtl .radio-field {
                flex-direction: row-reverse;
                justify-content: flex-end;
            }
            
            .select-field {
                position: relative;
            }
            
            .select-field select {
                appearance: none;
                background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
                background-position: right 0.5rem center;
                background-repeat: no-repeat;
                background-size: 1.5em 1.5em;
                padding-right: 2.5rem;
            }
            
            .rtl .select-field select {
                background-position: left 0.5rem center;
                padding-right: 0.75rem;
                padding-left: 2.5rem;
            }
        </style>`;
    }
    
    renderFormFields(locale, fields) {
        return fields.map(field => {
            switch (field.type) {
                case 'text':
                case 'email':
                case 'password':
                case 'tel':
                case 'url':
                    return this.renderTextInput(locale, field);
                case 'textarea':
                    return this.renderTextarea(locale, field);
                case 'select':
                    return this.renderSelect(locale, field);
                case 'checkbox':
                    return this.renderCheckbox(locale, field);
                case 'radio':
                    return this.renderRadio(locale, field);
                case 'date':
                case 'datetime-local':
                    return this.renderDateInput(locale, field);
                case 'number':
                    return this.renderNumberInput(locale, field);
                default:
                    return this.renderTextInput(locale, field);
            }
        }).join('');
    }
    
    renderTextInput(locale, field) {
        return `
            <div class="form-field">
                <label for="${field.name}" class="field-label">
                    ${field.label}${field.required ? ' *' : ''}
                </label>
                <input 
                    type="${field.type || 'text'}"
                    id="${field.name}"
                    name="${field.name}"
                    class="field-input"
                    placeholder="${field.placeholder || ''}"
                    ${field.required ? 'required' : ''}
                    ${field.disabled ? 'disabled' : ''}
                    value="${field.value || ''}"
                />
                ${field.help ? `<div class="field-help">${field.help}</div>` : ''}
                <div class="field-error" id="${field.name}-error"></div>
            </div>
        `;
    }
    
    renderTextarea(locale, field) {
        return `
            <div class="form-field">
                <label for="${field.name}" class="field-label">
                    ${field.label}${field.required ? ' *' : ''}
                </label>
                <textarea 
                    id="${field.name}"
                    name="${field.name}"
                    class="field-input"
                    placeholder="${field.placeholder || ''}"
                    rows="${field.rows || 3}"
                    ${field.required ? 'required' : ''}
                    ${field.disabled ? 'disabled' : ''}
                >${field.value || ''}</textarea>
                ${field.help ? `<div class="field-help">${field.help}</div>` : ''}
                <div class="field-error" id="${field.name}-error"></div>
            </div>
        `;
    }
    
    renderSelect(locale, field) {
        const options = field.options.map(option => 
            `<option value="${option.value}" ${option.value === field.value ? 'selected' : ''}>
                ${option.label}
            </option>`
        ).join('');
        
        return `
            <div class="form-field select-field">
                <label for="${field.name}" class="field-label">
                    ${field.label}${field.required ? ' *' : ''}
                </label>
                <select 
                    id="${field.name}"
                    name="${field.name}"
                    class="field-input"
                    ${field.required ? 'required' : ''}
                    ${field.disabled ? 'disabled' : ''}
                >
                    ${field.placeholder ? `<option value="">${field.placeholder}</option>` : ''}
                    ${options}
                </select>
                ${field.help ? `<div class="field-help">${field.help}</div>` : ''}
                <div class="field-error" id="${field.name}-error"></div>
            </div>
        `;
    }
    
    renderCheckbox(locale, field) {
        return `
            <div class="form-field checkbox-field">
                <input 
                    type="checkbox"
                    id="${field.name}"
                    name="${field.name}"
                    value="${field.value || '1'}"
                    ${field.checked ? 'checked' : ''}
                    ${field.required ? 'required' : ''}
                    ${field.disabled ? 'disabled' : ''}
                />
                <label for="${field.name}" class="field-label">
                    ${field.label}${field.required ? ' *' : ''}
                </label>
                ${field.help ? `<div class="field-help">${field.help}</div>` : ''}
                <div class="field-error" id="${field.name}-error"></div>
            </div>
        `;
    }
    
    renderDateInput(locale, field) {
        const dateFormat = this.i18n.getLocaleDateFormat(locale);
        
        return `
            <div class="form-field">
                <label for="${field.name}" class="field-label">
                    ${field.label}${field.required ? ' *' : ''}
                </label>
                <input 
                    type="${field.type}"
                    id="${field.name}"
                    name="${field.name}"
                    class="field-input"
                    ${field.required ? 'required' : ''}
                    ${field.disabled ? 'disabled' : ''}
                    value="${field.value || ''}"
                />
                ${field.help ? `<div class="field-help">${field.help}</div>` : `<div class="field-help">${this.i18n.translate('common.dateFormat', { locale, values: { format: dateFormat } })}</div>`}
                <div class="field-error" id="${field.name}-error"></div>
            </div>
        `;
    }
    
    renderNumberInput(locale, field) {
        const numberFormat = this.i18n.getLocaleNumberFormat(locale);
        
        return `
            <div class="form-field">
                <label for="${field.name}" class="field-label">
                    ${field.label}${field.required ? ' *' : ''}
                </label>
                <input 
                    type="number"
                    id="${field.name}"
                    name="${field.name}"
                    class="field-input"
                    placeholder="${field.placeholder || ''}"
                    ${field.min !== undefined ? `min="${field.min}"` : ''}
                    ${field.max !== undefined ? `max="${field.max}"` : ''}
                    ${field.step !== undefined ? `step="${field.step}"` : ''}
                    ${field.required ? 'required' : ''}
                    ${field.disabled ? 'disabled' : ''}
                    value="${field.value || ''}"
                />
                ${field.help ? `<div class="field-help">${field.help}</div>` : ''}
                <div class="field-error" id="${field.name}-error"></div>
            </div>
        `;
    }
}

// RTL Layout Manager
class RTLLayoutManager {
    constructor(i18nManager) {
        this.i18n = i18nManager;
    }
    
    applyRTLStyles(locale) {
        const isRTL = this.i18n.isRTL(locale);
        
        if (isRTL) {
            document.documentElement.setAttribute('dir', 'rtl');
            document.documentElement.classList.add('rtl');
            this.injectRTLStyles();
        } else {
            document.documentElement.setAttribute('dir', 'ltr');
            document.documentElement.classList.remove('rtl');
            this.removeRTLStyles();
        }
    }
    
    injectRTLStyles() {
        if (document.getElementById('rtl-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'rtl-styles';
        style.textContent = `
            /* RTL Global Styles */
            .rtl {
                direction: rtl;
            }
            
            .rtl .flex {
                flex-direction: row-reverse;
            }
            
            .rtl .text-left {
                text-align: right;
            }
            
            .rtl .text-right {
                text-align: left;
            }
            
            .rtl .float-left {
                float: right;
            }
            
            .rtl .float-right {
                float: left;
            }
            
            .rtl .ml-1 { margin-left: 0; margin-right: 0.25rem; }
            .rtl .ml-2 { margin-left: 0; margin-right: 0.5rem; }
            .rtl .ml-3 { margin-left: 0; margin-right: 0.75rem; }
            .rtl .ml-4 { margin-left: 0; margin-right: 1rem; }
            
            .rtl .mr-1 { margin-right: 0; margin-left: 0.25rem; }
            .rtl .mr-2 { margin-right: 0; margin-left: 0.5rem; }
            .rtl .mr-3 { margin-right: 0; margin-left: 0.75rem; }
            .rtl .mr-4 { margin-right: 0; margin-left: 1rem; }
            
            .rtl .pl-1 { padding-left: 0; padding-right: 0.25rem; }
            .rtl .pl-2 { padding-left: 0; padding-right: 0.5rem; }
            .rtl .pl-3 { padding-left: 0; padding-right: 0.75rem; }
            .rtl .pl-4 { padding-left: 0; padding-right: 1rem; }
            
            .rtl .pr-1 { padding-right: 0; padding-left: 0.25rem; }
            .rtl .pr-2 { padding-right: 0; padding-left: 0.5rem; }
            .rtl .pr-3 { padding-right: 0; padding-left: 0.75rem; }
            .rtl .pr-4 { padding-right: 0; padding-left: 1rem; }
            
            .rtl .left-0 { left: auto; right: 0; }
            .rtl .right-0 { right: auto; left: 0; }
            
            .rtl .border-l { border-left: none; border-right: 1px solid; }
            .rtl .border-r { border-right: none; border-left: 1px solid; }
            
            /* RTL Form Styles */
            .rtl input[type="text"],
            .rtl input[type="email"],
            .rtl input[type="password"],
            .rtl input[type="tel"],
            .rtl textarea {
                text-align: right;
            }
            
            .rtl input[type="number"] {
                text-align: left; /* Numbers should remain LTR */
            }
            
            /* RTL Table Styles */
            .rtl table {
                direction: rtl;
            }
            
            .rtl th,
            .rtl td {
                text-align: right;
            }
            
            .rtl th:first-child,
            .rtl td:first-child {
                border-left: none;
                border-right: 1px solid;
            }
            
            .rtl th:last-child,
            .rtl td:last-child {
                border-right: none;
                border-left: 1px solid;
            }
            
            /* RTL Navigation Styles */
            .rtl .nav {
                flex-direction: row-reverse;
            }
            
            .rtl .breadcrumb {
                flex-direction: row-reverse;
            }
            
            .rtl .breadcrumb-separator::before {
                content: "\\\\";
            }
            
            /* RTL Button Styles */
            .rtl .btn-group {
                flex-direction: row-reverse;
            }
            
            .rtl .btn-group > .btn:first-child {
                border-top-left-radius: 0;
                border-bottom-left-radius: 0;
                border-top-right-radius: var(--border-radius);
                border-bottom-right-radius: var(--border-radius);
            }
            
            .rtl .btn-group > .btn:last-child {
                border-top-right-radius: 0;
                border-bottom-right-radius: 0;
                border-top-left-radius: var(--border-radius);
                border-bottom-left-radius: var(--border-radius);
            }
            
            /* RTL Animation Adjustments */
            .rtl .slide-in-left {
                animation: slide-in-right 0.3s ease-out;
            }
            
            .rtl .slide-in-right {
                animation: slide-in-left 0.3s ease-out;
            }
            
            @keyframes slide-in-right {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slide-in-left {
                from {
                    transform: translateX(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    removeRTLStyles() {
        const rtlStyles = document.getElementById('rtl-styles');
        if (rtlStyles) {
            rtlStyles.remove();
        }
    }
}

module.exports = {
    LocalizedHeader,
    LocalizedDashboard,
    LocalizedForm,
    RTLLayoutManager
};