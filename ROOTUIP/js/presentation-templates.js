// Presentation Templates Data
const presentationTemplates = {
    // Executive Overview (15 minutes)
    executive: {
        title: "Executive Overview",
        duration: "15 minutes",
        slides: [
            {
                id: "exec-1",
                title: "The $14M Per Vessel Problem",
                content: `
                    <div class="exec-title-slide">
                        <img src="brand/logo.svg" alt="UIP" class="slide-logo">
                        <h1 class="main-title">Your Fleet is Losing <span class="highlight">$14M Per Vessel</span> Annually</h1>
                        <p class="subtitle">See how UIP eliminates detention & demurrage charges in 14 days</p>
                        <div class="exec-stats">
                            <div class="stat">
                                <span class="stat-value">$342M</span>
                                <span class="stat-label">Saved for Clients</span>
                            </div>
                            <div class="stat">
                                <span class="stat-value">2.5M</span>
                                <span class="stat-label">Containers Processed</span>
                            </div>
                            <div class="stat">
                                <span class="stat-value">14 Days</span>
                                <span class="stat-label">Implementation</span>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Focus on the personal impact - their specific fleet losses. Make it urgent."
            },
            {
                id: "exec-2",
                title: "The Hidden Cost Crisis",
                content: `
                    <div class="crisis-slide">
                        <h2>87% of Your D&D Charges Are Preventable</h2>
                        <div class="crisis-visual">
                            <div class="cost-breakdown">
                                <div class="cost-item preventable">
                                    <span class="percentage">87%</span>
                                    <span class="label">Preventable</span>
                                    <span class="amount">$12.3M per vessel</span>
                                </div>
                                <div class="cost-item unavoidable">
                                    <span class="percentage">13%</span>
                                    <span class="label">Unavoidable</span>
                                    <span class="amount">$1.8M per vessel</span>
                                </div>
                            </div>
                            <div class="impact-list">
                                <h3>Current Impact on Your Business:</h3>
                                <ul>
                                    <li>Eroding margins by 3-5%</li>
                                    <li>160+ hours weekly on manual processes</li>
                                    <li>Missing 73% of dispute deadlines</li>
                                    <li>4% error rate costing $50 per mistake</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Emphasize the preventable nature. They're literally throwing money away."
            },
            {
                id: "exec-3",
                title: "The UIP Solution",
                content: `
                    <div class="solution-overview">
                        <h2>One Platform. Every Carrier. Zero Manual Work.</h2>
                        <div class="solution-pillars">
                            <div class="pillar">
                                <div class="pillar-icon">🔌</div>
                                <h3>Universal Integration</h3>
                                <p>Connect ALL carrier systems<br>APIs, EDI, Email, OCR</p>
                            </div>
                            <div class="pillar">
                                <div class="pillar-icon">🤖</div>
                                <h3>AI Automation</h3>
                                <p>Predict charges 14 days early<br>File disputes automatically</p>
                            </div>
                            <div class="pillar">
                                <div class="pillar-icon">📊</div>
                                <h3>Real-time Visibility</h3>
                                <p>Single dashboard for all containers<br>Instant alerts on risks</p>
                            </div>
                        </div>
                        <div class="solution-proof">
                            <p class="proof-statement">Result: <strong>94% dispute success rate</strong> vs 67% industry average</p>
                        </div>
                    </div>
                `,
                notes: "Keep it simple. One platform that does everything they need."
            },
            {
                id: "exec-4",
                title: "Proven ROI - Real Customer Results",
                content: `
                    <div class="roi-showcase">
                        <h2>Your Peers Are Already Saving Millions</h2>
                        <div class="customer-results-grid">
                            <div class="customer-result featured">
                                <div class="customer-header">
                                    <img src="images/case-study-1.svg" alt="Global Retailer">
                                    <span class="customer-type">Global Retailer • 200 vessels</span>
                                </div>
                                <div class="result-metrics">
                                    <div class="primary-metric">
                                        <span class="value">$127M</span>
                                        <span class="label">Annual Savings</span>
                                    </div>
                                    <div class="secondary-metrics">
                                        <div class="metric">
                                            <span class="value">12 days</span>
                                            <span class="label">Payback Period</span>
                                        </div>
                                        <div class="metric">
                                            <span class="value">94%</span>
                                            <span class="label">D&D Reduction</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="customer-result">
                                <div class="customer-header">
                                    <img src="images/case-study-2.svg" alt="Auto Manufacturer">
                                    <span class="customer-type">Auto Manufacturer • 75 vessels</span>
                                </div>
                                <div class="result-metrics">
                                    <div class="primary-metric">
                                        <span class="value">$89M</span>
                                        <span class="label">First Year Savings</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Use peer pressure. Show competitors are already saving."
            },
            {
                id: "exec-5",
                title: "Implementation & Next Steps",
                content: `
                    <div class="implementation-slide">
                        <h2>From Signature to Savings: 14 Days</h2>
                        <div class="timeline">
                            <div class="timeline-item">
                                <span class="day">Day 1-3</span>
                                <h4>Connect Systems</h4>
                                <p>API keys, EDI setup, email config</p>
                            </div>
                            <div class="timeline-item">
                                <span class="day">Day 4-7</span>
                                <h4>Historical Analysis</h4>
                                <p>Identify patterns, validate data</p>
                            </div>
                            <div class="timeline-item">
                                <span class="day">Day 8-10</span>
                                <h4>Team Training</h4>
                                <p>2-hour sessions, documentation</p>
                            </div>
                            <div class="timeline-item">
                                <span class="day">Day 11-14</span>
                                <h4>Go Live</h4>
                                <p>Full automation, immediate ROI</p>
                            </div>
                        </div>
                        <div class="next-steps">
                            <h3>Immediate Next Steps:</h3>
                            <ol>
                                <li>Technical assessment call (30 min)</li>
                                <li>ROI analysis with your data</li>
                                <li>Pilot program proposal</li>
                            </ol>
                            <div class="cta-box">
                                <p class="urgency">Every day of delay = $38,000 lost per vessel</p>
                                <button class="cta-button">Schedule Technical Assessment</button>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Create urgency. Every day they wait costs them money."
            }
        ]
    },

    // Technical Deep Dive (30 minutes)
    technical: {
        title: "Technical Deep Dive",
        duration: "30 minutes",
        slides: [
            {
                id: "tech-1",
                title: "Technical Architecture Overview",
                content: `
                    <div class="architecture-slide">
                        <h2>Enterprise-Grade Ocean Freight Intelligence Platform</h2>
                        <div class="architecture-diagram">
                            <div class="arch-layer data-sources">
                                <h3>Data Sources</h3>
                                <div class="source-grid">
                                    <div class="source">Carrier APIs</div>
                                    <div class="source">EDI/AS2</div>
                                    <div class="source">Email Parsing</div>
                                    <div class="source">OCR/Documents</div>
                                    <div class="source">Port Systems</div>
                                    <div class="source">Terminal APIs</div>
                                </div>
                            </div>
                            <div class="arch-layer integration">
                                <h3>Integration Layer</h3>
                                <div class="tech-stack">
                                    <span>Apache Kafka</span>
                                    <span>Redis Queue</span>
                                    <span>GraphQL Gateway</span>
                                    <span>REST APIs</span>
                                </div>
                            </div>
                            <div class="arch-layer processing">
                                <h3>AI Processing Engine</h3>
                                <div class="tech-stack">
                                    <span>TensorFlow</span>
                                    <span>PyTorch</span>
                                    <span>Apache Spark</span>
                                    <span>Kubernetes</span>
                                </div>
                            </div>
                            <div class="arch-layer applications">
                                <h3>Applications</h3>
                                <div class="app-grid">
                                    <div class="app">Risk Prediction</div>
                                    <div class="app">Dispute Automation</div>
                                    <div class="app">Performance Analytics</div>
                                    <div class="app">Cost Optimization</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Show we're enterprise-ready with modern tech stack."
            },
            {
                id: "tech-2",
                title: "Integration Capabilities",
                content: `
                    <div class="integration-deep-dive">
                        <h2>Connect Every System in Your Supply Chain</h2>
                        <div class="integration-matrix">
                            <div class="integration-category">
                                <h3>Carrier Integrations</h3>
                                <div class="carrier-list">
                                    <div class="carrier-item">
                                        <span class="status ready">✓</span>
                                        <span>Maersk GCSS API</span>
                                    </div>
                                    <div class="carrier-item">
                                        <span class="status ready">✓</span>
                                        <span>MSC myMSC Platform</span>
                                    </div>
                                    <div class="carrier-item">
                                        <span class="status ready">✓</span>
                                        <span>CMA CGM eBusiness</span>
                                    </div>
                                    <div class="carrier-item">
                                        <span class="status ready">✓</span>
                                        <span>Hapag-Lloyd Navigator</span>
                                    </div>
                                    <div class="carrier-item">
                                        <span class="status custom">+</span>
                                        <span>200+ More Carriers</span>
                                    </div>
                                </div>
                            </div>
                            <div class="integration-category">
                                <h3>Data Formats</h3>
                                <div class="format-grid">
                                    <div class="format">
                                        <h4>EDI Standards</h4>
                                        <p>X12 (315, 322, 350)<br>EDIFACT (IFTSTA, COPRAR)</p>
                                    </div>
                                    <div class="format">
                                        <h4>API Protocols</h4>
                                        <p>REST, GraphQL<br>SOAP, WebSocket</p>
                                    </div>
                                    <div class="format">
                                        <h4>File Processing</h4>
                                        <p>CSV, Excel, PDF<br>XML, JSON</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="security-compliance">
                            <h3>Security & Compliance</h3>
                            <div class="security-badges">
                                <span class="badge">SOC 2 Type II</span>
                                <span class="badge">ISO 27001</span>
                                <span class="badge">GDPR Compliant</span>
                                <span class="badge">99.99% Uptime SLA</span>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Address security concerns upfront. Show we connect to everything."
            },
            {
                id: "tech-3",
                title: "AI & Machine Learning Capabilities",
                content: `
                    <div class="ai-capabilities">
                        <h2>Predictive Intelligence That Learns Your Business</h2>
                        <div class="ai-features">
                            <div class="ai-feature">
                                <div class="feature-visual">
                                    <canvas id="riskPredictionChart"></canvas>
                                </div>
                                <h3>Risk Prediction Engine</h3>
                                <ul>
                                    <li>14-day advance warning on D&D risks</li>
                                    <li>98.7% prediction accuracy</li>
                                    <li>Factors: weather, port congestion, carrier performance</li>
                                    <li>Custom ML models per trade lane</li>
                                </ul>
                            </div>
                            <div class="ai-feature">
                                <div class="feature-visual">
                                    <div class="automation-flow">
                                        <div class="flow-step">Detect Risk</div>
                                        <div class="flow-arrow">→</div>
                                        <div class="flow-step">Analyze Cause</div>
                                        <div class="flow-arrow">→</div>
                                        <div class="flow-step">File Dispute</div>
                                        <div class="flow-arrow">→</div>
                                        <div class="flow-step">Track Result</div>
                                    </div>
                                </div>
                                <h3>Automated Dispute Management</h3>
                                <ul>
                                    <li>AI-generated dispute documentation</li>
                                    <li>Automatic evidence compilation</li>
                                    <li>94% success rate vs 67% manual</li>
                                    <li>24/7 dispute filing</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Focus on AI as competitive advantage. Show real accuracy numbers."
            },
            {
                id: "tech-4",
                title: "Implementation Process",
                content: `
                    <div class="implementation-technical">
                        <h2>Zero-Disruption Implementation</h2>
                        <div class="implementation-phases">
                            <div class="phase">
                                <h3>Phase 1: Discovery (Days 1-3)</h3>
                                <div class="phase-tasks">
                                    <div class="task">
                                        <span class="task-icon">🔍</span>
                                        <div>
                                            <h4>System Audit</h4>
                                            <p>Map current carrier connections, identify data sources</p>
                                        </div>
                                    </div>
                                    <div class="task">
                                        <span class="task-icon">📊</span>
                                        <div>
                                            <h4>Data Assessment</h4>
                                            <p>Analyze historical data, identify quick wins</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="phase">
                                <h3>Phase 2: Integration (Days 4-10)</h3>
                                <div class="phase-tasks">
                                    <div class="task">
                                        <span class="task-icon">🔌</span>
                                        <div>
                                            <h4>API Configuration</h4>
                                            <p>Connect carrier systems, test data flows</p>
                                        </div>
                                    </div>
                                    <div class="task">
                                        <span class="task-icon">🤖</span>
                                        <div>
                                            <h4>AI Training</h4>
                                            <p>Configure ML models for your trade lanes</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="phase">
                                <h3>Phase 3: Validation (Days 11-14)</h3>
                                <div class="phase-tasks">
                                    <div class="task">
                                        <span class="task-icon">✅</span>
                                        <div>
                                            <h4>UAT & Training</h4>
                                            <p>Team training, process validation</p>
                                        </div>
                                    </div>
                                    <div class="task">
                                        <span class="task-icon">🚀</span>
                                        <div>
                                            <h4>Go Live</h4>
                                            <p>Full automation activated</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="technical-requirements">
                            <h3>Your Technical Requirements</h3>
                            <div class="req-grid">
                                <div class="req minimal">
                                    <h4>Minimal IT Effort</h4>
                                    <ul>
                                        <li>No infrastructure needed</li>
                                        <li>Cloud-based SaaS</li>
                                        <li>No code changes</li>
                                    </ul>
                                </div>
                                <div class="req access">
                                    <h4>Access Needed</h4>
                                    <ul>
                                        <li>Carrier portal credentials</li>
                                        <li>EDI mailbox access</li>
                                        <li>Read-only ERP access (optional)</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Emphasize minimal IT effort. They don't need to change anything."
            }
        ]
    },

    // Demo Walkthrough (45 minutes)
    demo: {
        title: "Live Product Demo",
        duration: "45 minutes",
        slides: [
            {
                id: "demo-1",
                title: "Dashboard Overview",
                content: `
                    <div class="demo-dashboard">
                        <h2>Your Command Center for Ocean Freight</h2>
                        <div class="dashboard-mockup">
                            <div class="dashboard-header">
                                <div class="kpi-cards">
                                    <div class="kpi-card alert">
                                        <span class="kpi-value">14</span>
                                        <span class="kpi-label">Active D&D Risks</span>
                                        <span class="kpi-trend">↓ 67% vs last month</span>
                                    </div>
                                    <div class="kpi-card success">
                                        <span class="kpi-value">$2.4M</span>
                                        <span class="kpi-label">Saved This Month</span>
                                        <span class="kpi-trend">↑ 23% vs target</span>
                                    </div>
                                    <div class="kpi-card">
                                        <span class="kpi-value">1,247</span>
                                        <span class="kpi-label">Containers Tracked</span>
                                        <span class="kpi-trend">Across 47 vessels</span>
                                    </div>
                                    <div class="kpi-card">
                                        <span class="kpi-value">94%</span>
                                        <span class="kpi-label">Dispute Success</span>
                                        <span class="kpi-trend">↑ from 67% manual</span>
                                    </div>
                                </div>
                            </div>
                            <div class="dashboard-main">
                                <div class="risk-heatmap">
                                    <h3>D&D Risk Heatmap</h3>
                                    <div class="heatmap-visual">
                                        <!-- Interactive heatmap would go here -->
                                    </div>
                                </div>
                                <div class="active-alerts">
                                    <h3>Active Alerts</h3>
                                    <div class="alert-list">
                                        <div class="alert-item high">
                                            <span class="alert-icon">⚠️</span>
                                            <div class="alert-content">
                                                <h4>High D&D Risk - Port of LA</h4>
                                                <p>27 containers approaching free time limit</p>
                                                <button class="action-btn">Take Action</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Show the dashboard live if possible. Focus on actionable insights."
            },
            {
                id: "demo-2",
                title: "Risk Prediction in Action",
                content: `
                    <div class="risk-demo">
                        <h2>See 14 Days Into the Future</h2>
                        <div class="prediction-demo">
                            <div class="container-details">
                                <h3>Container MSKU1234567</h3>
                                <div class="detail-grid">
                                    <div class="detail">
                                        <span class="label">Vessel:</span>
                                        <span class="value">MSC OSCAR</span>
                                    </div>
                                    <div class="detail">
                                        <span class="label">ETA:</span>
                                        <span class="value">Nov 15, 2024</span>
                                    </div>
                                    <div class="detail">
                                        <span class="label">Free Days:</span>
                                        <span class="value">5 days</span>
                                    </div>
                                </div>
                            </div>
                            <div class="prediction-timeline">
                                <div class="timeline-header">
                                    <h3>AI Risk Prediction</h3>
                                    <span class="risk-score high">87% D&D Risk</span>
                                </div>
                                <div class="timeline-events">
                                    <div class="event">
                                        <span class="date">Nov 15</span>
                                        <span class="description">Vessel arrival (2 days late)</span>
                                    </div>
                                    <div class="event warning">
                                        <span class="date">Nov 18</span>
                                        <span class="description">Port congestion detected</span>
                                    </div>
                                    <div class="event critical">
                                        <span class="date">Nov 20</span>
                                        <span class="description">Free time expires</span>
                                    </div>
                                    <div class="event">
                                        <span class="date">Nov 22</span>
                                        <span class="description">Projected pickup</span>
                                    </div>
                                </div>
                                <div class="action-recommendation">
                                    <h4>Recommended Actions:</h4>
                                    <ol>
                                        <li>Request free time extension (automated)</li>
                                        <li>Schedule priority pickup slot</li>
                                        <li>Alert customer of delay</li>
                                    </ol>
                                    <button class="execute-btn">Execute All Actions</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Show how we predict problems before they happen. Emphasize automation."
            },
            {
                id: "demo-3",
                title: "Automated Dispute Filing",
                content: `
                    <div class="dispute-demo">
                        <h2>From Detection to Resolution in Minutes</h2>
                        <div class="dispute-workflow">
                            <div class="workflow-step active">
                                <div class="step-number">1</div>
                                <h3>Charge Detected</h3>
                                <p>$4,500 demurrage charge from Maersk</p>
                                <span class="timestamp">2 minutes ago</span>
                            </div>
                            <div class="workflow-step active">
                                <div class="step-number">2</div>
                                <h3>AI Analysis</h3>
                                <p>Carrier delay identified as root cause</p>
                                <span class="timestamp">1 minute ago</span>
                            </div>
                            <div class="workflow-step active">
                                <div class="step-number">3</div>
                                <h3>Evidence Compiled</h3>
                                <ul>
                                    <li>✓ Vessel tracking data</li>
                                    <li>✓ Port records</li>
                                    <li>✓ Email communications</li>
                                </ul>
                            </div>
                            <div class="workflow-step processing">
                                <div class="step-number">4</div>
                                <h3>Dispute Filed</h3>
                                <p>Submitted via Maersk dispute portal</p>
                                <span class="timestamp">Processing...</span>
                            </div>
                        </div>
                        <div class="dispute-document">
                            <h3>Generated Dispute Document</h3>
                            <div class="document-preview">
                                <p><strong>RE: Demurrage Dispute - MSKU1234567</strong></p>
                                <p>We dispute the demurrage charges of $4,500 based on the following:</p>
                                <ol>
                                    <li>Vessel arrived 2 days late (tracking attached)</li>
                                    <li>Port congestion prevented timely pickup</li>
                                    <li>Free time should be extended per contract terms</li>
                                </ol>
                                <p>Supporting documentation attached.</p>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Show the speed of automation. Emphasize accuracy of AI-generated disputes."
            }
        ]
    },

    // CFO/ROI Presentation
    cfo: {
        title: "CFO Financial Impact Analysis",
        duration: "20 minutes",
        slides: [
            {
                id: "cfo-1",
                title: "Financial Executive Summary",
                content: `
                    <div class="cfo-summary">
                        <h2>UIP Investment Analysis</h2>
                        <div class="executive-metrics">
                            <div class="metric-card primary">
                                <h3>Net Present Value</h3>
                                <div class="metric-value">$487M</div>
                                <div class="metric-detail">5-year NPV at 10% discount rate</div>
                            </div>
                            <div class="metric-card">
                                <h3>Payback Period</h3>
                                <div class="metric-value">13 days</div>
                                <div class="metric-detail">Full investment recovery</div>
                            </div>
                            <div class="metric-card">
                                <h3>IRR</h3>
                                <div class="metric-value">2,847%</div>
                                <div class="metric-detail">Internal rate of return</div>
                            </div>
                            <div class="metric-card">
                                <h3>Annual ROI</h3>
                                <div class="metric-value">27.4x</div>
                                <div class="metric-detail">$27.40 return per $1 invested</div>
                            </div>
                        </div>
                        <div class="investment-breakdown">
                            <h3>Investment vs. Return (50 Vessels)</h3>
                            <div class="breakdown-table">
                                <div class="row header">
                                    <span>Category</span>
                                    <span>Annual Cost</span>
                                    <span>Annual Benefit</span>
                                    <span>Net Impact</span>
                                </div>
                                <div class="row">
                                    <span>Software License</span>
                                    <span class="negative">($25M)</span>
                                    <span>-</span>
                                    <span class="negative">($25M)</span>
                                </div>
                                <div class="row">
                                    <span>D&D Elimination</span>
                                    <span>-</span>
                                    <span class="positive">$618M</span>
                                    <span class="positive">$618M</span>
                                </div>
                                <div class="row">
                                    <span>Labor Savings</span>
                                    <span>-</span>
                                    <span class="positive">$67M</span>
                                    <span class="positive">$67M</span>
                                </div>
                                <div class="row">
                                    <span>Error Reduction</span>
                                    <span>-</span>
                                    <span class="positive">$25M</span>
                                    <span class="positive">$25M</span>
                                </div>
                                <div class="row total">
                                    <span>Total Annual Impact</span>
                                    <span class="negative">($25M)</span>
                                    <span class="positive">$710M</span>
                                    <span class="highlight">$685M</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Lead with NPV and payback period. CFOs care about financial metrics."
            },
            {
                id: "cfo-2",
                title: "Cost Structure Deep Dive",
                content: `
                    <div class="cost-analysis">
                        <h2>Hidden Costs in Your Current Operation</h2>
                        <div class="cost-categories">
                            <div class="category">
                                <h3>Direct Costs</h3>
                                <div class="cost-item">
                                    <span class="item-name">D&D Charges</span>
                                    <span class="item-amount">$14.2M/vessel</span>
                                    <p>87% preventable with UIP</p>
                                </div>
                                <div class="cost-item">
                                    <span class="item-name">Dispute Losses</span>
                                    <span class="item-amount">$2.1M/vessel</span>
                                    <p>33% of disputes fail manually</p>
                                </div>
                            </div>
                            <div class="category">
                                <h3>Hidden Costs</h3>
                                <div class="cost-item">
                                    <span class="item-name">Manual Processing</span>
                                    <span class="item-amount">$1.3M/vessel</span>
                                    <p>160 hours/week at $165/hour</p>
                                </div>
                                <div class="cost-item">
                                    <span class="item-name">Data Errors</span>
                                    <span class="item-amount">$0.5M/vessel</span>
                                    <p>4% error rate, $50/error</p>
                                </div>
                                <div class="cost-item">
                                    <span class="item-name">Missed Opportunities</span>
                                    <span class="item-amount">$0.8M/vessel</span>
                                    <p>Late filing, missed deadlines</p>
                                </div>
                            </div>
                        </div>
                        <div class="total-impact">
                            <h3>Total Addressable Cost per Vessel: $18.9M annually</h3>
                            <p>UIP eliminates 87% = <strong>$16.4M savings per vessel</strong></p>
                        </div>
                    </div>
                `,
                notes: "Show all the hidden costs they don't see. Make the problem bigger."
            },
            {
                id: "cfo-3",
                title: "5-Year Financial Projection",
                content: `
                    <div class="financial-projection">
                        <h2>5-Year Financial Impact Model</h2>
                        <canvas id="projectionChart"></canvas>
                        <div class="projection-summary">
                            <div class="projection-metrics">
                                <div class="metric">
                                    <h4>Cumulative Savings</h4>
                                    <div class="yearly-progression">
                                        <div class="year">
                                            <span class="label">Year 1</span>
                                            <span class="value">$685M</span>
                                        </div>
                                        <div class="year">
                                            <span class="label">Year 2</span>
                                            <span class="value">$1,412M</span>
                                        </div>
                                        <div class="year">
                                            <span class="label">Year 3</span>
                                            <span class="value">$2,183M</span>
                                        </div>
                                        <div class="year">
                                            <span class="label">Year 4</span>
                                            <span class="value">$3,001M</span>
                                        </div>
                                        <div class="year">
                                            <span class="label">Year 5</span>
                                            <span class="value">$3,867M</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="assumptions">
                                <h4>Conservative Assumptions:</h4>
                                <ul>
                                    <li>No fleet growth (static 50 vessels)</li>
                                    <li>No price increases from UIP</li>
                                    <li>3% annual inflation on savings</li>
                                    <li>Only 87% D&D prevention (vs 94% actual)</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Use conservative assumptions to build trust. Under-promise, over-deliver."
            },
            {
                id: "cfo-4",
                title: "Risk Analysis & Mitigation",
                content: `
                    <div class="risk-analysis">
                        <h2>Investment Risk Assessment</h2>
                        <div class="risk-matrix">
                            <div class="risk-item low">
                                <h3>Implementation Risk</h3>
                                <div class="risk-level">LOW</div>
                                <p><strong>Mitigation:</strong> 14-day implementation, 500+ successful deployments</p>
                            </div>
                            <div class="risk-item low">
                                <h3>Technology Risk</h3>
                                <div class="risk-level">LOW</div>
                                <p><strong>Mitigation:</strong> 99.99% uptime SLA, SOC 2 certified, redundant systems</p>
                            </div>
                            <div class="risk-item minimal">
                                <h3>Adoption Risk</h3>
                                <div class="risk-level">MINIMAL</div>
                                <p><strong>Mitigation:</strong> 2-hour training, automated workflows, 24/7 support</p>
                            </div>
                            <div class="risk-item minimal">
                                <h3>ROI Risk</h3>
                                <div class="risk-level">MINIMAL</div>
                                <p><strong>Mitigation:</strong> Guaranteed 3x ROI or money back, proven results</p>
                            </div>
                        </div>
                        <div class="guarantee">
                            <h3>UIP Performance Guarantee</h3>
                            <p>We guarantee minimum 3x ROI in Year 1 or we refund the difference</p>
                            <ul>
                                <li>✓ Contractual SLA on dispute success rate</li>
                                <li>✓ Monthly performance reporting</li>
                                <li>✓ Quarterly business reviews</li>
                                <li>✓ Dedicated success team</li>
                            </ul>
                        </div>
                    </div>
                `,
                notes: "Address risks upfront. Show our guarantee to remove purchase friction."
            }
        ]
    },

    // Industry-Specific Presentations
    retail: {
        title: "Retail & E-commerce Solution",
        duration: "25 minutes",
        slides: [
            {
                id: "retail-1",
                title: "Retail's Ocean Freight Crisis",
                content: `
                    <div class="retail-crisis">
                        <h2>Peak Season Losses Are Destroying Margins</h2>
                        <div class="retail-challenges">
                            <div class="challenge">
                                <div class="challenge-icon">📦</div>
                                <h3>Peak Season Chaos</h3>
                                <div class="stats">
                                    <div class="stat">3.2x higher D&D charges</div>
                                    <div class="stat">67% on-time delivery</div>
                                    <div class="stat">$28M lost in Q4 alone</div>
                                </div>
                            </div>
                            <div class="challenge">
                                <div class="challenge-icon">🏪</div>
                                <h3>Store Impact</h3>
                                <div class="stats">
                                    <div class="stat">23% stockout rate</div>
                                    <div class="stat">$4.2M lost sales/store</div>
                                    <div class="stat">17% customer churn</div>
                                </div>
                            </div>
                            <div class="challenge">
                                <div class="challenge-icon">💰</div>
                                <h3>Margin Pressure</h3>
                                <div class="stats">
                                    <div class="stat">D&D eating 3.7% margin</div>
                                    <div class="stat">Can't pass costs to consumers</div>
                                    <div class="stat">Competing on free shipping</div>
                                </div>
                            </div>
                        </div>
                        <div class="retail-case-study">
                            <h3>Case Study: Top 5 US Retailer</h3>
                            <div class="case-metrics">
                                <div class="before-after">
                                    <div class="before">
                                        <h4>Before UIP</h4>
                                        <ul>
                                            <li>$142M annual D&D charges</li>
                                            <li>62% on-time for Black Friday</li>
                                            <li>Manual tracking for 50K containers</li>
                                        </ul>
                                    </div>
                                    <div class="after">
                                        <h4>After UIP</h4>
                                        <ul>
                                            <li>$11M annual D&D (92% reduction)</li>
                                            <li>94% on-time delivery</li>
                                            <li>Real-time visibility, zero manual work</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `,
                notes: "Focus on peak season pain. Retailers live and die by Q4."
            }
        ]
    }
};