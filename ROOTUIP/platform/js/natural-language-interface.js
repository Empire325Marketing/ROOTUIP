// UIP Natural Language Interface - AI-Powered Query Processing
// Advanced NLP capabilities for freight intelligence queries

class NaturalLanguageInterface {
    constructor() {
        this.queryProcessor = new QueryProcessor();
        this.intentClassifier = new IntentClassifier();
        this.entityExtractor = new NLPEntityExtractor();
        this.responseGenerator = new ResponseGenerator();
        this.conversationManager = new ConversationManager();
        this.knowledgeBase = new KnowledgeBase();
        this.contextManager = new ContextManager();
        this.initialized = false;
    }

    async initialize() {
        console.log('Initializing Natural Language Interface...');
        
        await Promise.all([
            this.queryProcessor.initialize(),
            this.intentClassifier.initialize(),
            this.entityExtractor.initialize(),
            this.responseGenerator.initialize(),
            this.conversationManager.initialize(),
            this.knowledgeBase.initialize(),
            this.contextManager.initialize()
        ]);

        this.initialized = true;
        console.log('Natural Language Interface initialized successfully');
    }

    async processQuery(query, context = {}) {
        if (!this.initialized) {
            throw new Error('Natural Language Interface not initialized');
        }

        const sessionId = context.sessionId || this.generateSessionId();
        
        try {
            // Update conversation context
            await this.conversationManager.addMessage(sessionId, 'user', query);
            
            // Process the natural language query
            const processedQuery = await this.queryProcessor.process(query, context);
            
            // Classify intent
            const intent = await this.intentClassifier.classify(processedQuery);
            
            // Extract entities
            const entities = await this.entityExtractor.extract(processedQuery, intent);
            
            // Update context with new entities
            const updatedContext = await this.contextManager.updateContext(sessionId, {
                ...context,
                intent,
                entities,
                query: processedQuery
            });

            // Generate response
            const response = await this.generateResponse(intent, entities, updatedContext);
            
            // Add response to conversation
            await this.conversationManager.addMessage(sessionId, 'assistant', response.text);
            
            return {
                sessionId,
                intent: intent.name,
                confidence: intent.confidence,
                entities,
                response: response.text,
                data: response.data,
                suggestions: response.suggestions,
                followUpQuestions: response.followUpQuestions
            };

        } catch (error) {
            console.error('Query processing failed:', error);
            
            const fallbackResponse = await this.generateFallbackResponse(query, error);
            
            return {
                sessionId,
                intent: 'error',
                confidence: 0,
                entities: [],
                response: fallbackResponse,
                error: error.message
            };
        }
    }

    async generateResponse(intent, entities, context) {
        switch (intent.name) {
            case 'container_status':
                return await this.handleContainerStatusQuery(entities, context);
            case 'tracking_update':
                return await this.handleTrackingQuery(entities, context);
            case 'dd_risk_check':
                return await this.handleDDRiskQuery(entities, context);
            case 'cost_inquiry':
                return await this.handleCostInquiry(entities, context);
            case 'delay_prediction':
                return await this.handleDelayPrediction(entities, context);
            case 'document_status':
                return await this.handleDocumentStatus(entities, context);
            case 'port_congestion':
                return await this.handlePortCongestion(entities, context);
            case 'analytics_request':
                return await this.handleAnalyticsRequest(entities, context);
            case 'help_request':
                return await this.handleHelpRequest(entities, context);
            default:
                return await this.handleGenericQuery(intent, entities, context);
        }
    }

    async handleContainerStatusQuery(entities, context) {
        const containerNumbers = entities.filter(e => e.type === 'CONTAINER_NUMBER').map(e => e.value);
        
        if (containerNumbers.length === 0) {
            return {
                text: "I need a container number to check the status. Could you please provide the container number?",
                data: null,
                suggestions: ["Try: 'What's the status of MSKU1234567?'"]
            };
        }

        // Simulate fetching container data
        const containerData = await this.fetchContainerData(containerNumbers[0]);
        
        const response = this.formatContainerStatusResponse(containerData);
        
        return {
            text: response.text,
            data: containerData,
            suggestions: response.suggestions,
            followUpQuestions: [
                "Would you like to see the full tracking history?",
                "Should I check for any D&D risks?",
                "Do you want predictions for delivery?"
            ]
        };
    }

