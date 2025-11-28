const { pool } = require('../config/database');

/**
 * Check if a user role has a specific permission
 * @param {string} userRole - The user's role name
 * @param {string} resource - The resource (e.g., 'cases', 'users', 'counseling_forms')
 * @param {string} action - The action (e.g., 'create', 'read', 'update', 'delete')
 * @returns {Promise<boolean>} - True if the role has the permission
 */
async function hasPermission(userRole, resource, action) {
  try {
    const [permissions] = await pool.execute(`
      SELECT rp.permission 
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      WHERE r.name = ? AND r.is_active = 1
      AND rp.resource = ? AND rp.action = ?
    `, [userRole, resource, action]);
    
    return permissions.length > 0;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Check if a user role has any of the specified permissions
 * @param {string} userRole - The user's role name
 * @param {Array} permissionChecks - Array of {resource, action} objects
 * @returns {Promise<boolean>} - True if the role has any of the permissions
 */
async function hasAnyPermission(userRole, permissionChecks) {
  try {
    for (const check of permissionChecks) {
      if (await hasPermission(userRole, check.resource, check.action)) {
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking permissions:', error);
    return false;
  }
}

/**
 * Get all active roles from the database
 * @returns {Promise<Array>} - Array of role objects with name and display_name
 */
async function getActiveRoles() {
  try {
    const [roles] = await pool.execute(`
      SELECT name, display_name, description 
      FROM roles 
      WHERE is_active = 1 
      ORDER BY name
    `);
    return roles;
  } catch (error) {
    console.error('Error fetching roles:', error);
    return [];
  }
}

/**
 * Check if a role exists and is active
 * @param {string} roleName - The role name to check
 * @returns {Promise<boolean>} - True if the role exists and is active
 */
async function isValidRole(roleName) {
  try {
    const [roles] = await pool.execute(`
      SELECT id FROM roles 
      WHERE name = ? AND is_active = 1
    `, [roleName]);
    
    return roles.length > 0;
  } catch (error) {
    console.error('Error validating role:', error);
    return false;
  }
}

/**
 * Get role permissions for a specific role
 * @param {string} roleName - The role name
 * @returns {Promise<Array>} - Array of permission objects
 */
async function getRolePermissions(roleName) {
  try {
    const [permissions] = await pool.execute(`
      SELECT rp.permission, rp.resource, rp.action
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      WHERE r.name = ? AND r.is_active = 1
      ORDER BY rp.resource, rp.action
    `, [roleName]);
    
    return permissions;
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    return [];
  }
}

module.exports = {
  hasPermission,
  hasAnyPermission,
  getActiveRoles,
  isValidRole,
  getRolePermissions
};
