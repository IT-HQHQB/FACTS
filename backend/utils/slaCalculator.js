const { pool } = require('../config/database');
const notificationService = require('../services/notificationService');

/**
 * Convert time value and unit to hours
 * @param {number} value - The numeric value
 * @param {string} unit - The time unit (hours, days, business_days, weeks, months)
 * @returns {number} - Value in hours
 */
function convertToHours(value, unit) {
  if (!value || !unit) return null;

  const conversions = {
    hours: 1,
    days: 24,
    business_days: 8, // 8 business hours per day
    weeks: 168, // 7 * 24
    months: 730 // Average 30.4 days * 24 hours
  };

  const multiplier = conversions[unit];
  if (!multiplier) {
    console.warn(`Unknown time unit: ${unit}`);
    return null;
  }

  return value * multiplier;
}

/**
 * Calculate business hours between two dates (excluding weekends)
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} - Business hours elapsed
 */
function calculateBusinessHours(startDate, endDate) {
  let hours = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current < end) {
    const dayOfWeek = current.getDay();
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      hours += 8; // 8 business hours per day
    }
    current.setHours(current.getHours() + 1);
  }

  return hours;
}

/**
 * Calculate SLA status for a case
 * @param {number} caseId - Case ID
 * @param {object} workflowStage - Workflow stage object with SLA configuration
 * @returns {object} - SLA status information
 */
const DEFAULT_SLA = { status: 'on_time', hoursRemaining: null, hoursElapsed: 0, hoursOverdue: 0 };

async function calculateSLAStatus(caseId, workflowStage) {
  try {
    // Get case data (current_stage_entered_at may not exist in older DBs)
    let cases;
    try {
      [cases] = await pool.execute(
        'SELECT current_stage_entered_at, current_workflow_stage_id FROM cases WHERE id = ?',
        [caseId]
      );
    } catch (colError) {
      if (colError.code === 'ER_BAD_FIELD_ERROR' && colError.message && colError.message.includes('current_stage_entered_at')) {
        return DEFAULT_SLA;
      }
      throw colError;
    }

    if (cases.length === 0) {
      return DEFAULT_SLA;
    }

    const caseData = cases[0];

    // If no SLA configured for this stage, return on_time
    if (!workflowStage || !workflowStage.sla_value || !workflowStage.sla_unit) {
      return DEFAULT_SLA;
    }

    // If case hasn't entered the stage yet (or column missing), return on_time
    if (!caseData.current_stage_entered_at) {
      return DEFAULT_SLA;
    }

    const enteredAt = new Date(caseData.current_stage_entered_at);
    const now = new Date();

    // Calculate elapsed time
    let hoursElapsed;
    if (workflowStage.sla_unit === 'business_days') {
      hoursElapsed = calculateBusinessHours(enteredAt, now);
    } else {
      hoursElapsed = (now - enteredAt) / (1000 * 60 * 60); // Convert milliseconds to hours
    }

    // Convert SLA to hours
    const slaHours = convertToHours(workflowStage.sla_value, workflowStage.sla_unit);
    const warningHours = workflowStage.sla_warning_value && workflowStage.sla_warning_unit
      ? convertToHours(workflowStage.sla_warning_value, workflowStage.sla_warning_unit)
      : null;

    // Calculate status
    let status = 'on_time';
    let hoursRemaining = slaHours - hoursElapsed;
    let hoursOverdue = 0;

    if (hoursElapsed >= slaHours) {
      status = 'breached';
      hoursOverdue = hoursElapsed - slaHours;
      hoursRemaining = 0;
    } else if (warningHours && hoursElapsed >= warningHours) {
      status = 'warning';
      hoursRemaining = slaHours - hoursElapsed;
    } else {
      hoursRemaining = slaHours - hoursElapsed;
    }

    return {
      status,
      hoursRemaining: Math.max(0, hoursRemaining),
      hoursElapsed,
      hoursOverdue,
      slaHours,
      warningHours
    };
  } catch (error) {
    console.error('Error calculating SLA status:', error);
    return { status: 'on_time', hoursRemaining: null, hoursElapsed: 0, hoursOverdue: 0 };
  }
}

