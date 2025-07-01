#!/bin/bash
# ROOTUIP Pilot Program Setup Script

echo "🚀 Setting up ROOTUIP Pilot Program Infrastructure..."

# Create necessary directories
echo "Creating pilot program directories..."
mkdir -p /home/iii/ROOTUIP/pilot-program/{agreements,reports,data,feedback,templates}
mkdir -p /home/iii/ROOTUIP/reports/{weekly,monthly,executive}

# Install required dependencies
echo "Installing dependencies..."
cd /home/iii/ROOTUIP
npm install @slack/web-api pdfkit exceljs node-cron

# Create database tables for pilot tracking
echo "Setting up pilot database schema..."
psql -U postgres -d rootuip << EOF
-- Pilot agreements table
CREATE TABLE IF NOT EXISTS pilot_agreements (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    pilot_fee DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    contract_type VARCHAR(50) DEFAULT '60-day',
    report_recipients TEXT[],
    success_criteria JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Pilot metrics tracking
CREATE TABLE IF NOT EXISTS pilot_metrics (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    metric_date DATE NOT NULL,
    prevention_rate DECIMAL(5, 2),
    savings_amount DECIMAL(10, 2),
    shipments_processed INTEGER,
    active_users INTEGER,
    total_users INTEGER,
    system_uptime DECIMAL(5, 2),
    avg_response_time INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (customer_id) REFERENCES pilot_agreements(customer_id)
);

-- Success stories
CREATE TABLE IF NOT EXISTS pilot_success_stories (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    story_date TIMESTAMP NOT NULL,
    container_number VARCHAR(50),
    savings_amount DECIMAL(10, 2),
    risk_score INTEGER,
    prevention_method VARCHAR(255),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (customer_id) REFERENCES pilot_agreements(customer_id)
);

-- Feedback collection
CREATE TABLE IF NOT EXISTS pilot_feedback (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    user_name VARCHAR(255),
    user_email VARCHAR(255),
    user_role VARCHAR(100),
    satisfaction_score INTEGER,
    nps_score INTEGER,
    valuable_features TEXT[],
    feature_requests TEXT,
    improvement_priority VARCHAR(50),
    dd_reduction VARCHAR(50),
    significant_benefit TEXT,
    challenges TEXT,
    continuation_likelihood VARCHAR(50),
    continuation_factors TEXT,
    additional_comments TEXT,
    willing_reference BOOLEAN DEFAULT false,
    willing_case_study BOOLEAN DEFAULT false,
    submitted_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (customer_id) REFERENCES pilot_agreements(customer_id)
);

-- Reference activities
CREATE TABLE IF NOT EXISTS reference_activities (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    reference_date DATE NOT NULL,
    prospect_company VARCHAR(255),
    reference_type VARCHAR(50),
    outcome VARCHAR(50),
    feedback TEXT,
    time_invested INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (customer_id) REFERENCES pilot_agreements(customer_id)
);

-- Pilot conversion tracking
CREATE TABLE IF NOT EXISTS pilot_conversions (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) UNIQUE NOT NULL,
    conversion_date DATE,
    contract_type VARCHAR(50),
    annual_value DECIMAL(10, 2),
    contract_length_months INTEGER,
    discount_applied DECIMAL(5, 2),
    pilot_credit_applied DECIMAL(10, 2),
    conversion_status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (customer_id) REFERENCES pilot_agreements(customer_id)
);

-- Create indexes for performance
CREATE INDEX idx_pilot_metrics_customer_date ON pilot_metrics(customer_id, metric_date);
CREATE INDEX idx_success_stories_customer ON pilot_success_stories(customer_id);
CREATE INDEX idx_feedback_customer ON pilot_feedback(customer_id);
CREATE INDEX idx_reference_customer ON reference_activities(customer_id);

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO uip_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO uip_user;
EOF

# Create API endpoints for pilot program
echo "Creating pilot API endpoints..."
cat >> /home/iii/ROOTUIP/api-gateway.js << 'EOF'

// Pilot Program Routes
const pilotRoutes = require('./pilot-program/pilot-routes');
app.use('/api/pilot', pilotRoutes);

// Automated report generation
const reportGenerator = require('./pilot-program/automated-report-generator');
app.use('/api/pilot/reports', reportGenerator);

// Slack integration
const slackIntegration = require('./pilot-program/pilot-slack-integration');
app.use('/api/pilot/slack', slackIntegration.router);
EOF

# Create pilot routes file
cat > /home/iii/ROOTUIP/pilot-program/pilot-routes.js << 'EOF'
const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://uip_user:U1Pp@ssw0rd!@localhost:5432/rootuip'
});

