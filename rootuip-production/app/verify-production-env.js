#!/usr/bin/env node

/**
 * ROOTUIP Production Environment Verification
 * Checks all environment variables and configurations
 */

const fs = require('fs');
const path = require('path');

// Color codes for output
const colors = {
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    reset: '\x1b[0m'
};

console.log('\n🔍 ROOTUIP Production Environment Verification');
console.log('==============================================\n');

// Required environment variables
const requiredVars = {
    core: [
        'NODE_ENV',
        'PORT',
        'HOST',
        'APP_URL',
        'API_URL'
    ],
    database: [
        'DATABASE_URL',
        'REDIS_URL'
    ],
    maersk: [
        'MAERSK_CLIENT_ID',
        'MAERSK_CLIENT_SECRET',
        'MAERSK_APP_ID'
    ],
    authentication: [
        'JWT_SECRET',
        'SESSION_SECRET',
        'SAML_ENTITY_ID',
        'SAML_CONSUMER_SERVICE_URL'
    ],
    integrations: [
        'SENDGRID_API_KEY',
        'HUBSPOT_ACCESS_TOKEN',
        'STRIPE_API_KEY'
    ],
    services: [
        'API_GATEWAY_PORT',
        'AUTH_SERVICE_PORT',
        'DEMO_PLATFORM_PORT',
        'AI_ML_ENGINE_PORT',
        'WEBSOCKET_PORT',
        'MAERSK_SERVICE_PORT',
        'CUSTOMER_SUCCESS_PORT'
    ]
};

// Load environment from .env.production
function loadEnvFile() {
    const envPath = path.join(__dirname, '.env.production');
    if (!fs.existsSync(envPath)) {
        console.log(`${colors.red}❌ .env.production file not found!${colors.reset}`);
        return {};
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};
    
    envContent.split('\n').forEach(line => {
        if (line && !line.startsWith('#') && line.includes('=')) {
            const [key, ...valueParts] = line.split('=');
            env[key.trim()] = valueParts.join('=').trim();
        }
    });
    
    return env;
}

// Check environment variables
function checkEnvironment() {
    const env = loadEnvFile();
    let allGood = true;
    
    Object.entries(requiredVars).forEach(([category, vars]) => {
        console.log(`\n📂 ${category.toUpperCase()}`);
        console.log('─'.repeat(40));
        
        vars.forEach(varName => {
            const value = env[varName];
            if (value && value !== '') {
                // Mask sensitive values
                let displayValue = value;
                if (varName.includes('SECRET') || varName.includes('KEY') || varName.includes('PASSWORD')) {
                    displayValue = value.substring(0, 6) + '...***';
                }
                console.log(`${colors.green}✓${colors.reset} ${varName}: ${displayValue}`);
            } else {
                console.log(`${colors.red}✗${colors.reset} ${varName}: NOT SET`);
                allGood = false;
            }
        });
    });
    
    return allGood;
}

// Check file system
function checkFileSystem() {
    console.log('\n📁 FILE SYSTEM CHECK');
    console.log('─'.repeat(40));
    
    const requiredFiles = [
        'integration-gateway.js',
        'auth-unified.js',
        'enterprise-demo-platform.js',
        'ai-ml-simulation-engine.js',
        'real-time-websocket-server.js',
        'maersk-oauth-integration.js',
        'customer-success-platform.js',
        'package.json',
        'nginx-unified.conf',
        'public/index.html',
        'public/app.html'
    ];
    
    let allFilesExist = true;
    
    requiredFiles.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            console.log(`${colors.green}✓${colors.reset} ${file}`);
        } else {
            console.log(`${colors.red}✗${colors.reset} ${file} - NOT FOUND`);
            allFilesExist = false;
        }
    });
    
    return allFilesExist;
}

// Check ports
function checkPorts() {
    console.log('\n🔌 SERVICE PORTS');
    console.log('─'.repeat(40));
    
    const env = loadEnvFile();
    const ports = {
        'API Gateway': env.API_GATEWAY_PORT || '3007',
        'Auth Service': env.AUTH_SERVICE_PORT || '3003',
        'Demo Platform': env.DEMO_PLATFORM_PORT || '3001',
        'AI/ML Engine': env.AI_ML_ENGINE_PORT || '3002',
        'WebSocket Server': env.WEBSOCKET_PORT || '3004',
        'Maersk Service': env.MAERSK_SERVICE_PORT || '3005',
        'Customer Success': env.CUSTOMER_SUCCESS_PORT || '3006'
    };
    
    Object.entries(ports).forEach(([service, port]) => {
        console.log(`${service}: ${colors.yellow}${port}${colors.reset}`);
    });
}

// Check feature flags
function checkFeatures() {
    console.log('\n⚡ FEATURE FLAGS');
    console.log('─'.repeat(40));
    
    const env = loadEnvFile();
    const features = [
        'ENABLE_REAL_TIME_TRACKING',
        'ENABLE_AI_PREDICTIONS',
        'ENABLE_DOCUMENT_PROCESSING',
        'ENABLE_MULTI_CARRIER',
        'ENABLE_SSO',
        'ENABLE_API_RATE_LIMITING',
        'ENABLE_WEBHOOK_NOTIFICATIONS'
    ];
    
    features.forEach(feature => {
        const enabled = env[feature] === 'true';
        const status = enabled ? `${colors.green}ENABLED${colors.reset}` : `${colors.red}DISABLED${colors.reset}`;
        console.log(`${feature}: ${status}`);
    });
}

// Main verification
console.log('🔍 Checking environment variables...');
const envOk = checkEnvironment();

console.log('\n🔍 Checking required files...');
const filesOk = checkFileSystem();

checkPorts();
checkFeatures();

// Summary
console.log('\n📊 VERIFICATION SUMMARY');
console.log('─'.repeat(40));

if (envOk && filesOk) {
    console.log(`${colors.green}✅ All checks passed! Ready for production deployment.${colors.reset}`);
} else {
    console.log(`${colors.red}❌ Some checks failed. Please fix the issues above before deploying.${colors.reset}`);
    process.exit(1);
}

console.log('\n📋 Next Steps:');
console.log('1. Run: ./deploy-production.sh');
console.log('2. Follow the deployment instructions');
console.log('3. Monitor services after deployment\n');