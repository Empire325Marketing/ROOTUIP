/**
 * ROOTUIP Real-Time Client Library
 * WebSocket client for real-time updates
 */

class RootUIRealTimeClient {
    constructor(options = {}) {
        this.options = {
            url: options.url || 'wss://rootuip.com',
            reconnectDelay: options.reconnectDelay || 3000,
            maxReconnectAttempts: options.maxReconnectAttempts || 10,
            debug: options.debug || false
        };
        
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.eventHandlers = new Map();
        this.subscriptions = new Set();
        this.messageQueue = [];
        this.lastHeartbeat = null;
    }
    
    // Connect to WebSocket server
    async connect(authToken) {
        return new Promise((resolve, reject) => {
            try {
                this.log('Connecting to WebSocket server...');
                
                this.socket = io(this.options.url, {
                    auth: { token: authToken },
                    transports: ['websocket', 'polling'],
                    reconnection: true,
                    reconnectionDelay: this.options.reconnectDelay,
                    reconnectionAttempts: this.options.maxReconnectAttempts
                });
                
                // Connection events
                this.socket.on('connect', () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this.log('Connected to WebSocket server');
                    
                    // Process queued messages
                    this.processMessageQueue();
                    
                    // Resubscribe to rooms
                    if (this.subscriptions.size > 0) {
                        this.subscribe(Array.from(this.subscriptions));
                    }
                    
                    resolve();
                });
                
                this.socket.on('disconnect', (reason) => {
                    this.connected = false;
                    this.log('Disconnected:', reason);
                    this.emit('connection:lost', { reason });
                });
                
                this.socket.on('connect_error', (error) => {
                    this.log('Connection error:', error.message);
                    this.emit('connection:error', { error: error.message });
                    
                    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
                        reject(new Error('Max reconnection attempts reached'));
                    }
                    this.reconnectAttempts++;
                });
                
                // Setup default event handlers
                this.setupDefaultHandlers();
                
                // Start heartbeat
                this.startHeartbeat();
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    // Setup default event handlers
    setupDefaultHandlers() {
        // Container updates
        this.socket.on('container:update', (data) => {
            this.emit('container:update', data);
            this.updateUI('container', data);
        });
        
        this.socket.on('container:status', (data) => {
            this.emit('container:status', data);
            this.updateUI('status', data);
        });
        
        this.socket.on('container:location', (data) => {
            this.emit('container:location', data);
            this.updateUI('location', data);
        });
        
        // Risk and predictions
        this.socket.on('risk:update', (data) => {
            this.emit('risk:update', data);
            this.updateUI('risk', data);
        });
        
        this.socket.on('prediction:update', (data) => {
            this.emit('prediction:update', data);
            this.updateUI('prediction', data);
        });
        
        this.socket.on('anomaly:detected', (data) => {
            this.emit('anomaly:detected', data);
            this.showAlert('anomaly', data);
        });
        
        // Alerts
        this.socket.on('alert:critical', (data) => {
            this.emit('alert:critical', data);
            this.showAlert('critical', data);
        });
        
        this.socket.on('alert:warning', (data) => {
            this.emit('alert:warning', data);
            this.showAlert('warning', data);
        });
        
        this.socket.on('notification:info', (data) => {
            this.emit('notification:info', data);
            this.showNotification(data);
        });
        
        // Metrics and KPIs
        this.socket.on('metrics:update', (data) => {
            this.emit('metrics:update', data);
            this.updateMetrics(data);
        });
        
        this.socket.on('kpi:update', (data) => {
            this.emit('kpi:update', data);
            this.updateKPIs(data);
        });
        
        // Presence and collaboration
        this.socket.on('presence:update', (data) => {
            this.emit('presence:update', data);
            this.updatePresence(data);
        });
    }
    
    // Subscribe to rooms
    subscribe(rooms) {
        if (!Array.isArray(rooms)) {
            rooms = [rooms];
        }
        
        rooms.forEach(room => this.subscriptions.add(room));
        
        if (this.connected) {
            this.socket.emit('subscribe', { rooms });
        } else {
            this.log('Not connected, queuing subscription');
        }
    }
    
    // Unsubscribe from rooms
    unsubscribe(rooms) {
        if (!Array.isArray(rooms)) {
            rooms = [rooms];
        }
        
        rooms.forEach(room => this.subscriptions.delete(room));
        
        if (this.connected) {
            this.socket.emit('unsubscribe', { rooms });
        }
    }
    
    // Track specific container
    trackContainer(containerNumber) {
        this.subscribe(`container:${containerNumber}`);
        
        if (this.connected) {
            this.socket.emit('track:container', { containerNumber });
        }
    }
    
    // Update presence
    updatePresenceStatus(status, activity) {
        if (this.connected) {
            this.socket.emit('presence:update', { status, activity });
        }
    }
    
    // Event handling
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('Event handler error:', error);
                }
            });
        }
    }
    
    // UI update helpers
    updateUI(type, data) {
        switch (type) {
            case 'container':
                this.updateContainerDisplay(data);
                break;
            case 'status':
                this.updateStatusBadge(data);
                break;
            case 'location':
                this.updateLocationMap(data);
                break;
            case 'risk':
                this.updateRiskIndicator(data);
                break;
            case 'prediction':
                this.updatePredictionChart(data);
                break;
        }
    }
    
    updateContainerDisplay(data) {
        const element = document.querySelector(`[data-container="${data.containerNumber}"]`);
        if (element) {
            // Update status
            const statusEl = element.querySelector('.container-status');
            if (statusEl) {
                statusEl.textContent = data.status;
                statusEl.className = `container-status status-${data.status}`;
            }
            
            // Update location
            const locationEl = element.querySelector('.container-location');
            if (locationEl) {
                locationEl.textContent = data.location;
            }
            
            // Update ETA
            const etaEl = element.querySelector('.container-eta');
            if (etaEl && data.eta) {
                etaEl.textContent = new Date(data.eta).toLocaleDateString();
            }
            
            // Add update animation
            element.classList.add('updated');
            setTimeout(() => element.classList.remove('updated'), 1000);
        }
    }
    
    updateStatusBadge(data) {
        const badge = document.querySelector(`[data-status-container="${data.containerNumber}"]`);
        if (badge) {
            badge.className = `status-badge status-${data.status}`;
            badge.textContent = data.status.replace('_', ' ').toUpperCase();
        }
    }
    
    updateRiskIndicator(data) {
        const indicator = document.querySelector(`[data-risk-container="${data.containerNumber}"]`);
        if (indicator) {
            const percentage = Math.round(data.riskScore * 100);
            indicator.querySelector('.risk-value').textContent = `${percentage}%`;
            
            // Update color based on risk level
            indicator.className = 'risk-indicator';
            if (data.riskScore > 0.7) {
                indicator.classList.add('risk-high');
            } else if (data.riskScore > 0.4) {
                indicator.classList.add('risk-medium');
            } else {
                indicator.classList.add('risk-low');
            }
            
            // Update risk factors
            const factorsList = indicator.querySelector('.risk-factors');
            if (factorsList && data.riskFactors) {
                factorsList.innerHTML = data.riskFactors
                    .map(f => `<li>${f.factor}: ${Math.round(f.impact * 100)}%</li>`)
                    .join('');
            }
        }
    }
    
    updateMetrics(data) {
        Object.entries(data.metrics).forEach(([key, value]) => {
            const element = document.querySelector(`[data-metric="${key}"]`);
            if (element) {
                element.textContent = this.formatMetricValue(key, value);
                
                // Add pulse animation
                element.classList.add('metric-updated');
                setTimeout(() => element.classList.remove('metric-updated'), 500);
            }
        });
    }
    
    updateKPIs(data) {
        Object.entries(data.kpis).forEach(([key, value]) => {
            const element = document.querySelector(`[data-kpi="${key}"]`);
            if (element) {
                element.textContent = this.formatKPIValue(key, value);
            }
        });
    }
    
    // Alert and notification display
    showAlert(severity, data) {
        const alertContainer = document.getElementById('realtime-alerts') || this.createAlertContainer();
        
        const alert = document.createElement('div');
        alert.className = `realtime-alert alert-${severity}`;
        alert.innerHTML = `
            <div class="alert-icon">
                <i class="fas fa-${this.getAlertIcon(severity)}"></i>
            </div>
            <div class="alert-content">
                <div class="alert-title">${severity.toUpperCase()} ALERT</div>
                <div class="alert-message">${data.message}</div>
                <div class="alert-time">${new Date(data.timestamp).toLocaleTimeString()}</div>
            </div>
            <button class="alert-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        alertContainer.appendChild(alert);
        
        // Auto-remove after 10 seconds for non-critical alerts
        if (severity !== 'critical') {
            setTimeout(() => alert.remove(), 10000);
        }
        
        // Play sound for critical alerts
        if (severity === 'critical') {
            this.playAlertSound();
        }
    }
    
    showNotification(data) {
        // Use browser notifications if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('ROOTUIP Notification', {
                body: data.message,
                icon: '/assets/images/rootuip-icon.png',
                tag: data.type
            });
        }
        
        // Also show in-app notification
        this.showAlert('info', data);
    }
    
    createAlertContainer() {
        const container = document.createElement('div');
        container.id = 'realtime-alerts';
        container.className = 'realtime-alerts-container';
        document.body.appendChild(container);
        return container;
    }
    
    getAlertIcon(severity) {
        const icons = {
            critical: 'exclamation-triangle',
            warning: 'exclamation-circle',
            info: 'info-circle'
        };
        return icons[severity] || 'bell';
    }
    
    playAlertSound() {
        const audio = new Audio('/assets/sounds/alert.mp3');
        audio.play().catch(e => console.log('Could not play alert sound'));
    }
    
    // Utility methods
    formatMetricValue(key, value) {
        if (typeof value === 'number') {
            if (key.includes('rate') || key.includes('percentage')) {
                return `${(value * 100).toFixed(1)}%`;
            }
            if (key.includes('time')) {
                return `${value.toFixed(1)}s`;
            }
            if (key.includes('count') || key.includes('total')) {
                return value.toLocaleString();
            }
        }
        return value;
    }
    
    formatKPIValue(key, value) {
        if (typeof value === 'number') {
            if (key.includes('savings') || key.includes('revenue')) {
                return `$${value.toLocaleString()}`;
            }
            return this.formatMetricValue(key, value);
        }
        return value;
    }
    
    // Heartbeat to detect connection health
    startHeartbeat() {
        setInterval(() => {
            if (this.connected) {
                this.socket.emit('ping');
                this.lastHeartbeat = Date.now();
            }
        }, 30000); // Every 30 seconds
    }
    
    // Message queue for offline support
    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.socket.emit(message.event, message.data);
        }
    }
    
    // Disconnect
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.connected = false;
            this.socket = null;
        }
    }
    
    // Logging
    log(...args) {
        if (this.options.debug) {
            console.log('[RealTime]', ...args);
        }
    }
}

// Export for use
window.RootUIRealTimeClient = RootUIRealTimeClient;