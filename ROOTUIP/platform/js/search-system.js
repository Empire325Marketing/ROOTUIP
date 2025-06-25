// UIP Advanced Search and Filtering System
// Enterprise-grade search with AI-powered natural language queries

class SearchSystem {
    constructor() {
        this.searchEngine = new SearchEngine();
        this.filterEngine = new FilterEngine();
        this.nlpProcessor = new NLPSearchProcessor();
        this.indexer = new SearchIndexer();
        this.cache = new SearchCache();
        this.analytics = new SearchAnalytics();
        this.initialized = false;
    }

    async initialize() {
        console.log('Initializing UIP Search System...');
        
        await Promise.all([
            this.searchEngine.initialize(),
            this.filterEngine.initialize(),
            this.nlpProcessor.initialize(),
            this.indexer.initialize(),
            this.cache.initialize(),
            this.analytics.initialize()
        ]);

        // Build initial search index
        await this.buildSearchIndex();
        
        this.initialized = true;
        console.log('Search System initialized successfully');
    }

    async buildSearchIndex() {
        console.log('Building search index...');
        
        // Index all searchable content
        const indexData = [
            ...await this.indexContainers(),
            ...await this.indexShipments(),
            ...await this.indexDocuments(),
            ...await this.indexCarriers(),
            ...await this.indexPorts(),
            ...await this.indexInvoices(),
            ...await this.indexBookings()
        ];

        await this.indexer.buildIndex(indexData);
        console.log(`Search index built with ${indexData.length} items`);
    }

    async search(query, options = {}) {
        if (!this.initialized) {
            throw new Error('Search System not initialized');
        }

        const searchId = this.generateSearchId();
        const startTime = Date.now();

        try {
            // Check cache first
            const cacheKey = this.cache.generateKey(query, options);
            const cachedResults = await this.cache.get(cacheKey);
            
            if (cachedResults && !options.fresh) {
                await this.analytics.recordSearch(searchId, query, cachedResults, true);
                return cachedResults;
            }

            // Process natural language query
            const processedQuery = await this.nlpProcessor.process(query);
            
            // Execute search
            const searchResults = await this.searchEngine.search(processedQuery, options);
            
            // Apply filters
            const filteredResults = await this.filterEngine.apply(searchResults, options.filters);
            
            // Enhance results with additional data
            const enhancedResults = await this.enhanceResults(filteredResults, options);
            
            // Cache results
            await this.cache.set(cacheKey, enhancedResults);
            
            // Record analytics
            await this.analytics.recordSearch(searchId, query, enhancedResults, false);
            
            return {
                searchId,
                query,
                processedQuery,
                results: enhancedResults,
                total: enhancedResults.length,
                searchTime: Date.now() - startTime,
                suggestions: await this.generateSuggestions(query, enhancedResults)
            };

        } catch (error) {
            console.error('Search failed:', error);
            await this.analytics.recordError(searchId, query, error);
            throw error;
        }
    }

    async advancedSearch(criteria, options = {}) {
        const queries = [];
        
        Object.entries(criteria).forEach(([field, value]) => {
            if (value && value.trim()) {
                queries.push(`${field}:${value}`);
            }
        });

        const combinedQuery = queries.join(' AND ');
        return await this.search(combinedQuery, {
            ...options,
            advanced: true,
            criteria
        });
    }

    async facetedSearch(query, facets = [], options = {}) {
        const results = await this.search(query, options);
        
        const facetResults = {};
        for (const facet of facets) {
            facetResults[facet] = await this.calculateFacets(results.results, facet);
        }
        
        return {
            ...results,
            facets: facetResults
        };
    }

