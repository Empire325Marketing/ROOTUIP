/**
 * MSC (Mediterranean Shipping Company) Carrier Integration
 * Implements MSC API/EDI connections and data processing
 */

const { BaseCarrierConnector, DataType } = require('../core/base-connector');
const soap = require('soap');
const ftp = require('basic-ftp');
const path = require('path');

class MSCConnector extends BaseCarrierConnector {
    constructor(config) {
        super({
            ...config,
            carrierId: 'msc',
            carrierName: 'Mediterranean Shipping Company',
            apiUrl: config.apiUrl || 'https://api.msc.com/services',
            rateLimit: 30 // MSC has stricter rate limits
        });
        
        // MSC-specific configuration
        this.username = config.username;
        this.password = config.password;
        this.customerId = config.customerId;
        this.ediPartnerId = config.ediPartnerId;
        
        // MSC uses SOAP for some services
        this.soapClients = {};
        this.soapEndpoints = {
            tracking: '/TrackingService?wsdl',
            booking: '/BookingService?wsdl',
            charges: '/ChargesService?wsdl'
        };
        
        // FTP configuration for EDI files
        this.ftpConfig = {
            host: config.ftpHost || 'ftp.msc.com',
            user: config.ftpUser,
            password: config.ftpPassword,
            secure: true
        };
        
        // EDI file patterns
        this.ediPatterns = {
            status: /^IFTSTA.*\.edi$/i,    // Status messages
            charges: /^IFTMCS.*\.edi$/i,   // Charges
            booking: /^IFTMBF.*\.edi$/i    // Booking confirmation
        };
        
        // MSC status codes
        this.statusMapping = {
            'AE': 'gate_in_empty',
            'AF': 'gate_in_full',
            'I': 'gate_in',
            'OA': 'gate_out_empty',
            'OF': 'gate_out_full',
            'VL': 'loaded',
            'UV': 'discharged',
            'AR': 'on_rail',
            'RD': 'off_rail',
            'RD': 'returned_empty'
        };
    }

    // Implement MSC authentication
    async authenticate() {
        try {
            this.logger.info('Authenticating with MSC systems');
            
            // Initialize SOAP clients
            await this.initializeSoapClients();
            
            // Test FTP connection
            await this.testFtpConnection();
            
            this.logger.info('Successfully authenticated with MSC');
            return true;
            
        } catch (error) {
            this.logger.error('MSC authentication failed', error);
            throw new Error(`MSC authentication failed: ${error.message}`);
        }
    }

    // Initialize SOAP clients
    async initializeSoapClients() {
        for (const [service, endpoint] of Object.entries(this.soapEndpoints)) {
            try {
                const url = `${this.config.apiUrl}${endpoint}`;
                const client = await soap.createClientAsync(url, {
                    wsdl_headers: {
                        Authorization: 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64')
                    }
                });
                
                // Add security headers
                const security = new soap.BasicAuthSecurity(this.username, this.password);
                client.setSecurity(security);
                
                this.soapClients[service] = client;
                this.logger.debug(`SOAP client initialized for ${service}`);
                
            } catch (error) {
                this.logger.error(`Failed to initialize SOAP client for ${service}`, error);
                throw error;
            }
        }
    }

    // Test FTP connection
    async testFtpConnection() {
        const client = new ftp.Client();
        try {
            await client.access(this.ftpConfig);
            await client.list();
            this.logger.debug('FTP connection test successful');
        } finally {
            client.close();
        }
    }

    // Fetch container status via SOAP
    async fetchContainerStatus(containerNumber) {
        return this.executeWithRateLimit(async () => {
            return this.executeWithRetry(async () => {
                const client = this.soapClients.tracking;
                if (!client) {
                    throw new Error('Tracking SOAP client not initialized');
                }
                
                const args = {
                    ContainerNumber: containerNumber,
                    CustomerId: this.customerId
                };
                
                const [result] = await client.GetContainerTrackingAsync(args);
                
                const trackingData = this.parseSOAPTrackingResponse(result);
                
                await this.processData(DataType.CONTAINER_STATUS, trackingData, {
                    containerNumber: containerNumber,
                    source: 'soap'
                });
                
                return trackingData;
            });
        });
    }

