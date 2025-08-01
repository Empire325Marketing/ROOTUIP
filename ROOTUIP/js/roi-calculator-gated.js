// ROI Calculator with Lead Capture
let calculatorData = {};
let leadScore = 0;

function calculateROI() {
    // Get input values
    const vesselCount = parseInt(document.getElementById('vessel-count').value);
    const teuVolume = parseInt(document.getElementById('teu-volume').value);
    const docHours = parseInt(document.getElementById('doc-hours').value);
    const ddCharges = parseInt(document.getElementById('dd-charges').value);
    const carrierCount = parseInt(document.getElementById('carrier-count').value);
    
    // Calculate savings
    const hourlyRate = 75; // Average documentation staff cost
    const shipmentsPerYear = teuVolume / 25; // Average TEUs per shipment
    
    // Documentation savings (80% reduction in processing time)
    const docSavings = shipmentsPerYear * docHours * hourlyRate * 0.8;
    
    // D&D savings (30% reduction)
    const ddSavings = ddCharges * 0.3;
    
    // Integration savings ($50k per carrier integration avoided)
    const integrationSavings = carrierCount * 50000;
    
    // Error reduction savings (2% of volume * $500 per error)
    const errorSavings = shipmentsPerYear * 0.02 * 500;
    
    // Total savings
    const totalSavings = docSavings + ddSavings + integrationSavings + errorSavings;
    
    // ROI calculation (assuming $500k implementation cost)
    const implementationCost = 500000;
    const roi = ((totalSavings - implementationCost) / implementationCost * 100).toFixed(0);
    const paybackMonths = Math.ceil(implementationCost / (totalSavings / 12));
    
    // Calculate lead score based on potential value
    leadScore = calculateLeadScore(vesselCount, teuVolume, totalSavings);
    
    // Store data for form submission
    calculatorData = {
        inputs: {
            vesselCount,
            teuVolume,
            docHours,
            ddCharges,
            carrierCount
        },
        results: {
            totalSavings,
            docSavings,
            ddSavings,
            integrationSavings,
            errorSavings,
            roi,
            paybackMonths,
            hoursSaved: shipmentsPerYear * docHours * 0.8,
            processingSpeed: 80,
            accuracyImprovement: 95
        }
    };
    
    // Update preview
    document.getElementById('preview-savings').textContent = formatCurrency(totalSavings);
    document.getElementById('preview-roi').textContent = roi + '%';
    document.getElementById('preview-payback').textContent = paybackMonths;
    
    // Show lead capture form
    showStep('lead-capture');
    
    // Track calculator completion
    trackEvent('ROI_Calculator', 'Completed', `Savings: ${totalSavings}`);
}

function calculateLeadScore(vessels, teus, savings) {
    let score = 0;
    
    // Company size scoring
    if (vessels >= 50) score += 30;
    else if (vessels >= 20) score += 20;
    else if (vessels >= 10) score += 10;
    else score += 5;
    
    // Volume scoring
    if (teus >= 500000) score += 30;
    else if (teus >= 100000) score += 20;
    else if (teus >= 50000) score += 15;
    else score += 5;
    
    // Savings potential scoring
    if (savings >= 5000000) score += 40;
    else if (savings >= 2000000) score += 30;
    else if (savings >= 1000000) score += 20;
    else if (savings >= 500000) score += 10;
    else score += 5;
    
    return score;
}

function submitROILead(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    // Add calculated data
    formData.append('lead_score', leadScore);
    formData.append('roi_data', JSON.stringify(calculatorData));
    formData.append('source', 'roi_calculator');
    formData.append('timestamp', new Date().toISOString());
    
    // Show loading state
    const submitBtn = form.querySelector('.submit-btn');
    submitBtn.textContent = 'Processing...';
    submitBtn.disabled = true;
    
    // Submit to lead capture API
    fetch('/api/lead-capture', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        // Show results
        updateResultsDisplay();
        showStep('roi-results');
        
        // Track conversion
        trackEvent('Lead_Capture', 'ROI_Calculator', `Score: ${leadScore}`);
        
        // Trigger email automation
        triggerEmailSequence('roi_calculator', formData.get('email'), calculatorData);
        
        // If high-value lead, trigger sales alert
        if (leadScore >= 70) {
            triggerSalesAlert(formData, calculatorData);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        // Fallback: still show results
        updateResultsDisplay();
        showStep('roi-results');
    });
}

function updateResultsDisplay() {
    const r = calculatorData.results;
    
    document.getElementById('total-savings').textContent = formatCurrency(r.totalSavings);
    document.getElementById('roi-percentage').textContent = r.roi + '%';
    document.getElementById('payback-period').textContent = r.paybackMonths;
    
    document.getElementById('doc-savings').textContent = formatCurrency(r.docSavings);
    document.getElementById('dd-savings').textContent = formatCurrency(r.ddSavings);
    document.getElementById('integration-savings').textContent = formatCurrency(r.integrationSavings);
    document.getElementById('error-savings').textContent = formatCurrency(r.errorSavings);
    
    document.getElementById('hours-saved').textContent = formatNumber(r.hoursSaved);
    document.getElementById('processing-speed').textContent = r.processingSpeed + '%';
    document.getElementById('accuracy-improvement').textContent = r.accuracyImprovement + '%';
}

function showStep(stepId) {
    document.querySelectorAll('.calculator-step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(stepId).classList.add('active');
}

function formatCurrency(value) {
    return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatNumber(value) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Email automation trigger
function triggerEmailSequence(sequence, email, data) {
    fetch('/api/email-automation/trigger', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sequence: sequence,
            email: email,
            data: data
        })
    });
}

// Sales alert for high-value leads
function triggerSalesAlert(formData, calculatorData) {
    fetch('/api/sales-alert', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            lead: Object.fromEntries(formData),
            score: leadScore,
            savings: calculatorData.results.totalSavings,
            alert_type: 'high_value_roi_lead'
        })
    });
}

// Event tracking
function trackEvent(category, action, label) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, {
            'event_category': category,
            'event_label': label
        });
    }
}