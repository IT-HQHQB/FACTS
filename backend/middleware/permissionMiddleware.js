const { hasPermission, hasCounselingFormAccess, canManageUsers, canManageRoles } = require('../utils/permissionUtils');

/**
 * Middleware to check if user has a specific permission
 * @param {string} resource - The resource (e.g., 'cases', 'users', 'counseling_forms')
 * @param {string} action - The action (e.g., 'create', 'read', 'update', 'delete')
 * @returns {Function} - Express middleware function
 */
const requirePermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user.role;
      
      if (!userRole) {
        return res.status(401).json({ error: 'User role not found' });
      }

      const hasAccess = await hasPermission(userRole, resource, action);
      
      if (!hasAccess) {
        return res.status(403).json({ 
          error: `Access denied - insufficient permissions for ${resource}:${action}` 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Error checking permissions' });
    }
  };
};

/**
 * Middleware to check if user has counseling form access
 * @returns {Function} - Express middleware function
 */
const requireCounselingFormAccess = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    
    if (!userRole) {
      return res.status(401).json({ error: 'User role not found' });
    }

    const hasAccess = await hasCounselingFormAccess(userRole);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Access denied - insufficient permissions for counseling forms' 
      });
    }

    next();
  } catch (error) {
    console.error('Counseling form access check error:', error);
    return res.status(500).json({ error: 'Error checking counseling form access' });
  }
};

/**
 * Middleware to check if user has admin access
 * @returns {Function} - Express middleware function
 */
const requireAdminAccess = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    
    if (!userRole) {
      return res.status(401).json({ error: 'User role not found' });
    }

    const hasAccess = await canManageUsers(userRole);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Access denied - admin access required' 
      });
    }

    next();
  } catch (error) {
    console.error('Admin access check error:', error);
    return res.status(500).json({ error: 'Error checking admin access' });
  }
};

/**
 * Middleware to check if user has super admin access
 * @returns {Function} - Express middleware function
 */
const requireSuperAdminAccess = async (req, res, next) => {
  try {
    const userRole = req.user.role;
    
    if (!userRole) {
      return res.status(401).json({ error: 'User role not found' });
    }

    const hasAccess = await canManageRoles(userRole);
    
    if (!hasAccess) {
      return res.status(403).json({ 
        error: 'Access denied - super admin access required' 
      });
    }

    next();
  } catch (error) {
    console.error('Super admin access check error:', error);
    return res.status(500).json({ error: 'Error checking super admin access' });
  }
};

module.exports = {
  requirePermission,
  requireCounselingFormAccess,
  requireAdminAccess,
  requireSuperAdminAccess
};
