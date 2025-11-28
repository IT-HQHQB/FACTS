const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { hasPermission } = require('../utils/roleUtils');

const router = express.Router();

// Get all education levels
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [educationLevels] = await pool.execute(
      'SELECT * FROM education_levels WHERE is_active = TRUE ORDER BY name'
    );
    res.json(educationLevels);
  } catch (error) {
    console.error('Get education levels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get education level by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const [educationLevels] = await pool.execute(
      'SELECT * FROM education_levels WHERE id = ? AND is_active = TRUE',
      [id]
    );
    
    if (educationLevels.length === 0) {
      return res.status(404).json({ error: 'Education level not found' });
    }
    
    res.json(educationLevels[0]);
  } catch (error) {
    console.error('Get education level error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new education level (Admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;
    
    // Check if user has admin permissions
    if (!await hasPermission(req.user.role, 'education_levels', 'create')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO education_levels (name, description) VALUES (?, ?)',
      [name, description]
    );
    
    res.status(201).json({
      id: result.insertId,
      name,
      description,
      message: 'Education level created successfully'
    });
  } catch (error) {
    console.error('Create education level error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Education level with this name already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Update education level (Admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;
    
    // Check if user has admin permissions
    if (!await hasPermission(req.user.role, 'education_levels', 'update')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const [result] = await pool.execute(
      'UPDATE education_levels SET name = ?, description = ?, is_active = ? WHERE id = ?',
      [name, description, is_active !== undefined ? is_active : true, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Education level not found' });
    }
    
    res.json({ message: 'Education level updated successfully' });
  } catch (error) {
    console.error('Update education level error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Education level with this name already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete education level (Admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has admin permissions
    if (!await hasPermission(req.user.role, 'education_levels', 'delete')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const [result] = await pool.execute(
      'UPDATE education_levels SET is_active = FALSE WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Education level not found' });
    }
    
    res.json({ message: 'Education level deleted successfully' });
  } catch (error) {
    console.error('Delete education level error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
