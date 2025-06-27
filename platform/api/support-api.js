// ROOTUIP Support System API
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// In-memory storage (replace with database in production)
const tickets = new Map();
const articles = new Map();
const ticketComments = new Map();

// Initialize with sample data
function initializeSampleData() {
    // Sample tickets
    const sampleTickets = [
        {
            id: 'TKT-2024-001',
            companyId: 'ACME001',
            userId: 'user123',
            subject: 'Unable to download tracking report',
            category: 'technical',
            priority: 'medium',
            status: 'open',
            description: 'Getting error when trying to export tracking data for last month',
            shipmentId: null,
            created: new Date('2025-06-26T10:30:00'),
            updated: new Date('2025-06-26T14:45:00'),
            assignedTo: 'support-agent-1',
            tags: ['export', 'error', 'tracking']
        },
        {
            id: 'TKT-2024-002',
            companyId: 'ACME001',
            userId: 'user456',
            subject: 'Invoice discrepancy for May shipments',
            category: 'billing',
            priority: 'high',
            status: 'in-progress',
            description: 'Several charges appear to be duplicated on the May invoice',
            shipmentId: 'MAEU1234567',
            created: new Date('2025-06-25T09:15:00'),
            updated: new Date('2025-06-26T11:20:00'),
            assignedTo: 'billing-specialist-1',
            tags: ['invoice', 'billing', 'duplicate-charge']
        }
    ];

    sampleTickets.forEach(ticket => {
        tickets.set(ticket.id, ticket);
    });

    // Sample knowledge base articles
    const sampleArticles = [
        {
            id: 'kb-001',
            title: 'Quick Start Guide',
            slug: 'quick-start',
            category: 'getting-started',
            content: 'Welcome to ROOTUIP! This guide will help you get started...',
            views: 1523,
            helpful: 142,
            notHelpful: 8,
            tags: ['onboarding', 'setup', 'quickstart'],
            created: new Date('2025-01-15'),
            updated: new Date('2025-06-01')
        },
        {
            id: 'kb-002',
            title: 'Understanding D&D Risk Scores',
            slug: 'dd-risk-scores',
            category: 'shipment-management',
            content: 'Our AI-powered D&D risk scoring system helps you prevent detention and demurrage charges...',
            views: 892,
            helpful: 87,
            notHelpful: 3,
            tags: ['d&d', 'risk', 'ai', 'prevention'],
            created: new Date('2025-02-01'),
            updated: new Date('2025-06-15')
        }
    ];

    sampleArticles.forEach(article => {
        articles.set(article.id, article);
    });
}

// Initialize sample data
initializeSampleData();

// Middleware to check authentication
const requireAuth = (req, res, next) => {
    // In production, verify JWT token
    if (!req.headers.authorization) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Mock user data
    req.user = {
        id: 'user123',
        companyId: 'ACME001',
        role: 'admin'
    };
    
    next();
};

