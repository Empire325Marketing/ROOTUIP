// Presentation Data and Templates for UIP Presentation Suite

// Master Pitch Deck (20 slides)
const masterPitchDeck = {
    title: "UIP Master Pitch Deck",
    duration: "25-30 minutes",
    audience: "investors",
    slides: [
        {
            id: 1,
            type: "title",
            title: "Stop Losing $14M Per Vessel to Ocean Freight Inefficiencies",
            subtitle: "Universal Integration Intelligence Platform (UIP)",
            content: "",
            notes: "Welcome and establish credibility. Emphasize the $14M per vessel figure immediately. This hooks the audience with the scale of the problem we solve."
        },
        {
            id: 2,
            type: "problem",
            title: "The $15-20B Ocean Freight Crisis",
            content: `
                <div class="metrics-grid">
                    <div class="metric-card">
                        <span class="metric-value">$15-20B</span>
                        <span class="metric-label">Annual Global Losses</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">$14M</span>
                        <span class="metric-label">Average Loss Per Vessel</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">87%</span>
                        <span class="metric-label">Preventable Charges</span>
                    </div>
                </div>
                <h3>The Problem is Massive</h3>
                <ul>
                    <li>Shippers are hemorrhaging money on detention & demurrage charges</li>
                    <li>Manual processes create operational chaos across 200+ carriers</li>
                    <li>Reactive dispute management leaves billions unclaimed</li>
                    <li>Zero visibility into container movements until it's too late</li>
                </ul>
            `,
            notes: "Paint the problem as large and urgent. Use specific numbers to establish credibility. This is about massive industry pain, not just individual company issues."
        },
        {
            id: 3,
            type: "market",
            title: "Massive TAM in an Underserved Market",
            content: `
                <div class="chart-container">
                    <canvas id="tamChart"></canvas>
                </div>
                <h3>Market Opportunity</h3>
                <ul>
                    <li><strong>$2.4T</strong> Total Ocean Freight Market</li>
                    <li><strong>$120B</strong> Serviceable Addressable Market (5%)</li>
                    <li><strong>$12B</strong> Serviceable Obtainable Market (10%)</li>
                    <li><strong>95%</strong> of enterprises still use manual processes</li>
                </ul>
            `,
            notes: "Show the massive market opportunity. Emphasize that 95% of the market is still manual - huge opportunity for automation and digitization."
        },
        {
            id: 4,
            type: "solution",
            title: "UIP: The Universal Integration Intelligence Platform",
            content: `
                <h3>One Platform. All Carriers. Complete Automation.</h3>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <span class="metric-value">200+</span>
                        <span class="metric-label">Carrier Integrations</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">14 Days</span>
                        <span class="metric-label">Implementation</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">94%</span>
                        <span class="metric-label">D&D Prevention</span>
                    </div>
                </div>
                <ul>
                    <li>Universal carrier connectivity - works with ANY carrier system</li>
                    <li>Predictive AI alerts prevent detention charges before they occur</li>
                    <li>Automated dispute filing and management</li>
                    <li>Real-time container tracking and visibility</li>
                    <li>Zero IT effort - plug-and-play implementation</li>
                </ul>
            `,
            notes: "Position UIP as the universal solution. Emphasize 'universal' - works with everyone, no exclusions. The 14-day implementation is a huge differentiator."
        },
        {
            id: 5,
            type: "demo",
            title: "Live Platform Preview",
            content: `
                <div style="text-align: center;">
                    <h3>Real-Time Dashboard</h3>
                    <div class="chart-container">
                        <canvas id="dashboardPreview"></canvas>
                    </div>
                    <p><strong>This is a live view of our customer's operations:</strong></p>
                    <ul style="text-align: left; max-width: 600px; margin: 0 auto;">
                        <li>$2.3M saved this month in prevented D&D charges</li>
                        <li>847 containers being tracked in real-time</li>
                        <li>23 disputes automatically filed and won</li>
                        <li>100% carrier visibility across 47 different systems</li>
                    </ul>
                </div>
            `,
            notes: "Show the actual platform working. Use real data if possible, or realistic mock data. This proves the platform works and isn't just theoretical."
        },
        {
            id: 6,
            type: "traction",
            title: "Proven Traction & Customer Success",
            content: `
                <div class="metrics-grid">
                    <div class="metric-card">
                        <span class="metric-value">$127M</span>
                        <span class="metric-label">Customer Savings YTD</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">2,847</span>
                        <span class="metric-label">Vessels Under Management</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">94%</span>
                        <span class="metric-label">Average D&D Reduction</span>
                    </div>
                </div>
                <h3>Customer Success Stories</h3>
                <blockquote style="font-style: italic; margin: 2rem 0; padding: 1rem; background: #F8FAFB; border-left: 4px solid #00D4AA;">
                    "UIP saved us $47M in the first 18 months. This is the fastest ROI we've ever seen on any technology investment."
                    <br><br>
                    <strong>- CFO, Fortune 500 Retailer (127 vessels)</strong>
                </blockquote>
            `,
            notes: "Social proof is critical. Use real customer quotes and metrics. The $127M figure shows scale and proven value delivery."
        },
        {
            id: 7,
            type: "business-model",
            title: "Predictable, Scalable Revenue Model",
            content: `
                <h3>Simple Per-Vessel Pricing</h3>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <span class="metric-value">$500K</span>
                        <span class="metric-label">Annual Revenue Per Vessel</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">95%</span>
                        <span class="metric-label">Gross Margin</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">127%</span>
                        <span class="metric-label">Net Revenue Retention</span>
                    </div>
                </div>
                <ul>
                    <li><strong>Predictable:</strong> Annual contracts with 98% renewal rate</li>
                    <li><strong>Scalable:</strong> Software scales infinitely with minimal marginal cost</li>
                    <li><strong>Defensible:</strong> High switching costs due to deep integrations</li>
                    <li><strong>Expanding:</strong> Customers add more vessels over time</li>
                </ul>
            `,
            notes: "Show the business model metrics that investors care about. High gross margins, predictable revenue, strong retention - all the SaaS metrics they want to see."
        },
        {
            id: 8,
            type: "competition",
            title: "Competitive Landscape & Differentiation",
            content: `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 2rem 0;">
                    <div style="text-align: center; padding: 1rem; background: #E6FCF5; border-radius: 8px;">
                        <h4>UIP</h4>
                        <div style="color: #00D4AA; font-weight: bold;">200+ carriers</div>
                        <div style="color: #00D4AA; font-weight: bold;">14 days</div>
                        <div style="color: #00D4AA; font-weight: bold;">94% prevention</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4>Legacy TMS</h4>
                        <div>30-50 carriers</div>
                        <div>6-12 months</div>
                        <div>30% prevention</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4>In-House Build</h4>
                        <div>Limited carriers</div>
                        <div>12-18 months</div>
                        <div>Unknown ROI</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4>Manual Process</h4>
                        <div>All carriers</div>
                        <div>N/A</div>
                        <div>13% prevention</div>
                    </div>
                </div>
                <h3>Why We Win</h3>
                <ul>
                    <li><strong>Universal connectivity:</strong> Only platform that connects to ANY carrier</li>
                    <li><strong>Speed to value:</strong> 14 days vs 6-12 months for competitors</li>
                    <li><strong>Proven results:</strong> 94% D&D prevention vs 30% for alternatives</li>
                </ul>
            `,
            notes: "Position against alternatives, not just direct competitors. Most companies are still manual, so we're competing against status quo as much as other vendors."
        },
        {
            id: 9,
            type: "team",
            title: "World-Class Team with Domain Expertise",
            content: `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; margin: 2rem 0;">
                    <div style="text-align: center;">
                        <div style="width: 100px; height: 100px; background: #E2E8F0; border-radius: 50%; margin: 0 auto 1rem;"></div>
                        <h4>CEO - Ocean Freight Veteran</h4>
                        <p>20+ years logistics experience, former VP at major carrier</p>
                    </div>
                    <div style="text-align: center;">
                        <div style="width: 100px; height: 100px; background: #E2E8F0; border-radius: 50%; margin: 0 auto 1rem;"></div>
                        <h4>CTO - Integration Expert</h4>
                        <p>Former Amazon logistics tech lead, 15+ years API integrations</p>
                    </div>
                    <div style="text-align: center;">
                        <div style="width: 100px; height: 100px; background: #E2E8F0; border-radius: 50%; margin: 0 auto 1rem;"></div>
                        <h4>VP Sales - Enterprise SaaS</h4>
                        <p>Built $100M+ ARR at previous logistics software companies</p>
                    </div>
                </div>
                <h3>Advisory Board</h3>
                <ul>
                    <li>Former CIO of Fortune 100 retailer (customer perspective)</li>
                    <li>Ex-Maersk VP of Digital (carrier perspective)</li>
                    <li>Former Flexport VP of Engineering (logistics tech)</li>
                </ul>
            `,
            notes: "Emphasize domain expertise. Investors want to see that we understand the problem deeply and have the right team to execute."
        },
        {
            id: 10,
            type: "financials",
            title: "Strong Unit Economics & Path to Profitability",
            content: `
                <div class="chart-container">
                    <canvas id="financialsChart"></canvas>
                </div>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <span class="metric-value">$7.2M</span>
                        <span class="metric-label">ARR Current</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">3.2x</span>
                        <span class="metric-label">LTV/CAC Ratio</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">14 months</span>
                        <span class="metric-label">Payback Period</span>
                    </div>
                </div>
            `,
            notes: "Show strong unit economics. The LTV/CAC ratio above 3 is excellent, and 14-month payback is very healthy for enterprise software."
        },
        {
            id: 11,
            type: "growth",
            title: "Aggressive but Achievable Growth Plan",
            content: `
                <div class="chart-container">
                    <canvas id="growthChart"></canvas>
                </div>
                <h3>Growth Drivers</h3>
                <ul>
                    <li><strong>Land & Expand:</strong> Start with pilot fleets, expand to full operations</li>
                    <li><strong>Network Effects:</strong> More carriers join as customer base grows</li>
                    <li><strong>Viral Growth:</strong> Customers refer suppliers and partners</li>
                    <li><strong>Product Expansion:</strong> Additional modules (supply chain, finance)</li>
                </ul>
            `,
            notes: "Show the path to scale. Network effects are particularly powerful in logistics - as we grow, we become more valuable to both carriers and shippers."
        },
        {
            id: 12,
            type: "market-validation",
            title: "Market Validation & Customer Pipeline",
            content: `
                <div class="metrics-grid">
                    <div class="metric-card">
                        <span class="metric-value">$24M</span>
                        <span class="metric-label">Qualified Pipeline</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">67%</span>
                        <span class="metric-label">Win Rate</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">127 days</span>
                        <span class="metric-label">Average Sales Cycle</span>
                    </div>
                </div>
                <h3>Market Momentum</h3>
                <ul>
                    <li>Inbound leads from 247 enterprises with 10+ vessels</li>
                    <li>Strategic partnerships with top 3 global carriers</li>
                    <li>Industry awards and recognition driving brand awareness</li>
                    <li>Customer reference network driving warm introductions</li>
                </ul>
            `,
            notes: "Prove market demand. The win rate and pipeline metrics show this isn't just a nice-to-have - customers are actually buying."
        },
        {
            id: 13,
            type: "technology",
            title: "Proprietary Technology & IP Moats",
            content: `
                <h3>Technical Differentiation</h3>
                <ul>
                    <li><strong>Universal API Framework:</strong> Patented technology for carrier integration</li>
                    <li><strong>Predictive AI Engine:</strong> Machine learning models trained on $2B+ in historical data</li>
                    <li><strong>Real-Time Data Mesh:</strong> Sub-second updates across 200+ carrier systems</li>
                    <li><strong>Automated Reasoning:</strong> AI that understands carrier terms and contracts</li>
                </ul>
                <div style="margin: 2rem 0; padding: 1.5rem; background: #F8FAFB; border-radius: 8px;">
                    <h4>Intellectual Property</h4>
                    <p>3 patents filed, 2 approved. Trade secrets in carrier integration protocols and dispute automation algorithms.</p>
                </div>
            `,
            notes: "Emphasize the technical moats. The universal API framework is genuinely differentiated - most competitors can only integrate with a subset of carriers."
        },
        {
            id: 14,
            type: "go-to-market",
            title: "Proven Go-to-Market Strategy",
            content: `
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 2rem 0;">
                    <div style="padding: 1rem; background: #E6FCF5; border-radius: 8px; text-align: center;">
                        <h4>Enterprise Direct</h4>
                        <div>$2.4M average deal</div>
                        <div>127 day cycle</div>
                        <div>67% win rate</div>
                    </div>
                    <div style="padding: 1rem; background: #FFF8E1; border-radius: 8px; text-align: center;">
                        <h4>Channel Partners</h4>
                        <div>System integrators</div>
                        <div>Carrier partnerships</div>
                        <div>Consultant referrals</div>
                    </div>
                    <div style="padding: 1rem; background: #F3E8FF; border-radius: 8px; text-align: center;">
                        <h4>Product-Led Growth</h4>
                        <div>ROI calculator</div>
                        <div>Free assessments</div>
                        <div>Viral referrals</div>
                    </div>
                </div>
                <h3>Expansion Strategy</h3>
                <ul>
                    <li>Geographic: Europe and Asia-Pacific in 2024</li>
                    <li>Vertical: Manufacturing and automotive in Q2 2024</li>
                    <li>Product: Supply chain finance and trade compliance modules</li>
                </ul>
            `,
            notes: "Show multiple growth vectors. Not dependent on just one channel or approach. The international expansion plan addresses the global nature of shipping."
        },
        {
            id: 15,
            type: "funding",
            title: "Series A Funding Request",
            content: `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin: 2rem 0;">
                    <div>
                        <h3>Funding Ask: $15M Series A</h3>
                        <ul>
                            <li><strong>$8M:</strong> Sales & Marketing (team + programs)</li>
                            <li><strong>$4M:</strong> Product Development (R&D + platform)</li>
                            <li><strong>$2M:</strong> International Expansion</li>
                            <li><strong>$1M:</strong> Working Capital & Operations</li>
                        </ul>
                    </div>
                    <div>
                        <h3>Use of Funds Impact</h3>
                        <ul>
                            <li>Scale to $50M ARR by end of 2025</li>
                            <li>Expand to 5,000+ vessels under management</li>
                            <li>Launch in European and Asian markets</li>
                            <li>Build moat through network effects</li>
                        </ul>
                    </div>
                </div>
            `,
            notes: "Be specific about funding use and expected outcomes. Show that this funding gets us to a major milestone (Series B readiness)."
        },
        {
            id: 16,
            type: "milestones",
            title: "Key Milestones & Metrics to Track",
            content: `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 2rem 0;">
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4>Q1 2024</h4>
                        <div style="color: #00D4AA; font-weight: bold;">$12M ARR</div>
                        <div>2,000 vessels</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4>Q2 2024</h4>
                        <div style="color: #00D4AA; font-weight: bold;">$18M ARR</div>
                        <div>Europe launch</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4>Q3 2024</h4>
                        <div style="color: #00D4AA; font-weight: bold;">$28M ARR</div>
                        <div>3,500 vessels</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4>Q4 2024</h4>
                        <div style="color: #00D4AA; font-weight: bold;">$42M ARR</div>
                        <div>Series B ready</div>
                    </div>
                </div>
                <h3>Success Metrics</h3>
                <ul>
                    <li><strong>Revenue:</strong> ARR growth, average deal size, win rate</li>
                    <li><strong>Product:</strong> D&D prevention rate, customer satisfaction</li>
                    <li><strong>Market:</strong> Market share, brand recognition, partnerships</li>
                    <li><strong>Team:</strong> Key hires, retention, culture metrics</li>
                </ul>
            `,
            notes: "Set clear expectations and milestones. Investors want to see specific, measurable goals they can track progress against."
        },
        {
            id: 17,
            type: "risks",
            title: "Risk Mitigation & Contingencies",
            content: `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div>
                        <h3>Identified Risks</h3>
                        <ul>
                            <li><strong>Carrier Integration:</strong> API changes or access restrictions</li>
                            <li><strong>Competition:</strong> Large players entering market</li>
                            <li><strong>Economic Downturn:</strong> Reduced enterprise spending</li>
                            <li><strong>Regulatory:</strong> Changes in international trade rules</li>
                        </ul>
                    </div>
                    <div>
                        <h3>Mitigation Strategies</h3>
                        <ul>
                            <li><strong>Partner Relationships:</strong> Direct partnerships with carriers</li>
                            <li><strong>Network Effects:</strong> First-mover advantage and switching costs</li>
                            <li><strong>Value Proposition:</strong> ROI guarantee reduces buying risk</li>
                            <li><strong>Diversification:</strong> Multiple geographies and verticals</li>
                        </ul>
                    </div>
                </div>
            `,
            notes: "Address risks proactively. Investors appreciate when entrepreneurs have thought through potential challenges and have mitigation plans."
        },
        {
            id: 18,
            type: "vision",
            title: "Long-Term Vision: The Universal Trade Platform",
            content: `
                <h3>Beyond Ocean Freight</h3>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 2rem 0;">
                    <div style="text-align: center; padding: 1rem; background: #E6FCF5; border-radius: 8px;">
                        <h4>Phase 1 (Now)</h4>
                        <div>Ocean Freight D&D</div>
                        <div>$7M ARR</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #FFF8E1; border-radius: 8px;">
                        <h4>Phase 2 (2025)</h4>
                        <div>Supply Chain Finance</div>
                        <div>$50M ARR</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #F3E8FF; border-radius: 8px;">
                        <h4>Phase 3 (2027)</h4>
                        <div>Universal Trade Platform</div>
                        <div>$500M ARR</div>
                    </div>
                </div>
                <p>UIP becomes the universal integration layer for all global trade - connecting every carrier, every port, every customs agency, every financial institution.</p>
            `,
            notes: "Paint the big picture vision. Investors want to see potential for a very large outcome, not just a nice logistics tool."
        },
        {
            id: 19,
            type: "investment-terms",
            title: "Investment Terms & Structure",
            content: `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div>
                        <h3>Series A Terms</h3>
                        <ul>
                            <li><strong>Amount:</strong> $15M</li>
                            <li><strong>Valuation:</strong> $60M pre-money</li>
                            <li><strong>Liquidation:</strong> 1x non-participating preferred</li>
                            <li><strong>Anti-dilution:</strong> Weighted average broad-based</li>
                            <li><strong>Board:</strong> 2 investors, 2 founders, 1 independent</li>
                        </ul>
                    </div>
                    <div>
                        <h3>Investor Rights</h3>
                        <ul>
                            <li><strong>Information Rights:</strong> Monthly reporting</li>
                            <li><strong>Pro-rata Rights:</strong> Future rounds participation</li>
                            <li><strong>Approval Rights:</strong> Budget, major hires, strategy</li>
                            <li><strong>Tag/Drag Rights:</strong> Standard terms</li>
                        </ul>
                    </div>
                </div>
                <div style="margin-top: 2rem; padding: 1.5rem; background: #E6FCF5; border-radius: 8px;">
                    <h4>Exit Strategy</h4>
                    <p>Target exit in 5-7 years via strategic acquisition (Oracle, SAP, Salesforce) or IPO. Comparable companies trade at 15-25x revenue multiples.</p>
                </div>
            `,
            notes: "Be upfront about terms. Professional investors appreciate transparency and market-standard terms."
        },
        {
            id: 20,
            type: "closing",
            title: "Join Us in Transforming Global Trade",
            content: `
                <div style="text-align: center;">
                    <h2 style="color: #00D4AA; margin-bottom: 2rem;">The Future of Ocean Freight is Automated</h2>
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <span class="metric-value">$15B+</span>
                            <span class="metric-label">Market Opportunity</span>
                        </div>
                        <div class="metric-card">
                            <span class="metric-value">Proven</span>
                            <span class="metric-label">Technology & Traction</span>
                        </div>
                        <div class="metric-card">
                            <span class="metric-value">World-Class</span>
                            <span class="metric-label">Team & Vision</span>
                        </div>
                    </div>
                    <h3 style="margin: 2rem 0;">Next Steps</h3>
                    <ul style="text-align: left; max-width: 600px; margin: 0 auto;">
                        <li>Due diligence materials and customer references available</li>
                        <li>Product demo and customer site visit can be arranged</li>
                        <li>Term sheet review and negotiation</li>
                        <li>Series A closing target: Q1 2024</li>
                    </ul>
                </div>
            `,
            notes: "Strong close with clear next steps. Reiterate the key themes: large market, proven solution, strong team. Make it easy for investors to move forward."
        }
    ]
};