    // Parse SOAP tracking response
    parseSOAPTrackingResponse(response) {
        const tracking = response.TrackingResult || {};
        const events = tracking.Events || [];
        
        return {
            containerNumber: tracking.ContainerNumber,
            status: this.statusMapping[tracking.StatusCode] || tracking.Status,
            location: {
                port: tracking.CurrentLocation,
                terminal: tracking.Terminal,
                country: tracking.Country
            },
            timestamp: tracking.StatusDate,
            vessel: {
                name: tracking.VesselName,
                voyage: tracking.Voyage,
                service: tracking.Service
            },
            eta: tracking.ETA,
            pod: tracking.PortOfDischarge,
            pol: tracking.PortOfLoading,
            events: events.map(event => ({
                type: this.statusMapping[event.StatusCode] || event.Status,
                location: event.Location,
                timestamp: event.EventDate,
                description: event.Description,
                mode: event.TransportMode
            })),
            lastFreeDate: tracking.LastFreeDate,
            demurrageInfo: {
                startDate: tracking.DemurrageStartDate,
                freeDays: tracking.FreeDays,
                rate: tracking.DemurrageRate,
                currency: tracking.Currency
            }
        };
    }

    // Fetch D&D charges via EDI files
    async fetchDDCharges(startDate, endDate) {
        return this.executeWithRateLimit(async () => {
            return this.executeWithRetry(async () => {
                // MSC primarily uses EDI for charges
                const ediFiles = await this.fetchEDIFiles('charges', startDate, endDate);
                const allCharges = [];
                
                for (const file of ediFiles) {
                    const charges = await this.parseChargesEDI(file);
                    allCharges.push(...charges);
                    
                    // Process each charge
                    for (const charge of charges) {
                        await this.processData(DataType.DD_CHARGES, charge, {
                            source: 'edi',
                            fileName: file.name
                        });
                    }
                }
                
                return allCharges;
            });
        });
    }

    // Fetch EDI files via FTP
    async fetchEDIFiles(type, startDate, endDate) {
        const client = new ftp.Client();
        const files = [];
        
        try {
            await client.access(this.ftpConfig);
            
            // Navigate to appropriate directory
            const directory = `/outbound/${this.ediPartnerId}/${type}`;
            await client.cd(directory);
            
            // List files
            const fileList = await client.list();
            
            // Filter files by pattern and date
            const pattern = this.ediPatterns[type];
            const relevantFiles = fileList.filter(file => {
                if (!pattern.test(file.name)) return false;
                
                const fileDate = new Date(file.modifiedAt);
                return fileDate >= startDate && fileDate <= endDate;
            });
            
            // Download files
            for (const fileInfo of relevantFiles) {
                const localPath = path.join('/tmp', fileInfo.name);
                await client.downloadTo(localPath, fileInfo.name);
                
                files.push({
                    name: fileInfo.name,
                    path: localPath,
                    date: fileInfo.modifiedAt
                });
            }
            
            this.logger.info(`Downloaded ${files.length} EDI files for ${type}`);
            
        } finally {
            client.close();
        }
        
        return files;
    }

