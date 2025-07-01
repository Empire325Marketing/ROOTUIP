// ROOTUIP Main Application
console.log('ROOTUIP Platform Loaded');

// API Configuration
const API_BASE = window.location.origin + '/api';
const WS_URL = window.location.origin.replace('http', 'ws');

// Initialize WebSocket connection
function initWebSocket() {
    const socket = io(WS_URL, {
        path: '/socket.io/',
        transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
        console.log('WebSocket connected');
    });
    
    return socket;
}

// API Helper
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Call Failed:', error);
        throw error;
    }
}

// Export for use in other scripts
window.ROOTUIP = {
    API_BASE,
    WS_URL,
    apiCall,
    initWebSocket
};
