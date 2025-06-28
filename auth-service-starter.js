// Start the Enterprise Auth System
const EnterpriseAuthSystem = require('./auth/auth_system_complete');

// Create and start the auth system
const authSystem = new EnterpriseAuthSystem();
authSystem.start(3001);

console.log('Auth service started on port 3001');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down auth service...');
  process.exit(0);
});