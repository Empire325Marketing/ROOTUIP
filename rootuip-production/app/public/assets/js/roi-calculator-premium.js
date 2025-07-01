/**
 * ROOTUIP Premium ROI Calculator
 * Fortune 500 Lead Generation Tool
 */

// Calculator state
let calculatorStep = 1;
let totalSteps = 4;
let calculatorData = {
    // Company info
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    jobTitle: '',
    companySize: '',
    industry: '',
    urgency: '',
    
    // Business metrics
    annualVolume: 0,
    currentDDCharges: 0,
    numberOfRoutes: 0,
    averageShipmentValue: 0,
    
    // Calculated results
    totalSavings: 0,
    detentionSavings: 0,
    demurrageSavings: 0,
    operationalSavings: 0,
    roi: 0,
    paybackPeriod: 0
};

// Industry-specific calculation factors
const industryFactors = {
    retail: {
        name: 'Retail & E-commerce',
        detentionMultiplier: 1.3,
        demurrageMultiplier: 1.1,
        operationalMultiplier: 1.4,
        inventoryCostFactor: 0.25,
        seasonalRiskFactor: 1.5,
        description: 'Peak season disruptions cost millions in lost sales'
    },
    manufacturing: {
        name: 'Manufacturing',
        detentionMultiplier: 1.5,
        demurrageMultiplier: 1.2,
        operationalMultiplier: 1.6,
        productionDelayFactor: 2.0,
        jitRiskFactor: 1.8,
        description: 'Production delays cascade through entire supply chain'
    },
    automotive: {
        name: 'Automotive',
        detentionMultiplier: 1.7,
        demurrageMultiplier: 1.4,
        operationalMultiplier: 1.8,
        lineStopCost: 50000,
        partsCriticalityFactor: 2.2,
        description: 'Single delayed part can shut down entire assembly line'
    },
    consumer_goods: {
        name: 'Consumer Goods',
        detentionMultiplier: 1.2,
        demurrageMultiplier: 1.0,
        operationalMultiplier: 1.3,
        brandRiskFactor: 1.1,
        marketTimingFactor: 1.4,
        description: 'Market timing and brand reputation at stake'
    },
    pharmaceuticals: {
        name: 'Pharmaceuticals',
        detentionMultiplier: 1.8,
        demurrageMultiplier: 1.6,
        operationalMultiplier: 2.0,
        complianceRiskFactor: 3.0,
        temperatureRiskFactor: 2.5,
        description: 'Compliance violations and temperature excursions cost millions'
    }
};

// Company size factors
const companySizeFactors = {
    startup: { multiplier: 0.3, name: 'Startup (< $10M revenue)' },
    small: { multiplier: 0.6, name: 'Small Business ($10M - $100M)' },
    midmarket: { multiplier: 1.0, name: 'Mid-Market ($100M - $1B)' },
    enterprise: { multiplier: 1.8, name: 'Enterprise ($1B - $10B)' },
    fortune500: { multiplier: 3.2, name: 'Fortune 500 ($10B+)' }
};

