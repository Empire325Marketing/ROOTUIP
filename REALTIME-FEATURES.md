# ROOTUIP Real-Time Features Documentation

## 🚀 Overview

The ROOTUIP platform now includes comprehensive real-time features that make the platform feel alive with instant updates and live collaboration capabilities.

## 📡 Real-Time Infrastructure

### WebSocket Server
- **Service**: `real-time-websocket-server-enhanced.js`
- **Port**: 3004
- **Features**:
  - JWT authentication for secure connections
  - Room-based subscriptions
  - Connection pooling and management
  - Automatic reconnection with exponential backoff
  - Message compression for bandwidth efficiency

### Redis Pub/Sub
- **Channels**:
  - `realtime:containers` - Container status updates
  - `realtime:predictions` - AI/ML predictions
  - `realtime:alerts` - Critical alerts and warnings
  - `realtime:metrics` - Performance metrics
  - `realtime:notifications` - User notifications

## 🔄 Real-Time Updates

### Container Tracking
- **Live Status Changes**: Container status updates in real-time
- **Location Updates**: GPS and port location changes
- **ETA Adjustments**: Dynamic ETA recalculations
- **Document Processing**: OCR results and document status

### AI/ML Predictions
- **Risk Score Updates**: Every 30 seconds
- **Anomaly Detection**: Instant alerts for unusual patterns
- **Predictive Analytics**: Live forecast adjustments
- **Performance Metrics**: Model accuracy in real-time

### Dashboard Metrics
- **KPI Updates**: Live business metrics
- **Performance Indicators**: System health and uptime
- **Financial Metrics**: Cost savings and revenue at risk
- **Operational Stats**: Container counts and statuses

## 🎯 Event Types

### Container Events
```javascript
// Container update
{
  type: 'container:update',
  containerNumber: 'MSKU1234567',
  status: 'in_transit',
  location: 'Pacific Ocean',
  eta: '2024-12-25T10:00:00Z',
  riskScore: 0.23
}

// Risk score change
{
  type: 'risk:update',
  containerNumber: 'MSKU1234567',
  riskScore: 0.67,
  factors: [
    { factor: 'weather_delay', impact: 0.3 },
    { factor: 'port_congestion', impact: 0.2 }
  ]
}
```

### Alert Events
```javascript
// Critical alert
{
  type: 'alert:critical',
  severity: 'critical',
  message: 'Container MSKU1234567 at high risk of detention',
  containerNumber: 'MSKU1234567',
  timestamp: '2024-01-20T15:30:00Z'
}

// Anomaly detected
{
  type: 'anomaly:detected',
  containerNumber: 'MSKU1234567',
  anomaly: {
    type: 'temperature_deviation',
    severity: 'high',
    description: 'Temperature 9°C, outside range'
  }
}
```

## 💻 Client Integration

### JavaScript Client
```javascript
// Initialize client
const realtimeClient = new RootUIRealTimeClient({
  url: 'wss://rootuip.com',
  debug: true
});

// Connect with auth
await realtimeClient.connect(authToken);

// Subscribe to updates
realtimeClient.subscribe('container:MSKU1234567');
realtimeClient.subscribe('dashboard:executive');

// Handle events
realtimeClient.on('container:update', (data) => {
  console.log('Container updated:', data);
});

realtimeClient.on('alert:critical', (data) => {
  showCriticalAlert(data);
});
```

### UI Integration
- **Live Indicators**: Visual feedback for real-time connection
- **Update Animations**: Smooth transitions for data changes
- **Alert Notifications**: Toast messages and browser notifications
- **Presence Indicators**: See who else is viewing the same data

## 🎨 Visual Features

### Connection Indicator
- Green pulse: Connected and receiving updates
- Yellow: Connecting or reconnecting
- Red: Disconnected or error

### Update Animations
- Pulse effect on updated elements
- Glow animation for important changes
- Slide-in for new alerts
- Fade transitions for metric updates

### Real-Time Charts
- Live data streaming
- Smooth chart updates
- Time-series visualization
- Performance sparklines

## 🔧 Configuration

### Environment Variables
```bash
# WebSocket configuration
WEBSOCKET_PORT=3004
WEBSOCKET_PING_INTERVAL=25000
WEBSOCKET_PING_TIMEOUT=60000

# Redis configuration
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your_password

# Real-time features
ENABLE_REAL_TIME_TRACKING=true
REALTIME_UPDATE_INTERVAL=3000
REALTIME_BATCH_SIZE=20
```

### PM2 Services
```bash
# Start all real-time services
pm2 start ecosystem.config.js

# Monitor real-time services
pm2 monit

# Check WebSocket connections
pm2 logs websocket-server
```

## 📊 Performance Optimization

### Message Batching
- Groups multiple updates into single transmission
- Reduces network overhead
- Configurable batch size and interval

### Connection Pooling
- Reuses WebSocket connections
- Automatic cleanup of idle connections
- Connection health monitoring

### Client-Side Caching
- Stores recent updates locally
- Reduces redundant data transmission
- Intelligent cache invalidation

## 🛡️ Security

### Authentication
- JWT token validation on connection
- Role-based room access
- Automatic session expiry

### Rate Limiting
- Per-user connection limits
- Message frequency throttling
- DDoS protection

### Data Privacy
- End-to-end encryption for sensitive data
- User-specific data isolation
- Audit logging for all events

## 📱 Mobile Support

### Responsive Design
- Optimized for mobile devices
- Touch-friendly alert dismissal
- Reduced data usage on mobile

### Offline Support
- Message queuing when disconnected
- Automatic sync on reconnection
- Local storage for critical data

## 🔍 Monitoring

### Health Checks
```bash
# Check WebSocket server health
curl http://localhost:3004/health

# View connection statistics
curl http://localhost:3004/stats
```

### Metrics
- Total active connections
- Messages per second
- Average latency
- Room subscription counts

## 🚦 Troubleshooting

### Common Issues

1. **Connection Drops**
   - Check firewall settings
   - Verify WebSocket port is open
   - Review proxy configuration

2. **Missing Updates**
   - Confirm room subscriptions
   - Check user permissions
   - Verify Redis connectivity

3. **High Latency**
   - Monitor server resources
   - Check network bandwidth
   - Review message sizes

### Debug Mode
```javascript
// Enable debug logging
const realtimeClient = new RootUIRealTimeClient({
  debug: true
});
```

## 🎯 Best Practices

1. **Subscribe Wisely**: Only subscribe to necessary rooms
2. **Handle Disconnections**: Implement reconnection logic
3. **Process Updates Efficiently**: Use requestAnimationFrame for UI updates
4. **Clean Up**: Unsubscribe when components unmount
5. **Error Handling**: Gracefully handle connection errors

## 🔮 Future Enhancements

- [ ] WebRTC for peer-to-peer updates
- [ ] GraphQL subscriptions
- [ ] Offline-first architecture
- [ ] Advanced presence features
- [ ] Collaborative editing
- [ ] Push notifications
- [ ] Real-time analytics dashboard

---

The real-time features transform ROOTUIP into a living, breathing platform where every update happens instantly, keeping users informed and engaged with their critical supply chain data.