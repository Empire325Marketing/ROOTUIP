let savingsChart, comparisonChart;
let calculationData = {};
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
const uipMetrics = {
 ddReduction: 0.87, // 87% reduction in D&D charges
 automationRate: 0.85, // 85% automation of manual tasks
 errorReduction: 0.90, // 90% reduction in errors (4% to 0.4%)
 disputeSuccessRate: 0.94, // 94% dispute success rate
 implementationDays: 14, // 14-day implementation
 yearlyGrowth: 0.15 // 15% additional savings year-over-year
};
document.addEventListener('DOMContentLoaded', function() {
 initializeSliders();
 initializeEventListeners();
 initializeCharts();
 calculateROI();
});
function initializeSliders() {
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
function initializeEventListeners() {
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
 const inputs = document.querySelectorAll('input[type="number"], select');
 inputs.forEach(input => {
 input.addEventListener('input', calculateROI);
 input.addEventListener('change', calculateROI);
 });
 document.getElementById('resultsForm').addEventListener('submit', handleFormSubmission);
 document.getElementById('downloadReport').addEventListener('click', generatePDFReport);
 document.getElementById('shareResults').addEventListener('click', shareResults);
}
function calculateROI() {
 const industryType = document.getElementById('industryType').value;
 const vessels = parseInt(document.getElementById('vesselCount').value) || 10;
 const containersPerVessel = parseInt(document.getElementById('containersPerVessel').value) || 5000;
 const monthlyDDCharges = parseFloat(document.getElementById('ddCharges').value) || 1200000;
 const weeklyManualHours = parseInt(document.getElementById('manualHours').value) || 160;
 const dataSources = parseInt(document.getElementById('dataSources').value) || 8;
 const avgDelayDays = parseFloat(document.getElementById('avgDelayDays').value) || 3.5;
 const currentDisputeRate = parseFloat(document.getElementById('disputeSuccessRate').value) / 100 || 0.67;
 const hourlyRate = parseFloat(document.getElementById('avgHourlyRate').value) || 65;
 const benchmark = industryBenchmarks[industryType];
 const totalContainers = vessels * containersPerVessel;
 const annualDDCharges = monthlyDDCharges * 12;
 const preventableCharges = annualDDCharges * uipMetrics.ddReduction;
 const improvedDisputeRecovery = annualDDCharges * 0.13 * (uipMetrics.disputeSuccessRate - currentDisputeRate);
 const totalDDSavings = preventableCharges + improvedDisputeRecovery;
 const annualManualHours = weeklyManualHours * 52;
 const automatedHours = annualManualHours * uipMetrics.automationRate;
 const laborSavings = automatedHours * hourlyRate;
 const errorCostPerContainer = 250; // Average cost per error
 const currentErrors = totalContainers * benchmark.errorRate;
 const reducedErrors = totalContainers * (benchmark.errorRate * (1 - uipMetrics.errorReduction));
 const errorReductionSavings = (currentErrors - reducedErrors) * errorCostPerContainer;
 const processingTimeSavings = totalContainers * 15 * (dataSources / 10); // $15 per container per data source complexity
 const totalEfficiencyGains = errorReductionSavings + processingTimeSavings;
 const annualSavings = totalDDSavings + laborSavings + totalEfficiencyGains;
 const annualInvestment = vessels * 500000; // $500K per vessel
 const roi = ((annualSavings - annualInvestment) / annualInvestment) * 100;
 const paybackDays = (annualInvestment / annualSavings) * 365;
 let fiveYearValue = 0;
 for (let year = 1; year <= 5; year++) {
 fiveYearValue += annualSavings * Math.pow(1 + uipMetrics.yearlyGrowth, year - 1);
 }
 fiveYearValue -= annualInvestment * 5; // Subtract 5 years of investment
 const dataQuality = Math.min(1, dataSources / 10);
 const confidenceInterval = 5 + (15 * (1 - dataQuality)); // 5-20% range
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
 updateResults();
 updateCharts();
 updateBenchmarks();
}
function updateResults() {
 const formatCurrency = (value) => {
 if (value >= 1000000) {
 return '$' + (value / 1000000).toFixed(1) + 'M';
 } else if (value >= 1000) {
 return '$' + (value / 1000).toFixed(0) + 'K';
 }
 return '$' + value.toFixed(0);
 };
 document.getElementById('annualSavings').textContent = formatCurrency(calculationData.annualSavings);
 document.getElementById('fiveYearValue').textContent = formatCurrency(calculationData.fiveYearValue);
 document.getElementById('roiPercentage').textContent = calculationData.roi.toFixed(0) + '%';
 document.getElementById('confidenceInterval').textContent = '±' + calculationData.confidenceInterval.toFixed(0) + '%';
 if (calculationData.paybackDays < 365) {
 document.getElementById('paybackPeriod').textContent = calculationData.paybackDays.toFixed(0) + ' days';
 } else {
 document.getElementById('paybackPeriod').textContent = (calculationData.paybackDays / 365).toFixed(1) + ' years';
 }
 document.getElementById('currentDDExposure').textContent = formatCurrency(calculationData.annualDDCharges);
 document.getElementById('preventableCharges').textContent = formatCurrency(calculationData.preventableCharges);
 document.getElementById('annualDDSavings').textContent = formatCurrency(calculationData.totalDDSavings);
 document.getElementById('currentManualHours').textContent = calculationData.annualManualHours.toLocaleString() + ' hrs/year';
 document.getElementById('automatedHours').textContent = calculationData.automatedHours.toFixed(0) + ' hrs/year';
 document.getElementById('annualLaborSavings').textContent = formatCurrency(calculationData.laborSavings);
 document.getElementById('errorReduction').textContent = formatCurrency(calculationData.errorReductionSavings);
 document.getElementById('processingGains').textContent = formatCurrency(calculationData.processingTimeSavings);
 document.getElementById('annualEfficiencyGains').textContent = formatCurrency(calculationData.totalEfficiencyGains);
 const savingsElement = document.getElementById('annualSavings');
 savingsElement.classList.remove('pulse');
 if (calculationData.roi > 200) {
 setTimeout(() => savingsElement.classList.add('pulse'), 100);
 }
}
function initializeCharts() {
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
function updateCharts() {
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
function updateBenchmarks() {
 const currentDDRate = (calculationData.annualDDCharges / (calculationData.totalContainers * 5000)) * 100; // Assuming $5000 avg container value
 const ddRateBar = document.getElementById('yourDDRate');
 const ddRateWidth = Math.min(100, (currentDDRate / 5) * 100); // Scale to 5% max
 ddRateBar.style.width = ddRateWidth + '%';
 ddRateBar.querySelector('.benchmark-value').textContent = currentDDRate.toFixed(1) + '%';
 const processingBar = document.getElementById('yourProcessingTime');
 const processingWidth = Math.min(100, (calculationData.weeklyManualHours / 300) * 100); // Scale to 300 hrs max
 processingBar.style.width = processingWidth + '%';
 processingBar.querySelector('.benchmark-value').textContent = calculationData.weeklyManualHours + ' hrs';
 if (currentDDRate > 3) {
 ddRateBar.style.backgroundColor = '#FF6B35';
 } else if (currentDDRate > 2) {
 ddRateBar.style.backgroundColor = '#FFA500';
 } else {
 ddRateBar.style.backgroundColor = '#00D4AA';
 }
}
function handleFormSubmission(e) {
 e.preventDefault();
 const formData = new FormData(e.target);
 const data = Object.fromEntries(formData);
 data.calculationData = calculationData;
 const submitButton = e.target.querySelector('button[type="submit"]');
 const originalText = submitButton.textContent;
 submitButton.textContent = 'Booking Your Call...';
 submitButton.disabled = true;
 setTimeout(() => {
 submitButton.textContent = '✓ Call Booked!';
 submitButton.style.backgroundColor = '#00D4AA';
 setTimeout(() => {
 submitButton.textContent = originalText;
 submitButton.disabled = false;
 submitButton.style.backgroundColor = '';
 e.target.reset();
 }, 3000);
 }, 1500);
 if (typeof gtag !== 'undefined') {
 gtag('event', 'conversion', {
 'event_category': 'ROI Calculator',
 'event_label': 'Strategy Call Booked',
 'value': calculationData.annualSavings
 });
 }
}
function generatePDFReport() {
 const { jsPDF } = window.jspdf;
 const doc = new jsPDF();
 doc.setFontSize(20);
 doc.setTextColor(10, 22, 40); // Navy
 doc.text('UIP ROI Analysis Report', 20, 20);
 doc.setFontSize(10);
 doc.setTextColor(94, 107, 124); // Gray
 doc.text(new Date().toLocaleDateString(), 20, 30);
 doc.setFontSize(12);
 doc.setTextColor(10, 22, 40);
 const vesselCount = document.getElementById('vesselCount').value;
 doc.text(`Analysis for: ${vesselCount} Vessels Operation`, 20, 45);
 doc.setFontSize(16);
 doc.text('Executive Summary', 20, 60);
 doc.setFontSize(12);
 doc.setTextColor(0, 212, 170); // Teal
 doc.text(`Total Annual Savings: $${(calculationData.annualSavings / 1000000).toFixed(1)}M`, 20, 75);
 doc.setTextColor(10, 22, 40);
 doc.text(`ROI: ${calculationData.roi.toFixed(0)}%`, 20, 85);
 doc.text(`Payback Period: ${calculationData.paybackDays.toFixed(0)} days`, 20, 95);
 doc.text(`5-Year Value: $${(calculationData.fiveYearValue / 1000000).toFixed(1)}M`, 20, 105);
 doc.setFontSize(14);
 doc.text('Savings Breakdown', 20, 125);
 doc.setFontSize(11);
 doc.text(`D&D Prevention: $${(calculationData.totalDDSavings / 1000000).toFixed(1)}M`, 30, 140);
 doc.text(`Labor Efficiency: $${(calculationData.laborSavings / 1000).toFixed(0)}K`, 30, 150);
 doc.text(`Integration Gains: $${(calculationData.totalEfficiencyGains / 1000).toFixed(0)}K`, 30, 160);
 doc.setFontSize(14);
 doc.text('Implementation Timeline', 20, 180);
 doc.setFontSize(11);
 doc.text('• Day 1-3: API Integration & Data Mapping', 30, 195);
 doc.text('• Day 4-7: Historical Data Analysis', 30, 205);
 doc.text('• Day 8-10: Team Training & Testing', 30, 215);
 doc.text('• Day 11-14: Go-Live & Optimization', 30, 225);
 doc.setFontSize(10);
 doc.setTextColor(94, 107, 124);
 doc.text('This analysis is based on industry benchmarks and actual client results.', 20, 260);
 doc.text('Contact UIP at sales@uip.com for a personalized consultation.', 20, 270);
 doc.save(`UIP_ROI_Analysis_${new Date().toISOString().split('T')[0]}.pdf`);
 if (typeof gtag !== 'undefined') {
 gtag('event', 'download', {
 'event_category': 'ROI Calculator',
 'event_label': 'PDF Report',
 'value': calculationData.annualSavings
 });
 }
}
function shareResults() {
 const shareData = {
 title: 'UIP ROI Calculator Results',
 text: `I could save $${(calculationData.annualSavings / 1000000).toFixed(1)}M annually with UIP's ocean freight automation platform!`,
 url: window.location.href
 };
 if (navigator.share) {
 navigator.share(shareData);
 } else {
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