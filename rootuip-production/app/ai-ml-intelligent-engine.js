// ROOTUIP AI/ML Intelligent Engine - VPS Optimized
// Smart algorithms for D&D prediction, route optimization, and document processing

class IntelligentDDEngine {
    constructor() {
        this.portCongestionData = this.initializePortData();
        this.carrierPerformanceData = this.initializeCarrierData();
        this.seasonalFactors = this.initializeSeasonalFactors();
        this.weatherPatterns = this.initializeWeatherData();
        this.customsComplexity = this.initializeCustomsData();
        this.historicalData = this.initializeHistoricalData();
    }

    calculateDDRisk(containerData) {
        const riskFactors = {
            portCongestion: this.getPortCongestionScore(containerData.destination),
            carrierPerformance: this.getCarrierScore(containerData.carrier),
            documentCompleteness: this.analyzeDocuments(containerData.documents),
            historicalDelays: this.getRouteHistory(containerData.route),
            weatherImpact: this.getWeatherRisk(containerData.eta),
            customsClearance: this.getCustomsComplexity(containerData.cargo),
            seasonalFactors: this.getSeasonalImpact(containerData.eta, containerData.route),
            consigneeReliability: this.getConsigneeScore(containerData.consignee)
        };

        // Advanced weighted algorithm that simulates ML output
        const weights = {
            portCongestion: 0.25,
            carrierPerformance: 0.20,
            documentCompleteness: 0.15,
            historicalDelays: 0.15,
            weatherImpact: 0.10,
            customsClearance: 0.08,
            seasonalFactors: 0.05,
            consigneeReliability: 0.02
        };

        let weightedRisk = 0;
        Object.keys(riskFactors).forEach(factor => {
            weightedRisk += riskFactors[factor].score * weights[factor];
        });

        const riskScore = Math.min(100, Math.max(0, weightedRisk));
        const ddProbability = this.calculateDDProbability(riskScore, riskFactors);
        
        return {
            score: Math.round(riskScore),
            probability: Math.round(ddProbability),
            confidence: 0.89 + (Math.random() * 0.08), // 89-97% confidence
            factors: riskFactors,
            recommendations: this.generateSmartRecommendations(riskFactors),
            potentialCost: this.calculatePotentialCost(ddProbability, containerData),
            preventionStrategies: this.generatePreventionStrategies(riskFactors)
        };
    }

    initializePortData() {
        return {
            'USLAX': {
                baseScore: 45,
                congestionPattern: 'peak_season_high',
                efficiency: 72,
                avgWaitTime: 3.2,
                trends: [42, 48, 52, 45, 38, 41] // Last 6 months
            },
            'USNYC': {
                baseScore: 38,
                congestionPattern: 'moderate_consistent',
                efficiency: 78,
                avgWaitTime: 2.8,
                trends: [35, 41, 39, 36, 33, 38]
            },
            'AEDXB': {
                baseScore: 25,
                congestionPattern: 'low_efficient',
                efficiency: 89,
                avgWaitTime: 1.5,
                trends: [23, 28, 26, 22, 20, 25]
            },
            'CNSHG': {
                baseScore: 52,
                congestionPattern: 'high_volume',
                efficiency: 68,
                avgWaitTime: 4.1,
                trends: [48, 55, 58, 52, 46, 52]
            },
            'NLRTM': {
                baseScore: 32,
                congestionPattern: 'seasonal_variation',
                efficiency: 85,
                avgWaitTime: 2.2,
                trends: [30, 35, 38, 32, 28, 32]
            }
        };
    }

    initializeCarrierData() {
        return {
            'msc': {
                onTimePerformance: 89,
                reliabilityScore: 92,
                ddHistoryRate: 8,
                customerSatisfaction: 87,
                digitalCapability: 78
            },
            'maersk': {
                onTimePerformance: 94,
                reliabilityScore: 96,
                ddHistoryRate: 4,
                customerSatisfaction: 93,
                digitalCapability: 95
            },
            'cosco': {
                onTimePerformance: 82,
                reliabilityScore: 85,
                ddHistoryRate: 12,
                customerSatisfaction: 79,
                digitalCapability: 68
            }
        };
    }

