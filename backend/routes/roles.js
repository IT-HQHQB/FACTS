const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get all roles with permissions
router.get('/', authenticateToken, authorizeRoles('super_admin', 'admin', 'dcm', 'Deputy Counseling Manager', 'ZI', 'welfare', 'welfare_reviewer', 'Welfare'), async (req, res) => {
  try {
    const [roles] = await pool.execute(`
      SELECT 
        r.*,
        COUNT(DISTINCT rp.id) as permission_count,
        (SELECT COUNT(*) FROM users u WHERE u.role = r.name AND u.is_active = 0) as user_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      WHERE r.is_active = 1
      GROUP BY r.id
      ORDER BY r.name
    `);

    // Get permissions for each role
    for (let role of roles) {
      const [permissions] = await pool.execute(`
        SELECT resource, action 
        FROM role_permissions 
        WHERE role_id = ?
        ORDER BY resource, action
      `, [role.id]);

      // Convert permissions to the format expected by frontend
      const permissionsObj = {};
      permissions.forEach(perm => {
        if (!permissionsObj[perm.resource]) {
          permissionsObj[perm.resource] = [];
        }
        permissionsObj[perm.resource].push(perm.action);
      });

      // Get counseling form stage permissions (if table exists)
      let stagePermissions = [];
      try {
        const [stagePerms] = await pool.execute(`
          SELECT stage_key, stage_name, can_read, can_update
          FROM counseling_form_stage_permissions
          WHERE role_id = ?
          ORDER BY 
            CASE stage_key
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
        `, [role.id]);
        stagePermissions = stagePerms || [];
      } catch (err) {
        // Table doesn't exist yet or other error - skip stage permissions
        console.log('Stage permissions table not available:', err.message);
        stagePermissions = [];
      }

      if (stagePermissions.length > 0) {
        if (!permissionsObj['counseling_forms']) {
          permissionsObj['counseling_forms'] = [];
        }
        permissionsObj['counseling_forms_stages'] = stagePermissions.map(sp => ({
          stage_key: sp.stage_key,
          stage_name: sp.stage_name,
          can_read: sp.can_read,
          can_update: sp.can_update
        }));
      }

      role.permissions = permissionsObj;
    }

    res.json({ roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get role by ID with detailed permissions
router.get('/:id', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get role details
    const [roles] = await pool.execute(
      'SELECT * FROM roles WHERE id = ? AND is_active = 1',
      [id]
    );
    
    if (roles.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Get role permissions
    const [permissions] = await pool.execute(`
      SELECT permission, resource, action 
      FROM role_permissions 
      WHERE role_id = ?
      ORDER BY resource, action
    `, [id]);
    
    // Get users with this role
    const [users] = await pool.execute(`
      SELECT u.id, u.full_name, u.email, u.username, ur.assigned_at
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      WHERE ur.role_id = ? AND ur.is_active = 1
      ORDER BY u.full_name
    `, [id]);
    
    res.json({
      role: roles[0],
      permissions,
      users
    });
  } catch (error) {
    console.error('Get role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new role
router.post('/', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { name, display_name, description, permissions } = req.body;
    
    // Validate required fields
    if (!name || !display_name) {
      return res.status(400).json({ error: 'Name and display name are required' });
    }
    
    // Check if role name already exists
    const [existing] = await pool.execute(
      'SELECT id FROM roles WHERE name = ?',
      [name]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Role name already exists' });
    }
    
    // Create role
    const [result] = await pool.execute(
      'INSERT INTO roles (name, display_name, description, permissions) VALUES (?, ?, ?, ?)',
      [name, display_name, description, JSON.stringify(permissions || {})]
    );
    
    const roleId = result.insertId;
    
    // Add permissions if provided
    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        await pool.execute(
          'INSERT INTO role_permissions (role_id, permission, resource, action) VALUES (?, ?, ?, ?)',
          [roleId, perm.permission, perm.resource, perm.action]
        );
      }
    }
    
    // Handle counseling form stage permissions if provided
    const { counseling_form_stages } = req.body;
    if (counseling_form_stages && Array.isArray(counseling_form_stages) && counseling_form_stages.length > 0) {
      try {
        for (const stage of counseling_form_stages) {
          if (!stage.stage_key || !stage.stage_name) {
            console.warn('Skipping invalid stage permission:', stage);
            continue;
          }
          // Ensure boolean values are properly converted
          const canRead = Boolean(stage.can_read === true || stage.can_read === 'true' || stage.can_read === 1);
          const canUpdate = Boolean(stage.can_update === true || stage.can_update === 'true' || stage.can_update === 1);
          
          await pool.execute(`
            INSERT INTO counseling_form_stage_permissions (role_id, stage_key, stage_name, can_read, can_update)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              can_read = VALUES(can_read),
              can_update = VALUES(can_update),
              updated_at = CURRENT_TIMESTAMP
          `, [roleId, stage.stage_key, stage.stage_name, canRead ? 1 : 0, canUpdate ? 1 : 0]);
        }
      } catch (err) {
        // Log the full error for debugging
        console.error('Error saving stage permissions:', err);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        // Table doesn't exist yet or other error - log warning but don't fail the whole request
        console.warn('Cannot save stage permissions:', err.message);
      }
    }
    
    res.status(201).json({ 
      message: 'Role created successfully',
      role: { id: roleId, name, display_name, description }
    });
  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update role
router.put('/:id', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display_name, description, permissions } = req.body;
    
    // Check if role exists and get its details
    const [existing] = await pool.execute(
      'SELECT id, name, is_system_role FROM roles WHERE id = ? AND is_active = 1',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Prevent modification of system roles (super admin)
    if (existing[0].is_system_role) {
      return res.status(400).json({ error: 'Cannot modify system roles' });
    }
    
    // Check if new name conflicts with existing roles
    if (name) {
      const [nameConflict] = await pool.execute(
        'SELECT id FROM roles WHERE name = ? AND id != ?',
        [name, id]
      );
      
      if (nameConflict.length > 0) {
        return res.status(400).json({ error: 'Role name already exists' });
      }
    }
    
    // Update role
    const updateFields = [];
    const updateValues = [];
    
    if (name) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (display_name) {
      updateFields.push('display_name = ?');
      updateValues.push(display_name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    // Convert permissions array to object format for JSON storage
    let permissionsJson = null;
    if (permissions) {
      if (Array.isArray(permissions)) {
        // Convert array format to object format: {resource: [actions]}
        const permissionsObj = {};
        for (const perm of permissions) {
          if (perm.resource && perm.action) {
            if (!permissionsObj[perm.resource]) {
              permissionsObj[perm.resource] = [];
            }
            if (!permissionsObj[perm.resource].includes(perm.action)) {
              permissionsObj[perm.resource].push(perm.action);
            }
          }
        }
        permissionsJson = Object.keys(permissionsObj).length > 0 ? permissionsObj : null;
      } else if (typeof permissions === 'object') {
        // Already in object format
        permissionsJson = permissions;
      }
      
      if (permissionsJson) {
        updateFields.push('permissions = ?');
        updateValues.push(JSON.stringify(permissionsJson));
      }
    }
    
    updateValues.push(id);
    
    if (updateFields.length > 0) {
      await pool.execute(
        `UPDATE roles SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }
    
    // Update granular permissions in role_permissions table if provided
    if (permissions && Array.isArray(permissions)) {
      // Remove existing permissions
      await pool.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);
      
      // Add new permissions
      for (const perm of permissions) {
        // Validate permission object
        if (!perm.permission || !perm.resource || !perm.action) {
          console.warn('Skipping invalid permission:', perm);
          continue;
        }
        try {
          await pool.execute(
            'INSERT INTO role_permissions (role_id, permission, resource, action) VALUES (?, ?, ?, ?)',
            [id, perm.permission, perm.resource, perm.action]
          );
        } catch (permErr) {
          // Log but continue - might be duplicate or constraint issue
          console.warn('Error inserting permission:', permErr.message, 'Permission:', perm);
        }
      }
    }
    
    // Handle counseling form stage permissions if provided
    const { counseling_form_stages } = req.body;
    if (counseling_form_stages && Array.isArray(counseling_form_stages) && counseling_form_stages.length > 0) {
      try {
        for (const stage of counseling_form_stages) {
          if (!stage.stage_key || !stage.stage_name) {
            console.warn('Skipping invalid stage permission:', stage);
            continue;
          }
          // Ensure boolean values are properly converted
          const canRead = Boolean(stage.can_read === true || stage.can_read === 'true' || stage.can_read === 1);
          const canUpdate = Boolean(stage.can_update === true || stage.can_update === 'true' || stage.can_update === 1);
          
          await pool.execute(`
            INSERT INTO counseling_form_stage_permissions (role_id, stage_key, stage_name, can_read, can_update)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              can_read = VALUES(can_read),
              can_update = VALUES(can_update),
              updated_at = CURRENT_TIMESTAMP
          `, [id, stage.stage_key, stage.stage_name, canRead ? 1 : 0, canUpdate ? 1 : 0]);
        }
      } catch (err) {
        // Log the full error for debugging
        console.error('Error saving stage permissions:', err);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        console.error('SQL State:', err.sqlState);
        // Table doesn't exist yet or other error - log warning but don't fail the whole request
        console.warn('Cannot save stage permissions:', err.message);
      }
    }
    
    res.json({ message: 'Role updated successfully' });
  } catch (error) {
    console.error('Update role error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    res.status(500).json({ error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
});

// Delete role (soft delete)
router.delete('/:id', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if role exists
    const [existing] = await pool.execute(
      'SELECT id, name, is_system_role FROM roles WHERE id = ? AND is_active = 1',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Check if role is in use
    const [usersWithRole] = await pool.execute(
      'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ? AND is_active = 1',
      [id]
    );
    
    if (usersWithRole[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete role that is assigned to users. Please reassign users first.' 
      });
    }
    
    // Prevent deletion of system roles (super admin)
    if (existing[0].is_system_role) {
      return res.status(400).json({ error: 'Cannot delete system roles' });
    }
    
    // Soft delete role
    await pool.execute(
      'UPDATE roles SET is_active = 0 WHERE id = ?',
      [id]
    );
    
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all available permissions
router.get('/permissions/available', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    // Get counseling form stage permissions if they exist
    let counselingFormStages = [
      { key: 'personal', name: 'Personal Details' },
      { key: 'family', name: 'Family Details' },
      { key: 'assessment', name: 'Assessment' },
      { key: 'financial', name: 'Financial Assistance' },
      { key: 'growth', name: 'Economic Growth' },
      { key: 'declaration', name: 'Declaration' },
      { key: 'attachments', name: 'Attachments' },
      { key: 'manzoori', name: 'Manzoori' }
    ];

    // Always ensure default stages are included
    // Merge with any custom stages from database if they exist
    try {
      const [stagePermissions] = await pool.execute(`
        SELECT DISTINCT stage_key, stage_name 
        FROM counseling_form_stage_permissions 
        ORDER BY 
          CASE stage_key
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
      `);

      // Create a map of database stages for quick lookup
      const dbStagesMap = new Map();
      if (stagePermissions && stagePermissions.length > 0) {
        stagePermissions.forEach(sp => {
          dbStagesMap.set(sp.stage_key, sp.stage_name);
        });
      }
      
      // Always start with default stages (ensures manzoori and all defaults are included)
      // Then update names from DB if they exist (in case they were customized)
      counselingFormStages = counselingFormStages.map(stage => {
        const dbName = dbStagesMap.get(stage.key);
        return {
          key: stage.key,
          name: dbName || stage.name
        };
      });
      
      // Add any additional stages from DB that aren't in defaults
      if (stagePermissions && stagePermissions.length > 0) {
        stagePermissions.forEach(sp => {
          if (!counselingFormStages.find(s => s.key === sp.stage_key)) {
            counselingFormStages.push({ key: sp.stage_key, name: sp.stage_name });
          }
        });
      }
    } catch (err) {
      // Table doesn't exist yet - use default stages (which includes manzoori)
      console.log('Stage permissions table not available, using defaults:', err.message);
      // counselingFormStages already has all defaults including manzoori
    }

    const permissions = [
      // User permissions
      { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
      // Case permissions
      { resource: 'cases', actions: ['create', 'read', 'update', 'delete', 'assign_case', 'assign_counselor', 'change_assignee', 'close_case', 'case_assigned'] },
      // Applicant permissions
      { resource: 'applicants', actions: ['create', 'read', 'update', 'delete'] },
      // Counseling form permissions
      { 
        resource: 'counseling_forms', 
        actions: ['create', 'read', 'update', 'delete', 'complete', 'comment'],
        stages: counselingFormStages
      },
      // Payment management permissions
      { resource: 'payment_management', actions: ['create', 'read', 'update', 'delete'] },
      // Cover letter permissions
      { resource: 'cover_letters', actions: ['create', 'read', 'update', 'delete'] },
      // Cover letter form permissions
      { resource: 'cover_letter_forms', actions: ['create', 'read', 'update', 'submit'] },
      // Notification permissions
      { resource: 'notifications', actions: ['create', 'read', 'update', 'delete'] },
      // Report permissions
      { resource: 'reports', actions: ['read'] },
      // Role permissions
      { resource: 'roles', actions: ['create', 'read', 'update', 'delete'] },
      // Dashboard permissions
      { resource: 'dashboard', actions: ['read'] },
      // Welfare checklist permissions
      { resource: 'welfare_checklist', actions: ['create', 'read', 'update', 'delete', 'fill', 'view'] },
      // Master data permissions (Jamiat Master, Case Types, Relations, etc.)
      { resource: 'master', actions: ['read', 'create', 'update', 'delete'] },
      // Case Identification permissions
      { resource: 'case_identification', actions: ['create', 'read', 'update', 'delete', 'approve'] },
    ];
    
    res.json({ permissions });
  } catch (error) {
    console.error('Get available permissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign role to user
router.post('/:id/assign', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { id: roleId } = req.params;
    const { user_id, expires_at } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check if role exists
    const [role] = await pool.execute(
      'SELECT id FROM roles WHERE id = ? AND is_active = 1',
      [roleId]
    );
    
    if (role.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Check if user exists
    const [user] = await pool.execute(
      'SELECT id FROM users WHERE id = ?',
      [user_id]
    );
    
    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if assignment already exists
    const [existing] = await pool.execute(
      'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?',
      [user_id, roleId]
    );
    
    if (existing.length > 0) {
      // Update existing assignment
      await pool.execute(
        'UPDATE user_roles SET is_active = 1, expires_at = ?, assigned_by = ? WHERE user_id = ? AND role_id = ?',
        [expires_at, req.user.id, user_id, roleId]
      );
    } else {
      // Create new assignment
      await pool.execute(
        'INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at) VALUES (?, ?, ?, ?)',
        [user_id, roleId, req.user.id, expires_at]
      );
    }
    
    res.json({ message: 'Role assigned successfully' });
  } catch (error) {
    console.error('Assign role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove role from user
router.delete('/:id/unassign/:userId', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const { id: roleId, userId } = req.params;
    
    // Check if assignment exists
    const [existing] = await pool.execute(
      'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ? AND is_active = 1',
      [userId, roleId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Role assignment not found' });
    }
    
    // Prevent removing admin role from last admin
    if (roleId === '1' || roleId === 1) { // Admin role
      const [adminCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM user_roles WHERE role_id = 1 AND is_active = 1'
      );
      
      if (adminCount[0].count <= 1) {
        return res.status(400).json({ error: 'Cannot remove admin role from the last admin user' });
      }
    }
    
    // Deactivate assignment
    await pool.execute(
      'UPDATE user_roles SET is_active = 0 WHERE user_id = ? AND role_id = ?',
      [userId, roleId]
    );
    
    res.json({ message: 'Role removed successfully' });
  } catch (error) {
    console.error('Remove role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get role statistics
router.get('/stats/overview', authenticateToken, authorizeRoles('super_admin'), async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_roles,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_roles,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_roles,
        (SELECT COUNT(*) FROM role_permissions) as total_permissions,
        (SELECT COUNT(*) FROM user_roles WHERE is_active = 1) as active_assignments
      FROM roles
    `);
    
    res.json({ stats: stats[0] });
  } catch (error) {
    console.error('Get role stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

