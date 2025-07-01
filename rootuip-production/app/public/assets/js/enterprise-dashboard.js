/**
 * ROOTUIP Enterprise Dashboard
 * Premium dashboard content for $500K+ enterprise clients
 */

function getEnterpriseDashboardContent() {
    return `
        <!-- Page Header -->
        <div class="page-header">
            <div>
                <h1 style="font-size: var(--text-4xl); font-weight: var(--font-black); color: var(--enterprise-dark); margin-bottom: var(--space-2);">Financial Impact Dashboard</h1>
                <p style="font-size: var(--text-lg); color: var(--enterprise-gray-600);">Real-time intelligence preventing <strong style="color: var(--enterprise-success);">$38K daily</strong> in unnecessary charges</p>
            </div>
            <div style="display: flex; gap: var(--space-3);">
                <button class="btn btn-secondary">
                    <i class="fas fa-file-export"></i>
                    Export Executive Report
                </button>
                <button class="btn btn-primary">
                    <i class="fas fa-plus"></i>
                    Track New Container
                </button>
            </div>
        </div>

        <!-- Trust Badges -->
        <div class="trust-badges animate-slide-up" style="animation-delay: 0.1s;">
            <div class="trust-badge">
                <i class="fas fa-shield-alt text-success"></i>
                <span>SOC 2 Compliant</span>
            </div>
            <div class="trust-badge">
                <i class="fas fa-lock text-success"></i>
                <span>Bank-Grade Encryption</span>
            </div>
            <div class="trust-badge">
                <i class="fas fa-certificate text-success"></i>
                <span>ISO 27001 Certified</span>
            </div>
            <div class="trust-badge">
                <i class="fas fa-check-circle text-success"></i>
                <span>99.9% Uptime SLA</span>
            </div>
        </div>

        <!-- Key Performance Indicators -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-6); margin-top: var(--space-8);">
            <div class="kpi-card">
                <div class="kpi-header">
                    <div>
                        <div class="kpi-label">Monthly Savings</div>
                        <div class="kpi-value">$1.8M</div>
                        <div class="kpi-trend positive">
                            <i class="fas fa-arrow-up"></i>
                            <span>+27% from last month</span>
                        </div>
                    </div>
                    <div class="kpi-icon success">
                        <i class="fas fa-dollar-sign"></i>
                    </div>
                </div>
                <canvas class="kpi-sparkline" id="savings-sparkline"></canvas>
            </div>
            
            <div class="kpi-card">
                <div class="kpi-header">
                    <div>
                        <div class="kpi-label">Prevention Rate</div>
                        <div class="kpi-value">94%</div>
                        <div class="kpi-trend positive">
                            <i class="fas fa-check-circle"></i>
                            <span>Industry-leading</span>
                        </div>
                    </div>
                    <div class="kpi-icon success">
                        <i class="fas fa-shield-alt"></i>
                    </div>
                </div>
                <canvas class="kpi-sparkline" id="prevention-sparkline"></canvas>
            </div>
            
            <div class="kpi-card">
                <div class="kpi-header">
                    <div>
                        <div class="kpi-label">Revenue at Risk</div>
                        <div class="kpi-value" style="color: var(--enterprise-danger);">$3.2M</div>
                        <div class="kpi-trend negative">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>Requires action</span>
                        </div>
                    </div>
                    <div class="kpi-icon danger">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                </div>
                <canvas class="kpi-sparkline" id="risk-sparkline"></canvas>
            </div>
            
            <div class="kpi-card">
                <div class="kpi-header">
                    <div>
                        <div class="kpi-label">Container Health</div>
                        <div class="kpi-value">12,487</div>
                        <div class="kpi-trend positive">
                            <i class="fas fa-ship"></i>
                            <span>98.2% on schedule</span>
                        </div>
                    </div>
                    <div class="kpi-icon success">
                        <i class="fas fa-ship"></i>
                    </div>
                </div>
                <canvas class="kpi-sparkline" id="container-sparkline"></canvas>
            </div>
        </div>

        <!-- Analytics Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: var(--space-6); margin-top: var(--space-8);">
            <!-- Financial Impact Chart -->
            <div class="chart-container">
                <div class="chart-header">
                    <div>
                        <h3 class="chart-title">Cost Breakdown by Category</h3>
                        <p style="font-size: var(--text-sm); color: var(--enterprise-gray-600); margin-top: var(--space-1);">Identify your biggest savings opportunities</p>
                    </div>
                    <div class="chart-legend">
                        <div class="legend-item">
                            <span class="legend-dot" style="background: var(--enterprise-success);"></span>
                            <span>Prevented</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-dot" style="background: var(--enterprise-danger);"></span>
                            <span>At Risk</span>
                        </div>
                    </div>
                </div>
                <canvas id="cost-breakdown-chart" height="300"></canvas>
            </div>

            <!-- Risk Prediction Chart -->
            <div class="chart-container">
                <div class="chart-header">
                    <div>
                        <h3 class="chart-title">30-Day Risk Forecast</h3>
                        <p style="font-size: var(--text-sm); color: var(--enterprise-gray-600); margin-top: var(--space-1);">AI-powered predictions with 94% accuracy</p>
                    </div>
                    <span class="badge badge-enterprise" style="display: flex; align-items: center; gap: var(--space-2);">
                        <i class="fas fa-brain"></i>
                        AI Analysis
                    </span>
                </div>
                <canvas id="risk-forecast-chart" height="300"></canvas>
            </div>
        </div>

        <!-- High Risk Containers Table -->
        <div class="data-table-wrapper" style="margin-top: var(--space-8);">
            <div class="table-header">
                <div>
                    <h3 class="table-title">Containers Requiring Immediate Action</h3>
                    <p style="font-size: var(--text-sm); color: var(--enterprise-gray-600); margin-top: var(--space-1);">Prevent $487K in charges by taking action on these containers</p>
                </div>
                <div class="table-actions">
                    <select class="form-control" style="width: 180px;">
                        <option>All Carriers</option>
                        <option>Maersk</option>
                        <option>MSC</option>
                        <option>CMA CGM</option>
                    </select>
                    <button class="btn btn-secondary btn-sm">
                        <i class="fas fa-filter"></i>
                        Filters
                    </button>
                    <button class="btn btn-primary btn-sm">
                        <i class="fas fa-download"></i>
                        Export
                    </button>
                </div>
            </div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Container ID</th>
                        <th>Carrier</th>
                        <th>Status</th>
                        <th>Risk Score</th>
                        <th>Financial Impact</th>
                        <th>Days Until Charge</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="font-family: var(--font-mono); font-weight: var(--font-semibold);">MSKU7654321</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: var(--space-2);">
                                <div style="width: 24px; height: 24px; background: #0066CC; border-radius: 4px;"></div>
                                <span>Maersk</span>
                            </div>
                        </td>
                        <td>
                            <span class="status-badge danger">
                                <i class="fas fa-circle" style="font-size: 8px;"></i>
                                Delayed
                            </span>
                        </td>
                        <td>
                            <div style="display: flex; align-items: center; gap: var(--space-2);">
                                <span style="color: var(--enterprise-danger); font-weight: var(--font-bold);">87%</span>
                                <i class="fas fa-arrow-up" style="color: var(--enterprise-danger); font-size: var(--text-xs);"></i>
                            </div>
                        </td>
                        <td>
                            <span style="color: var(--enterprise-danger); font-weight: var(--font-bold); font-size: var(--text-lg);">$487,230</span>
                        </td>
                        <td>
                            <span style="color: var(--enterprise-danger); font-weight: var(--font-semibold);">3 days</span>
                        </td>
                        <td>
                            <div style="display: flex; gap: var(--space-2);">
                                <button class="btn btn-primary btn-sm">
                                    <i class="fas fa-shield-alt"></i>
                                    Prevent Charge
                                </button>
                                <button class="btn btn-ghost btn-sm" title="View Details">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="font-family: var(--font-mono); font-weight: var(--font-semibold);">CMAU8901234</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: var(--space-2);">
                                <div style="width: 24px; height: 24px; background: #E30D0E; border-radius: 4px;"></div>
                                <span>CMA CGM</span>
                            </div>
                        </td>
                        <td>
                            <span class="status-badge warning">
                                <i class="fas fa-circle" style="font-size: 8px;"></i>
                                At Risk
                            </span>
                        </td>
                        <td>
                            <div style="display: flex; align-items: center; gap: var(--space-2);">
                                <span style="color: var(--enterprise-warning); font-weight: var(--font-bold);">72%</span>
                                <i class="fas fa-arrow-up" style="color: var(--enterprise-warning); font-size: var(--text-xs);"></i>
                            </div>
                        </td>
                        <td>
                            <span style="color: var(--enterprise-warning); font-weight: var(--font-bold); font-size: var(--text-lg);">$325,100</span>
                        </td>
                        <td>
                            <span style="color: var(--enterprise-warning); font-weight: var(--font-semibold);">7 days</span>
                        </td>
                        <td>
                            <div style="display: flex; gap: var(--space-2);">
                                <button class="btn btn-primary btn-sm">
                                    <i class="fas fa-shield-alt"></i>
                                    Prevent Charge
                                </button>
                                <button class="btn btn-ghost btn-sm" title="View Details">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="font-family: var(--font-mono); font-weight: var(--font-semibold);">MSCU5432178</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: var(--space-2);">
                                <div style="width: 24px; height: 24px; background: #F96E11; border-radius: 4px;"></div>
                                <span>MSC</span>
                            </div>
                        </td>
                        <td>
                            <span class="status-badge success">
                                <i class="fas fa-circle" style="font-size: 8px;"></i>
                                On Track
                            </span>
                        </td>
                        <td>
                            <div style="display: flex; align-items: center; gap: var(--space-2);">
                                <span style="color: var(--enterprise-success); font-weight: var(--font-bold);">12%</span>
                                <i class="fas fa-arrow-down" style="color: var(--enterprise-success); font-size: var(--text-xs);"></i>
                            </div>
                        </td>
                        <td>
                            <span style="color: var(--enterprise-gray-600); font-weight: var(--font-bold); font-size: var(--text-lg);">$158,900</span>
                        </td>
                        <td>
                            <span style="color: var(--enterprise-gray-600); font-weight: var(--font-semibold);">Safe</span>
                        </td>
                        <td>
                            <div style="display: flex; gap: var(--space-2);">
                                <button class="btn btn-secondary btn-sm">
                                    <i class="fas fa-eye"></i>
                                    Monitor
                                </button>
                                <button class="btn btn-ghost btn-sm" title="View Details">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Bottom Section Grid -->
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: var(--space-6); margin-top: var(--space-8);">
            <!-- Real-time Activity Feed -->
            <div style="background: var(--enterprise-white); border-radius: var(--radius-lg); padding: var(--space-6); box-shadow: var(--shadow-sm); border: 1px solid var(--enterprise-gray-100);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-6);">
                    <h3 style="font-size: var(--text-lg); font-weight: var(--font-semibold);">Live Activity Feed</h3>
                    <div style="display: flex; align-items: center; gap: var(--space-2); color: var(--enterprise-success);">
                        <span style="width: 8px; height: 8px; background: currentColor; border-radius: 50%; animation: pulse 2s infinite;"></span>
                        <span style="font-size: var(--text-sm); font-weight: var(--font-medium);">Live</span>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: var(--space-4);">
                    <div style="display: flex; gap: var(--space-3);">
                        <div style="width: 40px; height: 40px; background: var(--enterprise-success-subtle); color: var(--enterprise-success); border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="fas fa-check"></i>
                        </div>
                        <div style="flex: 1;">
                            <p style="font-weight: var(--font-semibold); margin-bottom: var(--space-1);">$125K saved on MSKU1234567</p>
                            <p style="font-size: var(--text-sm); color: var(--enterprise-gray-600);">Detention charges prevented through early action</p>
                            <p style="font-size: var(--text-xs); color: var(--enterprise-gray-500); margin-top: var(--space-1);">2 minutes ago</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: var(--space-3);">
                        <div style="width: 40px; height: 40px; background: var(--enterprise-warning-subtle); color: var(--enterprise-warning); border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div style="flex: 1;">
                            <p style="font-weight: var(--font-semibold); margin-bottom: var(--space-1);">Risk detected: CMAU7890123</p>
                            <p style="font-size: var(--text-sm); color: var(--enterprise-gray-600);">$87K at risk - 5 days until charges apply</p>
                            <p style="font-size: var(--text-xs); color: var(--enterprise-gray-500); margin-top: var(--space-1);">15 minutes ago</p>
                        </div>
                    </div>
                    <div style="display: flex; gap: var(--space-3);">
                        <div style="width: 40px; height: 40px; background: var(--enterprise-primary-subtle); color: var(--enterprise-primary); border-radius: var(--radius-full); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i class="fas fa-brain"></i>
                        </div>
                        <div style="flex: 1;">
                            <p style="font-weight: var(--font-semibold); margin-bottom: var(--space-1);">AI prediction updated</p>
                            <p style="font-size: var(--text-sm); color: var(--enterprise-gray-600);">12 new containers flagged for monitoring</p>
                            <p style="font-size: var(--text-xs); color: var(--enterprise-gray-500); margin-top: var(--space-1);">1 hour ago</p>
                        </div>
                    </div>
                </div>
                <button class="btn btn-secondary btn-sm w-full" style="margin-top: var(--space-4);">
                    View All Activity
                </button>
            </div>

            <!-- Savings Impact Card -->
            <div style="background: var(--enterprise-gradient-subtle); border: 2px solid var(--enterprise-primary); border-radius: var(--radius-lg); padding: var(--space-6); position: relative; overflow: hidden;">
                <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: var(--enterprise-primary); opacity: 0.1; border-radius: 50%;"></div>
                <h3 style="font-size: var(--text-lg); font-weight: var(--font-semibold); margin-bottom: var(--space-4);">Today's Impact</h3>
                <div style="text-align: center; margin: var(--space-6) 0;">
                    <div style="font-size: var(--text-4xl); font-weight: var(--font-black); color: var(--enterprise-success); margin-bottom: var(--space-2);">$38,472</div>
                    <p style="color: var(--enterprise-gray-600); font-size: var(--text-sm);">Saved so far today</p>
                </div>
                <div style="background: var(--enterprise-white); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-4);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: var(--space-2);">
                        <span style="font-size: var(--text-sm); font-weight: var(--font-medium);">Monthly Goal</span>
                        <span style="font-size: var(--text-sm); font-weight: var(--font-bold); color: var(--enterprise-success);">78%</span>
                    </div>
                    <div style="height: 8px; background: var(--enterprise-gray-200); border-radius: var(--radius-full); overflow: hidden;">
                        <div style="height: 100%; width: 78%; background: var(--enterprise-gradient-success); transition: width 1s ease;"></div>
                    </div>
                </div>
                <p style="text-align: center; font-size: var(--text-sm); color: var(--enterprise-gray-600);">On track for <strong>$22M</strong> annual savings</p>
            </div>

            <!-- Quick Actions -->
            <div style="display: flex; flex-direction: column; gap: var(--space-4);">
                <div class="action-card" onclick="loadPage('tracking')">
                    <div class="action-icon">
                        <i class="fas fa-plus"></i>
                    </div>
                    <h4 class="action-title">Track Container</h4>
                    <p class="action-description">Add new containers to prevent charges</p>
                </div>
                <div class="action-card" onclick="loadPage('risk-matrix')">
                    <div class="action-icon" style="background: var(--enterprise-danger-subtle); color: var(--enterprise-danger);">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <h4 class="action-title">View Risks</h4>
                    <p class="action-description">12 containers need attention</p>
                </div>
                <div class="action-card" onclick="exportExecutiveReport()">
                    <div class="action-icon" style="background: var(--enterprise-success-subtle); color: var(--enterprise-success);">
                        <i class="fas fa-file-export"></i>
                    </div>
                    <h4 class="action-title">Export Report</h4>
                    <p class="action-description">Generate executive summary</p>
                </div>
            </div>
        </div>

        <!-- Industry-Specific Value Proposition -->
        <div class="card mt-8 animate-fade-in" style="animation-delay: 1.2s; background: var(--enterprise-gradient-subtle); border: 2px solid var(--enterprise-primary);">
            <div class="card-header">
                <h3 class="text-xl font-bold">Your Industry's Success with ROOTUIP</h3>
                <select class="form-control" style="width: 200px;" onchange="updateIndustryContent(this.value)">
                    <option value="retail">Retail & E-commerce</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="automotive">Automotive</option>
                    <option value="pharma">Pharmaceuticals</option>
                </select>
            </div>
            <div class="card-body" id="industry-content">
                <div class="grid grid-cols-3 gap-6">
                    <div class="text-center">
                        <div class="metric-value text-success">$22M</div>
                        <div class="metric-label">Average Annual Savings</div>
                        <p class="text-sm text-muted mt-2">Major retailers save millions</p>
                    </div>
                    <div class="text-center">
                        <div class="metric-value text-primary">50K+</div>
                        <div class="metric-label">Containers Monthly</div>
                        <p class="text-sm text-muted mt-2">Handle Walmart-scale volume</p>
                    </div>
                    <div class="text-center">
                        <div class="metric-value text-warning">89%</div>
                        <div class="metric-label">Disruption Reduction</div>
                        <p class="text-sm text-muted mt-2">Prevent stockouts & delays</p>
                    </div>
                </div>
                <div class="mt-6 p-4 bg-white bg-opacity-50 rounded-lg">
                    <h4 class="font-bold mb-2">Success Story: Fortune 100 Retailer</h4>
                    <p class="text-gray-700">"ROOTUIP saved us $18M in the first year alone. The platform predicted and prevented detention charges during our peak season, ensuring our holiday inventory arrived on time. It's now essential to our operations."</p>
                    <p class="text-sm text-muted mt-2">- VP Supply Chain, Fortune 100 Retailer</p>
                </div>
            </div>
        </div>
    `;
}

