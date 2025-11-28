const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get all jamaat or filter by jamiat_id - allow all authenticated users to read jamaat (needed for dropdowns)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { jamiat_id } = req.query;
    
    let query = `
      SELECT j.id, j.jamiat_id, j.jamaat_id, j.name, j.is_active, j.created_at, j.updated_at,
             ji.jamiat_id as parent_jamiat_id, ji.name as jamiat_name
      FROM jamaat j
      JOIN jamiat ji ON j.jamiat_id = ji.id
      WHERE j.is_active = 1
    `;
    
    const queryParams = [];
    
    if (jamiat_id) {
      query += ' AND j.jamiat_id = ?';
      queryParams.push(jamiat_id);
    }
    
    query += ' ORDER BY ji.jamiat_id, j.jamaat_id';
    
    const [jamaat] = await pool.execute(query, queryParams);
    
    res.json({ jamaat });
  } catch (error) {
    console.error('Get jamaat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get jamaat by jamiat
router.get('/by-jamiat/:jamiatId', authenticateToken, authorizeRoles('admin', 'dcm', 'Deputy Counseling Manager', 'ZI'), async (req, res) => {
  try {
    const { jamiatId } = req.params;
    
    const [jamaat] = await pool.execute(`
      SELECT id, jamaat_id, name, is_active
      FROM jamaat 
      WHERE jamiat_id = ? AND is_active = 1
      ORDER BY jamaat_id
    `, [jamiatId]);
    
    res.json({ jamaat });
  } catch (error) {
    console.error('Get jamaat by jamiat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single jamaat
router.get('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [jamaat] = await pool.execute(`
      SELECT j.id, j.jamiat_id, j.jamaat_id, j.name, j.is_active, j.created_at, j.updated_at,
             ji.jamiat_id as parent_jamiat_id, ji.name as jamiat_name
      FROM jamaat j
      JOIN jamiat ji ON j.jamiat_id = ji.id
      WHERE j.id = ?
    `, [id]);
    
    if (jamaat.length === 0) {
      return res.status(404).json({ error: 'Jamaat not found' });
    }
    
    res.json({ jamaat: jamaat[0] });
  } catch (error) {
    console.error('Get jamaat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create jamaat
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { jamiat_id, jamaat_id, name, is_active } = req.body;
    
    // Validate required fields
    if (!jamiat_id || !jamaat_id || !name) {
      return res.status(400).json({ error: 'Jamiat ID, Jamaat ID, and Name are required' });
    }
    
    // Check if jamiat exists
    const [jamiat] = await pool.execute(
      'SELECT id FROM jamiat WHERE id = ?',
      [jamiat_id]
    );
    
    if (jamiat.length === 0) {
      return res.status(404).json({ error: 'Jamiat not found' });
    }
    
    // Check if jamaat_id already exists for this jamiat
    const [existingJamaat] = await pool.execute(
      'SELECT id FROM jamaat WHERE jamiat_id = ? AND jamaat_id = ?',
      [jamiat_id, jamaat_id]
    );
    
    if (existingJamaat.length > 0) {
      return res.status(409).json({ error: 'Jamaat ID already exists for this Jamiat' });
    }
    
    const [result] = await pool.execute(`
      INSERT INTO jamaat (jamiat_id, jamaat_id, name, is_active, created_by)
      VALUES (?, ?, ?, ?, ?)
    `, [jamiat_id, jamaat_id, name, is_active !== false, req.user.id]);
    
    res.status(201).json({ 
      message: 'Jamaat created successfully',
      jamaat: {
        id: result.insertId,
        jamiat_id,
        jamaat_id,
        name,
        is_active: is_active !== false
      }
    });
  } catch (error) {
    console.error('Create jamaat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update jamaat
router.put('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { jamiat_id, jamaat_id, name, is_active } = req.body;
    
    // Check if jamaat exists
    const [existingJamaat] = await pool.execute(
      'SELECT id FROM jamaat WHERE id = ?',
      [id]
    );
    
    if (existingJamaat.length === 0) {
      return res.status(404).json({ error: 'Jamaat not found' });
    }
    
    // Check if jamiat exists (if jamiat_id is being updated)
    if (jamiat_id) {
      const [jamiat] = await pool.execute(
        'SELECT id FROM jamiat WHERE id = ?',
        [jamiat_id]
      );
      
      if (jamiat.length === 0) {
        return res.status(404).json({ error: 'Jamiat not found' });
      }
    }
    
    // Check if jamaat_id already exists (excluding current jamaat)
    if (jamaat_id) {
      const [idExists] = await pool.execute(
        'SELECT id FROM jamaat WHERE jamiat_id = ? AND jamaat_id = ? AND id != ?',
        [jamiat_id || existingJamaat[0].jamiat_id, jamaat_id, id]
      );
      
      if (idExists.length > 0) {
        return res.status(409).json({ error: 'Jamaat ID already exists for this Jamiat' });
      }
    }
    
    const updateFields = [];
    const updateValues = [];
    
    if (jamiat_id !== undefined) {
      updateFields.push('jamiat_id = ?');
      updateValues.push(jamiat_id);
    }
    if (jamaat_id !== undefined) {
      updateFields.push('jamaat_id = ?');
      updateValues.push(jamaat_id);
    }
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updateFields.push('updated_by = ?');
    updateValues.push(req.user.id);
    updateValues.push(id);
    
    await pool.execute(
      `UPDATE jamaat SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    res.json({ message: 'Jamaat updated successfully' });
  } catch (error) {
    console.error('Update jamaat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete jamaat
router.delete('/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if jamaat exists
    const [existingJamaat] = await pool.execute(
      'SELECT id FROM jamaat WHERE id = ?',
      [id]
    );
    
    if (existingJamaat.length === 0) {
      return res.status(404).json({ error: 'Jamaat not found' });
    }
    
    // Delete jamaat
    await pool.execute('DELETE FROM jamaat WHERE id = ?', [id]);
    
    res.json({ message: 'Jamaat deleted successfully' });
  } catch (error) {
    console.error('Delete jamaat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
