/**
 * ROOTUIP Smart Support Chatbot
 * AI-powered chatbot with natural language understanding
 */

const EventEmitter = require('events');
const { KnowledgeBaseSystem } = require('./knowledge-base-system');

class SmartSupportChatbot extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            botName: config.botName || 'ROOTUIP Assistant',
            escalationThreshold: config.escalationThreshold || 3,
            sessionTimeout: config.sessionTimeout || 1800000, // 30 minutes
            ...config
        };
        
        this.sessions = new Map();
        this.conversations = new Map();
        this.knowledgeBase = new KnowledgeBaseSystem();
        this.intents = new Map();
        this.entities = new Map();
        
        this.initializeChatbot();
    }
    
    // Initialize chatbot
    initializeChatbot() {
        this.setupIntents();
        this.setupResponses();
        this.startSessionCleanup();
        
        console.log('Smart Support Chatbot initialized');
    }
    
    // Setup intents
    setupIntents() {
        const intents = [
            {
                name: 'greeting',
                patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon'],
                response: 'greeting'
            },
            {
                name: 'track_container',
                patterns: ['track', 'where is', 'container location', 'find container'],
                response: 'track_container'
            },
            {
                name: 'billing_inquiry',
                patterns: ['bill', 'invoice', 'payment', 'charge', 'pricing'],
                response: 'billing_help'
            },
            {
                name: 'technical_issue',
                patterns: ['error', 'problem', 'not working', 'broken', 'bug'],
                response: 'technical_support'
            },
            {
                name: 'api_help',
                patterns: ['api', 'integration', 'webhook', 'documentation'],
                response: 'api_assistance'
            },
            {
                name: 'human_agent',
                patterns: ['agent', 'human', 'representative', 'talk to someone'],
                response: 'escalate_to_human'
            }
        ];
        
        intents.forEach(intent => {
            this.intents.set(intent.name, intent);
        });
    }
    
    // Setup response templates
    setupResponses() {
        this.responses = {
            greeting: [
                "Hello! I'm your ROOTUIP Assistant. How can I help you today?",
                "Hi there! I'm here to help with container tracking, billing, or any questions you have.",
                "Welcome! What can I assist you with today?"
            ],
            track_container: [
                "I can help you track your container. Please provide the container ID or booking number.",
                "Let me help you find your container. What's the container or reference number?"
            ],
            billing_help: [
                "I can help with billing inquiries. Are you looking for invoices, payment methods, or pricing information?",
                "Let me assist with your billing question. What specific information do you need?"
            ],
            technical_support: [
                "I understand you're experiencing an issue. Can you describe what's happening?",
                "I'm here to help troubleshoot. What error or problem are you encountering?"
            ],
            api_assistance: [
                "I can help with API integration. Are you looking for documentation, authentication help, or webhook setup?",
                "Let me guide you through our API. What specific integration help do you need?"
            ],
            escalate_to_human: [
                "I'll connect you with a human agent right away. Please hold on.",
                "Let me transfer you to our support team for personalized assistance."
            ],
            clarification: [
                "I'm not quite sure I understood. Could you rephrase that?",
                "Can you provide more details about what you're looking for?"
            ],
            container_found: "I found your container {containerId}. It's currently at {location} and expected to arrive on {eta}.",
            no_container: "I couldn't find that container. Please double-check the ID or contact support.",
            article_suggestion: "I found this helpful article: {title}. Would you like me to share more details?",
            confirmation: "Got it! Is there anything else I can help you with?",
            goodbye: "Thank you for using ROOTUIP! Have a great day!"
        };
    }
    
    // Start new chat session
    startSession(userId, context = {}) {
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            userId,
            startTime: new Date(),
            lastActivity: new Date(),
            context: {
                ...context,
                conversationHistory: [],
                attemptedSolutions: [],
                escalated: false
            },
            metrics: {
                messages: 0,
                articlesShared: 0,
                resolved: false
            }
        };
        
        this.sessions.set(sessionId, session);
        
        // Send welcome message
        const welcomeMessage = this.generateWelcomeMessage(context);
        this.addMessageToHistory(sessionId, 'bot', welcomeMessage);
        
        return {
            sessionId,
            message: welcomeMessage
        };
    }
    
    // Process user message
    async processMessage(sessionId, message) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { error: 'Invalid session' };
        }
        
        // Update session activity
        session.lastActivity = new Date();
        session.metrics.messages++;
        
        // Add user message to history
        this.addMessageToHistory(sessionId, 'user', message);
        
        // Analyze message
        const analysis = await this.analyzeMessage(message, session.context);
        
        // Generate response
        const response = await this.generateResponse(analysis, session);
        
        // Add bot response to history
        this.addMessageToHistory(sessionId, 'bot', response.message);
        
        // Track analytics
        this.trackChatAnalytics(session, analysis, response);
        
        return response;
    }
    
    // Analyze user message
    async analyzeMessage(message, context) {
        const analysis = {
            originalMessage: message,
            intent: null,
            entities: [],
            sentiment: 'neutral',
            confidence: 0,
            keywords: []
        };
        
        // Convert to lowercase for analysis
        const lowerMessage = message.toLowerCase();
        
        // Detect intent
        let highestConfidence = 0;
        for (const [intentName, intent] of this.intents) {
            const confidence = this.calculateIntentConfidence(lowerMessage, intent.patterns);
            if (confidence > highestConfidence) {
                highestConfidence = confidence;
                analysis.intent = intentName;
                analysis.confidence = confidence;
            }
        }
        
        // Extract entities
        analysis.entities = this.extractEntities(message);
        
        // Detect sentiment
        analysis.sentiment = this.detectSentiment(message);
        
        // Extract keywords
        analysis.keywords = this.extractKeywords(message);
        
        // Use knowledge base for additional context
        if (analysis.confidence < 0.7) {
            const kbResults = await this.knowledgeBase.searchArticles(message, {
                limit: 3,
                context: context
            });
            
            if (kbResults.results.length > 0) {
                analysis.suggestedArticles = kbResults.results;
            }
        }
        
        return analysis;
    }
    
    // Generate response based on analysis
    async generateResponse(analysis, session) {
        let response = {
            message: '',
            suggestions: [],
            actions: [],
            escalate: false
        };
        
        // Check if escalation is needed
        if (this.shouldEscalate(session, analysis)) {
            response.escalate = true;
            response.message = this.getRandomResponse('escalate_to_human');
            response.actions = [{ type: 'escalate', priority: 'high' }];
            session.context.escalated = true;
            return response;
        }
        
        // Handle based on intent
        if (analysis.intent && analysis.confidence > 0.7) {
            response = await this.handleIntent(analysis.intent, analysis, session);
        } else if (analysis.suggestedArticles) {
            // Suggest knowledge base articles
            response.message = "I found some articles that might help:";
            response.suggestions = analysis.suggestedArticles.map(article => ({
                type: 'article',
                id: article.id,
                title: article.title,
                preview: article.content.sections[0].content
            }));
            session.metrics.articlesShared += analysis.suggestedArticles.length;
        } else {
            // Ask for clarification
            response.message = this.getRandomResponse('clarification');
            response.suggestions = this.getCommonQuestions();
        }
        
        // Add quick replies
        response.quickReplies = this.generateQuickReplies(session.context);
        
        return response;
    }
    
    // Handle specific intent
    async handleIntent(intentName, analysis, session) {
        const response = {
            message: '',
            suggestions: [],
            actions: []
        };
        
        switch (intentName) {
            case 'greeting':
                response.message = this.getRandomResponse('greeting');
                response.suggestions = this.getCommonQuestions();
                break;
                
            case 'track_container':
                if (analysis.entities.containerId) {
                    const containerInfo = await this.getContainerInfo(analysis.entities.containerId);
                    if (containerInfo) {
                        response.message = this.formatResponse('container_found', containerInfo);
                        response.actions = [{ type: 'show_tracking', data: containerInfo }];
                    } else {
                        response.message = this.responses.no_container;
                    }
                } else {
                    response.message = this.getRandomResponse('track_container');
                    response.actions = [{ type: 'request_input', field: 'containerId' }];
                }
                break;
                
            case 'billing_inquiry':
                response.message = this.getRandomResponse('billing_help');
                response.suggestions = [
                    { type: 'action', label: 'View Invoices', action: 'navigate:/billing/invoices' },
                    { type: 'action', label: 'Payment Methods', action: 'navigate:/billing/payment' },
                    { type: 'action', label: 'Pricing Plans', action: 'navigate:/pricing' }
                ];
                break;
                
            case 'technical_issue':
                response.message = this.getRandomResponse('technical_support');
                if (analysis.entities.errorCode) {
                    const errorHelp = await this.getErrorHelp(analysis.entities.errorCode);
                    if (errorHelp) {
                        response.suggestions = [{ type: 'article', ...errorHelp }];
                    }
                }
                session.context.attemptedSolutions.push('technical_troubleshooting');
                break;
                
            case 'api_help':
                response.message = this.getRandomResponse('api_assistance');
                response.suggestions = [
                    { type: 'link', label: 'API Documentation', url: '/docs/api' },
                    { type: 'link', label: 'API Keys', url: '/settings/api-keys' },
                    { type: 'article', title: 'Getting Started with API', id: 'art-003' }
                ];
                break;
                
            case 'human_agent':
                response.escalate = true;
                response.message = this.getRandomResponse('escalate_to_human');
                response.actions = [{ type: 'escalate', priority: 'normal' }];
                break;
        }
        
        return response;
    }
    
    // Calculate intent confidence
    calculateIntentConfidence(message, patterns) {
        let matches = 0;
        patterns.forEach(pattern => {
            if (message.includes(pattern)) {
                matches++;
            }
        });
        return matches / patterns.length;
    }
    
    // Extract entities from message
    extractEntities(message) {
        const entities = {};
        
        // Container ID pattern
        const containerPattern = /\b[A-Z]{4}\d{7}\b/;
        const containerMatch = message.match(containerPattern);
        if (containerMatch) {
            entities.containerId = containerMatch[0];
        }
        
        // Error code pattern
        const errorPattern = /\b[A-Z]+_[A-Z]+\b/;
        const errorMatch = message.match(errorPattern);
        if (errorMatch) {
            entities.errorCode = errorMatch[0];
        }
        
        // Email pattern
        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
        const emailMatch = message.match(emailPattern);
        if (emailMatch) {
            entities.email = emailMatch[0];
        }
        
        // Date patterns
        const datePattern = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/;
        const dateMatch = message.match(datePattern);
        if (dateMatch) {
            entities.date = dateMatch[0];
        }
        
        return entities;
    }
    
    // Detect sentiment
    detectSentiment(message) {
        const positiveWords = ['thanks', 'great', 'awesome', 'perfect', 'good'];
        const negativeWords = ['problem', 'issue', 'error', 'broken', 'frustrated', 'angry'];
        
        const lowerMessage = message.toLowerCase();
        let sentiment = 'neutral';
        
        positiveWords.forEach(word => {
            if (lowerMessage.includes(word)) sentiment = 'positive';
        });
        
        negativeWords.forEach(word => {
            if (lowerMessage.includes(word)) sentiment = 'negative';
        });
        
        return sentiment;
    }
    
    // Extract keywords
    extractKeywords(message) {
        const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was', 'were']);
        return message.toLowerCase()
            .split(' ')
            .filter(word => word.length > 2 && !stopWords.has(word));
    }
    
    // Should escalate to human
    shouldEscalate(session, analysis) {
        // Escalate if explicitly requested
        if (analysis.intent === 'human_agent') return true;
        
        // Escalate after threshold attempts
        if (session.context.attemptedSolutions.length >= this.config.escalationThreshold) return true;
        
        // Escalate for very negative sentiment
        if (analysis.sentiment === 'negative' && session.metrics.messages > 5) return true;
        
        // Escalate for low confidence after multiple attempts
        if (analysis.confidence < 0.5 && session.metrics.messages > 3) return true;
        
        return false;
    }
    
    // Generate welcome message
    generateWelcomeMessage(context) {
        if (context.userName) {
            return `Hello ${context.userName}! I'm your ROOTUIP Assistant. How can I help you today?`;
        }
        return this.getRandomResponse('greeting');
    }
    
    // Get random response
    getRandomResponse(type) {
        const responses = this.responses[type];
        if (Array.isArray(responses)) {
            return responses[Math.floor(Math.random() * responses.length)];
        }
        return responses;
    }
    
    // Format response with variables
    formatResponse(template, data) {
        let response = this.responses[template];
        Object.keys(data).forEach(key => {
            response = response.replace(`{${key}}`, data[key]);
        });
        return response;
    }
    
    // Get common questions
    getCommonQuestions() {
        return [
            { type: 'question', label: 'Track a container', action: 'intent:track_container' },
            { type: 'question', label: 'View billing', action: 'intent:billing_inquiry' },
            { type: 'question', label: 'Report an issue', action: 'intent:technical_issue' },
            { type: 'question', label: 'API help', action: 'intent:api_help' }
        ];
    }
    
    // Generate quick replies based on context
    generateQuickReplies(context) {
        const replies = [];
        
        if (!context.escalated) {
            replies.push({ label: 'Talk to an agent', action: 'intent:human_agent' });
        }
        
        if (context.conversationHistory.length > 2) {
            replies.push({ label: 'Start over', action: 'restart' });
        }
        
        replies.push({ label: 'End chat', action: 'end_chat' });
        
        return replies;
    }
    
    // Mock container info
    async getContainerInfo(containerId) {
        // In production, this would query the actual database
        if (containerId.startsWith('TEST')) {
            return {
                containerId,
                location: 'Port of Shanghai',
                eta: '2024-01-15',
                status: 'In Transit',
                vessel: 'Maersk Endeavor'
            };
        }
        return null;
    }
    
    // Get error help
    async getErrorHelp(errorCode) {
        const errorHelp = await this.knowledgeBase.getErrorHelp(errorCode);
        return errorHelp;
    }
    
    // Add message to history
    addMessageToHistory(sessionId, sender, message) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.context.conversationHistory.push({
                sender,
                message,
                timestamp: new Date()
            });
        }
    }
    
    // Track chat analytics
    trackChatAnalytics(session, analysis, response) {
        const analytics = {
            sessionId: session.id,
            userId: session.userId,
            messageCount: session.metrics.messages,
            intent: analysis.intent,
            confidence: analysis.confidence,
            sentiment: analysis.sentiment,
            escalated: response.escalate || false,
            articlesShared: session.metrics.articlesShared,
            timestamp: new Date()
        };
        
        this.emit('analytics:chat', analytics);
    }
    
    // End session
    endSession(sessionId, resolved = false) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.endTime = new Date();
            session.metrics.resolved = resolved;
            session.duration = session.endTime - session.startTime;
            
            // Save conversation for analysis
            this.conversations.set(sessionId, session);
            
            // Remove from active sessions
            this.sessions.delete(sessionId);
            
            // Emit session ended event
            this.emit('session:ended', session);
        }
    }
    
    // Session cleanup
    startSessionCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [sessionId, session] of this.sessions) {
                if (now - session.lastActivity > this.config.sessionTimeout) {
                    this.endSession(sessionId);
                }
            }
        }, 60000); // Check every minute
    }
    
    // Generate session ID
    generateSessionId() {
        return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Get chat analytics
    getChatAnalytics() {
        const analytics = {
            totalSessions: this.conversations.size,
            activeSessions: this.sessions.size,
            averageDuration: 0,
            resolutionRate: 0,
            escalationRate: 0,
            commonIntents: new Map(),
            sentimentBreakdown: {
                positive: 0,
                neutral: 0,
                negative: 0
            }
        };
        
        let totalDuration = 0;
        let resolvedCount = 0;
        let escalatedCount = 0;
        
        for (const session of this.conversations.values()) {
            totalDuration += session.duration || 0;
            if (session.metrics.resolved) resolvedCount++;
            if (session.context.escalated) escalatedCount++;
            
            // Count intents
            session.context.conversationHistory.forEach(msg => {
                if (msg.analysis?.intent) {
                    const count = analytics.commonIntents.get(msg.analysis.intent) || 0;
                    analytics.commonIntents.set(msg.analysis.intent, count + 1);
                }
            });
        }
        
        analytics.averageDuration = this.conversations.size > 0 ? 
            totalDuration / this.conversations.size : 0;
        analytics.resolutionRate = this.conversations.size > 0 ? 
            (resolvedCount / this.conversations.size * 100).toFixed(1) : 0;
        analytics.escalationRate = this.conversations.size > 0 ? 
            (escalatedCount / this.conversations.size * 100).toFixed(1) : 0;
        
        return analytics;
    }
}

module.exports = { SmartSupportChatbot };