function getROICalculatorContent() {
    return `
        <div class="roi-calculator-container">
            <!-- Header Section -->
            <div class="calculator-header">
                <div class="header-content">
                    <h1 class="calculator-title">Calculate Your Annual Ocean Freight Savings</h1>
                    <p class="calculator-subtitle">See how much your company could save with AI-powered detention & demurrage prevention</p>
                    <div class="trust-indicators">
                        <div class="trust-item">
                            <i class="fas fa-shield-check"></i>
                            <span>Fortune 500 Trusted</span>
                        </div>
                        <div class="trust-item">
                            <i class="fas fa-chart-line"></i>
                            <span>$2.8B+ Saved</span>
                        </div>
                        <div class="trust-item">
                            <i class="fas fa-clock"></i>
                            <span>2-Minute Assessment</span>
                        </div>
                        <div class="trust-item">
                            <i class="fas fa-lock"></i>
                            <span>Confidential Results</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Progress Bar -->
            <div class="calculator-progress">
                <div class="progress-track">
                    <div class="progress-fill" id="progress-fill"></div>
                </div>
                <div class="progress-steps">
                    <div class="progress-step active" data-step="1">
                        <div class="step-circle">1</div>
                        <span>Business Profile</span>
                    </div>
                    <div class="progress-step" data-step="2">
                        <div class="step-circle">2</div>
                        <span>Shipping Volume</span>
                    </div>
                    <div class="progress-step" data-step="3">
                        <div class="step-circle">3</div>
                        <span>Cost Analysis</span>
                    </div>
                    <div class="progress-step" data-step="4">
                        <div class="step-circle">4</div>
                        <span>Your Results</span>
                    </div>
                </div>
            </div>

            <!-- Calculator Steps -->
            <div class="calculator-content">
                <!-- Step 1: Business Profile -->
                <div class="calculator-step active" id="step-1">
                    <div class="step-content">
                        <h2>Tell us about your business</h2>
                        <p>This helps us provide industry-specific calculations</p>
                        
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label">Industry *</label>
                                <select class="form-control" id="industry" onchange="updateIndustryInfo()">
                                    <option value="">Select your industry</option>
                                    <option value="retail">Retail & E-commerce</option>
                                    <option value="manufacturing">Manufacturing</option>
                                    <option value="automotive">Automotive</option>
                                    <option value="consumer_goods">Consumer Goods</option>
                                    <option value="pharmaceuticals">Pharmaceuticals</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Company Size *</label>
                                <select class="form-control" id="companySize">
                                    <option value="">Select company size</option>
                                    <option value="startup">Startup (< $10M revenue)</option>
                                    <option value="small">Small Business ($10M - $100M)</option>
                                    <option value="midmarket">Mid-Market ($100M - $1B)</option>
                                    <option value="enterprise">Enterprise ($1B - $10B)</option>
                                    <option value="fortune500">Fortune 500 ($10B+)</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="industry-highlight" id="industry-highlight" style="display: none;">
                            <div class="highlight-icon">
                                <i class="fas fa-lightbulb"></i>
                            </div>
                            <div class="highlight-content">
                                <h4 id="industry-name">Industry Insight</h4>
                                <p id="industry-description">Select an industry to see specific risks and opportunities</p>
                            </div>
                        </div>
                        
                        <div class="step-actions">
                            <button class="btn btn-primary btn-lg" onclick="nextStep()" id="step1-next" disabled>
                                Continue to Volume Assessment
                                <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Shipping Volume -->
                <div class="calculator-step" id="step-2">
                    <div class="step-content">
                        <h2>What's your annual shipping volume?</h2>
                        <p>Help us understand the scale of your operations</p>
                        
                        <div class="slider-input-group">
                            <label class="form-label">Containers per year</label>
                            <div class="slider-container">
                                <input type="range" class="volume-slider" id="volumeSlider" 
                                       min="0" max="100000" value="5000" 
                                       oninput="updateVolumeDisplay(this.value)">
                                <div class="slider-labels">
                                    <span>0</span>
                                    <span>25K</span>
                                    <span>50K</span>
                                    <span>75K</span>
                                    <span>100K+</span>
                                </div>
                            </div>
                            <div class="volume-display">
                                <span class="volume-number" id="volumeDisplay">5,000</span>
                                <span class="volume-unit">containers/year</span>
                            </div>
                        </div>
                        
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label">Number of shipping routes</label>
                                <select class="form-control" id="numberOfRoutes">
                                    <option value="1">1-2 routes</option>
                                    <option value="5">3-5 routes</option>
                                    <option value="10">6-10 routes</option>
                                    <option value="20">11-20 routes</option>
                                    <option value="50">20+ routes</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Average shipment value</label>
                                <select class="form-control" id="averageShipmentValue">
                                    <option value="50000">$50K - $100K</option>
                                    <option value="200000">$100K - $500K</option>
                                    <option value="750000">$500K - $1M</option>
                                    <option value="2000000">$1M - $5M</option>
                                    <option value="5000000">$5M+</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="volume-insights">
                            <div class="insight-card">
                                <i class="fas fa-exclamation-triangle text-warning"></i>
                                <div>
                                    <strong>Risk Alert:</strong>
                                    <span id="volume-risk-text">High-volume shippers face exponentially higher D&D exposure</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="step-actions">
                            <button class="btn btn-ghost" onclick="previousStep()">
                                <i class="fas fa-arrow-left"></i>
                                Back
                            </button>
                            <button class="btn btn-primary btn-lg" onclick="nextStep()">
                                Continue to Cost Analysis
                                <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Step 3: Cost Analysis -->
                <div class="calculator-step" id="step-3">
                    <div class="step-content">
                        <h2>Current detention & demurrage costs</h2>
                        <p>Understanding your current costs helps us calculate potential savings</p>
                        
                        <div class="cost-input-section">
                            <div class="cost-question">
                                <h4>Do you track your current D&D charges?</h4>
                                <div class="radio-group">
                                    <label class="radio-option">
                                        <input type="radio" name="trackingMethod" value="known" onchange="toggleCostInput('known')">
                                        <span class="radio-custom"></span>
                                        Yes, I know our annual D&D costs
                                    </label>
                                    <label class="radio-option">
                                        <input type="radio" name="trackingMethod" value="estimate" onchange="toggleCostInput('estimate')" checked>
                                        <span class="radio-custom"></span>
                                        No, please estimate based on industry benchmarks
                                    </label>
                                </div>
                            </div>
                            
                            <div class="cost-input-group" id="known-costs" style="display: none;">
                                <div class="form-group">
                                    <label class="form-label">Annual D&D charges</label>
                                    <div class="input-with-prefix">
                                        <span class="input-prefix">$</span>
                                        <input type="number" class="form-control" id="currentDDCharges" 
                                               placeholder="e.g., 2500000" oninput="formatCurrencyInput(this)">
                                    </div>
                                </div>
                            </div>
                            
                            <div class="estimation-display" id="cost-estimation">
                                <div class="estimation-card">
                                    <h4>Industry Benchmark Estimation</h4>
                                    <p>Based on your shipping volume and industry, we estimate:</p>
                                    <div class="benchmark-breakdown">
                                        <div class="benchmark-item">
                                            <span class="benchmark-label">Detention charges:</span>
                                            <span class="benchmark-value" id="estimated-detention">$8.5M</span>
                                        </div>
                                        <div class="benchmark-item">
                                            <span class="benchmark-label">Demurrage fees:</span>
                                            <span class="benchmark-value" id="estimated-demurrage">$5.2M</span>
                                        </div>
                                        <div class="benchmark-item total">
                                            <span class="benchmark-label">Total estimated D&D:</span>
                                            <span class="benchmark-value" id="estimated-total">$13.7M</span>
                                        </div>
                                    </div>
                                    <p class="benchmark-note">
                                        <i class="fas fa-info-circle"></i>
                                        Based on industry averages for your sector and volume
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="step-actions">
                            <button class="btn btn-ghost" onclick="previousStep()">
                                <i class="fas fa-arrow-left"></i>
                                Back
                            </button>
                            <button class="btn btn-primary btn-lg" onclick="nextStep()">
                                Calculate My Savings
                                <i class="fas fa-calculator"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Step 4: Results & Lead Capture -->
                <div class="calculator-step" id="step-4">
                    <div class="step-content">
                        <div class="results-preview">
                            <h2>Your Potential Annual Savings</h2>
                            <div class="savings-highlight">
                                <div class="savings-amount" id="total-savings-display">$25.4M</div>
                                <div class="savings-subtitle">in prevented detention & demurrage charges</div>
                            </div>
                            
                            <div class="savings-breakdown">
                                <div class="breakdown-item">
                                    <div class="breakdown-icon detention">
                                        <i class="fas fa-shield-alt"></i>
                                    </div>
                                    <div class="breakdown-content">
                                        <h4>Detention Prevention</h4>
                                        <div class="breakdown-amount" id="detention-savings">$12.0M</div>
                                        <p>AI-powered pickup optimization</p>
                                    </div>
                                </div>
                                <div class="breakdown-item">
                                    <div class="breakdown-icon demurrage">
                                        <i class="fas fa-clock"></i>
                                    </div>
                                    <div class="breakdown-content">
                                        <h4>Demurrage Reduction</h4>
                                        <div class="breakdown-amount" id="demurrage-savings">$8.0M</div>
                                        <p>Port congestion predictions</p>
                                    </div>
                                </div>
                                <div class="breakdown-item">
                                    <div class="breakdown-icon operational">
                                        <i class="fas fa-cogs"></i>
                                    </div>
                                    <div class="breakdown-content">
                                        <h4>Operational Efficiency</h4>
                                        <div class="breakdown-amount" id="operational-savings">$5.4M</div>
                                        <p>Automated workflows & alerts</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="lead-capture-gate">
                            <div class="gate-header">
                                <h3>Get Your Detailed ROI Report</h3>
                                <p>See your complete savings breakdown, implementation timeline, and industry benchmarks</p>
                                <div class="report-benefits">
                                    <div class="benefit-item">
                                        <i class="fas fa-check text-success"></i>
                                        <span>Detailed 12-month savings projection</span>
                                    </div>
                                    <div class="benefit-item">
                                        <i class="fas fa-check text-success"></i>
                                        <span>Industry benchmark comparison</span>
                                    </div>
                                    <div class="benefit-item">
                                        <i class="fas fa-check text-success"></i>
                                        <span>Implementation roadmap & timeline</span>
                                    </div>
                                    <div class="benefit-item">
                                        <i class="fas fa-check text-success"></i>
                                        <span>Executive presentation deck</span>
                                    </div>
                                </div>
                            </div>
                            
                            <form class="lead-capture-form" id="leadCaptureForm">
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label class="form-label">Full Name *</label>
                                        <input type="text" class="form-control" id="contactName" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Business Email *</label>
                                        <input type="email" class="form-control" id="email" required>
                                    </div>
                                </div>
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label class="form-label">Company Name *</label>
                                        <input type="text" class="form-control" id="companyName" required>
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Job Title *</label>
                                        <select class="form-control" id="jobTitle" required>
                                            <option value="">Select your role</option>
                                            <option value="ceo">CEO/President</option>
                                            <option value="cfo">CFO/Finance</option>
                                            <option value="coo">COO/Operations</option>
                                            <option value="supply_chain">VP Supply Chain</option>
                                            <option value="logistics">Logistics Manager</option>
                                            <option value="procurement">Procurement</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label">What's your timeline for implementing a solution?</label>
                                    <select class="form-control" id="urgency">
                                        <option value="immediate">Immediate (0-30 days)</option>
                                        <option value="short">Short-term (1-3 months)</option>
                                        <option value="medium">Medium-term (3-6 months)</option>
                                        <option value="long">Long-term (6+ months)</option>
                                        <option value="research">Just researching</option>
                                    </select>
                                </div>
                                
                                <div class="form-actions">
                                    <button type="submit" class="btn btn-primary btn-xl">
                                        <i class="fas fa-download"></i>
                                        Get My ROI Report
                                    </button>
                                    <p class="privacy-note">
                                        <i class="fas fa-lock"></i>
                                        Your information is secure and will never be shared. 
                                        <a href="#" class="text-primary">Privacy Policy</a>
                                    </p>
                                </div>
                            </form>
                        </div>
                        
                        <div class="social-proof">
                            <h4>Join 500+ Companies Already Saving Millions</h4>
                            <div class="customer-logos">
                                <div class="customer-logo">Fortune 100 Retailer</div>
                                <div class="customer-logo">Global Auto Manufacturer</div>
                                <div class="customer-logo">Major Electronics Brand</div>
                                <div class="customer-logo">Leading Pharma Company</div>
                            </div>
                            <div class="testimonial">
                                <blockquote>
                                    "ROOTUIP's ROI calculator was spot-on. We're now saving $18M annually, exactly as predicted."
                                </blockquote>
                                <cite>VP Supply Chain, Fortune 100 Retailer</cite>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Success Modal -->
        <div id="success-modal" class="modal">
            <div class="modal-content success-modal-content">
                <div class="success-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h2>Your ROI Report is Ready!</h2>
                <p>We've sent your detailed savings analysis to your email. Our team will follow up within 24 hours with additional insights.</p>
                <div class="next-steps">
                    <h4>What happens next?</h4>
                    <ol>
                        <li>Review your personalized ROI report</li>
                        <li>Schedule a 30-minute executive demo</li>
                        <li>Get a custom implementation proposal</li>
                    </ol>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="bookDemo()">
                        <i class="fas fa-calendar"></i>
                        Schedule Executive Demo
                    </button>
                    <button class="btn btn-ghost" onclick="closeSuccessModal()">
                        Continue Browsing
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Step navigation
function nextStep() {
    if (validateCurrentStep()) {
        if (calculatorStep < totalSteps) {
            // Hide current step
            document.getElementById(`step-${calculatorStep}`).classList.remove('active');
            document.querySelector(`[data-step="${calculatorStep}"]`).classList.remove('active');
            
            calculatorStep++;
            
            // Show next step
            document.getElementById(`step-${calculatorStep}`).classList.add('active');
            document.querySelector(`[data-step="${calculatorStep}"]`).classList.add('active');
            
            // Update progress
            updateProgress();
            
            // Perform step-specific actions
            if (calculatorStep === 3) {
                updateCostEstimation();
            } else if (calculatorStep === 4) {
                calculateResults();
            }
        }
    }
}

function previousStep() {
    if (calculatorStep > 1) {
        // Hide current step
        document.getElementById(`step-${calculatorStep}`).classList.remove('active');
        document.querySelector(`[data-step="${calculatorStep}"]`).classList.remove('active');
        
        calculatorStep--;
        
        // Show previous step
        document.getElementById(`step-${calculatorStep}`).classList.add('active');
        document.querySelector(`[data-step="${calculatorStep}"]`).classList.add('active');
        
        // Update progress
        updateProgress();
    }
}

function validateCurrentStep() {
    switch (calculatorStep) {
        case 1:
            const industry = document.getElementById('industry').value;
            const companySize = document.getElementById('companySize').value;
            return industry && companySize;
        case 2:
        case 3:
        case 4:
            return true;
        default:
            return false;
    }
}

function updateProgress() {
    const progressPercent = (calculatorStep / totalSteps) * 100;
    document.getElementById('progress-fill').style.width = `${progressPercent}%`;
    
    // Update step indicators
    document.querySelectorAll('.progress-step').forEach((step, index) => {
        if (index + 1 <= calculatorStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
}

// Industry and company size handling
function updateIndustryInfo() {
    const industry = document.getElementById('industry').value;
    const companySize = document.getElementById('companySize').value;
    const highlight = document.getElementById('industry-highlight');
    const nextBtn = document.getElementById('step1-next');
    
    if (industry) {
        const factor = industryFactors[industry];
        document.getElementById('industry-name').textContent = factor.name;
        document.getElementById('industry-description').textContent = factor.description;
        highlight.style.display = 'flex';
    }
    
    nextBtn.disabled = !(industry && companySize);
}

// Volume slider handling
function updateVolumeDisplay(value) {
    const display = document.getElementById('volumeDisplay');
    const formatted = parseInt(value).toLocaleString();
    display.textContent = formatted;
    
    // Update risk text based on volume
    const riskText = document.getElementById('volume-risk-text');
    if (value > 50000) {
        riskText.textContent = 'Ultra-high volume shippers can lose $50M+ annually to D&D charges';
    } else if (value > 20000) {
        riskText.textContent = 'High-volume shippers face exponentially higher D&D exposure';
    } else if (value > 5000) {
        riskText.textContent = 'Medium-volume shippers often lack visibility into rising costs';
    } else {
        riskText.textContent = 'Small delays compound quickly into significant charges';
    }
}

// Cost tracking method
function toggleCostInput(method) {
    const knownCosts = document.getElementById('known-costs');
    const estimation = document.getElementById('cost-estimation');
    
    if (method === 'known') {
        knownCosts.style.display = 'block';
        estimation.style.display = 'none';
    } else {
        knownCosts.style.display = 'none';
        estimation.style.display = 'block';
        updateCostEstimation();
    }
}

function updateCostEstimation() {
    const volume = parseInt(document.getElementById('volumeSlider').value) || 5000;
    const industry = document.getElementById('industry').value || 'retail';
    const companySize = document.getElementById('companySize').value || 'midmarket';
    
    const industryFactor = industryFactors[industry];
    const sizeFactor = companySizeFactors[companySize];
    
    // Base calculation: $2,000 per container per year (industry average)
    const baseDetention = volume * 2000 * industryFactor.detentionMultiplier * sizeFactor.multiplier;
    const baseDemurrage = volume * 1500 * industryFactor.demurrageMultiplier * sizeFactor.multiplier;
    
    document.getElementById('estimated-detention').textContent = '$' + (baseDetention / 1000000).toFixed(1) + 'M';
    document.getElementById('estimated-demurrage').textContent = '$' + (baseDemurrage / 1000000).toFixed(1) + 'M';
    document.getElementById('estimated-total').textContent = '$' + ((baseDetention + baseDemurrage) / 1000000).toFixed(1) + 'M';
}

function formatCurrencyInput(input) {
    let value = input.value.replace(/[^\d]/g, '');
    if (value) {
        input.value = parseInt(value).toLocaleString();
    }
}

// Results calculation
function calculateResults() {
    // Get form data
    const volume = parseInt(document.getElementById('volumeSlider').value) || 5000;
    const industry = document.getElementById('industry').value || 'retail';
    const companySize = document.getElementById('companySize').value || 'midmarket';
    const routes = parseInt(document.getElementById('numberOfRoutes').value) || 5;
    const shipmentValue = parseInt(document.getElementById('averageShipmentValue').value) || 200000;
    
    const trackingMethod = document.querySelector('input[name="trackingMethod"]:checked').value;
    let currentDDCharges;
    
    if (trackingMethod === 'known') {
        const inputValue = document.getElementById('currentDDCharges').value.replace(/[^\d]/g, '');
        currentDDCharges = parseInt(inputValue) || 0;
    } else {
        // Use estimation
        const industryFactor = industryFactors[industry];
        const sizeFactor = companySizeFactors[companySize];
        const baseDetention = volume * 2000 * industryFactor.detentionMultiplier * sizeFactor.multiplier;
        const baseDemurrage = volume * 1500 * industryFactor.demurrageMultiplier * sizeFactor.multiplier;
        currentDDCharges = baseDetention + baseDemurrage;
    }
    
    // Calculate savings (85% reduction is our average)
    const detentionSavings = currentDDCharges * 0.6 * 0.85; // 60% is typically detention
    const demurrageSavings = currentDDCharges * 0.4 * 0.85; // 40% is typically demurrage
    const operationalSavings = volume * 500; // $500 per container in operational savings
    
    const totalSavings = detentionSavings + demurrageSavings + operationalSavings;
    
    // Update display
    document.getElementById('total-savings-display').textContent = '$' + (totalSavings / 1000000).toFixed(1) + 'M';
    document.getElementById('detention-savings').textContent = '$' + (detentionSavings / 1000000).toFixed(1) + 'M';
    document.getElementById('demurrage-savings').textContent = '$' + (demurrageSavings / 1000000).toFixed(1) + 'M';
    document.getElementById('operational-savings').textContent = '$' + (operationalSavings / 1000000).toFixed(1) + 'M';
    
    // Store results for lead capture
    calculatorData.totalSavings = totalSavings;
    calculatorData.detentionSavings = detentionSavings;
    calculatorData.demurrageSavings = demurrageSavings;
    calculatorData.operationalSavings = operationalSavings;
    calculatorData.annualVolume = volume;
    calculatorData.currentDDCharges = currentDDCharges;
    calculatorData.numberOfRoutes = routes;
    calculatorData.averageShipmentValue = shipmentValue;
    calculatorData.industry = industry;
    calculatorData.companySize = companySize;
}

// Lead capture form handling
function initLeadCaptureForm() {
    const form = document.getElementById('leadCaptureForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Collect form data
            calculatorData.contactName = document.getElementById('contactName').value;
            calculatorData.email = document.getElementById('email').value;
            calculatorData.companyName = document.getElementById('companyName').value;
            calculatorData.jobTitle = document.getElementById('jobTitle').value;
            calculatorData.urgency = document.getElementById('urgency').value;
            
            // Submit to CRM and generate report
            const success = await submitLeadData();
            
            if (success) {
                showSuccessModal();
            } else {
                showErrorMessage('There was an error processing your request. Please try again.');
            }
        });
    }
}

async function submitLeadData() {
    try {
        // In production, this would integrate with HubSpot, Salesforce, or your CRM
        const response = await fetch('/api/roi-calculator-lead', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(calculatorData)
        });
        
        return response.ok;
    } catch (error) {
        console.error('Lead submission error:', error);
        return false;
    }
}

function showSuccessModal() {
    document.getElementById('success-modal').classList.add('show');
}

function closeSuccessModal() {
    document.getElementById('success-modal').classList.remove('show');
}

function bookDemo() {
    // Integrate with Calendly or your scheduling system
    window.open('https://calendly.com/rootuip/executive-demo', '_blank');
}

function showErrorMessage(message) {
    alert(message); // In production, use a proper notification system
}

// Initialize calculator
function initROICalculator() {
    // Set up event listeners
    initLeadCaptureForm();
    
    // Set up dependent dropdowns
    document.getElementById('industry').addEventListener('change', updateIndustryInfo);
    document.getElementById('companySize').addEventListener('change', updateIndustryInfo);
    
    // Set up volume slider
    document.getElementById('volumeSlider').addEventListener('input', function() {
        updateVolumeDisplay(this.value);
    });
    
    // Initialize displays
    updateVolumeDisplay(5000);
    updateProgress();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (document.querySelector('.roi-calculator-container')) {
        initROICalculator();
    }
});

// Export for global access
window.ROICalculator = {
    initROICalculator,
    nextStep,
    previousStep,
    updateIndustryInfo,
    updateVolumeDisplay,
    toggleCostInput,
    calculateResults,
    showSuccessModal,
    closeSuccessModal,
    bookDemo
};