    async handleTrackingQuery(entities, context) {
        const containerNumbers = entities.filter(e => e.type === 'CONTAINER_NUMBER').map(e => e.value);
        const blNumbers = entities.filter(e => e.type === 'BL_NUMBER').map(e => e.value);
        
        const identifier = containerNumbers[0] || blNumbers[0];
        
        if (!identifier) {
            return {
                text: "I need a container number or bill of lading number to provide tracking information.",
                suggestions: ["Try: 'Track container MSKU1234567'", "Try: 'Where is BL ABC123456?'"]
            };
        }

        const trackingData = await this.fetchTrackingData(identifier);
        const response = this.formatTrackingResponse(trackingData);
        
        return {
            text: response.text,
            data: trackingData,
            suggestions: response.suggestions
        };
    }

    async handleDDRiskQuery(entities, context) {
        const containerNumbers = entities.filter(e => e.type === 'CONTAINER_NUMBER').map(e => e.value);
        
        if (containerNumbers.length === 0) {
            return {
                text: "Which container would you like me to check for D&D risk?",
                suggestions: ["Try: 'Check D&D risk for MSKU1234567'"]
            };
        }

        // Use AI prediction engine
        const riskData = await this.getPredictiveAnalytics('dd_risk', { containerNumber: containerNumbers[0] });
        const response = this.formatDDRiskResponse(riskData);
        
        return {
            text: response.text,
            data: riskData,
            suggestions: response.suggestions,
            followUpQuestions: [
                "Would you like me to schedule a pickup?",
                "Should I set up automated alerts for this container?"
            ]
        };
    }

    async handleCostInquiry(entities, context) {
        const origins = entities.filter(e => e.type === 'LOCATION' || e.type === 'PORT').map(e => e.value);
        const destinations = entities.filter(e => e.type === 'DESTINATION').map(e => e.value);
        
        if (origins.length === 0 || destinations.length === 0) {
            return {
                text: "I need both origin and destination to provide cost information. Where are you shipping from and to?",
                suggestions: ["Try: 'What's the cost from Shanghai to Los Angeles?'"]
            };
        }

        const costData = await this.getCostEstimate(origins[0], destinations[0]);
        const response = this.formatCostResponse(costData);
        
        return {
            text: response.text,
            data: costData,
            suggestions: response.suggestions
        };
    }

    async handleDelayPrediction(entities, context) {
        const containerNumbers = entities.filter(e => e.type === 'CONTAINER_NUMBER').map(e => e.value);
        const routes = entities.filter(e => e.type === 'ROUTE').map(e => e.value);
        
        const prediction = await this.getPredictiveAnalytics('container_delay', {
            containerNumber: containerNumbers[0],
            route: routes[0]
        });
        
        const response = this.formatDelayPredictionResponse(prediction);
        
        return {
            text: response.text,
            data: prediction,
            suggestions: response.suggestions
        };
    }

    async handleDocumentStatus(entities, context) {
        const documentTypes = entities.filter(e => e.type === 'DOCUMENT_TYPE').map(e => e.value);
        const references = entities.filter(e => e.type === 'REFERENCE_NUMBER').map(e => e.value);
        
        const documentData = await this.fetchDocumentStatus(references[0], documentTypes[0]);
        const response = this.formatDocumentStatusResponse(documentData);
        
        return {
            text: response.text,
            data: documentData,
            suggestions: response.suggestions
        };
    }

    async handlePortCongestion(entities, context) {
        const ports = entities.filter(e => e.type === 'PORT' || e.type === 'LOCATION').map(e => e.value);
        
        if (ports.length === 0) {
            return {
                text: "Which port would you like me to check for congestion?",
                suggestions: ["Try: 'What's the congestion at Los Angeles port?'"]
            };
        }

        const congestionData = await this.getPredictiveAnalytics('port_congestion', { portCode: ports[0] });
        const response = this.formatPortCongestionResponse(congestionData);
        
        return {
            text: response.text,
            data: congestionData,
            suggestions: response.suggestions
        };
    }

