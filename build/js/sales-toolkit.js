class SalesToolkit {
 constructor() {
 this.currentDocument = null;
 this.documents = {
 'solution-overview': {
 title: 'UIP One-Page Solution Overview',
 content: this.getSolutionOverviewContent()
 },
 'tech-specs': {
 title: 'Technical Specifications',
 content: this.getTechSpecsContent()
 },
 'roi-worksheet': {
 title: 'ROI Calculation Worksheet',
 content: this.getROIWorksheetContent()
 },
 'battle-cards': {
 title: 'Competitive Battle Cards',
 content: this.getBattleCardsContent()
 },
 'implementation-timeline': {
 title: 'Implementation Timeline',
 content: this.getImplementationTimelineContent()
 },
 'security-compliance': {
 title: 'Security & Compliance Fact Sheet',
 content: this.getSecurityComplianceContent()
 },
 'integration-matrix': {
 title: 'Integration Capability Matrix',
 content: this.getIntegrationMatrixContent()
 },
 'discovery-questions': {
 title: 'Discovery Question Framework',
 content: this.getDiscoveryQuestionsContent()
 },
 'buyer-personas': {
 title: 'Buyer Persona Guides',
 content: this.getBuyerPersonasContent()
 }
 };
 this.init();
 }
 init() {
 const downloadAllBtn = document.getElementById('downloadAll');
 if (downloadAllBtn) {
 downloadAllBtn.addEventListener('click', () => this.downloadAllDocuments());
 }
 window.viewDocument = (docId) => this.viewDocument(docId);
 window.downloadDocument = (docId) => this.downloadDocument(docId);
 window.closeViewer = () => this.closeViewer();
 }
 viewDocument(docId) {
 const doc = this.documents[docId];
 if (!doc) return;
 const viewer = document.getElementById('documentViewer');
 const title = document.getElementById('documentTitle');
 const content = document.getElementById('viewerContent');
 title.textContent = doc.title;
 content.innerHTML = `<div class="document-container">${doc.content}</div>`;
 viewer.classList.add('active');
 this.currentDocument = docId;
 if (docId === 'roi-worksheet') {
 this.initROICalculator();
 }
 }
 closeViewer() {
 const viewer = document.getElementById('documentViewer');
 viewer.classList.remove('active');
 this.currentDocument = null;
 }
 downloadDocument(docId) {
 const doc = this.documents[docId];
 if (!doc) return;
 const tempDiv = document.createElement('div');
 tempDiv.innerHTML = doc.content;
 const text = tempDiv.innerText;
 const blob = new Blob([text], { type: 'text/plain' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `UIP-${docId}.txt`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 }
 downloadAllDocuments() {
 Object.keys(this.documents).forEach(docId => {
 setTimeout(() => this.downloadDocument(docId), 100);
 });
 }
 getSolutionOverviewContent() {
 return `
 <div class="solution-overview">
 <div class="overview-header">
 <img src="brand/logo.svg" alt="UIP" class="overview-logo">
 <h1 class="overview-title">Stop Losing $14M Per Vessel Annually</h1>
 <p class="overview-subtitle">The Only AI Platform That Eliminates Ocean Freight Inefficiencies</p>
 </div>
 <div class="key-metrics">
 <div class="metric">
 <span class="metric-value">$342M</span>
 <span class="metric-label">Saved for Customers</span>
 </div>
 <div class="metric">
 <span class="metric-value">94%</span>
 <span class="metric-label">D&D Prevention</span>
 </div>
 <div class="metric">
 <span class="metric-value">14 Days</span>
 <span class="metric-label">Implementation</span>
 </div>
 <div class="metric">
 <span class="metric-value">200+</span>
 <span class="metric-label">Carrier Integrations</span>
 </div>
 </div>
 <div class="solution-sections">
 <div class="solution-section">
 <h3>🚨 The Problem</h3>
 <ul class="solution-points">
 <li>87% of detention & demurrage charges are preventable ($14.2M per vessel)</li>
 <li>200+ disconnected carrier systems require 160+ hours weekly manual work</li>
 <li>67% dispute success rate leaves millions on the table</li>
 <li>4% data error rate costs $50 per mistake</li>
 </ul>
 </div>
 <div class="solution-section">
 <h3>💡 Our Solution</h3>
 <ul class="solution-points">
 <li>Universal integration connects ALL carrier systems automatically</li>
 <li>AI predicts D&D risks 14 days in advance</li>
 <li>Automated dispute filing achieves 94% success rate</li>
 <li>Real-time visibility across your entire container fleet</li>
 </ul>
 </div>
 <div class="solution-section">
 <h3>🎯 Key Benefits</h3>
 <ul class="solution-points">
 <li>Save $14.2M annually per vessel in D&D charges</li>
 <li>Eliminate 160+ hours of manual work weekly</li>
 <li>Achieve 27.4x ROI with 13-day payback period</li>
 <li>Implement in 14 days with zero disruption</li>
 </ul>
 </div>
 <div class="solution-section">
 <h3>🏆 Why UIP Wins</h3>
 <ul class="solution-points">
 <li>Only platform with true universal carrier connectivity</li>
 <li>Fastest implementation in the industry (14 days vs 6+ months)</li>
 <li>Highest dispute success rate (94% vs 67% industry average)</li>
 <li>Guaranteed 3x ROI or money back</li>
 </ul>
 </div>
 </div>
 <div class="cta-section">
 <h3>Ready to Save $14M Per Vessel?</h3>
 <p>Contact: sales@uip.ai | (555) 123-4567 | uip.ai/demo</p>
 </div>
 </div>
 `;
 }
 getTechSpecsContent() {
 return `
 <div class="tech-specs">
 <h2>Technical Specifications</h2>
 <div class="spec-section">
 <h3>Platform Architecture</h3>
 <table class="spec-table">
 <tr>
 <td>Deployment Model</td>
 <td>Cloud-native SaaS (AWS/Azure/GCP)</td>
 </tr>
 <tr>
 <td>Architecture</td>
 <td>Microservices on Kubernetes</td>
 </tr>
 <tr>
 <td>Data Processing</td>
 <td>Apache Kafka, Spark Streaming</td>
 </tr>
 <tr>
 <td>AI/ML Framework</td>
 <td>TensorFlow, PyTorch, Custom Models</td>
 </tr>
 <tr>
 <td>API Gateway</td>
 <td>GraphQL, REST, WebSocket</td>
 </tr>
 <tr>
 <td>Database</td>
 <td>PostgreSQL, MongoDB, Redis</td>
 </tr>
 </table>
 </div>
 <div class="spec-section">
 <h3>Integration Capabilities</h3>
 <table class="spec-table">
 <tr>
 <td>API Protocols</td>
 <td>REST, GraphQL, SOAP, WebSocket</td>
 </tr>
 <tr>
 <td>EDI Standards</td>
 <td>X12 (315, 322, 350), EDIFACT</td>
 </tr>
 <tr>
 <td>Communication</td>
 <td>AS2, AS3, SFTP, HTTPS</td>
 </tr>
 <tr>
 <td>File Formats</td>
 <td>JSON, XML, CSV, Excel, PDF</td>
 </tr>
 <tr>
 <td>Email Processing</td>
 <td>IMAP, POP3, Exchange Web Services</td>
 </tr>
 </table>
 </div>
 <div class="spec-section">
 <h3>Security & Compliance</h3>
 <table class="spec-table">
 <tr>
 <td>Certifications</td>
 <td>SOC 2 Type II, ISO 27001, GDPR</td>
 </tr>
 <tr>
 <td>Encryption</td>
 <td>AES-256 at rest, TLS 1.3 in transit</td>
 </tr>
 <tr>
 <td>Authentication</td>
 <td>SSO, SAML 2.0, OAuth 2.0, MFA</td>
 </tr>
 <tr>
 <td>Audit Trail</td>
 <td>Complete audit logging, SIEM integration</td>
 </tr>
 <tr>
 <td>Availability</td>
 <td>99.99% uptime SLA</td>
 </tr>
 </table>
 </div>
 <div class="spec-section">
 <h3>Performance Specifications</h3>
 <table class="spec-table">
 <tr>
 <td>Container Processing</td>
 <td>1M+ containers/day capacity</td>
 </tr>
 <tr>
 <td>API Response Time</td>
 <td>&lt; 100ms p95</td>
 </tr>
 <tr>
 <td>Data Latency</td>
 <td>&lt; 5 minutes end-to-end</td>
 </tr>
 <tr>
 <td>Dispute Processing</td>
 <td>&lt; 3 minutes per dispute</td>
 </tr>
 <tr>
 <td>Scalability</td>
 <td>Auto-scaling, no container limits</td>
 </tr>
 </table>
 </div>
 <div class="spec-section">
 <h3>System Requirements</h3>
 <table class="spec-table">
 <tr>
 <td>Browser Support</td>
 <td>Chrome 90+, Firefox 88+, Safari 14+, Edge 90+</td>
 </tr>
 <tr>
 <td>Mobile Support</td>
 <td>iOS 13+, Android 10+</td>
 </tr>
 <tr>
 <td>Network</td>
 <td>Broadband internet (10+ Mbps)</td>
 </tr>
 <tr>
 <td>Integration Time</td>
 <td>14 days average implementation</td>
 </tr>
 </table>
 </div>
 </div>
 `;
 }
 getROIWorksheetContent() {
 return `
 <div class="roi-worksheet">
 <div class="worksheet-header">
 <h2>ROI Calculation Worksheet</h2>
 <p>Calculate your potential savings with UIP</p>
 </div>
 <div class="input-section">
 <h3>Your Current Operations</h3>
 <div class="input-grid">
 <div class="input-field">
 <label>Number of Vessels</label>
 <input type="number" id="roiVessels" value="50" min="1">
 </div>
 <div class="input-field">
 <label>Containers per Vessel/Year</label>
 <input type="number" id="roiContainers" value="2500" min="1">
 </div>
 <div class="input-field">
 <label>Average D&D per Container</label>
 <input type="number" id="roiDDCharge" value="850" min="1">
 </div>
 <div class="input-field">
 <label>D&D Incident Rate (%)</label>
 <input type="number" id="roiIncidentRate" value="12" min="1" max="100">
 </div>
 <div class="input-field">
 <label>Manual Hours per Week</label>
 <input type="number" id="roiManualHours" value="160" min="1">
 </div>
 <div class="input-field">
 <label>Hourly Labor Cost ($)</label>
 <input type="number" id="roiLaborCost" value="65" min="1">
 </div>
 </div>
 </div>
 <div class="calculation-section">
 <h3>Your Potential Savings</h3>
 <div class="calculation-row">
 <span class="calculation-label">Current Annual D&D Charges</span>
 <span class="calculation-value" id="currentDDCharges">$0</span>
 </div>
 <div class="calculation-row">
 <span class="calculation-label">Preventable D&D (87%)</span>
 <span class="calculation-value" id="preventableDD">$0</span>
 </div>
 <div class="calculation-row">
 <span class="calculation-label">Annual Labor Costs</span>
 <span class="calculation-value" id="laborCosts">$0</span>
 </div>
 <div class="calculation-row">
 <span class="calculation-label">Labor Savings (85% automation)</span>
 <span class="calculation-value" id="laborSavings">$0</span>
 </div>
 <div class="calculation-row">
 <span class="calculation-label">Additional Dispute Recovery</span>
 <span class="calculation-value" id="disputeRecovery">$0</span>
 </div>
 <div class="calculation-row total-row">
 <span class="calculation-label">Total Annual Savings</span>
 <span class="calculation-value" id="totalSavings">$0</span>
 </div>
 </div>
 <div class="roi-section">
 <h3>Investment Analysis</h3>
 <div class="calculation-row">
 <span class="calculation-label">UIP Annual Investment</span>
 <span class="calculation-value" id="uipInvestment">$0</span>
 </div>
 <div class="calculation-row">
 <span class="calculation-label">Net Annual Benefit</span>
 <span class="calculation-value" id="netBenefit">$0</span>
 </div>
 <div class="calculation-row">
 <span class="calculation-label">ROI Percentage</span>
 <span class="calculation-value" id="roiPercentage">0%</span>
 </div>
 <div class="calculation-row">
 <span class="calculation-label">Payback Period</span>
 <span class="calculation-value" id="paybackPeriod">0 days</span>
 </div>
 </div>
 </div>
 `;
 }
 getBattleCardsContent() {
 return `
 <div class="battle-cards">
 <h2>Competitive Battle Cards</h2>
 <div class="battle-card">
 <div class="competitor-header">
 <h3 class="competitor-name">vs. Legacy TMS Systems</h3>
 <span class="win-rate">Win Rate: 92%</span>
 </div>
 <div class="comparison-grid">
 <div class="comparison-column">
 <h4>Their Weaknesses</h4>
 <ul class="weakness-list">
 <li>6-12 month implementation</li>
 <li>Limited carrier coverage (20-30%)</li>
 <li>No predictive capabilities</li>
 <li>Manual dispute process</li>
 <li>Separate modules = higher cost</li>
 <li>Requires IT resources</li>
 </ul>
 </div>
 <div class="comparison-column">
 <h4>Our Advantages</h4>
 <ul class="strength-list">
 <li>14-day implementation</li>
 <li>200+ carrier integrations</li>
 <li>AI predicts issues 14 days early</li>
 <li>94% automated dispute success</li>
 <li>All-inclusive platform</li>
 <li>Zero IT effort required</li>
 </ul>
 </div>
 </div>
 <div class="objection-handling">
 <h4>Common Objections & Responses</h4>
 <div class="objection-item">
 <p class="objection">"We already have a TMS"</p>
 <p class="response">→ "Great! UIP complements your TMS by adding AI-powered D&D prevention. We integrate seamlessly and our customers see $14M savings per vessel even with existing systems."</p>
 </div>
 <div class="objection-item">
 <p class="objection">"Implementation will disrupt operations"</p>
 <p class="response">→ "Unlike TMS replacements that take 6-12 months, UIP deploys in 14 days with zero disruption. We connect to your existing systems without any changes required."</p>
 </div>
 </div>
 </div>
 <div class="battle-card">
 <div class="competitor-header">
 <h3 class="competitor-name">vs. In-House Development</h3>
 <span class="win-rate">Win Rate: 96%</span>
 </div>
 <div class="comparison-grid">
 <div class="comparison-column">
 <h4>Their Weaknesses</h4>
 <ul class="weakness-list">
 <li>12-18 month development time</li>
 <li>$2-5M initial investment</li>
 <li>Ongoing maintenance burden</li>
 <li>Limited to few carriers</li>
 <li>No AI/ML expertise</li>
 <li>High risk of failure</li>
 </ul>
 </div>
 <div class="comparison-column">
 <h4>Our Advantages</h4>
 <ul class="strength-list">
 <li>Ready in 14 days</li>
 <li>$500K/vessel/year subscription</li>
 <li>We handle all updates</li>
 <li>200+ carriers pre-integrated</li>
 <li>Proven AI with 94% success</li>
 <li>Guaranteed ROI</li>
 </ul>
 </div>
 </div>
 <div class="objection-handling">
 <h4>Common Objections & Responses</h4>
 <div class="objection-item">
 <p class="objection">"We prefer to build internally"</p>
 <p class="response">→ "Building carrier integrations is complex - we've invested 5 years and $50M. Why recreate the wheel when you can be saving $14M per vessel in just 14 days?"</p>
 </div>
 <div class="objection-item">
 <p class="objection">"We need custom features"</p>
 <p class="response">→ "UIP is built on feedback from 100+ enterprise shippers. Our platform is configurable and our APIs allow custom integrations while you benefit from continuous improvements."</p>
 </div>
 </div>
 </div>
 <div class="battle-card">
 <div class="competitor-header">
 <h3 class="competitor-name">vs. Manual Processes/Consultants</h3>
 <span class="win-rate">Win Rate: 98%</span>
 </div>
 <div class="comparison-grid">
 <div class="comparison-column">
 <h4>Their Weaknesses</h4>
 <ul class="weakness-list">
 <li>67% dispute success rate</li>
 <li>Can't scale with volume</li>
 <li>High error rate (4%+)</li>
 <li>Reactive, not predictive</li>
 <li>Expensive hourly billing</li>
 <li>Knowledge walks out door</li>
 </ul>
 </div>
 <div class="comparison-column">
 <h4>Our Advantages</h4>
 <ul class="strength-list">
 <li>94% dispute success rate</li>
 <li>Unlimited scalability</li>
 <li>99.9% accuracy</li>
 <li>Predict issues 14 days early</li>
 <li>Fixed per-vessel pricing</li>
 <li>AI learns and improves</li>
 </ul>
 </div>
 </div>
 <div class="objection-handling">
 <h4>Common Objections & Responses</h4>
 <div class="objection-item">
 <p class="objection">"Our team knows our business"</p>
 <p class="response">→ "Absolutely! UIP empowers your team by eliminating manual work so they can focus on strategic decisions. We turn your 160 hours of data entry into 160 hours of value creation."</p>
 </div>
 <div class="objection-item">
 <p class="objection">"Consultants give us flexibility"</p>
 <p class="response">→ "UIP gives you both automation and flexibility. Our AI handles routine disputes at 94% success while your team focuses on complex negotiations, armed with better data."</p>
 </div>
 </div>
 </div>
 </div>
 `;
 }
 getImplementationTimelineContent() {
 return `
 <div class="implementation-timeline">
 <h2>14-Day Implementation Timeline</h2>
 <div class="timeline-overview">
 <p class="timeline-intro">From contract to full automation in just 14 days - the fastest in the industry</p>
 </div>
 <div class="timeline-phases">
 <div class="phase">
 <div class="phase-header">
 <span class="phase-number">Phase 1</span>
 <span class="phase-days">Days 1-3</span>
 <h3>Discovery & Setup</h3>
 </div>
 <div class="phase-content">
 <h4>Activities:</h4>
 <ul>
 <li>Kickoff call with stakeholders</li>
 <li>Current state assessment</li>
 <li>Carrier system inventory</li>
 <li>API credential gathering</li>
 <li>User account provisioning</li>
 </ul>
 <h4>Deliverables:</h4>
 <ul>
 <li>✓ Integration roadmap</li>
 <li>✓ User access configured</li>
 <li>✓ Project timeline confirmed</li>
 </ul>
 <div class="phase-owner">Owner: UIP Implementation Team</div>
 </div>
 </div>
 <div class="phase">
 <div class="phase-header">
 <span class="phase-number">Phase 2</span>
 <span class="phase-days">Days 4-7</span>
 <h3>Integration & Configuration</h3>
 </div>
 <div class="phase-content">
 <h4>Activities:</h4>
 <ul>
 <li>Connect carrier APIs</li>
 <li>Configure EDI connections</li>
 <li>Set up email parsing</li>
 <li>Historical data import</li>
 <li>Business rules configuration</li>
 </ul>
 <h4>Deliverables:</h4>
 <ul>
 <li>✓ All carriers connected</li>
 <li>✓ Historical data loaded</li>
 <li>✓ Automation rules active</li>
 </ul>
 <div class="phase-owner">Owner: UIP Technical Team</div>
 </div>
 </div>
 <div class="phase">
 <div class="phase-header">
 <span class="phase-number">Phase 3</span>
 <span class="phase-days">Days 8-10</span>
 <h3>Testing & Training</h3>
 </div>
 <div class="phase-content">
 <h4>Activities:</h4>
 <ul>
 <li>End-to-end testing</li>
 <li>User acceptance testing</li>
 <li>Team training sessions (2 hours)</li>
 <li>Process documentation</li>
 <li>Dispute automation testing</li>
 </ul>
 <h4>Deliverables:</h4>
 <ul>
 <li>✓ All workflows validated</li>
 <li>✓ Team fully trained</li>
 <li>✓ Documentation complete</li>
 </ul>
 <div class="phase-owner">Owner: Joint Team</div>
 </div>
 </div>
 <div class="phase">
 <div class="phase-header">
 <span class="phase-number">Phase 4</span>
 <span class="phase-days">Days 11-14</span>
 <h3>Go-Live & Optimization</h3>
 </div>
 <div class="phase-content">
 <h4>Activities:</h4>
 <ul>
 <li>Production go-live</li>
 <li>Hypercare support</li>
 <li>Performance monitoring</li>
 <li>Quick wins identification</li>
 <li>Success metrics review</li>
 </ul>
 <h4>Deliverables:</h4>
 <ul>
 <li>✓ Full automation active</li>
 <li>✓ First disputes filed</li>
 <li>✓ ROI tracking enabled</li>
 </ul>
 <div class="phase-owner">Owner: UIP Success Team</div>
 </div>
 </div>
 </div>
 <div class="success-metrics">
 <h3>Success Metrics by Day 30</h3>
 <div class="metrics-grid">
 <div class="metric-item">
 <span class="metric-value">100%</span>
 <span class="metric-label">Carrier Coverage</span>
 </div>
 <div class="metric-item">
 <span class="metric-value">94%</span>
 <span class="metric-label">Dispute Success</span>
 </div>
 <div class="metric-item">
 <span class="metric-value">$2.4M</span>
 <span class="metric-label">Identified Savings</span>
 </div>
 <div class="metric-item">
 <span class="metric-value">160hr</span>
 <span class="metric-label">Time Saved</span>
 </div>
 </div>
 </div>
 </div>
 `;
 }
 getSecurityComplianceContent() {
 return `
 <div class="security-compliance">
 <h2>Security & Compliance Fact Sheet</h2>
 <div class="security-overview">
 <p class="intro">UIP maintains the highest standards of security and compliance for enterprise ocean freight operations</p>
 </div>
 <div class="certifications">
 <h3>Certifications & Attestations</h3>
 <div class="cert-grid">
 <div class="cert-item">
 <div class="cert-icon">🛡️</div>
 <h4>SOC 2 Type II</h4>
 <p>Annual audit covering security, availability, processing integrity, confidentiality, and privacy</p>
 <span class="cert-date">Last Audit: October 2024</span>
 </div>
 <div class="cert-item">
 <div class="cert-icon">🏅</div>
 <h4>ISO 27001:2013</h4>
 <p>Information security management system certification</p>
 <span class="cert-date">Valid Through: December 2025</span>
 </div>
 <div class="cert-item">
 <div class="cert-icon">🇪🇺</div>
 <h4>GDPR Compliant</h4>
 <p>Full compliance with EU data protection regulations</p>
 <span class="cert-date">Privacy Shield Certified</span>
 </div>
 <div class="cert-item">
 <div class="cert-icon">🔒</div>
 <h4>NIST Framework</h4>
 <p>Aligned with NIST Cybersecurity Framework</p>
 <span class="cert-date">Continuous Compliance</span>
 </div>
 </div>
 </div>
 <div class="security-features">
 <h3>Security Architecture</h3>
 <table class="security-table">
 <tr>
 <td><strong>Data Encryption</strong></td>
 <td>
 • AES-256 encryption at rest<br>
 • TLS 1.3 for data in transit<br>
 • Hardware security modules (HSM) for key management
 </td>
 </tr>
 <tr>
 <td><strong>Access Control</strong></td>
 <td>
 • Single Sign-On (SSO) with SAML 2.0<br>
 • Multi-factor authentication (MFA) required<br>
 • Role-based access control (RBAC)<br>
 • Session management and timeout controls
 </td>
 </tr>
 <tr>
 <td><strong>Infrastructure</strong></td>
 <td>
 • Multi-region deployment on AWS<br>
 • Private VPC with network isolation<br>
 • Web Application Firewall (WAF)<br>
 • DDoS protection
 </td>
 </tr>
 <tr>
 <td><strong>Monitoring</strong></td>
 <td>
 • 24/7 Security Operations Center (SOC)<br>
 • Real-time threat detection<br>
 • SIEM integration<br>
 • Automated incident response
 </td>
 </tr>
 </table>
 </div>
 <div class="compliance-features">
 <h3>Compliance & Governance</h3>
 <table class="compliance-table">
 <tr>
 <td><strong>Data Residency</strong></td>
 <td>Customer choice of data location: US, EU, APAC regions</td>
 </tr>
 <tr>
 <td><strong>Data Retention</strong></td>
 <td>Configurable retention policies, automated data deletion</td>
 </tr>
 <tr>
 <td><strong>Audit Trail</strong></td>
 <td>Complete audit logging of all system activities</td>
 </tr>
 <tr>
 <td><strong>Right to Delete</strong></td>
 <td>GDPR-compliant data deletion within 30 days</td>
 </tr>
 <tr>
 <td><strong>Data Portability</strong></td>
 <td>Export all data in standard formats anytime</td>
 </tr>
 </table>
 </div>
 <div class="security-practices">
 <h3>Security Best Practices</h3>
 <ul class="practices-list">
 <li>Annual third-party penetration testing</li>
 <li>Continuous vulnerability scanning</li>
 <li>Security awareness training for all employees</li>
 <li>Incident response plan with &lt;1 hour RTO</li>
 <li>Business continuity and disaster recovery testing</li>
 <li>Vendor security assessments</li>
 <li>Regular security patches and updates</li>
 </ul>
 </div>
 <div class="availability">
 <h3>Platform Availability</h3>
 <div class="availability-stats">
 <div class="stat">
 <span class="stat-value">99.99%</span>
 <span class="stat-label">Uptime SLA</span>
 </div>
 <div class="stat">
 <span class="stat-value">&lt; 5min</span>
 <span class="stat-label">RTO</span>
 </div>
 <div class="stat">
 <span class="stat-value">&lt; 1hr</span>
 <span class="stat-label">RPO</span>
 </div>
 <div class="stat">
 <span class="stat-value">24/7</span>
 <span class="stat-label">Support</span>
 </div>
 </div>
 </div>
 </div>
 `;
 }
 getIntegrationMatrixContent() {
 return `
 <div class="integration-matrix">
 <h2>Integration Capability Matrix</h2>
 <div class="matrix-overview">
 <p>UIP connects to 200+ carrier systems through multiple integration methods</p>
 </div>
 <div class="integration-stats">
 <div class="stat">
 <span class="stat-number">200+</span>
 <span class="stat-label">Carriers Connected</span>
 </div>
 <div class="stat">
 <span class="stat-number">97%</span>
 <span class="stat-label">Global Coverage</span>
 </div>
 <div class="stat">
 <span class="stat-number">4</span>
 <span class="stat-label">Integration Methods</span>
 </div>
 <div class="stat">
 <span class="stat-number">Real-time</span>
 <span class="stat-label">Data Updates</span>
 </div>
 </div>
 <div class="carrier-table">
 <h3>Major Carrier Integrations</h3>
 <table>
 <thead>
 <tr>
 <th>Carrier</th>
 <th>API</th>
 <th>EDI</th>
 <th>Email</th>
 <th>Portal</th>
 <th>Features</th>
 </tr>
 </thead>
 <tbody>
 <tr>
 <td>Maersk</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>Track & Trace, D&D, Booking, Documentation</td>
 </tr>
 <tr>
 <td>MSC</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>myMSC API, Container Events, Invoices</td>
 </tr>
 <tr>
 <td>CMA CGM</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>eBusiness Suite, Real-time Tracking</td>
 </tr>
 <tr>
 <td>Hapag-Lloyd</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>Navigator API, Quick Quotes, D&D</td>
 </tr>
 <tr>
 <td>ONE</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>eCommerce Platform, Detention Data</td>
 </tr>
 <tr>
 <td>Evergreen</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>ShipmentLink, Invoice Management</td>
 </tr>
 <tr>
 <td>COSCO</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>COSCO Syncon, D&D Notifications</td>
 </tr>
 <tr>
 <td>Yang Ming</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>✓</td>
 <td>E-Service, Container Status</td>
 </tr>
 </tbody>
 </table>
 </div>
 <div class="integration-methods">
 <h3>Integration Methods</h3>
 <div class="method-grid">
 <div class="method">
 <h4>🔌 API Integration</h4>
 <ul>
 <li>Real-time data synchronization</li>
 <li>Bi-directional communication</li>
 <li>REST, GraphQL, SOAP support</li>
 <li>Webhook notifications</li>
 <li>Rate limiting handled</li>
 </ul>
 </div>
 <div class="method">
 <h4>📡 EDI Processing</h4>
 <ul>
 <li>X12 and EDIFACT standards</li>
 <li>AS2/AS3 protocols</li>
 <li>VAN connectivity</li>
 <li>Automated translation</li>
 <li>Error handling & retry</li>
 </ul>
 </div>
 <div class="method">
 <h4>📧 Email Intelligence</h4>
 <ul>
 <li>AI-powered parsing</li>
 <li>99.9% accuracy</li>
 <li>Attachment processing</li>
 <li>Multi-language support</li>
 <li>Auto-categorization</li>
 </ul>
 </div>
 <div class="method">
 <h4>🤖 RPA/OCR</h4>
 <ul>
 <li>Portal automation</li>
 <li>Document extraction</li>
 <li>Invoice processing</li>
 <li>PDF/Image parsing</li>
 <li>Human validation</li>
 </ul>
 </div>
 </div>
 </div>
 <div class="data-types">
 <h3>Supported Data Types</h3>
 <div class="data-grid">
 <div class="data-category">
 <h4>Container Events</h4>
 <ul>
 <li>Gate in/out</li>
 <li>Load/discharge</li>
 <li>Rail/truck moves</li>
 <li>Customs clearance</li>
 <li>Empty return</li>
 </ul>
 </div>
 <div class="data-category">
 <h4>Commercial Data</h4>
 <ul>
 <li>D&D invoices</li>
 <li>Rate agreements</li>
 <li>Booking confirmations</li>
 <li>Bill of lading</li>
 <li>Payment status</li>
 </ul>
 </div>
 <div class="data-category">
 <h4>Operational Data</h4>
 <ul>
 <li>Vessel schedules</li>
 <li>Port congestion</li>
 <li>Equipment availability</li>
 <li>Free time remaining</li>
 <li>Terminal data</li>
 </ul>
 </div>
 </div>
 </div>
 <div class="technical-specs">
 <h3>Technical Specifications</h3>
 <table class="specs-table">
 <tr>
 <td>Update Frequency</td>
 <td>Real-time (API), 5-min (EDI), 1-min (Email)</td>
 </tr>
 <tr>
 <td>Data Formats</td>
 <td>JSON, XML, CSV, EDI, PDF, Excel</td>
 </tr>
 <tr>
 <td>Security</td>
 <td>OAuth 2.0, API Keys, IP Whitelisting</td>
 </tr>
 <tr>
 <td>Rate Limits</td>
 <td>Handled automatically, no throttling</td>
 </tr>
 <tr>
 <td>Uptime</td>
 <td>99.99% availability SLA</td>
 </tr>
 </table>
 </div>
 </div>
 `;
 }
 getDiscoveryQuestionsContent() {
 return `
 <div class="discovery-questions">
 <h2>Discovery Question Framework</h2>
 <p class="framework-intro">MEDDIC-based qualification framework for ocean freight opportunities</p>
 <div class="question-categories">
 <div class="category">
 <h3>📊 Metrics - Quantify the Pain</h3>
 <div class="questions">
 <div class="question-item">
 <p class="question">How many vessels/containers do you manage annually?</p>
 <p class="purpose">→ Establishes scale for ROI calculation</p>
 </div>
 <div class="question-item">
 <p class="question">What are your current annual D&D charges?</p>
 <p class="purpose">→ Identifies immediate savings opportunity</p>
 </div>
 <div class="question-item">
 <p class="question">How many hours does your team spend on carrier portals weekly?</p>
 <p class="purpose">→ Quantifies labor savings potential</p>
 </div>
 <div class="question-item">
 <p class="question">What's your current dispute success rate?</p>
 <p class="purpose">→ Shows improvement opportunity (industry avg: 67%)</p>
 </div>
 <div class="question-item">
 <p class="question">How often do you miss dispute filing deadlines?</p>
 <p class="purpose">→ Highlights automation value</p>
 </div>
 </div>
 </div>
 <div class="category">
 <h3>💰 Economic Buyer - Find the Money</h3>
 <div class="questions">
 <div class="question-item">
 <p class="question">Who has budget authority for supply chain optimization?</p>
 <p class="purpose">→ Identifies the economic buyer</p>
 </div>
 <div class="question-item">
 <p class="question">What's driving the need for change? (margins, growth, competition)</p>
 <p class="purpose">→ Uncovers business drivers</p>
 </div>
 <div class="question-item">
 <p class="question">How do you currently budget for D&D charges?</p>
 <p class="purpose">→ Shows where savings will impact</p>
 </div>
 <div class="question-item">
 <p class="question">What ROI threshold do investments need to meet?</p>
 <p class="purpose">→ Ensures we exceed requirements (27.4x ROI)</p>
 </div>
 </div>
 </div>
 <div class="category">
 <h3>🎯 Decision Criteria - Understand Requirements</h3>
 <div class="questions">
 <div class="question-item">
 <p class="question">What's most important: cost savings, efficiency, or visibility?</p>
 <p class="purpose">→ Aligns our messaging</p>
 </div>
 <div class="question-item">
 <p class="question">What carriers must we integrate with?</p>
 <p class="purpose">→ Confirms coverage (we have 200+)</p>
 </div>
 <div class="question-item">
 <p class="question">What are your security/compliance requirements?</p>
 <p class="purpose">→ Addresses with SOC 2, ISO 27001</p>
 </div>
 <div class="question-item">
 <p class="question">How quickly do you need to see results?</p>
 <p class="purpose">→ Highlights 14-day implementation</p>
 </div>
 </div>
 </div>
 <div class="category">
 <h3>⚙️ Decision Process - Map the Journey</h3>
 <div class="questions">
 <div class="question-item">
 <p class="question">Walk me through your typical software evaluation process</p>
 <p class="purpose">→ Understand steps and timeline</p>
 </div>
 <div class="question-item">
 <p class="question">Who else needs to be involved in this decision?</p>
 <p class="purpose">→ Identifies all stakeholders</p>
 </div>
 <div class="question-item">
 <p class="question">What happened with your last supply chain technology purchase?</p>
 <p class="purpose">→ Learn from past experiences</p>
 </div>
 <div class="question-item">
 <p class="question">What could derail this project?</p>
 <p class="purpose">→ Uncover hidden obstacles</p>
 </div>
 </div>
 </div>
 <div class="category">
 <h3>🔍 Identify Pain - Dig Deeper</h3>
 <div class="questions">
 <div class="question-item">
 <p class="question">Tell me about your worst D&D charge experience</p>
 <p class="purpose">→ Makes pain tangible</p>
 </div>
 <div class="question-item">
 <p class="question">How does poor container visibility impact your business?</p>
 <p class="purpose">→ Expands beyond just D&D</p>
 </div>
 <div class="question-item">
 <p class="question">What would you do with 160 hours of freed-up time weekly?</p>
 <p class="purpose">→ Shows transformation opportunity</p>
 </div>
 <div class="question-item">
 <p class="question">How are D&D charges affecting your competitiveness?</p>
 <p class="purpose">→ Links to strategic goals</p>
 </div>
 </div>
 </div>
 <div class="category">
 <h3>🏆 Champion - Build Internal Support</h3>
 <div class="questions">
 <div class="question-item">
 <p class="question">Who would be most excited about solving this problem?</p>
 <p class="purpose">→ Identifies potential champion</p>
 </div>
 <div class="question-item">
 <p class="question">How can I help you build the business case internally?</p>
 <p class="purpose">→ Provides tools for success</p>
 </div>
 <div class="question-item">
 <p class="question">What objections might come up from IT/Finance/Ops?</p>
 <p class="purpose">→ Prepares champion with answers</p>
 </div>
 <div class="question-item">
 <p class="question">What would make you a hero in your organization?</p>
 <p class="purpose">→ Aligns personal and business wins</p>
 </div>
 </div>
 </div>
 </div>
 <div class="red-flags">
 <h3>🚩 Disqualification Red Flags</h3>
 <ul>
 <li>&lt; 10 vessels (too small for enterprise solution)</li>
 <li>No budget allocated for optimization</li>
 <li>Recent investment in competing solution (&lt; 12 months)</li>
 <li>No executive sponsor identified</li>
 <li>Timeline beyond 6 months (not urgent)</li>
 </ul>
 </div>
 <div class="next-steps">
 <h3>✅ Qualified? Next Steps:</h3>
 <ol>
 <li>Schedule Technical Deep Dive with IT stakeholder</li>
 <li>Provide ROI analysis with their specific data</li>
 <li>Arrange Executive Briefing for economic buyer</li>
 <li>Offer 30-day pilot program</li>
 </ol>
 </div>
 </div>
 `;
 }
 getBuyerPersonasContent() {
 return `
 <div class="buyer-personas">
 <h2>Buyer Persona Guides</h2>
 <div class="persona">
 <div class="persona-header">
 <h3>👔 Chief Financial Officer (CFO)</h3>
 <span class="influence-level">Decision Maker</span>
 </div>
 <div class="persona-details">
 <div class="persona-section">
 <h4>Profile</h4>
 <ul>
 <li>Focused on margin improvement and cost reduction</li>
 <li>Evaluates investments based on ROI and payback period</li>
 <li>Concerned about hidden supply chain costs</li>
 <li>Reports to CEO/Board on operational efficiency</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Pain Points</h4>
 <ul>
 <li>📊 D&D charges eroding margins by 3-5%</li>
 <li>💸 Unpredictable freight costs affecting budgets</li>
 <li>📈 Pressure to reduce operational expenses</li>
 <li>🎯 Lack of visibility into true logistics costs</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Key Messages</h4>
 <ul>
 <li>"27.4x ROI with 13-day payback period"</li>
 <li>"Guaranteed 3x ROI or your money back"</li>
 <li>"Turn unpredictable D&D into fixed costs"</li>
 <li>"Free up $14.2M per vessel for growth"</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Discovery Questions</h4>
 <ul>
 <li>What percentage of revenue goes to ocean freight?</li>
 <li>How do D&D charges impact your margins?</li>
 <li>What's your hurdle rate for new investments?</li>
 <li>How do you benchmark logistics costs?</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Objection Handling</h4>
 <div class="objection">
 <strong>Objection:</strong> "We don't have budget for new software"<br>
 <strong>Response:</strong> "UIP pays for itself in 13 days. We're not asking for new budget - we're giving you back $14M per vessel that you're already losing."
 </div>
 </div>
 </div>
 </div>
 <div class="persona">
 <div class="persona-header">
 <h3>📦 VP of Operations</h3>
 <span class="influence-level">Key Influencer</span>
 </div>
 <div class="persona-details">
 <div class="persona-section">
 <h4>Profile</h4>
 <ul>
 <li>Responsible for supply chain efficiency</li>
 <li>Manages logistics teams and carrier relationships</li>
 <li>Measured on on-time delivery and cost per container</li>
 <li>Deals with daily operational firefighting</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Pain Points</h4>
 <ul>
 <li>⏰ Team spending 160+ hours/week on manual tasks</li>
 <li>🚨 Learning about D&D charges too late</li>
 <li>📉 67% dispute success rate isn't good enough</li>
 <li>🔥 Constant firefighting instead of strategic work</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Key Messages</h4>
 <ul>
 <li>"See D&D risks 14 days before they hit"</li>
 <li>"Free your team from 160 hours of manual work"</li>
 <li>"94% dispute success rate on autopilot"</li>
 <li>"One dashboard for all carriers"</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Discovery Questions</h4>
 <ul>
 <li>How many carrier portals does your team access daily?</li>
 <li>What's your biggest operational challenge?</li>
 <li>How do you track container milestones today?</li>
 <li>What would you do with 160 freed hours weekly?</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Objection Handling</h4>
 <div class="objection">
 <strong>Objection:</strong> "My team knows our processes"<br>
 <strong>Response:</strong> "Absolutely! UIP amplifies their expertise by eliminating manual work. They'll shift from data entry to strategic optimization."
 </div>
 </div>
 </div>
 </div>
 <div class="persona">
 <div class="persona-header">
 <h3>💻 IT Director/CTO</h3>
 <span class="influence-level">Technical Evaluator</span>
 </div>
 <div class="persona-details">
 <div class="persona-section">
 <h4>Profile</h4>
 <ul>
 <li>Guards technology stack and security</li>
 <li>Evaluates integration complexity</li>
 <li>Concerned about implementation resources</li>
 <li>Wants minimal maintenance burden</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Pain Points</h4>
 <ul>
 <li>🔧 Too many integration projects in queue</li>
 <li>🔒 Security and compliance requirements</li>
 <li>👥 Limited IT resources for new projects</li>
 <li>🔌 Complex carrier system integrations</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Key Messages</h4>
 <ul>
 <li>"Zero IT effort - we handle everything"</li>
 <li>"SOC 2 Type II and ISO 27001 certified"</li>
 <li>"Pre-built integrations with 200+ carriers"</li>
 <li>"Cloud-native SaaS, no infrastructure"</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Discovery Questions</h4>
 <ul>
 <li>What's your current integration backlog?</li>
 <li>What are your security requirements?</li>
 <li>How do you handle carrier EDI today?</li>
 <li>What's your preferred deployment model?</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Objection Handling</h4>
 <div class="objection">
 <strong>Objection:</strong> "We don't have resources for integration"<br>
 <strong>Response:</strong> "That's exactly why we built UIP. Zero IT effort required. Our team handles all integrations in 14 days while your team focuses on priorities."
 </div>
 </div>
 </div>
 </div>
 <div class="persona">
 <div class="persona-header">
 <h3><img src="/brand/logo-icon.svg" alt="UIP" style="height: 24px; width: 24px; vertical-align: middle;"> Logistics Manager</h3>
 <span class="influence-level">Daily User / Champion</span>
 </div>
 <div class="persona-details">
 <div class="persona-section">
 <h4>Profile</h4>
 <ul>
 <li>Hands-on container tracking daily</li>
 <li>Manages carrier relationships</li>
 <li>First to hear about problems</li>
 <li>Wants tools that actually work</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Pain Points</h4>
 <ul>
 <li>😫 Logging into 12+ carrier portals daily</li>
 <li>⏰ Always behind on dispute deadlines</li>
 <li>📞 Constant carrier follow-ups</li>
 <li>🔍 No visibility until it's too late</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Key Messages</h4>
 <ul>
 <li>"Never log into another carrier portal"</li>
 <li>"Get alerts 14 days before charges hit"</li>
 <li>"File disputes with one click"</li>
 <li>"Track every container in real-time"</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Discovery Questions</h4>
 <ul>
 <li>Walk me through your daily routine</li>
 <li>What's your biggest time waster?</li>
 <li>How often do you miss D&D deadlines?</li>
 <li>What would make your job easier?</li>
 </ul>
 </div>
 <div class="persona-section">
 <h4>Building Champions</h4>
 <ul>
 <li>Show them the actual dashboard early</li>
 <li>Calculate their personal time savings</li>
 <li>Make them the hero of the story</li>
 <li>Provide materials to sell internally</li>
 </ul>
 </div>
 </div>
 </div>
 <div class="messaging-matrix">
 <h3>Messaging by Persona</h3>
 <table>
 <thead>
 <tr>
 <th>Persona</th>
 <th>Primary Message</th>
 <th>Proof Point</th>
 <th>Call to Action</th>
 </tr>
 </thead>
 <tbody>
 <tr>
 <td>CFO</td>
 <td>27.4x ROI guaranteed</td>
 <td>$342M saved for customers</td>
 <td>See ROI calculation</td>
 </tr>
 <tr>
 <td>VP Ops</td>
 <td>Prevent 94% of D&D</td>
 <td>14-day advance warnings</td>
 <td>See live dashboard</td>
 </tr>
 <tr>
 <td>IT Director</td>
 <td>Zero IT effort</td>
 <td>14-day implementation</td>
 <td>Review security docs</td>
 </tr>
 <tr>
 <td>Logistics Mgr</td>
 <td>Save 160 hours/week</td>
 <td>One-click disputes</td>
 <td>Try live demo</td>
 </tr>
 </tbody>
 </table>
 </div>
 </div>
 `;
 }
 initROICalculator() {
 const inputs = [
 'roiVessels', 'roiContainers', 'roiDDCharge', 
 'roiIncidentRate', 'roiManualHours', 'roiLaborCost'
 ];
 inputs.forEach(id => {
 const input = document.getElementById(id);
 if (input) {
 input.addEventListener('input', () => this.calculateROI());
 }
 });
 this.calculateROI();
 }
 calculateROI() {
 const vessels = parseFloat(document.getElementById('roiVessels')?.value) || 50;
 const containers = parseFloat(document.getElementById('roiContainers')?.value) || 2500;
 const ddCharge = parseFloat(document.getElementById('roiDDCharge')?.value) || 850;
 const incidentRate = parseFloat(document.getElementById('roiIncidentRate')?.value) / 100 || 0.12;
 const manualHours = parseFloat(document.getElementById('roiManualHours')?.value) || 160;
 const laborCost = parseFloat(document.getElementById('roiLaborCost')?.value) || 65;
 const totalContainers = vessels * containers;
 const ddIncidents = totalContainers * incidentRate;
 const currentDDCharges = ddIncidents * ddCharge;
 const annualLaborCosts = manualHours * laborCost * 52; // 52 weeks
 const preventableDD = currentDDCharges * 0.87; // 87% preventable
 const laborSavings = annualLaborCosts * 0.85; // 85% automation
 const disputeRecovery = currentDDCharges * 0.13 * 0.27; // Additional 27% recovery on remaining
 const totalSavings = preventableDD + laborSavings + disputeRecovery;
 const uipInvestment = vessels * 500000; // $500K per vessel
 const netBenefit = totalSavings - uipInvestment;
 const roiPercentage = (netBenefit / uipInvestment * 100).toFixed(0);
 const paybackDays = Math.round(uipInvestment / (totalSavings / 365));
 this.updateValue('currentDDCharges', this.formatCurrency(currentDDCharges));
 this.updateValue('preventableDD', this.formatCurrency(preventableDD));
 this.updateValue('laborCosts', this.formatCurrency(annualLaborCosts));
 this.updateValue('laborSavings', this.formatCurrency(laborSavings));
 this.updateValue('disputeRecovery', this.formatCurrency(disputeRecovery));
 this.updateValue('totalSavings', this.formatCurrency(totalSavings));
 this.updateValue('uipInvestment', this.formatCurrency(uipInvestment));
 this.updateValue('netBenefit', this.formatCurrency(netBenefit));
 this.updateValue('roiPercentage', roiPercentage + '%');
 this.updateValue('paybackPeriod', paybackDays + ' days');
 }
 formatCurrency(value) {
 return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
 }
 updateValue(id, value) {
 const element = document.getElementById(id);
 if (element) {
 element.textContent = value;
 }
 }
}
document.addEventListener('DOMContentLoaded', () => {
 const toolkit = new SalesToolkit();
});