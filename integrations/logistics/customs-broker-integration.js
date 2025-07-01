/**
 * ROOTUIP Customs Broker Integration
 * Connects with major customs brokerage systems
 */

const EventEmitter = require('events');
const axios = require('axios');
const crypto = require('crypto');

class CustomsBrokerIntegration extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            provider: config.provider, // 'chrobinson', 'expeditors', 'dhl', 'ups_brokerage'
            apiUrl: config.apiUrl,
            apiKey: config.apiKey,
            secretKey: config.secretKey,
            environment: config.environment || 'production',
            timeout: config.timeout || 30000,
            retryAttempts: config.retryAttempts || 3
        };
        
        // Provider-specific configurations
        this.providerConfigs = {
            chrobinson: {
                baseUrl: 'https://api.chrobinson.com/v1',
                authType: 'oauth2',
                endpoints: {
                    shipments: '/shipments',
                    customs: '/customs/declarations',
                    documents: '/documents',
                    tracking: '/tracking'
                }
            },
            expeditors: {
                baseUrl: 'https://api.expeditors.com/v2',
                authType: 'api_key',
                endpoints: {
                    customs: '/customs/entries',
                    documents: '/documents',
                    status: '/status'
                }
            },
            dhl_brokerage: {
                baseUrl: 'https://api.dhl.com/brokerage/v1',
                authType: 'oauth2',
                endpoints: {
                    clearance: '/customs/clearance',
                    duties: '/duties/calculation',
                    documents: '/documents'
                }
            },
            ups_brokerage: {
                baseUrl: 'https://onlinetools.ups.com/json',
                authType: 'oauth2',
                endpoints: {
                    brokerage: '/Brokerage',
                    customs: '/CustomsClearance',
                    tracking: '/Track'
                }
            }
        };
        
        this.currentProvider = this.providerConfigs[this.config.provider];
        this.accessToken = null;
        this.tokenExpiry = null;
        
        // Customs data cache
        this.customsCache = new Map();
        
        // Document templates
        this.documentTemplates = new Map();
        this.initializeDocumentTemplates();
    }
    
    // Initialize document templates
    initializeDocumentTemplates() {
        // Commercial Invoice template
        this.documentTemplates.set('commercial_invoice', {
            required_fields: [
                'exporter_info',
                'importer_info',
                'invoice_number',
                'invoice_date',
                'shipment_details',
                'item_details',
                'total_value',
                'currency',
                'terms_of_sale'
            ],
            format: 'pdf'
        });
        
        // Packing List template
        this.documentTemplates.set('packing_list', {
            required_fields: [
                'shipper_info',
                'consignee_info',
                'package_details',
                'item_descriptions',
                'weights',
                'dimensions'
            ],
            format: 'pdf'
        });
        
        // Certificate of Origin template
        this.documentTemplates.set('certificate_of_origin', {
            required_fields: [
                'exporter_info',
                'importer_info',
                'goods_description',
                'origin_country',
                'tariff_classification',
                'certification_statement'
            ],
            format: 'pdf'
        });
    }
    
    // Connect to customs broker system
    async connect() {
        try {
            await this.authenticate();
            this.emit('connected', { provider: this.config.provider });
            return { success: true, provider: this.config.provider };
        } catch (error) {
            this.emit('error', { type: 'connection', error: error.message });
            throw error;
        }
    }
    
    // Authenticate with provider
    async authenticate() {
        const provider = this.currentProvider;
        
        if (provider.authType === 'oauth2') {
            const authResponse = await axios.post(`${provider.baseUrl}/oauth/token`, {
                grant_type: 'client_credentials',
                client_id: this.config.apiKey,
                client_secret: this.config.secretKey
            });
            
            this.accessToken = authResponse.data.access_token;
            this.tokenExpiry = Date.now() + (authResponse.data.expires_in * 1000);
            
        } else if (provider.authType === 'api_key') {
            this.accessToken = this.config.apiKey;
        }
    }
    
    // Submit customs declaration
    async submitCustomsDeclaration(declarationData) {
        try {
            await this.ensureAuthenticated();
            
            const provider = this.currentProvider;
            const endpoint = `${provider.baseUrl}${provider.endpoints.customs}`;
            
            // Transform data based on provider format
            const transformedData = await this.transformCustomsData(declarationData);
            
            const response = await this.makeRequest('POST', endpoint, transformedData);
            
            // Cache the declaration
            this.customsCache.set(response.data.declaration_id, {
                data: declarationData,
                response: response.data,
                timestamp: new Date(),
                status: 'submitted'
            });
            
            this.emit('customs:submitted', {
                declaration_id: response.data.declaration_id,
                status: response.data.status
            });
            
            return {
                success: true,
                declaration_id: response.data.declaration_id,
                status: response.data.status,
                reference_number: response.data.reference_number,
                estimated_clearance: response.data.estimated_clearance_time
            };
            
        } catch (error) {
            this.emit('error', { type: 'customs_submission', error: error.message });
            throw error;
        }
    }
    
    // Get customs status
    async getCustomsStatus(declarationId) {
        try {
            await this.ensureAuthenticated();
            
            const provider = this.currentProvider;
            const endpoint = `${provider.baseUrl}${provider.endpoints.customs}/${declarationId}/status`;
            
            const response = await this.makeRequest('GET', endpoint);
            
            // Update cache
            if (this.customsCache.has(declarationId)) {
                const cached = this.customsCache.get(declarationId);
                cached.status = response.data.status;
                cached.last_updated = new Date();
            }
            
            this.emit('customs:status_updated', {
                declaration_id: declarationId,
                status: response.data.status,
                details: response.data
            });
            
            return {
                declaration_id: declarationId,
                status: response.data.status,
                clearance_date: response.data.clearance_date,
                duties_paid: response.data.duties_paid,
                total_duties: response.data.total_duties,
                holds: response.data.holds || [],
                next_action: response.data.next_action
            };
            
        } catch (error) {
            this.emit('error', { type: 'status_check', error: error.message });
            throw error;
        }
    }
    
    // Calculate duties and taxes
    async calculateDuties(shipmentData) {
        try {
            await this.ensureAuthenticated();
            
            const provider = this.currentProvider;
            const endpoint = `${provider.baseUrl}${provider.endpoints.duties || '/duties/calculate'}`;
            
            const calculationData = {
                origin_country: shipmentData.origin_country,
                destination_country: shipmentData.destination_country,
                items: shipmentData.items.map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    unit_value: item.unit_value,
                    currency: item.currency,
                    weight: item.weight,
                    hs_code: item.hs_code,
                    country_of_origin: item.country_of_origin
                })),
                shipment_value: shipmentData.total_value,
                currency: shipmentData.currency,
                incoterm: shipmentData.incoterm
            };
            
            const response = await this.makeRequest('POST', endpoint, calculationData);
            
            return {
                total_duties: response.data.total_duties,
                total_taxes: response.data.total_taxes,
                total_fees: response.data.total_fees,
                grand_total: response.data.grand_total,
                currency: response.data.currency,
                breakdown: response.data.breakdown || [],
                effective_rate: response.data.effective_rate
            };
            
        } catch (error) {
            this.emit('error', { type: 'duty_calculation', error: error.message });
            throw error;
        }
    }
    
    // Submit required documents
    async submitDocuments(declarationId, documents) {
        try {
            await this.ensureAuthenticated();
            
            const provider = this.currentProvider;
            const endpoint = `${provider.baseUrl}${provider.endpoints.documents}`;
            
            const uploadedDocuments = [];
            
            for (const document of documents) {
                // Validate document
                const validation = this.validateDocument(document);
                if (!validation.valid) {
                    throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
                }
                
                // Upload document
                const formData = new FormData();
                formData.append('declaration_id', declarationId);
                formData.append('document_type', document.type);
                formData.append('file', document.file);
                formData.append('metadata', JSON.stringify(document.metadata || {}));
                
                const response = await this.makeRequest('POST', endpoint, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                
                uploadedDocuments.push({
                    document_id: response.data.document_id,
                    type: document.type,
                    status: response.data.status,
                    filename: document.filename
                });
            }
            
            this.emit('documents:submitted', {
                declaration_id: declarationId,
                documents: uploadedDocuments
            });
            
            return {
                success: true,
                declaration_id: declarationId,
                uploaded_documents: uploadedDocuments
            };
            
        } catch (error) {
            this.emit('error', { type: 'document_submission', error: error.message });
            throw error;
        }
    }
    
    // Get required documents list
    async getRequiredDocuments(shipmentData) {
        const documents = [];
        
        // Always required
        documents.push('commercial_invoice');
        documents.push('packing_list');
        
        // Based on shipment characteristics
        if (shipmentData.total_value > 2500) {
            documents.push('certificate_of_origin');
        }
        
        if (shipmentData.regulated_goods) {
            documents.push('import_license');
            documents.push('safety_certificate');
        }
        
        if (shipmentData.food_products) {
            documents.push('fda_prior_notice');
            documents.push('health_certificate');
        }
        
        if (shipmentData.textile_products) {
            documents.push('textile_declaration');
        }
        
        if (shipmentData.wood_products) {
            documents.push('phytosanitary_certificate');
        }
        
        return {
            required_documents: documents,
            optional_documents: ['insurance_certificate', 'inspection_certificate'],
            deadline: this.calculateDocumentDeadline(shipmentData.estimated_arrival)
        };
    }
    
    // Track shipment through customs
    async trackCustomsProgress(declarationId) {
        try {
            const status = await this.getCustomsStatus(declarationId);
            
            const progressStages = [
                { stage: 'submitted', completed: true, timestamp: status.submission_date },
                { stage: 'documents_review', completed: status.documents_approved, timestamp: status.documents_review_date },
                { stage: 'examination', completed: status.examination_complete, timestamp: status.examination_date },
                { stage: 'duty_payment', completed: status.duties_paid, timestamp: status.payment_date },
                { stage: 'release', completed: status.status === 'released', timestamp: status.release_date }
            ];
            
            const currentStage = progressStages.find(stage => !stage.completed);
            const completedStages = progressStages.filter(stage => stage.completed).length;
            const progressPercentage = (completedStages / progressStages.length) * 100;
            
            return {
                declaration_id: declarationId,
                current_stage: currentStage ? currentStage.stage : 'completed',
                progress_percentage: progressPercentage,
                stages: progressStages,
                estimated_completion: status.estimated_clearance,
                holds: status.holds,
                next_action: status.next_action
            };
            
        } catch (error) {
            this.emit('error', { type: 'tracking', error: error.message });
            throw error;
        }
    }
    
    // Transform customs data based on provider format
    async transformCustomsData(data) {
        const provider = this.config.provider;
        
        const baseTransformation = {
            shipment_info: {
                reference_number: data.shipment_reference,
                shipper: data.shipper,
                consignee: data.consignee,
                origin_port: data.origin_port,
                destination_port: data.destination_port,
                mode_of_transport: data.transport_mode
            },
            goods_info: {
                total_packages: data.total_packages,
                total_weight: data.total_weight,
                total_value: data.total_value,
                currency: data.currency,
                incoterm: data.incoterm
            },
            items: data.items.map(item => ({
                line_number: item.line_number,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_value: item.total_value,
                weight: item.weight,
                hs_code: item.hs_code,
                country_of_origin: item.country_of_origin
            }))
        };
        
        // Provider-specific transformations
        switch (provider) {
            case 'chrobinson':
                return {
                    ...baseTransformation,
                    declaration_type: 'formal_entry',
                    entry_summary: true
                };
                
            case 'expeditors':
                return {
                    ...baseTransformation,
                    service_type: 'customs_clearance',
                    priority: data.priority || 'standard'
                };
                
            case 'dhl_brokerage':
                return {
                    ...baseTransformation,
                    clearance_type: 'import',
                    dhl_account: this.config.account_number
                };
                
            case 'ups_brokerage':
                return {
                    ...baseTransformation,
                    brokerage_service: 'UPS_BROKERAGE',
                    shipment_digest: this.generateShipmentDigest(data)
                };
                
            default:
                return baseTransformation;
        }
    }
    
    // Validate document
    validateDocument(document) {
        const template = this.documentTemplates.get(document.type);
        
        if (!template) {
            return {
                valid: false,
                errors: [`Unknown document type: ${document.type}`]
            };
        }
        
        const errors = [];
        
        // Check required fields
        for (const field of template.required_fields) {
            if (!document.metadata || !document.metadata[field]) {
                errors.push(`Missing required field: ${field}`);
            }
        }
        
        // Check file format
        if (template.format && document.format !== template.format) {
            errors.push(`Invalid format. Expected: ${template.format}, Got: ${document.format}`);
        }
        
        // Check file size (max 10MB)
        if (document.file && document.file.size > 10 * 1024 * 1024) {
            errors.push('File size exceeds 10MB limit');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    // Calculate document deadline
    calculateDocumentDeadline(estimatedArrival) {
        const arrivalDate = new Date(estimatedArrival);
        const deadline = new Date(arrivalDate);
        deadline.setDate(deadline.getDate() - 7); // 7 days before arrival
        
        return deadline.toISOString();
    }
    
    // Generate shipment digest
    generateShipmentDigest(data) {
        const digestData = {
            reference: data.shipment_reference,
            value: data.total_value,
            weight: data.total_weight,
            items: data.items.length
        };
        
        return crypto.createHash('sha256')
            .update(JSON.stringify(digestData))
            .digest('hex')
            .substring(0, 16);
    }
    
    // Make HTTP request
    async makeRequest(method, url, data = null, options = {}) {
        const config = {
            method,
            url,
            timeout: this.config.timeout,
            headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'ROOTUIP-Integration/1.0',
                ...options.headers
            }
        };
        
        if (data) {
            if (method === 'GET') {
                config.params = data;
            } else {
                config.data = data;
            }
        }
        
        return await axios(config);
    }
    
    // Ensure authentication is valid
    async ensureAuthenticated() {
        if (!this.accessToken || (this.tokenExpiry && Date.now() >= this.tokenExpiry)) {
            await this.authenticate();
        }
    }
    
    // Health check
    async healthCheck() {
        try {
            await this.ensureAuthenticated();
            
            const provider = this.currentProvider;
            const endpoint = `${provider.baseUrl}/health`;
            
            await this.makeRequest('GET', endpoint);
            
            return { healthy: true, provider: this.config.provider };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }
    
    // Execute operation
    async execute(operation, data, options = {}) {
        switch (operation) {
            case 'submit_declaration':
                return await this.submitCustomsDeclaration(data);
            case 'get_status':
                return await this.getCustomsStatus(data.declaration_id);
            case 'calculate_duties':
                return await this.calculateDuties(data);
            case 'submit_documents':
                return await this.submitDocuments(data.declaration_id, data.documents);
            case 'get_required_documents':
                return await this.getRequiredDocuments(data);
            case 'track_progress':
                return await this.trackCustomsProgress(data.declaration_id);
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
    
    // Disconnect
    async disconnect() {
        this.accessToken = null;
        this.tokenExpiry = null;
        this.customsCache.clear();
        this.emit('disconnected');
    }
}

module.exports = CustomsBrokerIntegration;