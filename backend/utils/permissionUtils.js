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
    // Super admin always has all permissions
    if (userRole === 'super_admin') {
      return true;
    }

    // First check for exact match
    const [permissions] = await pool.execute(`
      SELECT rp.permission 
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      WHERE r.name = ? AND r.is_active = 1
      AND rp.resource = ? AND rp.action = ?
    `, [userRole, resource, action]);
    
    if (permissions.length > 0) {
      return true;
    }

    // Check if user has "all" permission for this resource (grants all actions)
    const [allPermissions] = await pool.execute(`
      SELECT rp.permission 
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      WHERE r.name = ? AND r.is_active = 1
      AND rp.resource = ? AND rp.action = 'all'
    `, [userRole, resource]);
    
    if (allPermissions.length > 0) {
      return true;
    }

    // Also check JSON permissions in roles table for "all" permission
    const [roles] = await pool.execute(`
      SELECT r.permissions
      FROM roles r
      WHERE r.name = ? AND r.is_active = 1
    `, [userRole]);

    if (roles.length > 0 && roles[0].permissions) {
      try {
        const rolePermissions = JSON.parse(roles[0].permissions);
        if (rolePermissions[resource]) {
          // Check if action is in permissions array
          if (rolePermissions[resource].includes(action)) {
            return true;
          }
          // Check if "all" is in permissions array (grants all actions)
          if (rolePermissions[resource].includes('all')) {
            return true;
          }
        }
      } catch (parseError) {
        // Ignore JSON parse errors
      }
    }
    
    return false;
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
 * Check if a user role has counseling form access
 * @param {string} userRole - The user's role name
 * @returns {Promise<boolean>} - True if the role has counseling form access
 */
async function hasCounselingFormAccess(userRole) {
  try {
    // Check if user has any counseling form permissions
    const counselingFormPermissions = [
      { resource: 'counseling_forms', action: 'create' },
      { resource: 'counseling_forms', action: 'read' },
      { resource: 'counseling_forms', action: 'update' }
    ];
    
    return await hasAnyPermission(userRole, counselingFormPermissions);
  } catch (error) {
    console.error('Error checking counseling form access:', error);
    return false;
  }
}

/**
 * Check if a user role has case_assigned permission (see only assigned cases)
 * Super admin is never treated as assigned-only; they always see all cases.
 * @param {string} userRole - The user's role name
 * @returns {Promise<boolean>} - True if the role has case_assigned
 */
async function hasCaseAssignedOnly(userRole) {
  try {
    if (userRole === 'super_admin' || userRole === 'Super Administrator') return false;
    return await hasPermission(userRole, 'cases', 'case_assigned');
  } catch (error) {
    console.error('Error checking case_assigned:', error);
    return false;
  }
}

/**
 * Check if a user role can access all cases (admin-level access)
 * Super admin always has access to all cases. Otherwise true when role has cases:read and does NOT have case_assigned.
 * @param {string} userRole - The user's role name
 * @returns {Promise<boolean>} - True if the role can access all cases
 */
async function canAccessAllCases(userRole) {
  try {
    if (userRole === 'super_admin' || userRole === 'Super Administrator') return true;
    const hasRead = await hasPermission(userRole, 'cases', 'read');
    const hasAssignedOnly = await hasCaseAssignedOnly(userRole);
    return hasRead && !hasAssignedOnly;
  } catch (error) {
    console.error('Error checking case access:', error);
    return false;
  }
}

/**
 * Check if a user role can manage users (admin-level access)
 * @param {string} userRole - The user's role name
 * @returns {Promise<boolean>} - True if the role can manage users
 */
async function canManageUsers(userRole) {
  try {
    const userPermissions = [
      { resource: 'users', action: 'create' },
      { resource: 'users', action: 'update' },
      { resource: 'users', action: 'delete' }
    ];
    
    return await hasAnyPermission(userRole, userPermissions);
  } catch (error) {
    console.error('Error checking user management access:', error);
    return false;
  }
}

/**
 * Check if a user role can manage roles (super admin access)
 * @param {string} userRole - The user's role name
 * @returns {Promise<boolean>} - True if the role can manage roles
 */
async function canManageRoles(userRole) {
  try {
    const rolePermissions = [
      { resource: 'roles', action: 'create' },
      { resource: 'roles', action: 'update' },
      { resource: 'roles', action: 'delete' }
    ];
    
    return await hasAnyPermission(userRole, rolePermissions);
  } catch (error) {
    console.error('Error checking role management access:', error);
    return false;
  }
}

/**
 * Get all roles that have a specific permission
 * @param {string} resource - The resource
 * @param {string} action - The action
 * @returns {Promise<Array>} - Array of role names that have the permission
 */
async function getRolesWithPermission(resource, action) {
  try {
    const [roles] = await pool.execute(`
      SELECT r.name 
      FROM roles r
      JOIN role_permissions rp ON r.id = rp.role_id
      WHERE r.is_active = 1 
      AND rp.resource = ? AND rp.action = ?
      ORDER BY r.name
    `, [resource, action]);
    
    return roles.map(role => role.name);
  } catch (error) {
    console.error('Error getting roles with permission:', error);
    return [];
  }
}

/**
 * Get all roles that have counseling form access
 * @returns {Promise<Array>} - Array of role names that have counseling form access
 */
async function getCounselingFormRoles() {
  try {
    const [roles] = await pool.execute(`
      SELECT DISTINCT r.name 
      FROM roles r
      JOIN role_permissions rp ON r.id = rp.role_id
      WHERE r.is_active = 1 
      AND rp.resource = 'counseling_forms' 
      AND rp.action IN ('create', 'read', 'update')
      ORDER BY r.name
    `);
    
    return roles.map(role => role.name);
  } catch (error) {
    console.error('Error getting counseling form roles:', error);
    return [];
  }
}