/**
 * Update case SLA status in database
 * @param {number} caseId - Case ID
 * @param {object} slaInfo - SLA status information from calculateSLAStatus
 */
async function updateCaseSLAStatus(caseId, slaInfo) {
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Get current case SLA status
    const [cases] = await pool.execute(
      'SELECT sla_status, sla_breached_at FROM cases WHERE id = ?',
      [caseId]
    );

    if (cases.length === 0) return;

    const currentStatus = cases[0].sla_status;
    const breachedAt = cases[0].sla_breached_at;

    // Update status
    if (slaInfo.status === 'breached' && !breachedAt) {
      // First time breaching
      await pool.execute(
        'UPDATE cases SET sla_status = ?, sla_breached_at = ? WHERE id = ?',
        [slaInfo.status, now, caseId]
      );
    } else if (slaInfo.status !== currentStatus) {
      // Status changed
      if (slaInfo.status === 'breached') {
        await pool.execute(
          'UPDATE cases SET sla_status = ?, sla_breached_at = ? WHERE id = ?',
          [slaInfo.status, now, caseId]
        );
      } else {
        await pool.execute(
          'UPDATE cases SET sla_status = ?, sla_breached_at = NULL WHERE id = ?',
          [slaInfo.status, caseId]
        );
      }
    }
  } catch (error) {
    console.error('Error updating case SLA status:', error);
  }
}

/**
 * Check and send SLA notifications for all cases
 */
