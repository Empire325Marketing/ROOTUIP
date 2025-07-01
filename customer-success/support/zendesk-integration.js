// ROOTUIP Support Infrastructure with Zendesk Integration
// Comprehensive support system with SLA tracking, escalation workflows, and knowledge base

const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class SupportInfrastructure {
    constructor() {
        this.app = express();
        this.port = process.env.SUPPORT_PORT || 3020;
        
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        // Zendesk configuration
        this.zendesk = {
            subdomain: process.env.ZENDESK_SUBDOMAIN || 'rootuip',
            username: process.env.ZENDESK_USERNAME,
            token: process.env.ZENDESK_API_TOKEN,
            baseUrl: `https://${process.env.ZENDESK_SUBDOMAIN || 'rootuip'}.zendesk.com/api/v2`
        };
        
        // SLA configuration for enterprise customers
        this.slaConfig = {
            priority: {
                urgent: {
                    firstResponseTime: 1, // hours
                    resolutionTime: 4,    // hours
                    escalationTime: 2     // hours
                },
                high: {
                    firstResponseTime: 2,
                    resolutionTime: 8,
                    escalationTime: 4
                },
                normal: {
                    firstResponseTime: 4,
                    resolutionTime: 24,
                    escalationTime: 8
                },
                low: {
                    firstResponseTime: 8,
                    resolutionTime: 72,
                    escalationTime: 24
                }
            },
            
            // Customer tier SLA modifiers
            customerTiers: {
                enterprise: { multiplier: 1.0 },    // Full SLA
                business: { multiplier: 1.5 },      // 50% longer
                standard: { multiplier: 2.0 }       // 100% longer
            }
        };
        
        // Escalation paths
        this.escalationPaths = {
            level1: ['support-tier1@rootuip.com'],
            level2: ['support-tier2@rootuip.com', 'support-manager@rootuip.com'],
            level3: ['support-director@rootuip.com', 'engineering-lead@rootuip.com'],
            executive: ['cto@rootuip.com', 'ceo@rootuip.com']
        };
        
        this.setupMiddleware();
        this.setupRoutes();
        this.initializeSupportSystem();
    }
    
    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            if (req.method === 'OPTIONS') return res.sendStatus(200);
            next();
        });
    }
    
    setupRoutes() {
        // Create support ticket
        this.app.post('/api/support/tickets', async (req, res) => {
            try {
                const ticket = await this.createTicket(req.body);
                res.json(ticket);
            } catch (error) {
                console.error('Ticket creation error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Get ticket details
        this.app.get('/api/support/tickets/:ticketId', async (req, res) => {
            try {
                const ticket = await this.getTicket(req.params.ticketId);
                res.json(ticket);
            } catch (error) {
                console.error('Ticket retrieval error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Update ticket
        this.app.put('/api/support/tickets/:ticketId', async (req, res) => {
            try {
                const ticket = await this.updateTicket(req.params.ticketId, req.body);
                res.json(ticket);
            } catch (error) {
                console.error('Ticket update error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // SLA status for customer
        this.app.get('/api/support/sla/:customerId', async (req, res) => {
            try {
                const slaStatus = await this.getSLAStatus(req.params.customerId);
                res.json(slaStatus);
            } catch (error) {
                console.error('SLA status error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Knowledge base search
        this.app.get('/api/support/kb/search', async (req, res) => {
            try {
                const results = await this.searchKnowledgeBase(req.query.q);
                res.json(results);
            } catch (error) {
                console.error('Knowledge base search error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Support metrics
        this.app.get('/api/support/metrics', async (req, res) => {
            try {
                const metrics = await this.getSupportMetrics();
                res.json(metrics);
            } catch (error) {
                console.error('Support metrics error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Escalation endpoint
        this.app.post('/api/support/escalate/:ticketId', async (req, res) => {
            try {
                const result = await this.escalateTicket(req.params.ticketId, req.body.reason);
                res.json(result);
            } catch (error) {
                console.error('Escalation error:', error);
                res.status(500).json({ error: error.message });
            }
        });
        
        // Webhook for Zendesk events
        this.app.post('/api/support/webhook', async (req, res) => {
            try {
                await this.handleZendeskWebhook(req.body);
                res.sendStatus(200);
            } catch (error) {
                console.error('Webhook error:', error);
                res.status(500).json({ error: error.message });
            }
        });
    }
    
    async createTicket(ticketData) {
        const {
            customerId,
            subject,
            description,
            priority = 'normal',
            category = 'general',
            requesterEmail,
            requesterName,
            attachments = []
        } = ticketData;
        
        // Get customer information for SLA determination
        const customer = await this.getCustomerInfo(customerId);
        
        // Calculate SLA times based on customer tier and priority
        const slaTerms = this.calculateSLA(priority, customer.tier);
        
        // Create ticket in Zendesk
        const zendeskTicket = await this.createZendeskTicket({
            subject,
            description,
            priority,
            requesterEmail,
            requesterName,
            customFields: {
                customer_id: customerId,
                customer_tier: customer.tier,
                category: category,
                sla_due_date: slaTerms.resolutionDue.toISOString()
            },
            tags: [
                `customer_${customer.tier}`,
                `priority_${priority}`,
                `category_${category}`,
                'rootuip_platform'
            ]
        });
        
        // Store ticket in local database
        const ticketId = uuidv4();
        await this.db.query(`
            INSERT INTO support_tickets 
            (id, zendesk_id, customer_id, subject, description, priority, category, 
             status, requester_email, requester_name, sla_first_response_due, 
             sla_resolution_due, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        `, [
            ticketId,
            zendeskTicket.id,
            customerId,
            subject,
            description,
            priority,
            category,
            'open',
            requesterEmail,
            requesterName,
            slaTerms.firstResponseDue,
            slaTerms.resolutionDue
        ]);
        
        // Schedule SLA monitoring
        await this.scheduleSLAMonitoring(ticketId);
        
        // Send confirmation to customer
        await this.sendTicketConfirmation(ticketId, requesterEmail);
        
        return {
            ticketId,
            zendeskId: zendeskTicket.id,
            status: 'created',
            sla: slaTerms,
            estimatedResolution: slaTerms.resolutionDue
        };
    }
    
    async createZendeskTicket(ticketData) {
        const ticket = {
            ticket: {
                subject: ticketData.subject,
                comment: {
                    body: ticketData.description
                },
                priority: ticketData.priority,
                type: 'incident',
                requester: {
                    name: ticketData.requesterName,
                    email: ticketData.requesterEmail
                },
                custom_fields: Object.entries(ticketData.customFields || {}).map(([key, value]) => ({
                    id: this.getCustomFieldId(key),
                    value: value
                })),
                tags: ticketData.tags || []
            }
        };
        
        const response = await this.zendeskRequest('POST', '/tickets.json', ticket);
        return response.data.ticket;
    }
    
    async getTicket(ticketId) {
        const ticketQuery = `
            SELECT t.*, c.company_name, c.tier as customer_tier
            FROM support_tickets t
            JOIN customers c ON t.customer_id = c.id
            WHERE t.id = $1
        `;
        const ticket = await this.db.query(ticketQuery, [ticketId]);
        
        if (!ticket.rows.length) {
            throw new Error('Ticket not found');
        }
        
        const ticketData = ticket.rows[0];
        
        // Get Zendesk ticket for latest status
        const zendeskTicket = await this.getZendeskTicket(ticketData.zendesk_id);
        
        // Get SLA status
        const slaStatus = await this.calculateTicketSLA(ticketData);
        
        // Get ticket history
        const history = await this.getTicketHistory(ticketId);
        
        return {
            ...ticketData,
            zendeskData: zendeskTicket,
            slaStatus,
            history,
            escalationPath: this.getEscalationPath(ticketData.escalation_level || 0)
        };
    }
    
    async updateTicket(ticketId, updates) {
        const { status, priority, assigneeId, resolution, internalNote } = updates;
        
        // Update local database
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        
        if (status) {
            updateFields.push(`status = $${paramIndex++}`);
            updateValues.push(status);
        }
        
        if (priority) {
            updateFields.push(`priority = $${paramIndex++}`);
            updateValues.push(priority);
        }
        
        if (assigneeId) {
            updateFields.push(`assignee_id = $${paramIndex++}`);
            updateValues.push(assigneeId);
        }
        
        if (resolution) {
            updateFields.push(`resolution = $${paramIndex++}, resolved_at = NOW()`);
            updateValues.push(resolution);
        }
        
        updateFields.push(`updated_at = NOW()`);
        updateValues.push(ticketId);
        
        await this.db.query(`
            UPDATE support_tickets 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramIndex}
        `, updateValues);
        
        // Update Zendesk ticket
        const ticket = await this.db.query('SELECT zendesk_id FROM support_tickets WHERE id = $1', [ticketId]);
        if (ticket.rows.length) {
            await this.updateZendeskTicket(ticket.rows[0].zendesk_id, updates);
        }
        
        // Log ticket update
        await this.logTicketUpdate(ticketId, updates);
        
        // Check if SLA breach
        await this.checkSLABreach(ticketId);
        
        return { success: true };
    }
    
    calculateSLA(priority, customerTier) {
        const baseSLA = this.slaConfig.priority[priority];
        const tierMultiplier = this.slaConfig.customerTiers[customerTier]?.multiplier || 2.0;
        
        const now = new Date();
        
        const firstResponseTime = baseSLA.firstResponseTime * tierMultiplier;
        const resolutionTime = baseSLA.resolutionTime * tierMultiplier;
        const escalationTime = baseSLA.escalationTime * tierMultiplier;
        
        return {
            firstResponseDue: new Date(now.getTime() + firstResponseTime * 60 * 60 * 1000),
            resolutionDue: new Date(now.getTime() + resolutionTime * 60 * 60 * 1000),
            escalationDue: new Date(now.getTime() + escalationTime * 60 * 60 * 1000),
            terms: {
                firstResponseTime: `${firstResponseTime} hours`,
                resolutionTime: `${resolutionTime} hours`,
                escalationTime: `${escalationTime} hours`
            }
        };
    }
    
    async getSLAStatus(customerId) {
        const query = `
            SELECT 
                priority,
                status,
                COUNT(*) as count,
                AVG(EXTRACT(EPOCH FROM (COALESCE(first_response_at, NOW()) - created_at))/3600) as avg_first_response_hours,
                AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at))/3600) as avg_resolution_hours,
                COUNT(CASE WHEN first_response_at > sla_first_response_due THEN 1 END) as first_response_breaches,
                COUNT(CASE WHEN resolved_at > sla_resolution_due THEN 1 END) as resolution_breaches
            FROM support_tickets
            WHERE customer_id = $1 
            AND created_at >= NOW() - INTERVAL '30 days'
            GROUP BY priority, status
        `;
        
        const results = await this.db.query(query, [customerId]);
        
        // Calculate overall SLA compliance
        const totalTickets = results.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
        const totalFirstResponseBreaches = results.rows.reduce((sum, row) => sum + parseInt(row.first_response_breaches), 0);
        const totalResolutionBreaches = results.rows.reduce((sum, row) => sum + parseInt(row.resolution_breaches), 0);
        
        const firstResponseCompliance = totalTickets > 0 ? 
            ((totalTickets - totalFirstResponseBreaches) / totalTickets * 100).toFixed(1) : 100;
        const resolutionCompliance = totalTickets > 0 ? 
            ((totalTickets - totalResolutionBreaches) / totalTickets * 100).toFixed(1) : 100;
        
        return {
            customerId,
            period: '30_days',
            overall: {
                totalTickets,
                firstResponseCompliance: parseFloat(firstResponseCompliance),
                resolutionCompliance: parseFloat(resolutionCompliance),
                avgFirstResponseHours: results.rows.length > 0 ? 
                    (results.rows.reduce((sum, row) => sum + parseFloat(row.avg_first_response_hours || 0), 0) / results.rows.length).toFixed(1) : 0,
                avgResolutionHours: results.rows.length > 0 ? 
                    (results.rows.reduce((sum, row) => sum + parseFloat(row.avg_resolution_hours || 0), 0) / results.rows.length).toFixed(1) : 0
            },
            breakdown: results.rows
        };
    }
    
    async searchKnowledgeBase(query) {
        // Search Zendesk Help Center
        const zendeskResults = await this.searchZendeskHelpCenter(query);
        
        // Search local knowledge base
        const localResults = await this.searchLocalKB(query);
        
        // Combine and rank results
        const combinedResults = [...zendeskResults, ...localResults];
        
        // Sort by relevance score
        combinedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
        
        return {
            query,
            totalResults: combinedResults.length,
            results: combinedResults.slice(0, 20), // Top 20 results
            categories: this.categorizeResults(combinedResults)
        };
    }
    
    async searchZendeskHelpCenter(query) {
        try {
            const response = await this.zendeskRequest('GET', `/help_center/articles/search.json?query=${encodeURIComponent(query)}`);
            
            return response.data.results.map(article => ({
                id: article.id,
                title: article.title,
                snippet: article.body ? article.body.substring(0, 200) + '...' : '',
                url: article.html_url,
                source: 'zendesk',
                category: article.section?.name || 'General',
                relevanceScore: article.score || 0.5,
                lastUpdated: article.updated_at
            }));
        } catch (error) {
            console.error('Zendesk search error:', error);
            return [];
        }
    }
    
    async searchLocalKB(query) {
        const searchQuery = `
            SELECT id, title, content, category, tags, created_at, updated_at,
                   ts_rank(search_vector, plainto_tsquery($1)) as rank
            FROM knowledge_base_articles
            WHERE search_vector @@ plainto_tsquery($1)
               OR title ILIKE $2
               OR content ILIKE $2
            ORDER BY rank DESC, updated_at DESC
            LIMIT 10
        `;
        
        const results = await this.db.query(searchQuery, [query, `%${query}%`]);
        
        return results.rows.map(article => ({
            id: article.id,
            title: article.title,
            snippet: article.content.substring(0, 200) + '...',
            url: `/knowledge-base/${article.id}`,
            source: 'local',
            category: article.category,
            relevanceScore: parseFloat(article.rank) || 0.3,
            lastUpdated: article.updated_at,
            tags: article.tags
        }));
    }
    
    async escalateTicket(ticketId, reason) {
        const ticket = await this.db.query('SELECT * FROM support_tickets WHERE id = $1', [ticketId]);
        
        if (!ticket.rows.length) {
            throw new Error('Ticket not found');
        }
        
        const ticketData = ticket.rows[0];
        const currentLevel = ticketData.escalation_level || 0;
        const newLevel = Math.min(currentLevel + 1, 3); // Max level 3 (executive)
        
        // Update escalation level
        await this.db.query(`
            UPDATE support_tickets 
            SET escalation_level = $1, escalated_at = NOW(), escalation_reason = $2
            WHERE id = $3
        `, [newLevel, reason, ticketId]);
        
        // Get escalation recipients
        const escalationLevel = ['level1', 'level2', 'level3', 'executive'][newLevel];
        const recipients = this.escalationPaths[escalationLevel];
        
        // Send escalation notification
        await this.sendEscalationNotification(ticketData, newLevel, reason, recipients);
        
        // Update Zendesk ticket
        await this.updateZendeskTicket(ticketData.zendesk_id, {
            priority: this.getEscalatedPriority(ticketData.priority),
            tags: [`escalated_level_${newLevel}`],
            comment: `Ticket escalated to Level ${newLevel}: ${reason}`
        });
        
        // Log escalation
        await this.logTicketUpdate(ticketId, {
            action: 'escalated',
            level: newLevel,
            reason: reason
        });
        
        return {
            success: true,
            newLevel,
            recipients,
            escalationLevel
        };
    }
    
    async getSupportMetrics() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Overall metrics
        const overallQuery = `
            SELECT 
                COUNT(*) as total_tickets,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
                COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
                COUNT(CASE WHEN first_response_at <= sla_first_response_due THEN 1 END) as sla_first_response_met,
                COUNT(CASE WHEN resolved_at <= sla_resolution_due THEN 1 END) as sla_resolution_met,
                AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/3600) as avg_first_response_hours,
                AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
            FROM support_tickets
            WHERE created_at >= $1
        `;
        const overall = await this.db.query(overallQuery, [thirtyDaysAgo]);
        
        // Priority breakdown
        const priorityQuery = `
            SELECT priority, COUNT(*) as count
            FROM support_tickets
            WHERE created_at >= $1
            GROUP BY priority
        `;
        const priorityBreakdown = await this.db.query(priorityQuery, [thirtyDaysAgo]);
        
        // Customer tier breakdown
        const tierQuery = `
            SELECT c.tier, COUNT(t.*) as ticket_count
            FROM support_tickets t
            JOIN customers c ON t.customer_id = c.id
            WHERE t.created_at >= $1
            GROUP BY c.tier
        `;
        const tierBreakdown = await this.db.query(tierQuery, [thirtyDaysAgo]);
        
        // Daily ticket volume
        const volumeQuery = `
            SELECT DATE(created_at) as date, COUNT(*) as tickets
            FROM support_tickets
            WHERE created_at >= $1
            GROUP BY DATE(created_at)
            ORDER BY date
        `;
        const dailyVolume = await this.db.query(volumeQuery, [thirtyDaysAgo]);
        
        const overallData = overall.rows[0] || {};
        
        return {
            period: '30_days',
            summary: {
                totalTickets: parseInt(overallData.total_tickets || 0),
                resolvedTickets: parseInt(overallData.resolved_tickets || 0),
                openTickets: parseInt(overallData.open_tickets || 0),
                resolutionRate: overallData.total_tickets > 0 ? 
                    (overallData.resolved_tickets / overallData.total_tickets * 100).toFixed(1) : 0,
                firstResponseSLA: overallData.total_tickets > 0 ? 
                    (overallData.sla_first_response_met / overallData.total_tickets * 100).toFixed(1) : 100,
                resolutionSLA: overallData.resolved_tickets > 0 ? 
                    (overallData.sla_resolution_met / overallData.resolved_tickets * 100).toFixed(1) : 100,
                avgFirstResponseHours: parseFloat(overallData.avg_first_response_hours || 0).toFixed(1),
                avgResolutionHours: parseFloat(overallData.avg_resolution_hours || 0).toFixed(1)
            },
            breakdown: {
                byPriority: priorityBreakdown.rows,
                byTier: tierBreakdown.rows
            },
            trends: {
                dailyVolume: dailyVolume.rows
            }
        };
    }
    
    async scheduleSLAMonitoring(ticketId) {
        // In production, use a job queue like Bull or Agenda
        const ticket = await this.db.query(`
            SELECT id, sla_first_response_due, sla_resolution_due, escalation_level
            FROM support_tickets WHERE id = $1
        `, [ticketId]);
        
        if (!ticket.rows.length) return;
        
        const ticketData = ticket.rows[0];
        
        // Schedule first response SLA check
        const firstResponseDelay = ticketData.sla_first_response_due.getTime() - Date.now();
        if (firstResponseDelay > 0) {
            setTimeout(() => this.checkFirstResponseSLA(ticketId), firstResponseDelay);
        }
        
        // Schedule resolution SLA check
        const resolutionDelay = ticketData.sla_resolution_due.getTime() - Date.now();
        if (resolutionDelay > 0) {
            setTimeout(() => this.checkResolutionSLA(ticketId), resolutionDelay);
        }
    }
    
    async checkFirstResponseSLA(ticketId) {
        const ticket = await this.db.query(`
            SELECT * FROM support_tickets 
            WHERE id = $1 AND first_response_at IS NULL
        `, [ticketId]);
        
        if (ticket.rows.length) {
            // SLA breach - first response
            await this.handleSLABreach(ticketId, 'first_response');
        }
    }
    
    async checkResolutionSLA(ticketId) {
        const ticket = await this.db.query(`
            SELECT * FROM support_tickets 
            WHERE id = $1 AND resolved_at IS NULL
        `, [ticketId]);
        
        if (ticket.rows.length) {
            // SLA breach - resolution
            await this.handleSLABreach(ticketId, 'resolution');
        }
    }
    
    async handleSLABreach(ticketId, breachType) {
        // Log SLA breach
        await this.db.query(`
            INSERT INTO sla_breaches (ticket_id, breach_type, breach_time, created_at)
            VALUES ($1, $2, NOW(), NOW())
        `, [ticketId, breachType]);
        
        // Auto-escalate
        await this.escalateTicket(ticketId, `SLA breach: ${breachType}`);
        
        // Send notifications
        await this.sendSLABreachNotification(ticketId, breachType);
    }
    
    async zendeskRequest(method, endpoint, data = null) {
        const config = {
            method,
            url: `${this.zendesk.baseUrl}${endpoint}`,
            auth: {
                username: `${this.zendesk.username}/token`,
                password: this.zendesk.token
            },
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (data) {
            config.data = data;
        }
        
        return await axios(config);
    }
    
    getCustomFieldId(fieldName) {
        // Map field names to Zendesk custom field IDs
        const fieldMap = {
            customer_id: '360000000001',
            customer_tier: '360000000002',
            category: '360000000003',
            sla_due_date: '360000000004'
        };
        
        return fieldMap[fieldName];
    }
    
    async initializeSupportSystem() {
        console.log('Support Infrastructure initialized');
        
        // Schedule periodic SLA monitoring
        setInterval(() => this.monitorSLAs(), 300000); // Every 5 minutes
        
        // Schedule metrics aggregation
        setInterval(() => this.aggregateMetrics(), 3600000); // Every hour
        
        // Start API server
        this.app.listen(this.port, () => {
            console.log(`Support Infrastructure running on port ${this.port}`);
        });
    }
    
    async monitorSLAs() {
        console.log('Monitoring SLA compliance...');
        
        // Check for upcoming SLA breaches (within 30 minutes)
        const upcomingBreaches = await this.db.query(`
            SELECT id, subject, priority, customer_id, sla_first_response_due, sla_resolution_due
            FROM support_tickets
            WHERE status != 'resolved'
            AND (
                (first_response_at IS NULL AND sla_first_response_due <= NOW() + INTERVAL '30 minutes')
                OR
                (resolved_at IS NULL AND sla_resolution_due <= NOW() + INTERVAL '30 minutes')
            )
        `);
        
        // Send warnings for upcoming breaches
        for (const ticket of upcomingBreaches.rows) {
            await this.sendSLAWarning(ticket.id);
        }
    }
    
    async aggregateMetrics() {
        console.log('Aggregating support metrics...');
        
        const metrics = await this.getSupportMetrics();
        
        // Store aggregated metrics
        await this.db.query(`
            INSERT INTO support_metrics_daily 
            (date, total_tickets, resolved_tickets, first_response_sla, resolution_sla, created_at)
            VALUES (CURRENT_DATE, $1, $2, $3, $4, NOW())
            ON CONFLICT (date) DO UPDATE SET
                total_tickets = EXCLUDED.total_tickets,
                resolved_tickets = EXCLUDED.resolved_tickets,
                first_response_sla = EXCLUDED.first_response_sla,
                resolution_sla = EXCLUDED.resolution_sla,
                updated_at = NOW()
        `, [
            metrics.summary.totalTickets,
            metrics.summary.resolvedTickets,
            metrics.summary.firstResponseSLA,
            metrics.summary.resolutionSLA
        ]);
    }
}

module.exports = SupportInfrastructure;

// Start the system if run directly
if (require.main === module) {
    new SupportInfrastructure();
}