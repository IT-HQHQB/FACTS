const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizePermission } = require('../middleware/auth');

const router = express.Router();

// Get all workflow stages with roles and users (optionally filtered by case type)
router.get('/', authenticateToken, authorizePermission('master', 'read'), async (req, res) => {
  try {
    const { case_type_id } = req.query;
    
    let query = `
      SELECT 
        ws.*,
        ct.name as case_type_name,
        COUNT(DISTINCT wsr.id) as role_count,
        COUNT(DISTINCT wsu.id) as user_count
      FROM workflow_stages ws
      LEFT JOIN case_types ct ON ws.case_type_id = ct.id
      LEFT JOIN workflow_stage_roles wsr ON ws.id = wsr.workflow_stage_id
      LEFT JOIN workflow_stage_users wsu ON ws.id = wsu.workflow_stage_id
      WHERE ws.is_active = TRUE
    `;
    
    const queryParams = [];
    
    if (case_type_id) {
      query += ` AND ws.case_type_id = ?`;
      queryParams.push(case_type_id);
    }
    
    query += `
      GROUP BY ws.id
      ORDER BY ws.sort_order ASC, ws.id ASC
    `;
    
    const [stages] = await pool.execute(query, queryParams);

    // Get roles and users for each stage
    for (let stage of stages) {
       // Get roles for this stage
       const [roles] = await pool.execute(`
         SELECT 
           r.id,
           r.name,
           r.display_name,
        wsr.can_approve,
        wsr.can_reject,
        wsr.can_review,
        wsr.can_view,
        wsr.can_edit,
        wsr.can_delete,
        wsr.can_create_case,
        wsr.can_fill_case
         FROM workflow_stage_roles wsr
         JOIN roles r ON wsr.role_id = r.id
         WHERE wsr.workflow_stage_id = ? AND r.is_active = 1
         ORDER BY r.name
       `, [stage.id]);

       // Get users for this stage
       const [users] = await pool.execute(`
         SELECT 
           u.id,
           u.full_name,
           u.email,
           u.role,
        wsu.can_approve,
        wsu.can_review,
        wsu.can_view,
        wsu.can_edit,
        wsu.can_delete,
        wsu.can_create_case,
        wsu.can_fill_case
         FROM workflow_stage_users wsu
         JOIN users u ON wsu.user_id = u.id
         WHERE wsu.workflow_stage_id = ? AND u.is_active = TRUE
         ORDER BY u.full_name
       `, [stage.id]);

      stage.roles = roles;
      stage.users = users;
      
      // Parse associated_statuses if it exists
      if (stage.associated_statuses) {
        try {
          stage.associated_statuses = JSON.parse(stage.associated_statuses);
        } catch (e) {
          stage.associated_statuses = [];
        }
      } else {
        stage.associated_statuses = [];
      }
    }

    res.json({ stages });
  } catch (error) {
    console.error('Get workflow stages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get status to workflow stage mapping (for viewing mappings)
router.get('/status-mappings', authenticateToken, authorizePermission('master', 'read'), async (req, res) => {
  try {
    // Get all active workflow stages with their associated statuses
    const [stages] = await pool.execute(
      'SELECT id, stage_name, stage_key, sort_order, associated_statuses FROM workflow_stages WHERE is_active = TRUE ORDER BY sort_order ASC'
    );

    // Get all active statuses
    const [statuses] = await pool.execute(
      'SELECT id, name, description FROM statuses WHERE is_active = TRUE ORDER BY sort_order ASC'
    );

    // Build mapping
    const statusToStageMap = {};
    const stageDetails = {};

    stages.forEach(stage => {
      let associatedStatuses = [];
      if (stage.associated_statuses) {
        try {
          associatedStatuses = JSON.parse(stage.associated_statuses);
        } catch (e) {
          associatedStatuses = [];
        }
      }

      stageDetails[stage.id] = {
        id: stage.id,
        stage_name: stage.stage_name,
        stage_key: stage.stage_key,
        sort_order: stage.sort_order
      };

      // Map each associated status to this stage
      associatedStatuses.forEach(status => {
        if (!statusToStageMap[status]) {
          statusToStageMap[status] = [];
        }
        statusToStageMap[status].push(stage.id);
      });
    });

    // Build reverse mapping (which statuses map to which stages)
    const stageToStatusMap = {};
    stages.forEach(stage => {
      let associatedStatuses = [];
      if (stage.associated_statuses) {
        try {
          associatedStatuses = JSON.parse(stage.associated_statuses);
        } catch (e) {
          associatedStatuses = [];
        }
      }
      stageToStatusMap[stage.id] = {
        stage: stageDetails[stage.id],
        statuses: associatedStatuses
      };
    });

    res.json({
      statusToStage: statusToStageMap,
      stageToStatus: stageToStatusMap,
      allStatuses: statuses,
      allStages: stages.map(s => ({
        ...s,
        associated_statuses: s.associated_statuses ? JSON.parse(s.associated_statuses) : []
      }))
    });
  } catch (error) {
    console.error('Get status mappings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get workflow stages grouped by case type
router.get('/by-case-type', authenticateToken, authorizePermission('master', 'read'), async (req, res) => {
  try {
    const { include_deleted } = req.query;
    console.log('API called with include_deleted:', include_deleted);
    
    // Get all case types
    const [caseTypes] = await pool.execute(`
      SELECT * FROM case_types 
      WHERE is_active = TRUE 
      ORDER BY sort_order ASC, name ASC
    `);

    const result = {};

    for (const caseType of caseTypes) {
      // Get workflow stages for this case type (include deleted if requested)
      // Include both case-type-specific stages AND global stages (case_type_id IS NULL)
      let stagesQuery = `
        SELECT 
          ws.*,
          COUNT(DISTINCT wsr.id) as role_count,
          COUNT(DISTINCT wsu.id) as user_count
        FROM workflow_stages ws
        LEFT JOIN workflow_stage_roles wsr ON ws.id = wsr.workflow_stage_id
        LEFT JOIN workflow_stage_users wsu ON ws.id = wsu.workflow_stage_id
        WHERE (ws.case_type_id = ? OR ws.case_type_id IS NULL)
      `;
      
      if (!include_deleted) {
        stagesQuery += ` AND ws.is_active = TRUE`;
      }
      
      stagesQuery += `
        GROUP BY ws.id
        ORDER BY ws.is_active DESC, CASE WHEN ws.case_type_id IS NULL THEN 1 ELSE 0 END, ws.sort_order ASC, ws.id ASC
      `;
      
      const [stages] = await pool.execute(stagesQuery, [caseType.id]);
      console.log(`Stages for case type ${caseType.name} (${caseType.id}):`, stages.length, stages.map(s => ({ id: s.id, name: s.stage_name, active: s.is_active })));

      // Get roles and users for each stage
      for (let stage of stages) {
        // Get roles for this stage
        const [roles] = await pool.execute(`
          SELECT 
            r.id,
            r.name,
            r.display_name,
            wsr.can_approve,
            wsr.can_reject,
            wsr.can_review,
            wsr.can_view,
            wsr.can_edit,
            wsr.can_delete,
            wsr.can_create_case,
            wsr.can_fill_case
          FROM workflow_stage_roles wsr
          JOIN roles r ON wsr.role_id = r.id
          WHERE wsr.workflow_stage_id = ? AND r.is_active = 1
          ORDER BY r.name
        `, [stage.id]);

        // Get users for this stage
        const [users] = await pool.execute(`
          SELECT 
            u.id,
            u.full_name,
            u.email,
            u.role,
        wsu.can_approve,
        wsu.can_review,
        wsu.can_view,
        wsu.can_edit,
        wsu.can_delete,
        wsu.can_create_case,
        wsu.can_fill_case
          FROM workflow_stage_users wsu
          JOIN users u ON wsu.user_id = u.id
          WHERE wsu.workflow_stage_id = ? AND u.is_active = TRUE
          ORDER BY u.full_name
        `, [stage.id]);

        stage.roles = roles;
        stage.users = users;
      }

      result[caseType.id] = {
        caseType,
        stages
      };
    }

    res.json({ workflowByCaseType: result });
  } catch (error) {
    console.error('Get workflow stages by case type error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single workflow stage by ID
router.get('/:id', authenticateToken, authorizePermission('master', 'read'), async (req, res) => {
  try {
    const { id } = req.params;

    const [stages] = await pool.execute(
      'SELECT * FROM workflow_stages WHERE id = ? AND is_active = TRUE',
      [id]
    );

    if (stages.length === 0) {
      return res.status(404).json({ error: 'Workflow stage not found' });
    }

    const stage = stages[0];

     // Get roles for this stage
     const [roles] = await pool.execute(`
       SELECT 
         r.id,
         r.name,
         r.display_name,
         wsr.can_approve,
         wsr.can_reject,
         wsr.can_review,
         wsr.can_view,
         wsr.can_edit,
         wsr.can_delete,
         wsr.can_create_case,
         wsr.can_fill_case
       FROM workflow_stage_roles wsr
       JOIN roles r ON wsr.role_id = r.id
       WHERE wsr.workflow_stage_id = ? AND r.is_active = 1
       ORDER BY r.name
     `, [id]);

     // Get users for this stage
     const [users] = await pool.execute(`
       SELECT 
         u.id,
         u.full_name,
         u.email,
         u.role,
         wsu.can_approve,
         wsu.can_review,
         wsu.can_view,
         wsu.can_edit,
         wsu.can_delete,
         wsu.can_create_case,
         wsu.can_fill_case
       FROM workflow_stage_users wsu
       JOIN users u ON wsu.user_id = u.id
       WHERE wsu.workflow_stage_id = ? AND u.is_active = TRUE
       ORDER BY u.full_name
     `, [id]);

    stage.roles = roles;
    stage.users = users;

    res.json({ stage });
  } catch (error) {
    console.error('Get workflow stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new workflow stage
router.post('/', authenticateToken, authorizePermission('master', 'create'), async (req, res) => {
  try {
     const { 
       stage_name, 
       stage_key, 
       description, 
       sort_order,
       case_type_id,
       associated_statuses,
       sla_value,
       sla_unit,
       sla_warning_value,
       sla_warning_unit,
       roles = [],
       users = []
     } = req.body;

    // Normalize case_type_id: convert empty string, NaN, or 0 to null
    const normalizedCaseTypeId = (case_type_id && !isNaN(case_type_id) && case_type_id > 0) 
      ? parseInt(case_type_id, 10) 
      : null;

    if (!stage_name || !stage_key) {
      return res.status(400).json({ error: 'Stage name and key are required' });
    }

    // Validate SLA configuration
    if (sla_value !== undefined && sla_value !== null) {
      if (typeof sla_value !== 'number' || sla_value <= 0) {
        return res.status(400).json({ error: 'SLA value must be a positive number' });
      }
      if (!sla_unit || !['hours', 'days', 'business_days', 'weeks', 'months'].includes(sla_unit)) {
        return res.status(400).json({ error: 'SLA unit is required and must be one of: hours, days, business_days, weeks, months' });
      }
    }
    if (sla_warning_value !== undefined && sla_warning_value !== null) {
      if (typeof sla_warning_value !== 'number' || sla_warning_value <= 0) {
        return res.status(400).json({ error: 'SLA warning value must be a positive number' });
      }
      if (!sla_warning_unit || !['hours', 'days', 'business_days', 'weeks', 'months'].includes(sla_warning_unit)) {
        return res.status(400).json({ error: 'SLA warning unit is required and must be one of: hours, days, business_days, weeks, months' });
      }
    }

    // Validate and format associated_statuses
    let formattedAssociatedStatuses = null;
    if (associated_statuses) {
      if (Array.isArray(associated_statuses)) {
        // Convert array to JSON
        formattedAssociatedStatuses = JSON.stringify(associated_statuses);
      } else if (typeof associated_statuses === 'string') {
        // If it's a string, try to parse it as JSON
        try {
          const parsed = JSON.parse(associated_statuses);
          if (Array.isArray(parsed)) {
            formattedAssociatedStatuses = JSON.stringify(parsed);
          }
        } catch (e) {
          return res.status(400).json({ error: 'associated_statuses must be a valid JSON array' });
        }
      }
    }

    // Check if stage key already exists for the same case type
    let duplicateCheckQuery;
    let duplicateCheckParams;
    
    if (normalizedCaseTypeId === null) {
      // For global stages (case_type_id = NULL), check if any global stage with this key exists
      duplicateCheckQuery = 'SELECT id FROM workflow_stages WHERE stage_key = ? AND case_type_id IS NULL';
      duplicateCheckParams = [stage_key];
    } else {
      // For case-type-specific stages, check if stage with same key exists for this case type OR as global
      duplicateCheckQuery = 'SELECT id FROM workflow_stages WHERE stage_key = ? AND (case_type_id = ? OR case_type_id IS NULL)';
      duplicateCheckParams = [stage_key, normalizedCaseTypeId];
    }
    
    const [existing] = await pool.execute(duplicateCheckQuery, duplicateCheckParams);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Stage key already exists' });
    }

    // Get next sort order if not provided
    let finalSortOrder = sort_order;
    if (!finalSortOrder) {
      const [maxOrder] = await pool.execute(
        'SELECT MAX(sort_order) as max_order FROM workflow_stages'
      );
      finalSortOrder = (maxOrder[0].max_order || 0) + 1;
    }

     // Create workflow stage
     const [result] = await pool.execute(`
       INSERT INTO workflow_stages (stage_name, stage_key, description, sort_order, case_type_id, associated_statuses, sla_value, sla_unit, sla_warning_value, sla_warning_unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     `, [stage_name, stage_key, description || null, finalSortOrder, normalizedCaseTypeId, formattedAssociatedStatuses, sla_value || null, sla_unit || null, sla_warning_value || null, sla_warning_unit || null]);

    const stageId = result.insertId;

    // Add roles if provided
    for (const role of roles) {
      await pool.execute(`
        INSERT INTO workflow_stage_roles (workflow_stage_id, role_id, can_approve, can_review, can_view, can_edit, can_delete)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        stageId, 
        role.role_id, 
        role.can_approve || false, 
        role.can_review || false, 
        role.can_view !== false,
        role.can_edit || false,
        role.can_delete || false
      ]);
    }

    // Add users if provided
    for (const user of users) {
      await pool.execute(`
        INSERT INTO workflow_stage_users (workflow_stage_id, user_id, can_approve, can_reject, can_review, can_view, can_edit, can_delete)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        stageId, 
        user.user_id, 
        user.can_approve || false,
        user.can_reject || false,
        user.can_review || false, 
        user.can_view !== false,
        user.can_edit || false,
        user.can_delete || false
      ]);
    }

    res.status(201).json({
      message: 'Workflow stage created successfully',
      stageId
    });
  } catch (error) {
    console.error('Create workflow stage error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error sql:', error.sql);
    console.error('Error stack:', error.stack);
    
    // Ensure response hasn't been sent yet
    if (res.headersSent) {
      return;
    }
    
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Stage key already exists' });
    } else if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_NO_REFERENCED_ROW') {
      res.status(400).json({ error: 'Invalid case type ID. The selected case type does not exist.' });
    } else {
      // Include error details in development mode
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? (error.message || 'Internal server error')
        : 'Internal server error';
      res.status(500).json({ 
        error: errorMessage, 
        ...(process.env.NODE_ENV === 'development' && { 
          details: error.message,
          code: error.code,
          sql: error.sql ? error.sql.substring(0, 200) : undefined
        })
      });
    }
  }
});

// Reorder workflow stages (must be before /:id route)
router.put('/reorder', authenticateToken, authorizePermission('master', 'update'), async (req, res) => {
  try {
    const { stages } = req.body;

    if (!Array.isArray(stages)) {
      return res.status(400).json({ error: 'Stages must be an array' });
    }

    // Start transaction
    await pool.query('START TRANSACTION');

    try {
      // Update sort order for each stage
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        await pool.execute(
          'UPDATE workflow_stages SET sort_order = ? WHERE id = ?',
          [i + 1, stage.id]
        );
      }

      await pool.query('COMMIT');
      res.json({ message: 'Workflow stages reordered successfully' });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Reorder workflow stages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update role permissions in workflow stage (must be before /:id route)
router.put('/:id/roles/:roleId', authenticateToken, authorizePermission('master', 'update'), async (req, res) => {
  try {
    const { id, roleId } = req.params;
    const { can_approve, can_reject, can_review, can_view, can_edit, can_delete, can_create_case, can_fill_case } = req.body;

    // Convert boolean values to 1/0 for MySQL
    const canApproveVal = Boolean(can_approve) ? 1 : 0;
    const canRejectVal = Boolean(can_reject) ? 1 : 0;
    const canReviewVal = Boolean(can_review) ? 1 : 0;
    const canViewVal = can_view !== false ? 1 : 0;
    const canEditVal = Boolean(can_edit) ? 1 : 0;
    const canDeleteVal = Boolean(can_delete) ? 1 : 0;
    const canCreateCaseVal = Boolean(can_create_case) ? 1 : 0;
    const canFillCaseVal = Boolean(can_fill_case) ? 1 : 0;

    const [result] = await pool.execute(
      'UPDATE workflow_stage_roles SET can_approve = ?, can_reject = ?, can_review = ?, can_view = ?, can_edit = ?, can_delete = ?, can_create_case = ?, can_fill_case = ? WHERE workflow_stage_id = ? AND role_id = ?',
      [canApproveVal, canRejectVal, canReviewVal, canViewVal, canEditVal, canDeleteVal, canCreateCaseVal, canFillCaseVal, id, roleId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Role assignment not found' });
    }

    res.json({ message: 'Role permissions updated successfully' });
  } catch (error) {
    console.error('Update role permissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user permissions in workflow stage (must be before /:id route)
router.put('/:id/users/:userId', authenticateToken, authorizePermission('master', 'update'), async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { can_approve, can_reject, can_review, can_view, can_edit, can_delete, can_create_case, can_fill_case } = req.body;

    // Convert boolean values to 1/0 for MySQL
    const canApproveVal = can_approve !== undefined ? (Boolean(can_approve) ? 1 : 0) : null;
    const canRejectVal = can_reject !== undefined ? (Boolean(can_reject) ? 1 : 0) : null;
    const canReviewVal = can_review !== undefined ? (Boolean(can_review) ? 1 : 0) : null;
    const canViewVal = can_view !== undefined ? (can_view !== false ? 1 : 0) : null;
    const canEditVal = can_edit !== undefined ? (Boolean(can_edit) ? 1 : 0) : null;
    const canDeleteVal = can_delete !== undefined ? (Boolean(can_delete) ? 1 : 0) : null;
    const canCreateCaseVal = can_create_case !== undefined ? (Boolean(can_create_case) ? 1 : 0) : null;
    const canFillCaseVal = can_fill_case !== undefined ? (Boolean(can_fill_case) ? 1 : 0) : null;

    const [result] = await pool.execute(
      'UPDATE workflow_stage_users SET can_approve = ?, can_reject = ?, can_review = ?, can_view = ?, can_edit = ?, can_delete = ?, can_create_case = ?, can_fill_case = ? WHERE workflow_stage_id = ? AND user_id = ?',
      [canApproveVal, canRejectVal, canReviewVal, canViewVal, canEditVal, canDeleteVal, canCreateCaseVal, canFillCaseVal, id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User assignment not found' });
    }

    res.json({ message: 'User permissions updated successfully' });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update workflow stage
router.put('/:id', authenticateToken, authorizePermission('master', 'update'), async (req, res) => {
  try {
    const { id } = req.params;
     const { 
       stage_name, 
       stage_key, 
       description, 
       sort_order,
       is_active,
       associated_statuses,
       sla_value,
       sla_unit,
       sla_warning_value,
       sla_warning_unit
     } = req.body;

    // Validate SLA configuration
    if (sla_value !== undefined && sla_value !== null) {
      if (typeof sla_value !== 'number' || sla_value <= 0) {
        return res.status(400).json({ error: 'SLA value must be a positive number' });
      }
      if (!sla_unit || !['hours', 'days', 'business_days', 'weeks', 'months'].includes(sla_unit)) {
        return res.status(400).json({ error: 'SLA unit is required and must be one of: hours, days, business_days, weeks, months' });
      }
    }
    if (sla_warning_value !== undefined && sla_warning_value !== null) {
      if (typeof sla_warning_value !== 'number' || sla_warning_value <= 0) {
        return res.status(400).json({ error: 'SLA warning value must be a positive number' });
      }
      if (!sla_warning_unit || !['hours', 'days', 'business_days', 'weeks', 'months'].includes(sla_warning_unit)) {
        return res.status(400).json({ error: 'SLA warning unit is required and must be one of: hours, days, business_days, weeks, months' });
      }
    }

    // Validate and format associated_statuses
    let formattedAssociatedStatuses = null;
    if (associated_statuses !== undefined) {
      if (associated_statuses === null) {
        formattedAssociatedStatuses = null;
      } else if (Array.isArray(associated_statuses)) {
        formattedAssociatedStatuses = JSON.stringify(associated_statuses);
      } else if (typeof associated_statuses === 'string') {
        try {
          const parsed = JSON.parse(associated_statuses);
          if (Array.isArray(parsed)) {
            formattedAssociatedStatuses = JSON.stringify(parsed);
          } else if (parsed === null) {
            formattedAssociatedStatuses = null;
          }
        } catch (e) {
          return res.status(400).json({ error: 'associated_statuses must be a valid JSON array or null' });
        }
      }
    }

    // Check if stage exists
    const [existing] = await pool.execute(
      'SELECT id FROM workflow_stages WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Workflow stage not found' });
    }

    // Check if new stage key conflicts with existing stages
    if (stage_key) {
      const [keyConflict] = await pool.execute(
        'SELECT id FROM workflow_stages WHERE stage_key = ? AND id != ?',
        [stage_key, id]
      );

      if (keyConflict.length > 0) {
        return res.status(400).json({ error: 'Stage key already exists' });
      }
    }

    // Update stage
    const updateFields = [];
    const updateValues = [];

    if (stage_name) {
      updateFields.push('stage_name = ?');
      updateValues.push(stage_name);
    }
    if (stage_key) {
      updateFields.push('stage_key = ?');
      updateValues.push(stage_key);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (sort_order !== undefined) {
      updateFields.push('sort_order = ?');
      updateValues.push(sort_order);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }
    if (associated_statuses !== undefined) {
      updateFields.push('associated_statuses = ?');
      updateValues.push(formattedAssociatedStatuses);
    }
    if (sla_value !== undefined) {
      updateFields.push('sla_value = ?');
      updateValues.push(sla_value);
    }
    if (sla_unit !== undefined) {
      updateFields.push('sla_unit = ?');
      updateValues.push(sla_unit);
    }
    if (sla_warning_value !== undefined) {
      updateFields.push('sla_warning_value = ?');
      updateValues.push(sla_warning_value);
    }
    if (sla_warning_unit !== undefined) {
      updateFields.push('sla_warning_unit = ?');
      updateValues.push(sla_warning_unit);
    }

    updateValues.push(id);

    if (updateFields.length > 0) {
      await pool.execute(
        `UPDATE workflow_stages SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
    }

    res.json({ message: 'Workflow stage updated successfully' });
  } catch (error) {
    console.error('Update workflow stage error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'Stage key already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Delete workflow stage (soft delete)
router.delete('/:id', authenticateToken, authorizePermission('master', 'delete'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if stage exists
    const [existing] = await pool.execute(
      'SELECT id FROM workflow_stages WHERE id = ? AND is_active = TRUE',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Workflow stage not found' });
    }

    // Check if stage is being used by any cases
    const [cases] = await pool.execute(
      'SELECT COUNT(*) as count FROM cases WHERE current_workflow_stage_id = ?',
      [id]
    );

    if (cases[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete workflow stage that is being used by existing cases' 
      });
    }

    // Soft delete stage
    await pool.execute(
      'UPDATE workflow_stages SET is_active = FALSE WHERE id = ?',
      [id]
    );

    res.json({ message: 'Workflow stage deleted successfully' });
  } catch (error) {
    console.error('Delete workflow stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Restore soft-deleted workflow stage
router.put('/:id/restore', authenticateToken, authorizePermission('master', 'update'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if stage exists and is soft-deleted
    const [existing] = await pool.execute(
      'SELECT id FROM workflow_stages WHERE id = ? AND is_active = FALSE',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Soft-deleted workflow stage not found' });
    }

    // Restore stage
    await pool.execute(
      'UPDATE workflow_stages SET is_active = TRUE WHERE id = ?',
      [id]
    );

    res.json({ message: 'Workflow stage restored successfully' });
  } catch (error) {
    console.error('Restore workflow stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add role to workflow stage
router.post('/:id/roles', authenticateToken, authorizePermission('master', 'create'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id, can_approve, can_reject, can_review, can_view, can_edit, can_delete, can_create_case, can_fill_case } = req.body;

    if (!role_id) {
      return res.status(400).json({ error: 'Role ID is required' });
    }

    // Check if stage exists
    const [stage] = await pool.execute(
      'SELECT id FROM workflow_stages WHERE id = ? AND is_active = TRUE',
      [id]
    );

    if (stage.length === 0) {
      return res.status(404).json({ error: 'Workflow stage not found' });
    }

    // Check if role exists
    const [role] = await pool.execute(
      'SELECT id FROM roles WHERE id = ? AND is_active = 1',
      [role_id]
    );

    if (role.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }

    // Add role to stage
    await pool.execute(`
      INSERT INTO workflow_stage_roles (workflow_stage_id, role_id, can_approve, can_reject, can_review, can_view, can_edit, can_delete, can_create_case, can_fill_case)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        can_approve = VALUES(can_approve),
        can_reject = VALUES(can_reject),
        can_review = VALUES(can_review),
        can_view = VALUES(can_view),
        can_edit = VALUES(can_edit),
        can_delete = VALUES(can_delete),
        can_create_case = VALUES(can_create_case),
        can_fill_case = VALUES(can_fill_case)
    `, [id, role_id, can_approve || false, can_reject || false, can_review || false, can_view !== false, can_edit || false, can_delete || false, can_create_case || false, can_fill_case || false]);

    res.json({ message: 'Role added to workflow stage successfully' });
  } catch (error) {
    console.error('Add role to workflow stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove role from workflow stage
router.delete('/:id/roles/:roleId', authenticateToken, authorizePermission('master', 'delete'), async (req, res) => {
  try {
    const { id, roleId } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM workflow_stage_roles WHERE workflow_stage_id = ? AND role_id = ?',
      [id, roleId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Role assignment not found' });
    }

    res.json({ message: 'Role removed from workflow stage successfully' });
  } catch (error) {
    console.error('Remove role from workflow stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add user to workflow stage
router.post('/:id/users', authenticateToken, authorizePermission('master', 'create'), async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, can_approve, can_reject, can_review, can_view, can_edit, can_delete, can_create_case, can_fill_case } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if stage exists
    const [stage] = await pool.execute(
      'SELECT id FROM workflow_stages WHERE id = ? AND is_active = TRUE',
      [id]
    );

    if (stage.length === 0) {
      return res.status(404).json({ error: 'Workflow stage not found' });
    }

    // Check if user exists
    const [user] = await pool.execute(
      'SELECT id FROM users WHERE id = ? AND is_active = TRUE',
      [user_id]
    );

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add user to stage
    await pool.execute(`
      INSERT INTO workflow_stage_users (workflow_stage_id, user_id, can_approve, can_reject, can_review, can_view, can_edit, can_delete, can_create_case, can_fill_case)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        can_approve = VALUES(can_approve),
        can_reject = VALUES(can_reject),
        can_review = VALUES(can_review),
        can_view = VALUES(can_view),
        can_edit = VALUES(can_edit),
        can_delete = VALUES(can_delete),
        can_create_case = VALUES(can_create_case),
        can_fill_case = VALUES(can_fill_case)
    `, [id, user_id, can_approve || false, can_reject || false, can_review || false, can_view !== false, can_edit || false, can_delete || false, can_create_case || false, can_fill_case || false]);

    res.json({ message: 'User added to workflow stage successfully' });
  } catch (error) {
    console.error('Add user to workflow stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove user from workflow stage
router.delete('/:id/users/:userId', authenticateToken, authorizePermission('master', 'delete'), async (req, res) => {
  try {
    const { id, userId } = req.params;

    const [result] = await pool.execute(
      'DELETE FROM workflow_stage_users WHERE workflow_stage_id = ? AND user_id = ?',
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User assignment not found' });
    }

    res.json({ message: 'User removed from workflow stage successfully' });
  } catch (error) {
    console.error('Remove user from workflow stage error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available roles for assignment
router.get('/available/roles', authenticateToken, authorizePermission('master', 'read'), async (req, res) => {
  try {
    const [roles] = await pool.execute(`
      SELECT id, name, display_name, description
      FROM roles 
      WHERE is_active = 1
      ORDER BY name
    `);

    res.json({ roles });
  } catch (error) {
    console.error('Get available roles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get available users for assignment
router.get('/available/users', authenticateToken, authorizePermission('master', 'read'), async (req, res) => {
  try {
    const [users] = await pool.execute(`
      SELECT id, full_name, email, role, username
      FROM users 
      WHERE is_active = TRUE
      ORDER BY full_name
    `);

    res.json({ users });
  } catch (error) {
    console.error('Get available users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
