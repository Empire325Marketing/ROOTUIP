// Interactive Workflow Comparison Component
class WorkflowComparison {
    constructor() {
        this.scenarios = {
            dd_charge: {
                title: "Detention & Demurrage Charge Detection",
                manual: {
                    steps: [
                        {
                            icon: "📧",
                            time: "Day 1-3",
                            title: "Email Arrives",
                            details: "D&D invoice buried in inbox with 50 other emails"
                        },
                        {
                            icon: "👀",
                            time: "Day 4-7",
                            title: "Manual Review",
                            details: "Team member eventually finds and reviews charge"
                        },
                        {
                            icon: "📊",
                            time: "Day 8-10",
                            title: "Spreadsheet Entry",
                            details: "Manual data entry, often with errors"
                        },
                        {
                            icon: "⚠️",
                            time: "Day 11-14",
                            title: "Dispute Window Closes",
                            details: "Too late to file dispute, charge becomes final"
                        }
                    ],
                    metrics: {
                        time: "14 days",
                        success: "33%",
                        cost: "$14,200",
                        effort: "8 hours"
                    }
                },
                automated: {
                    steps: [
                        {
                            icon: "🤖",
                            time: "0 min",
                            title: "AI Detection",
                            details: "UIP instantly detects D&D charge from any source"
                        },
                        {
                            icon: "🔍",
                            time: "1 min",
                            title: "Root Cause Analysis",
                            details: "AI identifies carrier delay as cause"
                        },
                        {
                            icon: "📄",
                            time: "2 min",
                            title: "Dispute Filed",
                            details: "Automated dispute with evidence submitted"
                        },
                        {
                            icon: "✅",
                            time: "3 min",
                            title: "Confirmation",
                            details: "Team notified, dispute tracked automatically"
                        }
                    ],
                    metrics: {
                        time: "3 min",
                        success: "94%",
                        cost: "$890",
                        effort: "0 hours"
                    }
                }
            },
            container_tracking: {
                title: "Multi-Carrier Container Tracking",
                manual: {
                    steps: [
                        {
                            icon: "🔐",
                            time: "9:00 AM",
                            title: "Log into Carrier Portal",
                            details: "Access first of 12 different carrier websites"
                        },
                        {
                            icon: "🔍",
                            time: "9:15 AM",
                            title: "Search Containers",
                            details: "Manual search for each container number"
                        },
                        {
                            icon: "📝",
                            time: "10:30 AM",
                            title: "Copy to Spreadsheet",
                            details: "Manual copy/paste of status updates"
                        },
                        {
                            icon: "🔄",
                            time: "2:00 PM",
                            title: "Repeat Process",
                            details: "Do this for all 12 carriers daily"
                        }
                    ],
                    metrics: {
                        time: "5 hours/day",
                        accuracy: "76%",
                        visibility: "Once daily",
                        coverage: "60%"
                    }
                },
                automated: {
                    steps: [
                        {
                            icon: "🔌",
                            time: "Real-time",
                            title: "API Connection",
                            details: "All carriers connected automatically"
                        },
                        {
                            icon: "📡",
                            time: "24/7",
                            title: "Continuous Sync",
                            details: "Updates every 5 minutes from all sources"
                        },
                        {
                            icon: "🎯",
                            time: "Instant",
                            title: "Smart Alerts",
                            details: "AI alerts on delays or issues"
                        },
                        {
                            icon: "📊",
                            title: "Unified Dashboard",
                            details: "All containers in one view, always current"
                        }
                    ],
                    metrics: {
                        time: "0 hours",
                        accuracy: "99.9%",
                        visibility: "Real-time",
                        coverage: "100%"
                    }
                }
            },
            dispute_management: {
                title: "Dispute Filing & Management",
                manual: {
                    steps: [
                        {
                            icon: "📚",
                            time: "2 hours",
                            title: "Research Contracts",
                            details: "Find relevant terms and conditions"
                        },
                        {
                            icon: "📧",
                            time: "1 hour",
                            title: "Gather Evidence",
                            details: "Search emails, documents, tracking data"
                        },
                        {
                            icon: "✍️",
                            time: "1 hour",
                            title: "Draft Dispute",
                            details: "Write dispute letter with evidence"
                        },
                        {
                            icon: "📤",
                            time: "30 min",
                            title: "Submit & Track",
                            details: "Email dispute, hope for response"
                        }
                    ],
                    metrics: {
                        time: "4.5 hours",
                        success: "67%",
                        response: "14 days",
                        tracking: "Manual"
                    }
                },
                automated: {
                    steps: [
                        {
                            icon: "🧠",
                            time: "Instant",
                            title: "AI Analysis",
                            details: "Contract terms automatically applied"
                        },
                        {
                            icon: "🔗",
                            time: "Automatic",
                            title: "Evidence Compiled",
                            details: "All relevant data auto-attached"
                        },
                        {
                            icon: "🚀",
                            time: "1 min",
                            title: "Submit via API",
                            details: "Direct submission to carrier systems"
                        },
                        {
                            icon: "📈",
                            time: "Real-time",
                            title: "Track Progress",
                            details: "Automated follow-ups and escalations"
                        }
                    ],
                    metrics: {
                        time: "1 min",
                        success: "94%",
                        response: "3 days",
                        tracking: "Automated"
                    }
                }
            }
        };
    }

    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        
        this.render();
        this.attachEventListeners();
    }

    render() {
        this.container.innerHTML = `
            <div class="workflow-comparison">
                <div class="comparison-header">
                    <h3>See the Difference: Manual vs UIP Automated</h3>
                    <div class="comparison-toggle">
                        ${Object.keys(this.scenarios).map((key, index) => `
                            <button class="toggle-btn ${index === 0 ? 'active' : ''}" data-scenario="${key}">
                                ${this.scenarios[key].title}
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <div class="workflow-display">
                    ${Object.keys(this.scenarios).map((key, index) => this.renderScenario(key, index === 0)).join('')}
                </div>
            </div>
        `;
    }

    renderScenario(scenarioKey, isActive) {
        const scenario = this.scenarios[scenarioKey];
        return `
            <div class="workflow-scenario ${isActive ? 'active' : ''}" data-scenario="${scenarioKey}">
                <div class="scenario-comparison">
                    <div class="manual-workflow">
                        <h4>❌ Current Manual Process</h4>
                        <div class="workflow-steps">
                            ${scenario.manual.steps.map((step, index) => `
                                <div class="workflow-step manual" style="animation-delay: ${index * 0.1}s">
                                    <div class="step-header">
                                        <div class="step-icon">${step.icon}</div>
                                        <span class="step-time">${step.time}</span>
                                    </div>
                                    <div class="step-content">
                                        <h4>${step.title}</h4>
                                        <p class="step-details">${step.details}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="workflow-metrics">
                            ${Object.entries(scenario.manual.metrics).map(([key, value]) => `
                                <div class="metric-card negative">
                                    <span class="metric-value">${value}</span>
                                    <span class="metric-label">${this.formatMetricLabel(key)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="vs-divider">
                        <span>VS</span>
                    </div>
                    
                    <div class="automated-workflow">
                        <h4>✅ UIP Automated Process</h4>
                        <div class="workflow-steps">
                            ${scenario.automated.steps.map((step, index) => `
                                <div class="workflow-step automated" style="animation-delay: ${index * 0.1 + 0.5}s">
                                    <div class="step-header">
                                        <div class="step-icon">${step.icon}</div>
                                        <span class="step-time">${step.time || 'Instant'}</span>
                                    </div>
                                    <div class="step-content">
                                        <h4>${step.title}</h4>
                                        <p class="step-details">${step.details}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="workflow-metrics">
                            ${Object.entries(scenario.automated.metrics).map(([key, value]) => `
                                <div class="metric-card positive">
                                    <span class="metric-value">${value}</span>
                                    <span class="metric-label">${this.formatMetricLabel(key)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                <div class="workflow-impact">
                    <div class="impact-summary">
                        <h4>Bottom Line Impact</h4>
                        <p>${this.calculateImpact(scenario)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    formatMetricLabel(key) {
        const labels = {
            time: 'Time Required',
            success: 'Success Rate',
            cost: 'Cost per Incident',
            effort: 'Manual Effort',
            accuracy: 'Data Accuracy',
            visibility: 'Update Frequency',
            coverage: 'Carrier Coverage',
            response: 'Response Time',
            tracking: 'Tracking Method'
        };
        return labels[key] || key;
    }

    calculateImpact(scenario) {
        // Calculate specific impact based on scenario
        if (scenario.title.includes("Detention")) {
            return "Save $13,310 per charge and prevent 87% of charges from occurring";
        } else if (scenario.title.includes("Tracking")) {
            return "Save 25 hours per week and achieve 100% real-time visibility";
        } else if (scenario.title.includes("Dispute")) {
            return "Increase dispute success from 67% to 94% with zero manual effort";
        }
    }

    attachEventListeners() {
        const toggleBtns = this.container.querySelectorAll('.toggle-btn');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchScenario(e.target.dataset.scenario);
            });
        });
    }

    switchScenario(scenarioKey) {
        // Update active button
        this.container.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.scenario === scenarioKey);
        });

        // Update active scenario
        this.container.querySelectorAll('.workflow-scenario').forEach(scenario => {
            scenario.classList.toggle('active', scenario.dataset.scenario === scenarioKey);
        });

        // Trigger animations
        const activeScenario = this.container.querySelector(`.workflow-scenario[data-scenario="${scenarioKey}"]`);
        if (activeScenario) {
            const steps = activeScenario.querySelectorAll('.workflow-step');
            steps.forEach((step, index) => {
                step.style.animation = 'none';
                setTimeout(() => {
                    step.style.animation = `slideInUp 0.5s ease forwards`;
                    step.style.animationDelay = `${index * 0.1}s`;
                }, 10);
            });
        }
    }
}

// Initialize when needed
const workflowComparison = new WorkflowComparison();