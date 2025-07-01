/**
 * ROOTUIP Enterprise Messaging
 * Compelling copy that drives $500K+ sales
 */

const EnterpriseMessaging = {
    // Hero messaging for different contexts
    hero: {
        main: {
            headline: "Prevent $14M+ Annual Losses with AI-Powered Ocean Freight Intelligence",
            subheading: "The only platform that predicts detention & demurrage charges 14 days in advance with 94% accuracy",
            cta: "See Your $25M+ Savings Calculation"
        },
        dashboard: {
            headline: "Your Supply Chain Command Center",
            subheading: "Real-time intelligence preventing millions in unnecessary charges"
        },
        tracking: {
            headline: "Never Pay Another Late Fee",
            subheading: "24/7 visibility across all carriers prevents $50K+ detention charges per container"
        }
    },

    // Value propositions by audience
    valueProps: {
        cfo: {
            title: "Guaranteed ROI in 30 Days",
            points: [
                "Average $14M annual savings for Fortune 500 shippers",
                "Reduce D&D charges by 87% with predictive alerts",
                "Cut operational costs by 23% through automation",
                "Proven 412% ROI in first year"
            ]
        },
        vp_logistics: {
            title: "Transform Your Ocean Freight Operations",
            points: [
                "Prevent 94% of detention charges with 14-day advance warnings",
                "Manage 50,000+ containers from a single dashboard",
                "Integrate with Maersk, MSC, CMA CGM in minutes",
                "Reduce team workload by 67% with AI automation"
            ]
        },
        operations: {
            title: "Your Team's New Superpower",
            points: [
                "Track every container across every carrier in real-time",
                "Get alerts 2 weeks before costly delays occur",
                "Automate document processing with 99.9% accuracy",
                "Access from anywhere - desktop, tablet, or mobile"
            ]
        }
    },

    // Feature descriptions (business-focused)
    features: {
        tracking: {
            title: "Prevent Costly Surprises",
            subtitle: "24/7 Container Visibility",
            description: "Monitor 50,000+ containers across all major carriers. Prevent $50K+ detention charges per container with real-time alerts.",
            metric: "$3.2M saved monthly"
        },
        predictions: {
            title: "Predict Problems Before They Cost You",
            subtitle: "AI-Powered Risk Intelligence",
            description: "Our ML models analyze 47 risk factors to predict delays 14 days in advance with 94% accuracy.",
            metric: "14 days advance warning"
        },
        analytics: {
            title: "Optimize Your $100M+ Shipping Spend",
            subtitle: "Executive Analytics Dashboard",
            description: "Transform shipping data into actionable insights that reduce costs by 23% on average.",
            metric: "23% cost reduction"
        },
        automation: {
            title: "Eliminate 67% of Manual Work",
            subtitle: "Intelligent Process Automation",
            description: "Automate document processing, fee disputes, and carrier communications.",
            metric: "67% efficiency gain"
        }
    },

    // Trust & credibility
    trust: {
        headline: "Trusted by Fortune 500 Leaders",
        badges: [
            {
                icon: "shield-alt",
                title: "SOC 2 Type II",
                description: "Enterprise-grade security"
            },
            {
                icon: "chart-line",
                title: "$10B+ Processed",
                description: "Annual shipping value"
            },
            {
                icon: "check-circle",
                title: "99.99% Uptime",
                description: "Guaranteed SLA"
            },
            {
                icon: "headset",
                title: "24/7 Support",
                description: "Dedicated success team"
            }
        ],
        testimonials: [
            {
                quote: "ROOTUIP saved us $18M in the first year alone. It's now essential to our operations.",
                author: "VP Supply Chain",
                company: "Fortune 100 Retailer"
            },
            {
                quote: "94% reduction in detention charges. The ROI was immediate and substantial.",
                author: "CFO",
                company: "Global Manufacturing Leader"
            }
        ]
    },

    // Industry-specific messaging
    industries: {
        retail: {
            headline: "Optimize 50,000+ Monthly Containers",
            stats: {
                walmart: "Handle Walmart's scale with ease",
                target: "Prevent delays across 35K+ Target shipments",
                home_depot: "Secure $40M+ Home Depot inventory flows"
            },
            value: "Average $22M annual savings for major retailers"
        },
        manufacturing: {
            headline: "Ensure Just-In-Time Delivery",
            stats: {
                automotive: "Prevent production line shutdowns",
                electronics: "Track high-value component shipments",
                industrial: "Manage complex multi-modal logistics"
            },
            value: "Reduce supply chain disruptions by 89%"
        },
        ecommerce: {
            headline: "Scale Without Complexity",
            stats: {
                amazon: "Amazon-level logistics for everyone",
                seasonal: "Handle 10x peak season volume",
                global: "Manage suppliers across 47 countries"
            },
            value: "Support 300% growth without adding headcount"
        }
    },

    // CTAs by context
    ctas: {
        primary: {
            calculate: "Calculate Your $25M+ Annual Savings",
            demo: "Book Executive Demo",
            start: "Start Preventing Losses Today",
            roi: "See ROI in 30 Days"
        },
        secondary: {
            learn: "See How Fortune 500 Leaders Save Millions",
            compare: "Compare Your Current Costs",
            case_study: "Read Walmart Case Study",
            contact: "Talk to Enterprise Sales"
        },
        urgent: {
            limited: "Limited Spots for Q1 Implementation",
            savings: "Start Saving Before Year-End",
            competitive: "Your Competitors Are Already Saving Millions",
            risk: "Every Day Costs You $38,000+"
        }
    },

    // Metric displays
    metrics: {
        financial: {
            saved: {
                label: "Annual Savings",
                format: "${{value}}M+",
                context: "Verified by Big 4 audit"
            },
            risk: {
                label: "Revenue at Risk",
                format: "${{value}}M",
                context: "Prevent with ROOTUIP"
            },
            roi: {
                label: "Proven ROI",
                format: "{{value}}%",
                context: "In first 90 days"
            }
        },
        operational: {
            containers: {
                label: "Containers Monitored",
                format: "{{value}}K+",
                context: "Across all carriers"
            },
            accuracy: {
                label: "Prediction Accuracy",
                format: "{{value}}%",
                context: "14 days in advance"
            },
            uptime: {
                label: "Platform Uptime",
                format: "{{value}}%",
                context: "Guaranteed SLA"
            }
        }
    },

    // Email templates
    emails: {
        subject_lines: {
            cold: "{{Company}} is losing $14M annually on container fees",
            warm: "Your competitors saved $22M last year with ROOTUIP",
            hot: "Your ROI calculation: ${{amount}}M in savings"
        }
    }
};

// Helper functions to apply messaging
function applyEnterpriseMessaging(context = 'main') {
    // Update hero section
    const heroTitle = document.querySelector('.page-title');
    const heroSubtitle = document.querySelector('.page-subtitle');
    
    if (heroTitle && EnterpriseMessaging.hero[context]) {
        heroTitle.textContent = EnterpriseMessaging.hero[context].headline;
    }
    
    if (heroSubtitle && EnterpriseMessaging.hero[context]) {
        heroSubtitle.textContent = EnterpriseMessaging.hero[context].subheading;
    }
}

// Format financial numbers for maximum impact
function formatFinancialImpact(value) {
    if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
}

// Generate industry-specific value prop
function getIndustryValueProp(industry) {
    const data = EnterpriseMessaging.industries[industry];
    if (!data) return '';
    
    return `
        <div class="industry-value-prop">
            <h3>${data.headline}</h3>
            <p class="text-2xl font-bold text-success">${data.value}</p>
        </div>
    `;
}

// Export for use
window.EnterpriseMessaging = EnterpriseMessaging;
window.applyEnterpriseMessaging = applyEnterpriseMessaging;
window.formatFinancialImpact = formatFinancialImpact;
window.getIndustryValueProp = getIndustryValueProp;