// Executive Presentation (8 slides)
const executivePresentation = {
    title: "UIP Executive Overview",
    duration: "15 minutes",
    audience: "executives",
    slides: [
        {
            id: 1,
            type: "title",
            title: "Stop Losing $14M Per Vessel",
            subtitle: "Ocean Freight Automation for Enterprise",
            content: "",
            notes: "Hook immediately with the loss number. Executives care about bottom line impact."
        },
        {
            id: 2,
            type: "problem",
            title: "The $15B Ocean Freight Crisis",
            content: `
                <div class="metrics-grid">
                    <div class="metric-card">
                        <span class="metric-value">$14M</span>
                        <span class="metric-label">Average Annual Loss Per Vessel</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">87%</span>
                        <span class="metric-label">Charges are Preventable</span>
                    </div>
                </div>
                <h3>Your Team is Drowning in Manual Work</h3>
                <ul>
                    <li>Detention & demurrage charges eating into margins</li>
                    <li>200+ carrier systems require manual monitoring</li>
                    <li>Reactive dispute management leaves money on the table</li>
                    <li>Zero visibility until containers are already delayed</li>
                </ul>
            `,
            notes: "Focus on business impact, not technical details. Executives need to understand the cost of inaction."
        },
        {
            id: 3,
            type: "solution",
            title: "UIP: Complete Ocean Freight Automation",
            content: `
                <h3>One Platform. All Carriers. 14 Days.</h3>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <span class="metric-value">94%</span>
                        <span class="metric-label">D&D Prevention</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">200+</span>
                        <span class="metric-label">Carrier Integrations</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">14 Days</span>
                        <span class="metric-label">Implementation</span>
                    </div>
                </div>
                <ul>
                    <li><strong>Predict & Prevent:</strong> AI alerts stop charges before they occur</li>
                    <li><strong>Universal Integration:</strong> Works with any carrier, anywhere</li>
                    <li><strong>Automated Disputes:</strong> AI files and wins disputes automatically</li>
                    <li><strong>Zero IT Effort:</strong> Plug-and-play deployment in 2 weeks</li>
                </ul>
            `,
            notes: "Emphasize business outcomes and ease of implementation. Executives want solutions that deliver value quickly without disruption."
        },
        {
            id: 4,
            type: "roi",
            title: "Guaranteed ROI: 3x Minimum in Year 1",
            content: `
                <div style="text-align: center; margin: 2rem 0;">
                    <div style="font-size: 3rem; font-weight: 900; color: #00D4AA; margin-bottom: 1rem;">3x ROI Guarantee</div>
                    <p style="font-size: 1.25rem; color: #64748B;">Or we refund the difference</p>
                </div>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <span class="metric-value">$500K</span>
                        <span class="metric-label">Annual Investment Per Vessel</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">$1.5M+</span>
                        <span class="metric-label">Guaranteed Savings Per Vessel</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">73 Days</span>
                        <span class="metric-label">Average Payback Period</span>
                    </div>
                </div>
            `,
            notes: "The guarantee removes all financial risk. Executives love guaranteed returns and fast payback periods."
        },
        {
            id: 5,
            type: "proof",
            title: "Proven Results from Industry Leaders",
            content: `
                <blockquote style="font-size: 1.5rem; font-style: italic; margin: 2rem 0; padding: 2rem; background: #F8FAFB; border-left: 4px solid #00D4AA; text-align: center;">
                    "UIP saved us $47M in 18 months. This is the fastest ROI we've ever seen on any technology investment."
                    <br><br>
                    <strong>- CFO, Fortune 500 Retailer</strong>
                </blockquote>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <span class="metric-value">$127M</span>
                        <span class="metric-label">Total Customer Savings YTD</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">2,847</span>
                        <span class="metric-label">Vessels Under Management</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-value">98%</span>
                        <span class="metric-label">Customer Retention Rate</span>
                    </div>
                </div>
            `,
            notes: "Social proof from peer companies. The Fortune 500 reference and retention rate prove customer satisfaction."
        },
        {
            id: 6,
            type: "comparison",
            title: "UIP vs. Alternatives",
            content: `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 2rem 0;">
                    <div style="text-align: center; padding: 1rem; background: #E6FCF5; border-radius: 8px;">
                        <h4 style="color: #00D4AA;">UIP</h4>
                        <div style="margin: 0.5rem 0;"><strong>200+</strong> carriers</div>
                        <div style="margin: 0.5rem 0;"><strong>14 days</strong> implementation</div>
                        <div style="margin: 0.5rem 0;"><strong>94%</strong> D&D prevention</div>
                        <div style="margin: 0.5rem 0;"><strong>3x</strong> guaranteed ROI</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4>Status Quo</h4>
                        <div style="margin: 0.5rem 0;">Manual processes</div>
                        <div style="margin: 0.5rem 0;">Ongoing inefficiency</div>
                        <div style="margin: 0.5rem 0;">13% prevention</div>
                        <div style="margin: 0.5rem 0;">Negative ROI</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4>Legacy TMS</h4>
                        <div style="margin: 0.5rem 0;">30-50 carriers</div>
                        <div style="margin: 0.5rem 0;">6-12 months</div>
                        <div style="margin: 0.5rem 0;">30% prevention</div>
                        <div style="margin: 0.5rem 0;">Unknown ROI</div>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4>Build In-House</h4>
                        <div style="margin: 0.5rem 0;">Limited carriers</div>
                        <div style="margin: 0.5rem 0;">12-18 months</div>
                        <div style="margin: 0.5rem 0;">Unknown results</div>
                        <div style="margin: 0.5rem 0;">High risk</div>
                    </div>
                </div>
            `,
            notes: "Clear competitive differentiation. Show why UIP is the only viable option for comprehensive automation."
        },
        {
            id: 7,
            type: "implementation",
            title: "Implementation: 14 Days to Full Automation",
            content: `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 2rem 0;">
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4 style="color: #00D4AA;">Days 1-3</h4>
                        <div>Discovery & Setup</div>
                        <small>Map existing systems and processes</small>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4 style="color: #00D4AA;">Days 4-7</h4>
                        <div>Integration</div>
                        <small>Connect all carrier systems</small>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4 style="color: #00D4AA;">Days 8-10</h4>
                        <div>Testing & Training</div>
                        <small>Validate data and train team</small>
                    </div>
                    <div style="text-align: center; padding: 1rem; background: #F8FAFB; border-radius: 8px;">
                        <h4 style="color: #00D4AA;">Days 11-14</h4>
                        <div>Go Live</div>
                        <small>Full automation active</small>
                    </div>
                </div>
                <div style="text-align: center; margin-top: 2rem; padding: 1.5rem; background: #E6FCF5; border-radius: 8px;">
                    <h3>Zero IT Effort Required</h3>
                    <p>Our team handles everything. Your IT team can focus on strategic initiatives while we deliver immediate value.</p>
                </div>
            `,
            notes: "Emphasize speed and simplicity. Executives are concerned about implementation risk and IT resource requirements."
        },
        {
            id: 8,
            type: "next-steps",
            title: "Next Steps: Start Saving Money in 30 Days",
            content: `
                <div style="text-align: center;">
                    <h2 style="color: #00D4AA; margin-bottom: 2rem;">Ready to Stop Losing $14M Per Vessel?</h2>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; margin: 2rem 0;">
                        <div style="padding: 1.5rem; background: #F8FAFB; border-radius: 8px;">
                            <h4>Step 1</h4>
                            <p>Free ROI Assessment</p>
                            <small>Quantify your specific savings opportunity</small>
                        </div>
                        <div style="padding: 1.5rem; background: #F8FAFB; border-radius: 8px;">
                            <h4>Step 2</h4>
                            <p>Live Platform Demo</p>
                            <small>See UIP working with your data</small>
                        </div>
                        <div style="padding: 1.5rem; background: #F8FAFB; border-radius: 8px;">
                            <h4>Step 3</h4>
                            <p>14-Day Implementation</p>
                            <small>Full automation and immediate savings</small>
                        </div>
                    </div>
                    <div style="margin-top: 2rem; padding: 1.5rem; background: #00D4AA; color: white; border-radius: 8px;">
                        <h3>Limited Time: Implementation Guarantee</h3>
                        <p>Sign by month-end and we guarantee go-live within 14 days or your first year is free.</p>
                    </div>
                </div>
            `,
            notes: "Clear call to action with urgency and guarantee. Give executives a risk-free way to evaluate and a compelling reason to act quickly."
        }
    ]
};

