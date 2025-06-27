class PresentationDeck {
 constructor() {
 this.currentSlide = 1;
 this.totalSlides = 20;
 this.presentationData = {};
 this.isPresenting = false;
 this.timer = null;
 this.startTime = null;
 this.charts = {};
 this.animations = {};
 this.init();
 }
 init() {
 this.loadPresentation();
 this.setupEventListeners();
 this.initializeCharts();
 this.hideLoadingScreen();
 }
 hideLoadingScreen() {
 setTimeout(() => {
 const loadingScreen = document.getElementById('loadingScreen');
 if (loadingScreen) {
 loadingScreen.classList.add('hidden');
 }
 }, 1500);
 }
 loadPresentation() {
 const prospectName = localStorage.getItem('prospectName') || '';
 const vesselCount = localStorage.getItem('vesselCount') || '50';
 const industryType = localStorage.getItem('industryType') || 'general';
 const annualRevenue = localStorage.getItem('annualRevenue') || '';
 this.presentationData = {
 prospectName,
 vesselCount: parseInt(vesselCount),
 industryType,
 annualRevenue,
 annualSavings: parseInt(vesselCount) * 14.2, // $14.2M per vessel
 roiPercentage: 347,
 implementationDays: 2
 };
 this.updateSlideContent();
 }
 updateSlideContent() {
 if (this.presentationData.prospectName) {
 const companyElements = document.querySelectorAll('.prospect-name');
 companyElements.forEach(el => {
 el.textContent = this.presentationData.prospectName;
 });
 }
 const vesselElements = document.querySelectorAll('.vessel-count');
 vesselElements.forEach(el => {
 el.textContent = this.presentationData.vesselCount;
 });
 const savingsElements = document.querySelectorAll('.annual-savings');
 savingsElements.forEach(el => {
 el.textContent = `$${this.presentationData.annualSavings.toFixed(1)}M`;
 });
 }
 setupEventListeners() {
 const selectBtns = document.querySelectorAll('.select-btn');
 selectBtns.forEach(btn => {
 btn.addEventListener('click', (e) => {
 const presentationType = btn.dataset.presentation;
 this.startPresentation(presentationType);
 });
 });
 const inputs = ['prospectName', 'vesselCount', 'industryType', 'annualRevenue'];
 inputs.forEach(id => {
 const input = document.getElementById(id);
 if (input) {
 input.addEventListener('change', (e) => {
 localStorage.setItem(id, e.target.value);
 this.loadPresentation();
 });
 }
 });
 this.setupPresentationControls();
 document.addEventListener('keydown', (e) => this.handleKeyPress(e));
 const exitBtn = document.querySelector('.exit-presentation');
 if (exitBtn) {
 exitBtn.addEventListener('click', () => this.exitPresentation());
 }
 }
 setupPresentationControls() {
 const prevBtn = document.querySelector('.prev-slide');
 const nextBtn = document.querySelector('.next-slide');
 if (prevBtn) prevBtn.addEventListener('click', () => this.previousSlide());
 if (nextBtn) nextBtn.addEventListener('click', () => this.nextSlide());
 const thumbnails = document.querySelectorAll('.slide-thumbnail');
 thumbnails.forEach(thumb => {
 thumb.addEventListener('click', () => {
 const slideNum = parseInt(thumb.dataset.slide);
 this.goToSlide(slideNum);
 });
 });
 const playBtn = document.querySelector('.play-pause');
 const fullscreenBtn = document.querySelector('.fullscreen');
 const notesBtn = document.querySelector('.toggle-notes');
 if (playBtn) playBtn.addEventListener('click', () => this.toggleAutoPlay());
 if (fullscreenBtn) fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
 if (notesBtn) notesBtn.addEventListener('click', () => this.toggleNotes());
 }
 startPresentation(type) {
 const dashboard = document.getElementById('presentationDashboard');
 const viewer = document.getElementById('presentationViewer');
 if (dashboard) dashboard.style.display = 'none';
 if (viewer) viewer.style.display = 'block';
 this.isPresenting = true;
 this.currentSlide = 1;
 this.startTimer();
 this.showSlide(1);
 this.loadPresentationType(type);
 }
 loadPresentationType(type) {
 const slideContainer = document.getElementById('slidesContainer');
 if (!slideContainer) return;
 if (type === 'master') {
 this.totalSlides = 20;
 return;
 }
 if (typeof presentationTemplates !== 'undefined' && presentationTemplates[type]) {
 const template = presentationTemplates[type];
 this.totalSlides = template.slides.length;
 slideContainer.innerHTML = '';
 template.slides.forEach((slide, index) => {
 const slideElement = document.createElement('div');
 slideElement.className = 'slide';
 slideElement.setAttribute('data-slide', index + 1);
 slideElement.setAttribute('data-notes', slide.notes || '');
 slideElement.innerHTML = `
 <div class="slide-content">
 ${slide.content}
 </div>
 `;
 slideContainer.appendChild(slideElement);
 });
 const titleElement = document.querySelector('.presentation-title');
 if (titleElement) {
 titleElement.textContent = template.title;
 }
 }
 }
 showSlide(slideNum) {
 const slides = document.querySelectorAll('.slide');
 slides.forEach(slide => {
 slide.classList.remove('active');
 });
 const currentSlide = document.querySelector(`[data-slide="${slideNum}"]`);
 if (currentSlide) {
 currentSlide.classList.add('active');
 this.animateSlide(slideNum);
 this.updateNavigation(slideNum);
 this.updatePresenterNotes(slideNum);
 }
 this.currentSlide = slideNum;
 }
 animateSlide(slideNum) {
 const slide = document.querySelector(`[data-slide="${slideNum}"]`);
 if (!slide) return;
 const counters = slide.querySelectorAll('.counter');
 counters.forEach(counter => {
 const target = parseFloat(counter.dataset.target);
 const decimals = parseInt(counter.dataset.decimals) || 0;
 anime({
 targets: counter,
 textContent: [0, target],
 duration: 2000,
 easing: 'easeInOutExpo',
 round: decimals === 0 ? 1 : Math.pow(10, decimals),
 update: function(anim) {
 if (decimals > 0) {
 counter.textContent = parseFloat(counter.textContent).toFixed(decimals);
 }
 }
 });
 });
 if (this.charts[`slide${slideNum}`]) {
 this.charts[`slide${slideNum}`].update();
 }
 anime({
 targets: slide.querySelectorAll('.animate-in'),
 opacity: [0, 1],
 translateY: [30, 0],
 delay: anime.stagger(100),
 duration: 800,
 easing: 'easeOutCubic'
 });
 }
 updateNavigation(slideNum) {
 const current = document.querySelector('.slide-current');
 const total = document.querySelector('.slide-total');
 if (current) current.textContent = slideNum;
 if (total) total.textContent = this.totalSlides;
 const progress = (slideNum / this.totalSlides) * 100;
 const progressBar = document.querySelector('.slide-progress-fill');
 if (progressBar) progressBar.style.width = `${progress}%`;
 const thumbnails = document.querySelectorAll('.slide-thumbnail');
 thumbnails.forEach(thumb => {
 thumb.classList.remove('active');
 if (parseInt(thumb.dataset.slide) === slideNum) {
 thumb.classList.add('active');
 }
 });
 const prevBtn = document.querySelector('.prev-slide');
 const nextBtn = document.querySelector('.next-slide');
 if (prevBtn) prevBtn.disabled = slideNum === 1;
 if (nextBtn) nextBtn.disabled = slideNum === this.totalSlides;
 }
 updatePresenterNotes(slideNum) {
 const slide = document.querySelector(`[data-slide="${slideNum}"]`);
 const notesPanel = document.querySelector('.presenter-notes');
 if (slide && notesPanel) {
 const notes = slide.dataset.notes || 'No presenter notes for this slide.';
 notesPanel.querySelector('.notes-content').textContent = notes;
 }
 }
 previousSlide() {
 if (this.currentSlide > 1) {
 this.showSlide(this.currentSlide - 1);
 }
 }
 nextSlide() {
 if (this.currentSlide < this.totalSlides) {
 this.showSlide(this.currentSlide + 1);
 }
 }
 goToSlide(slideNum) {
 if (slideNum >= 1 && slideNum <= this.totalSlides) {
 this.showSlide(slideNum);
 }
 }
 handleKeyPress(e) {
 if (!this.isPresenting) return;
 switch(e.key) {
 case 'ArrowLeft':
 this.previousSlide();
 break;
 case 'ArrowRight':
 case ' ':
 this.nextSlide();
 break;
 case 'Escape':
 this.exitPresentation();
 break;
 case 'f':
 this.toggleFullscreen();
 break;
 case 'n':
 this.toggleNotes();
 break;
 }
 }
 toggleAutoPlay() {
 const playBtn = document.querySelector('.play-pause');
 const isPlaying = playBtn.classList.contains('playing');
 if (isPlaying) {
 clearInterval(this.autoPlayInterval);
 playBtn.classList.remove('playing');
 playBtn.innerHTML = '▶';
 } else {
 this.autoPlayInterval = setInterval(() => {
 if (this.currentSlide < this.totalSlides) {
 this.nextSlide();
 } else {
 this.toggleAutoPlay();
 }
 }, 5000);
 playBtn.classList.add('playing');
 playBtn.innerHTML = '⏸';
 }
 }
 toggleFullscreen() {
 if (!document.fullscreenElement) {
 document.documentElement.requestFullscreen();
 } else {
 document.exitFullscreen();
 }
 }
 toggleNotes() {
 const notesPanel = document.querySelector('.presenter-notes');
 if (notesPanel) {
 notesPanel.classList.toggle('hidden');
 }
 }
 startTimer() {
 this.startTime = Date.now();
 this.updateTimer();
 this.timerInterval = setInterval(() => {
 this.updateTimer();
 }, 1000);
 }
 updateTimer() {
 const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
 const minutes = Math.floor(elapsed / 60);
 const seconds = elapsed % 60;
 const timer = document.querySelector('.presentation-timer');
 if (timer) {
 timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
 }
 }
 exitPresentation() {
 if (this.timerInterval) clearInterval(this.timerInterval);
 if (this.autoPlayInterval) clearInterval(this.autoPlayInterval);
 const dashboard = document.getElementById('presentationDashboard');
 const viewer = document.getElementById('presentationViewer');
 if (dashboard) dashboard.style.display = 'block';
 if (viewer) viewer.style.display = 'none';
 this.isPresenting = false;
 if (document.fullscreenElement) {
 document.exitFullscreen();
 }
 }
 initializeCharts() {
 this.initMarketSizeChart();
 this.initSavingsChart();
 this.initCompetitionChart();
 this.initFinancialsChart();
 }
 initMarketSizeChart() {
 const canvas = document.getElementById('marketSizeChart');
 if (!canvas) return;
 const ctx = canvas.getContext('2d');
 this.charts.slide5 = new Chart(ctx, {
 type: 'bar',
 data: {
 labels: ['D&D Charges', 'Port Congestion', 'Documentation', 'Other'],
 datasets: [{
 label: 'Market Size ($B)',
 data: [8, 6, 2.5, 2.5],
 backgroundColor: '#00D4AA',
 borderRadius: 8
 }]
 },
 options: {
 responsive: true,
 maintainAspectRatio: false,
 plugins: {
 legend: { display: false }
 },
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
 initSavingsChart() {
 const canvas = document.getElementById('savingsChart');
 if (!canvas) return;
 const ctx = canvas.getContext('2d');
 const vesselCount = this.presentationData.vesselCount;
 this.charts.slide7 = new Chart(ctx, {
 type: 'line',
 data: {
 labels: ['Month 1', 'Month 3', 'Month 6', 'Month 12', 'Month 18'],
 datasets: [{
 label: 'Cumulative Savings',
 data: [
 vesselCount * 1.2,
 vesselCount * 3.5,
 vesselCount * 7.1,
 vesselCount * 14.2,
 vesselCount * 21.3
 ],
 borderColor: '#00D4AA',
 backgroundColor: 'rgba(0, 212, 170, 0.1)',
 fill: true,
 tension: 0.4
 }]
 },
 options: {
 responsive: true,
 maintainAspectRatio: false,
 plugins: {
 legend: { display: false }
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
 initCompetitionChart() {
 const canvas = document.getElementById('competitionChart');
 if (!canvas) return;
 const ctx = canvas.getContext('2d');
 this.charts.slide12 = new Chart(ctx, {
 type: 'radar',
 data: {
 labels: ['Universal Integration', 'AI Automation', 'Predictive Analytics', 'Dispute Success', 'Implementation Speed', 'ROI'],
 datasets: [{
 label: 'UIP',
 data: [100, 95, 98, 94, 95, 100],
 borderColor: '#00D4AA',
 backgroundColor: 'rgba(0, 212, 170, 0.2)'
 }, {
 label: 'Traditional Solutions',
 data: [30, 20, 15, 67, 20, 40],
 borderColor: '#FF6B6B',
 backgroundColor: 'rgba(255, 107, 107, 0.2)'
 }]
 },
 options: {
 responsive: true,
 maintainAspectRatio: false,
 scales: {
 r: {
 beginAtZero: true,
 max: 100
 }
 }
 }
 });
 }
 initFinancialsChart() {
 const canvas = document.getElementById('financialsChart');
 if (!canvas) return;
 const ctx = canvas.getContext('2d');
 this.charts.slide16 = new Chart(ctx, {
 type: 'bar',
 data: {
 labels: ['2023', '2024', '2025', '2026', '2027'],
 datasets: [{
 label: 'Revenue ($M)',
 data: [12, 48, 125, 280, 520],
 backgroundColor: '#00D4AA',
 borderRadius: 8,
 yAxisID: 'y'
 }, {
 label: 'ARR Growth %',
 data: [0, 300, 160, 124, 86],
 type: 'line',
 borderColor: '#0066FF',
 backgroundColor: 'transparent',
 yAxisID: 'y1'
 }]
 },
 options: {
 responsive: true,
 maintainAspectRatio: false,
 interaction: {
 mode: 'index',
 intersect: false
 },
 scales: {
 y: {
 type: 'linear',
 display: true,
 position: 'left',
 ticks: {
 callback: function(value) {
 return '$' + value + 'M';
 }
 }
 },
 y1: {
 type: 'linear',
 display: true,
 position: 'right',
 grid: {
 drawOnChartArea: false
 },
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
 exportToPDF() {
 console.log('Exporting to PDF...');
 alert('PDF export functionality would be implemented here');
 }
 exportToPowerPoint() {
 console.log('Exporting to PowerPoint...');
 alert('PowerPoint export functionality would be implemented here');
 }
}
document.addEventListener('DOMContentLoaded', () => {
 new PresentationDeck();
});