const demoState = {
 currentRole: null,
 currentView: 'dashboard',
 tourActive: false,
 tourStep: 0,
 analytics: {
 startTime: Date.now(),
 interactions: [],
 viewedSections: new Set(),
 roleSelected: null
 }
};
const tourSteps = {
 executive: [
 {
 element: '.kpi-card[data-tooltip*="D&D"]',
 title: 'Real-Time Savings Tracking',
 text: 'See exactly how much you\'re saving on D&D charges. This month alone, you\'ve prevented $1.4M in unnecessary fees.',
 position: 'bottom'
 },
 {
 element: '.risk-analysis',
 title: 'Predictive Risk Analysis',
 text: 'Our AI analyzes patterns to predict D&D risks up to 14 days in advance, giving you time to prevent charges.',
 position: 'top'
 },
 {
 element: '.alerts-panel',
 title: 'Automated Exception Handling',
 text: 'Critical issues are automatically detected and resolved. Your team only deals with true exceptions.',
 position: 'left'
 },
 {
 element: '.demo-tab[data-view="tracking"]',
 title: 'Live Container Tracking',
 text: 'Track all your containers across carriers in real-time. Click to see the live tracking view.',
 position: 'bottom',
 action: 'click'
 }
 ],
 operations: [
 {
 element: '.alerts-panel',
 title: 'Your Daily Workflow Simplified',
 text: 'Start your day with prioritized alerts. UIP handles routine tasks so you can focus on exceptions.',
 position: 'left'
 },
 {
 element: '.demo-tab[data-view="prevention"]',
 title: 'Automated D&D Prevention',
 text: 'See how UIP automatically prevents charges before they occur. Click to explore the workflow.',
 position: 'bottom',
 action: 'click'
 },
 {
 element: '.workflow-timeline',
 title: 'Intelligent Automation',
 text: 'Each step is automated based on your business rules. Manual intervention only when needed.',
 position: 'right'
 }
 ],
 it: [
 {
 element: '.demo-tab[data-view="integrations"]',
 title: 'Seamless Integration',
 text: 'UIP connects to your existing systems without disruption. Click to see live integration status.',
 position: 'bottom',
 action: 'click'
 },
 {
 element: '.integration-card',
 title: 'Real-Time Data Flow',
 text: 'Monitor data flow and system health in real-time. 99.9% uptime guaranteed.',
 position: 'right'
 },
 {
 element: '.demo-tab[data-view="documents"]',
 title: 'Intelligent Document Processing',
 text: 'See how AI processes documents 900x faster than manual entry.',
 position: 'bottom',
 action: 'click'
 }
 ]
};
document.addEventListener('DOMContentLoaded', function() {
 initializeRoleSelection();
 initializeDemoInterface();
 initializeCharts();
 setupEventListeners();
 trackAnalytics('demo_loaded');
});
function initializeRoleSelection() {
 const roleCards = document.querySelectorAll('.role-select-btn');
 const skipBtn = document.getElementById('skipTour');
 roleCards.forEach(btn => {
 btn.addEventListener('click', function() {
 const role = this.getAttribute('data-role');
 selectRole(role, true);
 });
 });
 skipBtn.addEventListener('click', function() {
 selectRole('explorer', false);
 });
}
function selectRole(role, startTour) {
 demoState.currentRole = role;
 demoState.analytics.roleSelected = role;
 document.getElementById('userRole').textContent = getRoleTitle(role);
 document.querySelector('.role-selection').classList.remove('active');
 document.querySelector('.demo-interface').classList.add('active');
 trackAnalytics('role_selected', { role: role });
 if (startTour && tourSteps[role]) {
 setTimeout(() => startGuidedTour(role), 500);
 }
 customizeForRole(role);
}
function getRoleTitle(role) {
 const titles = {
 executive: 'Executive View',
 operations: 'Operations View',
 it: 'IT/Technical View',
 explorer: 'Explorer Mode'
 };
 return titles[role] || 'Demo Mode';
}
function customizeForRole(role) {
 if (role === 'executive') {
 document.querySelectorAll('.technical-detail').forEach(el => el.style.display = 'none');
 } else if (role === 'operations') {
 switchView('prevention');
 } else if (role === 'it') {
 switchView('integrations');
 }
}
function startGuidedTour(role) {
 const steps = tourSteps[role];
 if (!steps || steps.length === 0) return;
 demoState.tourActive = true;
 demoState.tourStep = 0;
 document.getElementById('tourOverlay').classList.add('active');
 document.getElementById('tourTotal').textContent = steps.length;
 showTourStep(steps[0], 1);
}
function showTourStep(step, stepNumber) {
 const element = document.querySelector(step.element);
 if (!element) return;
 const highlight = document.getElementById('tourHighlight');
 const tooltip = document.getElementById('tourTooltip');
 const rect = element.getBoundingClientRect();
 highlight.style.top = rect.top - 5 + 'px';
 highlight.style.left = rect.left - 5 + 'px';
 highlight.style.width = rect.width + 10 + 'px';
 highlight.style.height = rect.height + 10 + 'px';
 positionTooltip(tooltip, rect, step.position);
 document.getElementById('tooltipTitle').textContent = step.title;
 document.getElementById('tooltipText').textContent = step.text;
 document.getElementById('tourStep').textContent = stepNumber;
 if (step.action === 'click') {
 element.addEventListener('click', handleTourAction, { once: true });
 }
}
function positionTooltip(tooltip, targetRect, position) {
 const tooltipRect = tooltip.getBoundingClientRect();
 let top, left;
 switch (position) {
 case 'bottom':
 top = targetRect.bottom + 10;
 left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
 break;
 case 'top':
 top = targetRect.top - tooltipRect.height - 10;
 left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
 break;
 case 'left':
 top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
 left = targetRect.left - tooltipRect.width - 10;
 break;
 case 'right':
 top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
 left = targetRect.right + 10;
 break;
 }
 top = Math.max(10, Math.min(top, window.innerHeight - tooltipRect.height - 10));
 left = Math.max(10, Math.min(left, window.innerWidth - tooltipRect.width - 10));
 tooltip.style.top = top + 'px';
 tooltip.style.left = left + 'px';
}
function handleTourAction() {
 setTimeout(() => nextTourStep(), 1000);
}
function nextTourStep() {
 const role = demoState.currentRole;
 const steps = tourSteps[role];
 demoState.tourStep++;
 if (demoState.tourStep >= steps.length) {
 endTour();
 } else {
 showTourStep(steps[demoState.tourStep], demoState.tourStep + 1);
 }
}
function endTour() {
 demoState.tourActive = false;
 document.getElementById('tourOverlay').classList.remove('active');
 trackAnalytics('tour_completed', { role: demoState.currentRole });
 setTimeout(() => {
 document.getElementById('ctaSidebar').classList.add('active');
 }, 1000);
}
function initializeDemoInterface() {
 const tabs = document.querySelectorAll('.demo-tab');
 tabs.forEach(tab => {
 tab.addEventListener('click', function() {
 const view = this.getAttribute('data-view');
 switchView(view);
 });
 });
 document.getElementById('demoHelp').addEventListener('click', function() {
 if (demoState.currentRole && tourSteps[demoState.currentRole]) {
 startGuidedTour(demoState.currentRole);
 }
 });
 document.getElementById('demoExit').addEventListener('click', showExitModal);
 document.getElementById('nextStepBtn').addEventListener('click', nextTourStep);
 document.getElementById('skipTourBtn').addEventListener('click', endTour);
}
function switchView(viewName) {
 document.querySelectorAll('.demo-tab').forEach(tab => {
 tab.classList.toggle('active', tab.getAttribute('data-view') === viewName);
 });
 document.querySelectorAll('.demo-view').forEach(view => {
 view.classList.toggle('active', view.id === viewName + 'View');
 });
 demoState.currentView = viewName;
 demoState.analytics.viewedSections.add(viewName);
 trackAnalytics('view_changed', { view: viewName });
 initializeViewFeatures(viewName);
}
function initializeViewFeatures(viewName) {
 switch (viewName) {
 case 'tracking':
 initializeTrackingMap();
 animateVesselMovement();
 break;
 case 'prevention':
 startPreventionAnimation();
 break;
 case 'documents':
 startDocumentProcessing();
 break;
 case 'disputes':
 setupDisputeDemo();
 break;
 }
}
function initializeCharts() {
 const sparkCtx = document.getElementById('ddSparkline');
 if (sparkCtx) {
 new Chart(sparkCtx.getContext('2d'), {
 type: 'line',
 data: {
 labels: Array.from({length: 30}, (_, i) => i + 1),
 datasets: [{
 data: generateSparklineData(),
 borderColor: '#00D4AA',
 borderWidth: 2,
 fill: false,
 tension: 0.4,
 pointRadius: 0
 }]
 },
 options: {
 responsive: true,
 maintainAspectRatio: false,
 plugins: {
 legend: { display: false }
 },
 scales: {
 x: { display: false },
 y: { display: false }
 }
 }
 });
 }
 const riskCtx = document.getElementById('riskChart');
 if (riskCtx) {
 new Chart(riskCtx.getContext('2d'), {
 type: 'bar',
 data: {
 labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
 datasets: [{
 label: 'High Risk',
 data: [2, 3, 1, 4, 2, 3, 5],
 backgroundColor: '#FF6B35'
 }, {
 label: 'Medium Risk',
 data: [5, 8, 6, 9, 7, 6, 8],
 backgroundColor: '#FFA500'
 }, {
 label: 'Low Risk',
 data: [15, 12, 18, 14, 16, 20, 17],
 backgroundColor: '#00D4AA'
 }]
 },
 options: {
 responsive: true,
 maintainAspectRatio: false,
 scales: {
 x: { stacked: true },
 y: { stacked: true }
 }
 }
 });
 }
}
function generateSparklineData() {
 return Array.from({length: 30}, () => 
 1200000 + Math.random() * 400000 - 200000
 );
}
function initializeTrackingMap() {
 mapboxgl.accessToken = 'pk.eyJ1IjoiZGVtby11aXAiLCJhIjoiY2xwMHZ3NGRmMDRmYTJrcXN5ZHB6OHVzNyJ9.demo'; // Demo token
 const map = new mapboxgl.Map({
 container: 'trackingMap',
 style: 'mapbox://styles/mapbox/dark-v10',
 center: [-118.2437, 34.0522], // LA Port
 zoom: 3
 });
 const vessels = [
 { 
 id: 'msc-geneva',
 coords: [-140, 35],
 name: 'MSC GENEVA',
 status: 'delayed'
 },
 {
 id: 'ever-given',
 coords: [-73.5, 40.7],
 name: 'EVER GIVEN',
 status: 'on-time'
 }
 ];
 vessels.forEach(vessel => {
 const el = document.createElement('div');
 el.className = `vessel-marker ${vessel.status}`;
 new mapboxgl.Marker(el)
 .setLngLat(vessel.coords)
 .setPopup(new mapboxgl.Popup().setHTML(
 `<h4>${vessel.name}</h4>
 <p>Status: ${vessel.status}</p>`
 ))
 .addTo(map);
 });
 map.on('load', () => {
 map.addSource('route', {
 'type': 'geojson',
 'data': {
 'type': 'Feature',
 'properties': {},
 'geometry': {
 'type': 'LineString',
 'coordinates': [
 [121.4737, 31.2304], // Shanghai
 [-140, 35], // Current position
 [-118.2437, 34.0522] // LA
 ]
 }
 }
 });
 map.addLayer({
 'id': 'route',
 'type': 'line',
 'source': 'route',
 'layout': {
 'line-join': 'round',
 'line-cap': 'round'
 },
 'paint': {
 'line-color': '#FF6B35',
 'line-width': 3,
 'line-dasharray': [2, 2]
 }
 });
 });
}
function animateVesselMovement() {
 const vesselItems = document.querySelectorAll('.vessel-item');
 vesselItems.forEach(item => {
 item.addEventListener('click', function() {
 vesselItems.forEach(v => v.classList.remove('active'));
 this.classList.add('active');
 const vesselId = this.getAttribute('data-vessel');
 const popup = document.getElementById('vesselPopup');
 popup.style.display = 'block';
 setTimeout(() => popup.classList.add('visible'), 100);
 });
 });
}
function startPreventionAnimation() {
 const steps = document.querySelectorAll('.workflow-step');
 let currentStep = 0;
 function animateStep() {
 if (currentStep > 0) {
 steps[currentStep - 1].classList.remove('active');
 }
 if (currentStep < steps.length) {
 steps[currentStep].classList.add('active');
 const stepContent = steps[currentStep].querySelector('.step-demo');
 if (stepContent) {
 animateStepContent(stepContent);
 }
 currentStep++;
 setTimeout(animateStep, 3000);
 } else {
 currentStep = 0;
 setTimeout(animateStep, 2000);
 }
 }
 animateStep();
}
function animateStepContent(content) {
 const items = content.querySelectorAll('.detection-item, .action-item, .notif-item');
 items.forEach((item, index) => {
 setTimeout(() => {
 item.classList.add('animate');
 }, index * 500);
 });
}
function startDocumentProcessing() {
 const manualSteps = document.querySelectorAll('.manual-process .process-step');
 const autoSteps = document.querySelectorAll('.automated-process .process-step');
 manualSteps.forEach((step, index) => {
 setTimeout(() => {
 step.classList.add('active');
 }, index * 1500);
 });
 setTimeout(() => {
 autoSteps.forEach((step, index) => {
 setTimeout(() => {
 step.classList.add('completed');
 }, index * 200);
 });
 }, 2000);
 simulateDocumentStream();
}
function simulateDocumentStream() {
 const processingDoc = document.querySelector('.doc-item.processing');
 if (!processingDoc) return;
 const progressBar = processingDoc.querySelector('.progress-fill');
 let progress = 0;
 const interval = setInterval(() => {
 progress += 10;
 progressBar.style.width = progress + '%';
 if (progress >= 100) {
 clearInterval(interval);
 processingDoc.classList.remove('processing');
 processingDoc.classList.add('completed');
 setTimeout(() => {
 createNewProcessingDoc();
 }, 2000);
 }
 }, 200);
}
function createNewProcessingDoc() {
 const stream = document.querySelector('.document-stream');
 const newDoc = document.createElement('div');
 newDoc.className = 'doc-item processing';
 newDoc.innerHTML = `
 <div class="doc-icon">📄</div>
 <div class="doc-info">
 <div class="doc-name">EVERGREEN_B/L_${Math.floor(Math.random() * 100000)}.pdf</div>
 <div class="doc-status">Processing...</div>
 </div>
 <div class="doc-progress">
 <div class="progress-bar">
 <div class="progress-fill" style="width: 0%"></div>
 </div>
 </div>
 `;
 stream.insertBefore(newDoc, stream.firstChild);
 setTimeout(() => simulateDocumentStream(), 500);
}
function updateIntegrationMetrics() {
 setInterval(() => {
 const metrics = document.querySelectorAll('.integration-card .metric-value');
 metrics.forEach(metric => {
 const current = parseInt(metric.textContent);
 const variation = Math.random() * 10 - 5; // ±5% variation
 const newValue = Math.max(0, current + Math.floor(current * variation / 100));
 metric.textContent = newValue.toLocaleString();
 });
 }, 3000);
}
function setupDisputeDemo() {
 const demoBtn = document.getElementById('startDisputeDemo');
 demoBtn.addEventListener('click', startDisputeDemo);
}
function startDisputeDemo() {
 const stages = document.querySelectorAll('.dispute-stage');
 let currentStage = 0;
 stages.forEach(stage => {
 stage.classList.remove('active', 'complete');
 });
 function animateStage() {
 if (currentStage > 0) {
 stages[currentStage - 1].classList.remove('active');
 stages[currentStage - 1].classList.add('complete');
 }
 if (currentStage < stages.length) {
 stages[currentStage].classList.add('active');
 switch (currentStage) {
 case 1: // Analysis
 animateAnalysis();
 break;
 case 2: // Filing
 prepareDispute();
 break;
 case 3: // Resolution
 showResolution();
 break;
 }
 currentStage++;
 setTimeout(animateStage, 3000);
 }
 }
 animateStage();
}
function animateAnalysis() {
 const items = document.querySelectorAll('.analysis-item');
 items.forEach((item, index) => {
 setTimeout(() => {
 item.classList.add('complete');
 }, index * 500);
 });
}
function prepareDispute() {
 const fileBtn = document.querySelector('.file-dispute-btn');
 fileBtn.addEventListener('click', function() {
 this.textContent = 'Filing...';
 this.disabled = true;
 setTimeout(() => {
 this.textContent = '✓ Filed';
 this.style.backgroundColor = '#00D4AA';
 }, 1500);
 });
}
function showResolution() {
 const resolution = document.querySelector('.resolution-success');
 resolution.classList.add('animate');
}
function setupCTASidebar() {
 const toggle = document.getElementById('ctaToggle');
 const sidebar = document.getElementById('ctaSidebar');
 toggle.addEventListener('click', function() {
 sidebar.classList.toggle('expanded');
 });
 document.getElementById('bookLiveDemo').addEventListener('click', function() {
 trackAnalytics('demo_cta_clicked', { type: 'book_demo' });
 window.location.href = '/book-demo';
 });
}
function showExitModal() {
 const modal = document.getElementById('exitModal');
 modal.classList.add('active');
 trackAnalytics('exit_intent_shown');
}
function setupExitModal() {
 document.getElementById('closeExitModal').addEventListener('click', function() {
 document.getElementById('exitModal').classList.remove('active');
 });
 document.getElementById('scheduleDemoExit').addEventListener('click', function() {
 trackAnalytics('exit_cta_clicked', { type: 'schedule_demo' });
 window.location.href = '/book-demo';
 });
 document.getElementById('downloadGuideExit').addEventListener('click', function() {
 trackAnalytics('exit_cta_clicked', { type: 'download_guide' });
 });
}
function setupEventListeners() {
 updateIntegrationMetrics();
 setupCTASidebar();
 setupExitModal();
 window.addEventListener('beforeunload', function() {
 const timeSpent = Date.now() - demoState.analytics.startTime;
 trackAnalytics('demo_session_end', {
 timeSpent: timeSpent,
 viewedSections: Array.from(demoState.analytics.viewedSections),
 interactions: demoState.analytics.interactions.length
 });
 });
}
function trackAnalytics(event, data = {}) {
 demoState.analytics.interactions.push({
 event: event,
 data: data,
 timestamp: Date.now()
 });
 if (typeof gtag !== 'undefined') {
 gtag('event', event, {
 event_category: 'Interactive Demo',
 ...data
 });
 }
 console.log('Analytics:', event, data);
}
function animateValue(element, start, end, duration) {
 const range = end - start;
 const increment = range / (duration / 16);
 let current = start;
 const timer = setInterval(() => {
 current += increment;
 if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
 current = end;
 clearInterval(timer);
 }
 element.textContent = formatValue(current);
 }, 16);
}
function formatValue(value) {
 if (value >= 1000000) {
 return '$' + (value / 1000000).toFixed(1) + 'M';
 } else if (value >= 1000) {
 return '$' + (value / 1000).toFixed(0) + 'K';
 }
 return '$' + Math.round(value);
}