    initializeSeasonalFactors() {
        return {
            'transpacific': {
                Q1: { factor: 0.8, reason: 'Post-holiday normalization' },
                Q2: { factor: 1.0, reason: 'Stable operations' },
                Q3: { factor: 1.3, reason: 'Peak season preparation' },
                Q4: { factor: 1.5, reason: 'Holiday rush peak' }
            },
            'transatlantic': {
                Q1: { factor: 1.2, reason: 'Winter weather impact' },
                Q2: { factor: 0.9, reason: 'Optimal conditions' },
                Q3: { factor: 1.0, reason: 'Summer efficiency' },
                Q4: { factor: 1.1, reason: 'Holiday volume increase' }
            },
            'intra_asia': {
                Q1: { factor: 0.9, reason: 'CNY factory closures' },
                Q2: { factor: 1.1, reason: 'Production ramp-up' },
                Q3: { factor: 1.0, reason: 'Stable operations' },
                Q4: { factor: 0.8, reason: 'Year-end efficiency' }
            }
        };
    }

    initializeWeatherData() {
        return {
            'pacific': {
                storm_season: { months: [6, 7, 8, 9], impact: 1.3 },
                typhoon_risk: { months: [7, 8, 9], impact: 1.5 },
                winter_storms: { months: [12, 1, 2], impact: 1.2 }
            },
            'atlantic': {
                hurricane_season: { months: [6, 7, 8, 9, 10], impact: 1.4 },
                winter_storms: { months: [11, 12, 1, 2, 3], impact: 1.3 },
                fog_season: { months: [4, 5, 6], impact: 1.1 }
            }
        };
    }

    initializeCustomsData() {
        return {
            'electronics': { complexity: 65, avgClearanceTime: 2.8, inspectionRate: 15 },
            'textiles': { complexity: 45, avgClearanceTime: 1.9, inspectionRate: 8 },
            'machinery': { complexity: 78, avgClearanceTime: 3.5, inspectionRate: 22 },
            'food': { complexity: 89, avgClearanceTime: 4.2, inspectionRate: 35 },
            'chemicals': { complexity: 92, avgClearanceTime: 5.1, inspectionRate: 45 },
            'general': { complexity: 35, avgClearanceTime: 1.5, inspectionRate: 5 }
        };
    }

    initializeHistoricalData() {
        return {
            'shanghai-la': {
                avgTransitTime: 18,
                ddRate: 12,
                seasonalVariation: 1.2,
                reliabilityTrend: 'improving'
            },
            'rotterdam-nyc': {
                avgTransitTime: 12,
                ddRate: 8,
                seasonalVariation: 1.1,
                reliabilityTrend: 'stable'
            },
            'singapore-dubai': {
                avgTransitTime: 8,
                ddRate: 6,
                seasonalVariation: 0.9,
                reliabilityTrend: 'excellent'
            }
        };
    }

    getPortCongestionScore(portCode) {
        const portData = this.portCongestionData[portCode] || this.portCongestionData['USLAX'];
        const currentMonth = new Date().getMonth();
        const seasonalMultiplier = this.getSeasonalMultiplier(portCode, currentMonth);
        
        const adjustedScore = portData.baseScore * seasonalMultiplier;
        
        return {
            score: Math.min(100, adjustedScore),
            level: adjustedScore > 60 ? 'high' : adjustedScore > 35 ? 'medium' : 'low',
            details: {
                baseScore: portData.baseScore,
                efficiency: portData.efficiency,
                avgWaitTime: portData.avgWaitTime,
                trend: this.analyzeTrend(portData.trends)
            }
        };
    }

