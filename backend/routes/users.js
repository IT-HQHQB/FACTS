const express = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRoles, authorizePermission } = require('../middleware/auth');
const { hasPermission } = require('../utils/permissionUtils');
const multer = require('multer');
const xlsx = require('xlsx');
const axios = require('axios');
const https = require('https');

const router = express.Router();

/** Resolve comma-separated jamiat_ids and jamaat_ids to arrays of { id, name, ... } (for list/single user responses). */
async function resolveJamiatJamaatFromIds(jamiatIdsStr, jamaatIdsStr) {
  const jamiatIds = (jamiatIdsStr || '')
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id));
  const jamaatIds = (jamaatIdsStr || '')
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id));
  let jamiat = [];
  let jamaat = [];
  if (jamiatIds.length > 0) {
    const [rows] = await pool.execute(
      `SELECT id, name, jamiat_id FROM jamiat WHERE id IN (${jamiatIds.map(() => '?').join(',')}) AND is_active = 1 ORDER BY name`,
      jamiatIds
    );
    jamiat = rows;
  }
  if (jamaatIds.length > 0) {
    const [rows] = await pool.execute(
      `SELECT ja.id, ja.name, ja.jamaat_id, j.name as jamiat_name FROM jamaat ja JOIN jamiat j ON ja.jamiat_id = j.id WHERE ja.id IN (${jamaatIds.map(() => '?').join(',')}) AND ja.is_active = 1 ORDER BY j.name, ja.name`,
      jamaatIds
    );
    jamaat = rows;
  }
  return { jamiat, jamaat };
}

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed!'), false);
    }
  }
});

