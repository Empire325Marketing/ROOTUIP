/**
 * ROOTUIP Internationalization (i18n) Framework
 * Comprehensive localization system for global expansion
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

// Internationalization Manager
class InternationalizationManager extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            defaultLocale: 'en-US',
            fallbackLocale: 'en-US',
            localesPath: config.localesPath || './locales',
            supportedLocales: config.supportedLocales || [
                'en-US', 'en-GB', 'es-ES', 'es-MX', 'fr-FR', 'de-DE', 
                'it-IT', 'pt-BR', 'pt-PT', 'ja-JP', 'ko-KR', 'zh-CN', 
                'zh-TW', 'ar-SA', 'he-IL', 'ru-RU', 'nl-NL', 'sv-SE',
                'da-DK', 'no-NO', 'fi-FI', 'pl-PL', 'cs-CZ', 'hu-HU'
            ],
            rtlLocales: ['ar-SA', 'he-IL', 'fa-IR', 'ur-PK'],
            ...config
        };
        
        this.translations = new Map();
        this.formatters = new Map();
        this.pluralRules = new Map();
        this.contextualTranslations = new Map();
        
        this.setupFormatters();
        this.setupPluralRules();
    }
    
    // Initialize i18n system
    async initialize() {
        try {
            await this.loadAllTranslations();
            await this.setupCurrencyFormatters();
            await this.setupDateTimeFormatters();
            await this.setupNumberFormatters();
            
            this.emit('i18n_initialized', {
                supportedLocales: this.config.supportedLocales,
                loadedTranslations: this.translations.size
            });
            
            console.log(`i18n initialized with ${this.config.supportedLocales.length} locales`);
        } catch (error) {
            this.emit('i18n_error', { error: error.message });
            throw error;
        }
    }
    
    // Load translations for all supported locales
    async loadAllTranslations() {
        const loadPromises = this.config.supportedLocales.map(locale => 
            this.loadTranslationFiles(locale)
        );
        
        await Promise.all(loadPromises);
    }
    
    async loadTranslationFiles(locale) {
        try {
            const localePath = path.join(this.config.localesPath, locale);
            const files = await fs.readdir(localePath);
            
            const translations = {};
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(localePath, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const namespace = path.basename(file, '.json');
                    translations[namespace] = JSON.parse(content);
                }
            }
            
            this.translations.set(locale, translations);
            
            this.emit('translations_loaded', { locale, files: files.length });
        } catch (error) {
            console.warn(`Failed to load translations for ${locale}:`, error.message);
            // Set empty translations for locale
            this.translations.set(locale, {});
        }
    }
    
    // Translate text with interpolation and pluralization
    translate(key, options = {}) {
        const {
            locale = this.config.defaultLocale,
            values = {},
            count = null,
            context = null,
            namespace = 'common'
        } = options;
        
        // Get translation
        let translation = this.getTranslation(key, locale, namespace, context);
        
        // Handle pluralization
        if (count !== null && typeof translation === 'object') {
            translation = this.handlePluralization(translation, count, locale);
        }
        
        // Handle interpolation
        if (typeof translation === 'string' && Object.keys(values).length > 0) {
            translation = this.interpolate(translation, values, locale);
        }
        
        return translation || key;
    }
    
    getTranslation(key, locale, namespace, context) {
        const localeTranslations = this.translations.get(locale) || {};
        const namespaceTranslations = localeTranslations[namespace] || {};
        
        // Try with context first
        if (context) {
            const contextKey = `${key}_${context}`;
            if (namespaceTranslations[contextKey]) {
                return namespaceTranslations[contextKey];
            }
        }
        
        // Try direct key
        if (namespaceTranslations[key]) {
            return namespaceTranslations[key];
        }
        
        // Try nested key (dot notation)
        const nestedValue = this.getNestedValue(namespaceTranslations, key);
        if (nestedValue) {
            return nestedValue;
        }
        
        // Fallback to default locale
        if (locale !== this.config.fallbackLocale) {
            return this.getTranslation(key, this.config.fallbackLocale, namespace, context);
        }
        
        return null;
    }
    
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : null;
        }, obj);
    }
    
    handlePluralization(translations, count, locale) {
        if (typeof translations !== 'object') return translations;
        
        const pluralRule = this.getPluralRule(locale);
        const category = pluralRule(count);
        
        // Try specific category first
        if (translations[category]) {
            return translations[category];
        }
        
        // Fallback order: other -> one -> zero
        if (translations.other) return translations.other;
        if (translations.one) return translations.one;
        if (translations.zero) return translations.zero;
        
        return Object.values(translations)[0];
    }
    
    interpolate(text, values, locale) {
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            const value = values[key];
            
            if (value === undefined) return match;
            
            // Format numbers, dates, currencies if needed
            if (typeof value === 'number') {
                return this.formatNumber(value, locale);
            }
            
            if (value instanceof Date) {
                return this.formatDateTime(value, locale);
            }
            
            return String(value);
        });
    }
    
    // Format currency with locale-specific rules
    formatCurrency(amount, currency, locale = this.config.defaultLocale) {
        const formatter = this.getCurrencyFormatter(locale, currency);
        return formatter.format(amount / 100); // Assuming amount is in cents
    }
    
    getCurrencyFormatter(locale, currency) {
        const key = `${locale}-${currency}`;
        
        if (!this.formatters.has(key)) {
            const formatter = new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            this.formatters.set(key, formatter);
        }
        
        return this.formatters.get(key);
    }
    
    // Format numbers with locale-specific rules
    formatNumber(number, locale = this.config.defaultLocale, options = {}) {
        const key = `number-${locale}-${JSON.stringify(options)}`;
        
        if (!this.formatters.has(key)) {
            const formatter = new Intl.NumberFormat(locale, options);
            this.formatters.set(key, formatter);
        }
        
        return this.formatters.get(key).format(number);
    }
    
    // Format date/time with locale-specific rules
    formatDateTime(date, locale = this.config.defaultLocale, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        
        const formatOptions = { ...defaultOptions, ...options };
        const key = `datetime-${locale}-${JSON.stringify(formatOptions)}`;
        
        if (!this.formatters.has(key)) {
            const formatter = new Intl.DateTimeFormat(locale, formatOptions);
            this.formatters.set(key, formatter);
        }
        
        return this.formatters.get(key).format(date);
    }
    
    // Format date only
    formatDate(date, locale = this.config.defaultLocale, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        
        return this.formatDateTime(date, locale, { ...defaultOptions, ...options });
    }
    
    // Format time only
    formatTime(date, locale = this.config.defaultLocale, options = {}) {
        const defaultOptions = {
            hour: '2-digit',
            minute: '2-digit'
        };
        
        return this.formatDateTime(date, locale, { ...defaultOptions, ...options });
    }
    
    // Format relative time (e.g., "3 hours ago")
    formatRelativeTime(date, locale = this.config.defaultLocale) {
        const key = `relative-${locale}`;
        
        if (!this.formatters.has(key)) {
            const formatter = new Intl.RelativeTimeFormat(locale, {
                numeric: 'auto'
            });
            this.formatters.set(key, formatter);
        }
        
        const formatter = this.formatters.get(key);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffMinutes = Math.round(diffMs / (1000 * 60));
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        
        if (Math.abs(diffMinutes) < 60) {
            return formatter.format(diffMinutes, 'minute');
        } else if (Math.abs(diffHours) < 24) {
            return formatter.format(diffHours, 'hour');
        } else {
            return formatter.format(diffDays, 'day');
        }
    }
    
    // Check if locale uses right-to-left text direction
    isRTL(locale = this.config.defaultLocale) {
        return this.config.rtlLocales.includes(locale);
    }
    
    // Get text direction for locale
    getTextDirection(locale = this.config.defaultLocale) {
        return this.isRTL(locale) ? 'rtl' : 'ltr';
    }
    
    // Get locale-specific configuration
    getLocaleConfig(locale = this.config.defaultLocale) {
        const isRTL = this.isRTL(locale);
        const [language, region] = locale.split('-');
        
        return {
            locale,
            language,
            region,
            isRTL,
            textDirection: isRTL ? 'rtl' : 'ltr',
            currency: this.getLocaleCurrency(locale),
            dateFormat: this.getLocaleDateFormat(locale),
            numberFormat: this.getLocaleNumberFormat(locale)
        };
    }
    
    getLocaleCurrency(locale) {
        const currencyMap = {
            'en-US': 'USD', 'en-GB': 'GBP', 'en-CA': 'CAD', 'en-AU': 'AUD',
            'es-ES': 'EUR', 'es-MX': 'MXN', 'fr-FR': 'EUR', 'de-DE': 'EUR',
            'it-IT': 'EUR', 'pt-BR': 'BRL', 'pt-PT': 'EUR', 'ja-JP': 'JPY',
            'ko-KR': 'KRW', 'zh-CN': 'CNY', 'zh-TW': 'TWD', 'ar-SA': 'SAR',
            'he-IL': 'ILS', 'ru-RU': 'RUB', 'nl-NL': 'EUR', 'sv-SE': 'SEK',
            'da-DK': 'DKK', 'no-NO': 'NOK', 'fi-FI': 'EUR', 'pl-PL': 'PLN',
            'cs-CZ': 'CZK', 'hu-HU': 'HUF'
        };
        
        return currencyMap[locale] || 'USD';
    }
    
    getLocaleDateFormat(locale) {
        // Common date format patterns by locale
        const formatMap = {
            'en-US': 'MM/DD/YYYY',
            'en-GB': 'DD/MM/YYYY',
            'de-DE': 'DD.MM.YYYY',
            'fr-FR': 'DD/MM/YYYY',
            'ja-JP': 'YYYY/MM/DD',
            'ko-KR': 'YYYY.MM.DD',
            'zh-CN': 'YYYY/MM/DD'
        };
        
        return formatMap[locale] || 'DD/MM/YYYY';
    }
    
    getLocaleNumberFormat(locale) {
        const [language, region] = locale.split('-');
        
        // Different decimal and thousand separators
        const formatMap = {
            'en': { decimal: '.', thousand: ',' },
            'de': { decimal: ',', thousand: '.' },
            'fr': { decimal: ',', thousand: ' ' },
            'es': { decimal: ',', thousand: '.' },
            'it': { decimal: ',', thousand: '.' },
            'pt': { decimal: ',', thousand: '.' },
            'ja': { decimal: '.', thousand: ',' },
            'ko': { decimal: '.', thousand: ',' },
            'zh': { decimal: '.', thousand: ',' },
            'ar': { decimal: '.', thousand: ',' },
            'he': { decimal: '.', thousand: ',' }
        };
        
        return formatMap[language] || { decimal: '.', thousand: ',' };
    }
    
    // Setup formatters for common use cases
    setupFormatters() {
        // Will be populated with Intl formatters as needed
    }
    
    setupCurrencyFormatters() {
        // Pre-create formatters for common currency/locale combinations
        const commonCombinations = [
            { locale: 'en-US', currency: 'USD' },
            { locale: 'en-GB', currency: 'GBP' },
            { locale: 'de-DE', currency: 'EUR' },
            { locale: 'fr-FR', currency: 'EUR' },
            { locale: 'ja-JP', currency: 'JPY' },
            { locale: 'zh-CN', currency: 'CNY' }
        ];
        
        commonCombinations.forEach(({ locale, currency }) => {
            this.getCurrencyFormatter(locale, currency);
        });
    }
    
    setupDateTimeFormatters() {
        // Pre-create common date/time formatters
        this.config.supportedLocales.forEach(locale => {
            this.formatDateTime(new Date(), locale, { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        });
    }
    
    setupNumberFormatters() {
        // Pre-create number formatters
        this.config.supportedLocales.forEach(locale => {
            this.formatNumber(1234.56, locale);
        });
    }
    
    // Setup plural rules for different languages
    setupPluralRules() {
        // English and similar languages
        const englishRule = (n) => {
            if (n === 0) return 'zero';
            if (n === 1) return 'one';
            return 'other';
        };
        
        // Slavic languages (complex plural rules)
        const slavicRule = (n) => {
            if (n === 0) return 'zero';
            if (n === 1) return 'one';
            if (n >= 2 && n <= 4) return 'few';
            return 'other';
        };
        
        // Arabic (very complex plural rules)
        const arabicRule = (n) => {
            if (n === 0) return 'zero';
            if (n === 1) return 'one';
            if (n === 2) return 'two';
            if (n >= 3 && n <= 10) return 'few';
            if (n >= 11 && n <= 99) return 'many';
            return 'other';
        };
        
        // Chinese, Japanese, Korean (no pluralization)
        const asianRule = (n) => 'other';
        
        // Map locales to rules
        const ruleMap = {
            'en': englishRule, 'es': englishRule, 'fr': englishRule,
            'de': englishRule, 'it': englishRule, 'pt': englishRule,
            'ru': slavicRule, 'pl': slavicRule, 'cs': slavicRule,
            'ar': arabicRule, 'he': arabicRule,
            'ja': asianRule, 'ko': asianRule, 'zh': asianRule
        };
        
        // Set rules for all supported locales
        this.config.supportedLocales.forEach(locale => {
            const [language] = locale.split('-');
            const rule = ruleMap[language] || englishRule;
            this.pluralRules.set(locale, rule);
        });
    }
    
    getPluralRule(locale) {
        return this.pluralRules.get(locale) || this.pluralRules.get('en-US');
    }
    
    // Validate locale
    isValidLocale(locale) {
        return this.config.supportedLocales.includes(locale);
    }
    
    // Get closest supported locale
    getClosestLocale(requestedLocale) {
        if (this.isValidLocale(requestedLocale)) {
            return requestedLocale;
        }
        
        // Try language without region
        const [language] = requestedLocale.split('-');
        const languageMatch = this.config.supportedLocales.find(locale => 
            locale.startsWith(language)
        );
        
        if (languageMatch) {
            return languageMatch;
        }
        
        return this.config.defaultLocale;
    }
    
    // Get list of supported locales with metadata
    getSupportedLocales() {
        return this.config.supportedLocales.map(locale => ({
            locale,
            ...this.getLocaleConfig(locale),
            name: this.getLocaleDisplayName(locale),
            nativeName: this.getLocaleNativeName(locale)
        }));
    }
    
    getLocaleDisplayName(locale) {
        const displayNames = {
            'en-US': 'English (United States)',
            'en-GB': 'English (United Kingdom)',
            'es-ES': 'Spanish (Spain)',
            'es-MX': 'Spanish (Mexico)',
            'fr-FR': 'French (France)',
            'de-DE': 'German (Germany)',
            'it-IT': 'Italian (Italy)',
            'pt-BR': 'Portuguese (Brazil)',
            'pt-PT': 'Portuguese (Portugal)',
            'ja-JP': 'Japanese (Japan)',
            'ko-KR': 'Korean (South Korea)',
            'zh-CN': 'Chinese (Simplified)',
            'zh-TW': 'Chinese (Traditional)',
            'ar-SA': 'Arabic (Saudi Arabia)',
            'he-IL': 'Hebrew (Israel)',
            'ru-RU': 'Russian (Russia)',
            'nl-NL': 'Dutch (Netherlands)',
            'sv-SE': 'Swedish (Sweden)',
            'da-DK': 'Danish (Denmark)',
            'no-NO': 'Norwegian (Norway)',
            'fi-FI': 'Finnish (Finland)',
            'pl-PL': 'Polish (Poland)',
            'cs-CZ': 'Czech (Czech Republic)',
            'hu-HU': 'Hungarian (Hungary)'
        };
        
        return displayNames[locale] || locale;
    }
    
    getLocaleNativeName(locale) {
        const nativeNames = {
            'en-US': 'English',
            'en-GB': 'English',
            'es-ES': 'Español',
            'es-MX': 'Español',
            'fr-FR': 'Français',
            'de-DE': 'Deutsch',
            'it-IT': 'Italiano',
            'pt-BR': 'Português',
            'pt-PT': 'Português',
            'ja-JP': '日本語',
            'ko-KR': '한국어',
            'zh-CN': '中文',
            'zh-TW': '中文',
            'ar-SA': 'العربية',
            'he-IL': 'עברית',
            'ru-RU': 'Русский',
            'nl-NL': 'Nederlands',
            'sv-SE': 'Svenska',
            'da-DK': 'Dansk',
            'no-NO': 'Norsk',
            'fi-FI': 'Suomi',
            'pl-PL': 'Polski',
            'cs-CZ': 'Čeština',
            'hu-HU': 'Magyar'
        };
        
        return nativeNames[locale] || locale;
    }
}

// Translation middleware for Express.js
class I18nMiddleware {
    constructor(i18nManager) {
        this.i18nManager = i18nManager;
    }
    
    middleware() {
        return (req, res, next) => {
            // Detect user locale from various sources
            const locale = this.detectLocale(req);
            
            // Add i18n helpers to request
            req.locale = locale;
            req.t = (key, options = {}) => {
                return this.i18nManager.translate(key, { ...options, locale });
            };
            req.formatCurrency = (amount, currency) => {
                return this.i18nManager.formatCurrency(amount, currency, locale);
            };
            req.formatDate = (date, options = {}) => {
                return this.i18nManager.formatDate(date, locale, options);
            };
            req.formatNumber = (number, options = {}) => {
                return this.i18nManager.formatNumber(number, locale, options);
            };
            req.isRTL = () => {
                return this.i18nManager.isRTL(locale);
            };
            req.getLocaleConfig = () => {
                return this.i18nManager.getLocaleConfig(locale);
            };
            
            // Add helpers to response locals for templates
            res.locals.locale = locale;
            res.locals.t = req.t;
            res.locals.formatCurrency = req.formatCurrency;
            res.locals.formatDate = req.formatDate;
            res.locals.formatNumber = req.formatNumber;
            res.locals.isRTL = req.isRTL;
            res.locals.textDirection = this.i18nManager.getTextDirection(locale);
            res.locals.localeConfig = req.getLocaleConfig();
            
            next();
        };
    }
    
    detectLocale(req) {
        // Priority order for locale detection:
        // 1. URL parameter (?locale=en-US)
        // 2. User preference (from database)
        // 3. Accept-Language header
        // 4. Default locale
        
        // URL parameter
        if (req.query.locale && this.i18nManager.isValidLocale(req.query.locale)) {
            return req.query.locale;
        }
        
        // User preference (assuming user object exists)
        if (req.user && req.user.preferredLocale) {
            const closestLocale = this.i18nManager.getClosestLocale(req.user.preferredLocale);
            if (closestLocale) return closestLocale;
        }
        
        // Accept-Language header
        const acceptLanguage = req.headers['accept-language'];
        if (acceptLanguage) {
            const preferredLocales = this.parseAcceptLanguage(acceptLanguage);
            for (const locale of preferredLocales) {
                const closestLocale = this.i18nManager.getClosestLocale(locale);
                if (closestLocale !== this.i18nManager.config.defaultLocale) {
                    return closestLocale;
                }
            }
        }
        
        return this.i18nManager.config.defaultLocale;
    }
    
    parseAcceptLanguage(acceptLanguage) {
        return acceptLanguage
            .split(',')
            .map(lang => {
                const [locale, quality = '1'] = lang.trim().split(';q=');
                return { locale: locale.trim(), quality: parseFloat(quality) };
            })
            .sort((a, b) => b.quality - a.quality)
            .map(item => item.locale);
    }
}

// Translation key extractor (for development)
class TranslationExtractor {
    constructor() {
        this.extractedKeys = new Set();
        this.keyPattern = /\bt\(\s*['"`]([^'"`]+)['"`]/g;
    }
    
    extractFromFile(content, filename) {
        const keys = [];
        let match;
        
        while ((match = this.keyPattern.exec(content)) !== null) {
            const key = match[1];
            keys.push({
                key,
                file: filename,
                line: this.getLineNumber(content, match.index)
            });
            this.extractedKeys.add(key);
        }
        
        return keys;
    }
    
    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }
    
    generateTranslationTemplate(namespace = 'common') {
        const template = {};
        
        for (const key of this.extractedKeys) {
            this.setNestedValue(template, key, key);
        }
        
        return template;
    }
    
    setNestedValue(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!current[key]) {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
    }
}

module.exports = {
    InternationalizationManager,
    I18nMiddleware,
    TranslationExtractor
};