    async generateSuggestions(query, results) {
        const suggestions = [];
        
        // Query suggestions based on common searches
        const commonQueries = await this.analytics.getCommonQueries();
        const querySuggestions = commonQueries
            .filter(q => q.toLowerCase().includes(query.toLowerCase()) && q !== query)
            .slice(0, 3);
        
        suggestions.push(...querySuggestions.map(q => ({
            type: 'query',
            text: q,
            description: 'Popular search'
        })));

        // Filter suggestions based on results
        if (results.length > 0) {
            const carriers = [...new Set(results.map(r => r.carrier).filter(Boolean))];
            const ports = [...new Set(results.map(r => r.port).filter(Boolean))];
            
            carriers.slice(0, 2).forEach(carrier => {
                suggestions.push({
                    type: 'filter',
                    text: `carrier:${carrier}`,
                    description: `Filter by ${carrier}`
                });
            });
            
            ports.slice(0, 2).forEach(port => {
                suggestions.push({
                    type: 'filter',
                    text: `port:${port}`,
                    description: `Filter by ${port}`
                });
            });
        }

        // Auto-complete suggestions
        const autoComplete = await this.getAutoComplete(query);
        suggestions.push(...autoComplete);

        return suggestions.slice(0, 8);
    }

    async getAutoComplete(query) {
        const terms = await this.indexer.getTerms(query);
        return terms.map(term => ({
            type: 'autocomplete',
            text: term,
            description: 'Auto-complete'
        }));
    }

    // Indexing methods
    async indexContainers() {
        const containers = await this.fetchContainers();
        return containers.map(container => ({
            id: container.id,
            type: 'container',
            title: `Container ${container.number}`,
            content: `${container.number} ${container.carrier} ${container.status} ${container.origin} ${container.destination}`,
            searchableFields: {
                containerNumber: container.number,
                carrier: container.carrier,
                status: container.status,
                origin: container.origin,
                destination: container.destination,
                vessel: container.vessel,
                voyage: container.voyage
            },
            metadata: {
                created: container.created,
                updated: container.updated,
                priority: container.priority || 'normal'
            },
            data: container
        }));
    }

    async indexShipments() {
        const shipments = await this.fetchShipments();
        return shipments.map(shipment => ({
            id: shipment.id,
            type: 'shipment',
            title: `Shipment ${shipment.number}`,
            content: `${shipment.number} ${shipment.carrier} ${shipment.status} ${shipment.shipper} ${shipment.consignee}`,
            searchableFields: {
                shipmentNumber: shipment.number,
                carrier: shipment.carrier,
                status: shipment.status,
                shipper: shipment.shipper,
                consignee: shipment.consignee,
                blNumber: shipment.blNumber
            },
            metadata: {
                created: shipment.created,
                updated: shipment.updated,
                value: shipment.value
            },
            data: shipment
        }));
    }

    async indexDocuments() {
        const documents = await this.fetchDocuments();
        return documents.map(document => ({
            id: document.id,
            type: 'document',
            title: document.name,
            content: `${document.name} ${document.type} ${document.extractedText || ''}`,
            searchableFields: {
                documentName: document.name,
                documentType: document.type,
                extractedText: document.extractedText,
                blNumber: document.blNumber,
                containerNumber: document.containerNumber
            },
            metadata: {
                created: document.created,
                size: document.size,
                confidence: document.confidence
            },
            data: document
        }));
    }

    async indexCarriers() {
        const carriers = await this.fetchCarriers();
        return carriers.map(carrier => ({
            id: carrier.id,
            type: 'carrier',
            title: carrier.name,
            content: `${carrier.name} ${carrier.code} ${carrier.description || ''}`,
            searchableFields: {
                carrierName: carrier.name,
                carrierCode: carrier.code,
                services: carrier.services?.join(' ') || '',
                routes: carrier.routes?.join(' ') || ''
            },
            metadata: {
                active: carrier.active,
                rating: carrier.rating
            },
            data: carrier
        }));
    }

    async indexPorts() {
        const ports = await this.fetchPorts();
        return ports.map(port => ({
            id: port.id,
            type: 'port',
            title: `${port.name} (${port.code})`,
            content: `${port.name} ${port.code} ${port.country} ${port.region}`,
            searchableFields: {
                portName: port.name,
                portCode: port.code,
                country: port.country,
                region: port.region,
                city: port.city
            },
            metadata: {
                latitude: port.latitude,
                longitude: port.longitude,
                timezone: port.timezone
            },
            data: port
        }));
    }

