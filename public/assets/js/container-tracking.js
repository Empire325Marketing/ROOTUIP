/**
 * ROOTUIP Container Tracking System
 * Enterprise-grade container tracking with advanced features
 */

// Container tracking state
let currentFilters = {};
let selectedContainers = new Set();
let currentPage = 1;
const itemsPerPage = 25;
let totalContainers = 12487;

// Sample container data (in production, this would come from API)
const mockContainers = [
    {
        id: 'MSKU7654321',
        carrier: 'Maersk',
        carrierColor: '#0066CC',
        status: 'delayed',
        location: 'Los Angeles, USA',
        risk: 87,
        financialImpact: 487230,
        daysToCharge: 3,
        type: '40\' High Cube',
        weight: '28,450 kg',
        commodity: 'Electronics',
        value: 2400000,
        origin: 'Shanghai, China',
        destination: 'Chicago, IL',
        eta: '2024-12-12',
        journey: [
            { location: 'Shanghai, China', date: '2024-11-15', status: 'completed' },
            { location: 'Singapore', date: '2024-11-20', status: 'completed' },
            { location: 'Los Angeles, USA', date: '2024-12-05', status: 'current' },
            { location: 'Chicago, IL', date: '2024-12-12', status: 'pending' }
        ]
    },
    {
        id: 'CMAU8901234',
        carrier: 'CMA CGM',
        carrierColor: '#E30D0E',
        status: 'at-risk',
        location: 'Rotterdam, Netherlands',
        risk: 72,
        financialImpact: 325100,
        daysToCharge: 7,
        type: '40\' Standard',
        weight: '24,890 kg',
        commodity: 'Automotive Parts',
        value: 1800000,
        origin: 'Hamburg, Germany',
        destination: 'New York, USA',
        eta: '2024-12-10',
        journey: [
            { location: 'Hamburg, Germany', date: '2024-11-18', status: 'completed' },
            { location: 'Rotterdam, Netherlands', date: '2024-11-22', status: 'current' },
            { location: 'New York, USA', date: '2024-12-10', status: 'pending' }
        ]
    },
    {
        id: 'MSCU5432178',
        carrier: 'MSC',
        carrierColor: '#F96E11',
        status: 'on-track',
        location: 'Singapore',
        risk: 12,
        financialImpact: 158900,
        daysToCharge: null,
        type: '20\' Standard',
        weight: '18,200 kg',
        commodity: 'Textiles',
        value: 950000,
        origin: 'Mumbai, India',
        destination: 'Los Angeles, USA',
        eta: '2024-12-08',
        journey: [
            { location: 'Mumbai, India', date: '2024-11-20', status: 'completed' },
            { location: 'Singapore', date: '2024-11-28', status: 'current' },
            { location: 'Los Angeles, USA', date: '2024-12-08', status: 'pending' }
        ]
    }
];

