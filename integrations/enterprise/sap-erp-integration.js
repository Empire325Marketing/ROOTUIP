/**
 * ROOTUIP SAP ERP Integration
 * Connects with SAP S/4HANA, SAP ECC, and SAP Business One
 */

const EventEmitter = require('events');
const axios = require('axios');
const soap = require('soap');

class SAPERPIntegration extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            sapSystem: config.sapSystem, // 's4hana', 'ecc', 'business_one'
            baseUrl: config.baseUrl,
            client: config.client,
            username: config.username,
            password: config.password,
            companyDB: config.companyDB, // For Business One
            language: config.language || 'EN',
            timeout: config.timeout || 60000,
            retryAttempts: config.retryAttempts || 3
        };
        
        // SAP-specific configurations
        this.sapConfigs = {
            s4hana: {
                servicePath: '/sap/opu/odata/sap',
                services: {
                    salesOrder: 'API_SALES_ORDER_SRV',
                    purchaseOrder: 'API_PURCHASE_ORDER_PROCESS_SRV',
                    deliveryDocument: 'API_OUTBOUND_DELIVERY_SRV',
                    invoice: 'API_BILLING_DOCUMENT_SRV',
                    material: 'API_MATERIAL_DOCUMENT_SRV',
                    businessPartner: 'API_BUSINESS_PARTNER'
                },
                authType: 'basic'
            },
            ecc: {
                servicePath: '/sap/bc/rest',
                services: {
                    rfc: '/rfc',
                    bapi: '/bapi',
                    idoc: '/idoc'
                },
                authType: 'basic'
            },
            business_one: {
                servicePath: '/b1s/v1',
                services: {
                    login: '/Login',
                    orders: '/Orders',
                    deliveryNotes: '/DeliveryNotes',
                    invoices: '/Invoices',
                    items: '/Items',
                    businessPartners: '/BusinessPartners'
                },
                authType: 'session'
            }
        };
        
        this.currentConfig = this.sapConfigs[this.config.sapSystem];
        this.sessionId = null;
        this.csrfToken = null;
        
        // Data synchronization queues
        this.syncQueues = {
            inbound: [],
            outbound: []
        };
        
        // Field mappings
        this.fieldMappings = new Map();
        this.initializeFieldMappings();
        
        // Transaction cache
        this.transactionCache = new Map();
    }
    
    // Initialize field mappings
    initializeFieldMappings() {
        // Sales Order mappings
        this.fieldMappings.set('sales_order', {
            rootuip_to_sap: {
                'order_number': 'SalesOrder',
                'customer_id': 'SoldToParty',
                'order_date': 'SalesOrderDate',
                'delivery_date': 'RequestedDeliveryDate',
                'total_amount': 'TotalNetAmount',
                'currency': 'TransactionCurrency',
                'items': 'to_Item'
            },
            sap_to_rootuip: {
                'SalesOrder': 'order_number',
                'SoldToParty': 'customer_id',
                'SalesOrderDate': 'order_date',
                'RequestedDeliveryDate': 'delivery_date',
                'TotalNetAmount': 'total_amount',
                'TransactionCurrency': 'currency'
            }
        });
        
        // Purchase Order mappings
        this.fieldMappings.set('purchase_order', {
            rootuip_to_sap: {
                'po_number': 'PurchaseOrder',
                'vendor_id': 'Supplier',
                'po_date': 'PurchaseOrderDate',
                'delivery_date': 'ScheduleLineDeliveryDate',
                'total_amount': 'NetPriceAmount',
                'currency': 'DocumentCurrency'
            },
            sap_to_rootuip: {
                'PurchaseOrder': 'po_number',
                'Supplier': 'vendor_id',
                'PurchaseOrderDate': 'po_date',
                'ScheduleLineDeliveryDate': 'delivery_date',
                'NetPriceAmount': 'total_amount',
                'DocumentCurrency': 'currency'
            }
        });
        
        // Delivery mappings
        this.fieldMappings.set('delivery', {
            rootuip_to_sap: {
                'delivery_number': 'DeliveryDocument',
                'shipment_date': 'ActualGoodsMovementDate',
                'tracking_number': 'TrackingNumber',
                'carrier': 'CarrierName',
                'delivery_status': 'DeliveryDocumentProcessingStatus'
            },
            sap_to_rootuip: {
                'DeliveryDocument': 'delivery_number',
                'ActualGoodsMovementDate': 'shipment_date',
                'TrackingNumber': 'tracking_number',
                'CarrierName': 'carrier',
                'DeliveryDocumentProcessingStatus': 'delivery_status'
            }
        });
    }
    
    // Connect to SAP system
    async connect() {
        try {
            if (this.config.sapSystem === 'business_one') {
                await this.authenticateBusinessOne();
            } else {
                await this.authenticateS4HANA();
            }
            
            this.emit('connected', { system: this.config.sapSystem });
            return { success: true, system: this.config.sapSystem };
        } catch (error) {
            this.emit('error', { type: 'connection', error: error.message });
            throw error;
        }
    }
    
    // Authenticate with SAP Business One
    async authenticateBusinessOne() {
        const loginUrl = `${this.config.baseUrl}${this.currentConfig.servicePath}${this.currentConfig.services.login}`;
        
        const loginData = {
            CompanyDB: this.config.companyDB,
            UserName: this.config.username,
            Password: this.config.password,
            Language: this.config.language
        };
        
        const response = await axios.post(loginUrl, loginData, {
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        this.sessionId = response.data.SessionId;
        
        // Set session cookie for future requests
        this.sessionCookie = response.headers['set-cookie'];
    }
    
    // Authenticate with SAP S/4HANA or ECC
    async authenticateS4HANA() {
        // For OData services, we use basic authentication
        // No explicit login required, but we can test the connection
        const testUrl = `${this.config.baseUrl}${this.currentConfig.servicePath}/${this.currentConfig.services.material}`;
        
        await axios.get(testUrl, {
            auth: {
                username: this.config.username,
                password: this.config.password
            },
            timeout: this.config.timeout,
            headers: {
                'X-CSRF-Token': 'Fetch'
            }
        }).then(response => {
            this.csrfToken = response.headers['x-csrf-token'];
        });
    }
    
    // Sync sales orders from SAP
    async syncSalesOrders(filters = {}) {
        try {
            await this.ensureConnected();
            
            let orders = [];
            
            if (this.config.sapSystem === 'business_one') {
                orders = await this.getSalesOrdersBusinessOne(filters);
            } else {
                orders = await this.getSalesOrdersOData(filters);
            }
            
            // Transform to ROOTUIP format
            const transformedOrders = orders.map(order => 
                this.transformSAPToROOTUIP(order, 'sales_order')
            );
            
            this.emit('sync:sales_orders', {
                count: transformedOrders.length,
                orders: transformedOrders
            });
            
            return transformedOrders;
            
        } catch (error) {
            this.emit('error', { type: 'sales_order_sync', error: error.message });
            throw error;
        }
    }
    
    // Get sales orders from Business One
    async getSalesOrdersBusinessOne(filters) {
        const url = `${this.config.baseUrl}${this.currentConfig.servicePath}${this.currentConfig.services.orders}`;
        
        let queryParams = '';
        if (filters.dateFrom) {
            queryParams += `$filter=DocDate ge '${filters.dateFrom}'`;
        }
        if (filters.dateTo) {
            queryParams += queryParams ? ' and ' : '$filter=';
            queryParams += `DocDate le '${filters.dateTo}'`;
        }
        
        const response = await this.makeRequest('GET', `${url}?${queryParams}`);
        return response.data.value || response.data;
    }
    
    // Get sales orders from S/4HANA OData
    async getSalesOrdersOData(filters) {
        const serviceUrl = `${this.config.baseUrl}${this.currentConfig.servicePath}/${this.currentConfig.services.salesOrder}`;
        const entityUrl = `${serviceUrl}/A_SalesOrder`;
        
        let queryParams = '';
        if (filters.dateFrom || filters.dateTo) {
            queryParams = '$filter=';
            if (filters.dateFrom) {
                queryParams += `SalesOrderDate ge datetime'${filters.dateFrom}T00:00:00'`;
            }
            if (filters.dateTo) {
                if (filters.dateFrom) queryParams += ' and ';
                queryParams += `SalesOrderDate le datetime'${filters.dateTo}T23:59:59'`;
            }
        }
        
        const response = await this.makeRequest('GET', `${entityUrl}?${queryParams}`);
        return response.data.d?.results || response.data.value || [];
    }
    
    // Create purchase order in SAP
    async createPurchaseOrder(orderData) {
        try {
            await this.ensureConnected();
            
            // Transform ROOTUIP data to SAP format
            const sapOrderData = this.transformROOTUIPageToSAP(orderData, 'purchase_order');
            
            let result;
            if (this.config.sapSystem === 'business_one') {
                result = await this.createPurchaseOrderBusinessOne(sapOrderData);
            } else {
                result = await this.createPurchaseOrderOData(sapOrderData);
            }
            
            this.emit('purchase_order:created', {
                rootuip_id: orderData.id,
                sap_number: result.po_number,
                total_amount: result.total_amount
            });
            
            return result;
            
        } catch (error) {
            this.emit('error', { type: 'purchase_order_creation', error: error.message });
            throw error;
        }
    }
    
    // Create purchase order in Business One
    async createPurchaseOrderBusinessOne(orderData) {
        const url = `${this.config.baseUrl}${this.currentConfig.servicePath}/PurchaseOrders`;
        
        const response = await this.makeRequest('POST', url, orderData);
        
        return {
            po_number: response.data.DocNum,
            sap_id: response.data.DocEntry,
            total_amount: response.data.DocTotal,
            currency: response.data.DocCurrency,
            status: 'created'
        };
    }
    
    // Create purchase order via OData
    async createPurchaseOrderOData(orderData) {
        const serviceUrl = `${this.config.baseUrl}${this.currentConfig.servicePath}/${this.currentConfig.services.purchaseOrder}`;
        const entityUrl = `${serviceUrl}/A_PurchaseOrder`;
        
        const response = await this.makeRequest('POST', entityUrl, orderData);
        
        return {
            po_number: response.data.PurchaseOrder,
            total_amount: response.data.NetPriceAmount,
            currency: response.data.DocumentCurrency,
            status: 'created'
        };
    }
    
    // Update delivery status in SAP
    async updateDeliveryStatus(deliveryData) {
        try {
            await this.ensureConnected();
            
            let result;
            if (this.config.sapSystem === 'business_one') {
                result = await this.updateDeliveryBusinessOne(deliveryData);
            } else {
                result = await this.updateDeliveryOData(deliveryData);
            }
            
            this.emit('delivery:updated', {
                delivery_number: deliveryData.delivery_number,
                status: deliveryData.status,
                tracking_number: deliveryData.tracking_number
            });
            
            return result;
            
        } catch (error) {
            this.emit('error', { type: 'delivery_update', error: error.message });
            throw error;
        }
    }
    
    // Update delivery in Business One
    async updateDeliveryBusinessOne(deliveryData) {
        const url = `${this.config.baseUrl}${this.currentConfig.servicePath}/DeliveryNotes(${deliveryData.sap_id})`;
        
        const updateData = {
            TrackingNumber: deliveryData.tracking_number,
            Comments: `Updated from ROOTUIP: ${deliveryData.status}`
        };
        
        await this.makeRequest('PATCH', url, updateData);
        
        return { success: true };
    }
    
    // Update delivery via OData
    async updateDeliveryOData(deliveryData) {
        const serviceUrl = `${this.config.baseUrl}${this.currentConfig.servicePath}/${this.currentConfig.services.deliveryDocument}`;
        const entityUrl = `${serviceUrl}/A_OutbDeliveryHeader('${deliveryData.delivery_number}')`;
        
        const updateData = {
            TrackingNumber: deliveryData.tracking_number,
            DeliveryDocumentProcessingStatus: deliveryData.status
        };
        
        await this.makeRequest('PATCH', entityUrl, updateData);
        
        return { success: true };
    }
    
    // Get material master data
    async getMaterialData(materialNumbers = []) {
        try {
            await this.ensureConnected();
            
            let materials = [];
            
            if (this.config.sapSystem === 'business_one') {
                materials = await this.getMaterialsBusinessOne(materialNumbers);
            } else {
                materials = await this.getMaterialsOData(materialNumbers);
            }
            
            return materials.map(material => ({
                material_number: material.ItemCode || material.Material,
                description: material.ItemName || material.MaterialDescription,
                unit_of_measure: material.InventoryUOM || material.BaseUnit,
                weight: material.ItemWeight || material.GrossWeight,
                volume: material.ItemVolume || material.Volume,
                price: material.ItemPrice || material.StandardPrice,
                currency: material.Currency || 'USD',
                status: material.Status || 'Active'
            }));
            
        } catch (error) {
            this.emit('error', { type: 'material_data', error: error.message });
            throw error;
        }
    }
    
    // Get materials from Business One
    async getMaterialsBusinessOne(materialNumbers) {
        const url = `${this.config.baseUrl}${this.currentConfig.servicePath}${this.currentConfig.services.items}`;
        
        let filter = '';
        if (materialNumbers.length > 0) {
            const itemFilter = materialNumbers.map(num => `ItemCode eq '${num}'`).join(' or ');
            filter = `?$filter=${itemFilter}`;
        }
        
        const response = await this.makeRequest('GET', `${url}${filter}`);
        return response.data.value || response.data;
    }
    
    // Get materials from S/4HANA
    async getMaterialsOData(materialNumbers) {
        const serviceUrl = `${this.config.baseUrl}${this.currentConfig.servicePath}/${this.currentConfig.services.material}`;
        const entityUrl = `${serviceUrl}/A_Material`;
        
        let filter = '';
        if (materialNumbers.length > 0) {
            const materialFilter = materialNumbers.map(num => `Material eq '${num}'`).join(' or ');
            filter = `?$filter=${materialFilter}`;
        }
        
        const response = await this.makeRequest('GET', `${entityUrl}${filter}`);
        return response.data.d?.results || response.data.value || [];
    }
    
    // Sync business partners (customers/vendors)
    async syncBusinessPartners(type = 'all') {
        try {
            await this.ensureConnected();
            
            let partners = [];
            
            if (this.config.sapSystem === 'business_one') {
                partners = await this.getBusinessPartnersBusinessOne(type);
            } else {
                partners = await this.getBusinessPartnersOData(type);
            }
            
            const transformedPartners = partners.map(partner => ({
                partner_id: partner.CardCode || partner.BusinessPartner,
                name: partner.CardName || partner.BusinessPartnerName,
                type: partner.CardType || (partner.Customer ? 'customer' : 'vendor'),
                address: this.extractAddress(partner),
                contact_info: this.extractContactInfo(partner),
                payment_terms: partner.PayTermsGrpCode || partner.PaymentTerms,
                currency: partner.Currency || 'USD',
                credit_limit: partner.CreditLimit || 0,
                status: partner.Status || 'Active'
            }));
            
            this.emit('sync:business_partners', {
                count: transformedPartners.length,
                type,
                partners: transformedPartners
            });
            
            return transformedPartners;
            
        } catch (error) {
            this.emit('error', { type: 'business_partner_sync', error: error.message });
            throw error;
        }
    }
    
    // Execute RFC function (for ECC systems)
    async executeRFC(functionName, parameters = {}) {
        try {
            if (this.config.sapSystem !== 'ecc') {
                throw new Error('RFC execution only supported for SAP ECC systems');
            }
            
            const rfcUrl = `${this.config.baseUrl}${this.currentConfig.servicePath}${this.currentConfig.services.rfc}`;
            
            const rfcRequest = {
                function_name: functionName,
                import_parameters: parameters.import || {},
                table_parameters: parameters.tables || {}
            };
            
            const response = await this.makeRequest('POST', rfcUrl, rfcRequest);
            
            return {
                success: true,
                export_parameters: response.data.export_parameters,
                table_data: response.data.table_data,
                return_messages: response.data.return_messages
            };
            
        } catch (error) {
            this.emit('error', { type: 'rfc_execution', error: error.message });
            throw error;
        }
    }
    
    // Transform ROOTUIP data to SAP format
    transformROOTUIPageToSAP(data, entityType) {
        const mapping = this.fieldMappings.get(entityType);
        if (!mapping) return data;
        
        const transformed = {};
        
        for (const [rootuipField, sapField] of Object.entries(mapping.rootuip_to_sap)) {
            if (data[rootuipField] !== undefined) {
                transformed[sapField] = data[rootuipField];
            }
        }
        
        // Handle special transformations
        if (entityType === 'purchase_order' && data.items) {
            transformed.PurchaseOrderItem = data.items.map((item, index) => ({
                PurchaseOrderItem: String(index + 1).padStart(5, '0'),
                Material: item.material_number,
                OrderQuantity: item.quantity,
                NetPriceAmount: item.unit_price,
                Plant: item.plant || '1000'
            }));
        }
        
        return transformed;
    }
    
    // Transform SAP data to ROOTUIP format
    transformSAPToROOTUIP(data, entityType) {
        const mapping = this.fieldMappings.get(entityType);
        if (!mapping) return data;
        
        const transformed = {};
        
        for (const [sapField, rootuipField] of Object.entries(mapping.sap_to_rootuip)) {
            if (data[sapField] !== undefined) {
                transformed[rootuipField] = data[sapField];
            }
        }
        
        return transformed;
    }
    
    // Extract address from business partner data
    extractAddress(partner) {
        return {
            street: partner.MailAddress || partner.StreetName,
            city: partner.MailCity || partner.CityName,
            postal_code: partner.MailZipCode || partner.PostalCode,
            country: partner.MailCountry || partner.Country,
            region: partner.MailState || partner.Region
        };
    }
    
    // Extract contact info from business partner data
    extractContactInfo(partner) {
        return {
            phone: partner.Phone1 || partner.PhoneNumber1,
            fax: partner.Fax || partner.FaxNumber,
            email: partner.EmailAddress || partner.EMailAddress,
            contact_person: partner.ContactPerson || partner.ContactPersonName
        };
    }
    
    // Make HTTP request
    async makeRequest(method, url, data = null, options = {}) {
        const config = {
            method,
            url,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'ROOTUIP-SAP-Integration/1.0',
                ...options.headers
            }
        };
        
        // Add authentication
        if (this.config.sapSystem === 'business_one' && this.sessionCookie) {
            config.headers.Cookie = this.sessionCookie.join('; ');
        } else if (this.csrfToken) {
            config.headers['X-CSRF-Token'] = this.csrfToken;
            config.auth = {
                username: this.config.username,
                password: this.config.password
            };
        } else {
            config.auth = {
                username: this.config.username,
                password: this.config.password
            };
        }
        
        if (data) {
            if (method === 'GET') {
                config.params = data;
            } else {
                config.data = data;
            }
        }
        
        return await axios(config);
    }
    
    // Ensure connection is valid
    async ensureConnected() {
        if (this.config.sapSystem === 'business_one' && !this.sessionId) {
            await this.authenticateBusinessOne();
        } else if (!this.csrfToken && this.config.sapSystem !== 'business_one') {
            await this.authenticateS4HANA();
        }
    }
    
    // Health check
    async healthCheck() {
        try {
            await this.ensureConnected();
            
            // Test with a simple query
            if (this.config.sapSystem === 'business_one') {
                const url = `${this.config.baseUrl}${this.currentConfig.servicePath}/CompanyService`;
                await this.makeRequest('GET', url);
            } else {
                const url = `${this.config.baseUrl}${this.currentConfig.servicePath}/${this.currentConfig.services.material}`;
                await this.makeRequest('GET', url);
            }
            
            return { healthy: true, system: this.config.sapSystem };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }
    
    // Execute operation
    async execute(operation, data, options = {}) {
        switch (operation) {
            case 'sync_sales_orders':
                return await this.syncSalesOrders(data);
            case 'create_purchase_order':
                return await this.createPurchaseOrder(data);
            case 'update_delivery_status':
                return await this.updateDeliveryStatus(data);
            case 'get_material_data':
                return await this.getMaterialData(data.material_numbers);
            case 'sync_business_partners':
                return await this.syncBusinessPartners(data.type);
            case 'execute_rfc':
                return await this.executeRFC(data.function_name, data.parameters);
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
    
    // Disconnect
    async disconnect() {
        if (this.config.sapSystem === 'business_one' && this.sessionId) {
            try {
                const logoutUrl = `${this.config.baseUrl}${this.currentConfig.servicePath}/Logout`;
                await this.makeRequest('POST', logoutUrl);
            } catch (error) {
                console.warn('Error during SAP logout:', error.message);
            }
        }
        
        this.sessionId = null;
        this.csrfToken = null;
        this.sessionCookie = null;
        this.transactionCache.clear();
        this.emit('disconnected');
    }
}

module.exports = SAPERPIntegration;