    // Parse charges EDI file (IFTMCS)
    async parseChargesEDI(file) {
        const content = await this.parseFile(file.path, 'edi');
        const charges = [];
        
        let currentCharge = null;
        
        for (const segment of content.segments) {
            switch (segment.id) {
                case 'BGM': // Beginning of message
                    if (currentCharge) charges.push(currentCharge);
                    currentCharge = {
                        messageType: segment.elements[0],
                        documentNumber: segment.elements[1]
                    };
                    break;
                    
                case 'EQD': // Equipment details
                    if (currentCharge) {
                        currentCharge.containerNumber = segment.elements[1];
                        currentCharge.containerType = segment.elements[2];
                    }
                    break;
                    
                case 'LOC': // Location
                    if (currentCharge && segment.elements[0] === '9') { // Port of discharge
                        currentCharge.portOfDischarge = segment.elements[1];
                    }
                    break;
                    
                case 'DTM': // Date/time
                    if (currentCharge) {
                        const qualifier = segment.elements[0];
                        const date = this.parseEDIDate(segment.elements[1]);
                        
                        switch (qualifier) {
                            case '203': // Charge start date
                                currentCharge.startDate = date;
                                break;
                            case '206': // Charge end date
                                currentCharge.endDate = date;
                                break;
                            case '399': // Last free date
                                currentCharge.lastFreeDate = date;
                                break;
                        }
                    }
                    break;
                    
                case 'MOA': // Monetary amount
                    if (currentCharge) {
                        const qualifier = segment.elements[0];
                        const amount = parseFloat(segment.elements[1]);
                        const currency = segment.elements[2];
                        
                        switch (qualifier) {
                            case '23': // Charge amount
                                currentCharge.amount = amount;
                                currentCharge.currency = currency;
                                break;
                            case '204': // Daily rate
                                currentCharge.dailyRate = amount;
                                break;
                        }
                    }
                    break;
                    
                case 'FTX': // Free text
                    if (currentCharge && segment.elements[0] === 'CHG') {
                        currentCharge.chargeType = segment.elements[1].toLowerCase();
                        currentCharge.description = segment.elements[2];
                    }
                    break;
                    
                case 'RFF': // Reference
                    if (currentCharge && segment.elements[0] === 'BN') {
                        currentCharge.bookingNumber = segment.elements[1];
                    }
                    break;
            }
        }
        
        if (currentCharge) charges.push(currentCharge);
        
        // Enhance charge data
        return charges.map(charge => ({
            ...charge,
            days: this.calculateDays(charge.startDate, charge.endDate),
            carrier: 'MSC',
            status: 'pending',
            source: 'EDI'
        }));
    }

    // Parse EDI date format
    parseEDIDate(dateStr) {
        // EDI dates are typically in YYMMDD or YYYYMMDD format
        if (dateStr.length === 6) {
            const year = '20' + dateStr.substring(0, 2);
            const month = dateStr.substring(2, 4);
            const day = dateStr.substring(4, 6);
            return new Date(`${year}-${month}-${day}`);
        } else if (dateStr.length === 8) {
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            return new Date(`${year}-${month}-${day}`);
        }
        return null;
    }

    // Calculate days between dates
    calculateDays(startDate, endDate) {
        if (!startDate || !endDate) return 0;
        const start = new Date(startDate);
        const end = new Date(endDate);
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }

    // Fetch bookings
    async fetchBookings(startDate, endDate) {
        return this.executeWithRateLimit(async () => {
            return this.executeWithRetry(async () => {
                const client = this.soapClients.booking;
                if (!client) {
                    throw new Error('Booking SOAP client not initialized');
                }
                
                const args = {
                    CustomerId: this.customerId,
                    DateFrom: startDate.toISOString(),
                    DateTo: endDate.toISOString()
                };
                
                const [result] = await client.GetBookingsAsync(args);
                
                const bookings = this.parseBookingsResponse(result);
                
                for (const booking of bookings) {
                    await this.processData(DataType.BOOKING, booking, {
                        source: 'soap',
                        dateRange: { start: startDate, end: endDate }
                    });
                }
                
                return bookings;
            });
        });
    }

    // Parse bookings response
    parseBookingsResponse(response) {
        const bookingsList = response.BookingsResult?.Bookings || [];
        
        return bookingsList.map(booking => ({
            bookingNumber: booking.BookingNumber,
            status: booking.Status,
            bookingDate: booking.BookingDate,
            origin: {
                port: booking.PortOfReceipt,
                country: booking.OriginCountry
            },
            destination: {
                port: booking.PortOfDelivery,
                country: booking.DestinationCountry
            },
            containers: (booking.Containers || []).map(container => ({
                number: container.ContainerNumber,
                type: container.Type,
                size: container.Size,
                weight: container.GrossWeight,
                commodity: container.Commodity,
                hazmat: container.IsHazmat,
                reefer: container.IsReefer,
                temperature: container.Temperature
            })),
            vessel: {
                name: booking.VesselName,
                voyage: booking.VoyageNumber,
                service: booking.ServiceName,
                etd: booking.ETD,
                eta: booking.ETA
            },
            customer: {
                name: booking.CustomerName,
                reference: booking.CustomerReference,
                contact: booking.ContactPerson
            },
            specialInstructions: booking.SpecialInstructions
        }));
    }

