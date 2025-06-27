/**
 * Maersk Carrier Integration
 * Implements Maersk Line API connections and data processing
 */

const { BaseCarrierConnector, DataType } = require('../core/base-connector');
const crypto = require('crypto');

class MaerskConnector extends BaseCarrierConnector {
    constructor(config) {
        super({
            ...config,
            carrierId: 'maersk',
            carrierName: 'Maersk Line',
            apiUrl: config.apiUrl || 'https://api.maersk.com/v1',
            rateLimit: 60 // Maersk rate limit: 60 requests per minute
        });
        
        // Maersk-specific configuration
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.consumerKey = config.consumerKey;
        this.accessToken = null;
        this.tokenExpiry = null;
        
        // Maersk-specific endpoints
        this.endpoints = {
            auth: '/oauth2/token',
            tracking: '/track/{containerNumber}',
            schedule: '/schedules',
            booking: '/bookings',
            invoice: '/invoices',
            ddCharges: '/demurrage-detention',
            events: '/events/subscriptions'
        };
        
        // Container status mapping
        this.statusMapping = {
            'GATE_IN': 'gate_in',
            'GATE_OUT': 'gate_out',
            'LOADED': 'loaded',
            'DISCHARGED': 'discharged',
            'ON_RAIL': 'on_rail',
            'OFF_RAIL': 'off_rail',
            'EMPTY_RETURNED': 'empty_returned',
            'FULL_RECEIVED': 'full_received'
        };
    }

