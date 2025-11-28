const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const axios = require('axios');
const https = require('https');

const router = express.Router();

// Get all applicants with pagination and search
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      jamiat_id,
      jamaat_id 
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const offset = (pageNum - 1) * limitNum;
    let whereConditions = [];
    let queryParams = [];

    if (search && typeof search === 'string' && search.trim() !== '') {
      whereConditions.push('(a.full_name LIKE ? OR a.its_number LIKE ? OR a.phone LIKE ?)');
      const searchTerm = `%${search.trim()}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (jamiat_id && jamiat_id.toString().trim() !== '') {
      whereConditions.push('a.jamiat_id = ?');
      queryParams.push(parseInt(jamiat_id, 10));
    }

    if (jamaat_id && jamaat_id.toString().trim() !== '') {
      whereConditions.push('a.jamaat_id = ?');
      queryParams.push(parseInt(jamaat_id, 10));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count (use a copy of queryParams since we'll add LIMIT/OFFSET later)
    const countQuery = `SELECT COUNT(*) as total FROM applicants a ${whereClause}`;
    const [countResult] = await pool.execute(countQuery, [...queryParams]);
    const total = countResult[0].total;

    // Get applicants with pagination and join jamiat/jamaat information
    const applicantsQuery = `
      SELECT a.*, 
             j.name as jamiat_name,
             ja.name as jamaat_name
      FROM applicants a
      LEFT JOIN jamiat j ON a.jamiat_id = j.id
      LEFT JOIN jamaat ja ON a.jamaat_id = ja.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    // Ensure limitNum and offset are valid numbers
    if (isNaN(limitNum) || isNaN(offset) || limitNum < 1 || offset < 0) {
      throw new Error(`Invalid pagination parameters: limit=${limitNum}, offset=${offset}`);
    }
    
    // Use string interpolation for LIMIT/OFFSET since they're validated integers
    // This avoids the "Incorrect arguments to mysqld_stmt_execute" error
    const finalApplicantsQuery = applicantsQuery.replace('LIMIT ? OFFSET ?', `LIMIT ${parseInt(limitNum, 10)} OFFSET ${parseInt(offset, 10)}`);
    
    const [applicants] = await pool.execute(finalApplicantsQuery, queryParams);

    res.json({
      applicants,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get applicants error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single applicant by ID
router.get('/:applicantId', authenticateToken, async (req, res) => {
  try {
    const { applicantId } = req.params;

    const [applicants] = await pool.execute(
      'SELECT * FROM applicants WHERE id = ?',
      [applicantId]
    );

    if (applicants.length === 0) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    res.json({ applicant: applicants[0] });
  } catch (error) {
    console.error('Get applicant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new applicant
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const {
      its_number,
      first_name,
      last_name,
      age,
      gender,
      phone,
      email,
      photo,
      address,
      jamiat_name,
      jamaat_name,
      jamiat_id,
      jamaat_id
    } = req.body;

    // Look up internal IDs from database for foreign key constraints
    let jamiatInternalId = null;
    let jamaatInternalId = null;
    
    if (jamiat_id) {
      try {
        const [jamiatResult] = await pool.execute(
          'SELECT id FROM jamiat WHERE jamiat_id = ?',
          [jamiat_id]
        );
        jamiatInternalId = jamiatResult.length > 0 ? jamiatResult[0].id : null;
      } catch (dbError) {
        console.error('Error looking up jamiat internal ID:', dbError);
      }
    }
    
    if (jamaat_id) {
      try {
        let jamaatQuery = 'SELECT id FROM jamaat WHERE jamaat_id = ?';
        const jamaatParams = [jamaat_id];
        
        // If we have the internal jamiat_id, filter by it to ensure correct match
        // This prevents matching the wrong jamaat when the same external jamaat_id exists for multiple jamiat
        if (jamiatInternalId) {
          jamaatQuery += ' AND jamiat_id = ?';
          jamaatParams.push(jamiatInternalId);
        }
        
        const [jamaatResult] = await pool.execute(jamaatQuery, jamaatParams);
        jamaatInternalId = jamaatResult.length > 0 ? jamaatResult[0].id : null;
      } catch (dbError) {
        console.error('Error looking up jamaat internal ID:', dbError);
      }
    }

    // Validate required fields
    if (!its_number || !first_name || !last_name) {
      return res.status(400).json({ error: 'ITS number, first name, and last name are required' });
    }

    // Check if ITS number already exists
    const [existingApplicants] = await pool.execute(
      'SELECT id FROM applicants WHERE its_number = ?',
      [its_number]
    );

    if (existingApplicants.length > 0) {
      return res.status(409).json({ error: 'Applicant with this ITS number already exists' });
    }

    // Create applicant
    const [result] = await pool.execute(`
      INSERT INTO applicants (
        its_number, full_name, age, gender, 
        phone, email, photo, address, jamiat_name, jamaat_name, jamiat_id, jamaat_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      its_number, `${first_name} ${last_name}`.trim(), age, gender,
      phone, email, photo || null, address, jamiat_name, jamaat_name, jamiatInternalId, jamaatInternalId
    ]);

    res.status(201).json({
      message: 'Applicant created successfully',
      applicantId: result.insertId
    });
  } catch (error) {
    console.error('Create applicant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update applicant
router.put('/:applicantId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { applicantId } = req.params;
    const updateData = req.body;

    // Remove id and created_at from update data
    delete updateData.id;
    delete updateData.created_at;

    // Convert first_name and last_name to full_name if they exist
    if (updateData.first_name || updateData.last_name) {
      const firstName = updateData.first_name || '';
      const lastName = updateData.last_name || '';
      updateData.full_name = `${firstName} ${lastName}`.trim();
      delete updateData.first_name;
      delete updateData.last_name;
    }

    // Handle foreign key constraints for jamiat_id and jamaat_id
    let resolvedJamiatInternalId = null;
    if (updateData.jamiat_id) {
      try {
        const [jamiatResult] = await pool.execute(
          'SELECT id FROM jamiat WHERE jamiat_id = ?',
          [updateData.jamiat_id]
        );
        resolvedJamiatInternalId = jamiatResult.length > 0 ? jamiatResult[0].id : null;
        updateData.jamiat_id = resolvedJamiatInternalId;
      } catch (dbError) {
        console.error('Error looking up jamiat internal ID for update:', dbError);
        updateData.jamiat_id = null;
      }
    }
    
    if (updateData.jamaat_id) {
      try {
        let jamaatQuery = 'SELECT id FROM jamaat WHERE jamaat_id = ?';
        const jamaatParams = [updateData.jamaat_id];
        
        // If we have the internal jamiat_id, filter by it to ensure correct match
        // This prevents matching the wrong jamaat when the same external jamaat_id exists for multiple jamiat
        if (resolvedJamiatInternalId) {
          jamaatQuery += ' AND jamiat_id = ?';
          jamaatParams.push(resolvedJamiatInternalId);
        }
        
        const [jamaatResult] = await pool.execute(jamaatQuery, jamaatParams);
        updateData.jamaat_id = jamaatResult.length > 0 ? jamaatResult[0].id : null;
      } catch (dbError) {
        console.error('Error looking up jamaat internal ID for update:', dbError);
        updateData.jamaat_id = null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Check if ITS number is being changed and if it's already taken
    if (updateData.its_number) {
      const [existingApplicants] = await pool.execute(
        'SELECT id FROM applicants WHERE its_number = ? AND id != ?',
        [updateData.its_number, applicantId]
      );

      if (existingApplicants.length > 0) {
        return res.status(409).json({ error: 'ITS number already exists' });
      }
    }

    // Build update query
    const updateFields = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const updateValues = Object.values(updateData);
    updateValues.push(applicantId);

    const [result] = await pool.execute(
      `UPDATE applicants SET ${updateFields} WHERE id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    res.json({ message: 'Applicant updated successfully' });
  } catch (error) {
    console.error('Update applicant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete applicant (admin only)
router.delete('/:applicantId', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { applicantId } = req.params;

    // Check if applicant has any cases
    const [cases] = await pool.execute(
      'SELECT id FROM cases WHERE applicant_id = ?',
      [applicantId]
    );

    if (cases.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete applicant with existing cases. Please delete cases first.' 
      });
    }

    const [result] = await pool.execute(
      'DELETE FROM applicants WHERE id = ?',
      [applicantId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    res.json({ message: 'Applicant deleted successfully' });
  } catch (error) {
    console.error('Delete applicant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unique values for filters
router.get('/meta/unique-values', authenticateToken, async (req, res) => {
  try {
    const [mauzes] = await pool.execute('SELECT DISTINCT mauze FROM applicants WHERE mauze IS NOT NULL ORDER BY mauze');
    const [cities] = await pool.execute('SELECT DISTINCT city FROM applicants WHERE city IS NOT NULL ORDER BY city');
    const [states] = await pool.execute('SELECT DISTINCT state FROM applicants WHERE state IS NOT NULL ORDER BY state');

    res.json({
      mauzes: mauzes.map(row => row.mauze),
      cities: cities.map(row => row.city),
      states: states.map(row => row.state)
    });
  } catch (error) {
    console.error('Get unique values error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fetch applicant data from external API
router.get('/fetch-from-api/:itsNumber', async (req, res) => {
  try {
    const { itsNumber } = req.params;
    
    if (!itsNumber) {
      return res.status(400).json({ error: 'ITS number is required' });
    }

    // Call external API for user data
    const externalApiUrl = `https://counseling.dbohra.com/test/its-user/${itsNumber}`;
    
    try {
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
        return res.status(404).json({ error: 'No data found for this ITS number' });
      }

      const userData = apiData.data;
      
      // Fetch photo from image API
      let photoBase64 = null;
      try {
        const photoApiUrl = `http://13.127.158.101:3000/test/its-user-image/${itsNumber}`;
        console.log(`📸 Fetching photo from: ${photoApiUrl}`);
        
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
          
          console.log(`✅ Photo fetched successfully: ${(photoBase64.length / 1024).toFixed(2)} KB`);
        } else {
          console.log('⚠️ Photo API returned data but no image_data field');
        }
      } catch (photoError) {
        console.log(`❌ Photo fetch failed: ${photoError.message}`);
        // Continue without photo if photo API fails
      }
      
      // Get IDs from API
      const apiJamiatId = userData.Jamiaat_ID ? userData.Jamiaat_ID.toString() : null;
      const apiJamaatId = userData.Jamaat_ID ? userData.Jamaat_ID.toString() : null;
      
      // Look up names from our database using the API IDs
      let jamiatName = '';
      let jamaatName = '';
      
      if (apiJamiatId) {
        try {
          const [jamiatResult] = await pool.execute(
            'SELECT name FROM jamiat WHERE jamiat_id = ?',
            [apiJamiatId]
          );
          jamiatName = jamiatResult.length > 0 ? jamiatResult[0].name : userData.Jamiaat || '';
        } catch (dbError) {
          console.error('Error looking up jamiat name:', dbError);
          jamiatName = userData.Jamiaat || '';
        }
      }
      
      if (apiJamaatId) {
        try {
          const [jamaatResult] = await pool.execute(
            'SELECT name FROM jamaat WHERE jamaat_id = ?',
            [apiJamaatId]
          );
          jamaatName = jamaatResult.length > 0 ? jamaatResult[0].name : userData.Jamaat || '';
        } catch (dbError) {
          console.error('Error looking up jamaat name:', dbError);
          jamaatName = userData.Jamaat || '';
        }
      }

      // Map external API data to our internal format
      const mappedData = {
        its_number: itsNumber,
        full_name: userData.Fullname || '',
        age: userData.Age ? parseInt(userData.Age) : null,
        gender: userData.Gender === 'M' ? 'male' : userData.Gender === 'F' ? 'female' : 'other',
        phone: userData.Mobile || '',
        email: userData.Email || '',
        photo: photoBase64, // Use Base64 photo from image API
        address: userData.Address || '',
        jamiat_name: jamiatName,
        jamaat_name: jamaatName,
        jamiat_id: apiJamiatId,
        jamaat_id: apiJamaatId,
        country: userData.Country || '',
        city: userData.City || '',
        state: userData.State || '',
        occupation: userData.Occupation || '',
        qualification: userData.Qualification || '',
        idara: userData.Idara || ''
      };
      
      console.log(`📤 Sending response for ITS ${itsNumber}:`);
      console.log(`   Name: ${mappedData.full_name}`);
      console.log(`   Photo: ${photoBase64 ? `YES (${(photoBase64.length / 1024).toFixed(2)} KB)` : 'NO'}`);

      res.json({
        success: true,
        data: mappedData,
        raw_data: apiData // Include raw data for debugging
      });

    } catch (apiError) {
      console.error('External API error:', apiError.message);
      
      if (apiError.response) {
        // API responded with error status
        if (apiError.response.status === 404) {
          return res.status(404).json({ error: 'ITS number not found in external system' });
        } else if (apiError.response.status >= 500) {
          return res.status(503).json({ error: 'External API is currently unavailable' });
        } else {
          return res.status(400).json({ error: 'Invalid request to external API' });
        }
      } else if (apiError.code === 'ECONNABORTED') {
        return res.status(408).json({ error: 'Request to external API timed out' });
      } else {
        return res.status(503).json({ error: 'Unable to connect to external API' });
      }
    }

  } catch (error) {
    console.error('Fetch applicant data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
