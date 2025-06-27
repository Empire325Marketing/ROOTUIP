// Assessment Tool JavaScript
let currentStep = 1;
const totalSteps = 5;
let assessmentData = {};
let assessmentScore = 0;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize
    updateProgress();
    setupSliders();
    setupSortable();
    
    // Navigation
    document.getElementById('next-btn').addEventListener('click', nextStep);
    document.getElementById('prev-btn').addEventListener('click', prevStep);
    
    // Form submission
    document.getElementById('assessment-form').addEventListener('submit', submitAssessment);
    
    // Track form field interactions
    document.querySelectorAll('input, select, textarea').forEach(field => {
        field.addEventListener('change', () => trackFieldInteraction(field));
    });
});

function nextStep() {
    if (validateStep(currentStep)) {
        saveStepData(currentStep);
        
        if (currentStep === 4) {
            calculateScore();
        }
        
        currentStep++;
        showStep(currentStep);
        updateProgress();
        
        // Track progression
        trackEvent('Assessment_Progress', `Step_${currentStep}_Reached`);
    }
}

function prevStep() {
    currentStep--;
    showStep(currentStep);
    updateProgress();
}

function showStep(step) {
    // Hide all steps
    document.querySelectorAll('.assessment-step').forEach(s => {
        s.classList.remove('active');
    });
    
    // Show current step
    document.querySelector(`.assessment-step[data-step="${step}"]`).classList.add('active');
    
    // Update navigation
    document.getElementById('prev-btn').style.display = step === 1 ? 'none' : 'block';
    document.getElementById('next-btn').textContent = step === totalSteps ? 'Get Results' : 'Next →';
    
    // Update progress steps
    document.querySelectorAll('.progress-steps .step').forEach(s => {
        const stepNum = parseInt(s.dataset.step);
        s.classList.toggle('active', stepNum <= step);
        s.classList.toggle('completed', stepNum < step);
    });
}

function updateProgress() {
    const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
}

function validateStep(step) {
    const stepElement = document.querySelector(`.assessment-step[data-step="${step}"]`);
    const requiredFields = stepElement.querySelectorAll('[required], input[type="radio"]');
    
    let valid = true;
    let radioGroups = {};
    
    requiredFields.forEach(field => {
        if (field.type === 'radio') {
            radioGroups[field.name] = radioGroups[field.name] || false;
            if (field.checked) radioGroups[field.name] = true;
        } else if (!field.value) {
            valid = false;
            field.classList.add('error');
        }
    });
    
    // Check radio groups
    for (let group in radioGroups) {
        if (!radioGroups[group]) {
            valid = false;
            // Highlight radio group
            document.querySelectorAll(`input[name="${group}"]`).forEach(radio => {
                radio.closest('.radio-card').classList.add('error');
            });
        }
    }
    
    if (!valid) {
        showValidationMessage();
    }
    
    return valid;
}

function saveStepData(step) {
    const stepElement = document.querySelector(`.assessment-step[data-step="${step}"]`);
    const inputs = stepElement.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            assessmentData[input.name] = assessmentData[input.name] || [];
            if (input.checked) {
                assessmentData[input.name].push(input.value);
            }
        } else if (input.type === 'radio' && input.checked) {
            assessmentData[input.name] = input.value;
        } else if (input.value) {
            assessmentData[input.name] = input.value;
        }
    });
    
    // Save pain points order
    if (step === 3) {
        const painPoints = [];
        document.querySelectorAll('#pain-points .sortable-item').forEach((item, index) => {
            painPoints.push({
                value: item.dataset.value,
                priority: index + 1
            });
        });
        assessmentData.pain_points_priority = painPoints;
    }
}

function calculateScore() {
    let score = 0;
    let factors = {
        automation: 0,
        integration: 0,
        efficiency: 0,
        readiness: 0
    };
    
    // Automation score (0-25)
    const manualPercentage = parseInt(assessmentData.manual_percentage) || 50;
    factors.automation = 25 * (1 - manualPercentage / 100);
    
    // Integration score (0-25)
    const integrationRating = parseInt(assessmentData.integration_rating) || 1;
    factors.integration = 5 * integrationRating;
    
    // Efficiency score (0-25)
    const shipmentVolume = assessmentData.shipment_volume;
    const manualTime = assessmentData.manual_time;
    if (shipmentVolume === '1000+' && manualTime === '6+') {
        factors.efficiency = 5; // Very inefficient
    } else if (shipmentVolume === '0-100' && manualTime === '0-2') {
        factors.efficiency = 25; // Efficient for volume
    } else {
        factors.efficiency = 15; // Average
    }
    
    // Readiness score (0-25)
    if (assessmentData.timeline === 'immediate' && assessmentData.budget_allocated === 'yes') {
        factors.readiness = 25;
    } else if (assessmentData.timeline === 'next_year' || assessmentData.budget_allocated === 'no') {
        factors.readiness = 5;
    } else {
        factors.readiness = 15;
    }
    
    // Calculate total
    score = Math.round(factors.automation + factors.integration + factors.efficiency + factors.readiness);
    assessmentScore = score;
    assessmentData.score = score;
    assessmentData.score_factors = factors;
    
    // Update display
    animateScore(score);
    updateScoreLabel(score);
}