    // Process email notifications (MSC sends some updates via email)
    async processEmailNotification(email) {
        try {
            // Extract container numbers from email
            const containerRegex = /\b[A-Z]{4}\d{7}\b/g;
            const containers = email.body.match(containerRegex) || [];
            
            // Check for charge notifications
            if (email.subject.toLowerCase().includes('demurrage') || 
                email.subject.toLowerCase().includes('detention')) {
                
                // Parse charge details from email
                const chargeInfo = this.parseChargeEmail(email);
                
                if (chargeInfo) {
                    await this.processData(DataType.DD_CHARGES, chargeInfo, {
                        source: 'email',
                        emailId: email.id
                    });
                }
            }
            
            // Check for status updates
            if (containers.length > 0) {
                for (const containerNumber of containers) {
                    // Fetch latest status for mentioned containers
                    await this.fetchContainerStatus(containerNumber);
                }
            }
            
            return { processed: true, containers: containers.length };
            
        } catch (error) {
            this.logger.error('Email processing error', error);
            throw error;
        }
    }

    // Parse charge information from email
    parseChargeEmail(email) {
        // Basic email parsing logic - would be enhanced with specific templates
        const amountMatch = email.body.match(/(?:USD|EUR|GBP)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
        const containerMatch = email.body.match(/\b[A-Z]{4}\d{7}\b/);
        const periodMatch = email.body.match(/period:\s*(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
        
        if (amountMatch && containerMatch) {
            return {
                containerNumber: containerMatch[0],
                chargeType: email.subject.toLowerCase().includes('demurrage') ? 'demurrage' : 'detention',
                amount: parseFloat(amountMatch[1].replace(/,/g, '')),
                currency: amountMatch[0].substring(0, 3),
                startDate: periodMatch ? new Date(periodMatch[1]) : null,
                endDate: periodMatch ? new Date(periodMatch[2]) : null,
                source: 'email',
                emailSubject: email.subject,
                receivedDate: email.date
            };
        }
        
        return null;
    }

    // Override standardizeData for MSC-specific formatting
    async standardizeData(dataType, rawData) {
        const standardized = await super.standardizeData(dataType, rawData);
        
        // Add MSC-specific fields
        standardized.carrier = 'MSCU'; // MSC carrier code
        standardized.source = 'MSC Systems';
        
        // MSC uses different date formats in different systems
        this.standardizeMSCDates(standardized.data);
        
        return standardized;
    }

    // Standardize MSC date formats
    standardizeMSCDates(obj) {
        for (const key in obj) {
            if (obj[key] && typeof obj[key] === 'string') {
                // Check for MSC date format (DD/MM/YYYY)
                const mscDateMatch = obj[key].match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                if (mscDateMatch) {
                    obj[key] = new Date(`${mscDateMatch[3]}-${mscDateMatch[2]}-${mscDateMatch[1]}`).toISOString();
                }
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                this.standardizeMSCDates(obj[key]);
            }
        }
    }

    // Get carrier-specific metadata
    getCarrierMetadata() {
        return {
            carrier: 'Mediterranean Shipping Company',
            carrierCode: 'MSCU',
            integrationTypes: ['SOAP', 'EDI', 'FTP', 'Email'],
            supportedFeatures: [
                'container_tracking',
                'edi_processing',
                'dd_charges',
                'booking_management',
                'email_notifications'
            ],
            dataFormats: ['XML', 'EDI', 'Email'],
            updateFrequency: {
                tracking: 'real-time via SOAP',
                charges: 'daily via EDI',
                bookings: 'on-demand'
            }
        };
    }
}

module.exports = MSCConnector;