    async handleAnalyticsRequest(entities, context) {
        const metrics = entities.filter(e => e.type === 'METRIC').map(e => e.value);
        const timeframes = entities.filter(e => e.type === 'TIMEFRAME').map(e => e.value);
        
        const analyticsData = await this.getAnalyticsData(metrics[0], timeframes[0]);
        const response = this.formatAnalyticsResponse(analyticsData);
        
        return {
            text: response.text,
            data: analyticsData,
            suggestions: response.suggestions
        };
    }

    async handleHelpRequest(entities, context) {
        const topics = entities.filter(e => e.type === 'HELP_TOPIC').map(e => e.value);
        
        const helpContent = await this.knowledgeBase.getHelp(topics[0] || 'general');
        
        return {
            text: helpContent.content,
            data: helpContent,
            suggestions: helpContent.relatedTopics,
            followUpQuestions: helpContent.commonQuestions
        };
    }

    async handleGenericQuery(intent, entities, context) {
        const knowledgeResult = await this.knowledgeBase.search(context.query);
        
        if (knowledgeResult.confidence > 0.7) {
            return {
                text: knowledgeResult.answer,
                data: knowledgeResult,
                suggestions: knowledgeResult.relatedQuestions
            };
        }

        return {
            text: "I'm not sure I understand that request. Could you please rephrase it or try asking about container status, tracking, costs, or delays?",
            suggestions: [
                "Ask about container status",
                "Check tracking information",
                "Get cost estimates",
                "View port congestion"
            ]
        };
    }

    // Response Formatters
    formatContainerStatusResponse(containerData) {
        const status = containerData.status;
        const location = containerData.currentLocation;
        const eta = containerData.eta;
        
        let text = `Container ${containerData.containerNumber} is currently ${status}`;
        
        if (location) {
            text += ` at ${location}`;
        }
        
        if (eta) {
            const etaDate = new Date(eta);
            text += `. Expected arrival: ${etaDate.toLocaleDateString()}`;
        }
        
        const suggestions = [
            "Check D&D risk",
            "View full tracking history",
            "Get delay predictions"
        ];
        
        return { text, suggestions };
    }

    formatTrackingResponse(trackingData) {
        const events = trackingData.events || [];
        const latestEvent = events[0];
        
        let text = `Latest update for ${trackingData.identifier}: `;
        
        if (latestEvent) {
            text += `${latestEvent.description} at ${latestEvent.location} on ${new Date(latestEvent.timestamp).toLocaleDateString()}`;
        } else {
            text += "No tracking events found";
        }
        
        const suggestions = [
            "Show all tracking events",
            "Get delivery prediction",
            "Check for delays"
        ];
        
        return { text, suggestions };
    }

    formatDDRiskResponse(riskData) {
        const riskLevel = riskData.riskLevel;
        const riskScore = Math.round(riskData.riskScore * 100);
        
        let text = `D&D Risk Level: ${riskLevel} (${riskScore}% probability)`;
        
        if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
            text += ". ⚠️ Immediate action recommended!";
            
            if (riskData.recommendations && riskData.recommendations.length > 0) {
                text += ` ${riskData.recommendations[0].description}`;
            }
        }
        
        const suggestions = [
            "Schedule pickup",
            "Request free time extension",
            "View mitigation options"
        ];
        
