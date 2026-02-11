const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');
const { hasPermission } = require('../utils/roleUtils');

const router = express.Router();

// Get all relations - open to all authenticated users (used in dropdowns)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [relations] = await pool.execute(
      'SELECT * FROM relations WHERE is_active = TRUE ORDER BY name'
    );
    res.json(relations);
  } catch (error) {
    console.error('Get relations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get relation by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [relations] = await pool.execute(
      'SELECT * FROM relations WHERE id = ? AND is_active = TRUE',
      [id]
    );
    
    if (relations.length === 0) {
      return res.status(404).json({ error: 'Relation not found' });
    }
    
    res.json(relations[0]);
  } catch (error) {
    console.error('Get relation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new relation (Admin only)
router.post('/', authenticateToken, authorizePermission('master', 'create'), async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Check if user has admin permissions
    if (!await hasPermission(req.user.role, 'relations', 'create')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO relations (name, description) VALUES (?, ?)',
      [name, description]
    );
    
    res.status(201).json({
      id: result.insertId,
      name,
      description,
      message: 'Relation created successfully'
    });
  } catch (error) {
    console.error('Create relation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Relation with this name already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Update relation (Admin only)
router.put('/:id', authenticateToken, authorizePermission('master', 'update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;
    
    // Check if user has admin permissions
    if (!await hasPermission(req.user.role, 'relations', 'update')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const [result] = await pool.execute(
      'UPDATE relations SET name = ?, description = ?, is_active = ? WHERE id = ?',
      [name, description, is_active !== undefined ? is_active : true, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Relation not found' });
    }
    
    res.json({ message: 'Relation updated successfully' });
  } catch (error) {
    console.error('Update relation error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Relation with this name already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete relation (Admin only)
router.delete('/:id', authenticateToken, authorizePermission('master', 'delete'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has admin permissions
    if (!await hasPermission(req.user.role, 'relations', 'delete')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const [result] = await pool.execute(
      'UPDATE relations SET is_active = FALSE WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Relation not found' });
    }
    
    res.json({ message: 'Relation deleted successfully' });
  } catch (error) {
    console.error('Delete relation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
