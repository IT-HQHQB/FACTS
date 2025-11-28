const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, authorizeCaseAccess } = require('../middleware/auth');
const { authorizePermission } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

const router = express.Router();

// Helper function to update workflow stage
const updateCaseWorkflowStage = async (caseId, newStatus, userId, userName, action = 'status_changed', caseTypeId = null, preferredStageId = null) => {
  try {
    const [currentCase] = await pool.execute(
      'SELECT current_workflow_stage_id, case_type_id FROM cases WHERE id = ?',
      [caseId]
    );
    
    const currentStageId = currentCase.length > 0 ? currentCase[0].current_workflow_stage_id : null;
    const actualCaseTypeId = caseTypeId || (currentCase.length > 0 ? currentCase[0].case_type_id : null);
    
    let newStageId = preferredStageId;
    if (!newStageId) {
      // Get next stage using sort_order
      const [currentStage] = await pool.execute(
        'SELECT sort_order FROM workflow_stages WHERE id = ? AND is_active = TRUE',
        [currentStageId]
      );
      
      if (currentStage.length > 0) {
        const [nextStages] = await pool.execute(
          `SELECT * FROM workflow_stages 
           WHERE is_active = TRUE AND sort_order > ? 
           AND (case_type_id = ? OR case_type_id IS NULL)
           ORDER BY CASE WHEN case_type_id IS NULL THEN 1 ELSE 0 END, sort_order ASC LIMIT 1`,
          [currentStage[0].sort_order, actualCaseTypeId]
        );
        
        if (nextStages.length > 0) {
          newStageId = nextStages[0].id;
        }
      }
    }
    
    if (!newStageId) {
      console.log(`No workflow stage found for status: ${newStatus}, case: ${caseId}`);
      return;
    }

    const [caseData] = await pool.execute(
      'SELECT workflow_history, status FROM cases WHERE id = ?',
      [caseId]
    );

    if (caseData.length === 0) return;
    
    if (currentStageId === newStageId && caseData[0].status === newStatus) {
      return;
    }
    
    if (!caseData[0].status || caseData[0].status !== newStatus) {
      await pool.execute(
        'UPDATE cases SET status = ? WHERE id = ?',
        [newStatus, caseId]
      );
    }

    const [stageInfo] = await pool.execute(
      'SELECT stage_name FROM workflow_stages WHERE id = ?',
      [newStageId]
    );

    const stageName = stageInfo.length > 0 ? stageInfo[0].stage_name : 'Unknown Stage';

    let workflowHistory = [];
    try {
      const existingHistory = caseData[0].workflow_history;
      if (existingHistory) {
        workflowHistory = JSON.parse(existingHistory);
      }
    } catch (e) {
      workflowHistory = [];
    }

    workflowHistory.push({
      stage_id: newStageId,
      stage_name: stageName,
      entered_at: new Date().toISOString(),
      entered_by: userId,
      entered_by_name: userName,
      action: action
    });

    await pool.execute(
      'UPDATE cases SET current_workflow_stage_id = ?, workflow_history = ? WHERE id = ?',
      [newStageId, JSON.stringify(workflowHistory), caseId]
    );
  } catch (error) {
    console.error('Error updating case workflow stage:', error);
  }
};