    async indexInvoices() {
        const invoices = await this.fetchInvoices();
        return invoices.map(invoice => ({
            id: invoice.id,
            type: 'invoice',
            title: `Invoice ${invoice.number}`,
            content: `${invoice.number} ${invoice.supplier} ${invoice.customer} ${invoice.amount}`,
            searchableFields: {
                invoiceNumber: invoice.number,
                supplier: invoice.supplier,
                customer: invoice.customer,
                amount: invoice.amount,
                currency: invoice.currency,
                status: invoice.status
            },
            metadata: {
                created: invoice.created,
                dueDate: invoice.dueDate,
                paid: invoice.paid
            },
            data: invoice
        }));
    }

    async indexBookings() {
        const bookings = await this.fetchBookings();
        return bookings.map(booking => ({
            id: booking.id,
            type: 'booking',
            title: `Booking ${booking.number}`,
            content: `${booking.number} ${booking.carrier} ${booking.shipper} ${booking.origin} ${booking.destination}`,
            searchableFields: {
                bookingNumber: booking.number,
                carrier: booking.carrier,
                shipper: booking.shipper,
                origin: booking.origin,
                destination: booking.destination,
                commodity: booking.commodity
            },
            metadata: {
                created: booking.created,
                sailingDate: booking.sailingDate,
                confirmed: booking.confirmed
            },
            data: booking
        }));
    }

    // Data fetching methods (these would connect to actual data sources)
    async fetchContainers() {
        return [
            {
                id: 'c1',
                number: 'MSKU1234567',
                carrier: 'Maersk',
                status: 'In Transit',
                origin: 'Shanghai',
                destination: 'Los Angeles',
                vessel: 'Maersk Edinburg',
                voyage: '124E',
                created: '2024-03-10',
                updated: '2024-03-15'
            },
            {
                id: 'c2',
                number: 'MSCU9876543',
                carrier: 'MSC',
                status: 'Delivered',
                origin: 'Rotterdam',
                destination: 'New York',
                vessel: 'MSC Isabella',
                voyage: '247W',
                created: '2024-03-08',
                updated: '2024-03-14'
            }
        ];
    }

    async fetchShipments() {
        return [
            {
                id: 's1',
                number: 'SH001234',
                carrier: 'Maersk',
                status: 'Active',
                shipper: 'ABC Trading Co',
                consignee: 'XYZ Import Corp',
                blNumber: 'MAEU123456789',
                created: '2024-03-10',
                updated: '2024-03-15',
                value: 125000
            }
        ];
    }

    async fetchDocuments() {
        return [
            {
                id: 'd1',
                name: 'Bill of Lading - MAEU123456789.pdf',
                type: 'bill_of_lading',
                extractedText: 'Bill of Lading MAEU123456789 Maersk Edinburg Shanghai Los Angeles',
                blNumber: 'MAEU123456789',
                containerNumber: 'MSKU1234567',
                created: '2024-03-10',
                size: 245760,
                confidence: 0.97
            }
        ];
    }

    async fetchCarriers() {
        return [
            {
                id: 'cr1',
                name: 'Maersk',
                code: 'MAEU',
                description: 'A.P. Moller - Maersk',
                services: ['Ocean Freight', 'Inland Transport', 'Customs'],
                routes: ['Asia-Europe', 'Trans-Pacific', 'Trans-Atlantic'],
                active: true,
                rating: 4.5
            },
            {
                id: 'cr2',
                name: 'MSC',
                code: 'MSCU',
                description: 'Mediterranean Shipping Company',
                services: ['Ocean Freight', 'Terminal Operations'],
                routes: ['Europe-Asia', 'Americas', 'Africa'],
                active: true,
                rating: 4.2
            }
        ];
    }