    // Implement Maersk OAuth2 authentication
    async authenticate() {
        try {
            this.logger.info('Authenticating with Maersk API');
            
            // Check if we have a valid token
            if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
                return true;
            }
            
            // Request new access token
            const authData = {
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret,
                scope: 'track booking invoice'
            };
            
            const response = await this.httpClient.post(this.endpoints.auth, authData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Consumer-Key': this.consumerKey
                }
            });
            
            this.accessToken = response.data.access_token;
            this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
            
            // Update HTTP client with auth token
            this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
            this.httpClient.defaults.headers.common['Consumer-Key'] = this.consumerKey;
            
            this.logger.info('Successfully authenticated with Maersk');
            return true;
            
        } catch (error) {
            this.logger.error('Maersk authentication failed', error);
            throw new Error(`Maersk authentication failed: ${error.message}`);
        }
    }

    // Fetch container tracking information
    async fetchContainerStatus(containerNumber) {
        return this.executeWithRateLimit(async () => {
            return this.executeWithRetry(async () => {
                // Ensure we're authenticated
                await this.authenticate();
                
                const endpoint = this.endpoints.tracking.replace('{containerNumber}', containerNumber);
                const response = await this.httpClient.get(endpoint);
                
                // Process the tracking data
                const trackingData = this.parseTrackingResponse(response.data);
                
                // Save to database
                await this.processData(DataType.CONTAINER_STATUS, trackingData, {
                    containerNumber: containerNumber,
                    source: 'api'
                });
                
                return trackingData;
            });
        });
    }

    // Parse Maersk tracking response
    parseTrackingResponse(data) {
        const events = data.events || [];
        const currentEvent = events[0] || {};
        
        return {
            containerNumber: data.containerNumber,
            status: this.statusMapping[currentEvent.eventType] || currentEvent.eventType,
            location: {
                port: currentEvent.location?.port,
                terminal: currentEvent.location?.terminal,
                country: currentEvent.location?.country,
                coordinates: {
                    lat: currentEvent.location?.latitude,
                    lng: currentEvent.location?.longitude
                }
            },
            timestamp: currentEvent.eventDateTime,
            vessel: {
                name: currentEvent.vessel?.name,
                imo: currentEvent.vessel?.imo,
                voyage: currentEvent.voyage
            },
            eta: data.estimatedTimeOfArrival,
            events: events.map(event => ({
                type: this.statusMapping[event.eventType] || event.eventType,
                location: event.location?.port,
                timestamp: event.eventDateTime,
                description: event.description
            })),
            lastFreeDate: data.lastFreeDate,
            demurrageStartDate: data.demurrageStartDate,
            detentionStartDate: data.detentionStartDate
        };
    }

    // Fetch D&D charges
    async fetchDDCharges(startDate, endDate) {
        return this.executeWithRateLimit(async () => {
            return this.executeWithRetry(async () => {
                await this.authenticate();
                
                const params = {
                    fromDate: startDate.toISOString().split('T')[0],
                    toDate: endDate.toISOString().split('T')[0],
                    chargeType: 'DEMURRAGE,DETENTION'
                };
                
                const response = await this.httpClient.get(this.endpoints.ddCharges, { params });
                
                const charges = this.parseDDCharges(response.data);
                
                // Process each charge
                for (const charge of charges) {
                    await this.processData(DataType.DD_CHARGES, charge, {
                        source: 'api',
                        dateRange: { start: startDate, end: endDate }
                    });
                }
                
                return charges;
            });
        });
    }

    // Parse D&D charges response
    parseDDCharges(data) {
        return (data.charges || []).map(charge => ({
            containerNumber: charge.containerNumber,
            chargeType: charge.type.toLowerCase(),
            amount: parseFloat(charge.amount),
            currency: charge.currency,
            startDate: charge.periodStart,
            endDate: charge.periodEnd,
            days: charge.chargeDays,
            rate: parseFloat(charge.dailyRate),
            invoiceNumber: charge.invoiceReference,
            status: charge.status,
            booking: {
                number: charge.bookingNumber,
                pol: charge.portOfLoading,
                pod: charge.portOfDischarge
            },
            freeTime: {
                days: charge.freeTimeDays,
                expiry: charge.freeTimeExpiry
            },
            disputes: charge.disputes?.map(dispute => ({
                id: dispute.id,
                status: dispute.status,
                amount: parseFloat(dispute.disputedAmount),
                reason: dispute.reason,
                createdDate: dispute.createdDate
            }))
        }));
    }

    // Fetch bookings
    async fetchBookings(startDate, endDate) {
        return this.executeWithRateLimit(async () => {
            return this.executeWithRetry(async () => {
                await this.authenticate();
                
                const params = {
                    bookingDateFrom: startDate.toISOString().split('T')[0],
                    bookingDateTo: endDate.toISOString().split('T')[0]
                };
                
                const response = await this.httpClient.get(this.endpoints.booking, { params });
                
                const bookings = this.parseBookings(response.data);
                
                for (const booking of bookings) {
                    await this.processData(DataType.BOOKING, booking, {
                        source: 'api',
                        dateRange: { start: startDate, end: endDate }
                    });
                }
                
                return bookings;
            });
        });
    }

    // Parse bookings response
    parseBookings(data) {
        return (data.bookings || []).map(booking => ({
            bookingNumber: booking.bookingNumber,
            status: booking.status,
            bookingDate: booking.bookingDate,
            origin: {
                port: booking.placeOfReceipt,
                country: booking.originCountry
            },
            destination: {
                port: booking.placeOfDelivery,
                country: booking.destinationCountry
            },
            containers: (booking.containers || []).map(container => ({
                number: container.containerNumber,
                type: container.containerType,
                size: container.containerSize,
                weight: container.grossWeight,
                commodity: container.commodity
            })),
            vessel: {
                name: booking.vesselName,
                voyage: booking.voyageNumber,
                etd: booking.estimatedDeparture,
                eta: booking.estimatedArrival
            },
            customer: {
                name: booking.customerName,
                reference: booking.customerReference
            }
        }));
    }

    // Subscribe to real-time events
    async subscribeToEvents(eventTypes = ['CONTAINER_EVENT', 'BOOKING_UPDATE']) {
        try {
            await this.authenticate();
            
            const subscription = {
                callbackUrl: `${process.env.WEBHOOK_BASE_URL}/webhooks/maersk/${this.integrationId}`,
                eventTypes: eventTypes,
                filters: {
                    customerCode: this.config.customerCode
                }
            };
            
            const response = await this.httpClient.post(this.endpoints.events, subscription);
            
            this.logger.info('Subscribed to Maersk events', {
                subscriptionId: response.data.subscriptionId,
                eventTypes: eventTypes
            });
            
            return response.data.subscriptionId;
            
        } catch (error) {
            this.logger.error('Failed to subscribe to Maersk events', error);
            throw error;
        }
    }

    // Process webhook event
    async processWebhookEvent(event) {
        try {
            // Verify webhook signature
            if (!this.verifyWebhookSignature(event.headers, event.body)) {
                throw new Error('Invalid webhook signature');
            }
            
            const eventData = JSON.parse(event.body);
            
            switch (eventData.eventType) {
                case 'CONTAINER_EVENT':
                    await this.processContainerEvent(eventData);
                    break;
                case 'BOOKING_UPDATE':
                    await this.processBookingUpdate(eventData);
                    break;
                case 'CHARGE_NOTIFICATION':
                    await this.processChargeNotification(eventData);
                    break;
                default:
                    this.logger.warn('Unknown event type', { type: eventData.eventType });
            }
            
            return { processed: true };
            
        } catch (error) {
            this.logger.error('Webhook processing error', error);
            throw error;
        }
    }

    // Verify webhook signature
    verifyWebhookSignature(headers, body) {
        const signature = headers['x-maersk-signature'];
        const timestamp = headers['x-maersk-timestamp'];
        
        if (!signature || !timestamp) {
            return false;
        }
        
        // Verify timestamp is within 5 minutes
        const currentTime = Math.floor(Date.now() / 1000);
        if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
            return false;
        }
        
        // Calculate expected signature
        const payload = `${timestamp}.${body}`;
        const expectedSignature = crypto
            .createHmac('sha256', this.config.webhookSecret)
            .update(payload)
            .digest('hex');
        
        return signature === expectedSignature;
    }

    // Process container event
    async processContainerEvent(eventData) {
        const containerStatus = {
            containerNumber: eventData.containerNumber,
            status: this.statusMapping[eventData.status] || eventData.status,
            location: eventData.location,
            timestamp: eventData.timestamp,
            vessel: eventData.vessel,
            previousStatus: eventData.previousStatus
        };
        
        await this.processData(DataType.CONTAINER_STATUS, containerStatus, {
            source: 'webhook',
            eventId: eventData.eventId
        });
        
        // Emit real-time update
        this.emit('containerUpdate', containerStatus);
    }

    // Process booking update
    async processBookingUpdate(eventData) {
        const booking = this.parseBookings({ bookings: [eventData.booking] })[0];
        
        await this.processData(DataType.BOOKING, booking, {
            source: 'webhook',
            eventId: eventData.eventId,
            updateType: eventData.updateType
        });
        
        this.emit('bookingUpdate', booking);
    }

    // Process charge notification
    async processChargeNotification(eventData) {
        const charge = this.parseDDCharges({ charges: [eventData.charge] })[0];
        
        await this.processData(DataType.DD_CHARGES, charge, {
            source: 'webhook',
            eventId: eventData.eventId,
            notificationType: eventData.notificationType
        });
        
        // Alert for new charges
        if (eventData.notificationType === 'NEW_CHARGE') {
            this.emit('newCharge', charge);
        }
    }

    // Override standardizeData for Maersk-specific formatting
    async standardizeData(dataType, rawData) {
        const standardized = await super.standardizeData(dataType, rawData);
        
        // Add Maersk-specific fields
        standardized.carrier = 'MAEU'; // Maersk carrier code
        standardized.source = 'Maersk Line API';
        
        // Ensure consistent date formats
        if (standardized.data) {
            this.normalizeDates(standardized.data);
        }
        
        return standardized;
    }

    // Normalize date formats
    normalizeDates(obj) {
        for (const key in obj) {
            if (obj[key] instanceof Date) {
                obj[key] = obj[key].toISOString();
            } else if (typeof obj[key] === 'string' && this.isISODate(obj[key])) {
                obj[key] = new Date(obj[key]).toISOString();
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                this.normalizeDates(obj[key]);
            }
        }
    }

    // Check if string is ISO date
    isISODate(str) {
        return /^\d{4}-\d{2}-\d{2}/.test(str);
    }

    // Get carrier-specific metadata
    getCarrierMetadata() {
        return {
            carrier: 'Maersk Line',
            carrierCode: 'MAEU',
            apiVersion: 'v1',
            supportedFeatures: [
                'real_time_tracking',
                'webhook_notifications',
                'dd_charges',
                'dispute_management',
                'booking_management'
            ],
            rateLimit: {
                requests: this.config.rateLimit,
                window: '1 minute'
            }
        };
    }
}

module.exports = MaerskConnector;