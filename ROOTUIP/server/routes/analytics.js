const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Initialize analytics database
const dbPath = path.join(__dirname, '../database/analytics.db');
const db = new sqlite3.Database(dbPath);

// Create analytics tables
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS page_views (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        page TEXT,
        title TEXT,
        referrer TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_agent TEXT
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        event_type TEXT,
        data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Track page view
router.post('/page-view', (req, res) => {
    const {
        session_id,
        page,
        title,
        referrer,
        user_agent
    } = req.body;
    
    const id = uuidv4();
    
    const stmt = db.prepare(`INSERT INTO page_views (
        id, session_id, page, title, referrer, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?)`);
    
    stmt.run([id, session_id, page, title, referrer, user_agent], (error) => {
        if (error) {
            console.error('Analytics error:', error);
            return res.status(500).json({ error: 'Failed to track page view' });
        }
        
        res.json({ success: true });
    });
    
    stmt.finalize();
});

// Track interaction
router.post('/interaction', (req, res) => {
    const {
        session_id,
        event_type,
        data
    } = req.body;
    
    const id = uuidv4();
    
    const stmt = db.prepare(`INSERT INTO interactions (
        id, session_id, event_type, data
    ) VALUES (?, ?, ?, ?)`);
    
    stmt.run([id, session_id, event_type, JSON.stringify(data)], (error) => {
        if (error) {
            console.error('Analytics error:', error);
            return res.status(500).json({ error: 'Failed to track interaction' });
        }
        
        res.json({ success: true });
    });
    
    stmt.finalize();
});

// Get analytics summary
router.get('/summary', (req, res) => {
    const timeframe = req.query.timeframe || '24h';
    
    let timeCondition = '';
    switch (timeframe) {
        case '1h':
            timeCondition = "AND timestamp > datetime('now', '-1 hour')";
            break;
        case '24h':
            timeCondition = "AND timestamp > datetime('now', '-1 day')";
            break;
        case '7d':
            timeCondition = "AND timestamp > datetime('now', '-7 days')";
            break;
        case '30d':
            timeCondition = "AND timestamp > datetime('now', '-30 days')";
            break;
    }
    
    // Get page views
    db.get(
        `SELECT COUNT(*) as total_views, COUNT(DISTINCT session_id) as unique_visitors 
         FROM page_views WHERE 1=1 ${timeCondition}`,
        (error, pageViewStats) => {
            if (error) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            // Get top pages
            db.all(
                `SELECT page, COUNT(*) as views 
                 FROM page_views WHERE 1=1 ${timeCondition}
                 GROUP BY page ORDER BY views DESC LIMIT 10`,
                (error, topPages) => {
                    if (error) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    // Get interactions
                    db.all(
                        `SELECT event_type, COUNT(*) as count
                         FROM interactions WHERE 1=1 ${timeCondition}
                         GROUP BY event_type ORDER BY count DESC`,
                        (error, interactions) => {
                            if (error) {
                                return res.status(500).json({ error: 'Database error' });
                            }
                            
                            res.json({
                                success: true,
                                timeframe,
                                summary: {
                                    totalViews: pageViewStats.total_views,
                                    uniqueVisitors: pageViewStats.unique_visitors,
                                    topPages,
                                    interactions
                                }
                            });
                        }
                    );
                }
            );
        }
    );
});

module.exports = router;