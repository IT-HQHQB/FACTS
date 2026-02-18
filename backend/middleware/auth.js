const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { hasPermission } = require('../utils/roleUtils');

/**
 * Get jamiat_ids and jamaat_ids for a user's current (primary) role.
 * Uses user_roles.jamiat_ids/jamaat_ids; falls back to users table if NULL.
 * @param {number} userId
 * @param {string} roleName - users.role (primary role name)
 * @returns {Promise<{ jamiat_ids: string|null, jamaat_ids: string|null }>}
 */
async function getCurrentRoleScopes(userId, roleName) {
  if (!userId || !roleName) {
    return { jamiat_ids: null, jamaat_ids: null };
  }
  const [rows] = await pool.execute(
    `SELECT ur.jamiat_ids, ur.jamaat_ids
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND LOWER(r.name) = LOWER(?) AND ur.is_active = 1 AND r.is_active = 1
     AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
     LIMIT 1`,
    [userId, roleName]
  );
  let jamiat_ids = rows[0]?.jamiat_ids ?? null;
  let jamaat_ids = rows[0]?.jamaat_ids ?? null;
  if (jamiat_ids === null && jamaat_ids === null) {
    const [userRows] = await pool.execute(
      'SELECT jamiat_ids, jamaat_ids FROM users WHERE id = ?',
      [userId]
    );
    jamiat_ids = userRows[0]?.jamiat_ids ?? null;
    jamaat_ids = userRows[0]?.jamaat_ids ?? null;
  }
  return { jamiat_ids, jamaat_ids };
}

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key-here');
    
    // Verify user still exists and is active (1 = active, 0 = inactive)
    const [users] = await pool.execute(
      'SELECT id, username, email, role, is_active, executive_level FROM users WHERE id = ? AND is_active = 1',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    req.user = users[0];
    const scopes = await getCurrentRoleScopes(req.user.id, req.user.role || '');
    req.user.jamiat_ids = scopes.jamiat_ids;
    req.user.jamaat_ids = scopes.jamaat_ids;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Super admin has access to everything
    if (req.user.role === 'super_admin') {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const authorizeCaseAccess = async (req, res, next) => {
  try {
    const caseId = req.params.caseId || req.body.caseId;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has permission to access all cases
    const canAccessAllCases = await hasPermission(userRole, 'cases', 'read');
    if (canAccessAllCases) {
      return next();
    }

    // DCM and counselor can only access assigned cases
    const [cases] = await pool.execute(
      'SELECT id FROM cases WHERE id = ? AND (roles = ? OR assigned_counselor_id = ?)',
      [caseId, userId, userId]
    );

    if (cases.length === 0) {
      return res.status(403).json({ error: 'Access denied - case not assigned to you' });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Error checking case access' });
  }
};

// Enhanced RBAC middleware for granular permissions
const authorizePermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Super admin has access to everything
      if (req.user.role === 'super_admin') {
        return next();
      }

      // Get user's active roles and permissions from user_roles table
      const [userRoles] = await pool.execute(`
        SELECT r.id, r.name, r.permissions
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      `, [req.user.id]);

      // If no roles found in user_roles table, fallback to users.role column (for backward compatibility)
      let rolesToCheck = userRoles;
      if (userRoles.length === 0 && req.user.role) {
        // Use case-insensitive matching for role name
        const [fallbackRoles] = await pool.execute(`
          SELECT id, name, permissions
          FROM roles
          WHERE LOWER(name) = LOWER(?) AND is_active = 1
        `, [req.user.role]);
        rolesToCheck = fallbackRoles;
        console.log(`[Permission Check] Fallback lookup for role "${req.user.role}": found ${fallbackRoles.length} role(s)`);
      }

      // Check if user has the required permission
      let hasPermission = false;
      
      // Debug logging
      console.log(`[Permission Check] User ID: ${req.user.id}, Role: ${req.user.role}, Checking: ${resource}:${action}`);
      console.log(`[Permission Check] Roles to check:`, rolesToCheck.map(r => ({ id: r.id, name: r.name })));
      
      for (const role of rolesToCheck) {
        // Check JSON permissions
        if (role.permissions) {
          try {
            const permissions = JSON.parse(role.permissions);
            // Handle both object format {resource: [actions]} and array format
            if (typeof permissions === 'object' && !Array.isArray(permissions)) {
              if (permissions[resource] && permissions[resource].includes(action)) {
                console.log(`[Permission Check] Found permission in JSON for role ${role.name}`);
                hasPermission = true;
                break;
              }
            } else if (Array.isArray(permissions)) {
              // Handle array format like [{resource: 'cases', action: 'create'}]
              const hasPerm = permissions.some(p => 
                p.resource === resource && p.action === action
              );
              if (hasPerm) {
                console.log(`[Permission Check] Found permission in JSON array for role ${role.name}`);
                hasPermission = true;
                break;
              }
            }
          } catch (parseError) {
            // Ignore JSON parse errors and continue to granular check
            console.warn('Error parsing role permissions JSON:', parseError);
          }
        }
        
        // Check granular permissions
        const [permissions] = await pool.execute(`
          SELECT permission FROM role_permissions 
          WHERE role_id = ? AND resource = ? AND action = ?
        `, [role.id, resource, action]);
        
        if (permissions.length > 0) {
          console.log(`[Permission Check] Found permission in role_permissions table for role ${role.name}`);
          hasPermission = true;
          break;
        }
      }

      if (!hasPermission) {
        const errorMessage = `Insufficient permissions. Required: ${resource}:${action}`;
        console.log(`[Permission Check] DENIED - User ${req.user.id} (${req.user.role}) does not have ${resource}:${action}`);
        console.log(`[Permission Check] Available roles:`, rolesToCheck.map(r => r.name));
        
        // Ensure response is sent properly
        if (!res.headersSent) {
          res.status(403).json({ 
            error: errorMessage
          });
        }
        return;
      }
      
      console.log(`[Permission Check] ALLOWED - User ${req.user.id} has ${resource}:${action}`);

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        userId: req.user?.id,
        userRole: req.user?.role,
        resource,
        action
      });
      
      // Make sure we haven't already sent a response
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Internal server error',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  };
};

