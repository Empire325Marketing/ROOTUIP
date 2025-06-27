const RBAC = {
 permissions: {
 DASHBOARD_VIEW: 'dashboard.view',
 DASHBOARD_EXECUTIVE: 'dashboard.executive',
 CONTAINERS_VIEW: 'containers.view',
 CONTAINERS_EDIT: 'containers.edit',
 CONTAINERS_DELETE: 'containers.delete',
 CONTAINERS_BULK_ACTIONS: 'containers.bulk_actions',
 DD_VIEW: 'dd.view',
 DD_PREVENT: 'dd.prevent',
 DD_DISPUTE: 'dd.dispute',
 DD_APPROVE: 'dd.approve',
 INTEGRATIONS_VIEW: 'integrations.view',
 INTEGRATIONS_EDIT: 'integrations.edit',
 INTEGRATIONS_API_KEYS: 'integrations.api_keys',
 ANALYTICS_VIEW: 'analytics.view',
 ANALYTICS_EXPORT: 'analytics.export',
 ANALYTICS_CUSTOM_REPORTS: 'analytics.custom_reports',
 USERS_VIEW: 'users.view',
 USERS_EDIT: 'users.edit',
 USERS_DELETE: 'users.delete',
 USERS_ROLES: 'users.roles',
 SETTINGS_VIEW: 'settings.view',
 SETTINGS_EDIT: 'settings.edit',
 SETTINGS_BILLING: 'settings.billing',
 SETTINGS_SECURITY: 'settings.security',
 DOCUMENTS_VIEW: 'documents.view',
 DOCUMENTS_UPLOAD: 'documents.upload',
 DOCUMENTS_DELETE: 'documents.delete',
 DOCUMENTS_OCR: 'documents.ocr',
 API_READ: 'api.read',
 API_WRITE: 'api.write',
 API_DELETE: 'api.delete',
 AUDIT_VIEW: 'audit.view',
 AUDIT_EXPORT: 'audit.export'
 },
 roles: {
 SUPER_ADMIN: {
 name: 'Super Administrator',
 description: 'Full system access with all permissions',
 permissions: ['*'], // Wildcard for all permissions
 level: 100
 },
 ADMIN: {
 name: 'Administrator',
 description: 'Administrative access with user management',
 permissions: [
 'dashboard.*',
 'containers.*',
 'dd.*',
 'integrations.*',
 'analytics.*',
 'users.*',
 'settings.view',
 'settings.edit',
 'documents.*',
 'api.*',
 'audit.view'
 ],
 level: 90
 },
 MANAGER: {
 name: 'Operations Manager',
 description: 'Manage operations and approve actions',
 permissions: [
 'dashboard.view',
 'dashboard.executive',
 'containers.*',
 'dd.*',
 'integrations.view',
 'analytics.*',
 'users.view',
 'settings.view',
 'documents.*',
 'api.read',
 'api.write',
 'audit.view'
 ],
 level: 70
 },
 ANALYST: {
 name: 'Data Analyst',
 description: 'View and analyze data, generate reports',
 permissions: [
 'dashboard.view',
 'containers.view',
 'dd.view',
 'integrations.view',
 'analytics.*',
 'documents.view',
 'api.read',
 'audit.view'
 ],
 level: 50
 },
 OPERATOR: {
 name: 'Operations Staff',
 description: 'Daily operations and container management',
 permissions: [
 'dashboard.view',
 'containers.view',
 'containers.edit',
 'dd.view',
 'dd.prevent',
 'dd.dispute',
 'documents.view',
 'documents.upload',
 'api.read'
 ],
 level: 30
 },
 VIEWER: {
 name: 'Read-Only User',
 description: 'View-only access to dashboards and reports',
 permissions: [
 'dashboard.view',
 'containers.view',
 'dd.view',
 'analytics.view',
 'documents.view'
 ],
 level: 10
 },
 API_USER: {
 name: 'API User',
 description: 'Programmatic access via API',
 permissions: [
 'api.read',
 'api.write',
 'containers.view',
 'dd.view',
 'analytics.view'
 ],
 level: 20
 }
 },
 customRoles: {},
 hasPermission(userRole, permission) {
 const role = this.roles[userRole] || this.customRoles[userRole];
 if (!role) return false;
 if (role.permissions.includes('*')) return true;
 if (role.permissions.includes(permission)) return true;
 const permissionGroup = permission.split('.')[0];
 if (role.permissions.includes(`${permissionGroup}.*`)) return true;
 return false;
 },
 hasAllPermissions(userRole, permissions) {
 return permissions.every(permission => this.hasPermission(userRole, permission));
 },
 hasAnyPermission(userRole, permissions) {
 return permissions.some(permission => this.hasPermission(userRole, permission));
 },
 getPermissionLevel(userRole) {
 const role = this.roles[userRole] || this.customRoles[userRole];
 return role ? role.level : 0;
 },
 createCustomRole(roleId, name, description, permissions, level) {
 this.customRoles[roleId] = {
 name,
 description,
 permissions,
 level: Math.min(level, 89) // Custom roles can't exceed admin level
 };
 this.saveCustomRoles();
 },
 updateCustomRole(roleId, updates) {
 if (this.customRoles[roleId]) {
 Object.assign(this.customRoles[roleId], updates);
 if (updates.level) {
 this.customRoles[roleId].level = Math.min(updates.level, 89);
 }
 this.saveCustomRoles();
 }
 },
 deleteCustomRole(roleId) {
 delete this.customRoles[roleId];
 this.saveCustomRoles();
 },
 saveCustomRoles() {
 localStorage.setItem('uip_custom_roles', JSON.stringify(this.customRoles));
 },
 loadCustomRoles() {
 const saved = localStorage.getItem('uip_custom_roles');
 if (saved) {
 this.customRoles = JSON.parse(saved);
 }
 },
 getAllRoles() {
 return { ...this.roles, ...this.customRoles };
 },
 getRole(roleId) {
 return this.roles[roleId] || this.customRoles[roleId];
 },
 getRolePermissions(roleId) {
 const role = this.getRole(roleId);
 if (!role) return [];
 if (role.permissions.includes('*')) {
 return Object.values(this.permissions);
 }
 const expanded = [];
 role.permissions.forEach(perm => {
 if (perm.endsWith('.*')) {
 const group = perm.replace('.*', '');
 Object.entries(this.permissions).forEach(([key, value]) => {
 if (value.startsWith(group + '.')) {
 expanded.push(value);
 }
 });
 } else {
 expanded.push(perm);
 }
 });
 return [...new Set(expanded)];
 },
 canManageRole(managerRole, targetRole) {
 const managerLevel = this.getPermissionLevel(managerRole);
 const targetLevel = this.getPermissionLevel(targetRole);
 return managerLevel > targetLevel && this.hasPermission(managerRole, 'users.roles');
 },
 init() {
 this.loadCustomRoles();
 window.checkPermission = (permission) => {
 const currentUser = this.getCurrentUser();
 return this.hasPermission(currentUser.role, permission);
 };
 window.requirePermission = (permission) => {
 if (!window.checkPermission(permission)) {
 throw new Error(`Permission denied: ${permission}`);
 }
 };
 },
 getCurrentUser() {
 const userStr = localStorage.getItem('uip_current_user');
 return userStr ? JSON.parse(userStr) : null;
 },
 setCurrentUser(user) {
 localStorage.setItem('uip_current_user', JSON.stringify(user));
 },
 clearCurrentUser() {
 localStorage.removeItem('uip_current_user');
 }
};
if (typeof module !== 'undefined' && module.exports) {
 module.exports = RBAC;
}
document.addEventListener('DOMContentLoaded', () => {
 RBAC.init();
});