        return { text, suggestions };
    }

    formatCostResponse(costData) {
        const cost = costData.estimatedCost;
        const currency = costData.currency || 'USD';
        
        let text = `Estimated cost: ${currency} ${cost.toLocaleString()}`;
        
        if (costData.breakdown) {
            text += ` (Ocean freight: ${costData.breakdown.oceanFreight}, Local charges: ${costData.breakdown.localCharges})`;
        }
        
        if (costData.transitTime) {
            text += `. Transit time: ${costData.transitTime} days`;
        }
        
        const suggestions = [
            "Get cost breakdown",
            "Compare carriers",
            "Book shipment"
        ];
        
        return { text, suggestions };
    }

    formatDelayPredictionResponse(prediction) {
        const probability = Math.round(prediction.delayProbability * 100);
        const expectedDelay = prediction.expectedDelay;
        
        let text = `Delay probability: ${probability}%`;
        
        if (expectedDelay > 0) {
            text += `. Expected delay: ${expectedDelay} day${expectedDelay > 1 ? 's' : ''}`;
            
            if (prediction.delayReasons && prediction.delayReasons.length > 0) {
                text += `. Main reason: ${prediction.delayReasons[0].description}`;
            }
        }
        
        const suggestions = [
            "View mitigation options",
            "Get alternative routes",
            "Set up alerts"
        ];
        
        return { text, suggestions };
    }

    formatPortCongestionResponse(congestionData) {
        const level = Math.round(congestionData.congestionLevel * 100);
        const trend = congestionData.trend;
        
        let text = `Port congestion: ${level}% (${trend})`;
        
        if (level > 80) {
            text += ". ⚠️ High congestion - consider alternative ports";
        } else if (level > 60) {
            text += ". ⚠️ Moderate congestion - possible delays";
        } else {
            text += ". ✅ Normal operations";
        }
        
        const suggestions = [
            "View alternative ports",
            "Get congestion forecast",
            "Check processing times"
        ];
        
        return { text, suggestions };
    }

    formatAnalyticsResponse(analyticsData) {
        const metric = analyticsData.metric;
        const value = analyticsData.value;
        const change = analyticsData.change;
        
        let text = `${metric}: ${value}`;
        
        if (change) {
            const changeText = change > 0 ? `+${change}` : change;
            text += ` (${changeText}% vs previous period)`;
        }
        
        const suggestions = [
            "View detailed breakdown",
            "Export report",
            "Set up alerts"
        ];
        
        return { text, suggestions };
    }

    async generateFallbackResponse(query, error) {
        const fallbacks = [
            "I apologize, but I'm having trouble understanding that request. Could you please rephrase it?",
            "I'm not sure about that. Try asking about container status, tracking, costs, or port information.",
            "Let me help you with that. What specific information are you looking for?",
            "I can help with container tracking, D&D risk assessment, cost estimates, and more. What would you like to know?"
        ];
        
        return fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }

    // Data Fetching Methods (simulate API calls)
    async fetchContainerData(containerNumber) {
        await this.sleep(200);
        
        return {
            containerNumber,
            status: 'In Transit',
            currentLocation: 'Pacific Ocean',
            vessel: 'Maersk Edinburg',
            eta: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            origin: 'Shanghai',
            destination: 'Los Angeles'
        };
    }

    async fetchTrackingData(identifier) {
        await this.sleep(300);
        
        return {
            identifier,
            events: [
                {
                    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                    description: 'Departed',
                    location: 'Shanghai',
                    status: 'DEPARTED'
                },
                {
                    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
                    description: 'Loaded',
                    location: 'Shanghai Terminal',
                    status: 'LOADED'
                }
            ]
        };
    }

    async getPredictiveAnalytics(type, data) {
        await this.sleep(500);
        
        // Simulate calling the predictive analytics engine
        if (typeof window !== 'undefined' && window.AIEngine) {
            return await window.AIEngine.predictiveAnalytics.predict(type, data);
        }
        
        // Fallback mock data
        switch (type) {
            case 'dd_risk':
                return {
                    riskScore: 0.75,
                    riskLevel: 'HIGH',
                    recommendations: [
                        { description: 'Schedule immediate pickup to avoid charges' }
                    ]
                };
            case 'container_delay':
                return {
                    delayProbability: 0.3,
                    expectedDelay: 1,
                    delayReasons: [
                        { description: 'Port congestion at destination' }
                    ]
                };
            case 'port_congestion':
                return {
                    congestionLevel: 0.65,
                    trend: 'stable'
                };
            default:
                return {};
        }
    }

    async getCostEstimate(origin, destination) {
        await this.sleep(400);
        
        return {
            estimatedCost: 2500 + Math.random() * 1000,
            currency: 'USD',
            transitTime: 14,
            breakdown: {
                oceanFreight: 2000,
                localCharges: 500
            }
        };
    }

    async fetchDocumentStatus(reference, type) {
        await this.sleep(200);
        
        return {
            reference,
            type: type || 'Bill of Lading',
            status: 'Processed',
            confidence: 0.95
        };
    }

    async getAnalyticsData(metric, timeframe) {
        await this.sleep(300);
        
        return {
            metric: metric || 'Total Savings',
            value: '$14.2M',
            change: 23,
            timeframe: timeframe || 'YTD'
        };
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Query Processor
class QueryProcessor {
    async initialize() {
        console.log('Initializing Query Processor...');
    }

    async process(query, context) {
        // Clean and normalize the query
        let processed = query.toLowerCase().trim();
        
        // Handle common contractions
        processed = processed.replace(/what's/g, 'what is');
        processed = processed.replace(/where's/g, 'where is');
        processed = processed.replace(/how's/g, 'how is');
        
        // Normalize container number patterns
        processed = processed.replace(/container\s*#?\s*([a-z]{4}\d{7})/gi, 'container $1');
        
        return {
            original: query,
            processed,
            tokens: processed.split(/\s+/),
            context
        };
    }
}

// Intent Classifier
class IntentClassifier {
    constructor() {
        this.intents = new Map();
    }

    async initialize() {
        console.log('Initializing Intent Classifier...');
        
        // Define intent patterns
        this.intents.set('container_status', {
            patterns: [
                /status.*container/i,
                /where.*container/i,
                /container.*status/i,
                /check.*container/i
            ],
            keywords: ['status', 'where', 'location', 'container']
        });
        
        this.intents.set('tracking_update', {
            patterns: [
                /track/i,
                /tracking/i,
                /trace/i,
                /follow/i
            ],
            keywords: ['track', 'tracking', 'trace', 'follow', 'updates']
        });
        
        this.intents.set('dd_risk_check', {
            patterns: [
                /d&d/i,
                /demurrage/i,
                /detention/i,
                /risk/i
            ],
            keywords: ['dd', 'demurrage', 'detention', 'risk', 'charges']
        });
        
        this.intents.set('cost_inquiry', {
            patterns: [
                /cost/i,
                /price/i,
                /rate/i,
                /quote/i,
                /how much/i
            ],
            keywords: ['cost', 'price', 'rate', 'quote', 'much', 'expensive']
        });
        
        this.intents.set('delay_prediction', {
            patterns: [
                /delay/i,
                /late/i,
                /behind/i,
                /schedule/i
            ],
            keywords: ['delay', 'late', 'behind', 'schedule', 'time']
        });
        
        this.intents.set('help_request', {
            patterns: [
                /help/i,
                /how.*do/i,
                /what.*can/i,
                /assist/i
            ],
            keywords: ['help', 'how', 'what', 'can', 'assist', 'support']
        });
    }

    async classify(processedQuery) {
        const { processed, tokens } = processedQuery;
        const scores = new Map();
        
        for (const [intentName, intentDef] of this.intents.entries()) {
            let score = 0;
            
            // Check pattern matches
            for (const pattern of intentDef.patterns) {
                if (pattern.test(processed)) {
                    score += 0.8;
                }
            }
            
            // Check keyword matches
            for (const keyword of intentDef.keywords) {
                if (tokens.includes(keyword.toLowerCase())) {
                    score += 0.3;
                }
            }
            
            if (score > 0) {
                scores.set(intentName, score);
            }
        }
        
        // Find best match
        let bestIntent = 'unknown';
        let bestScore = 0;
        
        for (const [intent, score] of scores.entries()) {
            if (score > bestScore) {
                bestIntent = intent;
                bestScore = score;
            }
        }
        
        return {
            name: bestIntent,
            confidence: Math.min(bestScore, 1.0),
            allScores: Object.fromEntries(scores)
        };
    }
}

// NLP Entity Extractor
class NLPEntityExtractor {
    constructor() {
        this.patterns = new Map();
    }

    async initialize() {
        console.log('Initializing NLP Entity Extractor...');
        
        // Define entity patterns
        this.patterns.set('CONTAINER_NUMBER', /\b[A-Z]{4}\d{7}\b/gi);
        this.patterns.set('BL_NUMBER', /(?:bl|bill of lading)\s*#?\s*([A-Z0-9]+)/gi);
        this.patterns.set('PORT', /\b(?:port of |port )?([A-Z]{5}|[A-Z][a-z]+ [A-Z][a-z]+)\b/gi);
        this.patterns.set('DATE', /\b\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}\b/g);
        this.patterns.set('AMOUNT', /\$[\d,]+\.?\d*/g);
        this.patterns.set('PERCENTAGE', /\d+\.?\d*%/g);
    }

    async extract(processedQuery, intent) {
        const { processed } = processedQuery;
        const entities = [];
        
        for (const [type, pattern] of this.patterns.entries()) {
            const matches = [...processed.matchAll(pattern)];
            
            for (const match of matches) {
                entities.push({
                    type,
                    value: match[1] || match[0],
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                    confidence: 0.9
                });
            }
        }
        
        // Add intent-specific entity extraction
        entities.push(...this.extractIntentEntities(processed, intent));
        
        return entities;
    }

    extractIntentEntities(text, intent) {
        const entities = [];
        
        switch (intent.name) {
            case 'cost_inquiry':
                const fromMatch = text.match(/from\s+([a-z\s]+?)(?:\s+to|\s+$)/i);
                const toMatch = text.match(/to\s+([a-z\s]+?)(?:\s|$)/i);
                
                if (fromMatch) {
                    entities.push({
                        type: 'ORIGIN',
                        value: fromMatch[1].trim(),
                        confidence: 0.8
                    });
                }
                
                if (toMatch) {
                    entities.push({
                        type: 'DESTINATION',
                        value: toMatch[1].trim(),
                        confidence: 0.8
                    });
                }
                break;
                
            case 'analytics_request':
                const metricMatch = text.match(/(savings|cost|revenue|performance|efficiency)/i);
                if (metricMatch) {
                    entities.push({
                        type: 'METRIC',
                        value: metricMatch[1],
                        confidence: 0.85
                    });
                }
                break;
        }
        
        return entities;
    }
}

// Additional support classes
class ResponseGenerator {
    async initialize() {
        console.log('Initializing Response Generator...');
    }
}

class ConversationManager {
    constructor() {
        this.conversations = new Map();
    }

    async initialize() {
        console.log('Initializing Conversation Manager...');
    }

    async addMessage(sessionId, role, content) {
        if (!this.conversations.has(sessionId)) {
            this.conversations.set(sessionId, []);
        }
        
        this.conversations.get(sessionId).push({
            role,
            content,
            timestamp: new Date()
        });
    }

    getConversation(sessionId) {
        return this.conversations.get(sessionId) || [];
    }
}

class KnowledgeBase {
    constructor() {
        this.knowledge = new Map();
    }

    async initialize() {
        console.log('Initializing Knowledge Base...');
        
        // Load knowledge base content
        this.knowledge.set('general', {
            content: "I can help you with container tracking, D&D risk assessment, cost estimates, delay predictions, and port information.",
            relatedTopics: ['tracking', 'costs', 'delays', 'ports'],
            commonQuestions: [
                "How do I track a container?",
                "What is D&D risk?",
                "How do I get cost estimates?"
            ]
        });
    }

    async search(query) {
        // Simple keyword-based search
        for (const [topic, content] of this.knowledge.entries()) {
            if (query.toLowerCase().includes(topic)) {
                return {
                    answer: content.content,
                    confidence: 0.8,
                    relatedQuestions: content.commonQuestions
                };
            }
        }
        
        return {
            answer: "I don't have specific information about that.",
            confidence: 0.2,
            relatedQuestions: []
        };
    }

    async getHelp(topic) {
        return this.knowledge.get(topic) || this.knowledge.get('general');
    }
}

class ContextManager {
    constructor() {
        this.contexts = new Map();
    }

    async initialize() {
        console.log('Initializing Context Manager...');
    }

    async updateContext(sessionId, newContext) {
        const existing = this.contexts.get(sessionId) || {};
        const updated = { ...existing, ...newContext };
        this.contexts.set(sessionId, updated);
        return updated;
    }

    getContext(sessionId) {
        return this.contexts.get(sessionId) || {};
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        NaturalLanguageInterface,
        QueryProcessor,
        IntentClassifier,
        NLPEntityExtractor,
        ResponseGenerator,
        ConversationManager,
        KnowledgeBase,
        ContextManager
    };
}