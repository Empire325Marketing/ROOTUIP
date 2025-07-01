#!/usr/bin/env node

/**
 * ROOTUIP Environment Configuration Verification
 * Validates that all required environment variables are properly configured
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔍 ROOTUIP Environment Configuration Verification\n');

// Load environment variables
require('dotenv').config();

// Required configuration sections
const configSections = {
  'Microsoft Entra SAML': [
    'SAML_METADATA_URL',
    'SAML_LOGIN_URL',
    'SAML_ISSUER',
    'SAML_LOGOUT_URL',
    'SAML_CERT_PATH',
    'SAML_ENTITY_ID',
    'SAML_CONSUMER_SERVICE_URL'
  ],
  'Maersk OAuth 2.0': [
    'MAERSK_CLIENT_ID',
    'MAERSK_CLIENT_SECRET',
    'MAERSK_APP_ID',
    'MAERSK_API_BASE'
  ],
  'Azure Tenant': [
    'AZURE_TENANT_ID',
    'AZURE_APP_ID'
  ],
  'Database & Security': [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'REDIS_URL'
  ],
  'Application': [
    'NODE_ENV',
    'PORT',
    'HOST'
  ]
};

let allValid = true;

// Check each configuration section
for (const [section, vars] of Object.entries(configSections)) {
  console.log(`\n📋 ${section}:`);
  
  for (const varName of vars) {
    const value = process.env[varName];
    
    if (!value) {
      console.log(`  ❌ ${varName}: NOT SET`);
      allValid = false;
    } else if (varName.includes('SECRET') || varName.includes('PASSWORD')) {
      console.log(`  ✅ ${varName}: ****** (hidden)`);
    } else if (varName === 'SAML_CERT_PATH') {
      // Check if certificate file exists
      const certPath = path.resolve(value);
      if (fs.existsSync(certPath)) {
        const stats = fs.statSync(certPath);
        console.log(`  ✅ ${varName}: ${value} (${stats.size} bytes)`);
      } else {
        console.log(`  ❌ ${varName}: ${value} (FILE NOT FOUND)`);
        allValid = false;
      }
    } else {
      console.log(`  ✅ ${varName}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
    }
  }
}

// Verify JWT secret strength
console.log('\n🔐 Security Checks:');
const jwtSecret = process.env.JWT_SECRET;
if (jwtSecret && jwtSecret.length >= 32) {
  console.log('  ✅ JWT_SECRET: Strong (32+ characters)');
} else {
  console.log('  ❌ JWT_SECRET: Weak (less than 32 characters)');
  allValid = false;
}

// Check SAML certificate
console.log('\n📜 SAML Certificate:');
const certPath = process.env.SAML_CERT_PATH;
if (certPath) {
  const resolvedPath = path.resolve(certPath);
  if (fs.existsSync(resolvedPath)) {
    try {
      const cert = fs.readFileSync(resolvedPath, 'utf8');
      if (cert.includes('BEGIN CERTIFICATE')) {
        console.log('  ✅ Valid certificate format detected');
        console.log(`  📍 Location: ${resolvedPath}`);
      } else {
        console.log('  ⚠️  Certificate file exists but format may be incorrect');
      }
    } catch (error) {
      console.log('  ❌ Error reading certificate:', error.message);
    }
  } else {
    console.log('  ❌ Certificate file not found at:', resolvedPath);
  }
}

// Summary
console.log('\n' + '='.repeat(50));
if (allValid) {
  console.log('✅ All required environment variables are configured!');
  console.log('\n🚀 Your ROOTUIP authentication system is ready for deployment.');
} else {
  console.log('❌ Some required environment variables are missing or invalid.');
  console.log('\n⚠️  Please check the configuration and try again.');
}

console.log('\n💡 Tips:');
console.log('  - Keep your .env file secure and never commit it to version control');
console.log('  - Regularly rotate your secrets and API keys');
console.log('  - Use environment-specific .env files for different deployments');
console.log('  - Consider using a secrets management service for production');

// Test database connection if possible
if (process.env.DATABASE_URL) {
  console.log('\n🔗 Testing database connection...');
  // Note: Actual connection test would require pg module
  console.log('  ℹ️  Run your application to verify database connectivity');
}