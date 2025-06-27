#!/bin/bash
echo "Creating infrastructure directories..."
cd /var/www/html
mkdir -p infrastructure/{cloud,security,data,integration,monitoring}


echo "Creating cloud/index.html..."
cat > 'infrastructure/cloud/index.html' << 'ENDOFFILE'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cloud Infrastructure | UIP Enterprise Platform</title>
    <meta name="description" content="Enterprise-grade cloud infrastructure management for UIP with multi-region deployment, auto-scaling, and 99.99% uptime SLA.">
    <link rel="icon" type="image/svg+xml" href="/ROOTUIP/brand/logo-icon.svg">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            overflow-x: hidden;
        }

        .infrastructure-container {
            display: flex;
            min-height: 100vh;
        }

        /* Sidebar */
        .sidebar {
            width: 260px;
            background: #1e293b;
            padding: 20px 0;
            position: fixed;
            height: 100vh;
            overflow-y: auto;
            border-right: 1px solid #334155;
        }

        .logo {
            padding: 0 20px 30px;
            border-bottom: 1px solid #334155;
            margin-bottom: 20px;
        }

        .logo h2 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #38bdf8;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .nav-section {
            margin-bottom: 30px;
            padding: 0 20px;
        }

        .nav-title {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 10px;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 15px;
            margin: 5px -15px;
            border-radius: 8px;
            text-decoration: none;
            color: #cbd5e1;
            transition: all 0.3s ease;
        }

        .nav-item:hover, .nav-item.active {
            background: rgba(56, 189, 248, 0.1);
            color: #38bdf8;
        }

        /* Main Content */
        .main-content {
            flex: 1;
            margin-left: 260px;
            padding: 20px;
        }

        .header {
            background: #1e293b;
            padding: 25px 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .page-title {
            font-size: 1.8rem;
            font-weight: 700;
            color: #f1f5f9;
        }

        .status-indicator {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 16px;
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid #22c55e;
            border-radius: 20px;
            color: #22c55e;
            font-weight: 600;
            font-size: 0.9rem;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background: #22c55e;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        /* Global Infrastructure Map */
        .infrastructure-map {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
            position: relative;
            overflow: hidden;
        }

        .map-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
        }

        .map-title {
            font-size: 1.4rem;
            font-weight: 600;
            color: #f1f5f9;
        }

        .region-selector {
            display: flex;
            gap: 10px;
        }

        .region-btn {
            padding: 8px 16px;
            background: #334155;
            border: 1px solid #475569;
            border-radius: 6px;
            color: #cbd5e1;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .region-btn:hover, .region-btn.active {
            background: #38bdf8;
            border-color: #38bdf8;
            color: #0f172a;
        }

        .world-map {
            height: 400px;
            background: #0f172a;
            border-radius: 8px;
            position: relative;
            background-image: radial-gradient(circle at 20% 50%, #1e293b 0%, transparent 50%),
                              radial-gradient(circle at 80% 30%, #1e293b 0%, transparent 50%),
                              radial-gradient(circle at 60% 70%, #1e293b 0%, transparent 50%);
        }

        .region-marker {
            position: absolute;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 0.8rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .region-marker.primary {
            background: #38bdf8;
            color: #0f172a;
            box-shadow: 0 0 0 4px rgba(56, 189, 248, 0.3);
        }

        .region-marker.secondary {
            background: #22c55e;
            color: white;
            box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.3);
        }

        .region-marker:hover {
            transform: scale(1.2);
        }

        /* Region Stats */
        .region-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .region-card {
            background: #1e293b;
            padding: 25px;
            border-radius: 12px;
            border: 1px solid #334155;
            position: relative;
            overflow: hidden;
        }

        .region-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: #38bdf8;
        }

        .region-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .region-name {
            font-size: 1.2rem;
            font-weight: 600;
            color: #f1f5f9;
        }

        .region-status {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-active {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
        }

        .status-standby {
            background: rgba(251, 191, 36, 0.1);
            color: #fbbf24;
        }

        .region-metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        .metric-item {
            padding: 10px;
            background: #0f172a;
            border-radius: 8px;
        }

        .metric-label {
            font-size: 0.8rem;
            color: #64748b;
            margin-bottom: 5px;
        }

        .metric-value {
            font-size: 1.3rem;
            font-weight: 700;
            color: #f1f5f9;
        }

        /* Auto-scaling Dashboard */
        .scaling-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .scaling-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }

        .scaling-chart {
            height: 200px;
            background: #0f172a;
            border-radius: 8px;
            display: flex;
            align-items: flex-end;
            padding: 20px;
            gap: 4px;
        }

        .chart-bar {
            flex: 1;
            background: #38bdf8;
            border-radius: 4px 4px 0 0;
            min-height: 20px;
            transition: height 0.3s ease;
        }

        .scaling-controls {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }

        .control-btn {
            flex: 1;
            padding: 10px;
            background: #334155;
            border: 1px solid #475569;
            border-radius: 6px;
            color: #cbd5e1;
            cursor: pointer;
            transition: all 0.3s ease;
            text-align: center;
        }

        .control-btn:hover {
            background: #475569;
        }

        /* Load Balancer Status */
        .load-balancer-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .lb-card {
            background: #1e293b;
            padding: 25px;
            border-radius: 12px;
            border: 1px solid #334155;
        }

        .lb-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .lb-title {
            font-weight: 600;
            color: #f1f5f9;
        }

        .lb-health {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
        }

        .server-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .server-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: #0f172a;
            border-radius: 6px;
        }

        .server-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .server-icon {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #22c55e;
        }

        .server-load {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .load-bar {
            width: 60px;
            height: 6px;
            background: #334155;
            border-radius: 3px;
            overflow: hidden;
        }

        .load-fill {
            height: 100%;
            background: #38bdf8;
            transition: width 0.3s ease;
        }

        /* CDN Performance */
        .cdn-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .cdn-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 25px;
        }

        .cdn-stat {
            text-align: center;
            padding: 20px;
            background: #0f172a;
            border-radius: 8px;
        }

        .cdn-value {
            font-size: 2rem;
            font-weight: 700;
            color: #38bdf8;
            margin-bottom: 5px;
        }

        .cdn-label {
            color: #64748b;
            font-size: 0.9rem;
        }

        /* Disaster Recovery */
        .dr-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
        }

        .dr-status {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }

        .dr-item {
            padding: 20px;
            background: #0f172a;
            border-radius: 8px;
            border: 1px solid #334155;
        }

        .dr-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .dr-title {
            font-weight: 600;
            color: #f1f5f9;
        }

        .dr-last-backup {
            font-size: 0.85rem;
            color: #64748b;
        }

        .dr-progress {
            margin-bottom: 10px;
        }

        .progress-bar {
            width: 100%;
            height: 8px;
            background: #334155;
            border-radius: 4px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #38bdf8, #3b82f6);
            transition: width 0.3s ease;
        }

        .dr-actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }

        .action-btn {
            padding: 8px 16px;
            background: #334155;
            border: 1px solid #475569;
            border-radius: 6px;
            color: #cbd5e1;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .action-btn:hover {
            background: #475569;
        }

        .action-btn.primary {
            background: #38bdf8;
            border-color: #38bdf8;
            color: #0f172a;
        }

        .action-btn.primary:hover {
            background: #0284c7;
            border-color: #0284c7;
        }

        @media (max-width: 768px) {
            .sidebar {
                transform: translateX(-100%);
            }

            .main-content {
                margin-left: 0;
            }

            .region-stats {
                grid-template-columns: 1fr;
            }

            .load-balancer-section {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="infrastructure-container">
        <!-- Sidebar -->
        <nav class="sidebar">
            <div class="logo">
                <h2>🌐 UIP Infrastructure</h2>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Infrastructure</div>
                <a href="/infrastructure/cloud/index.html" class="nav-item active">
                    <span>☁️</span> Cloud Architecture
                </a>
                <a href="/infrastructure/security/index.html" class="nav-item">
                    <span>🔐</span> Security Center
                </a>
                <a href="/infrastructure/data/index.html" class="nav-item">
                    <span>💾</span> Data Management
                </a>
                <a href="/infrastructure/integration/index.html" class="nav-item">
                    <span>🔗</span> Integration Hub
                </a>
                <a href="/infrastructure/monitoring/index.html" class="nav-item">
                    <span>📊</span> Monitoring
                </a>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Operations</div>
                <a href="#" class="nav-item">
                    <span>🚨</span> Incident Management
                </a>
                <a href="#" class="nav-item">
                    <span>📈</span> Performance
                </a>
                <a href="#" class="nav-item">
                    <span>💰</span> Cost Optimization
                </a>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Compliance</div>
                <a href="#" class="nav-item">
                    <span>✅</span> SOC 2
                </a>
                <a href="#" class="nav-item">
                    <span>🛡️</span> GDPR
                </a>
                <a href="#" class="nav-item">
                    <span>📋</span> Audit Logs
                </a>
            </div>
        </nav>

        <!-- Main Content -->
        <main class="main-content">
            <!-- Header -->
            <div class="header">
                <div class="header-top">
                    <h1 class="page-title">Cloud Infrastructure</h1>
                    <div class="status-indicator">
                        <div class="status-dot"></div>
                        <span>All Systems Operational - 99.99% Uptime</span>
                    </div>
                </div>
            </div>

            <!-- Global Infrastructure Map -->
            <div class="infrastructure-map">
                <div class="map-header">
                    <h2 class="map-title">Global Infrastructure</h2>
                    <div class="region-selector">
                        <button class="region-btn active" onclick="selectRegion('all')">All Regions</button>
                        <button class="region-btn" onclick="selectRegion('americas')">Americas</button>
                        <button class="region-btn" onclick="selectRegion('europe')">Europe</button>
                        <button class="region-btn" onclick="selectRegion('asia')">Asia Pacific</button>
                    </div>
                </div>
                
                <div class="world-map" id="worldMap">
                    <!-- US East -->
                    <div class="region-marker primary" style="left: 25%; top: 40%;" onclick="showRegionDetails('us-east')">
                        USE1
                    </div>
                    <!-- US West -->
                    <div class="region-marker secondary" style="left: 15%; top: 35%;" onclick="showRegionDetails('us-west')">
                        USW2
                    </div>
                    <!-- Europe -->
                    <div class="region-marker primary" style="left: 48%; top: 30%;" onclick="showRegionDetails('eu-west')">
                        EU1
                    </div>
                    <!-- Asia -->
                    <div class="region-marker secondary" style="left: 75%; top: 45%;" onclick="showRegionDetails('ap-south')">
                        APS1
                    </div>
                </div>
            </div>

            <!-- Region Stats -->
            <div class="region-stats">
                <div class="region-card">
                    <div class="region-header">
                        <h3 class="region-name">US East (Primary)</h3>
                        <span class="region-status status-active">Active</span>
                    </div>
                    <div class="region-metrics">
                        <div class="metric-item">
                            <div class="metric-label">Availability</div>
                            <div class="metric-value">99.99%</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">Response Time</div>
                            <div class="metric-value">12ms</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">Active Instances</div>
                            <div class="metric-value">247</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">Traffic</div>
                            <div class="metric-value">2.4TB/h</div>
                        </div>
                    </div>
                </div>

                <div class="region-card">
                    <div class="region-header">
                        <h3 class="region-name">Europe West</h3>
                        <span class="region-status status-active">Active</span>
                    </div>
                    <div class="region-metrics">
                        <div class="metric-item">
                            <div class="metric-label">Availability</div>
                            <div class="metric-value">99.98%</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">Response Time</div>
                            <div class="metric-value">18ms</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">Active Instances</div>
                            <div class="metric-value">189</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">Traffic</div>
                            <div class="metric-value">1.8TB/h</div>
                        </div>
                    </div>
                </div>

                <div class="region-card">
                    <div class="region-header">
                        <h3 class="region-name">Asia Pacific</h3>
                        <span class="region-status status-standby">Standby</span>
                    </div>
                    <div class="region-metrics">
                        <div class="metric-item">
                            <div class="metric-label">Availability</div>
                            <div class="metric-value">99.95%</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">Response Time</div>
                            <div class="metric-value">32ms</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">Active Instances</div>
                            <div class="metric-value">124</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-label">Traffic</div>
                            <div class="metric-value">980GB/h</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Auto-scaling Dashboard -->
            <div class="scaling-section">
                <div class="map-header">
                    <h2 class="map-title">Auto-Scaling Status</h2>
                    <span style="color: #64748b; font-size: 0.9rem;">Real-time instance scaling based on demand</span>
                </div>

                <div class="scaling-grid">
                    <div>
                        <h4 style="color: #cbd5e1; margin-bottom: 10px;">Web Tier Scaling</h4>
                        <div class="scaling-chart" id="webScaling">
                            <div class="chart-bar" style="height: 60%;"></div>
                            <div class="chart-bar" style="height: 75%;"></div>
                            <div class="chart-bar" style="height: 85%;"></div>
                            <div class="chart-bar" style="height: 70%;"></div>
                            <div class="chart-bar" style="height: 65%;"></div>
                            <div class="chart-bar" style="height: 80%;"></div>
                            <div class="chart-bar" style="height: 90%;"></div>
                            <div class="chart-bar" style="height: 85%;"></div>
                        </div>
                        <div class="scaling-controls">
                            <div class="control-btn">Min: 10</div>
                            <div class="control-btn">Current: 85</div>
                            <div class="control-btn">Max: 200</div>
                        </div>
                    </div>

                    <div>
                        <h4 style="color: #cbd5e1; margin-bottom: 10px;">API Tier Scaling</h4>
                        <div class="scaling-chart" id="apiScaling">
                            <div class="chart-bar" style="height: 40%;"></div>
                            <div class="chart-bar" style="height: 45%;"></div>
                            <div class="chart-bar" style="height: 55%;"></div>
                            <div class="chart-bar" style="height: 65%;"></div>
                            <div class="chart-bar" style="height: 70%;"></div>
                            <div class="chart-bar" style="height: 60%;"></div>
                            <div class="chart-bar" style="height: 55%;"></div>
                            <div class="chart-bar" style="height: 50%;"></div>
                        </div>
                        <div class="scaling-controls">
                            <div class="control-btn">Min: 20</div>
                            <div class="control-btn">Current: 124</div>
                            <div class="control-btn">Max: 500</div>
                        </div>
                    </div>

                    <div>
                        <h4 style="color: #cbd5e1; margin-bottom: 10px;">Worker Tier Scaling</h4>
                        <div class="scaling-chart" id="workerScaling">
                            <div class="chart-bar" style="height: 30%;"></div>
                            <div class="chart-bar" style="height: 35%;"></div>
                            <div class="chart-bar" style="height: 40%;"></div>
                            <div class="chart-bar" style="height: 45%;"></div>
                            <div class="chart-bar" style="height: 50%;"></div>
                            <div class="chart-bar" style="height: 45%;"></div>
                            <div class="chart-bar" style="height: 40%;"></div>
                            <div class="chart-bar" style="height: 35%;"></div>
                        </div>
                        <div class="scaling-controls">
                            <div class="control-btn">Min: 5</div>
                            <div class="control-btn">Current: 38</div>
                            <div class="control-btn">Max: 100</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Load Balancer Status -->
            <div class="load-balancer-section">
                <div class="lb-card">
                    <div class="lb-header">
                        <h3 class="lb-title">Application Load Balancer - US East</h3>
                        <span class="lb-health">Healthy</span>
                    </div>
                    <div class="server-list">
                        <div class="server-item">
                            <div class="server-info">
                                <div class="server-icon"></div>
                                <span>web-use1-001</span>
                            </div>
                            <div class="server-load">
                                <div class="load-bar">
                                    <div class="load-fill" style="width: 65%;"></div>
                                </div>
                                <span style="font-size: 0.85rem; color: #64748b;">65%</span>
                            </div>
                        </div>
                        <div class="server-item">
                            <div class="server-info">
                                <div class="server-icon"></div>
                                <span>web-use1-002</span>
                            </div>
                            <div class="server-load">
                                <div class="load-bar">
                                    <div class="load-fill" style="width: 72%;"></div>
                                </div>
                                <span style="font-size: 0.85rem; color: #64748b;">72%</span>
                            </div>
                        </div>
                        <div class="server-item">
                            <div class="server-info">
                                <div class="server-icon"></div>
                                <span>web-use1-003</span>
                            </div>
                            <div class="server-load">
                                <div class="load-bar">
                                    <div class="load-fill" style="width: 58%;"></div>
                                </div>
                                <span style="font-size: 0.85rem; color: #64748b;">58%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="lb-card">
                    <div class="lb-header">
                        <h3 class="lb-title">Network Load Balancer - Europe</h3>
                        <span class="lb-health">Healthy</span>
                    </div>
                    <div class="server-list">
                        <div class="server-item">
                            <div class="server-info">
                                <div class="server-icon"></div>
                                <span>api-eu1-001</span>
                            </div>
                            <div class="server-load">
                                <div class="load-bar">
                                    <div class="load-fill" style="width: 45%;"></div>
                                </div>
                                <span style="font-size: 0.85rem; color: #64748b;">45%</span>
                            </div>
                        </div>
                        <div class="server-item">
                            <div class="server-info">
                                <div class="server-icon"></div>
                                <span>api-eu1-002</span>
                            </div>
                            <div class="server-load">
                                <div class="load-bar">
                                    <div class="load-fill" style="width: 52%;"></div>
                                </div>
                                <span style="font-size: 0.85rem; color: #64748b;">52%</span>
                            </div>
                        </div>
                        <div class="server-item">
                            <div class="server-info">
                                <div class="server-icon"></div>
                                <span>api-eu1-003</span>
                            </div>
                            <div class="server-load">
                                <div class="load-bar">
                                    <div class="load-fill" style="width: 48%;"></div>
                                </div>
                                <span style="font-size: 0.85rem; color: #64748b;">48%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- CDN Performance -->
            <div class="cdn-section">
                <div class="map-header">
                    <h2 class="map-title">CDN Performance</h2>
                    <span style="color: #64748b; font-size: 0.9rem;">Global content delivery network statistics</span>
                </div>

                <div class="cdn-stats">
                    <div class="cdn-stat">
                        <div class="cdn-value">147</div>
                        <div class="cdn-label">Edge Locations</div>
                    </div>
                    <div class="cdn-stat">
                        <div class="cdn-value">98.7%</div>
                        <div class="cdn-label">Cache Hit Ratio</div>
                    </div>
                    <div class="cdn-stat">
                        <div class="cdn-value">8.2ms</div>
                        <div class="cdn-label">Avg Latency</div>
                    </div>
                    <div class="cdn-stat">
                        <div class="cdn-value">342TB</div>
                        <div class="cdn-label">Daily Transfer</div>
                    </div>
                    <div class="cdn-stat">
                        <div class="cdn-value">$2,847</div>
                        <div class="cdn-label">Daily Savings</div>
                    </div>
                </div>
            </div>

            <!-- Disaster Recovery -->
            <div class="dr-section">
                <div class="map-header">
                    <h2 class="map-title">Disaster Recovery & Backup</h2>
                    <span style="color: #64748b; font-size: 0.9rem;">Automated backup and recovery systems</span>
                </div>

                <div class="dr-status">
                    <div class="dr-item">
                        <div class="dr-header">
                            <h4 class="dr-title">Database Backups</h4>
                            <span class="dr-last-backup">Last: 15 min ago</span>
                        </div>
                        <div class="dr-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: 100%;"></div>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                            <span style="font-size: 0.85rem; color: #64748b;">RPO: 15 min</span>
                            <span style="font-size: 0.85rem; color: #64748b;">RTO: 30 min</span>
                        </div>
                        <div class="dr-actions">
                            <button class="action-btn">Test Restore</button>
                            <button class="action-btn primary">Manual Backup</button>
                        </div>
                    </div>

                    <div class="dr-item">
                        <div class="dr-header">
                            <h4 class="dr-title">Application State</h4>
                            <span class="dr-last-backup">Last: 5 min ago</span>
                        </div>
                        <div class="dr-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: 100%;"></div>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                            <span style="font-size: 0.85rem; color: #64748b;">RPO: 5 min</span>
                            <span style="font-size: 0.85rem; color: #64748b;">RTO: 15 min</span>
                        </div>
                        <div class="dr-actions">
                            <button class="action-btn">View Snapshots</button>
                            <button class="action-btn primary">Create Snapshot</button>
                        </div>
                    </div>

                    <div class="dr-item">
                        <div class="dr-header">
                            <h4 class="dr-title">File Storage</h4>
                            <span class="dr-last-backup">Continuous</span>
                        </div>
                        <div class="dr-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: 100%;"></div>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 10px;">
                            <span style="font-size: 0.85rem; color: #64748b;">RPO: Real-time</span>
                            <span style="font-size: 0.85rem; color: #64748b;">RTO: 5 min</span>
                        </div>
                        <div class="dr-actions">
                            <button class="action-btn">Sync Status</button>
                            <button class="action-btn primary">Force Sync</button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script>
        // Infrastructure monitoring data
        let infrastructureData = {
            regions: {
                'us-east': {
                    name: 'US East (Virginia)',
                    status: 'active',
                    availability: 99.99,
                    instances: 247,
                    traffic: '2.4TB/h'
                },
                'us-west': {
                    name: 'US West (Oregon)',
                    status: 'standby',
                    availability: 99.98,
                    instances: 124,
                    traffic: '980GB/h'
                },
                'eu-west': {
                    name: 'Europe (Frankfurt)',
                    status: 'active',
                    availability: 99.98,
                    instances: 189,
                    traffic: '1.8TB/h'
                },
                'ap-south': {
                    name: 'Asia Pacific (Singapore)',
                    status: 'standby',
                    availability: 99.95,
                    instances: 98,
                    traffic: '650GB/h'
                }
            },
            scaling: {
                web: { min: 10, current: 85, max: 200 },
                api: { min: 20, current: 124, max: 500 },
                worker: { min: 5, current: 38, max: 100 }
            }
        };

        function selectRegion(region) {
            const buttons = document.querySelectorAll('.region-btn');
            buttons.forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            console.log('Selected region:', region);
            trackEvent('Region Selected', { region: region });
        }

        function showRegionDetails(regionId) {
            const region = infrastructureData.regions[regionId];
            if (!region) return;
            
            trackEvent('Region Details Viewed', { 
                region: regionId,
                status: region.status,
                availability: region.availability
            });
            
            console.log('Region details:', region);
            // In production, this would show detailed region dashboard
        }

        function updateScalingCharts() {
            // Simulate real-time scaling updates
            const webBars = document.querySelectorAll('#webScaling .chart-bar');
            const apiBars = document.querySelectorAll('#apiScaling .chart-bar');
            const workerBars = document.querySelectorAll('#workerScaling .chart-bar');
            
            webBars.forEach(bar => {
                const height = 40 + Math.random() * 50;
                bar.style.height = height + '%';
            });
            
            apiBars.forEach(bar => {
                const height = 30 + Math.random() * 40;
                bar.style.height = height + '%';
            });
            
            workerBars.forEach(bar => {
                const height = 20 + Math.random() * 30;
                bar.style.height = height + '%';
            });
        }

        function simulateFailover(fromRegion, toRegion) {
            trackEvent('Failover Initiated', {
                from: fromRegion,
                to: toRegion,
                timestamp: new Date().toISOString()
            });
            
            console.log(`Initiating failover from ${fromRegion} to ${toRegion}`);
            // In production, this would trigger actual failover procedures
        }

        function testDisasterRecovery(component) {
            trackEvent('DR Test Started', { component: component });
            
            console.log('Starting disaster recovery test for:', component);
            // In production, this would initiate DR testing
        }

        function trackEvent(eventName, properties = {}) {
            console.log('Infrastructure Event:', eventName, properties);
            
            // Integration with monitoring systems
            if (typeof monitoring !== 'undefined') {
                monitoring.track(eventName, {
                    ...properties,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Initialize real-time updates
        document.addEventListener('DOMContentLoaded', function() {
            // Update scaling charts every 5 seconds
            setInterval(updateScalingCharts, 5000);
            
            // Simulate load balancer updates
            setInterval(() => {
                const loadBars = document.querySelectorAll('.load-fill');
                loadBars.forEach(bar => {
                    const currentLoad = parseInt(bar.style.width);
                    const newLoad = Math.max(20, Math.min(90, currentLoad + (Math.random() - 0.5) * 20));
                    bar.style.width = newLoad + '%';
                    bar.parentElement.nextElementSibling.textContent = newLoad + '%';
                });
            }, 3000);
            
            trackEvent('Infrastructure Dashboard Loaded');
        });

        // Simulate infrastructure alerts
        function checkInfrastructureHealth() {
            Object.entries(infrastructureData.regions).forEach(([regionId, region]) => {
                if (region.availability < 99.9) {
                    trackEvent('Availability Alert', {
                        region: regionId,
                        availability: region.availability,
                        severity: 'warning'
                    });
                }
            });
        }

        // Check health every minute
        setInterval(checkInfrastructureHealth, 60000);
    </script>
</body>
</html>
ENDOFFILE


echo "Creating security/index.html..."
cat > 'infrastructure/security/index.html' << 'ENDOFFILE'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Center | UIP Enterprise Platform</title>
    <meta name="description" content="Enterprise security framework with zero-trust architecture, SOC 2 compliance, and comprehensive vulnerability management for UIP.">
    <link rel="icon" type="image/svg+xml" href="/ROOTUIP/brand/logo-icon.svg">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            overflow-x: hidden;
        }

        .security-container {
            display: flex;
            min-height: 100vh;
        }

        /* Sidebar */
        .sidebar {
            width: 260px;
            background: #1e293b;
            padding: 20px 0;
            position: fixed;
            height: 100vh;
            overflow-y: auto;
            border-right: 1px solid #334155;
        }

        .logo {
            padding: 0 20px 30px;
            border-bottom: 1px solid #334155;
            margin-bottom: 20px;
        }

        .logo h2 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #38bdf8;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .nav-section {
            margin-bottom: 30px;
            padding: 0 20px;
        }

        .nav-title {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 10px;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 15px;
            margin: 5px -15px;
            border-radius: 8px;
            text-decoration: none;
            color: #cbd5e1;
            transition: all 0.3s ease;
        }

        .nav-item:hover, .nav-item.active {
            background: rgba(56, 189, 248, 0.1);
            color: #38bdf8;
        }

        /* Main Content */
        .main-content {
            flex: 1;
            margin-left: 260px;
            padding: 20px;
        }

        .header {
            background: #1e293b;
            padding: 25px 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .page-title {
            font-size: 1.8rem;
            font-weight: 700;
            color: #f1f5f9;
        }

        .security-score {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .score-circle {
            width: 80px;
            height: 80px;
            background: conic-gradient(#22c55e 0deg 324deg, #334155 324deg);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }

        .score-circle::before {
            content: '';
            position: absolute;
            width: 65px;
            height: 65px;
            background: #1e293b;
            border-radius: 50%;
        }

        .score-value {
            position: relative;
            font-size: 1.5rem;
            font-weight: 700;
            color: #22c55e;
        }

        .score-label {
            font-size: 0.9rem;
            color: #64748b;
        }

        /* Security Overview */
        .security-overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .security-card {
            background: #1e293b;
            padding: 25px;
            border-radius: 12px;
            border: 1px solid #334155;
            position: relative;
        }

        .security-card.critical {
            border-color: #ef4444;
        }

        .security-card.warning {
            border-color: #f59e0b;
        }

        .security-card.secure {
            border-color: #22c55e;
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .card-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #f1f5f9;
        }

        .card-status {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-critical {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
        }

        .status-warning {
            background: rgba(245, 158, 11, 0.1);
            color: #f59e0b;
        }

        .status-secure {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
        }

        .card-content {
            color: #cbd5e1;
        }

        .metric-value {
            font-size: 2rem;
            font-weight: 700;
            color: #f1f5f9;
            margin: 10px 0;
        }

        .metric-label {
            font-size: 0.9rem;
            color: #64748b;
        }

        /* Zero Trust Dashboard */
        .zero-trust-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
        }

        .section-title {
            font-size: 1.4rem;
            font-weight: 600;
            color: #f1f5f9;
        }

        .trust-principles {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }

        .principle-card {
            padding: 20px;
            background: #0f172a;
            border-radius: 8px;
            border: 1px solid #334155;
        }

        .principle-icon {
            width: 40px;
            height: 40px;
            background: rgba(56, 189, 248, 0.1);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 15px;
            font-size: 1.3rem;
        }

        .principle-title {
            font-weight: 600;
            color: #f1f5f9;
            margin-bottom: 10px;
        }

        .principle-status {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 15px;
        }

        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .status-indicator.active {
            background: #22c55e;
        }

        .status-indicator.partial {
            background: #f59e0b;
        }

        /* Authentication & Access */
        .auth-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .auth-card {
            background: #1e293b;
            padding: 25px;
            border-radius: 12px;
            border: 1px solid #334155;
        }

        .mfa-coverage {
            margin: 20px 0;
        }

        .coverage-bar {
            background: #334155;
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            margin: 10px 0;
        }

        .coverage-fill {
            height: 100%;
            background: linear-gradient(90deg, #22c55e, #16a34a);
            transition: width 0.3s ease;
        }

        .user-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 20px;
        }

        .user-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background: #0f172a;
            border-radius: 6px;
        }

        .user-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .user-avatar {
            width: 32px;
            height: 32px;
            background: #334155;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.8rem;
            font-weight: 600;
        }

        /* Vulnerability Management */
        .vulnerability-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .vuln-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 25px;
        }

        .vuln-stat {
            text-align: center;
            padding: 20px;
            background: #0f172a;
            border-radius: 8px;
        }

        .vuln-count {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 5px;
        }

        .vuln-count.critical {
            color: #ef4444;
        }

        .vuln-count.high {
            color: #f59e0b;
        }

        .vuln-count.medium {
            color: #3b82f6;
        }

        .vuln-count.low {
            color: #22c55e;
        }

        .vuln-label {
            color: #64748b;
            font-size: 0.9rem;
        }

        .vuln-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .vuln-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: #0f172a;
            border-radius: 8px;
            border-left: 4px solid;
        }

        .vuln-item.critical {
            border-color: #ef4444;
        }

        .vuln-item.high {
            border-color: #f59e0b;
        }

        .vuln-details h4 {
            font-weight: 600;
            color: #f1f5f9;
            margin-bottom: 5px;
        }

        .vuln-details p {
            font-size: 0.85rem;
            color: #64748b;
        }

        .vuln-actions {
            display: flex;
            gap: 10px;
        }

        .action-btn {
            padding: 6px 12px;
            background: #334155;
            border: 1px solid #475569;
            border-radius: 6px;
            color: #cbd5e1;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .action-btn:hover {
            background: #475569;
        }

        /* Compliance Dashboard */
        .compliance-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
        }

        .compliance-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
        }

        .compliance-card {
            padding: 20px;
            background: #0f172a;
            border-radius: 8px;
            border: 1px solid #334155;
        }

        .compliance-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .compliance-title {
            font-weight: 600;
            color: #f1f5f9;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .compliance-badge {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
        }

        .badge-compliant {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
        }

        .badge-in-progress {
            background: rgba(245, 158, 11, 0.1);
            color: #f59e0b;
        }

        .control-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .control-item {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.9rem;
            color: #cbd5e1;
        }

        .control-check {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
        }

        .control-check.complete {
            background: #22c55e;
            color: white;
        }

        .control-check.pending {
            background: #f59e0b;
            color: white;
        }

        @media (max-width: 768px) {
            .sidebar {
                transform: translateX(-100%);
            }

            .main-content {
                margin-left: 0;
            }

            .security-overview {
                grid-template-columns: 1fr;
            }

            .auth-section {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="security-container">
        <!-- Sidebar -->
        <nav class="sidebar">
            <div class="logo">
                <h2>🌐 UIP Infrastructure</h2>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Infrastructure</div>
                <a href="/infrastructure/cloud/index.html" class="nav-item">
                    <span>☁️</span> Cloud Architecture
                </a>
                <a href="/infrastructure/security/index.html" class="nav-item active">
                    <span>🔐</span> Security Center
                </a>
                <a href="/infrastructure/data/index.html" class="nav-item">
                    <span>💾</span> Data Management
                </a>
                <a href="/infrastructure/integration/index.html" class="nav-item">
                    <span>🔗</span> Integration Hub
                </a>
                <a href="/infrastructure/monitoring/index.html" class="nav-item">
                    <span>📊</span> Monitoring
                </a>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Operations</div>
                <a href="#" class="nav-item">
                    <span>🚨</span> Incident Management
                </a>
                <a href="#" class="nav-item">
                    <span>📈</span> Performance
                </a>
                <a href="#" class="nav-item">
                    <span>💰</span> Cost Optimization
                </a>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Compliance</div>
                <a href="#" class="nav-item">
                    <span>✅</span> SOC 2
                </a>
                <a href="#" class="nav-item">
                    <span>🛡️</span> GDPR
                </a>
                <a href="#" class="nav-item">
                    <span>📋</span> Audit Logs
                </a>
            </div>
        </nav>

        <!-- Main Content -->
        <main class="main-content">
            <!-- Header -->
            <div class="header">
                <div class="header-top">
                    <h1 class="page-title">Security Center</h1>
                    <div class="security-score">
                        <div>
                            <div class="score-circle">
                                <span class="score-value">90</span>
                            </div>
                        </div>
                        <div>
                            <div style="font-weight: 600; color: #f1f5f9; margin-bottom: 5px;">Security Score</div>
                            <div class="score-label">Enterprise Grade Protection</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Security Overview -->
            <div class="security-overview">
                <div class="security-card critical">
                    <div class="card-header">
                        <h3 class="card-title">Critical Vulnerabilities</h3>
                        <span class="card-status status-critical">Action Required</span>
                    </div>
                    <div class="card-content">
                        <div class="metric-value">2</div>
                        <div class="metric-label">Requires immediate attention</div>
                    </div>
                </div>

                <div class="security-card warning">
                    <div class="card-header">
                        <h3 class="card-title">Security Events</h3>
                        <span class="card-status status-warning">Monitoring</span>
                    </div>
                    <div class="card-content">
                        <div class="metric-value">147</div>
                        <div class="metric-label">Last 24 hours</div>
                    </div>
                </div>

                <div class="security-card secure">
                    <div class="card-header">
                        <h3 class="card-title">MFA Coverage</h3>
                        <span class="card-status status-secure">Secure</span>
                    </div>
                    <div class="card-content">
                        <div class="metric-value">94%</div>
                        <div class="metric-label">Users protected</div>
                    </div>
                </div>

                <div class="security-card secure">
                    <div class="card-header">
                        <h3 class="card-title">Encryption Status</h3>
                        <span class="card-status status-secure">Active</span>
                    </div>
                    <div class="card-content">
                        <div class="metric-value">100%</div>
                        <div class="metric-label">Data encrypted at rest & transit</div>
                    </div>
                </div>
            </div>

            <!-- Zero Trust Dashboard -->
            <div class="zero-trust-section">
                <div class="section-header">
                    <h2 class="section-title">Zero Trust Security Model</h2>
                    <button class="action-btn" style="background: #38bdf8; border-color: #38bdf8; color: #0f172a;">
                        View Policy Details
                    </button>
                </div>

                <div class="trust-principles">
                    <div class="principle-card">
                        <div class="principle-icon">🔐</div>
                        <h4 class="principle-title">Verify Explicitly</h4>
                        <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 15px;">
                            Always authenticate and authorize based on all available data points
                        </p>
                        <div class="principle-status">
                            <div class="status-indicator active"></div>
                            <span style="font-size: 0.85rem; color: #22c55e;">Fully Implemented</span>
                        </div>
                    </div>

                    <div class="principle-card">
                        <div class="principle-icon">🛡️</div>
                        <h4 class="principle-title">Least Privilege Access</h4>
                        <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 15px;">
                            Limit user access with Just-In-Time and Just-Enough-Access
                        </p>
                        <div class="principle-status">
                            <div class="status-indicator active"></div>
                            <span style="font-size: 0.85rem; color: #22c55e;">Fully Implemented</span>
                        </div>
                    </div>

                    <div class="principle-card">
                        <div class="principle-icon">🚨</div>
                        <h4 class="principle-title">Assume Breach</h4>
                        <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 15px;">
                            Minimize blast radius and segment access to prevent lateral movement
                        </p>
                        <div class="principle-status">
                            <div class="status-indicator partial"></div>
                            <span style="font-size: 0.85rem; color: #f59e0b;">85% Complete</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Authentication & Access -->
            <div class="auth-section">
                <div class="auth-card">
                    <h3 style="font-size: 1.2rem; font-weight: 600; color: #f1f5f9; margin-bottom: 20px;">
                        Multi-Factor Authentication
                    </h3>
                    
                    <div class="mfa-coverage">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>MFA Coverage</span>
                            <span style="font-weight: 600;">94%</span>
                        </div>
                        <div class="coverage-bar">
                            <div class="coverage-fill" style="width: 94%;"></div>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
                        <div style="padding: 15px; background: #0f172a; border-radius: 6px; text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #22c55e;">847</div>
                            <div style="font-size: 0.85rem; color: #64748b;">Protected Users</div>
                        </div>
                        <div style="padding: 15px; background: #0f172a; border-radius: 6px; text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: 700; color: #f59e0b;">54</div>
                            <div style="font-size: 0.85rem; color: #64748b;">Pending Setup</div>
                        </div>
                    </div>
                </div>

                <div class="auth-card">
                    <h3 style="font-size: 1.2rem; font-weight: 600; color: #f1f5f9; margin-bottom: 20px;">
                        Recent Access Anomalies
                    </h3>
                    
                    <div class="user-list">
                        <div class="user-item">
                            <div class="user-info">
                                <div class="user-avatar">JD</div>
                                <div>
                                    <div style="font-weight: 600;">john.doe@company.com</div>
                                    <div style="font-size: 0.85rem; color: #64748b;">Unusual location: Brazil</div>
                                </div>
                            </div>
                            <button class="action-btn">Review</button>
                        </div>
                        <div class="user-item">
                            <div class="user-info">
                                <div class="user-avatar">SK</div>
                                <div>
                                    <div style="font-weight: 600;">sarah.kim@company.com</div>
                                    <div style="font-size: 0.85rem; color: #64748b;">Multiple failed attempts</div>
                                </div>
                            </div>
                            <button class="action-btn">Review</button>
                        </div>
                        <div class="user-item">
                            <div class="user-info">
                                <div class="user-avatar">ML</div>
                                <div>
                                    <div style="font-weight: 600;">mike.lee@company.com</div>
                                    <div style="font-size: 0.85rem; color: #64748b;">After-hours access</div>
                                </div>
                            </div>
                            <button class="action-btn">Review</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Vulnerability Management -->
            <div class="vulnerability-section">
                <div class="section-header">
                    <h2 class="section-title">Vulnerability Management</h2>
                    <button class="action-btn" style="background: #ef4444; border-color: #ef4444;">
                        Run Security Scan
                    </button>
                </div>

                <div class="vuln-stats">
                    <div class="vuln-stat">
                        <div class="vuln-count critical">2</div>
                        <div class="vuln-label">Critical</div>
                    </div>
                    <div class="vuln-stat">
                        <div class="vuln-count high">8</div>
                        <div class="vuln-label">High</div>
                    </div>
                    <div class="vuln-stat">
                        <div class="vuln-count medium">23</div>
                        <div class="vuln-label">Medium</div>
                    </div>
                    <div class="vuln-stat">
                        <div class="vuln-count low">47</div>
                        <div class="vuln-label">Low</div>
                    </div>
                </div>

                <div class="vuln-list">
                    <div class="vuln-item critical">
                        <div class="vuln-details">
                            <h4>CVE-2024-1234 - SQL Injection in API Gateway</h4>
                            <p>Critical vulnerability allowing unauthorized database access</p>
                        </div>
                        <div class="vuln-actions">
                            <button class="action-btn">View Details</button>
                            <button class="action-btn" style="background: #ef4444; border-color: #ef4444;">
                                Apply Patch
                            </button>
                        </div>
                    </div>
                    <div class="vuln-item critical">
                        <div class="vuln-details">
                            <h4>CVE-2024-1235 - Authentication Bypass</h4>
                            <p>Critical flaw in authentication mechanism</p>
                        </div>
                        <div class="vuln-actions">
                            <button class="action-btn">View Details</button>
                            <button class="action-btn" style="background: #ef4444; border-color: #ef4444;">
                                Apply Patch
                            </button>
                        </div>
                    </div>
                    <div class="vuln-item high">
                        <div class="vuln-details">
                            <h4>Outdated TLS Configuration</h4>
                            <p>Server supports deprecated TLS 1.0 and 1.1 protocols</p>
                        </div>
                        <div class="vuln-actions">
                            <button class="action-btn">View Details</button>
                            <button class="action-btn" style="background: #f59e0b; border-color: #f59e0b;">
                                Update Config
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Compliance Dashboard -->
            <div class="compliance-section">
                <div class="section-header">
                    <h2 class="section-title">Compliance Status</h2>
                    <button class="action-btn">Generate Audit Report</button>
                </div>

                <div class="compliance-grid">
                    <div class="compliance-card">
                        <div class="compliance-header">
                            <h4 class="compliance-title">
                                <span>🛡️</span> SOC 2 Type II
                            </h4>
                            <span class="compliance-badge badge-compliant">Compliant</span>
                        </div>
                        <div class="control-list">
                            <div class="control-item">
                                <div class="control-check complete">✓</div>
                                <span>Security Controls</span>
                            </div>
                            <div class="control-item">
                                <div class="control-check complete">✓</div>
                                <span>Availability Controls</span>
                            </div>
                            <div class="control-item">
                                <div class="control-check complete">✓</div>
                                <span>Processing Integrity</span>
                            </div>
                            <div class="control-item">
                                <div class="control-check complete">✓</div>
                                <span>Confidentiality Controls</span>
                            </div>
                            <div class="control-item">
                                <div class="control-check complete">✓</div>
                                <span>Privacy Controls</span>
                            </div>
                        </div>
                        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #334155;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                                <span style="color: #64748b;">Last Audit</span>
                                <span style="color: #22c55e;">Nov 15, 2024</span>
                            </div>
                        </div>
                    </div>

                    <div class="compliance-card">
                        <div class="compliance-header">
                            <h4 class="compliance-title">
                                <span>🔒</span> GDPR
                            </h4>
                            <span class="compliance-badge badge-compliant">Compliant</span>
                        </div>
                        <div class="control-list">
                            <div class="control-item">
                                <div class="control-check complete">✓</div>
                                <span>Data Protection Officer</span>
                            </div>
                            <div class="control-item">
                                <div class="control-check complete">✓</div>
                                <span>Privacy by Design</span>
                            </div>
                            <div class="control-item">
                                <div class="control-check complete">✓</div>
                                <span>Data Subject Rights</span>
                            </div>
                            <div class="control-item">
                                <div class="control-check complete">✓</div>
                                <span>Breach Notification</span>
                            </div>
                            <div class="control-item">
                                <div class="control-check complete">✓</div>
                                <span>Data Processing Records</span>
                            </div>
                        </div>
                        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #334155;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                                <span style="color: #64748b;">Last Review</span>
                                <span style="color: #22c55e;">Dec 1, 2024</span>
                            </div>
                        </div>
                    </div>

                    <div class="compliance-card">
                        <div class="compliance-header">
                            <h4 class="compliance-title">
                                <span>🏥</span> HIPAA
                            </h4>
                            <span class="compliance-badge badge-in-progress">In Progress</span>
                        </div>
                        <div class="control-list">
                            <div class="control-item">
                                <div class="control-check complete">✓</div>
                                <span>Administrative Safeguards</span>
                            </div>
                            <div class="control-item">
                                <div class="control-check complete">✓</div>
                                <span>Physical Safeguards</span>
                            </div>
                            <div class="control-item">
                                <div class="control-check pending">!</div>
                                <span>Technical Safeguards</span>
                            </div>
                            <div class="control-item">
                                <div class="control-check pending">!</div>
                                <span>Breach Notification Rule</span>
                            </div>
                            <div class="control-item">
                                <div class="control-check complete">✓</div>
                                <span>Privacy Rule</span>
                            </div>
                        </div>
                        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #334155;">
                            <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                                <span style="color: #64748b;">Target Date</span>
                                <span style="color: #f59e0b;">Jan 31, 2025</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script>
        // Security monitoring data
        let securityData = {
            score: 90,
            vulnerabilities: {
                critical: 2,
                high: 8,
                medium: 23,
                low: 47
            },
            mfaCoverage: 94,
            encryptionStatus: 100,
            zeroTrustImplementation: 92,
            compliance: {
                soc2: { status: 'compliant', lastAudit: '2024-11-15' },
                gdpr: { status: 'compliant', lastReview: '2024-12-01' },
                hipaa: { status: 'in-progress', targetDate: '2025-01-31' }
            }
        };

        function calculateSecurityScore() {
            let score = 100;
            
            // Deduct for vulnerabilities
            score -= securityData.vulnerabilities.critical * 10;
            score -= securityData.vulnerabilities.high * 3;
            score -= securityData.vulnerabilities.medium * 0.5;
            score -= securityData.vulnerabilities.low * 0.1;
            
            // Factor in MFA coverage
            score = score * (securityData.mfaCoverage / 100);
            
            return Math.max(0, Math.round(score));
        }

        function updateSecurityScore() {
            const newScore = calculateSecurityScore();
            document.querySelector('.score-value').textContent = newScore;
            
            // Update score circle gradient
            const degrees = (newScore / 100) * 360;
            const scoreCircle = document.querySelector('.score-circle');
            scoreCircle.style.background = `conic-gradient(#22c55e 0deg ${degrees}deg, #334155 ${degrees}deg)`;
            
            trackEvent('Security Score Updated', { score: newScore });
        }

        function runSecurityScan() {
            trackEvent('Security Scan Initiated');
            
            console.log('Running comprehensive security scan...');
            // In production, this would trigger actual security scanning
            
            // Simulate scan progress
            setTimeout(() => {
                alert('Security scan completed. 2 new vulnerabilities detected.');
                location.reload();
            }, 3000);
        }

        function applySecurityPatch(vulnerability) {
            trackEvent('Security Patch Applied', { vulnerability: vulnerability });
            
            console.log('Applying security patch for:', vulnerability);
            // In production, this would trigger patch deployment
        }

        function reviewAccessAnomaly(user) {
            trackEvent('Access Anomaly Reviewed', { user: user });
            
            console.log('Reviewing access anomaly for:', user);
            // In production, this would open detailed anomaly investigation
        }

        function generateAuditReport(compliance) {
            trackEvent('Audit Report Generated', { compliance: compliance });
            
            console.log('Generating audit report for:', compliance);
            // In production, this would generate comprehensive audit report
        }

        function trackEvent(eventName, properties = {}) {
            console.log('Security Event:', eventName, properties);
            
            // Integration with security monitoring
            if (typeof securityMonitoring !== 'undefined') {
                securityMonitoring.track(eventName, {
                    ...properties,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Initialize security monitoring
        document.addEventListener('DOMContentLoaded', function() {
            updateSecurityScore();
            
            // Simulate real-time security events
            setInterval(() => {
                const eventCount = document.querySelector('.security-card.warning .metric-value');
                const currentCount = parseInt(eventCount.textContent);
                eventCount.textContent = currentCount + Math.floor(Math.random() * 3);
            }, 10000);
            
            // Monitor vulnerability changes
            setInterval(() => {
                // Check for new vulnerabilities
                if (Math.random() > 0.9) {
                    trackEvent('New Vulnerability Detected', {
                        severity: 'high',
                        timestamp: new Date().toISOString()
                    });
                }
            }, 30000);
            
            trackEvent('Security Center Loaded');
        });

        // Penetration testing simulation
        function startPenTest() {
            trackEvent('Penetration Test Started');
            
            console.log('Initiating automated penetration testing...');
            // In production, this would trigger comprehensive pen testing
        }

        // Security incident response
        function handleSecurityIncident(incidentType, severity) {
            trackEvent('Security Incident', {
                type: incidentType,
                severity: severity,
                timestamp: new Date().toISOString()
            });
            
            // Automated incident response
            if (severity === 'critical') {
                console.log('Critical incident detected. Initiating emergency response...');
                // In production, this would trigger incident response procedures
            }
        }
    </script>
</body>
</html>
ENDOFFILE


echo "Creating data/index.html..."
cat > 'infrastructure/data/index.html' << 'ENDOFFILE'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Data Management Platform | UIP Enterprise Infrastructure</title>
    <meta name="description" content="Enterprise data management platform with data lake architecture, real-time processing, governance controls, and privacy compliance for UIP.">
    <link rel="icon" type="image/svg+xml" href="/ROOTUIP/brand/logo-icon.svg">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            overflow-x: hidden;
        }

        .data-container {
            display: flex;
            min-height: 100vh;
        }

        /* Sidebar */
        .sidebar {
            width: 260px;
            background: #1e293b;
            padding: 20px 0;
            position: fixed;
            height: 100vh;
            overflow-y: auto;
            border-right: 1px solid #334155;
        }

        .logo {
            padding: 0 20px 30px;
            border-bottom: 1px solid #334155;
            margin-bottom: 20px;
        }

        .logo h2 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #38bdf8;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .nav-section {
            margin-bottom: 30px;
            padding: 0 20px;
        }

        .nav-title {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 10px;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 15px;
            margin: 5px -15px;
            border-radius: 8px;
            text-decoration: none;
            color: #cbd5e1;
            transition: all 0.3s ease;
        }

        .nav-item:hover, .nav-item.active {
            background: rgba(56, 189, 248, 0.1);
            color: #38bdf8;
        }

        /* Main Content */
        .main-content {
            flex: 1;
            margin-left: 260px;
            padding: 20px;
        }

        .header {
            background: #1e293b;
            padding: 25px 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .page-title {
            font-size: 1.8rem;
            font-weight: 700;
            color: #e2e8f0;
        }

        .header-actions {
            display: flex;
            gap: 15px;
        }

        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.9rem;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: white;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(59, 130, 246, 0.4);
        }

        .btn-secondary {
            background: #334155;
            color: #e2e8f0;
        }

        /* Data Architecture Overview */
        .architecture-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .architecture-card {
            background: #1e293b;
            padding: 25px;
            border-radius: 12px;
            border: 1px solid #334155;
        }

        .arch-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
        }

        .arch-icon {
            width: 50px;
            height: 50px;
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
        }

        .arch-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: #e2e8f0;
        }

        .arch-stats {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }

        .stat-item {
            background: #0f172a;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #334155;
        }

        .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #38bdf8;
            margin-bottom: 5px;
        }

        .stat-label {
            font-size: 0.85rem;
            color: #94a3b8;
        }

        /* Data Pipeline */
        .pipeline-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
        }

        .section-title {
            font-size: 1.4rem;
            font-weight: 600;
            color: #e2e8f0;
        }

        .pipeline-flow {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 30px;
            padding: 20px;
            background: #0f172a;
            border-radius: 10px;
            overflow-x: auto;
        }

        .pipeline-stage {
            flex: 1;
            text-align: center;
            padding: 20px;
            position: relative;
        }

        .pipeline-stage::after {
            content: '→';
            position: absolute;
            right: -20px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 1.5rem;
            color: #38bdf8;
        }

        .pipeline-stage:last-child::after {
            display: none;
        }

        .stage-icon {
            width: 60px;
            height: 60px;
            background: #334155;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 10px;
            font-size: 1.5rem;
        }

        .stage-name {
            font-weight: 600;
            color: #e2e8f0;
            margin-bottom: 5px;
        }

        .stage-count {
            font-size: 0.85rem;
            color: #94a3b8;
        }

        /* Data Sources */
        .sources-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .source-card {
            background: #0f172a;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #334155;
            text-align: center;
            transition: all 0.3s ease;
        }

        .source-card:hover {
            border-color: #38bdf8;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(56, 189, 248, 0.1);
        }

        .source-icon {
            font-size: 2rem;
            margin-bottom: 10px;
        }

        .source-name {
            font-weight: 600;
            color: #e2e8f0;
            margin-bottom: 5px;
        }

        .source-status {
            font-size: 0.8rem;
            padding: 3px 8px;
            border-radius: 12px;
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
        }

        /* Data Governance */
        .governance-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .governance-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }

        .governance-item {
            background: #0f172a;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #334155;
        }

        .governance-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .governance-title {
            font-weight: 600;
            color: #e2e8f0;
        }

        .compliance-badge {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .badge-compliant {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
        }

        .badge-warning {
            background: rgba(251, 146, 60, 0.1);
            color: #fb923c;
        }

        .governance-details {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .detail-item {
            display: flex;
            justify-content: space-between;
            font-size: 0.9rem;
        }

        .detail-label {
            color: #94a3b8;
        }

        .detail-value {
            color: #e2e8f0;
            font-weight: 500;
        }

        /* Data Quality */
        .quality-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .quality-card {
            background: #0f172a;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #334155;
            text-align: center;
        }

        .quality-score {
            font-size: 2.5rem;
            font-weight: 700;
            color: #22c55e;
            margin-bottom: 5px;
        }

        .quality-label {
            font-size: 0.9rem;
            color: #94a3b8;
        }

        /* Privacy Controls */
        .privacy-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
        }

        .privacy-controls {
            display: grid;
            gap: 20px;
        }

        .privacy-control {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            background: #0f172a;
            border-radius: 8px;
            border: 1px solid #334155;
        }

        .control-info {
            flex: 1;
        }

        .control-title {
            font-weight: 600;
            color: #e2e8f0;
            margin-bottom: 5px;
        }

        .control-description {
            font-size: 0.9rem;
            color: #94a3b8;
        }

        .toggle-switch {
            position: relative;
            width: 50px;
            height: 24px;
        }

        .toggle-input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #334155;
            transition: .4s;
            border-radius: 24px;
        }

        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }

        .toggle-input:checked + .toggle-slider {
            background-color: #22c55e;
        }

        .toggle-input:checked + .toggle-slider:before {
            transform: translateX(26px);
        }

        /* Retention Policies */
        .retention-table {
            width: 100%;
            border-collapse: collapse;
        }

        .retention-table th {
            text-align: left;
            padding: 12px;
            background: #0f172a;
            font-weight: 600;
            color: #94a3b8;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .retention-table td {
            padding: 15px 12px;
            border-bottom: 1px solid #334155;
            color: #e2e8f0;
        }

        .retention-table tr:hover {
            background: rgba(56, 189, 248, 0.05);
        }

        @media (max-width: 768px) {
            .sidebar {
                transform: translateX(-100%);
            }

            .main-content {
                margin-left: 0;
            }

            .architecture-grid {
                grid-template-columns: 1fr;
            }

            .pipeline-flow {
                flex-direction: column;
            }

            .pipeline-stage::after {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="data-container">
        <!-- Sidebar -->
        <nav class="sidebar">
            <div class="logo">
                <h2>🏗️ UIP Infrastructure</h2>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Infrastructure</div>
                <a href="/infrastructure/cloud/index.html" class="nav-item">
                    <span>☁️</span> Cloud Architecture
                </a>
                <a href="/infrastructure/security/index.html" class="nav-item">
                    <span>🔐</span> Security
                </a>
                <a href="/infrastructure/data/index.html" class="nav-item active">
                    <span>📊</span> Data Management
                </a>
                <a href="/infrastructure/integration/index.html" class="nav-item">
                    <span>🔗</span> Integration
                </a>
                <a href="/infrastructure/monitoring/index.html" class="nav-item">
                    <span>📈</span> Monitoring
                </a>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Analytics</div>
                <a href="#" class="nav-item">
                    <span>📊</span> Performance
                </a>
                <a href="#" class="nav-item">
                    <span>💰</span> Cost Analysis
                </a>
                <a href="#" class="nav-item">
                    <span>🔍</span> Usage Insights
                </a>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Operations</div>
                <a href="#" class="nav-item">
                    <span>🚀</span> Deployments
                </a>
                <a href="#" class="nav-item">
                    <span>🔧</span> Maintenance
                </a>
                <a href="#" class="nav-item">
                    <span>📝</span> Documentation
                </a>
            </div>
        </nav>

        <!-- Main Content -->
        <main class="main-content">
            <!-- Header -->
            <div class="header">
                <div class="header-top">
                    <h1 class="page-title">Data Management Platform</h1>
                    <div class="header-actions">
                        <button class="btn btn-secondary" onclick="viewDataCatalog()">
                            📚 Data Catalog
                        </button>
                        <button class="btn btn-primary" onclick="createDataPipeline()">
                            + New Pipeline
                        </button>
                    </div>
                </div>
            </div>

            <!-- Data Architecture Overview -->
            <div class="architecture-grid">
                <div class="architecture-card">
                    <div class="arch-header">
                        <div class="arch-icon">🌊</div>
                        <div>
                            <h3 class="arch-title">Data Lake</h3>
                            <p style="color: #94a3b8; font-size: 0.9rem;">Unified data storage</p>
                        </div>
                    </div>
                    <div class="arch-stats">
                        <div class="stat-item">
                            <div class="stat-value">2.4 PB</div>
                            <div class="stat-label">Total Storage</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">847 TB</div>
                            <div class="stat-label">Active Data</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">124K</div>
                            <div class="stat-label">Datasets</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">99.95%</div>
                            <div class="stat-label">Availability</div>
                        </div>
                    </div>
                </div>

                <div class="architecture-card">
                    <div class="arch-header">
                        <div class="arch-icon">⚡</div>
                        <div>
                            <h3 class="arch-title">Stream Processing</h3>
                            <p style="color: #94a3b8; font-size: 0.9rem;">Real-time data pipelines</p>
                        </div>
                    </div>
                    <div class="arch-stats">
                        <div class="stat-item">
                            <div class="stat-value">1.2M</div>
                            <div class="stat-label">Events/sec</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">47</div>
                            <div class="stat-label">Active Streams</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value"><50ms</div>
                            <div class="stat-label">Avg Latency</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">99.99%</div>
                            <div class="stat-label">Uptime</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Data Pipeline -->
            <div class="pipeline-section">
                <div class="section-header">
                    <h2 class="section-title">Data Pipeline Architecture</h2>
                    <button class="btn btn-secondary" onclick="viewPipelineMetrics()">
                        📈 Pipeline Metrics
                    </button>
                </div>

                <div class="pipeline-flow">
                    <div class="pipeline-stage">
                        <div class="stage-icon">📥</div>
                        <div class="stage-name">Ingestion</div>
                        <div class="stage-count">247 sources</div>
                    </div>
                    <div class="pipeline-stage">
                        <div class="stage-icon">🔄</div>
                        <div class="stage-name">Processing</div>
                        <div class="stage-count">89 transforms</div>
                    </div>
                    <div class="pipeline-stage">
                        <div class="stage-icon">✨</div>
                        <div class="stage-name">Enrichment</div>
                        <div class="stage-count">34 models</div>
                    </div>
                    <div class="pipeline-stage">
                        <div class="stage-icon">💾</div>
                        <div class="stage-name">Storage</div>
                        <div class="stage-count">12 destinations</div>
                    </div>
                    <div class="pipeline-stage">
                        <div class="stage-icon">📊</div>
                        <div class="stage-name">Analytics</div>
                        <div class="stage-count">156 consumers</div>
                    </div>
                </div>

                <div class="sources-grid">
                    <div class="source-card">
                        <div class="source-icon">🚛</div>
                        <div class="source-name">Logistics API</div>
                        <div class="source-status">Connected</div>
                    </div>
                    <div class="source-card">
                        <div class="source-icon">📱</div>
                        <div class="source-name">Mobile Apps</div>
                        <div class="source-status">Connected</div>
                    </div>
                    <div class="source-card">
                        <div class="source-icon">🌐</div>
                        <div class="source-name">Web Platform</div>
                        <div class="source-status">Connected</div>
                    </div>
                    <div class="source-card">
                        <div class="source-icon">🏢</div>
                        <div class="source-name">ERP Systems</div>
                        <div class="source-status">Connected</div>
                    </div>
                    <div class="source-card">
                        <div class="source-icon">📊</div>
                        <div class="source-name">Analytics DB</div>
                        <div class="source-status">Connected</div>
                    </div>
                    <div class="source-card">
                        <div class="source-icon">🤖</div>
                        <div class="source-name">IoT Sensors</div>
                        <div class="source-status">Connected</div>
                    </div>
                </div>
            </div>

            <!-- Data Governance -->
            <div class="governance-section">
                <div class="section-header">
                    <h2 class="section-title">Data Governance & Quality</h2>
                    <button class="btn btn-secondary" onclick="viewGovernanceReport()">
                        📋 Governance Report
                    </button>
                </div>

                <div class="quality-metrics">
                    <div class="quality-card">
                        <div class="quality-score">98.5%</div>
                        <div class="quality-label">Data Quality Score</div>
                    </div>
                    <div class="quality-card">
                        <div class="quality-score">99.2%</div>
                        <div class="quality-label">Completeness</div>
                    </div>
                    <div class="quality-card">
                        <div class="quality-score">97.8%</div>
                        <div class="quality-label">Accuracy</div>
                    </div>
                    <div class="quality-card">
                        <div class="quality-score">99.9%</div>
                        <div class="quality-label">Consistency</div>
                    </div>
                    <div class="quality-card">
                        <div class="quality-score">96.5%</div>
                        <div class="quality-label">Timeliness</div>
                    </div>
                </div>

                <div class="governance-grid">
                    <div class="governance-item">
                        <div class="governance-header">
                            <span class="governance-title">Data Classification</span>
                            <span class="compliance-badge badge-compliant">Compliant</span>
                        </div>
                        <div class="governance-details">
                            <div class="detail-item">
                                <span class="detail-label">Public Data</span>
                                <span class="detail-value">34%</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Internal</span>
                                <span class="detail-value">45%</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Confidential</span>
                                <span class="detail-value">18%</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Restricted</span>
                                <span class="detail-value">3%</span>
                            </div>
                        </div>
                    </div>

                    <div class="governance-item">
                        <div class="governance-header">
                            <span class="governance-title">Access Control</span>
                            <span class="compliance-badge badge-compliant">Compliant</span>
                        </div>
                        <div class="governance-details">
                            <div class="detail-item">
                                <span class="detail-label">Active Users</span>
                                <span class="detail-value">1,247</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Service Accounts</span>
                                <span class="detail-value">89</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Access Reviews</span>
                                <span class="detail-value">Monthly</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">MFA Enabled</span>
                                <span class="detail-value">98%</span>
                            </div>
                        </div>
                    </div>

                    <div class="governance-item">
                        <div class="governance-header">
                            <span class="governance-title">Audit Trail</span>
                            <span class="compliance-badge badge-compliant">Compliant</span>
                        </div>
                        <div class="governance-details">
                            <div class="detail-item">
                                <span class="detail-label">Events Logged</span>
                                <span class="detail-value">24.5M/day</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Retention</span>
                                <span class="detail-value">7 years</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Immutability</span>
                                <span class="detail-value">Enabled</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">Encryption</span>
                                <span class="detail-value">AES-256</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Privacy Controls -->
            <div class="privacy-section">
                <div class="section-header">
                    <h2 class="section-title">Privacy & Compliance Controls</h2>
                    <button class="btn btn-secondary" onclick="viewPrivacyReport()">
                        🔒 Privacy Report
                    </button>
                </div>

                <div class="privacy-controls">
                    <div class="privacy-control">
                        <div class="control-info">
                            <h4 class="control-title">GDPR Data Subject Rights</h4>
                            <p class="control-description">Automated handling of access, rectification, and deletion requests</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" class="toggle-input" checked>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="privacy-control">
                        <div class="control-info">
                            <h4 class="control-title">PII Detection & Masking</h4>
                            <p class="control-description">Automatic detection and masking of personally identifiable information</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" class="toggle-input" checked>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="privacy-control">
                        <div class="control-info">
                            <h4 class="control-title">Cross-Border Transfer Controls</h4>
                            <p class="control-description">Enforce data residency requirements and transfer restrictions</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" class="toggle-input" checked>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>

                    <div class="privacy-control">
                        <div class="control-info">
                            <h4 class="control-title">Consent Management</h4>
                            <p class="control-description">Track and enforce user consent preferences across all data processing</p>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" class="toggle-input" checked>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                <h3 style="margin: 30px 0 20px; color: #e2e8f0;">Data Retention Policies</h3>
                <table class="retention-table">
                    <thead>
                        <tr>
                            <th>Data Type</th>
                            <th>Retention Period</th>
                            <th>Legal Basis</th>
                            <th>Auto-Delete</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Transaction Data</td>
                            <td>7 years</td>
                            <td>Financial Regulations</td>
                            <td>Enabled</td>
                            <td style="color: #22c55e;">Active</td>
                        </tr>
                        <tr>
                            <td>Customer PII</td>
                            <td>3 years after last activity</td>
                            <td>GDPR / Consent</td>
                            <td>Enabled</td>
                            <td style="color: #22c55e;">Active</td>
                        </tr>
                        <tr>
                            <td>System Logs</td>
                            <td>90 days</td>
                            <td>Security Policy</td>
                            <td>Enabled</td>
                            <td style="color: #22c55e;">Active</td>
                        </tr>
                        <tr>
                            <td>Analytics Data</td>
                            <td>2 years</td>
                            <td>Business Need</td>
                            <td>Enabled</td>
                            <td style="color: #22c55e;">Active</td>
                        </tr>
                        <tr>
                            <td>Backup Archives</td>
                            <td>1 year</td>
                            <td>Disaster Recovery</td>
                            <td>Enabled</td>
                            <td style="color: #22c55e;">Active</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </main>
    </div>

    <script>
        // Data management functions
        function createDataPipeline() {
            trackEvent('Data Pipeline Creation Started');
            console.log('Opening data pipeline creation wizard');
            // In production, this would open pipeline builder
        }

        function viewDataCatalog() {
            trackEvent('Data Catalog Accessed');
            console.log('Opening data catalog');
            // In production, this would open data catalog interface
        }

        function viewPipelineMetrics() {
            trackEvent('Pipeline Metrics Viewed');
            console.log('Loading pipeline metrics dashboard');
        }

        function viewGovernanceReport() {
            trackEvent('Governance Report Generated');
            console.log('Generating governance compliance report');
        }

        function viewPrivacyReport() {
            trackEvent('Privacy Report Generated');
            console.log('Generating privacy compliance report');
        }

        // Monitor data quality
        function monitorDataQuality() {
            const qualityMetrics = {
                completeness: 99.2,
                accuracy: 97.8,
                consistency: 99.9,
                timeliness: 96.5
            };

            const overallScore = Object.values(qualityMetrics).reduce((a, b) => a + b) / 4;
            
            if (overallScore < 95) {
                trackEvent('Data Quality Alert', {
                    score: overallScore,
                    metrics: qualityMetrics
                });
            }
        }

        // Privacy control handlers
        document.querySelectorAll('.toggle-input').forEach(toggle => {
            toggle.addEventListener('change', function() {
                const controlName = this.closest('.privacy-control').querySelector('.control-title').textContent;
                trackEvent('Privacy Control Changed', {
                    control: controlName,
                    enabled: this.checked
                });
            });
        });

        function trackEvent(eventName, properties = {}) {
            console.log('Data Management Event:', eventName, properties);
            
            // Integration with analytics
            if (typeof analytics !== 'undefined') {
                analytics.track(eventName, {
                    ...properties,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Simulate real-time data flow monitoring
        let dataFlowInterval;
        function startDataFlowMonitoring() {
            dataFlowInterval = setInterval(() => {
                const eventsPerSec = Math.floor(1200000 + Math.random() * 100000);
                const latency = Math.floor(30 + Math.random() * 20);
                
                console.log(`Data flow: ${eventsPerSec.toLocaleString()} events/sec, ${latency}ms latency`);
                
                // Check for anomalies
                if (latency > 100) {
                    trackEvent('High Latency Alert', { latency: latency });
                }
            }, 5000);
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            trackEvent('Data Management Platform Loaded');
            monitorDataQuality();
            startDataFlowMonitoring();
        });

        // Cleanup
        window.addEventListener('beforeunload', function() {
            if (dataFlowInterval) {
                clearInterval(dataFlowInterval);
            }
        });
    </script>
</body>
</html>
ENDOFFILE


echo "Creating integration/index.html..."
cat > 'infrastructure/integration/index.html' << 'ENDOFFILE'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Integration Platform | UIP Enterprise Infrastructure</title>
    <meta name="description" content="Enterprise integration platform with API gateway, microservices architecture, developer portal, and webhook management for UIP.">
    <link rel="icon" type="image/svg+xml" href="/ROOTUIP/brand/logo-icon.svg">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            overflow-x: hidden;
        }

        .integration-container {
            display: flex;
            min-height: 100vh;
        }

        /* Sidebar */
        .sidebar {
            width: 260px;
            background: #1e293b;
            padding: 20px 0;
            position: fixed;
            height: 100vh;
            overflow-y: auto;
            border-right: 1px solid #334155;
        }

        .logo {
            padding: 0 20px 30px;
            border-bottom: 1px solid #334155;
            margin-bottom: 20px;
        }

        .logo h2 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #38bdf8;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .nav-section {
            margin-bottom: 30px;
            padding: 0 20px;
        }

        .nav-title {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 10px;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 15px;
            margin: 5px -15px;
            border-radius: 8px;
            text-decoration: none;
            color: #cbd5e1;
            transition: all 0.3s ease;
        }

        .nav-item:hover, .nav-item.active {
            background: rgba(56, 189, 248, 0.1);
            color: #38bdf8;
        }

        /* Main Content */
        .main-content {
            flex: 1;
            margin-left: 260px;
            padding: 20px;
        }

        .header {
            background: #1e293b;
            padding: 25px 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .page-title {
            font-size: 1.8rem;
            font-weight: 700;
            color: #e2e8f0;
        }

        .header-actions {
            display: flex;
            gap: 15px;
        }

        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.9rem;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn-primary {
            background: linear-gradient(135deg, #8b5cf6, #7c3aed);
            color: white;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(139, 92, 246, 0.4);
        }

        .btn-secondary {
            background: #334155;
            color: #e2e8f0;
        }

        /* API Gateway Stats */
        .gateway-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: #1e293b;
            padding: 25px;
            border-radius: 12px;
            border: 1px solid #334155;
        }

        .stat-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }

        .stat-icon {
            width: 45px;
            height: 45px;
            background: rgba(139, 92, 246, 0.1);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.3rem;
        }

        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            color: #e2e8f0;
            margin-bottom: 5px;
        }

        .stat-label {
            color: #94a3b8;
            font-size: 0.9rem;
        }

        .stat-trend {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 0.85rem;
            color: #22c55e;
        }

        /* API Endpoints */
        .api-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
        }

        .section-title {
            font-size: 1.4rem;
            font-weight: 600;
            color: #e2e8f0;
        }

        .api-grid {
            display: grid;
            gap: 15px;
        }

        .api-endpoint {
            background: #0f172a;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #334155;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.3s ease;
        }

        .api-endpoint:hover {
            border-color: #8b5cf6;
            transform: translateX(5px);
        }

        .endpoint-info {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .method-badge {
            padding: 5px 12px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.8rem;
            text-transform: uppercase;
        }

        .method-get {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
        }

        .method-post {
            background: rgba(59, 130, 246, 0.1);
            color: #3b82f6;
        }

        .method-put {
            background: rgba(251, 146, 60, 0.1);
            color: #fb923c;
        }

        .method-delete {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
        }

        .endpoint-path {
            font-family: 'Consolas', 'Monaco', monospace;
            color: #e2e8f0;
            font-size: 0.95rem;
        }

        .endpoint-stats {
            display: flex;
            align-items: center;
            gap: 20px;
            font-size: 0.9rem;
            color: #94a3b8;
        }

        /* Services Architecture */
        .services-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .service-card {
            background: #1e293b;
            padding: 25px;
            border-radius: 12px;
            border: 1px solid #334155;
            position: relative;
            overflow: hidden;
        }

        .service-status {
            position: absolute;
            top: 15px;
            right: 15px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #22c55e;
            box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
        }

        .service-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
        }

        .service-icon {
            width: 50px;
            height: 50px;
            background: rgba(139, 92, 246, 0.1);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
        }

        .service-name {
            font-size: 1.1rem;
            font-weight: 600;
            color: #e2e8f0;
        }

        .service-metrics {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
        }

        .metric-item {
            background: #0f172a;
            padding: 12px;
            border-radius: 6px;
            border: 1px solid #334155;
        }

        .metric-value {
            font-size: 1.2rem;
            font-weight: 600;
            color: #8b5cf6;
        }

        .metric-label {
            font-size: 0.8rem;
            color: #94a3b8;
        }

        /* Developer Portal */
        .developer-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .portal-features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }

        .feature-card {
            background: #0f172a;
            padding: 25px;
            border-radius: 8px;
            border: 1px solid #334155;
            text-align: center;
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .feature-card:hover {
            border-color: #8b5cf6;
            transform: translateY(-3px);
            box-shadow: 0 5px 15px rgba(139, 92, 246, 0.2);
        }

        .feature-icon {
            font-size: 2.5rem;
            margin-bottom: 15px;
        }

        .feature-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #e2e8f0;
            margin-bottom: 10px;
        }

        .feature-description {
            font-size: 0.9rem;
            color: #94a3b8;
            line-height: 1.5;
        }

        /* Webhook Management */
        .webhook-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
        }

        .webhook-list {
            display: grid;
            gap: 15px;
        }

        .webhook-item {
            background: #0f172a;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #334155;
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 20px;
            align-items: center;
        }

        .webhook-info h4 {
            font-weight: 600;
            color: #e2e8f0;
            margin-bottom: 5px;
        }

        .webhook-url {
            font-family: 'Consolas', 'Monaco', monospace;
            color: #94a3b8;
            font-size: 0.9rem;
            margin-bottom: 10px;
        }

        .webhook-events {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .event-tag {
            padding: 3px 10px;
            background: rgba(139, 92, 246, 0.1);
            color: #a78bfa;
            border-radius: 12px;
            font-size: 0.8rem;
        }

        .webhook-actions {
            display: flex;
            gap: 10px;
        }

        .action-btn {
            padding: 8px 16px;
            background: #334155;
            border: none;
            border-radius: 6px;
            color: #e2e8f0;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .action-btn:hover {
            background: #475569;
        }

        /* API Documentation */
        .docs-preview {
            background: #0f172a;
            padding: 25px;
            border-radius: 8px;
            border: 1px solid #334155;
            margin-top: 20px;
        }

        .code-block {
            background: #1e293b;
            padding: 20px;
            border-radius: 6px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.9rem;
            color: #e2e8f0;
            overflow-x: auto;
        }

        .code-comment {
            color: #64748b;
        }

        @media (max-width: 768px) {
            .sidebar {
                transform: translateX(-100%);
            }

            .main-content {
                margin-left: 0;
            }

            .gateway-stats {
                grid-template-columns: 1fr;
            }

            .services-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="integration-container">
        <!-- Sidebar -->
        <nav class="sidebar">
            <div class="logo">
                <h2>🏗️ UIP Infrastructure</h2>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Infrastructure</div>
                <a href="/infrastructure/cloud/index.html" class="nav-item">
                    <span>☁️</span> Cloud Architecture
                </a>
                <a href="/infrastructure/security/index.html" class="nav-item">
                    <span>🔐</span> Security
                </a>
                <a href="/infrastructure/data/index.html" class="nav-item">
                    <span>📊</span> Data Management
                </a>
                <a href="/infrastructure/integration/index.html" class="nav-item active">
                    <span>🔗</span> Integration
                </a>
                <a href="/infrastructure/monitoring/index.html" class="nav-item">
                    <span>📈</span> Monitoring
                </a>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Developer</div>
                <a href="#" class="nav-item">
                    <span>📚</span> API Docs
                </a>
                <a href="#" class="nav-item">
                    <span>🔑</span> API Keys
                </a>
                <a href="#" class="nav-item">
                    <span>🧪</span> Testing
                </a>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Operations</div>
                <a href="#" class="nav-item">
                    <span>🚀</span> Deployments
                </a>
                <a href="#" class="nav-item">
                    <span>🔧</span> Maintenance
                </a>
                <a href="#" class="nav-item">
                    <span>📝</span> Documentation
                </a>
            </div>
        </nav>

        <!-- Main Content -->
        <main class="main-content">
            <!-- Header -->
            <div class="header">
                <div class="header-top">
                    <h1 class="page-title">Integration Platform</h1>
                    <div class="header-actions">
                        <button class="btn btn-secondary" onclick="viewAPIDocs()">
                            📚 API Documentation
                        </button>
                        <button class="btn btn-primary" onclick="createNewIntegration()">
                            + New Integration
                        </button>
                    </div>
                </div>
            </div>

            <!-- API Gateway Stats -->
            <div class="gateway-stats">
                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon">🚀</div>
                    </div>
                    <div class="stat-value">24.7M</div>
                    <div class="stat-label">API Calls Today</div>
                    <div class="stat-trend">
                        ↑ 12% from yesterday
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon">⚡</div>
                    </div>
                    <div class="stat-value">45ms</div>
                    <div class="stat-label">Avg Response Time</div>
                    <div class="stat-trend">
                        ↓ 8ms improvement
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon">✅</div>
                    </div>
                    <div class="stat-value">99.98%</div>
                    <div class="stat-label">Success Rate</div>
                    <div class="stat-trend">
                        → Stable
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-icon">🔗</div>
                    </div>
                    <div class="stat-value">156</div>
                    <div class="stat-label">Active Integrations</div>
                    <div class="stat-trend">
                        ↑ 3 new this week
                    </div>
                </div>
            </div>

            <!-- Popular API Endpoints -->
            <div class="api-section">
                <div class="section-header">
                    <h2 class="section-title">Popular API Endpoints</h2>
                    <button class="btn btn-secondary" onclick="viewAllEndpoints()">
                        View All
                    </button>
                </div>

                <div class="api-grid">
                    <div class="api-endpoint">
                        <div class="endpoint-info">
                            <span class="method-badge method-get">GET</span>
                            <span class="endpoint-path">/api/v1/shipments/{id}</span>
                        </div>
                        <div class="endpoint-stats">
                            <span>2.4M calls</span>
                            <span>32ms avg</span>
                            <span>99.9% success</span>
                        </div>
                    </div>

                    <div class="api-endpoint">
                        <div class="endpoint-info">
                            <span class="method-badge method-post">POST</span>
                            <span class="endpoint-path">/api/v1/tracking/events</span>
                        </div>
                        <div class="endpoint-stats">
                            <span>1.8M calls</span>
                            <span>45ms avg</span>
                            <span>99.8% success</span>
                        </div>
                    </div>

                    <div class="api-endpoint">
                        <div class="endpoint-info">
                            <span class="method-badge method-get">GET</span>
                            <span class="endpoint-path">/api/v1/analytics/dashboard</span>
                        </div>
                        <div class="endpoint-stats">
                            <span>856K calls</span>
                            <span>124ms avg</span>
                            <span>99.7% success</span>
                        </div>
                    </div>

                    <div class="api-endpoint">
                        <div class="endpoint-info">
                            <span class="method-badge method-put">PUT</span>
                            <span class="endpoint-path">/api/v1/routes/optimize</span>
                        </div>
                        <div class="endpoint-stats">
                            <span>623K calls</span>
                            <span>287ms avg</span>
                            <span>98.5% success</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Microservices Architecture -->
            <div class="services-grid">
                <div class="service-card">
                    <div class="service-status"></div>
                    <div class="service-header">
                        <div class="service-icon">🚛</div>
                        <div>
                            <h3 class="service-name">Shipment Service</h3>
                            <p style="color: #94a3b8; font-size: 0.9rem;">Core logistics operations</p>
                        </div>
                    </div>
                    <div class="service-metrics">
                        <div class="metric-item">
                            <div class="metric-value">24</div>
                            <div class="metric-label">Instances</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">1.2K</div>
                            <div class="metric-label">Req/sec</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">38ms</div>
                            <div class="metric-label">Latency</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">0.12%</div>
                            <div class="metric-label">Error Rate</div>
                        </div>
                    </div>
                </div>

                <div class="service-card">
                    <div class="service-status"></div>
                    <div class="service-header">
                        <div class="service-icon">📊</div>
                        <div>
                            <h3 class="service-name">Analytics Service</h3>
                            <p style="color: #94a3b8; font-size: 0.9rem;">Business intelligence & reporting</p>
                        </div>
                    </div>
                    <div class="service-metrics">
                        <div class="metric-item">
                            <div class="metric-value">12</div>
                            <div class="metric-label">Instances</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">456</div>
                            <div class="metric-label">Req/sec</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">142ms</div>
                            <div class="metric-label">Latency</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">0.08%</div>
                            <div class="metric-label">Error Rate</div>
                        </div>
                    </div>
                </div>

                <div class="service-card">
                    <div class="service-status"></div>
                    <div class="service-header">
                        <div class="service-icon">🔔</div>
                        <div>
                            <h3 class="service-name">Notification Service</h3>
                            <p style="color: #94a3b8; font-size: 0.9rem;">Multi-channel notifications</p>
                        </div>
                    </div>
                    <div class="service-metrics">
                        <div class="metric-item">
                            <div class="metric-value">8</div>
                            <div class="metric-label">Instances</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">892</div>
                            <div class="metric-label">Msg/sec</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">67ms</div>
                            <div class="metric-label">Latency</div>
                        </div>
                        <div class="metric-item">
                            <div class="metric-value">0.03%</div>
                            <div class="metric-label">Error Rate</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Developer Portal -->
            <div class="developer-section">
                <div class="section-header">
                    <h2 class="section-title">Developer Portal</h2>
                    <button class="btn btn-secondary" onclick="viewDeveloperDashboard()">
                        Dashboard
                    </button>
                </div>

                <div class="portal-features">
                    <div class="feature-card" onclick="openAPIDocs()">
                        <div class="feature-icon">📖</div>
                        <h3 class="feature-title">API Documentation</h3>
                        <p class="feature-description">Interactive API documentation with code examples in multiple languages</p>
                    </div>

                    <div class="feature-card" onclick="openSDKs()">
                        <div class="feature-icon">📦</div>
                        <h3 class="feature-title">SDKs & Libraries</h3>
                        <p class="feature-description">Official SDKs for Python, JavaScript, Java, Go, and more</p>
                    </div>

                    <div class="feature-card" onclick="openPlayground()">
                        <div class="feature-icon">🧪</div>
                        <h3 class="feature-title">API Playground</h3>
                        <p class="feature-description">Test API endpoints directly in your browser with live responses</p>
                    </div>

                    <div class="feature-card" onclick="openWebhooks()">
                        <div class="feature-icon">🪝</div>
                        <h3 class="feature-title">Webhooks</h3>
                        <p class="feature-description">Configure real-time event notifications for your applications</p>
                    </div>
                </div>

                <div class="docs-preview">
                    <h4 style="margin-bottom: 15px; color: #e2e8f0;">Quick Start Example</h4>
                    <div class="code-block">
                        <span class="code-comment"># Install the UIP Python SDK</span><br>
                        pip install uip-sdk<br><br>
                        <span class="code-comment"># Initialize the client</span><br>
                        from uip import Client<br><br>
                        client = Client(api_key='your_api_key')<br><br>
                        <span class="code-comment"># Get shipment details</span><br>
                        shipment = client.shipments.get('SHIP-12345')<br>
                        print(f"Status: {shipment.status}")<br>
                        print(f"ETA: {shipment.estimated_delivery}")
                    </div>
                </div>
            </div>

            <!-- Webhook Management -->
            <div class="webhook-section">
                <div class="section-header">
                    <h2 class="section-title">Active Webhooks</h2>
                    <button class="btn btn-primary" onclick="createWebhook()">
                        + Add Webhook
                    </button>
                </div>

                <div class="webhook-list">
                    <div class="webhook-item">
                        <div class="webhook-info">
                            <h4>Order Status Updates</h4>
                            <div class="webhook-url">https://api.customer.com/webhooks/uip/orders</div>
                            <div class="webhook-events">
                                <span class="event-tag">order.created</span>
                                <span class="event-tag">order.updated</span>
                                <span class="event-tag">order.delivered</span>
                            </div>
                        </div>
                        <div class="webhook-actions">
                            <button class="action-btn" onclick="testWebhook('order-status')">Test</button>
                            <button class="action-btn" onclick="editWebhook('order-status')">Edit</button>
                            <button class="action-btn" onclick="viewWebhookLogs('order-status')">Logs</button>
                        </div>
                    </div>

                    <div class="webhook-item">
                        <div class="webhook-info">
                            <h4>Tracking Events</h4>
                            <div class="webhook-url">https://analytics.partner.io/tracking</div>
                            <div class="webhook-events">
                                <span class="event-tag">tracking.scan</span>
                                <span class="event-tag">tracking.exception</span>
                            </div>
                        </div>
                        <div class="webhook-actions">
                            <button class="action-btn" onclick="testWebhook('tracking')">Test</button>
                            <button class="action-btn" onclick="editWebhook('tracking')">Edit</button>
                            <button class="action-btn" onclick="viewWebhookLogs('tracking')">Logs</button>
                        </div>
                    </div>

                    <div class="webhook-item">
                        <div class="webhook-info">
                            <h4>Inventory Sync</h4>
                            <div class="webhook-url">https://erp.enterprise.com/api/inventory/sync</div>
                            <div class="webhook-events">
                                <span class="event-tag">inventory.low</span>
                                <span class="event-tag">inventory.updated</span>
                                <span class="event-tag">inventory.replenished</span>
                            </div>
                        </div>
                        <div class="webhook-actions">
                            <button class="action-btn" onclick="testWebhook('inventory')">Test</button>
                            <button class="action-btn" onclick="editWebhook('inventory')">Edit</button>
                            <button class="action-btn" onclick="viewWebhookLogs('inventory')">Logs</button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script>
        // Integration platform functions
        function createNewIntegration() {
            trackEvent('Integration Creation Started');
            console.log('Opening integration wizard');
            // In production, this would open integration creation flow
        }

        function viewAPIDocs() {
            trackEvent('API Documentation Accessed');
            console.log('Opening API documentation');
        }

        function viewAllEndpoints() {
            trackEvent('All Endpoints Viewed');
            console.log('Loading complete endpoint list');
        }

        function viewDeveloperDashboard() {
            trackEvent('Developer Dashboard Accessed');
            console.log('Opening developer dashboard');
        }

        // Developer portal functions
        function openAPIDocs() {
            trackEvent('API Docs Opened');
            console.log('Loading interactive API documentation');
        }

        function openSDKs() {
            trackEvent('SDKs Accessed');
            console.log('Opening SDK download page');
        }

        function openPlayground() {
            trackEvent('API Playground Opened');
            console.log('Loading API playground');
        }

        function openWebhooks() {
            trackEvent('Webhook Configuration Opened');
            console.log('Opening webhook management');
        }

        // Webhook management
        function createWebhook() {
            trackEvent('Webhook Creation Started');
            console.log('Opening webhook creation form');
        }

        function testWebhook(webhookId) {
            trackEvent('Webhook Tested', { webhookId: webhookId });
            alert(`Sending test event to webhook: ${webhookId}`);
        }

        function editWebhook(webhookId) {
            trackEvent('Webhook Edited', { webhookId: webhookId });
            console.log('Editing webhook:', webhookId);
        }

        function viewWebhookLogs(webhookId) {
            trackEvent('Webhook Logs Viewed', { webhookId: webhookId });
            console.log('Loading webhook logs for:', webhookId);
        }

        // Monitor API performance
        function monitorAPIPerformance() {
            const endpoints = [
                { path: '/api/v1/shipments/{id}', calls: 2400000, latency: 32 },
                { path: '/api/v1/tracking/events', calls: 1800000, latency: 45 },
                { path: '/api/v1/analytics/dashboard', calls: 856000, latency: 124 },
                { path: '/api/v1/routes/optimize', calls: 623000, latency: 287 }
            ];

            endpoints.forEach(endpoint => {
                if (endpoint.latency > 200) {
                    trackEvent('High Latency Alert', {
                        endpoint: endpoint.path,
                        latency: endpoint.latency
                    });
                }
            });
        }

        // Service health monitoring
        function checkServiceHealth() {
            const services = [
                { name: 'Shipment Service', errorRate: 0.12 },
                { name: 'Analytics Service', errorRate: 0.08 },
                { name: 'Notification Service', errorRate: 0.03 }
            ];

            services.forEach(service => {
                if (service.errorRate > 1) {
                    trackEvent('Service Health Alert', {
                        service: service.name,
                        errorRate: service.errorRate
                    });
                }
            });
        }

        function trackEvent(eventName, properties = {}) {
            console.log('Integration Platform Event:', eventName, properties);
            
            // Integration with analytics
            if (typeof analytics !== 'undefined') {
                analytics.track(eventName, {
                    ...properties,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Simulate real-time API metrics
        let metricsInterval;
        function startMetricsMonitoring() {
            metricsInterval = setInterval(() => {
                const apiCalls = Math.floor(24700000 + Math.random() * 100000);
                const responseTime = Math.floor(40 + Math.random() * 10);
                
                console.log(`API Metrics: ${apiCalls.toLocaleString()} calls, ${responseTime}ms avg response`);
            }, 5000);
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            trackEvent('Integration Platform Loaded');
            monitorAPIPerformance();
            checkServiceHealth();
            startMetricsMonitoring();
        });

        // Cleanup
        window.addEventListener('beforeunload', function() {
            if (metricsInterval) {
                clearInterval(metricsInterval);
            }
        });
    </script>
</body>
</html>
ENDOFFILE


echo "Creating monitoring/index.html..."
cat > 'infrastructure/monitoring/index.html' << 'ENDOFFILE'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monitoring & Observability | UIP Enterprise Infrastructure</title>
    <meta name="description" content="Enterprise monitoring platform with distributed tracing, real-time metrics, log aggregation, and intelligent alerting for UIP infrastructure.">
    <link rel="icon" type="image/svg+xml" href="/ROOTUIP/brand/logo-icon.svg">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            overflow-x: hidden;
        }

        .monitoring-container {
            display: flex;
            min-height: 100vh;
        }

        /* Sidebar */
        .sidebar {
            width: 260px;
            background: #1e293b;
            padding: 20px 0;
            position: fixed;
            height: 100vh;
            overflow-y: auto;
            border-right: 1px solid #334155;
        }

        .logo {
            padding: 0 20px 30px;
            border-bottom: 1px solid #334155;
            margin-bottom: 20px;
        }

        .logo h2 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #38bdf8;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .nav-section {
            margin-bottom: 30px;
            padding: 0 20px;
        }

        .nav-title {
            font-size: 0.8rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
            margin-bottom: 10px;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 15px;
            margin: 5px -15px;
            border-radius: 8px;
            text-decoration: none;
            color: #cbd5e1;
            transition: all 0.3s ease;
        }

        .nav-item:hover, .nav-item.active {
            background: rgba(56, 189, 248, 0.1);
            color: #38bdf8;
        }

        /* Main Content */
        .main-content {
            flex: 1;
            margin-left: 260px;
            padding: 20px;
        }

        .header {
            background: #1e293b;
            padding: 25px 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .page-title {
            font-size: 1.8rem;
            font-weight: 700;
            color: #e2e8f0;
        }

        .header-actions {
            display: flex;
            gap: 15px;
        }

        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.9rem;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .btn-primary {
            background: linear-gradient(135deg, #06b6d4, #0891b2);
            color: white;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(6, 182, 212, 0.4);
        }

        .btn-secondary {
            background: #334155;
            color: #e2e8f0;
        }

        /* System Health Overview */
        .health-overview {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .health-card {
            background: #1e293b;
            padding: 25px;
            border-radius: 12px;
            border: 1px solid #334155;
            position: relative;
            overflow: hidden;
        }

        .health-status {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 4px;
        }

        .status-healthy {
            background: linear-gradient(90deg, #22c55e, #16a34a);
        }

        .status-warning {
            background: linear-gradient(90deg, #fb923c, #f97316);
        }

        .status-critical {
            background: linear-gradient(90deg, #ef4444, #dc2626);
        }

        .health-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .health-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #e2e8f0;
        }

        .health-score {
            font-size: 2rem;
            font-weight: 700;
        }

        .score-healthy {
            color: #22c55e;
        }

        .score-warning {
            color: #fb923c;
        }

        .score-critical {
            color: #ef4444;
        }

        .health-metrics {
            display: grid;
            gap: 10px;
        }

        .metric-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.9rem;
        }

        .metric-label {
            color: #94a3b8;
        }

        .metric-value {
            color: #e2e8f0;
            font-weight: 500;
        }

        /* Real-time Metrics */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .metrics-card {
            background: #1e293b;
            padding: 25px;
            border-radius: 12px;
            border: 1px solid #334155;
        }

        .metrics-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .metrics-title {
            font-size: 1.2rem;
            font-weight: 600;
            color: #e2e8f0;
        }

        .time-range {
            display: flex;
            gap: 10px;
        }

        .time-btn {
            padding: 5px 12px;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 6px;
            color: #94a3b8;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .time-btn.active {
            background: #06b6d4;
            color: white;
            border-color: #06b6d4;
        }

        .chart-container {
            height: 250px;
            background: #0f172a;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #64748b;
            font-size: 1.1rem;
        }

        /* Distributed Tracing */
        .tracing-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 25px;
        }

        .section-title {
            font-size: 1.4rem;
            font-weight: 600;
            color: #e2e8f0;
        }

        .trace-list {
            display: grid;
            gap: 15px;
        }

        .trace-item {
            background: #0f172a;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #334155;
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 20px;
            align-items: center;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .trace-item:hover {
            border-color: #06b6d4;
            transform: translateY(-2px);
        }

        .trace-info h4 {
            font-weight: 600;
            color: #e2e8f0;
            margin-bottom: 5px;
        }

        .trace-details {
            display: flex;
            gap: 20px;
            font-size: 0.9rem;
            color: #94a3b8;
        }

        .trace-metrics {
            display: flex;
            gap: 20px;
            align-items: center;
        }

        .duration-badge {
            padding: 5px 12px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 0.85rem;
        }

        .duration-fast {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
        }

        .duration-normal {
            background: rgba(6, 182, 212, 0.1);
            color: #06b6d4;
        }

        .duration-slow {
            background: rgba(251, 146, 60, 0.1);
            color: #fb923c;
        }

        /* Log Aggregation */
        .logs-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
            margin-bottom: 30px;
        }

        .log-filters {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
        }

        .filter-select {
            padding: 8px 15px;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 6px;
            color: #e2e8f0;
            font-size: 0.9rem;
        }

        .search-box {
            flex: 1;
            padding: 8px 15px;
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 6px;
            color: #e2e8f0;
            font-size: 0.9rem;
        }

        .log-stream {
            background: #0f172a;
            border-radius: 8px;
            padding: 20px;
            height: 400px;
            overflow-y: auto;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.85rem;
        }

        .log-entry {
            padding: 8px 0;
            border-bottom: 1px solid #1e293b;
            display: flex;
            gap: 15px;
        }

        .log-timestamp {
            color: #64748b;
            white-space: nowrap;
        }

        .log-level {
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 0.75rem;
        }

        .level-info {
            background: rgba(6, 182, 212, 0.1);
            color: #06b6d4;
        }

        .level-warn {
            background: rgba(251, 146, 60, 0.1);
            color: #fb923c;
        }

        .level-error {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
        }

        .log-message {
            color: #e2e8f0;
            flex: 1;
        }

        /* Alert Management */
        .alerts-section {
            background: #1e293b;
            padding: 30px;
            border-radius: 12px;
            border: 1px solid #334155;
        }

        .alert-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }

        .alert-stat {
            background: #0f172a;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #334155;
        }

        .alert-count {
            font-size: 2rem;
            font-weight: 700;
            margin-bottom: 5px;
        }

        .count-critical {
            color: #ef4444;
        }

        .count-warning {
            color: #fb923c;
        }

        .count-info {
            color: #06b6d4;
        }

        .count-resolved {
            color: #22c55e;
        }

        .alert-label {
            color: #94a3b8;
            font-size: 0.9rem;
        }

        .active-alerts {
            display: grid;
            gap: 15px;
        }

        .alert-item {
            background: #0f172a;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid;
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 20px;
            align-items: center;
        }

        .alert-critical {
            border-color: #ef4444;
        }

        .alert-warning {
            border-color: #fb923c;
        }

        .alert-info {
            border-color: #06b6d4;
        }

        .alert-info-content h4 {
            font-weight: 600;
            color: #e2e8f0;
            margin-bottom: 5px;
        }

        .alert-description {
            color: #94a3b8;
            font-size: 0.9rem;
            margin-bottom: 10px;
        }

        .alert-meta {
            display: flex;
            gap: 20px;
            font-size: 0.85rem;
            color: #64748b;
        }

        .alert-actions {
            display: flex;
            gap: 10px;
        }

        .action-btn {
            padding: 8px 16px;
            background: #334155;
            border: none;
            border-radius: 6px;
            color: #e2e8f0;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .action-btn:hover {
            background: #475569;
        }

        @media (max-width: 768px) {
            .sidebar {
                transform: translateX(-100%);
            }

            .main-content {
                margin-left: 0;
            }

            .health-overview {
                grid-template-columns: 1fr;
            }

            .metrics-grid {
                grid-template-columns: 1fr;
            }

            .alert-stats {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <div class="monitoring-container">
        <!-- Sidebar -->
        <nav class="sidebar">
            <div class="logo">
                <h2>🏗️ UIP Infrastructure</h2>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Infrastructure</div>
                <a href="/infrastructure/cloud/index.html" class="nav-item">
                    <span>☁️</span> Cloud Architecture
                </a>
                <a href="/infrastructure/security/index.html" class="nav-item">
                    <span>🔐</span> Security
                </a>
                <a href="/infrastructure/data/index.html" class="nav-item">
                    <span>📊</span> Data Management
                </a>
                <a href="/infrastructure/integration/index.html" class="nav-item">
                    <span>🔗</span> Integration
                </a>
                <a href="/infrastructure/monitoring/index.html" class="nav-item active">
                    <span>📈</span> Monitoring
                </a>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Observability</div>
                <a href="#" class="nav-item">
                    <span>📊</span> Metrics
                </a>
                <a href="#" class="nav-item">
                    <span>📝</span> Logs
                </a>
                <a href="#" class="nav-item">
                    <span>🔍</span> Traces
                </a>
            </div>
            
            <div class="nav-section">
                <div class="nav-title">Alerts</div>
                <a href="#" class="nav-item">
                    <span>🚨</span> Active Alerts
                </a>
                <a href="#" class="nav-item">
                    <span>📋</span> Alert Rules
                </a>
                <a href="#" class="nav-item">
                    <span>📞</span> On-Call
                </a>
            </div>
        </nav>

        <!-- Main Content -->
        <main class="main-content">
            <!-- Header -->
            <div class="header">
                <div class="header-top">
                    <h1 class="page-title">Monitoring & Observability</h1>
                    <div class="header-actions">
                        <button class="btn btn-secondary" onclick="viewDashboards()">
                            📊 All Dashboards
                        </button>
                        <button class="btn btn-primary" onclick="createAlert()">
                            + New Alert Rule
                        </button>
                    </div>
                </div>
            </div>

            <!-- System Health Overview -->
            <div class="health-overview">
                <div class="health-card">
                    <div class="health-status status-healthy"></div>
                    <div class="health-header">
                        <h3 class="health-title">Overall System Health</h3>
                        <span class="health-score score-healthy">98.5%</span>
                    </div>
                    <div class="health-metrics">
                        <div class="metric-row">
                            <span class="metric-label">Uptime (30d)</span>
                            <span class="metric-value">99.99%</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Response Time</span>
                            <span class="metric-value">124ms</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Error Rate</span>
                            <span class="metric-value">0.12%</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Active Services</span>
                            <span class="metric-value">47/47</span>
                        </div>
                    </div>
                </div>

                <div class="health-card">
                    <div class="health-status status-warning"></div>
                    <div class="health-header">
                        <h3 class="health-title">Infrastructure Health</h3>
                        <span class="health-score score-warning">92.3%</span>
                    </div>
                    <div class="health-metrics">
                        <div class="metric-row">
                            <span class="metric-label">CPU Usage</span>
                            <span class="metric-value">68%</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Memory Usage</span>
                            <span class="metric-value">74%</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Disk I/O</span>
                            <span class="metric-value">Normal</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Network Latency</span>
                            <span class="metric-value">12ms</span>
                        </div>
                    </div>
                </div>

                <div class="health-card">
                    <div class="health-status status-healthy"></div>
                    <div class="health-header">
                        <h3 class="health-title">Application Health</h3>
                        <span class="health-score score-healthy">96.7%</span>
                    </div>
                    <div class="health-metrics">
                        <div class="metric-row">
                            <span class="metric-label">Request Rate</span>
                            <span class="metric-value">24.7K/s</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Success Rate</span>
                            <span class="metric-value">99.88%</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Queue Depth</span>
                            <span class="metric-value">1,234</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Active Users</span>
                            <span class="metric-value">8,456</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Real-time Metrics -->
            <div class="metrics-grid">
                <div class="metrics-card">
                    <div class="metrics-header">
                        <h3 class="metrics-title">Request Rate & Latency</h3>
                        <div class="time-range">
                            <button class="time-btn">1h</button>
                            <button class="time-btn active">6h</button>
                            <button class="time-btn">24h</button>
                            <button class="time-btn">7d</button>
                        </div>
                    </div>
                    <div class="chart-container">
                        📈 Request rate and latency chart
                    </div>
                </div>

                <div class="metrics-card">
                    <div class="metrics-header">
                        <h3 class="metrics-title">Resource Utilization</h3>
                        <div class="time-range">
                            <button class="time-btn">1h</button>
                            <button class="time-btn active">6h</button>
                            <button class="time-btn">24h</button>
                            <button class="time-btn">7d</button>
                        </div>
                    </div>
                    <div class="chart-container">
                        📊 CPU, Memory, and Disk usage chart
                    </div>
                </div>
            </div>

            <!-- Distributed Tracing -->
            <div class="tracing-section">
                <div class="section-header">
                    <h2 class="section-title">Recent Traces</h2>
                    <button class="btn btn-secondary" onclick="viewAllTraces()">
                        View All Traces
                    </button>
                </div>

                <div class="trace-list">
                    <div class="trace-item" onclick="viewTraceDetail('trace-1')">
                        <div class="trace-info">
                            <h4>POST /api/v1/shipments/create</h4>
                            <div class="trace-details">
                                <span>TraceID: 4bf92f3577b34da6</span>
                                <span>12 spans</span>
                                <span>5 services</span>
                            </div>
                        </div>
                        <div class="trace-metrics">
                            <span class="duration-badge duration-fast">142ms</span>
                        </div>
                    </div>

                    <div class="trace-item" onclick="viewTraceDetail('trace-2')">
                        <div class="trace-info">
                            <h4>GET /api/v1/analytics/dashboard</h4>
                            <div class="trace-details">
                                <span>TraceID: 8b0e5c4a912fd834</span>
                                <span>24 spans</span>
                                <span>8 services</span>
                            </div>
                        </div>
                        <div class="trace-metrics">
                            <span class="duration-badge duration-normal">387ms</span>
                        </div>
                    </div>

                    <div class="trace-item" onclick="viewTraceDetail('trace-3')">
                        <div class="trace-info">
                            <h4>PUT /api/v1/routes/optimize</h4>
                            <div class="trace-details">
                                <span>TraceID: c91e9f2d8a3b7c5e</span>
                                <span>18 spans</span>
                                <span>6 services</span>
                            </div>
                        </div>
                        <div class="trace-metrics">
                            <span class="duration-badge duration-slow">892ms</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Log Aggregation -->
            <div class="logs-section">
                <div class="section-header">
                    <h2 class="section-title">Live Log Stream</h2>
                    <button class="btn btn-secondary" onclick="exportLogs()">
                        Export Logs
                    </button>
                </div>

                <div class="log-filters">
                    <select class="filter-select">
                        <option value="">All Levels</option>
                        <option value="error">Error</option>
                        <option value="warn">Warning</option>
                        <option value="info">Info</option>
                        <option value="debug">Debug</option>
                    </select>
                    <select class="filter-select">
                        <option value="">All Services</option>
                        <option value="api">API Gateway</option>
                        <option value="shipment">Shipment Service</option>
                        <option value="analytics">Analytics Service</option>
                        <option value="notification">Notification Service</option>
                    </select>
                    <input type="text" class="search-box" placeholder="Search logs..." />
                </div>

                <div class="log-stream" id="logStream">
                    <div class="log-entry">
                        <span class="log-timestamp">2024-12-20 14:32:15</span>
                        <span class="log-level level-info">INFO</span>
                        <span class="log-message">API Gateway: Successfully processed shipment creation request</span>
                    </div>
                    <div class="log-entry">
                        <span class="log-timestamp">2024-12-20 14:32:14</span>
                        <span class="log-level level-warn">WARN</span>
                        <span class="log-message">Analytics Service: High memory usage detected (78%)</span>
                    </div>
                    <div class="log-entry">
                        <span class="log-timestamp">2024-12-20 14:32:12</span>
                        <span class="log-level level-error">ERROR</span>
                        <span class="log-message">Notification Service: Failed to send webhook to customer endpoint</span>
                    </div>
                    <div class="log-entry">
                        <span class="log-timestamp">2024-12-20 14:32:10</span>
                        <span class="log-level level-info">INFO</span>
                        <span class="log-message">Shipment Service: Route optimization completed in 287ms</span>
                    </div>
                </div>
            </div>

            <!-- Alert Management -->
            <div class="alerts-section">
                <div class="section-header">
                    <h2 class="section-title">Alert Management</h2>
                    <button class="btn btn-secondary" onclick="configureAlerts()">
                        ⚙️ Configure Rules
                    </button>
                </div>

                <div class="alert-stats">
                    <div class="alert-stat">
                        <div class="alert-count count-critical">2</div>
                        <div class="alert-label">Critical</div>
                    </div>
                    <div class="alert-stat">
                        <div class="alert-count count-warning">5</div>
                        <div class="alert-label">Warning</div>
                    </div>
                    <div class="alert-stat">
                        <div class="alert-count count-info">12</div>
                        <div class="alert-label">Info</div>
                    </div>
                    <div class="alert-stat">
                        <div class="alert-count count-resolved">47</div>
                        <div class="alert-label">Resolved (24h)</div>
                    </div>
                </div>

                <div class="active-alerts">
                    <div class="alert-item alert-critical">
                        <div class="alert-info-content">
                            <h4>Database Connection Pool Exhausted</h4>
                            <p class="alert-description">Primary database connection pool is at 95% capacity, risking service degradation</p>
                            <div class="alert-meta">
                                <span>Service: Analytics DB</span>
                                <span>Duration: 15 minutes</span>
                                <span>Affected: 3 services</span>
                            </div>
                        </div>
                        <div class="alert-actions">
                            <button class="action-btn" onclick="acknowledgeAlert('db-pool')">Acknowledge</button>
                            <button class="action-btn" onclick="escalateAlert('db-pool')">Escalate</button>
                        </div>
                    </div>

                    <div class="alert-item alert-critical">
                        <div class="alert-info-content">
                            <h4>API Response Time Degradation</h4>
                            <p class="alert-description">P95 latency exceeded 500ms threshold for the past 10 minutes</p>
                            <div class="alert-meta">
                                <span>Endpoint: /api/v1/routes</span>
                                <span>Duration: 10 minutes</span>
                                <span>Impact: High</span>
                            </div>
                        </div>
                        <div class="alert-actions">
                            <button class="action-btn" onclick="acknowledgeAlert('api-latency')">Acknowledge</button>
                            <button class="action-btn" onclick="investigateAlert('api-latency')">Investigate</button>
                        </div>
                    </div>

                    <div class="alert-item alert-warning">
                        <div class="alert-info-content">
                            <h4>Disk Space Warning</h4>
                            <p class="alert-description">Log storage volume at 82% capacity on production cluster</p>
                            <div class="alert-meta">
                                <span>Cluster: prod-us-east-1</span>
                                <span>Duration: 2 hours</span>
                                <span>Trend: Increasing</span>
                            </div>
                        </div>
                        <div class="alert-actions">
                            <button class="action-btn" onclick="acknowledgeAlert('disk-space')">Acknowledge</button>
                            <button class="action-btn" onclick="remediateAlert('disk-space')">Remediate</button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script>
        // Monitoring functions
        function viewDashboards() {
            trackEvent('All Dashboards Viewed');
            console.log('Opening dashboard catalog');
        }

        function createAlert() {
            trackEvent('Alert Rule Creation Started');
            console.log('Opening alert rule builder');
        }

        function viewAllTraces() {
            trackEvent('All Traces Viewed');
            console.log('Loading trace explorer');
        }

        function viewTraceDetail(traceId) {
            trackEvent('Trace Detail Viewed', { traceId: traceId });
            console.log('Opening trace detail:', traceId);
        }

        function exportLogs() {
            trackEvent('Logs Exported');
            console.log('Exporting log data');
        }

        function configureAlerts() {
            trackEvent('Alert Configuration Opened');
            console.log('Opening alert configuration');
        }

        // Alert management
        function acknowledgeAlert(alertId) {
            trackEvent('Alert Acknowledged', { alertId: alertId });
            console.log('Acknowledging alert:', alertId);
        }

        function escalateAlert(alertId) {
            trackEvent('Alert Escalated', { alertId: alertId });
            alert(`Alert ${alertId} has been escalated to on-call engineer`);
        }

        function investigateAlert(alertId) {
            trackEvent('Alert Investigation Started', { alertId: alertId });
            console.log('Starting investigation for:', alertId);
        }

        function remediateAlert(alertId) {
            trackEvent('Alert Remediation Started', { alertId: alertId });
            console.log('Initiating remediation for:', alertId);
        }

        // Real-time log streaming simulation
        function streamLogs() {
            const logLevels = ['INFO', 'WARN', 'ERROR', 'INFO', 'INFO'];
            const services = ['API Gateway', 'Shipment Service', 'Analytics Service', 'Notification Service'];
            const messages = [
                'Request processed successfully',
                'High memory usage detected',
                'Connection timeout to external service',
                'Cache hit ratio: 87%',
                'Database query optimized',
                'Webhook delivered successfully',
                'Rate limit approaching threshold'
            ];

            const logStream = document.getElementById('logStream');
            
            setInterval(() => {
                const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
                const level = logLevels[Math.floor(Math.random() * logLevels.length)];
                const service = services[Math.floor(Math.random() * services.length)];
                const message = messages[Math.floor(Math.random() * messages.length)];
                
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry';
                logEntry.innerHTML = `
                    <span class="log-timestamp">${timestamp}</span>
                    <span class="log-level level-${level.toLowerCase()}">${level}</span>
                    <span class="log-message">${service}: ${message}</span>
                `;
                
                logStream.insertBefore(logEntry, logStream.firstChild);
                
                // Keep only last 50 entries
                if (logStream.children.length > 50) {
                    logStream.removeChild(logStream.lastChild);
                }
            }, 2000);
        }

        // Monitor system health
        function monitorSystemHealth() {
            const healthScores = {
                system: 98.5,
                infrastructure: 92.3,
                application: 96.7
            };

            // Check for degradation
            Object.entries(healthScores).forEach(([component, score]) => {
                if (score < 90) {
                    trackEvent('Health Score Alert', {
                        component: component,
                        score: score
                    });
                }
            });
        }

        // Time range selection
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                this.parentElement.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                trackEvent('Time Range Changed', { range: this.textContent });
            });
        });

        function trackEvent(eventName, properties = {}) {
            console.log('Monitoring Event:', eventName, properties);
            
            // Integration with analytics
            if (typeof analytics !== 'undefined') {
                analytics.track(eventName, {
                    ...properties,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            trackEvent('Monitoring Platform Loaded');
            streamLogs();
            monitorSystemHealth();
            
            // Simulate real-time metric updates
            setInterval(() => {
                console.log('Updating real-time metrics...');
            }, 5000);
        });
    </script>
</body>
</html>
ENDOFFILE


echo "Infrastructure platform deployed successfully!"
echo "Available at:"
echo "- http://145.223.73.4/infrastructure/cloud/"
echo "- http://145.223.73.4/infrastructure/security/"
echo "- http://145.223.73.4/infrastructure/data/"
echo "- http://145.223.73.4/infrastructure/integration/"
echo "- http://145.223.73.4/infrastructure/monitoring/"