async function checkAndSendSLANotifications() {
  try {
    // Get all active cases with workflow stages that have SLA configured
    const [cases] = await pool.execute(`
      SELECT 
        c.id as case_id,
        c.case_number,
        c.current_workflow_stage_id,
        c.current_stage_entered_at,
        c.sla_status,
        c.sla_warning_sent_at,
        c.sla_breach_notification_sent_at,
        c.roles as assigned_dcm_id,
        c.assigned_counselor_id,
        a.first_name,
        a.last_name,
        ws.sla_value,
        ws.sla_unit,
        ws.sla_warning_value,
        ws.sla_warning_unit,
        ws.stage_name
      FROM cases c
      JOIN applicants a ON c.applicant_id = a.id
      LEFT JOIN workflow_stages ws ON c.current_workflow_stage_id = ws.id
      WHERE c.current_workflow_stage_id IS NOT NULL
        AND c.current_stage_entered_at IS NOT NULL
        AND ws.sla_value IS NOT NULL
        AND ws.sla_unit IS NOT NULL
    `);

    for (const caseData of cases) {
      const slaInfo = await calculateSLAStatus(caseData.case_id, {
        sla_value: caseData.sla_value,
        sla_unit: caseData.sla_unit,
        sla_warning_value: caseData.sla_warning_value,
        sla_warning_unit: caseData.sla_warning_unit
      });

      // Update SLA status
      await updateCaseSLAStatus(caseData.case_id, slaInfo);

      // Send warning notification
      if (slaInfo.status === 'warning' && !caseData.sla_warning_sent_at) {
        const warningHours = convertToHours(caseData.sla_warning_value, caseData.sla_warning_unit);
        const hoursRemaining = slaInfo.hoursRemaining;
        
        // Notify assigned users
        const userIds = [];
        if (caseData.assigned_dcm_id) userIds.push(caseData.assigned_dcm_id);
        if (caseData.assigned_counselor_id) userIds.push(caseData.assigned_counselor_id);

        // Also get users with permissions for this workflow stage
        const [stageUsers] = await pool.execute(
          'SELECT DISTINCT user_id FROM workflow_stage_users WHERE workflow_stage_id = ?',
          [caseData.current_workflow_stage_id]
        );
        stageUsers.forEach(u => {
          if (!userIds.includes(u.user_id)) userIds.push(u.user_id);
        });

        const [stageRoles] = await pool.execute(
          'SELECT DISTINCT r.name as role_name FROM workflow_stage_roles wsr JOIN roles r ON wsr.role_id = r.id WHERE wsr.workflow_stage_id = ? AND r.is_active = 1',
          [caseData.current_workflow_stage_id]
        );
        for (const role of stageRoles) {
          const [roleUsers] = await pool.execute(
            'SELECT id FROM users WHERE role = ? AND is_active = TRUE',
            [role.role_name]
          );
          roleUsers.forEach(u => {
            if (!userIds.includes(u.id)) userIds.push(u.id);
          });
        }

        const daysRemaining = Math.ceil(hoursRemaining / 24);
        const title = `SLA Warning - Case ${caseData.case_number}`;
        const message = `Case ${caseData.case_number} for ${caseData.first_name} ${caseData.last_name} is approaching SLA deadline. ${daysRemaining} day(s) remaining in ${caseData.stage_name} stage.`;

        for (const userId of userIds) {
          await notificationService.createNotification(
            userId,
            caseData.case_id,
            title,
            message,
            'warning'
          );
        }

        // Mark warning as sent
        await pool.execute(
          'UPDATE cases SET sla_warning_sent_at = NOW() WHERE id = ?',
          [caseData.case_id]
        );
      }

      // Send breach notification
      if (slaInfo.status === 'breached' && !caseData.sla_breach_notification_sent_at) {
        const hoursOverdue = slaInfo.hoursOverdue;
        const daysOverdue = Math.ceil(hoursOverdue / 24);

        // Notify assigned users and stage users
        const userIds = [];
        if (caseData.assigned_dcm_id) userIds.push(caseData.assigned_dcm_id);
        if (caseData.assigned_counselor_id) userIds.push(caseData.assigned_counselor_id);

        const [stageUsers] = await pool.execute(
          'SELECT DISTINCT user_id FROM workflow_stage_users WHERE workflow_stage_id = ?',
          [caseData.current_workflow_stage_id]
        );
        stageUsers.forEach(u => {
          if (!userIds.includes(u.user_id)) userIds.push(u.user_id);
        });

        const [stageRoles] = await pool.execute(
          'SELECT DISTINCT r.name as role_name FROM workflow_stage_roles wsr JOIN roles r ON wsr.role_id = r.id WHERE wsr.workflow_stage_id = ? AND r.is_active = 1',
          [caseData.current_workflow_stage_id]
        );
        for (const role of stageRoles) {
          const [roleUsers] = await pool.execute(
            'SELECT id FROM users WHERE role = ? AND is_active = TRUE',
            [role.role_name]
          );
          roleUsers.forEach(u => {
            if (!userIds.includes(u.id)) userIds.push(u.id);
          });
        }

        const title = `SLA Breached - Case ${caseData.case_number}`;
        const message = `Case ${caseData.case_number} for ${caseData.first_name} ${caseData.last_name} has exceeded SLA deadline by ${daysOverdue} day(s) in ${caseData.stage_name} stage.`;

        for (const userId of userIds) {
          await notificationService.createNotification(
            userId,
            caseData.case_id,
            title,
            message,
            'error'
          );
        }

        // Mark breach notification as sent
        await pool.execute(
          'UPDATE cases SET sla_breach_notification_sent_at = NOW() WHERE id = ?',
          [caseData.case_id]
        );
      }
    }

    console.log(`Checked SLA status for ${cases.length} cases`);
  } catch (error) {
    console.error('Error checking and sending SLA notifications:', error);
  }
}

module.exports = {
  convertToHours,
  calculateSLAStatus,
  updateCaseSLAStatus,
  checkAndSendSLANotifications,
  calculateBusinessHours
};