// Technical Presentation Template
const technicalPresentation = {
    title: "UIP Technical Deep Dive",
    duration: "30 minutes",
    audience: "technical",
    slides: [
        // Technical slides would go here - shortened for brevity
        {
            id: 1,
            type: "title",
            title: "UIP Technical Architecture",
            subtitle: "Universal Integration Intelligence Platform",
            content: "",
            notes: "Focus on technical capabilities and architecture for IT decision makers."
        }
        // ... more technical slides
    ]
};

// Industry-specific templates
const retailPresentation = {
    title: "UIP for Retail & E-commerce",
    duration: "20 minutes",
    audience: "retail",
    slides: [
        {
            id: 1,
            type: "title",
            title: "Peak Season Without the Peak Costs",
            subtitle: "Ocean Freight Automation for Retail",
            content: "",
            notes: "Focus on peak season challenges that retail faces."
        }
        // ... retail-specific slides
    ]
};

// Presentation templates registry
const presentationTemplates = {
    investors: masterPitchDeck,
    executives: executivePresentation,
    technical: technicalPresentation,
    operations: technicalPresentation, // Reuse technical for now
    retail: retailPresentation,
    cfo: executivePresentation // Reuse executive for CFO
};

// Chart data configurations
const chartConfigs = {
    tam: {
        type: 'doughnut',
        data: {
            labels: ['TAM ($2.4T)', 'SAM ($120B)', 'SOM ($12B)'],
            datasets: [{
                data: [2400, 120, 12],
                backgroundColor: ['#E2E8F0', '#64748B', '#00D4AA'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    },
    financials: {
        type: 'line',
        data: {
            labels: ['2022', '2023', '2024E', '2025E', '2026E'],
            datasets: [{
                label: 'ARR ($M)',
                data: [0.8, 7.2, 25, 67, 150],
                borderColor: '#00D4AA',
                backgroundColor: 'rgba(0, 212, 170, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'ARR ($M)'
                    }
                }
            }
        }
    },
    growth: {
        type: 'bar',
        data: {
            labels: ['Q1 24', 'Q2 24', 'Q3 24', 'Q4 24', 'Q1 25', 'Q2 25'],
            datasets: [{
                label: 'New ARR ($M)',
                data: [4.8, 6.2, 10.1, 14.3, 18.7, 23.4],
                backgroundColor: '#00D4AA'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'New ARR ($M)'
                    }
                }
            }
        }
    }
};

// Export for use in main script
window.presentationData = {
    templates: presentationTemplates,
    charts: chartConfigs
};