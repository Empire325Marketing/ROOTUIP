// ROI Calculator JavaScript - Now with Backend API Integration
// Handles all calculations, visualizations, and interactions

// Initialize variables
let savingsChart, comparisonChart;
let calculationData = {};

// API Configuration
const API_BASE = '/api';

// API Helper Functions
async function apiCall(endpoint, data = null, method = 'GET') {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        
        if (!response.ok) {
            throw new Error(`API call failed: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, error: error.message };
    }
}

// Industry benchmarks
const industryBenchmarks = {
    importer: {
        ddRate: 0.024, // 2.4% of revenue
        manualHours: 180,
        errorRate: 0.04,
        disputeSuccessRate: 0.67
    },
    manufacturer: {
        ddRate: 0.018,
        manualHours: 150,
        errorRate: 0.035,
        disputeSuccessRate: 0.70
    },
    '3pl': {
        ddRate: 0.032,
        manualHours: 240,
        errorRate: 0.045,
        disputeSuccessRate: 0.65
    },
    carrier: {
        ddRate: 0.015,
        manualHours: 120,
        errorRate: 0.025,
        disputeSuccessRate: 0.75
    },
    other: {
        ddRate: 0.024,
        manualHours: 180,
        errorRate: 0.04,
        disputeSuccessRate: 0.67
    }
};

// UIP performance metrics
const uipMetrics = {
    ddReduction: 0.87, // 87% reduction in D&D charges
    automationRate: 0.85, // 85% automation of manual tasks
    errorReduction: 0.90, // 90% reduction in errors (4% to 0.4%)
    disputeSuccessRate: 0.94, // 94% dispute success rate
    implementationDays: 14, // 14-day implementation
    yearlyGrowth: 0.15 // 15% additional savings year-over-year
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeSliders();
    initializeEventListeners();
    initializeCharts();
    calculateROI();
});

// Initialize sliders
function initializeSliders() {
    // Vessel count slider
    const vesselSlider = document.getElementById('vesselSlider');
    const vesselCount = document.getElementById('vesselCount');
    
    vesselSlider.addEventListener('input', function() {
        vesselCount.value = this.value;
        calculateROI();
    });
    
    vesselCount.addEventListener('input', function() {
        vesselSlider.value = Math.min(100, this.value);
        calculateROI();
    });
    
    // Data sources slider
    const dataSourcesSlider = document.getElementById('dataSourcesSlider');
    const dataSources = document.getElementById('dataSources');
    
    dataSourcesSlider.addEventListener('input', function() {
        dataSources.value = this.value;
        calculateROI();
    });
    
    dataSources.addEventListener('input', function() {
        dataSourcesSlider.value = Math.min(20, this.value);
        calculateROI();
    });
}

// Initialize event listeners
function initializeEventListeners() {
    // Advanced options toggle
    document.getElementById('advancedToggle').addEventListener('click', function() {
        const advancedOptions = document.getElementById('advancedOptions');
        const isOpen = advancedOptions.classList.contains('open');
        
        if (isOpen) {
            advancedOptions.classList.remove('open');
            this.classList.remove('open');
        } else {
            advancedOptions.classList.add('open');
            this.classList.add('open');
        }
    });
    
    // All input fields trigger recalculation
    const inputs = document.querySelectorAll('input[type="number"], select');
    inputs.forEach(input => {
        input.addEventListener('input', calculateROI);
        input.addEventListener('change', calculateROI);
    });
    
    // Form submission
    document.getElementById('resultsForm').addEventListener('submit', handleFormSubmission);
    
    // Download report button
    document.getElementById('downloadReport').addEventListener('click', generatePDFReport);
    
    // Share results button
    document.getElementById('shareResults').addEventListener('click', shareResults);
}

// Main ROI calculation function
function calculateROI() {
    // Get input values
    const industryType = document.getElementById('industryType').value;
    const vessels = parseInt(document.getElementById('vesselCount').value) || 10;
    const containersPerVessel = parseInt(document.getElementById('containersPerVessel').value) || 5000;
    const monthlyDDCharges = parseFloat(document.getElementById('ddCharges').value) || 1200000;
    const weeklyManualHours = parseInt(document.getElementById('manualHours').value) || 160;
    const dataSources = parseInt(document.getElementById('dataSources').value) || 8;
    
    // Advanced options
    const avgDelayDays = parseFloat(document.getElementById('avgDelayDays').value) || 3.5;
    const currentDisputeRate = parseFloat(document.getElementById('disputeSuccessRate').value) / 100 || 0.67;
    const hourlyRate = parseFloat(document.getElementById('avgHourlyRate').value) || 65;
    
    // Get industry benchmarks
    const benchmark = industryBenchmarks[industryType];
    
    // Calculate total containers
    const totalContainers = vessels * containersPerVessel;
    
    // D&D Savings Calculations
    const annualDDCharges = monthlyDDCharges * 12;
    const preventableCharges = annualDDCharges * uipMetrics.ddReduction;
    const improvedDisputeRecovery = annualDDCharges * 0.13 * (uipMetrics.disputeSuccessRate - currentDisputeRate);
    const totalDDSavings = preventableCharges + improvedDisputeRecovery;
    
    // Labor Savings Calculations
    const annualManualHours = weeklyManualHours * 52;
    const automatedHours = annualManualHours * uipMetrics.automationRate;
    const laborSavings = automatedHours * hourlyRate;
    
    // Integration Efficiency Gains
    const errorCostPerContainer = 250; // Average cost per error
    const currentErrors = totalContainers * benchmark.errorRate;
    const reducedErrors = totalContainers * (benchmark.errorRate * (1 - uipMetrics.errorReduction));
    const errorReductionSavings = (currentErrors - reducedErrors) * errorCostPerContainer;
    
    // Processing time improvements
    const processingTimeSavings = totalContainers * 15 * (dataSources / 10); // $15 per container per data source complexity
    
    const totalEfficiencyGains = errorReductionSavings + processingTimeSavings;
    
    // Total Savings
    const annualSavings = totalDDSavings + laborSavings + totalEfficiencyGains;
    
    // Investment calculation (based on vessel count)
    const annualInvestment = vessels * 500000; // $500K per vessel
    
    // ROI Calculations
    const roi = ((annualSavings - annualInvestment) / annualInvestment) * 100;
    const paybackDays = (annualInvestment / annualSavings) * 365;
    
    // 5-year projection with growth
    let fiveYearValue = 0;
    for (let year = 1; year <= 5; year++) {
        fiveYearValue += annualSavings * Math.pow(1 + uipMetrics.yearlyGrowth, year - 1);
    }
    fiveYearValue -= annualInvestment * 5; // Subtract 5 years of investment
    
    // Confidence interval based on data quality
    const dataQuality = Math.min(1, dataSources / 10);
    const confidenceInterval = 5 + (15 * (1 - dataQuality)); // 5-20% range
    
    // Store calculation data for charts
    calculationData = {
        annualSavings,
        totalDDSavings,
        laborSavings,
        totalEfficiencyGains,
        annualInvestment,
        roi,
        paybackDays,
        fiveYearValue,
        confidenceInterval,
        preventableCharges,
        improvedDisputeRecovery,
        automatedHours,
        errorReductionSavings,
        processingTimeSavings,
        annualDDCharges,
        annualManualHours,
        vessels,
        totalContainers,
        benchmark,
        weeklyManualHours
    };
    
    // Update UI
    updateResults();
    updateCharts();
    updateBenchmarks();
}

// Update results display
function updateResults() {
    // Format currency
    const formatCurrency = (value) => {
        if (value >= 1000000) {
            return '$' + (value / 1000000).toFixed(1) + 'M';
        } else if (value >= 1000) {
            return '$' + (value / 1000).toFixed(0) + 'K';
        }
        return '$' + value.toFixed(0);
    };
    
    // Update key metrics
    document.getElementById('annualSavings').textContent = formatCurrency(calculationData.annualSavings);
    document.getElementById('fiveYearValue').textContent = formatCurrency(calculationData.fiveYearValue);
    document.getElementById('roiPercentage').textContent = calculationData.roi.toFixed(0) + '%';
    document.getElementById('confidenceInterval').textContent = '±' + calculationData.confidenceInterval.toFixed(0) + '%';
    
    // Payback period
    if (calculationData.paybackDays < 365) {
        document.getElementById('paybackPeriod').textContent = calculationData.paybackDays.toFixed(0) + ' days';
    } else {
        document.getElementById('paybackPeriod').textContent = (calculationData.paybackDays / 365).toFixed(1) + ' years';
    }
    
    // Update breakdown details
    document.getElementById('currentDDExposure').textContent = formatCurrency(calculationData.annualDDCharges);
    document.getElementById('preventableCharges').textContent = formatCurrency(calculationData.preventableCharges);
    document.getElementById('annualDDSavings').textContent = formatCurrency(calculationData.totalDDSavings);
    
    document.getElementById('currentManualHours').textContent = calculationData.annualManualHours.toLocaleString() + ' hrs/year';
    document.getElementById('automatedHours').textContent = calculationData.automatedHours.toFixed(0) + ' hrs/year';
    document.getElementById('annualLaborSavings').textContent = formatCurrency(calculationData.laborSavings);
    
    document.getElementById('errorReduction').textContent = formatCurrency(calculationData.errorReductionSavings);
    document.getElementById('processingGains').textContent = formatCurrency(calculationData.processingTimeSavings);
    document.getElementById('annualEfficiencyGains').textContent = formatCurrency(calculationData.totalEfficiencyGains);
    
    // Add visual indicators for high-impact savings
    const savingsElement = document.getElementById('annualSavings');
    savingsElement.classList.remove('pulse');
    if (calculationData.roi > 200) {
        setTimeout(() => savingsElement.classList.add('pulse'), 100);
    }
}

// Initialize charts
function initializeCharts() {
    // Savings over time chart
    const savingsCtx = document.getElementById('savingsChart').getContext('2d');
    savingsChart = new Chart(savingsCtx, {
        type: 'line',
        data: {
            labels: ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'],
            datasets: [{
                label: 'Cumulative Savings',
                data: [],
                borderColor: '#00D4AA',
                backgroundColor: 'rgba(0, 212, 170, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }, {
                label: 'Investment',
                data: [],
                borderColor: '#FF6B35',
                borderWidth: 2,
                borderDash: [5, 5]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let value = context.parsed.y;
                            if (value >= 1000000) {
                                return context.dataset.label + ': $' + (value / 1000000).toFixed(1) + 'M';
                            }
                            return context.dataset.label + ': $' + (value / 1000).toFixed(0) + 'K';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (value >= 1000000) {
                                return '$' + (value / 1000000).toFixed(0) + 'M';
                            }
                            return '$' + (value / 1000).toFixed(0) + 'K';
                        }
                    }
                }
            }
        }
    });
    
    // Before/After comparison chart
    const comparisonCtx = document.getElementById('comparisonChart').getContext('2d');
    comparisonChart = new Chart(comparisonCtx, {
        type: 'bar',
        data: {
            labels: ['D&D Charges', 'Manual Hours', 'Error Rate', 'Dispute Success'],
            datasets: [{
                label: 'Current State',
                data: [],
                backgroundColor: '#E2E8F0',
                borderColor: '#CBD5E1',
                borderWidth: 1
            }, {
                label: 'With UIP',
                data: [],
                backgroundColor: '#00D4AA',
                borderColor: '#00B894',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Update charts with calculation data
function updateCharts() {
    // Update savings over time chart
    let cumulativeSavings = [];
    let cumulativeInvestment = [];
    let runningTotal = 0;
    
    for (let year = 1; year <= 5; year++) {
        const yearSavings = calculationData.annualSavings * Math.pow(1 + uipMetrics.yearlyGrowth, year - 1);
        runningTotal += yearSavings;
        cumulativeSavings.push(runningTotal);
        cumulativeInvestment.push(calculationData.annualInvestment * year);
    }
    
    savingsChart.data.datasets[0].data = cumulativeSavings;
    savingsChart.data.datasets[1].data = cumulativeInvestment;
    savingsChart.update();
    
    // Update comparison chart
    const currentHours = calculationData.weeklyManualHours;
    const uipHours = currentHours * (1 - uipMetrics.automationRate);
    
    comparisonChart.data.datasets[0].data = [
        100, // Current D&D as baseline
        currentHours,
        calculationData.benchmark.errorRate * 100,
        67 // Current dispute success rate
    ];
    
    comparisonChart.data.datasets[1].data = [
        13, // 87% reduction
        uipHours,
        calculationData.benchmark.errorRate * (1 - uipMetrics.errorReduction) * 100,
        94 // UIP dispute success rate
    ];
    
    comparisonChart.update();
}

// Update industry benchmarks display
function updateBenchmarks() {
    // Your D&D Rate
    const currentDDRate = (calculationData.annualDDCharges / (calculationData.totalContainers * 5000)) * 100; // Assuming $5000 avg container value
    const ddRateBar = document.getElementById('yourDDRate');
    const ddRateWidth = Math.min(100, (currentDDRate / 5) * 100); // Scale to 5% max
    ddRateBar.style.width = ddRateWidth + '%';
    ddRateBar.querySelector('.benchmark-value').textContent = currentDDRate.toFixed(1) + '%';
    
    // Manual Processing Time
    const processingBar = document.getElementById('yourProcessingTime');
    const processingWidth = Math.min(100, (calculationData.weeklyManualHours / 300) * 100); // Scale to 300 hrs max
    processingBar.style.width = processingWidth + '%';
    processingBar.querySelector('.benchmark-value').textContent = calculationData.weeklyManualHours + ' hrs';
    
    // Update bar colors based on performance
    if (currentDDRate > 3) {
        ddRateBar.style.backgroundColor = '#FF6B35';
    } else if (currentDDRate > 2) {
        ddRateBar.style.backgroundColor = '#FFA500';
    } else {
        ddRateBar.style.backgroundColor = '#00D4AA';
    }
}

// Handle form submission - Now with Real API Integration
async function handleFormSubmission(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    // Show loading state
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Processing...';
    submitButton.disabled = true;
    
    try {
        // Prepare data for API
        const roiData = {
            monthlyShipments: calculationData.totalContainers,
            avgDetentionCost: calculationData.monthlyDDCharges / calculationData.totalContainers,
            manualHours: calculationData.weeklyManualHours,
            hourlyRate: calculationData.hourlyRate || 65,
            email: data.email,
            company: data.company,
            name: data.name,
            phone: data.phone
        };
        
        // Submit to API
        const response = await apiCall('/leads/roi-calculate', roiData, 'POST');
        
        if (response.success) {
            // Success state
            submitButton.textContent = '✓ ROI Report Sent!';
            submitButton.style.backgroundColor = '#00D4AA';
            
            // Track successful lead capture
            if (typeof leadTracker !== 'undefined') {
                leadTracker.identifyLead(data.email, {
                    source: 'roi_calculator',
                    leadScore: response.leadScore || 75,
                    roiData: response.roiData
                });
            }
            
            // Track conversion
            if (typeof gtag !== 'undefined') {
                gtag('event', 'conversion', {
                    'event_category': 'ROI Calculator',
                    'event_label': 'Lead Captured',
                    'value': calculationData.annualSavings
                });
            }
            
            // Show success message
            showSuccessMessage('Your personalized ROI report has been sent to your email!');
            
        } else {
            throw new Error(response.error || 'Failed to submit');
        }
        
    } catch (error) {
        console.error('Submission error:', error);
        submitButton.textContent = 'Try Again';
        submitButton.style.backgroundColor = '#FF6B35';
        showErrorMessage('Failed to send report. Please try again.');
    }
    
    // Reset button after 3 seconds
    setTimeout(() => {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        submitButton.style.backgroundColor = '';
        if (submitButton.textContent.includes('✓')) {
            e.target.reset();
        }
    }, 3000);
}

// Show success message
function showSuccessMessage(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.style.cssText = `
        background: #d4edda;
        color: #155724;
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
        border: 1px solid #c3e6cb;
    `;
    successDiv.textContent = message;
    
    const form = document.querySelector('#resultsForm');
    form.parentNode.insertBefore(successDiv, form);
    
    setTimeout(() => successDiv.remove(), 5000);
}

// Show error message
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.style.cssText = `
        background: #f8d7da;
        color: #721c24;
        padding: 15px;
        border-radius: 8px;
        margin: 20px 0;
        border: 1px solid #f5c6cb;
    `;
    errorDiv.textContent = message;
    
    const form = document.querySelector('#resultsForm');
    form.parentNode.insertBefore(errorDiv, form);
    
    setTimeout(() => errorDiv.remove(), 5000);
}

// Generate PDF report
function generatePDFReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(10, 22, 40); // Navy
    doc.text('UIP ROI Analysis Report', 20, 20);
    
    // Date
    doc.setFontSize(10);
    doc.setTextColor(94, 107, 124); // Gray
    doc.text(new Date().toLocaleDateString(), 20, 30);
    
    // Company info
    doc.setFontSize(12);
    doc.setTextColor(10, 22, 40);
    const vesselCount = document.getElementById('vesselCount').value;
    doc.text(`Analysis for: ${vesselCount} Vessels Operation`, 20, 45);
    
    // Key Metrics Section
    doc.setFontSize(16);
    doc.text('Executive Summary', 20, 60);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 212, 170); // Teal
    doc.text(`Total Annual Savings: $${(calculationData.annualSavings / 1000000).toFixed(1)}M`, 20, 75);
    
    doc.setTextColor(10, 22, 40);
    doc.text(`ROI: ${calculationData.roi.toFixed(0)}%`, 20, 85);
    doc.text(`Payback Period: ${calculationData.paybackDays.toFixed(0)} days`, 20, 95);
    doc.text(`5-Year Value: $${(calculationData.fiveYearValue / 1000000).toFixed(1)}M`, 20, 105);
    
    // Breakdown Section
    doc.setFontSize(14);
    doc.text('Savings Breakdown', 20, 125);
    
    doc.setFontSize(11);
    doc.text(`D&D Prevention: $${(calculationData.totalDDSavings / 1000000).toFixed(1)}M`, 30, 140);
    doc.text(`Labor Efficiency: $${(calculationData.laborSavings / 1000).toFixed(0)}K`, 30, 150);
    doc.text(`Integration Gains: $${(calculationData.totalEfficiencyGains / 1000).toFixed(0)}K`, 30, 160);
    
    // Implementation Section
    doc.setFontSize(14);
    doc.text('Implementation Timeline', 20, 180);
    
    doc.setFontSize(11);
    doc.text('• Day 1-3: API Integration & Data Mapping', 30, 195);
    doc.text('• Day 4-7: Historical Data Analysis', 30, 205);
    doc.text('• Day 8-10: Team Training & Testing', 30, 215);
    doc.text('• Day 11-14: Go-Live & Optimization', 30, 225);
    
    // Footer
    doc.setFontSize(10);
    doc.setTextColor(94, 107, 124);
    doc.text('This analysis is based on industry benchmarks and actual client results.', 20, 260);
    doc.text('Contact UIP at sales@uip.com for a personalized consultation.', 20, 270);
    
    // Save the PDF
    doc.save(`UIP_ROI_Analysis_${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Track download
    if (typeof gtag !== 'undefined') {
        gtag('event', 'download', {
            'event_category': 'ROI Calculator',
            'event_label': 'PDF Report',
            'value': calculationData.annualSavings
        });
    }
}

// Share results functionality
function shareResults() {
    const shareData = {
        title: 'UIP ROI Calculator Results',
        text: `I could save $${(calculationData.annualSavings / 1000000).toFixed(1)}M annually with UIP's ocean freight automation platform!`,
        url: window.location.href
    };
    
    if (navigator.share) {
        navigator.share(shareData);
    } else {
        // Fallback: Copy to clipboard
        const shareText = `${shareData.text} Check it out: ${shareData.url}`;
        navigator.clipboard.writeText(shareText).then(() => {
            const button = document.getElementById('shareResults');
            const originalText = button.innerHTML;
            button.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg> Copied!';
            setTimeout(() => {
                button.innerHTML = originalText;
            }, 2000);
        });
    }
}