// Test Maersk OAuth 2.0 Integration
// Production credentials testing for real API connection

const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

class MaerskOAuthTest {
    constructor() {
        this.clientId = process.env.MAERSK_CLIENT_ID || 'your-maersk-client-id';
        this.clientSecret = process.env.MAERSK_CLIENT_SECRET || 'YFCyxmMCchO5lRGo';
        this.oauthUrl = process.env.MAERSK_OAUTH_URL || 'https://api.maersk.com/customer-identity/oauth/v2/access_token';
        this.apiBaseUrl = process.env.MAERSK_API_BASE_URL || 'https://api.maersk.com';
        
        console.log('🔑 Maersk OAuth Test Configuration:');
        console.log(`   Client ID: ${this.clientId}`);
        console.log(`   OAuth URL: ${this.oauthUrl}`);
        console.log(`   API Base: ${this.apiBaseUrl}`);
        console.log('');
    }
    
    async testAuthentication() {
        console.log('🚀 Testing Maersk OAuth Authentication...');
        
        try {
            const authPayload = {
                grant_type: 'client_credentials',
                client_id: this.clientId,
                client_secret: this.clientSecret
            };
            
            console.log('📤 Sending OAuth request...');
            
            const response = await axios.post(this.oauthUrl, authPayload, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 30000 // 30 second timeout
            });
            
            console.log('✅ OAuth Authentication Successful!');
            console.log('📊 Response Data:');
            console.log(`   Access Token: ${response.data.access_token?.substring(0, 20)}...`);
            console.log(`   Token Type: ${response.data.token_type}`);
            console.log(`   Expires In: ${response.data.expires_in} seconds`);
            console.log(`   Scope: ${response.data.scope || 'Not specified'}`);
            
            return {
                success: true,
                accessToken: response.data.access_token,
                tokenType: response.data.token_type,
                expiresIn: response.data.expires_in,
                scope: response.data.scope
            };
            
        } catch (error) {
            console.error('❌ OAuth Authentication Failed:');
            
            if (error.response) {
                console.error(`   Status: ${error.response.status}`);
                console.error(`   Status Text: ${error.response.statusText}`);
                console.error(`   Error Data:`, error.response.data);
                
                if (error.response.status === 401) {
                    console.error('   💡 Possible causes:');
                    console.error('      - Invalid client credentials');
                    console.error('      - Credentials not approved for production');
                    console.error('      - API access not enabled');
                }
            } else if (error.request) {
                console.error('   Network Error:', error.message);
                console.error('   💡 Possible causes:');
                console.error('      - Network connectivity issues');
                console.error('      - API endpoint not reachable');
                console.error('      - Firewall blocking requests');
            } else {
                console.error('   Configuration Error:', error.message);
            }
            
            return {
                success: false,
                error: error.message,
                details: error.response?.data || error.request || error
            };
        }
    }
    
    async testContainerTracking(accessToken, containerNumber = 'TCLU1234567') {
        console.log('🔍 Testing Container Tracking API...');
        console.log(`   Container: ${containerNumber}`);
        
        try {
            const trackingUrl = `${this.apiBaseUrl}/track/v1/containers/${containerNumber}`;
            console.log(`   Endpoint: ${trackingUrl}`);
            
            const response = await axios.get(trackingUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                },
                timeout: 30000
            });
            
            console.log('✅ Container Tracking Successful!');
            console.log('📊 Tracking Data:');
            console.log(`   Status: ${response.data.transportStatus || 'Not available'}`);
            console.log(`   Location: ${response.data.currentLocation?.description || 'Not available'}`);
            console.log(`   Vessel: ${response.data.vesselName || 'Not available'}`);
            console.log(`   Voyage: ${response.data.voyageNumber || 'Not available'}`);
            console.log(`   ETA: ${response.data.estimatedTimeOfArrival || 'Not available'}`);
            console.log(`   Events: ${response.data.events?.length || 0} events`);
            
            return {
                success: true,
                trackingData: response.data
            };
            
        } catch (error) {
            console.error('❌ Container Tracking Failed:');
            
            if (error.response) {
                console.error(`   Status: ${error.response.status}`);
                console.error(`   Status Text: ${error.response.statusText}`);
                console.error(`   Error Data:`, error.response.data);
                
                if (error.response.status === 404) {
                    console.error('   💡 Container not found or not accessible');
                    console.error('      - Try with a different container number');
                    console.error('      - Ensure container belongs to your account');
                } else if (error.response.status === 401) {
                    console.error('   💡 Authorization failed');
                    console.error('      - Access token may be expired');
                    console.error('      - Insufficient permissions for tracking API');
                }
            } else {
                console.error('   Network/Configuration Error:', error.message);
            }
            
            return {
                success: false,
                error: error.message,
                details: error.response?.data || error
            };
        }
    }
    
    async testAPIEndpoints(accessToken) {
        console.log('🔍 Testing Available API Endpoints...');
        
        const endpoints = [
            { path: '/track/v1/containers', method: 'GET', description: 'Container tracking' },
            { path: '/track/v1/shipments', method: 'GET', description: 'Shipment tracking' },
            { path: '/locations/v1/ports', method: 'GET', description: 'Port information' },
            { path: '/vessels/v1/vessels', method: 'GET', description: 'Vessel information' }
        ];
        
        const results = [];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`   Testing ${endpoint.path}...`);
                
                const response = await axios.get(`${this.apiBaseUrl}${endpoint.path}`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    },
                    timeout: 10000
                });
                
                console.log(`   ✅ ${endpoint.description}: Available`);
                results.push({
                    endpoint: endpoint.path,
                    description: endpoint.description,
                    available: true,
                    status: response.status
                });
                
            } catch (error) {
                const status = error.response?.status || 'Network Error';
                console.log(`   ❌ ${endpoint.description}: ${status}`);
                results.push({
                    endpoint: endpoint.path,
                    description: endpoint.description,
                    available: false,
                    status: status,
                    error: error.message
                });
            }
        }
        
        return results;
    }
    
    async runFullTest() {
        console.log('🧪 MAERSK PRODUCTION API INTEGRATION TEST');
        console.log('==========================================');
        console.log('');
        
        // Test 1: Authentication
        const authResult = await this.testAuthentication();
        console.log('');
        
        if (!authResult.success) {
            console.log('❌ Authentication failed. Cannot proceed with further tests.');
            return { success: false, stage: 'authentication', error: authResult.error };
        }
        
        // Test 2: Container Tracking
        const trackingResult = await this.testContainerTracking(authResult.accessToken);
        console.log('');
        
        // Test 3: API Endpoints
        const endpointResults = await this.testAPIEndpoints(authResult.accessToken);
        console.log('');
        
        // Summary
        console.log('📋 TEST SUMMARY');
        console.log('===============');
        console.log(`✅ Authentication: ${authResult.success ? 'PASSED' : 'FAILED'}`);
        console.log(`${trackingResult.success ? '✅' : '❌'} Container Tracking: ${trackingResult.success ? 'PASSED' : 'FAILED'}`);
        
        const availableEndpoints = endpointResults.filter(r => r.available).length;
        console.log(`📊 Available Endpoints: ${availableEndpoints}/${endpointResults.length}`);
        
        console.log('');
        
        if (authResult.success && trackingResult.success) {
            console.log('🎉 MAERSK API INTEGRATION READY FOR PRODUCTION!');
            console.log('   ✅ OAuth authentication working');
            console.log('   ✅ Container tracking operational');
            console.log('   ✅ Real-time data access confirmed');
            
            return {
                success: true,
                authentication: authResult,
                tracking: trackingResult,
                endpoints: endpointResults
            };
        } else {
            console.log('⚠️  MAERSK API INTEGRATION NEEDS ATTENTION');
            console.log('   Review the errors above before proceeding');
            
            return {
                success: false,
                authentication: authResult,
                tracking: trackingResult,
                endpoints: endpointResults
            };
        }
    }
}

// Run test if called directly
if (require.main === module) {
    const test = new MaerskOAuthTest();
    test.runFullTest().then(result => {
        console.log('');
        console.log('Test completed. Results:', result.success ? 'SUCCESS' : 'NEEDS ATTENTION');
        process.exit(result.success ? 0 : 1);
    }).catch(error => {
        console.error('Test failed with error:', error);
        process.exit(1);
    });
}

module.exports = MaerskOAuthTest;