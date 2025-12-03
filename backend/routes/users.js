const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRoles, authorizePermission } = require('../middleware/auth');
const { hasPermission } = require('../utils/permissionUtils');

const router = express.Router();

// Get all roles
// Allow access if user has assign_case permission OR is one of the authorized roles
router.get('/roles', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    
    // Check if user has assign_case permission
    const canAssignCase = await hasPermission(userRole, 'cases', 'assign_case');
    
    // Check if user is in authorized roles list
    const authorizedRoles = ['admin', 'dcm', 'Deputy Counseling Manager', 'ZI', 'welfare', 'welfare_reviewer', 'Welfare', 'super_admin'];
    const isAuthorizedRole = authorizedRoles.includes(userRole);
    
    // Allow access if user has permission OR is authorized role
    if (!canAssignCase && !isAuthorizedRole) {
      return res.status(403).json({ error: 'You do not have permission to view roles' });
    }
    
    const [roles] = await pool.execute('SELECT * FROM roles WHERE is_active = 1 ORDER BY name');
    res.json({ roles });
  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new user
router.post('/', authenticateToken, authorizePermission('users', 'create'), async (req, res) => {
  try {
    const { 
      full_name, 
      username,
      email, 
      phone, 
      its_number,
      jamiat, 
      jamaat, 
      role, 
      is_active = true, // Default to 1 (Active)
      password,
      photo 
    } = req.body;

    // Validate required fields
    if (!full_name || !username || !email || !role) {
      return res.status(400).json({ error: 'Full name, username, email, and role are required' });
    }

    // Validate username format (alphanumeric, underscores, and dots allowed, 3-30 characters)
    const usernameRegex = /^[a-zA-Z0-9_.]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ 
        error: 'Username must be 3-30 characters long and contain only letters, numbers, underscores, and dots' 
      });
    }

    // Validate role against database and get role_id
    const [roles] = await pool.execute('SELECT id, name FROM roles WHERE is_active = 1');
    const validRoles = roles.map(r => r.name);
    const roleObj = roles.find(r => r.name === role);
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role specified', 
        validRoles: validRoles 
      });
    }
    
    const roleId = roleObj ? roleObj.id : null;

    // Check if username already exists
    const [existingUsername] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUsername.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Check if email already exists
    const [existingEmail] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingEmail.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Hash password if provided, otherwise generate a temporary one
    const saltRounds = 10;
    const finalPassword = password || 'TempPassword123!';
    const password_hash = await bcrypt.hash(finalPassword, saltRounds);

    // Create user (without jamiat_id and jamaat_id as they're now handled separately)
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash, full_name, phone, its_number, role, is_active, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, email, password_hash, full_name, phone, its_number || null, role, is_active, photo || null]
    );

    const userId = result.insertId;

    // Handle jamiat associations (comma-separated)
    if (Array.isArray(jamiat)) {
      const jamiatIds = jamiat.length > 0 ? jamiat.join(',') : null;
      await pool.execute(
        'UPDATE users SET jamiat_ids = ? WHERE id = ?',
        [jamiatIds, userId]
      );
    }

    // Handle jamaat associations (comma-separated)
    if (Array.isArray(jamaat)) {
      const jamaatIds = jamaat.length > 0 ? jamaat.join(',') : null;
      await pool.execute(
        'UPDATE users SET jamaat_ids = ? WHERE id = ?',
        [jamaatIds, userId]
      );
    }

    // Create role assignment in user_roles table
    if (roleId) {
      await pool.execute(
        'INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at) VALUES (?, ?, ?, NULL)',
        [userId, roleId, req.user.id]
      );
    }

    res.status(201).json({
      message: 'User created successfully',
      userId: userId,
      username: username
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all users with filtering
// Allow access if user has assign_case permission OR is admin
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user.role;
    
    // Check if user has assign_case permission
    const canAssignCase = await hasPermission(userRole, 'cases', 'assign_case');
    
    // Check if user is admin
    const isAdmin = userRole === 'admin' || userRole === 'super_admin';
    
    // Allow access if user has permission OR is admin
    if (!canAssignCase && !isAdmin) {
      return res.status(403).json({ error: 'You do not have permission to view users' });
    }
    
    const { role, is_active, search, jamiat_id } = req.query;

    let whereConditions = [];
    let queryParams = [];

    if (role) {
      whereConditions.push('role = ?');
      queryParams.push(role);
    }

    if (is_active !== undefined) {
      whereConditions.push('is_active = ?');
      // Convert 'true'/'false' strings to 0/1 (0=inactive, 1=active)
      queryParams.push(is_active === 'true' ? 1 : 0);
    }

    if (search) {
      whereConditions.push('(full_name LIKE ? OR username LIKE ? OR email LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (jamiat_id) {
      whereConditions.push('(jamiat_ids LIKE ? OR jamiat_ids LIKE ? OR jamiat_ids = ?)');
      queryParams.push(`%${jamiat_id},%`, `%,${jamiat_id}%`, jamiat_id);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [users] = await pool.execute(`
      SELECT 
        u.id, u.username, u.email, u.full_name, u.role, u.is_active, u.phone, u.its_number, u.photo,
        u.jamiat_ids, u.jamaat_ids, u.executive_level, u.created_at, u.updated_at
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
    `, queryParams);

    // Process jamiat and jamaat associations for each user
    for (let user of users) {
      // Parse jamiat associations
      if (user.jamiat_ids) {
        const jamiatIdArray = user.jamiat_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (jamiatIdArray.length > 0) {
          const [jamiatAssociations] = await pool.execute(`
            SELECT id, name, jamiat_id
            FROM jamiat
            WHERE id IN (${jamiatIdArray.map(() => '?').join(',')}) AND is_active = 1
            ORDER BY name
          `, jamiatIdArray);
          user.jamiat = jamiatAssociations;
        } else {
          user.jamiat = [];
        }
      } else {
        user.jamiat = [];
      }

      // Parse jamaat associations
      if (user.jamaat_ids) {
        const jamaatIdArray = user.jamaat_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        if (jamaatIdArray.length > 0) {
          const [jamaatAssociations] = await pool.execute(`
            SELECT ja.id, ja.name, ja.jamaat_id, j.name as jamiat_name
            FROM jamaat ja
            JOIN jamiat j ON ja.jamiat_id = j.id
            WHERE ja.id IN (${jamaatIdArray.map(() => '?').join(',')}) AND ja.is_active = 1
            ORDER BY j.name, ja.name
          `, jamaatIdArray);
          user.jamaat = jamaatAssociations;
        } else {
          user.jamaat = [];
        }
      } else {
        user.jamaat = [];
      }

      // Remove the raw comma-separated fields from response
      delete user.jamiat_ids;
      delete user.jamaat_ids;
    }

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get users by role (for dropdowns)
router.get('/by-role/:role', authenticateToken, async (req, res) => {
  try {
    const { role } = req.params;

    // Validate role against database
    const [roles] = await pool.execute('SELECT name FROM roles WHERE is_active = 1');
    const validRoles = roles.map(r => r.name);
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const [users] = await pool.execute(`
      SELECT id, full_name, username, email
      FROM users 
      WHERE role = ? AND is_active = 1
      ORDER BY full_name
    `, [role]);

    res.json({ users });
  } catch (error) {
    console.error('Get users by role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single user
router.get('/:userId', authenticateToken, authorizePermission('users', 'read'), async (req, res) => {
  try {
    const { userId } = req.params;

    const [users] = await pool.execute(`
      SELECT 
        u.id, u.username, u.email, u.full_name, u.role, u.is_active, u.phone, u.its_number, u.photo,
        u.jamiat_ids, u.jamaat_ids, u.executive_level, u.created_at, u.updated_at
      FROM users u
      WHERE u.id = ?
    `, [userId]);

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Parse jamiat associations
    if (user.jamiat_ids) {
      const jamiatIdArray = user.jamiat_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (jamiatIdArray.length > 0) {
        const [jamiatAssociations] = await pool.execute(`
          SELECT id, name, jamiat_id
          FROM jamiat
          WHERE id IN (${jamiatIdArray.map(() => '?').join(',')}) AND is_active = 1
          ORDER BY name
        `, jamiatIdArray);
        user.jamiat = jamiatAssociations;
      } else {
        user.jamiat = [];
      }
    } else {
      user.jamiat = [];
    }

    // Parse jamaat associations
    if (user.jamaat_ids) {
      const jamaatIdArray = user.jamaat_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (jamaatIdArray.length > 0) {
        const [jamaatAssociations] = await pool.execute(`
          SELECT ja.id, ja.name, ja.jamaat_id, j.name as jamiat_name
          FROM jamaat ja
          JOIN jamiat j ON ja.jamiat_id = j.id
          WHERE ja.id IN (${jamaatIdArray.map(() => '?').join(',')}) AND ja.is_active = 1
          ORDER BY j.name, ja.name
        `, jamaatIdArray);
        user.jamaat = jamaatAssociations;
      } else {
        user.jamaat = [];
      }
    } else {
      user.jamaat = [];
    }

    // Remove the raw comma-separated fields from response
    delete user.jamiat_ids;
    delete user.jamaat_ids;

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user
router.put('/:userId', authenticateToken, authorizePermission('users', 'update'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { full_name, username, email, phone, its_number, jamiat, jamaat, role, is_active, password, photo } = req.body;

    // Check if username is being changed and if it's already taken
    if (username) {
      const [existingUsername] = await pool.execute(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId]
      );

      if (existingUsername.length > 0) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      // Validate username format
      const usernameRegex = /^[a-zA-Z0-9_.]{3,30}$/;
      if (!usernameRegex.test(username)) {
        return res.status(400).json({ 
          error: 'Username must be 3-30 characters long and contain only letters, numbers, underscores, and dots' 
        });
      }
    }

    // Check if email is being changed and if it's already taken
    if (email) {
      const [existingUsers] = await pool.execute(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({ error: 'Email already exists' });
      }
    }

    // Validate role if provided and get role_id
    let roleId = null;
    if (role) {
      const [roles] = await pool.execute('SELECT id, name FROM roles WHERE is_active = 1');
      const validRoles = roles.map(r => r.name);
      
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      
      // Get role_id for user_roles table
      const roleObj = roles.find(r => r.name === role);
      if (roleObj) {
        roleId = roleObj.id;
      }
    }

    // Validate and hash password if provided
    let password_hash = null;
    if (password !== undefined && password !== null && password !== '') {
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }
      const saltRounds = 10;
      password_hash = await bcrypt.hash(password, saltRounds);
    }

    const updateFields = [];
    const updateValues = [];

    if (full_name !== undefined) {
      updateFields.push('full_name = ?');
      updateValues.push(full_name);
    }
    if (username !== undefined) {
      updateFields.push('username = ?');
      updateValues.push(username);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (its_number !== undefined) {
      updateFields.push('its_number = ?');
      updateValues.push(its_number);
    }
    // Note: jamiat and jamaat are now handled separately after the main user update
    if (role !== undefined) {
      updateFields.push('role = ?');
      updateValues.push(role);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }
    if (password_hash !== null) {
      updateFields.push('password_hash = ?');
      updateValues.push(password_hash);
    }
    if (photo !== undefined) {
      updateFields.push('photo = ?');
      updateValues.push(photo);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(userId);

    const [result] = await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Handle jamiat associations (comma-separated)
    if (jamiat !== undefined) {
      const jamiatIds = Array.isArray(jamiat) && jamiat.length > 0 ? jamiat.join(',') : null;
      await pool.execute(
        'UPDATE users SET jamiat_ids = ? WHERE id = ?',
        [jamiatIds, userId]
      );
    }

    // Handle jamaat associations (comma-separated)
    if (jamaat !== undefined) {
      const jamaatIds = Array.isArray(jamaat) && jamaat.length > 0 ? jamaat.join(',') : null;
      await pool.execute(
        'UPDATE users SET jamaat_ids = ? WHERE id = ?',
        [jamaatIds, userId]
      );
    }

    // Handle role assignment in user_roles table if role was changed
    if (role !== undefined && roleId) {
      // Deactivate all existing role assignments for this user
      await pool.execute(
        'UPDATE user_roles SET is_active = 0 WHERE user_id = ? AND is_active = 1',
        [userId]
      );

      // Check if assignment already exists (even if inactive)
      const [existing] = await pool.execute(
        'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?',
        [userId, roleId]
      );

      if (existing.length > 0) {
        // Reactivate existing assignment
        await pool.execute(
          'UPDATE user_roles SET is_active = 1, assigned_by = ?, assigned_at = NOW(), expires_at = NULL WHERE user_id = ? AND role_id = ?',
          [req.user.id, userId, roleId]
        );
      } else {
        // Create new assignment
        await pool.execute(
          'INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at) VALUES (?, ?, ?, NULL)',
          [userId, roleId, req.user.id]
        );
      }
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Deactivate/Activate user
router.put('/:userId/toggle-status', authenticateToken, authorizePermission('users', 'update'), async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent deactivating self
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    // Toggle between 0 (inactive) and 1 (active)
    const [result] = await pool.execute(
      'UPDATE users SET is_active = CASE WHEN is_active = 0 THEN 1 ELSE 0 END WHERE id = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User status updated successfully' });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user status
router.put('/:id/status', authenticateToken, authorizePermission('users', 'update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    // Prevent deactivating self
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot modify your own account status' });
    }

    const [result] = await pool.execute(
      'UPDATE users SET is_active = ? WHERE id = ?',
      [is_active, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User status updated successfully' });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user statistics
router.get('/stats/overview', authenticateToken, authorizeRoles('admin', 'dcm', 'Deputy Counseling Manager', 'ZI'), async (req, res) => {
  try {
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_users
      FROM users
    `);

    // Get role-specific counts dynamically
    const [roleCounts] = await pool.execute(`
      SELECT 
        r.name as role_name,
        COUNT(u.id) as user_count
      FROM roles r
      LEFT JOIN users u ON r.name = u.role AND u.is_active = 1
      WHERE r.is_active = 1
      GROUP BY r.id, r.name
    `);

    // Add role counts to stats
    const roleStats = {};
    roleCounts.forEach(role => {
      roleStats[`${role.role_name}_count`] = role.user_count;
    });

    res.json({ stats: { ...stats[0], ...roleStats } });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign user to executive level
router.put('/:userId/assign-executive-level', authenticateToken, authorizeRoles('super_admin', 'admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { executive_level } = req.body;

    // Validate required fields - allow null for unassignment
    if (executive_level === undefined) {
      return res.status(400).json({ error: 'Executive level is required' });
    }

    // Check if user exists
    const [users] = await pool.execute(
      'SELECT id, full_name, role FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Check if user has executive role
    if (user.role !== 'Executive Management') {
      return res.status(400).json({ error: 'User must have Executive Management role to be assigned to an executive level' });
    }

    // If executive_level is provided, validate it exists
    if (executive_level !== null) {
      const [levels] = await pool.execute(
        'SELECT id, level_name FROM executive_levels WHERE level_number = ? AND is_active = TRUE',
        [executive_level]
      );

      if (levels.length === 0) {
        return res.status(400).json({ error: 'Invalid executive level' });
      }
    }

    // Update user's executive level
    await pool.execute(
      'UPDATE users SET executive_level = ? WHERE id = ?',
      [executive_level, userId]
    );

    const message = executive_level 
      ? `User ${user.full_name} has been assigned to executive level ${executive_level}`
      : `User ${user.full_name} has been unassigned from executive level`;

    res.json({ 
      message,
      user: {
        id: user.id,
        full_name: user.full_name,
        executive_level: executive_level
      }
    });

  } catch (error) {
    console.error('Assign executive level error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user
router.delete('/:userId', authenticateToken, authorizePermission('users', 'delete'), async (req, res) => {
  try {
    const { userId } = req.params;

    // Prevent deleting self
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const [users] = await pool.execute(
      'SELECT id, full_name, role FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting super_admin users
    if (users[0].role === 'super_admin') {
      return res.status(400).json({ error: 'Cannot delete super admin users' });
    }

    // Delete user role assignments first (if any)
    await pool.execute(
      'DELETE FROM user_roles WHERE user_id = ?',
      [userId]
    );

    // Delete the user
    const [result] = await pool.execute(
      'DELETE FROM users WHERE id = ?',
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
