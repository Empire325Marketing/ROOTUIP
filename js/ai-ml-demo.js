// AI/ML Demonstration System - Interactive JavaScript
class AIMLDemo {
    constructor() {
        this.initializeEventListeners();
        this.initializeCharts();
        this.modelMetrics = {
            accuracy: 94.3,
            precision: 92.1,
            recall: 95.8,
            f1Score: 0.89
        };
    }

    initializeEventListeners() {
        // Document Processing
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const processBtn = document.getElementById('processBtn');

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('active');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('active');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('active');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFileUpload(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        processBtn.addEventListener('click', () => this.processDocument());

        // Predictive Analytics
        document.getElementById('runPredictionsBtn').addEventListener('click', () => this.runPredictions());

        // ML Model Performance
        document.getElementById('refreshMetricsBtn').addEventListener('click', () => this.refreshMetrics());

        // Automation Workflow
        document.getElementById('runWorkflowBtn').addEventListener('click', () => this.runWorkflow());
    }

    handleFileUpload(file) {
        const uploadArea = document.getElementById('uploadArea');
        uploadArea.innerHTML = `
            <svg width="48" height="48" fill="#10b981" viewBox="0 0 24 24" style="margin: 0 auto;">
                <path d="M9,16.17L4.83,12L3.41,13.41L9,19L14.59,13.41L13.17,12L9,16.17Z"/>
            </svg>
            <p style="margin-top: 10px; color: #10b981;">File uploaded: ${file.name}</p>
            <p style="font-size: 0.9rem; color: #64748b; margin-top: 5px;">Ready for AI processing</p>
        `;
        document.getElementById('processBtn').disabled = false;
    }

    async processDocument() {
        const processingBar = document.getElementById('processingBar');
        const progressBar = document.getElementById('progressBar');
        const resultsPanel = document.getElementById('ocrResults');
        
        // Show processing animation
        processingBar.style.display = 'block';
        resultsPanel.classList.remove('active');
        
        // Simulate GPU vs CPU processing
        const useGPU = Math.random() > 0.3;
        const processingTime = useGPU ? 
            Math.random() * 2000 + 500 : // GPU: 0.5-2.5 seconds
            Math.random() * 15000 + 5000; // CPU: 5-20 seconds

        // Animate progress bar
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 20;
            if (progress > 95) progress = 95;
            progressBar.style.width = progress + '%';
        }, 200);

        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, processingTime));
        
        clearInterval(interval);
        progressBar.style.width = '100%';

        // Generate results
        const results = this.generateOCRResults(useGPU, processingTime);
        
        // Display results
        setTimeout(() => {
            this.displayOCRResults(results);
            processingBar.style.display = 'none';
            progressBar.style.width = '0%';
        }, 500);
    }

    generateOCRResults(useGPU, processingTime) {
        const documentTypes = ['Bill of Lading', 'Commercial Invoice', 'Packing List', 'Customs Declaration'];
        const confidence = Math.random() * 0.1 + 0.9; // 90-100%
        
        return {
            documentType: documentTypes[Math.floor(Math.random() * documentTypes.length)],
            confidence: confidence,
            processingTime: processingTime,
            useGPU: useGPU,
            entitiesExtracted: Math.floor(Math.random() * 15) + 10,
            accuracy: confidence * 100
        };
    }

    displayOCRResults(results) {
        const resultsPanel = document.getElementById('ocrResults');
        resultsPanel.classList.add('active');

        // Update values
        document.getElementById('docType').textContent = results.documentType;
        document.getElementById('ocrConfidence').textContent = (results.confidence * 100).toFixed(1) + '%';
        document.getElementById('processingTime').textContent = 
            results.useGPU ? 
            `${(results.processingTime / 1000).toFixed(2)}s (GPU)` : 
            `${(results.processingTime / 1000).toFixed(2)}s (CPU)`;
        document.getElementById('entitiesCount').textContent = results.entitiesExtracted;

        // Update confidence bar
        const confidenceBar = document.getElementById('confidenceBar');
        confidenceBar.style.width = (results.confidence * 100) + '%';
        confidenceBar.textContent = (results.confidence * 100).toFixed(1) + '%';

        // Update comparison
        document.getElementById('aiProcessingTime').textContent = 
            `${(results.processingTime / 1000).toFixed(2)}s`;
        document.getElementById('aiAccuracy').textContent = 
            `${results.accuracy.toFixed(1)}%`;

        // Show extracted entities
        this.showExtractedEntities(results.documentType);
    }

    showExtractedEntities(docType) {
        const entities = {
            'Bill of Lading': [
                { type: 'Container', value: 'MSKU7750847' },
                { type: 'Port of Loading', value: 'Shanghai' },
                { type: 'Port of Discharge', value: 'Los Angeles' },
                { type: 'Vessel', value: 'MAERSK BROOKLYN' }
            ],
            'Commercial Invoice': [
                { type: 'Invoice No', value: 'INV-2025-0001' },
                { type: 'Total Amount', value: '$45,750.00' },
                { type: 'Shipper', value: 'ACME Corp' },
                { type: 'Terms', value: 'FOB Shanghai' }
            ]
        };

        // Could display these entities in the UI if needed
    }

    async runPredictions() {
        const btn = document.getElementById('runPredictionsBtn');
        btn.disabled = true;
        btn.textContent = 'Analyzing...';

        // Simulate prediction calculation
        await new Promise(resolve => setTimeout(resolve, 1500));

        const predictions = this.generatePredictions();
        this.displayPredictions(predictions);

        btn.disabled = false;
        btn.innerHTML = `
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
            </svg>
            Run Predictive Analysis
        `;
    }

    generatePredictions() {
        const ddRisk = Math.random() * 100;
        const portCongestion = Math.random() * 100;
        const delayHours = Math.floor(Math.random() * 72);
        const potentialCharges = Math.floor(Math.random() * 50000) + 5000;
        const savings = Math.floor(potentialCharges * 0.85);

        return {
            ddRisk: ddRisk,
            portCongestion: portCongestion,
            delayPrediction: delayHours,
            potentialCharges: potentialCharges,
            savings: savings,
            confidence: Math.random() * 0.15 + 0.8 // 80-95%
        };
    }

    displayPredictions(predictions) {
        // Update feature cards
        document.getElementById('ddRiskScore').textContent = predictions.ddRisk.toFixed(1) + '%';
        document.getElementById('ddRiskScore').className = 'feature-value ' + 
            (predictions.ddRisk > 70 ? 'high' : predictions.ddRisk > 40 ? 'medium' : 'low');

        document.getElementById('portCongestion').textContent = predictions.portCongestion.toFixed(1) + '%';
        document.getElementById('delayPrediction').textContent = predictions.delayPrediction + 'h';
        document.getElementById('costSavings').textContent = '$' + predictions.savings.toLocaleString();

        // Show risk gauge
        this.updateRiskGauge(predictions.ddRisk);

        // Show results panel
        const resultsPanel = document.getElementById('predictionResults');
        resultsPanel.classList.add('active');

        // Update risk alert
        const riskAlert = document.getElementById('riskAlert');
        const riskMessage = document.getElementById('riskMessage');
        
        if (predictions.ddRisk > 70) {
            riskAlert.className = 'alert danger';
            riskMessage.textContent = 'Critical risk detected. Immediate action required.';
        } else if (predictions.ddRisk > 40) {
            riskAlert.className = 'alert warning';
            riskMessage.textContent = 'Moderate risk. Monitor closely and prepare interventions.';
        } else {
            riskAlert.className = 'alert success';
            riskMessage.textContent = 'Low risk. Continue standard monitoring.';
        }

        // Update other metrics
        document.getElementById('confidenceInterval').textContent = 
            `${(predictions.confidence * 100).toFixed(1)}% ± 5%`;
        
        document.getElementById('recommendedAction').textContent = 
            predictions.ddRisk > 70 ? 'Schedule immediate pickup' :
            predictions.ddRisk > 40 ? 'Request free time extension' :
            'Continue monitoring';

        // Generate recommendations
        this.generateRecommendations(predictions);
    }

    updateRiskGauge(riskScore) {
        const gauge = document.getElementById('riskGauge');
        const needle = document.getElementById('gaugeNeedle');
        
        gauge.style.display = 'block';
        
        // Convert risk score to rotation angle (-90 to 90 degrees)
        const angle = (riskScore / 100) * 180 - 90;
        needle.style.transform = `translateX(-50%) rotate(${angle}deg)`;
    }

    generateRecommendations(predictions) {
        const container = document.getElementById('recommendations');
        container.innerHTML = '';

        const recommendations = [];
        
        if (predictions.ddRisk > 70) {
            recommendations.push({
                action: 'Immediate container pickup',
                impact: `Save $${(predictions.potentialCharges * 0.9).toLocaleString()}`,
                priority: 'URGENT'
            });
        }
        
        if (predictions.portCongestion > 60) {
            recommendations.push({
                action: 'Schedule off-peak appointment',
                impact: 'Reduce wait time by 4-6 hours',
                priority: 'HIGH'
            });
        }
        
        if (predictions.delayPrediction > 48) {
            recommendations.push({
                action: 'Negotiate free time extension',
                impact: `Prevent $${Math.floor(predictions.potentialCharges * 0.3).toLocaleString()} in charges`,
                priority: 'MEDIUM'
            });
        }

        recommendations.forEach(rec => {
            const div = document.createElement('div');
            div.className = 'alert';
            div.innerHTML = `
                <strong>${rec.priority}:</strong> ${rec.action}<br>
                <span style="color: #10b981;">Impact: ${rec.impact}</span>
            `;
            container.appendChild(div);
        });
    }

    async refreshMetrics() {
        const btn = document.getElementById('refreshMetricsBtn');
        btn.disabled = true;
        
        // Simulate metrics update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update metrics with slight variations
        this.modelMetrics.accuracy += (Math.random() - 0.5) * 0.5;
        this.modelMetrics.precision += (Math.random() - 0.5) * 0.5;
        this.modelMetrics.recall += (Math.random() - 0.5) * 0.5;
        
        // Update chart
        this.updatePerformanceChart();
        
        btn.disabled = false;
    }

    async runWorkflow() {
        const steps = ['step1', 'step2', 'step3', 'step4', 'step5'];
        const resultsPanel = document.getElementById('workflowResults');
        
        resultsPanel.classList.remove('active');
        
        // Reset all steps
        steps.forEach(step => {
            document.getElementById(step).className = 'workflow-step';
        });

        // Animate through steps
        for (let i = 0; i < steps.length; i++) {
            const step = document.getElementById(steps[i]);
            step.classList.add('active');
            
            await new Promise(resolve => setTimeout(resolve, 800));
            
            step.classList.add('completed');
        }

        // Show results
        this.displayWorkflowResults();
    }

    displayWorkflowResults() {
        const resultsPanel = document.getElementById('workflowResults');
        resultsPanel.classList.add('active');

        const executionTime = Math.random() * 3000 + 2000;
        const rulesApplied = Math.floor(Math.random() * 10) + 5;
        const successRate = Math.random() * 10 + 90;

        document.getElementById('workflowTime').textContent = 
            `${(executionTime / 1000).toFixed(2)}s`;
        document.getElementById('rulesApplied').textContent = rulesApplied;
        document.getElementById('successRate').textContent = 
            `${successRate.toFixed(1)}%`;
        
        document.getElementById('workflowResult').textContent = 
            'Container prioritized for immediate pickup. Notification sent to operations team.';
    }

    initializeCharts() {
        const ctx = document.getElementById('modelChart');
        if (!ctx) return;

        this.performanceChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: this.generateTimeLabels(),
                datasets: [{
                    label: 'Accuracy',
                    data: this.generateRandomData(94, 96),
                    borderColor: '#3b82f6',
                    tension: 0.4
                }, {
                    label: 'Precision',
                    data: this.generateRandomData(91, 93),
                    borderColor: '#10b981',
                    tension: 0.4
                }, {
                    label: 'Recall',
                    data: this.generateRandomData(94, 97),
                    borderColor: '#f59e0b',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#e2e8f0' }
                    }
                },
                scales: {
                    y: {
                        min: 85,
                        max: 100,
                        ticks: { color: '#94a3b8' },
                        grid: { color: '#334155' }
                    },
                    x: {
                        ticks: { color: '#94a3b8' },
                        grid: { color: '#334155' }
                    }
                }
            }
        });
    }

    generateTimeLabels() {
        const labels = [];
        for (let i = 23; i >= 0; i--) {
            labels.push(`${i}h ago`);
        }
        return labels.reverse();
    }

    generateRandomData(min, max) {
        return Array.from({ length: 24 }, () => 
            Math.random() * (max - min) + min
        );
    }

    updatePerformanceChart() {
        if (!this.performanceChart) return;
        
        // Update with new data
        this.performanceChart.data.datasets[0].data = this.generateRandomData(93, 96);
        this.performanceChart.data.datasets[1].data = this.generateRandomData(90, 93);
        this.performanceChart.data.datasets[2].data = this.generateRandomData(93, 97);
        this.performanceChart.update();
    }
}

