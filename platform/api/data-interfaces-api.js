// ROOTUIP Data Interfaces API
const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parse');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads', req.user.companyId);
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.xlsx', '.xls', '.csv', '.xml', '.json'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Import endpoints
router.post('/import/upload', upload.array('files', 10), async (req, res) => {
    try {
        const { importType, mappingTemplate } = req.body;
        const processedFiles = [];

        for (const file of req.files) {
            const result = await processFile(file, {
                companyId: req.user.companyId,
                importType,
                mappingTemplate
            });
            
            processedFiles.push({
                filename: file.originalname,
                size: file.size,
                status: result.status,
                recordsProcessed: result.recordsProcessed,
                errors: result.errors
            });
        }

        res.json({
            success: true,
            files: processedFiles,
            message: `Successfully processed ${processedFiles.length} files`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export endpoints
router.post('/export/generate', async (req, res) => {
    try {
        const {
            startDate,
            endDate,
            dataTypes,
            format,
            filters
        } = req.body;

        // Validate date range
        if (new Date(endDate) < new Date(startDate)) {
            return res.status(400).json({ error: 'Invalid date range' });
        }

        // Generate export based on format
        let exportFile;
        switch (format) {
            case 'excel':
                exportFile = await generateExcelExport(req.user.companyId, {
                    startDate,
                    endDate,
                    dataTypes,
                    filters
                });
                break;
            case 'csv':
                exportFile = await generateCSVExport(req.user.companyId, {
                    startDate,
                    endDate,
                    dataTypes,
                    filters
                });
                break;
            case 'pdf':
                exportFile = await generatePDFReport(req.user.companyId, {
                    startDate,
                    endDate,
                    dataTypes,
                    filters
                });
                break;
            case 'json':
                exportFile = await generateJSONExport(req.user.companyId, {
                    startDate,
                    endDate,
                    dataTypes,
                    filters
                });
                break;
            default:
                return res.status(400).json({ error: 'Invalid export format' });
        }

        // Store export for download
        const exportId = await storeExport(exportFile, req.user.companyId);

        res.json({
            success: true,
            exportId,
            downloadUrl: `/api/data/export/download/${exportId}`,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Download export
router.get('/export/download/:exportId', async (req, res) => {
    try {
        const { exportId } = req.params;
        const exportData = await getExport(exportId, req.user.companyId);
        
        if (!exportData) {
            return res.status(404).json({ error: 'Export not found or expired' });
        }

        res.download(exportData.filepath, exportData.filename);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get import/export history
router.get('/history', async (req, res) => {
    try {
        const { type, limit = 20, offset = 0 } = req.query;
        
        const history = await getDataTransferHistory(req.user.companyId, {
            type,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            success: true,
            history: history.data,
            total: history.total,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                pages: Math.ceil(history.total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Template management
router.get('/templates', async (req, res) => {
    try {
        const templates = await getTemplates(req.user.companyId);
        
        res.json({
            success: true,
            templates: templates.map(t => ({
                id: t.id,
                name: t.name,
                type: t.type,
                format: t.format,
                fields: t.fields,
                lastUsed: t.lastUsed,
                createdAt: t.createdAt
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/templates', async (req, res) => {
    try {
        const { name, type, format, mappings } = req.body;
        
        const template = await createTemplate({
            companyId: req.user.companyId,
            name,
            type,
            format,
            mappings,
            createdBy: req.user.id
        });

        res.json({
            success: true,
            template: {
                id: template.id,
                name: template.name,
                type: template.type
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Schedule management
router.get('/schedules', async (req, res) => {
    try {
        const schedules = await getSchedules(req.user.companyId);
        
        res.json({
            success: true,
            schedules: schedules.map(s => ({
                id: s.id,
                name: s.name,
                type: s.type,
                frequency: s.frequency,
                nextRun: s.nextRun,
                status: s.status,
                config: s.config
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/schedules', async (req, res) => {
    try {
        const { name, type, frequency, config } = req.body;
        
        const schedule = await createSchedule({
            companyId: req.user.companyId,
            name,
            type,
            frequency,
            config,
            createdBy: req.user.id
        });

        res.json({
            success: true,
            schedule: {
                id: schedule.id,
                name: schedule.name,
                nextRun: schedule.nextRun
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper functions
async function processFile(file, options) {
    const ext = path.extname(file.originalname).toLowerCase();
    let data;

    // Parse file based on type
    switch (ext) {
        case '.csv':
            data = await parseCSV(file.path);
            break;
        case '.xlsx':
        case '.xls':
            data = await parseExcel(file.path);
            break;
        case '.json':
            data = await parseJSON(file.path);
            break;
        case '.xml':
            data = await parseXML(file.path);
            break;
        case '.pdf':
            // Use OCR/document processing service
            data = await processPDF(file.path);
            break;
    }

    // Apply mapping template if specified
    if (options.mappingTemplate) {
        data = await applyMapping(data, options.mappingTemplate);
    }

    // Process based on import type
    const result = await processImportData(data, options);
    
    // Clean up uploaded file
    await fs.unlink(file.path);
    
    return result;
}

async function parseCSV(filepath) {
    const fileContent = await fs.readFile(filepath, 'utf8');
    return new Promise((resolve, reject) => {
        csv.parse(fileContent, {
            columns: true,
            skip_empty_lines: true
        }, (err, records) => {
            if (err) reject(err);
            else resolve(records);
        });
    });
}

async function parseExcel(filepath) {
    const workbook = xlsx.readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(worksheet);
}

async function parseJSON(filepath) {
    const fileContent = await fs.readFile(filepath, 'utf8');
    return JSON.parse(fileContent);
}

async function parseXML(filepath) {
    // XML parsing implementation
    const fileContent = await fs.readFile(filepath, 'utf8');
    // Use xml2js or similar library
    return {}; // Placeholder
}

async function processPDF(filepath) {
    // OCR processing for PDFs
    // This would integrate with document processing service
    return {
        text: 'Extracted text from PDF',
        confidence: 0.95,
        fields: {}
    };
}

async function processImportData(data, options) {
    const results = {
        status: 'success',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: []
    };

    // Process each record
    for (const record of data) {
        try {
            switch (options.importType) {
                case 'bookings':
                    await processBooking(record, options.companyId);
                    break;
                case 'tracking':
                    await processTrackingUpdate(record, options.companyId);
                    break;
                case 'invoices':
                    await processInvoice(record, options.companyId);
                    break;
                // Add more import types
            }
            results.recordsProcessed++;
        } catch (error) {
            results.errors.push({
                record: record,
                error: error.message
            });
        }
    }

    if (results.errors.length > 0) {
        results.status = 'partial';
    }

    return results;
}

async function generateExcelExport(companyId, options) {
    const data = await gatherExportData(companyId, options);
    const workbook = xlsx.utils.book_new();

    // Create sheets for different data types
    if (options.dataTypes.includes('shipments')) {
        const shipmentSheet = xlsx.utils.json_to_sheet(data.shipments);
        xlsx.utils.book_append_sheet(workbook, shipmentSheet, 'Shipments');
    }

    if (options.dataTypes.includes('tracking')) {
        const trackingSheet = xlsx.utils.json_to_sheet(data.tracking);
        xlsx.utils.book_append_sheet(workbook, trackingSheet, 'Tracking History');
    }

    if (options.dataTypes.includes('performance')) {
        const performanceSheet = xlsx.utils.json_to_sheet(data.performance);
        xlsx.utils.book_append_sheet(workbook, performanceSheet, 'Performance Metrics');
    }

    // Generate file
    const filename = `export_${companyId}_${Date.now()}.xlsx`;
    const filepath = path.join(__dirname, '../../exports', filename);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    xlsx.writeFile(workbook, filepath);
    
    return { filename, filepath };
}

async function generateCSVExport(companyId, options) {
    const data = await gatherExportData(companyId, options);
    const csvData = [];
    
    // Flatten data for CSV
    if (options.dataTypes.includes('shipments')) {
        data.shipments.forEach(shipment => {
            csvData.push({
                type: 'shipment',
                ...shipment
            });
        });
    }

    // Convert to CSV
    const csv = convertToCSV(csvData);
    const filename = `export_${companyId}_${Date.now()}.csv`;
    const filepath = path.join(__dirname, '../../exports', filename);
    
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, csv);
    
    return { filename, filepath };
}

async function generatePDFReport(companyId, options) {
    const data = await gatherExportData(companyId, options);
    const doc = new PDFDocument();
    
    const filename = `report_${companyId}_${Date.now()}.pdf`;
    const filepath = path.join(__dirname, '../../exports', filename);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    
    // Add content to PDF
    doc.fontSize(20).text('ROOTUIP Export Report', 50, 50);
    doc.fontSize(12).text(`Period: ${options.startDate} to ${options.endDate}`, 50, 80);
    
    // Add data sections
    let yPosition = 120;
    if (data.shipments) {
        doc.fontSize(16).text('Shipments Summary', 50, yPosition);
        yPosition += 30;
        doc.fontSize(10).text(`Total Shipments: ${data.shipments.length}`, 50, yPosition);
        yPosition += 20;
    }
    
    doc.end();
    
    return new Promise((resolve) => {
        stream.on('finish', () => {
            resolve({ filename, filepath });
        });
    });
}

async function gatherExportData(companyId, options) {
    const data = {};
    
    // Fetch data based on selected types
    if (options.dataTypes.includes('shipments')) {
        data.shipments = await getShipments(companyId, {
            startDate: options.startDate,
            endDate: options.endDate,
            filters: options.filters
        });
    }
    
    if (options.dataTypes.includes('tracking')) {
        data.tracking = await getTrackingHistory(companyId, {
            startDate: options.startDate,
            endDate: options.endDate
        });
    }
    
    if (options.dataTypes.includes('performance')) {
        data.performance = await getPerformanceMetrics(companyId, {
            startDate: options.startDate,
            endDate: options.endDate
        });
    }
    
    return data;
}

function convertToCSV(data) {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
        return headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') 
                ? `"${value}"` 
                : value;
        }).join(',');
    });
    
    return [csvHeaders, ...csvRows].join('\n');
}

// Database simulation functions (replace with actual DB queries)
async function getShipments(companyId, options) {
    // Simulated data
    return [
        {
            containerNumber: 'MAEU1234567',
            blNumber: 'BL123456789',
            origin: 'Shanghai',
            destination: 'Rotterdam',
            status: 'In Transit',
            eta: '2025-07-15'
        }
    ];
}

async function storeExport(exportFile, companyId) {
    const exportId = Date.now().toString();
    // Store export metadata in database
    return exportId;
}

async function getExport(exportId, companyId) {
    // Retrieve export from database
    return {
        filename: 'export.xlsx',
        filepath: '/path/to/export.xlsx'
    };
}

async function getDataTransferHistory(companyId, options) {
    // Fetch from database
    return {
        data: [],
        total: 0
    };
}

async function getTemplates(companyId) {
    // Fetch templates from database
    return [];
}

async function createTemplate(templateData) {
    // Save template to database
    return {
        id: Date.now().toString(),
        ...templateData
    };
}

async function getSchedules(companyId) {
    // Fetch schedules from database
    return [];
}

async function createSchedule(scheduleData) {
    // Save schedule to database
    return {
        id: Date.now().toString(),
        ...scheduleData,
        nextRun: calculateNextRun(scheduleData.frequency)
    };
}

function calculateNextRun(frequency) {
    const now = new Date();
    switch (frequency) {
        case 'daily':
            return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        case 'weekly':
            return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        case 'monthly':
            return new Date(now.setMonth(now.getMonth() + 1));
        default:
            return now;
    }
}

module.exports = router;