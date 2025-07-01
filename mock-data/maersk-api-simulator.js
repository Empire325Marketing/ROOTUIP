/**
 * ROOTUIP Maersk API Simulator
 * Creates realistic mock data matching Maersk's actual API response format
 */

const crypto = require('crypto');

class MaerskAPISimulator {
    constructor() {
        this.ports = [
            { code: 'SGSIN', name: 'Singapore', country: 'Singapore', timezone: 'Asia/Singapore' },
            { code: 'NLRTM', name: 'Rotterdam', country: 'Netherlands', timezone: 'Europe/Amsterdam' },
            { code: 'USNYC', name: 'New York', country: 'USA', timezone: 'America/New_York' },
            { code: 'CNSHA', name: 'Shanghai', country: 'China', timezone: 'Asia/Shanghai' },
            { code: 'DEHAM', name: 'Hamburg', country: 'Germany', timezone: 'Europe/Berlin' },
            { code: 'JPTYO', name: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo' },
            { code: 'USLAX', name: 'Los Angeles', country: 'USA', timezone: 'America/Los_Angeles' },
            { code: 'AEDXB', name: 'Dubai', country: 'UAE', timezone: 'Asia/Dubai' }
        ];

        this.vessels = [
            'MAERSK EINDHOVEN', 'MAERSK EDMONTON', 'MAERSK ENSHI',
            'MAERSK EUREKA', 'MAERSK ESSEX', 'MAERSK ELBA',
            'MSC AMSTERDAM', 'MSC ANNA', 'MSC APOLLO',
            'EVER GIVEN', 'EVER GLORY', 'EVER GRADE'
        ];

        this.containerStatuses = [
            'Gate In', 'Loaded on Vessel', 'Vessel Departed', 'Vessel Arrived',
            'Discharged from Vessel', 'Gate Out', 'Empty Return', 'On Rail', 'Customs Hold'
        ];

        this.carriers = ['Maersk', 'MSC', 'CMA CGM', 'Hapag-Lloyd', 'ONE', 'Evergreen'];
    }

    generateContainerNumber() {
        const prefix = ['MSKU', 'MSCU', 'CMAU', 'HLXU', 'ONEU', 'EGLV'][Math.floor(Math.random() * 6)];
        const numbers = Math.floor(Math.random() * 9000000) + 1000000;
        return `${prefix}${numbers}`;
    }

    generateBookingReference() {
        return Math.floor(Math.random() * 900000000) + 100000000;
    }

    generateVoyageNumber() {
        const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        const numbers = Math.floor(Math.random() * 900) + 100;
        const direction = ['E', 'W', 'N', 'S'][Math.floor(Math.random() * 4)];
        return `${numbers}${letter}${direction}`;
    }

    // Generate realistic tracking data matching Maersk API format
    generateTrackingData(containerNumber = null) {
        const container = containerNumber || this.generateContainerNumber();
        const origin = this.ports[Math.floor(Math.random() * this.ports.length)];
        const destination = this.ports[Math.floor(Math.random() * this.ports.length)];
        const vessel = this.vessels[Math.floor(Math.random() * this.vessels.length)];
        const voyage = this.generateVoyageNumber();
        const booking = this.generateBookingReference();

        // Generate journey timeline
        const now = new Date();
        const journeyStart = new Date(now.getTime() - (Math.random() * 30 * 24 * 60 * 60 * 1000)); // Up to 30 days ago
        
        const events = this.generateContainerEvents(journeyStart, origin, destination, vessel, voyage);
        const currentEvent = events.find(e => new Date(e.eventDateTime) <= now && (!events[events.indexOf(e) + 1] || new Date(events[events.indexOf(e) + 1].eventDateTime) > now)) || events[events.length - 1];

        return {
            containerNumber: container,
            bookingReference: booking.toString(),
            isContainerSearch: true,
            containers: [{
                containerNumber: container,
                iso_6346: container,
                status: currentEvent.activityName,
                statusCode: currentEvent.statusCode,
                statusDescription: currentEvent.description,
                lastUpdate: currentEvent.eventDateTime,
                events: events,
                shipmentInfo: {
                    bookingNumber: booking.toString(),
                    vesselName: vessel,
                    voyageNumber: voyage,
                    carrier: this.carriers[Math.floor(Math.random() * this.carriers.length)],
                    service: 'AE7',
                    tradeRoute: `${origin.country}-${destination.country}`,
                    portOfLoading: {
                        code: origin.code,
                        name: origin.name,
                        country: origin.country,
                        estimatedTimeOfLoading: events.find(e => e.activityName === 'Loaded on Vessel')?.eventDateTime
                    },
                    portOfDischarge: {
                        code: destination.code,
                        name: destination.name,
                        country: destination.country,
                        estimatedTimeOfArrival: events.find(e => e.location.code === destination.code && e.activityName === 'Vessel Arrived')?.eventDateTime
                    }
                },
                demurrageInfo: this.generateDemurrageInfo(events, destination),
                detentionInfo: this.generateDetentionInfo(events)
            }]
        };
    }

    generateContainerEvents(startDate, origin, destination, vessel, voyage) {
        const events = [];
        let currentDate = new Date(startDate);

        // Gate In at origin
        events.push({
            eventId: crypto.randomUUID(),
            eventDateTime: currentDate.toISOString(),
            eventClassifierCode: 'ACT',
            activityName: 'Gate In',
            statusCode: 'CGI',
            description: 'Container gate in at terminal',
            location: {
                code: origin.code,
                name: origin.name,
                country: origin.country,
                locationType: 'Terminal'
            },
            vessel: null,
            voyage: null
        });

        // Loaded on vessel (1-3 days later)
        currentDate = new Date(currentDate.getTime() + (1 + Math.random() * 2) * 24 * 60 * 60 * 1000);
        events.push({
            eventId: crypto.randomUUID(),
            eventDateTime: currentDate.toISOString(),
            eventClassifierCode: 'ACT',
            activityName: 'Loaded on Vessel',
            statusCode: 'LOV',
            description: `Container loaded on vessel ${vessel}`,
            location: {
                code: origin.code,
                name: origin.name,
                country: origin.country,
                locationType: 'Port'
            },
            vessel: vessel,
            voyage: voyage
        });

        // Vessel departed (few hours later)
        currentDate = new Date(currentDate.getTime() + (2 + Math.random() * 6) * 60 * 60 * 1000);
        events.push({
            eventId: crypto.randomUUID(),
            eventDateTime: currentDate.toISOString(),
            eventClassifierCode: 'TPT',
            activityName: 'Vessel Departed',
            statusCode: 'VDL',
            description: `Vessel ${vessel} departed from ${origin.name}`,
            location: {
                code: origin.code,
                name: origin.name,
                country: origin.country,
                locationType: 'Port'
            },
            vessel: vessel,
            voyage: voyage
        });

        // Transit time (7-20 days)
        const transitDays = 7 + Math.random() * 13;
        currentDate = new Date(currentDate.getTime() + transitDays * 24 * 60 * 60 * 1000);

        // Vessel arrived at destination
        events.push({
            eventId: crypto.randomUUID(),
            eventDateTime: currentDate.toISOString(),
            eventClassifierCode: 'TPT',
            activityName: 'Vessel Arrived',
            statusCode: 'VAD',
            description: `Vessel ${vessel} arrived at ${destination.name}`,
            location: {
                code: destination.code,
                name: destination.name,
                country: destination.country,
                locationType: 'Port'
            },
            vessel: vessel,
            voyage: voyage,
            estimatedDischargeTime: new Date(currentDate.getTime() + (12 + Math.random() * 24) * 60 * 60 * 1000).toISOString()
        });

        // Discharged from vessel (1-2 days later)
        currentDate = new Date(currentDate.getTime() + (1 + Math.random() * 1) * 24 * 60 * 60 * 1000);
        const dischargeDate = currentDate;
        events.push({
            eventId: crypto.randomUUID(),
            eventDateTime: currentDate.toISOString(),
            eventClassifierCode: 'ACT',
            activityName: 'Discharged from Vessel',
            statusCode: 'DFV',
            description: 'Container discharged from vessel',
            location: {
                code: destination.code,
                name: destination.name,
                country: destination.country,
                locationType: 'Terminal'
            },
            vessel: vessel,
            voyage: voyage,
            yardLocation: `Block ${Math.floor(Math.random() * 20) + 1}, Row ${String.fromCharCode(65 + Math.floor(Math.random() * 10))}, Tier ${Math.floor(Math.random() * 5) + 1}`
        });

        // Simulate potential delays and customs
        if (Math.random() > 0.7) {
            currentDate = new Date(currentDate.getTime() + (1 + Math.random() * 2) * 24 * 60 * 60 * 1000);
            events.push({
                eventId: crypto.randomUUID(),
                eventDateTime: currentDate.toISOString(),
                eventClassifierCode: 'HLD',
                activityName: 'Customs Hold',
                statusCode: 'CSH',
                description: 'Container under customs examination',
                location: {
                    code: destination.code,
                    name: destination.name,
                    country: destination.country,
                    locationType: 'Terminal'
                },
                estimatedReleaseTime: new Date(currentDate.getTime() + (1 + Math.random() * 3) * 24 * 60 * 60 * 1000).toISOString()
            });
        }

        // Gate out (future or past based on current date)
        const gateOutDate = new Date(dischargeDate.getTime() + (3 + Math.random() * 10) * 24 * 60 * 60 * 1000);
        if (gateOutDate <= new Date()) {
            events.push({
                eventId: crypto.randomUUID(),
                eventDateTime: gateOutDate.toISOString(),
                eventClassifierCode: 'ACT',
                activityName: 'Gate Out',
                statusCode: 'CGO',
                description: 'Container gate out from terminal',
                location: {
                    code: destination.code,
                    name: destination.name,
                    country: destination.country,
                    locationType: 'Terminal'
                },
                transportMode: 'Truck',
                truckingCompany: 'ABC Logistics'
            });
        }

        return events;
    }

    generateDemurrageInfo(events, destination) {
        const dischargeEvent = events.find(e => e.activityName === 'Discharged from Vessel');
        const gateOutEvent = events.find(e => e.activityName === 'Gate Out');
        
        if (!dischargeEvent) return null;

        const dischargeDate = new Date(dischargeEvent.eventDateTime);
        const freeTime = Math.floor(Math.random() * 3) + 3; // 3-5 days free time
        const demurrageStartDate = new Date(dischargeDate.getTime() + freeTime * 24 * 60 * 60 * 1000);
        
        const now = new Date();
        const lastRelevantDate = gateOutEvent ? new Date(gateOutEvent.eventDateTime) : now;
        
        const demurrageDays = Math.max(0, Math.floor((lastRelevantDate - demurrageStartDate) / (24 * 60 * 60 * 1000)));
        const rate = 75 + Math.random() * 75; // $75-150 per day

        return {
            freeTimeDays: freeTime,
            demurrageStartDate: demurrageStartDate.toISOString(),
            currentDemurrageDays: demurrageDays,
            demurrageRate: rate.toFixed(2),
            currency: 'USD',
            totalDemurrageCharges: (demurrageDays * rate).toFixed(2),
            lastFreeDay: new Date(demurrageStartDate.getTime() - 24 * 60 * 60 * 1000).toISOString(),
            terminal: destination.name,
            status: gateOutEvent ? 'Closed' : (demurrageDays > 0 ? 'Accruing' : 'In Free Time')
        };
    }

    generateDetentionInfo(events) {
        const gateOutEvent = events.find(e => e.activityName === 'Gate Out');
        const emptyReturnEvent = events.find(e => e.activityName === 'Empty Return');
        
        if (!gateOutEvent) return null;

        const gateOutDate = new Date(gateOutEvent.eventDateTime);
        const freeTime = Math.floor(Math.random() * 5) + 5; // 5-10 days free time
        const detentionStartDate = new Date(gateOutDate.getTime() + freeTime * 24 * 60 * 60 * 1000);
        
        const now = new Date();
        const lastRelevantDate = emptyReturnEvent ? new Date(emptyReturnEvent.eventDateTime) : now;
        
        const detentionDays = Math.max(0, Math.floor((lastRelevantDate - detentionStartDate) / (24 * 60 * 60 * 1000)));
        const rate = 50 + Math.random() * 50; // $50-100 per day

        return {
            freeTimeDays: freeTime,
            detentionStartDate: detentionStartDate.toISOString(),
            currentDetentionDays: detentionDays,
            detentionRate: rate.toFixed(2),
            currency: 'USD',
            totalDetentionCharges: (detentionDays * rate).toFixed(2),
            lastFreeDay: new Date(detentionStartDate.getTime() - 24 * 60 * 60 * 1000).toISOString(),
            equipmentType: '40HC',
            status: emptyReturnEvent ? 'Closed' : (detentionDays > 0 ? 'Accruing' : 'In Free Time')
        };
    }

    // Generate vessel schedule data
    generateVesselSchedule(vesselName = null, origin = null, destination = null) {
        const vessel = vesselName || this.vessels[Math.floor(Math.random() * this.vessels.length)];
        const ports = origin && destination ? [origin, destination] : this.getRandomPortPair();
        
        const schedule = {
            vesselName: vessel,
            vesselIMO: `IMO${9000000 + Math.floor(Math.random() * 999999)}`,
            service: 'AE7',
            operator: 'Maersk',
            voyages: []
        };

        // Generate 3 voyages
        let currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 30); // Start 30 days ago

        for (let i = 0; i < 3; i++) {
            const voyage = {
                voyageNumber: this.generateVoyageNumber(),
                direction: i % 2 === 0 ? 'Eastbound' : 'Westbound',
                portCalls: []
            };

            // Add port calls
            const portSequence = i % 2 === 0 ? [...ports] : [...ports].reverse();
            let arrivalDate = new Date(currentDate);

            portSequence.forEach((port, index) => {
                const portCall = {
                    port: port,
                    terminal: `${port.name} Container Terminal`,
                    arrival: {
                        scheduled: arrivalDate.toISOString(),
                        estimated: new Date(arrivalDate.getTime() + (Math.random() * 12 - 6) * 60 * 60 * 1000).toISOString(),
                        actual: arrivalDate < new Date() ? arrivalDate.toISOString() : null
                    },
                    departure: {
                        scheduled: new Date(arrivalDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                        estimated: new Date(arrivalDate.getTime() + (24 + Math.random() * 12 - 6) * 60 * 60 * 1000).toISOString(),
                        actual: arrivalDate < new Date() ? new Date(arrivalDate.getTime() + 24 * 60 * 60 * 1000).toISOString() : null
                    },
                    status: arrivalDate < new Date() ? 'Departed' : 'Scheduled'
                };

                voyage.portCalls.push(portCall);
                arrivalDate = new Date(arrivalDate.getTime() + (7 + Math.random() * 7) * 24 * 60 * 60 * 1000);
            });

            schedule.voyages.push(voyage);
            currentDate = new Date(currentDate.getTime() + 21 * 24 * 60 * 60 * 1000); // Next voyage starts 3 weeks later
        }

        return schedule;
    }

    getRandomPortPair() {
        const origin = this.ports[Math.floor(Math.random() * this.ports.length)];
        let destination = this.ports[Math.floor(Math.random() * this.ports.length)];
        while (destination.code === origin.code) {
            destination = this.ports[Math.floor(Math.random() * this.ports.length)];
        }
        return [origin, destination];
    }

    // Generate booking data
    generateBookingData() {
        const booking = {
            bookingNumber: this.generateBookingReference().toString(),
            bookingStatus: 'Confirmed',
            createdDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            shipmentDetails: {
                origin: this.ports[Math.floor(Math.random() * this.ports.length)],
                destination: this.ports[Math.floor(Math.random() * this.ports.length)],
                commodity: ['Electronics', 'Textiles', 'Auto Parts', 'Machinery', 'Consumer Goods'][Math.floor(Math.random() * 5)],
                containerCount: Math.floor(Math.random() * 5) + 1,
                totalWeight: (Math.random() * 20000 + 5000).toFixed(2) + ' KG',
                totalVolume: (Math.random() * 50 + 10).toFixed(2) + ' CBM'
            },
            containers: []
        };

        // Generate containers for this booking
        for (let i = 0; i < booking.shipmentDetails.containerCount; i++) {
            booking.containers.push({
                containerNumber: this.generateContainerNumber(),
                size: ['20GP', '40GP', '40HC'][Math.floor(Math.random() * 3)],
                type: 'Dry',
                sealNumber: `SEAL${Math.floor(Math.random() * 9000000) + 1000000}`,
                weight: (Math.random() * 15000 + 2000).toFixed(2) + ' KG',
                status: 'In Transit'
            });
        }

        return booking;
    }
}

module.exports = MaerskAPISimulator;