// Initialize premium charts
function initializePremiumCharts() {
    // Initialize sparklines
    initializeSparklines();
    
    // Cost Breakdown Chart
    const costCtx = document.getElementById('cost-breakdown-chart');
    if (costCtx) {
        new Chart(costCtx, {
            type: 'bar',
            data: {
                labels: ['Detention', 'Demurrage', 'Storage', 'Documentation', 'Customs'],
                datasets: [
                    {
                        label: 'Prevented',
                        data: [2850000, 1870000, 945000, 325000, 210000],
                        backgroundColor: 'rgba(5, 150, 105, 0.8)',
                        borderColor: 'rgb(5, 150, 105)',
                        borderWidth: 1
                    },
                    {
                        label: 'At Risk',
                        data: [1250000, 875000, 425000, 125000, 75000],
                        backgroundColor: 'rgba(220, 38, 38, 0.8)',
                        borderColor: 'rgb(220, 38, 38)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        stacked: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + (value / 1000000).toFixed(1) + 'M';
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': $' + (context.parsed.y / 1000000).toFixed(2) + 'M';
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    // Risk Forecast Chart
    const riskCtx = document.getElementById('risk-forecast-chart');
    if (riskCtx) {
        new Chart(riskCtx, {
            type: 'line',
            data: {
                labels: ['Today', 'Day 3', 'Day 7', 'Day 14', 'Day 21', 'Day 30'],
                datasets: [
                    {
                        label: 'Predicted Risk ($M)',
                        data: [3.2, 4.1, 5.8, 7.2, 6.5, 5.9],
                        borderColor: 'rgb(220, 38, 38)',
                        backgroundColor: 'rgba(220, 38, 38, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'With Preventive Action ($M)',
                        data: [3.2, 2.1, 1.5, 0.8, 0.5, 0.3],
                        borderColor: 'rgb(5, 150, 105)',
                        backgroundColor: 'rgba(5, 150, 105, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value + 'M';
                            }
                        },
                        grid: {
                            borderDash: [2, 2]
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': $' + context.parsed.y.toFixed(1) + 'M at risk';
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}

// Initialize sparklines for KPI cards
function initializeSparklines() {
    const sparklineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { display: false },
            y: { display: false }
        },
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
        },
        elements: {
            point: { radius: 0 },
            line: { borderWidth: 2 }
        }
    };

    // Savings sparkline
    const savingsCtx = document.getElementById('savings-sparkline');
    if (savingsCtx) {
        new Chart(savingsCtx, {
            type: 'line',
            data: {
                labels: Array(30).fill(''),
                datasets: [{
                    data: [1.2, 1.3, 1.3, 1.4, 1.5, 1.5, 1.6, 1.6, 1.7, 1.7, 1.8, 1.8],
                    borderColor: 'rgba(5, 150, 105, 0.5)',
                    backgroundColor: 'transparent'
                }]
            },
            options: sparklineOptions
        });
    }
}

// Export functions
function exportReport() {
    showSuccess('Report generation started. You will receive an email shortly.', 'Export Initiated');
}

function exportExecutiveReport() {
    showSuccess('Executive report generation started. Check your email in 2 minutes.', 'Report Processing');
}

// Helper function for showing notifications
function showSuccess(message, title) {
    console.log(title + ': ' + message);
    // In production, this would show a toast notification
}

// Mobile sidebar functions
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
}

// Update industry-specific content
function updateIndustryContent(industry) {
    const content = document.getElementById('industry-content');
    if (!content) return;
    
    const industryData = {
        retail: {
            savings: '$22M',
            volume: '50K+',
            metric: '89%',
            metricLabel: 'Disruption Reduction',
            story: 'Fortune 100 Retailer',
            quote: 'ROOTUIP saved us $18M in the first year alone. The platform predicted and prevented detention charges during our peak season, ensuring our holiday inventory arrived on time.',
            features: ['Handle Walmart-scale volume', 'Peak season optimization', 'Multi-DC coordination']
        },
        manufacturing: {
            savings: '$31M',
            volume: '35K+',
            metric: '97%',
            metricLabel: 'JIT Delivery Success',
            story: 'Global Auto Manufacturer',
            quote: 'Zero production line shutdowns due to shipping delays since implementing ROOTUIP. The $31M saved allowed us to expand our operations.',
            features: ['Prevent production delays', 'Component tracking', 'Supplier coordination']
        },
        automotive: {
            savings: '$28M',
            volume: '40K+',
            metric: '99.2%',
            metricLabel: 'Parts Availability',
            story: 'Top 3 Auto OEM',
            quote: 'ROOTUIP\'s predictive alerts prevented a potential $15M production shutdown. The ROI was immediate and substantial.',
            features: ['Critical parts tracking', 'Assembly line sync', 'Global supplier network']
        },
        pharma: {
            savings: '$19M',
            volume: '15K+',
            metric: '100%',
            metricLabel: 'Compliance Rate',
            story: 'Fortune 500 Pharma',
            quote: 'Temperature-sensitive shipment monitoring and predictive delays saved us from $19M in spoiled products. Compliance is now automatic.',
            features: ['Cold chain monitoring', 'FDA compliance', 'Batch tracking']
        }
    };
    
    const data = industryData[industry] || industryData.retail;
    
    content.innerHTML = `
        <div class="grid grid-cols-3 gap-6">
            <div class="text-center">
                <div class="metric-value text-success">${data.savings}</div>
                <div class="metric-label">Average Annual Savings</div>
                <p class="text-sm text-muted mt-2">${data.features[0]}</p>
            </div>
            <div class="text-center">
                <div class="metric-value text-primary">${data.volume}</div>
                <div class="metric-label">Containers Monthly</div>
                <p class="text-sm text-muted mt-2">${data.features[1]}</p>
            </div>
            <div class="text-center">
                <div class="metric-value text-warning">${data.metric}</div>
                <div class="metric-label">${data.metricLabel}</div>
                <p class="text-sm text-muted mt-2">${data.features[2]}</p>
            </div>
        </div>
        <div class="mt-6 p-4 bg-white bg-opacity-50 rounded-lg">
            <h4 class="font-bold mb-2">Success Story: ${data.story}</h4>
            <p class="text-gray-700">"${data.quote}"</p>
            <p class="text-sm text-muted mt-2">- VP Supply Chain, ${data.story}</p>
        </div>
    `;
}