    async fetchPorts() {
        return [
            {
                id: 'p1',
                name: 'Port of Los Angeles',
                code: 'USLAX',
                country: 'United States',
                region: 'North America',
                city: 'Los Angeles',
                latitude: 33.7447,
                longitude: -118.2589,
                timezone: 'America/Los_Angeles'
            },
            {
                id: 'p2',
                name: 'Port of Shanghai',
                code: 'CNSHA',
                country: 'China',
                region: 'Asia',
                city: 'Shanghai',
                latitude: 31.2304,
                longitude: 121.4737,
                timezone: 'Asia/Shanghai'
            }
        ];
    }

    async fetchInvoices() {
        return [
            {
                id: 'i1',
                number: 'INV-2024-001234',
                supplier: 'Global Freight Solutions',
                customer: 'ABC Trading Co',
                amount: 15750,
                currency: 'USD',
                status: 'Paid',
                created: '2024-03-10',
                dueDate: '2024-04-10',
                paid: true
            }
        ];
    }

    async fetchBookings() {
        return [
            {
                id: 'b1',
                number: 'BK123456789',
                carrier: 'Maersk',
                shipper: 'ABC Trading Co',
                origin: 'Shanghai',
                destination: 'Los Angeles',
                commodity: 'Electronics',
                created: '2024-03-05',
                sailingDate: '2024-03-15',
                confirmed: true
            }
        ];
    }

    async enhanceResults(results, options) {
        // Add relevance scoring
        const scoredResults = results.map(result => ({
            ...result,
            relevanceScore: this.calculateRelevance(result, options.query)
        }));

        // Sort by relevance
        scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Add related items
        for (const result of scoredResults) {
            result.related = await this.findRelatedItems(result);
        }

        return scoredResults;
    }

    calculateRelevance(result, query) {
        let score = 0;
        const queryLower = query.toLowerCase();
        
        // Exact matches in title get high score
        if (result.title.toLowerCase().includes(queryLower)) {
            score += 100;
        }
        
        // Matches in searchable fields
        Object.values(result.searchableFields).forEach(value => {
            if (value && value.toString().toLowerCase().includes(queryLower)) {
                score += 50;
            }
        });
        
        // Content matches
        if (result.content.toLowerCase().includes(queryLower)) {
            score += 25;
        }
        
        // Recent items get slight boost
        if (result.metadata.updated) {
            const daysSinceUpdate = (Date.now() - new Date(result.metadata.updated).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceUpdate < 7) {
                score += 10;
            }
        }
        
        return score;
    }

    async findRelatedItems(item) {
        const related = [];
        
        // Find related items based on common fields
        if (item.searchableFields.containerNumber) {
            const containerItems = await this.search(`containerNumber:${item.searchableFields.containerNumber}`);
            related.push(...containerItems.results.filter(r => r.id !== item.id).slice(0, 3));
        }
        
        if (item.searchableFields.blNumber) {
            const blItems = await this.search(`blNumber:${item.searchableFields.blNumber}`);
            related.push(...blItems.results.filter(r => r.id !== item.id).slice(0, 3));
        }
        
        return related.slice(0, 5);
    }

    async calculateFacets(results, facetField) {
        const facetCounts = {};
        
        results.forEach(result => {
            const value = result.searchableFields[facetField] || result.data[facetField];
            if (value) {
                facetCounts[value] = (facetCounts[value] || 0) + 1;
            }
        });
        
        return Object.entries(facetCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([value, count]) => ({ value, count }));
    }

