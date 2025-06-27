class BaseCarrierAdapter {
 constructor(config) {
 this.name = config.name;
 this.carrierId = config.carrierId;
 this.baseUrl = config.baseUrl;
 this.rateLimits = config.rateLimits || {
 maxRequests: 100,
 windowMs: 60000, // 1 minute
 maxBurst: 10
 };
 this.supportedTypes = config.supportedTypes || ['api'];
 }
 async testConnection(credentials, type) {
 try {
 switch (type) {
 case 'api':
 return await this.testAPIConnection(credentials);
 case 'edi':
 return await this.testEDIConnection(credentials);
 case 'email':
 return await this.testEmailConnection(credentials);
 case 'web':
 return await this.testWebConnection(credentials);
 default:
 return { success: false, error: 'Unsupported connection type' };
 }
 } catch (error) {
 return { success: false, error: error.message };
 }
 }
 async healthCheck(credentials) {
 return this.testConnection(credentials, 'api');
 }
 async fetchViaAPI(credentials, dataType, params) {
 throw new Error('fetchViaAPI must be implemented by carrier adapter');
 }
 async testAPIConnection(credentials) {
 throw new Error('testAPIConnection must be implemented by carrier adapter');
 }
 async fetchViaEDI(credentials, dataType, params) {
 throw new Error('EDI not implemented for this carrier');
 }
 async testEDIConnection(credentials) {
 return { success: false, error: 'EDI not supported' };
 }
 async fetchViaEmail(credentials, dataType, params) {
 throw new Error('Email integration not implemented for this carrier');
 }
 async testEmailConnection(credentials) {
 return { success: false, error: 'Email integration not supported' };
 }
 async fetchViaWeb(credentials, dataType, params) {
 throw new Error('Web scraping not implemented for this carrier');
 }
 async testWebConnection(credentials) {
 return { success: false, error: 'Web scraping not supported' };
 }
 async processManualUpload(file) {
 const text = await this.performOCR(file);
 const data = await this.parseOCRText(text);
 return data;
 }
 async performOCR(file) {
 console.log('Performing OCR on file:', file.name);
 return new Promise(resolve => {
 setTimeout(() => {
 resolve(`
 Container: MSKU1234567
 Status: In Transit
 Vessel: Maersk Eindhoven
 ETA: 2024-03-25
 Port: Los Angeles
 `);
 }, 1000);
 });
 }
 async parseOCRText(text) {
 const lines = text.split('\n').map(l => l.trim()).filter(l => l);
 const data = {};
 lines.forEach(line => {
 const [key, value] = line.split(':').map(s => s.trim());
 if (key && value) {
 data[key.toLowerCase()] = value;
 }
 });
 return [{
 containerNumber: data.container,
 status: data.status,
 vessel: data.vessel,
 eta: data.eta,
 location: data.port
 }];
 }
 async makeRequest(url, options = {}) {
 const controller = new AbortController();
 const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
 try {
 const response = await fetch(url, {
 ...options,
 signal: controller.signal
 });
 clearTimeout(timeout);
 if (!response.ok) {
 throw new Error(`HTTP ${response.status}: ${response.statusText}`);
 }
 return await response.json();
 } catch (error) {
 clearTimeout(timeout);
 if (error.name === 'AbortError') {
 throw new Error('Request timeout');
 }
 throw error;
 }
 }
}
class MaerskAdapter extends BaseCarrierAdapter {
 constructor() {
 super({
 name: 'Maersk',
 carrierId: 'maersk',
 baseUrl: 'https://api.maersk.com/v1',
 supportedTypes: ['api', 'edi'],
 rateLimits: {
 maxRequests: 300,
 windowMs: 60000,
 maxBurst: 20
 }
 });
 }
 async testAPIConnection(credentials) {
 try {
 const response = await this.makeRequest(`${this.baseUrl}/auth/validate`, {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${credentials.apiKey}`,
 'Consumer-Key': credentials.consumerKey
 }
 });
 return { success: true, message: 'Connection successful' };
 } catch (error) {
 return { success: false, error: error.message };
 }
 }
 async fetchViaAPI(credentials, dataType, params) {
 const endpoints = {
 containers: '/tracking/containers',
 bookings: '/bookings',
 schedules: '/schedules',
 invoices: '/invoices'
 };
 const endpoint = endpoints[dataType];
 if (!endpoint) {
 throw new Error(`Unsupported data type: ${dataType}`);
 }
 const url = new URL(`${this.baseUrl}${endpoint}`);
 if (params.containerNumbers) {
 url.searchParams.append('containerNumbers', params.containerNumbers.join(','));
 }
 if (params.bookingNumber) {
 url.searchParams.append('bookingNumber', params.bookingNumber);
 }
 if (params.dateFrom) {
 url.searchParams.append('dateFrom', params.dateFrom);
 }
 if (params.dateTo) {
 url.searchParams.append('dateTo', params.dateTo);
 }
 const response = await this.makeRequest(url.toString(), {
 headers: {
 'Authorization': `Bearer ${credentials.apiKey}`,
 'Consumer-Key': credentials.consumerKey,
 'Accept': 'application/json'
 }
 });
 return this.transformMaerskData(response, dataType);
 }
 transformMaerskData(response, dataType) {
 if (dataType === 'containers') {
 return response.containers.map(container => ({
 containerNumber: container.containerNumber,
 status: container.statusCode,
 location: container.lastKnownLocation,
 vessel: container.vessel?.name,
 voyage: container.voyage,
 eta: container.estimatedTimeOfArrival,
 etd: container.estimatedTimeOfDeparture,
 events: container.events?.map(e => ({
 timestamp: e.eventDateTime,
 description: e.eventDescription,
 location: e.location
 }))
 }));
 }
 return response;
 }
 async fetchViaEDI(credentials, dataType, params) {
 console.log('Fetching via EDI for Maersk');
 const ediConnection = await this.connectToEDI(credentials);
 const messages = await this.fetchEDIMessages(ediConnection, dataType);
 return this.parseEDIMessages(messages);
 }
 async connectToEDI(credentials) {
 return {
 host: credentials.ediHost,
 port: credentials.ediPort,
 username: credentials.ediUsername,
 connected: true
 };
 }
 async fetchEDIMessages(connection, dataType) {
 return [
 `UNB+UNOC:3+MAERSK+CUSTOMER+240315:1200+1234567890'
 UNH+1+IFTSTA:D:95B:UN:EAN007'
 BGM+340+ABC123+9'
 DTM+137:202403151200:203'
 NAD+CZ+MAERSK:160:ZZZ'
 EQD+CN+MSKU1234567+45G1:102:5'
 LOC+147+USLAX:139:6'
 STS+1+21::ZZZ'
 UNT+8+1'
 UNZ+1+1234567890'`
 ];
 }
 parseEDIMessages(messages) {
 return messages.map(message => {
 const lines = message.split('\n');
 const data = {};
 lines.forEach(line => {
 if (line.startsWith('EQD+CN+')) {
 const parts = line.split('+');
 data.containerNumber = parts[2];
 }
 if (line.startsWith('LOC+')) {
 const parts = line.split('+');
 data.location = parts[2].split(':')[0];
 }
 if (line.startsWith('STS+')) {
 const parts = line.split('+');
 data.status = parts[1];
 }
 });
 return data;
 });
 }
}
class MSCAdapter extends BaseCarrierAdapter {
 constructor() {
 super({
 name: 'MSC',
 carrierId: 'msc',
 baseUrl: 'https://api.msc.com/api/v1',
 supportedTypes: ['api', 'edi', 'web'],
 rateLimits: {
 maxRequests: 200,
 windowMs: 60000,
 maxBurst: 15
 }
 });
 }
 async testAPIConnection(credentials) {
 try {
 const response = await this.makeRequest(`${this.baseUrl}/auth`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 username: credentials.username,
 password: credentials.password,
 apiKey: credentials.apiKey
 })
 });
 return { success: true, token: response.token };
 } catch (error) {
 return { success: false, error: error.message };
 }
 }
 async fetchViaAPI(credentials, dataType, params) {
 const authResult = await this.testAPIConnection(credentials);
 if (!authResult.success) {
 throw new Error('Authentication failed');
 }
 const endpoints = {
 containers: '/cargo/tracking',
 bookings: '/bookings/list',
 schedules: '/schedules/search'
 };
 const response = await this.makeRequest(`${this.baseUrl}${endpoints[dataType]}`, {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${authResult.token}`,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify(params)
 });
 return this.transformMSCData(response, dataType);
 }
 transformMSCData(response, dataType) {
 if (dataType === 'containers') {
 return response.trackingResults.map(result => ({
 containerNumber: result.equipmentNumber,
 status: this.mapMSCStatus(result.lastStatus),
 location: result.currentLocation,
 vessel: result.vesselName,
 voyage: result.voyageNumber,
 eta: result.eta,
 pol: result.portOfLoading,
 pod: result.portOfDischarge
 }));
 }
 return response;
 }
 mapMSCStatus(mscStatus) {
 const statusMap = {
 'Empty to Shipper': 'EMPTY',
 'Gate In': 'GATE_IN',
 'Loaded': 'LOADED',
 'Discharged': 'DISCHARGED',
 'Gate Out': 'GATE_OUT',
 'Empty Return': 'EMPTY_RETURN'
 };
 return statusMap[mscStatus] || mscStatus;
 }
 async fetchViaWeb(credentials, dataType, params) {
 console.log('Web scraping MSC portal');
 const browser = await this.launchBrowser();
 const page = await browser.newPage();
 try {
 await page.goto('https://www.msc.com/track-a-shipment');
 await page.type('#username', credentials.username);
 await page.type('#password', credentials.password);
 await page.click('#loginButton');
 await page.waitForNavigation();
 await page.goto('https://www.msc.com/mycontainers');
 const data = await page.evaluate(() => {
 const containers = [];
 document.querySelectorAll('.container-row').forEach(row => {
 containers.push({
 containerNumber: row.querySelector('.container-id').textContent,
 status: row.querySelector('.status').textContent,
 location: row.querySelector('.location').textContent,
 eta: row.querySelector('.eta').textContent
 });
 });
 return containers;
 });
 return data;
 } finally {
 await browser.close();
 }
 }
 async launchBrowser() {
 return {
 newPage: async () => ({
 goto: async (url) => console.log('Navigating to:', url),
 type: async (selector, text) => console.log('Typing:', text),
 click: async (selector) => console.log('Clicking:', selector),
 waitForNavigation: async () => console.log('Waiting for navigation'),
 evaluate: async (fn) => {
 return [
 {
 containerNumber: 'MSCU1234567',
 status: 'In Transit',
 location: 'Singapore',
 eta: '2024-03-28'
 }
 ];
 }
 }),
 close: async () => console.log('Browser closed')
 };
 }
}
class CMACGMAdapter extends BaseCarrierAdapter {
 constructor() {
 super({
 name: 'CMA CGM',
 carrierId: 'cma-cgm',
 baseUrl: 'https://api.cma-cgm.com/v1',
 supportedTypes: ['api', 'email'],
 rateLimits: {
 maxRequests: 250,
 windowMs: 60000,
 maxBurst: 25
 }
 });
 }
 async testAPIConnection(credentials) {
 try {
 const response = await this.makeRequest(`${this.baseUrl}/ping`, {
 headers: {
 'X-API-Key': credentials.apiKey,
 'X-Customer-Code': credentials.customerCode
 }
 });
 return { success: response.status === 'ok' };
 } catch (error) {
 return { success: false, error: error.message };
 }
 }
 async fetchViaAPI(credentials, dataType, params) {
 const endpoints = {
 containers: '/container/tracking',
 bookings: '/booking/search',
 schedules: '/schedule/search',
 quotes: '/quote/search'
 };
 const response = await this.makeRequest(`${this.baseUrl}${endpoints[dataType]}`, {
 method: 'POST',
 headers: {
 'X-API-Key': credentials.apiKey,
 'X-Customer-Code': credentials.customerCode,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 ...params,
 customerCode: credentials.customerCode
 })
 });
 return this.transformCMACGMData(response, dataType);
 }
 transformCMACGMData(response, dataType) {
 if (dataType === 'containers') {
 return response.containers.map(container => ({
 containerNumber: container.containerReference,
 status: container.lastEvent?.status,
 location: container.lastEvent?.location,
 vessel: container.vesselName,
 voyage: container.voyageReference,
 eta: container.estimatedArrival,
 lastUpdate: container.lastEvent?.eventDate,
 route: container.route?.map(leg => ({
 from: leg.departurePort,
 to: leg.arrivalPort,
 vessel: leg.vesselName,
 etd: leg.etd,
 eta: leg.eta
 }))
 }));
 }
 return response;
 }
 async fetchViaEmail(credentials, dataType, params) {
 console.log('Fetching CMA CGM data via email');
 const emails = await this.fetchEmails(credentials);
 return this.parseContainerEmails(emails);
 }
 async fetchEmails(credentials) {
 return [
 {
 subject: 'Container Status Update - CMAU1234567',
 from: 'noreply@cma-cgm.com',
 date: new Date(),
 body: `
 Dear Customer,
 Your container CMAU1234567 has been updated:
 Status: Discharged
 Location: Port of Los Angeles
 Date: 2024-03-15 14:30
 Vessel: CMA CGM BENJAMIN FRANKLIN
 Thank you for choosing CMA CGM.
 `
 }
 ];
 }
 parseContainerEmails(emails) {
 return emails.map(email => {
 const containerMatch = email.subject.match(/([A-Z]{4}\d{7})/);
 const statusMatch = email.body.match(/Status:\s*(.+)/);
 const locationMatch = email.body.match(/Location:\s*(.+)/);
 const vesselMatch = email.body.match(/Vessel:\s*(.+)/);
 return {
 containerNumber: containerMatch?.[1],
 status: statusMatch?.[1]?.trim(),
 location: locationMatch?.[1]?.trim(),
 vessel: vesselMatch?.[1]?.trim(),
 emailDate: email.date,
 source: 'email'
 };
 }).filter(data => data.containerNumber);
 }
}
class HapagLloydAdapter extends BaseCarrierAdapter {
 constructor() {
 super({
 name: 'Hapag-Lloyd',
 carrierId: 'hapag-lloyd',
 baseUrl: 'https://api.hapag-lloyd.com/v2',
 supportedTypes: ['api', 'web'],
 rateLimits: {
 maxRequests: 150,
 windowMs: 60000,
 maxBurst: 10
 }
 });
 }
 async testAPIConnection(credentials) {
 try {
 const token = await this.getAuthToken(credentials);
 return { success: true, token };
 } catch (error) {
 return { success: false, error: error.message };
 }
 }
 async getAuthToken(credentials) {
 const response = await this.makeRequest(`${this.baseUrl}/oauth/token`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/x-www-form-urlencoded'
 },
 body: new URLSearchParams({
 grant_type: 'client_credentials',
 client_id: credentials.clientId,
 client_secret: credentials.clientSecret
 })
 });
 return response.access_token;
 }
 async fetchViaAPI(credentials, dataType, params) {
 const token = await this.getAuthToken(credentials);
 const endpoints = {
 containers: '/tracking/container',
 bookings: '/booking',
 schedules: '/schedule/port-to-port'
 };
 const url = new URL(`${this.baseUrl}${endpoints[dataType]}`);
 Object.entries(params).forEach(([key, value]) => {
 if (value) url.searchParams.append(key, value);
 });
 const response = await this.makeRequest(url.toString(), {
 headers: {
 'Authorization': `Bearer ${token}`,
 'Accept': 'application/json'
 }
 });
 return this.transformHapagLloydData(response, dataType);
 }
 transformHapagLloydData(response, dataType) {
 if (dataType === 'containers') {
 return response.data.map(container => ({
 containerNumber: container.equipmentNumber,
 status: container.transportStatus,
 location: container.currentLocation,
 vessel: container.currentVessel,
 voyage: container.currentVoyage,
 eta: container.predictedTimeOfArrival,
 pod: container.placeOfDelivery,
 events: container.transportEvents?.map(event => ({
 timestamp: event.eventDateTime,
 status: event.transportEventTypeCode,
 location: event.location
 }))
 }));
 }
 return response;
 }
}
class ONEAdapter extends BaseCarrierAdapter {
 constructor() {
 super({
 name: 'ONE',
 carrierId: 'one',
 baseUrl: 'https://api.one-line.com/v1',
 supportedTypes: ['api'],
 rateLimits: {
 maxRequests: 100,
 windowMs: 60000,
 maxBurst: 5
 }
 });
 }
 async testAPIConnection(credentials) {
 try {
 const response = await this.makeRequest(`${this.baseUrl}/auth/validate`, {
 method: 'GET',
 headers: {
 'API-Key': credentials.apiKey,
 'Customer-ID': credentials.customerId
 }
 });
 return { success: response.valid === true };
 } catch (error) {
 return { success: false, error: error.message };
 }
 }
 async fetchViaAPI(credentials, dataType, params) {
 const endpoints = {
 containers: '/cargo-tracking',
 bookings: '/bookings',
 invoices: '/invoices'
 };
 const response = await this.makeRequest(`${this.baseUrl}${endpoints[dataType]}`, {
 method: 'POST',
 headers: {
 'API-Key': credentials.apiKey,
 'Customer-ID': credentials.customerId,
 'Content-Type': 'application/json'
 },
 body: JSON.stringify(params)
 });
 return this.transformONEData(response, dataType);
 }
 transformONEData(response, dataType) {
 if (dataType === 'containers') {
 return response.cargoTrackingList.map(tracking => ({
 containerNumber: tracking.containerNo,
 status: tracking.statusNm,
 location: tracking.placeNm,
 vessel: tracking.vslEngNm,
 voyage: tracking.voyNo,
 eta: tracking.eta,
 etd: tracking.etd,
 pol: tracking.polNm,
 pod: tracking.podNm
 }));
 }
 return response;
 }
}
class GenericCarrierAdapter extends BaseCarrierAdapter {
 constructor(config) {
 super(config);
 this.authConfig = config.auth;
 this.endpoints = config.endpoints;
 this.transformers = config.transformers;
 }
 async testAPIConnection(credentials) {
 try {
 const authHeaders = await this.buildAuthHeaders(credentials);
 const response = await this.makeRequest(
 `${this.baseUrl}${this.endpoints.test || '/ping'}`,
 {
 headers: authHeaders
 }
 );
 return { success: true, response };
 } catch (error) {
 return { success: false, error: error.message };
 }
 }
 async buildAuthHeaders(credentials) {
 const headers = {};
 switch (this.authConfig.type) {
 case 'bearer':
 headers['Authorization'] = `Bearer ${credentials[this.authConfig.tokenField || 'apiKey']}`;
 break;
 case 'apikey':
 headers[this.authConfig.headerName || 'X-API-Key'] = credentials[this.authConfig.keyField || 'apiKey'];
 break;
 case 'basic':
 const auth = btoa(`${credentials.username}:${credentials.password}`);
 headers['Authorization'] = `Basic ${auth}`;
 break;
 case 'custom':
 Object.entries(this.authConfig.headers).forEach(([key, value]) => {
 headers[key] = credentials[value] || value;
 });
 break;
 }
 return headers;
 }
 async fetchViaAPI(credentials, dataType, params) {
 const endpoint = this.endpoints[dataType];
 if (!endpoint) {
 throw new Error(`No endpoint configured for data type: ${dataType}`);
 }
 const authHeaders = await this.buildAuthHeaders(credentials);
 const response = await this.makeRequest(`${this.baseUrl}${endpoint}`, {
 method: endpoint.method || 'GET',
 headers: {
 ...authHeaders,
 'Content-Type': 'application/json'
 },
 body: endpoint.method === 'POST' ? JSON.stringify(params) : undefined
 });
 return this.transformData(response, dataType);
 }
 transformData(response, dataType) {
 const transformer = this.transformers[dataType];
 if (!transformer) {
 return response;
 }
 if (typeof transformer === 'function') {
 return transformer(response);
 }
 const data = this.getNestedValue(response, transformer.root || '');
 if (!Array.isArray(data)) {
 return [this.mapFields(data, transformer.fields)];
 }
 return data.map(item => this.mapFields(item, transformer.fields));
 }
 mapFields(source, fieldMap) {
 const result = {};
 Object.entries(fieldMap).forEach(([targetField, sourceField]) => {
 result[targetField] = this.getNestedValue(source, sourceField);
 });
 return result;
 }
 getNestedValue(obj, path) {
 if (!path) return obj;
 return path.split('.').reduce((current, key) => 
 current && current[key] !== undefined ? current[key] : null, 
 obj
 );
 }
}
class EvergreenAdapter extends GenericCarrierAdapter {
 constructor() {
 super({
 name: 'Evergreen',
 carrierId: 'evergreen',
 baseUrl: 'https://api.evergreen-marine.com/v1',
 supportedTypes: ['api'],
 auth: {
 type: 'apikey',
 headerName: 'X-API-Key'
 },
 endpoints: {
 test: '/health',
 containers: '/shipments/track',
 schedules: '/schedules'
 },
 transformers: {
 containers: {
 root: 'shipments',
 fields: {
 containerNumber: 'containerNo',
 status: 'status',
 location: 'currentLocation',
 vessel: 'vesselName',
 voyage: 'voyageNo',
 eta: 'eta'
 }
 }
 }
 });
 }
}
class COSCOAdapter extends GenericCarrierAdapter {
 constructor() {
 super({
 name: 'COSCO',
 carrierId: 'cosco',
 baseUrl: 'https://api.cosco.com/service/v1',
 supportedTypes: ['api', 'edi'],
 auth: {
 type: 'custom',
 headers: {
 'App-Key': 'appKey',
 'App-Secret': 'appSecret'
 }
 },
 endpoints: {
 test: '/system/ping',
 containers: '/cargo/tracking',
 bookings: '/booking/query'
 },
 transformers: {
 containers: response => {
 return response.data.trackingInfo.map(info => ({
 containerNumber: info.cntrNo,
 status: info.cntrStatus,
 location: info.location,
 vessel: info.vslName,
 voyage: info.voyage,
 eta: info.eta,
 movement: info.cntrMovement
 }));
 }
 }
 });
 }
}
class YangMingAdapter extends GenericCarrierAdapter {
 constructor() {
 super({
 name: 'Yang Ming',
 carrierId: 'yang-ming',
 baseUrl: 'https://api.yangming.com/open/v1',
 supportedTypes: ['api'],
 auth: {
 type: 'bearer'
 },
 endpoints: {
 test: '/auth/verify',
 containers: '/tracking/container',
 schedules: '/schedule/search'
 },
 transformers: {
 containers: {
 root: 'result.containers',
 fields: {
 containerNumber: 'cntrNo',
 status: 'statusDesc',
 location: 'locationName',
 vessel: 'vesselName',
 voyage: 'voyageNo',
 eta: 'etaDate'
 }
 }
 }
 });
 }
}
class ZIMAdapter extends GenericCarrierAdapter {
 constructor() {
 super({
 name: 'ZIM',
 carrierId: 'zim',
 baseUrl: 'https://api.zim.com/v1',
 supportedTypes: ['api', 'web'],
 auth: {
 type: 'apikey',
 headerName: 'Ocp-Apim-Subscription-Key'
 },
 endpoints: {
 test: '/health/ping',
 containers: '/tracking/trackunits',
 bookings: '/booking/bookings'
 },
 transformers: {
 containers: response => {
 return response.TrackedUnits.map(unit => ({
 containerNumber: unit.ContainerNumber,
 status: unit.LastStatus,
 location: unit.LastLocation,
 vessel: unit.VesselName,
 voyage: unit.VoyageNumber,
 eta: unit.EstimatedArrival,
 lastEvent: {
 date: unit.LastEventDate,
 description: unit.LastEventDescription
 }
 }));
 }
 }
 });
 }
}
class HMMAdapter extends GenericCarrierAdapter {
 constructor() {
 super({
 name: 'HMM (Hyundai Merchant Marine)',
 carrierId: 'hmm',
 baseUrl: 'https://api.hmm21.com/api/v1',
 supportedTypes: ['api'],
 auth: {
 type: 'custom',
 headers: {
 'Authorization': 'apiKey',
 'User-Agent': 'userAgent'
 }
 },
 endpoints: {
 test: '/common/health',
 containers: '/cargo/tracking',
 bookings: '/booking/list'
 },
 transformers: {
 containers: {
 root: 'data',
 fields: {
 containerNumber: 'cntrNo',
 status: 'cntrSts',
 location: 'locNm',
 vessel: 'vslEngNm',
 voyage: 'voyNo',
 eta: 'eta',
 pol: 'polNm',
 pod: 'podNm'
 }
 }
 }
 });
 }
}
if (typeof module !== 'undefined' && module.exports) {
 module.exports = {
 BaseCarrierAdapter,
 MaerskAdapter,
 MSCAdapter,
 CMACGMAdapter,
 HapagLloydAdapter,
 ONEAdapter,
 GenericCarrierAdapter,
 EvergreenAdapter,
 COSCOAdapter,
 YangMingAdapter,
 ZIMAdapter,
 HMMAdapter
 };
}