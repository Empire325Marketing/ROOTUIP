/**
 * ROOTUIP Enterprise Customer Support System
 * Intercom integration with knowledge base and SLA tracking
 */

const express = require('express');
const { Pool } = require('pg');
const axios = require('axios');
const EventEmitter = require('events');

class CustomerSupportSystem extends EventEmitter {
    constructor(config = {}) {
        super();
        
        // Intercom configuration
        this.intercom = {
            accessToken: process.env.INTERCOM_ACCESS_TOKEN || config.intercomToken,
            appId: process.env.INTERCOM_APP_ID || config.intercomAppId,
            apiBase: 'https://api.intercom.io'
        };
        
        // Database connection
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL || 'postgresql://localhost/rootuip_support',
            max: 10
        });
        
        // Support tiers and SLAs
        this.supportTiers = {
            enterprise: {
                name: 'Enterprise',
                firstResponseSLA: 60, // minutes
                resolutionSLA: 240, // 4 hours
                priority: 'urgent',
                features: ['24/7 support', 'dedicated success manager', 'phone support']
            },
            professional: {
                name: 'Professional',
                firstResponseSLA: 240, // 4 hours
                resolutionSLA: 1440, // 24 hours
                priority: 'high',
                features: ['business hours support', 'priority queue', 'video calls']
            },
            standard: {
                name: 'Standard',
                firstResponseSLA: 1440, // 24 hours
                resolutionSLA: 2880, // 48 hours
                priority: 'normal',
                features: ['email support', 'knowledge base access']
            }
        };
        
        // Ticket categories
        this.categories = {
            technical: {
                name: 'Technical Issue',
                team: 'engineering',
                urgencyWeight: 1.5
            },
            integration: {
                name: 'Integration Support',
                team: 'engineering',
                urgencyWeight: 1.3
            },
            billing: {
                name: 'Billing & Account',
                team: 'finance',
                urgencyWeight: 1.0
            },
            feature_request: {
                name: 'Feature Request',
                team: 'product',
                urgencyWeight: 0.7
            },
            training: {
                name: 'Training & Onboarding',
                team: 'success',
                urgencyWeight: 0.8
            },
            performance: {
                name: 'Performance Issue',
                team: 'engineering',
                urgencyWeight: 1.7
            }
        };
        
        // Initialize support system
        this.initializeSupport();
    }

    async initializeSupport() {
        // Create database schema
        await this.createSchema();
        
        // Set up webhook listeners
        this.setupWebhooks();
        
        // Start SLA monitoring
        this.startSLAMonitoring();
        
        // Initialize knowledge base
        await this.initializeKnowledgeBase();
        
        console.log('Customer support system initialized');
    }

    // Intercom integration
    async createOrUpdateUser(userData) {
        try {
            const intercomUser = {
                user_id: userData.userId,
                email: userData.email,
                name: userData.name,
                companies: [{
                    company_id: userData.companyId,
                    name: userData.company,
                    custom_attributes: {
                        fleet_size: userData.fleet_size,
                        support_tier: userData.support_tier || 'standard',
                        mrr: userData.mrr,
                        health_score: userData.health_score
                    }
                }],
                custom_attributes: {
                    support_tier: userData.support_tier || 'standard',
                    onboarding_status: userData.onboarding_status,
                    last_login: userData.last_login,
                    features_used: userData.features_used
                }
            };
            
            const response = await axios.post(
                `${this.intercom.apiBase}/users`,
                intercomUser,
                {
                    headers: {
                        'Authorization': `Bearer ${this.intercom.accessToken}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            // Store Intercom ID
            await this.db.query(
                'UPDATE users SET intercom_id = $1 WHERE id = $2',
                [response.data.id, userData.userId]
            );
            
            return response.data;
            
        } catch (error) {
            console.error('Intercom user sync error:', error);
            throw error;
        }
    }

    async createTicket(ticketData) {
        try {
            // Determine priority and SLA
            const tier = await this.getUserTier(ticketData.userId);
            const category = this.categories[ticketData.category] || this.categories.technical;
            const sla = this.supportTiers[tier];
            
            // Calculate urgency score
            const urgencyScore = this.calculateUrgencyScore(ticketData, tier, category);
            
            // Create Intercom conversation
            const conversation = await this.createIntercomConversation({
                from: {
                    type: 'user',
                    id: ticketData.intercomUserId || ticketData.userId
                },
                body: ticketData.message,
                custom_attributes: {
                    category: ticketData.category,
                    priority: this.determinePriority(urgencyScore),
                    sla_first_response: sla.firstResponseSLA,
                    sla_resolution: sla.resolutionSLA,
                    urgency_score: urgencyScore
                }
            });
            
            // Store ticket in database
            const ticket = await this.db.query(`
                INSERT INTO support_tickets (
                    user_id, conversation_id, category, priority,
                    subject, message, status, tier, urgency_score,
                    sla_first_response, sla_resolution, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
                RETURNING *
            `, [
                ticketData.userId,
                conversation.id,
                ticketData.category,
                this.determinePriority(urgencyScore),
                ticketData.subject,
                ticketData.message,
                'open',
                tier,
                urgencyScore,
                sla.firstResponseSLA,
                sla.resolutionSLA
            ]);
            
            // Auto-assign to team
            await this.assignTicket(ticket.rows[0]);
            
            // Set up SLA tracking
            await this.trackSLA(ticket.rows[0]);
            
            // Check for auto-responses
            await this.checkAutoResponse(ticket.rows[0]);
            
            this.emit('ticket:created', ticket.rows[0]);
            
            return ticket.rows[0];
            
        } catch (error) {
            console.error('Ticket creation error:', error);
            throw error;
        }
    }

    async createIntercomConversation(data) {
        const response = await axios.post(
            `${this.intercom.apiBase}/conversations`,
            data,
            {
                headers: {
                    'Authorization': `Bearer ${this.intercom.accessToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return response.data;
    }

    calculateUrgencyScore(ticketData, tier, category) {
        let score = 0;
        
        // Tier weight (Enterprise = 3, Professional = 2, Standard = 1)
        const tierWeight = tier === 'enterprise' ? 3 : tier === 'professional' ? 2 : 1;
        score += tierWeight * 30;
        
        // Category weight
        score += category.urgencyWeight * 20;
        
        // Customer health score impact
        if (ticketData.health_score < 50) score += 20;
        else if (ticketData.health_score < 70) score += 10;
        
        // Revenue impact
        if (ticketData.mrr > 10000) score += 15;
        else if (ticketData.mrr > 5000) score += 10;
        else if (ticketData.mrr > 1000) score += 5;
        
        // Keywords in message
        const urgentKeywords = ['down', 'broken', 'urgent', 'asap', 'critical', 'stopped working'];
        const messageLC = (ticketData.message || '').toLowerCase();
        if (urgentKeywords.some(keyword => messageLC.includes(keyword))) {
            score += 15;
        }
        
        // Time since last ticket
        if (ticketData.lastTicketDays && ticketData.lastTicketDays < 7) {
            score += 10; // Recurring issue
        }
        
        return Math.min(100, score);
    }

    determinePriority(urgencyScore) {
        if (urgencyScore >= 80) return 'urgent';
        if (urgencyScore >= 60) return 'high';
        if (urgencyScore >= 40) return 'normal';
        return 'low';
    }

    async assignTicket(ticket) {
        try {
            // Get available agents for the team
            const team = this.categories[ticket.category]?.team || 'support';
            const agent = await this.getAvailableAgent(team, ticket.priority);
            
            if (agent) {
                // Assign in Intercom
                await axios.put(
                    `${this.intercom.apiBase}/conversations/${ticket.conversation_id}`,
                    {
                        assignee_id: agent.intercom_id,
                        custom_attributes: {
                            assigned_team: team,
                            assigned_at: new Date().toISOString()
                        }
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.intercom.accessToken}`,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    }
                );
                
                // Update database
                await this.db.query(
                    'UPDATE support_tickets SET assigned_to = $1, assigned_at = NOW() WHERE id = $2',
                    [agent.id, ticket.id]
                );
                
                // Notify agent
                await this.notifyAgent(agent, ticket);
            }
            
        } catch (error) {
            console.error('Ticket assignment error:', error);
        }
    }

    async getAvailableAgent(team, priority) {
        // Get agents ordered by availability and skill match
        const agents = await this.db.query(`
            SELECT 
                a.*,
                COUNT(t.id) as active_tickets,
                AVG(t.urgency_score) as avg_urgency
            FROM support_agents a
            LEFT JOIN support_tickets t ON a.id = t.assigned_to 
                AND t.status NOT IN ('closed', 'resolved')
            WHERE a.team = $1 
                AND a.status = 'available'
                AND a.skill_level >= $2
            GROUP BY a.id
            ORDER BY 
                active_tickets ASC,
                a.skill_level DESC,
                avg_urgency ASC
            LIMIT 1
        `, [team, priority === 'urgent' ? 3 : priority === 'high' ? 2 : 1]);
        
        return agents.rows[0];
    }

    // SLA management
    async trackSLA(ticket) {
        // Schedule first response check
        const firstResponseDeadline = new Date(
            Date.now() + ticket.sla_first_response * 60000
        );
        
        await this.db.query(`
            INSERT INTO sla_tracking (
                ticket_id, type, deadline, status
            ) VALUES ($1, 'first_response', $2, 'pending')
        `, [ticket.id, firstResponseDeadline]);
        
        // Schedule resolution check
        const resolutionDeadline = new Date(
            Date.now() + ticket.sla_resolution * 60000
        );
        
        await this.db.query(`
            INSERT INTO sla_tracking (
                ticket_id, type, deadline, status
            ) VALUES ($1, 'resolution', $2, 'pending')
        `, [ticket.id, resolutionDeadline]);
    }

    startSLAMonitoring() {
        // Check SLAs every minute
        setInterval(async () => {
            await this.checkSLABreaches();
        }, 60000);
    }

    async checkSLABreaches() {
        try {
            // Find approaching or breached SLAs
            const breaches = await this.db.query(`
                SELECT 
                    st.*,
                    t.*,
                    u.name as user_name,
                    u.company,
                    EXTRACT(EPOCH FROM (st.deadline - NOW())) / 60 as minutes_remaining
                FROM sla_tracking st
                JOIN support_tickets t ON st.ticket_id = t.id
                JOIN users u ON t.user_id = u.id
                WHERE st.status = 'pending'
                    AND st.deadline < NOW() + INTERVAL '30 minutes'
            `);
            
            for (const breach of breaches.rows) {
                if (breach.minutes_remaining <= 0) {
                    // SLA breached
                    await this.handleSLABreach(breach);
                } else if (breach.minutes_remaining <= 15) {
                    // SLA warning
                    await this.handleSLAWarning(breach);
                }
            }
            
        } catch (error) {
            console.error('SLA monitoring error:', error);
        }
    }

    async handleSLABreach(breach) {
        // Update SLA status
        await this.db.query(
            'UPDATE sla_tracking SET status = $1, breached_at = NOW() WHERE id = $2',
            ['breached', breach.id]
        );
        
        // Escalate ticket
        await this.escalateTicket(breach.ticket_id, 'sla_breach');
        
        // Notify management
        this.emit('sla:breached', {
            ticket: breach,
            type: breach.type,
            breachedBy: Math.abs(breach.minutes_remaining)
        });
        
        // Log for reporting
        await this.db.query(`
            INSERT INTO sla_breach_log (
                ticket_id, breach_type, breach_minutes, tier, category
            ) VALUES ($1, $2, $3, $4, $5)
        `, [
            breach.ticket_id,
            breach.type,
            Math.abs(breach.minutes_remaining),
            breach.tier,
            breach.category
        ]);
    }

    async handleSLAWarning(breach) {
        // Notify assigned agent
        if (breach.assigned_to) {
            await this.notifyAgent(
                { id: breach.assigned_to },
                breach,
                `SLA Warning: ${breach.minutes_remaining} minutes remaining`
            );
        }
        
        this.emit('sla:warning', {
            ticket: breach,
            minutesRemaining: breach.minutes_remaining
        });
    }

    async escalateTicket(ticketId, reason) {
        const ticket = await this.db.query(
            'SELECT * FROM support_tickets WHERE id = $1',
            [ticketId]
        );
        
        if (ticket.rows[0]) {
            // Update priority
            const newPriority = this.getEscalatedPriority(ticket.rows[0].priority);
            
            await this.db.query(`
                UPDATE support_tickets 
                SET priority = $1, escalated = true, escalation_reason = $2
                WHERE id = $3
            `, [newPriority, reason, ticketId]);
            
            // Reassign to senior agent
            const seniorAgent = await this.getAvailableAgent(
                this.categories[ticket.rows[0].category].team,
                'urgent'
            );
            
            if (seniorAgent) {
                await this.assignTicket({ ...ticket.rows[0], priority: newPriority });
            }
            
            // Add escalation note to Intercom
            await this.addIntercomNote(
                ticket.rows[0].conversation_id,
                `Ticket escalated due to: ${reason}. New priority: ${newPriority}`
            );
        }
    }

    getEscalatedPriority(currentPriority) {
        const escalation = {
            'low': 'normal',
            'normal': 'high',
            'high': 'urgent',
            'urgent': 'urgent'
        };
        
        return escalation[currentPriority] || 'high';
    }

    // Knowledge base
    async initializeKnowledgeBase() {
        // Create default articles
        const articles = [
            {
                title: 'Getting Started with ROOTUIP',
                category: 'onboarding',
                content: 'Complete guide to setting up your ROOTUIP platform...',
                keywords: ['setup', 'getting started', 'onboarding']
            },
            {
                title: 'API Integration Guide',
                category: 'technical',
                content: 'How to integrate ROOTUIP with your existing systems...',
                keywords: ['api', 'integration', 'technical']
            },
            {
                title: 'Understanding D&D Predictions',
                category: 'features',
                content: 'How our AI predicts demurrage and detention charges...',
                keywords: ['predictions', 'ai', 'demurrage', 'detention']
            }
        ];
        
        for (const article of articles) {
            await this.createKnowledgeBaseArticle(article);
        }
    }

    async createKnowledgeBaseArticle(article) {
        try {
            await this.db.query(`
                INSERT INTO knowledge_base (
                    title, category, content, keywords, views, helpful_count
                ) VALUES ($1, $2, $3, $4, 0, 0)
                ON CONFLICT (title) DO UPDATE
                SET content = $3, keywords = $4, updated_at = NOW()
            `, [article.title, article.category, article.content, article.keywords]);
            
        } catch (error) {
            console.error('KB article creation error:', error);
        }
    }

    async searchKnowledgeBase(query) {
        const results = await this.db.query(`
            SELECT 
                id, title, category, 
                ts_rank(search_vector, plainto_tsquery($1)) as rank,
                SUBSTRING(content, 1, 200) as excerpt
            FROM knowledge_base
            WHERE search_vector @@ plainto_tsquery($1)
            ORDER BY rank DESC
            LIMIT 10
        `, [query]);
        
        // Track search
        await this.db.query(
            'INSERT INTO kb_searches (query, results_count) VALUES ($1, $2)',
            [query, results.rows.length]
        );
        
        return results.rows;
    }

    async checkAutoResponse(ticket) {
        // Search KB for relevant articles
        const articles = await this.searchKnowledgeBase(ticket.subject + ' ' + ticket.message);
        
        if (articles.length > 0 && articles[0].rank > 0.5) {
            // Auto-respond with KB article
            await this.addIntercomNote(
                ticket.conversation_id,
                `Hi! While our team reviews your request, this article might help:\n\n` +
                `**${articles[0].title}**\n${articles[0].excerpt}...\n\n` +
                `[Read full article](https://app.rootuip.com/kb/${articles[0].id})`
            );
            
            // Track auto-response
            await this.db.query(
                'UPDATE support_tickets SET auto_responded = true WHERE id = $1',
                [ticket.id]
            );
        }
    }

    // Customer health scoring
    async calculateCustomerHealthScore(userId) {
        const metrics = await this.db.query(`
            SELECT 
                COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_tickets,
                AVG(CASE WHEN resolved_at IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600 
                END) as avg_resolution_hours,
                COUNT(CASE WHEN escalated = true THEN 1 END) as escalated_count
            FROM support_tickets
            WHERE user_id = $1
        `, [userId]);
        
        const data = metrics.rows[0];
        let score = 100;
        
        // Deduct for open tickets
        score -= data.open_tickets * 5;
        
        // Deduct for high ticket volume
        if (data.recent_tickets > 10) score -= 20;
        else if (data.recent_tickets > 5) score -= 10;
        
        // Deduct for slow resolution
        if (data.avg_resolution_hours > 48) score -= 15;
        else if (data.avg_resolution_hours > 24) score -= 10;
        
        // Deduct for escalations
        score -= data.escalated_count * 10;
        
        return Math.max(0, Math.min(100, score));
    }

    // Success manager assignment
    async assignSuccessManager(userId, tier) {
        if (tier !== 'enterprise') return null;
        
        // Get available success managers
        const manager = await this.db.query(`
            SELECT 
                sm.*,
                COUNT(a.user_id) as assigned_accounts
            FROM success_managers sm
            LEFT JOIN user_assignments a ON sm.id = a.manager_id
            WHERE sm.status = 'active'
            GROUP BY sm.id
            ORDER BY assigned_accounts ASC
            LIMIT 1
        `);
        
        if (manager.rows[0]) {
            await this.db.query(
                'INSERT INTO user_assignments (user_id, manager_id) VALUES ($1, $2)',
                [userId, manager.rows[0].id]
            );
            
            // Notify manager
            this.emit('manager:assigned', {
                userId,
                managerId: manager.rows[0].id,
                managerName: manager.rows[0].name
            });
            
            return manager.rows[0];
        }
        
        return null;
    }

    // Webhook handlers
    setupWebhooks() {
        const router = express.Router();
        
        // Intercom webhook
        router.post('/webhooks/intercom', async (req, res) => {
            const { topic, data } = req.body;
            
            try {
                switch (topic) {
                    case 'conversation.user.replied':
                        await this.handleUserReply(data);
                        break;
                    case 'conversation.admin.replied':
                        await this.handleAdminReply(data);
                        break;
                    case 'conversation.admin.closed':
                        await this.handleTicketClosed(data);
                        break;
                }
                
                res.json({ success: true });
            } catch (error) {
                console.error('Webhook error:', error);
                res.status(500).json({ error: 'Webhook processing failed' });
            }
        });
        
        return router;
    }

    async handleUserReply(data) {
        // Update last response time
        await this.db.query(`
            UPDATE support_tickets 
            SET last_user_response = NOW(), status = 'awaiting_response'
            WHERE conversation_id = $1
        `, [data.conversation.id]);
        
        // Check if needs re-escalation
        const ticket = await this.db.query(
            'SELECT * FROM support_tickets WHERE conversation_id = $1',
            [data.conversation.id]
        );
        
        if (ticket.rows[0] && data.conversation_message.body.toLowerCase().includes('still not working')) {
            await this.escalateTicket(ticket.rows[0].id, 'customer_frustration');
        }
    }

    async handleAdminReply(data) {
        // Update first response time if needed
        const ticket = await this.db.query(
            'SELECT * FROM support_tickets WHERE conversation_id = $1',
            [data.conversation.id]
        );
        
        if (ticket.rows[0] && !ticket.rows[0].first_response_at) {
            await this.db.query(`
                UPDATE support_tickets 
                SET first_response_at = NOW(), status = 'in_progress'
                WHERE id = $1
            `, [ticket.rows[0].id]);
            
            // Update SLA tracking
            await this.db.query(`
                UPDATE sla_tracking 
                SET status = 'met', completed_at = NOW()
                WHERE ticket_id = $1 AND type = 'first_response' AND status = 'pending'
            `, [ticket.rows[0].id]);
        }
    }

    async handleTicketClosed(data) {
        await this.db.query(`
            UPDATE support_tickets 
            SET status = 'closed', resolved_at = NOW()
            WHERE conversation_id = $1
        `, [data.conversation.id]);
        
        // Update resolution SLA
        const ticket = await this.db.query(
            'SELECT * FROM support_tickets WHERE conversation_id = $1',
            [data.conversation.id]
        );
        
        if (ticket.rows[0]) {
            await this.db.query(`
                UPDATE sla_tracking 
                SET status = 'met', completed_at = NOW()
                WHERE ticket_id = $1 AND type = 'resolution' AND status = 'pending'
            `, [ticket.rows[0].id]);
            
            // Send satisfaction survey
            await this.sendSatisfactionSurvey(ticket.rows[0]);
        }
    }

    async sendSatisfactionSurvey(ticket) {
        // Create survey link
        const surveyUrl = `https://app.rootuip.com/survey/${ticket.id}`;
        
        await this.addIntercomNote(
            ticket.conversation_id,
            `Thank you for contacting support! Please take a moment to rate your experience:\n\n` +
            `[Complete Survey](${surveyUrl})`
        );
    }

    async addIntercomNote(conversationId, note) {
        await axios.post(
            `${this.intercom.apiBase}/conversations/${conversationId}/parts`,
            {
                message_type: 'note',
                type: 'admin',
                body: note,
                admin_id: process.env.INTERCOM_ADMIN_ID
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.intercom.accessToken}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );
    }

    // Reporting
    async getSupportMetrics(startDate, endDate) {
        const metrics = await this.db.query(`
            SELECT 
                COUNT(*) as total_tickets,
                COUNT(CASE WHEN status = 'closed' THEN 1 END) as resolved_tickets,
                AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60) as avg_first_response_minutes,
                AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_resolution_hours,
                COUNT(CASE WHEN escalated = true THEN 1 END) as escalated_tickets,
                tier,
                category
            FROM support_tickets
            WHERE created_at BETWEEN $1 AND $2
            GROUP BY tier, category
        `, [startDate, endDate]);
        
        const slaMetrics = await this.db.query(`
            SELECT 
                type,
                COUNT(CASE WHEN status = 'met' THEN 1 END) as met_count,
                COUNT(CASE WHEN status = 'breached' THEN 1 END) as breached_count,
                COUNT(*) as total_count
            FROM sla_tracking st
            JOIN support_tickets t ON st.ticket_id = t.id
            WHERE t.created_at BETWEEN $1 AND $2
            GROUP BY type
        `, [startDate, endDate]);
        
        return {
            tickets: metrics.rows,
            sla: slaMetrics.rows,
            slaCompliance: this.calculateSLACompliance(slaMetrics.rows)
        };
    }

    calculateSLACompliance(slaData) {
        let totalMet = 0;
        let totalCount = 0;
        
        for (const sla of slaData) {
            totalMet += sla.met_count;
            totalCount += sla.total_count;
        }
        
        return totalCount > 0 ? (totalMet / totalCount) * 100 : 100;
    }

    async getUserTier(userId) {
        const user = await this.db.query(
            'SELECT support_tier FROM users WHERE id = $1',
            [userId]
        );
        
        return user.rows[0]?.support_tier || 'standard';
    }

    async notifyAgent(agent, ticket, message = null) {
        // Send notification via preferred channel
        this.emit('agent:notification', {
            agentId: agent.id,
            ticket,
            message: message || `New ${ticket.priority} priority ticket assigned`
        });
    }

    // Database schema
    async createSchema() {
        const schemas = [
            `CREATE TABLE IF NOT EXISTS support_tickets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                conversation_id VARCHAR(255),
                category VARCHAR(50),
                priority VARCHAR(50),
                subject TEXT,
                message TEXT,
                status VARCHAR(50),
                tier VARCHAR(50),
                urgency_score INTEGER,
                sla_first_response INTEGER,
                sla_resolution INTEGER,
                assigned_to INTEGER,
                assigned_at TIMESTAMP,
                first_response_at TIMESTAMP,
                resolved_at TIMESTAMP,
                last_user_response TIMESTAMP,
                escalated BOOLEAN DEFAULT false,
                escalation_reason TEXT,
                auto_responded BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS sla_tracking (
                id SERIAL PRIMARY KEY,
                ticket_id INTEGER REFERENCES support_tickets(id),
                type VARCHAR(50),
                deadline TIMESTAMP,
                status VARCHAR(50),
                completed_at TIMESTAMP,
                breached_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS support_agents (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255),
                intercom_id VARCHAR(255),
                team VARCHAR(50),
                skill_level INTEGER,
                status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS knowledge_base (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) UNIQUE,
                category VARCHAR(50),
                content TEXT,
                keywords TEXT[],
                views INTEGER DEFAULT 0,
                helpful_count INTEGER DEFAULT 0,
                search_vector tsvector,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS kb_searches (
                id SERIAL PRIMARY KEY,
                query TEXT,
                results_count INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS success_managers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255),
                status VARCHAR(50),
                specialties TEXT[],
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            
            `CREATE TABLE IF NOT EXISTS user_assignments (
                user_id INTEGER,
                manager_id INTEGER REFERENCES success_managers(id),
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, manager_id)
            )`,
            
            `CREATE TABLE IF NOT EXISTS sla_breach_log (
                id SERIAL PRIMARY KEY,
                ticket_id INTEGER,
                breach_type VARCHAR(50),
                breach_minutes INTEGER,
                tier VARCHAR(50),
                category VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        ];
        
        for (const schema of schemas) {
            await this.db.query(schema);
        }
        
        // Create indexes
        await this.db.query(`
            CREATE INDEX IF NOT EXISTS idx_tickets_user ON support_tickets(user_id);
            CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets(status);
            CREATE INDEX IF NOT EXISTS idx_sla_pending ON sla_tracking(status, deadline) WHERE status = 'pending';
            CREATE INDEX IF NOT EXISTS idx_kb_search ON knowledge_base USING GIN(search_vector);
            
            -- Update search vector trigger
            CREATE OR REPLACE FUNCTION kb_search_trigger() RETURNS trigger AS $$
            BEGIN
                NEW.search_vector := to_tsvector('english', NEW.title || ' ' || NEW.content || ' ' || array_to_string(NEW.keywords, ' '));
                RETURN NEW;
            END
            $$ LANGUAGE plpgsql;
            
            DROP TRIGGER IF EXISTS kb_search_update ON knowledge_base;
            CREATE TRIGGER kb_search_update BEFORE INSERT OR UPDATE ON knowledge_base
            FOR EACH ROW EXECUTE FUNCTION kb_search_trigger();
        `);
    }
}

module.exports = CustomerSupportSystem;