    generateSearchId() {
        return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Search Engine Core
class SearchEngine {
    constructor() {
        this.index = new Map();
        this.termIndex = new Map();
    }

    async initialize() {
        console.log('Initializing Search Engine...');
    }

    async search(processedQuery, options = {}) {
        const { terms, filters, operators } = processedQuery;
        let results = [];

        if (terms.length === 0) {
            return [];
        }

        // Search for each term
        for (const term of terms) {
            const termResults = this.searchTerm(term);
            results.push(...termResults);
        }

        // Remove duplicates and merge scores
        const merged = this.mergeResults(results);
        
        // Apply sorting
        return this.sortResults(merged, options.sort || 'relevance');
    }

    searchTerm(term) {
        const results = [];
        
        for (const [id, item] of this.index.entries()) {
            const score = this.calculateTermScore(term, item);
            if (score > 0) {
                results.push({
                    ...item,
                    score
                });
            }
        }
        
        return results;
    }

    calculateTermScore(term, item) {
        let score = 0;
        const termLower = term.toLowerCase();
        
        // Exact match in title
        if (item.title.toLowerCase().includes(termLower)) {
            score += 100;
        }
        
        // Match in searchable fields
        Object.values(item.searchableFields).forEach(value => {
            if (value && value.toString().toLowerCase().includes(termLower)) {
                score += 50;
            }
        });
        
        // Match in content
        if (item.content.toLowerCase().includes(termLower)) {
            score += 25;
        }
        
        return score;
    }

    mergeResults(results) {
        const merged = new Map();
        
        results.forEach(result => {
            if (merged.has(result.id)) {
                merged.get(result.id).score += result.score;
            } else {
                merged.set(result.id, result);
            }
        });
        
        return Array.from(merged.values());
    }

    sortResults(results, sortBy) {
        switch (sortBy) {
            case 'relevance':
                return results.sort((a, b) => b.score - a.score);
            case 'date':
                return results.sort((a, b) => new Date(b.metadata.updated) - new Date(a.metadata.updated));
            case 'alphabetical':
                return results.sort((a, b) => a.title.localeCompare(b.title));
            default:
                return results;
        }
    }

    indexItem(item) {
        this.index.set(item.id, item);
        
        // Build term index
        const terms = this.extractTerms(item);
        terms.forEach(term => {
            if (!this.termIndex.has(term)) {
                this.termIndex.set(term, new Set());
            }
            this.termIndex.get(term).add(item.id);
        });
    }

    extractTerms(item) {
        const text = `${item.title} ${item.content}`.toLowerCase();
        return text.match(/\b\w+\b/g) || [];
    }
}

// Filter Engine
class FilterEngine {
    async initialize() {
        console.log('Initializing Filter Engine...');
    }

    async apply(results, filters = {}) {
        if (!filters || Object.keys(filters).length === 0) {
            return results;
        }

        return results.filter(result => {
            return this.matchesFilters(result, filters);
        });
    }

    matchesFilters(result, filters) {
        for (const [field, value] of Object.entries(filters)) {
            if (!this.matchesFilter(result, field, value)) {
                return false;
            }
        }
        return true;
    }

    matchesFilter(result, field, value) {
        const resultValue = result.searchableFields[field] || result.data[field];
        
        if (Array.isArray(value)) {
            return value.includes(resultValue);
        }
        
        if (typeof value === 'object' && value.range) {
            return this.matchesRange(resultValue, value.range);
        }
        
        return resultValue === value;
    }

    matchesRange(value, range) {
        if (range.min !== undefined && value < range.min) return false;
        if (range.max !== undefined && value > range.max) return false;
        return true;
    }
}

// NLP Search Processor
class NLPSearchProcessor {
    async initialize() {
        console.log('Initializing NLP Search Processor...');
        this.stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    }

    async process(query) {
        const cleaned = this.cleanQuery(query);
        const terms = this.extractTerms(cleaned);
        const filters = this.extractFilters(query);
        const operators = this.extractOperators(query);
        
        return {
            original: query,
            cleaned,
            terms,
            filters,
            operators
        };
    }

    cleanQuery(query) {
        return query
            .toLowerCase()
            .replace(/[^\w\s:]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    extractTerms(query) {
        const words = query.split(/\s+/);
        return words.filter(word => 
            word.length > 2 && 
            !this.stopWords.has(word) &&
            !word.includes(':')
        );
    }

    extractFilters(query) {
        const filters = {};
        const filterMatches = query.match(/(\w+):(\w+)/g);
        
        if (filterMatches) {
            filterMatches.forEach(match => {
                const [field, value] = match.split(':');
                filters[field] = value;
            });
        }
        
        return filters;
    }

    extractOperators(query) {
        const operators = [];
        
        if (query.includes(' AND ')) operators.push('AND');
        if (query.includes(' OR ')) operators.push('OR');
        if (query.includes(' NOT ')) operators.push('NOT');
        
        return operators;
    }
}

// Search Indexer
class SearchIndexer {
    constructor() {
        this.index = new Map();
        this.termFrequency = new Map();
    }

    async initialize() {
        console.log('Initializing Search Indexer...');
    }

    async buildIndex(items) {
        this.index.clear();
        this.termFrequency.clear();
        
        items.forEach(item => {
            this.indexItem(item);
        });
        
        console.log(`Indexed ${items.length} items`);
    }

    indexItem(item) {
        this.index.set(item.id, item);
        
        const terms = this.extractAllTerms(item);
        terms.forEach(term => {
            this.termFrequency.set(term, (this.termFrequency.get(term) || 0) + 1);
        });
    }

    extractAllTerms(item) {
        const text = [
            item.title,
            item.content,
            ...Object.values(item.searchableFields)
        ].join(' ').toLowerCase();
        
        return text.match(/\b\w+\b/g) || [];
    }

    async getTerms(prefix) {
        const terms = [];
        
        for (const [term, frequency] of this.termFrequency.entries()) {
            if (term.startsWith(prefix.toLowerCase()) && frequency > 1) {
                terms.push(term);
            }
        }
        
        return terms.sort((a, b) => this.termFrequency.get(b) - this.termFrequency.get(a)).slice(0, 10);
    }

    getIndex() {
        return this.index;
    }
}

// Search Cache
class SearchCache {
    constructor() {
        this.cache = new Map();
        this.maxSize = 1000;
        this.ttl = 300000; // 5 minutes
    }

    async initialize() {
        console.log('Initializing Search Cache...');
        this.startCleanupTask();
    }

    generateKey(query, options) {
        return btoa(JSON.stringify({ query, options }));
    }

    async get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return entry.data;
    }

    async set(key, data) {
        if (this.cache.size >= this.maxSize) {
            this.evictOldest();
        }
        
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    evictOldest() {
        const oldestKey = this.cache.keys().next().value;
        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }

    startCleanupTask() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.cache.entries()) {
                if (now - entry.timestamp > this.ttl) {
                    this.cache.delete(key);
                }
            }
        }, 60000); // Clean every minute
    }
}

