class PresentationSuite {
 constructor() {
 this.currentAudience = null;
 this.currentPresentation = null;
 this.customData = {};
 this.currentSlideIndex = 0;
 this.timerStart = null;
 this.timerInterval = null;
 this.isFullscreen = false;
 this.init();
 }
 init() {
 this.setupEventListeners();
 this.loadSavedData();
 anime({
 targets: '.presentation-hub',
 opacity: [0, 1],
 translateY: [30, 0],
 duration: 800,
 easing: 'easeOutCubic'
 });
 }
 setupEventListeners() {
 document.querySelectorAll('.audience-card').forEach(card => {
 card.addEventListener('click', (e) => {
 this.selectAudience(card.dataset.audience);
 });
 });
 document.getElementById('companyName').addEventListener('input', (e) => {
 this.customData.companyName = e.target.value;
 this.saveCustomData();
 });
 document.getElementById('vesselCount').addEventListener('input', (e) => {
 this.customData.vesselCount = parseInt(e.target.value) || 50;
 this.updateROICalculations();
 this.saveCustomData();
 });
 document.getElementById('industryType').addEventListener('change', (e) => {
 this.customData.industryType = e.target.value;
 this.saveCustomData();
 });
 document.getElementById('annualRevenue').addEventListener('input', (e) => {
 this.customData.annualRevenue = e.target.value;
 this.saveCustomData();
 });
 document.getElementById('meetingDuration').addEventListener('change', (e) => {
 this.customData.meetingDuration = parseInt(e.target.value);
 this.saveCustomData();
 });
 document.getElementById('presenterName').addEventListener('input', (e) => {
 this.customData.presenterName = e.target.value;
 this.saveCustomData();
 });
 document.getElementById('startPresentation').addEventListener('click', () => {
 this.startPresentation();
 });
 document.getElementById('previewSlides').addEventListener('click', () => {
 this.previewSlides();
 });
 document.getElementById('downloadPDF').addEventListener('click', () => {
 this.downloadPDF();
 });
 document.getElementById('backToHub').addEventListener('click', () => {
 this.backToHub();
 });
 document.getElementById('toggleNotes').addEventListener('click', () => {
 this.toggleNotes();
 });
 document.getElementById('toggleFullscreen').addEventListener('click', () => {
 this.toggleFullscreen();
 });
 document.addEventListener('keydown', (e) => {
 this.handleKeyboard(e);
 });
 window.addEventListener('resize', () => {
 if (this.currentPresentation) {
 this.resizePresentation();
 }
 });
 }
 selectAudience(audience) {
 document.querySelectorAll('.audience-card').forEach(card => {
 card.classList.remove('selected');
 });
 const selectedCard = document.querySelector(`[data-audience="${audience}"]`);
 selectedCard.classList.add('selected');
 this.currentAudience = audience;
 anime({
 targets: selectedCard,
 scale: [1, 1.05, 1],
 duration: 300,
 easing: 'easeInOutCubic'
 });
 document.getElementById('startPresentation').disabled = false;
 this.updatePresentationPreview();
 }
 updatePresentationPreview() {
 if (!this.currentAudience || !window.presentationData) return;
 const template = window.presentationData.templates[this.currentAudience];
 if (template) {
 document.querySelector('.current-slide').textContent = '1';
 document.querySelector('.total-slides').textContent = template.slides.length;
 document.getElementById('currentTitle').textContent = template.title;
 }
 }
 updateROICalculations() {
 const vessels = this.customData.vesselCount || 50;
 const annualSavings = vessels * 14; // $14M per vessel
 const investment = vessels * 0.5; // $500K per vessel
 const roi = (annualSavings / investment).toFixed(1);
 const paybackDays = Math.round((investment / annualSavings) * 365);
 this.customData.annualSavings = annualSavings;
 this.customData.totalInvestment = investment;
 this.customData.roiMultiple = roi;
 this.customData.paybackDays = paybackDays;
 }
 startPresentation() {
 if (!this.currentAudience) {
 alert('Please select an audience first');
 return;
 }
 document.getElementById('presentationHub').style.display = 'none';
 document.getElementById('presentationViewer').style.display = 'block';
 this.loadPresentation();
 this.startTimer();
 this.initializeReveal();
 }
 loadPresentation() {
 if (!window.presentationData) {
 console.error('Presentation data not loaded');
 return;
 }
 const template = window.presentationData.templates[this.currentAudience];
 if (!template) {
 console.error('Template not found for audience:', this.currentAudience);
 return;
 }
 this.currentPresentation = template;
 document.getElementById('currentTitle').textContent = template.title;
 document.querySelector('.total-slides').textContent = template.slides.length;
 this.generateSlides();
 this.generateNavigator();
 }
 generateSlides() {
 const slidesContainer = document.getElementById('dynamicSlides');
 slidesContainer.innerHTML = '';
 this.currentPresentation.slides.forEach((slide, index) => {
 const slideElement = document.createElement('section');
 slideElement.dataset.slideId = slide.id;
 slideElement.dataset.notes = slide.notes || '';
 slideElement.classList.add(`slide-${slide.type}`);
 if (slide.type === 'title') {
 slideElement.classList.add('title-slide');
 }
 let content = this.customizeContent(slide.content);
 let title = this.customizeContent(slide.title);
 let subtitle = this.customizeContent(slide.subtitle || '');
 let slideHTML = '';
 if (slide.type === 'title') {
 slideHTML = `
 <img src="brand/logo.svg" alt="UIP" class="slide-logo">
 <h1 class="main-title">${title}</h1>
 ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
 `;
 } else {
 slideHTML = `
 <h2>${title}</h2>
 ${content}
 `;
 }
 slideElement.innerHTML = slideHTML;
 slidesContainer.appendChild(slideElement);
 });
 setTimeout(() => this.initializeCharts(), 100);
 }
 customizeContent(content) {
 if (!content) return '';
 return content
 .replace(/\[Customer Name\]/g, this.customData.companyName || '[Customer Name]')
 .replace(/\[Company\]/g, this.customData.companyName || '[Company]')
 .replace(/\[Number\]/g, this.customData.vesselCount || '50')
 .replace(/\[Annual Savings\]/g, this.customData.annualSavings || '700')
 .replace(/\[Total Investment\]/g, this.customData.totalInvestment || '25')
 .replace(/\[ROI Multiple\]/g, this.customData.roiMultiple || '28')
 .replace(/\[Payback\]/g, this.customData.paybackDays || '13')
 .replace(/\[Industry\]/g, this.customData.industryType || 'General')
 .replace(/\[Presenter Name\]/g, this.customData.presenterName || 'UIP Team');
 }
 generateNavigator() {
 const navigatorGrid = document.getElementById('navigatorGrid');
 navigatorGrid.innerHTML = '';
 this.currentPresentation.slides.forEach((slide, index) => {
 const thumbElement = document.createElement('div');
 thumbElement.classList.add('navigator-slide');
 thumbElement.dataset.slideIndex = index;
 thumbElement.innerHTML = `
 <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">
 ${index + 1}. ${slide.title}
 </div>
 <div style="font-size: 0.75rem; color: #64748B;">
 ${slide.type.replace('-', ' ').toUpperCase()}
 </div>
 `;
 thumbElement.addEventListener('click', () => {
 this.goToSlide(index);
 });
 navigatorGrid.appendChild(thumbElement);
 });
 }
 initializeReveal() {
 if (typeof Reveal === 'undefined') {
 console.error('Reveal.js not loaded');
 return;
 }
 Reveal.initialize({
 hash: true,
 controls: true,
 progress: true,
 center: true,
 transition: 'slide',
 backgroundTransition: 'fade',
 plugins: []
 });
 Reveal.on('slidechanged', (event) => {
 this.onSlideChanged(event.indexh);
 });
 this.onSlideChanged(0);
 }
 initializeCharts() {
 if (typeof Chart === 'undefined' || !window.presentationData) return;
 const charts = window.presentationData.charts;
 const tamCanvas = document.getElementById('tamChart');
 if (tamCanvas) {
 new Chart(tamCanvas, charts.tam);
 }
 const financialsCanvas = document.getElementById('financialsChart');
 if (financialsCanvas) {
 new Chart(financialsCanvas, charts.financials);
 }
 const growthCanvas = document.getElementById('growthChart');
 if (growthCanvas) {
 new Chart(growthCanvas, charts.growth);
 }
 const dashboardCanvas = document.getElementById('dashboardPreview');
 if (dashboardCanvas) {
 this.createDashboardChart(dashboardCanvas);
 }
 }
 createDashboardChart(canvas) {
 new Chart(canvas, {
 type: 'doughnut',
 data: {
 labels: ['Prevented D&D', 'Saved Hours', 'Won Disputes'],
 datasets: [{
 data: [2300000, 1840, 23],
 backgroundColor: ['#00D4AA', '#64748B', '#0A1628'],
 borderWidth: 0
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
 const label = context.label;
 const value = context.parsed;
 if (label === 'Prevented D&D') {
 return `${label}: $${(value/1000000).toFixed(1)}M`;
 } else if (label === 'Saved Hours') {
 return `${label}: ${value} hrs`;
 } else {
 return `${label}: ${value} disputes`;
 }
 }
 }
 }
 }
 }
 });
 }
 onSlideChanged(slideIndex) {
 this.currentSlideIndex = slideIndex;
 const progress = ((slideIndex + 1) / this.currentPresentation.slides.length) * 100;
 document.querySelector('.progress-fill').style.width = `${progress}%`;
 document.querySelector('.current-slide').textContent = slideIndex + 1;
 this.updateNotes(slideIndex);
 this.updateNavigator(slideIndex);
 this.animateSlideElements();
 }
 updateNotes(slideIndex) {
 const slide = this.currentPresentation.slides[slideIndex];
 const notesContent = document.getElementById('notesContent');
 if (slide && slide.notes) {
 notesContent.innerHTML = `
 <h4>Slide ${slideIndex + 1}: ${slide.title}</h4>
 <p>${slide.notes}</p>
 `;
 } else {
 notesContent.innerHTML = 'No notes available for this slide.';
 }
 }
 updateNavigator(slideIndex) {
 document.querySelectorAll('.navigator-slide').forEach((thumb, index) => {
 thumb.classList.toggle('current', index === slideIndex);
 });
 }
 animateSlideElements() {
 const currentSlide = document.querySelector('.reveal .present');
 if (currentSlide) {
 const elements = currentSlide.querySelectorAll('h1, h2, h3, p, ul, .metric-card, .chart-container');
 anime({
 targets: elements,
 opacity: [0, 1],
 translateY: [20, 0],
 duration: 600,
 delay: anime.stagger(100),
 easing: 'easeOutCubic'
 });
 }
 }
 goToSlide(index) {
 if (typeof Reveal !== 'undefined') {
 Reveal.slide(index);
 }
 }
 toggleNotes() {
 const notesPanel = document.getElementById('notesPanel');
 notesPanel.classList.toggle('active');
 const button = document.getElementById('toggleNotes');
 button.textContent = notesPanel.classList.contains('active') ? 'Hide Notes' : 'Notes';
 }
 toggleFullscreen() {
 if (!this.isFullscreen) {
 if (document.documentElement.requestFullscreen) {
 document.documentElement.requestFullscreen();
 }
 } else {
 if (document.exitFullscreen) {
 document.exitFullscreen();
 }
 }
 this.isFullscreen = !this.isFullscreen;
 document.getElementById('toggleFullscreen').textContent = 
 this.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
 }
 startTimer() {
 this.timerStart = Date.now();
 this.timerInterval = setInterval(() => {
 const elapsed = Date.now() - this.timerStart;
 const minutes = Math.floor(elapsed / 60000);
 const seconds = Math.floor((elapsed % 60000) / 1000);
 document.getElementById('presentationTimer').textContent = 
 `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
 }, 1000);
 }
 stopTimer() {
 if (this.timerInterval) {
 clearInterval(this.timerInterval);
 this.timerInterval = null;
 }
 }
 backToHub() {
 this.stopTimer();
 document.getElementById('presentationViewer').style.display = 'none';
 document.getElementById('presentationHub').style.display = 'block';
 this.currentPresentation = null;
 this.currentSlideIndex = 0;
 anime({
 targets: '.presentation-hub',
 opacity: [0, 1],
 translateY: [30, 0],
 duration: 600,
 easing: 'easeOutCubic'
 });
 }
 previewSlides() {
 if (!this.currentAudience) {
 alert('Please select an audience first');
 return;
 }
 this.generatePreviewWindow();
 }
 generatePreviewWindow() {
 const template = window.presentationData.templates[this.currentAudience];
 if (!template) return;
 const previewWindow = window.open('', '_blank', 'width=800,height=600');
 let previewHTML = `
 <!DOCTYPE html>
 <html>
 <head>
 <title>${template.title} - Preview</title>
 <style>
 body { font-family: Inter, sans-serif; padding: 2rem; background: #F8FAFB; }
 .slide-preview { 
 background: white; 
 margin: 2rem 0; 
 padding: 2rem; 
 border-radius: 8px; 
 box-shadow: 0 2px 8px rgba(0,0,0,0.1);
 }
 .slide-number { 
 background: #00D4AA; 
 color: white; 
 padding: 0.5rem 1rem; 
 border-radius: 4px; 
 font-weight: 600; 
 display: inline-block; 
 margin-bottom: 1rem; 
 }
 h1, h2 { color: #0A1628; }
 .notes { 
 background: #FFF8E1; 
 padding: 1rem; 
 border-radius: 4px; 
 margin-top: 1rem; 
 font-style: italic; 
 }
 </style>
 </head>
 <body>
 <h1>${template.title}</h1>
 <p><strong>Duration:</strong> ${template.duration} | <strong>Audience:</strong> ${template.audience}</p>
 `;
 template.slides.forEach((slide, index) => {
 const customTitle = this.customizeContent(slide.title);
 const customContent = this.customizeContent(slide.content);
 previewHTML += `
 <div class="slide-preview">
 <div class="slide-number">Slide ${index + 1}</div>
 <h2>${customTitle}</h2>
 ${customContent}
 ${slide.notes ? `<div class="notes"><strong>Notes:</strong> ${slide.notes}</div>` : ''}
 </div>
 `;
 });
 previewHTML += `
 </body>
 </html>
 `;
 previewWindow.document.write(previewHTML);
 previewWindow.document.close();
 }
 downloadPDF() {
 if (!this.currentAudience) {
 alert('Please select an audience first');
 return;
 }
 alert('PDF generation feature coming soon! Use your browser\'s print function to save as PDF.');
 }
 handleKeyboard(e) {
 if (document.getElementById('presentationViewer').style.display === 'none') return;
 switch(e.key) {
 case 'Escape':
 this.backToHub();
 break;
 case 'f':
 case 'F':
 if (e.ctrlKey || e.metaKey) {
 e.preventDefault();
 this.toggleFullscreen();
 }
 break;
 case 'n':
 case 'N':
 this.toggleNotes();
 break;
 case 'ArrowRight':
 case 'Space':
 if (typeof Reveal !== 'undefined') {
 Reveal.next();
 }
 break;
 case 'ArrowLeft':
 if (typeof Reveal !== 'undefined') {
 Reveal.prev();
 }
 break;
 }
 }
 resizePresentation() {
 if (typeof Reveal !== 'undefined') {
 Reveal.layout();
 }
 }
 saveCustomData() {
 localStorage.setItem('uip-presentation-data', JSON.stringify(this.customData));
 }
 loadSavedData() {
 const saved = localStorage.getItem('uip-presentation-data');
 if (saved) {
 this.customData = JSON.parse(saved);
 if (this.customData.companyName) {
 document.getElementById('companyName').value = this.customData.companyName;
 }
 if (this.customData.vesselCount) {
 document.getElementById('vesselCount').value = this.customData.vesselCount;
 }
 if (this.customData.industryType) {
 document.getElementById('industryType').value = this.customData.industryType;
 }
 if (this.customData.annualRevenue) {
 document.getElementById('annualRevenue').value = this.customData.annualRevenue;
 }
 if (this.customData.meetingDuration) {
 document.getElementById('meetingDuration').value = this.customData.meetingDuration;
 }
 if (this.customData.presenterName) {
 document.getElementById('presenterName').value = this.customData.presenterName;
 }
 this.updateROICalculations();
 }
 }
}
document.addEventListener('DOMContentLoaded', () => {
 window.presentationSuite = new PresentationSuite();
});
document.addEventListener('DOMContentLoaded', () => {
 const revealCSS = document.createElement('link');
 revealCSS.rel = 'stylesheet';
 revealCSS.href = 'https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.3.1/reveal.min.css';
 document.head.appendChild(revealCSS);
 const revealTheme = document.createElement('link');
 revealTheme.rel = 'stylesheet';
 revealTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.3.1/theme/white.min.css';
 document.head.appendChild(revealTheme);
});