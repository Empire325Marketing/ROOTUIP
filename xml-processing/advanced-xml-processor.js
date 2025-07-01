#!/usr/bin/env node

/**
 * ROOTUIP Advanced XML Processing System
 * High-performance XML parsing, validation, and transformation
 */

const { DOMParser, XMLSerializer } = require('xmldom');
const xpath = require('xpath');
const xslt = require('xslt-processor');
const { Validator } = require('jsonschema');
const sax = require('sax');
const { Transform } = require('stream');
const crypto = require('crypto');

class AdvancedXMLProcessor {
    constructor(config = {}) {
        this.config = {
            enableCaching: config.enableCaching !== false,
            cacheTTL: config.cacheTTL || 3600000, // 1 hour
            maxFileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB
            streamingThreshold: config.streamingThreshold || 10 * 1024 * 1024, // 10MB
            validateByDefault: config.validateByDefault !== false,
            ...config
        };
        
        // XML parser options
        this.parserOptions = {
            locator: true,
            errorHandler: {
                warning: (w) => this.handleWarning(w),
                error: (e) => this.handleError(e),
                fatalError: (e) => this.handleFatalError(e)
            }
        };
        
        // Schema cache
        this.schemaCache = new Map();
        
        // XSLT cache
        this.xsltCache = new Map();
        
        // Namespace registry
        this.namespaceRegistry = new Map();
        this.initializeCommonNamespaces();
        
        // Performance metrics
        this.metrics = {
            parsed: 0,
            validated: 0,
            transformed: 0,
            avgParseTime: 0,
            avgValidationTime: 0,
            avgTransformTime: 0
        };
    }
    