/**
 * Get all roles that have admin-level access
 * @returns {Promise<Array>} - Array of role names that have admin access
 */
async function getAdminRoles() {
  try {
    const [roles] = await pool.execute(`
      SELECT DISTINCT r.name 
      FROM roles r
      JOIN role_permissions rp ON r.id = rp.role_id
      WHERE r.is_active = 1 
      AND rp.resource = 'users' 
      AND rp.action IN ('create', 'update', 'delete')
      ORDER BY r.name
    `);
    
    return roles.map(role => role.name);
  } catch (error) {
    console.error('Error getting admin roles:', error);
    return [];
  }
}

/**
 * Check if a user role has permission for a specific counseling form stage
 * @param {string} userRole - The user's role name
 * @param {string} stageKey - The stage key (e.g., 'personal', 'family', 'assessment')
 * @param {string} action - The action ('read' or 'update')
 * @returns {Promise<boolean>} - True if the role has the permission
 */
async function hasCounselingFormStagePermission(userRole, stageKey, action) {
  try {
    // Super admin always has full access
    if (userRole === 'super_admin') {
      return true;
    }

    // First check if user has general counseling_forms permission
    const hasGeneralPermission = await hasPermission(userRole, 'counseling_forms', action);
    if (!hasGeneralPermission) {
      return false;
    }

    // Check stage-specific permission
    const [permissions] = await pool.execute(`
      SELECT cfsp.can_read, cfsp.can_update
      FROM counseling_form_stage_permissions cfsp
      JOIN roles r ON cfsp.role_id = r.id
      WHERE r.name = ? AND r.is_active = 1
      AND cfsp.stage_key = ?
    `, [userRole, stageKey]);

    if (permissions.length === 0) {
      // No stage-specific permission found - default to general permission
      return hasGeneralPermission;
    }

    const stagePerm = permissions[0];
    if (action === 'read') {
      return stagePerm.can_read === 1 || stagePerm.can_read === true;
    } else if (action === 'update') {
      return stagePerm.can_update === 1 || stagePerm.can_update === true;
    }

    return false;
  } catch (error) {
    console.error('Error checking counseling form stage permission:', error);
    // If table doesn't exist yet, fall back to general permission
    return hasPermission(userRole, 'counseling_forms', action);
  }
}

/**
 * Get all stage permissions for a user role
 * @param {string} userRole - The user's role name
 * @returns {Promise<Object>} - Object with stage keys as keys and {can_read, can_update} as values
 */
async function getCounselingFormStagePermissions(userRole) {
  try {
    // Super admin always has full access to all stages
    if (userRole === 'super_admin') {
      const stages = ['personal', 'family', 'assessment', 'financial', 'growth', 'declaration', 'attachments', 'manzoori'];
      const stagePermissions = {};
      stages.forEach(stage => {
        stagePermissions[stage] = {
          can_read: true,
          can_update: true
        };
      });
      return stagePermissions;
    }

    const [permissions] = await pool.execute(`
      SELECT cfsp.stage_key, cfsp.can_read, cfsp.can_update
      FROM counseling_form_stage_permissions cfsp
      JOIN roles r ON cfsp.role_id = r.id
      WHERE r.name = ? AND r.is_active = 1
      ORDER BY 
        CASE cfsp.stage_key
          WHEN 'personal' THEN 1
          WHEN 'family' THEN 2
          WHEN 'assessment' THEN 3
          WHEN 'financial' THEN 4
          WHEN 'growth' THEN 5
          WHEN 'declaration' THEN 6
          WHEN 'attachments' THEN 7
          WHEN 'manzoori' THEN 8
          ELSE 9
        END
    `, [userRole]);

    const stagePermissions = {};
    permissions.forEach(perm => {
      stagePermissions[perm.stage_key] = {
        can_read: perm.can_read === 1 || perm.can_read === true,
        can_update: perm.can_update === 1 || perm.can_update === true
      };
    });

    // If no stage permissions found, check general permissions and apply to all stages
    if (Object.keys(stagePermissions).length === 0) {
      const canRead = await hasPermission(userRole, 'counseling_forms', 'read');
      const canUpdate = await hasPermission(userRole, 'counseling_forms', 'update');
      
      const stages = ['personal', 'family', 'assessment', 'financial', 'growth', 'declaration', 'attachments', 'manzoori'];
      stages.forEach(stage => {
        stagePermissions[stage] = {
          can_read: canRead,
          can_update: canUpdate
        };
      });
    }

    return stagePermissions;
  } catch (error) {
    console.error('Error getting counseling form stage permissions:', error);
    // Fallback: return permissions based on general counseling_forms permissions
    const canRead = await hasPermission(userRole, 'counseling_forms', 'read');
    const canUpdate = await hasPermission(userRole, 'counseling_forms', 'update');
    
    const stages = ['personal', 'family', 'assessment', 'financial', 'growth', 'declaration', 'attachments', 'manzoori'];
    const stagePermissions = {};
    stages.forEach(stage => {
      stagePermissions[stage] = {
        can_read: canRead,
        can_update: canUpdate
      };
    });
    return stagePermissions;
  }
}

module.exports = {
  hasPermission,
  hasAnyPermission,
  hasCounselingFormAccess,
  hasCaseAssignedOnly,
  canAccessAllCases,
  canManageUsers,
  canManageRoles,
  getRolesWithPermission,
  getCounselingFormRoles,
  getAdminRoles,
  hasCounselingFormStagePermission,
  getCounselingFormStagePermissions
};