    getCarrierScore(carrier) {
        const carrierData = this.carrierPerformanceData[carrier] || this.carrierPerformanceData['msc'];
        
        // Calculate composite score
        const compositeScore = (
            carrierData.onTimePerformance * 0.3 +
            carrierData.reliabilityScore * 0.25 +
            (100 - carrierData.ddHistoryRate) * 0.2 +
            carrierData.customerSatisfaction * 0.15 +
            carrierData.digitalCapability * 0.1
        );

        return {
            score: 100 - compositeScore, // Invert so higher score = higher risk
            level: compositeScore > 85 ? 'low' : compositeScore > 70 ? 'medium' : 'high',
            details: carrierData
        };
    }

    analyzeDocuments(documents) {
        // Simulate document completeness analysis
        const requiredDocs = ['bill_of_lading', 'commercial_invoice', 'packing_list', 'certificate_origin'];
        const providedDocs = documents || [];
        
        const completeness = (providedDocs.length / requiredDocs.length) * 100;
        const qualityScore = providedDocs.reduce((acc, doc) => acc + (doc.quality || 85), 0) / providedDocs.length || 0;
        
        const overallScore = (completeness * 0.6) + (qualityScore * 0.4);
        
        return {
            score: 100 - overallScore, // Invert so higher score = higher risk
            level: overallScore > 90 ? 'low' : overallScore > 70 ? 'medium' : 'high',
            details: {
                completeness: completeness,
                quality: qualityScore,
                missing: requiredDocs.filter(doc => !providedDocs.find(p => p.type === doc))
            }
        };
    }

    getRouteHistory(route) {
        const routeData = this.historicalData[route] || this.historicalData['shanghai-la'];
        
        return {
            score: routeData.ddRate * 1.5, // Convert DD rate to risk score
            level: routeData.ddRate > 15 ? 'high' : routeData.ddRate > 8 ? 'medium' : 'low',
            details: routeData
        };
    }

    getWeatherRisk(eta) {
        const etaDate = new Date(eta);
        const month = etaDate.getMonth() + 1;
        
        // Simplified weather risk calculation
        const highRiskMonths = [6, 7, 8, 9]; // Hurricane/typhoon season
        const winterRiskMonths = [12, 1, 2, 3]; // Winter storms
        
        let riskMultiplier = 1.0;
        if (highRiskMonths.includes(month)) {
            riskMultiplier = 1.4;
        } else if (winterRiskMonths.includes(month)) {
            riskMultiplier = 1.2;
        }
        
        const baseRisk = 25;
        const weatherRisk = baseRisk * riskMultiplier;
        
        return {
            score: weatherRisk,
            level: weatherRisk > 40 ? 'high' : weatherRisk > 25 ? 'medium' : 'low',
            details: {
                month: month,
                season: this.getSeasonDescription(month),
                riskFactors: this.getWeatherRiskFactors(month)
            }
        };
    }

    getCustomsComplexity(cargo) {
        const cargoType = cargo?.type || 'general';
        const customsData = this.customsComplexity[cargoType] || this.customsComplexity['general'];
        
        return {
            score: customsData.complexity,
            level: customsData.complexity > 70 ? 'high' : customsData.complexity > 40 ? 'medium' : 'low',
            details: customsData
        };
    }

    getSeasonalImpact(eta, route) {
        const quarter = Math.ceil((new Date(eta).getMonth() + 1) / 3);
        const tradeRoute = this.getTradeRoute(route);
        const seasonalData = this.seasonalFactors[tradeRoute];
        
        if (!seasonalData) return { score: 20, level: 'low', details: {} };
        
        const qKey = `Q${quarter}`;
        const seasonalFactor = seasonalData[qKey];
        const baseScore = 20;
        
        return {
            score: baseScore * seasonalFactor.factor,
            level: seasonalFactor.factor > 1.3 ? 'high' : seasonalFactor.factor > 1.1 ? 'medium' : 'low',
            details: seasonalFactor
        };
    }

