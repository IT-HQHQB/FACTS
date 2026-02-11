const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');

const router = express.Router();

// Get all executive levels
router.get('/', authenticateToken, authorizePermission('master', 'read'), async (req, res) => {
  try {
    const [levels] = await pool.execute(`
      SELECT 
        el.*,
        COUNT(DISTINCT u.id) as assigned_users_count,
        COUNT(DISTINCT c.id) as active_cases_count
      FROM executive_levels el
      LEFT JOIN users u ON u.executive_level = el.level_number
      LEFT JOIN cases c ON c.current_executive_level = el.level_number AND c.status = 'submitted_to_executive'
      GROUP BY el.id
      ORDER BY el.sort_order
    `);

    res.json({ levels });
  } catch (error) {
    console.error('Get executive levels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get executive level by ID
router.get('/:id', authenticateToken, authorizePermission('master', 'read'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [levels] = await pool.execute(
      'SELECT * FROM executive_levels WHERE id = ?',
      [id]
    );

    if (levels.length === 0) {
      return res.status(404).json({ error: 'Executive level not found' });
    }

    res.json({ level: levels[0] });
  } catch (error) {
    console.error('Get executive level error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new executive level
router.post('/', authenticateToken, authorizePermission('master', 'create'), async (req, res) => {
  try {
    const { level_number, level_name, description, sort_order } = req.body;
    
    // Validate required fields
    if (!level_number || !level_name || !sort_order) {
      return res.status(400).json({ error: 'Level number, name, and sort order are required' });
    }
    
    // Check if level number already exists
    const [existing] = await pool.execute(
      'SELECT id FROM executive_levels WHERE level_number = ?',
      [level_number]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Executive level number already exists' });
    }
    
    // Create executive level
    const [result] = await pool.execute(
      'INSERT INTO executive_levels (level_number, level_name, description, sort_order) VALUES (?, ?, ?, ?)',
      [level_number, level_name, description, sort_order]
    );
    
    const levelId = result.insertId;
    
    res.status(201).json({ 
      message: 'Executive level created successfully',
      level: { id: levelId, level_number, level_name, description, sort_order }
    });
  } catch (error) {
    console.error('Create executive level error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update executive level
router.put('/:id', authenticateToken, authorizePermission('master', 'update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { level_number, level_name, description, sort_order, is_active } = req.body;
    
    // Check if executive level exists
    const [existing] = await pool.execute(
      'SELECT * FROM executive_levels WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Executive level not found' });
    }
    
    // Check if new level number conflicts with existing (if changed)
    if (level_number && level_number !== existing[0].level_number) {
      const [conflict] = await pool.execute(
        'SELECT id FROM executive_levels WHERE level_number = ? AND id != ?',
        [level_number, id]
      );
      
      if (conflict.length > 0) {
        return res.status(400).json({ error: 'Executive level number already exists' });
      }
    }
    
    // Update executive level
    await pool.execute(
      'UPDATE executive_levels SET level_number = ?, level_name = ?, description = ?, sort_order = ?, is_active = ? WHERE id = ?',
      [level_number, level_name, description, sort_order, is_active, id]
    );
    
    res.json({ 
      message: 'Executive level updated successfully',
      level: { id, level_number, level_name, description, sort_order, is_active }
    });
  } catch (error) {
    console.error('Update executive level error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete executive level
router.delete('/:id', authenticateToken, authorizePermission('master', 'delete'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if executive level exists
    const [existing] = await pool.execute(
      'SELECT * FROM executive_levels WHERE id = ?',
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Executive level not found' });
    }
    
    const levelNumber = existing[0].level_number;
    
    // Check if there are users assigned to this level
    const [assignedUsers] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE executive_level = ? AND is_active = TRUE',
      [levelNumber]
    );
    
    if (assignedUsers[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete executive level with assigned users. Please reassign users first.' 
      });
    }
    
    // Check if there are active cases at this level
    const [activeCases] = await pool.execute(
      'SELECT COUNT(*) as count FROM cases WHERE current_executive_level = ? AND status = "submitted_to_executive"',
      [levelNumber]
    );
    
    if (activeCases[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete executive level with active cases. Please process or reassign cases first.' 
      });
    }
    
    // Delete executive level
    await pool.execute(
      'DELETE FROM executive_levels WHERE id = ?',
      [id]
    );
    
    res.json({ message: 'Executive level deleted successfully' });
  } catch (error) {
    console.error('Delete executive level error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reorder executive levels
router.put('/reorder', authenticateToken, authorizePermission('master', 'update'), async (req, res) => {
  try {
    const { levels } = req.body; // Array of { id, sort_order }
    
    if (!Array.isArray(levels)) {
      return res.status(400).json({ error: 'Levels array is required' });
    }
    
    await pool.execute('START TRANSACTION');
    
    try {
      for (const level of levels) {
        await pool.execute(
          'UPDATE executive_levels SET sort_order = ? WHERE id = ?',
          [level.sort_order, level.id]
        );
      }
      
      await pool.execute('COMMIT');
      
      res.json({ message: 'Executive levels reordered successfully' });
    } catch (error) {
      await pool.execute('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Reorder executive levels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active executive levels (for workflow logic)
router.get('/active/list', authenticateToken, async (req, res) => {
  try {
    const [levels] = await pool.execute(`
      SELECT level_number, level_name, sort_order 
      FROM executive_levels 
      WHERE is_active = TRUE 
      ORDER BY sort_order
    `);

    res.json({ levels });
  } catch (error) {
    console.error('Get active executive levels error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