// Search Analytics
class SearchAnalytics {
    constructor() {
        this.searches = [];
        this.queries = new Map();
        this.errors = [];
    }

    async initialize() {
        console.log('Initializing Search Analytics...');
    }

    async recordSearch(searchId, query, results, cached) {
        this.searches.push({
            id: searchId,
            query,
            resultCount: results.length,
            cached,
            timestamp: new Date()
        });
        
        // Update query frequency
        this.queries.set(query, (this.queries.get(query) || 0) + 1);
        
        // Keep only recent searches
        if (this.searches.length > 10000) {
            this.searches = this.searches.slice(-5000);
        }
    }

    async recordError(searchId, query, error) {
        this.errors.push({
            id: searchId,
            query,
            error: error.message,
            timestamp: new Date()
        });
    }

    async getCommonQueries() {
        return Array.from(this.queries.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([query]) => query);
    }

    getSearchStats() {
        const totalSearches = this.searches.length;
        const cachedSearches = this.searches.filter(s => s.cached).length;
        const cacheHitRate = totalSearches > 0 ? cachedSearches / totalSearches : 0;
        
        return {
            totalSearches,
            cachedSearches,
            cacheHitRate,
            errorRate: this.errors.length / totalSearches,
            averageResults: this.searches.reduce((sum, s) => sum + s.resultCount, 0) / totalSearches
        };
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SearchSystem,
        SearchEngine,
        FilterEngine,
        NLPSearchProcessor,
        SearchIndexer,
        SearchCache,
        SearchAnalytics
    };
}