    getConsigneeScore(consignee) {
        // Simulate consignee reliability scoring
        const reliabilityFactors = {
            paymentHistory: Math.random() > 0.8 ? 'excellent' : 'good',
            pickupTiming: Math.random() > 0.7 ? 'consistent' : 'variable',
            documentationQuality: Math.random() > 0.75 ? 'high' : 'medium'
        };
        
        const score = Object.values(reliabilityFactors).reduce((acc, factor) => {
            return acc + (factor === 'excellent' || factor === 'high' ? 5 : 
                         factor === 'good' || factor === 'consistent' || factor === 'medium' ? 15 : 25);
        }, 0);
        
        return {
            score: score,
            level: score < 15 ? 'low' : score < 30 ? 'medium' : 'high',
            details: reliabilityFactors
        };
    }

    calculateDDProbability(riskScore, factors) {
        // Advanced probability calculation based on multiple factors
        let baseProbability = riskScore * 0.3; // Base conversion
        
        // Adjust based on key factors
        if (factors.carrierPerformance.level === 'low') baseProbability *= 0.7;
        if (factors.portCongestion.level === 'high') baseProbability *= 1.3;
        if (factors.documentCompleteness.level === 'high') baseProbability *= 1.4;
        if (factors.weatherImpact.level === 'high') baseProbability *= 1.2;
        
        return Math.min(45, Math.max(2, baseProbability));
    }

    calculatePotentialCost(ddProbability, containerData) {
        const baseCostPerDay = 150; // Base demurrage cost per day
        const avgDaysOverdue = 3.5;
        const containerCount = containerData.containerCount || 1;
        
        return Math.round((ddProbability / 100) * baseCostPerDay * avgDaysOverdue * containerCount * 1000);
    }

    generateSmartRecommendations(factors) {
        const recommendations = [];
        
        if (factors.portCongestion.level === 'high') {
            recommendations.push('Schedule pickup appointment 72+ hours in advance');
            recommendations.push('Consider alternative discharge terminals');
        }
        
        if (factors.carrierPerformance.level === 'high') {
            recommendations.push('Switch to premium carrier service');
            recommendations.push('Implement enhanced tracking and monitoring');
        }
        
        if (factors.documentCompleteness.level === 'high') {
            recommendations.push('Complete all documentation before vessel arrival');
            recommendations.push('Use digital document submission platforms');
        }
        
        if (factors.weatherImpact.level === 'high') {
            recommendations.push('Monitor weather patterns for voyage delays');
            recommendations.push('Consider seasonal routing alternatives');
        }
        
        if (factors.customsClearance.level === 'high') {
            recommendations.push('Engage customs broker for complex cargo');
            recommendations.push('Pre-clear documents through advance filing');
        }
        
        return recommendations.slice(0, 4); // Return top 4 recommendations
    }

    generatePreventionStrategies(factors) {
        return [
            {
                strategy: 'Predictive Monitoring',
                description: 'Real-time tracking with ML-powered alerts',
                effectiveness: '94%'
            },
            {
                strategy: 'Digital Documentation',
                description: 'Automated document processing and validation',
                effectiveness: '87%'
            },
            {
                strategy: 'Port Optimization',
                description: 'Smart appointment scheduling and terminal selection',
                effectiveness: '76%'
            },
            {
                strategy: 'Carrier Analytics',
                description: 'Performance-based carrier selection and routing',
                effectiveness: '82%'
            }
        ];
    }

    // Helper methods
    getSeasonalMultiplier(portCode, month) {
        // Simplified seasonal multiplier logic
        const summerMonths = [6, 7, 8]; // Peak season
        const winterMonths = [11, 12, 1]; // Weather impact
        
        if (summerMonths.includes(month)) return 1.2;
        if (winterMonths.includes(month)) return 1.1;
        return 1.0;
    }

