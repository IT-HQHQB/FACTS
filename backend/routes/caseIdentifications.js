const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizePermission, getUserPermissions } = require('../middleware/auth');

const router = express.Router();

// ─── Check if ITS number is already registered ─────────────────────────────
router.get('/check-its/:itsNumber', authenticateToken, async (req, res) => {
  try {
    const { itsNumber } = req.params;

    const [existing] = await pool.execute(
      `SELECT id, status, full_name FROM case_identifications 
       WHERE its_number = ? AND status IN ('pending', 'eligible')`,
      [itsNumber]
    );

    if (existing.length > 0) {
      return res.json({
        exists: true,
        message: 'Case already registered for this ITS number',
        record: {
          id: existing[0].id,
          status: existing[0].status,
          full_name: existing[0].full_name
        }
      });
    }

    return res.json({ exists: false });
  } catch (error) {
    console.error('Error checking ITS:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── List all case identifications (with pagination, search, filters) ───────
router.get('/', authenticateToken, authorizePermission('case_identification', 'read'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      eligible_in = ''
    } = req.query;

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (safePage - 1) * safeLimit;

    let whereConditions = [];
    let queryParams = [];

    if (search) {
      whereConditions.push('(ci.its_number LIKE ? OR ci.full_name LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereConditions.push('ci.status = ?');
      queryParams.push(status);
    }

    if (eligible_in) {
      whereConditions.push('ci.eligible_in = ?');
      queryParams.push(eligible_in);
    }

    // Scope by user's assigned jamiat/jamaat (super_admin and admin see all)
    const currentUserId = Number(req.user.id) || req.user.id;
    const roleLower = (req.user.role || '').toLowerCase();
    const skipScopeFilter = roleLower === 'super_admin' || roleLower === 'super administrator' || roleLower === 'admin';
    if (!skipScopeFilter) {
      const permissions = await getUserPermissions(req.user.id);
      const hasApprove = permissions.includes('case_identification:approve');

      // "All" access: null, empty, or literal "all" means no scope filter (user sees all cases)
      const isAllJamiat = (v) => !v || (typeof v === 'string' && v.trim().toLowerCase() === 'all');
      const isAllJamaat = (v) => !v || (typeof v === 'string' && v.trim().toLowerCase() === 'all');

      // Use explicit collation to avoid "Illegal mix of collations" (case_identifications vs jamiat/jamaat tables)
      const collate = 'COLLATE utf8mb4_unicode_ci';
      if (hasApprove) {
        // Approve users: filter by assigned jamiat (amuze); skip filter if all jamiat access.
        const jamiatIdsStr = (req.user.jamiat_ids || '').trim();
        if (jamiatIdsStr && !isAllJamiat(jamiatIdsStr)) {
          whereConditions.push(`ci.jamiat ${collate} IN (SELECT j.name ${collate} FROM jamiat j WHERE FIND_IN_SET(j.id, ?) > 0)`);
          queryParams.push(jamiatIdsStr);
        }
      } else {
        // Filling users: filter by assigned jamaat; skip filter if all jamaat access.
        const jamaatIdsStr = (req.user.jamaat_ids || '').trim();
        if (jamaatIdsStr && !isAllJamaat(jamaatIdsStr)) {
          whereConditions.push(`ci.jamaat ${collate} IN (SELECT ja.name ${collate} FROM jamaat ja WHERE FIND_IN_SET(ja.id, ?) > 0)`);
          queryParams.push(jamaatIdsStr);
        }
      }
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Debug: log scope and params for list (remove after fixing empty list)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[case-identifications list]', {
        userId: currentUserId,
        role: req.user.role,
        skipScope: !!skipScopeFilter,
        jamiat_ids: req.user.jamiat_ids,
        jamaat_ids: req.user.jamaat_ids,
        whereLen: whereConditions.length,
        paramCount: queryParams.length
      });
    }

    // Count total records
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM case_identifications ci ${whereClause}`,
      queryParams
    );
    // Ensure number (MySQL2 may return BigInt for COUNT, which breaks JSON.stringify)
    const total = Number(countResult[0].total) || 0;

    // Get records with case type name join
    // Note: LIMIT/OFFSET are interpolated directly (safe - they are parsed integers)
    const safeOffset = Math.max(0, offset);

    const [records] = await pool.execute(
      `SELECT ci.*, 
              ct.name as case_type_name,
              u.username as created_by_name,
              u.full_name as created_by_full_name,
              rv.username as reviewed_by_name,
              rv.full_name as reviewed_by_full_name
       FROM case_identifications ci
       LEFT JOIN case_types ct ON ci.eligible_in = ct.id
       LEFT JOIN users u ON ci.created_by = u.id
       LEFT JOIN users rv ON ci.reviewed_by = rv.id
       ${whereClause}
       ORDER BY ci.created_at DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      queryParams
    );

    // Sanitize records so BigInt fields (e.g. id) don't break JSON
    const safeRecords = (records || []).map((r) => {
      const row = { ...r };
      for (const key of Object.keys(row)) {
        if (typeof row[key] === 'bigint') row[key] = Number(row[key]);
      }
      return row;
    });

    res.json({
      records: safeRecords,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: safeLimit > 0 ? Math.ceil(total / safeLimit) : 0
      }
    });
  } catch (error) {
    console.error('Error listing case identifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Get single case identification ────────────────────────────────────────
router.get('/:id', authenticateToken, authorizePermission('case_identification', 'read'), async (req, res) => {
  try {
    const { id } = req.params;

    const [records] = await pool.execute(
      `SELECT ci.*, 
              ct.name as case_type_name,
              u.username as created_by_name,
              u.full_name as created_by_full_name,
              rv.username as reviewed_by_name,
              rv.full_name as reviewed_by_full_name
       FROM case_identifications ci
       LEFT JOIN case_types ct ON ci.eligible_in = ct.id
       LEFT JOIN users u ON ci.created_by = u.id
       LEFT JOIN users rv ON ci.reviewed_by = rv.id
       WHERE ci.id = ?`,
      [id]
    );

    if (records.length === 0) {
      return res.status(404).json({ error: 'Case identification not found' });
    }

    res.json(records[0]);
  } catch (error) {
    console.error('Error getting case identification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Create a new case identification ──────────────────────────────────────
router.post('/', authenticateToken, authorizePermission('case_identification', 'create'), async (req, res) => {
  try {
    const {
      its_number,
      full_name,
      age,
      gender,
      phone,
      email,
      photo,
      address,
      jamiat,
      jamaat,
      eligible_in,
      total_family_members,
      earning_family_members,
      individual_income,
      family_income,
      remarks
    } = req.body;

    // ── Validations ──
    if (!its_number || !eligible_in) {
      return res.status(400).json({ error: 'ITS number and Eligible In are required' });
    }

    if (total_family_members == null || total_family_members < 0 || total_family_members > 25) {
      return res.status(400).json({ error: 'Total family members must be between 0 and 25' });
    }

    if (earning_family_members == null || earning_family_members < 0 || earning_family_members > 20) {
      return res.status(400).json({ error: 'Earning family members must be between 0 and 20' });
    }

    if (individual_income == null || individual_income < 0 || individual_income > 9999999) {
      return res.status(400).json({ error: 'Individual income must be between 0 and 9999999' });
    }

    if (family_income == null || family_income < 0 || family_income > 9999999) {
      return res.status(400).json({ error: 'Family income must be between 0 and 9999999' });
    }

    // Check for duplicate ITS (pending or eligible)
    const [existing] = await pool.execute(
      `SELECT id FROM case_identifications 
       WHERE its_number = ? AND status IN ('pending', 'eligible')`,
      [its_number]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Case already registered for this ITS number' });
    }

    // Validate case type exists
    const [caseType] = await pool.execute(
      'SELECT id FROM case_types WHERE id = ? AND is_active = 1',
      [eligible_in]
    );

    if (caseType.length === 0) {
      return res.status(400).json({ error: 'Invalid case type selected' });
    }

    // Insert the record
    const [result] = await pool.execute(
      `INSERT INTO case_identifications 
        (its_number, full_name, age, gender, phone, email, photo, address, jamiat, jamaat,
         eligible_in, total_family_members, earning_family_members, individual_income, family_income, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        its_number, full_name || null, age || null, gender || null,
        phone || null, email || null, photo || null, address || null,
        jamiat || null, jamaat || null,
        eligible_in, total_family_members, earning_family_members,
        individual_income, family_income, remarks || null,
        req.user.id
      ]
    );

    res.status(201).json({
      message: 'Case identification created successfully',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error creating case identification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Review case identification (mark eligible / ineligible) ────────────────
router.put('/:id/review', authenticateToken, authorizePermission('case_identification', 'approve'), async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const { id } = req.params;
    const { status, review_remarks } = req.body;

    if (!status || !['eligible', 'ineligible'].includes(status)) {
      await connection.rollback();
      return res.status(400).json({ error: 'Status must be either "eligible" or "ineligible"' });
    }

    // Get the case identification record
    const [records] = await connection.execute(
      'SELECT * FROM case_identifications WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Case identification not found' });
    }

    const record = records[0];

    if (record.status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({ error: `Cannot review a case identification that is already "${record.status}"` });
    }

    let caseId = null;
    let caseNumber = null;

    // If marking as eligible, auto-create a case
    if (status === 'eligible') {
      // ── 1. Upsert applicant (use same columns as applicants.js) ──
      let applicantId;
      const [existingApplicant] = await connection.execute(
        'SELECT id FROM applicants WHERE its_number = ?',
        [record.its_number]
      );

      if (existingApplicant.length > 0) {
        applicantId = existingApplicant[0].id;
      } else {
        // Look up internal jamiat/jamaat IDs from names
        let jamiatInternalId = null;
        let jamaatInternalId = null;

        if (record.jamiat) {
          const [jamiatResult] = await connection.execute(
            'SELECT id FROM jamiat WHERE name = ? LIMIT 1',
            [record.jamiat]
          );
          if (jamiatResult.length > 0) {
            jamiatInternalId = jamiatResult[0].id;
          }
        }

        if (record.jamaat) {
          let jamaatQuery = 'SELECT id FROM jamaat WHERE name = ?';
          const jamaatParams = [record.jamaat];
          if (jamiatInternalId) {
            jamaatQuery += ' AND jamiat_id = ?';
            jamaatParams.push(jamiatInternalId);
          }
          jamaatQuery += ' LIMIT 1';
          const [jamaatResult] = await connection.execute(jamaatQuery, jamaatParams);
          if (jamaatResult.length > 0) {
            jamaatInternalId = jamaatResult[0].id;
          }
        }

        // Use same INSERT columns as applicants.js (no first_name/last_name)
        const [applicantResult] = await connection.execute(
          `INSERT INTO applicants (its_number, full_name, age, gender, phone, email, photo, address, jamiat_name, jamaat_name, jamiat_id, jamaat_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.its_number, record.full_name || '',
            record.age, record.gender, record.phone, record.email,
            record.photo, record.address,
            record.jamiat || '', record.jamaat || '',
            jamiatInternalId, jamaatInternalId
          ]
        );
        applicantId = applicantResult.insertId;
      }

      // ── 2. Create case ──
      const caseTypeId = record.eligible_in;

      // Get case type name
      const [caseTypeResult] = await connection.execute(
        'SELECT name FROM case_types WHERE id = ?',
        [caseTypeId]
      );
      const caseTypeName = caseTypeResult.length > 0 ? caseTypeResult[0].name : 'BS';

      // Get default draft status
      const [defaultStatus] = await connection.execute(
        "SELECT id FROM statuses WHERE name = 'draft' LIMIT 1"
      );
      const statusId = defaultStatus.length > 0 ? defaultStatus[0].id : null;

      // Get first workflow stage
      const [firstStage] = await connection.execute(
        'SELECT id FROM workflow_stages WHERE is_active = TRUE ORDER BY sort_order ASC LIMIT 1'
      );
      const stageId = firstStage.length > 0 ? firstStage[0].id : null;

      // Look up internal jamiat/jamaat IDs for the case
      let caseJamiatId = null;
      let caseJamaatId = null;
      if (record.jamiat) {
        const [jr] = await connection.execute('SELECT id FROM jamiat WHERE name = ? LIMIT 1', [record.jamiat]);
        if (jr.length > 0) caseJamiatId = jr[0].id;
      }
      if (record.jamaat) {
        let q = 'SELECT id FROM jamaat WHERE name = ?';
        const p = [record.jamaat];
        if (caseJamiatId) { q += ' AND jamiat_id = ?'; p.push(caseJamiatId); }
        q += ' LIMIT 1';
        const [jr] = await connection.execute(q, p);
        if (jr.length > 0) caseJamaatId = jr[0].id;
      }

      // Generate temporary case number (same pattern as cases.js)
      const tempCaseNumber = `${caseTypeName.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      // Use same INSERT columns as cases.js POST route
      const [caseResult] = await connection.execute(
        `INSERT INTO cases (case_number, applicant_id, case_type_id, status_id, roles, assigned_counselor_id, jamiat_id, jamaat_id, assigned_role, description, notes, created_by, current_workflow_stage_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tempCaseNumber, applicantId, caseTypeId, statusId, null, null, caseJamiatId, caseJamaatId, null, null, null, req.user.id, stageId]
      );

      caseId = caseResult.insertId;

      // Update to sequential case number (BS-0001 format)
      caseNumber = `BS-${String(caseId).padStart(4, '0')}`;
      await connection.execute(
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

      await connection.execute(
        'UPDATE cases SET workflow_history = ? WHERE id = ?',
        [JSON.stringify(workflowHistory), caseId]
      );
    }

    // ── 3. Update the case identification record ──
    await connection.execute(
      `UPDATE case_identifications 
       SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_remarks = ?, case_id = ?
       WHERE id = ?`,
      [status, req.user.id, review_remarks || null, caseId, id]
    );

    await connection.commit();

    const responseData = {
      message: status === 'eligible'
        ? 'Case identification marked as eligible. Case created successfully.'
        : 'Case identification marked as ineligible.',
      status
    };

    if (caseId) {
      responseData.case_id = caseId;
      responseData.case_number = caseNumber;
    }

    res.json(responseData);
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error('Rollback error:', rollbackErr);
      }
    }
    console.error('Error reviewing case identification:', error);
    console.error('Error details:', error.code, error.sqlMessage, error.sql);
    res.status(500).json({
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
