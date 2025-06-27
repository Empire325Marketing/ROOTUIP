// ROOTUIP Authentication System - Demo Mode
// Uses in-memory database for testing without PostgreSQL

const fs = require('fs');
const path = require('path');

// Load environment variables
if (fs.existsSync('.env.production')) {
    require('dotenv').config({ path: '.env.production' });
} else if (fs.existsSync('.env')) {
    require('dotenv').config();
}

// Set demo mode
process.env.DEMO_MODE = 'true';

// Load the main authentication system
require('./enterprise-auth-system.js');
