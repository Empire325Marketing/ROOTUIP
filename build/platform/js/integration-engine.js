class IntegrationEngine {
 constructor() {
 this.adapters = new Map();
 this.pipeline = new DataProcessingPipeline();
 this.monitor = new IntegrationMonitor();
 this.security = new SecurityManager();
 this.rateLimiters = new Map();
 this.activeConnections = new Map();
 this.initializeEngine();
 }
 initializeEngine() {
 this.registerAdapter('maersk', new MaerskAdapter());
 this.registerAdapter('msc', new MSCAdapter());
 this.registerAdapter('cma-cgm', new CMACGMAdapter());
 this.registerAdapter('hapag-lloyd', new HapagLloydAdapter());
 this.registerAdapter('one', new ONEAdapter());
 this.registerAdapter('evergreen', new EvergreenAdapter());
 this.registerAdapter('cosco', new COSCOAdapter());
 this.registerAdapter('yang-ming', new YangMingAdapter());
 this.registerAdapter('zim', new ZIMAdapter());
 this.registerAdapter('hmm', new HMMAdapter());
 this.monitor.start();
 this.loadConnections();
 }
 registerAdapter(carrierId, adapter) {
 this.adapters.set(carrierId, adapter);
 console.log(`Registered adapter for ${carrierId}`);
 }
 async createConnection(config) {
 const { carrierId, type, credentials, settings } = config;
 if (!this.adapters.has(carrierId)) {
 throw new Error(`No adapter found for carrier: ${carrierId}`);
 }
 const encryptedCreds = await this.security.encryptCredentials(credentials);
 const connection = {
 id: this.generateConnectionId(),
 carrierId,
 type,
 credentials: encryptedCreds,
 settings,
 status: 'connecting',
 createdAt: new Date(),
 lastSync: null,
 metrics: {
 uptime: 100,
 errorRate: 0,
 avgResponseTime: 0,
 totalRequests: 0
 }
 };
 const adapter = this.adapters.get(carrierId);
 const testResult = await adapter.testConnection(credentials, type);
 if (testResult.success) {
 connection.status = 'connected';
 this.activeConnections.set(connection.id, connection);
 await this.saveConnection(connection);
 this.monitor.addConnection(connection);
 await this.security.logAudit({
 action: 'connection_created',
 carrierId,
 connectionId: connection.id,
 timestamp: new Date()
 });
 return { success: true, connection };
 } else {
 return { success: false, error: testResult.error };
 }
 }
 async fetchData(connectionId, dataType, params = {}) {
 const connection = this.activeConnections.get(connectionId);
 if (!connection) {
 throw new Error('Connection not found');
 }
 const adapter = this.adapters.get(connection.carrierId);
 const rateLimiter = this.getRateLimiter(connectionId);
 try {
 await rateLimiter.checkLimit();
 const credentials = await this.security.decryptCredentials(connection.credentials);
 let rawData;
 switch (connection.type) {
 case 'api':
 rawData = await adapter.fetchViaAPI(credentials, dataType, params);
 break;
 case 'edi':
 rawData = await adapter.fetchViaEDI(credentials, dataType, params);
 break;
 case 'email':
 rawData = await adapter.fetchViaEmail(credentials, dataType, params);
 break;
 case 'web':
 rawData = await adapter.fetchViaWeb(credentials, dataType, params);
 break;
 case 'manual':
 rawData = await adapter.processManualUpload(params.file);
 break;
 default:
 throw new Error(`Unsupported integration type: ${connection.type}`);
 }
 const processedData = await this.pipeline.process(rawData, connection.carrierId);
 this.updateConnectionMetrics(connectionId, true);
 await this.security.logAudit({
 action: 'data_fetched',
 connectionId,
 dataType,
 recordCount: processedData.length,
 timestamp: new Date()
 });
 return processedData;
 } catch (error) {
 this.updateConnectionMetrics(connectionId, false, error);
 if (this.shouldRetry(error)) {
 return await this.retryFetch(connectionId, dataType, params, error);
 }
 throw error;
 }
 }
 getRateLimiter(connectionId) {
 if (!this.rateLimiters.has(connectionId)) {
 const connection = this.activeConnections.get(connectionId);
 const adapter = this.adapters.get(connection.carrierId);
 this.rateLimiters.set(connectionId, new RateLimiter({
 maxRequests: adapter.rateLimits.maxRequests,
 windowMs: adapter.rateLimits.windowMs,
 maxBurst: adapter.rateLimits.maxBurst
 }));
 }
 return this.rateLimiters.get(connectionId);
 }
 updateConnectionMetrics(connectionId, success, error = null) {
 const connection = this.activeConnections.get(connectionId);
 if (!connection) return;
 connection.metrics.totalRequests++;
 if (success) {
 connection.lastSync = new Date();
 } else {
 const errorRate = connection.metrics.errorRate;
 connection.metrics.errorRate = 
 (errorRate * (connection.metrics.totalRequests - 1) + 1) / 
 connection.metrics.totalRequests;
 }
 this.monitor.updateMetrics(connectionId, connection.metrics);
 }
 async retryFetch(connectionId, dataType, params, previousError, attempt = 1) {
 const maxRetries = 3;
 const backoffMs = Math.min(1000 * Math.pow(2, attempt), 30000);
 if (attempt > maxRetries) {
 throw new Error(`Max retries exceeded. Last error: ${previousError.message}`);
 }
 console.log(`Retrying fetch for ${connectionId}, attempt ${attempt}...`);
 await this.sleep(backoffMs);
 return this.fetchData(connectionId, dataType, params);
 }
 shouldRetry(error) {
 const retryableErrors = [
 'ETIMEDOUT',
 'ECONNRESET',
 'ENOTFOUND',
 'ECONNREFUSED',
 '502',
 '503',
 '504'
 ];
 return retryableErrors.some(e => 
 error.message.includes(e) || error.code === e
 );
 }
 generateConnectionId() {
 return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
 }
 async saveConnection(connection) {
 const connections = this.loadConnectionsFromStorage();
 connections.push(connection);
 localStorage.setItem('uip_connections', JSON.stringify(connections));
 }
 loadConnections() {
 const connections = this.loadConnectionsFromStorage();
 connections.forEach(conn => {
 if (conn.status === 'connected') {
 this.activeConnections.set(conn.id, conn);
 this.monitor.addConnection(conn);
 }
 });
 }
 loadConnectionsFromStorage() {
 const stored = localStorage.getItem('uip_connections');
 return stored ? JSON.parse(stored) : [];
 }
 sleep(ms) {
 return new Promise(resolve => setTimeout(resolve, ms));
 }
 getActiveConnections() {
 return Array.from(this.activeConnections.values());
 }
 getConnectionHealth(connectionId) {
 const connection = this.activeConnections.get(connectionId);
 if (!connection) return null;
 return {
 ...connection,
 health: this.calculateHealthScore(connection.metrics)
 };
 }
 calculateHealthScore(metrics) {
 const uptimeScore = metrics.uptime;
 const errorScore = (1 - metrics.errorRate) * 100;
 const responseScore = Math.max(0, 100 - (metrics.avgResponseTime / 10));
 return Math.round((uptimeScore + errorScore + responseScore) / 3);
 }
}
class DataProcessingPipeline {
 constructor() {
 this.processors = [
 new ValidationProcessor(),
 new StandardizationProcessor(),
 new EnrichmentProcessor(),
 new DuplicateDetectionProcessor(),
 new QualityScoringProcessor()
 ];
 }
 async process(rawData, carrierId) {
 let data = rawData;
 const context = { carrierId, timestamp: new Date() };
 for (const processor of this.processors) {
 try {
 data = await processor.process(data, context);
 } catch (error) {
 console.error(`Pipeline error in ${processor.constructor.name}:`, error);
 throw error;
 }
 }
 return data;
 }
}
class BaseProcessor {
 async process(data, context) {
 throw new Error('Process method must be implemented');
 }
}
class ValidationProcessor extends BaseProcessor {
 async process(data, context) {
 if (!Array.isArray(data)) {
 data = [data];
 }
 return data.filter(item => {
 if (!item.containerNumber || !item.status) {
 console.warn('Invalid item missing required fields:', item);
 return false;
 }
 if (!this.isValidContainerNumber(item.containerNumber)) {
 console.warn('Invalid container number:', item.containerNumber);
 return false;
 }
 return true;
 });
 }
 isValidContainerNumber(containerNumber) {
 const regex = /^[A-Z]{3}[UJZ]\d{7}$/;
 return regex.test(containerNumber);
 }
}
class StandardizationProcessor extends BaseProcessor {
 async process(data, context) {
 return data.map(item => ({
 containerNumber: item.containerNumber.toUpperCase(),
 status: this.standardizeStatus(item.status),
 currentLocation: this.standardizeLocation(item.location || item.currentLocation),
 origin: this.standardizeLocation(item.origin || item.pol),
 destination: this.standardizeLocation(item.destination || item.pod),
 eta: this.standardizeDate(item.eta || item.estimatedArrival),
 etd: this.standardizeDate(item.etd || item.estimatedDeparture),
 ata: this.standardizeDate(item.ata || item.actualArrival),
 atd: this.standardizeDate(item.atd || item.actualDeparture),
 carrier: context.carrierId,
 vessel: item.vessel || item.vesselName,
 voyage: item.voyage || item.voyageNumber,
 bookingNumber: item.bookingNumber || item.bookingRef,
 billOfLading: item.billOfLading || item.blNumber,
 lastUpdated: new Date(),
 source: context.carrierId,
 rawData: item
 }));
 }
 standardizeStatus(status) {
 const statusMap = {
 'in transit': 'IN_TRANSIT',
 'at sea': 'IN_TRANSIT',
 'on vessel': 'IN_TRANSIT',
 'at port': 'AT_PORT',
 'in terminal': 'AT_PORT',
 'discharged': 'AT_PORT',
 'delivered': 'DELIVERED',
 'empty': 'EMPTY',
 'loaded': 'LOADED',
 'gate out': 'GATE_OUT',
 'gate in': 'GATE_IN'
 };
 const normalized = status.toLowerCase();
 return statusMap[normalized] || 'UNKNOWN';
 }
 standardizeLocation(location) {
 if (!location) return null;
 const portCodeMatch = location.match(/\b[A-Z]{5}\b/);
 if (portCodeMatch) {
 return {
 code: portCodeMatch[0],
 name: location,
 type: 'PORT'
 };
 }
 return {
 code: null,
 name: location,
 type: 'UNKNOWN'
 };
 }
 standardizeDate(dateStr) {
 if (!dateStr) return null;
 const date = new Date(dateStr);
 return isNaN(date.getTime()) ? null : date.toISOString();
 }
}
class EnrichmentProcessor extends BaseProcessor {
 async process(data, context) {
 return Promise.all(data.map(async item => {
 if (item.etd && item.eta) {
 const days = Math.ceil((new Date(item.eta) - new Date(item.etd)) / (1000 * 60 * 60 * 24));
 item.transitDays = days;
 }
 if (item.status === 'AT_PORT' && item.ata) {
 const freeTimeEnd = new Date(item.ata);
 freeTimeEnd.setDate(freeTimeEnd.getDate() + 5); // Standard 5 days free time
 const now = new Date();
 const remaining = Math.ceil((freeTimeEnd - now) / (1000 * 60 * 60 * 24));
 item.freeTimeRemaining = Math.max(0, remaining);
 item.ddRisk = remaining <= 2 ? 'HIGH' : remaining <= 4 ? 'MEDIUM' : 'LOW';
 }
 if (item.currentLocation?.code) {
 const coords = await this.getPortCoordinates(item.currentLocation.code);
 if (coords) {
 item.currentLocation.coordinates = coords;
 }
 }
 return item;
 }));
 }
 async getPortCoordinates(portCode) {
 const portCoords = {
 'USLAX': { lat: 33.7406, lng: -118.2706 },
 'CNSHA': { lat: 31.2304, lng: 121.4737 },
 'DEHAM': { lat: 53.5511, lng: 9.9937 },
 'SGSIN': { lat: 1.3521, lng: 103.8198 }
 };
 return portCoords[portCode] || null;
 }
}
class DuplicateDetectionProcessor extends BaseProcessor {
 constructor() {
 super();
 this.seenRecords = new Map();
 }
 async process(data, context) {
 const uniqueData = [];
 for (const item of data) {
 const key = this.generateKey(item);
 const existing = this.seenRecords.get(key);
 if (existing) {
 const merged = this.mergeRecords(existing, item);
 this.seenRecords.set(key, merged);
 if (this.hasSignificantChanges(existing, item)) {
 uniqueData.push(merged);
 }
 } else {
 this.seenRecords.set(key, item);
 uniqueData.push(item);
 }
 }
 this.cleanupOldRecords();
 return uniqueData;
 }
 generateKey(item) {
 return `${item.containerNumber}_${item.carrier}`;
 }
 mergeRecords(existing, newRecord) {
 return {
 ...existing,
 ...newRecord,
 lastUpdated: new Date(),
 updateHistory: [
 ...(existing.updateHistory || []),
 {
 timestamp: new Date(),
 changes: this.detectChanges(existing, newRecord)
 }
 ]
 };
 }
 hasSignificantChanges(existing, newRecord) {
 const significantFields = ['status', 'currentLocation', 'eta', 'ata'];
 return significantFields.some(field => 
 JSON.stringify(existing[field]) !== JSON.stringify(newRecord[field])
 );
 }
 detectChanges(existing, newRecord) {
 const changes = {};
 const fields = Object.keys(newRecord);
 fields.forEach(field => {
 if (JSON.stringify(existing[field]) !== JSON.stringify(newRecord[field])) {
 changes[field] = {
 from: existing[field],
 to: newRecord[field]
 };
 }
 });
 return changes;
 }
 cleanupOldRecords() {
 const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
 const now = Date.now();
 for (const [key, record] of this.seenRecords) {
 if (now - new Date(record.lastUpdated).getTime() > maxAge) {
 this.seenRecords.delete(key);
 }
 }
 }
}
class QualityScoringProcessor extends BaseProcessor {
 async process(data, context) {
 return data.map(item => {
 const qualityScore = this.calculateQualityScore(item);
 const confidence = this.calculateConfidence(item);
 return {
 ...item,
 dataQuality: {
 score: qualityScore,
 confidence: confidence,
 completeness: this.calculateCompleteness(item),
 issues: this.identifyIssues(item)
 }
 };
 });
 }
 calculateQualityScore(item) {
 let score = 100;
 const optionalFields = ['vessel', 'voyage', 'bookingNumber', 'billOfLading'];
 optionalFields.forEach(field => {
 if (!item[field]) score -= 5;
 });
 if (!item.eta) score -= 10;
 if (!item.etd) score -= 10;
 if (item.status === 'UNKNOWN') score -= 20;
 return Math.max(0, score);
 }
 calculateConfidence(item) {
 const age = Date.now() - new Date(item.lastUpdated).getTime();
 const hoursSinceUpdate = age / (1000 * 60 * 60);
 if (hoursSinceUpdate < 1) return 'HIGH';
 if (hoursSinceUpdate < 24) return 'MEDIUM';
 return 'LOW';
 }
 calculateCompleteness(item) {
 const requiredFields = ['containerNumber', 'status', 'carrier'];
 const optionalFields = ['currentLocation', 'origin', 'destination', 'eta', 'etd', 
 'vessel', 'voyage', 'bookingNumber', 'billOfLading'];
 const allFields = [...requiredFields, ...optionalFields];
 const filledFields = allFields.filter(field => item[field] !== null && item[field] !== undefined);
 return Math.round((filledFields.length / allFields.length) * 100);
 }
 identifyIssues(item) {
 const issues = [];
 if (!item.eta) issues.push('Missing ETA');
 if (!item.currentLocation) issues.push('Missing current location');
 if (item.status === 'UNKNOWN') issues.push('Unknown status');
 if (item.ddRisk === 'HIGH') issues.push('High D&D risk');
 return issues;
 }
}
class RateLimiter {
 constructor(options) {
 this.maxRequests = options.maxRequests;
 this.windowMs = options.windowMs;
 this.maxBurst = options.maxBurst || options.maxRequests;
 this.requests = [];
 }
 async checkLimit() {
 const now = Date.now();
 this.requests = this.requests.filter(time => now - time < this.windowMs);
 if (this.requests.length >= this.maxRequests) {
 const oldestRequest = this.requests[0];
 const waitTime = this.windowMs - (now - oldestRequest);
 throw new Error(`Rate limit exceeded. Retry after ${Math.ceil(waitTime / 1000)} seconds`);
 }
 this.requests.push(now);
 }
 getRemainingRequests() {
 const now = Date.now();
 this.requests = this.requests.filter(time => now - time < this.windowMs);
 return Math.max(0, this.maxRequests - this.requests.length);
 }
}
class IntegrationMonitor {
 constructor() {
 this.connections = new Map();
 this.metrics = new Map();
 this.alerts = [];
 this.interval = null;
 }
 start() {
 this.interval = setInterval(() => {
 this.checkConnections();
 }, 30000);
 }
 stop() {
 if (this.interval) {
 clearInterval(this.interval);
 this.interval = null;
 }
 }
 addConnection(connection) {
 this.connections.set(connection.id, connection);
 this.metrics.set(connection.id, {
 checks: [],
 incidents: []
 });
 }
 async checkConnections() {
 for (const [id, connection] of this.connections) {
 try {
 const health = await this.checkConnectionHealth(connection);
 this.recordHealthCheck(id, health);
 if (health.status === 'error') {
 this.createAlert(connection, 'Connection failed', 'error');
 } else if (health.responseTime > 5000) {
 this.createAlert(connection, 'High response time', 'warning');
 } else if (health.errorRate > 0.05) {
 this.createAlert(connection, 'High error rate', 'warning');
 }
 } catch (error) {
 console.error(`Health check failed for ${id}:`, error);
 }
 }
 }
 async checkConnectionHealth(connection) {
 const startTime = Date.now();
 try {
 const adapter = IntegrationEngine.adapters.get(connection.carrierId);
 const result = await adapter.healthCheck(connection.credentials);
 return {
 status: result.success ? 'healthy' : 'error',
 responseTime: Date.now() - startTime,
 errorRate: connection.metrics.errorRate,
 timestamp: new Date()
 };
 } catch (error) {
 return {
 status: 'error',
 responseTime: Date.now() - startTime,
 error: error.message,
 timestamp: new Date()
 };
 }
 }
 recordHealthCheck(connectionId, health) {
 const metrics = this.metrics.get(connectionId);
 if (!metrics) return;
 metrics.checks.push(health);
 if (metrics.checks.length > 100) {
 metrics.checks.shift();
 }
 const connection = this.connections.get(connectionId);
 if (connection) {
 connection.metrics.uptime = this.calculateUptime(metrics.checks);
 connection.metrics.avgResponseTime = this.calculateAvgResponseTime(metrics.checks);
 }
 }
 calculateUptime(checks) {
 if (checks.length === 0) return 100;
 const healthyChecks = checks.filter(c => c.status === 'healthy').length;
 return Math.round((healthyChecks / checks.length) * 100);
 }
 calculateAvgResponseTime(checks) {
 if (checks.length === 0) return 0;
 const totalTime = checks.reduce((sum, c) => sum + c.responseTime, 0);
 return Math.round(totalTime / checks.length);
 }
 createAlert(connection, message, severity) {
 const alert = {
 id: `alert_${Date.now()}`,
 connectionId: connection.id,
 carrierId: connection.carrierId,
 message,
 severity,
 timestamp: new Date(),
 acknowledged: false
 };
 this.alerts.push(alert);
 this.notifyAlert(alert);
 this.alerts = this.alerts.slice(-100);
 }
 notifyAlert(alert) {
 console.warn('Integration Alert:', alert);
 if (typeof window !== 'undefined') {
 window.dispatchEvent(new CustomEvent('integration-alert', { detail: alert }));
 }
 }
 getAlerts(options = {}) {
 let alerts = [...this.alerts];
 if (options.unacknowledged) {
 alerts = alerts.filter(a => !a.acknowledged);
 }
 if (options.severity) {
 alerts = alerts.filter(a => a.severity === options.severity);
 }
 if (options.connectionId) {
 alerts = alerts.filter(a => a.connectionId === options.connectionId);
 }
 return alerts;
 }
 acknowledgeAlert(alertId) {
 const alert = this.alerts.find(a => a.id === alertId);
 if (alert) {
 alert.acknowledged = true;
 alert.acknowledgedAt = new Date();
 }
 }
 updateMetrics(connectionId, metrics) {
 const connection = this.connections.get(connectionId);
 if (connection) {
 connection.metrics = { ...connection.metrics, ...metrics };
 }
 }
}
class SecurityManager {
 constructor() {
 this.encryptionKey = this.getOrCreateKey();
 this.auditLog = [];
 }
 getOrCreateKey() {
 let key = localStorage.getItem('uip_encryption_key');
 if (!key) {
 key = this.generateKey();
 localStorage.setItem('uip_encryption_key', key);
 }
 return key;
 }
 generateKey() {
 const array = new Uint8Array(32);
 crypto.getRandomValues(array);
 return btoa(String.fromCharCode(...array));
 }
 async encryptCredentials(credentials) {
 const jsonStr = JSON.stringify(credentials);
 const encrypted = btoa(jsonStr);
 return {
 encrypted: true,
 data: encrypted,
 algorithm: 'base64',
 timestamp: new Date()
 };
 }
 async decryptCredentials(encryptedCreds) {
 if (!encryptedCreds.encrypted) {
 return encryptedCreds;
 }
 const jsonStr = atob(encryptedCreds.data);
 return JSON.parse(jsonStr);
 }
 async logAudit(event) {
 const auditEntry = {
 id: `audit_${Date.now()}`,
 ...event,
 user: this.getCurrentUser(),
 ip: await this.getClientIP(),
 timestamp: new Date()
 };
 this.auditLog.push(auditEntry);
 this.saveAuditLog();
 if (this.auditLog.length > 1000) {
 this.auditLog = this.auditLog.slice(-1000);
 }
 return auditEntry;
 }
 getCurrentUser() {
 const userStr = localStorage.getItem('uip_current_user');
 return userStr ? JSON.parse(userStr) : { id: 'system', name: 'System' };
 }
 async getClientIP() {
 return '127.0.0.1';
 }
 saveAuditLog() {
 const logs = this.getAuditLogs();
 localStorage.setItem('uip_audit_log', JSON.stringify(logs.slice(-10000)));
 }
 getAuditLogs(filters = {}) {
 let logs = [...this.auditLog];
 if (filters.action) {
 logs = logs.filter(l => l.action === filters.action);
 }
 if (filters.startDate) {
 logs = logs.filter(l => new Date(l.timestamp) >= new Date(filters.startDate));
 }
 if (filters.endDate) {
 logs = logs.filter(l => new Date(l.timestamp) <= new Date(filters.endDate));
 }
 return logs;
 }
 async exportGDPRData(userId) {
 const userData = {
 auditLogs: this.getAuditLogs().filter(l => l.user?.id === userId),
 connections: Array.from(IntegrationEngine.activeConnections.values())
 .filter(c => c.createdBy === userId),
 exportedAt: new Date(),
 format: 'GDPR_EXPORT_V1'
 };
 return userData;
 }
 async deleteUserData(userId) {
 this.auditLog = this.auditLog.filter(l => l.user?.id !== userId);
 this.saveAuditLog();
 await this.logAudit({
 action: 'gdpr_data_deletion',
 targetUserId: userId,
 timestamp: new Date()
 });
 return { success: true, message: 'User data deleted' };
 }
}
if (typeof module !== 'undefined' && module.exports) {
 module.exports = {
 IntegrationEngine,
 DataProcessingPipeline,
 RateLimiter,
 IntegrationMonitor,
 SecurityManager
 };
}