// Middleware to check multiple permissions (user needs ALL)
const authorizeAllPermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const [userRoles] = await pool.execute(`
        SELECT r.id, r.name, r.permissions
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      `, [req.user.id]);

      const userPermissions = new Set();
      
      for (const role of userRoles) {
        // Add JSON permissions
        if (role.permissions) {
          const rolePermissions = JSON.parse(role.permissions);
          for (const [resource, actions] of Object.entries(rolePermissions)) {
            for (const action of actions) {
              userPermissions.add(`${resource}:${action}`);
            }
          }
        }
        
        // Add granular permissions
        const [granularPermissions] = await pool.execute(`
          SELECT CONCAT(resource, ':', action) as permission
          FROM role_permissions 
          WHERE role_id = ?
        `, [role.id]);
        
        for (const perm of granularPermissions) {
          userPermissions.add(perm.permission);
        }
      }

      // Check if user has all required permissions
      const hasAllPermissions = permissions.every(permission => 
        userPermissions.has(permission)
      );

      if (!hasAllPermissions) {
        return res.status(403).json({ 
          error: `Insufficient permissions. Required: ${permissions.join(', ')}` 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Middleware to check multiple permissions (user needs ANY)
const authorizeAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const [userRoles] = await pool.execute(`
        SELECT r.id, r.name, r.permissions
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      `, [req.user.id]);

      const userPermissions = new Set();
      
      for (const role of userRoles) {
        // Add JSON permissions
        if (role.permissions) {
          const rolePermissions = JSON.parse(role.permissions);
          for (const [resource, actions] of Object.entries(rolePermissions)) {
            for (const action of actions) {
              userPermissions.add(`${resource}:${action}`);
            }
          }
        }
        
        // Add granular permissions
        const [granularPermissions] = await pool.execute(`
          SELECT CONCAT(resource, ':', action) as permission
          FROM role_permissions 
          WHERE role_id = ?
        `, [role.id]);
        
        for (const perm of granularPermissions) {
          userPermissions.add(perm.permission);
        }
      }

      // Check if user has any of the required permissions
      const hasAnyPermission = permissions.some(permission => 
        userPermissions.has(permission)
      );

      if (!hasAnyPermission) {
        return res.status(403).json({ 
          error: `Insufficient permissions. Required one of: ${permissions.join(', ')}` 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Helper function to get user permissions
const getUserPermissions = async (userId) => {
  try {
    const [userRoles] = await pool.execute(`
      SELECT r.id, r.name, r.permissions
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    `, [userId]);

    const permissions = new Set();
    
    for (const role of userRoles) {
      // Add JSON permissions
      if (role.permissions) {
        const rolePermissions = JSON.parse(role.permissions);
        for (const [resource, actions] of Object.entries(rolePermissions)) {
          for (const action of actions) {
            permissions.add(`${resource}:${action}`);
          }
        }
      }
      
      // Add granular permissions
      const [granularPermissions] = await pool.execute(`
        SELECT CONCAT(resource, ':', action) as permission
        FROM role_permissions 
        WHERE role_id = ?
      `, [role.id]);
      
      for (const perm of granularPermissions) {
        permissions.add(perm.permission);
      }
    }

    return Array.from(permissions);
  } catch (error) {
    console.error('Get user permissions error:', error);
    return [];
  }
};

// Workflow stage authorization middleware
const authorizeWorkflowStageAccess = (action = 'view') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userId = req.user.id;
      const userRole = req.user.role;
      const stageId = req.params.stageId || req.body.stageId || req.query.stageId;

      if (!stageId) {
        return res.status(400).json({ error: 'Workflow stage ID is required' });
      }

      // Super admin has access to everything
      if (userRole === 'super_admin') {
        return next();
      }

      // Check if user has permission for this stage action
      const hasStagePermission = await checkWorkflowStagePermission(userId, userRole, stageId, action);

      if (!hasStagePermission) {
        return res.status(403).json({ 
          error: `Insufficient permissions for ${action} action on this workflow stage` 
        });
      }

      next();
    } catch (error) {
      console.error('Workflow stage authorization error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Helper function to check workflow stage permissions
const checkWorkflowStagePermission = async (userId, userRole, stageId, action) => {
  try {
    // Normalize role: DB may store "Super Administrator" but code checks for "super_admin"
    const normalizedRole = (userRole && typeof userRole === 'string') ? userRole.trim() : userRole;
    const isSuperAdmin = normalizedRole === 'super_admin' || normalizedRole === 'Super Administrator';

    // Super admin has access to all permissions: allow approve/reject on any review stage
    if (isSuperAdmin && (action === 'approve' || action === 'reject')) {
      const [stageRows] = await pool.execute(
        'SELECT stage_key, stage_name FROM workflow_stages WHERE id = ? AND is_active = 1',
        [stageId]
      );
      if (stageRows.length > 0) {
        const stageKey = (stageRows[0].stage_key || '').toLowerCase();
        const stageName = (stageRows[0].stage_name || '').toLowerCase();
        const nonApprovalStages = [
          'draft', 'case_assignment', 'assignment', 'counselor', 'counseling',
          'finance', 'finance_disbursement', 'disbursement'
        ];
        const isNonApprovalStage = nonApprovalStages.some(key =>
          stageKey.includes(key) || stageName.includes(key)
        );
        if (!isNonApprovalStage) {
          return true;
        }
      } else {
        // Stage not found or inactive: allow super_admin anyway (full access)
        return true;
      }
    }

    // Super admin for view/edit/review/delete: allow all stages
    if (isSuperAdmin && ['view', 'edit', 'review', 'delete', 'update'].includes(action)) {
      return true;
    }

    // Get user's roles - check both user_roles table and users.role column
    const [userRoles] = await pool.execute(`
      SELECT r.id, r.name
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    `, [userId]);

    // If no roles found in user_roles table, fallback to users.role column
    let rolesToCheck = userRoles.map(r => r.name);
    if (rolesToCheck.length === 0 && userRole) {
      rolesToCheck = [userRole];
    }

    // Check role-based permissions for all user roles
    for (const roleName of rolesToCheck) {
      const [rolePermissions] = await pool.execute(`
        SELECT wsr.can_approve, wsr.can_reject, wsr.can_review, wsr.can_view, wsr.can_edit, wsr.can_delete
        FROM workflow_stage_roles wsr
        JOIN roles r ON wsr.role_id = r.id
        WHERE wsr.workflow_stage_id = ? AND r.name = ? AND r.is_active = 1
      `, [stageId, roleName]);

      if (rolePermissions.length > 0) {
        const permissions = rolePermissions[0];
        if (action === 'approve' && permissions.can_approve) return true;
        if (action === 'reject' && permissions.can_reject) return true;
        if (action === 'review' && permissions.can_review) return true;
        if (action === 'view' && permissions.can_view) return true;
        if (action === 'edit' && permissions.can_edit) return true;
        if (action === 'delete' && permissions.can_delete) return true;
        if (action === 'update' && permissions.can_edit) return true; // Alias for edit
      }
    }

    // Check user-specific permissions (overrides role permissions)
    const [userPermissions] = await pool.execute(`
      SELECT wsu.can_approve, wsu.can_reject, wsu.can_review, wsu.can_view, wsu.can_edit, wsu.can_delete
      FROM workflow_stage_users wsu
      WHERE wsu.workflow_stage_id = ? AND wsu.user_id = ?
    `, [stageId, userId]);

    if (userPermissions.length > 0) {
      const permissions = userPermissions[0];
      if (action === 'approve' && permissions.can_approve) return true;
      if (action === 'reject' && permissions.can_reject) return true;
      if (action === 'review' && permissions.can_review) return true;
      if (action === 'view' && permissions.can_view) return true;
      if (action === 'edit' && permissions.can_edit) return true;
      if (action === 'delete' && permissions.can_delete) return true;
      if (action === 'update' && permissions.can_edit) return true; // Alias for edit
    }

    return false;
  } catch (error) {
    console.error('Check workflow stage permission error:', error);
    return false;
  }
};

// Helper function to check if user can perform action on a case's current workflow stage
const checkCaseWorkflowStagePermission = async (userId, userRole, caseId, action) => {
  try {
    // Get case's current workflow stage
    const [cases] = await pool.execute(
      'SELECT current_workflow_stage_id FROM cases WHERE id = ?',
      [caseId]
    );

    if (cases.length === 0 || !cases[0].current_workflow_stage_id) {
      // If no workflow stage, check general permissions
      return await hasPermission(userRole, 'cases', action === 'view' ? 'read' : action);
    }

    const stageId = cases[0].current_workflow_stage_id;
    return await checkWorkflowStagePermission(userId, userRole, stageId, action);
  } catch (error) {
    console.error('Check case workflow stage permission error:', error);
    return false;
  }
};

// Helper function to get user's permissions for a specific workflow stage
const getWorkflowStagePermissions = async (userId, userRole, stageId) => {
  try {
    const permissions = {
      can_view: false,
      can_edit: false,
      can_delete: false,
      can_approve: false,
      can_reject: false,
      can_review: false,
      can_create_case: false,
      can_fill_case: false
    };

    // For super_admin: get the union of all permissions configured for this workflow stage
    // This ensures super_admin only sees buttons that are appropriate for that stage
    if (userRole === 'super_admin') {
      // Get workflow stage info to check stage type
      const [stageInfo] = await pool.execute(`
        SELECT stage_key, stage_name
        FROM workflow_stages
        WHERE id = ?
      `, [stageId]);

      // Get all permissions configured for any role in this stage
      const [allStagePermissions] = await pool.execute(`
        SELECT 
          MAX(COALESCE(wsr.can_approve, 0)) as can_approve,
          MAX(COALESCE(wsr.can_reject, 0)) as can_reject,
          MAX(COALESCE(wsr.can_review, 0)) as can_review,
          MAX(COALESCE(wsr.can_view, 0)) as can_view,
          MAX(COALESCE(wsr.can_edit, 0)) as can_edit,
          MAX(COALESCE(wsr.can_delete, 0)) as can_delete,
          MAX(COALESCE(wsr.can_create_case, 0)) as can_create_case,
          MAX(COALESCE(wsr.can_fill_case, 0)) as can_fill_case
        FROM workflow_stage_roles wsr
        JOIN roles r ON wsr.role_id = r.id
        WHERE wsr.workflow_stage_id = ? AND r.is_active = 1
      `, [stageId]);

      // Also check user-specific permissions configured for this stage
      const [allUserPermissions] = await pool.execute(`
        SELECT 
          MAX(COALESCE(wsu.can_approve, 0)) as can_approve,
          MAX(COALESCE(wsu.can_reject, 0)) as can_reject,
          MAX(COALESCE(wsu.can_review, 0)) as can_review,
          MAX(COALESCE(wsu.can_view, 0)) as can_view,
          MAX(COALESCE(wsu.can_edit, 0)) as can_edit,
          MAX(COALESCE(wsu.can_delete, 0)) as can_delete,
          MAX(COALESCE(wsu.can_create_case, 0)) as can_create_case,
          MAX(COALESCE(wsu.can_fill_case, 0)) as can_fill_case
        FROM workflow_stage_users wsu
        WHERE wsu.workflow_stage_id = ?
      `, [stageId]);

      // Combine role and user permissions (union)
      if (allStagePermissions.length > 0) {
        const perm = allStagePermissions[0];
        // Handle NULL values properly - MAX() returns NULL if no rows, COALESCE ensures 0
        permissions.can_view = Boolean(perm.can_view) || false;
        permissions.can_edit = Boolean(perm.can_edit) || false;
        permissions.can_delete = Boolean(perm.can_delete) || false;
        permissions.can_approve = Boolean(perm.can_approve) || false;
        permissions.can_reject = Boolean(perm.can_reject) || false;
        permissions.can_review = Boolean(perm.can_review) || false;
        permissions.can_create_case = Boolean(perm.can_create_case) || false;
        permissions.can_fill_case = Boolean(perm.can_fill_case) || false;
      }

      if (allUserPermissions.length > 0) {
        const perm = allUserPermissions[0];
        // Union with role permissions (if any user has permission, include it)
        permissions.can_view = permissions.can_view || Boolean(perm.can_view) || false;
        permissions.can_edit = permissions.can_edit || Boolean(perm.can_edit) || false;
        permissions.can_delete = permissions.can_delete || Boolean(perm.can_delete) || false;
        permissions.can_approve = permissions.can_approve || Boolean(perm.can_approve) || false;
        permissions.can_reject = permissions.can_reject || Boolean(perm.can_reject) || false;
        permissions.can_review = permissions.can_review || Boolean(perm.can_review) || false;
        permissions.can_create_case = permissions.can_create_case || Boolean(perm.can_create_case) || false;
        permissions.can_fill_case = permissions.can_fill_case || Boolean(perm.can_fill_case) || false;
      }

      // Explicitly filter out approve/reject for stages that shouldn't have them
      // Case Assignment, Draft, and other non-review stages should not have approve/reject
      if (stageInfo.length > 0) {
        const stageKey = stageInfo[0].stage_key?.toLowerCase() || '';
        const stageName = stageInfo[0].stage_name?.toLowerCase() || '';
        
        // Stages that should NOT have approve/reject permissions
        const nonApprovalStages = [
          'draft', 'case_assignment', 'assignment', 'counselor', 'counseling',
          'finance', 'finance_disbursement', 'disbursement'
        ];
        
        const isNonApprovalStage = nonApprovalStages.some(key => 
          stageKey.includes(key) || stageName.includes(key)
        );
        
        if (isNonApprovalStage) {
          permissions.can_approve = false;
          permissions.can_reject = false;
        } else {
          // Super admin has access to all permissions: allow approve/reject on any review stage
          permissions.can_approve = true;
          permissions.can_reject = true;
        }
      } else {
        // No stage info: allow super_admin approve/reject by default (full access)
        permissions.can_approve = true;
        permissions.can_reject = true;
      }

      // Super admin always has view access to all stages
      permissions.can_view = true;

      // Debug logging (can be removed after testing)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Super Admin Permissions] Stage ID: ${stageId}, Stage: ${stageInfo[0]?.stage_name || 'unknown'}, Permissions:`, {
          can_approve: permissions.can_approve,
          can_reject: permissions.can_reject,
          can_view: permissions.can_view,
          can_edit: permissions.can_edit
        });
      }

      return permissions;
    }

    // Get user's roles - check both user_roles table and users.role column
    const [userRoles] = await pool.execute(`
      SELECT r.id, r.name
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    `, [userId]);

    // If no roles found in user_roles table, fallback to users.role column
    let rolesToCheck = userRoles.map(r => r.name);
    if (rolesToCheck.length === 0 && userRole) {
      rolesToCheck = [userRole];
    }

    // Check role-based permissions for all user roles
    for (const roleName of rolesToCheck) {
      const [rolePermissions] = await pool.execute(`
        SELECT wsr.can_approve, wsr.can_reject, wsr.can_review, wsr.can_view, wsr.can_edit, wsr.can_delete, 
               wsr.can_create_case, wsr.can_fill_case
        FROM workflow_stage_roles wsr
        JOIN roles r ON wsr.role_id = r.id
        WHERE wsr.workflow_stage_id = ? AND r.name = ? AND r.is_active = 1
      `, [stageId, roleName]);

      if (rolePermissions.length > 0) {
        const perm = rolePermissions[0];
        // Use OR logic - if any role has permission, grant it
        // Convert MySQL BOOLEAN (0/1) to JavaScript boolean
        // Note: MySQL returns 0/1 as numbers, so we need to explicitly check for truthy values
        if (perm.can_view) permissions.can_view = true;
        if (perm.can_edit) permissions.can_edit = true;
        if (perm.can_delete) permissions.can_delete = true;
        if (perm.can_approve) permissions.can_approve = true;
        // Explicitly check can_reject - MySQL returns 1/0 as numbers
        if (perm.can_reject === 1 || perm.can_reject === true) {
          permissions.can_reject = true;
        }
        if (perm.can_review) permissions.can_review = true;
        if (perm.can_create_case) permissions.can_create_case = true;
        if (perm.can_fill_case) permissions.can_fill_case = true;
      }
    }

    // Check user-specific permissions (user permissions override role permissions)
    const [userPermissions] = await pool.execute(`
      SELECT wsu.can_approve, wsu.can_reject, wsu.can_review, wsu.can_view, wsu.can_edit, wsu.can_delete,
             wsu.can_create_case, wsu.can_fill_case
      FROM workflow_stage_users wsu
      WHERE wsu.workflow_stage_id = ? AND wsu.user_id = ?
    `, [stageId, userId]);

    if (userPermissions.length > 0) {
      const perm = userPermissions[0];
      // User-specific permissions override role permissions
      // Convert MySQL BOOLEAN (0/1) to JavaScript boolean
      if (perm.can_view !== null) permissions.can_view = Boolean(perm.can_view);
      if (perm.can_edit !== null) permissions.can_edit = Boolean(perm.can_edit);
      if (perm.can_delete !== null) permissions.can_delete = Boolean(perm.can_delete);
      if (perm.can_approve !== null) permissions.can_approve = Boolean(perm.can_approve);
      // Explicitly check can_reject - MySQL returns 1/0 as numbers
      if (perm.can_reject !== null) {
        permissions.can_reject = perm.can_reject === 1 || perm.can_reject === true;
      }
      if (perm.can_review !== null) permissions.can_review = Boolean(perm.can_review);
      if (perm.can_create_case !== null) permissions.can_create_case = Boolean(perm.can_create_case);
      if (perm.can_fill_case !== null) permissions.can_fill_case = Boolean(perm.can_fill_case);
    }

    return permissions;
  } catch (error) {
    console.error('Get workflow stage permissions error:', error);
    return {
      can_view: false,
      can_edit: false,
      can_delete: false,
      can_approve: false,
      can_reject: false,
      can_review: false,
      can_create_case: false,
      can_fill_case: false
    };
  }
};

// Helper function to check if user can create cases in a stage
const canCreateCaseInStage = async (userId, userRole, stageId) => {
  try {
    console.log(`[CanCreateCaseInStage] Checking for user ${userId}, role: ${userRole}, stageId: ${stageId}`);
    
    // Super admin has access to everything
    if (userRole === 'super_admin') {
      console.log(`[CanCreateCaseInStage] Super admin - allowing`);
      return true;
    }

    // Get user's roles to check permissions (do this first for fallback)
    const [userRoles] = await pool.execute(`
      SELECT r.id, r.name, r.permissions
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    `, [userId]);

    console.log(`[CanCreateCaseInStage] Found ${userRoles.length} roles in user_roles table`);

    // If no roles found in user_roles table, fallback to users.role column
    let rolesToCheck = userRoles;
    if (rolesToCheck.length === 0 && userRole) {
      console.log(`[CanCreateCaseInStage] No roles in user_roles, checking fallback for role: ${userRole}`);
      // Use case-insensitive matching for role name
      const [fallbackRoles] = await pool.execute(`
        SELECT id, name, permissions
        FROM roles
        WHERE LOWER(name) = LOWER(?) AND is_active = 1
      `, [userRole]);
      rolesToCheck = fallbackRoles;
      console.log(`[CanCreateCaseInStage] Found ${fallbackRoles.length} roles in fallback`);
    }

    // Check if user has general cases:create permission (fallback check first)
    let hasGeneralCreatePermission = false;
    for (const role of rolesToCheck) {
      console.log(`[CanCreateCaseInStage] Checking role: ${role.name} (ID: ${role.id})`);
      
      // Check granular permissions
      const [permissions] = await pool.execute(`
        SELECT permission FROM role_permissions 
        WHERE role_id = ? AND resource = 'cases' AND action = 'create'
      `, [role.id]);
      
      if (permissions.length > 0) {
        console.log(`[CanCreateCaseInStage] Found cases:create in role_permissions for role ${role.name}`);
        hasGeneralCreatePermission = true;
        break;
      }

      // Check JSON permissions
      if (role.permissions) {
        try {
          const rolePermissions = JSON.parse(role.permissions);
          if (typeof rolePermissions === 'object' && !Array.isArray(rolePermissions)) {
            if (rolePermissions.cases && rolePermissions.cases.includes('create')) {
              console.log(`[CanCreateCaseInStage] Found cases:create in JSON for role ${role.name}`);
              hasGeneralCreatePermission = true;
              break;
            }
          } else if (Array.isArray(rolePermissions)) {
            const hasPerm = rolePermissions.some(p => 
              p.resource === 'cases' && p.action === 'create'
            );
            if (hasPerm) {
              console.log(`[CanCreateCaseInStage] Found cases:create in JSON array for role ${role.name}`);
              hasGeneralCreatePermission = true;
              break;
            }
          }
        } catch (parseError) {
          console.warn(`[CanCreateCaseInStage] Error parsing JSON for role ${role.name}:`, parseError);
        }
      }
    }

    console.log(`[CanCreateCaseInStage] Has general create permission: ${hasGeneralCreatePermission}`);

    // Check if stage exists and allows case creation
    // Try to get can_create_case, but handle if column doesn't exist
    let stage;
    try {
      [stage] = await pool.execute(`
        SELECT can_create_case, stage_name
        FROM workflow_stages
        WHERE id = ? AND is_active = TRUE
      `, [stageId]);
    } catch (columnError) {
      // If column doesn't exist, just get stage info without can_create_case
      console.warn('[CanCreateCaseInStage] can_create_case column not found, using fallback logic');
      [stage] = await pool.execute(`
        SELECT stage_name
        FROM workflow_stages
        WHERE id = ? AND is_active = TRUE
      `, [stageId]);
      // If column doesn't exist, treat as if stage allows creation (use fallback)
      if (stage.length > 0) {
        console.log('[CanCreateCaseInStage] Column missing, using general permission fallback');
        return hasGeneralCreatePermission;
      }
    }

    // If stage doesn't exist, allow if user has general permission (fallback)
    if (stage.length === 0) {
      console.log(`[CanCreateCaseInStage] Stage ${stageId} not found, returning: ${hasGeneralCreatePermission}`);
      return hasGeneralCreatePermission;
    }

    const stageData = stage[0];
    // Check if can_create_case column exists (might be undefined if column doesn't exist)
    const stageAllowsCreation = stageData.can_create_case !== undefined 
      ? (stageData.can_create_case === 1 || stageData.can_create_case === true)
      : true; // Default to true if column doesn't exist (use fallback logic)
    console.log(`[CanCreateCaseInStage] Stage: ${stageData.stage_name}, can_create_case: ${stageData.can_create_case !== undefined ? stageData.can_create_case : 'N/A (column missing)'}, stageAllowsCreation: ${stageAllowsCreation}`);

    // If stage explicitly allows case creation, check stage permissions
    if (stageAllowsCreation) {
      // Check if user has permission for this stage (view permission)
      const hasStagePermission = await checkWorkflowStagePermission(userId, userRole, stageId, 'view');
      console.log(`[CanCreateCaseInStage] Has stage view permission: ${hasStagePermission}`);
      
      // If user has stage permission, allow
      if (hasStagePermission) {
        console.log(`[CanCreateCaseInStage] ALLOWED - user has stage permission`);
        return true;
      }

      // If stage allows creation but user doesn't have stage permission,
      // fallback to general cases:create permission
      if (hasGeneralCreatePermission) {
        console.log(`[CanCreateCaseInStage] ALLOWED - fallback to general permission`);
        return true;
      }
    } else {
      // If stage doesn't explicitly allow creation, but user has general permission,
      // allow it anyway (more permissive approach)
      if (hasGeneralCreatePermission) {
        console.log(`[CanCreateCaseInStage] ALLOWED - stage doesn't allow but user has general permission`);
        return true;
      }
    }

    console.log(`[CanCreateCaseInStage] DENIED - no permissions found`);
    return false;
  } catch (error) {
    console.error('Can create case in stage error:', error);
    console.error('Error details:', { userId, userRole, stageId, error: error.message });
    console.error('Error stack:', error.stack);
    return false;
  }
};

// Helper function to check if user can fill cases in a stage
const canFillCaseInStage = async (userId, userRole, stageId) => {
  try {
    // Super admin has access to everything
    if (userRole === 'super_admin') {
      return true;
    }

    // Check if stage allows case filling
    const [stage] = await pool.execute(`
      SELECT can_fill_case
      FROM workflow_stages
      WHERE id = ? AND is_active = TRUE
    `, [stageId]);

    if (stage.length === 0 || !stage[0].can_fill_case) {
      return false;
    }

    // Check if user has permission for this stage
    return await checkWorkflowStagePermission(userId, userRole, stageId, 'view');
  } catch (error) {
    console.error('Can fill case in stage error:', error);
    return false;
  }
};

// Middleware that checks for role OR permission (supports both role-based and permission-based access)
const authorizeRolesOrPermission = (...roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Super admin has access to everything
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has one of the allowed roles
    if (roles.includes(req.user.role)) {
      return next();
    }

    // If no role match, check permissions (try to extract resource and action from context)
    // For welfare checklist, check for welfare_checklist:view permission
    try {
      const [userRoles] = await pool.execute(`
        SELECT r.id, r.name, r.permissions
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      `, [req.user.id]);

      let hasPermission = false;
      
      for (const role of userRoles) {
        // Check JSON permissions for welfare_checklist
        if (role.permissions) {
          const permissions = JSON.parse(role.permissions);
          if (permissions['welfare_checklist'] && 
              (permissions['welfare_checklist'].includes('view') || 
               permissions['welfare_checklist'].includes('read') ||
               permissions['welfare_checklist'].includes('create') ||
               permissions['welfare_checklist'].includes('update'))) {
            hasPermission = true;
            break;
          }
        }
        
        // Check granular permissions
        const [permissions] = await pool.execute(`
          SELECT permission FROM role_permissions 
          WHERE role_id = ? AND resource = 'welfare_checklist'
        `, [role.id]);
        
        if (permissions.length > 0) {
          hasPermission = true;
          break;
        }
      }

      if (hasPermission) {
        return next();
      }
    } catch (error) {
      console.error('Permission check error:', error);
      // Fall through to deny access
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  };
};

module.exports = {
  authenticateToken,
  getCurrentRoleScopes,
  authorizeRoles,
  authorizeCaseAccess,
  authorizePermission,
  authorizeAllPermissions,
  authorizeAnyPermission,
  authorizeRolesOrPermission,
  checkWorkflowStagePermission,
  checkCaseWorkflowStagePermission,
  getWorkflowStagePermissions,
  getUserPermissions,
  authorizeWorkflowStageAccess,
  canCreateCaseInStage,
  canFillCaseInStage
};
