// Lead Scoring and Qualification Engine
class LeadScoringEngine {
    constructor() {
        this.scoringRules = {
            // Company Size Scoring (0-30 points)
            companySize: {
                vessels: {
                    '100+': 30,
                    '50-99': 25,
                    '20-49': 20,
                    '10-19': 15,
                    '5-9': 10,
                    '1-4': 5
                },
                revenue: {
                    '1B+': 30,
                    '500M-1B': 25,
                    '100M-500M': 20,
                    '50M-100M': 15,
                    '10M-50M': 10,
                    '<10M': 5
                },
                employees: {
                    '5000+': 25,
                    '1000-4999': 20,
                    '500-999': 15,
                    '100-499': 10,
                    '<100': 5
                }
            },
            
            // Engagement Scoring (0-25 points)
            engagement: {
                emailOpens: {
                    weight: 1,
                    max: 10
                },
                emailClicks: {
                    weight: 2,
                    max: 15
                },
                contentDownloads: {
                    weight: 3,
                    max: 15
                },
                webinarAttendance: {
                    weight: 5,
                    max: 10
                },
                demoRequest: {
                    weight: 10,
                    max: 10
                }
            },
            
            // Intent Scoring (0-30 points)
            intent: {
                pricingPageVisits: 8,
                roiCalculatorCompletion: 10,
                caseStudyViews: 5,
                competitorComparison: 7,
                implementationGuideDownload: 8,
                contactSalesForm: 10,
                repeatVisits: {
                    '10+': 10,
                    '5-9': 7,
                    '3-4': 5,
                    '1-2': 2
                }
            },
            
            // Industry Fit (0-15 points)
            industryFit: {
                'shipping_line': 15,
                'freight_forwarder': 15,
                'nvocc': 12,
                'terminal_operator': 10,
                'logistics_provider': 8,
                'other': 3
            },
            
            // Budget Indicators (0-10 points)
            budgetQualification: {
                explicitBudget: {
                    '1M+': 10,
                    '500K-1M': 8,
                    '250K-500K': 6,
                    '100K-250K': 4,
                    '<100K': 2
                },
                budgetTimeline: {
                    'immediate': 10,
                    'this_quarter': 8,
                    'this_year': 5,
                    'next_year': 3,
                    'no_budget': 0
                }
            }
        };
        
        this.leadGrades = {
            'A': { min: 85, label: 'Hot Lead', action: 'immediate_sales_contact' },
            'B': { min: 70, label: 'Warm Lead', action: 'priority_nurture' },
            'C': { min: 50, label: 'Developing Lead', action: 'standard_nurture' },
            'D': { min: 30, label: 'Early Stage', action: 'education_track' },
            'F': { min: 0, label: 'Not Qualified', action: 'marketing_only' }
        };
    }
    
    // Calculate comprehensive lead score
    calculateLeadScore(leadData) {
        let totalScore = 0;
        let scoreBreakdown = {};
        
        // Company Size Score
        const companySizeScore = this.calculateCompanySizeScore(leadData);
        totalScore += companySizeScore;
        scoreBreakdown.companySize = companySizeScore;
        
        // Engagement Score
        const engagementScore = this.calculateEngagementScore(leadData.engagement);
        totalScore += engagementScore;
        scoreBreakdown.engagement = engagementScore;
        
        // Intent Score
        const intentScore = this.calculateIntentScore(leadData.behavior);
        totalScore += intentScore;
        scoreBreakdown.intent = intentScore;
        
        // Industry Fit Score
        const industryScore = this.scoringRules.industryFit[leadData.industry] || 3;
        totalScore += industryScore;
        scoreBreakdown.industryFit = industryScore;
        
        // Budget Qualification Score
        const budgetScore = this.calculateBudgetScore(leadData.budget);
        totalScore += budgetScore;
        scoreBreakdown.budget = budgetScore;
        
        // Determine lead grade
        const grade = this.getLeadGrade(totalScore);
        
        // Calculate velocity score (how fast they're progressing)
        const velocityScore = this.calculateVelocityScore(leadData.timeline);
        
        return {
            totalScore,
            scoreBreakdown,
            grade: grade.label,
            gradeLevel: this.getGradeLevel(totalScore),
            recommendedAction: grade.action,
            velocityScore,
            scoringDate: new Date().toISOString(),
            nextReviewDate: this.calculateNextReviewDate(grade, velocityScore)
        };
    }
    