// Get cover letter form for a case
router.get('/case/:caseId', authenticateToken, authorizeCaseAccess, async (req, res) => {
  try {
    const { caseId } = req.params;

    const [forms] = await pool.execute(
      'SELECT * FROM cover_letter_forms WHERE case_id = ?',
      [caseId]
    );

    if (forms.length === 0) {
      return res.json({ form: null });
    }

    const form = forms[0];
    
    // Parse JSON fields
    const formData = {
      id: form.id,
      case_id: form.case_id,
      applicant_details: form.applicant_details ? (typeof form.applicant_details === 'string' ? JSON.parse(form.applicant_details) : form.applicant_details) : null,
      counsellor_details: form.counsellor_details ? (typeof form.counsellor_details === 'string' ? JSON.parse(form.counsellor_details) : form.counsellor_details) : null,
      financial_overview: form.financial_overview ? (typeof form.financial_overview === 'string' ? JSON.parse(form.financial_overview) : form.financial_overview) : null,
      proposed_upliftment_plan: form.proposed_upliftment_plan || '',
      financial_assistance: form.financial_assistance ? (typeof form.financial_assistance === 'string' ? JSON.parse(form.financial_assistance) : form.financial_assistance) : null,
      non_financial_assistance: form.non_financial_assistance || '',
      projected_income: form.projected_income ? (typeof form.projected_income === 'string' ? JSON.parse(form.projected_income) : form.projected_income) : null,
      case_management_comments: form.case_management_comments || '',
      executive_approval: form.executive_approval ? (typeof form.executive_approval === 'string' ? JSON.parse(form.executive_approval) : form.executive_approval) : null,
      is_complete: form.is_complete || false,
      submitted_at: form.submitted_at,
      created_at: form.created_at,
      updated_at: form.updated_at
    };

    res.json({ form: formData });
  } catch (error) {
    console.error('Get cover letter form error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update cover letter form
router.post('/case/:caseId', authenticateToken, authorizeCaseAccess, authorizePermission('cover_letter_forms', 'create'), async (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;
    const {
      applicant_details,
      counsellor_details,
      financial_overview,
      proposed_upliftment_plan,
      financial_assistance,
      non_financial_assistance,
      projected_income,
      case_management_comments,
      executive_approval
    } = req.body;

    // Check if form already exists
    const [existingForms] = await pool.execute(
      'SELECT id FROM cover_letter_forms WHERE case_id = ?',
      [caseId]
    );

    if (existingForms.length > 0) {
      // Update existing form
      const formId = existingForms[0].id;
      
      await pool.execute(
        `UPDATE cover_letter_forms SET
          applicant_details = ?,
          counsellor_details = ?,
          financial_overview = ?,
          proposed_upliftment_plan = ?,
          financial_assistance = ?,
          non_financial_assistance = ?,
          projected_income = ?,
          case_management_comments = ?,
          executive_approval = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        [
          applicant_details ? JSON.stringify(applicant_details) : null,
          counsellor_details ? JSON.stringify(counsellor_details) : null,
          financial_overview ? JSON.stringify(financial_overview) : null,
          proposed_upliftment_plan || null,
          financial_assistance ? JSON.stringify(financial_assistance) : null,
          non_financial_assistance || null,
          projected_income ? JSON.stringify(projected_income) : null,
          case_management_comments || null,
          executive_approval ? JSON.stringify(executive_approval) : null,
          formId
        ]
      );

      res.json({ 
        message: 'Cover letter form updated successfully',
        formId: formId
      });
    } else {
      // Create new form
      const [result] = await pool.execute(
        `INSERT INTO cover_letter_forms (
          case_id,
          applicant_details,
          counsellor_details,
          financial_overview,
          proposed_upliftment_plan,
          financial_assistance,
          non_financial_assistance,
          projected_income,
          case_management_comments,
          executive_approval
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          caseId,
          applicant_details ? JSON.stringify(applicant_details) : null,
          counsellor_details ? JSON.stringify(counsellor_details) : null,
          financial_overview ? JSON.stringify(financial_overview) : null,
          proposed_upliftment_plan || null,
          financial_assistance ? JSON.stringify(financial_assistance) : null,
          non_financial_assistance || null,
          projected_income ? JSON.stringify(projected_income) : null,
          case_management_comments || null,
          executive_approval ? JSON.stringify(executive_approval) : null
        ]
      );

      res.json({ 
        message: 'Cover letter form created successfully',
        formId: result.insertId
      });
    }
  } catch (error) {
    console.error('Create/update cover letter form error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit cover letter form and advance workflow
router.put('/:formId/submit', authenticateToken, authorizePermission('cover_letter_forms', 'submit'), async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get form and case details
    const [forms] = await pool.execute(
      `SELECT clf.*, c.id as case_id, c.case_number, c.case_type_id, c.current_workflow_stage_id, c.status
       FROM cover_letter_forms clf
       JOIN cases c ON clf.case_id = c.id
       WHERE clf.id = ?`,
      [formId]
    );

    if (forms.length === 0) {
      return res.status(404).json({ error: 'Cover letter form not found' });
    }

    const form = forms[0];
    const caseId = form.case_id;

    // Check if case is in Cover Letter stage
    const [currentStages] = await pool.execute(
      'SELECT * FROM workflow_stages WHERE id = ? AND is_active = TRUE',
      [form.current_workflow_stage_id]
    );

    if (currentStages.length === 0 || currentStages[0].stage_key !== 'cover_letter') {
      return res.status(400).json({ error: 'Case is not in Cover Letter stage' });
    }

    // Start transaction
    await pool.query('START TRANSACTION');

    try {
      // Mark form as complete
      await pool.execute(
        'UPDATE cover_letter_forms SET is_complete = TRUE, submitted_by = ?, submitted_at = CURRENT_TIMESTAMP WHERE id = ?',
        [userId, formId]
      );

      // Get next workflow stage
      const currentStage = currentStages[0];
      let nextStage = null;

      // Strategy 1: Use next_stage_id if set
      if (currentStage.next_stage_id) {
        const [nextStages] = await pool.execute(
          'SELECT * FROM workflow_stages WHERE id = ? AND is_active = TRUE',
          [currentStage.next_stage_id]
        );
        if (nextStages.length > 0) {
          nextStage = nextStages[0];
        }
      }

      // Strategy 2: Use sort_order to find next stage
      if (!nextStage) {
        const [nextStages] = await pool.execute(
          'SELECT * FROM workflow_stages WHERE is_active = TRUE AND sort_order > ? ORDER BY sort_order ASC LIMIT 1',
          [currentStage.sort_order]
        );
        if (nextStages.length > 0) {
          nextStage = nextStages[0];
        }
      }

      if (!nextStage) {
        throw new Error('No next stage found in workflow');
      }

      // Get status from next stage's associated_statuses
      let newStatus = `submitted_to_${nextStage.stage_key}`;
      if (nextStage.associated_statuses) {
        try {
          const statuses = JSON.parse(nextStage.associated_statuses);
          if (statuses.length > 0) {
            newStatus = statuses[0];
          }
        } catch (e) {
          // Use default status
        }
      }

      // Update case status and workflow stage
      await pool.execute(
        'UPDATE cases SET status = ?, current_workflow_stage_id = ? WHERE id = ?',
        [newStatus, nextStage.id, caseId]
      );

      // Update workflow history
      await updateCaseWorkflowStage(
        caseId,
        newStatus,
        userId,
        req.user.full_name || req.user.username,
        'cover_letter_submitted',
        form.case_type_id,
        nextStage.id
      );

      // Log status change
      await pool.execute(
        `INSERT INTO status_history (case_id, from_status, to_status, changed_by, comments) 
         VALUES (?, ?, ?, ?, ?)`,
        [caseId, form.status, newStatus, userId, 'Cover letter form submitted']
      );

      // Create notifications for next stage users
      const [stageUsers] = await pool.execute(`
        SELECT DISTINCT u.id 
        FROM users u
        LEFT JOIN workflow_stage_users wsu ON u.id = wsu.user_id AND wsu.workflow_stage_id = ?
        LEFT JOIN workflow_stage_roles wsr ON wsr.workflow_stage_id = ?
        LEFT JOIN roles r ON wsr.role_id = r.id AND r.name = u.role AND r.is_active = 1
        WHERE (wsu.can_view = 1 OR wsr.can_view = 1 OR wsu.can_approve = 1 OR wsr.can_approve = 1) 
          AND u.is_active = TRUE
      `, [nextStage.id, nextStage.id]);

      const notifications = [];
      for (const stageUser of stageUsers) {
        notifications.push([
          stageUser.id,
          caseId,
          `Case Ready for ${nextStage.stage_name}`,
          `Case ${form.case_number || `#${caseId}`} has been submitted and is ready for ${nextStage.stage_name}.`,
          'info'
        ]);
      }

      if (notifications.length > 0) {
        await pool.execute(
          `INSERT INTO notifications (user_id, case_id, title, message, type) VALUES ?`,
          [notifications]
        );
      }

      await pool.query('COMMIT');

      res.json({
        message: 'Cover letter form submitted successfully',
        caseId: caseId,
        newStatus: newStatus,
        nextStage: nextStage.stage_name
      });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Submit cover letter form error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;

