const RBACConfig = {
 roles: {
 superAdmin: {
 name: 'Super Administrator',
 description: 'Full system access with all permissions',
 level: 100
 },
 admin: {
 name: 'Administrator',
 description: 'Full access to organization data and settings',
 level: 90
 },
 manager: {
 name: 'Operations Manager',
 description: 'Manage containers, D&D actions, and team operations',
 level: 70
 },
 analyst: {
 name: 'Data Analyst',
 description: 'View and analyze data, generate reports',
 level: 50
 },
 operator: {
 name: 'Operations Staff',
 description: 'Execute D&D prevention actions and container management',
 level: 40
 },
 viewer: {
 name: 'Read-Only User',
 description: 'View-only access to dashboards and reports',
 level: 20
 },
 guest: {
 name: 'Guest User',
 description: 'Limited temporary access',
 level: 10
 }
 },
 permissions: {
 dashboard: {
 view: ['all'],
 edit: ['superAdmin', 'admin'],
 export: ['superAdmin', 'admin', 'manager', 'analyst']
 },
 containers: {
 view: ['all'],
 create: ['superAdmin', 'admin', 'manager', 'operator'],
 edit: ['superAdmin', 'admin', 'manager', 'operator'],
 delete: ['superAdmin', 'admin'],
 export: ['superAdmin', 'admin', 'manager', 'analyst'],
 bulkActions: ['superAdmin', 'admin', 'manager']
 },
 ddPrevention: {
 view: ['all'],
 executeActions: ['superAdmin', 'admin', 'manager', 'operator'],
 configureAutomation: ['superAdmin', 'admin', 'manager'],
 overrideAutomation: ['superAdmin', 'admin'],
 fileDispute: ['superAdmin', 'admin', 'manager', 'operator'],
 approveDispute: ['superAdmin', 'admin', 'manager']
 },
 integrations: {
 view: ['superAdmin', 'admin', 'manager', 'analyst'],
 create: ['superAdmin', 'admin'],
 edit: ['superAdmin', 'admin'],
 delete: ['superAdmin', 'admin'],
 testConnection: ['superAdmin', 'admin', 'manager'],
 viewApiKeys: ['superAdmin', 'admin'],
 rotateApiKeys: ['superAdmin', 'admin']
 },
 documents: {
 view: ['all'],
 upload: ['superAdmin', 'admin', 'manager', 'operator'],
 download: ['all'],
 delete: ['superAdmin', 'admin', 'manager'],
 processOCR: ['superAdmin', 'admin', 'manager', 'operator']
 },
 analytics: {
 view: ['superAdmin', 'admin', 'manager', 'analyst'],
 createReports: ['superAdmin', 'admin', 'manager', 'analyst'],
 exportReports: ['superAdmin', 'admin', 'manager', 'analyst'],
 configureDashboards: ['superAdmin', 'admin', 'analyst'],
 viewFinancials: ['superAdmin', 'admin', 'manager']
 },
 users: {
 view: ['superAdmin', 'admin', 'manager'],
 create: ['superAdmin', 'admin'],
 edit: ['superAdmin', 'admin'],
 delete: ['superAdmin'],
 changeRoles: ['superAdmin', 'admin'],
 resetPassword: ['superAdmin', 'admin'],
 viewAuditLog: ['superAdmin', 'admin']
 },
 settings: {
 viewGeneral: ['superAdmin', 'admin', 'manager'],
 editGeneral: ['superAdmin', 'admin'],
 viewSecurity: ['superAdmin', 'admin'],
 editSecurity: ['superAdmin'],
 viewBilling: ['superAdmin', 'admin'],
 editBilling: ['superAdmin'],
 viewApiSettings: ['superAdmin', 'admin'],
 editApiSettings: ['superAdmin', 'admin']
 },
 notifications: {
 viewOwn: ['all'],
 viewAll: ['superAdmin', 'admin'],
 configure: ['superAdmin', 'admin', 'manager'],
 sendBulk: ['superAdmin', 'admin']
 }
 },
 features: {
 executiveDashboard: ['superAdmin', 'admin', 'manager'],
 containerTracking: ['all'],
 ddCommandCenter: ['superAdmin', 'admin', 'manager', 'operator'],
 integrationHealth: ['superAdmin', 'admin', 'manager'],
 documentProcessing: ['superAdmin', 'admin', 'manager', 'operator'],
 predictiveAnalytics: ['superAdmin', 'admin', 'manager', 'analyst'],
 financialReports: ['superAdmin', 'admin', 'manager'],
 apiAccess: ['superAdmin', 'admin'],
 bulkOperations: ['superAdmin', 'admin', 'manager'],
 automationRules: ['superAdmin', 'admin', 'manager'],
 whiteLabeling: ['superAdmin']
 },
 dataAccess: {
 organizationIsolation: true,
 dataFilters: {
 superAdmin: {
 containers: 'all',
 financials: 'all',
 users: 'all',
 organizations: 'all'
 },
 admin: {
 containers: 'organization',
 financials: 'organization',
 users: 'organization',
 organizations: 'own'
 },
 manager: {
 containers: 'team',
 financials: 'summary',
 users: 'team',
 organizations: 'none'
 },
 operator: {
 containers: 'assigned',
 financials: 'none',
 users: 'self',
 organizations: 'none'
 },
 analyst: {
 containers: 'organization',
 financials: 'reports',
 users: 'none',
 organizations: 'none'
 },
 viewer: {
 containers: 'read-only',
 financials: 'summary',
 users: 'none',
 organizations: 'none'
 }
 }
 },
 sessionConfig: {
 maxConcurrentSessions: {
 superAdmin: 5,
 admin: 3,
 manager: 3,
 operator: 2,
 analyst: 2,
 viewer: 1,
 guest: 1
 },
 sessionTimeout: {
 superAdmin: 480, // 8 hours
 admin: 480,
 manager: 240, // 4 hours
 operator: 240,
 analyst: 240,
 viewer: 120, // 2 hours
 guest: 60 // 1 hour
 },
 requireMFA: {
 superAdmin: true,
 admin: true,
 manager: true,
 operator: false,
 analyst: false,
 viewer: false,
 guest: false
 }
 },
 apiRateLimits: {
 superAdmin: 1000,
 admin: 500,
 manager: 200,
 operator: 100,
 analyst: 100,
 viewer: 50,
 guest: 10
 },
 auditConfig: {
 auditableActions: [
 'user.create',
 'user.delete',
 'user.roleChange',
 'integration.create',
 'integration.delete',
 'apiKey.create',
 'apiKey.rotate',
 'apiKey.delete',
 'container.bulkUpdate',
 'container.delete',
 'dispute.file',
 'dispute.approve',
 'automation.configure',
 'automation.override',
 'settings.security.change',
 'data.export',
 'data.bulkDelete'
 ],
 retentionPeriod: {
 superAdmin: 2555, // 7 years
 admin: 1095, // 3 years
 default: 365 // 1 year
 }
 },
 hasPermission: function(userRole, resource, action) {
 const allowedRoles = this.permissions[resource]?.[action] || [];
 if (allowedRoles.includes('all')) return true;
 return allowedRoles.includes(userRole);
 },
 hasFeatureAccess: function(userRole, feature) {
 const allowedRoles = this.features[feature] || [];
 if (allowedRoles.includes('all')) return true;
 return allowedRoles.includes(userRole);
 },
 getRoleLevel: function(role) {
 return this.roles[role]?.level || 0;
 },
 canAccessData: function(userRole, dataType) {
 return this.dataAccess.dataFilters[userRole]?.[dataType] || 'none';
 },
 getSessionConfig: function(userRole) {
 return {
 maxSessions: this.sessionConfig.maxConcurrentSessions[userRole] || 1,
 timeout: this.sessionConfig.sessionTimeout[userRole] || 60,
 requireMFA: this.sessionConfig.requireMFA[userRole] || false
 };
 },
 isAuditRequired: function(action) {
 return this.auditConfig.auditableActions.includes(action);
 }
};
if (typeof module !== 'undefined' && module.exports) {
 module.exports = RBACConfig;
}