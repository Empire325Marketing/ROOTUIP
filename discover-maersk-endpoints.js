// Maersk API Endpoint Discovery
// Test various endpoints to find the correct authentication URL

const axios = require('axios');

class MaerskEndpointDiscovery {
    constructor() {
        this.baseUrls = [
            'https://api.maersk.com',
            'https://api.maersk.com/customer-identity',
            'https://developer.maersk.com/api',
            'https://maersk.com/api'
        ];
        
        this.authPaths = [
            '/oauth/v2/access_token',
            '/oauth2/access_token',
            '/oauth2/token',
            '/oauth/token',
            '/auth/token',
            '/token',
            '/customer-identity/oauth/v2/access_token'
        ];
        
        this.trackingPaths = [
            '/track/v1/containers',
            '/tracking/v1/containers',
            '/container-tracking/v1',
            '/track-trace/v1/containers'
        ];
    }
    
    async discoverEndpoints() {
        console.log('🔍 Discovering Maersk API Endpoints...\n');
        
        const results = {
            oauth: [],
            tracking: [],
            general: []
        };
        
        // Test OAuth endpoints
        console.log('🔑 Testing OAuth Endpoints:');
        for (const baseUrl of this.baseUrls) {
            for (const path of this.authPaths) {
                const fullUrl = `${baseUrl}${path}`;
                const result = await this.testEndpoint(fullUrl, 'POST');
                
                if (result.accessible) {
                    results.oauth.push({ url: fullUrl, ...result });
                    console.log(`   ✅ ${fullUrl} - Status: ${result.status}`);
                } else {
                    console.log(`   ❌ ${fullUrl} - ${result.error}`);
                }
            }
        }
        
        console.log('\n📦 Testing Tracking Endpoints:');
        for (const baseUrl of this.baseUrls) {
            for (const path of this.trackingPaths) {
                const fullUrl = `${baseUrl}${path}`;
                const result = await this.testEndpoint(fullUrl, 'GET');
                
                if (result.accessible) {
                    results.tracking.push({ url: fullUrl, ...result });
                    console.log(`   ✅ ${fullUrl} - Status: ${result.status}`);
                } else {
                    console.log(`   ❌ ${fullUrl} - ${result.error}`);
                }
            }
        }
        
        // Test base API endpoints
        console.log('\n🌐 Testing Base API Endpoints:');
        for (const baseUrl of this.baseUrls) {
            const result = await this.testEndpoint(baseUrl, 'GET');
            
            if (result.accessible) {
                results.general.push({ url: baseUrl, ...result });
                console.log(`   ✅ ${baseUrl} - Status: ${result.status}`);
            } else {
                console.log(`   ❌ ${baseUrl} - ${result.error}`);
            }
        }
        
        return results;
    }
    
    async testEndpoint(url, method = 'GET') {
        try {
            const options = {
                method,
                url,
                timeout: 10000,
                validateStatus: () => true // Accept all status codes
            };
            
            // For POST requests (OAuth), add form data
            if (method === 'POST') {
                options.data = new URLSearchParams({
                    grant_type: 'client_credentials',
                    client_id: 'test',
                    client_secret: 'test'
                });
                options.headers = {
                    'Content-Type': 'application/x-www-form-urlencoded'
                };
            }
            
            const response = await axios(options);
            
            return {
                accessible: response.status !== 404,
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
                data: this.summarizeResponse(response.data)
            };
            
        } catch (error) {
            if (error.response) {
                return {
                    accessible: error.response.status !== 404,
                    status: error.response.status,
                    error: error.response.statusText || error.message,
                    data: this.summarizeResponse(error.response.data)
                };
            } else {
                return {
                    accessible: false,
                    error: error.message
                };
            }
        }
    }
    