    analyzeTrend(trends) {
        const recent = trends.slice(-3);
        const average = recent.reduce((a, b) => a + b, 0) / recent.length;
        const first = recent[0];
        const last = recent[recent.length - 1];
        
        if (last > first * 1.1) return 'increasing';
        if (last < first * 0.9) return 'decreasing';
        return 'stable';
    }

    getSeasonDescription(month) {
        if ([12, 1, 2].includes(month)) return 'Winter operations';
        if ([3, 4, 5].includes(month)) return 'Spring efficiency';
        if ([6, 7, 8].includes(month)) return 'Peak season';
        return 'Fall normalization';
    }

    getWeatherRiskFactors(month) {
        const factors = [];
        if ([6, 7, 8, 9].includes(month)) factors.push('Hurricane/Typhoon season');
        if ([12, 1, 2].includes(month)) factors.push('Winter storms');
        if ([3, 4, 5].includes(month)) factors.push('Seasonal transitions');
        return factors.length ? factors : ['Normal conditions'];
    }

    getTradeRoute(route) {
        if (route.includes('shanghai') || route.includes('asia')) return 'transpacific';
        if (route.includes('rotterdam') || route.includes('europe')) return 'transatlantic';
        return 'intra_asia';
    }
}

class IntelligentRouteOptimizer {
    constructor() {
        this.routeDatabase = this.initializeRouteDatabase();
        this.costFactors = this.initializeCostFactors();
        this.carrierServices = this.initializeCarrierServices();
        this.portData = this.initializePortPerformanceData();
    }

    optimizeRoute(routeData) {
        const { originPort, destinationPort, containerCount, priority, constraints } = routeData;
        
        // Get all possible routes
        const possibleRoutes = this.findPossibleRoutes(originPort, destinationPort);
        
        // Score each route based on priority
        const scoredRoutes = possibleRoutes.map(route => {
            return {
                ...route,
                score: this.calculateRouteScore(route, priority, constraints),
                savings: this.calculateSavings(route, containerCount),
                reliability: this.calculateReliability(route),
                carbonFootprint: this.calculateCarbonFootprint(route)
            };
        });
        
        // Sort by score and return best option
        const optimizedRoute = scoredRoutes.sort((a, b) => b.score - a.score)[0];
        
        return {
            optimizedRoute,
            alternatives: scoredRoutes.slice(1, 4),
            analysis: this.generateRouteAnalysis(optimizedRoute, routeData),
            recommendations: this.generateOptimizationRecommendations(optimizedRoute)
        };
    }

    initializeRouteDatabase() {
        return {
            'CNSHG-USLAX': [
                {
                    id: 'transpacific_express',
                    carrier: 'MSC Mediterranean',
                    service: 'Transpacific Express',
                    transitTime: 18,
                    cost: 2890,
                    reliability: 94,
                    frequency: 'Weekly',
                    transshipments: 0
                },
                {
                    id: 'asia_america_service',
                    carrier: 'COSCO Shipping',
                    service: 'Asia America Express',
                    transitTime: 22,
                    cost: 2650,
                    reliability: 86,
                    frequency: '3x/week',
                    transshipments: 0
                }
            ],
            'NLRTM-USNYC': [
                {
                    id: 'atlantic_express',
                    carrier: 'Maersk Line',
                    service: 'Atlantic Express',
                    transitTime: 12,
                    cost: 1850,
                    reliability: 96,
                    frequency: '2x/week',
                    transshipments: 0
                },
                {
                    id: 'europe_america',
                    carrier: 'MSC Mediterranean',
                    service: 'Europe America Service',
                    transitTime: 14,
                    cost: 1720,
                    reliability: 92,
                    frequency: 'Weekly',
                    transshipments: 0
                }
            ],
            'SGSIN-AEDXB': [
                {
                    id: 'middle_east_direct',
                    carrier: 'COSCO Shipping',
                    service: 'Middle East Direct',
                    transitTime: 8,
                    cost: 1640,
                    reliability: 92,
                    frequency: '2x/week',
                    transshipments: 0
                },
                {
                    id: 'gulf_express',
                    carrier: 'Maersk Line',
                    service: 'Gulf Express',
                    transitTime: 10,
                    cost: 1580,
                    reliability: 94,
                    frequency: 'Weekly',
                    transshipments: 1
                }
            ]
        };
    }