// Helper function to fetch user data from external API
async function fetchUserDataFromAPI(itsNumber) {
  try {
    // Call external API for user data
    const externalApiUrl = `https://counseling.dbohra.com/test/its-user/${itsNumber}`;
    
    const response = await axios.get(externalApiUrl, {
      timeout: 10000, // 10 second timeout
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Baaseteen-CMS/1.0'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // Handle SSL certificate issues
      })
    });

    const apiData = response.data;
    
    // Check if we have valid data structure
    if (!apiData || !apiData.data) {
      throw new Error('No data found for this ITS number');
    }

    const userData = apiData.data;
    
    // Fetch photo from image API
    let photoBase64 = null;
    try {
      const photoApiUrl = `http://13.127.158.101:3000/test/its-user-image/${itsNumber}`;
      
      const photoResponse = await axios.get(photoApiUrl, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Baaseteen-CMS/1.0'
        }
      });
      
      // API response format: { "data": { "image": "path", "image_data": "base64string" } }
      if (photoResponse.data && photoResponse.data.data && photoResponse.data.data.image_data) {
        photoBase64 = photoResponse.data.data.image_data;
        
        // Ensure it has the data:image prefix if it's just base64
        if (photoBase64 && !photoBase64.startsWith('data:')) {
          photoBase64 = `data:image/jpeg;base64,${photoBase64}`;
        }
      }
    } catch (photoError) {
      console.log(`❌ Photo fetch failed for ITS ${itsNumber}: ${photoError.message}`);
      // Continue without photo if photo API fails
    }
    
    // Return only the fields we need for users (including email for fetch-contact)
    return {
      success: true,
      data: {
        full_name: userData.Fullname || '',
        phone: userData.Mobile || '',
        email: userData.Email || '',
        photo: photoBase64
      }
    };
  } catch (error) {
    console.error(`Error fetching data for ITS ${itsNumber}:`, error.message);
    return { 
      success: false, 
      error: error.response?.status === 404 ? 'ITS number not found' : error.message,
      data: {
        full_name: '',
        phone: '',
        email: '',
        photo: null
      }
    };
  }
}

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
      role_jamiat_jamaat,
      is_active = true, // Default to 1 (Active)
      password,
      photo 
    } = req.body;

    // Validate required fields
    const roleArray = Array.isArray(role) ? role : (role ? [role] : []);
    if (!full_name || !username || !email || roleArray.length === 0) {
      return res.status(400).json({ error: 'Full name, username, email, and at least one role are required' });
    }

    // Validate username format (alphanumeric, underscores, and dots allowed, 3-30 characters)
    const usernameRegex = /^[a-zA-Z0-9_.]{3,30}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ 
        error: 'Username must be 3-30 characters long and contain only letters, numbers, underscores, and dots' 
      });
    }

    // Validate roles against database
    const [roles] = await pool.execute('SELECT id, name FROM roles WHERE is_active = 1');
    const validRoles = roles.map(r => r.name);
    const roleIds = [];
    for (const r of roleArray) {
      if (!validRoles.includes(r)) {
        return res.status(400).json({ 
          error: `Invalid role specified: ${r}`, 
          validRoles: validRoles 
        });
      }
      const roleObj = roles.find(x => x.name === r);
      if (roleObj) roleIds.push(roleObj);
    }
    const primaryRole = roleIds.length > 0 ? roleIds[0].name : null;

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
      [username, email, password_hash, full_name, phone, its_number || null, primaryRole, is_active, photo || null]
    );

    const userId = result.insertId;

    const getScopeForRole = (roleName) => {
      const perRole = role_jamiat_jamaat && role_jamiat_jamaat[roleName];
      if (perRole && (perRole.jamiat || perRole.jamaat)) {
        const jIds = Array.isArray(perRole.jamiat) && perRole.jamiat.length > 0 ? perRole.jamiat.join(',') : null;
        const jaIds = Array.isArray(perRole.jamaat) && perRole.jamaat.length > 0 ? perRole.jamaat.join(',') : null;
        return { jamiat_ids: jIds, jamaat_ids: jaIds };
      }
      const jIds = Array.isArray(jamiat) && jamiat.length > 0 ? jamiat.join(',') : null;
      const jaIds = Array.isArray(jamaat) && jamaat.length > 0 ? jamaat.join(',') : null;
      return { jamiat_ids: jIds, jamaat_ids: jaIds };
    };

    const primaryScope = getScopeForRole(primaryRole);

    await pool.execute(
      'UPDATE users SET jamiat_ids = ?, jamaat_ids = ? WHERE id = ?',
      [primaryScope.jamiat_ids, primaryScope.jamaat_ids, userId]
    );

    for (const roleObj of roleIds) {
      const scope = getScopeForRole(roleObj.name);
      await pool.execute(
        'INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at, jamiat_ids, jamaat_ids) VALUES (?, ?, ?, NULL, ?, ?)',
        [userId, roleObj.id, req.user.id, scope.jamiat_ids, scope.jamaat_ids]
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
    
    const { role, is_active, search, jamiat_id, page: pageParam, limit: limitParam } = req.query;

    const allowedLimits = [10, 20, 50, 100, 500];
    const parsedLimit = limitParam ? parseInt(limitParam, 10) : 10;
    const effectiveLimit = allowedLimits.includes(parsedLimit) ? parsedLimit : 10;
    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const offset = (page - 1) * effectiveLimit;

    let whereConditions = [];
    let queryParams = [];

    if (role) {
      whereConditions.push('(u.role = ? OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND ur.is_active = 1 AND r.name = ?))');
      queryParams.push(role, role);
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

    // Get total count for pagination
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      queryParams
    );
    const total = Number(countResult[0]?.total ?? 0);
    const totalPages = Math.ceil(total / effectiveLimit) || 1;

    // Use string interpolation for LIMIT/OFFSET (validated integers) to avoid parameter binding issues
    const safeLimit = parseInt(effectiveLimit, 10);
    const safeOffset = parseInt(offset, 10);
    const usersQuery = `
      SELECT 
        u.id, u.username, u.email, u.full_name, u.role, u.is_active, u.phone, u.its_number, u.photo,
        u.jamiat_ids, u.jamaat_ids, u.executive_level, u.created_at, u.updated_at
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    const [users] = await pool.execute(usersQuery, queryParams);
    const userIds = users.map(u => u.id);

    // Load assigned_roles with per-role jamiat_ids/jamaat_ids from user_roles
    let roleRowsByUserId = {};
    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      const [assignedRows] = await pool.execute(
        `SELECT ur.user_id, ur.role_id, ur.jamiat_ids AS ur_jamiat_ids, ur.jamaat_ids AS ur_jamaat_ids, r.name
         FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id IN (${placeholders}) AND ur.is_active = 1 AND r.is_active = 1
         ORDER BY r.name`,
        userIds
      );
      assignedRows.forEach(row => {
        if (!roleRowsByUserId[row.user_id]) roleRowsByUserId[row.user_id] = [];
        roleRowsByUserId[row.user_id].push(row);
      });
    }

    // Build assigned_roles (with per-role jamiat/jamaat) and top-level jamiat/jamaat for each user
    for (const user of users) {
      const roleRows = roleRowsByUserId[user.id] || [];
      const allJamiatById = new Map();
      const allJamaatById = new Map();
      const assignedRolesWithScopes = [];

      for (const row of roleRows) {
        const jamiatIdsStr = row.ur_jamiat_ids != null ? row.ur_jamiat_ids : user.jamiat_ids;
        const jamaatIdsStr = row.ur_jamaat_ids != null ? row.ur_jamaat_ids : user.jamaat_ids;
        const { jamiat: roleJamiat, jamaat: roleJamaat } = await resolveJamiatJamaatFromIds(jamiatIdsStr, jamaatIdsStr);
        roleJamiat.forEach(j => allJamiatById.set(j.id, j));
        roleJamaat.forEach(j => allJamaatById.set(j.id, j));
        assignedRolesWithScopes.push({
          role_id: row.role_id,
          name: row.name,
          jamiat: roleJamiat,
          jamaat: roleJamaat
        });
      }

      user.assigned_roles = assignedRolesWithScopes.length > 0
        ? assignedRolesWithScopes
        : (user.role ? [{ role_id: null, name: user.role, jamiat: [], jamaat: [] }] : []);
      user.jamiat = Array.from(allJamiatById.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      user.jamaat = Array.from(allJamaatById.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (user.jamiat.length === 0 && user.jamaat.length === 0 && (user.jamiat_ids || user.jamaat_ids)) {
        const fallback = await resolveJamiatJamaatFromIds(user.jamiat_ids, user.jamaat_ids);
        user.jamiat = fallback.jamiat;
        user.jamaat = fallback.jamaat;
      }
      delete user.jamiat_ids;
      delete user.jamaat_ids;
    }

    res.json({ users, total, page, limit: effectiveLimit, totalPages });
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

// Get current user with assigned roles (for Switch role UI)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [users] = await pool.execute(
      'SELECT id, username, email, full_name, role, is_active, phone, its_number, photo, executive_level, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = users[0];
    const [assignedRoles] = await pool.execute(`
      SELECT r.id, r.name FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      ORDER BY r.name
    `, [userId]);
    user.assigned_roles = assignedRoles;
    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Set current user's primary (display) role - persisted as default for next login
router.patch('/me/primary-role', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { role: roleName } = req.body;
    if (!roleName || typeof roleName !== 'string') {
      return res.status(400).json({ error: 'Role is required' });
    }
    const name = roleName.trim();
    const [hasRole] = await pool.execute(`
      SELECT r.id FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW()) AND r.name = ?
    `, [userId, name]);
    if (hasRole.length === 0) {
      return res.status(400).json({ error: 'You do not have this role assigned' });
    }
    await pool.execute('UPDATE users SET role = ? WHERE id = ?', [name, userId]);
    res.json({ success: true, role: name });
  } catch (error) {
    console.error('Patch primary-role error:', error);
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

    // Load assigned_roles from user_roles with per-role jamiat_ids/jamaat_ids
    const [assignedRolesRows] = await pool.execute(
      `SELECT ur.role_id, ur.jamiat_ids AS ur_jamiat_ids, ur.jamaat_ids AS ur_jamaat_ids, r.name
       FROM user_roles ur JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1 ORDER BY r.name`,
      [userId]
    );
    const allJamiatById = new Map();
    const allJamaatById = new Map();
    const assignedRolesWithScopes = [];
    for (const row of assignedRolesRows) {
      const jamiatIdsStr = row.ur_jamiat_ids != null ? row.ur_jamiat_ids : user.jamiat_ids;
      const jamaatIdsStr = row.ur_jamaat_ids != null ? row.ur_jamaat_ids : user.jamaat_ids;
      const { jamiat: roleJamiat, jamaat: roleJamaat } = await resolveJamiatJamaatFromIds(jamiatIdsStr, jamaatIdsStr);
      roleJamiat.forEach(j => allJamiatById.set(j.id, j));
      roleJamaat.forEach(j => allJamaatById.set(j.id, j));
      assignedRolesWithScopes.push({
        role_id: row.role_id,
        name: row.name,
        jamiat: roleJamiat,
        jamaat: roleJamaat
      });
    }
    user.assigned_roles = assignedRolesWithScopes.length > 0
      ? assignedRolesWithScopes
      : (user.role ? [{ role_id: null, name: user.role, jamiat: [], jamaat: [] }] : []);
    user.jamiat = Array.from(allJamiatById.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    user.jamaat = Array.from(allJamaatById.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (user.jamiat.length === 0 && user.jamaat.length === 0 && (user.jamiat_ids || user.jamaat_ids)) {
      const fallback = await resolveJamiatJamaatFromIds(user.jamiat_ids, user.jamaat_ids);
      user.jamiat = fallback.jamiat;
      user.jamaat = fallback.jamaat;
    }
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
    const { full_name, username, email, phone, its_number, jamiat, jamaat, role, role_jamiat_jamaat, is_active, password, photo } = req.body;

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

    // Normalize role to array and validate
    const roleArray = role === undefined ? undefined : Array.isArray(role) ? role : (role ? [role] : []);
    if (role !== undefined) {
      console.log('[PUT user] role (raw):', typeof role, role);
      console.log('[PUT user] roleArray:', roleArray?.length, roleArray);
    }
    let roleIds = []; // array of { id, name } for user_roles sync
    let primaryRole = null; // first role for users.role
    if (roleArray !== undefined) {
      if (roleArray.length === 0) {
        return res.status(400).json({ error: 'At least one role is required' });
      }
      const [roles] = await pool.execute('SELECT id, name FROM roles WHERE is_active = 1');
      const validRoles = roles.map(r => r.name);
      for (const r of roleArray) {
        if (!validRoles.includes(r)) {
          return res.status(400).json({ error: `Invalid role: ${r}` });
        }
        const roleObj = roles.find(x => x.name === r);
        if (roleObj) roleIds.push(roleObj);
      }
      primaryRole = roleIds.length > 0 ? roleIds[0].name : null;
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
    if (primaryRole !== null) {
      updateFields.push('role = ?');
      updateValues.push(primaryRole);
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

    // Helper: get jamiat_ids/jamaat_ids strings for a role (from role_jamiat_jamaat or legacy jamiat/jamaat)
    const getScopeForRole = (roleName) => {
      const perRole = role_jamiat_jamaat && role_jamiat_jamaat[roleName];
      if (perRole && (perRole.jamiat || perRole.jamaat)) {
        const jIds = Array.isArray(perRole.jamiat) && perRole.jamiat.length > 0 ? perRole.jamiat.join(',') : null;
        const jaIds = Array.isArray(perRole.jamaat) && perRole.jamaat.length > 0 ? perRole.jamaat.join(',') : null;
        return { jamiat_ids: jIds, jamaat_ids: jaIds };
      }
      const jIds = Array.isArray(jamiat) && jamiat.length > 0 ? jamiat.join(',') : null;
      const jaIds = Array.isArray(jamaat) && jamaat.length > 0 ? jamaat.join(',') : null;
      return { jamiat_ids: jIds, jamaat_ids: jaIds };
    };

    // Handle role assignments in user_roles table if role was changed (with per-role jamiat/jamaat)
    if (roleArray !== undefined && roleIds.length > 0) {
      await pool.execute(
        'UPDATE user_roles SET is_active = 0 WHERE user_id = ? AND is_active = 1',
        [userId]
      );
      for (const roleObj of roleIds) {
        const scope = getScopeForRole(roleObj.name);
        const [existing] = await pool.execute(
          'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?',
          [userId, roleObj.id]
        );
        if (existing.length > 0) {
          await pool.execute(
            'UPDATE user_roles SET is_active = 1, assigned_by = ?, assigned_at = NOW(), expires_at = NULL, jamiat_ids = ?, jamaat_ids = ? WHERE user_id = ? AND role_id = ?',
            [req.user.id, scope.jamiat_ids, scope.jamaat_ids, userId, roleObj.id]
          );
        } else {
          await pool.execute(
            'INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at, jamiat_ids, jamaat_ids) VALUES (?, ?, ?, NULL, ?, ?)',
            [userId, roleObj.id, req.user.id, scope.jamiat_ids, scope.jamaat_ids]
          );
        }
      }
      // Fallback: write primary role's scopes to users.jamiat_ids/jamaat_ids for getCurrentRoleScopes fallback
      const primaryScope = getScopeForRole(roleIds[0].name);
      await pool.execute(
        'UPDATE users SET jamiat_ids = ?, jamaat_ids = ? WHERE id = ?',
        [primaryScope.jamiat_ids, primaryScope.jamaat_ids, userId]
      );
      // Verify sync: active user_roles count should match roleIds.length
      const [countRows] = await pool.execute(
        'SELECT COUNT(*) AS cnt FROM user_roles WHERE user_id = ? AND is_active = 1',
        [userId]
      );
      const activeCount = Number(countRows[0]?.cnt ?? 0);
      if (activeCount !== roleIds.length) {
        console.warn(`[PUT user] user_roles sync mismatch for user_id=${userId}: expected ${roleIds.length} active, got ${activeCount}`);
      }
    } else if (jamiat !== undefined || jamaat !== undefined) {
      // Role not changed but jamiat/jamaat sent (legacy): update users table and all active user_roles
      const jamiatIds = Array.isArray(jamiat) && jamiat.length > 0 ? jamiat.join(',') : null;
      const jamaatIds = Array.isArray(jamaat) && jamaat.length > 0 ? jamaat.join(',') : null;
      await pool.execute('UPDATE users SET jamiat_ids = ?, jamaat_ids = ? WHERE id = ?', [jamiatIds, jamaatIds, userId]);
      await pool.execute(
        'UPDATE user_roles SET jamiat_ids = ?, jamaat_ids = ? WHERE user_id = ? AND is_active = 1',
        [jamiatIds, jamaatIds, userId]
      );
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

// Export sample Excel template for user import
router.get('/export/template', authenticateToken, authorizePermission('users', 'read'), async (req, res) => {
  try {
    // Create sample data (optional Jamiat ID and Jamaat ID for access by jamiat/jamaat)
    const sampleData = [
      { 'ITS Number': '30335640', 'Username': 'user1.example', 'Role': 'Counselor', 'Jamiat ID': '', 'Jamaat ID': '' },
      { 'ITS Number': '30335641', 'Username': 'user2.example', 'Role': 'Finance', 'Jamiat ID': '', 'Jamaat ID': '' },
      { 'ITS Number': '30335642', 'Username': 'user3.example', 'Role': 'Operations Lead', 'Jamiat ID': '', 'Jamaat ID': '' }
    ];

    // Create workbook and worksheet
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(sampleData);

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(wb, ws, 'Users_Import_Template');

    // Generate buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=users_import_template.xlsx');

    // Send buffer
    res.send(buffer);
  } catch (error) {
    console.error('Export template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Import users from Excel
router.post('/import-excel', authenticateToken, authorizePermission('users', 'create'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse Excel file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      return res.status(400).json({ error: 'No data found in Excel file' });
    }

    // Validate required columns (no Email - email set to NULL on import)
    const requiredColumns = ['ITS Number', 'Username', 'Role'];
    const firstRow = data[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({ 
        error: `Missing required columns: ${missingColumns.join(', ')}. Please ensure your Excel file has columns: ${requiredColumns.join(', ')}` 
      });
    }

    // Get all active roles
    const [roles] = await pool.execute('SELECT id, name FROM roles WHERE is_active = 1');
    const validRoles = roles.map(r => r.name);
    const roleMap = {};
    roles.forEach(r => {
      roleMap[r.name] = r.id;
    });

    const connection = await pool.getConnection();

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];
    const BATCH_SIZE = 100; // Commit every N rows so partial progress is saved and request doesn't time out

    try {
      for (let i = 0; i < data.length; i++) {
        if (i % BATCH_SIZE === 0) {
          await connection.beginTransaction();
        }

        const row = data[i];
        const rowNum = i + 2; // +2 because Excel rows start at 1 and we have a header

        try {
          const itsNumber = String(row['ITS Number'] || '').trim();
          const username = String(row['Username'] || '').trim();
          const role = String(row['Role'] || '').trim();

          // Validate required fields (no Email - set to NULL)
          if (!itsNumber || !username || !role) {
            errors.push(`Row ${rowNum}: Missing required fields (ITS Number, Username, or Role)`);
            skipped++;
            continue;
          }

          // Validate role
          if (!validRoles.includes(role)) {
            errors.push(`Row ${rowNum}: Invalid role "${role}". Valid roles: ${validRoles.join(', ')}`);
            skipped++;
            continue;
          }

          // Validate username format
          const usernameRegex = /^[a-zA-Z0-9_.]{3,30}$/;
          if (!usernameRegex.test(username)) {
            errors.push(`Row ${rowNum}: Invalid username format. Username must be 3-30 characters and contain only letters, numbers, underscores, and dots`);
            skipped++;
            continue;
          }

          // Optional Jamiat ID and Jamaat ID (codes from master) - resolve to internal ids
          const jamiatCode = String(row['Jamiat ID'] || '').trim();
          const jamaatCode = String(row['Jamaat ID'] || '').trim();
          let rowJamiatIdsString = null;
          let rowJamaatIdsString = null;
          if (jamiatCode) {
            const [jamiatRows] = await connection.execute(
              'SELECT id FROM jamiat WHERE jamiat_id = ? AND is_active = 1',
              [jamiatCode]
            );
            if (jamiatRows.length > 0) {
              rowJamiatIdsString = String(jamiatRows[0].id);
              if (jamaatCode) {
                const [jamaatRows] = await connection.execute(
                  'SELECT j.id FROM jamaat j JOIN jamiat ji ON j.jamiat_id = ji.id WHERE ji.jamiat_id = ? AND j.jamaat_id = ? AND j.is_active = 1',
                  [jamiatCode, jamaatCode]
                );
                if (jamaatRows.length > 0) {
                  rowJamaatIdsString = String(jamaatRows[0].id);
                }
              }
            }
          }

          // Check if user exists: by ITS number first, then by username
          let [existingUsers] = await connection.execute(
            'SELECT id, jamiat_ids, jamaat_ids FROM users WHERE its_number = ? AND its_number IS NOT NULL AND its_number != ""',
            [itsNumber]
          );
          if (existingUsers.length === 0) {
            [existingUsers] = await connection.execute(
              'SELECT id, jamiat_ids, jamaat_ids FROM users WHERE username = ?',
              [username]
            );
          }

          const roleId = roleMap[role];

          if (existingUsers.length > 0) {
            // Existing user: only add role and update jamiat/jamaat if provided; preserve name and credentials
            const userId = existingUsers[0].id;
            const existingJamiatIds = existingUsers[0].jamiat_ids;
            const existingJamaatIds = existingUsers[0].jamaat_ids;
            const finalJamiatIds = rowJamiatIdsString !== null ? rowJamiatIdsString : existingJamiatIds;
            const finalJamaatIds = rowJamaatIdsString !== null ? rowJamaatIdsString : existingJamaatIds;

            await connection.execute(
              'UPDATE users SET role = ?, jamiat_ids = ?, jamaat_ids = ? WHERE id = ?',
              [role, finalJamiatIds, finalJamaatIds, userId]
            );

            // Add role (do not deactivate existing roles - dual role support)
            const [existingRole] = await connection.execute(
              'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ?',
              [userId, roleId]
            );
            if (existingRole.length > 0) {
              await connection.execute(
                'UPDATE user_roles SET is_active = 1, assigned_by = ?, assigned_at = NOW(), jamiat_ids = ?, jamaat_ids = ? WHERE user_id = ? AND role_id = ?',
                [req.user.id, finalJamiatIds, finalJamaatIds, userId, roleId]
              );
            } else {
              await connection.execute(
                'INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at, jamiat_ids, jamaat_ids) VALUES (?, ?, ?, NULL, ?, ?)',
                [userId, roleId, req.user.id, finalJamiatIds, finalJamaatIds]
              );
            }

            updated++;
          } else {
            // New user: email = NULL, password = ITS number, optional jamiat/jamaat from row
            const fullName = null;
            const phone = null;
            const photo = null;
            const saltRounds = 10;
            const password_hash = await bcrypt.hash(itsNumber, saltRounds);

            const [result] = await connection.execute(
              `INSERT INTO users (
                username, email, password_hash, full_name, phone, its_number, 
                role, is_active, photo, jamiat_ids, jamaat_ids
              ) VALUES (?, NULL, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
              [username, password_hash, fullName || null, phone || null, itsNumber, role, photo, rowJamiatIdsString, rowJamaatIdsString]
            );

            const userId = result.insertId;

            if (roleId) {
              await connection.execute(
                'INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at, jamiat_ids, jamaat_ids) VALUES (?, ?, ?, NULL, ?, ?)',
                [userId, roleId, req.user.id, rowJamiatIdsString, rowJamaatIdsString]
              );
            }

            inserted++;
          }
        } catch (rowError) {
          console.error(`Error processing row ${rowNum}:`, rowError);
          errors.push(`Row ${rowNum}: ${rowError.message || 'Unknown error'}`);
          skipped++;
        }

        // Commit every BATCH_SIZE rows so partial progress is saved and request stays responsive
        if ((i + 1) % BATCH_SIZE === 0 || i === data.length - 1) {
          await connection.commit();
          if (i < data.length - 1) {
            await connection.beginTransaction();
          }
        }
      }

      connection.release();

      res.json({
        success: true,
        inserted,
        updated,
        skipped,
        total: data.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (transactionError) {
      await connection.rollback();
      connection.release();
      throw transactionError;
    }
  } catch (error) {
    console.error('Import Excel error:', error);
    if (error.message === 'Only Excel files are allowed!') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch email, phone and photo from external API for users with a given role
router.post('/fetch-contact-from-api', authenticateToken, authorizePermission('users', 'update'), async (req, res) => {
  try {
    const { role: roleName } = req.body;
    if (!roleName || typeof roleName !== 'string') {
      return res.status(400).json({ error: 'Role is required' });
    }

    const [roles] = await pool.execute('SELECT id, name FROM roles WHERE is_active = 1');
    const validRoles = roles.map(r => r.name);
    if (!validRoles.includes(roleName.trim())) {
      return res.status(400).json({ error: `Invalid role. Valid roles: ${validRoles.join(', ')}` });
    }

    // Users who have this role in user_roles OR in users.role, and have its_number
    const [users] = await pool.execute(`
      SELECT DISTINCT u.id, u.its_number, u.username
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = 1
      LEFT JOIN roles r ON r.id = ur.role_id AND r.is_active = 1
      WHERE (u.role = ? OR r.name = ?) AND u.its_number IS NOT NULL AND TRIM(u.its_number) != ''
    `, [roleName.trim(), roleName.trim()]);

    let updated = 0;
    let failed = 0;
    const errors = [];

    for (const user of users) {
      try {
        const apiResult = await fetchUserDataFromAPI(user.its_number);
        if (!apiResult.success || !apiResult.data) {
          failed++;
          errors.push(`ITS ${user.its_number} (${user.username}): ${apiResult.error || 'No data'}`);
          continue;
        }
        const { email = '', phone = '', photo = null, full_name: fullName = '' } = apiResult.data;
        await pool.execute(
          'UPDATE users SET email = ?, phone = ?, photo = ?, full_name = ? WHERE id = ?',
          [email || null, phone || null, photo, fullName || null, user.id]
        );
        updated++;
      } catch (err) {
        failed++;
        errors.push(`ITS ${user.its_number} (${user.username}): ${err.message || 'Unknown error'}`);
      }
    }

    res.json({ success: true, updated, failed, total: users.length, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error('Fetch contact from API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
