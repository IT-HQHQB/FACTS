const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRoles, authorizePermission } = require('../middleware/auth');
const axios = require('axios');
const https = require('https');
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

// Rate limiting tracker for API calls (20 per 3 minutes)
let apiCallTimestamps = [];

// Helper function to check and enforce rate limit
async function enforceRateLimit() {
  const now = Date.now();
  const threeMinutesAgo = now - (3 * 60 * 1000);
  
  // Remove timestamps older than 3 minutes
  apiCallTimestamps = apiCallTimestamps.filter(timestamp => timestamp > threeMinutesAgo);
  
  // If we have 20 or more calls in the last 3 minutes, wait
  if (apiCallTimestamps.length >= 20) {
    const oldestCall = Math.min(...apiCallTimestamps);
    const waitTime = (oldestCall + (3 * 60 * 1000)) - now + 1000; // Add 1 second buffer
    if (waitTime > 0) {
      console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // Record this API call
  apiCallTimestamps.push(Date.now());
}

// Helper function to fetch applicant data from external API
async function fetchApplicantDataFromAPI(itsNumber) {
  try {
    // Enforce rate limit before making API call
    await enforceRateLimit();
    
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
    
    // Get IDs from API
    const apiJamiatId = userData.Jamiaat_ID ? userData.Jamiaat_ID.toString() : null;
    const apiJamaatId = userData.Jamaat_ID ? userData.Jamaat_ID.toString() : null;
    
    // Look up names from our database using the API IDs
    let jamiatName = '';
    let jamaatName = '';
    let jamiatInternalId = null;
    let jamaatInternalId = null;
    
    if (apiJamiatId) {
      try {
        const [jamiatResult] = await pool.execute(
          'SELECT id, name FROM jamiat WHERE jamiat_id = ?',
          [apiJamiatId]
        );
        if (jamiatResult.length > 0) {
          jamiatName = jamiatResult[0].name;
          jamiatInternalId = jamiatResult[0].id;
        } else {
          jamiatName = userData.Jamiaat || '';
        }
      } catch (dbError) {
        console.error('Error looking up jamiat name:', dbError);
        jamiatName = userData.Jamiaat || '';
      }
    }
    
    if (apiJamaatId) {
      try {
        let jamaatQuery = 'SELECT id, name FROM jamaat WHERE jamaat_id = ?';
        const jamaatParams = [apiJamaatId];
        
        if (jamiatInternalId) {
          jamaatQuery += ' AND jamiat_id = ?';
          jamaatParams.push(jamiatInternalId);
        }
        
        const [jamaatResult] = await pool.execute(jamaatQuery, jamaatParams);
        if (jamaatResult.length > 0) {
          jamaatName = jamaatResult[0].name;
          jamaatInternalId = jamaatResult[0].id;
        } else {
          jamaatName = userData.Jamaat || '';
        }
      } catch (dbError) {
        console.error('Error looking up jamaat name:', dbError);
        jamaatName = userData.Jamaat || '';
      }
    }

    // Map gender value - ensure it matches database ENUM ('male', 'female', 'other')
    let genderValue = null;
    if (userData.Gender) {
      const genderUpper = String(userData.Gender).toUpperCase().trim();
      if (genderUpper === 'M' || genderUpper === 'MALE') {
        genderValue = 'male';
      } else if (genderUpper === 'F' || genderUpper === 'FEMALE') {
        genderValue = 'female';
      } else {
        genderValue = 'other'; // Default to 'other' for any other value
      }
    }

    // Map external API data to our internal format
    const mappedData = {
      its_number: itsNumber,
      full_name: userData.Fullname || '',
      age: userData.Age ? parseInt(userData.Age) : null,
      gender: genderValue,
      phone: userData.Mobile || '',
      email: userData.Email || '',
      photo: photoBase64,
      address: userData.Address || '',
      jamiat_name: jamiatName,
      jamaat_name: jamaatName,
      jamiat_id: apiJamiatId,
      jamaat_id: apiJamaatId,
      jamiat_internal_id: jamiatInternalId,
      jamaat_internal_id: jamaatInternalId,
      country: userData.Country || '',
      city: userData.City || '',
      state: userData.State || '',
      occupation: userData.Occupation || '',
      qualification: userData.Qualification || '',
      idara: userData.Idara || ''
    };
    
    return { success: true, data: mappedData };
  } catch (error) {
    console.error(`Error fetching data for ITS ${itsNumber}:`, error.message);
    return { 
      success: false, 
      error: error.response?.status === 404 ? 'ITS number not found' : error.message 
    };
  }
}

// Get all applicants with pagination and search
router.get('/', authenticateToken, authorizePermission('applicants', 'read'), async (req, res) => {
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
    // Use COALESCE to prefer stored values from applicants table, falling back to JOIN values
    const applicantsQuery = `
      SELECT a.*, 
             COALESCE(NULLIF(a.jamiat_name, ''), j.name) as jamiat_name,
             COALESCE(NULLIF(a.jamaat_name, ''), ja.name) as jamaat_name
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
router.get('/:applicantId', authenticateToken, authorizePermission('applicants', 'read'), async (req, res) => {
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

// Lookup ITS number for mentor - fetches from external API
router.get('/lookup/:itsNumber', authenticateToken, async (req, res) => {
  try {
    const { itsNumber } = req.params;
    
    // Validate ITS number format (8 digits)
    if (!itsNumber || !/^\d{8}$/.test(itsNumber)) {
      return res.status(400).json({ error: 'Invalid ITS number. Must be 8 digits.' });
    }
    
    // First check if applicant exists in our database
    const [existingApplicant] = await pool.execute(
      'SELECT its_number, full_name, phone, email, photo FROM applicants WHERE its_number = ?',
      [itsNumber]
    );
    
    if (existingApplicant.length > 0) {
      // Return data from our database
      const applicant = existingApplicant[0];
      return res.json({
        success: true,
        source: 'database',
        data: {
          its_number: applicant.its_number,
          name: applicant.full_name || '',
          contact_number: applicant.phone || '',
          email: applicant.email || '',
          photo: applicant.photo || null
        }
      });
    }
    
    // If not in database, fetch from external API
    const result = await fetchApplicantDataFromAPI(itsNumber);
    
    if (!result.success) {
      return res.status(404).json({ error: result.error || 'ITS number not found' });
    }
    
    // Return the fetched data
    return res.json({
      success: true,
      source: 'api',
      data: {
        its_number: result.data.its_number,
        name: result.data.full_name || '',
        contact_number: result.data.phone || '',
        email: result.data.email || '',
        photo: result.data.photo || null
      }
    });
  } catch (error) {
    console.error('Lookup ITS error:', error);
    res.status(500).json({ error: 'Failed to lookup ITS number' });
  }
});

// Create new applicant
router.post('/', authenticateToken, authorizePermission('applicants', 'create'), async (req, res) => {
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

    const applicantId = result.insertId;

    // If case_data is provided, create case automatically
    let caseId = null;
    let caseNumber = null;
    if (req.body.case_data) {
      const caseData = req.body.case_data;
      const { case_type_id, description, notes, status_id, roles, assigned_counselor_id, assigned_role, workflow_stage_id } = caseData;

      if (case_type_id) {
        try {
          // Check if user has permission to create cases
          const { hasPermission } = require('../utils/permissionUtils');
          const canCreateCase = await hasPermission(req.user.role, 'cases', 'create');
          
          if (!canCreateCase) {
            console.log(`[Create Applicant] User ${req.user.id} (${req.user.role}) does not have cases:create permission, skipping case creation`);
          } else {
            // Get the first workflow stage (draft stage) if not provided
            let stageId = workflow_stage_id;
            if (!stageId) {
              const [firstStage] = await pool.execute(
                'SELECT id FROM workflow_stages WHERE is_active = TRUE ORDER BY sort_order ASC LIMIT 1'
              );
              if (firstStage.length > 0) {
                stageId = firstStage[0].id;
              }
            }

            // Get case type name for case number generation
            const [caseTypeResult] = await pool.execute(
              'SELECT name FROM case_types WHERE id = ?',
              [case_type_id]
            );

            if (caseTypeResult.length > 0) {
              const caseTypeName = caseTypeResult[0].name;

              // Generate a temporary unique case number
              const tempCaseNumber = `${caseTypeName.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

              // Get default status if not provided
              let finalStatusId = status_id;
              if (!finalStatusId) {
                const [defaultStatus] = await pool.execute(
                  'SELECT id FROM statuses WHERE name = ?',
                  ['draft']
                );
                finalStatusId = defaultStatus[0]?.id;
              }

              // Create case
              const [caseResult] = await pool.execute(`
                INSERT INTO cases (case_number, applicant_id, case_type_id, status_id, roles, assigned_counselor_id, 
                                  jamiat_id, jamaat_id, assigned_role, description, notes, created_by, current_workflow_stage_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [tempCaseNumber, applicantId, case_type_id, finalStatusId, roles, assigned_counselor_id, 
                  jamiatInternalId, jamaatInternalId, assigned_role, description, notes, req.user.id, stageId]);

              caseId = caseResult.insertId;

              // Update case_number to sequential BS-0001 style
              caseNumber = `BS-${String(caseId).padStart(4, '0')}`;
              await pool.execute(
                'UPDATE cases SET case_number = ? WHERE id = ?',
                [caseNumber, caseId]
              );

              // Initialize workflow history
              const workflowHistory = [{
                stage_id: stageId,
                stage_name: 'Draft Stage',
                entered_at: new Date().toISOString(),
                entered_by: req.user.id,
                entered_by_name: req.user.full_name || req.user.username,
                action: 'case_created'
              }];

              await pool.execute(`
                UPDATE cases SET workflow_history = ? WHERE id = ?
              `, [JSON.stringify(workflowHistory), caseId]);

              console.log(`[Create Applicant] Auto-created case with ID: ${caseId}, Number: ${caseNumber}`);
            }
          }
        } catch (caseError) {
          console.error('Error creating case from applicant endpoint:', caseError);
          // Don't fail the applicant creation if case creation fails
        }
      }
    }

    const response = {
      message: 'Applicant created successfully',
      applicantId: applicantId
    };

    if (caseId) {
      response.caseId = caseId;
      response.caseNumber = caseNumber;
      response.message = 'Applicant and case created successfully';
    }

    res.status(201).json(response);
  } catch (error) {
    console.error('Create applicant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update applicant
router.put('/:applicantId', authenticateToken, authorizePermission('applicants', 'update'), async (req, res) => {
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

    // Track if jamiat_id or jamaat_id are being updated
    const jamiatIdBeingUpdated = 'jamiat_id' in updateData;
    const jamaatIdBeingUpdated = 'jamaat_id' in updateData;

    // Handle foreign key constraints for jamiat_id and jamaat_id
    let resolvedJamiatInternalId = null;
    let resolvedJamaatInternalId = null;
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
        resolvedJamaatInternalId = jamaatResult.length > 0 ? jamaatResult[0].id : null;
        updateData.jamaat_id = resolvedJamaatInternalId;
      } catch (dbError) {
        console.error('Error looking up jamaat internal ID for update:', dbError);
        updateData.jamaat_id = null;
      }
    }

    // Remove refresh_from_api flag (not a database field)
    const refreshFromApi = updateData.refresh_from_api;
    delete updateData.refresh_from_api;

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

    // Update associated cases if jamiat_id or jamaat_id were updated
    // This is especially important when data was refreshed from API, but also update in general
    if ((jamiatIdBeingUpdated || jamaatIdBeingUpdated) && (resolvedJamiatInternalId !== null || resolvedJamaatInternalId !== null)) {
      try {
        // Find all cases associated with this applicant
        const [cases] = await pool.execute(
          'SELECT id FROM cases WHERE applicant_id = ?',
          [applicantId]
        );

        // Update each case with new jamiat/jamaat IDs
        for (const caseRecord of cases) {
          // Only update if we have new values (don't set to null if we don't have them)
          const updateCaseParams = [];
          const updateCaseFields = [];
          
          if (resolvedJamiatInternalId !== null) {
            updateCaseFields.push('jamiat_id = ?');
            updateCaseParams.push(resolvedJamiatInternalId);
          }
          
          if (resolvedJamaatInternalId !== null) {
            updateCaseFields.push('jamaat_id = ?');
            updateCaseParams.push(resolvedJamaatInternalId);
          }
          
          if (updateCaseFields.length > 0) {
            updateCaseParams.push(caseRecord.id);
            await pool.execute(
              `UPDATE cases SET ${updateCaseFields.join(', ')} WHERE id = ?`,
              updateCaseParams
            );
            console.log(`✅ Updated case ${caseRecord.id} with new jamiat/jamaat for applicant ${applicantId}`);
          }
        }
      } catch (caseUpdateError) {
        console.error('Error updating associated cases:', caseUpdateError);
        // Don't fail the request if case update fails, just log the error
      }
    }

    res.json({ message: 'Applicant updated successfully' });
  } catch (error) {
    console.error('Update applicant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete applicant
router.delete('/:applicantId', authenticateToken, authorizePermission('applicants', 'delete'), async (req, res) => {
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

// Get pending applicants count (applicants that need API data fetch)
router.get('/meta/pending-count', authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM applicants
      WHERE (full_name IS NULL OR phone IS NULL OR email IS NULL)
        AND (email IS NULL OR (email != 'NOT_FOUND_IN_API' AND email != 'DATA_ERROR_SKIP'))
    `);
    
    res.json({ pendingCount: result[0].count });
  } catch (error) {
    console.error('Get pending count error:', error);
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

// Bulk import ITS numbers
router.post('/bulk-import', authenticateToken, authorizePermission('applicants', 'create'), async (req, res) => {
  try {
    const { its_numbers, case_type_id } = req.body;
    
    if (!its_numbers || !Array.isArray(its_numbers) || its_numbers.length === 0) {
      return res.status(400).json({ error: 'ITS numbers array is required' });
    }

    // Get default case type if not provided
    let finalCaseTypeId = case_type_id;
    if (!finalCaseTypeId) {
      const [caseTypes] = await pool.execute(
        'SELECT id FROM case_types WHERE is_active = TRUE ORDER BY id ASC LIMIT 1'
      );
      if (caseTypes.length === 0) {
        return res.status(400).json({ error: 'No active case type found. Please provide case_type_id.' });
      }
      finalCaseTypeId = caseTypes[0].id;
    }

    // Get default status
    const [defaultStatus] = await pool.execute(
      'SELECT id FROM statuses WHERE name = ?',
      ['draft']
    );
    const defaultStatusId = defaultStatus[0]?.id;

    // Get first workflow stage
    const [firstStage] = await pool.execute(
      'SELECT id FROM workflow_stages WHERE is_active = TRUE ORDER BY sort_order ASC LIMIT 1'
    );
    const stageId = firstStage[0]?.id;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    try {
      for (const itsNumber of its_numbers) {
        if (!itsNumber || typeof itsNumber !== 'string' || itsNumber.trim() === '') {
          skipped++;
          errors.push({ its_number: itsNumber, error: 'Invalid ITS number' });
          continue;
        }

        const trimmedItsNumber = itsNumber.trim();

        // Check if ITS number already exists
        const [existing] = await connection.execute(
          'SELECT id FROM applicants WHERE its_number = ?',
          [trimmedItsNumber]
        );

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        try {
          // Insert applicant with only ITS number
          const [applicantResult] = await connection.execute(`
            INSERT INTO applicants (its_number, full_name, age, gender, phone, email, photo, address, jamiat_name, jamaat_name, jamiat_id, jamaat_id)
            VALUES (?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
          `, [trimmedItsNumber]);

          const applicantId = applicantResult.insertId;

          // Create case for this applicant
          const tempCaseNumber = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          
          const [caseResult] = await connection.execute(`
            INSERT INTO cases (case_number, applicant_id, case_type_id, status_id, created_by, current_workflow_stage_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [tempCaseNumber, applicantId, finalCaseTypeId, defaultStatusId, req.user.id, stageId]);

          const caseId = caseResult.insertId;

          // Update case_number to sequential BS-XXXX format
          const formattedCaseNumber = `BS-${String(caseId).padStart(4, '0')}`;
          await connection.execute(
            'UPDATE cases SET case_number = ? WHERE id = ?',
            [formattedCaseNumber, caseId]
          );

          // Initialize workflow history
          const workflowHistory = [{
            stage_id: stageId,
            stage_name: 'Draft Stage',
            entered_at: new Date().toISOString(),
            entered_by: req.user.id,
            entered_by_name: req.user.full_name || req.user.username,
            action: 'case_created'
          }];

          await connection.execute(
            'UPDATE cases SET workflow_history = ? WHERE id = ?',
            [JSON.stringify(workflowHistory), caseId]
          );

          inserted++;
        } catch (insertError) {
          skipped++;
          errors.push({ its_number: trimmedItsNumber, error: insertError.message });
        }
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Bulk import completed',
        summary: {
          total: its_numbers.length,
          inserted,
          skipped,
          errors: errors.length > 0 ? errors : undefined
        }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Bulk fetch applicant details from API
router.post('/bulk-fetch', authenticateToken, authorizePermission('applicants', 'update'), async (req, res) => {
  try {
    const limit = 30; // Fetch up to 30 applicants at a time

    // Find applicants that need data fetching (where full_name, phone, or email is NULL)
    // Exclude applicants that were already marked as "NOT_FOUND_IN_API" or "DATA_ERROR_SKIP"
    // Use string interpolation for LIMIT to avoid parameter binding issues
    const [pendingApplicants] = await pool.execute(`
      SELECT a.id, a.its_number, c.id as case_id
      FROM applicants a
      LEFT JOIN cases c ON a.id = c.applicant_id
      WHERE (a.full_name IS NULL OR a.phone IS NULL OR a.email IS NULL)
        AND (a.email IS NULL OR (a.email != 'NOT_FOUND_IN_API' AND a.email != 'DATA_ERROR_SKIP'))
      ORDER BY a.created_at ASC
      LIMIT ${parseInt(limit, 10)}
    `);

    if (pendingApplicants.length === 0) {
      return res.json({
        success: true,
        message: 'No pending applicants to fetch',
        summary: {
          total: 0,
          fetched: 0,
          failed: 0,
          skipped: 0
        }
      });
    }

    let fetched = 0;
    let failed = 0;
    let notFound = 0;
    const errors = [];

    // Process each applicant
    for (const applicant of pendingApplicants) {
      try {
        const result = await fetchApplicantDataFromAPI(applicant.its_number);
        
        if (!result.success) {
          // If ITS number is not found in API, mark it so we don't try again
          if (result.error === 'ITS number not found' || result.error.includes('not found')) {
            // Mark this applicant as "not found" by setting email to a special marker
            await pool.execute(
              'UPDATE applicants SET email = ? WHERE id = ?',
              ['NOT_FOUND_IN_API', applicant.id]
            );
            notFound++;
            console.log(`⚠️ ITS ${applicant.its_number} not found in API - marked to skip future fetches`);
            continue;
          }
          
          // For other errors, just log and continue
          failed++;
          errors.push({ its_number: applicant.its_number, error: result.error });
          continue;
        }

        const apiData = result.data;
        
        // Look up internal IDs for jamiat and jamaat
        let jamiatInternalId = apiData.jamiat_internal_id;
        let jamaatInternalId = apiData.jamaat_internal_id;

        if (!jamiatInternalId && apiData.jamiat_id) {
          const [jamiatResult] = await pool.execute(
            'SELECT id FROM jamiat WHERE jamiat_id = ?',
            [apiData.jamiat_id]
          );
          jamiatInternalId = jamiatResult.length > 0 ? jamiatResult[0].id : null;
        }

        if (!jamaatInternalId && apiData.jamaat_id) {
          let jamaatQuery = 'SELECT id FROM jamaat WHERE jamaat_id = ?';
          const jamaatParams = [apiData.jamaat_id];
          
          if (jamiatInternalId) {
            jamaatQuery += ' AND jamiat_id = ?';
            jamaatParams.push(jamiatInternalId);
          }
          
          const [jamaatResult] = await pool.execute(jamaatQuery, jamaatParams);
          jamaatInternalId = jamaatResult.length > 0 ? jamaatResult[0].id : null;
        }

        // Update applicant with fetched data
        // Only update columns that are confirmed to exist (matching INSERT statement columns)
        // Ensure all values are properly converted to null if undefined
        const updateParams = [
          apiData.full_name || null,
          apiData.age || null,
          apiData.gender || null,
          apiData.phone || null,
          apiData.email || null,
          apiData.photo || null,
          apiData.address || null,
          apiData.jamiat_name || null,
          apiData.jamaat_name || null,
          (jamiatInternalId !== undefined && jamiatInternalId !== null) ? jamiatInternalId : null,
          (jamaatInternalId !== undefined && jamaatInternalId !== null) ? jamaatInternalId : null,
          applicant.id
        ];
        
        // Verify parameter count matches placeholders (12 placeholders, 12 parameters)
        if (updateParams.length !== 12) {
          throw new Error(`Parameter count mismatch: expected 12, got ${updateParams.length}`);
        }
        
        await pool.execute(`
          UPDATE applicants SET
            full_name = ?,
            age = ?,
            gender = ?,
            phone = ?,
            email = ?,
            photo = ?,
            address = ?,
            jamiat_name = ?,
            jamaat_name = ?,
            jamiat_id = ?,
            jamaat_id = ?
          WHERE id = ?
        `, updateParams);

        // Update case with jamiat/jamaat if case exists
        if (applicant.case_id && (jamiatInternalId || jamaatInternalId)) {
          await pool.execute(
            'UPDATE cases SET jamiat_id = ?, jamaat_id = ? WHERE id = ?',
            [jamiatInternalId, jamaatInternalId, applicant.case_id]
          );
        }

        fetched++;
        console.log(`✅ Fetched data for ITS ${applicant.its_number} (${fetched}/${pendingApplicants.length})`);
      } catch (error) {
        failed++;
        errors.push({ its_number: applicant.its_number, error: error.message });
        console.error(`❌ Failed to fetch data for ITS ${applicant.its_number}:`, error.message);
        
        // Mark records that fail due to data validation errors so they don't get retried
        // This includes errors like "Data truncated for column", "Invalid value", etc.
        if (error.message.includes('Data truncated') || 
            error.message.includes('Invalid value') || 
            error.message.includes('Incorrect') ||
            error.message.includes('column')) {
          // Mark this applicant to skip future fetches due to data validation error
          try {
            await pool.execute(
              'UPDATE applicants SET email = ? WHERE id = ?',
              ['DATA_ERROR_SKIP', applicant.id]
            );
            console.log(`⚠️ ITS ${applicant.its_number} marked to skip due to data validation error`);
          } catch (markError) {
            console.error(`Failed to mark ITS ${applicant.its_number} for skipping:`, markError.message);
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Fetched details for ${fetched} applicant(s)`,
      summary: {
        total: pendingApplicants.length,
        fetched,
        failed,
        notFound,
        skipped: 0,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Limit errors in response
      }
    });
  } catch (error) {
    console.error('Bulk fetch error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Import ITS numbers from Excel
router.post('/import-excel', authenticateToken, authorizePermission('applicants', 'create'), upload.single('file'), async (req, res) => {
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

    // Extract ITS numbers from Excel
    // Try different possible column names
    const possibleColumns = ['ITS Number', 'ITS_Number', 'its_number', 'ITS', 'its', 'ITSNumber', 'itsNumber'];
    let itsNumbers = [];
    
    for (const row of data) {
      for (const col of possibleColumns) {
        if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
          itsNumbers.push(String(row[col]).trim());
          break;
        }
      }
    }

    if (itsNumbers.length === 0) {
      return res.status(400).json({ 
        error: 'No ITS numbers found in Excel file. Please ensure column is named: "ITS Number", "ITS_Number", "its_number", "ITS", "its", "ITSNumber", or "itsNumber"' 
      });
    }

    // Call bulk-import endpoint logic
    const { case_type_id } = req.body;
    
    // Get default case type if not provided
    let finalCaseTypeId = case_type_id;
    if (!finalCaseTypeId) {
      const [caseTypes] = await pool.execute(
        'SELECT id FROM case_types WHERE is_active = TRUE ORDER BY id ASC LIMIT 1'
      );
      if (caseTypes.length === 0) {
        return res.status(400).json({ error: 'No active case type found. Please provide case_type_id.' });
      }
      finalCaseTypeId = caseTypes[0].id;
    }

    // Get default status
    const [defaultStatus] = await pool.execute(
      'SELECT id FROM statuses WHERE name = ?',
      ['draft']
    );
    const defaultStatusId = defaultStatus[0]?.id;

    // Get first workflow stage
    const [firstStage] = await pool.execute(
      'SELECT id FROM workflow_stages WHERE is_active = TRUE ORDER BY sort_order ASC LIMIT 1'
    );
    const stageId = firstStage[0]?.id;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    let inserted = 0;
    let skipped = 0;
    const errors = [];

    try {
      for (const itsNumber of itsNumbers) {
        if (!itsNumber || itsNumber.trim() === '') {
          skipped++;
          continue;
        }

        // Check if ITS number already exists
        const [existing] = await connection.execute(
          'SELECT id FROM applicants WHERE its_number = ?',
          [itsNumber]
        );

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        try {
          // Insert applicant with only ITS number
          const [applicantResult] = await connection.execute(`
            INSERT INTO applicants (its_number, full_name, age, gender, phone, email, photo, address, jamiat_name, jamaat_name, jamiat_id, jamaat_id)
            VALUES (?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
          `, [itsNumber]);

          const applicantId = applicantResult.insertId;

          // Create case for this applicant
          const tempCaseNumber = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          
          const [caseResult] = await connection.execute(`
            INSERT INTO cases (case_number, applicant_id, case_type_id, status_id, created_by, current_workflow_stage_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [tempCaseNumber, applicantId, finalCaseTypeId, defaultStatusId, req.user.id, stageId]);

          const caseId = caseResult.insertId;

          // Update case_number to sequential BS-XXXX format
          const formattedCaseNumber = `BS-${String(caseId).padStart(4, '0')}`;
          await connection.execute(
            'UPDATE cases SET case_number = ? WHERE id = ?',
            [formattedCaseNumber, caseId]
          );

          // Initialize workflow history
          const workflowHistory = [{
            stage_id: stageId,
            stage_name: 'Draft Stage',
            entered_at: new Date().toISOString(),
            entered_by: req.user.id,
            entered_by_name: req.user.full_name || req.user.username,
            action: 'case_created'
          }];

          await connection.execute(
            'UPDATE cases SET workflow_history = ? WHERE id = ?',
            [JSON.stringify(workflowHistory), caseId]
          );

          inserted++;
        } catch (insertError) {
          skipped++;
          errors.push({ its_number: itsNumber, error: insertError.message });
        }
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Excel import completed',
        summary: {
          total: itsNumbers.length,
          inserted,
          skipped,
          errors: errors.length > 0 ? errors.slice(0, 10) : undefined
        }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('Excel import error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Export sample Excel template
router.get('/export-template', authenticateToken, async (req, res) => {
  try {
    // Create sample data
    const sampleData = [
      { 'ITS Number': 'ITS001' },
      { 'ITS Number': 'ITS002' },
      { 'ITS Number': 'ITS003' },
      { 'ITS Number': 'ITS004' },
      { 'ITS Number': 'ITS005' }
    ];

    // Create workbook and worksheet
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(sampleData);

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(wb, ws, 'ITS_Numbers_Template');

    // Generate buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=its_numbers_template.xlsx');

    // Send buffer
    res.send(buffer);
  } catch (error) {
    console.error('Export template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