    summarizeResponse(data) {
        if (!data) return null;
        
        if (typeof data === 'string') {
            return data.length > 200 ? data.substring(0, 200) + '...' : data;
        }
        
        if (typeof data === 'object') {
            const summary = {};
            const keys = Object.keys(data).slice(0, 5); // First 5 keys
            
            for (const key of keys) {
                summary[key] = typeof data[key] === 'string' && data[key].length > 100
                    ? data[key].substring(0, 100) + '...'
                    : data[key];
            }
            
            return summary;
        }
        
        return data;
    }
    
    async testOAuthWithRealCredentials() {
        console.log('\n🔐 Testing OAuth with Real Credentials:');
        
        const credentials = {
            client_id: 'your-maersk-client-id',
            client_secret: 'YFCyxmMCchO5lRGo'
        };
        
        const oauthUrls = [
            'https://api.maersk.com/customer-identity/oauth/v2/access_token',
            'https://api.maersk.com/oauth2/access_token',
            'https://api.maersk.com/oauth/v2/access_token',
            'https://developer.maersk.com/oauth2/access_token'
        ];
        
        for (const url of oauthUrls) {
            try {
                console.log(`\n   Testing: ${url}`);
                
                const response = await axios.post(url, new URLSearchParams({
                    grant_type: 'client_credentials',
                    ...credentials
                }), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Consumer-Key': credentials.client_id
                    },
                    timeout: 15000,
                    validateStatus: () => true
                });
                
                console.log(`   Status: ${response.status} ${response.statusText}`);
                
                if (response.status === 200) {
                    console.log('   ✅ SUCCESS! Access token received');
                    console.log(`   Token: ${response.data.access_token?.substring(0, 20)}...`);
                    console.log(`   Expires: ${response.data.expires_in} seconds`);
                    return { url, success: true, data: response.data };
                } else if (response.status === 401) {
                    console.log('   🔑 Endpoint exists but credentials invalid/not approved');
                } else if (response.status === 400) {
                    console.log('   ⚠️  Bad request - check parameters');
                    console.log(`   Error: ${JSON.stringify(response.data)}`);
                } else {
                    console.log(`   ❌ ${response.status}: ${JSON.stringify(response.data)}`);
                }
                
            } catch (error) {
                if (error.response) {
                    console.log(`   ❌ ${error.response.status}: ${error.response.statusText}`);
                } else {
                    console.log(`   ❌ Network error: ${error.message}`);
                }
            }
        }
        
        return null;
    }
    
    async checkMaerskDocumentation() {
        console.log('\n📚 Checking Maersk Developer Documentation:');
        
        const docUrls = [
            'https://developer.maersk.com',
            'https://api.maersk.com/docs',
            'https://api.maersk.com/.well-known/openapi_definition',
            'https://api.maersk.com/swagger',
            'https://developer.maersk.com/api-catalogue'
        ];
        
        for (const url of docUrls) {
            const result = await this.testEndpoint(url);
            
            if (result.accessible) {
                console.log(`   ✅ ${url} - Available`);
            } else {
                console.log(`   ❌ ${url} - Not accessible`);
            }
        }
    }
    
    async run() {
        console.log('🚢 MAERSK API ENDPOINT DISCOVERY');
        console.log('================================\n');
        
        const results = await this.discoverEndpoints();
        
        console.log('\n📋 DISCOVERY SUMMARY:');
        console.log(`   OAuth endpoints found: ${results.oauth.length}`);
        console.log(`   Tracking endpoints found: ${results.tracking.length}`);
        console.log(`   General endpoints found: ${results.general.length}`);
        
        await this.testOAuthWithRealCredentials();
        await this.checkMaerskDocumentation();
        
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('   1. Check developer.maersk.com for latest API documentation');
        console.log('   2. Verify credentials are approved for production use');
        console.log('   3. Contact Maersk API support: apisupport@maersk.com');
        console.log('   4. Ensure application is properly registered');
        
        return results;
    }
}

// Run discovery if called directly
if (require.main === module) {
    const discovery = new MaerskEndpointDiscovery();
    discovery.run().catch(error => {
        console.error('Discovery failed:', error);
        process.exit(1);
    });
}

module.exports = MaerskEndpointDiscovery;