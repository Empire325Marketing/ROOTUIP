const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Initialize SQLite database
const dbPath = path.join(__dirname, '../database/leads.db');
const db = new sqlite3.Database(dbPath);

// Create tables if they don't exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        company TEXT,
        name TEXT,
        phone TEXT,
        source TEXT,
        lead_score INTEGER DEFAULT 0,
        assessment_data TEXT,
        roi_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS lead_interactions (
        id TEXT PRIMARY KEY,
        lead_id TEXT,
        interaction_type TEXT,
        data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (lead_id) REFERENCES leads (id)
    )`);
});

// Calculate lead score based on assessment data
function calculateLeadScore(assessmentData) {
    let score = 0;
    
    if (!assessmentData) return score;
    
    try {
        const data = typeof assessmentData === 'string' ? JSON.parse(assessmentData) : assessmentData;
        
        // Company size scoring (0-25 points)
        const shipmentVolume = data.shipment_volume;
        if (shipmentVolume === '1000+') score += 25;
        else if (shipmentVolume === '500-1000') score += 20;
        else if (shipmentVolume === '100-500') score += 15;
        else if (shipmentVolume === '50-100') score += 10;
        else score += 5;
        
        // Urgency scoring (0-25 points)
        const timeline = data.timeline;
        if (timeline === 'immediate') score += 25;
        else if (timeline === 'next_quarter') score += 20;
        else if (timeline === 'next_6_months') score += 15;
        else if (timeline === 'next_year') score += 10;
        else score += 5;
        
        // Budget scoring (0-25 points)
        if (data.budget_allocated === 'yes') score += 25;
        else if (data.budget_allocated === 'planning') score += 15;
        else score += 5;
        
        // Pain points scoring (0-25 points)
        const manualPercentage = parseInt(data.manual_percentage) || 50;
        score += Math.floor((100 - manualPercentage) / 4); // Max 25 points
        
    } catch (error) {
        console.error('Error calculating lead score:', error);
    }
    
    return Math.min(score, 100); // Cap at 100
}

// Lead capture endpoint
router.post('/capture', (req, res) => {
    const leadId = uuidv4();
    const {
        email,
        company,
        name,
        phone,
        source = 'website',
        assessmentData,
        roiData
    } = req.body;
    
    if (!email) {
        return res.status(400).json({
            error: 'Email is required'
        });
    }
    
    // Calculate lead score
    const leadScore = calculateLeadScore(assessmentData);
    
    // Insert lead into database
    const stmt = db.prepare(`INSERT INTO leads (
        id, email, company, name, phone, source, lead_score, assessment_data, roi_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    
    stmt.run([
        leadId,
        email,
        company || null,
        name || null,
        phone || null,
        source,
        leadScore,
        assessmentData ? JSON.stringify(assessmentData) : null,
        roiData ? JSON.stringify(roiData) : null
    ], function(error) {
        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({
                error: 'Failed to save lead'
            });
        }
        
        // Send real-time notification
        if (global.broadcastToClients) {
            global.broadcastToClients({
                type: 'new_lead',
                data: {
                    leadId,
                    email,
                    company,
                    leadScore,
                    source,
                    timestamp: new Date().toISOString()
                }
            });
        }
        
        res.json({
            success: true,
            leadId,
            leadScore,
            message: 'Lead captured successfully'
        });
    });
    
    stmt.finalize();
});

// ROI calculation endpoint
router.post('/roi-calculate', (req, res) => {
    const {
        monthlyShipments,
        avgDetentionCost,
        manualHours,
        hourlyRate,
        email,
        company
    } = req.body;
    
    // Calculate ROI
    const monthlyDetentionCosts = monthlyShipments * avgDetentionCost;
    const monthlyLaborCosts = manualHours * hourlyRate * monthlyShipments;
    const totalMonthlyCosts = monthlyDetentionCosts + monthlyLaborCosts;
    
    const annualCosts = totalMonthlyCosts * 12;
    const potentialSavings = annualCosts * 0.94; // 94% reduction
    const roiPercent = ((potentialSavings - 50000) / 50000) * 100; // Assuming $50k implementation cost
    
    const roiData = {
        inputs: {
            monthlyShipments,
            avgDetentionCost,
            manualHours,
            hourlyRate
        },
        calculations: {
            monthlyDetentionCosts,
            monthlyLaborCosts,
            totalMonthlyCosts,
            annualCosts,
            potentialSavings,
            roiPercent,
            paybackMonths: Math.ceil(50000 / (potentialSavings / 12))
        },
        timestamp: new Date().toISOString()
    };
    
    // Capture lead if email provided
    if (email) {
        const leadId = uuidv4();
        const leadScore = calculateROILeadScore(roiData);
        
        const stmt = db.prepare(`INSERT INTO leads (
            id, email, company, source, lead_score, roi_data
        ) VALUES (?, ?, ?, ?, ?, ?)`);
        
        stmt.run([
            leadId,
            email,
            company || null,
            'roi_calculator',
            leadScore,
            JSON.stringify(roiData)
        ]);
        
        stmt.finalize();
    }
    
    res.json({
        success: true,
        roiData
    });
});

function calculateROILeadScore(roiData) {
    let score = 50; // Base score
    
    if (roiData.calculations.potentialSavings > 1000000) score += 30;
    else if (roiData.calculations.potentialSavings > 500000) score += 20;
    else if (roiData.calculations.potentialSavings > 100000) score += 10;
    
    if (roiData.calculations.paybackMonths < 6) score += 20;
    else if (roiData.calculations.paybackMonths < 12) score += 10;
    
    return Math.min(score, 100);
}

// Get lead by ID
router.get('/:leadId', (req, res) => {
    const { leadId } = req.params;
    
    db.get('SELECT * FROM leads WHERE id = ?', [leadId], (error, row) => {
        if (error) {
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!row) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        
        res.json({
            success: true,
            lead: row
        });
    });
});

// Get all leads (admin endpoint)
router.get('/', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    db.all(
        'SELECT * FROM leads ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset],
        (error, rows) => {
            if (error) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({
                success: true,
                leads: rows,
                count: rows.length
            });
        }
    );
});

module.exports = router;