// Get all tickets for a company
router.get('/tickets', requireAuth, (req, res) => {
    try {
        const { status, priority, category, page = 1, limit = 20 } = req.query;
        
        // Filter tickets by company
        let companyTickets = Array.from(tickets.values())
            .filter(ticket => ticket.companyId === req.user.companyId);
        
        // Apply filters
        if (status) {
            companyTickets = companyTickets.filter(t => t.status === status);
        }
        if (priority) {
            companyTickets = companyTickets.filter(t => t.priority === priority);
        }
        if (category) {
            companyTickets = companyTickets.filter(t => t.category === category);
        }
        
        // Sort by updated date (newest first)
        companyTickets.sort((a, b) => b.updated - a.updated);
        
        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedTickets = companyTickets.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            tickets: paginatedTickets,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: companyTickets.length,
                pages: Math.ceil(companyTickets.length / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single ticket
router.get('/tickets/:ticketId', requireAuth, (req, res) => {
    try {
        const ticket = tickets.get(req.params.ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        // Check if user has access to this ticket
        if (ticket.companyId !== req.user.companyId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Get comments for this ticket
        const comments = ticketComments.get(ticket.id) || [];
        
        res.json({
            success: true,
            ticket: {
                ...ticket,
                comments: comments
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new ticket
router.post('/tickets', requireAuth, (req, res) => {
    try {
        const {
            subject,
            category,
            priority,
            description,
            shipmentId
        } = req.body;
        
        // Validate required fields
        if (!subject || !category || !priority || !description) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Generate ticket ID
        const ticketCount = Array.from(tickets.values())
            .filter(t => t.created.getFullYear() === new Date().getFullYear())
            .length;
        const ticketId = `TKT-${new Date().getFullYear()}-${String(ticketCount + 1).padStart(3, '0')}`;
        
        // Create ticket
        const newTicket = {
            id: ticketId,
            companyId: req.user.companyId,
            userId: req.user.id,
            subject,
            category,
            priority,
            status: 'open',
            description,
            shipmentId: shipmentId || null,
            created: new Date(),
            updated: new Date(),
            assignedTo: null,
            tags: []
        };
        
        tickets.set(ticketId, newTicket);
        
        // Auto-assign based on category
        autoAssignTicket(newTicket);
        
        // Send notification (in production)
        // await sendTicketNotification(newTicket);
        
        res.json({
            success: true,
            ticket: newTicket,
            message: 'Ticket created successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update ticket
router.put('/tickets/:ticketId', requireAuth, (req, res) => {
    try {
        const ticket = tickets.get(req.params.ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        if (ticket.companyId !== req.user.companyId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const { status, priority } = req.body;
        
        // Update allowed fields
        if (status) ticket.status = status;
        if (priority) ticket.priority = priority;
        ticket.updated = new Date();
        
        tickets.set(ticket.id, ticket);
        
        res.json({
            success: true,
            ticket: ticket
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add comment to ticket
router.post('/tickets/:ticketId/comments', requireAuth, (req, res) => {
    try {
        const ticket = tickets.get(req.params.ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        if (ticket.companyId !== req.user.companyId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const { message, isInternal = false } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        // Get existing comments
        const comments = ticketComments.get(ticket.id) || [];
        
        // Add new comment
        const newComment = {
            id: crypto.randomBytes(16).toString('hex'),
            ticketId: ticket.id,
            userId: req.user.id,
            userName: 'Current User', // In production, get from user data
            message,
            isInternal,
            created: new Date()
        };
        
        comments.push(newComment);
        ticketComments.set(ticket.id, comments);
        
        // Update ticket
        ticket.updated = new Date();
        tickets.set(ticket.id, ticket);
        
        res.json({
            success: true,
            comment: newComment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search knowledge base
router.get('/knowledge/search', (req, res) => {
    try {
        const { q, category, limit = 10 } = req.query;
        
        let results = Array.from(articles.values());
        
        // Filter by category
        if (category) {
            results = results.filter(article => article.category === category);
        }
        
        // Search by query
        if (q) {
            const query = q.toLowerCase();
            results = results.filter(article => 
                article.title.toLowerCase().includes(query) ||
                article.content.toLowerCase().includes(query) ||
                article.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }
        
        // Sort by relevance (views for now)
        results.sort((a, b) => b.views - a.views);
        
        // Limit results
        results = results.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            articles: results,
            total: results.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get knowledge base categories
router.get('/knowledge/categories', (req, res) => {
    try {
        const categories = [
            {
                id: 'getting-started',
                name: 'Getting Started',
                icon: '🚀',
                articleCount: 12
            },
            {
                id: 'shipment-management',
                name: 'Shipment Management',
                icon: '📦',
                articleCount: 18
            },
            {
                id: 'integrations-api',
                name: 'Integrations & API',
                icon: '🔌',
                articleCount: 15
            },
            {
                id: 'billing-payments',
                name: 'Billing & Payments',
                icon: '💳',
                articleCount: 8
            },
            {
                id: 'reports-analytics',
                name: 'Reports & Analytics',
                icon: '📊',
                articleCount: 10
            },
            {
                id: 'troubleshooting',
                name: 'Troubleshooting',
                icon: '🔧',
                articleCount: 22
            }
        ];
        
        res.json({
            success: true,
            categories: categories
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single article
router.get('/knowledge/articles/:slug', (req, res) => {
    try {
        const article = Array.from(articles.values())
            .find(a => a.slug === req.params.slug);
        
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        
        // Increment view count
        article.views++;
        articles.set(article.id, article);
        
        res.json({
            success: true,
            article: article
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rate article
router.post('/knowledge/articles/:slug/rate', (req, res) => {
    try {
        const article = Array.from(articles.values())
            .find(a => a.slug === req.params.slug);
        
        if (!article) {
            return res.status(404).json({ error: 'Article not found' });
        }
        
        const { helpful } = req.body;
        
        if (helpful) {
            article.helpful++;
        } else {
            article.notHelpful++;
        }
        
        articles.set(article.id, article);
        
        res.json({
            success: true,
            message: 'Thank you for your feedback'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get support metrics
router.get('/metrics', requireAuth, (req, res) => {
    try {
        const companyTickets = Array.from(tickets.values())
            .filter(ticket => ticket.companyId === req.user.companyId);
        
        const metrics = {
            totalTickets: companyTickets.length,
            openTickets: companyTickets.filter(t => t.status === 'open').length,
            inProgressTickets: companyTickets.filter(t => t.status === 'in-progress').length,
            resolvedTickets: companyTickets.filter(t => t.status === 'resolved').length,
            avgResponseTime: '2.4 hours',
            avgResolutionTime: '18.6 hours',
            satisfactionScore: 4.7,
            ticketsByCategory: {
                technical: companyTickets.filter(t => t.category === 'technical').length,
                billing: companyTickets.filter(t => t.category === 'billing').length,
                tracking: companyTickets.filter(t => t.category === 'tracking').length,
                integration: companyTickets.filter(t => t.category === 'integration').length,
                other: companyTickets.filter(t => t.category === 'other').length
            }
        };
        
        res.json({
            success: true,
            metrics: metrics
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to auto-assign tickets
function autoAssignTicket(ticket) {
    const assignmentRules = {
        technical: ['tech-support-1', 'tech-support-2'],
        billing: ['billing-specialist-1'],
        tracking: ['ops-support-1', 'ops-support-2'],
        integration: ['api-specialist-1'],
        other: ['general-support-1']
    };
    
    const agents = assignmentRules[ticket.category] || assignmentRules.other;
    ticket.assignedTo = agents[Math.floor(Math.random() * agents.length)];
}

module.exports = router;