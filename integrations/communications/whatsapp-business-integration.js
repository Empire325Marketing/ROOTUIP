/**
 * ROOTUIP WhatsApp Business API Integration
 * Advanced messaging capabilities for logistics communication
 */

const EventEmitter = require('events');
const axios = require('axios');

class WhatsAppBusinessIntegration extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            phoneNumberId: config.phoneNumberId,
            accessToken: config.accessToken,
            webhookVerifyToken: config.webhookVerifyToken,
            businessAccountId: config.businessAccountId,
            apiVersion: config.apiVersion || 'v18.0',
            baseUrl: config.baseUrl || 'https://graph.facebook.com',
            timeout: config.timeout || 30000
        };
        
        // Message templates for logistics
        this.messageTemplates = new Map();
        this.initializeTemplates();
        
        // Message queue for bulk sending
        this.messageQueue = [];
        this.processingQueue = false;
        
        // Contact management
        this.contacts = new Map();
        
        // Conversation tracking
        this.conversations = new Map();
        
        // Message status tracking
        this.messageStatus = new Map();
        
        // Rate limiting
        this.rateLimiter = {
            requests: [],
            limit: 1000, // Per hour
            window: 3600000
        };
    }
    
    // Initialize message templates
    initializeTemplates() {
        // Shipment notification templates
        this.messageTemplates.set('shipment_pickup', {
            name: 'shipment_pickup_notification',
            category: 'UTILITY',
            language: 'en_US',
            components: [
                {
                    type: 'HEADER',
                    format: 'TEXT',
                    text: '📦 Shipment Pickup Scheduled'
                },
                {
                    type: 'BODY',
                    text: 'Hello {{1}},\n\nYour shipment {{2}} has been scheduled for pickup on {{3}} between {{4}}.\n\nPickup Address: {{5}}\nSpecial Instructions: {{6}}\n\nPlease ensure the cargo is ready and properly packaged.'
                },
                {
                    type: 'FOOTER',
                    text: 'ROOTUIP Logistics Platform'
                },
                {
                    type: 'BUTTONS',
                    buttons: [
                        {
                            type: 'QUICK_REPLY',
                            text: 'Confirm Ready'
                        },
                        {
                            type: 'QUICK_REPLY',
                            text: 'Reschedule'
                        }
                    ]
                }
            ]
        });
        
        this.messageTemplates.set('shipment_in_transit', {
            name: 'shipment_in_transit',
            category: 'UTILITY',
            language: 'en_US',
            components: [
                {
                    type: 'HEADER',
                    format: 'TEXT',
                    text: '🚛 Shipment In Transit'
                },
                {
                    type: 'BODY',
                    text: 'Your shipment {{1}} is now in transit!\n\n📍 Current Location: {{2}}\n📅 Expected Delivery: {{3}}\n🔗 Tracking: {{4}}\n\nWe\'ll keep you updated on the progress.'
                },
                {
                    type: 'BUTTONS',
                    buttons: [
                        {
                            type: 'URL',
                            text: 'Track Shipment',
                            url: 'https://rootuip.com/track/{{1}}'
                        }
                    ]
                }
            ]
        });
        
        this.messageTemplates.set('delivery_notification', {
            name: 'delivery_notification',
            category: 'UTILITY',
            language: 'en_US',
            components: [
                {
                    type: 'HEADER',
                    format: 'TEXT',
                    text: '✅ Delivery Completed'
                },
                {
                    type: 'BODY',
                    text: 'Great news {{1}}! Your shipment {{2}} has been successfully delivered.\n\n📅 Delivered: {{3}}\n📍 Location: {{4}}\n👤 Received by: {{5}}\n\nThank you for choosing ROOTUIP!'
                },
                {
                    type: 'BUTTONS',
                    buttons: [
                        {
                            type: 'QUICK_REPLY',
                            text: 'Rate Service'
                        },
                        {
                            type: 'URL',
                            text: 'Download POD',
                            url: 'https://rootuip.com/pod/{{2}}'
                        }
                    ]
                }
            ]
        });
        
        this.messageTemplates.set('customs_alert', {
            name: 'customs_alert',
            category: 'UTILITY',
            language: 'en_US',
            components: [
                {
                    type: 'HEADER',
                    format: 'TEXT',
                    text: '⚠️ Customs Action Required'
                },
                {
                    type: 'BODY',
                    text: 'Hello {{1}},\n\nYour shipment {{2}} requires customs clearance action:\n\n📋 Issue: {{3}}\n📄 Documents Needed: {{4}}\n⏰ Deadline: {{5}}\n\nPlease respond promptly to avoid delays.'
                },
                {
                    type: 'BUTTONS',
                    buttons: [
                        {
                            type: 'URL',
                            text: 'Upload Documents',
                            url: 'https://rootuip.com/customs/{{2}}'
                        },
                        {
                            type: 'PHONE_NUMBER',
                            text: 'Call Support',
                            phone_number: '+1234567890'
                        }
                    ]
                }
            ]
        });
        
        this.messageTemplates.set('quote_response', {
            name: 'shipping_quote',
            category: 'UTILITY',
            language: 'en_US',
            components: [
                {
                    type: 'HEADER',
                    format: 'TEXT',
                    text: '💰 Shipping Quote Ready'
                },
                {
                    type: 'BODY',
                    text: 'Hi {{1}},\n\nYour shipping quote is ready:\n\n📦 Route: {{2}} → {{3}}\n💵 Price: {{4}} {{5}}\n⏱️ Transit Time: {{6}} days\n📅 Valid Until: {{7}}\n\nReady to book?'
                },
                {
                    type: 'BUTTONS',
                    buttons: [
                        {
                            type: 'QUICK_REPLY',
                            text: 'Book Now'
                        },
                        {
                            type: 'QUICK_REPLY',
                            text: 'Get Details'
                        }
                    ]
                }
            ]
        });
        
        // Emergency and alert templates
        this.messageTemplates.set('delay_alert', {
            name: 'shipment_delay',
            category: 'UTILITY',
            language: 'en_US',
            components: [
                {
                    type: 'HEADER',
                    format: 'TEXT',
                    text: '⏰ Shipment Delay Notice'
                },
                {
                    type: 'BODY',
                    text: 'Hello {{1}},\n\nWe regret to inform you that shipment {{2}} has been delayed.\n\n📅 Original ETA: {{3}}\n📅 New ETA: {{4}}\n🔍 Reason: {{5}}\n\nWe apologize for the inconvenience and are working to minimize further delays.'
                },
                {
                    type: 'BUTTONS',
                    buttons: [
                        {
                            type: 'PHONE_NUMBER',
                            text: 'Call Support',
                            phone_number: '+1234567890'
                        }
                    ]
                }
            ]
        });
    }
    
    // Connect to WhatsApp Business API
    async connect() {
        try {
            // Verify access token and phone number
            await this.verifyCredentials();
            
            // Load existing templates
            await this.loadApprovedTemplates();
            
            this.emit('connected', { phone_number_id: this.config.phoneNumberId });
            return { success: true };
        } catch (error) {
            this.emit('error', { type: 'connection', error: error.message });
            throw error;
        }
    }
    
    // Verify credentials
    async verifyCredentials() {
        const url = `${this.config.baseUrl}/${this.config.apiVersion}/${this.config.phoneNumberId}`;
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`
            }
        });
        
        return response.data;
    }
    
    // Load approved templates
    async loadApprovedTemplates() {
        const url = `${this.config.baseUrl}/${this.config.apiVersion}/${this.config.businessAccountId}/message_templates`;
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`
            }
        });
        
        // Update local templates with approved status
        for (const template of response.data.data) {
            if (this.messageTemplates.has(template.name)) {
                const localTemplate = this.messageTemplates.get(template.name);
                localTemplate.id = template.id;
                localTemplate.status = template.status;
            }
        }
    }
    
    // Send template message
    async sendTemplateMessage(to, templateName, parameters = [], language = 'en_US') {
        try {
            if (!this.checkRateLimit()) {
                throw new Error('Rate limit exceeded');
            }
            
            const template = this.messageTemplates.get(templateName);
            if (!template) {
                throw new Error(`Template ${templateName} not found`);
            }
            
            const messageData = {
                messaging_product: 'whatsapp',
                to: this.formatPhoneNumber(to),
                type: 'template',
                template: {
                    name: template.name,
                    language: {
                        code: language
                    },
                    components: [
                        {
                            type: 'body',
                            parameters: parameters.map(param => ({
                                type: 'text',
                                text: String(param)
                            }))
                        }
                    ]
                }
            };
            
            const response = await this.sendMessage(messageData);
            
            this.emit('template:sent', {
                to,
                template: templateName,
                message_id: response.messages[0].id
            });
            
            return response;
            
        } catch (error) {
            this.emit('error', { type: 'template_send', error: error.message });
            throw error;
        }
    }
    
    // Send shipment pickup notification
    async notifyShipmentPickup(contactInfo, shipmentData) {
        const parameters = [
            contactInfo.name,
            shipmentData.shipment_number,
            shipmentData.pickup_date,
            shipmentData.pickup_time_window,
            shipmentData.pickup_address,
            shipmentData.special_instructions || 'None'
        ];
        
        return await this.sendTemplateMessage(
            contactInfo.phone,
            'shipment_pickup',
            parameters
        );
    }
    
    // Send in-transit notification
    async notifyShipmentInTransit(contactInfo, shipmentData) {
        const parameters = [
            shipmentData.shipment_number,
            shipmentData.current_location,
            shipmentData.expected_delivery,
            shipmentData.tracking_url
        ];
        
        return await this.sendTemplateMessage(
            contactInfo.phone,
            'shipment_in_transit',
            parameters
        );
    }
    
    // Send delivery notification
    async notifyDeliveryComplete(contactInfo, deliveryData) {
        const parameters = [
            contactInfo.name,
            deliveryData.shipment_number,
            deliveryData.delivery_date,
            deliveryData.delivery_location,
            deliveryData.received_by
        ];
        
        return await this.sendTemplateMessage(
            contactInfo.phone,
            'delivery_notification',
            parameters
        );
    }
    
    // Send customs alert
    async sendCustomsAlert(contactInfo, customsData) {
        const parameters = [
            contactInfo.name,
            customsData.shipment_number,
            customsData.issue_description,
            customsData.required_documents,
            customsData.deadline
        ];
        
        return await this.sendTemplateMessage(
            contactInfo.phone,
            'customs_alert',
            parameters
        );
    }
    
    // Send shipping quote
    async sendShippingQuote(contactInfo, quoteData) {
        const parameters = [
            contactInfo.name,
            quoteData.origin,
            quoteData.destination,
            quoteData.price,
            quoteData.currency,
            quoteData.transit_time,
            quoteData.valid_until
        ];
        
        return await this.sendTemplateMessage(
            contactInfo.phone,
            'quote_response',
            parameters
        );
    }
    
    // Send delay alert
    async sendDelayAlert(contactInfo, delayData) {
        const parameters = [
            contactInfo.name,
            delayData.shipment_number,
            delayData.original_eta,
            delayData.new_eta,
            delayData.delay_reason
        ];
        
        return await this.sendTemplateMessage(
            contactInfo.phone,
            'delay_alert',
            parameters
        );
    }
    
    // Send text message
    async sendTextMessage(to, text) {
        try {
            if (!this.checkRateLimit()) {
                throw new Error('Rate limit exceeded');
            }
            
            const messageData = {
                messaging_product: 'whatsapp',
                to: this.formatPhoneNumber(to),
                type: 'text',
                text: {
                    body: text
                }
            };
            
            const response = await this.sendMessage(messageData);
            
            this.emit('text:sent', {
                to,
                message_id: response.messages[0].id,
                text: text.substring(0, 100) + '...'
            });
            
            return response;
            
        } catch (error) {
            this.emit('error', { type: 'text_send', error: error.message });
            throw error;
        }
    }
    
    // Send document
    async sendDocument(to, documentUrl, filename, caption = '') {
        try {
            if (!this.checkRateLimit()) {
                throw new Error('Rate limit exceeded');
            }
            
            const messageData = {
                messaging_product: 'whatsapp',
                to: this.formatPhoneNumber(to),
                type: 'document',
                document: {
                    link: documentUrl,
                    filename: filename,
                    caption: caption
                }
            };
            
            const response = await this.sendMessage(messageData);
            
            this.emit('document:sent', {
                to,
                message_id: response.messages[0].id,
                filename,
                url: documentUrl
            });
            
            return response;
            
        } catch (error) {
            this.emit('error', { type: 'document_send', error: error.message });
            throw error;
        }
    }
    
    // Send location
    async sendLocation(to, latitude, longitude, name = '', address = '') {
        try {
            const messageData = {
                messaging_product: 'whatsapp',
                to: this.formatPhoneNumber(to),
                type: 'location',
                location: {
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    name: name,
                    address: address
                }
            };
            
            const response = await this.sendMessage(messageData);
            
            this.emit('location:sent', {
                to,
                message_id: response.messages[0].id,
                coordinates: `${latitude}, ${longitude}`
            });
            
            return response;
            
        } catch (error) {
            this.emit('error', { type: 'location_send', error: error.message });
            throw error;
        }
    }
    
    // Send message to WhatsApp API
    async sendMessage(messageData) {
        const url = `${this.config.baseUrl}/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;
        
        const response = await axios.post(url, messageData, {
            headers: {
                'Authorization': `Bearer ${this.config.accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: this.config.timeout
        });
        
        // Track message status
        if (response.data.messages && response.data.messages[0]) {
            this.messageStatus.set(response.data.messages[0].id, {
                status: 'sent',
                to: messageData.to,
                timestamp: new Date(),
                type: messageData.type
            });
        }
        
        return response.data;
    }
    
    // Process incoming webhook
    async processWebhook(payload) {
        try {
            if (payload.object !== 'whatsapp_business_account') {
                return;
            }
            
            for (const entry of payload.entry) {
                for (const change of entry.changes) {
                    if (change.field === 'messages') {
                        await this.processMessageChange(change.value);
                    }
                }
            }
            
        } catch (error) {
            this.emit('error', { type: 'webhook_processing', error: error.message });
        }
    }
    
    // Process message changes
    async processMessageChange(value) {
        // Process incoming messages
        if (value.messages) {
            for (const message of value.messages) {
                await this.processIncomingMessage(message, value.contacts?.[0]);
            }
        }
        
        // Process message status updates
        if (value.statuses) {
            for (const status of value.statuses) {
                this.processMessageStatus(status);
            }
        }
    }
    
    // Process incoming message
    async processIncomingMessage(message, contact) {
        const phoneNumber = message.from;
        const messageId = message.id;
        
        // Update contact info
        if (contact) {
            this.contacts.set(phoneNumber, {
                name: contact.profile?.name || 'Unknown',
                phone: phoneNumber,
                last_seen: new Date()
            });
        }
        
        // Track conversation
        if (!this.conversations.has(phoneNumber)) {
            this.conversations.set(phoneNumber, {
                messages: [],
                started: new Date(),
                status: 'active'
            });
        }
        
        const conversation = this.conversations.get(phoneNumber);
        conversation.messages.push({
            id: messageId,
            timestamp: new Date(message.timestamp * 1000),
            type: message.type,
            content: this.extractMessageContent(message),
            direction: 'inbound'
        });
        
        // Emit event for message processing
        this.emit('message:received', {
            from: phoneNumber,
            message_id: messageId,
            type: message.type,
            content: this.extractMessageContent(message),
            contact: this.contacts.get(phoneNumber)
        });
        
        // Auto-respond to common queries
        await this.handleAutoResponse(phoneNumber, message);
    }
    
    // Handle auto-responses
    async handleAutoResponse(phoneNumber, message) {
        const content = this.extractMessageContent(message);
        const text = content.text?.toLowerCase() || '';
        
        // Track shipment queries
        if (text.includes('track') || text.includes('status') || text.includes('where')) {
            // Extract potential tracking number
            const trackingMatch = text.match(/[A-Z0-9]{8,15}/);
            if (trackingMatch) {
                const trackingNumber = trackingMatch[0];
                await this.sendTextMessage(
                    phoneNumber,
                    `I'm looking up tracking information for ${trackingNumber}. Please wait a moment...`
                );
                
                // Emit event for tracking lookup
                this.emit('tracking:request', {
                    phone: phoneNumber,
                    tracking_number: trackingNumber
                });
            } else {
                await this.sendTextMessage(
                    phoneNumber,
                    'Please provide your tracking number and I\'ll check the status for you.'
                );
            }
        }
        
        // Quote requests
        else if (text.includes('quote') || text.includes('price') || text.includes('cost')) {
            await this.sendTextMessage(
                phoneNumber,
                'I can help you get a shipping quote! Please provide:\n• Origin location\n• Destination\n• Cargo details (weight, dimensions)\n• Preferred shipping date'
            );
        }
        
        // Support requests
        else if (text.includes('help') || text.includes('support') || text.includes('problem')) {
            await this.sendTextMessage(
                phoneNumber,
                'I\'m here to help! For immediate assistance, you can:\n• Call our support line: +1-234-567-8900\n• Email: support@rootuip.com\n• Or describe your issue and I\'ll connect you with the right team.'
            );
        }
        
        // Quick replies
        else if (message.type === 'button') {
            await this.handleButtonResponse(phoneNumber, message);
        }
    }
    
    // Handle button responses
    async handleButtonResponse(phoneNumber, message) {
        const buttonText = message.button?.text;
        
        switch (buttonText) {
            case 'Confirm Ready':
                await this.sendTextMessage(
                    phoneNumber,
                    'Thank you for confirming! Your pickup has been confirmed and the driver will arrive as scheduled.'
                );
                this.emit('pickup:confirmed', { phone: phoneNumber });
                break;
                
            case 'Reschedule':
                await this.sendTextMessage(
                    phoneNumber,
                    'I understand you need to reschedule. Please let me know your preferred date and time, and I\'ll arrange it for you.'
                );
                this.emit('pickup:reschedule_request', { phone: phoneNumber });
                break;
                
            case 'Rate Service':
                await this.sendTextMessage(
                    phoneNumber,
                    'Thank you for choosing ROOTUIP! Please rate your experience on a scale of 1-5, and let us know if you have any feedback.'
                );
                break;
                
            case 'Book Now':
                this.emit('quote:book_request', { phone: phoneNumber });
                break;
                
            case 'Get Details':
                this.emit('quote:details_request', { phone: phoneNumber });
                break;
        }
    }
    
    // Process message status updates
    processMessageStatus(status) {
        const messageId = status.id;
        const newStatus = status.status;
        
        if (this.messageStatus.has(messageId)) {
            const messageInfo = this.messageStatus.get(messageId);
            messageInfo.status = newStatus;
            messageInfo.updated = new Date();
            
            if (status.timestamp) {
                messageInfo.status_timestamp = new Date(status.timestamp * 1000);
            }
            
            this.emit('message:status_update', {
                message_id: messageId,
                status: newStatus,
                to: messageInfo.to,
                type: messageInfo.type
            });
        }
    }
    
    // Extract message content
    extractMessageContent(message) {
        switch (message.type) {
            case 'text':
                return { text: message.text?.body };
            case 'image':
                return { 
                    image_id: message.image?.id,
                    caption: message.image?.caption 
                };
            case 'document':
                return { 
                    document_id: message.document?.id,
                    filename: message.document?.filename,
                    caption: message.document?.caption 
                };
            case 'location':
                return { 
                    latitude: message.location?.latitude,
                    longitude: message.location?.longitude,
                    name: message.location?.name,
                    address: message.location?.address
                };
            case 'button':
                return { 
                    button_text: message.button?.text,
                    button_payload: message.button?.payload 
                };
            default:
                return { type: message.type };
        }
    }
    
    // Format phone number
    formatPhoneNumber(phoneNumber) {
        // Remove any non-digit characters
        const cleaned = phoneNumber.replace(/\D/g, '');
        
        // Ensure it starts with country code
        if (!cleaned.startsWith('1') && cleaned.length === 10) {
            return '1' + cleaned; // Add US country code
        }
        
        return cleaned;
    }
    
    // Check rate limit
    checkRateLimit() {
        const now = Date.now();
        const windowStart = now - this.rateLimiter.window;
        
        // Remove old requests
        this.rateLimiter.requests = this.rateLimiter.requests.filter(
            time => time > windowStart
        );
        
        // Check if under limit
        if (this.rateLimiter.requests.length >= this.rateLimiter.limit) {
            return false;
        }
        
        // Add current request
        this.rateLimiter.requests.push(now);
        return true;
    }
    
    // Bulk send messages
    async sendBulkMessages(messages) {
        this.messageQueue.push(...messages);
        this.processBulkQueue();
    }
    
    // Process bulk message queue
    async processBulkQueue() {
        if (this.processingQueue || this.messageQueue.length === 0) {
            return;
        }
        
        this.processingQueue = true;
        
        try {
            while (this.messageQueue.length > 0 && this.checkRateLimit()) {
                const messageData = this.messageQueue.shift();
                
                try {
                    await this.sendMessage(messageData);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
                } catch (error) {
                    console.error('Bulk message send error:', error.message);
                    // Re-queue failed message
                    messageData.retry_count = (messageData.retry_count || 0) + 1;
                    if (messageData.retry_count < 3) {
                        this.messageQueue.push(messageData);
                    }
                }
            }
        } finally {
            this.processingQueue = false;
            
            // Continue processing if queue not empty
            if (this.messageQueue.length > 0) {
                setTimeout(() => this.processBulkQueue(), 5000);
            }
        }
    }
    
    // Get conversation history
    getConversationHistory(phoneNumber, limit = 50) {
        const conversation = this.conversations.get(phoneNumber);
        if (!conversation) {
            return { messages: [], total: 0 };
        }
        
        const messages = conversation.messages
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
        
        return {
            messages,
            total: conversation.messages.length,
            started: conversation.started,
            status: conversation.status
        };
    }
    
    // Health check
    async healthCheck() {
        try {
            await this.verifyCredentials();
            return { healthy: true };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }
    
    // Execute operation
    async execute(operation, data, options = {}) {
        switch (operation) {
            case 'send_pickup_notification':
                return await this.notifyShipmentPickup(data.contact, data.shipment);
            case 'send_transit_notification':
                return await this.notifyShipmentInTransit(data.contact, data.shipment);
            case 'send_delivery_notification':
                return await this.notifyDeliveryComplete(data.contact, data.delivery);
            case 'send_customs_alert':
                return await this.sendCustomsAlert(data.contact, data.customs);
            case 'send_quote':
                return await this.sendShippingQuote(data.contact, data.quote);
            case 'send_delay_alert':
                return await this.sendDelayAlert(data.contact, data.delay);
            case 'send_text':
                return await this.sendTextMessage(data.to, data.text);
            case 'send_document':
                return await this.sendDocument(data.to, data.url, data.filename, data.caption);
            case 'send_location':
                return await this.sendLocation(data.to, data.latitude, data.longitude, data.name, data.address);
            case 'get_conversation':
                return this.getConversationHistory(data.phone_number, data.limit);
            default:
                throw new Error(`Unknown operation: ${operation}`);
        }
    }
    
    // Disconnect
    async disconnect() {
        this.messageQueue = [];
        this.processingQueue = false;
        this.conversations.clear();
        this.messageStatus.clear();
        this.emit('disconnected');
    }
}

module.exports = WhatsAppBusinessIntegration;