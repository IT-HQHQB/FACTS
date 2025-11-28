const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { hasPermission } = require('../utils/roleUtils');

const router = express.Router();

// Get all occupations
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [occupations] = await pool.execute(
      'SELECT * FROM occupations WHERE is_active = TRUE ORDER BY name'
    );
    res.json(occupations);
  } catch (error) {
    console.error('Get occupations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get occupation by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [occupations] = await pool.execute(
      'SELECT * FROM occupations WHERE id = ? AND is_active = TRUE',
      [id]
    );
    
    if (occupations.length === 0) {
      return res.status(404).json({ error: 'Occupation not found' });
    }
    
    res.json(occupations[0]);
  } catch (error) {
    console.error('Get occupation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new occupation (Admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Check if user has admin permissions
    if (!await hasPermission(req.user.role, 'occupations', 'create')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO occupations (name, description) VALUES (?, ?)',
      [name, description]
    );
    
    res.status(201).json({
      id: result.insertId,
      name,
      description,
      message: 'Occupation created successfully'
    });
  } catch (error) {
    console.error('Create occupation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Occupation with this name already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Update occupation (Admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;
    
    // Check if user has admin permissions
    if (!await hasPermission(req.user.role, 'occupations', 'update')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const [result] = await pool.execute(
      'UPDATE occupations SET name = ?, description = ?, is_active = ? WHERE id = ?',
      [name, description, is_active !== undefined ? is_active : true, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Occupation not found' });
    }
    
    res.json({ message: 'Occupation updated successfully' });
  } catch (error) {
    console.error('Update occupation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Occupation with this name already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete occupation (Admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has admin permissions
    if (!await hasPermission(req.user.role, 'occupations', 'delete')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const [result] = await pool.execute(
      'UPDATE occupations SET is_active = FALSE WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Occupation not found' });
    }
    
    res.json({ message: 'Occupation deleted successfully' });
  } catch (error) {
    console.error('Delete occupation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
