const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRoles, authorizePermission } = require('../middleware/auth');
const multer = require('multer');
const xlsx = require('xlsx');

const router = express.Router();

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

// Get all jamiat - allow all authenticated users to read jamiat (needed for dropdowns)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [jamiat] = await pool.execute(`
      SELECT id, jamiat_id, name, is_active, created_at, updated_at
      FROM jamiat 
      WHERE is_active = 1
      ORDER BY jamiat_id
    `);
    
    res.json({ jamiat });
  } catch (error) {
    console.error('Get jamiat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single jamiat
router.get('/:id', authenticateToken, authorizePermission('master', 'read'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [jamiat] = await pool.execute(`
      SELECT id, jamiat_id, name, is_active, created_at, updated_at
      FROM jamiat 
      WHERE id = ?
    `, [id]);
    
    if (jamiat.length === 0) {
      return res.status(404).json({ error: 'Jamiat not found' });
    }
    
    res.json({ jamiat: jamiat[0] });
  } catch (error) {
    console.error('Get jamiat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create jamiat
router.post('/', authenticateToken, authorizePermission('master', 'create'), async (req, res) => {
  try {
    const { name, jamiat_id, is_active } = req.body;
    
    // Validate required fields
    if (!name || !jamiat_id) {
      return res.status(400).json({ error: 'Name and Jamiat ID are required' });
    }
    
    // Check if jamiat_id already exists
    const [existingJamiat] = await pool.execute(
      'SELECT id FROM jamiat WHERE jamiat_id = ?',
      [jamiat_id]
    );
    
    if (existingJamiat.length > 0) {
      return res.status(409).json({ error: 'Jamiat ID already exists' });
    }
    
    const [result] = await pool.execute(`
      INSERT INTO jamiat (name, jamiat_id, is_active, created_by)
      VALUES (?, ?, ?, ?)
    `, [name, jamiat_id, is_active !== false, req.user.id]);
    
    res.status(201).json({ 
      message: 'Jamiat created successfully',
      jamiat: {
        id: result.insertId,
        name,
        jamiat_id,
        is_active: is_active !== false
      }
    });
  } catch (error) {
    console.error('Create jamiat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update jamiat
router.put('/:id', authenticateToken, authorizePermission('master', 'update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, jamiat_id, is_active } = req.body;
    
    // Check if jamiat exists
    const [existingJamiat] = await pool.execute(
      'SELECT id FROM jamiat WHERE id = ?',
      [id]
    );
    
    if (existingJamiat.length === 0) {
      return res.status(404).json({ error: 'Jamiat not found' });
    }
    
    // Check if jamiat_id already exists (excluding current jamiat)
    if (jamiat_id) {
      const [idExists] = await pool.execute(
        'SELECT id FROM jamiat WHERE jamiat_id = ? AND id != ?',
        [jamiat_id, id]
      );
      
      if (idExists.length > 0) {
        return res.status(409).json({ error: 'Jamiat ID already exists' });
      }
    }
    
    const updateFields = [];
    const updateValues = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (jamiat_id !== undefined) {
      updateFields.push('jamiat_id = ?');
      updateValues.push(jamiat_id);
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
      `UPDATE jamiat SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    res.json({ message: 'Jamiat updated successfully' });
  } catch (error) {
    console.error('Update jamiat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete jamiat
router.delete('/:id', authenticateToken, authorizePermission('master', 'delete'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if jamiat exists
    const [existingJamiat] = await pool.execute(
      'SELECT id FROM jamiat WHERE id = ?',
      [id]
    );
    
    if (existingJamiat.length === 0) {
      return res.status(404).json({ error: 'Jamiat not found' });
    }
    
    // Delete jamiat (cascade will handle jamaat deletion)
    await pool.execute('DELETE FROM jamiat WHERE id = ?', [id]);
    
    res.json({ message: 'Jamiat and associated Jamaat deleted successfully' });
  } catch (error) {
    console.error('Delete jamiat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download sample Excel template
router.get('/template/download', authenticateToken, authorizePermission('master', 'read'), (req, res) => {
  try {
    // Create sample data for template
    const sampleData = [
      {
        'Jamiat ID': '1',
        'Jamiat': 'Mumbai',
        'Jamaat ID': '10',
        'Jamaat': 'BADRI MOHALLA (MUMBAI)'
      },
      {
        'Jamiat ID': '1',
        'Jamiat': 'Mumbai',
        'Jamaat ID': '11',
        'Jamaat': 'MUMBAI CENTRAL'
      },
      {
        'Jamiat ID': '2',
        'Jamiat': 'Delhi',
        'Jamaat ID': '20',
        'Jamaat': 'DELHI CENTRAL'
      },
      {
        'Jamiat ID': '2',
        'Jamiat': 'Delhi',
        'Jamaat ID': '21',
        'Jamaat': 'DELHI NORTH'
      }
    ];
    
    // Create workbook and worksheet
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(sampleData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Jamiat ID
      { wch: 20 }, // Jamiat
      { wch: 12 }, // Jamaat ID
      { wch: 30 }  // Jamaat
    ];
    
    xlsx.utils.book_append_sheet(wb, ws, 'Jamiat_Jamaat_Template');
    
    // Generate buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=jamiat_jamaat_template.xlsx');
    res.send(buffer);
  } catch (error) {
    console.error('Download template error:', error);
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

// Import Excel file
router.post('/import', authenticateToken, authorizePermission('master', 'create'), upload.single('file'), async (req, res) => {
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
    
    // Validate required columns
    const requiredColumns = ['Jamiat ID', 'Jamiat', 'Jamaat ID', 'Jamaat'];
    const firstRow = data[0];
    const missingColumns = requiredColumns.filter(col => !(col in firstRow));
    
    if (missingColumns.length > 0) {
      return res.status(400).json({ 
        error: `Missing required columns: ${missingColumns.join(', ')}` 
      });
    }
    
    let importedJamiat = 0;
    let importedJamaat = 0;
    const errors = [];
    
    // Process data in transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Group data by jamiat
      const jamiatMap = new Map();
      
      for (const row of data) {
        const jamiatId = row['Jamiat ID']?.toString().trim();
        const jamiatName = row['Jamiat']?.toString().trim();
        const jamaatId = row['Jamaat ID']?.toString().trim();
        const jamaatName = row['Jamaat']?.toString().trim();
        
        if (!jamiatId || !jamiatName || !jamaatId || !jamaatName) {
          errors.push(`Row ${data.indexOf(row) + 1}: Missing required data`);
          continue;
        }
        
        if (!jamiatMap.has(jamiatId)) {
          jamiatMap.set(jamiatId, {
            jamiat_id: jamiatId,
            name: jamiatName,
            jamaat: []
          });
        }
        
        jamiatMap.get(jamiatId).jamaat.push({
          jamaat_id: jamaatId,
          name: jamaatName
        });
      }
      
      // Insert jamiat
      for (const [jamiatId, jamiatData] of jamiatMap) {
        // Check if jamiat already exists
        const [existingJamiat] = await connection.execute(
          'SELECT id FROM jamiat WHERE jamiat_id = ?',
          [jamiatId]
        );
        
        let jamiatDbId;
        if (existingJamiat.length > 0) {
          jamiatDbId = existingJamiat[0].id;
        } else {
          const [result] = await connection.execute(
            'INSERT INTO jamiat (jamiat_id, name, is_active, created_by) VALUES (?, ?, ?, ?)',
            [jamiatId, jamiatData.name, true, req.user.id]
          );
          jamiatDbId = result.insertId;
          importedJamiat++;
        }
        
        // Insert jamaat
        for (const jamaatData of jamiatData.jamaat) {
          // Check if jamaat already exists
          const [existingJamaat] = await connection.execute(
            'SELECT id FROM jamaat WHERE jamiat_id = ? AND jamaat_id = ?',
            [jamiatDbId, jamaatData.jamaat_id]
          );
          
          if (existingJamaat.length === 0) {
            await connection.execute(
              'INSERT INTO jamaat (jamiat_id, jamaat_id, name, is_active, created_by) VALUES (?, ?, ?, ?, ?)',
              [jamiatDbId, jamaatData.jamaat_id, jamaatData.name, true, req.user.id]
            );
            importedJamaat++;
          }
        }
      }
      
      await connection.commit();
      
      res.json({
        message: 'Import completed successfully',
        importedJamiat,
        importedJamaat,
        errors: errors.length > 0 ? errors : undefined
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import data' });
  }
});

// Export to Excel
router.get('/export/excel', authenticateToken, authorizePermission('master', 'read'), async (req, res) => {
  try {
    // Get all jamiat with their jamaat
    const [jamiat] = await pool.execute(`
      SELECT j.id, j.jamiat_id, j.name as jamiat_name, j.is_active as jamiat_active,
             ja.jamaat_id, ja.name as jamaat_name, ja.is_active as jamaat_active
      FROM jamiat j
      LEFT JOIN jamaat ja ON j.id = ja.jamiat_id
      ORDER BY j.jamiat_id, ja.jamaat_id
    `);
    
    // Transform data for Excel
    const exportData = jamiat.map(row => ({
      'Jamiat ID': row.jamiat_id,
      'Jamiat': row.jamiat_name,
      'Jamaat ID': row.jamaat_id || '',
      'Jamaat': row.jamaat_name || ''
    }));
    
    // Create workbook and worksheet
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(exportData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 12 }, // Jamiat ID
      { wch: 20 }, // Jamiat
      { wch: 12 }, // Jamaat ID
      { wch: 30 }  // Jamaat
    ];
    
    xlsx.utils.book_append_sheet(wb, ws, 'Jamiat_Jamaat_Export');
    
    // Generate buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=jamiat_jamaat_export.xlsx');
    res.send(buffer);
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

module.exports = router;