    calculateCompanySizeScore(leadData) {
        let score = 0;
        
        // Vessel count score
        if (leadData.vesselCount) {
            for (const [range, points] of Object.entries(this.scoringRules.companySize.vessels)) {
                if (this.matchesRange(leadData.vesselCount, range)) {
                    score = Math.max(score, points);
                    break;
                }
            }
        }
        
        // Revenue score (if available)
        if (leadData.revenue) {
            for (const [range, points] of Object.entries(this.scoringRules.companySize.revenue)) {
                if (this.matchesRevenueRange(leadData.revenue, range)) {
                    score = Math.max(score, points);
                    break;
                }
            }
        }
        
        return score;
    }
    
    calculateEngagementScore(engagement) {
        if (!engagement) return 0;
        
        let score = 0;
        const rules = this.scoringRules.engagement;
        
        // Email engagement
        if (engagement.emailOpens) {
            score += Math.min(engagement.emailOpens * rules.emailOpens.weight, rules.emailOpens.max);
        }
        
        if (engagement.emailClicks) {
            score += Math.min(engagement.emailClicks * rules.emailClicks.weight, rules.emailClicks.max);
        }
        
        // Content engagement
        if (engagement.contentDownloads) {
            score += Math.min(engagement.contentDownloads * rules.contentDownloads.weight, rules.contentDownloads.max);
        }
        
        // High-value engagement
        if (engagement.webinarAttendance) {
            score += rules.webinarAttendance.weight * engagement.webinarAttendance;
        }
        
        if (engagement.demoRequest) {
            score += rules.demoRequest.weight;
        }
        
        return Math.min(score, 25); // Cap at max engagement score
    }
    
    calculateIntentScore(behavior) {
        if (!behavior) return 0;
        
        let score = 0;
        const rules = this.scoringRules.intent;
        
        // High-intent actions
        if (behavior.pricingPageVisits > 0) {
            score += rules.pricingPageVisits;
        }
        
        if (behavior.roiCalculatorCompleted) {
            score += rules.roiCalculatorCompletion;
        }
        
        if (behavior.caseStudyViews > 0) {
            score += Math.min(behavior.caseStudyViews * 2, rules.caseStudyViews);
        }
        
        if (behavior.competitorComparisonViewed) {
            score += rules.competitorComparison;
        }
        
        if (behavior.implementationGuideDownloaded) {
            score += rules.implementationGuideDownload;
        }
        
        // Repeat visit scoring
        if (behavior.totalVisits) {
            for (const [range, points] of Object.entries(rules.repeatVisits)) {
                if (this.matchesVisitRange(behavior.totalVisits, range)) {
                    score += points;
                    break;
                }
            }
        }
        
        return Math.min(score, 30); // Cap at max intent score
    }
    
    calculateBudgetScore(budget) {
        if (!budget) return 0;
        
        let score = 0;
        
        // Explicit budget
        if (budget.amount) {
            for (const [range, points] of Object.entries(this.scoringRules.budgetQualification.explicitBudget)) {
                if (this.matchesBudgetRange(budget.amount, range)) {
                    score = points;
                    break;
                }
            }
        }
        
        // Budget timeline
        if (budget.timeline) {
            const timelineScore = this.scoringRules.budgetQualification.budgetTimeline[budget.timeline] || 0;
            score = Math.max(score, timelineScore);
        }
        
        return score;
    }
    
