const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { authenticateToken, authorizeRoles, authorizeCaseAccess, canCreateCaseInStage, canFillCaseInStage, authorizePermission } = require('../middleware/auth');
const { hasPermission, canAccessAllCases } = require('../utils/permissionUtils');
const notificationService = require('../services/notificationService');
const { v4: uuidv4 } = require('uuid');

// Configure multer for case closure document uploads
const closureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { caseId } = req.params;
    const uploadDir = path.join(__dirname, '../uploads/case_closures', caseId);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const closureUpload = multer({
  storage: closureStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|jpg|jpeg|png|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || 
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'image/jpeg' ||
      file.mimetype === 'image/png';
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, JPG, and PNG files are allowed.'), false);
    }
  }
});

const router = express.Router();

// Get available counselors for case assignment (filtered by jamiat/jamaat if applicable)
// IMPORTANT: This route must come BEFORE /:caseId route, otherwise "available-counselors" will be matched as a caseId
router.get('/available-counselors', authenticateToken, async (req, res) => {
  try {
    const { caseId, jamiat_id, jamaat_id } = req.query;
    const userRole = req.user.role;

    // First, get the Counselor workflow stage ID(s)
    const [counselorStages] = await pool.execute(
      `SELECT id FROM workflow_stages 
       WHERE (stage_key LIKE '%counselor%' OR stage_key = 'counselor') 
       AND is_active = TRUE`
    );

    if (counselorStages.length === 0) {
      console.log('[available-counselors] No Counselor workflow stage found');
      return res.json({ counselors: [], message: 'No Counselor workflow stage found' });
    }

    const counselorStageIds = counselorStages.map(s => s.id);
    console.log('[available-counselors] Counselor stage IDs:', counselorStageIds);

    let query = `
      SELECT DISTINCT
        u.id,
        u.full_name,
        u.email,
        u.role,
        u.jamiat_ids,
        u.jamaat_ids
      FROM users u
      INNER JOIN workflow_stage_users wsu ON u.id = wsu.user_id
      WHERE u.role = 'counselor' 
        AND u.is_active = TRUE
        AND wsu.workflow_stage_id IN (${counselorStageIds.map(() => '?').join(',')})
    `;

    const queryParams = [...counselorStageIds];

    // If caseId provided, filter by case location
    if (caseId) {
      const [caseData] = await pool.execute(
        'SELECT assigned_counselor_id, jamiat_id, jamaat_id FROM cases WHERE id = ?',
        [caseId]
      );
      
      if (caseData.length > 0) {
        const assignedCounselorId = caseData[0].assigned_counselor_id;
        const caseJamiatId = caseData[0].jamiat_id;
        const caseJamaatId = caseData[0].jamaat_id;

        console.log(`[available-counselors] Case ${caseId}: jamiat_id=${caseJamiatId}, jamaat_id=${caseJamaatId || 'NULL'}`);

        // Filter by jamiat/jamaat if case has them
        // If case has no location, show all counselors (no filter)
        // If case has location, filter counselors by matching location OR counselors with no location restrictions
        if (caseJamiatId || caseJamaatId) {
          query += ` AND (
            FIND_IN_SET(?, u.jamiat_ids) > 0 
            OR FIND_IN_SET(?, u.jamaat_ids) > 0
            OR (u.jamiat_ids IS NULL AND u.jamaat_ids IS NULL)
          )`;
          queryParams.push(caseJamiatId, caseJamaatId);
          console.log(`[available-counselors] Adding location filter: jamiat_id=${caseJamiatId}, jamaat_id=${caseJamaatId || 'NULL'}`);
          console.log(`[available-counselors] This will match counselors with jamiat_ids containing ${caseJamiatId} or jamaat_ids containing ${caseJamaatId || 'NULL'}, or counselors with no location restrictions`);
        } else {
          console.log('[available-counselors] Case has no jamiat/jamaat (NULL), showing ALL counselors (no location filter)');
        }

        // Include currently assigned counselor in results (don't exclude them)
        // The query already shows all counselors, so assigned one will be included
      } else {
        console.log(`[available-counselors] Case ${caseId} not found`);
      }
    } else if (jamiat_id || jamaat_id) {
      // Filter by provided jamiat/jamaat
      query += ` AND (
        FIND_IN_SET(?, u.jamiat_ids) > 0 
        OR FIND_IN_SET(?, u.jamaat_ids) > 0
        OR (u.jamiat_ids IS NULL AND u.jamaat_ids IS NULL)
      )`;
      queryParams.push(jamiat_id || null, jamaat_id || null);
      console.log(`[available-counselors] Filtering by provided: jamiat_id=${jamiat_id || 'NULL'}, jamaat_id=${jamaat_id || 'NULL'}`);
    } else {
      console.log('[available-counselors] No caseId or location provided, showing all counselors');
    }

    query += ' ORDER BY u.full_name ASC';

    console.log('[available-counselors] Executing query with params:', queryParams);
    const [counselors] = await pool.execute(query, queryParams);
    console.log(`[available-counselors] Found ${counselors.length} counselor(s)`);

    res.json({ counselors });
  } catch (error) {
    console.error('[available-counselors] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get counselor permissions for all workflow stages
router.get('/counselor-permissions/:counselorId', authenticateToken, authorizePermission('cases', 'read'), async (req, res) => {
  try {
    const { counselorId } = req.params;

    // Get counselor details
    const [counselors] = await pool.execute(
      'SELECT id, full_name, email, role FROM users WHERE id = ? AND role = ?',
      [counselorId, 'counselor']
    );

    if (counselors.length === 0) {
      return res.status(404).json({ error: 'Counselor not found' });
    }

    const counselor = counselors[0];

    // Get all workflow stages
    const [stages] = await pool.execute(
      'SELECT id, stage_name, stage_key, sort_order FROM workflow_stages WHERE is_active = TRUE ORDER BY sort_order ASC'
    );

    // Get permissions for each stage
    const stagesWithPermissions = await Promise.all(
      stages.map(async (stage) => {
        const { getWorkflowStagePermissions } = require('../middleware/auth');
        const permissions = await getWorkflowStagePermissions(
          counselorId,
          'counselor',
          stage.id
        );
        return {
          ...stage,
          permissions
        };
      })
    );

    res.json({
      counselor,
      stages: stagesWithPermissions
    });
  } catch (error) {
    console.error('Get counselor permissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all cases with filtering and pagination
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      case_type, 
      assigned_roles, 
      assigned_counselor_id,
      search,
      jamiat_id,
      jamaat_id,
      current_workflow_stage_id
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const offset = (pageNum - 1) * limitNum;
    const userId = req.user.id;
    const userRole = req.user.role;

    let whereConditions = [];
    let queryParams = [];

    // Explicit check for Deputy Counseling Manager - they should only see assigned cases
    // This overrides any cases.read permission they might have
    if (userRole === 'Deputy Counseling Manager' || userRole === 'dcm') {
      whereConditions.push('c.roles = ?');
      queryParams.push(userId);
    } else {
      // Role-based filtering using database permissions
      const canAccessAll = await canAccessAllCases(userRole);
      
      if (!canAccessAll) {
        // For roles that can't access all cases, filter by assignment or jamiat/jamaat
        if (userRole === 'ZI' || userRole === 'Zonal Incharge') {
          // ZI can see cases in their assigned jamiat/jamaat areas
          whereConditions.push(`
            (c.roles = ? OR c.assigned_counselor_id = ? OR 
             EXISTS (
               SELECT 1 FROM applicants a 
               WHERE a.id = c.applicant_id 
               AND EXISTS (
                 SELECT 1 FROM users u 
                 WHERE u.id = ? 
                 AND (FIND_IN_SET(a.jamiat_id, u.jamiat_ids) > 0 OR FIND_IN_SET(a.jamaat_id, u.jamaat_ids) > 0)
               )
             ))
          `);
          queryParams.push(userId, userId, userId);
        } else {
          // Other roles (counselor) can only see assigned cases
          whereConditions.push('(c.roles = ? OR c.assigned_counselor_id = ?)');
          queryParams.push(userId, userId);
        }
      }
    }

    // Additional filters (only add if value is not empty)
    if (status && typeof status === 'string' && status.trim() !== '') {
      whereConditions.push('c.status = ?');
      queryParams.push(status.trim());
    }

    if (case_type && typeof case_type === 'string' && case_type.trim() !== '') {
      whereConditions.push('c.case_type = ?');
      queryParams.push(case_type.trim());
    }

    if (assigned_roles && assigned_roles.toString().trim() !== '') {
      whereConditions.push('c.roles = ?');
      queryParams.push(assigned_roles);
    }

    if (assigned_counselor_id && assigned_counselor_id.toString().trim() !== '') {
      whereConditions.push('c.assigned_counselor_id = ?');
      queryParams.push(assigned_counselor_id);
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      whereConditions.push('(a.full_name LIKE ? OR a.its_number LIKE ? OR c.case_number LIKE ?)');
      const searchTerm = `%${search.trim()}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (jamiat_id && jamiat_id.toString().trim() !== '') {
      whereConditions.push('c.jamiat_id = ?');
      queryParams.push(jamiat_id);
    }

    if (jamaat_id && jamaat_id.toString().trim() !== '') {
      whereConditions.push('c.jamaat_id = ?');
      queryParams.push(jamaat_id);
    }

    if (current_workflow_stage_id && current_workflow_stage_id.toString().trim() !== '') {
      whereConditions.push('c.current_workflow_stage_id = ?');
      queryParams.push(current_workflow_stage_id);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count (use a copy of queryParams since we'll add LIMIT/OFFSET later)
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM cases c 
      JOIN applicants a ON c.applicant_id = a.id 
      LEFT JOIN counseling_forms cf ON c.id = cf.case_id
      ${whereClause}
    `;
    
    // Count placeholders in the count query
    const countPlaceholderCount = (countQuery.match(/\?/g) || []).length;
    const countParamCount = queryParams.length;
    
    // Debug logging
    console.log('Count query - Parameter count:', countParamCount);
    console.log('Count query - Placeholder count:', countPlaceholderCount);
    console.log('Count query - WHERE clause:', whereClause);
    console.log('Count query - Parameters:', queryParams);
    
    // Validate parameter count matches placeholder count
    if (countPlaceholderCount !== countParamCount) {
      console.error('Count query parameter mismatch detected!');
      console.error('Query:', countQuery);
      console.error('Placeholders:', countPlaceholderCount, 'Parameters:', countParamCount);
      throw new Error(`SQL parameter mismatch in count query: Expected ${countPlaceholderCount} parameters but got ${countParamCount}`);
    }
    
    const [countResult] = await pool.execute(countQuery, [...queryParams]);
    const total = countResult[0].total;

    // Check if SLA columns exist in workflow_stages table
    let workflowSlaColumnsExist = false;
    try {
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'workflow_stages' 
        AND COLUMN_NAME = 'sla_value'
      `);
      workflowSlaColumnsExist = columns.length > 0;
    } catch (error) {
      console.warn('Could not check for workflow_stages SLA columns:', error.message);
    }

    // Check if SLA tracking columns exist in cases table
    let casesSlaColumnsExist = false;
    try {
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'cases' 
        AND COLUMN_NAME = 'current_stage_entered_at'
      `);
      casesSlaColumnsExist = columns.length > 0;
    } catch (error) {
      console.warn('Could not check for cases SLA columns:', error.message);
    }

    // Check if cover_letter_forms approval columns exist (migration may not have been applied yet)
    let coverLetterApprovedColumnExists = false;
    try {
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'cover_letter_forms'
        AND COLUMN_NAME = 'is_approved'
      `);
      coverLetterApprovedColumnExists = columns.length > 0;
    } catch (error) {
      console.warn('Could not check for cover_letter_forms is_approved column:', error.message);
    }

    // Build query with or without SLA columns
    // workflow_stages SLA columns
    const workflowSlaFields = workflowSlaColumnsExist ? `
        ws.sla_value,
        ws.sla_unit,
        ws.sla_warning_value,
        ws.sla_warning_unit,
    ` : `
        NULL as sla_value,
        NULL as sla_unit,
        NULL as sla_warning_value,
        NULL as sla_warning_unit,
    `;

    // cases table SLA tracking columns
    const casesSlaFields = casesSlaColumnsExist ? `
        c.current_stage_entered_at,
        c.sla_status,
        c.sla_breached_at,
    ` : `
        NULL as current_stage_entered_at,
        'on_time' as sla_status,
        NULL as sla_breached_at,
    `;

    const slaFields = workflowSlaFields + casesSlaFields;
    const coverLetterApprovalField = coverLetterApprovedColumnExists
      ? `COALESCE(clf.is_approved, FALSE) as cover_letter_form_approved,`
      : `FALSE as cover_letter_form_approved,`;

    // Get cases with pagination
    const casesQuery = `
      SELECT 
        c.*,
        a.full_name as applicant_full_name,
        a.its_number,
        roles_user.full_name as roles_full_name,
        counselor.full_name as counselor_full_name,
        creator.full_name as created_by_full_name,
        cf.is_complete as counseling_form_completed,
        CASE WHEN clf.id IS NOT NULL THEN TRUE ELSE FALSE END as cover_letter_form_exists,
        clf.is_complete as cover_letter_form_completed,
        ${coverLetterApprovalField}
        -- Individual section completion flags
        CASE WHEN cf.personal_details_id IS NOT NULL THEN TRUE ELSE FALSE END as personal_details_completed,
        CASE WHEN cf.family_details_id IS NOT NULL THEN TRUE ELSE FALSE END as family_details_completed,
        CASE WHEN cf.assessment_id IS NOT NULL THEN TRUE ELSE FALSE END as assessment_completed,
        CASE WHEN cf.financial_assistance_id IS NOT NULL THEN TRUE ELSE FALSE END as financial_assistance_completed,
        CASE WHEN cf.economic_growth_id IS NOT NULL THEN TRUE ELSE FALSE END as economic_growth_completed,
        CASE WHEN cf.declaration_id IS NOT NULL THEN TRUE ELSE FALSE END as declaration_completed,
        CASE WHEN cf.attachments_id IS NOT NULL THEN TRUE ELSE FALSE END as attachments_completed,
        -- Check if all 7 sections are completed
        CASE 
          WHEN cf.personal_details_id IS NOT NULL 
           AND cf.family_details_id IS NOT NULL 
           AND cf.assessment_id IS NOT NULL 
           AND cf.financial_assistance_id IS NOT NULL 
           AND cf.economic_growth_id IS NOT NULL 
           AND cf.declaration_id IS NOT NULL 
           AND cf.attachments_id IS NOT NULL 
          THEN TRUE 
          ELSE FALSE 
        END as all_sections_completed,
        COALESCE(manzoori_attachments.manzoori_file_count, 0) as manzoori_file_count,
        COALESCE(j.name, a.jamiat_name) as jamiat_name,
        COALESCE(applicant_jamaat.name, ja.name) as jamaat_name,
        ct.name as case_type_name,
        COALESCE(NULLIF(c.status, ''), 'draft') as status_name,
        ws.stage_name as current_workflow_stage_name,
        ${slaFields}
        el.level_name as current_executive_level_name,
        el.description as current_executive_level_description,
        CASE 
          WHEN c.status = 'draft' THEN '#6B7280'
          WHEN c.status = 'assigned' THEN '#3B82F6'
          WHEN c.status = 'in_counseling' THEN '#F59E0B'
          WHEN c.status = 'cover_letter_generated' THEN '#8B5CF6'
          WHEN c.status = 'submitted_to_welfare' THEN '#06B6D4'
          WHEN c.status = 'welfare_approved' THEN '#10B981'
          WHEN c.status = 'welfare_rejected' THEN '#EF4444'
          WHEN c.status = 'welfare_processing_rework' THEN '#F59E0B'
          WHEN c.status = 'submitted_to_zi' OR c.status = 'submitted_to_zi_review' THEN '#10B981'
          WHEN c.status = 'zi_approved' THEN '#10B981'
          WHEN c.status = 'zi_rejected' THEN '#EF4444'
          WHEN c.status = 'submitted_to_kg_review' THEN '#8B5CF6'
          WHEN c.status = 'submitted_to_operations_lead' THEN '#F59E0B'
          WHEN c.status = 'submitted_to_executive' OR c.status LIKE 'submitted_to_executive_%' THEN '#3B82F6'
          WHEN c.status = 'executive_approved' THEN '#10B981'
          WHEN c.status = 'finance_disbursement' THEN '#059669'
          ELSE '#6B7280'
        END as status_color
      FROM cases c
      JOIN applicants a ON c.applicant_id = a.id
      LEFT JOIN users roles_user ON c.roles = roles_user.id
      LEFT JOIN users counselor ON c.assigned_counselor_id = counselor.id
      LEFT JOIN users creator ON c.created_by = creator.id
      LEFT JOIN counseling_forms cf ON c.id = cf.case_id
      LEFT JOIN cover_letter_forms clf ON c.id = clf.case_id
      LEFT JOIN jamiat j ON c.jamiat_id = j.id
      LEFT JOIN jamaat ja ON c.jamaat_id = ja.id
      LEFT JOIN jamaat applicant_jamaat ON a.jamaat_id = applicant_jamaat.id
      LEFT JOIN case_types ct ON c.case_type_id = ct.id
      LEFT JOIN workflow_stages ws ON c.current_workflow_stage_id = ws.id
      LEFT JOIN executive_levels el ON c.current_executive_level = el.level_number AND el.is_active = TRUE
      LEFT JOIN (
        SELECT 
          case_id, 
          COUNT(*) as manzoori_file_count
        FROM case_attachments
        WHERE stage = 'manzoori'
        GROUP BY case_id
      ) manzoori_attachments ON c.id = manzoori_attachments.case_id
      ${whereClause}
      ORDER BY CAST(REPLACE(c.case_number, 'BS-', '') AS UNSIGNED) DESC
      LIMIT ? OFFSET ?
    `;

    // Ensure limitNum and offset are valid numbers
    if (isNaN(limitNum) || isNaN(offset) || limitNum < 1 || offset < 0) {
      throw new Error(`Invalid pagination parameters: limit=${limitNum}, offset=${offset}`);
    }
    
    // Use string interpolation for LIMIT/OFFSET since they're validated integers
    // This avoids the "Incorrect arguments to mysqld_stmt_execute" error
    const finalCasesQuery = casesQuery.replace('LIMIT ? OFFSET ?', `LIMIT ${parseInt(limitNum, 10)} OFFSET ${parseInt(offset, 10)}`);
    
    // Debug logging
    console.log('Cases query - Parameter count:', queryParams.length);
    console.log('Cases query - WHERE clause:', whereClause);
    console.log('Cases query - Parameters:', queryParams);
    console.log('Cases query - LIMIT:', limitNum, 'OFFSET:', offset);
    
    const [cases] = await pool.execute(finalCasesQuery, queryParams);

    // Add workflow permissions and SLA information for each case
    const { getWorkflowStagePermissions } = require('../middleware/auth');
    const { calculateSLAStatus } = require('../utils/slaCalculator');
    const casesWithPermissions = await Promise.all(
      cases.map(async (caseItem) => {
        // Auto-fix: Check if status matches workflow stage's associated_statuses
        if (caseItem.current_workflow_stage_id && caseItem.status) {
          try {
            const [stageData] = await pool.execute(
              'SELECT associated_statuses FROM workflow_stages WHERE id = ? AND is_active = TRUE',
              [caseItem.current_workflow_stage_id]
            );

            if (stageData.length > 0 && stageData[0].associated_statuses) {
              let associatedStatuses = [];
              try {
                associatedStatuses = JSON.parse(stageData[0].associated_statuses);
              } catch (e) {
                associatedStatuses = Array.isArray(stageData[0].associated_statuses) ? stageData[0].associated_statuses : [];
              }

              // If current status doesn't match any associated status, update it
              if (associatedStatuses.length > 0 && !associatedStatuses.includes(caseItem.status)) {
                let correctStatus = associatedStatuses[0];
                
                // Check if roles are assigned before setting status to 'assigned'
                // If the correct status is 'assigned' but no roles are assigned, set to 'draft' instead
                if (correctStatus === 'assigned' && !caseItem.roles) {
                  // Check if 'draft' is in the associated statuses, otherwise use the first non-assigned status
                  if (associatedStatuses.includes('draft')) {
                    correctStatus = 'draft';
                  } else {
                    // Find first status that's not 'assigned' or use 'draft' as fallback
                    const nonAssignedStatus = associatedStatuses.find(s => s !== 'assigned') || 'draft';
                    correctStatus = nonAssignedStatus;
                  }
                }
                
                await pool.execute(
                  'UPDATE cases SET status = ? WHERE id = ?',
                  [correctStatus, caseItem.id]
                );
                caseItem.status = correctStatus;
                caseItem.status_name = correctStatus;
              }
            }
          } catch (error) {
            console.error(`Error auto-fixing case ${caseItem.id} status:`, error);
            // Don't fail the request if auto-fix fails
          }
        }

        let workflowPermissions = null;
        if (caseItem.current_workflow_stage_id) {
          try {
            workflowPermissions = await getWorkflowStagePermissions(
              userId,
              userRole,
              caseItem.current_workflow_stage_id
            );
          } catch (error) {
            console.error(`Error getting permissions for case ${caseItem.id}:`, error);
            // Continue without permissions if error occurs
          }
        }

        // Calculate SLA status if workflow stage has SLA configured
        let slaInfo = null;
        if (caseItem.current_workflow_stage_id && caseItem.sla_value && caseItem.sla_unit) {
          try {
            slaInfo = await calculateSLAStatus(caseItem.id, {
              sla_value: caseItem.sla_value,
              sla_unit: caseItem.sla_unit,
              sla_warning_value: caseItem.sla_warning_value,
              sla_warning_unit: caseItem.sla_warning_unit
            });
          } catch (error) {
            console.error(`Error calculating SLA for case ${caseItem.id}:`, error);
          }
        }

        return {
          ...caseItem,
          workflowPermissions,
          slaInfo
        };
      })
    );

    res.json({
      cases: casesWithPermissions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get cases error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get single case by ID
router.get('/:caseId', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;

    // Check if SLA columns exist in workflow_stages table
    let workflowSlaColumnsExist = false;
    try {
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'workflow_stages' 
        AND COLUMN_NAME = 'sla_value'
      `);
      workflowSlaColumnsExist = columns.length > 0;
    } catch (error) {
      console.warn('Could not check for workflow_stages SLA columns:', error.message);
    }

    // Check if SLA tracking columns exist in cases table
    let casesSlaColumnsExist = false;
    try {
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'cases' 
        AND COLUMN_NAME = 'current_stage_entered_at'
      `);
      casesSlaColumnsExist = columns.length > 0;
    } catch (error) {
      console.warn('Could not check for cases SLA columns:', error.message);
    }

    // Check if photo column exists in users table
    let usersPhotoColumnExists = false;
    try {
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'photo'
      `);
      usersPhotoColumnExists = columns.length > 0;
    } catch (error) {
      console.warn('Could not check for users photo column:', error.message);
    }

    // Build SLA fields based on column existence
    // workflow_stages SLA columns
    const workflowSlaFields = workflowSlaColumnsExist ? `
        ws.sla_value,
        ws.sla_unit,
        ws.sla_warning_value,
        ws.sla_warning_unit,
    ` : `
        NULL as sla_value,
        NULL as sla_unit,
        NULL as sla_warning_value,
        NULL as sla_warning_unit,
    `;

    // cases table SLA tracking columns
    const casesSlaFields = casesSlaColumnsExist ? `
        DATE_FORMAT(c.current_stage_entered_at, '%Y-%m-%dT%H:%i:%s') as current_stage_entered_at_iso,
    ` : `
        NULL as current_stage_entered_at_iso,
    `;

    const slaFields = workflowSlaFields + casesSlaFields;

    // Build counselor fields based on column existence
    const counselorPhotoField = usersPhotoColumnExists ? 'counselor.photo as counselor_photo,' : 'NULL as counselor_photo,';

    const [cases] = await pool.execute(`
      SELECT 
        c.*,
        a.*,
        dcm.full_name as dcm_full_name,
        counselor.full_name as counselor_full_name,
        counselor.email as counselor_email,
        counselor.phone as counselor_phone,
        ${counselorPhotoField}
        creator.full_name as created_by_full_name,
        ct.name as case_type_name,
        ct.description as case_type_description,
        c.status as status_name,
        ws.stage_name as current_workflow_stage_name,
        ${slaFields}
        -- Format dates as ISO-like strings to preserve exact date/time from database
        -- Using 'T' separator for ISO format, but without 'Z' to preserve server timezone date
        DATE_FORMAT(c.created_at, '%Y-%m-%dT%H:%i:%s') as created_at_iso,
        DATE_FORMAT(c.updated_at, '%Y-%m-%dT%H:%i:%s') as updated_at_iso,
        CASE 
          WHEN c.status = 'draft' THEN '#6B7280'
          WHEN c.status = 'assigned' THEN '#3B82F6'
          WHEN c.status = 'in_counseling' THEN '#F59E0B'
          WHEN c.status = 'cover_letter_generated' THEN '#8B5CF6'
          WHEN c.status = 'submitted_to_welfare' THEN '#06B6D4'
          WHEN c.status = 'welfare_approved' THEN '#10B981'
          WHEN c.status = 'welfare_rejected' THEN '#EF4444'
          WHEN c.status = 'executive_approved' THEN '#10B981'
          WHEN c.status = 'executive_rejected' THEN '#EF4444'
          WHEN c.status = 'finance_disbursement' THEN '#059669'
          ELSE '#6B7280'
        END as status_color
      FROM cases c
      JOIN applicants a ON c.applicant_id = a.id
      LEFT JOIN users dcm ON c.roles = dcm.id
      LEFT JOIN users counselor ON c.assigned_counselor_id = counselor.id
      LEFT JOIN users creator ON c.created_by = creator.id
      LEFT JOIN case_types ct ON c.case_type_id = ct.id
      LEFT JOIN workflow_stages ws ON c.current_workflow_stage_id = ws.id
      WHERE c.id = ?
    `, [caseId]);

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Use ISO formatted dates from SQL query to preserve exact date/time
    const caseData = cases[0];

    // Auto-fix: Check if status matches workflow stage's associated_statuses
    // IMPORTANT: Never downgrade a case that has already reached finance_disbursement.
    if (caseData.current_workflow_stage_id && caseData.status && caseData.status !== 'finance_disbursement') {
      try {
        const [stageData] = await pool.execute(
          'SELECT associated_statuses FROM workflow_stages WHERE id = ? AND is_active = TRUE',
          [caseData.current_workflow_stage_id]
        );

        if (stageData.length > 0 && stageData[0].associated_statuses) {
          let associatedStatuses = [];
          try {
            associatedStatuses = JSON.parse(stageData[0].associated_statuses);
          } catch (e) {
            associatedStatuses = Array.isArray(stageData[0].associated_statuses) ? stageData[0].associated_statuses : [];
          }

          // If current status doesn't match any associated status, update it
          if (associatedStatuses.length > 0 && !associatedStatuses.includes(caseData.status)) {
            let correctStatus = associatedStatuses[0];
            
            // Check if roles are assigned before setting status to 'assigned'
            // If the correct status is 'assigned' but no roles are assigned, set to 'draft' instead
            if (correctStatus === 'assigned' && !caseData.roles) {
              // Check if 'draft' is in the associated statuses, otherwise use the first non-assigned status
              if (associatedStatuses.includes('draft')) {
                correctStatus = 'draft';
              } else {
                // Find first status that's not 'assigned' or use 'draft' as fallback
                const nonAssignedStatus = associatedStatuses.find(s => s !== 'assigned') || 'draft';
                correctStatus = nonAssignedStatus;
              }
            }
            
            await pool.execute(
              'UPDATE cases SET status = ? WHERE id = ?',
              [correctStatus, caseId]
            );
            caseData.status = correctStatus;
            caseData.status_name = correctStatus;
          }
        }
      } catch (error) {
        console.error('Error auto-fixing case status:', error);
        // Don't fail the request if auto-fix fails
      }
    }
    if (caseData.created_at_iso) {
      caseData.created_at = caseData.created_at_iso;
      delete caseData.created_at_iso;
    }
    if (caseData.updated_at_iso) {
      caseData.updated_at = caseData.updated_at_iso;
      delete caseData.updated_at_iso;
    }
    if (caseData.current_stage_entered_at_iso) {
      caseData.current_stage_entered_at = caseData.current_stage_entered_at_iso;
      delete caseData.current_stage_entered_at_iso;
    }

    // Calculate SLA status if workflow stage has SLA configured
    let slaInfo = null;
    if (caseData.current_workflow_stage_id && caseData.sla_value && caseData.sla_unit) {
      try {
        const { calculateSLAStatus } = require('../utils/slaCalculator');
        slaInfo = await calculateSLAStatus(caseId, {
          sla_value: caseData.sla_value,
          sla_unit: caseData.sla_unit,
          sla_warning_value: caseData.sla_warning_value,
          sla_warning_unit: caseData.sla_warning_unit
        });
      } catch (error) {
        console.error(`Error calculating SLA for case ${caseId}:`, error);
      }
    }

    // Get status history
    const [statusHistory] = await pool.execute(`
      SELECT 
        sh.*,
        u.full_name
      FROM status_history sh
      JOIN users u ON sh.changed_by = u.id
      WHERE sh.case_id = ?
      ORDER BY sh.created_at DESC
    `, [caseId]);

    // Get comments
    const [comments] = await pool.execute(`
      SELECT 
        cc.*,
        u.full_name
      FROM case_comments cc
      JOIN users u ON cc.user_id = u.id
      WHERE cc.case_id = ?
      ORDER BY cc.created_at DESC
    `, [caseId]);

    // Get attachments
    const [attachments] = await pool.execute(`
      SELECT 
        ca.*,
        u.full_name as uploaded_by_full_name
      FROM case_attachments ca
      JOIN users u ON ca.uploaded_by = u.id
      WHERE ca.case_id = ?
      ORDER BY ca.created_at DESC
    `, [caseId]);

    // Get workflow stage permissions for current user
    const { getWorkflowStagePermissions } = require('../middleware/auth');
    let workflowPermissions = null;
    if (caseData.current_workflow_stage_id) {
      workflowPermissions = await getWorkflowStagePermissions(
        req.user.id,
        req.user.role,
        caseData.current_workflow_stage_id
      );
    }

    res.json({
      case: caseData,
      statusHistory,
      comments,
      attachments,
      workflowPermissions, // Permissions for current workflow stage
      slaInfo // SLA status information
    });
  } catch (error) {
    console.error('Get case error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available counselors for case assignment (filtered by jamiat/jamaat if applicable)
// IMPORTANT: This route must come BEFORE /:caseId route, otherwise "available-counselors" will be matched as a caseId
router.get('/available-counselors', authenticateToken, async (req, res) => {
  try {
    const { caseId, jamiat_id, jamaat_id } = req.query;
    const userRole = req.user.role;

    // First, get the Counselor workflow stage ID(s)
    const [counselorStages] = await pool.execute(
      `SELECT id FROM workflow_stages 
       WHERE (stage_key LIKE '%counselor%' OR stage_key = 'counselor') 
       AND is_active = TRUE`
    );

    if (counselorStages.length === 0) {
      console.log('[available-counselors] No Counselor workflow stage found');
      return res.json({ counselors: [], message: 'No Counselor workflow stage found' });
    }

    const counselorStageIds = counselorStages.map(s => s.id);
    console.log('[available-counselors] Counselor stage IDs:', counselorStageIds);

    let query = `
      SELECT DISTINCT
        u.id,
        u.full_name,
        u.email,
        u.role,
        u.jamiat_ids,
        u.jamaat_ids
      FROM users u
      INNER JOIN workflow_stage_users wsu ON u.id = wsu.user_id
      WHERE u.role = 'counselor' 
        AND u.is_active = TRUE
        AND wsu.workflow_stage_id IN (${counselorStageIds.map(() => '?').join(',')})
    `;

    const queryParams = [...counselorStageIds];

    // If caseId provided, filter by case location
    if (caseId) {
      const [caseData] = await pool.execute(
        'SELECT assigned_counselor_id, jamiat_id, jamaat_id FROM cases WHERE id = ?',
        [caseId]
      );
      
      if (caseData.length > 0) {
        const assignedCounselorId = caseData[0].assigned_counselor_id;
        const caseJamiatId = caseData[0].jamiat_id;
        const caseJamaatId = caseData[0].jamaat_id;

        console.log(`[available-counselors] Case ${caseId}: jamiat_id=${caseJamiatId}, jamaat_id=${caseJamaatId || 'NULL'}`);

        // Filter by jamiat/jamaat if case has them
        if (caseJamiatId || caseJamaatId) {
          query += ` AND (
            FIND_IN_SET(?, u.jamiat_ids) > 0 
            OR FIND_IN_SET(?, u.jamaat_ids) > 0
            OR (u.jamiat_ids IS NULL AND u.jamaat_ids IS NULL)
          )`;
          queryParams.push(caseJamiatId, caseJamaatId);
          console.log(`[available-counselors] Adding location filter: jamiat_id=${caseJamiatId}, jamaat_id=${caseJamaatId || 'NULL'}`);
        } else {
          console.log('[available-counselors] Case has no jamiat/jamaat, showing all counselors');
        }

        // Include currently assigned counselor in results (don't exclude them)
        // The query already shows all counselors, so assigned one will be included
      } else {
        console.log(`[available-counselors] Case ${caseId} not found`);
      }
    } else if (jamiat_id || jamaat_id) {
      // Filter by provided jamiat/jamaat
      query += ` AND (
        FIND_IN_SET(?, u.jamiat_ids) > 0 
        OR FIND_IN_SET(?, u.jamaat_ids) > 0
        OR (u.jamiat_ids IS NULL AND u.jamaat_ids IS NULL)
      )`;
      queryParams.push(jamiat_id || null, jamaat_id || null);
      console.log(`[available-counselors] Filtering by provided: jamiat_id=${jamiat_id || 'NULL'}, jamaat_id=${jamaat_id || 'NULL'}`);
    } else {
      console.log('[available-counselors] No caseId or location provided, showing all counselors');
    }

    query += ' ORDER BY u.full_name ASC';

    console.log('[available-counselors] Executing query with params:', queryParams);
    const [counselors] = await pool.execute(query, queryParams);
    console.log(`[available-counselors] Found ${counselors.length} counselor(s)`);

    res.json({ counselors });
  } catch (error) {
    console.error('[available-counselors] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get counselor permissions for all workflow stages
router.get('/counselor-permissions/:counselorId', authenticateToken, authorizePermission('cases', 'read'), async (req, res) => {
  try {
    const { counselorId } = req.params;

    // Get counselor details
    const [counselors] = await pool.execute(
      'SELECT id, full_name, email, role FROM users WHERE id = ? AND role = ?',
      [counselorId, 'counselor']
    );

    if (counselors.length === 0) {
      return res.status(404).json({ error: 'Counselor not found' });
    }

    const counselor = counselors[0];

    // Get all workflow stages
    const [stages] = await pool.execute(
      'SELECT id, stage_name, stage_key, sort_order FROM workflow_stages WHERE is_active = TRUE ORDER BY sort_order ASC'
    );

    // Get permissions for each stage
    const { getWorkflowStagePermissions } = require('../middleware/auth');
    const stagePermissions = [];

    for (const stage of stages) {
      const permissions = await getWorkflowStagePermissions(counselorId, 'counselor', stage.id);
      stagePermissions.push({
        stage: {
          id: stage.id,
          stage_name: stage.stage_name,
          stage_key: stage.stage_key,
          sort_order: stage.sort_order
        },
        permissions
      });
    }

    res.json({
      counselor: {
        id: counselor.id,
        full_name: counselor.full_name,
        email: counselor.email
      },
      stagePermissions
    });
  } catch (error) {
    console.error('Get counselor permissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new case
router.post('/', authenticateToken, authorizePermission('cases', 'create'), async (req, res) => {
  try {
    const { 
      applicant_id, 
      case_type_id, 
      status_id,
      roles, 
      assigned_counselor_id,
      jamiat_id,
      jamaat_id,
      assigned_role,
      description,
      notes,
      workflow_stage_id,
      // Optional applicant data for auto-creation
      applicant_data
    } = req.body;

    let finalApplicantId = applicant_id;
    // Store internal IDs for case creation (will be looked up if applicant_data is provided)
    let jamiatInternalId = null;
    let jamaatInternalId = null;

    // If applicant_id is not provided but applicant_data is present, create applicant first
    if (!finalApplicantId && applicant_data) {
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
        jamaat_name
      } = applicant_data;

      // Validate required applicant fields
      if (!its_number || !first_name || !last_name) {
        return res.status(400).json({ error: 'ITS number, first name, and last name are required when creating applicant' });
      }

      // Check if ITS number already exists
      const [existingApplicants] = await pool.execute(
        'SELECT id FROM applicants WHERE its_number = ?',
        [its_number]
      );

      if (existingApplicants.length > 0) {
        // Use existing applicant
        finalApplicantId = existingApplicants[0].id;
        // Still need to look up internal IDs for case creation
        const applicantJamiatId = applicant_data.jamiat_id || jamiat_id;
        const applicantJamaatId = applicant_data.jamaat_id || jamaat_id;
        
        if (applicantJamiatId) {
          try {
            const [jamiatResult] = await pool.execute(
              'SELECT id FROM jamiat WHERE jamiat_id = ?',
              [applicantJamiatId]
            );
            jamiatInternalId = jamiatResult.length > 0 ? jamiatResult[0].id : null;
          } catch (dbError) {
            console.error('Error looking up jamiat internal ID:', dbError);
          }
        }
        
        if (applicantJamaatId) {
          try {
            let jamaatQuery = 'SELECT id FROM jamaat WHERE jamaat_id = ?';
            const jamaatParams = [applicantJamaatId];
            
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
      } else {
        // Look up internal IDs from database for foreign key constraints
        const applicantJamiatId = applicant_data.jamiat_id || jamiat_id;
        const applicantJamaatId = applicant_data.jamaat_id || jamaat_id;
        
        if (applicantJamiatId) {
          try {
            const [jamiatResult] = await pool.execute(
              'SELECT id FROM jamiat WHERE jamiat_id = ?',
              [applicantJamiatId]
            );
            jamiatInternalId = jamiatResult.length > 0 ? jamiatResult[0].id : null;
          } catch (dbError) {
            console.error('Error looking up jamiat internal ID:', dbError);
          }
        }
        
        if (applicantJamaatId) {
          try {
            let jamaatQuery = 'SELECT id FROM jamaat WHERE jamaat_id = ?';
            const jamaatParams = [applicantJamaatId];
            
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

        // Create applicant
        const [applicantResult] = await pool.execute(`
          INSERT INTO applicants (
            its_number, full_name, age, gender, 
            phone, email, photo, address, jamiat_name, jamaat_name, jamiat_id, jamaat_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          its_number, `${first_name} ${last_name}`.trim(), age, gender,
          phone, email, photo || null, address, jamiat_name, jamaat_name, jamiatInternalId, jamaatInternalId
        ]);

        finalApplicantId = applicantResult.insertId;
        console.log(`[Create Case] Auto-created applicant with ID: ${finalApplicantId}`);
      }
    } else if (finalApplicantId && (jamiat_id || jamaat_id)) {
      // If applicant_id is provided but we have external jamiat/jamaat IDs, look up internal IDs
      const externalJamiatId = jamiat_id;
      const externalJamaatId = jamaat_id;
      
      if (externalJamiatId) {
        try {
          const [jamiatResult] = await pool.execute(
            'SELECT id FROM jamiat WHERE jamiat_id = ?',
            [externalJamiatId]
          );
          jamiatInternalId = jamiatResult.length > 0 ? jamiatResult[0].id : null;
        } catch (dbError) {
          console.error('Error looking up jamiat internal ID:', dbError);
        }
      }
      
      if (externalJamaatId) {
        try {
          let jamaatQuery = 'SELECT id FROM jamaat WHERE jamaat_id = ?';
          const jamaatParams = [externalJamaatId];
          
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
    }

    if (!finalApplicantId || !case_type_id) {
      return res.status(400).json({ error: 'Applicant ID and case type are required' });
    }

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

    // Check if user can create cases in this stage
    if (stageId) {
      const canCreate = await canCreateCaseInStage(req.user.id, req.user.role, stageId);
      if (!canCreate) {
        return res.status(403).json({ error: 'You do not have permission to create cases in this workflow stage' });
      }
    }

    // Get case type name for case number generation
    const [caseTypeResult] = await pool.execute(
      'SELECT name FROM case_types WHERE id = ?',
      [case_type_id]
    );

    if (caseTypeResult.length === 0) {
      return res.status(400).json({ error: 'Invalid case type' });
    }

    const caseTypeName = caseTypeResult[0].name;

    // Generate a temporary unique case number (will be replaced after insert)
    const caseNumber = `${caseTypeName.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    // Get default status if not provided
    let finalStatusId = status_id;
    if (!finalStatusId) {
      const [defaultStatus] = await pool.execute(
        'SELECT id FROM statuses WHERE name = ?',
        ['draft']
      );
      finalStatusId = defaultStatus[0]?.id;
    }

    // Create case - use internal IDs if they were looked up, otherwise use external IDs from request
    const finalJamiatId = jamiatInternalId !== null ? jamiatInternalId : jamiat_id;
    const finalJamaatId = jamaatInternalId !== null ? jamaatInternalId : jamaat_id;
    
    const [result] = await pool.execute(`
      INSERT INTO cases (case_number, applicant_id, case_type_id, status_id, roles, assigned_counselor_id, 
                        jamiat_id, jamaat_id, assigned_role, description, notes, created_by, current_workflow_stage_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [caseNumber, finalApplicantId, case_type_id, finalStatusId, roles, assigned_counselor_id, 
        finalJamiatId, finalJamaatId, assigned_role, description, notes, req.user.id, stageId]);

    const caseId = result.insertId;

    // Update case_number to sequential BS-0001 style using the inserted ID
    const formattedCaseNumber = `BS-${String(caseId).padStart(4, '0')}`;
    await pool.execute(
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

    await pool.execute(`
      UPDATE cases SET workflow_history = ? WHERE id = ?
    `, [JSON.stringify(workflowHistory), caseId]);

    // Determine final status based on assignment
    // If roles are assigned, set status to 'assigned', otherwise 'draft'
    let finalStatus = 'draft';
    if (roles) {
      finalStatus = 'assigned';
      // Send assignment notifications if both roles and counselor are assigned
      if (assigned_counselor_id) {
        await notificationService.sendCaseAssignmentNotification(
          caseId,
          roles,
          assigned_counselor_id,
          req.user
        );
      }
      
      // Update workflow stage to case assignment stage when case is assigned
      await updateCaseWorkflowStage(
        caseId,
        finalStatus,
        req.user.id,
        req.user.full_name || req.user.username,
        'case_assigned',
        case_type_id
      );
    }
    
    // If status is draft, make sure workflow stage is set to draft stage
    if (finalStatus === 'draft') {
      await updateCaseWorkflowStage(
        caseId,
        finalStatus,
        req.user.id,
        req.user.full_name || req.user.username,
        'case_created',
        case_type_id
      );
    }

    // Update case status to final status
    await pool.execute(`
      UPDATE cases SET status = ? WHERE id = ?
    `, [finalStatus, caseId]);

    // Log status change
    await pool.execute(`
      INSERT INTO status_history (case_id, to_status, changed_by, comments)
      VALUES (?, ?, ?, ?)
    `, [caseId, finalStatus, req.user.id, roles ? 'Case created and assigned' : 'Case created']);

    res.status(201).json({
      message: 'Case created successfully',
      caseId,
      caseNumber: formattedCaseNumber
    });
  } catch (error) {
    console.error('Create case error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    console.error('User:', { id: req.user?.id, role: req.user?.role });
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update case
router.put('/:caseId', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { 
      assigned_roles, 
      assigned_counselor_id, 
      estimated_end_date,
      status 
    } = req.body;

    const userId = req.user.id;
    const userRole = req.user.role;

    // Get current case status
    const [currentCase] = await pool.execute(`
      SELECT c.status 
      FROM cases c 
      WHERE c.id = ?
    `, [caseId]);

    if (currentCase.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const currentStatusName = currentCase[0].status;
    let updateFields = [];
    let updateValues = [];

    // Get current case assignments to check if both roles and counselor will be assigned
    const [caseAssignments] = await pool.execute(`
      SELECT roles, assigned_counselor_id FROM cases WHERE id = ?
    `, [caseId]);
    
    const currentRoles = caseAssignments[0]?.roles;
    const currentCounselor = caseAssignments[0]?.assigned_counselor_id;
    
    // Determine final assignments (use new values if provided, otherwise keep current)
    const finalRoles = assigned_roles !== undefined ? assigned_roles : currentRoles;
    const finalCounselor = assigned_counselor_id !== undefined ? assigned_counselor_id : currentCounselor;

    // Check permissions for assignment operations
    // Note: super_admin always has all permissions (handled by hasPermission)
    // For backward compatibility, admin can still assign without explicit permission
    if (assigned_roles !== undefined) {
      const canAssignCase = await hasPermission(userRole, 'cases', 'assign_case');
      if (!canAssignCase && userRole !== 'admin') {
        return res.status(403).json({ error: 'You do not have permission to assign cases' });
      }
      updateFields.push('roles = ?');
      updateValues.push(assigned_roles);
    }
    
    if (assigned_counselor_id !== undefined) {
      const canAssignCounselor = await hasPermission(userRole, 'cases', 'assign_counselor');
      if (!canAssignCounselor && userRole !== 'admin') {
        return res.status(403).json({ error: 'You do not have permission to assign counselors' });
      }
      updateFields.push('assigned_counselor_id = ?');
      updateValues.push(assigned_counselor_id);
    }

    // Check if user has permission to update estimated end date
    const canUpdateEndDate = await hasPermission(userRole, 'cases', 'update');
    if (canUpdateEndDate && estimated_end_date !== undefined) {
      updateFields.push('estimated_end_date = ?');
      updateValues.push(estimated_end_date);
    }

    // Auto-update status based on assignments
    // If roles (DCM) is assigned, set status to 'assigned'
    // If roles is unassigned, set status to 'draft'
    let autoStatusChange = null;
    if (finalRoles && (finalRoles !== currentRoles)) {
      // Roles will be assigned after this update
      if (!status || status === currentStatusName) {
        // Only auto-update if status wasn't explicitly changed
        autoStatusChange = 'assigned';
        updateFields.push('status = ?');
        updateValues.push('assigned');
        // Send assignment notifications if newly assigned
        if (assigned_roles !== undefined && assigned_roles !== currentRoles) {
          await notificationService.sendCaseAssignmentNotification(
            caseId,
            finalRoles,
            finalCounselor,
            req.user
          );
        }
      }
    } else if (!finalRoles && finalRoles !== currentRoles) {
      // Roles will be unassigned after this update
      if (!status || status === currentStatusName) {
        // Only auto-update if status wasn't explicitly changed
        autoStatusChange = 'draft';
        updateFields.push('status = ?');
        updateValues.push('draft');
      }
    }

    // Status updates based on role and current status (explicit status change)
    if (status && status !== currentStatusName) {
      // Admin and super_admin can transition to any status
      if (userRole === 'admin' || userRole === 'super_admin') {
        // Update the status directly (it's an ENUM field)
        updateFields.push('status = ?');
        updateValues.push(status);
      } else {
        // For other roles, use the transition validation
        const validTransitions = getValidStatusTransitions(currentStatusName, userRole);
        if (validTransitions.includes(status)) {
          // Update the status directly (it's an ENUM field)
          updateFields.push('status = ?');
          updateValues.push(status);
        } else {
          return res.status(400).json({ error: 'Invalid status transition' });
        }
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateValues.push(caseId);

    await pool.execute(
      `UPDATE cases SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Log status change if status was updated (explicit or auto)
    const finalStatusChange = status || autoStatusChange;
    if (finalStatusChange && finalStatusChange !== currentStatusName) {
      // Get case type for workflow stage lookup
      const [caseInfo] = await pool.execute(
        'SELECT case_type_id FROM cases WHERE id = ?',
        [caseId]
      );
      const caseTypeId = caseInfo.length > 0 ? caseInfo[0].case_type_id : null;

      await pool.execute(`
        INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments)
        VALUES (?, ?, ?, ?, ?)
      `, [caseId, currentStatusName, finalStatusChange, userId, `Status changed to ${finalStatusChange}`]);

      // Update workflow stage based on new status
      await updateCaseWorkflowStage(
        caseId,
        finalStatusChange,
        userId,
        req.user.full_name || req.user.username,
        autoStatusChange ? (autoStatusChange === 'assigned' ? 'case_assigned' : 'case_unassigned') : 'status_changed',
        caseTypeId
      );

      // Send status change notifications
      await notificationService.sendCaseStatusNotification(
        caseId,
        currentStatusName,
        finalStatusChange,
        req.user,
        req.body.comments || ''
      );
    }

    res.json({ message: 'Case updated successfully' });
  } catch (error) {
    console.error('Update case error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete case (admin only)
router.delete('/:caseId', authenticateToken, authorizePermission('cases', 'delete'), async (req, res) => {
  try {
    const { caseId } = req.params;

    const [result] = await pool.execute('DELETE FROM cases WHERE id = ?', [caseId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    res.json({ message: 'Case deleted successfully' });
  } catch (error) {
    console.error('Delete case error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Welfare department approval endpoint
router.put('/:caseId/welfare-approve', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has welfare reviewer role or super admin
    const normalizedRole = userRole?.toLowerCase();
    if (normalizedRole !== 'welfare_reviewer' && normalizedRole !== 'welfare' && userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only welfare department or super admin can approve cases' });
    }

    // Get case details
    const [cases] = await pool.execute(
      `SELECT c.*, a.full_name, a.its_number
       FROM cases c 
       JOIN applicants a ON c.applicant_id = a.id
       WHERE c.id = ?`,
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = cases[0];

    // Check if case is in correct status
    if (caseData.status !== 'submitted_to_welfare') {
      return res.status(400).json({ error: 'Case must be submitted to welfare department before approval' });
    }

    // Check if checklist is completed and submitted
    const [totalItems] = await pool.execute(
      'SELECT COUNT(*) as count FROM welfare_checklist_items WHERE is_active = TRUE'
    );
    const [filledResponses] = await pool.execute(
      'SELECT COUNT(DISTINCT checklist_item_id) as count FROM welfare_checklist_responses WHERE case_id = ?',
      [caseId]
    );
    
    const total = totalItems[0].count || 0;
    const filled = filledResponses[0].count || 0;
    
    // If there are checklist items but no responses at all, checklist hasn't been submitted
    if (total > 0 && filled === 0) {
      return res.status(400).json({ 
        error: 'Submit the checklist and then click on approve button'
      });
    }
    
    // If checklist is partially filled but not complete
    if (total > 0 && filled > 0 && filled < total) {
      return res.status(400).json({ 
        error: `Checklist incomplete. Please complete all checklist items before approving. (${filled}/${total} completed)` 
      });
    }

    // Start transaction
    await pool.query('START TRANSACTION');

    try {
      // Get case type for workflow stage lookup
      const [caseInfo] = await pool.execute(
        'SELECT case_type_id FROM cases WHERE id = ?',
        [caseId]
      );
      const caseTypeId = caseInfo.length > 0 ? caseInfo[0].case_type_id : null;

      // Update status to submitted_to_zi (going to ZI stage after welfare)
      const newStatus = 'submitted_to_zi';

      // Get ZI Review stage ID directly to ensure correct stage assignment
      const [ziStages] = await pool.execute(
        "SELECT id FROM workflow_stages WHERE (stage_key LIKE '%zi%' OR stage_key LIKE '%zonal%') AND is_active = TRUE ORDER BY sort_order LIMIT 1"
      );
      
      const ziStageId = ziStages.length > 0 ? ziStages[0].id : null;
      
      if (!ziStageId) {
        throw new Error('ZI Review stage not found. Please configure workflow stages.');
      }

      // Update case status and workflow stage together
      await pool.execute(
        'UPDATE cases SET status = ?, current_workflow_stage_id = ? WHERE id = ?',
        [newStatus, ziStageId, caseId]
      );

      // Update workflow history (pass ziStageId to prevent override)
      await updateCaseWorkflowStage(
        caseId,
        newStatus,
        userId,
        req.user.full_name || req.user.username,
        'welfare_approved',
        caseTypeId,
        ziStageId
      );

      // Log status change
      await pool.execute(
        `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments) 
         VALUES (?, ?, ?, ?, ?)`,
        [caseId, 'submitted_to_welfare', newStatus, userId, comments || 'Case approved by welfare department and forwarded to ZI Review']
      );

      // Add welfare approval comment
      // #region agent log
      const commentTypeValue = 'approval';
      fetch('http://127.0.0.1:7242/ingest/bfa26678-5497-4bdc-a2f0-ce1972c9f199',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cases.js:1577',message:'Before inserting case comment',data:{caseId,commentType:commentTypeValue,commentTypeLength:commentTypeValue.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      await pool.execute(
        `INSERT INTO case_comments (case_id, user_id, role_name, comment, comment_type, is_visible_to_dcm) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [caseId, userId, userRole, comments || 'Case approved by welfare department and forwarded to ZI Review', commentTypeValue, true]
      );
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bfa26678-5497-4bdc-a2f0-ce1972c9f199',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cases.js:1583',message:'After inserting case comment - success',data:{caseId},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Create notifications
      const notifications = [];

      // Notify assigned DCM (using roles field instead of assigned_dcm_id)
      if (caseData.roles) {
        notifications.push([
          caseData.roles,
          caseId,
          'Case Approved by Welfare Department',
          `Case ${caseData.case_number} for ${caseData.full_name} has been approved by welfare department and forwarded to ZI Review.`,
          'success'
        ]);
      }

      // Mark cover letter form as approved
      const [coverLetterForms] = await pool.execute(
        'SELECT id FROM cover_letter_forms WHERE case_id = ?',
        [caseId]
      );
      if (coverLetterForms.length > 0) {
        await pool.execute(
          'UPDATE cover_letter_forms SET is_approved = TRUE, approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE case_id = ?',
          [userId, caseId]
        );
      }

      // Notify ZI users
      const [ziUsers] = await pool.execute(
        'SELECT id FROM users WHERE role = "ZI" AND is_active = TRUE'
      );

      for (const ziUser of ziUsers) {
        notifications.push([
          ziUser.id,
          caseId,
          'Case Ready for ZI Review',
          `Case ${caseData.case_number} for ${caseData.full_name} has been approved by welfare department and is ready for ZI review.`,
          'info'
        ]);
      }

      // Insert all notifications
      for (const notification of notifications) {
        await pool.execute(
          `INSERT INTO notifications (user_id, case_id, title, message, type) 
           VALUES (?, ?, ?, ?, ?)`,
          notification
        );
      }

      // Commit transaction
      await pool.query('COMMIT');

      res.json({ 
        message: 'Case approved successfully by welfare department and forwarded to ZI Review',
        caseId: caseId,
        caseNumber: caseData.case_number
      });

    } catch (error) {
      // Rollback transaction on error
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bfa26678-5497-4bdc-a2f0-ce1972c9f199',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cases.js:1631',message:'Transaction error caught',data:{errorMessage:error.message,errorCode:error.code,caseId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Welfare approval error:', error);
    console.error('Error stack:', error.stack);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bfa26678-5497-4bdc-a2f0-ce1972c9f199',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cases.js:1637',message:'Welfare approval outer catch',data:{errorMessage:error.message,errorCode:error.code,stack:error.stack?.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Welfare department rework endpoint
router.put('/:caseId/welfare-reject', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has welfare reviewer role or super admin
    const normalizedRole = userRole?.toLowerCase();
    if (normalizedRole !== 'welfare_reviewer' && normalizedRole !== 'welfare' && userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only welfare department or super admin can send cases for rework' });
    }

    // Comments are required for rejection
    if (!comments || comments.trim().length === 0) {
      return res.status(400).json({ error: 'Comments are required when sending a case for rework' });
    }

    // Get case details
    const [cases] = await pool.execute(
      `SELECT c.*, a.first_name, a.last_name, a.its_number, 
              dcm.first_name as dcm_first_name, dcm.last_name as dcm_last_name, dcm.email as dcm_email
       FROM cases c 
       JOIN applicants a ON c.applicant_id = a.id
       LEFT JOIN users dcm ON c.assigned_dcm_id = dcm.id
       WHERE c.id = ?`,
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = cases[0];

    // Check if case is in correct status
    if (caseData.status !== 'submitted_to_welfare') {
      return res.status(400).json({ error: 'Case must be submitted to welfare department before sending for rework' });
    }

    // Start transaction
    await pool.execute('START TRANSACTION');

    try {
      // Get case type for workflow stage lookup
      const [caseInfo] = await pool.execute(
        'SELECT case_type_id FROM cases WHERE id = ?',
        [caseId]
      );
      const caseTypeId = caseInfo.length > 0 ? caseInfo[0].case_type_id : null;

      // Update case status to welfare_rejected and reopen for assigned user (rework)
      await pool.execute(
        'UPDATE cases SET status = "welfare_rejected" WHERE id = ?',
        [caseId]
      );

      // Update workflow stage (moves back to counselor stage)
      await updateCaseWorkflowStage(
        caseId,
        'welfare_rejected',
        userId,
        req.user.full_name || req.user.username,
        'welfare_rejected',
        caseTypeId
      );

      // Log status change
      await pool.execute(
        `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments) 
         VALUES (?, ?, ?, ?, ?)`,
        [caseId, 'submitted_to_welfare', 'welfare_rejected', userId, comments]
      );

      // Add rework comment
      await pool.execute(
        `INSERT INTO case_comments (case_id, user_id, comment, comment_type) 
         VALUES (?, ?, ?, ?)`,
        [caseId, userId, comments, 'rework']
      );

      // Create notifications for assigned DCM
      if (caseData.assigned_dcm_id) {
        await pool.execute(
          `INSERT INTO notifications (user_id, case_id, title, message, type) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            caseData.assigned_dcm_id,
            caseId,
            'Case Sent for Rework by Welfare Department',
            `Case ${caseData.case_number} for ${caseData.first_name} ${caseData.last_name} has been sent for rework by welfare department. Please review the comments and make necessary changes.`,
            'error'
          ]
        );
      }

      // Commit transaction
      await pool.execute('COMMIT');

      res.json({ 
        message: 'Case sent for rework by welfare department',
        caseId: caseId,
        caseNumber: caseData.case_number
      });

    } catch (error) {
      // Rollback transaction on error
      await pool.execute('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Welfare rework error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get case comments
router.get('/:caseId/comments', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;

    const [comments] = await pool.execute(
      `SELECT cc.*, u.full_name, u.role
       FROM case_comments cc
       JOIN users u ON cc.user_id = u.id
       WHERE cc.case_id = ?
       ORDER BY cc.created_at DESC`,
      [caseId]
    );

    res.json({ comments });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add case comment
router.post('/:caseId/comments', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comment, comment_type = 'general' } = req.body;
    const userId = req.user.id;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    // Verify case exists
    const [cases] = await pool.execute('SELECT id FROM cases WHERE id = ?', [caseId]);
    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const [result] = await pool.execute(
      `INSERT INTO case_comments (case_id, user_id, comment, comment_type) 
       VALUES (?, ?, ?, ?)`,
      [caseId, userId, comment.trim(), comment_type]
    );

    // Get the created comment with user details
    const [newComment] = await pool.execute(
      `SELECT cc.*, u.full_name, u.role
       FROM case_comments cc
       JOIN users u ON cc.user_id = u.id
       WHERE cc.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ 
      message: 'Comment added successfully',
      comment: newComment[0]
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workflow comments for a specific step
router.get('/:caseId/workflow-comments/:workflowStep', authenticateToken, async (req, res) => {
  try {
    const { caseId, workflowStep } = req.params;
    const userRole = req.user.role;

    // Check if user has permission to view comments
    const canViewComments = await hasPermission(userRole, 'counseling_forms', 'comment');
    
    if (!canViewComments) {
      return res.status(403).json({ error: 'You do not have permission to view comments' });
    }

    const [comments] = await pool.execute(`
      SELECT 
        wc.*,
        u.full_name,
        u.email
      FROM workflow_comments wc
      JOIN users u ON wc.user_id = u.id
      WHERE wc.case_id = ? AND wc.workflow_step = ?
      ORDER BY wc.created_at DESC
    `, [caseId, workflowStep]);

    res.json({ comments });
  } catch (error) {
    console.error('Get workflow comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add workflow comment
router.post('/:caseId/workflow-comments', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comment, comment_type, workflow_step } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has permission to add comments
    const canAddComments = await hasPermission(userRole, 'counseling_forms', 'comment');
    
    if (!canAddComments) {
      return res.status(403).json({ error: 'You do not have permission to add comments' });
    }

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ error: 'Comment is required' });
    }

    if (!workflow_step) {
      return res.status(400).json({ error: 'Workflow step is required' });
    }

    // Verify case exists
    const [cases] = await pool.execute(
      'SELECT id FROM cases WHERE id = ?',
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const [result] = await pool.execute(
      `INSERT INTO workflow_comments (case_id, user_id, comment, comment_type, workflow_step) 
       VALUES (?, ?, ?, ?, ?)`,
      [caseId, userId, comment.trim(), comment_type || 'general', workflow_step]
    );

    // Get the created comment with user details
    const [newComment] = await pool.execute(
      `SELECT wc.*, u.full_name, u.email
       FROM workflow_comments wc
       JOIN users u ON wc.user_id = u.id
       WHERE wc.id = ?`,
      [result.insertId]
    );

    res.status(201).json({ 
      message: 'Workflow comment added successfully',
      comment: newComment[0]
    });
  } catch (error) {
    console.error('Add workflow comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generic workflow approval/rejection endpoint
// This endpoint works for ALL workflow stages automatically based on permissions
router.put('/:caseId/workflow-action', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { action, comments } = req.body; // action: 'approve' | 'reject'
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate action
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'Action must be either "approve" or "reject"' });
    }

    // Get case details
    const [cases] = await pool.execute(
      `SELECT c.*, a.full_name, a.its_number
       FROM cases c 
       JOIN applicants a ON c.applicant_id = a.id
       WHERE c.id = ?`,
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = cases[0];

    // Get current workflow stage
    if (!caseData.current_workflow_stage_id) {
      return res.status(400).json({ error: 'Case has no workflow stage assigned' });
    }

    const [currentStages] = await pool.execute(
      'SELECT * FROM workflow_stages WHERE id = ? AND is_active = TRUE',
      [caseData.current_workflow_stage_id]
    );

    if (currentStages.length === 0) {
      return res.status(400).json({ error: 'Current workflow stage not found or inactive' });
    }

    const currentStage = currentStages[0];

    // Check user permissions for this stage
    const { checkWorkflowStagePermission } = require('../middleware/auth');
    const canApprove = await checkWorkflowStagePermission(userId, userRole, currentStage.id, 'approve');
    const canReject = await checkWorkflowStagePermission(userId, userRole, currentStage.id, 'reject');

    if (action === 'approve' && !canApprove) {
      return res.status(403).json({ error: 'You do not have permission to approve cases in this stage' });
    }

    if (action === 'reject' && !canReject) {
      return res.status(403).json({ error: 'You do not have permission to reject cases in this stage' });
    }

    // Validate comments for rejection (if required)
    if (action === 'reject' && (currentStage.requires_comments_on_reject === 1 || currentStage.requires_comments_on_reject === TRUE) && (!comments || !comments.trim())) {
      return res.status(400).json({ error: 'Comments are required when rejecting a case' });
    }

    // Executive level validation: Check if user's executive level matches case's current level
    if (action === 'approve') {
      const isExecutiveStage = currentStage.stage_key && (currentStage.stage_key.includes('executive') || currentStage.stage_key === 'executive');
      
      if (isExecutiveStage && caseData.current_executive_level) {
        // Check if user's executive level matches the case's current level
        // Allow admin and super_admin to bypass this check (they can approve any level)
        if (userRole === 'Executive Management' && req.user.executive_level !== caseData.current_executive_level) {
          return res.status(403).json({ 
            error: 'You can only approve cases assigned to your executive level. This case is at Executive Level ' + caseData.current_executive_level 
          });
        }
      }
    }

    // Start transaction
    await pool.query('START TRANSACTION');

    try {
      let newStatus, newStageId, notificationMessage, actionType;

      if (action === 'approve') {
        // Special handling: If case is already at Executive stage, handle executive level progression
        const isExecutiveStage = currentStage.stage_key && (currentStage.stage_key.includes('executive') || currentStage.stage_key === 'executive');
        
        if (isExecutiveStage && caseData.current_executive_level) {
          // Case is at Executive stage - handle level progression
          const [levels] = await pool.execute(
            'SELECT level_number, level_name FROM executive_levels WHERE is_active = TRUE ORDER BY sort_order'
          );
          
          if (levels.length === 0) {
            throw new Error('No active executive levels found. Please configure executive levels first.');
          }
          
          // Find current level position
          const currentIndex = levels.findIndex(l => l.level_number === caseData.current_executive_level);
          
          if (currentIndex === -1) {
            throw new Error(`Current executive level ${caseData.current_executive_level} not found in active levels`);
          }
          
          const isLastLevel = currentIndex === levels.length - 1;
          
          if (isLastLevel) {
            // Final executive approval - move to finance disbursement
            // Find finance stage
            const [financeStages] = await pool.execute(
              "SELECT * FROM workflow_stages WHERE (stage_key LIKE '%finance%' OR stage_key LIKE '%disbursement%') AND is_active = TRUE ORDER BY sort_order LIMIT 1"
            );
            
            if (financeStages.length > 0) {
              newStatus = 'finance_disbursement';
              newStageId = financeStages[0].id;
              await pool.execute(
                'UPDATE cases SET current_executive_level = NULL WHERE id = ?',
                [caseId]
              );
              notificationMessage = `Case approved by ${levels[currentIndex].level_name} and moved to finance disbursement`;
            } else {
              throw new Error('Finance disbursement stage not found');
            }
          } else {
            // Move to next executive level (stay in same stage, just update level)
            const nextLevel = levels[currentIndex + 1];
            newStatus = `submitted_to_executive_${nextLevel.level_number}`;
            newStageId = currentStage.id; // Stay in Executive stage
            await pool.execute(
              'UPDATE cases SET current_executive_level = ? WHERE id = ?',
              [nextLevel.level_number, caseId]
            );
            notificationMessage = `Case approved by ${levels[currentIndex].level_name} and forwarded to ${nextLevel.level_name}`;
          }
          
          actionType = 'executive_approved';
        } else {
          // Normal workflow progression - get next stage
          let nextStage = null;
          
          // Get case type for filtering
          const caseTypeId = caseData.case_type_id || null;
          
          // Strategy 1: Use next_stage_id if set (explicit link)
          if (currentStage.next_stage_id) {
            let nextStageQuery = 'SELECT * FROM workflow_stages WHERE id = ? AND is_active = TRUE';
            const nextStageParams = [currentStage.next_stage_id];
            
            // Add case_type_id filter if provided
            if (caseTypeId) {
              nextStageQuery += ' AND (case_type_id = ? OR case_type_id IS NULL)';
              nextStageParams.push(caseTypeId);
            }
            
            const [nextStages] = await pool.execute(nextStageQuery, nextStageParams);
            if (nextStages.length > 0) {
              nextStage = nextStages[0];
            }
          }
          
          // Strategy 2: Use sort_order to find next stage dynamically
          // This adapts automatically when stages are reordered via drag-and-drop
          if (!nextStage) {
            // Get case type for filtering
            const caseTypeId = caseData.case_type_id || null;
            
            let nextStageQuery = 'SELECT * FROM workflow_stages WHERE is_active = TRUE AND sort_order > ?';
            const nextStageParams = [currentStage.sort_order];
            
            // Add case_type_id filter if provided
            if (caseTypeId) {
              nextStageQuery += ' AND (case_type_id = ? OR case_type_id IS NULL)';
              nextStageParams.push(caseTypeId);
            }
            
            nextStageQuery += ' ORDER BY CASE WHEN case_type_id IS NULL THEN 1 ELSE 0 END, sort_order ASC LIMIT 1';
            
            const [nextStages] = await pool.execute(nextStageQuery, nextStageParams);
            if (nextStages.length > 0) {
              nextStage = nextStages[0];
            }
          }

          if (!nextStage) {
            throw new Error('No next stage found in workflow');
          }

          // Get status from next stage's associated_statuses
          let statuses = [];
          if (nextStage.associated_statuses) {
            try {
              statuses = JSON.parse(nextStage.associated_statuses);
            } catch (e) {
              // If not JSON, generate from stage_key
              statuses = [`submitted_to_${nextStage.stage_key}`];
            }
          } else {
            // Auto-generate status from stage_key
            statuses = [`submitted_to_${nextStage.stage_key}`];
          }

          // Special handling for Executive stages - need to check executive levels (when moving TO executive)
          if (nextStage.stage_key && (nextStage.stage_key.includes('executive') || nextStage.stage_key === 'executive')) {
            // Get first active executive level
            const [execLevels] = await pool.execute(
              'SELECT level_number, level_name FROM executive_levels WHERE is_active = TRUE ORDER BY sort_order LIMIT 1'
            );
            
            if (execLevels.length > 0) {
              newStatus = `submitted_to_executive_${execLevels[0].level_number}`;
              // Also update executive level on the case
              await pool.execute(
                'UPDATE cases SET current_executive_level = ? WHERE id = ?',
                [execLevels[0].level_number, caseId]
              );
            } else {
              newStatus = statuses[0] || `submitted_to_executive_1`;
            }
          } else {
            newStatus = statuses[0] || `submitted_to_${nextStage.stage_key}`;
          }
          
          newStageId = nextStage.id;
          notificationMessage = `Case approved and forwarded to ${nextStage.stage_name}`;
          actionType = 'approved';
        }

      } else { // action === 'reject'
        // For rejection, always go back to Case Assignment stage
        // Strategy: Find Case Assignment stage by stage_key
        const [assignmentStages] = await pool.execute(
          "SELECT * FROM workflow_stages WHERE (stage_key LIKE '%assignment%' OR stage_key LIKE '%assign%') AND stage_key NOT LIKE '%draft%' AND is_active = TRUE LIMIT 1"
        );

        if (assignmentStages.length > 0) {
          const assignmentStage = assignmentStages[0];
          let statuses = [];
          if (assignmentStage.associated_statuses) {
            try {
              statuses = JSON.parse(assignmentStage.associated_statuses);
            } catch (e) {
              statuses = [`submitted_to_${assignmentStage.stage_key}`];
            }
          } else {
            statuses = ['assigned']; // Default status for assignment stage
          }
          newStatus = statuses[0] || 'assigned';
          newStageId = assignmentStage.id;
        } else {
          // Fallback: Find stage with lowest sort_order (first stage)
          const [firstStages] = await pool.execute(
            'SELECT * FROM workflow_stages WHERE is_active = TRUE ORDER BY sort_order ASC LIMIT 1'
          );
          if (firstStages.length > 0) {
            const firstStage = firstStages[0];
            let statuses = [];
            if (firstStage.associated_statuses) {
              try {
                statuses = JSON.parse(firstStage.associated_statuses);
              } catch (e) {
                statuses = [`submitted_to_${firstStage.stage_key}`];
              }
            } else {
              statuses = ['draft']; // Default fallback
            }
            newStatus = statuses[0] || 'draft';
            newStageId = firstStage.id;
          } else {
            throw new Error('No assignment stage found for rejection');
          }
        }

        notificationMessage = `Case rejected and sent back to Case Assignment stage`;
        actionType = 'rejected';
      }

      // Get case type
      const caseTypeId = caseData.case_type_id || null;

      // Check if stage is changing
      const stageChanged = caseData.current_workflow_stage_id !== newStageId;

      // Check if SLA columns exist
      let slaColumnsExist = false;
      try {
        const [columns] = await pool.execute(`
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'cases' 
          AND COLUMN_NAME = 'current_stage_entered_at'
        `);
        slaColumnsExist = columns.length > 0;
      } catch (error) {
        console.warn('Could not check for SLA columns:', error.message);
      }

      // Update case - set current_stage_entered_at when stage changes
      if (stageChanged && slaColumnsExist) {
        await pool.execute(
          'UPDATE cases SET status = ?, current_workflow_stage_id = ?, current_stage_entered_at = NOW(), sla_status = \'on_time\', sla_breached_at = NULL, sla_warning_sent_at = NULL, sla_breach_notification_sent_at = NULL WHERE id = ?',
          [newStatus, newStageId, caseId]
        );
      } else if (stageChanged) {
        // SLA columns don't exist, just update status and stage
        await pool.execute(
          'UPDATE cases SET status = ?, current_workflow_stage_id = ? WHERE id = ?',
          [newStatus, newStageId, caseId]
        );
      } else {
        await pool.execute(
          'UPDATE cases SET status = ?, current_workflow_stage_id = ? WHERE id = ?',
          [newStatus, newStageId, caseId]
        );
      }

      // If approving cover_letter stage, mark cover letter form as approved
      if (action === 'approve' && currentStage.stage_key === 'cover_letter') {
        const [coverLetterForms] = await pool.execute(
          'SELECT id FROM cover_letter_forms WHERE case_id = ?',
          [caseId]
        );
        if (coverLetterForms.length > 0) {
          await pool.execute(
            'UPDATE cover_letter_forms SET is_approved = TRUE, approved_at = CURRENT_TIMESTAMP, approved_by = ? WHERE case_id = ?',
            [userId, caseId]
          );
        }
      }

      // Update workflow history (pass newStageId to prevent override)
      await updateCaseWorkflowStage(
        caseId,
        newStatus,
        userId,
        req.user.full_name || req.user.username,
        actionType,
        caseTypeId,
        newStageId
      );

      // Log status change
      await pool.execute(
        `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments) 
         VALUES (?, ?, ?, ?, ?)`,
        [caseId, caseData.status, newStatus, userId, comments || notificationMessage]
      );

      // Add comment
      await pool.execute(
        `INSERT INTO case_comments (case_id, user_id, role_name, comment, comment_type, is_visible_to_dcm) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [caseId, userId, userRole, comments || notificationMessage, actionType === 'approved' ? 'approval' : 'rejection', true]
      );

      // Create notifications
      const notifications = [];

      // Notify assigned DCM (always notify DCM for both approve and reject)
      if (caseData.roles) {
        notifications.push([
          caseData.roles,
          caseId,
          `Case ${action === 'approve' ? 'Approved' : 'Rejected'}`,
          `Case ${caseData.case_number} for ${caseData.full_name} has been ${action === 'approve' ? 'approved' : 'rejected'}. ${notificationMessage}`,
          action === 'approve' ? 'success' : 'warning'
        ]);
      }

      if (action === 'approve') {
        // For approval: Notify users with permissions for next stage
        if (newStageId) {
          const [stageUsers] = await pool.execute(`
            SELECT DISTINCT u.id 
            FROM users u
            LEFT JOIN workflow_stage_users wsu ON u.id = wsu.user_id AND wsu.workflow_stage_id = ?
            LEFT JOIN workflow_stage_roles wsr ON wsr.workflow_stage_id = ?
            LEFT JOIN roles r ON wsr.role_id = r.id AND r.name = u.role AND r.is_active = 1
            WHERE (wsu.can_view = 1 OR wsr.can_view = 1 OR wsu.can_approve = 1 OR wsr.can_approve = 1) 
              AND u.is_active = TRUE
          `, [newStageId, newStageId]);

          for (const stageUser of stageUsers) {
            const [stageInfo] = await pool.execute(
              'SELECT stage_name FROM workflow_stages WHERE id = ?',
              [newStageId]
            );
            notifications.push([
              stageUser.id,
              caseId,
              `Case Ready for ${stageInfo[0]?.stage_name || 'Review'}`,
              `Case ${caseData.case_number} for ${caseData.full_name} has been approved and is ready for your review.`,
              'info'
            ]);
          }
        }
      } else {
        // For rejection: Notify users with permissions for Case Assignment stage (DCM, etc.)
        if (newStageId) {
          const [assignmentUsers] = await pool.execute(`
            SELECT DISTINCT u.id 
            FROM users u
            LEFT JOIN workflow_stage_users wsu ON u.id = wsu.user_id AND wsu.workflow_stage_id = ?
            LEFT JOIN workflow_stage_roles wsr ON wsr.workflow_stage_id = ?
            LEFT JOIN roles r ON wsr.role_id = r.id AND r.name = u.role AND r.is_active = 1
            WHERE (wsu.can_view = 1 OR wsr.can_view = 1 OR wsu.can_edit = 1 OR wsr.can_edit = 1) 
              AND u.is_active = TRUE
          `, [newStageId, newStageId]);

          for (const assignmentUser of assignmentUsers) {
            const [stageInfo] = await pool.execute(
              'SELECT stage_name FROM workflow_stages WHERE id = ?',
              [newStageId]
            );
            notifications.push([
              assignmentUser.id,
              caseId,
              `Case Rejected - Returned to ${stageInfo[0]?.stage_name || 'Case Assignment'}`,
              `Case ${caseData.case_number} for ${caseData.full_name} has been rejected and returned to ${stageInfo[0]?.stage_name || 'Case Assignment'} stage. Please review and take necessary action.`,
              'warning'
            ]);
          }
        }
      }

      // Insert all notifications
      for (const notification of notifications) {
        await pool.execute(
          `INSERT INTO notifications (user_id, case_id, title, message, type) 
           VALUES (?, ?, ?, ?, ?)`,
          notification
        );
      }

      // Commit transaction
      await pool.query('COMMIT');

      res.json({ 
        message: notificationMessage,
        caseId: caseId,
        caseNumber: caseData.case_number,
        newStatus,
        newStageId
      });

    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Workflow action error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ZI approval endpoint
router.put('/:caseId/zi-approve', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has ZI role or super admin
    if (userRole !== 'ZI' && userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only ZI users or super admin can approve cases' });
    }

    // Get case details
    const [cases] = await pool.execute(
      `SELECT c.*, a.full_name, a.its_number
       FROM cases c 
       JOIN applicants a ON c.applicant_id = a.id
       WHERE c.id = ?`,
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = cases[0];

    // Check if case is in correct status
    if (caseData.status !== 'submitted_to_zi') {
      return res.status(400).json({ error: 'Case must be submitted to ZI before approval' });
    }

    // Start transaction
    await pool.query('START TRANSACTION');

    try {
      // Get case type first for filtering
      const [caseInfo] = await pool.execute(
        'SELECT case_type_id FROM cases WHERE id = ?',
        [caseId]
      );
      const caseTypeId = caseInfo.length > 0 ? caseInfo[0].case_type_id : null;

      // Get current workflow stage (ZI Review)
      const [currentStages] = await pool.execute(
        'SELECT * FROM workflow_stages WHERE id = ? AND is_active = TRUE',
        [caseData.current_workflow_stage_id]
      );

      if (currentStages.length === 0) {
        throw new Error('Current workflow stage not found or inactive');
      }

      const currentStage = currentStages[0];

      // Find next stage after ZI Review (should be KG Review)
      // Use dynamic sort_order to adapt to workflow reordering
      let nextStage = null;

      // Strategy 1: Use next_stage_id if set (explicit link)
      if (currentStage.next_stage_id) {
        let nextStageQuery = 'SELECT * FROM workflow_stages WHERE id = ? AND is_active = TRUE';
        const nextStageParams = [currentStage.next_stage_id];
        
        // Add case_type_id filter if provided
        if (caseTypeId) {
          nextStageQuery += ' AND (case_type_id = ? OR case_type_id IS NULL)';
          nextStageParams.push(caseTypeId);
        }
        
        const [nextStages] = await pool.execute(nextStageQuery, nextStageParams);
        if (nextStages.length > 0) {
          nextStage = nextStages[0];
        }
      }

      // Strategy 2: Use sort_order to find next stage dynamically
      // This adapts automatically when stages are reordered via drag-and-drop
      if (!nextStage) {
        let nextStageQuery = 'SELECT * FROM workflow_stages WHERE is_active = TRUE AND sort_order > ?';
        const nextStageParams = [currentStage.sort_order];
        
        // Add case_type_id filter if provided
        if (caseTypeId) {
          nextStageQuery += ' AND (case_type_id = ? OR case_type_id IS NULL)';
          nextStageParams.push(caseTypeId);
        }
        
        nextStageQuery += ' ORDER BY CASE WHEN case_type_id IS NULL THEN 1 ELSE 0 END, sort_order ASC LIMIT 1';
        
        const [nextStages] = await pool.execute(nextStageQuery, nextStageParams);
        if (nextStages.length > 0) {
          nextStage = nextStages[0];
        }
      }

      if (!nextStage) {
        throw new Error('No next stage found in workflow after ZI Review');
      }

      // Get status from next stage's associated_statuses
      let statuses = [];
      if (nextStage.associated_statuses) {
        try {
          statuses = JSON.parse(nextStage.associated_statuses);
        } catch (e) {
          // If not JSON, generate from stage_key
          statuses = [`submitted_to_${nextStage.stage_key}`];
        }
      } else {
        // Auto-generate status from stage_key
        statuses = [`submitted_to_${nextStage.stage_key}`];
      }

      const newStatus = statuses[0] || `submitted_to_${nextStage.stage_key}`;
      const newStageId = nextStage.id;

      // Update case status and workflow stage
      await pool.execute(
        'UPDATE cases SET status = ?, current_workflow_stage_id = ? WHERE id = ?',
        [newStatus, newStageId, caseId]
      );

      // Update workflow stage history (pass newStageId to prevent override)
      await updateCaseWorkflowStage(
        caseId,
        newStatus,
        userId,
        req.user.full_name || req.user.username,
        'zi_approved',
        caseTypeId,
        newStageId
      );

      // Log status change
      await pool.execute(
        `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments) 
         VALUES (?, ?, ?, ?, ?)`,
        [caseId, 'submitted_to_zi', newStatus, userId, comments || `Case approved by ZI and forwarded to ${nextStage.stage_name}`]
      );

      // Add ZI approval comment
      await pool.execute(
        `INSERT INTO case_comments (case_id, user_id, role_name, comment, comment_type, is_visible_to_dcm) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [caseId, userId, userRole, comments || `Case approved by ZI and forwarded to ${nextStage.stage_name}`, 'approval', true]
      );

      // Create notifications
      const notifications = [];

      // Notify assigned DCM
      if (caseData.roles) {
        notifications.push([
          caseData.roles,
          caseId,
          'Case Approved by ZI',
          `Case ${caseData.case_number} for ${caseData.full_name} has been approved by ZI and forwarded to ${nextStage.stage_name}.`,
          'success'
        ]);
      }

      // Notify users with permissions for next stage (KG Review)
      const [stageUsers] = await pool.execute(`
        SELECT DISTINCT u.id 
        FROM users u
        LEFT JOIN workflow_stage_users wsu ON u.id = wsu.user_id AND wsu.workflow_stage_id = ?
        LEFT JOIN workflow_stage_roles wsr ON wsr.workflow_stage_id = ?
        LEFT JOIN roles r ON wsr.role_id = r.id AND r.name = u.role AND r.is_active = 1
        WHERE (wsu.can_view = 1 OR wsr.can_view = 1 OR wsu.can_approve = 1 OR wsr.can_approve = 1) 
          AND u.is_active = TRUE
      `, [newStageId, newStageId]);

      for (const stageUser of stageUsers) {
        notifications.push([
          stageUser.id,
          caseId,
          `Case Ready for ${nextStage.stage_name}`,
          `Case ${caseData.case_number} for ${caseData.full_name} has been approved by ZI and is ready for ${nextStage.stage_name}.`,
          'info'
        ]);
      }

      // Insert all notifications
      for (const notification of notifications) {
        await pool.execute(
          `INSERT INTO notifications (user_id, case_id, title, message, type) 
           VALUES (?, ?, ?, ?, ?)`,
          notification
        );
      }

      // Commit transaction
      await pool.query('COMMIT');

      res.json({ 
        message: `Case approved successfully by ZI and forwarded to ${nextStage.stage_name}`,
        caseId: caseId,
        caseNumber: caseData.case_number
      });

    } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('ZI approval error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ZI reject endpoint
router.put('/:caseId/zi-reject', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has ZI role or super admin
    if (userRole !== 'ZI' && userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only ZI users or super admin can reject cases' });
    }

    // Comments are required for rejection
    if (!comments || comments.trim().length === 0) {
      return res.status(400).json({ error: 'Comments are required when rejecting a case' });
    }

    // Get case details
    const [cases] = await pool.execute(
      `SELECT c.*, a.first_name, a.last_name, a.its_number, 
              dcm.first_name as dcm_first_name, dcm.last_name as dcm_last_name, dcm.email as dcm_email
       FROM cases c 
       JOIN applicants a ON c.applicant_id = a.id
       LEFT JOIN users dcm ON c.assigned_dcm_id = dcm.id
       WHERE c.id = ?`,
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = cases[0];

    // Check if case is in correct status
    if (caseData.status !== 'submitted_to_zi') {
      return res.status(400).json({ error: 'Case must be submitted to ZI before rejection' });
    }

    // Start transaction
    await pool.execute('START TRANSACTION');

    try {
      // Get case type for workflow stage lookup
      const [caseInfo] = await pool.execute(
        'SELECT case_type_id FROM cases WHERE id = ?',
        [caseId]
      );
      const caseTypeId = caseInfo.length > 0 ? caseInfo[0].case_type_id : null;

      // Update case status to zi_rejected and send back to welfare
      await pool.execute(
        'UPDATE cases SET status = "submitted_to_welfare" WHERE id = ?',
        [caseId]
      );

      // Update workflow stage back to welfare_review
      await updateCaseWorkflowStage(
        caseId,
        'submitted_to_welfare',
        userId,
        req.user.full_name || req.user.username,
        'zi_rejected',
        caseTypeId
      );

      // Log status change
      await pool.execute(
        `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments) 
         VALUES (?, ?, ?, ?, ?)`,
        [caseId, 'submitted_to_zi', 'submitted_to_welfare', userId, comments || 'Case rejected by ZI and sent back to welfare department']
      );

      // Add rejection comment
      await pool.execute(
        `INSERT INTO case_comments (case_id, user_id, role_name, comment, comment_type, is_visible_to_dcm) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [caseId, userId, userRole, comments, 'rejection', true]
      );

      // Create notifications
      const notifications = [];

      // Notify assigned DCM
      if (caseData.roles) {
        notifications.push([
          caseData.roles,
          caseId,
          'Case Rejected by ZI',
          `Case ${caseData.case_number} for ${caseData.first_name} ${caseData.last_name} has been rejected by ZI and sent back to welfare department. Reason: ${comments}`,
          'warning'
        ]);
      }

      // Notify welfare department users
      const [welfareUsers] = await pool.execute(
        'SELECT id FROM users WHERE (role = "welfare_reviewer" OR role = "welfare") AND is_active = TRUE'
      );

      for (const welfareUser of welfareUsers) {
        notifications.push([
          welfareUser.id,
          caseId,
          'Case Rejected by ZI - Action Required',
          `Case ${caseData.case_number} for ${caseData.first_name} ${caseData.last_name} has been rejected by ZI and sent back to welfare department. Reason: ${comments}`,
          'warning'
        ]);
      }

      // Insert all notifications
      for (const notification of notifications) {
        await pool.execute(
          `INSERT INTO notifications (user_id, case_id, title, message, type) 
           VALUES (?, ?, ?, ?, ?)`,
          notification
        );
      }

      // Commit transaction
      await pool.query('COMMIT');

      res.json({ 
        message: 'Case rejected by ZI and sent back to welfare department',
        caseId: caseId,
        caseNumber: caseData.case_number
      });

    } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('ZI reject error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Executive approval endpoint
router.put('/:caseId/executive-approve', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has executive role or super admin
    if (userRole !== 'Executive Management' && userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only executive management or super admin can approve cases' });
    }

    // Get case details
    const [cases] = await pool.execute(
      `SELECT c.*, a.full_name, a.its_number
       FROM cases c 
       JOIN applicants a ON c.applicant_id = a.id
       WHERE c.id = ?`,
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = cases[0];

    // Check if case is in correct status for executive approval
    if (!caseData.status.startsWith('submitted_to_executive')) {
      return res.status(400).json({ error: 'Case must be submitted to executive management before approval' });
    }

    // Check if user's executive level matches the case's current level
    if (userRole === 'Executive Management' && req.user.executive_level !== caseData.current_executive_level) {
      return res.status(403).json({ error: 'You can only approve cases assigned to your executive level' });
    }

    // Start transaction
    await pool.query('START TRANSACTION');

    try {
      // Get active executive levels ordered by sort_order
      const [levels] = await pool.execute(
        'SELECT level_number, level_name FROM executive_levels WHERE is_active = TRUE ORDER BY sort_order'
      );

      if (levels.length === 0) {
        throw new Error('No active executive levels found. Please configure executive levels first.');
      }

      // Find current level position
      const currentIndex = levels.findIndex(l => l.level_number === caseData.current_executive_level);
      const isLastLevel = currentIndex === levels.length - 1;

      let newStatus, nextLevel, notificationMessage;

      if (isLastLevel) {
        // Final executive approval - move to finance disbursement
        newStatus = 'finance_disbursement';
        nextLevel = null;
        notificationMessage = `Case approved by ${levels[currentIndex].level_name} and moved to finance disbursement`;
      } else {
        // Move to next executive level
        nextLevel = levels[currentIndex + 1].level_number;
        newStatus = `submitted_to_executive_${nextLevel}`;
        notificationMessage = `Case approved by ${levels[currentIndex].level_name} and forwarded to ${levels[currentIndex + 1].level_name}`;
      }

      // Get case type for workflow stage lookup
      const [caseInfo] = await pool.execute(
        'SELECT case_type_id FROM cases WHERE id = ?',
        [caseId]
      );
      const caseTypeId = caseInfo.length > 0 ? caseInfo[0].case_type_id : null;

      // Update case status and executive level
      await pool.execute(
        'UPDATE cases SET status = ?, current_executive_level = ? WHERE id = ?',
        [newStatus, nextLevel, caseId]
      );

      // Update workflow stage
      await updateCaseWorkflowStage(
        caseId,
        newStatus,
        userId,
        req.user.full_name || req.user.username,
        isLastLevel ? 'executive_approved' : 'executive_level_approved',
        caseTypeId
      );

      // Log status change
      await pool.execute(
        `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments) 
         VALUES (?, ?, ?, ?, ?)`,
        [caseId, 'submitted_to_executive', newStatus, userId, comments || notificationMessage]
      );

      // Add executive approval comment
      await pool.execute(
        `INSERT INTO case_comments (case_id, user_id, role_name, comment, comment_type, executive_level, is_visible_to_dcm) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [caseId, userId, userRole, comments || notificationMessage, 'approval', caseData.current_executive_level, true]
      );

      // Create notifications
      const notifications = [];

      // Notify assigned DCM (using roles field)
      if (caseData.roles) {
        notifications.push([
          caseData.roles,
          caseId,
          `Case Approved by ${levels[currentIndex].level_name}`,
          `Case ${caseData.case_number} for ${caseData.full_name} has been approved by ${levels[currentIndex].level_name}.`,
          'success'
        ]);
      }

      // Notify next executive level or finance team
      if (nextLevel) {
        const [executiveUsers] = await pool.execute(
          'SELECT id FROM users WHERE role = "Executive Management" AND executive_level = ? AND is_active = TRUE',
          [nextLevel]
        );

        for (const executiveUser of executiveUsers) {
          notifications.push([
            executiveUser.id,
            caseId,
            `Case Ready for ${levels[currentIndex + 1].level_name} Review`,
            `Case ${caseData.case_number} for ${caseData.full_name} has been approved by ${levels[currentIndex].level_name} and is ready for ${levels[currentIndex + 1].level_name} review.`,
            'info'
          ]);
        }
      } else {
        // Notify finance team
        const [financeUsers] = await pool.execute(
          'SELECT id FROM users WHERE role = "finance" AND is_active = TRUE'
        );

        for (const financeUser of financeUsers) {
          notifications.push([
            financeUser.id,
            caseId,
            'Case Ready for Finance Disbursement',
            `Case ${caseData.case_number} for ${caseData.full_name} has been approved by all Executive Management levels and is ready for finance disbursement.`,
            'success'
          ]);
        }
      }

      // Insert all notifications
      for (const notification of notifications) {
        await pool.execute(
          `INSERT INTO notifications (user_id, case_id, title, message, type) 
           VALUES (?, ?, ?, ?, ?)`,
          notification
        );
      }

      // Commit transaction
      await pool.query('COMMIT');

      res.json({ 
        message: notificationMessage,
        caseId: caseId,
        caseNumber: caseData.case_number,
        nextLevel: nextLevel
      });

    } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Executive approval error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Executive rework endpoint
router.put('/:caseId/executive-rework', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has executive role or super admin
    if (userRole !== 'Executive Management' && userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only executive management or super admin can send cases for rework' });
    }

    // Comments are required for rework
    if (!comments || comments.trim().length === 0) {
      return res.status(400).json({ error: 'Comments are required when sending a case for rework' });
    }

    // Get case details
    const [cases] = await pool.execute(
      `SELECT c.*, a.full_name, a.its_number
       FROM cases c 
       JOIN applicants a ON c.applicant_id = a.id
       WHERE c.id = ?`,
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = cases[0];

    // Check if case is in correct status for executive rework
    if (!caseData.status.startsWith('submitted_to_executive')) {
      return res.status(400).json({ error: 'Case must be submitted to executive management before sending for rework' });
    }

    // Check if user's executive level matches the case's current level
    if (userRole === 'Executive Management' && req.user.executive_level !== caseData.current_executive_level) {
      return res.status(403).json({ error: 'You can only send cases assigned to your executive level for rework' });
    }

    // Start transaction
    await pool.query('START TRANSACTION');

    try {
      // Get case type for workflow stage lookup
      const [caseInfo] = await pool.execute(
        'SELECT case_type_id FROM cases WHERE id = ?',
        [caseId]
      );
      const caseTypeId = caseInfo.length > 0 ? caseInfo[0].case_type_id : null;

      // Update case status to welfare_processing_rework
      await pool.execute(
        'UPDATE cases SET status = "welfare_processing_rework" WHERE id = ?',
        [caseId]
      );

      // Update workflow stage (stays in welfare_review)
      await updateCaseWorkflowStage(
        caseId,
        'welfare_processing_rework',
        userId,
        req.user.full_name || req.user.username,
        'executive_rework',
        caseTypeId
      );

      // Get executive level name for logging
      const [levelInfo] = await pool.execute(
        'SELECT level_name FROM executive_levels WHERE level_number = ?',
        [caseData.current_executive_level]
      );
      const levelName = levelInfo.length > 0 ? levelInfo[0].level_name : `Executive Level ${caseData.current_executive_level}`;

      // Log status change
      await pool.execute(
        `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments) 
         VALUES (?, ?, ?, ?, ?)`,
        [caseId, 'submitted_to_executive', 'welfare_processing_rework', userId, `Case sent for rework by ${levelName}: ${comments}`]
      );

      // Add executive rework comment (hidden from DCM)
      await pool.execute(
        `INSERT INTO case_comments (case_id, user_id, role_name, comment, comment_type, executive_level, is_visible_to_dcm) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [caseId, userId, userRole, comments, 'rejection', caseData.current_executive_level, false]
      );

      // Create notifications for welfare users
      const [welfareUsers] = await pool.execute(
        'SELECT id FROM users WHERE (role = "welfare_reviewer" OR role = "welfare") AND is_active = TRUE'
      );

      const notifications = [];
      for (const welfareUser of welfareUsers) {
        notifications.push([
          welfareUser.id,
          caseId,
          `Case Requires Rework - ${levelName}`,
          `Case ${caseData.case_number} for ${caseData.first_name} ${caseData.last_name} has been sent for rework by ${levelName}. Please review and forward to DCM.`,
          'warning'
        ]);
      }

      // Insert all notifications
      for (const notification of notifications) {
        await pool.execute(
          `INSERT INTO notifications (user_id, case_id, title, message, type) 
           VALUES (?, ?, ?, ?, ?)`,
          notification
        );
      }

      // Commit transaction
      await pool.query('COMMIT');

      res.json({ 
        message: `Case ${caseData.case_number} for ${caseData.full_name} has been sent for rework to welfare department by Executive Management ${caseData.current_executive_level}`,
        caseId: caseId,
        caseNumber: caseData.case_number
      });

    } catch (error) {
      // Rollback transaction on error
      await pool.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Executive rework error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Welfare forward rework endpoint
router.put('/:caseId/welfare-forward-rework', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has welfare reviewer role or super admin
    const normalizedRole = userRole?.toLowerCase();
    if (normalizedRole !== 'welfare_reviewer' && normalizedRole !== 'welfare' && userRole !== 'admin' && userRole !== 'super_admin') {
      return res.status(403).json({ error: 'Only welfare department or super admin can forward rework to DCM' });
    }

    // Comments are required for forwarding rework
    if (!comments || comments.trim().length === 0) {
      return res.status(400).json({ error: 'Comments are required when forwarding rework to DCM' });
    }

    // Get case details
    const [cases] = await pool.execute(
      `SELECT c.*, a.first_name, a.last_name, a.its_number, 
              dcm.first_name as dcm_first_name, dcm.last_name as dcm_last_name, dcm.email as dcm_email
       FROM cases c 
       JOIN applicants a ON c.applicant_id = a.id
       LEFT JOIN users dcm ON c.assigned_dcm_id = dcm.id
       WHERE c.id = ?`,
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = cases[0];

    // Check if case is in welfare_processing_rework status
    if (caseData.status !== 'welfare_processing_rework') {
      return res.status(400).json({ error: 'Case must be in welfare processing rework status before forwarding to DCM' });
    }

    // Start transaction
    await pool.execute('START TRANSACTION');

    try {
      // Get case type for workflow stage lookup
      const [caseInfo] = await pool.execute(
        'SELECT case_type_id FROM cases WHERE id = ?',
        [caseId]
      );
      const caseTypeId = caseInfo.length > 0 ? caseInfo[0].case_type_id : null;

      // Update case status to welfare_rejected and reset executive level
      await pool.execute(
        'UPDATE cases SET status = "welfare_rejected", current_executive_level = NULL, last_welfare_comment = ? WHERE id = ?',
        [comments, caseId]
      );

      // Update workflow stage (moves back to counselor stage)
      await updateCaseWorkflowStage(
        caseId,
        'welfare_rejected',
        userId,
        req.user.full_name || req.user.username,
        'welfare_forwarded_rework',
        caseTypeId
      );

      // Log status change
      await pool.execute(
        `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments) 
         VALUES (?, ?, ?, ?, ?)`,
        [caseId, 'welfare_processing_rework', 'welfare_rejected', userId, `Welfare forwarded rework to DCM: ${comments}`]
      );

      // Add welfare comment (visible to DCM)
      // #region agent log
      const welfareReworkCommentType = 'rejection';
      fetch('http://127.0.0.1:7242/ingest/bfa26678-5497-4bdc-a2f0-ce1972c9f199',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cases.js:3119',message:'Before inserting welfare rework comment',data:{caseId,commentType:welfareReworkCommentType,commentTypeLength:welfareReworkCommentType.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      await pool.execute(
        `INSERT INTO case_comments (case_id, user_id, role_name, comment, comment_type, is_visible_to_dcm) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [caseId, userId, userRole, comments, welfareReworkCommentType, true]
      );

      // Create notification for assigned DCM
      const notifications = [];
      if (caseData.assigned_dcm_id) {
        notifications.push([
          caseData.assigned_dcm_id,
          caseId,
          'Case Requires Rework - Welfare Department',
          `Case ${caseData.case_number} for ${caseData.first_name} ${caseData.last_name} has been sent for rework by welfare department. Please review the feedback and resubmit.`,
          'warning'
        ]);
      }

      // Insert all notifications
      for (const notification of notifications) {
        await pool.execute(
          `INSERT INTO notifications (user_id, case_id, title, message, type) 
           VALUES (?, ?, ?, ?, ?)`,
          notification
        );
      }

      // Commit transaction
      await pool.execute('COMMIT');

      res.json({ 
        message: 'Case rework forwarded to DCM successfully',
        caseId: caseId,
        caseNumber: caseData.case_number
      });

    } catch (error) {
      // Rollback transaction on error
      await pool.execute('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Welfare forward rework error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resubmit rejected case to welfare department
router.put('/:caseId/resubmit-welfare', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comments } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Check if user has permission to resubmit (DCM, Deputy Counseling Manager, ZI, admin, or super_admin)
    if (!['dcm', 'Deputy Counseling Manager', 'ZI', 'admin', 'super_admin'].includes(userRole)) {
      return res.status(403).json({ error: 'You do not have permission to resubmit cases' });
    }

    // Get case details
    const [cases] = await pool.execute(
      `SELECT c.*, a.first_name, a.last_name, a.its_number
       FROM cases c 
       JOIN applicants a ON c.applicant_id = a.id
       WHERE c.id = ?`,
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = cases[0];

    // Check if user is assigned to this case
    if (userRole !== 'admin' && userRole !== 'super_admin' && caseData.assigned_dcm_id !== userId) {
      return res.status(403).json({ error: 'You can only resubmit cases assigned to you' });
    }

    // Check if case is in welfare_rejected status
    if (caseData.status !== 'welfare_rejected') {
      return res.status(400).json({ error: 'Case must be sent for rework by welfare department before resubmission' });
    }

    // Start transaction
    await pool.execute('START TRANSACTION');

    try {
      // Get case type for workflow stage lookup
      const [caseInfo] = await pool.execute(
        'SELECT case_type_id FROM cases WHERE id = ?',
        [caseId]
      );
      const caseTypeId = caseInfo.length > 0 ? caseInfo[0].case_type_id : null;

      // Update case status to submitted_to_welfare and reset executive level
      await pool.execute(
        'UPDATE cases SET status = "submitted_to_welfare", current_executive_level = NULL WHERE id = ?',
        [caseId]
      );

      // Update workflow stage (back to welfare review)
      await updateCaseWorkflowStage(
        caseId,
        'submitted_to_welfare',
        userId,
        req.user.full_name || req.user.username,
        'resubmitted_to_welfare',
        caseTypeId
      );

      // Log status change
      await pool.execute(
        `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments) 
         VALUES (?, ?, ?, ?, ?)`,
        [caseId, 'welfare_rejected', 'submitted_to_welfare', userId, comments || 'Case resubmitted to welfare department after addressing rework feedback']
      );

      // Add resubmission comment
      await pool.execute(
        `INSERT INTO case_comments (case_id, user_id, comment, comment_type) 
         VALUES (?, ?, ?, ?)`,
        [caseId, userId, comments || 'Case resubmitted to welfare department after addressing rework feedback', 'general']
      );

      // Create notifications for welfare department users
      const [welfareUsers] = await pool.execute(
        'SELECT id FROM users WHERE role = "welfare_reviewer" AND is_active = TRUE'
      );

      for (const welfareUser of welfareUsers) {
        await pool.execute(
          `INSERT INTO notifications (user_id, case_id, title, message, type) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            welfareUser.id,
            caseId,
            'Case Resubmitted for Review',
            `Case ${caseData.case_number} for ${caseData.first_name} ${caseData.last_name} (ITS: ${caseData.its_number}) has been resubmitted for welfare department review.`,
            'info'
          ]
        );
      }

      // Commit transaction
      await pool.execute('COMMIT');

      res.json({ 
        message: 'Case resubmitted successfully to welfare department',
        caseId: caseId,
        caseNumber: caseData.case_number
      });

    } catch (error) {
      // Rollback transaction on error
      await pool.execute('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Resubmit case error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to get workflow stage ID based on case status
// This function uses a flexible approach:
// 1. First checks if any stage has this status in associated_statuses JSON array
// 2. Falls back to stage_key pattern matching
// 3. Uses sort_order for intelligent progression
async function getWorkflowStageIdByStatus(status, caseTypeId = null, currentStageId = null) {
  try {
    // Build base query
    let baseQuery = 'SELECT id, stage_key, sort_order, associated_statuses FROM workflow_stages WHERE is_active = TRUE';
    const queryParams = [];

    // Filter by case type if provided
    if (caseTypeId) {
      baseQuery += ' AND (case_type_id = ? OR case_type_id IS NULL)';
      queryParams.push(caseTypeId);
    }

    // Strategy 1: Check if any stage has this status in associated_statuses JSON field
    // MySQL JSON_CONTAINS for finding status in JSON array
    const associatedStatusQuery = baseQuery + 
      ' AND JSON_CONTAINS(COALESCE(associated_statuses, JSON_ARRAY()), JSON_QUOTE(?))' +
      ' ORDER BY CASE WHEN case_type_id IS NULL THEN 1 ELSE 0 END, sort_order ASC LIMIT 1';
    
    try {
      const [matchedStages] = await pool.execute(associatedStatusQuery, [status, ...queryParams]);
      if (matchedStages.length > 0) {
        return matchedStages[0].id;
      }
    } catch (jsonError) {
      // If JSON_CONTAINS fails (column might not exist or invalid JSON), fall through to next strategy
      console.log('JSON query not available, using fallback:', jsonError.message);
    }

    // Strategy 2: Try pattern matching with stage_key (backward compatibility)
    // Flexible mapping that handles partial matches
    const statusPatterns = [
      { pattern: /^draft$/, keys: ['draft', 'draft_stage'] },
      { pattern: /^assigned$/, keys: ['assigned', 'case_assignment', 'assignment'] },
      { pattern: /^(in_counseling|cover_letter_generated|welfare_rejected)$/, keys: ['counselor', 'counseling'] },
      { pattern: /^(submitted_to_welfare|welfare_processing_rework)$/, keys: ['welfare', 'welfare_review', 'review'] },
      { pattern: /^(submitted_to_zi|submitted_to_zi_review|zi_approved|zi_rejected)$/, keys: ['zi', 'zonal', 'zi_stage', 'zi_review'] },
      { pattern: /^(submitted_to_kg_review)$/, keys: ['kg', 'kg_review', 'kg_stage'] },
      { pattern: /^(submitted_to_operations_lead)$/, keys: ['operations_lead', 'ops_lead', 'operations'] },
      { pattern: /^(submitted_to_executive|submitted_to_executive_\d+)$/, keys: ['executive', 'executive_approval', 'approval'] },
      { pattern: /^(welfare_approved)$/, keys: ['welfare', 'welfare_review', 'review'] },
      { pattern: /^(executive_approved)$/, keys: ['executive', 'executive_approval', 'approval'] }, // executive_approved should stay in executive stage for level progression
      { pattern: /^(finance_disbursement)$/, keys: ['finance', 'finance_disbursement', 'disbursement'] }
    ];

    for (const mapping of statusPatterns) {
      if (mapping.pattern.test(status)) {
        // Try to find stage with matching key
        for (const keyPattern of mapping.keys) {
          const keyQuery = baseQuery + 
            ' AND (stage_key LIKE ? OR stage_key = ?)' +
            ' ORDER BY CASE WHEN case_type_id IS NULL THEN 1 ELSE 0 END, sort_order ASC LIMIT 1';
          
          const [keyStages] = await pool.execute(keyQuery, [`%${keyPattern}%`, keyPattern, ...queryParams]);
          if (keyStages.length > 0) {
            return keyStages[0].id;
          }
        }
      }
    }

    // Strategy 3: Use sort_order for intelligent progression
    // If we have current stage, find the next stage in sequence
    if (currentStageId) {
      const [currentStage] = await pool.execute(
        'SELECT sort_order FROM workflow_stages WHERE id = ?',
        [currentStageId]
      );
      
      if (currentStage.length > 0) {
        const currentSortOrder = currentStage[0].sort_order;
        const nextStageQuery = baseQuery + 
          ' AND sort_order > ?' +
          ' ORDER BY sort_order ASC LIMIT 1';
        
        const [nextStages] = await pool.execute(nextStageQuery, [currentSortOrder, ...queryParams]);
        if (nextStages.length > 0) {
          return nextStages[0].id;
        }
      }
    }

    // Strategy 4: Fallback to first stage by sort_order (for initial status)
    const firstStageQuery = baseQuery + 
      ' ORDER BY sort_order ASC LIMIT 1';
    const [firstStages] = await pool.execute(firstStageQuery, queryParams);
    if (firstStages.length > 0) {
      return firstStages[0].id;
    }

    return null;
  } catch (error) {
    console.error('Error getting workflow stage by status:', error);
    return null;
  }
}

// Helper function to update case workflow stage and history
async function updateCaseWorkflowStage(caseId, newStatus, userId, userName, action = 'status_changed', caseTypeId = null, preferredStageId = null) {
  try {
    // Get current stage ID to help with progression
    const [currentCase] = await pool.execute(
      'SELECT current_workflow_stage_id, case_type_id FROM cases WHERE id = ?',
      [caseId]
    );
    
    const currentStageId = currentCase.length > 0 ? currentCase[0].current_workflow_stage_id : null;
    const actualCaseTypeId = caseTypeId || (currentCase.length > 0 ? currentCase[0].case_type_id : null);
    
    // Use preferredStageId if provided, otherwise look it up
    let newStageId = preferredStageId;
    if (!newStageId) {
      newStageId = await getWorkflowStageIdByStatus(newStatus, actualCaseTypeId, currentStageId);
    }
    
    if (!newStageId) {
      // No workflow stage mapping found, skip update
      console.log(`No workflow stage found for status: ${newStatus}, case: ${caseId}`);
      return;
    }

    // Get the workflow stage's associated_statuses to ensure status stays in sync
    const [stageData] = await pool.execute(
      'SELECT associated_statuses FROM workflow_stages WHERE id = ? AND is_active = TRUE',
      [newStageId]
    );

    // currentStageId and actualCaseTypeId already retrieved above, reuse them
    // Get workflow history separately
    const [caseData] = await pool.execute(
      'SELECT workflow_history, status FROM cases WHERE id = ?',
      [caseId]
    );

    if (caseData.length === 0) return;
    
    let finalStatus = newStatus;
    const currentStatus = caseData[0].status;

    // If stage has associated_statuses, check if status should be updated
    if (stageData.length > 0 && stageData[0].associated_statuses) {
      let associatedStatuses = [];
      try {
        associatedStatuses = JSON.parse(stageData[0].associated_statuses);
      } catch (e) {
        // If parsing fails, try to use it as is if it's already an array
        associatedStatuses = Array.isArray(stageData[0].associated_statuses) ? stageData[0].associated_statuses : [];
      }

      // If the stage has associated_statuses, ensure status matches
      if (associatedStatuses.length > 0) {
        // If status was explicitly provided and matches an associated status, use it
        // Otherwise, if current status doesn't match any associated status, update to first associated status
        if (newStatus && associatedStatuses.includes(newStatus)) {
          finalStatus = newStatus;
        } else if (!associatedStatuses.includes(currentStatus)) {
          // Current status doesn't match stage's associated statuses, update to first one
          finalStatus = associatedStatuses[0];
        } else {
          // Current status matches, keep it
          finalStatus = currentStatus;
        }
      }
    }

    // If stage is already correct AND status matches, skip update
    if (currentStageId === newStageId && currentStatus === finalStatus) {
      return;
    }
    
    // Ensure status is also set correctly (in case it was missing or different)
    if (!currentStatus || currentStatus !== finalStatus) {
      await pool.execute(
        'UPDATE cases SET status = ? WHERE id = ?',
        [finalStatus, caseId]
      );
    }

    // Get stage name
    const [stageInfo] = await pool.execute(
      'SELECT stage_name FROM workflow_stages WHERE id = ?',
      [newStageId]
    );

    const stageName = stageInfo.length > 0 ? stageInfo[0].stage_name : 'Unknown Stage';

    // Update workflow history
    let workflowHistory = [];
    try {
      const existingHistory = caseData[0].workflow_history;
      if (existingHistory) {
        workflowHistory = JSON.parse(existingHistory);
      }
    } catch (e) {
      workflowHistory = [];
    }

    // Add new entry to workflow history
    workflowHistory.push({
      stage_id: newStageId,
      stage_name: stageName,
      entered_at: new Date().toISOString(),
      entered_by: userId,
      entered_by_name: userName,
      action: action
    });

    // Update case with new workflow stage and history
    await pool.execute(
      'UPDATE cases SET current_workflow_stage_id = ?, workflow_history = ? WHERE id = ?',
      [newStageId, JSON.stringify(workflowHistory), caseId]
    );
  } catch (error) {
    console.error('Error updating case workflow stage:', error);
    // Don't throw - workflow stage update shouldn't break the main operation
  }
}

// Helper function to determine valid status transitions
function getValidStatusTransitions(currentStatus, userRole) {
  const transitions = {
    'draft': ['assigned'],
    'assigned': ['in_counseling'],
    'in_counseling': ['cover_letter_generated'],
    'cover_letter_generated': ['submitted_to_welfare'],
    'submitted_to_welfare': ['welfare_approved', 'welfare_rejected'],
    'welfare_rejected': ['in_counseling'],
    'welfare_approved': ['submitted_to_zi'],
    'submitted_to_zi': ['zi_approved', 'zi_rejected'],
    'zi_rejected': ['submitted_to_welfare'],
    'zi_approved': ['submitted_to_executive_1', 'submitted_to_executive_2', 'submitted_to_executive_3'],
    'submitted_to_executive_1': ['executive_approved', 'executive_rejected'],
    'submitted_to_executive_2': ['executive_approved', 'executive_rejected'],
    'submitted_to_executive_3': ['executive_approved', 'executive_rejected'],
    'executive_rejected': ['submitted_to_welfare'],
    'executive_approved': ['finance_disbursement'],
    'finance_disbursement': []
  };

  const rolePermissions = {
    'admin': ['draft', 'assigned', 'in_counseling', 'cover_letter_generated', 'submitted_to_welfare', 'welfare_approved', 'welfare_rejected', 'submitted_to_zi', 'zi_approved', 'zi_rejected', 'executive_approved', 'executive_rejected', 'finance_disbursement'],
    'dcm': ['in_counseling', 'cover_letter_generated', 'submitted_to_welfare'],
        'Deputy Counseling Manager': ['in_counseling', 'cover_letter_generated', 'submitted_to_welfare'],
        'ZI': ['submitted_to_zi', 'zi_approved', 'zi_rejected'],
    'counselor': ['in_counseling'],
    'welfare_reviewer': ['welfare_approved', 'welfare_rejected'],
    'Executive Management': ['executive_approved', 'executive_rejected'],
    'finance': ['finance_disbursement']
  };

  const validStatuses = transitions[currentStatus] || [];
  const roleAllowedStatuses = rolePermissions[userRole] || [];

  return validStatuses.filter(status => roleAllowedStatuses.includes(status));
}

// Get case comments based on user role
router.get('/:caseId/comments', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get case details to verify access
    const [cases] = await pool.execute(
      `SELECT c.*, a.first_name, a.last_name, a.its_number
       FROM cases c 
       JOIN applicants a ON c.applicant_id = a.id
       WHERE c.id = ?`,
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const caseData = cases[0];

    // Check if user has access to this case
    const canAccessAll = await canAccessAllCases(userRole);
    if (!canAccessAll) {
      // For roles that can't access all cases, check assignment
      if (userRole === 'ZI' || userRole === 'Zonal Incharge') {
        // ZI can see cases in their assigned jamiat/jamaat areas
        const [accessCheck] = await pool.execute(
          `SELECT 1 FROM applicants a 
           JOIN users u ON u.id = ? 
           WHERE a.id = ? 
           AND (FIND_IN_SET(a.jamiat_id, u.jamiat_ids) > 0 OR FIND_IN_SET(a.jamaat_id, u.jamaat_ids) > 0)`,
          [userId, caseData.applicant_id]
        );
        if (accessCheck.length === 0) {
          return res.status(403).json({ error: 'You do not have access to this case' });
        }
      } else {
        // Other roles (DCM, counselor) can only see assigned cases
        if (caseData.roles !== userId && caseData.assigned_counselor_id !== userId) {
          return res.status(403).json({ error: 'You do not have access to this case' });
        }
      }
    }

    // Build query based on user role
    let whereClause = 'WHERE cc.case_id = ?';
    let queryParams = [caseId];

    if (userRole === 'dcm' || userRole === 'Deputy Counseling Manager' || userRole === 'ZI' || userRole === 'Zonal Incharge') {
      // DCM can only see comments visible to them
      whereClause += ' AND cc.is_visible_to_dcm = TRUE';
    } else if (userRole === 'Executive Management') {
      // Executive can see welfare and executive comments
      whereClause += ' AND (cc.comment_type = "approval" OR cc.comment_type = "rejection")';
    } else if (userRole === 'welfare_reviewer' || userRole === 'welfare') {
      // Welfare can see all comments
      // No additional filter needed
    } else if (userRole === 'admin' || userRole === 'super_admin') {
      // Admin can see all comments
      // No additional filter needed
    } else {
      // Default: only visible comments
      whereClause += ' AND cc.is_visible_to_dcm = TRUE';
    }

    // Get comments with user details
    const [comments] = await pool.execute(
      `SELECT 
        cc.*,
        u.full_name,
        u.role as user_role
       FROM case_comments cc
       JOIN users u ON cc.user_id = u.id
       ${whereClause}
       ORDER BY cc.created_at ASC`,
      queryParams
    );

    res.json({
      comments: comments.map(comment => ({
        id: comment.id,
        caseId: comment.case_id,
        userId: comment.user_id,
        userName: `${comment.first_name} ${comment.last_name}`,
        userRole: comment.user_role,
        roleName: comment.role_name,
        comment: comment.comment,
        commentType: comment.comment_type,
        executiveLevel: comment.executive_level,
        isVisibleToDcm: comment.is_visible_to_dcm,
        createdAt: comment.created_at
      }))
    });

  } catch (error) {
    console.error('Get case comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Payment Schedule Routes
// Get payment schedule for a case
router.get('/:caseId/payment-schedule', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;

    // Get all payment schedules for this case
    const [schedules] = await pool.execute(`
      SELECT 
        ps.*,
        u1.full_name as created_by_name,
        u2.full_name as updated_by_name,
        u3.full_name as disbursed_by_name
      FROM payment_schedules ps
      LEFT JOIN users u1 ON ps.created_by = u1.id
      LEFT JOIN users u2 ON ps.updated_by = u2.id
      LEFT JOIN users u3 ON ps.disbursed_by = u3.id
      WHERE ps.case_id = ?
      ORDER BY ps.payment_type, ps.year_number, ps.disbursement_year, ps.disbursement_month
    `, [caseId]);

    // Get repayments for each schedule
    const schedulesWithRepayments = await Promise.all(
      schedules.map(async (schedule) => {
        const [repayments] = await pool.execute(`
          SELECT 
            repayment_year,
            repayment_month,
            repayment_amount
          FROM payment_schedule_repayments
          WHERE payment_schedule_id = ?
          ORDER BY repayment_year, repayment_month
        `, [schedule.id]);

        return {
          ...schedule,
          repayments: repayments || []
        };
      })
    );

    res.json({ schedules: schedulesWithRepayments });
  } catch (error) {
    console.error('Get payment schedule error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Save payment schedule for a case
router.post('/:caseId/payment-schedule', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;
    const { schedules } = req.body;

    if (!Array.isArray(schedules)) {
      return res.status(400).json({ error: 'Schedules must be an array' });
    }

    await pool.query('START TRANSACTION');

    try {
      // Delete existing schedules for this case (only if not disbursed)
      await pool.execute('DELETE FROM payment_schedules WHERE case_id = ? AND (is_disbursed IS NULL OR is_disbursed = FALSE)', [caseId]);

      // Insert new schedules
      for (const schedule of schedules) {
        const {
          payment_type,
          year_number,
          disbursement_year,
          disbursement_month,
          disbursement_amount,
          repayment_months,
          repayment_start_year,
          repayment_start_month
        } = schedule;

        if (!payment_type || !year_number || !disbursement_year || !disbursement_month || !disbursement_amount) {
          throw new Error('Missing required fields in schedule');
        }

        // Insert payment schedule
        const [result] = await pool.execute(`
          INSERT INTO payment_schedules (
            case_id, payment_type, year_number, disbursement_year, disbursement_month,
            disbursement_amount, repayment_months, repayment_start_year, repayment_start_month,
            created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          caseId, payment_type, year_number, disbursement_year, disbursement_month,
          disbursement_amount, repayment_months || null, repayment_start_year || null, repayment_start_month || null,
          userId, userId
        ]);

        const scheduleId = result.insertId;

        // If it's Qardan Hasana and has repayment info, calculate and insert repayments
        if (payment_type === 'qardan_hasana' && repayment_months && repayment_start_year && repayment_start_month && disbursement_amount > 0) {
          const monthlyRepayment = disbursement_amount / repayment_months;
          let currentYear = repayment_start_year;
          let currentMonth = repayment_start_month;

          for (let i = 0; i < repayment_months; i++) {
            await pool.execute(`
              INSERT INTO payment_schedule_repayments (
                payment_schedule_id, repayment_year, repayment_month, repayment_amount
              ) VALUES (?, ?, ?, ?)
            `, [scheduleId, currentYear, currentMonth, monthlyRepayment]);

            // Move to next month
            currentMonth++;
            if (currentMonth > 12) {
              currentMonth = 1;
              currentYear++;
            }
          }
        }
      }

      await pool.query('COMMIT');
      res.json({ message: 'Payment schedule saved successfully' });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Save payment schedule error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Confirm disbursement for a payment schedule
router.post('/:caseId/payment-schedule/:scheduleId/confirm-disbursement', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId, scheduleId } = req.params;
    const userId = req.user.id;
    const { disbursed_date, repayment_months } = req.body;

    if (!disbursed_date) {
      return res.status(400).json({ error: 'Disbursed date is required' });
    }

    // Get the payment schedule
    const [schedules] = await pool.execute(
      'SELECT * FROM payment_schedules WHERE id = ? AND case_id = ?',
      [scheduleId, caseId]
    );

    if (schedules.length === 0) {
      return res.status(404).json({ error: 'Payment schedule not found' });
    }

    const schedule = schedules[0];

    // Extract year and month from disbursed_date
    const disbursedDate = new Date(disbursed_date);
    const disbursementYear = disbursedDate.getFullYear();
    const disbursementMonth = disbursedDate.getMonth() + 1; // JavaScript months are 0-indexed

    await pool.query('START TRANSACTION');

    try {
      // Update payment schedule with disbursement confirmation
      await pool.execute(
        `UPDATE payment_schedules 
         SET is_disbursed = TRUE,
             disbursed_date = ?,
             disbursement_year = ?,
             disbursement_month = ?,
             disbursed_by = ?,
             disbursed_at = NOW(),
             repayment_months = COALESCE(?, repayment_months)
         WHERE id = ?`,
        [disbursed_date, disbursementYear, disbursementMonth, userId, repayment_months || null, scheduleId]
      );

      // If it's Qardan Hasana and repayment_months is provided, recalculate repayments
      if (schedule.payment_type === 'qardan_hasana' && repayment_months && schedule.disbursement_amount > 0) {
        // Delete existing repayments
        await pool.execute(
          'DELETE FROM payment_schedule_repayments WHERE payment_schedule_id = ?',
          [scheduleId]
        );

        // Calculate repayment start date (next month after disbursement date)
        // Skip the disbursement month and start from the next month
        let currentYear = disbursementYear;
        let currentMonth = disbursementMonth + 1;
        
        // Handle year rollover (e.g., December -> January of next year)
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }

        const monthlyRepayment = schedule.disbursement_amount / repayment_months;

        // Insert new repayments
        for (let i = 0; i < repayment_months; i++) {
          await pool.execute(
            `INSERT INTO payment_schedule_repayments (
              payment_schedule_id, repayment_year, repayment_month, repayment_amount
            ) VALUES (?, ?, ?, ?)`,
            [scheduleId, currentYear, currentMonth, monthlyRepayment]
          );

          // Move to next month
          currentMonth++;
          if (currentMonth > 12) {
            currentMonth = 1;
            currentYear++;
          }
        }
      }

      await pool.query('COMMIT');
      res.json({ message: 'Disbursement confirmed successfully' });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Confirm disbursement error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Status diagnostics - list all statuses and highlight mismatches between status and workflow stage
router.get('/status-diagnostics', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    // 1) Distinct statuses currently used in cases table
    const [statusRows] = await pool.execute(
      `SELECT DISTINCT COALESCE(NULLIF(status, ''), 'NULL') AS status
       FROM cases
       ORDER BY status`
    );

    const statusesInCases = statusRows.map(row => row.status);

    // 2) Workflow stages with associated_statuses
    const [stageRows] = await pool.execute(
      `SELECT id, stage_name, stage_key, sort_order, associated_statuses
       FROM workflow_stages
       WHERE is_active = TRUE
       ORDER BY sort_order ASC`
    );

    const workflowStages = stageRows.map(stage => {
      let associatedStatuses = [];
      if (stage.associated_statuses) {
        try {
          associatedStatuses = JSON.parse(stage.associated_statuses);
        } catch (e) {
          // Fallback: handle legacy non-JSON data
          associatedStatuses = Array.isArray(stage.associated_statuses)
            ? stage.associated_statuses
            : [];
        }
      }
      return {
        id: stage.id,
        stage_name: stage.stage_name,
        stage_key: stage.stage_key,
        sort_order: stage.sort_order,
        associated_statuses: associatedStatuses,
        raw_associated_statuses: stage.associated_statuses
      };
    });

    // Build a quick lookup for associated statuses by stage id
    const stageStatusMap = new Map();
    for (const s of workflowStages) {
      stageStatusMap.set(s.id, s.associated_statuses || []);
    }

    // 3) Find cases where current_workflow_stage_id's associated_statuses
    // do not contain the case status
    const [caseRows] = await pool.execute(
      `SELECT 
         c.id,
         c.case_number,
         c.status,
         c.current_workflow_stage_id,
         ws.stage_name,
         ws.stage_key,
         ws.associated_statuses
       FROM cases c
       LEFT JOIN workflow_stages ws ON c.current_workflow_stage_id = ws.id
       WHERE c.current_workflow_stage_id IS NOT NULL`
    );

    const inconsistentCases = [];

    for (const row of caseRows) {
      const currentStatus = row.status || 'draft';
      const stageId = row.current_workflow_stage_id;
      const stageAssociatedStatuses = stageStatusMap.get(stageId) || [];

      // If stage has an explicit associated_statuses array, use it to validate
      if (stageAssociatedStatuses.length > 0 && !stageAssociatedStatuses.includes(currentStatus)) {
        inconsistentCases.push({
          id: row.id,
          case_number: row.case_number,
          status: currentStatus,
          stage_id: stageId,
          stage_name: row.stage_name,
          stage_key: row.stage_key,
          stage_associated_statuses: stageAssociatedStatuses
        });
      }
    }

    res.json({
      statusesInCases,
      workflowStages,
      inconsistentCasesPreview: inconsistentCases.slice(0, 200),
      inconsistentCount: inconsistentCases.length
    });
  } catch (error) {
    console.error('Status diagnostics error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Close a case with reason and optional supporting document
router.post('/:caseId/close', authenticateToken, authorizePermission('cases', 'close_case'), closureUpload.single('document'), async (req, res) => {
  try {
    const { caseId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason for closure is required' });
    }

    // Get current case details
    const [caseData] = await pool.execute(
      'SELECT id, case_number, status FROM cases WHERE id = ?',
      [caseId]
    );

    if (caseData.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const currentCase = caseData[0];

    if (currentCase.status === 'closed') {
      return res.status(400).json({ error: 'Case is already closed' });
    }

    const previousStatus = currentCase.status;

    // Prepare document data if file uploaded
    let documentPath = null;
    let documentName = null;
    let documentType = null;
    let documentSize = null;

    if (req.file) {
      documentPath = `case_closures/${caseId}/${req.file.filename}`;
      documentName = req.file.originalname;
      documentType = req.file.mimetype;
      documentSize = req.file.size;
    }

    // Insert closure record
    await pool.execute(`
      INSERT INTO case_closures (case_id, reason, document_path, document_name, document_type, document_size, closed_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [caseId, reason.trim(), documentPath, documentName, documentType, documentSize, userId]);

    // Update case status to closed
    await pool.execute(
      'UPDATE cases SET status = ? WHERE id = ?',
      ['closed', caseId]
    );

    // Log status change in status_history
    await pool.execute(
      `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments)
       VALUES (?, ?, ?, ?, ?)`,
      [caseId, previousStatus, 'closed', userId, `Case closed. Reason: ${reason.trim()}`]
    );

    res.json({
      message: 'Case closed successfully',
      case_number: currentCase.case_number,
      status: 'closed'
    });
  } catch (error) {
    console.error('Case closure error:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
    if (error.message?.includes('Invalid file type')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get case closure details
router.get('/:caseId/closure', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;

    const [closure] = await pool.execute(`
      SELECT cc.*, u.full_name as closed_by_name
      FROM case_closures cc
      JOIN users u ON cc.closed_by = u.id
      WHERE cc.case_id = ?
      ORDER BY cc.created_at DESC
      LIMIT 1
    `, [caseId]);

    if (closure.length === 0) {
      return res.status(404).json({ error: 'No closure record found for this case' });
    }

    res.json({ closure: closure[0] });
  } catch (error) {
    console.error('Get case closure error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download case closure document
router.get('/:caseId/closure/document', authenticateToken, async (req, res) => {
  try {
    const { caseId } = req.params;

    const [closure] = await pool.execute(
      'SELECT document_path, document_name, document_type FROM case_closures WHERE case_id = ? AND document_path IS NOT NULL ORDER BY created_at DESC LIMIT 1',
      [caseId]
    );

    if (closure.length === 0) {
      return res.status(404).json({ error: 'No closure document found' });
    }

    const filePath = path.join(__dirname, '../uploads', closure[0].document_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Document file not found on server' });
    }

    res.setHeader('Content-Type', closure[0].document_type);
    res.setHeader('Content-Disposition', `attachment; filename="${closure[0].document_name}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Download closure document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
