const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { 
  hasPermission, 
  hasCounselingFormAccess, 
  canAccessAllCases, 
  canManageUsers, 
  canManageRoles,
  getCounselingFormRoles,
  getAdminRoles
} = require('../utils/permissionUtils');

const router = express.Router();

/**
 * Check if current user has a specific permission
 * GET /api/permissions/check?resource=cases&action=read
 */
router.get('/check', authenticateToken, async (req, res) => {
  try {
    const { resource, action } = req.query;
    const userRole = req.user.role;

    if (!resource || !action) {
      return res.status(400).json({ error: 'Resource and action parameters are required' });
    }

    const hasAccess = await hasPermission(userRole, resource, action);
    
    res.json({ 
      hasPermission: hasAccess,
      userRole,
      resource,
      action
    });
  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({ error: 'Error checking permission' });
  }
});

/**
 * Check if current user has counseling form access
 * GET /api/permissions/counseling-form-access
 */
router.get('/counseling-form-access', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    const hasAccess = await hasCounselingFormAccess(userRole);
    
    res.json({ 
      hasCounselingFormAccess: hasAccess,
      userRole
    });
  } catch (error) {
    console.error('Counseling form access check error:', error);
    res.status(500).json({ error: 'Error checking counseling form access' });
  }
});

/**
 * Get all roles that have counseling form access
 * GET /api/permissions/counseling-form-roles
 */
router.get('/counseling-form-roles', authenticateToken, async (req, res) => {
  try {
    const roles = await getCounselingFormRoles();
    
    res.json({ 
      roles,
      count: roles.length
    });
  } catch (error) {
    console.error('Get counseling form roles error:', error);
    res.status(500).json({ error: 'Error getting counseling form roles' });
  }
});

/**
 * Get all roles that have admin access
 * GET /api/permissions/admin-roles
 */
router.get('/admin-roles', authenticateToken, async (req, res) => {
  try {
    const roles = await getAdminRoles();
    
    res.json({ 
      roles,
      count: roles.length
    });
  } catch (error) {
    console.error('Get admin roles error:', error);
    res.status(500).json({ error: 'Error getting admin roles' });
  }
});

/**
 * Get comprehensive permission summary for current user
 * GET /api/permissions/summary
 */
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    
    const [
      counselingFormAccess,
      allCasesAccess,
      userManagementAccess,
      roleManagementAccess
    ] = await Promise.all([
      hasCounselingFormAccess(userRole),
      canAccessAllCases(userRole),
      canManageUsers(userRole),
      canManageRoles(userRole)
    ]);
    
    res.json({ 
      userRole,
      permissions: {
        counselingFormAccess,
        allCasesAccess,
        userManagementAccess,
        roleManagementAccess
      }
    });
  } catch (error) {
    console.error('Permission summary error:', error);
    res.status(500).json({ error: 'Error getting permission summary' });
  }
});

module.exports = router;
