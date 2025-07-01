/**
 * ROOTUIP Knowledge Base and Help System
 * Intelligent help with AI-powered search and contextual assistance
 */

const express = require('express');
const EventEmitter = require('events');
const crypto = require('crypto');

class KnowledgeBaseSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            elasticsearchUrl: config.elasticsearchUrl || 'http://localhost:9200',
            mlModelPath: config.mlModelPath || './models/help-ml',
            cacheTimeout: config.cacheTimeout || 300000, // 5 minutes
            ...config
        };
        
        this.articles = new Map();
        this.categories = new Map();
        this.searchIndex = new Map();
        this.userContext = new Map();
        this.analytics = new Map();
        
        this.initializeKnowledgeBase();
    }
    
    // Initialize knowledge base
    initializeKnowledgeBase() {
        this.setupCategories();
        this.loadArticles();
        this.buildSearchIndex();
        this.initializeAnalytics();
        
        console.log('Knowledge Base System initialized');
    }
    
    // Setup categories
    setupCategories() {
        const categories = [
            {
                id: 'getting-started',
                name: 'Getting Started',
                icon: 'rocket',
                description: 'Begin your journey with ROOTUIP',
                subcategories: ['account-setup', 'first-shipment', 'dashboard-overview']
            },
            {
                id: 'container-tracking',
                name: 'Container Tracking',
                icon: 'map-marker',
                description: 'Track and manage your containers',
                subcategories: ['real-time-tracking', 'notifications', 'history']
            },
            {
                id: 'billing',
                name: 'Billing & Pricing',
                icon: 'credit-card',
                description: 'Understand billing and manage payments',
                subcategories: ['pricing-plans', 'invoices', 'payment-methods']
            },
            {
                id: 'api-integration',
                name: 'API & Integration',
                icon: 'code',
                description: 'Integrate ROOTUIP with your systems',
                subcategories: ['api-reference', 'webhooks', 'third-party']
            },
            {
                id: 'troubleshooting',
                name: 'Troubleshooting',
                icon: 'wrench',
                description: 'Solve common issues',
                subcategories: ['common-errors', 'connectivity', 'data-issues']
            }
        ];
        
        categories.forEach(cat => this.categories.set(cat.id, cat));
    }
    
    // Load articles
    loadArticles() {
        // Sample articles - in production, these would come from a database
        const articles = [
            {
                id: 'art-001',
                title: 'How to Track Your First Container',
                category: 'getting-started',
                subcategory: 'first-shipment',
                content: this.generateArticleContent('first-container'),
                tags: ['beginner', 'tracking', 'tutorial'],
                difficulty: 'easy',
                readTime: 5,
                helpful: 142,
                notHelpful: 8,
                views: 1523,
                lastUpdated: new Date()
            },
            {
                id: 'art-002',
                title: 'Understanding Real-Time Tracking',
                category: 'container-tracking',
                subcategory: 'real-time-tracking',
                content: this.generateArticleContent('real-time'),
                tags: ['tracking', 'features', 'advanced'],
                difficulty: 'medium',
                readTime: 8,
                helpful: 89,
                notHelpful: 3,
                views: 876,
                lastUpdated: new Date()
            },
            {
                id: 'art-003',
                title: 'API Authentication Guide',
                category: 'api-integration',
                subcategory: 'api-reference',
                content: this.generateArticleContent('api-auth'),
                tags: ['api', 'authentication', 'technical'],
                difficulty: 'hard',
                readTime: 12,
                helpful: 67,
                notHelpful: 5,
                views: 432,
                lastUpdated: new Date()
            }
        ];
        
        articles.forEach(article => {
            this.articles.set(article.id, article);
        });
        
        // Generate more articles
        this.generateSampleArticles();
    }
    
    // Generate sample articles
    generateSampleArticles() {
        const topics = [
            { title: 'Setting Up Email Notifications', category: 'container-tracking', tags: ['notifications', 'email'] },
            { title: 'Understanding Your Invoice', category: 'billing', tags: ['billing', 'invoice'] },
            { title: 'Webhook Configuration', category: 'api-integration', tags: ['api', 'webhooks'] },
            { title: 'Troubleshooting Connection Issues', category: 'troubleshooting', tags: ['connectivity', 'errors'] },
            { title: 'Managing Multiple Users', category: 'getting-started', tags: ['users', 'permissions'] }
        ];
        
        topics.forEach((topic, index) => {
            const article = {
                id: `art-${String(index + 4).padStart(3, '0')}`,
                title: topic.title,
                category: topic.category,
                content: this.generateArticleContent(topic.title),
                tags: topic.tags,
                difficulty: ['easy', 'medium', 'hard'][index % 3],
                readTime: 5 + Math.floor(Math.random() * 10),
                helpful: Math.floor(Math.random() * 200),
                notHelpful: Math.floor(Math.random() * 20),
                views: Math.floor(Math.random() * 2000),
                lastUpdated: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)
            };
            
            this.articles.set(article.id, article);
        });
    }
    
    // Build search index
    buildSearchIndex() {
        for (const [id, article] of this.articles) {
            // Index by title words
            const titleWords = article.title.toLowerCase().split(' ');
            titleWords.forEach(word => {
                if (!this.searchIndex.has(word)) {
                    this.searchIndex.set(word, new Set());
                }
                this.searchIndex.get(word).add(id);
            });
            
            // Index by tags
            article.tags.forEach(tag => {
                const tagKey = `tag:${tag}`;
                if (!this.searchIndex.has(tagKey)) {
                    this.searchIndex.set(tagKey, new Set());
                }
                this.searchIndex.get(tagKey).add(id);
            });
            
            // Index by category
            const catKey = `cat:${article.category}`;
            if (!this.searchIndex.has(catKey)) {
                this.searchIndex.set(catKey, new Set());
            }
            this.searchIndex.get(catKey).add(id);
        }
    }
    
    // Search articles with AI-powered relevance
    async searchArticles(query, options = {}) {
        const {
            limit = 10,
            category = null,
            tags = [],
            userRole = null,
            context = null
        } = options;
        
        // Parse query for natural language understanding
        const parsedQuery = this.parseNaturalLanguageQuery(query);
        
        // Get matching articles
        const matches = new Map();
        
        // Search by keywords
        parsedQuery.keywords.forEach(keyword => {
            const articleIds = this.searchIndex.get(keyword.toLowerCase());
            if (articleIds) {
                articleIds.forEach(id => {
                    if (!matches.has(id)) {
                        matches.set(id, { id, score: 0 });
                    }
                    matches.get(id).score += 10;
                });
            }
        });
        
        // Boost by category
        if (category) {
            const catArticles = this.searchIndex.get(`cat:${category}`);
            if (catArticles) {
                catArticles.forEach(id => {
                    if (matches.has(id)) {
                        matches.get(id).score += 5;
                    }
                });
            }
        }
        
        // Boost by tags
        tags.forEach(tag => {
            const tagArticles = this.searchIndex.get(`tag:${tag}`);
            if (tagArticles) {
                tagArticles.forEach(id => {
                    if (matches.has(id)) {
                        matches.get(id).score += 3;
                    }
                });
            }
        });
        
        // Apply ML-based relevance scoring
        const scoredArticles = await this.applyMLScoring(matches, parsedQuery, context);
        
        // Sort by score and limit
        const results = Array.from(scoredArticles.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(match => this.articles.get(match.id));
        
        // Track search analytics
        this.trackSearchAnalytics(query, results.length, userRole);
        
        return {
            query,
            results,
            totalResults: matches.size,
            suggestions: this.generateSearchSuggestions(query, results)
        };
    }
    
    // Parse natural language query
    parseNaturalLanguageQuery(query) {
        const commonWords = new Set(['how', 'to', 'the', 'a', 'an', 'is', 'are', 'what', 'where', 'when', 'why']);
        const words = query.toLowerCase().split(' ');
        
        const keywords = words.filter(word => !commonWords.has(word) && word.length > 2);
        
        // Detect intent
        let intent = 'general';
        if (query.includes('how to') || query.includes('how do')) {
            intent = 'howto';
        } else if (query.includes('error') || query.includes('problem')) {
            intent = 'troubleshoot';
        } else if (query.includes('what is') || query.includes('what are')) {
            intent = 'definition';
        }
        
        return {
            original: query,
            keywords,
            intent,
            entities: this.extractEntities(query)
        };
    }
    
    // Extract entities from query
    extractEntities(query) {
        const entities = {
            features: [],
            actions: [],
            objects: []
        };
        
        // Simple entity extraction - in production, use NLP library
        const featureWords = ['tracking', 'billing', 'api', 'notification', 'report'];
        const actionWords = ['track', 'create', 'delete', 'update', 'configure'];
        const objectWords = ['container', 'shipment', 'invoice', 'user', 'webhook'];
        
        const words = query.toLowerCase().split(' ');
        
        words.forEach(word => {
            if (featureWords.includes(word)) entities.features.push(word);
            if (actionWords.includes(word)) entities.actions.push(word);
            if (objectWords.includes(word)) entities.objects.push(word);
        });
        
        return entities;
    }
    
    // Apply ML-based scoring
    async applyMLScoring(matches, parsedQuery, context) {
        // Simulate ML scoring - in production, use actual ML model
        for (const [id, match] of matches) {
            const article = this.articles.get(id);
            
            // Intent matching
            if (parsedQuery.intent === 'howto' && article.title.toLowerCase().includes('how to')) {
                match.score += 8;
            }
            if (parsedQuery.intent === 'troubleshoot' && article.category === 'troubleshooting') {
                match.score += 10;
            }
            
            // Context relevance
            if (context) {
                if (context.currentPage && article.tags.includes(context.currentPage)) {
                    match.score += 5;
                }
                if (context.userRole === 'developer' && article.category === 'api-integration') {
                    match.score += 3;
                }
            }
            
            // Popularity boost
            match.score += Math.log(article.views + 1) * 0.5;
            
            // Helpfulness ratio
            const helpfulRatio = article.helpful / (article.helpful + article.notHelpful + 1);
            match.score += helpfulRatio * 5;
        }
        
        return matches;
    }
    
    // Get contextual help
    async getContextualHelp(context) {
        const { page, action, userRole, errorCode } = context;
        
        let relevantArticles = [];
        
        // Page-specific help
        if (page) {
            const pageHelp = this.getPageSpecificHelp(page);
            relevantArticles.push(...pageHelp);
        }
        
        // Action-specific help
        if (action) {
            const actionHelp = await this.searchArticles(action, { limit: 3 });
            relevantArticles.push(...actionHelp.results);
        }
        
        // Error-specific help
        if (errorCode) {
            const errorHelp = this.getErrorHelp(errorCode);
            if (errorHelp) {
                relevantArticles.unshift(errorHelp);
            }
        }
        
        // Role-specific content
        relevantArticles = this.filterByUserRole(relevantArticles, userRole);
        
        // Quick actions
        const quickActions = this.getQuickActions(context);
        
        return {
            articles: relevantArticles.slice(0, 5),
            quickActions,
            suggestedSearch: this.getSuggestedSearch(context),
            contactSupport: this.shouldShowContactSupport(context)
        };
    }
    
    // Get page-specific help
    getPageSpecificHelp(page) {
        const pageHelpMap = {
            'dashboard': ['art-001', 'art-004'],
            'tracking': ['art-002', 'art-005'],
            'billing': ['art-006', 'art-007'],
            'api': ['art-003', 'art-008']
        };
        
        const articleIds = pageHelpMap[page] || [];
        return articleIds.map(id => this.articles.get(id)).filter(Boolean);
    }
    
    // Get error help
    getErrorHelp(errorCode) {
        const errorArticles = {
            'AUTH_FAILED': {
                id: 'err-001',
                title: 'Authentication Failed',
                content: 'Your authentication has failed. Please check your credentials...',
                category: 'troubleshooting',
                quickFix: 'Reset your password or contact support'
            },
            'RATE_LIMIT': {
                id: 'err-002',
                title: 'Rate Limit Exceeded',
                content: 'You have exceeded the API rate limit...',
                category: 'troubleshooting',
                quickFix: 'Wait 60 seconds or upgrade your plan'
            }
        };
        
        return errorArticles[errorCode];
    }
    
    // Get quick actions
    getQuickActions(context) {
        const actions = [];
        
        if (context.page === 'tracking' && !context.hasContainers) {
            actions.push({
                label: 'Add Your First Container',
                action: 'navigate:/containers/add',
                icon: 'plus'
            });
        }
        
        if (context.errorCode === 'AUTH_FAILED') {
            actions.push({
                label: 'Reset Password',
                action: 'navigate:/auth/reset-password',
                icon: 'key'
            });
        }
        
        actions.push({
            label: 'Contact Support',
            action: 'openChat',
            icon: 'message'
        });
        
        return actions;
    }
    
    // Generate article content
    generateArticleContent(topic) {
        const content = {
            sections: [
                {
                    type: 'introduction',
                    content: `This guide will help you understand ${topic} in ROOTUIP.`
                },
                {
                    type: 'steps',
                    title: 'Step by Step Guide',
                    items: [
                        'Navigate to the relevant section',
                        'Follow the on-screen instructions',
                        'Complete the required fields',
                        'Save your changes'
                    ]
                },
                {
                    type: 'tips',
                    title: 'Pro Tips',
                    items: [
                        'Use keyboard shortcuts for faster navigation',
                        'Set up notifications to stay informed',
                        'Check the API documentation for automation'
                    ]
                },
                {
                    type: 'related',
                    title: 'Related Articles',
                    articles: ['art-001', 'art-002', 'art-003']
                }
            ],
            metadata: {
                author: 'ROOTUIP Team',
                lastReviewed: new Date(),
                version: '1.0'
            }
        };
        
        return content;
    }
    
    // Create support ticket from article
    async createSupportTicket(articleId, issue, userInfo) {
        const article = this.articles.get(articleId);
        const ticket = {
            id: this.generateTicketId(),
            subject: `Help with: ${article?.title || 'General Inquiry'}`,
            description: issue.description,
            category: article?.category || 'general',
            priority: this.determinePriority(issue),
            status: 'open',
            createdAt: new Date(),
            user: userInfo,
            relatedArticle: articleId,
            context: issue.context
        };
        
        // In production, save to database and notify support team
        console.log('Support ticket created:', ticket);
        
        // Track analytics
        this.trackSupportTicket(ticket);
        
        return ticket;
    }
    
    // Track article feedback
    async trackArticleFeedback(articleId, helpful, userId) {
        const article = this.articles.get(articleId);
        if (!article) return;
        
        if (helpful) {
            article.helpful++;
        } else {
            article.notHelpful++;
        }
        
        // Track in analytics
        this.trackAnalytics('article_feedback', {
            articleId,
            helpful,
            userId,
            timestamp: new Date()
        });
        
        return {
            helpful: article.helpful,
            notHelpful: article.notHelpful
        };
    }
    
    // Get analytics summary
    getAnalyticsSummary(timeRange = '7d') {
        const summary = {
            totalSearches: 0,
            popularSearches: [],
            articleViews: new Map(),
            helpfulnessScore: 0,
            ticketDeflection: 0,
            userSatisfaction: 0
        };
        
        // Aggregate analytics data
        for (const [type, data] of this.analytics) {
            if (type === 'search') {
                summary.totalSearches += data.length;
                // Count popular searches
            }
            if (type === 'article_view') {
                data.forEach(view => {
                    const count = summary.articleViews.get(view.articleId) || 0;
                    summary.articleViews.set(view.articleId, count + 1);
                });
            }
        }
        
        // Calculate metrics
        let totalHelpful = 0;
        let totalFeedback = 0;
        
        for (const article of this.articles.values()) {
            totalHelpful += article.helpful;
            totalFeedback += article.helpful + article.notHelpful;
        }
        
        summary.helpfulnessScore = totalFeedback > 0 ? 
            (totalHelpful / totalFeedback * 100).toFixed(1) : 0;
        
        // Estimate ticket deflection
        summary.ticketDeflection = Math.round(summary.totalSearches * 0.7);
        
        // Calculate user satisfaction
        summary.userSatisfaction = summary.helpfulnessScore > 80 ? 'High' : 
            summary.helpfulnessScore > 60 ? 'Medium' : 'Low';
        
        return summary;
    }
    
    // Initialize analytics
    initializeAnalytics() {
        this.analytics.set('search', []);
        this.analytics.set('article_view', []);
        this.analytics.set('article_feedback', []);
        this.analytics.set('support_ticket', []);
    }
    
    // Track search analytics
    trackSearchAnalytics(query, resultCount, userRole) {
        const searchData = this.analytics.get('search') || [];
        searchData.push({
            query,
            resultCount,
            userRole,
            timestamp: new Date()
        });
        this.analytics.set('search', searchData);
    }
    
    // Track analytics
    trackAnalytics(type, data) {
        const analyticsData = this.analytics.get(type) || [];
        analyticsData.push(data);
        this.analytics.set(type, analyticsData);
        
        // Emit event for real-time analytics
        this.emit('analytics:tracked', { type, data });
    }
    
    // Helper methods
    filterByUserRole(articles, userRole) {
        if (!userRole) return articles;
        
        // Filter based on role permissions
        return articles.filter(article => {
            if (userRole === 'developer' && article.category === 'api-integration') {
                return true;
            }
            if (userRole === 'admin' || article.difficulty !== 'hard') {
                return true;
            }
            return false;
        });
    }
    
    getSuggestedSearch(context) {
        const suggestions = [];
        
        if (context.page === 'tracking') {
            suggestions.push('how to track container', 'real-time updates');
        }
        if (context.errorCode) {
            suggestions.push('troubleshoot ' + context.errorCode);
        }
        
        return suggestions;
    }
    
    shouldShowContactSupport(context) {
        return context.errorCode || context.attempts > 3;
    }
    
    generateSearchSuggestions(query, results) {
        if (results.length >= 5) return [];
        
        const suggestions = [
            'Try different keywords',
            'Browse by category',
            'Contact support for personalized help'
        ];
        
        return suggestions;
    }
    
    determinePriority(issue) {
        if (issue.severity === 'critical' || issue.description.includes('urgent')) {
            return 'high';
        }
        if (issue.category === 'billing') {
            return 'medium';
        }
        return 'low';
    }
    
    generateTicketId() {
        return `ticket_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    trackSupportTicket(ticket) {
        this.trackAnalytics('support_ticket', {
            ticketId: ticket.id,
            category: ticket.category,
            priority: ticket.priority,
            relatedArticle: ticket.relatedArticle,
            timestamp: ticket.createdAt
        });
    }
}

module.exports = { KnowledgeBaseSystem };