    calculateVelocityScore(timeline) {
        if (!timeline || !timeline.firstTouch || !timeline.lastTouch) return 0;
        
        const daysSinceFirst = this.daysBetween(new Date(timeline.firstTouch), new Date());
        const daysSinceLast = this.daysBetween(new Date(timeline.lastTouch), new Date());
        const touchpoints = timeline.touchpoints || 1;
        
        // Calculate engagement velocity
        const velocity = touchpoints / daysSinceFirst;
        const recency = Math.max(0, 10 - daysSinceLast); // Decay over 10 days
        
        return Math.round((velocity * 50) + (recency * 5));
    }
    
    getLeadGrade(score) {
        for (const [grade, config] of Object.entries(this.leadGrades)) {
            if (score >= config.min) {
                return config;
            }
        }
        return this.leadGrades.F;
    }
    
    getGradeLevel(score) {
        if (score >= 85) return 'A';
        if (score >= 70) return 'B';
        if (score >= 50) return 'C';
        if (score >= 30) return 'D';
        return 'F';
    }
    
    // Utility functions
    matchesRange(value, range) {
        if (range.includes('+')) {
            const min = parseInt(range.replace('+', ''));
            return value >= min;
        } else if (range.includes('-')) {
            const [min, max] = range.split('-').map(v => parseInt(v));
            return value >= min && value <= max;
        } else {
            return value == parseInt(range);
        }
    }
    
    matchesRevenueRange(revenue, range) {
        const multipliers = { 'M': 1000000, 'B': 1000000000 };
        const getValue = (str) => {
            const match = str.match(/(\d+)([MB])/);
            if (match) {
                return parseInt(match[1]) * multipliers[match[2]];
            }
            return parseInt(str);
        };
        
        if (range.includes('+')) {
            const min = getValue(range.replace('+', ''));
            return revenue >= min;
        } else if (range.includes('-')) {
            const [minStr, maxStr] = range.split('-');
            return revenue >= getValue(minStr) && revenue <= getValue(maxStr);
        } else if (range.startsWith('<')) {
            return revenue < getValue(range.substring(1));
        }
        return false;
    }
    
    matchesVisitRange(visits, range) {
        if (range.includes('+')) {
            return visits >= parseInt(range.replace('+', ''));
        } else if (range.includes('-')) {
            const [min, max] = range.split('-').map(v => parseInt(v));
            return visits >= min && visits <= max;
        }
        return false;
    }
    
    matchesBudgetRange(budget, range) {
        return this.matchesRevenueRange(budget, range);
    }
    
    daysBetween(date1, date2) {
        const diff = Math.abs(date2 - date1);
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }
    
    calculateNextReviewDate(grade, velocityScore) {
        const daysUntilReview = {
            'A': 1,
            'B': 3,
            'C': 7,
            'D': 14,
            'F': 30
        };
        
        let days = daysUntilReview[grade.label] || 30;
        
        // Adjust based on velocity
        if (velocityScore > 80) {
            days = Math.max(1, days - 2);
        } else if (velocityScore > 60) {
            days = Math.max(1, days - 1);
        }
        
        const reviewDate = new Date();
        reviewDate.setDate(reviewDate.getDate() + days);
        return reviewDate.toISOString();
    }
    
    // Real-time scoring update
    updateLeadScore(leadId, newActivity) {
        // This would typically update the lead's score in the database
        // and trigger appropriate actions based on score changes
        const updatedScore = this.recalculateWithActivity(leadId, newActivity);
        
        // Check for significant score changes
        if (updatedScore.significantChange) {
            this.triggerScoreChangeActions(leadId, updatedScore);
        }
        
        return updatedScore;
    }
    
    triggerScoreChangeActions(leadId, scoreData) {
        // Grade improvement
        if (scoreData.gradeImproved) {
            this.notifySales(leadId, 'grade_improved', scoreData);
        }
        
        // Hot lead alert
        if (scoreData.gradeLevel === 'A' && scoreData.previousGrade !== 'A') {
            this.createSalesAlert(leadId, 'new_hot_lead', scoreData);
        }
        
        // High velocity alert
        if (scoreData.velocityScore > 90) {
            this.createSalesAlert(leadId, 'high_velocity_lead', scoreData);
        }
    }
}

// Export for use in lead capture and CRM integration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LeadScoringEngine;
}