const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get dashboard data based on user role
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let dashboardData = {};

    // Common statistics
    const [totalStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_cases,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_cases,
        SUM(CASE WHEN status = 'assigned' THEN 1 ELSE 0 END) as assigned_cases,
        SUM(CASE WHEN status = 'in_counseling' THEN 1 ELSE 0 END) as counseling_cases,
        SUM(CASE WHEN status = 'cover_letter_generated' THEN 1 ELSE 0 END) as cover_letter_cases,
        SUM(CASE WHEN status = 'submitted_to_welfare' THEN 1 ELSE 0 END) as welfare_review_cases,
        SUM(CASE WHEN status = 'welfare_approved' THEN 1 ELSE 0 END) as welfare_approved_cases,
        SUM(CASE WHEN status = 'welfare_rejected' THEN 1 ELSE 0 END) as welfare_rejected_cases,
        SUM(CASE WHEN status = 'executive_approved' THEN 1 ELSE 0 END) as executive_approved_cases,
        SUM(CASE WHEN status = 'executive_rejected' THEN 1 ELSE 0 END) as executive_rejected_cases,
        SUM(CASE WHEN status = 'finance_disbursement' THEN 1 ELSE 0 END) as finance_cases
      FROM cases
    `);

    dashboardData.totalStats = totalStats[0];

    // Role-specific data
    switch (userRole) {
      case 'admin':
        dashboardData = await getAdminDashboard(userId);
        break;
      case 'dcm':
      case 'Deputy Counseling Manager':
        dashboardData = await getDCMDashboard(userId, userRole);
        break;
      case 'ZI':
        dashboardData = await getDCMDashboard(userId, userRole);
        break;
      case 'counselor':
        dashboardData = await getCounselorDashboard(userId);
        break;
      case 'welfare_reviewer':
      case 'welfare':
        dashboardData = await getWelfareReviewerDashboard(userId);
        break;
      case 'executive':
        dashboardData = await getExecutiveDashboard(userId);
        break;
      case 'finance':
        dashboardData = await getFinanceDashboard(userId);
        break;
      default:
        dashboardData = { error: 'Invalid user role' };
    }

    res.json(dashboardData);
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent activities
router.get('/recent-activities', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let whereClause = '';
    let queryParams = [];

    // Role-based filtering for recent activities
    const { canAccessAllCases } = require('../utils/permissionUtils');
    const canAccessAll = await canAccessAllCases(userRole);
    
    if (!canAccessAll) {
      if (userRole === 'ZI' || userRole === 'Zonal Incharge') {
        // ZI can see cases in their assigned jamiat/jamaat areas
        whereClause = `WHERE (c.roles = ? OR c.assigned_counselor_id = ? OR 
          EXISTS (
            SELECT 1 FROM applicants a 
            JOIN users u ON u.id = ? 
            WHERE a.id = c.applicant_id 
            AND (FIND_IN_SET(a.jamiat_id, u.jamiat_ids) > 0 OR FIND_IN_SET(a.jamaat_id, u.jamaat_ids) > 0)
          ))`;
        queryParams = [userId, userId, userId];
      } else {
        // Other roles (DCM, counselor) can only see assigned cases
        whereClause = 'WHERE (c.roles = ? OR c.assigned_counselor_id = ?)';
        queryParams = [userId, userId];
      }
    }

    const [activities] = await pool.execute(`
      SELECT 
        sh.*,
        c.case_number,
        c.case_type,
        a.full_name as applicant_full_name,
        u.full_name as changed_by_name
      FROM status_history sh
      JOIN cases c ON sh.case_id = c.id
      JOIN applicants a ON c.applicant_id = a.id
      JOIN users u ON sh.changed_by = u.id
      ${whereClause}
      ORDER BY sh.created_at DESC
      LIMIT 10
    `, queryParams);

    res.json({ activities });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get case pipeline data for charts
router.get('/case-pipeline', authenticateToken, async (req, res) => {
  try {
    const [pipelineData] = await pool.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM cases
      GROUP BY status
      ORDER BY 
        CASE status
          WHEN 'draft' THEN 1
          WHEN 'assigned' THEN 2
          WHEN 'in_counseling' THEN 3
          WHEN 'cover_letter_generated' THEN 4
          WHEN 'submitted_to_welfare' THEN 5
          WHEN 'welfare_approved' THEN 6
          WHEN 'welfare_rejected' THEN 7
          WHEN 'executive_approved' THEN 8
          WHEN 'executive_rejected' THEN 9
          WHEN 'finance_disbursement' THEN 10
        END
    `);

    res.json({ pipelineData });
  } catch (error) {
    console.error('Get case pipeline error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions for role-specific dashboards
async function getAdminDashboard(userId) {
  const [userStats] = await pool.execute(`
    SELECT 
      COUNT(*) as total_users,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as active_users
    FROM users
  `);

  // Get role-specific counts dynamically
  const [roleCounts] = await pool.execute(`
    SELECT 
      r.name as role_name,
      COUNT(u.id) as user_count
    FROM roles r
    LEFT JOIN users u ON r.name = u.role AND u.is_active = 0
    WHERE r.is_active = 1
    GROUP BY r.id, r.name
  `);

  // Add role counts to user stats
  const roleStats = {};
  roleCounts.forEach(role => {
    roleStats[`${role.role_name}_count`] = role.user_count;
  });

  const [recentCases] = await pool.execute(`
    SELECT 
      c.*,
      a.full_name as applicant_full_name
    FROM cases c
    JOIN applicants a ON c.applicant_id = a.id
    ORDER BY c.created_at DESC
    LIMIT 5
  `);

  return {
    userStats: { ...userStats[0], ...roleStats },
    recentCases
  };
}

async function getDCMDashboard(userId, userRole = 'dcm') {
  // Build the WHERE clause based on role
  let whereClause = 'WHERE c.roles = ?';
  let queryParams = [userId];
  
  if (userRole === 'ZI' || userRole === 'Zonal Incharge') {
    // ZI can see cases in their assigned jamiat/jamaat areas
    whereClause = `WHERE (c.roles = ? OR c.assigned_counselor_id = ? OR 
      EXISTS (
        SELECT 1 FROM applicants a 
        JOIN users u ON u.id = ? 
        WHERE a.id = c.applicant_id 
        AND (FIND_IN_SET(a.jamiat_id, u.jamiat_ids) > 0 OR FIND_IN_SET(a.jamaat_id, u.jamaat_ids) > 0)
      ))`;
    queryParams = [userId, userId, userId];
  }

  const [assignedCases] = await pool.execute(`
    SELECT 
      COUNT(*) as total_assigned,
      SUM(CASE WHEN c.status = 'assigned' THEN 1 ELSE 0 END) as pending_assignment,
      SUM(CASE WHEN c.status = 'in_counseling' THEN 1 ELSE 0 END) as in_counseling,
      SUM(CASE WHEN c.status = 'cover_letter_generated' THEN 1 ELSE 0 END) as cover_letter_ready,
      SUM(CASE WHEN c.status = 'submitted_to_welfare' THEN 1 ELSE 0 END) as submitted_for_review
    FROM cases c
    ${whereClause}
  `, queryParams);

  const [recentAssignedCases] = await pool.execute(`
    SELECT 
      c.*,
      a.full_name as applicant_full_name
    FROM cases c
    JOIN applicants a ON c.applicant_id = a.id
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT 5
  `, queryParams);

  return {
    assignedCases: assignedCases[0],
    recentAssignedCases
  };
}

async function getCounselorDashboard(userId) {
  const [counselorCases] = await pool.execute(`
    SELECT 
      COUNT(*) as total_assigned,
      SUM(CASE WHEN status = 'in_counseling' THEN 1 ELSE 0 END) as active_counseling
    FROM cases
    WHERE assigned_counselor_id = ?
  `, [userId]);

  const [recentCounselorCases] = await pool.execute(`
    SELECT 
      c.*,
      a.full_name as applicant_full_name
    FROM cases c
    JOIN applicants a ON c.applicant_id = a.id
    WHERE c.assigned_counselor_id = ?
    ORDER BY c.created_at DESC
    LIMIT 5
  `, [userId]);

  return {
    counselorCases: counselorCases[0],
    recentCounselorCases
  };
}

async function getWelfareReviewerDashboard(userId) {
  const [reviewCases] = await pool.execute(`
    SELECT 
      SUM(CASE WHEN status = 'submitted_to_welfare' THEN 1 ELSE 0 END) as pending_review,
      SUM(CASE WHEN status = 'welfare_approved' THEN 1 ELSE 0 END) as approved_cases,
      SUM(CASE WHEN status = 'welfare_rejected' THEN 1 ELSE 0 END) as rejected_cases
    FROM cases
  `);

  const [pendingReviewCases] = await pool.execute(`
    SELECT 
      c.*,
      a.full_name as applicant_full_name
    FROM cases c
    JOIN applicants a ON c.applicant_id = a.id
    WHERE c.status = 'submitted_to_welfare'
    ORDER BY c.created_at ASC
    LIMIT 5
  `);

  return {
    reviewCases: reviewCases[0],
    pendingReviewCases
  };
}

async function getExecutiveDashboard(userId) {
  const [executiveCases] = await pool.execute(`
    SELECT 
      SUM(CASE WHEN status = 'welfare_approved' THEN 1 ELSE 0 END) as pending_approval,
      SUM(CASE WHEN status = 'executive_approved' THEN 1 ELSE 0 END) as approved_cases,
      SUM(CASE WHEN status = 'executive_rejected' THEN 1 ELSE 0 END) as rejected_cases
    FROM cases
  `);

  const [pendingApprovalCases] = await pool.execute(`
    SELECT 
      c.*,
      a.full_name as applicant_full_name
    FROM cases c
    JOIN applicants a ON c.applicant_id = a.id
    WHERE c.status = 'welfare_approved'
    ORDER BY c.created_at ASC
    LIMIT 5
  `);

  return {
    executiveCases: executiveCases[0],
    pendingApprovalCases
  };
}

async function getFinanceDashboard(userId) {
  const [financeCases] = await pool.execute(`
    SELECT 
      SUM(CASE WHEN status = 'executive_approved' THEN 1 ELSE 0 END) as pending_disbursement,
      SUM(CASE WHEN status = 'finance_disbursement' THEN 1 ELSE 0 END) as disbursed_cases
    FROM cases
  `);

  const [pendingDisbursementCases] = await pool.execute(`
    SELECT 
      c.*,
      a.full_name as applicant_full_name
    FROM cases c
    JOIN applicants a ON c.applicant_id = a.id
    WHERE c.status = 'executive_approved'
    ORDER BY c.created_at ASC
    LIMIT 5
  `);

  return {
    financeCases: financeCases[0],
    pendingDisbursementCases
  };
}

module.exports = router;
