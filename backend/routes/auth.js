const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// IPs that skip login rate limiting (e.g. office static IP with many users)
const loginRateLimitSkipIps = (process.env.LOGIN_RATE_LIMIT_SKIP_IPS || '')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);

// Max failed login attempts per IP per 15 min (env overrides defaults: 5 prod, 50 dev)
const loginRateLimitMax = process.env.LOGIN_RATE_LIMIT_MAX
  ? parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10)
  : (process.env.NODE_ENV === 'production' ? 5 : 50);

// Login-specific rate limiting (more lenient than general API)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: loginRateLimitMax,
  message: { error: 'Too many login attempts from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  skip: (req, res) => loginRateLimitSkipIps.length > 0 && loginRateLimitSkipIps.includes(req.ip),
});

// Login endpoint
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username or email (1 = active, 0 = inactive)
    const [users] = await pool.execute(
      'SELECT id, username, email, password_hash, full_name, role, is_active, executive_level FROM users WHERE (username = ? OR email = ?) AND is_active = 1',
      [username, username]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-super-secret-jwt-key-here',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Remove password from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register endpoint (admin only)
router.post('/register', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can create new users' });
    }

    const { 
      username, 
      email, 
      password, 
      full_name, 
      role 
    } = req.body;

    // Validate required fields
    if (!username || !email || !password || !full_name || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate role against database
    const [roles] = await pool.execute('SELECT name FROM roles WHERE is_active = 1');
    const validRoles = roles.map(r => r.name);
    
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role specified', 
        validRoles: validRoles 
      });
    }

    // Check if username or email already exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
      [username, email, password_hash, full_name, role]
    );

    res.status(201).json({
      message: 'User created successfully',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, username, email, full_name, role, is_active, executive_level, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Fetch user permissions from role_permissions table
    let permissions = {};
    try {
      const [rolePermissions] = await pool.execute(
        `SELECT rp.resource, rp.action 
         FROM role_permissions rp 
         JOIN roles r ON rp.role_id = r.id 
         WHERE r.name = ? AND r.is_active = 1`,
        [user.role]
      );

      // Group permissions by resource: { master: ['read', 'create'], cases: ['read', 'update'], ... }
      rolePermissions.forEach(rp => {
        if (!permissions[rp.resource]) {
          permissions[rp.resource] = [];
        }
        permissions[rp.resource].push(rp.action);
      });
    } catch (permErr) {
      // If role_permissions table doesn't exist or query fails, continue with empty permissions
      console.log('Could not fetch role permissions:', permErr.message);
    }

    user.permissions = permissions;

    res.json({ user });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { full_name, email } = req.body;
    const userId = req.user.id;

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

    // Update user profile
    const updateFields = [];
    const updateValues = [];

    if (full_name) {
      updateFields.push('full_name = ?');
      updateValues.push(full_name);
    }
    if (email) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateValues.push(userId);

    await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Get current password hash
    const [users] = await pool.execute(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, userId]
    );

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ message: 'Logout successful' });
});

module.exports = router;