    // Initialize common namespaces
    initializeCommonNamespaces() {
        this.namespaceRegistry.set('xs', 'http://www.w3.org/2001/XMLSchema');
        this.namespaceRegistry.set('xsi', 'http://www.w3.org/2001/XMLSchema-instance');
        this.namespaceRegistry.set('xsl', 'http://www.w3.org/1999/XSL/Transform');
        this.namespaceRegistry.set('soap', 'http://schemas.xmlsoap.org/soap/envelope/');
        this.namespaceRegistry.set('wsdl', 'http://schemas.xmlsoap.org/wsdl/');
        
        // Industry-specific namespaces
        this.namespaceRegistry.set('hl7', 'urn:hl7-org:v2xml');
        this.namespaceRegistry.set('oagis', 'http://www.openapplications.org/oagis/10');
        this.namespaceRegistry.set('ubl', 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2');
        this.namespaceRegistry.set('cefact', 'urn:un:unece:uncefact:data:standard');
    }
    
    // Parse XML with advanced options
    async parseXML(xmlContent, options = {}) {
        const startTime = Date.now();
        
        try {
            // Check if streaming is needed
            if (this.shouldUseStreaming(xmlContent)) {
                return await this.parseXMLStreaming(xmlContent, options);
            }
            
            // Standard DOM parsing
            const parser = new DOMParser(this.parserOptions);
            const doc = parser.parseFromString(xmlContent, 'text/xml');
            
            // Extract metadata
            const metadata = this.extractMetadata(doc);
            
            // Validate if requested
            let validation = null;
            if (options.validate || this.config.validateByDefault) {
                validation = await this.validateXML(doc, options.schema);
            }
            
            // Build result
            const result = {
                success: true,
                document: doc,
                metadata,
                validation,
                namespaces: this.extractNamespaces(doc),
                parseTime: Date.now() - startTime
            };
            
            // Update metrics
            this.updateMetrics('parsed', result.parseTime);
            
            return result;
            
        } catch (error) {
            console.error('XML parsing error:', error);
            return {
                success: false,
                error: error.message,
                parseTime: Date.now() - startTime
            };
        }
    }
    
    // Streaming XML parser for large files
    async parseXMLStreaming(xmlContent, options = {}) {
        return new Promise((resolve, reject) => {
            const parser = sax.createStream(true, {
                trim: true,
                normalize: true,
                xmlns: true,
                position: true
            });
            
            const result = {
                elements: [],
                attributes: {},
                text: {},
                namespaces: {},
                errors: []
            };
            
            let currentPath = [];
            let elementCount = 0;
            
            parser.on('opentag', (node) => {
                currentPath.push(node.name);
                elementCount++;
                
                // Store element info
                const path = currentPath.join('/');
                if (!result.elements.includes(path)) {
                    result.elements.push(path);
                }
                
                // Store attributes
                if (node.attributes && Object.keys(node.attributes).length > 0) {
                    result.attributes[path] = node.attributes;
                }
                
                // Store namespaces
                if (node.ns) {
                    Object.assign(result.namespaces, node.ns);
                }
                
                // Call custom handler if provided
                if (options.onElement) {
                    options.onElement(node, currentPath);
                }
            });
            
            parser.on('text', (text) => {
                if (text.trim()) {
                    const path = currentPath.join('/');
                    if (!result.text[path]) {
                        result.text[path] = [];
                    }
                    result.text[path].push(text);
                }
            });
            
            parser.on('closetag', () => {
                currentPath.pop();
            });
            
            parser.on('error', (error) => {
                result.errors.push({
                    message: error.message,
                    line: parser._parser.line,
                    column: parser._parser.column
                });
            });
            
            parser.on('end', () => {
                resolve({
                    success: result.errors.length === 0,
                    streaming: true,
                    elementCount,
                    result,
                    errors: result.errors
                });
            });
            
            // Start parsing
            if (typeof xmlContent === 'string') {
                parser.end(xmlContent);
            } else {
                xmlContent.pipe(parser);
            }
        });
    }
    
    // Validate XML against schema
    async validateXML(doc, schemaPath) {
        const startTime = Date.now();
        
        try {
            // Load schema
            const schema = await this.loadSchema(schemaPath);
            
            // Perform validation
            const errors = [];
            const warnings = [];
            
            // Schema validation logic would go here
            // This is a placeholder for actual XSD validation
            
            const result = {
                valid: errors.length === 0,
                errors,
                warnings,
                validationTime: Date.now() - startTime
            };
            
            // Update metrics
            this.updateMetrics('validated', result.validationTime);
            
            return result;
            
        } catch (error) {
            console.error('XML validation error:', error);
            return {
                valid: false,
                errors: [{ message: error.message }],
                validationTime: Date.now() - startTime
            };
        }
    }
    
    // XSLT transformation
    async transformXML(xmlDoc, xsltPath, parameters = {}) {
        const startTime = Date.now();
        
        try {
            // Load XSLT
            const xslt = await this.loadXSLT(xsltPath);
            
            // Create processor
            const processor = new xslt.Processor();
            
            // Set parameters
            for (const [key, value] of Object.entries(parameters)) {
                processor.setParameter(null, key, value);
            }
            
            // Import stylesheet
            processor.importStylesheet(xslt);
            
            // Transform
            const resultDoc = processor.transformToDocument(xmlDoc);
            
            const result = {
                success: true,
                document: resultDoc,
                output: new XMLSerializer().serializeToString(resultDoc),
                transformTime: Date.now() - startTime
            };
            
            // Update metrics
            this.updateMetrics('transformed', result.transformTime);
            
            return result;
            
        } catch (error) {
            console.error('XSLT transformation error:', error);
            return {
                success: false,
                error: error.message,
                transformTime: Date.now() - startTime
            };
        }
    }
    
    // XPath query
    async queryXPath(doc, expression, namespaces = {}) {
        try {
            // Merge with registered namespaces
            const allNamespaces = {
                ...Object.fromEntries(this.namespaceRegistry),
                ...namespaces
            };
            
            // Create namespace resolver
            const select = xpath.useNamespaces(allNamespaces);
            
            // Execute query
            const nodes = select(expression, doc);
            
            // Format results
            const results = nodes.map(node => {
                if (typeof node === 'string' || typeof node === 'number') {
                    return { type: 'value', value: node };
                } else if (node.nodeType === 2) { // Attribute
                    return {
                        type: 'attribute',
                        name: node.name,
                        value: node.value
                    };
                } else if (node.nodeType === 1) { // Element
                    return {
                        type: 'element',
                        name: node.nodeName,
                        text: node.textContent,
                        attributes: this.getAttributes(node)
                    };
                }
                return { type: 'unknown', node };
            });
            
            return {
                success: true,
                expression,
                results,
                count: results.length
            };
            
        } catch (error) {
            console.error('XPath query error:', error);
            return {
                success: false,
                error: error.message,
                expression
            };
        }
    }
    
    // Schema management
    async loadSchema(schemaPath) {
        // Check cache
        if (this.schemaCache.has(schemaPath)) {
            const cached = this.schemaCache.get(schemaPath);
            if (Date.now() - cached.timestamp < this.config.cacheTTL) {
                return cached.schema;
            }
        }
        
        // Load schema
        const schemaContent = await this.loadFile(schemaPath);
        const parser = new DOMParser();
        const schema = parser.parseFromString(schemaContent, 'text/xml');
        
        // Cache schema
        if (this.config.enableCaching) {
            this.schemaCache.set(schemaPath, {
                schema,
                timestamp: Date.now()
            });
        }
        
        return schema;
    }
    
    // XSLT management
    async loadXSLT(xsltPath) {
        // Check cache
        if (this.xsltCache.has(xsltPath)) {
            const cached = this.xsltCache.get(xsltPath);
            if (Date.now() - cached.timestamp < this.config.cacheTTL) {
                return cached.xslt;
            }
        }
        
        // Load XSLT
        const xsltContent = await this.loadFile(xsltPath);
        const parser = new DOMParser();
        const xslt = parser.parseFromString(xsltContent, 'text/xml');
        
        // Cache XSLT
        if (this.config.enableCaching) {
            this.xsltCache.set(xsltPath, {
                xslt,
                timestamp: Date.now()
            });
        }
        
        return xslt;
    }
    
    // Namespace handling
    registerNamespace(prefix, uri) {
        this.namespaceRegistry.set(prefix, uri);
    }
    
    resolveNamespace(prefix) {
        return this.namespaceRegistry.get(prefix);
    }
    
    extractNamespaces(doc) {
        const namespaces = {};
        const root = doc.documentElement;
        
        // Extract from root element
        for (let i = 0; i < root.attributes.length; i++) {
            const attr = root.attributes[i];
            if (attr.name.startsWith('xmlns:')) {
                const prefix = attr.name.substring(6);
                namespaces[prefix] = attr.value;
            } else if (attr.name === 'xmlns') {
                namespaces[''] = attr.value; // Default namespace
            }
        }
        
        return namespaces;
    }
    
    // Performance optimization
    async optimizeXML(xmlContent, options = {}) {
        const optimizations = {
            removeComments: options.removeComments !== false,
            removeWhitespace: options.removeWhitespace !== false,
            minify: options.minify !== false,
            removeEmptyElements: options.removeEmptyElements || false,
            removeUnusedNamespaces: options.removeUnusedNamespaces || false
        };
        
        let optimized = xmlContent;
        
        if (optimizations.removeComments) {
            optimized = optimized.replace(/<!--[\s\S]*?-->/g, '');
        }
        
        if (optimizations.removeWhitespace) {
            optimized = optimized.replace(/>\s+</g, '><');
            optimized = optimized.trim();
        }
        
        if (optimizations.minify) {
            optimized = optimized.replace(/\s+/g, ' ');
            optimized = optimized.replace(/> </g, '><');
        }
        
        // Parse for advanced optimizations
        if (optimizations.removeEmptyElements || optimizations.removeUnusedNamespaces) {
            const doc = new DOMParser().parseFromString(optimized, 'text/xml');
            
            if (optimizations.removeEmptyElements) {
                this.removeEmptyElements(doc);
            }
            
            if (optimizations.removeUnusedNamespaces) {
                this.removeUnusedNamespaces(doc);
            }
            
            optimized = new XMLSerializer().serializeToString(doc);
        }
        
        const savings = ((xmlContent.length - optimized.length) / xmlContent.length * 100).toFixed(2);
        
        return {
            success: true,
            original: xmlContent.length,
            optimized: optimized.length,
            savings: `${savings}%`,
            content: optimized
        };
    }
    
    // Remove empty elements
    removeEmptyElements(node) {
        const children = Array.from(node.childNodes);
        
        for (const child of children) {
            if (child.nodeType === 1) { // Element node
                this.removeEmptyElements(child);
                
                if (!child.hasChildNodes() && !child.hasAttributes()) {
                    node.removeChild(child);
                }
            }
        }
    }
    
    // Remove unused namespaces
    removeUnusedNamespaces(doc) {
        const usedNamespaces = new Set();
        
        // Find all used namespaces
        this.findUsedNamespaces(doc.documentElement, usedNamespaces);
        
        // Remove unused namespace declarations
        const root = doc.documentElement;
        const attrs = Array.from(root.attributes);
        
        for (const attr of attrs) {
            if (attr.name.startsWith('xmlns:')) {
                const prefix = attr.name.substring(6);
                if (!usedNamespaces.has(prefix)) {
                    root.removeAttribute(attr.name);
                }
            }
        }
    }
    
    // Find used namespaces
    findUsedNamespaces(node, usedNamespaces) {
        // Check node name
        if (node.prefix) {
            usedNamespaces.add(node.prefix);
        }
        
        // Check attributes
        if (node.attributes) {
            for (let i = 0; i < node.attributes.length; i++) {
                const attr = node.attributes[i];
                if (attr.prefix) {
                    usedNamespaces.add(attr.prefix);
                }
            }
        }
        
        // Check children
        for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i];
            if (child.nodeType === 1) { // Element node
                this.findUsedNamespaces(child, usedNamespaces);
            }
        }
    }
    
    // Convert XML to JSON
    xmlToJSON(xmlDoc, options = {}) {
        const config = {
            textNodeName: options.textNodeName || '_text',
            attributePrefix: options.attributePrefix || '@',
            includeRoot: options.includeRoot !== false,
            mergeText: options.mergeText !== false
        };
        
        const convertNode = (node) => {
            const obj = {};
            
            // Add attributes
            if (node.attributes && node.attributes.length > 0) {
                for (let i = 0; i < node.attributes.length; i++) {
                    const attr = node.attributes[i];
                    obj[config.attributePrefix + attr.name] = attr.value;
                }
            }
            
            // Process child nodes
            const children = {};
            let textContent = '';
            
            for (let i = 0; i < node.childNodes.length; i++) {
                const child = node.childNodes[i];
                
                if (child.nodeType === 3) { // Text node
                    textContent += child.nodeValue;
                } else if (child.nodeType === 1) { // Element node
                    const childObj = convertNode(child);
                    
                    if (children[child.nodeName]) {
                        if (!Array.isArray(children[child.nodeName])) {
                            children[child.nodeName] = [children[child.nodeName]];
                        }
                        children[child.nodeName].push(childObj);
                    } else {
                        children[child.nodeName] = childObj;
                    }
                }
            }
            
            // Add text content
            if (textContent.trim()) {
                if (Object.keys(children).length === 0 && Object.keys(obj).length === 0) {
                    return textContent.trim();
                } else {
                    obj[config.textNodeName] = textContent.trim();
                }
            }
            
            // Merge children
            Object.assign(obj, children);
            
            return obj;
        };
        
        const root = xmlDoc.documentElement;
        const result = convertNode(root);
        
        if (config.includeRoot) {
            return { [root.nodeName]: result };
        } else {
            return result;
        }
    }
    
    // Convert JSON to XML
    jsonToXML(jsonData, options = {}) {
        const config = {
            rootName: options.rootName || 'root',
            attributePrefix: options.attributePrefix || '@',
            textNodeName: options.textNodeName || '_text',
            declaration: options.declaration !== false,
            indent: options.indent || '  '
        };
        
        const convertValue = (key, value, level = 0) => {
            const indent = config.indent.repeat(level);
            const nextIndent = config.indent.repeat(level + 1);
            
            if (value === null || value === undefined) {
                return `${indent}<${key}/>`;
            }
            
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                return `${indent}<${key}>${this.escapeXML(value.toString())}</${key}>`;
            }
            
            if (Array.isArray(value)) {
                return value.map(item => convertValue(key, item, level)).join('\n');
            }
            
            if (typeof value === 'object') {
                const attributes = [];
                const children = [];
                let textContent = '';
                
                for (const [k, v] of Object.entries(value)) {
                    if (k.startsWith(config.attributePrefix)) {
                        attributes.push(`${k.substring(config.attributePrefix.length)}="${this.escapeXML(v.toString())}"`);
                    } else if (k === config.textNodeName) {
                        textContent = this.escapeXML(v.toString());
                    } else {
                        children.push(convertValue(k, v, level + 1));
                    }
                }
                
                const attrString = attributes.length > 0 ? ' ' + attributes.join(' ') : '';
                
                if (children.length === 0 && !textContent) {
                    return `${indent}<${key}${attrString}/>`;
                } else if (children.length === 0) {
                    return `${indent}<${key}${attrString}>${textContent}</${key}>`;
                } else {
                    const childrenString = children.join('\n');
                    if (textContent) {
                        return `${indent}<${key}${attrString}>\n${nextIndent}${textContent}\n${childrenString}\n${indent}</${key}>`;
                    } else {
                        return `${indent}<${key}${attrString}>\n${childrenString}\n${indent}</${key}>`;
                    }
                }
            }
            
            return '';
        };
        
        let xml = '';
        
        if (config.declaration) {
            xml += '<?xml version="1.0" encoding="UTF-8"?>\n';
        }
        
        xml += convertValue(config.rootName, jsonData);
        
        return xml;
    }
    
    // Escape XML special characters
    escapeXML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    
    // Extract metadata
    extractMetadata(doc) {
        const metadata = {
            encoding: doc.xmlEncoding || 'UTF-8',
            version: doc.xmlVersion || '1.0',
            standalone: doc.xmlStandalone,
            doctype: null,
            rootElement: doc.documentElement.nodeName,
            namespaces: this.extractNamespaces(doc),
            statistics: {
                elements: 0,
                attributes: 0,
                textNodes: 0,
                comments: 0,
                cdataSections: 0
            }
        };
        
        // Count nodes
        this.countNodes(doc.documentElement, metadata.statistics);
        
        // Extract doctype if present
        if (doc.doctype) {
            metadata.doctype = {
                name: doc.doctype.name,
                publicId: doc.doctype.publicId,
                systemId: doc.doctype.systemId
            };
        }
        
        return metadata;
    }
    
    // Count nodes recursively
    countNodes(node, stats) {
        if (node.nodeType === 1) { // Element
            stats.elements++;
            
            if (node.attributes) {
                stats.attributes += node.attributes.length;
            }
            
            for (let i = 0; i < node.childNodes.length; i++) {
                this.countNodes(node.childNodes[i], stats);
            }
        } else if (node.nodeType === 3) { // Text
            if (node.nodeValue.trim()) {
                stats.textNodes++;
            }
        } else if (node.nodeType === 8) { // Comment
            stats.comments++;
        } else if (node.nodeType === 4) { // CDATA
            stats.cdataSections++;
        }
    }
    
    // Get attributes of a node
    getAttributes(node) {
        const attributes = {};
        
        if (node.attributes) {
            for (let i = 0; i < node.attributes.length; i++) {
                const attr = node.attributes[i];
                attributes[attr.name] = attr.value;
            }
        }
        
        return attributes;
    }
    
    // Helper methods
    shouldUseStreaming(content) {
        if (typeof content !== 'string') return true;
        return content.length > this.config.streamingThreshold;
    }
    
    async loadFile(filePath) {
        // In production, this would load from file system or network
        return '';
    }
    
    updateMetrics(type, time) {
        this.metrics[type]++;
        const avgKey = `avg${type.charAt(0).toUpperCase() + type.slice(1)}Time`;
        const currentAvg = this.metrics[avgKey];
        const count = this.metrics[type];
        this.metrics[avgKey] = (currentAvg * (count - 1) + time) / count;
    }
    
    handleWarning(warning) {
        console.warn('XML Warning:', warning);
    }
    
    handleError(error) {
        console.error('XML Error:', error);
    }
    
    handleFatalError(error) {
        console.error('XML Fatal Error:', error);
        throw error;
    }
    
    // Get performance metrics
    getMetrics() {
        return {
            ...this.metrics,
            cacheStats: {
                schemas: this.schemaCache.size,
                xslts: this.xsltCache.size
            }
        };
    }
    
    // Clear caches
    clearCaches() {
        this.schemaCache.clear();
        this.xsltCache.clear();
    }
}

module.exports = AdvancedXMLProcessor;