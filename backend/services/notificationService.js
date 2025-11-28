const { pool } = require('../config/database');
const emailService = require('./emailService');

class NotificationService {
  async createNotification(userId, caseId, title, message, type = 'info') {
    try {
      const [result] = await pool.execute(
        'INSERT INTO notifications (user_id, case_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
        [userId, caseId, title, message, type]
      );
      return result.insertId;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  async sendCaseStatusNotification(caseId, fromStatus, toStatus, changedBy, comments = '') {
    try {
      // Get case details
      const [cases] = await pool.execute(`
        SELECT 
          c.*,
          a.first_name as applicant_first_name,
          a.last_name as applicant_last_name,
          a.its_number
        FROM cases c
        JOIN applicants a ON c.applicant_id = a.id
        WHERE c.id = ?
      `, [caseId]);

      if (cases.length === 0) {
        console.error('Case not found for notification:', caseId);
        return;
      }

      const caseData = cases[0];

      // Get users to notify based on case assignment and role
      const [users] = await pool.execute(`
        SELECT DISTINCT u.*
        FROM users u
        WHERE u.is_active = 0 
        AND (
          u.id = ? OR 
          u.id = ? OR 
          u.id = ? OR
          u.role IN ('admin', 'welfare_reviewer', 'executive')
        )
      `, [caseData.roles, caseData.assigned_counselor_id, changedBy]);

      const statusLabels = {
        draft: 'Draft',
        assigned: 'Assigned',
        in_counseling: 'In Counseling',
        cover_letter_generated: 'Cover Letter Generated',
        submitted_to_welfare: 'Submitted to Welfare',
        welfare_approved: 'Welfare Approved',
        welfare_rejected: 'Welfare Rejected',
        executive_approved: 'Executive Approved',
        executive_rejected: 'Executive Rejected',
        finance_disbursement: 'Finance Disbursement',
      };

      const title = `Case ${caseData.case_number} - Status Update`;
      const message = `Case status changed from "${statusLabels[fromStatus] || 'N/A'}" to "${statusLabels[toStatus]}". ${comments ? `Comments: ${comments}` : ''}`;

      // Create notifications and send emails
      for (const user of users) {
        // Create in-app notification
        await this.createNotification(
          user.id,
          caseId,
          title,
          message,
          toStatus.includes('rejected') ? 'error' : 'info'
        );

        // Send email notification
        await emailService.sendCaseStatusNotification(
          user,
          caseData,
          { fromStatus, toStatus, comments }
        );
      }

      console.log(`Sent status notifications for case ${caseId} to ${users.length} users`);
    } catch (error) {
      console.error('Failed to send case status notifications:', error);
    }
  }

  async sendCaseAssignmentNotification(caseId, assignedDcmId, assignedCounselorId, assignedBy) {
    try {
      // Get case details
      const [cases] = await pool.execute(`
        SELECT 
          c.*,
          a.first_name as applicant_first_name,
          a.last_name as applicant_last_name,
          a.its_number
        FROM cases c
        JOIN applicants a ON c.applicant_id = a.id
        WHERE c.id = ?
      `, [caseId]);

      if (cases.length === 0) {
        console.error('Case not found for assignment notification:', caseId);
        return;
      }

      const caseData = cases[0];

      // Get assigned users
      const [assignedUsers] = await pool.execute(`
        SELECT u.*
        FROM users u
        WHERE u.id IN (?, ?) AND u.is_active = 0
      `, [assignedDcmId, assignedCounselorId]);

      const title = `New Case Assignment - ${caseData.case_number}`;
      const message = `You have been assigned to case ${caseData.case_number} for ${caseData.applicant_first_name} ${caseData.applicant_last_name}.`;

      // Create notifications and send emails
      for (const user of assignedUsers) {
        // Create in-app notification
        await this.createNotification(
          user.id,
          caseId,
          title,
          message,
          'info'
        );

        // Send email notification
        await emailService.sendCaseAssignmentNotification(
          user,
          caseData,
          assignedBy
        );
      }

      console.log(`Sent assignment notifications for case ${caseId} to ${assignedUsers.length} users`);
    } catch (error) {
      console.error('Failed to send case assignment notifications:', error);
    }
  }

  async sendFormCompletionNotification(caseId) {
    try {
      // Get case details
      const [cases] = await pool.execute(`
        SELECT 
          c.*,
          a.first_name as applicant_first_name,
          a.last_name as applicant_last_name,
          a.its_number
        FROM cases c
        JOIN applicants a ON c.applicant_id = a.id
        WHERE c.id = ?
      `, [caseId]);

      if (cases.length === 0) {
        console.error('Case not found for form completion notification:', caseId);
        return;
      }

      const caseData = cases[0];

      // Get users to notify (welfare reviewers and admins)
      const [users] = await pool.execute(`
        SELECT u.*
        FROM users u
        WHERE u.is_active = 0 
        AND u.role IN ('admin', 'welfare_reviewer')
      `);

      const title = `Counseling Form Completed - ${caseData.case_number}`;
      const message = `The counseling form for case ${caseData.case_number} has been completed and is ready for review.`;

      // Create notifications and send emails
      for (const user of users) {
        // Create in-app notification
        await this.createNotification(
          user.id,
          caseId,
          title,
          message,
          'success'
        );

        // Send email notification
        await emailService.sendFormCompletionNotification(
          user,
          caseData
        );
      }

      console.log(`Sent form completion notifications for case ${caseId} to ${users.length} users`);
    } catch (error) {
      console.error('Failed to send form completion notifications:', error);
    }
  }

  async sendCoverLetterGeneratedNotification(caseId, generatedBy) {
    try {
      // Get case details
      const [cases] = await pool.execute(`
        SELECT 
          c.*,
          a.first_name as applicant_first_name,
          a.last_name as applicant_last_name,
          a.its_number
        FROM cases c
        JOIN applicants a ON c.applicant_id = a.id
        WHERE c.id = ?
      `, [caseId]);

      if (cases.length === 0) {
        console.error('Case not found for cover letter notification:', caseId);
        return;
      }

      const caseData = cases[0];

      // Get users to notify (welfare reviewers and admins)
      const [users] = await pool.execute(`
        SELECT u.*
        FROM users u
        WHERE u.is_active = 0 
        AND u.role IN ('admin', 'welfare_reviewer')
      `);

      const title = `Cover Letter Generated - ${caseData.case_number}`;
      const message = `A cover letter has been generated for case ${caseData.case_number} and is ready for review.`;

      // Create notifications
      for (const user of users) {
        await this.createNotification(
          user.id,
          caseId,
          title,
          message,
          'info'
        );
      }

      console.log(`Sent cover letter notifications for case ${caseId} to ${users.length} users`);
    } catch (error) {
      console.error('Failed to send cover letter notifications:', error);
    }
  }

  async markNotificationAsRead(notificationId, userId) {
    try {
      await pool.execute(
        'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
        [notificationId, userId]
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  async markAllNotificationsAsRead(userId) {
    try {
      await pool.execute(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
        [userId]
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  async getUnreadNotificationCount(userId) {
    try {
      const [result] = await pool.execute(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
        [userId]
      );
      return result[0].count;
    } catch (error) {
      console.error('Failed to get unread notification count:', error);
      throw error;
    }
  }
}

module.exports = new NotificationService();