function getContainerTrackingContent() {
    return `
        <!-- Page Header -->
        <div class="page-header">
            <div>
                <h1 style="font-size: var(--text-4xl); font-weight: var(--font-black); color: var(--enterprise-dark); margin-bottom: var(--space-2);">Container Intelligence Center</h1>
                <p style="font-size: var(--text-lg); color: var(--enterprise-gray-600);">Track <strong style="color: var(--enterprise-primary);">12,487</strong> containers preventing <strong style="color: var(--enterprise-success);">$3.2M</strong> in monthly charges</p>
            </div>
            <div style="display: flex; gap: var(--space-3);">
                <button class="btn btn-secondary" onclick="exportContainers()">
                    <i class="fas fa-file-export"></i>
                    Export Data
                </button>
                <button class="btn btn-primary" onclick="showAddContainerModal()">
                    <i class="fas fa-plus"></i>
                    Track New Container
                </button>
            </div>
        </div>

        <!-- Quick Stats Bar -->
        <div class="quick-stats-bar">
            <div class="quick-stat">
                <div class="quick-stat-value">243</div>
                <div class="quick-stat-label">High Risk</div>
                <div class="quick-stat-indicator danger"></div>
            </div>
            <div class="quick-stat">
                <div class="quick-stat-value">1,892</div>
                <div class="quick-stat-label">Medium Risk</div>
                <div class="quick-stat-indicator warning"></div>
            </div>
            <div class="quick-stat">
                <div class="quick-stat-value">10,352</div>
                <div class="quick-stat-label">On Track</div>
                <div class="quick-stat-indicator success"></div>
            </div>
            <div class="quick-stat">
                <div class="quick-stat-value">$487K</div>
                <div class="quick-stat-label">Preventable Today</div>
                <div class="quick-stat-indicator primary"></div>
            </div>
        </div>

        <!-- Advanced Filter Bar -->
        <div class="filter-bar">
            <div class="filter-group">
                <div class="filter-item">
                    <label class="filter-label">Risk Level</label>
                    <select class="form-control" id="risk-filter" onchange="updateFilters()">
                        <option value="">All Risks</option>
                        <option value="high">High Risk (87%+)</option>
                        <option value="medium">Medium Risk (50-86%)</option>
                        <option value="low">Low Risk (0-49%)</option>
                    </select>
                </div>
                <div class="filter-item">
                    <label class="filter-label">Carrier</label>
                    <select class="form-control" id="carrier-filter" onchange="updateFilters()">
                        <option value="">All Carriers</option>
                        <option value="maersk">Maersk</option>
                        <option value="msc">MSC</option>
                        <option value="cma-cgm">CMA CGM</option>
                        <option value="cosco">COSCO</option>
                        <option value="hapag-lloyd">Hapag-Lloyd</option>
                    </select>
                </div>
                <div class="filter-item">
                    <label class="filter-label">Status</label>
                    <select class="form-control" id="status-filter" onchange="updateFilters()">
                        <option value="">All Statuses</option>
                        <option value="delayed">Delayed</option>
                        <option value="at-port">At Port</option>
                        <option value="in-transit">In Transit</option>
                        <option value="delivered">Delivered</option>
                    </select>
                </div>
                <div class="filter-item">
                    <label class="filter-label">Days Until Charge</label>
                    <select class="form-control" id="days-filter" onchange="updateFilters()">
                        <option value="">All</option>
                        <option value="0-3">0-3 Days (Critical)</option>
                        <option value="4-7">4-7 Days</option>
                        <option value="8-14">8-14 Days</option>
                        <option value="15+">15+ Days</option>
                    </select>
                </div>
                <div class="filter-item" style="margin-left: auto;">
                    <label class="filter-label">&nbsp;</label>
                    <div style="display: flex; gap: var(--space-2);">
                        <button class="btn btn-ghost" onclick="clearFilters()">
                            <i class="fas fa-times"></i>
                            Clear
                        </button>
                        <button class="btn btn-secondary" onclick="saveFilterPreset()">
                            <i class="fas fa-save"></i>
                            Save Filter
                        </button>
                    </div>
                </div>
            </div>
            <div class="filter-chips" id="active-filters" style="display: none;"></div>
        </div>

        <!-- Bulk Actions Bar -->
        <div class="bulk-actions-bar" id="bulk-actions" style="display: none;">
            <div class="bulk-selection-info">
                <span class="bulk-count">0</span> containers selected
                <button class="btn btn-ghost btn-sm" onclick="clearSelection()">
                    Clear Selection
                </button>
            </div>
            <div class="bulk-actions">
                <button class="btn btn-secondary" onclick="bulkPreventCharges()">
                    <i class="fas fa-shield-alt"></i>
                    Prevent Charges
                </button>
                <button class="btn btn-secondary" onclick="bulkExport()">
                    <i class="fas fa-download"></i>
                    Export Selected
                </button>
                <button class="btn btn-secondary" onclick="bulkAssign()">
                    <i class="fas fa-user-tag"></i>
                    Assign Team
                </button>
                <button class="btn btn-ghost" onclick="bulkArchive()">
                    <i class="fas fa-archive"></i>
                    Archive
                </button>
            </div>
        </div>

        <!-- Container List -->
        <div class="container-list">
            <div class="container-list-header">
                <div style="display: flex; align-items: center; gap: var(--space-4);">
                    <input type="checkbox" class="form-checkbox" id="select-all" onchange="toggleSelectAll()">
                    <span style="font-weight: var(--font-semibold);">Container ID</span>
                </div>
                <div class="list-header-columns">
                    <span>Carrier</span>
                    <span>Status</span>
                    <span>Risk Score</span>
                    <span>Financial Impact</span>
                    <span>Days to Charge</span>
                    <span>Actions</span>
                </div>
            </div>
            <div id="container-list-items">
                <!-- Container items will be inserted here -->
            </div>
        </div>

        <!-- Container Detail Panel -->
        <div class="detail-panel" id="container-detail-panel">
            <div class="detail-panel-header">
                <button class="detail-panel-close" onclick="closeDetailPanel()">
                    <i class="fas fa-times"></i>
                </button>
                <h2 class="detail-panel-title" id="detail-container-id">MSKU7654321</h2>
                <p class="detail-panel-subtitle">Maersk Line • High Risk</p>
            </div>
            
            <div class="detail-section">
                <h3 class="detail-section-title">Financial Impact</h3>
                <div class="financial-impact-card danger">
                    <div class="impact-header">
                        <div>
                            <div class="impact-label">Total at Risk</div>
                            <div class="impact-value">$487,230</div>
                        </div>
                        <div class="impact-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                    </div>
                    <div class="impact-breakdown">
                        <div class="breakdown-item">
                            <span>Detention Charges</span>
                            <span>$342,100</span>
                        </div>
                        <div class="breakdown-item">
                            <span>Demurrage Fees</span>
                            <span>$125,130</span>
                        </div>
                        <div class="breakdown-item">
                            <span>Storage Costs</span>
                            <span>$20,000</span>
                        </div>
                    </div>
                    <button class="btn btn-primary w-full" style="margin-top: var(--space-4);">
                        <i class="fas fa-shield-alt"></i>
                        Prevent These Charges
                    </button>
                </div>
            </div>
            
            <div class="detail-section">
                <h3 class="detail-section-title">Container Information</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Type</span>
                        <span class="detail-value">40' High Cube</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Weight</span>
                        <span class="detail-value">28,450 kg</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Commodity</span>
                        <span class="detail-value">Electronics</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Value</span>
                        <span class="detail-value">$2.4M</span>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3 class="detail-section-title">Journey Timeline</h3>
                <div class="journey-timeline">
                    <div class="timeline-item completed">
                        <div class="timeline-marker">
                            <i class="fas fa-check"></i>
                        </div>
                        <div class="timeline-content">
                            <strong>Origin: Shanghai, China</strong>
                            <p>Departed: Nov 15, 2024</p>
                        </div>
                    </div>
                    <div class="timeline-item completed">
                        <div class="timeline-marker">
                            <i class="fas fa-check"></i>
                        </div>
                        <div class="timeline-content">
                            <strong>Transit: Singapore</strong>
                            <p>Arrived: Nov 20, 2024</p>
                        </div>
                    </div>
                    <div class="timeline-item current">
                        <div class="timeline-marker">
                            <i class="fas fa-ship"></i>
                        </div>
                        <div class="timeline-content">
                            <strong>Current: Los Angeles, USA</strong>
                            <p>Arrived: Dec 5, 2024 (Delayed)</p>
                            <span class="status-badge danger">3 days until charges</span>
                        </div>
                    </div>
                    <div class="timeline-item pending">
                        <div class="timeline-marker">
                            <i class="fas fa-circle"></i>
                        </div>
                        <div class="timeline-content">
                            <strong>Destination: Chicago, IL</strong>
                            <p>ETA: Dec 12, 2024</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3 class="detail-section-title">AI Risk Analysis</h3>
                <div class="ai-analysis-card">
                    <div class="analysis-header">
                        <span class="badge badge-enterprise">
                            <i class="fas fa-brain"></i>
                            AI Prediction
                        </span>
                        <span class="analysis-confidence">94% Confidence</span>
                    </div>
                    <div class="analysis-content">
                        <p><strong>High Risk Factors:</strong></p>
                        <ul>
                            <li>Port congestion at LA expected to increase 40% this week</li>
                            <li>Carrier has 78% on-time delivery rate for this route</li>
                            <li>Similar containers incurred average $425K in charges</li>
                        </ul>
                        <p><strong>Recommended Actions:</strong></p>
                        <ol>
                            <li>Schedule immediate pickup to avoid detention charges</li>
                            <li>Negotiate extended free time with carrier</li>
                            <li>Consider transloading to expedite final delivery</li>
                        </ol>
                    </div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3 class="detail-section-title">Action History</h3>
                <div class="action-history">
                    <div class="history-item">
                        <div class="history-icon">
                            <i class="fas fa-bell"></i>
                        </div>
                        <div class="history-content">
                            <strong>Risk Alert Sent</strong>
                            <p>Notification sent to operations team</p>
                            <span class="history-time">2 hours ago</span>
                        </div>
                    </div>
                    <div class="history-item">
                        <div class="history-icon">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div class="history-content">
                            <strong>Risk Score Updated</strong>
                            <p>Increased from 72% to 87% due to port delays</p>
                            <span class="history-time">1 day ago</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Pagination -->
        <div class="pagination-wrapper">
            <div class="pagination-info">
                Showing <span id="showing-start">1</span>-<span id="showing-end">${Math.min(itemsPerPage, totalContainers)}</span> of <span id="total-containers">${totalContainers.toLocaleString()}</span> containers
            </div>
            <div class="pagination-controls">
                <button class="btn btn-ghost" onclick="previousPage()" id="prev-page" disabled>
                    <i class="fas fa-chevron-left"></i>
                    Previous
                </button>
                <div class="page-numbers" id="page-numbers">
                    <!-- Page numbers will be inserted here -->
                </div>
                <button class="btn btn-ghost" onclick="nextPage()" id="next-page">
                    Next
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        </div>

        <!-- Add Container Modal -->
        <div id="add-container-modal" class="modal">
            <div class="modal-content">
                <button class="modal-close" onclick="closeAddContainerModal()">
                    <i class="fas fa-times"></i>
                </button>
                <h2>Track New Containers</h2>
                <p>Add containers to prevent detention and demurrage charges</p>
                
                <div class="modal-tabs">
                    <button class="modal-tab active" onclick="switchModalTab('single')">
                        <i class="fas fa-box"></i>
                        Single Container
                    </button>
                    <button class="modal-tab" onclick="switchModalTab('bulk')">
                        <i class="fas fa-boxes"></i>
                        Bulk Import
                    </button>
                    <button class="modal-tab" onclick="switchModalTab('api')">
                        <i class="fas fa-plug"></i>
                        API Integration
                    </button>
                </div>
                
                <div id="single-container-form" class="tab-content active">
                    <form id="add-container-form">
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label">Container ID *</label>
                                <input type="text" class="form-control" id="container-id" required placeholder="e.g., MSKU1234567">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Carrier *</label>
                                <select class="form-control" id="carrier" required>
                                    <option value="">Select Carrier</option>
                                    <option value="Maersk">Maersk</option>
                                    <option value="MSC">MSC</option>
                                    <option value="CMA CGM">CMA CGM</option>
                                    <option value="COSCO">COSCO</option>
                                    <option value="Hapag-Lloyd">Hapag-Lloyd</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label">Origin Port *</label>
                                <input type="text" class="form-control" id="origin" required placeholder="e.g., Shanghai, China">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Destination Port *</label>
                                <input type="text" class="form-control" id="destination" required placeholder="e.g., Los Angeles, USA">
                            </div>
                        </div>
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label">Container Type</label>
                                <select class="form-control" id="container-type">
                                    <option value="20-standard">20' Standard</option>
                                    <option value="40-standard">40' Standard</option>
                                    <option value="40-high-cube">40' High Cube</option>
                                    <option value="45-high-cube">45' High Cube</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Cargo Value</label>
                                <input type="number" class="form-control" id="cargo-value" placeholder="e.g., 2500000">
                            </div>
                        </div>
                        <div class="form-note">
                            <i class="fas fa-info-circle"></i>
                            We'll start monitoring this container immediately and alert you to any risks
                        </div>
                        <button type="submit" class="btn btn-primary btn-lg w-full">
                            <i class="fas fa-plus"></i>
                            Start Tracking Container
                        </button>
                    </form>
                </div>
                
                <div id="bulk-import-form" class="tab-content">
                    <div class="upload-area">
                        <i class="fas fa-cloud-upload-alt"></i>
                        <h3>Upload Container List</h3>
                        <p>Drag and drop your CSV/Excel file here or click to browse</p>
                        <input type="file" id="bulk-file" accept=".csv,.xlsx,.xls" style="display: none;">
                        <button class="btn btn-secondary" onclick="document.getElementById('bulk-file').click()">
                            Choose File
                        </button>
                    </div>
                    <div class="upload-format">
                        <p><strong>Required columns:</strong> Container ID, Carrier, Origin, Destination</p>
                        <a href="#" class="text-primary">Download sample template</a>
                    </div>
                </div>
                
                <div id="api-integration-form" class="tab-content">
                    <div class="api-info">
                        <h3>Connect Your Systems</h3>
                        <p>Automatically sync containers from your TMS, ERP, or carrier portals</p>
                        <div class="integration-options">
                            <div class="integration-card">
                                <img src="/assets/images/sap-logo.png" alt="SAP">
                                <span>SAP TM</span>
                            </div>
                            <div class="integration-card">
                                <img src="/assets/images/oracle-logo.png" alt="Oracle">
                                <span>Oracle OTM</span>
                            </div>
                            <div class="integration-card">
                                <img src="/assets/images/jda-logo.png" alt="JDA">
                                <span>JDA TMS</span>
                            </div>
                        </div>
                        <button class="btn btn-primary w-full">
                            <i class="fas fa-cogs"></i>
                            Configure Integration
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Generate container list items with mobile-responsive design
function generateContainerListItems(containers = mockContainers) {
    const isMobile = window.innerWidth <= 768;
    
    return containers.map(container => {
        const riskClass = container.risk >= 80 ? 'high' : container.risk >= 50 ? 'medium' : 'low';
        const statusClass = container.status === 'delayed' ? 'danger' : 
                          container.status === 'at-risk' ? 'warning' : 'success';
        
        if (isMobile) {
            // Mobile card layout
            return `
                <div class="container-item" onclick="showContainerDetails('${container.id}')">
                    <div class="container-item-header">
                        <div class="container-item-info">
                            <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-2);">
                                <input type="checkbox" class="container-checkbox" onclick="event.stopPropagation(); toggleContainerSelection('${container.id}')" data-container-id="${container.id}">
                                <div class="container-id" style="font-family: var(--font-mono); font-weight: var(--font-bold); font-size: var(--text-lg);">${container.id}</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: var(--space-2);">
                                <div style="width: 20px; height: 20px; background: ${container.carrierColor}; border-radius: 3px;"></div>
                                <span style="font-weight: var(--font-medium);">${container.carrier}</span>
                                <span class="status-badge ${statusClass}">
                                    <span class="status-indicator ${statusClass}"></span>
                                    ${container.status.charAt(0).toUpperCase() + container.status.slice(1).replace('-', ' ')}
                                </span>
                            </div>
                        </div>
                        <div class="container-item-actions">
                            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); preventCharges('${container.id}')">
                                <i class="fas fa-shield-alt"></i>
                            </button>
                            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); showContainerDetails('${container.id}')" title="View Details">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                        </div>
                    </div>
                    <div class="container-mobile-details">
                        <div class="mobile-detail-item">
                            <span class="mobile-detail-label">Risk Score</span>
                            <span class="mobile-detail-value" style="color: var(--enterprise-${riskClass === 'high' ? 'danger' : riskClass === 'medium' ? 'warning' : 'success'});">
                                ${container.risk}%
                            </span>
                        </div>
                        <div class="mobile-detail-item">
                            <span class="mobile-detail-label">Financial Impact</span>
                            <span class="mobile-detail-value" style="color: var(--enterprise-${riskClass === 'high' ? 'danger' : riskClass === 'medium' ? 'warning' : 'gray-600'});">
                                $${container.financialImpact.toLocaleString()}
                            </span>
                        </div>
                        <div class="mobile-detail-item">
                            <span class="mobile-detail-label">Days to Charge</span>
                            <span class="mobile-detail-value" style="color: var(--enterprise-${container.daysToCharge <= 3 ? 'danger' : container.daysToCharge <= 7 ? 'warning' : 'gray-600'});">
                                ${container.daysToCharge ? `${container.daysToCharge} days` : 'Safe'}
                            </span>
                        </div>
                        <div class="mobile-detail-item">
                            <span class="mobile-detail-label">Location</span>
                            <span class="mobile-detail-value">${container.location}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Desktop table layout
            return `
                <div class="container-item" onclick="showContainerDetails('${container.id}')">
                    <div style="display: flex; align-items: center; gap: var(--space-4); flex: 1;">
                        <input type="checkbox" class="container-checkbox" onclick="event.stopPropagation(); toggleContainerSelection('${container.id}')" data-container-id="${container.id}">
                        <div class="container-id">${container.id}</div>
                    </div>
                    <div class="container-carrier">
                        <div style="display: flex; align-items: center; gap: var(--space-2);">
                            <div style="width: 24px; height: 24px; background: ${container.carrierColor}; border-radius: 4px;"></div>
                            <span>${container.carrier}</span>
                        </div>
                    </div>
                    <div class="container-status">
                        <span class="status-badge ${statusClass}">
                            <span class="status-indicator ${statusClass}"></span>
                            ${container.status.charAt(0).toUpperCase() + container.status.slice(1).replace('-', ' ')}
                        </span>
                    </div>
                    <div class="container-risk">
                        <span class="risk-score ${riskClass}">${container.risk}%</span>
                    </div>
                    <div class="container-value">
                        <span style="color: var(--enterprise-${riskClass === 'high' ? 'danger' : riskClass === 'medium' ? 'warning' : 'gray-600'}); font-weight: var(--font-bold); font-size: var(--text-lg);">
                            $${container.financialImpact.toLocaleString()}
                        </span>
                    </div>
                    <div class="container-days">
                        <span style="color: var(--enterprise-${container.daysToCharge <= 3 ? 'danger' : container.daysToCharge <= 7 ? 'warning' : 'gray-600'}); font-weight: var(--font-semibold);">
                            ${container.daysToCharge ? `${container.daysToCharge} days` : 'Safe'}
                        </span>
                    </div>
                    <div class="container-actions">
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); preventCharges('${container.id}')">
                            <i class="fas fa-shield-alt"></i>
                            Prevent Charge
                        </button>
                        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); showContainerDetails('${container.id}')" title="View Details">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    }).join('');
}

// Initialize container tracking page
function initContainerTracking() {
    const listItems = document.getElementById('container-list-items');
    if (listItems) {
        listItems.innerHTML = generateContainerListItems();
    }
    
    updatePagination();
    updateQuickStats();
}

// Filter functions
function updateFilters() {
    const riskFilter = document.getElementById('risk-filter').value;
    const carrierFilter = document.getElementById('carrier-filter').value;
    const statusFilter = document.getElementById('status-filter').value;
    const daysFilter = document.getElementById('days-filter').value;
    
    currentFilters = {
        risk: riskFilter,
        carrier: carrierFilter,
        status: statusFilter,
        days: daysFilter
    };
    
    // Apply filters and update display
    applyFilters();
    updateFilterChips();
}

function applyFilters() {
    // In production, this would make an API call with filters
    let filteredContainers = mockContainers;
    
    if (currentFilters.risk) {
        filteredContainers = filteredContainers.filter(container => {
            if (currentFilters.risk === 'high') return container.risk >= 80;
            if (currentFilters.risk === 'medium') return container.risk >= 50 && container.risk < 80;
            if (currentFilters.risk === 'low') return container.risk < 50;
            return true;
        });
    }
    
    if (currentFilters.carrier) {
        filteredContainers = filteredContainers.filter(container => 
            container.carrier.toLowerCase().includes(currentFilters.carrier.toLowerCase())
        );
    }
    
    if (currentFilters.status) {
        filteredContainers = filteredContainers.filter(container => 
            container.status === currentFilters.status
        );
    }
    
    const listItems = document.getElementById('container-list-items');
    if (listItems) {
        listItems.innerHTML = generateContainerListItems(filteredContainers);
    }
}

function clearFilters() {
    currentFilters = {};
    document.getElementById('risk-filter').value = '';
    document.getElementById('carrier-filter').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('days-filter').value = '';
    
    applyFilters();
    updateFilterChips();
}

function updateFilterChips() {
    const chipsContainer = document.getElementById('active-filters');
    const hasFilters = Object.values(currentFilters).some(filter => filter);
    
    if (hasFilters) {
        chipsContainer.style.display = 'flex';
        chipsContainer.innerHTML = Object.entries(currentFilters)
            .filter(([key, value]) => value)
            .map(([key, value]) => `
                <div class="filter-chip">
                    ${key}: ${value}
                    <button onclick="removeFilter('${key}')">×</button>
                </div>
            `).join('');
    } else {
        chipsContainer.style.display = 'none';
    }
}

function removeFilter(filterKey) {
    currentFilters[filterKey] = '';
    document.getElementById(`${filterKey}-filter`).value = '';
    applyFilters();
    updateFilterChips();
}

// Selection functions
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all');
    const containerCheckboxes = document.querySelectorAll('.container-checkbox');
    
    containerCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        const containerId = checkbox.getAttribute('data-container-id');
        if (selectAllCheckbox.checked) {
            selectedContainers.add(containerId);
        } else {
            selectedContainers.delete(containerId);
        }
    });
    
    updateBulkActions();
}

function toggleContainerSelection(containerId) {
    if (selectedContainers.has(containerId)) {
        selectedContainers.delete(containerId);
    } else {
        selectedContainers.add(containerId);
    }
    
    updateBulkActions();
    updateSelectAllState();
}

function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('select-all');
    const containerCheckboxes = document.querySelectorAll('.container-checkbox');
    const checkedBoxes = document.querySelectorAll('.container-checkbox:checked');
    
    if (checkedBoxes.length === 0) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    } else if (checkedBoxes.length === containerCheckboxes.length) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = true;
    } else {
        selectAllCheckbox.indeterminate = true;
    }
}

function updateBulkActions() {
    const bulkActionsBar = document.getElementById('bulk-actions');
    const bulkCount = document.querySelector('.bulk-count');
    
    if (selectedContainers.size > 0) {
        bulkActionsBar.style.display = 'flex';
        bulkCount.textContent = selectedContainers.size;
    } else {
        bulkActionsBar.style.display = 'none';
    }
}

function clearSelection() {
    selectedContainers.clear();
    document.querySelectorAll('.container-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateBulkActions();
    updateSelectAllState();
}

// Detail panel functions
function showContainerDetails(containerId) {
    const container = mockContainers.find(c => c.id === containerId);
    if (!container) return;
    
    const panel = document.getElementById('container-detail-panel');
    const containerIdElement = document.getElementById('detail-container-id');
    
    containerIdElement.textContent = container.id;
    panel.classList.add('open');
    
    // Update detail panel content based on selected container
    updateDetailPanelContent(container);
}

function updateDetailPanelContent(container) {
    // Update financial impact
    const impactValue = document.querySelector('.impact-value');
    if (impactValue) {
        impactValue.textContent = `$${container.financialImpact.toLocaleString()}`;
    }
    
    // Update container information
    const detailItems = document.querySelectorAll('.detail-item');
    if (detailItems.length >= 4) {
        detailItems[0].querySelector('.detail-value').textContent = container.type;
        detailItems[1].querySelector('.detail-value').textContent = container.weight;
        detailItems[2].querySelector('.detail-value').textContent = container.commodity;
        detailItems[3].querySelector('.detail-value').textContent = `$${(container.value / 1000000).toFixed(1)}M`;
    }
}

function closeDetailPanel() {
    const panel = document.getElementById('container-detail-panel');
    panel.classList.remove('open');
}

// Modal functions
function showAddContainerModal() {
    const modal = document.getElementById('add-container-modal');
    modal.classList.add('show');
}

function closeAddContainerModal() {
    const modal = document.getElementById('add-container-modal');
    modal.classList.remove('show');
}

function switchModalTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.modal-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}-container-form`).classList.add('active');
}