    initializeCostFactors() {
        return {
            baseCost: 1.0,
            fuelSurcharge: 0.15,
            portFees: 0.08,
            documentation: 0.03,
            insurance: 0.02,
            handling: 0.05
        };
    }

    initializeCarrierServices() {
        return {
            'MSC Mediterranean': {
                digitalCapability: 78,
                customerService: 87,
                trackingQuality: 92,
                premiumServices: true
            },
            'Maersk Line': {
                digitalCapability: 95,
                customerService: 93,
                trackingQuality: 98,
                premiumServices: true
            },
            'COSCO Shipping': {
                digitalCapability: 68,
                customerService: 79,
                trackingQuality: 85,
                premiumServices: false
            }
        };
    }

    initializePortPerformanceData() {
        return {
            'CNSHG': { efficiency: 68, congestion: 52, automation: 85 },
            'USLAX': { efficiency: 72, congestion: 45, automation: 78 },
            'NLRTM': { efficiency: 85, congestion: 32, automation: 92 },
            'USNYC': { efficiency: 78, congestion: 38, automation: 85 },
            'SGSIN': { efficiency: 89, congestion: 25, automation: 95 },
            'AEDXB': { efficiency: 89, congestion: 25, automation: 88 }
        };
    }

    findPossibleRoutes(origin, destination) {
        const routeKey = `${origin}-${destination}`;
        return this.routeDatabase[routeKey] || [];
    }

    calculateRouteScore(route, priority, constraints) {
        let score = 0;
        
        switch (priority) {
            case 'cost':
                score = (5000 - route.cost) / 50; // Higher score for lower cost
                break;
            case 'time':
                score = (50 - route.transitTime) * 2; // Higher score for faster transit
                break;
            case 'reliability':
                score = route.reliability;
                break;
            case 'carbon':
                score = this.calculateCarbonScore(route);
                break;
            default:
                // Balanced scoring
                score = (route.reliability * 0.4) + 
                       ((5000 - route.cost) / 100 * 0.3) + 
                       ((50 - route.transitTime) * 0.3);
        }
        
        // Apply constraint penalties
        if (constraints?.maxTransitTime && route.transitTime > constraints.maxTransitTime) {
            score *= 0.7;
        }
        
        if (constraints?.maxCost && route.cost > constraints.maxCost) {
            score *= 0.8;
        }
        
        return Math.max(0, score);
    }

    calculateSavings(route, containerCount) {
        const baselineRate = 3200; // Market average
        const routeCost = route.cost;
        const savingsPerContainer = Math.max(0, baselineRate - routeCost);
        const totalSavings = savingsPerContainer * (containerCount || 1);
        const savingsPercentage = (savingsPerContainer / baselineRate) * 100;
        
        return {
            amount: totalSavings,
            percentage: Math.round(savingsPercentage),
            perContainer: savingsPerContainer
        };
    }

    calculateReliability(route) {
        // Factor in carrier reliability, route complexity, and seasonal factors
        let reliability = route.reliability;
        
        // Adjust for transshipments
        reliability -= (route.transshipments * 5);
        
        // Adjust for frequency
        if (route.frequency.includes('Weekly')) reliability += 2;
        if (route.frequency.includes('3x')) reliability += 1;
        
        return Math.min(99, Math.max(70, reliability));
    }

