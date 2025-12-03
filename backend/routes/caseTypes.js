const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRoles, authorizePermission } = require('../middleware/auth');

const router = express.Router();

// Get all case types
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [caseTypes] = await pool.execute(`
      SELECT * FROM case_types 
      WHERE is_active = TRUE 
      ORDER BY sort_order ASC, name ASC
    `);

    res.json({ caseTypes });
  } catch (error) {
    console.error('Get case types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single case type by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [caseTypes] = await pool.execute(
      'SELECT * FROM case_types WHERE id = ?',
      [id]
    );

    if (caseTypes.length === 0) {
      return res.status(404).json({ error: 'Case type not found' });
    }

    res.json({ caseType: caseTypes[0] });
  } catch (error) {
    console.error('Get case type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new case type (admin only)
router.post('/', authenticateToken, authorizePermission('cases', 'create'), async (req, res) => {
  try {
    const { name, description, sort_order } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const [result] = await pool.execute(
      'INSERT INTO case_types (name, description, sort_order) VALUES (?, ?, ?)',
      [name, description || null, sort_order || 0]
    );

    res.status(201).json({
      message: 'Case type created successfully',
      caseTypeId: result.insertId
    });
  } catch (error) {
    console.error('Create case type error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Case type with this name already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Update case type (admin only)
router.put('/:id', authenticateToken, authorizePermission('cases', 'update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sort_order, is_active } = req.body;

    const [result] = await pool.execute(
      'UPDATE case_types SET name = ?, description = ?, sort_order = ?, is_active = ? WHERE id = ?',
      [name, description || null, sort_order || 0, is_active !== undefined ? is_active : true, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Case type not found' });
    }

    res.json({ message: 'Case type updated successfully' });
  } catch (error) {
    console.error('Update case type error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Case type with this name already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete case type (admin only)
router.delete('/:id', authenticateToken, authorizePermission('cases', 'delete'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if case type is being used by any cases
    const [cases] = await pool.execute(
      'SELECT COUNT(*) as count FROM cases WHERE case_type_id = ?',
      [id]
    );

    if (cases[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete case type that is being used by existing cases' 
      });
    }

    const [result] = await pool.execute(
      'DELETE FROM case_types WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Case type not found' });
    }

    res.json({ message: 'Case type deleted successfully' });
  } catch (error) {
    console.error('Delete case type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