// Action functions
function preventCharges(containerId) {
    console.log(`Preventing charges for container: ${containerId}`);
    showNotification('Charge prevention initiated for ' + containerId, 'success');
}

function bulkPreventCharges() {
    console.log(`Preventing charges for ${selectedContainers.size} containers`);
    showNotification(`Charge prevention initiated for ${selectedContainers.size} containers`, 'success');
    clearSelection();
}

function bulkExport() {
    console.log(`Exporting ${selectedContainers.size} containers`);
    showNotification(`Exporting ${selectedContainers.size} containers`, 'success');
}

function bulkAssign() {
    console.log(`Assigning team to ${selectedContainers.size} containers`);
    showNotification(`Team assignment initiated for ${selectedContainers.size} containers`, 'success');
}

function bulkArchive() {
    console.log(`Archiving ${selectedContainers.size} containers`);
    showNotification(`Archived ${selectedContainers.size} containers`, 'success');
    clearSelection();
}

function exportContainers() {
    console.log('Exporting all containers');
    showNotification('Container export started. Check your email for the report.', 'success');
}

// Pagination functions
function updatePagination() {
    const totalPages = Math.ceil(totalContainers / itemsPerPage);
    const pageNumbers = document.getElementById('page-numbers');
    
    if (pageNumbers) {
        let paginationHTML = '';
        
        // Show first page
        if (currentPage > 3) {
            paginationHTML += `<button class="page-number" onclick="goToPage(1)">1</button>`;
            if (currentPage > 4) {
                paginationHTML += `<span class="page-ellipsis">...</span>`;
            }
        }
        
        // Show pages around current page
        for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
            paginationHTML += `<button class="page-number ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        }
        
        // Show last page
        if (currentPage < totalPages - 2) {
            if (currentPage < totalPages - 3) {
                paginationHTML += `<span class="page-ellipsis">...</span>`;
            }
            paginationHTML += `<button class="page-number" onclick="goToPage(${totalPages})">${totalPages}</button>`;
        }
        
        pageNumbers.innerHTML = paginationHTML;
    }
    
    // Update pagination controls
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === Math.ceil(totalContainers / itemsPerPage);
    
    // Update showing info
    const showingStart = (currentPage - 1) * itemsPerPage + 1;
    const showingEnd = Math.min(currentPage * itemsPerPage, totalContainers);
    document.getElementById('showing-start').textContent = showingStart;
    document.getElementById('showing-end').textContent = showingEnd;
}

function goToPage(page) {
    currentPage = page;
    updatePagination();
    // In production, this would fetch new data
    initContainerTracking();
}

function previousPage() {
    if (currentPage > 1) {
        goToPage(currentPage - 1);
    }
}

function nextPage() {
    if (currentPage < Math.ceil(totalContainers / itemsPerPage)) {
        goToPage(currentPage + 1);
    }
}

// Quick stats update
function updateQuickStats() {
    // In production, this would fetch real-time data from API
    // For now, using static data
}

// Notification function
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : 'info'}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to notification container
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    
    container.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Handle window resize for responsive updates
function handleResize() {
    const listItems = document.getElementById('container-list-items');
    if (listItems) {
        listItems.innerHTML = generateContainerListItems();
    }
}

// Debounce resize handler to improve performance
let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 250);
});

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the container tracking page
    if (document.getElementById('container-list-items')) {
        initContainerTracking();
    }
});

// Export functions for global access
window.ContainerTracking = {
    initContainerTracking,
    showContainerDetails,
    closeDetailPanel,
    showAddContainerModal,
    closeAddContainerModal,
    switchModalTab,
    updateFilters,
    clearFilters,
    toggleSelectAll,
    toggleContainerSelection,
    clearSelection,
    preventCharges,
    bulkPreventCharges,
    bulkExport,
    bulkAssign,
    bulkArchive,
    exportContainers,
    goToPage,
    previousPage,
    nextPage
};