// Create new pilot
router.post('/create', async (req, res) => {
  try {
    const { customerId, companyName, startDate, pilotFee, contractType, reportRecipients } = req.body;
    
    const result = await pool.query(
      `INSERT INTO pilot_agreements 
       (customer_id, company_name, start_date, end_date, pilot_fee, contract_type, report_recipients)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        customerId,
        companyName,
        startDate,
        calculateEndDate(startDate, contractType),
        pilotFee,
        contractType,
        reportRecipients
      ]
    );
    
    res.json({ success: true, pilot: result.rows[0] });
  } catch (error) {
    console.error('Error creating pilot:', error);
    res.status(500).json({ error: 'Failed to create pilot' });
  }
});

// Track metrics
router.post('/metrics/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const metrics = req.body;
    
    await pool.query(
      `INSERT INTO pilot_metrics 
       (customer_id, metric_date, prevention_rate, savings_amount, shipments_processed, 
        active_users, total_users, system_uptime, avg_response_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        customerId,
        new Date(),
        metrics.preventionRate,
        metrics.savingsAmount,
        metrics.shipmentsProcessed,
        metrics.activeUsers,
        metrics.totalUsers,
        metrics.systemUptime,
        metrics.avgResponseTime
      ]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking metrics:', error);
    res.status(500).json({ error: 'Failed to track metrics' });
  }
});

// Submit feedback
router.post('/feedback', async (req, res) => {
  try {
    const feedback = req.body;
    
    await pool.query(
      `INSERT INTO pilot_feedback 
       (customer_id, user_name, user_email, user_role, satisfaction_score, 
        nps_score, valuable_features, feature_requests, improvement_priority,
        dd_reduction, significant_benefit, challenges, continuation_likelihood,
        continuation_factors, additional_comments, willing_reference, willing_case_study)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        feedback.customerId || 'pilot-001', // Get from session in production
        feedback.name,
        feedback.email,
        feedback.role,
        feedback.satisfaction,
        feedback.nps,
        feedback.valuable_features,
        feedback.feature_requests,
        feedback.improvement_priority,
        feedback.dd_reduction,
        feedback.significant_benefit,
        feedback.challenges,
        feedback.continuation_likelihood,
        feedback.continuation_factors,
        feedback.additional_comments,
        feedback.follow_up === 'yes',
        feedback.case_study === 'yes'
      ]
    );
    
    res.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get pilot status
router.get('/status/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    
    const pilot = await pool.query(
      'SELECT * FROM pilot_agreements WHERE customer_id = $1',
      [customerId]
    );
    
    const latestMetrics = await pool.query(
      `SELECT * FROM pilot_metrics 
       WHERE customer_id = $1 
       ORDER BY metric_date DESC 
       LIMIT 1`,
      [customerId]
    );
    
    const successStories = await pool.query(
      `SELECT COUNT(*) as count, SUM(savings_amount) as total_savings 
       FROM pilot_success_stories 
       WHERE customer_id = $1`,
      [customerId]
    );
    
    res.json({
      pilot: pilot.rows[0],
      metrics: latestMetrics.rows[0],
      successStories: successStories.rows[0]
    });
  } catch (error) {
    console.error('Error getting pilot status:', error);
    res.status(500).json({ error: 'Failed to get pilot status' });
  }
});

function calculateEndDate(startDate, contractType) {
  const start = new Date(startDate);
  const days = contractType === '30-day' ? 30 : 60;
  start.setDate(start.getDate() + days);
  return start;
}

module.exports = router;
EOF

# Create HTML templates directory
echo "Creating HTML templates..."
mkdir -p /home/iii/ROOTUIP/pilot-program/templates

# Create executive report template
cat > /home/iii/ROOTUIP/pilot-program/templates/executive-report.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>ROOTUIP Executive Report - {{CUSTOMER_ID}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 40px; }
        .metrics { display: flex; justify-content: space-around; margin: 30px 0; }
        .metric-box { text-align: center; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .metric-value { font-size: 36px; font-weight: bold; color: #4299e1; }
        .metric-label { color: #666; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>ROOTUIP Pilot Report</h1>
        <p>Generated: {{REPORT_DATE}}</p>
    </div>
    
    <div class="metrics">
        <div class="metric-box">
            <div class="metric-value">{{PREVENTION_RATE}}%</div>
            <div class="metric-label">D&D Prevention Rate</div>
        </div>
        <div class="metric-box">
            <div class="metric-value">${{TOTAL_SAVINGS}}</div>
            <div class="metric-label">Total Savings</div>
        </div>
        <div class="metric-box">
            <div class="metric-value">{{ROI_RATIO}}:1</div>
            <div class="metric-label">ROI Achievement</div>
        </div>
    </div>
    
    <h2>Key Achievements</h2>
    <ul>
        <li>Prevented {{TOTAL_PREVENTED}} D&D events</li>
        <li>Achieved {{AVG_CONFIDENCE}}% prediction confidence</li>
        <li>{{ACTIVE_USERS}} of {{TOTAL_USERS}} users actively engaged</li>
        <li>{{AVG_RESPONSE_TIME}}ms average response time</li>
        <li>{{UPTIME}} system uptime</li>
    </ul>
</body>
</html>
EOF

# Create co-marketing agreement template
cat > /home/iii/ROOTUIP/pilot-program/co-marketing-agreement.md << 'EOF'
# Co-Marketing Agreement Template

**MUTUAL MARKETING AGREEMENT**

This Agreement is entered into between ROOTUIP Inc. ("ROOTUIP") and _________________ ("Customer").

## 1. Purpose
The parties agree to collaborate on marketing activities to promote the successful pilot program results.

## 2. Permitted Activities
- Case study development and publication
- Joint press releases
- Webinar presentations
- Conference speaking opportunities
- Website testimonials
- Social media campaigns

## 3. Approval Rights
- All materials require written approval from both parties
- 5 business day review period
- Specific quotes require explicit approval

## 4. Confidentiality
- No disclosure of confidential information
- Metrics may be shared as percentages
- Customer pricing remains confidential

## 5. Term
This agreement remains in effect for 24 months from signature.

## 6. Benefits
Customer receives:
- Co-branded content creation
- Thought leadership opportunities
- Industry recognition
- Preferential partnership status

---

**ROOTUIP Inc.**
By: _________________________
Date: _______________________

**[Customer Name]**
By: _________________________
Date: _______________________
EOF

# Create pilot dashboard nginx configuration
echo "Configuring pilot dashboard access..."
sudo tee /etc/nginx/sites-available/pilot-dashboard << EOF
server {
    listen 443 ssl;
    server_name pilot.rootuip.com;

    ssl_certificate /etc/letsencrypt/live/rootuip.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rootuip.com/privkey.pem;

    location / {
        root /home/iii/ROOTUIP/pilot-program;
        index pilot-tracking-dashboard.html;
        try_files \$uri \$uri/ =404;
    }

    location /api/pilot {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Create startup script for pilot services
cat > /home/iii/ROOTUIP/pilot-program/start-pilot-services.sh << 'EOF'
#!/bin/bash
echo "Starting ROOTUIP Pilot Program services..."

# Start report scheduler
node /home/iii/ROOTUIP/pilot-program/automated-report-generator.js &

# Start Slack integration
node /home/iii/ROOTUIP/pilot-program/pilot-slack-integration.js &

echo "Pilot services started successfully"
EOF

chmod +x /home/iii/ROOTUIP/pilot-program/start-pilot-services.sh

# Create pilot program documentation
cat > /home/iii/ROOTUIP/pilot-program/README.md << 'EOF'
# ROOTUIP Pilot Program

## Overview
The ROOTUIP Pilot Program is a 30-60 day trial designed to demonstrate our 94% D&D prevention capability.

## Directory Structure
```
pilot-program/
├── agreements/           # Pilot agreements and contracts
├── reports/             # Generated reports
├── data/               # Pilot data and metrics
├── feedback/           # Customer feedback
├── templates/          # Document templates
├── pilot-tracking-dashboard.html
├── feedback-collection-system.html
├── executive-presentation-template.html
└── automated-report-generator.js
```

## Key Features
1. **Automated Onboarding**: Structured workflow from contract to go-live
2. **Real-time Tracking**: Live dashboard showing savings and metrics
3. **Weekly Check-ins**: Templated meetings with success tracking
4. **Automated Reports**: Daily, weekly, and monthly report generation
5. **Feedback System**: Comprehensive feedback collection and analysis
6. **Reference Program**: Tiered benefits for customer advocates
7. **Slack Integration**: Dedicated channels for pilot customers
8. **Conversion Workflow**: Systematic pilot-to-annual conversion

## Quick Start
1. Create new pilot: `POST /api/pilot/create`
2. Access dashboard: https://pilot.rootuip.com
3. Generate report: `POST /api/pilot/reports/generate`
4. Track metrics: `POST /api/pilot/metrics/:customerId`

## Success Metrics
- D&D Prevention Rate ≥ 85% (target 94%)
- ROI Achievement ≥ 5:1
- User Adoption > 75%
- System Uptime ≥ 99.5%
EOF

echo "✅ Pilot Program setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure Slack bot token in .env"
echo "2. Set up email SMTP credentials"
echo "3. Enable nginx site: sudo ln -s /etc/nginx/sites-available/pilot-dashboard /etc/nginx/sites-enabled/"
echo "4. Start pilot services: ./pilot-program/start-pilot-services.sh"
echo "5. Access pilot dashboard at: https://pilot.rootuip.com"