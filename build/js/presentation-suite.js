let currentPresentation = null;
let revealInstance = null;
let presentationData = {
 vesselCount: 50,
 companyName: 'Your Company',
 primaryColor: '#0A1628',
 accentColor: '#00D4AA'
};
document.addEventListener('DOMContentLoaded', function() {
 initializePresentationSelector();
 initializeCustomizer();
 setupEventListeners();
});
function initializePresentationSelector() {
 const selectButtons = document.querySelectorAll('.select-presentation');
 selectButtons.forEach(button => {
 button.addEventListener('click', function() {
 const presentationType = this.getAttribute('data-type');
 if (presentationType === 'vertical') {
 const verticalSelect = document.getElementById('verticalSelect');
 if (!verticalSelect.value) {
 alert('Please select an industry first');
 return;
 }
 loadPresentation('vertical-' + verticalSelect.value);
 } else {
 loadPresentation(presentationType);
 }
 });
 });
 const verticalSelect = document.getElementById('verticalSelect');
 verticalSelect.addEventListener('change', function() {
 const verticalButton = document.querySelector('.select-presentation[data-type="vertical"]');
 if (this.value) {
 verticalButton.disabled = false;
 verticalButton.textContent = `Launch ${this.options[this.selectedIndex].text} Presentation`;
 } else {
 verticalButton.disabled = true;
 verticalButton.textContent = 'Select Industry First';
 }
 });
}
function loadPresentation(type) {
 currentPresentation = type;
 document.getElementById('presentationSelector').style.display = 'none';
 document.getElementById('presentationContainer').style.display = 'block';
 hideAllSlides();
 showPresentationSlides(type);
 initializeReveal();
 document.getElementById('presentationControls').style.display = 'flex';
 setTimeout(() => {
 initializeCharts();
 initializeAnimations();
 }, 500);
}
function hideAllSlides() {
 document.querySelectorAll('.reveal .slides > section').forEach(section => {
 section.style.display = 'none';
 });
}
function showPresentationSlides(type) {
 let selector = '';
 switch(type) {
 case 'master-pitch':
 selector = '#masterPitchDeck';
 break;
 case 'executive-15':
 selector = '#executive15';
 break;
 case 'technical-30':
 selector = '#technical30';
 break;
 case 'demo-45':
 selector = '#demo45';
 break;
 case 'cfo-roi':
 selector = '#cfoRoi';
 break;
 case 'vertical-retail':
 case 'vertical-manufacturing':
 case 'vertical-food':
 case 'vertical-automotive':
 loadVerticalContent(type.split('-')[1]);
 selector = '#verticalPresentation';
 break;
 }
 if (selector) {
 const presentationSection = document.querySelector(selector);
 if (presentationSection) {
 presentationSection.style.display = 'block';
 }
 }
}
function initializeReveal() {
 if (revealInstance) {
 revealInstance.destroy();
 }
 revealInstance = new Reveal({
 hash: true,
 controls: false, // Using custom controls
 progress: true,
 center: false,
 transition: 'slide',
 backgroundTransition: 'fade',
 parallaxBackgroundImage: '',
 parallaxBackgroundSize: '',
 parallaxBackgroundHorizontal: null,
 parallaxBackgroundVertical: null
 });
 revealInstance.initialize();
 revealInstance.on('slidechanged', updateSlideCounter);
 updateSlideCounter();
}
function updateSlideCounter() {
 if (!revealInstance) return;
 const indices = revealInstance.getIndices();
 const totalSlides = revealInstance.getTotalSlides();
 document.getElementById('currentSlide').textContent = indices.h + 1;
 document.getElementById('totalSlides').textContent = totalSlides;
}
function initializeCharts() {
 const problemCtx = document.getElementById('problemChart');
 if (problemCtx) {
 new Chart(problemCtx.getContext('2d'), {
 type: 'doughnut',
 data: {
 labels: ['D&D Charges', 'Manual Processing', 'Integration Errors', 'Other'],
 datasets: [{
 data: [35, 40, 20, 5],
 backgroundColor: [
 '#FF6B35',
 '#FFA500',
 '#FFD700',
 '#E2E8F0'
 ]
 }]
 },
 options: {
 responsive: true,
 maintainAspectRatio: false,
 plugins: {
 legend: {
 position: 'right'
 },
 tooltip: {
 callbacks: {
 label: function(context) {
 return context.label + ': $' + (context.parsed * 0.2).toFixed(1) + 'B';
 }
 }
 }
 }
 }
 });
 }
 const marketCtx = document.getElementById('marketChart');
 if (marketCtx) {
 new Chart(marketCtx.getContext('2d'), {
 type: 'bar',
 data: {
 labels: ['TAM', 'SAM', 'SOM Year 1', 'SOM Year 3', 'SOM Year 5'],
 datasets: [{
 label: 'Market Opportunity ($B)',
 data: [72, 24, 0.5, 4.2, 12.5],
 backgroundColor: '#00D4AA',
 borderColor: '#00B894',
 borderWidth: 2
 }]
 },
 options: {
 responsive: true,
 maintainAspectRatio: false,
 scales: {
 y: {
 beginAtZero: true,
 ticks: {
 callback: function(value) {
 return '$' + value + 'B';
 }
 }
 }
 }
 }
 });
 }
 const competitionCtx = document.getElementById('competitionChart');
 if (competitionCtx) {
 new Chart(competitionCtx.getContext('2d'), {
 type: 'scatter',
 data: {
 datasets: [{
 label: 'UIP',
 data: [{x: 14, y: 87}],
 backgroundColor: '#00D4AA',
 pointRadius: 15
 }, {
 label: 'Legacy TMS',
 data: [{x: 180, y: 20}],
 backgroundColor: '#FF6B35',
 pointRadius: 10
 }, {
 label: 'Freight Forwarders',
 data: [{x: 90, y: 40}],
 backgroundColor: '#FFA500',
 pointRadius: 10
 }, {
 label: 'In-House Solutions',
 data: [{x: 365, y: 15}],
 backgroundColor: '#94A3B8',
 pointRadius: 10
 }]
 },
 options: {
 responsive: true,
 maintainAspectRatio: false,
 scales: {
 x: {
 title: {
 display: true,
 text: 'Implementation Time (Days)'
 }
 },
 y: {
 title: {
 display: true,
 text: 'D&D Prevention Rate (%)'
 }
 }
 }
 }
 });
 }
 const financialCtx = document.getElementById('financialProjections');
 if (financialCtx) {
 new Chart(financialCtx.getContext('2d'), {
 type: 'line',
 data: {
 labels: ['2024', '2025', '2026', '2027', '2028'],
 datasets: [{
 label: 'ARR ($M)',
 data: [12, 48, 156, 420, 980],
 borderColor: '#00D4AA',
 backgroundColor: 'rgba(0, 212, 170, 0.1)',
 borderWidth: 3,
 tension: 0.4,
 fill: true
 }, {
 label: 'Expenses ($M)',
 data: [8, 32, 89, 210, 441],
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
 }
 },
 scales: {
 y: {
 beginAtZero: true,
 ticks: {
 callback: function(value) {
 return '$' + value + 'M';
 }
 }
 }
 }
 }
 });
 }
 const cohortCtx = document.getElementById('cohortChart');
 if (cohortCtx) {
 new Chart(cohortCtx.getContext('2d'), {
 type: 'line',
 data: {
 labels: ['Month 0', 'Month 6', 'Month 12', 'Month 18', 'Month 24'],
 datasets: [{
 label: '2023 Cohort',
 data: [100, 100, 100, 100, 100],
 borderColor: '#00D4AA',
 borderWidth: 3
 }, {
 label: '2022 Cohort',
 data: [100, 100, 100, 100, 100],
 borderColor: '#0066FF',
 borderWidth: 3
 }, {
 label: 'Industry Average',
 data: [100, 88, 76, 65, 54],
 borderColor: '#FF6B35',
 borderWidth: 2,
 borderDash: [5, 5]
 }]
 },
 options: {
 responsive: true,
 maintainAspectRatio: false,
 scales: {
 y: {
 beginAtZero: true,
 max: 110,
 ticks: {
 callback: function(value) {
 return value + '%';
 }
 }
 }
 }
 }
 });
 }
}
function initializeAnimations() {
 animateCounters();
 animateTimelineSteps();
 animateProcessSteps();
}
function animateCounters() {
 const counters = document.querySelectorAll('[data-counter]');
 counters.forEach(counter => {
 const target = parseInt(counter.getAttribute('data-counter'));
 const duration = 2000;
 const increment = target / (duration / 16);
 let current = 0;
 const updateCounter = () => {
 current += increment;
 if (current >= target) {
 current = target;
 counter.textContent = formatCounter(current, counter);
 } else {
 counter.textContent = formatCounter(current, counter);
 requestAnimationFrame(updateCounter);
 }
 };
 const observer = new IntersectionObserver((entries) => {
 entries.forEach(entry => {
 if (entry.isIntersecting) {
 updateCounter();
 observer.unobserve(entry.target);
 }
 });
 });
 observer.observe(counter);
 });
}
function formatCounter(value, element) {
 const text = element.textContent;
 if (text.includes('$')) {
 return '$' + Math.round(value) + text.match(/[A-Z]/)[0];
 } else if (text.includes('%')) {
 return Math.round(value) + '%';
 } else {
 return Math.round(value).toString();
 }
}
function animateTimelineSteps() {
 const steps = document.querySelectorAll('.timeline-step');
 steps.forEach((step, index) => {
 step.style.opacity = '0';
 step.style.transform = 'translateY(20px)';
 setTimeout(() => {
 step.style.transition = 'all 0.5s ease';
 step.style.opacity = '1';
 step.style.transform = 'translateY(0)';
 }, index * 200);
 });
}
function animateProcessSteps() {
 const processSteps = document.querySelectorAll('.process-step');
 processSteps.forEach((step, index) => {
 const observer = new IntersectionObserver((entries) => {
 entries.forEach(entry => {
 if (entry.isIntersecting) {
 setTimeout(() => {
 entry.target.classList.add('animate');
 }, index * 300);
 observer.unobserve(entry.target);
 }
 });
 });
 observer.observe(step);
 });
}
function setupEventListeners() {
 document.getElementById('prevSlide').addEventListener('click', () => {
 if (revealInstance) revealInstance.prev();
 });
 document.getElementById('nextSlide').addEventListener('click', () => {
 if (revealInstance) revealInstance.next();
 });
 document.getElementById('fullscreenToggle').addEventListener('click', toggleFullscreen);
 document.getElementById('exitPresentation').addEventListener('click', exitPresentation);
 document.addEventListener('keydown', handleKeyboard);
 document.getElementById('downloadAll').addEventListener('click', downloadAllTemplates);
 document.getElementById('customizeTheme').addEventListener('click', () => {
 document.getElementById('themeCustomizer').classList.add('active');
 });
}
function handleKeyboard(e) {
 if (!revealInstance) return;
 switch(e.key) {
 case 'Escape':
 if (document.fullscreenElement) {
 document.exitFullscreen();
 } else {
 exitPresentation();
 }
 break;
 case 'f':
 case 'F':
 toggleFullscreen();
 break;
 }
}
function toggleFullscreen() {
 if (!document.fullscreenElement) {
 document.documentElement.requestFullscreen();
 } else {
 document.exitFullscreen();
 }
}
function exitPresentation() {
 if (confirm('Exit presentation?')) {
 if (revealInstance) {
 revealInstance.destroy();
 revealInstance = null;
 }
 document.getElementById('presentationContainer').style.display = 'none';
 document.getElementById('presentationSelector').style.display = 'flex';
 document.getElementById('presentationControls').style.display = 'none';
 currentPresentation = null;
 }
}
function initializeCustomizer() {
 document.getElementById('closeCustomizer').addEventListener('click', () => {
 document.getElementById('themeCustomizer').classList.remove('active');
 });
 document.getElementById('applyCustomization').addEventListener('click', applyCustomization);
}
function applyCustomization() {
 presentationData.primaryColor = document.getElementById('primaryColor').value;
 presentationData.accentColor = document.getElementById('accentColor').value;
 presentationData.companyName = document.getElementById('companyName').value || 'Your Company';
 presentationData.vesselCount = parseInt(document.getElementById('vesselCount').value) || 50;
 document.documentElement.style.setProperty('--custom-primary', presentationData.primaryColor);
 document.documentElement.style.setProperty('--custom-accent', presentationData.accentColor);
 updateVesselCalculations();
 document.getElementById('themeCustomizer').classList.remove('active');
 showNotification('Customization applied successfully!');
}
function updateVesselCalculations() {
 const vessels = presentationData.vesselCount;
 const perVesselSavings = 14.2; // $14.2M per vessel
 const totalSavings = vessels * perVesselSavings;
 const investment = vessels * 0.5; // $500K per vessel
 const roi = ((totalSavings - investment) / investment) * 100;
 const vesselElements = document.querySelectorAll('.your-numbers h3');
 vesselElements.forEach(el => {
 if (el.textContent.includes('Vessels')) {
 el.textContent = `For Your ${vessels} Vessels:`;
 }
 });
 const savingsElements = document.querySelectorAll('.value');
 savingsElements.forEach(el => {
 });
}
function downloadAllTemplates() {
 showNotification('Preparing download package...');
 setTimeout(() => {
 showNotification('Download package ready! Check your downloads folder.');
 }, 2000);
}
function loadVerticalContent(vertical) {
 const verticalData = {
 retail: {
 title: 'Ocean Freight Solutions for Retail',
 painPoints: ['Seasonal demand spikes', 'Inventory carrying costs', 'Multi-vendor complexity'],
 savings: '$67M annual savings for typical retailer'
 },
 manufacturing: {
 title: 'Manufacturing Supply Chain Optimization',
 painPoints: ['JIT delivery requirements', 'Component tracking', 'Production delays'],
 savings: '$42M annual savings for typical manufacturer'
 },
 food: {
 title: 'Food & Beverage Logistics Excellence',
 painPoints: ['Perishable goods', 'Temperature control', 'Compliance requirements'],
 savings: '$38M annual savings for typical F&B company'
 },
 automotive: {
 title: 'Automotive Supply Chain Precision',
 painPoints: ['Parts synchronization', 'Assembly line timing', 'Global sourcing'],
 savings: '$89M annual savings for typical OEM'
 }
 };
}
function showNotification(message) {
 const notification = document.createElement('div');
 notification.className = 'notification';
 notification.textContent = message;
 notification.style.cssText = `
 position: fixed;
 bottom: 20px;
 right: 20px;
 padding: 1rem 2rem;
 background: var(--uip-teal-500);
 color: white;
 border-radius: 8px;
 box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
 z-index: 1000;
 animation: slideIn 0.3s ease;
 `;
 document.body.appendChild(notification);
 setTimeout(() => {
 notification.style.animation = 'slideOut 0.3s ease';
 setTimeout(() => notification.remove(), 300);
 }, 3000);
}
const style = document.createElement('style');
style.textContent = `
 @keyframes slideIn {
 from { transform: translateX(100%); opacity: 0; }
 to { transform: translateX(0); opacity: 1; }
 }
 @keyframes slideOut {
 from { transform: translateX(0); opacity: 1; }
 to { transform: translateX(100%); opacity: 0; }
 }
 .process-step.animate {
 animation: fadeInUp 0.5s ease forwards;
 }
 @keyframes fadeInUp {
 from { opacity: 0; transform: translateY(20px); }
 to { opacity: 1; transform: translateY(0); }
 }
`;
document.head.appendChild(style);