// Scenario runner for demo
function runScenario(scenario) {
    const resultsPanel = document.getElementById('scenarioResults');
    const title = document.getElementById('scenarioTitle');
    const content = document.getElementById('scenarioContent');
    
    resultsPanel.classList.add('active');
    
    const scenarios = {
        'high-risk': {
            title: '🚨 High Risk Container Scenario',
            content: `
                <div class="alert danger">
                    <strong>Container MSKU7750847</strong> - Critical D&D risk detected
                </div>
                <div class="metric">
                    <span class="metric-label">Risk Score</span>
                    <span class="metric-value high">87.3%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Free Time Remaining</span>
                    <span class="metric-value">18 hours</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Estimated Charges</span>
                    <span class="metric-value">$15,400</span>
                </div>
                <h4 style="margin: 20px 0 10px;">AI Actions Taken:</h4>
                <ul style="color: #94a3b8; line-height: 1.8;">
                    <li>✅ Priority pickup appointment scheduled</li>
                    <li>✅ Operations team notified via SMS/Email</li>
                    <li>✅ Trucking company dispatched</li>
                    <li>✅ Customer alert sent</li>
                </ul>
                <div class="alert success" style="margin-top: 20px;">
                    <strong>Result:</strong> $15,400 in D&D charges prevented
                </div>
            `
        },
        'port-congestion': {
            title: '🏗️ Port Congestion Alert',
            content: `
                <div class="alert warning">
                    <strong>Port of Los Angeles</strong> - High congestion detected
                </div>
                <div class="metric">
                    <span class="metric-label">Current Wait Time</span>
                    <span class="metric-value">8.5 hours</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Congestion Level</span>
                    <span class="metric-value medium">73%</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Affected Containers</span>
                    <span class="metric-value">47</span>
                </div>
                <h4 style="margin: 20px 0 10px;">AI Optimization:</h4>
                <ul style="color: #94a3b8; line-height: 1.8;">
                    <li>📊 Analyzed historical patterns</li>
                    <li>🕐 Identified optimal pickup windows</li>
                    <li>🚛 Re-routed to alternative terminals</li>
                    <li>📱 Updated all stakeholders</li>
                </ul>
                <div class="alert success" style="margin-top: 20px;">
                    <strong>Result:</strong> Average wait time reduced to 2.5 hours
                </div>
            `
        },
        'cost-optimization': {
            title: '💰 Cost Optimization Success',
            content: `
                <div class="alert success">
                    <strong>Monthly Analysis Complete</strong> - Significant savings identified
                </div>
                <div class="metric">
                    <span class="metric-label">Containers Analyzed</span>
                    <span class="metric-value">847</span>
                </div>
                <div class="metric">
                    <span class="metric-label">D&D Prevented</span>
                    <span class="metric-value low">$248,000</span>
                </div>
                <div class="metric">
                    <span class="metric-label">ROI</span>
                    <span class="metric-value">247%</span>
                </div>
                <h4 style="margin: 20px 0 10px;">Optimization Breakdown:</h4>
                <div class="feature-grid" style="margin-top: 15px;">
                    <div class="feature-card">
                        <div class="feature-value" style="font-size: 1.5rem;">$125K</div>
                        <div class="feature-label">Detention Saved</div>
                    </div>
                    <div class="feature-card">
                        <div class="feature-value" style="font-size: 1.5rem;">$89K</div>
                        <div class="feature-label">Demurrage Saved</div>
                    </div>
                    <div class="feature-card">
                        <div class="feature-value" style="font-size: 1.5rem;">$34K</div>
                        <div class="feature-label">Storage Saved</div>
                    </div>
                </div>
            `
        },
        'document-processing': {
            title: '📄 Complex Document Processing',
            content: `
                <div class="alert success">
                    <strong>Multi-page Bill of Lading</strong> - Successfully processed
                </div>
                <div class="metric">
                    <span class="metric-label">Pages Processed</span>
                    <span class="metric-value">12</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Processing Time</span>
                    <span class="metric-value">1.8s</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Accuracy</span>
                    <span class="metric-value">98.7%</span>
                </div>
                <h4 style="margin: 20px 0 10px;">Entities Extracted:</h4>
                <div style="background: #0f172a; padding: 15px; border-radius: 8px; font-family: monospace;">
                    <div style="margin: 5px 0;"><span style="color: #60a5fa;">Containers:</span> 15 identified</div>
                    <div style="margin: 5px 0;"><span style="color: #60a5fa;">Ports:</span> Shanghai → Long Beach</div>
                    <div style="margin: 5px 0;"><span style="color: #60a5fa;">Vessel:</span> MAERSK EDINBURGH</div>
                    <div style="margin: 5px 0;"><span style="color: #60a5fa;">ETA:</span> 2025-07-15 14:00 PST</div>
                    <div style="margin: 5px 0;"><span style="color: #60a5fa;">Value:</span> $2,450,000</div>
                </div>
                <div class="comparison-view" style="margin-top: 20px;">
                    <div class="comparison-panel before">
                        <h3>Manual Process</h3>
                        <div class="metric">
                            <span class="metric-label">Time</span>
                            <span class="metric-value">45 min</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Errors</span>
                            <span class="metric-value">3-5</span>
                        </div>
                    </div>
                    <div class="comparison-panel after">
                        <h3>AI Process</h3>
                        <div class="metric">
                            <span class="metric-label">Time</span>
                            <span class="metric-value">1.8s</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Errors</span>
                            <span class="metric-value">0</span>
                        </div>
                    </div>
                </div>
            `
        }
    };
    
    const selectedScenario = scenarios[scenario];
    title.textContent = selectedScenario.title;
    content.innerHTML = selectedScenario.content;
}

// Initialize demo on page load
document.addEventListener('DOMContentLoaded', () => {
    new AIMLDemo();
});