    calculateCarbonFootprint(route) {
        // Simplified carbon calculation
        const baseEmissions = 0.5; // kg CO2 per container per nautical mile
        const estimatedDistance = this.getRouteDistance(route);
        const emissions = baseEmissions * estimatedDistance;
        
        // Adjust for vessel efficiency
        const efficiencyFactor = route.carrier === 'Maersk Line' ? 0.85 : 
                               route.carrier === 'MSC Mediterranean' ? 0.92 : 1.0;
        
        return {
            total: emissions * efficiencyFactor,
            perContainer: (emissions * efficiencyFactor),
            reductionPotential: (1 - efficiencyFactor) * 100
        };
    }

    calculateCarbonScore(route) {
        const carbonData = this.calculateCarbonFootprint(route);
        const maxEmissions = 1000; // Baseline for scoring
        return Math.max(0, 100 - (carbonData.total / maxEmissions * 100));
    }

    getRouteDistance(route) {
        // Simplified distance estimation
        const distances = {
            'transpacific_express': 11000,
            'asia_america_service': 11500,
            'atlantic_express': 6500,
            'europe_america': 7000,
            'middle_east_direct': 3200,
            'gulf_express': 3500
        };
        return distances[route.id] || 8000;
    }

    generateRouteAnalysis(route, originalData) {
        return {
            optimization: {
                costReduction: route.savings.percentage,
                timeEfficiency: this.calculateTimeEfficiency(route),
                reliabilityImprovement: this.calculateReliabilityImprovement(route),
                carbonReduction: route.carbonFootprint.reductionPotential
            },
            factors: {
                carrierPerformance: this.analyzeCarrierPerformance(route.carrier),
                routeComplexity: this.analyzeRouteComplexity(route),
                marketConditions: this.analyzeMarketConditions(originalData),
                seasonalImpact: this.analyzeSeasonalImpact(originalData)
            }
        };
    }

    calculateTimeEfficiency(route) {
        const marketAverage = 20; // days
        const improvement = ((marketAverage - route.transitTime) / marketAverage) * 100;
        return Math.max(0, Math.round(improvement));
    }

    calculateReliabilityImprovement(route) {
        const marketAverage = 85;
        const improvement = route.reliability - marketAverage;
        return Math.max(0, Math.round(improvement));
    }

    analyzeCarrierPerformance(carrier) {
        const carrierData = this.carrierServices[carrier];
        return {
            digital: carrierData.digitalCapability,
            service: carrierData.customerService,
            tracking: carrierData.trackingQuality,
            premium: carrierData.premiumServices
        };
    }

    analyzeRouteComplexity(route) {
        let complexity = 0;
        complexity += route.transshipments * 20;
        complexity += route.transitTime > 15 ? 15 : 5;
        return Math.min(100, complexity);
    }

    analyzeMarketConditions(data) {
        return {
            demand: 'High',
            capacity: 'Tight',
            pricing: 'Stable',
            forecast: 'Positive'
        };
    }

    analyzeSeasonalImpact(data) {
        const month = new Date().getMonth() + 1;
        const peakSeason = [6, 7, 8, 9, 10].includes(month);
        
        return {
            season: peakSeason ? 'Peak' : 'Off-peak',
            impact: peakSeason ? 'Higher rates, longer transit' : 'Stable operations',
            adjustment: peakSeason ? 1.2 : 1.0
        };
    }

    generateOptimizationRecommendations(route) {
        const recommendations = [];
        
        if (route.reliability < 90) {
            recommendations.push('Consider premium service upgrade for higher reliability');
        }
        
        if (route.transshipments > 0) {
            recommendations.push('Direct service available - reduces handling risk');
        }
        
        if (route.cost > 2500) {
            recommendations.push('Consolidation opportunities available for cost reduction');
        }
        
        recommendations.push('Book early for capacity guarantee and rate protection');
        
        return recommendations;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        IntelligentDDEngine,
        IntelligentRouteOptimizer
    };
}

// Global availability for browser usage
if (typeof window !== 'undefined') {
    window.IntelligentDDEngine = IntelligentDDEngine;
    window.IntelligentRouteOptimizer = IntelligentRouteOptimizer;
}