function animateScore(targetScore) {
    const scoreElement = document.getElementById('score-number');
    const scorePath = document.getElementById('score-path');
    
    let currentScore = 0;
    const increment = targetScore / 50;
    const dashOffset = 220 - (220 * targetScore / 100);
    
    const animation = setInterval(() => {
        currentScore += increment;
        if (currentScore >= targetScore) {
            currentScore = targetScore;
            clearInterval(animation);
        }
        
        scoreElement.textContent = Math.round(currentScore);
        scorePath.style.strokeDashoffset = 220 - (220 * currentScore / 100);
        
        // Change color based on score
        if (currentScore < 40) {
            scorePath.style.stroke = '#dc3545';
        } else if (currentScore < 70) {
            scorePath.style.stroke = '#ffc107';
        } else {
            scorePath.style.stroke = '#28a745';
        }
    }, 20);
}

function updateScoreLabel(score) {
    const label = document.getElementById('score-label');
    
    if (score < 40) {
        label.textContent = 'Significant improvement potential';
        label.className = 'score-label poor';
    } else if (score < 70) {
        label.textContent = 'Good foundation with room to grow';
        label.className = 'score-label average';
    } else {
        label.textContent = 'Well-optimized operations';
        label.className = 'score-label excellent';
    }
}

function submitAssessment(event) {
    event.preventDefault();
    
    if (!validateStep(5)) return;
    
    saveStepData(5);
    
    // Add metadata
    assessmentData.source = 'assessment_tool';
    assessmentData.completed_at = new Date().toISOString();
    
    // Show loading state
    const submitBtn = document.querySelector('.submit-btn');
    submitBtn.textContent = 'Processing...';
    submitBtn.disabled = true;
    
    // Submit to API
    fetch('/api/leads/capture', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: assessmentData.email,
            company: assessmentData.company,
            name: assessmentData.name,
            phone: assessmentData.phone,
            source: 'assessment_tool',
            assessmentData: assessmentData
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Track successful lead capture
            if (typeof leadTracker !== 'undefined') {
                leadTracker.identifyLead(assessmentData.email, {
                    source: 'assessment_tool',
                    leadScore: data.leadScore || assessmentScore,
                    assessmentData: assessmentData
                });
            }
            
            // Track completion
            trackEvent('Assessment_Completed', `Score_${assessmentScore}`, assessmentScore);
            
            // Show thank you message
            showThankYou();
        } else {
            throw new Error(data.error || 'Failed to submit assessment');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        submitBtn.textContent = 'Get My Assessment Report';
        submitBtn.disabled = false;
        
        // Show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'validation-message';
        errorDiv.textContent = 'Failed to submit assessment. Please try again.';
        document.querySelector('.assessment-step.active').prepend(errorDiv);
        setTimeout(() => errorDiv.remove(), 5000);
    });
}

function showThankYou() {
    const formElement = document.querySelector('.assessment-wrapper');
    formElement.innerHTML = `
        <div class="thank-you-message">
            <div class="icon">✓</div>
            <h2>Thank You!</h2>
            <p>Your personalized assessment report is on its way to your inbox.</p>
            <div class="next-steps">
                <h3>What happens next:</h3>
                <ul>
                    <li>You'll receive your detailed report within 5 minutes</li>
                    <li>Our team will review your assessment</li>
                    <li>We'll send you industry-specific recommendations</li>
                </ul>
            </div>
            <div class="cta-buttons">
                <a href="/roi-calculator" class="primary-btn">Calculate Your ROI</a>
                <a href="/demo" class="secondary-btn">Book a Demo</a>
            </div>
        </div>
    `;
}

// Utility functions
function setupSliders() {
    document.querySelectorAll('.slider').forEach(slider => {
        const valueDisplay = document.getElementById(slider.name.replace('_', '-') + '-value');
        
        slider.addEventListener('input', function() {
            valueDisplay.textContent = this.value + '%';
        });
    });
}

function setupSortable() {
    // Simple drag and drop for pain points
    const sortableList = document.getElementById('pain-points');
    if (!sortableList) return;
    
    let draggedElement = null;
    
    sortableList.addEventListener('dragstart', (e) => {
        draggedElement = e.target.closest('.sortable-item');
        draggedElement.classList.add('dragging');
    });
    
    sortableList.addEventListener('dragend', (e) => {
        draggedElement.classList.remove('dragging');
    });
    
    sortableList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(sortableList, e.clientY);
        if (afterElement == null) {
            sortableList.appendChild(draggedElement);
        } else {
            sortableList.insertBefore(draggedElement, afterElement);
        }
    });
    
    // Make items draggable
    document.querySelectorAll('.sortable-item').forEach(item => {
        item.draggable = true;
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.sortable-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function showValidationMessage() {
    // Show inline validation message
    const message = document.createElement('div');
    message.className = 'validation-message';
    message.textContent = 'Please answer all required questions';
    
    // Remove existing messages
    document.querySelectorAll('.validation-message').forEach(m => m.remove());
    
    // Add new message
    document.querySelector('.assessment-step.active').prepend(message);
    
    // Scroll to top
    message.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Remove after 3 seconds
    setTimeout(() => message.remove(), 3000);
}

function trackFieldInteraction(field) {
    if (typeof gtag !== 'undefined') {
        gtag('event', 'field_interaction', {
            'event_category': 'Assessment_Tool',
            'event_label': field.name,
            'value': field.value
        });
    }
}

function trackEvent(category, action, value) {
    if (typeof gtag !== 'undefined') {
        gtag('event', action, {
            'event_category': category,
            'event_label': `Step ${currentStep}`,
            'value': value
        });
    }
}