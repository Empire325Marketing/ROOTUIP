#!/usr/bin/env node

/**
 * ROOTUIP EDI Processing Service
 * Electronic Data Interchange processing for carrier integrations
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const redis = require('redis');
const cors = require('cors');
const multer = require('multer');

const app = express();
const PORT = process.env.EDI_PROCESSING_PORT || 3026;

// Redis client
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Multer for file uploads
const upload = multer({ 
    dest: '/tmp/edi/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(cors());
app.use(express.json());
app.use(express.text());

// EDI message storage
const ediMessages = new Map();
const processedEvents = [];

// Connect to Redis
async function connectRedis() {
    try {
        await redisClient.connect();
        console.log('✅ Redis connected for EDI processing');
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
    }
}

connectRedis();

// EDI message types and processors
const EDI_PROCESSORS = {
    '214': processTransportationCarrierShipmentStatus,
    '315': processStatusDetailsOcean,
    '322': processTerminalOperationsActivity,
    '404': processRailCarrierShipmentInformation,
    '990': processResponseToLoadTender
};

// EDI 214 - Transportation Carrier Shipment Status Message
function processTransportationCarrierShipmentStatus(ediContent, segments) {
    try {
        const result = {
            messageType: '214',
            messageId: extractSegmentValue(segments, 'BGN', 2),
            shipmentId: extractSegmentValue(segments, 'N9', 2),
            containerNumber: extractContainerNumber(segments),
            carrier: extractCarrierInfo(segments),
            statusCode: extractSegmentValue(segments, 'AT7', 1),
            statusDescription: mapStatusCode(extractSegmentValue(segments, 'AT7', 1)),
            location: extractLocationInfo(segments),
            timestamp: extractDateTime(segments),
            equipment: extractEquipmentInfo(segments),
            events: extractEvents(segments)
        };

        console.log(`📋 Processed EDI 214 - Shipment Status for ${result.containerNumber}`);
        return result;

    } catch (error) {
        console.error('Error processing EDI 214:', error);
        return null;
    }
}

// EDI 315 - Status Details (Ocean)
function processStatusDetailsOcean(ediContent, segments) {
    try {
        const result = {
            messageType: '315',
            messageId: extractSegmentValue(segments, 'BGN', 2),
            containerNumber: extractContainerNumber(segments),
            vesselInfo: {
                name: extractSegmentValue(segments, 'V1', 1),
                voyage: extractSegmentValue(segments, 'V1', 2),
                steamshipLine: extractSegmentValue(segments, 'V1', 3)
            },
            portInfo: extractPortInfo(segments),
            statusEvents: extractStatusEvents(segments),
            estimatedTimes: extractEstimatedTimes(segments)
        };

        console.log(`🚢 Processed EDI 315 - Ocean Status for ${result.containerNumber}`);
        return result;

    } catch (error) {
        console.error('Error processing EDI 315:', error);
        return null;
    }
}

// EDI 322 - Terminal Operations Activity
function processTerminalOperationsActivity(ediContent, segments) {
    try {
        const result = {
            messageType: '322',
            messageId: extractSegmentValue(segments, 'BGN', 2),
            containerNumber: extractContainerNumber(segments),
            terminalCode: extractSegmentValue(segments, 'N1', 2),
            activityCode: extractSegmentValue(segments, 'AT7', 1),
            activityDescription: mapActivityCode(extractSegmentValue(segments, 'AT7', 1)),
            timestamp: extractDateTime(segments),
            location: extractLocationInfo(segments),
            equipmentDetails: extractEquipmentDetails(segments)
        };

        console.log(`🏗️ Processed EDI 322 - Terminal Activity for ${result.containerNumber}`);
        return result;

    } catch (error) {
        console.error('Error processing EDI 322:', error);
        return null;
    }
}

// Generic EDI processor for unknown message types
function processGenericEDI(ediContent, segments) {
    const messageType = extractMessageType(segments);
    
    return {
        messageType: messageType || 'UNKNOWN',
        messageId: extractSegmentValue(segments, 'BGN', 2) || generateMessageId(),
        rawContent: ediContent,
        segments: segments.length,
        timestamp: new Date().toISOString(),
        processed: false,
        requiresManualReview: true
    };
}

// EDI parsing utilities
function parseEDI(ediContent) {
    try {
        // Clean and normalize EDI content
        const cleaned = ediContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Split into segments (typically separated by ~ or newlines)
        const segments = cleaned.split(/[~\n]/).filter(seg => seg.trim().length > 0);
        
        return segments.map(segment => {
            // Split each segment by element separator (typically *)
            return segment.split('*').map(element => element.trim());
        });

    } catch (error) {
        console.error('Error parsing EDI:', error);
        return [];
    }
}

function extractMessageType(segments) {
    // Look for ST segment which contains message type
    const stSegment = segments.find(seg => seg[0] === 'ST');
    return stSegment ? stSegment[1] : null;
}

function extractSegmentValue(segments, segmentType, position) {
    const segment = segments.find(seg => seg[0] === segmentType);
    return segment && segment[position] ? segment[position] : null;
}

function extractContainerNumber(segments) {
    // Container number can be in various places depending on message type
    let containerNumber = extractSegmentValue(segments, 'N9', 2);
    if (!containerNumber) {
        containerNumber = extractSegmentValue(segments, 'EQD', 2);
    }
    if (!containerNumber) {
        // Look in REF segments
        const refSegments = segments.filter(seg => seg[0] === 'REF');
        for (const ref of refSegments) {
            if (ref[1] === 'CN' || ref[1] === 'BM') {
                containerNumber = ref[2];
                break;
            }
        }
    }
    return containerNumber;
}

function extractCarrierInfo(segments) {
    const n1Segment = segments.find(seg => seg[0] === 'N1' && seg[1] === 'SH');
    return {
        code: n1Segment ? n1Segment[2] : null,
        name: n1Segment ? n1Segment[3] : null
    };
}

function extractLocationInfo(segments) {
    const n3Segment = segments.find(seg => seg[0] === 'N3');
    const n4Segment = segments.find(seg => seg[0] === 'N4');
    
    return {
        address: n3Segment ? n3Segment[1] : null,
        city: n4Segment ? n4Segment[1] : null,
        state: n4Segment ? n4Segment[2] : null,
        postalCode: n4Segment ? n4Segment[3] : null,
        country: n4Segment ? n4Segment[4] : null
    };
}

function extractDateTime(segments) {
    const dtmSegment = segments.find(seg => seg[0] === 'DTM');
    if (dtmSegment && dtmSegment[2]) {
        // Convert YYYYMMDD or YYYYMMDDHHMM to ISO format
        const dateStr = dtmSegment[2];
        if (dateStr.length >= 8) {
            const year = dateStr.substr(0, 4);
            const month = dateStr.substr(4, 2);
            const day = dateStr.substr(6, 2);
            const hour = dateStr.length > 8 ? dateStr.substr(8, 2) : '00';
            const minute = dateStr.length > 10 ? dateStr.substr(10, 2) : '00';
            
            return new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`).toISOString();
        }
    }
    return new Date().toISOString();
}

function extractEquipmentInfo(segments) {
    const eqdSegment = segments.find(seg => seg[0] === 'EQD');
    return eqdSegment ? {
        type: eqdSegment[1],
        number: eqdSegment[2],
        size: eqdSegment[3]
    } : {};
}

function extractEvents(segments) {
    const at7Segments = segments.filter(seg => seg[0] === 'AT7');
    return at7Segments.map(seg => ({
        code: seg[1],
        description: mapStatusCode(seg[1]),
        qualifier: seg[2],
        time: seg[3]
    }));
}

function extractPortInfo(segments) {
    const r4Segments = segments.filter(seg => seg[0] === 'R4');
    return r4Segments.map(seg => ({
        code: seg[1],
        name: seg[2],
        country: seg[3],
        qualifier: seg[4]
    }));
}

function extractStatusEvents(segments) {
    const v9Segments = segments.filter(seg => seg[0] === 'V9');
    return v9Segments.map(seg => ({
        eventCode: seg[1],
        eventDate: seg[2],
        eventTime: seg[3],
        port: seg[4]
    }));
}

function extractEstimatedTimes(segments) {
    const dtmSegments = segments.filter(seg => seg[0] === 'DTM');
    const times = {};
    
    dtmSegments.forEach(seg => {
        switch (seg[1]) {
            case '140': times.estimatedDeparture = seg[2]; break;
            case '140': times.estimatedArrival = seg[2]; break;
            case '150': times.actualDeparture = seg[2]; break;
            case '151': times.actualArrival = seg[2]; break;
        }
    });
    
    return times;
}

function extractEquipmentDetails(segments) {
    const eqdSegments = segments.filter(seg => seg[0] === 'EQD');
    return eqdSegments.map(seg => ({
        equipmentType: seg[1],
        equipmentNumber: seg[2],
        equipmentSize: seg[3],
        equipmentCheckDigit: seg[4]
    }));
}

// Status code mappings
function mapStatusCode(code) {
    const statusCodes = {
        'A1': 'Loaded on Vessel',
        'A2': 'Unloaded from Vessel',
        'AF': 'Loaded on Aircraft',
        'AL': 'Available for Delivery',
        'AR': 'Arrived at Destination',
        'B1': 'Loaded on Equipment',
        'B2': 'Unloaded from Equipment',
        'CD': 'Customs Release',
        'CP': 'Cleared Destination Port',
        'CX': 'Cancelled',
        'D1': 'Delivered',
        'DE': 'Departed',
        'DR': 'Driver Dispatched',
        'G1': 'Gate In',
        'G2': 'Gate Out',
        'I1': 'Inbound to Destination',
        'IT': 'In Transit',
        'L1': 'Loaded',
        'OA': 'Out for Delivery',
        'OD': 'On Dock',
        'PL': 'Planned',
        'PU': 'Picked Up',
        'R1': 'Received',
        'SA': 'Sailed',
        'U1': 'Unloaded',
        'X1': 'Departed Origin',
        'X2': 'Arrived Destination',
        'X3': 'Estimated Departure',
        'X4': 'Estimated Arrival',
        'X6': 'Equipment Dispatched'
    };
    
    return statusCodes[code] || code || 'Unknown Status';
}

function mapActivityCode(code) {
    const activityCodes = {
        'RCE': 'Container Received Empty',
        'RCL': 'Container Received Loaded',
        'DEL': 'Container Delivered',
        'LOD': 'Container Loaded on Vessel',
        'ULD': 'Container Unloaded from Vessel',
        'STR': 'Container Stored',
        'REL': 'Container Released',
        'RTN': 'Container Returned'
    };
    
    return activityCodes[code] || code || 'Unknown Activity';
}

function generateMessageId() {
    return 'EDI-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Convert processed EDI to standard container format
function convertToStandardFormat(processedEDI) {
    return {
        id: processedEDI.containerNumber,
        containerId: processedEDI.containerNumber,
        source: 'edi_' + processedEDI.messageType,
        carrier: processedEDI.carrier?.name || 'Unknown',
        status: processedEDI.statusDescription || processedEDI.activityDescription,
        location: processedEDI.location?.city || 'Unknown',
        vessel: processedEDI.vesselInfo?.name,
        voyage: processedEDI.vesselInfo?.voyage,
        lastUpdate: processedEDI.timestamp || new Date().toISOString(),
        events: processedEDI.events || [],
        equipment: processedEDI.equipment || processedEDI.equipmentDetails?.[0] || {}
    };
}

// API Endpoints
app.post('/api/edi/process', upload.single('ediFile'), async (req, res) => {
    try {
        let ediContent;
        
        if (req.file) {
            // Process uploaded file
            ediContent = fs.readFileSync(req.file.path, 'utf8');
            fs.unlinkSync(req.file.path); // Clean up temp file
        } else if (req.body && typeof req.body === 'string') {
            // Process raw EDI content
            ediContent = req.body;
        } else {
            return res.status(400).json({ error: 'No EDI content provided' });
        }

        const segments = parseEDI(ediContent);
        const messageType = extractMessageType(segments);
        
        let processedData;
        const processor = EDI_PROCESSORS[messageType];
        
        if (processor) {
            processedData = processor(ediContent, segments);
        } else {
            processedData = processGenericEDI(ediContent, segments);
        }

        if (processedData) {
            // Store processed message
            const messageId = processedData.messageId || generateMessageId();
            ediMessages.set(messageId, {
                ...processedData,
                originalContent: ediContent,
                processedAt: new Date().toISOString()
            });

            // Convert to standard format and publish to real-time system
            if (processedData.containerNumber && processedData.messageType !== 'UNKNOWN') {
                const standardFormat = convertToStandardFormat(processedData);
                await redisClient.publish('container-updates', JSON.stringify(standardFormat));
                
                console.log(`📡 Published EDI update for container ${standardFormat.containerId}`);
            }

            res.json({
                success: true,
                messageId: messageId,
                messageType: messageType,
                containerNumber: processedData.containerNumber,
                processed: processedData.messageType !== 'UNKNOWN',
                data: processedData
            });

        } else {
            res.status(500).json({ error: 'Failed to process EDI message' });
        }

    } catch (error) {
        console.error('EDI processing error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/edi/messages', (req, res) => {
    const messages = Array.from(ediMessages.values());
    res.json({
        success: true,
        messages: messages.slice(-50), // Last 50 messages
        total: messages.length
    });
});

app.get('/api/edi/messages/:messageId', (req, res) => {
    const message = ediMessages.get(req.params.messageId);
    if (message) {
        res.json({ success: true, message });
    } else {
        res.status(404).json({ error: 'Message not found' });
    }
});

app.post('/api/edi/test', (req, res) => {
    // Generate test EDI 214 message
    const testEDI = `ST*214*001~
BGN*11*TEST123*20250630*1200~
N1*SH*MAERSK*ZZ*MAE~
N9*BM*MSKU1234567~
DTM*140*20250630*1200~
AT7*G1*NS*20250630*1200~
N3*APM Terminals Singapore~
N4*Singapore**119000*SG~
SE*8*001~`;

    const segments = parseEDI(testEDI);
    const processedData = processTransportationCarrierShipmentStatus(testEDI, segments);
    
    if (processedData) {
        const messageId = generateMessageId();
        ediMessages.set(messageId, {
            ...processedData,
            originalContent: testEDI,
            processedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            messageId: messageId,
            testMessage: 'EDI 214 test message processed',
            data: processedData
        });
    } else {
        res.status(500).json({ error: 'Failed to process test EDI message' });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'edi-processing-service',
        messagesProcessed: ediMessages.size,
        supportedMessageTypes: Object.keys(EDI_PROCESSORS),
        redisConnected: redisClient.isReady,
        uptime: process.uptime()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 EDI Processing Service running on port ${PORT}`);
    console.log(`📋 Supported EDI message types: ${Object.keys(EDI_PROCESSORS).join(', ')}`);
    console.log(`📁 Upload endpoint: http://localhost:${PORT}/api/edi/process`);
    console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/edi/test`);
});

module.exports = app;